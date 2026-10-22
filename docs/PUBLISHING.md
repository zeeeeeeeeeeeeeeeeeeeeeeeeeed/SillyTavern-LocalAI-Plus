# Как выложить local.ai+ на GitHub (впервые)

Без командной строки — всё через программу **GitHub Desktop**. Займёт ~20 минут.

---

## 1. Аккаунт на GitHub

1. Зарегистрируйся на [github.com](https://github.com/signup). Ник будет частью адреса проекта: `github.com/<ник>/SillyTavern-LocalAI-Plus`.
2. **Спрячь свою почту** (иначе она будет видна в истории проекта):
   *Settings → Emails* → включи **Keep my email addresses private** и **Block command line pushes that expose my email**.
   Ниже появится адрес вида `12345678+ник@users.noreply.github.com` — он и будет подписывать твои изменения.

## 2. GitHub Desktop

1. Скачай и установи [GitHub Desktop](https://desktop.github.com/).
2. Войди в свой аккаунт (*File → Options → Accounts → Sign in*).
3. *File → Options → Git*: имя — твой ник, почта — тот самый `...@users.noreply.github.com`.

## 3. Первый коммит

1. *File → Add local repository…* → выбери папку `Документы\GitHub\localai-plus` → **Add repository**.
2. Слева появится список файлов — это всё, что попадёт на GitHub. Папки `dist` там нет и не должно быть (она в `.gitignore`).
3. Внизу слева в поле **Summary** напиши `local.ai+ v1.0.0` → **Commit to main**.

## 4. Публикация

1. Нажми **Publish repository** (сверху).
2. Name: `SillyTavern-LocalAI-Plus`. Description — см. ниже.
3. **Сними галочку «Keep this code private»** — иначе проект увидишь только ты.
4. **Publish repository**. Готово — проект на `github.com/<ник>/SillyTavern-LocalAI-Plus`.

## 5. Оформление страницы проекта

На странице репозитория справа, у блока **About**, нажми ⚙️:

- **Description:**
  `Character.ai-style interface and character catalog (chub.ai, Pygmalion, RisuRealm) for SillyTavern · Интерфейс в стиле character.ai для SillyTavern`
- **Topics** (вводить по одному, через Enter):
  `sillytavern` `sillytavern-extension` `character-ai` `roleplay` `ai-chat` `llm` `local-llm` `chub-ai` `character-cards` `russian`
- Галочки **Releases** — оставь, **Packages** и **Deployments** — можно снять.

## 6. Скриншоты

Уже на месте: `docs/screenshots/` (6 картинок), README их показывает. Чтобы заменить картинку — положи новую с тем же именем (список и советы — в [docs/screenshots/README.md](screenshots/README.md)), затем в GitHub Desktop: Summary `Скриншоты` → **Commit to main** → **Push origin**.

## 7. Первый релиз (архив для скачивания)

Пользователи скачивают не код, а **zip из раздела Releases**. Его собирает GitHub сам:

1. В GitHub Desktop открой вкладку **History**, нажми правой кнопкой на последний коммит → **Create Tag…** → `v1.0.0` → **Create Tag**.
2. Нажми **Push origin** (вместе с изменениями уйдёт и метка).
3. На странице проекта открой вкладку **Actions** — там запустится «Release». Через 1–2 минуты в **Releases** появится `local.ai+ v1.0.0` с файлом `localai-plus-v1.0.0.zip` и описанием из `docs/release-notes/v1.0.0.md`.
4. **Проверь как пользователь:** скачай этот zip, распакуй, запусти `install.bat`.

**Если автоматика не сработала** (красный крестик в Actions) — можно вручную:
*Releases → Draft a new release* → *Choose a tag*: `v1.0.0` → *Title*: `local.ai+ v1.0.0` → в описание вставь текст из `docs/release-notes/v1.0.0.md` → перетащи файл `dist\localai-plus-v1.0.0.zip` (собрать его: `powershell -ExecutionPolicy Bypass -File tools\make-release.ps1`) → **Publish release**.

## 8. Рассказать людям

Пара идей: Reddit r/SillyTavernAI, Discord SillyTavern (канал с расширениями), русскоязычные сообщества про локальные нейросети. Ссылку давай на страницу проекта — там README и кнопка Releases.

---

## Как выпускать обновления потом

1. Внеси изменения (или попроси Claude).
2. Подними номер в файле `VERSION` (например `1.0.1` — исправления, `1.1.0` — новые функции).
3. Допиши `CHANGELOG.md` и создай `docs/release-notes/v1.0.1.md` (что нового — для страницы релиза).
4. GitHub Desktop: Commit → Push origin → History → правой кнопкой → Create Tag `v1.0.1` → Push origin.
5. Всё остальное (сборка zip и страница релиза) GitHub сделает сам. Пользователи обновляются, просто запустив новый `install.bat`.

## Мелочи

- В `LICENSE` стоит `Copyright (c) 2026 local.ai+ contributors`. Можно вписать свой ник вместо `local.ai+ contributors` — лицензия от этого не меняется. Остальной текст файла не трогай, иначе GitHub перестанет распознавать MIT.
- Если кто-то пришлёт Issue или Pull Request — GitHub пришлёт письмо. Шаблоны форм уже настроены (`.github/ISSUE_TEMPLATE`).
- Вкладка **Actions → Check** проверяет каждое изменение (переводы, синтаксис). Зелёная галочка — всё хорошо.
