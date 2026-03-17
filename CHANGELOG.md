# Changelog

## 4.1.3

- **Notification Card Refresh**: Redesigned in-product update and milestone notifications with a richer floating card layout, clearer actions, and improved highlight readability.
- **Milestone Celebration UI**: Added a dedicated support milestone hero with formatted export counts and celebratory visual treatment.
- **Clipping Reliability**: Improved repeated-section recovery on wrapped-heading layouts so extractions are less likely to start mid-article on structured docs pages.
- **Regression Coverage**: Expanded real-world extraction tests for repeated-section recovery edge cases to lock in the clipping fix.

## 4.1.2

- **In-Product Notifications**: Added queued update and support milestone notifications with release-note links inside the extension.
- **Options Management**: Added settings search with stricter fallback matching, per-setting reset links, a global **Reset All** action, and clearer URL metadata guidance.
- **Batch Processing UX**: Improved the link picker, kept the popup open after batch start, and added an in-page progress overlay with a cancel button for running batches.
- **Clipping Reliability**: Added two-pass readability recovery for repeated-section pages, preserved legacy `baseURI` behavior with SPA-safe page URL fields, and fixed `saveAs` handling in blob fallback paths without mutating markdown options.
- **Accessibility & Packaging**: Bundled popup/options fonts locally, improved keyboard accessibility, and opened the options page in a browser tab by default.
- **Licensing**: Replaced the Apache License with the PolyForm Noncommercial License.

## 4.1.1

- **Selection Capture Fix**: Preserved selected HTML context during conversion to prevent broken markdown output from partial selections.
- **Math Output Normalization**: Normalized math rendering paths for cleaner markdown output when clipping selected content.
- **Regression Coverage**: Added unit tests for selection capture behavior to lock in the fix.
- **Options Sidebar**: Added a new **Leave Review** button under **Buy Me a Coffee** that automatically links to Chrome Web Store or Firefox Add-ons reviews based on the current browser.

## 4.1.0

- **Markdown Controls**: Added configurable hashtag handling modes (`keep`, `remove`, `escape`) with safer conversion behavior and dedicated tests.
- **Math Extraction Reliability**: Improved LaTeX capture flow before DOM snapshotting and fixed KaTeX handling in offscreen processing when annotation fallback is missing.
- **Popup Appearance Settings**: Added popup customization controls for color mode, accent colors, and compact mode.
- **Options Page Refresh**: Redesigned the options page to align with the popup design system and improved sidebar behavior.
- **Options UX Improvements**: Added visual examples for table settings, a CodeMirror editor theme selector, helper hints for key toggles, and a donation button in the sidebar.
- **Test Coverage**: Added end-to-end URL snapshot batch coverage with fixtures for real-world pages.

## 4.0.7

- **Token Estimation**: Improved accuracy with per-content-type segmentation that better handles URLs, code blocks, markdown syntax, and non-ASCII characters.
- **Editor Stats**: Added a cycling character/word/token counter badge to the editor header in the popup.
- **Code Blocks**: Cleaned up `<pre>` code block conversion and added a controllable language-detection toggle in settings.
- **Clipping Reliability**: Fixed a bug where the content script could mutate the live DOM during clipping; now operates on a cloned document.
- **Docs**: Added Firefox installation instructions and linked them from the README.

## 4.0.6

- **Firefox Support**: Unified offscreen processing across Chrome and Firefox by loading `offscreen/offscreen.html` in Firefox and routing clipping through the same messaging path.
- **Firefox Build Output**: Updated browser manifest generation so Firefox bundles required background scripts and excludes the Chrome-only `offscreen` permission.
- **Readability Improvements**: Cherry-picked Safari Reader heuristics into `Readability.js` for better article extraction on difficult pages.
- **Regression Coverage**: Added end-to-end tests for command routing and download behavior (`command-download-regression.spec.js`).

## 4.0.5

- **Download Reliability**: Fixed filename conflicts with other extensions by only handling downloads positively identified as MarkSnip-owned.
- **Filename Safety**: Added fallbacks for empty/missing titles to prevent invalid or blank `.md` filenames.
- **Quality**: Added targeted unit tests for filename conflict handling and empty-title edge cases.
- **Docs/UI**: Refreshed README and user guide content and made small popup header styling updates.

