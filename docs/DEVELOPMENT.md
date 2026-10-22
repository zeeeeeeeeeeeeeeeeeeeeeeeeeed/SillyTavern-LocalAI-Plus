# Разработка local.ai+

## Структура репозитория

```
install.bat / uninstall.bat      запуск установщика двойным кликом (вызывают PowerShell)
VERSION                          текущая версия — единственный источник правды
CHANGELOG.md                     история версий
installer/
  lib.ps1                        общие функции: выбор языка, поиск SillyTavern, копирование, правка config.yaml
  install.ps1                    установка/обновление (параметры: -Path <папка ST>, -Yes без вопросов, -Lang ru|en)
  uninstall.ps1                  удаление
  i18n/<язык>.psd1               тексты установщика
addon/                           то, что копируется в SillyTavern
  extensions/                    → SillyTavern/data/default-user/extensions/
    localai-core/                общая локализация: i18n.js + locales/<язык>.json + locales/help.<язык>.html
    localai-layout/              раскладка c.ai: меню слева, окна настроек, тема, справка
    localai-catalog/             каталог «Узнать» (chub.ai, Pygmalion, RisuRealm)
    localai-persona/             генератор персоны во вкладке «Я»
    localai-setup/               мастер рекомендуемых настроек
  plugins/
    localai-card-sources/        → SillyTavern/plugins/ — серверный посредник каталога
tools/make-release.ps1           сборка zip для GitHub Releases
tools/check-locales.mjs          проверка переводов (все ключи на месте во всех языках)
.github/                         шаблоны Issues/PR, Actions: check.yml (проверка), release.yml (релиз по метке)
docs/release-notes/              тексты страниц релизов
docs/                            документация
```

Расширения ставятся в **данные пользователя** (`data/default-user/extensions`), а не в `public/` — поэтому обновления SillyTavern их не затирают.

## Как устроено

### localai-core (локализация)
- Все тексты интерфейса — в `locales/<код>.json` (плоские ключи вида `catalog.add`), справка — `locales/help.<код>.html`.
- В коде: `import { t, ready } from '../localai-core/i18n.js'`, перед построением интерфейса `await ready`, дальше `t('catalog.add')`, `t('catalog.added', { name })`.
- Язык хранится в `extensionSettings.localai.language`; пока не выбран — определяется по языку браузера. `setLanguage()` сохраняет его **немедленно** (`saveSettings`, не debounced — иначе перезагрузка обгоняет сохранение) и переключает язык самого SillyTavern (`localStorage.language`).
- Промпты для модели (генератор персоны, «отвечай на языке», пересказ памяти) тоже в файлах языков — модель пишет на языке пользователя.
- Недостающие ключи берутся из `en.json`, поэтому перевод можно делать частями.

### localai-layout
- Верхняя полоса иконок SillyTavern **не удаляется**, а прячется CSS. Пункты бокового меню программно «нажимают» её кнопки (`toggleDrawer(id)`), поэтому вся логика SillyTavern (открытие/закрытие панелей, сохранение) работает штатно.
- Открытые панели (`.drawer-content.openDrawer`) стилями превращаются в модальные окна; `MutationObserver` следит за классом и показывает затемнение.
- Тема — первая часть `style.css` (цвета в переменных `--cai-*` в `:root`).
- Справка — `help.html`, грузится по `import.meta.url`, показывается через `callGenericPopup`.
- Пункт «Рекомендуемые настройки» шлёт событие `document.dispatchEvent(new CustomEvent('localai:setup'))` — его ловит localai-setup. Расширения не импортируют друг друга.
- **Важно (мобильная версия):** стили SillyTavern на узком экране ломают растягивание `position: fixed` через `top/bottom/inset`. Всем фиксированным элементам задаём `height: 100dvh` явно, а «лист снизу» — через `top` + фиксированную высоту.

### localai-catalog
- Источники описаны объектами в `SOURCES` (см. ниже «Как добавить сайт»).
- chub.ai опрашивается прямо из браузера (у него открытый CORS), остальные — через плагин.
- Превью в сетке — `GET /api/plugins/localai-card-sources/thumb?url=…` (уменьшенный JPEG с кэшем), полноразмерные — напрямую с запасным путём через `/img`.
- Импорт: PNG-карточка → `processDroppedFiles` из `script.js` (штатный импорт SillyTavern).
  - chub: готовый `chara_card_v2.png`.
  - Pygmalion: JSON из `/api/export/character/<id>/v2` + аватарка → PNG собирается в браузере (`buildCardPng`: canvas + чанк `tEXt` «chara»).
  - RisuRealm: `png-v3`, а если автор запретил (403) — `charx-v3` (zip).
- Безопасность: всё с сайтов выводится через `textContent`; HTML-описания превращаются в текст через `DOMParser`. Теги из `BLOCKED_TOPICS` (несовершеннолетние) отфильтровываются всегда.

