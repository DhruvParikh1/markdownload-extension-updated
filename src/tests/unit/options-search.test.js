const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

// Load search-core first — options-search depends on globalThis.markSnipSearchCore
require('../../shared/search-core.js');
const optionsSearch = require('../../options/options-search.js');

const optionsHtml = fs.readFileSync(
  path.join(__dirname, '../../options/options.html'),
  'utf8'
);
const searchCoreSource = fs.readFileSync(
  path.join(__dirname, '../../shared/search-core.js'),
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
const libraryStateSource = fs.readFileSync(
  path.join(__dirname, '../../shared/library-state.js'),
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
  batchProcessingEnabled: true,
  obsidianIntegration: false,
  obsidianVault: '',
  obsidianFolder: '',
  popupTheme: 'system',
  specialTheme: 'none',
  popupAccent: 'sage',
  compactMode: false,
  showUserGuideIcon: true,
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

const specialThemeCases = [
  { label: 'ATLA', slug: 'atla', keyword: 'avatar' },
  { label: 'Ben 10', slug: 'ben10', keyword: 'omnitrix' }
];

async function waitFor(windowObject, ms) {
  await new Promise(resolve => windowObject.setTimeout(resolve, ms));
}

async function waitForMicrotasks() {
  await Promise.resolve();
  await Promise.resolve();
}

function createOptionsPageDom(optionOverrides = {}, libraryOverrides = {}) {
  const dom = new JSDOM(optionsHtml, {
    url: 'https://example.com/options.html',
    pretendToBeVisual: true,
    runScripts: 'dangerously'
  });

  const storedOptions = mergeOptions(optionOverrides);
  let localState = {
    librarySettings: {
      enabled: true,
      autoSaveOnPopupOpen: true,
      itemsToKeep: 10,
      ...libraryOverrides.settings
    },
    libraryItems: Array.isArray(libraryOverrides.items) ? libraryOverrides.items.slice() : []
  };
  const browser = {
    storage: {
      sync: {
        get: jest.fn(() => Promise.resolve(storedOptions)),
        set: jest.fn(() => Promise.resolve())
      },
      local: {
        get: jest.fn((keys) => {
          if (typeof keys === 'string') {
            return Promise.resolve({ [keys]: localState[keys] });
          }
          if (Array.isArray(keys)) {
            return Promise.resolve(keys.reduce((acc, key) => {
              acc[key] = localState[key];
              return acc;
            }, {}));
          }
          return Promise.resolve({ ...localState });
        }),
        set: jest.fn((payload) => {
          localState = { ...localState, ...payload };
          return Promise.resolve();
        }),
        remove: jest.fn((keys) => {
          const keyList = Array.isArray(keys) ? keys : [keys];
          keyList.forEach((key) => {
            delete localState[key];
          });
          return Promise.resolve();
        })
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
  dom.window.eval(searchCoreSource);
  dom.window.eval(libraryStateSource);
  dom.window.eval(optionsSearchSource);
  dom.window.eval(optionsSource);

  return {
    dom,
    browser,
    storedOptions,
    getLocalState: () => ({ ...localState })
  };
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
    expect(getMatchIds(index, 'highlight')).toContain('autoDetectCodeLanguage-container');
    expect(getMatchIds(index, 'highlightjs')).toContain('autoDetectCodeLanguage-container');
    expect(getMatchIds(index, 'highlight.js')).toContain('autoDetectCodeLanguage-container');
    expect(getMatchIds(index, 'shortcut')).toContain('linkReferenceStyle');
    expect(getMatchIds(index, 'hashtag')).toContain('hashtagHandling-container');
    expect(getMatchIds(index, 'batch processing')).toContain('batchProcessingEnabled-container');
    expect(getMatchIds(index, 'obsidian vault')).toContain('obsidianVault');
    expect(getMatchIds(index, 'download images')).toContain('downloadImages-container');
    expect(getMatchIds(index, 'guide icon')).toContain('showUserGuideIcon-container');
  });

  test('library search surfaces the new local-only library controls', () => {
    const matchIds = getMatchIds(index, 'library');
    const matchLabels = getMatchLabels(index, 'library');

    expect(matchIds).toContain('libraryAutoSave-container');
    expect(matchIds).toContain('libraryItemsToKeep-container');
    expect(matchLabels).toContain('Enable Library');
    expect(matchLabels).toContain('Clear Library');
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
    await waitFor(dom.window, 50);

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
    await waitFor(dom.window, 50);

    expect(document.querySelector('.content-panel').classList.contains('search-active')).toBe(false);
    expect(appearanceSection.classList.contains('active')).toBe(true);
    expect(downloadsSection.classList.contains('active')).toBe(false);
    expect(imagePrefixCard.classList.contains('search-match')).toBe(false);
    expect(imagePrefixCard.style.display).toBe('none');
  });

  test('reset all restores library defaults without deleting library items', async () => {
    const { dom, browser, getLocalState } = createOptionsPageDom({}, {
      settings: {
        enabled: false,
        autoSaveOnPopupOpen: false,
        itemsToKeep: 3
      },
      items: [{ id: 'saved-item' }]
    });
    const { document } = dom.window;

    dom.window.confirm = jest.fn(() => true);
    document.dispatchEvent(new dom.window.Event('DOMContentLoaded', { bubbles: true }));
    await waitForMicrotasks();
    await waitFor(dom.window, 50);

    document.getElementById('reset-all').click();
    await waitForMicrotasks();

    expect(browser.storage.local.set).toHaveBeenCalledWith({
      librarySettings: {
        enabled: true,
        autoSaveOnPopupOpen: true,
        itemsToKeep: 10
      }
    });
    expect(getLocalState().libraryItems).toEqual([{ id: 'saved-item' }]);
  });

  test('clear library removes saved library items from local storage', async () => {
    const { dom, browser } = createOptionsPageDom({}, {
      items: [{ id: 'saved-item' }]
    });
    const { document } = dom.window;

    dom.window.confirm = jest.fn(() => true);
    document.dispatchEvent(new dom.window.Event('DOMContentLoaded', { bubbles: true }));
    await waitForMicrotasks();

    document.getElementById('clear-library').click();
    await waitForMicrotasks();

    expect(browser.storage.local.remove).toHaveBeenCalledWith('libraryItems');
  });

  test('export payload includes library settings but excludes library items', async () => {
    const { dom } = createOptionsPageDom({}, {
      settings: {
        enabled: false,
        autoSaveOnPopupOpen: false,
        itemsToKeep: 4
      },
      items: [{ id: 'saved-item' }]
    });
    const { document } = dom.window;

    document.dispatchEvent(new dom.window.Event('DOMContentLoaded', { bubbles: true }));
    await waitForMicrotasks();
    await waitFor(dom.window, 50);

    const payload = dom.window.buildExportPayload();

    expect(payload.librarySettings).toEqual({
      enabled: false,
      autoSaveOnPopupOpen: false,
      itemsToKeep: 4
    });
    expect(payload.libraryItems).toBeUndefined();
  });

  test('import restores library settings when present in the backup payload', async () => {
    const { dom, browser } = createOptionsPageDom();
    const { document } = dom.window;

    class MockFileReader {
      readAsText() {
        this.onload({
          target: {
            result: JSON.stringify({
              ...mergeOptions({ popupTheme: 'dark' }),
              librarySettings: {
                enabled: false,
                autoSaveOnPopupOpen: false,
                itemsToKeep: 4
              },
              libraryItems: [{ id: 'should-be-ignored' }]
            })
          }
        });
      }
    }

    dom.window.FileReader = MockFileReader;
    document.dispatchEvent(new dom.window.Event('DOMContentLoaded', { bubbles: true }));
    await waitForMicrotasks();

    const importInput = document.getElementById('import-file');
    Object.defineProperty(importInput, 'files', {
      configurable: true,
      value: [{}]
    });

    importInput.dispatchEvent(new dom.window.Event('change', { bubbles: true }));
    await waitForMicrotasks();
    await waitFor(dom.window, 50);

    expect(browser.storage.local.set).toHaveBeenCalledWith({
      librarySettings: {
        enabled: false,
        autoSaveOnPopupOpen: false,
        itemsToKeep: 4
      }
    });
    expect(document.getElementById('libraryEnabled').checked).toBe(false);
    expect(document.getElementById('libraryAutoSaveOnPopupOpen').checked).toBe(false);
    expect(document.getElementById('libraryItemsToKeep').value).toBe('4');
  });

  test('restores and saves the popup guide icon toggle', async () => {
    const { dom, browser } = createOptionsPageDom({ showUserGuideIcon: false });
    const { document } = dom.window;

    document.dispatchEvent(new dom.window.Event('DOMContentLoaded', { bubbles: true }));
    await waitForMicrotasks();

    const toggle = document.getElementById('showUserGuideIcon');
    expect(toggle.checked).toBe(false);

    toggle.checked = true;
    toggle.dispatchEvent(new dom.window.Event('change', { bubbles: true }));
    await waitForMicrotasks();

    expect(browser.storage.sync.set).toHaveBeenCalledWith(expect.objectContaining({
      showUserGuideIcon: true
    }));
  });

  test('restores and saves the batch processing toggle', async () => {
    const { dom, browser } = createOptionsPageDom({ batchProcessingEnabled: false });
    const { document } = dom.window;

    document.dispatchEvent(new dom.window.Event('DOMContentLoaded', { bubbles: true }));
    await waitForMicrotasks();

    const toggle = document.getElementById('batchProcessingEnabled');
    expect(toggle.checked).toBe(false);

    toggle.checked = true;
    toggle.dispatchEvent(new dom.window.Event('change', { bubbles: true }));
    await waitForMicrotasks();

    expect(browser.storage.sync.set).toHaveBeenCalledWith(expect.objectContaining({
      batchProcessingEnabled: true
    }));
  });

  test.each(specialThemeCases)('$label special theme restores root classes and locks accent and editor theme controls', async ({ slug }) => {
    const { dom } = createOptionsPageDom({
      popupTheme: 'dark',
      popupAccent: 'ocean',
      specialTheme: slug,
      editorTheme: 'nord'
    });
    const { document } = dom.window;

    document.dispatchEvent(new dom.window.Event('DOMContentLoaded', { bubbles: true }));
    await waitForMicrotasks();
    await waitFor(dom.window, 50);

    const root = document.documentElement;
    expect(root.classList.contains('theme-dark')).toBe(true);
    expect(root.classList.contains(`special-theme-${slug}`)).toBe(true);
    expect(root.classList.contains('accent-ocean')).toBe(false);
    expect(document.getElementById(`special-theme-${slug}`).checked).toBe(true);
    expect(document.getElementById('popupAccentGroup').classList.contains('is-disabled')).toBe(true);
    expect(document.getElementById('editorThemeGroup').classList.contains('is-disabled')).toBe(true);
    expect(document.getElementById('popupAccentThemeNote').hidden).toBe(false);
    expect(document.getElementById('editorThemeLockNote').hidden).toBe(false);
    expect(Array.from(document.querySelectorAll("input[name='popupAccent']")).every((input) => input.disabled)).toBe(true);
    expect(Array.from(document.querySelectorAll("input[name='editorTheme']")).every((input) => input.disabled)).toBe(true);
  });

  test.each(specialThemeCases)('special theme keywords surface the Special Themes card for $label queries', ({ keyword }) => {
    const index = optionsSearch.buildSearchIndex(loadOptionsDocument().window.document);
    expect(getMatchIds(index, keyword)).toContain('specialThemeGroup');
  });
});
