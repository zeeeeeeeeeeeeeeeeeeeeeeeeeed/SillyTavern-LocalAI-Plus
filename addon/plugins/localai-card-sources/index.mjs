// local.ai+ — серверный посредник для «Каталога персонажей».
//
// Зачем он нужен:
//  * часть сайтов не пускает браузер напрямую (CORS) — запросы к ним идут через сервер SillyTavern;
//  * картинки уменьшаются до лёгких превью и кэшируются на диске;
//  * если сайт заблокирован у провайдера, прямое соединение и прокси (VPN) «соревнуются» —
//    побеждает первый ответивший, и этот путь запоминается для сайта.
// Ходит ТОЛЬКО на хосты из ALLOWED_HOSTS — это не открытый прокси.
//
// Прокси задаётся в config.json рядом с этим файлом:
//   "proxy": "auto"  — системный прокси Windows или переменная HTTPS_PROXY (по умолчанию)
//   "proxy": "off"   — только напрямую
//   "proxy": "http://127.0.0.1:10809" — конкретный адрес

import { execFileSync } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import fetch from 'node-fetch';
import { HttpsProxyAgent } from 'https-proxy-agent';
import { Jimp, JimpMime } from '../../src/jimp.js';

export const info = {
    id: 'localai-card-sources',
    name: 'local.ai+ card sources',
    description: 'Search/download proxy for the local.ai+ character catalog (chub.ai, Pygmalion, RisuRealm).',
};

const PLUGIN_DIR = path.dirname(fileURLToPath(import.meta.url));
const THUMB_DIR = path.join(PLUGIN_DIR, 'thumbs');
const THUMB_W = 240;
const THUMB_H = 320;
const HEAD_START_MS = 2500;   // сколько ждём первый путь, прежде чем параллельно запустить второй
const TOTAL_TIMEOUT_MS = 120000;
const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36';

const ALLOWED_HOSTS = new Set([
    'api.chub.ai',
    'avatars.charhub.io',
    'server.pygmalion.chat',
    'assets.pygmalion.chat',
    'realm.risuai.net',
    'sv.risuai.xyz',
]);
const IMAGE_HOSTS = new Set(['avatars.charhub.io', 'assets.pygmalion.chat', 'sv.risuai.xyz']);

// ------------------------------------------------------------------ прокси

function readConfig() {
    try {
        return JSON.parse(fs.readFileSync(path.join(PLUGIN_DIR, 'config.json'), 'utf8'));
    } catch {
        return {};
    }
}

/** Системный прокси Windows (его выставляют VPN-клиенты: v2rayN, Hiddify, NekoRay и т.п.). */
function windowsSystemProxy() {
    if (process.platform !== 'win32') return null;
    try {
        const key = 'HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Internet Settings';
        const out = execFileSync('reg', ['query', key], { encoding: 'utf8', windowsHide: true });
        if (!/ProxyEnable\s+REG_DWORD\s+0x1\b/i.test(out)) return null;
        const server = out.match(/ProxyServer\s+REG_SZ\s+(\S+)/i)?.[1];
        if (!server) return null;
        // Бывает «host:port» или «http=host:port;https=host:port»
        const value = server.match(/https=([^;]+)/i)?.[1] || server.match(/http=([^;]+)/i)?.[1] || server;
        return value.includes('://') ? value : `http://${value}`;
    } catch {
        return null;
    }
}

let proxyCache = { value: null, at: 0 };

/** Адрес прокси для запасного пути или null. Перечитывается раз в минуту (VPN могут включить/выключить). */
function currentProxy() {
    if (Date.now() - proxyCache.at < 60000) return proxyCache.value;
    const setting = String(readConfig().proxy ?? 'auto').trim();
    let value = null;
    if (/^https?:\/\//i.test(setting)) value = setting;
    else if (setting.toLowerCase() === 'auto') value = process.env.HTTPS_PROXY || process.env.HTTP_PROXY || windowsSystemProxy();
    proxyCache = { value, at: Date.now() };
    return value;
}

// ------------------------------------------------------------------ загрузка

/** Скачивает ответ целиком. Обрыв может случиться посреди большого файла — поэтому тело читается внутри попытки. */
async function download(url, options, route, proxy, signal) {
    const agent = route === 'proxy' ? new HttpsProxyAgent(proxy) : undefined;
    const result = await fetch(url, { ...options, agent, signal });
    const buffer = Buffer.from(await result.arrayBuffer());
    return { ok: result.ok, status: result.status, contentType: result.headers.get('content-type'), buffer, route };
}

// Какой путь сработал для хоста в последний раз ('direct' | 'proxy') — его пробуем первым
const preferredRoute = new Map();

/**
 * Без прокси — просто прямой запрос. С прокси — «гонка»: первый путь стартует сразу, второй — через 2,5 с,
 * если первый ещё не ответил (или сразу, если первый упал). У заблокированных сайтов прямое соединение
 * часто не рвётся, а висит — поэтому его не ждём до конца.
 */
async function upstream(url, options) {
    const host = new URL(url).hostname;
    const proxy = currentProxy();
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), TOTAL_TIMEOUT_MS);

    try {
        if (!proxy) return await download(url, options, 'direct', null, controller.signal);

        const first = preferredRoute.get(host) || 'direct';
        const second = first === 'direct' ? 'proxy' : 'direct';
        return await new Promise((resolve, reject) => {
            let failures = 0;
            let attempts = 0;
            let settled = false;
            let headStart;
            const attempt = route => {
                attempts++;
                // .catch в конце: ни одна ошибка (в т.ч. отмена проигравшего пути) не должна уронить сервер
                download(url, options, route, proxy, controller.signal).then(
                    res => {
                        if (settled) return;
                        settled = true;
                        clearTimeout(headStart);
                        if (preferredRoute.get(host) !== route) console.info(`[local.ai+] ${host}: быстрее ${route === 'proxy' ? 'через прокси' : 'напрямую'}`);
                        preferredRoute.set(host, route);
                        controller.abort();  // второй путь больше не нужен
                        resolve(res);
                    },
                    err => {
                        if (settled) return;
                        if (++failures === 2) {  // упали оба пути
                            settled = true;
                            clearTimeout(headStart);
                            return reject(err);
                        }
                        startSecond();
                    },
                ).catch(() => {});
            };
            const startSecond = () => {
                if (settled || attempts > 1) return;
                clearTimeout(headStart);
                attempt(second);
            };
            attempt(first);
            headStart = setTimeout(startSecond, HEAD_START_MS);
        });
    } finally {
        clearTimeout(timeout);
    }
}

