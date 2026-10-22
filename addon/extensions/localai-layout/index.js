// local.ai+ — раскладка в стиле character.ai.
// Боковое меню слева (создать, узнать, чаты, настройки с подписями); настройки SillyTavern
// открываются окном по центру поверх затемнения (на телефоне — листом снизу).
// Верхняя полоса иконок скрыта, но остаётся в странице: пункты меню просто «нажимают» её кнопки,
// поэтому вся логика SillyTavern работает как раньше. Выключить: Модули → «local.ai+ · Раскладка».

import { user_avatar } from '../../../../script.js';
import { t, ready, helpUrl, FALLBACK } from '../localai-core/i18n.js';

const ctx = () => SillyTavern.getContext();

// Пункты настроек: ключ подписи, иконка, id панели в верхней полосе SillyTavern
const SETTINGS = [
    ['aiResponse', 'fa-sliders', 'ai-config-button'],
    ['model', 'fa-plug', 'sys-settings-button'],
    ['template', 'fa-font', 'advanced-formatting-button'],
    ['worlds', 'fa-book-atlas', 'WI-SP-button'],
    ['modules', 'fa-cubes', 'extensions-settings-button'],
    ['background', 'fa-panorama', 'backgrounds-button'],
    ['userSettings', 'fa-gear', 'user-settings-button'],
];

function el(tag, cls, text) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text !== undefined) e.textContent = text;
    return e;
}

function navItem(label, icon, onClick, title) {
    const item = el('button', 'cai-nav-item');
    item.append(el('i', `fa-solid ${icon} fa-fw`), el('span', '', label));
    if (title) item.title = title;
    item.addEventListener('click', () => {
        closeSidebar();
        onClick();
    });
    return item;
}

/** Открыть/закрыть панель SillyTavern, «нажав» её скрытую кнопку в верхней полосе. */
function toggleDrawer(holderId) {
    const toggle = document.querySelector(`#${holderId} > .drawer-toggle`) || document.getElementById(holderId);
    toggle?.click();
}

function openDrawers() {
    return [...document.querySelectorAll('#top-settings-holder .drawer-content.openDrawer')];
}

function closeAllDrawers() {
    for (const content of openDrawers()) {
        const holder = content.closest('#top-settings-holder > .drawer');
        if (holder) toggleDrawer(holder.id);
    }
}

// Расширения local.ai+ не импортируют друг друга — общаются событиями
const emit = name => document.dispatchEvent(new CustomEvent(name));

// ------------------------------------------------------------------ боковое меню

let sidebar, chatList, searchInput, userBox;

function buildSidebar() {
    sidebar = el('aside', 'cai-sidebar');
    sidebar.id = 'cai-sidebar';

    const brand = el('div', 'cai-brand');
    brand.append(el('span', 'cai-logo', '(local.ai+)'));
    const collapse = el('button', 'cai-icon-btn fa-solid fa-angles-left');
    collapse.title = t('layout.collapse');
    collapse.addEventListener('click', () => (window.innerWidth > 1000 ? toggleCollapsed() : closeSidebar()));
    brand.append(collapse);

    const create = el('button', 'cai-create');
    create.append(el('i', 'fa-solid fa-plus'), el('span', '', t('layout.create')));
    create.title = t('layout.createTitle');
    create.addEventListener('click', () => {
        closeSidebar();
        openCreateCharacter();
    });

    const nav = el('nav', 'cai-nav');
    nav.append(
        navItem(t('layout.discover'), 'fa-compass', () => document.getElementById('cl-button')?.click(), t('layout.discoverTitle')),
        navItem(t('layout.characters'), 'fa-address-card', () => toggleDrawer('rightNavHolder'), t('layout.charactersTitle')),
        navItem(t('layout.persona'), 'fa-face-smile', () => toggleDrawer('persona-management-button'), t('layout.personaTitle')),
    );

    searchInput = el('input', 'cai-search');
    searchInput.type = 'search';
    searchInput.placeholder = t('layout.search');
    searchInput.addEventListener('input', renderChats);

    chatList = el('div', 'cai-chats');

    // Раскрывающаяся группа «Настройки» — над чатами, чтобы не теряться под длинным списком
    const settingsTitle = el('button', 'cai-nav-item cai-group');
    settingsTitle.append(el('i', 'fa-solid fa-gear fa-fw'), el('span', '', t('layout.settings')), el('i', 'fa-solid fa-chevron-down cai-group-chevron'));
    settingsTitle.title = t('layout.settingsTitle');
    settingsTitle.addEventListener('click', () => {
        sidebar.classList.toggle('cai-settings-open');
        try { localStorage.setItem('cai-settings-open', sidebar.classList.contains('cai-settings-open') ? '1' : ''); } catch { /* ок */ }
    });
    try { if (localStorage.getItem('cai-settings-open') !== '') sidebar.classList.add('cai-settings-open'); } catch { sidebar.classList.add('cai-settings-open'); }
    const settings = el('nav', 'cai-nav cai-settings');
    for (const [key, icon, id] of SETTINGS) {
        settings.append(navItem(t(`layout.s.${key}`), icon, () => toggleDrawer(id), t(`layout.s.${key}Title`)));
    }
    settings.append(
        navItem(t('layout.language'), 'fa-language', () => emit('localai:language'), t('layout.languageTitle')),
        navItem(t('layout.setup'), 'fa-wand-magic-sparkles', () => emit('localai:setup'), t('layout.setupTitle')),
        navItem(t('layout.help'), 'fa-circle-question', openHelp, t('layout.helpTitle')),
    );

    userBox = el('button', 'cai-user');
    userBox.title = t('layout.userTitle');
    userBox.addEventListener('click', () => {
        closeSidebar();
        toggleDrawer('persona-management-button');
    });

    const scroll = el('div', 'cai-sidebar-scroll');
    scroll.append(nav, settingsTitle, settings, searchInput, chatList);
    sidebar.append(brand, create, scroll, userBox);
    document.body.append(sidebar);
}

