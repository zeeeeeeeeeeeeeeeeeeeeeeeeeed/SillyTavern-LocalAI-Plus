// local.ai+ · Каталог персонажей: поиск карточек на chub.ai, Pygmalion и RisuRealm и добавление в SillyTavern
// в один клик. Всё, что приходит с сайтов, выводится только как текст (textContent).
// Сайты, которые не пускают браузер напрямую, опрашиваются через серверный плагин
// SillyTavern/plugins/localai-card-sources (он же выручает, если сайт заблокирован у провайдера).

import { importFromExternalUrl } from '../../../utils.js';
import { processDroppedFiles, getRequestHeaders } from '../../../../script.js';
import { t, ready } from '../localai-core/i18n.js';

const PAGE_SIZE = 24;
const PROXY = '/api/plugins/localai-card-sources';

// Карточки с этими тегами не показываются никогда
const BLOCKED_TOPICS = ['loli', 'lolicon', 'shota', 'shotacon', 'child', 'children', 'underage', 'minor', 'minors', 'kid', 'kids', 'toddler'];

const IMAGE_HOSTS = ['https://avatars.charhub.io/', 'https://assets.pygmalion.chat/', 'https://sv.risuai.xyz/'];

const ctx = () => SillyTavern.getContext();

// ================================================================== общие помощники

function el(tag, cls, text) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text !== undefined && text !== null) e.textContent = String(text);
    return e;
}

/** HTML/Markdown-описание → простой текст. DOMParser не выполняет скрипты. */
function htmlToText(html) {
    if (!html) return '';
    const doc = new DOMParser().parseFromString(String(html), 'text/html');
    return (doc.body.textContent || '').replace(/\n{3,}/g, '\n\n').trim();
}

function isBlocked(tags) {
    return (tags || []).some(t => BLOCKED_TOPICS.includes(String(t).toLowerCase()));
}

function formatCount(n) {
    if (typeof n === 'string' && /[a-z]/i.test(n)) return n;  // RisuRealm отдаёт уже «18.5k»
    n = Number(n) || 0;
    if (n >= 1e6) return (n / 1e6).toFixed(1).replace('.0', '') + t('catalog.million');
    if (n >= 1e3) return (n / 1e3).toFixed(1).replace('.0', '') + t('catalog.thousand');
    return String(n);
}

function findLocalCharacter(name) {
    return ctx().characters.findIndex(c => c.name === name);
}

/**
 * Картинка персонажа.
 * thumb=true (сетка каталога): лёгкое превью 240×320 с ПК (уменьшено и закэшировано плагином),
 *   при ошибке — оригинал напрямую.
 * thumb=false (страница персонажа): оригинал напрямую, при ошибке — через ПК (телефон без VPN).
 */
function setImage(img, url, thumb = false) {
    if (!IMAGE_HOSTS.some(h => String(url || '').startsWith(h))) {
        img.src = 'img/ai4.png';
        return;
    }
    const viaPc = `${PROXY}/${thumb ? 'thumb' : 'img'}?url=${encodeURIComponent(url)}`;
    const [first, second] = thumb ? [viaPc, url] : [url, viaPc];
    img.src = first;
    img.onerror = () => {
        img.onerror = null;
        img.src = second;
    };
}

/** Запрос через серверный плагин (для сайтов без CORS или заблокированных). */
async function proxyFetch(url, { method = 'GET', body } = {}) {
    const res = await fetch(`${PROXY}/fetch`, {
        method: 'POST',
        headers: getRequestHeaders(),
        body: JSON.stringify({ url, method, body }),
    });
    if (res.status === 404) throw new Error(t('catalog.err.pluginMissing'));
    if (!res.ok) throw new Error((await res.text()).slice(0, 200) || t('catalog.err.http', { status: res.status }));
    return res;
}

/** Распаковка ответа SvelteKit (__data.json, формат devalue). */
function unflatten(data) {
    const memo = new Map();
    const resolve = index => {
        if (typeof index !== 'number') return index;
        if (index < 0) return undefined;
        if (memo.has(index)) return memo.get(index);
        const value = data[index];
        if (Array.isArray(value)) {
            if (typeof value[0] === 'string' && ['Date', 'Set', 'Map', 'Promise', 'RegExp', 'BigInt', 'null'].includes(value[0])) {
                memo.set(index, value[0] === 'Date' ? value[1] : null);
                return memo.get(index);
            }
            const out = [];
            memo.set(index, out);
            for (const item of value) out.push(resolve(item));
            return out;
        }
        if (value && typeof value === 'object') {
            const out = {};
            memo.set(index, out);
            for (const [key, item] of Object.entries(value)) out[key] = resolve(item);
            return out;
        }
        memo.set(index, value);
        return value;
    };
    return resolve(0);
}

