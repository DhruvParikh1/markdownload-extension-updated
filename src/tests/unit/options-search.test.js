const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

const optionsSearch = require('../../options/options-search.js');

const optionsHtml = fs.readFileSync(
  path.join(__dirname, '../../options/options.html'),
  'utf8'
);
const optionsSearchSource = fs.readFileSync(
  path.join(__dirname, '../../options/options-search.js'),
  'utf8'
);
const optionsSource = fs.readFileSync(
  path.join(__dirname, '../../options/options.js'),
  'utf8'
);

const baseOptions = {
  headingStyle: 'atx',
  hr: '___',
  bulletListMarker: '-',
  codeBlockStyle: 'fenced',
  fence: '```',
  preserveCodeFormatting: false,
  autoDetectCodeLanguage: true,
  emDelimiter: '_',
  strongDelimiter: '**',
  linkStyle: 'inlined',
  linkReferenceStyle: 'full',
  imageStyle: 'markdown',
  imageRefStyle: 'inlined',
  tableFormatting: {
    stripLinks: true,
    stripFormatting: false,
    prettyPrint: true,
    centerText: true
  },
  frontmatter: 'frontmatter',
  backmatter: 'backmatter',
  title: '{pageTitle}',
  includeTemplate: false,
  saveAs: false,
  downloadImages: false,
  imagePrefix: '{pageTitle}/',
  mdClipsFolder: '',
  disallowedChars: '[]#^',
  downloadMode: 'downloadsApi',
  turndownEscape: true,
  hashtagHandling: 'keep',
  contextMenus: true,
  obsidianIntegration: false,
  obsidianVault: '',
  obsidianFolder: '',
  popupTheme: 'system',
  popupAccent: 'sage',
  compactMode: false,
  editorTheme: 'default'
};

function mergeOptions(overrides = {}) {
  return {
    ...baseOptions,
    ...overrides,
    tableFormatting: {
      ...baseOptions.tableFormatting,
      ...(overrides.tableFormatting || {})
    }
  };
}

function getCardLabel(card) {
  return (
    card.id ||
    card.querySelector('.card-title')?.textContent?.trim() ||
    card.querySelector('.toggle-label-text')?.textContent?.trim() ||
    card.querySelector('.input-label')?.textContent?.trim() ||
    ''
  );
}

function loadOptionsDocument() {
  return new JSDOM(optionsHtml, {
    url: 'https://example.com/options.html'
  });
}

function getMatchIds(index, query) {
  return optionsSearch.searchSettings(index, query).matches.map(result => result.card.id);
}

function getMatchLabels(index, query) {
  return optionsSearch.searchSettings(index, query).matches.map(result => getCardLabel(result.card));
}

async function waitFor(windowObject, ms) {
  await new Promise(resolve => windowObject.setTimeout(resolve, ms));
}

async function waitForMicrotasks() {
  await Promise.resolve();
  await Promise.resolve();
}

function createOptionsPageDom(optionOverrides = {}) {
  const dom = new JSDOM(optionsHtml, {
    url: 'https://example.com/options.html',
    pretendToBeVisual: true,
    runScripts: 'dangerously'
  });

  const storedOptions = mergeOptions(optionOverrides);
  const browser = {
    storage: {
      sync: {
        get: jest.fn(() => Promise.resolve(storedOptions)),
        set: jest.fn(() => Promise.resolve())
      }
    },
    runtime: {
      getURL: jest.fn(() => 'chrome-extension://marksnip/')
    },
    contextMenus: {
      update: jest.fn(() => Promise.resolve()),
      removeAll: jest.fn(() => Promise.resolve())
    },
    downloads: {}
  };

  dom.window.browser = browser;
  dom.window.chrome = browser;
  dom.window.createMenus = jest.fn();
  dom.window.eval(`var defaultOptions = ${JSON.stringify(storedOptions)};`);
  dom.window.eval(optionsSearchSource);
  dom.window.eval(optionsSource);

  return { dom, browser, storedOptions };
}