function openCreateCharacter() {
    const panel = document.getElementById('right-nav-panel');
    if (!panel.classList.contains('openDrawer')) toggleDrawer('rightNavHolder');
    setTimeout(() => document.getElementById('rm_button_create')?.click(), 150);
}

function thumb(type, file) {
    try {
        return ctx().getThumbnailUrl(type, file);
    } catch {
        return `/thumbnail?type=${type}&file=${encodeURIComponent(file)}`;
    }
}

function dateValue(c) {
    const d = c.date_last_chat || c.date_added || 0;
    return typeof d === 'number' ? d : Date.parse(d) || 0;
}

function renderChats() {
    if (!chatList) return;
    const { characters, characterId } = ctx();
    const query = (searchInput.value || '').trim().toLowerCase();
    const items = characters
        .map((c, index) => ({ c, index }))
        .filter(({ c }) => !query || c.name.toLowerCase().includes(query))
        .sort((a, b) => dateValue(b.c) - dateValue(a.c));

    chatList.replaceChildren();
    chatList.append(el('div', 'cai-section', query ? t('layout.found') : t('layout.chats')));
    for (const { c, index } of items) {
        const row = el('button', 'cai-chat');
        if (String(index) === String(characterId)) row.classList.add('active');
        const img = el('img', 'cai-chat-avatar');
        img.loading = 'lazy';
        img.alt = '';
        img.src = thumb('avatar', c.avatar);
        row.append(img, el('span', 'cai-chat-name', c.name));
        row.title = c.name;
        row.addEventListener('click', async () => {
            closeSidebar();
            closeAllDrawers();
            await ctx().selectCharacterById(index);
        });
        chatList.append(row);
    }
    if (!items.length) chatList.append(el('div', 'cai-empty', query ? t('layout.nobodyFound') : t('layout.noCharacters')));
    renderUser();
    renderMobileTitle();
}

function renderUser() {
    const { name1 } = ctx();
    userBox.replaceChildren();
    const img = el('img', 'cai-chat-avatar');
    img.alt = '';
    img.src = user_avatar ? thumb('persona', user_avatar) : 'img/user-default.png';
    userBox.append(img, el('span', 'cai-chat-name', name1 || 'User'), el('i', 'fa-solid fa-chevron-up cai-user-chevron'));
}

function toggleCollapsed() {
    document.body.classList.toggle('cai-collapsed');
    try { localStorage.setItem('cai-collapsed', document.body.classList.contains('cai-collapsed') ? '1' : ''); } catch { /* приватный режим */ }
}

// ------------------------------------------------------------------ телефон: верхняя полоса и выезжающее меню

let mobileTitle;