// ---- сборка PNG-карточки в браузере (картинка + данные персонажа в чанке tEXt «chara») ----

const CRC_TABLE = (() => {
    const table = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
        let c = n;
        for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1;
        table[n] = c >>> 0;
    }
    return table;
})();

function crc32(bytes) {
    let c = 0xFFFFFFFF;
    for (const b of bytes) c = CRC_TABLE[(c ^ b) & 0xFF] ^ (c >>> 8);
    return (c ^ 0xFFFFFFFF) >>> 0;
}

/** Любая картинка (webp/jpg/png) → PNG со вшитой карточкой персонажа, как у SillyTavern. */
async function buildCardPng(imageBlob, card) {
    const bitmap = await createImageBitmap(imageBlob);
    const canvas = document.createElement('canvas');
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    canvas.getContext('2d').drawImage(bitmap, 0, 0);
    const png = new Uint8Array(await (await new Promise(r => canvas.toBlob(r, 'image/png'))).arrayBuffer());

    const json = new TextEncoder().encode(JSON.stringify(card));
    let binary = '';
    for (const b of json) binary += String.fromCharCode(b);
    const data = new TextEncoder().encode('chara\0' + btoa(binary));
    const type = new TextEncoder().encode('tEXt');
    const chunk = new Uint8Array(12 + data.length);
    const view = new DataView(chunk.buffer);
    view.setUint32(0, data.length);
    chunk.set(type, 4);
    chunk.set(data, 8);
    view.setUint32(8 + data.length, crc32(new Uint8Array([...type, ...data])));

    const iend = png.length - 12;  // tEXt вставляется перед последним чанком IEND
    const out = new Uint8Array(png.length + chunk.length);
    out.set(png.subarray(0, iend), 0);
    out.set(chunk, iend);
    out.set(png.subarray(iend), iend + chunk.length);
    return new Blob([out], { type: 'image/png' });
}

async function importPng(url, fileName) {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    await processDroppedFiles([new File([await res.blob()], fileName, { type: 'image/png' })]);
}

// ================================================================== источники

const GENRES = [
    ['', 'all'], ['Fantasy', 'fantasy'], ['Romance', 'romance'], ['Anime', 'anime'],
    ['Horror', 'horror'], ['Adventure', 'adventure'], ['Sci-Fi', 'scifi'], ['Comedy', 'comedy'],
    ['Drama', 'drama'], ['Mystery', 'mystery'], ['Slice of Life', 'sliceOfLife'], ['Historical', 'historical'],
    ['Isekai', 'isekai'], ['RPG', 'rpg'], ['Game Characters', 'games'], ['Movies & TV', 'movies'],
    ['Monster', 'monster'], ['Villain', 'villain'], ['Yandere', 'yandere'], ['Tsundere', 'tsundere'],
    ['Multiple Characters', 'multiple'], ['Female', 'female'], ['Male', 'male'],
].map(([value, key]) => [value, `catalog.genre.${key}`]);

const LANGUAGES = ['', 'ru', 'en', 'uk', 'ja', 'zh', 'ko', 'es', 'de', 'fr', 'pt']
    .map(code => [code, `catalog.lang.${code || 'any'}`]);

const SIZES = [['', 'any'], ['s', 'small'], ['m', 'medium'], ['l', 'large']]
    .map(([value, key]) => [value, `catalog.size.${key}`]);

const FRESHNESS = [['', 'any'], ['7', 'week'], ['30', 'month'], ['365', 'year']]
    .map(([value, key]) => [value, `catalog.fresh.${key}`]);