## 4.0.4

- **UI Modernization**: Updated popup buttons with the Inter font and a new batch processing icon for a more polished look.
- **Batch Link Picker**: Improved the user experience of the link picker with smooth animations and a consistent sage-green color palette.

## 4.0.3

- **Firefox Compatibility**: Added `data_collection_permissions` and updated the extension ID for better Firefox support.
- **Reliability**: Improved keyboard shortcut reliability for "Copy as Markdown" and "Save as Markdown" actions.
- **Bug Fix**: Fixed "Strip Images" option not being honored when images were inside tables.
- **Build System**: Added support for generating browser-specific manifest files for Chrome and Firefox.

## 4.0.2

- Redesigned settings panel and popup with improved layout and polished styling
- Hide "Send to Obsidian" button when Obsidian integration is disabled in settings
- Converted "Download Images" and "Include Template" options to iOS-style inline toggles to save space
- Updated batch processing UI: replaced radio buttons with iOS-style switches for "Zip file" and "Individual files" options, and resized the "Pick Links from Page" button
- Increased popup window height to show more of the markdown preview

## 4.0.1

- Fixed download filename being overridden by other extensions
- Fixed keyboard shortcuts not working after Manifest V3 migration
- Added visual link picker feature for selecting links on a page during batch processing
- Fixed link picker data passing when popup closes
- Fixed script re-injection errors in link picker
- Fixed CI build workflow: excluded unnecessary files from Chrome package and improved npm compatibility

## 4.0.0

- Complete popup UI overhaul with a modern, redesigned interface
- Added **Send to Obsidian** button with the official Obsidian logo
- Fixed Obsidian integration: resolved CSP violations, corrected URI scheme, added `.md` extension to filenames, and improved clipboard reliability
- Added batch URL processing with progress indicator and markdown link output support
- Persisted batch processing URLs across popup sessions so they don't disappear on close
- Updated Readability.js to the latest version
- Added a comprehensive automated test suite for core markdown conversion functionality
- Fixed critical markdown conversion bugs found via test suite
- Various popup layout, styling, and UX improvements

## 3.9.0

- Fixed referenced link styles not working properly
- Added suggested keyboard shortcuts for copy-tab and copy-selection actions in the manifest

## 3.8.0

- Fixed subfolder downloads that were broken after the Manifest V3 migration

## 3.7.0

- Fixed image downloads broken after Manifest V3 migration

## 3.6.0

- Fixed "Strip Links" option not removing links from clipped content
- Fixed table handling for complex cell content such as lists
- Fixed links in tables being dropped when the strip links option was disabled
- Added "Copy" buttons to batch processing UI and improved batch UI layout

## 3.5.0

- Rebranded extension from MarkDownload to **MarkSnip** with updated name, icons, and options
- Migrated extension to **Manifest V3** (service worker, offscreen document, updated permissions)
- Fixed multiple issues introduced by the MV2 → MV3 migration (context menus, scripting API, clipboard)
- Refactored script execution and content retrieval to use service worker messaging
- Added option to preserve or clean code block formatting (indentation/whitespace)
- Added `highlight.min.js` for automatic code language detection in code blocks
- Added table formatting options in the options page
- Updated extension description to mention core libraries (Turndown & Readability)

## 3.4.0

- Fixed extra spaces in titles which could cause issues (thanks @rickdoesdev !)
- Fixed an issue with image paths in some circumstances (thanks @rickdoesdev !)
- Added parametersizations for "mixed-kebab" and "mixed_snake" which retain original casing but replace spaces (thanks @NSHenry !)
  - Also added a special "obsidian-cal" parameterization which is the same as "mixed-kebab" with duplicate `-` removed for additional compatibility with the Obsidian Consistent Attachment Location plugin (thanks @NSHenry !)
