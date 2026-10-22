// local.ai+ — мастер первого запуска.
// 1) Выбор языка (local.ai+ и интерфейса SillyTavern). 2) Рекомендуемые настройки с галочками.
// Ничего не привязано к конкретной модели: шаблон чата и размер окна берутся из самой модели/бэкенда.
//
// Настройки выставляются через элементы интерфейса SillyTavern (как если бы их нажал пользователь),
// поэтому срабатывает вся штатная логика сохранения.
// Открывается и вручную: событие 'localai:setup' (мастер) и 'localai:language' (выбор языка).

import { t, ready, LANGUAGES, getLanguage, isLanguageChosen, setLanguage } from '../localai-core/i18n.js';

// Увеличь, чтобы мастер снова показался всем после обновления (например, появилась важная группа)
const SETUP_VERSION = 1;

const ctx = () => SillyTavern.getContext();
const sleep = ms => new Promise(r => setTimeout(r, ms));

/** Выставить значение элементу SillyTavern и «сообщить» ему об изменении. */
function set(id, value) {
    const el = document.getElementById(id);
    if (!el) {
        console.warn(`[local.ai+ setup] #${id} not found — skipped`);
        return false;
    }
    if (el.type === 'checkbox') el.checked = Boolean(value);
    else el.value = String(value);
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
    return true;
}

function hasOption(id, value) {
    return [...(document.getElementById(id)?.options || [])].some(o => o.value === value);
}

// ------------------------------------------------------------------ группы настроек
// key → подписи в locales: setup.<key>.label / setup.<key>.hint; enabled() — галочка по умолчанию

const GROUPS = [
    {
        key: 'templates',
        enabled: () => true,
        async apply() {
            set('instruct_enabled', true);
            set('instruct_derived', true);
            set('context_derived', true);
            set('context_size_derived', true);
            set('max_context_unlocked', true);
            if (hasOption('sysprompt_select', 'Roleplay - Immersive')) set('sysprompt_select', 'Roleplay - Immersive');
        },
    },
    {
        key: 'samplers',
        enabled: () => false,  // у человека могут быть свои подобранные значения
        async apply() {
            const values = {
                temp_textgenerationwebui: 0.9, min_p_textgenerationwebui: 0.05, top_p_textgenerationwebui: 1,
                top_k_textgenerationwebui: 0, typical_p_textgenerationwebui: 1, tfs_textgenerationwebui: 1,
                top_a_textgenerationwebui: 0, rep_pen_textgenerationwebui: 1, freq_pen_textgenerationwebui: 0,
                presence_pen_textgenerationwebui: 0, dry_multiplier_textgenerationwebui: 0.8,
                dry_base_textgenerationwebui: 1.75, dry_allowed_length_textgenerationwebui: 2,
                xtc_probability_textgenerationwebui: 0,
            };
            for (const [id, v] of Object.entries(values)) set(id, v);
            set('amount_gen', 500);
            set('trim_sentences_checkbox', true);
        },
    },
    {
        key: 'replyLanguage',
        enabled: () => true,
        async apply() {
            set('sysprompt_post_history', t('setup.postHistory'));
            await sleep(200);
            // сохранить системный промпт в его пресет
            const box = document.getElementById('sysprompt_select')?.closest('.flex-container, div')?.parentElement;
            box?.querySelector('[data-preset-manager-update]')?.click();
            await sleep(800);
            set('translation_provider', 'google');
            set('translation_target_language', LANGUAGES[getLanguage()].translate);
            set('translation_auto_mode', 'none');
        },
    },
    {
        key: 'memory',
        enabled: () => true,
        async apply() {
            set('summary_source', 'main');
            await sleep(200);
            set('memory_prompt', t('setup.summaryPrompt'));
            set('memory_prompt_words', 350);
            set('memory_prompt_interval', 15);
            set('memory_template', t('setup.summaryTemplate'));
            set('vectors_source', 'transformers');
            await sleep(200);
            set('vectors_enabled_chats', true);
            set('vectors_template', t('setup.vectorsTemplate'));
            set('vectors_query', 3);
            set('vectors_insert', 3);
            set('vectors_protect', 10);
        },
    },
    {
        key: 'comfort',
        enabled: () => true,
        async apply() {
            set('tag_import_setting', '3');
            set('avatar_style', '0');
            set('chat_display', '0');
        },
    },
];

// ------------------------------------------------------------------ шаг 1: язык

// Заголовок окна выбора языка сразу на всех языках — окно видят до того, как язык выбран
const LANGUAGE_TITLES = { ru: 'Выбери язык', en: 'Choose your language', ja: '言語を選択', zh: '选择语言' };

/** Окно выбора языка: по кнопке на каждый язык. Возвращает код языка или null (окно закрыли). */
async function chooseLanguage() {
    const { Popup, POPUP_TYPE } = ctx();
    const current = getLanguage();
    const root = document.createElement('div');
    root.style.textAlign = 'center';
    const title = document.createElement('h3');
    title.textContent = Object.keys(LANGUAGES).map(code => LANGUAGE_TITLES[code]).filter(Boolean).join(' / ');
    const row = document.createElement('div');
    row.style.cssText = 'display:flex;gap:10px;justify-content:center;flex-wrap:wrap;margin:14px 0 4px;';
    root.append(title, row);

    let chosen = null;
    const popup = new Popup(root, POPUP_TYPE.DISPLAY, '', { wide: false });
    for (const [code, info] of Object.entries(LANGUAGES)) {
        const btn = document.createElement('button');
        btn.className = 'menu_button';
        btn.style.cssText = 'padding:12px 24px;font-size:16px;' + (code === current ? 'font-weight:700;' : '');
        btn.textContent = info.name;
        btn.addEventListener('click', () => {
            chosen = code;
            popup.complete(1);
        });
        row.append(btn);
    }
    await popup.show();
    return chosen;
}