const SOURCES = {
    chub: {
        label: 'chub.ai',
        note: 'catalog.source.chub',
        sorts: ['star_count', 'trending_downloads', 'created_at', 'rating', 'n_favorites'],
        features: ['genre', 'language', 'size', 'freshness', 'nsfw', 'russianTheme', 'altGreetings', 'lorebook'],
        siteUrl: item => `https://chub.ai/characters/${item.id}`,

        async search(f, page) {
            const tags = [f.genre, f.russianTheme ? 'Russian' : ''].filter(Boolean).join(',');
            const p = new URLSearchParams({
                search: f.search, first: String(PAGE_SIZE), page: String(page), sort: f.sort, asc: 'false',
                nsfw: String(f.nsfw), include_forks: 'true', excludetopics: BLOCKED_TOPICS.join(','),
            });
            if (tags) p.set('tags', tags);
            if (f.language) p.set('language', f.language);
            if (f.size === 's') p.set('max_tokens', '1000');
            if (f.size === 'm') { p.set('min_tokens', '1000'); p.set('max_tokens', '2500'); }
            if (f.size === 'l') p.set('min_tokens', '2500');
            if (f.freshness) p.set('max_days_ago', f.freshness);
            if (f.altGreetings) p.set('require_alternate_greetings', 'true');
            if (f.lorebook) p.set('require_lore', 'true');
            const url = `https://api.chub.ai/search?${p}`;
            let res;
            try {
                res = await fetch(url, { headers: { Accept: 'application/json' } });
                if (!res.ok) throw new Error(t('catalog.err.http', { status: res.status }));
            } catch {
                res = await proxyFetch(url);  // браузер не достучался — пробуем через сервер
            }
            const data = (await res.json()).data || {};
            const items = (data.nodes || []).map(n => ({
                source: 'chub', id: n.fullPath, name: n.name,
                author: String(n.fullPath || '').split('/')[0],
                tagline: htmlToText(n.tagline || n.description),
                avatar: n.avatar_url, bigAvatar: n.max_res_url || n.avatar_url,
                stats: [['★', n.starCount], ['💬', n.nChats]], tokens: n.nTokens,
                tags: n.topics || [],
            }));
            return { items, total: data.count || 0 };
        },

        async details(item) {
            const url = `https://api.chub.ai/api/characters/${item.id}?full=true`;
            let res;
            try {
                res = await fetch(url, { headers: { Accept: 'application/json' } });
                if (!res.ok) throw new Error();
            } catch {
                res = await proxyFetch(url);
            }
            const def = (await res.json()).node?.definition || {};
            return { description: htmlToText(def.description), firstMessage: def.first_message, altGreetings: (def.alternate_greetings || []).length };
        },

        async import(item) {
            const png = `https://avatars.charhub.io/avatars/${item.id}/chara_card_v2.png`;
            const fileName = item.id.split('/').pop() + '.png';
            try {
                await importPng(png, fileName);                                 // через браузер
            } catch {
                try {
                    await importPng(`${PROXY}/img?url=${encodeURIComponent(png)}`, fileName);  // через сервер (+VPN)
                } catch {
                    await importFromExternalUrl(`https://chub.ai/characters/${item.id}`);   // встроенный импорт
                }
            }
        },
    },

    pygmalion: {
        label: 'Pygmalion',
        note: 'catalog.source.pygmalion',
        sorts: ['downloads', 'stars', 'views', 'approved_at'],
        features: [],
        siteUrl: item => `https://pygmalion.chat/character/${item.id}`,

        async search(f, page) {
            const res = await proxyFetch('https://server.pygmalion.chat/galatea.v1.PublicCharacterService/CharacterSearch', {
                method: 'POST',
                body: { query: f.search, pageSize: PAGE_SIZE, orderBy: f.sort, page },
            });
            const data = await res.json();
            const items = (data.characters || []).map(c => ({
                source: 'pygmalion', id: c.id, name: c.displayName,
                author: c.owner?.displayName || c.owner?.username || '—',
                tagline: htmlToText(c.description),
                avatar: c.avatarUrl, bigAvatar: c.avatarUrl,
                stats: [['★', c.stars], ['⬇', c.downloads], ['💬', c.chatCount]], tokens: c.personalityTokenCount,
                tags: (c.tags || []).map(t => t.name || t).filter(Boolean),
            }));
            return { items, total: Number(data.totalItems) || 0 };
        },

        async details(item) {
            const res = await proxyFetch(`https://server.pygmalion.chat/api/export/character/${item.id}/v2`);
            const d = (await res.json()).character?.data || {};
            return { description: htmlToText(d.creator_notes || d.description), firstMessage: d.first_mes, altGreetings: (d.alternate_greetings || []).length };
        },

        async import(item) {
            // Встроенный импорт SillyTavern качает аватарку напрямую и виснет, если assets.pygmalion.chat
            // заблокирован. Поэтому данные и картинку берём через плагин (с запасным путём через VPN)
            // и собираем PNG-карточку сами.
            const res = await proxyFetch(`https://server.pygmalion.chat/api/export/character/${item.id}/v2`);
            const card = (await res.json()).character;
            if (!card?.data?.name) throw new Error(t('catalog.err.noData', { site: 'Pygmalion' }));
            const fileName = `${card.data.name.replace(/[\\/:*?"<>|]/g, '_')}`;
            const avatarUrl = card.data.avatar || item.avatar;
            let file;
            try {
                const img = await fetch(`${PROXY}/img?url=${encodeURIComponent(avatarUrl)}`);
                if (!img.ok) throw new Error(`avatar: HTTP ${img.status}`);
                file = new File([await buildCardPng(await img.blob(), card)], `${fileName}.png`, { type: 'image/png' });
            } catch (err) {
                console.warn('[local.ai+ catalog] Pygmalion avatar failed, importing without it', err);
                file = new File([JSON.stringify(card)], `${fileName}.json`, { type: 'application/json' });
            }
            await processDroppedFiles([file]);
        },
    },

    risu: {
        label: 'RisuRealm',
        note: 'catalog.source.risu',
        sorts: ['recommended', 'date'],
        features: ['nsfw'],
        siteUrl: item => `https://realm.risuai.net/character/${item.id}`,

        async search(f, page) {
            const p = new URLSearchParams({ q: f.search, nsfw: String(f.nsfw) });
            if (f.sort !== 'recommended') p.set('sort', f.sort);
            if (page > 1) {
                if (f.sort === 'recommended' && !f.search) return { items: [], total: 0 };
                p.set('page', String(page));
            }
            const res = await proxyFetch(`https://realm.risuai.net/__data.json?${p}`);
            const json = JSON.parse((await res.text()).split('\n')[0]);
            const node = (json.nodes || []).find(n => n?.type === 'data' && n.data);
            const root = node ? unflatten(node.data) : {};
            const items = (root.cards || []).map(c => ({
                source: 'risu', id: c.id, name: c.name, author: c.authorname || '—',
                tagline: htmlToText(c.desc),
                avatar: c.img ? `https://sv.risuai.xyz/resource/${c.img}` : '', bigAvatar: c.img ? `https://sv.risuai.xyz/resource/${c.img}` : '',
                stats: [['⬇', c.download]], tokens: null,
                tags: c.tags || [],
            }));
            return { items, total: items.length ? Infinity : 0 };
        },

        async details(item) {
            return { description: item.tagline, firstMessage: null, altGreetings: 0 };
        },

        async import(item) {
            // Большинство авторов на RisuRealm запрещают PNG, но разрешают CharX (zip с карточкой) —
            // SillyTavern умеет импортировать оба формата.
            const download = format => fetch(`${PROXY}/fetch`, {
                method: 'POST',
                headers: getRequestHeaders(),
                body: JSON.stringify({ url: `https://realm.risuai.net/api/v1/download/${format}/${item.id}?non_commercial=true` }),
            });
            let res = await download('png-v3');
            let ext = 'png';
            if (res.status === 403) {
                res = await download('charx-v3');
                ext = 'charx';
            }
            if (res.status === 403) throw new Error(t('catalog.err.risuForbidden'));
            if (!res.ok) throw new Error(t('catalog.err.http', { status: res.status }));
            const blob = await res.blob();
            await processDroppedFiles([new File([blob], `${item.id}.${ext}`, { type: ext === 'png' ? 'image/png' : 'application/zip' })]);
        },
    },
};

