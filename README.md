# MarkSnip

Markdown web clipper for Chrome and Firefox. Save pages as clean Markdown, copy content to clipboard, or send notes directly to Obsidian.

[Chrome Web Store](https://chromewebstore.google.com/detail/marksnip-markdown-web-cli/kcbaglhfgbkjdnpeokaamjjkddempipm?hl=en) | [Firefox Add-ons](https://addons.mozilla.org/en-US/firefox/addon/marksnip-markdown-web-clipper/) | [User Guide](user-guide.md) | [Changelog](CHANGELOG.md) | [Privacy Policy](PRIVACY.md)

![MarkSnip popup](media/Chrome.Screenshot.1.png)

## Why MarkSnip

MarkSnip is a Manifest V3 fork of [MarkDownload](https://github.com/deathau/markdownload/) focused on reliable markdown conversion, batch workflows, and browser-store compatibility.

Core pipeline:

- Content extraction with Mozilla Readability
- HTML to Markdown conversion with Turndown
- Optional template injection, image handling, and formatting controls

## Features

- Clip full page or selected text
- Edit markdown before saving
- Batch conversion from URL lists or markdown links
- Save batch output as ZIP or individual files
- Context menu actions for page, selection, links, images, and tabs
- Obsidian integration (via Advanced URI + clipboard)
- Keyboard shortcuts for common actions
- Rich markdown formatting controls (headings, fences, links, images, tables, templates)
- Import/export extension settings as JSON

## Install

### Chrome (stable)

Install from the [Chrome Web Store](https://chromewebstore.google.com/detail/marksnip-markdown-web-cli/kcbaglhfgbkjdnpeokaamjjkddempipm?hl=en).

### Firefox (stable)

Firefox support is available starting in `v4.0.6`.
Install from [Firefox Add-ons](https://addons.mozilla.org/en-US/firefox/addon/marksnip-markdown-web-clipper/).

### Load unpacked (local build)

1. `cd src`
2. `npm ci`
3. `npm run build:manifests`
4. Open `chrome://extensions`
5. Enable Developer mode
6. Click **Load unpacked** and select `src/.build/chrome`

### Firefox (local build)

1. `cd src`
2. `npm ci`
3. `npm run build:manifests`
4. Load `src/.build/firefox` as a temporary add-on in Firefox, or package with release workflow.

## Usage

1. Click the extension icon to open the popup.
2. Choose **Selection** or **Document**.
3. Review/edit markdown.
4. Use **Download**, **Copy All**, or **Send to Obsidian**.

Batch mode:

1. Open popup and click the batch icon.
2. Paste URLs (or markdown links), one per line.
3. Choose **ZIP** or **Individual** output.
4. Click **Convert All URLs**.

## Keyboard Shortcuts

- `Alt+Shift+M`: Open popup
- `Alt+Shift+D`: Download current tab as markdown
- `Alt+Shift+C`: Copy current tab as markdown
- `Alt+Shift+L`: Copy current tab URL as markdown link

Additional commands (selection, selected tabs, Obsidian actions) are available in browser shortcut settings.

## Development

All development commands run from `src/`.

### Prerequisites

- Node.js 20+
- npm

### Setup

```bash
cd src
npm ci
```

### Common scripts

- `npm test` - Run Jest test suite
- `npm run test:unit` - Unit tests
- `npm run test:integration` - Integration tests
- `npm run test:e2e` - Playwright end-to-end tests
- `npm run build:manifests` - Generate browser-specific manifests
- `npm run build` - Firefox package build via `web-ext`
- `npm run build:chrome` - Chrome ZIP package
- `npm run build:all` - Build Firefox + Chrome artifacts

## Build Architecture

`src/manifest.json` is the source manifest. `src/scripts/generate-browser-manifests.js` generates:

- `src/.build/chrome/manifest.json` with `background.service_worker`
- `src/.build/firefox/manifest.json` with `background.scripts`

The `.build/` directory is generated output and should not be committed.

## Release Flow

GitHub Actions workflow [`.github/workflows/build-release.yml`](.github/workflows/build-release.yml):

1. Runs unit and integration tests.
2. Builds browser manifests.
3. Packages:
   - `marksnip-chrome-<version>.zip`
   - `marksnip-firefox-<version>.xpi`
4. Publishes a GitHub Release on `v*` tags (or manual `workflow_dispatch`).

To publish:

1. Update version in `src/manifest.json`
2. Update `CHANGELOG.md`
3. Tag and push, for example:

```bash
git tag v4.0.4
git push origin v4.0.4
```

## Project Structure

```text
.
|- src/
|  |- background/
|  |- contentScript/
|  |- offscreen/
|  |- options/
|  |- popup/
|  |- scripts/
|  |- shared/
|  |- tests/
|  `- manifest.json
|- CHANGELOG.md
|- PRIVACY.md
`- user-guide.md
```

## Privacy

MarkSnip does not send clipped page content to external servers. See [PRIVACY.md](PRIVACY.md) for details.

## Credits

- Original [MarkDownload](https://github.com/deathau/markdownload/) by deathau
- [Readability.js](https://github.com/mozilla/readability)
- [Turndown](https://github.com/mixmark-io/turndown)
- [CodeMirror](https://codemirror.net/)
- [highlight.js](https://highlightjs.org/)

## License

This project is licensed under the [PolyForm Noncommercial License](LICENSE).