function parseImageUrl(raw) {
    try {
        const url = new URL(String(raw || ''));
        return url.protocol === 'https:' && IMAGE_HOSTS.has(url.hostname) ? url : null;
    } catch {
        return null;
    }
}

// ------------------------------------------------------------------ маршруты: /api/plugins/localai-card-sources/...

export async function init(router) {
    router.use(express.json({ limit: '1mb' }));
    fs.mkdirSync(THUMB_DIR, { recursive: true });

    // GET /status — для диагностики: какой прокси используется
    router.get('/status', (_request, response) => {
        response.json({ ok: true, proxy: currentProxy(), routes: Object.fromEntries(preferredRoute) });
    });

    // GET /thumb?url=...  — превью 240×320 JPEG (~10 КБ), из кэша или свежее
    router.get('/thumb', async (request, response) => {
        const target = parseImageUrl(request.query.url);
        if (!target) return response.status(403).send('host not allowed');
        const cached = path.join(THUMB_DIR, crypto.createHash('sha1').update(target.href).digest('hex') + '.jpg');
        response.set('Cache-Control', 'public, max-age=604800');
        if (fs.existsSync(cached)) return response.type('image/jpeg').sendFile(cached);
        try {
            const result = await upstream(target.href, { headers: { 'User-Agent': USER_AGENT } });
            if (!result.ok) return response.status(result.status).end();
            const image = await Jimp.read(result.buffer);
            image.cover({ w: THUMB_W, h: THUMB_H });
            const buffer = await image.getBuffer(JimpMime.jpeg, { quality: 82, jpegColorSpace: 'ycbcr' });
            fs.writeFileSync(cached, buffer);
            response.type('image/jpeg').send(buffer);
        } catch (error) {
            console.warn('[local.ai+] превью не получилось:', target.hostname, String(error?.message || error).slice(0, 300));
            response.status(502).end();
        }
    });

    // GET /img?url=...  — аватарки и PNG-карточки в полном размере
    router.get('/img', async (request, response) => {
        const target = parseImageUrl(request.query.url);
        if (!target) return response.status(403).send('host not allowed');
        try {
            const result = await upstream(target.href, { headers: { 'User-Agent': USER_AGENT } });
            if (!result.ok) return response.status(result.status).end();
            response.set('Content-Type', result.contentType || 'image/png');
            response.set('Cache-Control', 'public, max-age=86400');
            response.send(result.buffer);
        } catch (error) {
            response.status(502).send(error.message);
        }
    });

    // POST /fetch  { url, method?, body? }  — запросы к API сайтов с карточками
    router.post('/fetch', async (request, response) => {
        let target;
        try {
            target = new URL(String(request.body?.url || ''));
        } catch {
            return response.status(400).send('bad url');
        }
        if (target.protocol !== 'https:' || !ALLOWED_HOSTS.has(target.hostname)) {
            return response.status(403).send('host not allowed');
        }

        const method = request.body.method === 'POST' ? 'POST' : 'GET';
        const headers = { 'User-Agent': USER_AGENT, 'Accept': '*/*' };
        let body;
        if (method === 'POST' && request.body.body !== undefined) {
            headers['Content-Type'] = 'application/json';
            body = JSON.stringify(request.body.body);
        }

        try {
            const result = await upstream(target.href, { method, headers, body });
            response.status(result.status);
            response.set('Content-Type', result.contentType || 'application/octet-stream');
            response.send(result.buffer);
        } catch (error) {
            console.error('[local.ai+]', target.hostname, error.message);
            response.status(502).send(`Сайт ${target.hostname} недоступен: ${error.message}`);
        }
    });
}

export async function exit() {}