// ================================================================== состояние

const filters = {
    source: 'chub',
    search: '',
    sort: 'star_count',
    genre: '',
    language: '',
    size: '',
    freshness: '',
    nsfw: true,
    russianTheme: false,
    altGreetings: false,
    lorebook: false,
};

const state = { page: 1, loading: false, done: false, requestId: 0, shown: 0 };

// ================================================================== интерфейс

let overlay, grid, status, moreBtn, detail, sourceNote, sortRow, filterBox, filterToggle;

function buildOverlay() {
    overlay = el('div', 'cl-overlay');
    overlay.id = 'cl-overlay';

    const header = el('div', 'cl-header');
    const titleBox = el('div', 'cl-titlebox');
    titleBox.append(el('div', 'cl-title', t('catalog.title')), el('div', 'cl-subtitle', t('catalog.subtitle')));
    const close = el('button', 'cl-close fa-solid fa-xmark');
    close.title = t('catalog.close');
    close.addEventListener('click', () => closeLibrary());
    header.append(titleBox, close);

    // Источники
    const sourceRow = el('div', 'cl-sources');
    for (const [key, src] of Object.entries(SOURCES)) {
        const tab = el('button', 'cl-source', src.label);
        tab.dataset.value = key;
        tab.title = t(src.note);
        tab.addEventListener('click', () => switchSource(key));
        sourceRow.append(tab);
    }
    sourceNote = el('div', 'cl-source-note');

    // Поиск
    const searchRow = el('div', 'cl-search');
    const input = el('input', 'cl-search-input');
    input.type = 'search';
    input.placeholder = t('catalog.searchPlaceholder');
    const doSearch = () => { filters.search = input.value.trim(); reload(); };
    input.addEventListener('keydown', e => { if (e.key === 'Enter') doSearch(); });
    const go = el('button', 'cl-search-btn fa-solid fa-magnifying-glass');
    go.title = t('catalog.search');
    go.addEventListener('click', doSearch);
    filterToggle = el('button', 'cl-filter-btn fa-solid fa-sliders');
    filterToggle.title = t('catalog.filters');
    filterToggle.addEventListener('click', () => filterBox.classList.toggle('open'));
    searchRow.append(input, go, filterToggle);

    sortRow = el('div', 'cl-chips');

    // Панель фильтров
    filterBox = el('div', 'cl-filters');
    filterBox.append(
        selectField('language', t('catalog.f.language'), LANGUAGES, t('catalog.f.languageHint')),
        selectField('genre', t('catalog.f.genre'), GENRES),
        selectField('size', t('catalog.f.size'), SIZES, t('catalog.f.sizeHint')),
        selectField('freshness', t('catalog.f.freshness'), FRESHNESS),
        checkField('nsfw', t('catalog.f.nsfw'), t('catalog.f.nsfwHint')),
        checkField('russianTheme', t('catalog.f.russianTheme'), t('catalog.f.russianThemeHint')),
        checkField('altGreetings', t('catalog.f.altGreetings'), t('catalog.f.altGreetingsHint')),
        checkField('lorebook', t('catalog.f.lorebook'), t('catalog.f.lorebookHint')),
    );
    const reset = el('button', 'cl-reset', t('catalog.resetFilters'));
    reset.addEventListener('click', () => {
        Object.assign(filters, { genre: '', language: '', size: '', freshness: '', nsfw: true, russianTheme: false, altGreetings: false, lorebook: false });
        syncFilterInputs();
        reload();
    });
    filterBox.append(reset);

    grid = el('div', 'cl-grid');
    status = el('div', 'cl-status');
    moreBtn = el('button', 'cl-more', t('catalog.more'));
    moreBtn.addEventListener('click', () => loadPage());

    const scroller = el('div', 'cl-scroll');
    scroller.append(sourceRow, sourceNote, searchRow, sortRow, filterBox, grid, status, moreBtn);
    scroller.addEventListener('scroll', () => {
        if (scroller.scrollTop + scroller.clientHeight > scroller.scrollHeight - 400) loadPage();
    });

    detail = el('div', 'cl-detail');
    overlay.append(header, scroller, detail);
    document.body.append(overlay);
    switchSource(filters.source, false);
}