function buildMobileBar() {
    const bar = el('div', 'cai-mobilebar');
    const burger = el('button', 'cai-icon-btn fa-solid fa-bars');
    burger.title = t('layout.menu');
    burger.addEventListener('click', () => {
        // ПК со свёрнутым меню — развернуть; телефон — выдвинуть поверх чата
        if (document.body.classList.contains('cai-collapsed') && window.innerWidth > 1000) toggleCollapsed();
        else document.body.classList.add('cai-sidebar-open');
    });
    mobileTitle = el('div', 'cai-mobile-title');
    const discover = el('button', 'cai-icon-btn fa-solid fa-compass');
    discover.title = t('layout.discoverTitle');
    discover.addEventListener('click', () => document.getElementById('cl-button')?.click());
    bar.append(burger, mobileTitle, discover);
    document.body.append(bar);
}

function renderMobileTitle() {
    if (!mobileTitle) return;
    const { characters, characterId } = ctx();
    const c = characters[characterId];
    mobileTitle.replaceChildren();
    if (c) {
        const img = el('img', 'cai-chat-avatar');
        img.alt = '';
        img.src = thumb('avatar', c.avatar);
        mobileTitle.append(img, el('span', '', c.name));
    } else {
        mobileTitle.append(el('span', '', '(local.ai+)'));
    }
}

function closeSidebar() {
    document.body.classList.remove('cai-sidebar-open');
}

// ------------------------------------------------------------------ затемнение и кнопки «закрыть» у окон настроек

function buildBackdrop() {
    const backdrop = el('div', 'cai-backdrop');
    backdrop.addEventListener('click', () => {
        closeSidebar();
        closeAllDrawers();
    });
    document.body.append(backdrop);

    for (const content of document.querySelectorAll('#top-settings-holder .drawer-content')) {
        const holder = content.closest('#top-settings-holder > .drawer');
        if (!holder || content.querySelector(':scope > .cai-modal-close')) continue;
        const close = el('button', 'cai-modal-close fa-solid fa-xmark');
        close.title = t('layout.close');
        close.addEventListener('click', () => toggleDrawer(holder.id));
        content.prepend(close);
    }

    // Следим, открыто ли какое-нибудь окно, — показываем затемнение
    const update = () => document.body.classList.toggle('cai-modal-open', openDrawers().length > 0);
    const observer = new MutationObserver(update);
    document.querySelectorAll('#top-settings-holder .drawer-content').forEach(c => observer.observe(c, { attributes: true, attributeFilter: ['class'] }));
    update();

    document.addEventListener('keydown', e => {
        if (e.key === 'Escape' && document.body.classList.contains('cai-modal-open') && !document.querySelector('dialog[open]')) closeAllDrawers();
    });
}

// ------------------------------------------------------------------ справка (localai-core/locales/help.<язык>.html)

async function openHelp() {
    const { callGenericPopup, POPUP_TYPE } = ctx();
    let html = '';
    for (const url of [helpUrl(), helpUrl(FALLBACK)]) {
        try {
            const res = await fetch(url);
            if (res.ok) { html = await res.text(); break; }
        } catch { /* следующий вариант */ }
    }
    await callGenericPopup(html || `<p>${t('layout.helpFailed')}</p>`, POPUP_TYPE.TEXT, '', {
        wide: true, large: true, allowVerticalScrolling: true, okButton: t('layout.helpOk'),
    });
}

/** «Справка» последним пунктом в меню ☰ слева от поля ввода. */
function addHelpToOptionsMenu() {
    const menu = document.querySelector('#options .options-content');
    if (!menu || document.getElementById('option_cai_help')) return;
    const item = el('a', 'interactable');
    item.id = 'option_cai_help';
    item.tabIndex = 0;
    item.append(el('i', 'fa-lg fa-solid fa-circle-question'), el('span', '', t('layout.help')));
    item.addEventListener('click', openHelp);
    menu.append(el('hr'), item);
}

// ------------------------------------------------------------------ запуск

jQuery(async () => {
    await ready;
    document.body.classList.add('cai-layout');
    try { if (localStorage.getItem('cai-collapsed')) document.body.classList.add('cai-collapsed'); } catch { /* ок */ }
    buildSidebar();
    buildMobileBar();
    buildBackdrop();
    addHelpToOptionsMenu();

    const { eventSource, event_types } = ctx();
    const refresh = () => setTimeout(renderChats, 50);
    for (const ev of ['APP_READY', 'CHAT_CHANGED', 'CHARACTER_EDITED', 'CHARACTER_DELETED', 'CHARACTER_PAGE_LOADED', 'SETTINGS_UPDATED', 'MESSAGE_SENT']) {
        if (event_types[ev]) eventSource.on(event_types[ev], refresh);
    }
    // Список персонажей грузится асинхронно — дорисуем, когда он появится
    renderChats();
    setTimeout(renderChats, 1500);
    setTimeout(renderChats, 4000);
});
