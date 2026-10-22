// local.ai+ — генератор персоны.
// В панели «Я» (Persona Management) пользователь пишет идею своими словами, модель расписывает её
// в подробное описание, а кнопка вставляет результат в описание текущей персоны. Чат не затрагивается.
// Промпт для модели тоже берётся из файла языка — описание пишется на выбранном языке local.ai+.

import { t, ready } from '../localai-core/i18n.js';

const ctx = () => SillyTavern.getContext();

// [ключ, слов, токенов на ответ]
const LENGTHS = [['short', 150, 350], ['medium', 300, 650], ['long', 500, 1000]];
const FORMATS = ['sections', 'prose'];

function systemPrompt(words, format) {
    const layout = format === 'sections'
        ? t('persona.prompt.layoutSections', { sections: t('persona.prompt.sections') })
        : t('persona.prompt.layoutProse');
    return t('persona.prompt.system', { words, layout });
}

function userPrompt(idea, name) {
    const nameLine = name ? t('persona.prompt.name', { name }) : t('persona.prompt.noName');
    return `${nameLine}\n${t('persona.prompt.idea')}\n${idea}`;
}

function el(tag, cls, text) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text !== undefined) e.textContent = text;
    return e;
}

function select(options) {
    const s = el('select', 'text_pole pg-select');
    for (const [value, label] of options) {
        const o = el('option', '', label);
        o.value = value;
        s.append(o);
    }
    return s;
}

function buildPanel() {
    const description = document.getElementById('persona_description');
    if (!description || document.getElementById('pg-root')) return;
    const title = t('persona.title');

    const root = el('div', 'pg-root');
    root.id = 'pg-root';

    const toggle = el('button', 'menu_button pg-toggle', t('persona.toggle'));
    toggle.title = t('persona.toggleTitle');

    const body = el('div', 'pg-body');
    const idea = el('textarea', 'text_pole pg-idea');
    idea.rows = 4;
    idea.placeholder = t('persona.ideaPlaceholder');

    const name = el('input', 'text_pole pg-name');
    name.type = 'text';
    name.placeholder = t('persona.namePlaceholder');

    const length = select(LENGTHS.map(([key]) => [key, t(`persona.length.${key}`)]));
    length.value = 'medium';
    length.title = t('persona.lengthTitle');
    const format = select(FORMATS.map(key => [key, t(`persona.format.${key}`)]));

    const options = el('div', 'pg-options');
    options.append(name, length, format);

    const generate = el('button', 'menu_button pg-generate', t('persona.generate'));
    const stop = el('button', 'menu_button pg-stop', t('persona.stop'));
    stop.style.display = 'none';
    const status = el('div', 'pg-status');
    const actionsTop = el('div', 'pg-actions');
    actionsTop.append(generate, stop, status);

    const result = el('textarea', 'text_pole pg-result');
    result.rows = 12;
    result.placeholder = t('persona.resultPlaceholder');

    const replace = el('button', 'menu_button pg-apply', t('persona.replace'));
    replace.title = t('persona.replaceTitle');
    const append = el('button', 'menu_button', t('persona.append'));
    append.title = t('persona.appendTitle');
    const resultActions = el('div', 'pg-actions pg-result-actions');
    resultActions.append(replace, append);

    const hint = el('div', 'pg-hint', t('persona.hint'));

    body.append(idea, options, actionsTop, result, resultActions, hint);
    root.append(toggle, body);

    toggle.addEventListener('click', () => {
        root.classList.toggle('open');
        if (root.classList.contains('open')) idea.focus();
    });

    generate.addEventListener('click', async () => {
        const text = idea.value.trim();
        if (!text) {
            toastr.warning(t('persona.needIdea'), title);
            return;
        }
        if (ctx().onlineStatus === 'no_connection') {
            toastr.error(t('persona.noConnection'), title);
            return;
        }
        const [, words, tokens] = LENGTHS.find(([key]) => key === length.value);
        generate.disabled = true;
        stop.style.display = '';
        status.textContent = t('persona.writing');
        try {
            const output = await ctx().generateRaw({
                prompt: userPrompt(text, name.value.trim()),
                systemPrompt: systemPrompt(words, format.value),
                responseLength: tokens,
            });
            result.value = String(output || '').trim();
            status.textContent = result.value ? t('persona.done') : t('persona.empty');
        } catch (err) {
            console.error('[local.ai+ persona]', err);
            status.textContent = t('persona.failed', { error: err?.message || err });
        } finally {
            generate.disabled = false;
            generate.textContent = t('persona.again');
            stop.style.display = 'none';
        }
    });

    stop.addEventListener('click', () => ctx().stopGeneration());

    const apply = mode => {
        const text = result.value.trim();
        if (!text) {
            toastr.warning(t('persona.nothingToInsert'), title);
            return;
        }
        const current = description.value.trim();
        description.value = mode === 'append' && current ? `${current}\n\n${text}` : text;
        description.dispatchEvent(new Event('input', { bubbles: true }));  // SillyTavern сохранит персону
        toastr.success(t('persona.updated'), title);
    };
    replace.addEventListener('click', () => apply('replace'));
    append.addEventListener('click', () => apply('append'));

    // Блок встаёт прямо над заголовком «Описание персоны»
    const header = description.previousElementSibling || description;
    header.parentElement.insertBefore(root, header);
}

jQuery(async () => {
    await ready;
    buildPanel();
    // На случай, если панель персоны перерисуется
    ctx().eventSource.on(ctx().event_types.SETTINGS_LOADED, buildPanel);
});