function selectField(key, label, options, hint) {
    const wrap = el('label', 'cl-field');
    wrap.dataset.feature = key;
    const select = el('select', 'cl-select');
    select.dataset.key = key;
    for (const [value, key] of options) {
        const o = el('option', '', t(key));
        o.value = value;
        select.append(o);
    }
    select.addEventListener('change', () => { filters[key] = select.value; reload(); });
    wrap.append(el('span', 'cl-field-label', label), select);
    if (hint) wrap.title = hint;
    return wrap;
}

function checkField(key, label, hint) {
    const wrap = el('label', 'cl-check');
    wrap.dataset.feature = key;
    const box = el('input');
    box.type = 'checkbox';
    box.dataset.key = key;
    box.addEventListener('change', () => { filters[key] = box.checked; reload(); });
    wrap.append(box, el('span', '', label));
    if (hint) wrap.title = hint;
    return wrap;
}

function syncFilterInputs() {
    filterBox.querySelectorAll('[data-key]').forEach(input => {
        if (input.type === 'checkbox') input.checked = !!filters[input.dataset.key];
        else input.value = filters[input.dataset.key] ?? '';
    });
    const features = SOURCES[filters.source].features;
    filterBox.querySelectorAll('[data-feature]').forEach(f => { f.style.display = features.includes(f.dataset.feature) ? '' : 'none'; });
    filterToggle.style.display = features.length ? '' : 'none';
    if (!features.length) filterBox.classList.remove('open');
    const active = features.filter(f => filters[f] && !(f === 'nsfw')).length;
    filterToggle.classList.toggle('active', active > 0);
    filterToggle.dataset.count = active ? String(active) : '';
}