async function runLanguageStep() {
    const code = await chooseLanguage();
    if (!code) return false;
    if (code === getLanguage() && isLanguageChosen()) return false;
    await setLanguage(code);  // сохраняет и перезагружает страницу
    return true;
}

// ------------------------------------------------------------------ шаг 2: настройки

function buildForm() {
    const root = document.createElement('div');
    root.style.textAlign = 'left';
    const title = document.createElement('h3');
    title.textContent = t('setup.title');
    const intro = document.createElement('p');
    intro.textContent = t('setup.intro');
    root.append(title, intro);

    for (const group of GROUPS) {
        const label = document.createElement('label');
        label.className = 'checkbox_label';
        label.style.cssText = 'align-items:flex-start;margin:10px 0;gap:8px;';
        const box = document.createElement('input');
        box.type = 'checkbox';
        box.dataset.group = group.key;
        let on = true;
        try { on = group.enabled(); } catch { /* по умолчанию включено */ }
        box.checked = on;
        const text = document.createElement('div');
        const b = document.createElement('b');
        b.textContent = t(`setup.${group.key}.label`, { language: LANGUAGES[getLanguage()].name });
        text.append(b);
        const hint = t(`setup.${group.key}.hint`);
        if (hint && hint !== `setup.${group.key}.hint`) {
            const small = document.createElement('div');
            small.style.cssText = 'font-size:12px;opacity:.75;margin-top:2px;';
            small.textContent = hint;
            text.append(small);
        }
        label.append(box, text);
        root.append(label);
    }
    return root;
}

async function runWizard() {
    const { callGenericPopup, POPUP_TYPE, POPUP_RESULT, extensionSettings, saveSettingsDebounced } = ctx();
    const form = buildForm();
    const result = await callGenericPopup(form, POPUP_TYPE.CONFIRM, '', {
        okButton: t('setup.apply'),
        cancelButton: t('setup.later'),
        wide: true,
        allowVerticalScrolling: true,
    });

    extensionSettings.localai = { ...(extensionSettings.localai || {}), setupVersion: SETUP_VERSION };
    if (result !== POPUP_RESULT.AFFIRMATIVE) {
        saveSettingsDebounced();
        return;
    }

    const chosen = [...form.querySelectorAll('input[data-group]')].filter(b => b.checked).map(b => b.dataset.group);
    toastr.info(t('setup.applying'), 'local.ai+');
    for (const group of GROUPS.filter(g => chosen.includes(g.key))) {
        try {
            await group.apply();
        } catch (err) {
            console.error(`[local.ai+ setup] ${group.key}`, err);
        }
        await sleep(150);
    }
    saveSettingsDebounced();
    await sleep(1500);
    toastr.success(t('setup.done'), 'local.ai+');
}

// ------------------------------------------------------------------ первый запуск

let autoShown = false;

/** После смены языка: инструкция «отвечай на языке X» осталась от прошлого — предложить обновить. */
function suggestReapplyAfterLanguageChange() {
    const { extensionSettings, saveSettingsDebounced } = ctx();
    if (!extensionSettings.localai?.languageChanged) return;
    extensionSettings.localai.languageChanged = false;
    saveSettingsDebounced();
    toastr.info(t('setup.languageChangedHint'), 'local.ai+', {
        timeOut: 15000,
        onclick: () => runWizard(),
    });
}

async function firstRun() {
    if (autoShown) return;
    suggestReapplyAfterLanguageChange();
    const settings = ctx().extensionSettings.localai || {};
    if ((settings.setupVersion || 0) >= SETUP_VERSION && isLanguageChosen()) return;
    autoShown = true;
    await sleep(1500);
    // Сначала язык; после выбора страница перезагрузится и мастер откроется уже на нём
    if (!isLanguageChosen()) {
        const reloading = await runLanguageStep();
        if (reloading) return;
        // язык оставили прежним — просто запомним его выбор
        const { extensionSettings, saveSettingsDebounced } = ctx();
        extensionSettings.localai = { ...(extensionSettings.localai || {}), language: getLanguage() };
        saveSettingsDebounced();
    }
    if ((settings.setupVersion || 0) < SETUP_VERSION) await runWizard();
}

jQuery(async () => {
    await ready;
    const { eventSource, event_types } = ctx();
    document.addEventListener('localai:setup', () => runWizard());
    document.addEventListener('localai:language', () => runLanguageStep());
    // Мастер показывается, когда SillyTavern полностью загрузился (после его окна с именем).
    // Запасной таймер — на случай, если APP_READY случился раньше загрузки расширения.
    eventSource.once(event_types.APP_READY, firstRun);
    setTimeout(() => {
        const preloader = document.getElementById('preloader');
        if (!preloader || getComputedStyle(preloader).display === 'none') firstRun();
    }, 10000);
});
