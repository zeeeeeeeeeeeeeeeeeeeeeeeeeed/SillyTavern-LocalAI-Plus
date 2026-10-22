# Как помочь проекту / Contributing

**Русский** · [English](#english)

Любая помощь приветствуется — даже одно сообщение об ошибке.

- **Нашёл ошибку** — открой [Issue](../../issues/new/choose) по шаблону «Ошибка». Версии SillyTavern и local.ai+ и скриншот экономят кучу времени.
- **Есть идея** — шаблон «Идея».
- **Хочешь перевести на свой язык** — шаблон «Перевод» и инструкция в [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md) («Как добавить язык»). Программировать не нужно.
- **Хочешь поправить код** — сделай форк, изменения — в отдельной ветке, затем Pull Request. Как устроен проект — в [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md).

Правила простые:
- новые тексты интерфейса — только через файлы переводов (`t('ключ')`), сразу в `en.json` и `ru.json`;
- всё, что приходит с сайтов-каталогов, выводится как текст (`textContent`), а не как HTML;
- в серверном плагине любая ошибка должна перехватываться — необработанная роняет весь SillyTavern.

Код распространяется под [MIT](LICENSE): присылая изменения, ты соглашаешься, что они тоже будут под MIT.

---

## English

All help is welcome — even a single bug report.

- **Found a bug** — open an [Issue](../../issues/new/choose) using the “Bug report” template. SillyTavern and local.ai+ versions plus a screenshot save a lot of time.
- **Have an idea** — use the “Feature request” template.
- **Want to translate into your language** — use the “Translation” template; the steps are in [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md). No programming needed.
- **Want to change the code** — fork, make your changes in a separate branch, open a Pull Request.

Simple rules:
- new UI text goes through the locale files only (`t('key')`), in both `en.json` and `ru.json`;
- everything coming from catalog sites is rendered as text (`textContent`), never as HTML;
- every error in the server plugin must be caught — an unhandled one crashes the whole SillyTavern.

The code is MIT-licensed: by contributing you agree that your changes are released under MIT too.
