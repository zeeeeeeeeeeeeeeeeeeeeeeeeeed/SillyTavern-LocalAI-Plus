<div align="center">

# (local.ai+)

**A character.ai-style interface and character catalog for [SillyTavern](https://github.com/SillyTavern/SillyTavern)**

[Русский](README.md) · **English**

![License: MIT](https://img.shields.io/badge/license-MIT-green)
![SillyTavern 1.13+](https://img.shields.io/badge/SillyTavern-1.13%2B-blueviolet)
![Windows installer](https://img.shields.io/badge/installer-Windows-0078D6)
![Languages: RU, EN](https://img.shields.io/badge/languages-RU%20%7C%20EN-orange)

</div>

Installs on top of an existing SillyTavern and turns it into a familiar “character.ai”: a left-side menu, chats with avatars, tidy settings windows, a phone-friendly layout — and a **Discover** tab where you can find a character on chub.ai, Pygmalion or RisuRealm and start chatting in one click.

> This is an unofficial add-on. It is not affiliated with Character.AI or the SillyTavern team — the interface is just inspired by it.

<!-- SCREENSHOTS: put images into docs/screenshots/ (see docs/PUBLISHING.md) and remove this line and the line at the end of the block
<p align="center">
  <img src="docs/screenshots/main.png" alt="Main screen" width="49%">
  <img src="docs/screenshots/catalog.png" alt="Discover catalog" width="49%">
</p>
<p align="center">
  <img src="docs/screenshots/settings.png" alt="Settings window" width="49%">
  <img src="docs/screenshots/mobile.png" alt="Phone" width="24%">
</p>
-->

---

## What's inside

| | |
|---|---|
| 🧭 **c.ai-style layout** | Left menu: “+ Create”, “Discover”, “My characters”, “Me”, expandable “Settings” with labels, search and the chat list. Settings open as a centered window; on a phone — the ☰ menu and settings as a bottom sheet. |
| 🔎 **Discover catalog** | Search characters on **chub.ai**, **Pygmalion** and **RisuRealm**. Filters: card language, genre, size, freshness, 18+, alternative greetings, lorebook. “Add and start chatting” downloads the card for you. |
| ✨ **Persona generator** | In the “Me” tab: describe your character in a couple of phrases — the model writes a detailed profile and inserts it into your persona. |
| 🪄 **Setup wizard** | On first launch it offers (only with your consent) to make characters reply in your language, enable long-term memory, take the chat template from the model, and more. |
| ❓ **Help** | What every button does — right inside the interface. |
| 🌍 **Languages** | English and Russian: interface, help, wizard and even the prompts sent to the model. Chosen on first launch, switchable in “Language · Язык”. |

Any model and backend work: KoboldCpp, llama.cpp, Ollama, text-generation-webui, online APIs. The add-on is not tied to specific hardware or a specific model.

---

## Requirements

- **Windows 10/11** for one-click installation. On Linux/macOS — [manual installation](#manual-installation-linux-macos-or-if-the-installer-fails).
- **SillyTavern 1.13 or newer** already installed (tested on 1.19). Don't have it yet? See the [SillyTavern guide](https://docs.sillytavern.app/installation/windows/).
- An AI connected to SillyTavern (for chatting and the persona generator).
- Internet — only for the catalog and translation. Chats themselves work offline with a local model.

---

## Installation

1. **Download the archive** of the latest version: on the right side of the repository page → **Releases** → `localai-plus-vX.Y.Z.zip`.
2. **Unpack** it anywhere (for example, to your desktop).
3. Double-click **`install.bat`** and choose the installer language (Русский / English).
   - **You usually don't need to point to SillyTavern** — the installer looks for it for a few seconds (next to the archive, in your profile, on all drives) and asks “Install here?”. If there are several copies, it shows a list.
   - If it can't find it — open your SillyTavern folder (the one with `Start.bat` and `server.js`) and **drag it into the installer window**: the path will be pasted.
   - Answer the multilingual memory question (“yes” is recommended).
4. **Restart SillyTavern**: close its window and run `Start.bat` again.
5. Open SillyTavern in your browser (or press **F5** if it's already open).
6. First you'll see **“Choose your language”**, then **“Recommended settings”**: tick what you like and press “Apply”. Both can be opened again from the menu: *Settings → Language · Язык* and *Settings → Recommended settings*.

> If Windows says “Windows protected your PC”, click “More info” → “Run anyway”. This happens with any downloaded script; the installer's code is open and lives in the `installer` folder.

### Updating

Download the new version, unpack it and run `install.bat` again. It remembers where it installed last time and offers to update there. Your characters, chats and settings are not touched.

### Uninstalling

- **Get the regular SillyTavern look back without removing anything:** *Settings → Modules* → disable “local.ai+ · Layout / Раскладка”.
- **Remove completely:** run `uninstall.bat`. Characters, chats and settings stay.

---

## How to use

- **Discover** (compass) — the catalog. Tabs at the top switch the site. The sliders button next to search opens filters. Click a character → “Add and start chatting”.
- **My characters** — the list, importing your own cards (PNG/JSON), editing.
- **Me** — your name and description. The “✨ Write a description with AI” button writes a persona from your idea.
- **☰** left of the message box — new chat, all chats, regenerate, continue, help.
- **Right arrow** under a reply — another version of the reply (like swiping on c.ai).

Full help is inside the interface: *Settings → Help*.

### Interface and reply language

The language (English / Русский) is chosen on first launch and can be changed any time: *Settings → Language · Язык*. It switches both the SillyTavern interface and everything local.ai+ adds.

After switching, a hint appears: click it and apply **“Characters reply in…”** so the characters switch to the new language too.

### On a phone

The interface adapts to phones. To open SillyTavern from a phone on your home network, SillyTavern has to allow remote connections — see the [SillyTavern docs](https://docs.sillytavern.app/usage/remoteconnections/). Then open `http://YOUR-PC-IP:8000` on the phone and choose “Add to Home screen” in the browser menu.

---

## Troubleshooting

| Symptom | What to do |
|---|---|
| The interface didn't change | Restart SillyTavern and press **Ctrl+F5** in the browser. Check that the “local.ai+ · …” extensions are enabled in *Settings → Modules*. |
| Part of the interface is in another language | *Settings → Language · Язык* → pick yours. |
| Catalog says “the local.ai+ plugin is not running” | SillyTavern's `config.yaml` must contain `enableServerPlugins: true` (the installer sets it) — and SillyTavern must be **restarted**. |
| Catalog: “Failed to fetch” / nothing loads | Check your internet connection. If the sites are blocked by your provider, turn on a VPN: the plugin picks up the Windows system proxy automatically. You can set your own proxy in `SillyTavern/plugins/localai-card-sources/config.json`: `{ "proxy": "http://127.0.0.1:PORT" }`. |
| A RisuRealm card takes long to download | That's normal: many RisuRealm authors disallow PNG export, so the full archive with images is downloaded (40+ MB sometimes). |
| “The author does not allow downloading” | The card's author on RisuRealm closed it for export — pick another one. |
| A character replies in the wrong language | Open *Settings → Recommended settings* and enable “Characters reply in: …”. Some models are weak in some languages — try another model. |
| Persona generator: “No connection to the model” | Check the connection in *Settings → Model* (the dot should be green). |
| I want everything back as it was | `uninstall.bat` — it offers to restore `config.yaml` from the `config.yaml.before-localai` backup. |

Found a bug? Open an [Issue](../../issues) and include: SillyTavern version, local.ai+ version (the `VERSION` file), what you did and what you saw (a screenshot + the browser console text from F12, if any).

---

## Manual installation (Linux, macOS, or if the installer fails)

1. Copy **all** folders from `addon/extensions/` (`localai-core`, `localai-layout`, `localai-catalog`, `localai-persona`, `localai-setup`) into `SillyTavern/data/default-user/extensions/`.
2. Copy `addon/plugins/localai-card-sources` into `SillyTavern/plugins/`.
3. In `SillyTavern/config.yaml` set `enableServerPlugins: true`.
4. (Recommended) In the same file, under `extensions → models`, set `embedding:` to `Xenova/multilingual-e5-small` — for memory search in non-English languages.
5. Restart SillyTavern.

---

## Good to know

- **The catalog uses unofficial APIs** of chub.ai, Pygmalion and RisuRealm. If the sites change something, the catalog may break temporarily — wait for an update.
- **These sites contain a lot of 18+ content.** It is shown or hidden with the “18+” filter. Cards tagged as involving minors are never shown.
- Cards belong to their authors — respect the licenses stated on the sites.
- The catalog plugin only talks to these three sites and is not an open proxy.

---

## Help with translation

English and Russian are available; Japanese and Simplified Chinese are planned. A translation is one JSON file with strings plus one help page — no programming needed. See [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md) (section “Как добавить язык” / adding a language).

## For developers

How the project works, how to add a catalog site or a language, and how to release a version — [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md) (in Russian).

## License

The project is released under the **[MIT License](LICENSE)** — one of the most permissive open-source licenses. In plain words:

- ✅ **Use it** — free of charge, for any purpose, including commercial projects.
- ✅ **Modify the code** however you like.
- ✅ **Publish** your own versions and forks — under your own name, open or closed.
- 📝 **The only condition:** keep the `LICENSE` file (the license text and the copyright line) in your copies.
- ⚠️ **No warranty:** the code is provided “as is”; the authors are not liable for any consequences of using it.

The legally binding text is the one in [LICENSE](LICENSE); the summary above is for convenience.

SillyTavern is distributed under its own license (AGPL-3.0) and is not part of this repository.
