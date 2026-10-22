// Проверка переводов local.ai+.
//   node tools/check-locales.mjs
// 1) Все ключи t('...') из кода есть в английском файле (он — эталон и запасной язык).
// 2) В каждом другом языке есть все ключи английского (пропуски не ломают интерфейс — подставится
//    английский, — но их стоит перевести) и нет лишних ключей.
// 3) Для каждого языка есть справка help.<код>.html.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const extDir = path.join(root, 'addon', 'extensions');
const localeDir = path.join(extDir, 'localai-core', 'locales');

const codeKeys = new Set();
for (const ext of fs.readdirSync(extDir)) {
    const file = path.join(extDir, ext, 'index.js');
    if (!fs.existsSync(file)) continue;
    const src = fs.readFileSync(file, 'utf8');
    for (const m of src.matchAll(/\bt\(\s*'([a-zA-Z0-9_.]+)'/g)) codeKeys.add(m[1]);
}

const locales = fs.readdirSync(localeDir).filter(f => f.endsWith('.json')).map(f => f.replace('.json', ''));
const load = code => JSON.parse(fs.readFileSync(path.join(localeDir, `${code}.json`), 'utf8'));
const en = load('en');
let problems = 0;

const missingInEn = [...codeKeys].filter(k => !(k in en));
if (missingInEn.length) {
    problems += missingInEn.length;
    console.log(`en.json: нет ключей, которые использует код (${missingInEn.length}):\n  ${missingInEn.join('\n  ')}`);
}

for (const code of locales.filter(c => c !== 'en')) {
    const dict = load(code);
    const missing = Object.keys(en).filter(k => !(k in dict));
    const extra = Object.keys(dict).filter(k => !(k in en));
    if (missing.length) console.log(`${code}.json: не переведено ${missing.length}:\n  ${missing.join('\n  ')}`);
    if (extra.length) console.log(`${code}.json: лишние ключи (нет в en.json) ${extra.length}:\n  ${extra.join('\n  ')}`);
    problems += missing.length + extra.length;
}

for (const code of locales) {
    if (!fs.existsSync(path.join(localeDir, `help.${code}.html`))) {
        console.log(`нет справки help.${code}.html`);
        problems++;
    }
}

console.log(problems ? `\nПроблем: ${problems}` : `OK: ${locales.join(', ')} — ${Object.keys(en).length} строк, код использует ${codeKeys.size} ключей напрямую`);
process.exit(problems ? 1 : 0);