describe('Options search helper', () => {
  let dom;
  let index;

  beforeEach(() => {
    dom = loadOptionsDocument();
    index = optionsSearch.buildSearchIndex(dom.window.document);
  });

  afterEach(() => {
    dom.window.close();
  });

  test('obsdn only surfaces obsidian-related cards', () => {
    const matches = getMatchIds(index, 'obsdn');

    expect(matches).toEqual([
      'obsidian-container',
      'obsidianVault',
      'imageOptions'
    ]);
  });

  test('imgstyl stays focused on image style instead of unrelated cards', () => {
    expect(getMatchIds(index, 'imgstyl')).toEqual(['imageOptions']);
  });

  test('dwnld matches download settings without admitting clips folder', () => {
    const matches = getMatchIds(index, 'dwnld');

    expect(matches).toEqual([
      'downloadMode',
      'downloadImages-container'
    ]);
    expect(matches).not.toContain('mdClipsFolder');
    expect(matches).not.toContain('editorThemeGroup');
    expect(matches).not.toContain('includeTemplate-container');
  });

  test('downld falls back to the weaker fuzzy stage when strict search finds nothing', () => {
    const search = optionsSearch.searchSettings(index, 'downld');

    expect(search.stage).toBe('fallback');
    expect(search.matches.map(result => result.card.id)).toEqual([
      'downloadMode',
      'downloadImages-container'
    ]);
    expect(search.matches.map(result => result.card.id)).not.toContain('mdClipsFolder');
  });

  test('exact searches still resolve expected settings', () => {
    expect(getMatchIds(index, 'save as')).toContain('saveAs-container');
    expect(getMatchLabels(index, 'frontmatter')).toContain('Front-matter template');
    expect(getMatchLabels(index, 'backmatter')).toContain('Back-matter template');
    expect(getMatchIds(index, 'base64')).toContain('imageOptions');
    expect(getMatchIds(index, 'shortcut')).toContain('linkReferenceStyle');
    expect(getMatchIds(index, 'hashtag')).toContain('hashtagHandling-container');
    expect(getMatchIds(index, 'obsidian vault')).toContain('obsidianVault');
    expect(getMatchIds(index, 'download images')).toContain('downloadImages-container');
  });

  test('excluded examples and reference details do not affect search results', () => {
    expect(getMatchIds(index, 'google')).toEqual([]);
    expect(getMatchIds(index, 'format reference')).toEqual([]);
  });
});

describe('Options page search UI', () => {
  test('shows the no-results state for unmatched queries', async () => {
    const { dom } = createOptionsPageDom();
    const { document } = dom.window;

    document.dispatchEvent(new dom.window.Event('DOMContentLoaded', { bubbles: true }));
    await waitForMicrotasks();

    const searchInput = document.getElementById('settings-search');
    const noResults = document.getElementById('search-no-results');
    const noResultsQuery = document.getElementById('search-no-results-query');

    searchInput.value = 'google';
    searchInput.dispatchEvent(new dom.window.Event('input', { bubbles: true }));
    await waitFor(dom.window, 200);

    expect(noResults.classList.contains('visible')).toBe(true);
    expect(noResultsQuery.textContent).toBe('google');

    dom.window.close();
  });

  test('clearing search restores the active tab and conditional visibility', async () => {
    const { dom } = createOptionsPageDom({
      downloadMode: 'contentLink',
      downloadImages: false
    });

    const { document, sessionStorage } = dom.window;
    sessionStorage.setItem('marksnip-options-tab', 'appearance');

    document.dispatchEvent(new dom.window.Event('DOMContentLoaded', { bubbles: true }));
    await waitForMicrotasks();

    const appearanceSection = document.getElementById('section-appearance');
    const downloadsSection = document.getElementById('section-downloads');
    const imagePrefixCard = document.getElementById('imagePrefix');
    const searchInput = document.getElementById('settings-search');

    expect(appearanceSection.classList.contains('active')).toBe(true);
    expect(downloadsSection.classList.contains('active')).toBe(false);
    expect(imagePrefixCard.style.display).toBe('none');

    searchInput.value = 'image prefix';
    searchInput.dispatchEvent(new dom.window.Event('input', { bubbles: true }));
    await waitFor(dom.window, 200);

    expect(document.querySelector('.content-panel').classList.contains('search-active')).toBe(true);
    expect(imagePrefixCard.classList.contains('search-match')).toBe(true);
    expect(imagePrefixCard.style.display).toBe('');

    searchInput.focus();
    document.dispatchEvent(new dom.window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    await waitForMicrotasks();

    expect(document.querySelector('.content-panel').classList.contains('search-active')).toBe(false);
    expect(appearanceSection.classList.contains('active')).toBe(true);
    expect(downloadsSection.classList.contains('active')).toBe(false);
    expect(imagePrefixCard.classList.contains('search-match')).toBe(false);
    expect(imagePrefixCard.style.display).toBe('none');

    dom.window.close();
  });
});
