/**
 * Configuration Test Fixtures
 * Sample configuration options for testing different conversion scenarios
 */

module.exports = {
  // Default configuration
  defaultConfig: {
    headingStyle: 'atx',
    hr: '---',
    bulletListMarker: '-',
    codeBlockStyle: 'fenced',
    fence: '```',
    emDelimiter: '_',
    strongDelimiter: '**',
    linkStyle: 'inlined',
    linkReferenceStyle: 'full',
    imageStyle: 'markdown',
    imageRefStyle: 'inlined',
    frontmatter: '',
    backmatter: '',
    title: '{title}',
    includeTemplate: true,
    saveAs: false,
    downloadImages: false,
    imagePrefix: 'image-',
    mdClipsFolder: '',
    disallowedChars: '[]#^'
  },

  // Setext headings style
  setextHeadings: {
    headingStyle: 'setext',
    hr: '---',
    bulletListMarker: '-',
    codeBlockStyle: 'fenced',
    fence: '```'
  },

  // Underscores for emphasis
  underscoreEmphasis: {
    headingStyle: 'atx',
    emDelimiter: '_',
    strongDelimiter: '__'
  },

  // Asterisk for bullets
  asteriskBullets: {
    bulletListMarker: '*',
    hr: '***'
  },

  // Indented code blocks
  indentedCode: {
    codeBlockStyle: 'indented'
  },

  // Referenced links
  referencedLinks: {
    linkStyle: 'referenced',
    linkReferenceStyle: 'full'
  },

  // Obsidian image style
  obsidianImages: {
    imageStyle: 'obsidian',
    downloadImages: true,
    imagePrefix: 'img-'
  },

  // Front matter template
  withFrontmatter: {
    frontmatter: `---
title: {title}
source: {baseURI}
author: {author}
published: {date:YYYY-MM-DD}
tags: [{keywords}]
---`,
    includeTemplate: true
  },

  // Back matter template
  withBackmatter: {
    backmatter: `

---
*Clipped from: {baseURI}*
*Date: {date:YYYY-MM-DD HH:mm}*`,
    includeTemplate: true
  },

  // Custom title template
  customTitle: {
    title: '{title} - {date:YYYY-MM-DD}',
    includeTemplate: true
  },

  // Table formatting options
  tableStripLinks: {
    tableStripLinks: true
  },

  tableStripFormatting: {
    tableStripFormatting: true
  },

  tablePrettyPrint: {
    tablePrettyPrint: true
  },

  tableCenterText: {
    tableCenterText: true
  },

  // Image download options
  downloadImagesConfig: {
    downloadImages: true,
    imagePrefix: 'downloaded-',
    imageStyle: 'markdown'
  },

  // No images
  noImages: {
    imageStyle: 'noImage'
  },

  // Base64 images
  base64Images: {
    imageStyle: 'base64'
  },

  // Subfolder configuration
  withSubfolder: {
    mdClipsFolder: 'clippings',
    downloadImages: true
  },

  // Complete configuration with all options
  fullConfig: {
    headingStyle: 'atx',
    hr: '---',
    bulletListMarker: '-',
    codeBlockStyle: 'fenced',
    fence: '```',
    emDelimiter: '_',
    strongDelimiter: '**',
    linkStyle: 'inlined',
    linkReferenceStyle: 'full',
    imageStyle: 'markdown',
    imageRefStyle: 'inlined',
    frontmatter: `---
title: {title}
source: {baseURI}
clipped: {date:YYYY-MM-DD}
---`,
    backmatter: `\n---\nSource: {baseURI}`,
    title: '{title}',
    includeTemplate: true,
    saveAs: false,
    downloadImages: true,
    imagePrefix: 'img-',
    mdClipsFolder: 'markdown-clips',
    disallowedChars: '[]#^',
    turndownEscape: true,
    contextMenus: true
  }
};