function renderSorts() {
    sortRow.replaceChildren();
    for (const value of SOURCES[filters.source].sorts) {
        const chip = el('button', 'cl-chip', t(`catalog.sort.${value}`));
        chip.classList.toggle('active', value === filters.sort);
        chip.addEventListener('click', () => { filters.sort = value; renderSorts(); reload(); });
        sortRow.append(chip);
    }
}

function switchSource(key, doReload = true) {
    filters.source = key;
    filters.sort = SOURCES[key].sorts[0];
    overlay.querySelectorAll('.cl-source').forEach(t => t.classList.toggle('active', t.dataset.value === key));
    sourceNote.textContent = t(SOURCES[key].note);
    renderSorts();
    syncFilterInputs();
    if (doReload) reload();
}

function cardElement(item) {
    const card = el('div', 'cl-card');
    const img = el('img', 'cl-avatar');
    img.loading = 'lazy';
    img.alt = '';
    setImage(img, item.avatar, true);

    const body = el('div', 'cl-card-body');
    const stats = el('div', 'cl-stats');
    for (const [icon, value] of item.stats) stats.append(el('span', '', `${icon} ${formatCount(value)}`));
    if (item.tokens) stats.append(el('span', '', formatCount(item.tokens) + ' ' + t('catalog.tokensShort')));
    if (findLocalCharacter(item.name) !== -1) stats.append(el('span', 'cl-have', t('catalog.alreadyAddedBadge')));
    body.append(
        el('div', 'cl-name', item.name),
        el('div', 'cl-author', t('catalog.author', { author: item.author })),
        el('div', 'cl-tagline', item.tagline.slice(0, 220)),
        stats,
    );
    card.append(img, body);
    card.addEventListener('click', () => openDetail(item));
    return card;
}

async function loadPage() {
    if (state.loading || state.done) return;
    state.loading = true;
    const myId = state.requestId;
    status.textContent = t('catalog.loading');
    moreBtn.style.display = 'none';
    try {
        const { items, total } = await SOURCES[filters.source].search(filters, state.page);
        if (myId !== state.requestId) return;  // фильтр уже сменили
        const visible = items.filter(i => !isBlocked(i.tags));
        for (const item of visible) grid.append(cardElement(item));
        state.shown += items.length;
        state.page++;
        state.done = items.length === 0 || state.shown >= total;
        status.textContent = grid.children.length ? '' : t('catalog.nothingFound');
        moreBtn.style.display = state.done ? 'none' : '';
    } catch (err) {
        console.error('[local.ai+ catalog]', err);
        status.textContent = t('catalog.err.load', { site: SOURCES[filters.source].label, error: err.message });
        moreBtn.style.display = '';
    } finally {
        if (myId === state.requestId) state.loading = false;
    }
}

function reload() {
    state.requestId++;
    Object.assign(state, { page: 1, done: false, loading: false, shown: 0 });
    grid.replaceChildren();
    syncFilterInputs();
    loadPage();
}

// ================================================================== страница персонажа

