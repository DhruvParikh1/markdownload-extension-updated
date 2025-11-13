# MarkSnip - Markdown Web Clipper

## [MarkSnip Chrome Extension Link](https://chromewebstore.google.com/detail/marksnip-markdown-web-cli/kcbaglhfgbkjdnpeokaamjjkddempipm?hl=en)

MarkSnip is a powerful browser extension that helps you save web content in clean, formatted Markdown. Forked from the excellent [MarkDownload](https://github.com/deathau/markdownload/) extension, MarkSnip has been updated to Manifest V3 to comply with Chrome Extension Store requirements while adding enhanced features like improved table formatting, cleaner code blocks, and better overall readability.

## Features

- Clean article extraction using Mozilla's Readability.js
- Accurate HTML to Markdown conversion with Turndown
- Pretty-printed tables with customizable formatting (new)
- Enhanced code block handling with language detection
- Image downloading and management
- Obsidian integration
- Extensive context menu options
- Batch URL processing for converting multiple pages at once (new)
- Customizable front/back matter templates
- Dark mode support

## For Developers

As a developer, documentation is crucial to your workflow. MarkSnip streamlines the process of saving technical documentation for use with Large Language Models (LLMs) and other development tools:

- **One-Click Documentation Export**: Instead of manually copying sections of API documentation, code examples, and explanations, capture entire documentation pages with a single click - complete with proper code block formatting and syntax highlighting.

- **LLM-Ready Format**: The clean Markdown output is perfect for feeding into LLMs for code assistance, making it easier to work with AI tools while coding.

- **Code Block Preservation**: All code snippets are automatically detected and preserved in fenced code blocks with proper language tags, maintaining syntax highlighting and formatting.

- **Batch Processing**: When researching multiple technologies, use the "Download All Tabs" feature to quickly save entire documentation sets as separate Markdown files.

- **Table Handling**: Technical specifications and API parameter tables are converted with clean formatting, making them easy to reference or process programmatically.

## Use Cases

### Developers
- Save API documentation for offline reference or LLM assistance
- Capture code snippets with proper syntax highlighting
- Build personal knowledge bases of technical solutions
- Archive GitHub READMEs and documentation
- Save Stack Overflow solutions with formatting intact

### Researchers
- Collect academic articles and papers for citation
- Save methodology sections with tables and figures
- Archive research data with proper formatting
- Create literature review collections
- Export conference proceedings

### Writers & Content Creators
- Save reference materials with proper attribution
- Capture style guides and brand documentation
- Archive published articles for portfolios
- Save inspiration pieces with images
- Create content briefs from multiple sources

### Students
- Save lecture notes and course materials
- Create study guides from online resources
- Archive educational articles and papers
- Save code examples from programming tutorials
- Collect reference materials for assignments

### Knowledge Workers
- Build personal knowledge management systems
- Save meeting notes and documentation
- Create project wikis from multiple sources
- Archive important emails and communications
- Save process documentation and workflows

### Data Analysts
- Save data documentation and schemas
- Capture methodology descriptions
- Archive data visualization explanations
- Save SQL queries and explanations
- Create data dictionaries from web sources

### Designers
- Save design system documentation
- Archive UI/UX patterns with examples
- Collect inspiration with images
- Save accessibility guidelines
- Create component documentation

## User Guide

1. **Basic Clipping**
   - Click the MarkSnip icon in your browser toolbar
   - Choose between clipping the entire page or selected text
   - Edit the generated Markdown if needed
   - Click "Download" to save as a .md file

2. **Batch Processing**
   - Click the Batch Mode icon (📑) in the extension popup
   - Enter multiple URLs (one per line)
   - Click "Convert All" to process all URLs
   - Each page will be converted to Markdown and downloaded
   - URLs can be from any accessible web pages

3. **Context Menu Options**
   - Right-click anywhere on a page to:
     - Download the entire page as Markdown
     - Copy the page as Markdown
     - Download/copy selected text as Markdown
     - Copy links and images as Markdown
   - Right-click on your browser tabs to:
     - Download all tabs as Markdown
     - Copy tab links as a Markdown list

4. **Table Formatting Options**
   - Strip links from tables
   - Remove formatting (bold, italic, etc.)
   - Enable pretty printing for clean alignment
   - Center text in columns

5. **Image Handling**
   - Download images alongside Markdown files
   - Choose between various image reference styles
   - Organize images in custom folders
   - Convert images to base64 (optional)

## Obsidian Integration

MarkSnip supports direct integration with Obsidian via the Advanced URI plugin. To use this feature:

1. Install and enable the [Advanced Obsidian URI](https://vinzent03.github.io/obsidian-advanced-uri/) plugin in Obsidian
2. Configure your vault and folder settings in MarkSnip's options
3. Right-click on any page you want to save as markdown, then open the "MarkSnip" menu.
4. Select "Send Tab to Obsidian".
5. If you have configured your MarkSnip options correctly, it should have created a new note, in the folder you specified, in Obsidian.

The Advanced URI plugin helps bypass URL character limitations by using the clipboard as the source for creating new files.

## Keyboard Shortcuts

- Alt+Shift+M: Open MarkSnip popup
- Alt+Shift+D: Download current tab as Markdown
- Alt+Shift+C: Copy current tab as Markdown
- Alt+Shift+L: Copy current tab URL as Markdown link

## External Libraries

MarkSnip relies on several open-source libraries:

- [Readability.js](https://github.com/mozilla/readability) by Mozilla for content extraction
- [Turndown](https://github.com/mixmark-io/turndown) for HTML to Markdown conversion
- [highlight.js](https://highlightjs.org/) for code language auto-detection.
- [CodeMirror](https://codemirror.net/) for the Markdown editor

## Credits

- Original [MarkDownload](https://github.com/deathau/markdownload/) extension by deathau
- [CommonMark](https://github.com/dcurtis/markdown-mark) icon by Dustin Curtis
- All the amazing open-source libraries and their contributors

## Issues

If you have found an issue or have some feedback, feel free to email me dhruvjparikh28@gmail.com.
