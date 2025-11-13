/**
 * Browser Environment Setup for Tests
 * Loads browser libraries (Turndown, Readability) in a JSDOM environment
 */

const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

/**
 * Create a browser-like environment with required libraries loaded
 */
function createBrowserEnvironment() {
  // Create JSDOM instance
  const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>', {
    url: 'https://example.com',
    contentType: 'text/html',
    runScripts: 'dangerously',
    resources: 'usable'
  });

  const { window } = dom;
  const { document } = window;

  // Load Turndown library
  const turndownPath = path.join(__dirname, '../../background/turndown.js');
  const turndownCode = fs.readFileSync(turndownPath, 'utf8');

  // Load Turndown GFM plugin
  const gfmPath = path.join(__dirname, '../../background/turndown-plugin-gfm.js');
  const gfmCode = fs.readFileSync(gfmPath, 'utf8');

  // Load Readability library
  const readabilityPath = path.join(__dirname, '../../background/Readability.js');
  const readabilityCode = fs.readFileSync(readabilityPath, 'utf8');

  // Execute in JSDOM context
  const script = dom.window.document.createElement('script');
  script.textContent = `
    ${turndownCode}
    ${gfmCode}
    ${readabilityCode}
  `;
  dom.window.document.head.appendChild(script);

  return {
    window,
    document,
    TurndownService: dom.window.TurndownService,
    turndownPluginGfm: dom.window.turndownPluginGfm,
    Readability: dom.window.Readability
  };
}

/**
 * Create a configured TurndownService instance
 */
function createTurndownService(options = {}) {
  const env = createBrowserEnvironment();

  const defaultOptions = {
    headingStyle: 'atx',
    hr: '---',
    bulletListMarker: '-',
    codeBlockStyle: 'fenced',
    fence: '```',
    emDelimiter: '_',
    strongDelimiter: '**',
    linkStyle: 'inlined',
    linkReferenceStyle: 'full'
  };

  const mergedOptions = { ...defaultOptions, ...options };
  const service = new env.TurndownService(mergedOptions);

  // Add GFM plugins
  if (env.turndownPluginGfm) {
    service.use([
      env.turndownPluginGfm.highlightedCodeBlock,
      env.turndownPluginGfm.strikethrough,
      env.turndownPluginGfm.taskListItems,
      env.turndownPluginGfm.tables
    ]);
  }

  return { service, env };
}

/**
 * Parse HTML using Readability
 */
function parseArticle(html, url = 'https://example.com') {
  const env = createBrowserEnvironment();

  // Parse HTML in JSDOM
  const dom = new JSDOM(html, { url });
  const { document } = dom.window;

  // Use Readability to extract article
  const reader = new env.Readability(document);
  const article = reader.parse();

  return { article, env };
}

module.exports = {
  createBrowserEnvironment,
  createTurndownService,
  parseArticle
};