async function openDetail(item) {
    const source = SOURCES[item.source];
    detail.replaceChildren();
    detail.classList.add('open');

    const box = el('div', 'cl-detail-box');
    const back = el('button', 'cl-back', t('catalog.back'));
    back.addEventListener('click', closeDetail);

    const head = el('div', 'cl-detail-head');
    const img = el('img', 'cl-detail-avatar');
    img.alt = '';
    setImage(img, item.bigAvatar);
    const info = el('div', 'cl-detail-info');
    const statLine = item.stats.map(([i, v]) => `${i} ${formatCount(v)}`).join('   ') + (item.tokens ? `   ${formatCount(item.tokens)} ${t('catalog.tokens')}` : '');
    info.append(
        el('div', 'cl-detail-name', item.name),
        el('div', 'cl-author', `${t('catalog.author', { author: item.author })} · ${source.label}`),
        el('div', 'cl-stats', statLine),
    );
    head.append(img, info);

    const tags = el('div', 'cl-tags');
    for (const t of item.tags.slice(0, 16)) tags.append(el('span', 'cl-tag', t));

    const actions = el('div', 'cl-actions');
    const local = findLocalCharacter(item.name);
    const addBtn = el('button', 'cl-add', local !== -1 ? t('catalog.openChat') : t('catalog.add'));
    addBtn.addEventListener('click', () => (local !== -1 ? openChat(local) : importCharacter(item, addBtn)));
    const link = el('a', 'cl-link', t('catalog.openOnSite', { site: source.label }));
    link.href = source.siteUrl(item);
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    actions.append(addBtn, link);

    box.append(back, head, tags, actions);
    if (Number(item.tokens) > 2500) {
        box.append(el('div', 'cl-warn', t('catalog.bigCard', { tokens: item.tokens })));
    }
    const desc = el('div', 'cl-text', item.tagline || '—');
    const firstTitle = el('div', 'cl-section', t('catalog.firstMessage'));
    const first = el('div', 'cl-text cl-first', t('catalog.loading'));
    box.append(el('div', 'cl-section', t('catalog.description')), desc, firstTitle, first);
    detail.append(box);
    detail.scrollTop = 0;

    try {
        const d = await source.details(item);
        if (d.description) desc.textContent = d.description.slice(0, 3000);
        first.textContent = d.firstMessage ? d.firstMessage.slice(0, 2500) : t('catalog.noPreview');
        if (d.altGreetings) firstTitle.textContent = t('catalog.firstMessageAlt', { count: d.altGreetings });
    } catch (err) {
        first.textContent = t('catalog.err.detail', { error: err.message });
    }
}

function closeDetail() {
    detail.classList.remove('open');
    detail.replaceChildren();
}

async function importCharacter(item, button) {
    button.disabled = true;
    button.textContent = item.source === 'risu' ? t('catalog.downloadingRisu') : t('catalog.downloading');
    const before = new Set(ctx().characters.map(c => c.avatar));
    try {
        await SOURCES[item.source].import(item);
        await ctx().getCharacters();
        let index = ctx().characters.findIndex(c => !before.has(c.avatar));
        if (index === -1) index = findLocalCharacter(item.name);
        if (index === -1) throw new Error(t('catalog.err.notAppeared'));
        toastr.success(t('catalog.added', { name: item.name }), t('catalog.title'));
        await openChat(index);
    } catch (err) {
        console.error('[local.ai+ catalog]', err);
        toastr.error(String(err.message || err), t('catalog.err.addFailed'));
        button.disabled = false;
        button.textContent = t('catalog.add');
    }
}

async function openChat(index) {
    closeLibrary();
    await ctx().selectCharacterById(index);
}

// ================================================================== открытие/закрытие

function openLibrary() {
    if (!overlay) buildOverlay();
    overlay.classList.add('open');
    document.body.classList.add('cl-locked');
    history.pushState({ characterLibrary: true }, '');  // «назад» на телефоне закрывает каталог
    if (!grid.children.length) reload();
}

function closeLibrary(fromHistory = false) {
    if (!overlay?.classList.contains('open')) return;
    overlay.classList.remove('open');
    document.body.classList.remove('cl-locked');
    closeDetail();
    if (!fromHistory && history.state?.characterLibrary) history.back();
}

function addToolbarButton() {
    if (document.getElementById('cl-button')) return;
    const btn = el('div', 'cl-toolbar-button');
    btn.id = 'cl-button';
    btn.title = t('catalog.buttonTitle');
    btn.append(el('div', 'drawer-icon fa-solid fa-compass fa-fw interactable'));
    btn.addEventListener('click', () => openLibrary());
    document.getElementById('top-settings-holder').insertBefore(btn, document.getElementById('rightNavHolder'));
}

jQuery(async () => {
    await ready;
    addToolbarButton();
    window.addEventListener('popstate', () => {
        if (detail?.classList.contains('open')) {
            closeDetail();
            history.pushState({ characterLibrary: true }, '');
        } else {
            closeLibrary(true);
        }
    });
    document.addEventListener('keydown', e => {
        if (e.key === 'Escape' && overlay?.classList.contains('open')) {
            if (detail.classList.contains('open')) closeDetail();
            else closeLibrary();
        }
    });
});
