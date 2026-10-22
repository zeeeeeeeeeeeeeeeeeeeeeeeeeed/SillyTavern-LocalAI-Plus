// local.ai+ — общая локализация для всех расширений local.ai+.
//
// Использование в расширении:
//   import { t, ready } from '../localai-core/i18n.js';
//   jQuery(async () => { await ready; ... t('catalog.title') ... t('catalog.added', { name }) });
//
// Строки лежат в locales/<код>.json, справка — в locales/help.<код>.html.
// Чтобы добавить язык: положи <код>.json (+ help.<код>.html) и добавь запись в LANGUAGES ниже.
// Недостающие ключи берутся из английского файла, так что перевод можно делать постепенно.

// name — как язык называет себя сам; sillyTavernLocale — файл перевода интерфейса SillyTavern;
// translate — код языка для кнопки перевода сообщений (Google Translate)
import { saveSettings } from '../../../../script.js';

export const LANGUAGES = {
    ru: { name: 'Русский', sillyTavernLocale: 'ru-ru', translate: 'ru' },
    en: { name: 'English', sillyTavernLocale: 'en', translate: 'en' },
    // ja: { name: '日本語', sillyTavernLocale: 'ja-jp', translate: 'ja' },
    // zh: { name: '简体中文', sillyTavernLocale: 'zh-cn', translate: 'zh-CN' },
};
export const FALLBACK = 'en';

const BASE = new URL('./locales/', import.meta.url);
let dict = {};
let fallback = {};

async function loadJson(code) {
    try {
        const res = await fetch(new URL(`${code}.json`, BASE));
        return res.ok ? await res.json() : {};
    } catch {
        return {};
    }
}

/** Язык по умолчанию — по языку интерфейса SillyTavern/браузера. */
export function detectLanguage() {
    const candidates = [localStorage.getItem('language'), ...(navigator.languages || []), navigator.language];
    for (const value of candidates) {
        const code = String(value || '').toLowerCase().split(/[-_]/)[0];
        if (LANGUAGES[code]) return code;
    }
    return FALLBACK;
}

/** Выбранный язык local.ai+ (хранится в настройках SillyTavern) или определённый автоматически. */
export function getLanguage() {
    const saved = SillyTavern.getContext().extensionSettings?.localai?.language;
    return LANGUAGES[saved] ? saved : detectLanguage();
}

/** Выбран ли язык явно (в мастере). Пока нет — мастер первым делом предложит выбрать. */
export function isLanguageChosen() {
    return Boolean(LANGUAGES[SillyTavern.getContext().extensionSettings?.localai?.language]);
}

/** Перевод по ключу; {name} в строке заменяется на vars.name. */
export function t(key, vars) {
    let text = dict[key] ?? fallback[key] ?? key;
    if (vars) text = text.replace(/\{(\w+)\}/g, (m, k) => (vars[k] !== undefined ? String(vars[k]) : m));
    return text;
}

/** Ссылка на справку на текущем языке (с запасной на английском). */
export function helpUrl(code = getLanguage()) {
    return new URL(`help.${code}.html`, BASE);
}

/**
 * Сменить язык local.ai+ и интерфейса SillyTavern. Настройки сохраняются сразу (не «с задержкой» —
 * иначе перезагрузка успевает раньше сохранения), затем страница перезагружается.
 * @param {string} code ключ из LANGUAGES
 */
export async function setLanguage(code) {
    if (!LANGUAGES[code]) return;
    const { extensionSettings } = SillyTavern.getContext();
    const previous = extensionSettings.localai?.language;
    // languageChanged — после перезагрузки мастер подскажет обновить язык ответов персонажей
    extensionSettings.localai = { ...(extensionSettings.localai || {}), language: code, languageChanged: Boolean(previous && previous !== code) };
    try { localStorage.setItem('language', LANGUAGES[code].sillyTavernLocale); } catch { /* приватный режим */ }
    try {
        await saveSettings();
    } catch (err) {
        console.error('[local.ai+] settings save failed', err);
    }
    location.reload();
}

export const ready = (async () => {
    fallback = await loadJson(FALLBACK);
    const code = getLanguage();
    dict = code === FALLBACK ? fallback : await loadJson(code);
})();