- Added lowecase and uppercase options to parameterizations (thanks @redxtech !)
- Updated Turndown to v7.1.3 (thanks @WeHat !)
- Updated Readability to v0.5.0 (thanks @WeHat !)
- Fixed some issues with code block parsing and formatting (thanks @WeHat !)
- Fixed an issue with some sites missing a proper title (thanks @WeHat !)
- Fixed an issue with bad base urls causing issues with links in certain circumstances (thanks @WeHat !)
- Fixed an issue with readability removing everything in certain circumstances (thanks @WeHat !)
- Send properly configured title to the Obsidian integration (thanks @nekton39 !)
- Updates to the README (thanks @2gn and @eugenesvk !)

## 3.3.0

- Remove hidden content before exporting (thanks @nhaouari !). This allows you to use a different extension (e.g. Adblock) to hide elements that would otherwise clutter up your export
- Fixes for Obsidian integration in Safari (thanks @aancw !)
- Keep a few more HTML tags that have no markdown equivalent (`u`, `ins`, `del`, `small`, `big`) (thanks @mnaoumov !)
- Add support for KaTeX formulas parsing (thanks @mnaoumov !)
- Fixed saving for options when imported from file (and show a little 'saved' indicator)
- Added a toggle for downloading images in the context menu and popup
- Added a link to the options in the popup
- Added some basic error handling to the popup
- Changes to how html inside code blocks is handled (thanks @mnaumov !)
- Treat codehilite without specified language as plaintext (thanks @mnaoumov !)
- Ensure sequential line breaks in <pre> are preserved in code blocks (thanks @mnaumov !)
- Update user guide link in README to point to GitHub
- Added keyboard shortcuts to copy selection / current tab to obsidian (user-definable in browsers that support that) (thanks @legolasdimir and @likeablob !)
- Select multiple tabs (hold crtl/cmd) then copy all tab urls as a markdown link list via keyboard shortcut or context menu (thanks @romanPrignon !)
- Allow users to include custom text such like `{date:YYYY-MM-DD}/`` in their Obsidian Folder Name setting (thanks @likeablob !)
- Fixed a small typo in the user guide (thanks @devon-research !)
- Fix for missing headings on sites like Substack (thanks @eactisgrosso !)
- Add support for websites using MathJax 3 (thanks @LeLocTai !)

## 3.2.1

- Bugfixes for the Obsidian integration (thanks @aancw !)

## 3.2.0

- Added a basic Obsidian integration using the [Obsidian Advanced URI](https://vinzent03.github.io/obsidian-advanced-uri/) plugin and clipboard (thanks @aancw !)
- Keep sub/sup tags so that superscript and subscript text is retained (thanks @mnaoumov !)
- Added a keyboard shortcut for copy selection as markdown (nothing by default, needs to be user-configured)
- Added a new context menu item to copy all tabs as a list of markdown links
- Updated dependencies

## 3.1.0

- Firefox for Android (nightly) support
- Updated Readability and Turndown
- Added GitHub-flavoured Markdown (GFM) plugin to Turndown (adds some mardown table support)
- Added support for MathJax -> LaTeX (thanks @LeLocTai)
- Disallow slashes in title text replacements
- Suport for Open Graph meta tags as variables (which use `property` instead of `key`)
- Fixed an issue with regex characters like `|` in date formats
- Resolved an extra slash in file name causing images to fail to download in chromium browsers
- Added some support to parse pre elements as code blocks (supports syntax highlighting on GitHub, but not much else yet)
- Added option to enable or disable the context menus
- Added some extra keyboard shortcuts. These can be customised, depending on your browser
  - <kbd>Alt</kbd>+<kbd>Shift</kbd>+<kbd>M</kbd> opens the popup (as it has in previous versions)
  - <kbd>Alt</kbd>+<kbd>Shift</kbd>+<kbd>D</kbd> downloads the current tab as markdown, bypassing the popup
  - <kbd>Alt</kbd>+<kbd>Shift</kbd>+<kbd>C</kbd> copies the current tab as markdown to the clipboard, bypassing the popup
  - <kbd>Alt</kbd>+<kbd>Shift</kbd>+<kbd>L</kbd> copies the current tabs URL as a markdown link to the clipboard
- Added support for template variables having different casing using `:` followed by the casing type. For example, for an article titled "Different Types of Casing":
  - `{pageTitle:pascal}` — "DifferentTypesOfCasing"
  - `{pageTitle:camel}` — "differentTypesOfCasing"
  - `{pageTitle:kebab}` — "different-types-of-casing"
  - `{pageTitle:snake` — "different_types_of_casing"
- Added support for rending italics in double underscores (`__`). This isn't valid MarkDown (will output as **bold**), but it's useful for people copying to Roam
- Support image download as base64 embedded urls, directly in the markdown file
- Added some extra variables related to the url beyond the existing `{baseURI}`:
  - `{origin}` - The origin of the URL, that is its scheme, its domain and its port
  - `{host}` - The domain (that is the _hostname_) followed by (if a port was specified) a `:` and the _port_ of the URL.
  - `{hostname}` - The domain of the URL.
  - `{port}` - The port number of the URL.
  - `{protocol}` - The protocol scheme of the URL, including the final `':'`.
  - `{pathname}` - An initial `'/'` followed by the path of the URL, not including the query string or fragment.
  - `{search}` - The URL's parameter string; if any parameters are provided, this string includes all of them, beginning with the leading `?` character.

## 3.0.0

- Theme revamp
- Utilizing CodeMirror for the Markdown Editor
- Strip Disallowed characters on title and image filenames during text replacement
- Add "Download Type" option, to attempt to resolve conflicts with other Download extensions (and to help support Safari!)
- Add options for stripping images and links
- Fixes around downloading images and getting correct urls in the markdown
- Added meta keywords support for the text replace
- Added text replace support for meta tags in general
- Add option to disable turndown escaping
- Strip out 'red dot' special characters
- Added an option to specify a download path (within the downloads folder). Thanks to Nikita Lukianets!

## 2.4.1

- Add option for Obsidian-style image links (when downloading images with the markdown file)
- Downloaded images should download relative to the markdown file in the case where you specify a subfolder in your title template
- Front- and back-matter template will no longer put in extra lines on Opera
- Adjusted the way text is copied to the clipboard

## 2.4.0

- Fixed typo on options page (thanks Dean Cook)
- Added option to download images alongside the markdown file
  - Also added the ability to add a prefix to the images you download, so you can, for example, save them in a subfolder
  - If your browser has the option to always show a save as dialog enabled, you might get a dialog for every image. Sorry about that 😬
- Updated turndown to 7.0.1 and allowed iframes to be kept in the markdown
- Added a new `{pageTitle}` option for template replacement (there are many websites where the `{title}` and `{pageTitle}` actually differ)
- Added a context menu option to copy a tab URL as a markdown link, using the title configured in settings as the link title (i.e. `[<custom title>](<URL>)`)
- Added custom disallowed characters to strip from titles (set to `[]#^` by default for maximum compatibility with Obsidian)
- Added some focus styling so you can tell what is focused
- Auto-focus the download button (you can now `ctrl`+`shift`+`M`, Enter to quickly download a file)
- Template title (and image prefixes) now allow forward slashes (`/`) so that files get saved to a subfolder

## 2.3.1

- Added template toggle to Firefox's tab context menu

## 2.3.0

- Added contexy menus for copying markdown
- Added options to clip selected text
- Include front-matter/back-matter templates in popup
- Add title templating
- Added keyboard shortcut to show the popup
- Added option to always show Save As
- Added context menus to download all tabs as markdown

## 2.2.0

- Added extension options
  - Turndown (markdown generation) options
  - Front-matter/back-matter templates with replacement variables from page metadata (and date)

## 2.1.6

- Replace non-breaking spaces in filenames

## 2.1.5

- Fixed an issue with sites with invalid `<base>` tags

## 2.1.4

- Fixed issue with relative links [#1](https://github.com/deathau/markdownload/issues/1)

## 2.1.3

- Fist change, forked from [enrico-kaack/markdown-clipper](https://github.com/enrico-kaack/markdown-clipper)
- Added URL to markdown output ([#5](https://github.com/deathau/markdownload/issues/5))