### localai-card-sources (серверный плагин)
- Маршруты: `POST /fetch {url, method, body}`, `GET /img?url=`, `GET /thumb?url=`, `GET /status`.
- Разрешённые хосты — `ALLOWED_HOSTS` / `IMAGE_HOSTS`. **Новый сайт = добавить хосты сюда.**
- Прокси: `config.json` → `"proxy": "auto" | "off" | "http://…"`. `auto` = `HTTPS_PROXY` или системный прокси Windows из реестра.
- «Гонка» путей: с прокси первый путь стартует сразу, второй — через 2,5 с; победитель запоминается для хоста. Любая ошибка проигравшего глушится (`.catch(() => {})`) — **необработанная ошибка в плагине роняет весь SillyTavern**.
- `node-fetch` 3 не поддерживает опцию `timeout` — только `AbortSignal`.
- Картинки уменьшаются Jimp из SillyTavern (`../../src/jimp.js`); для JPEG обязателен `jpegColorSpace: 'ycbcr'`.

### localai-setup
- Группы настроек — массив `GROUPS` (`label`, `hint`, `enabled()` — галочка по умолчанию, `apply()`).
- Значения выставляются через элементы интерфейса SillyTavern (`set(id, value)` + события `input/change`) — так срабатывает штатное сохранение. Если SillyTavern переименует элемент, `set()` пишет предупреждение в консоль и пропускает его.
- Первый запуск: флаг `extensionSettings.localai.setupVersion`. Чтобы показать мастер всем ещё раз (например, добавили важную группу) — увеличь `SETUP_VERSION`.
- Мастер ждёт `APP_READY`: до него SillyTavern показывает окно ввода имени и не сохраняет настройки.

## Как добавить сайт в каталог

1. В `localai-catalog/index.js` добавь запись в `SOURCES`:
   ```js
   mysite: {
       label: 'MySite',
       note: 'Короткое описание под вкладками',
       sorts: [['popular', 'Популярные'], ['new', 'Новые']],
       features: ['nsfw'],             // какие фильтры показывать: genre, language, size, freshness, nsfw, russianTheme, altGreetings, lorebook
       siteUrl: item => `https://mysite/char/${item.id}`,
       async search(filters, page) { /* → { items: [...], total } */ },
       async details(item) { /* → { description, firstMessage, altGreetings } */ },
       async import(item) { /* скачать и вызвать processDroppedFiles([file]) */ },
   },
   ```
   Элемент `items` — `{ source, id, name, author, tagline, avatar, bigAvatar, stats: [['★', 123]], tokens, tags }`.
2. Если сайт не отдаёт CORS — ходи через `proxyFetch(url, {method, body})`, а хосты API и картинок добавь в плагин (`ALLOWED_HOSTS`, `IMAGE_HOSTS`) и в `IMAGE_HOSTS` каталога.
3. Проверь поиск, страницу персонажа и импорт (персонаж должен появиться, чат — открыться).

## Как добавить язык

1. Скопируй `addon/extensions/localai-core/locales/en.json` в `<код>.json` (например `ja.json`, `zh.json`) и переведи значения. Ключи и `{переменные}` в фигурных скобках не меняй. Промпты (`persona.prompt.*`, `setup.postHistory`, `setup.summaryPrompt`) переводи по смыслу и указывай в них нужный язык ответа.
2. Скопируй `help.en.html` в `help.<код>.html` и переведи.
3. В `localai-core/i18n.js` раскомментируй/добавь строку в `LANGUAGES` (`name` — как язык называет себя сам, `sillyTavernLocale` — файл из `SillyTavern/public/locales/`, `translate` — код для Google Translate). В `localai-setup/index.js` добавь заголовок окна выбора в `LANGUAGE_TITLES`.
4. Для установщика: `installer/i18n/<код>.psd1` (копия `en.psd1`) и строка в `$script:Languages` в `lib.ps1`.
5. `node tools/check-locales.mjs` — покажет непереведённые ключи.

## Выпуск версии

1. Подними версию в `VERSION` (патч — исправления, минорная — новые функции).
2. Опиши изменения в `CHANGELOG.md` и создай `docs/release-notes/vX.Y.Z.md` — текст для страницы релиза.
3. Закоммить и отправь, затем поставь метку `vX.Y.Z` и отправь её (GitHub Desktop: History → Create Tag → Push origin).
4. GitHub Actions (`.github/workflows/release.yml`) сам проверит, что метка совпадает с `VERSION`, соберёт zip через `tools/make-release.ps1` и создаст релиз.

Собрать zip локально (для проверки): `powershell -ExecutionPolicy Bypass -File tools\make-release.ps1` → `dist/`.

## Проверка перед релизом

- [ ] Установка в чистый SillyTavern: `install.bat` находит папку, после перезапуска появляются меню слева и мастер настроек.
- [ ] Обновление поверх: `install.bat` предлагает прошлую папку, `config.json` плагина не перезаписан.
- [ ] Каталог: поиск на всех трёх сайтах, фильтр языка, добавление с каждого сайта.
- [ ] Генератор персоны: генерация и вставка.
- [ ] Языки: при первом запуске — окно выбора языка, мастер на выбранном языке; смена языка в меню сохраняется после перезагрузки; `node tools/check-locales.mjs` без ошибок.
- [ ] Узкий экран (DevTools → 375×812): меню ☰, лист настроек, каталог.
- [ ] Консоль браузера (F12) без красных ошибок от `localai-*`.
- [ ] `uninstall.bat` убирает расширения и плагин.
