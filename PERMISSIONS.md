# MarkSnip - Extension Permissions

This document explains every permission declared in `src/manifest.json`, why it is needed, and what the extension would lose without it.

---

## Core Permissions

### `activeTab`
**Why it's needed:** Grants temporary access to the currently active tab when the user clicks the MarkSnip icon or triggers a keyboard shortcut. This allows the extension to read the page's URL, title, and content for conversion.

**Without it:** The extension could not read the current page to convert it to Markdown.

**Privacy note:** Access is granted only for the moment the user explicitly invokes the extension — the extension cannot silently read tabs in the background.

---

### `downloads`
**Why it's needed:** Used by the "Save as Markdown" feature to write `.md` files (and `.zip` archives for batch exports) to the user's local filesystem via the browser's built-in download mechanism.

**Without it:** Saving Markdown files to disk would not be possible.

---

### `storage`
**Why it's needed:** Persists the user's settings (template strings, formatting preferences, Obsidian vault config, Agent Bridge settings, etc.) in the browser's local storage so they survive page reloads and browser restarts.

**Without it:** All settings would reset every time the extension reloads; no preferences could be saved.

---

### `contextMenus`
**Why it's needed:** Adds MarkSnip actions to the right-click context menu for pages, selected text, links, images, and browser tabs — letting users clip content without opening the popup.

**Without it:** Context menu entries (e.g., "Copy selection as Markdown") would not appear.

---

### `clipboardWrite`
**Why it's needed:** Allows the extension to write Markdown text directly to the system clipboard when the user chooses a "Copy as Markdown" action instead of downloading a file.

**Without it:** All "Copy to clipboard" commands would silently fail.

---

### `nativeMessaging`
**Why it's needed:** Enables communication with the optional **Agent Bridge CLI** — a locally installed helper program that lets AI agents and automation scripts request Markdown clipping programmatically. The CLI runs entirely on the user's own machine; no data leaves the device.

**Without it:** The Agent Bridge feature (programmatic/API access for AI agents) would not function. All other clipping features remain unaffected.

**Privacy note:** This permission is only active when the user has installed and configured the Agent Bridge CLI. No external servers are contacted.

---

### `scripting`
**Why it's needed:** Injects the content script (`contentScript/pageContext.js`) into web pages at clip time to extract the page's DOM, selected text, and metadata (title, author, date, etc.) for Markdown conversion.

**Without it:** The extension could not access page content to convert it.

---

### `offscreen`
**Why it's needed:** Creates a hidden offscreen document used for clipboard operations in Manifest V3 service workers, which do not have direct DOM access. The offscreen document acts as a bridge to write text to the clipboard.

**Without it:** Clipboard write operations initiated from the background service worker would fail in Chromium-based browsers.

---

## Host Permissions

### `<all_urls>`
**Why it's needed:** Allows content scripts to be injected into any website the user navigates to, so the extension can clip content from any page — not just a predefined list of domains.

**Without it:** The extension could only clip content from sites explicitly listed in the manifest, making it useless on most of the web.

**Privacy note:** This does **not** mean the extension passively monitors all websites. Scripts are injected only when the user actively triggers a clip action on a page. No browsing data is collected or transmitted.

---

## Web Accessible Resources

### `contentScript/pageContext.js`
A script injected into pages at clip time to capture page context (e.g., `document.URL`, metadata, selected text). It is declared as a web-accessible resource so it can be loaded into the page's own JavaScript context for accurate DOM access.

### `guide/guide.html`
The in-extension guide/help page. It must be web-accessible so it can be opened as a new browser tab from within the extension UI.

---

## Data & Privacy Summary

| Permission | Sends data externally? | User-triggered only? |
|---|---|---|
| `activeTab` | No | Yes |
| `downloads` | No (local filesystem) | Yes |
| `storage` | No (browser local storage) | Yes |
| `contextMenus` | No | Yes |
| `clipboardWrite` | No (local clipboard) | Yes |
| `nativeMessaging` | No (local CLI only) | Yes (opt-in feature) |
| `scripting` | No | Yes |
| `offscreen` | No | Yes |
| `<all_urls>` | No | Yes |

All content processing happens **locally on your device**. MarkSnip does not transmit page content, clipboard data, or browsing history to any external server.
