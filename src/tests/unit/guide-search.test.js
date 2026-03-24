const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

// Load shared search core
require('../../shared/search-core.js');
const searchCore = globalThis.markSnipSearchCore;

const guideHtml = fs.readFileSync(
  path.join(__dirname, '../../guide/guide.html'),
  'utf8'
);

const guideSource = fs.readFileSync(
  path.join(__dirname, '../../guide/guide.js'),
  'utf8'
);

const searchCoreSource = fs.readFileSync(
  path.join(__dirname, '../../shared/search-core.js'),
  'utf8'
);

function loadGuideDom() {
  return new JSDOM(guideHtml, {
    url: 'https://example.com/guide/guide.html'
  });
}

function buildGuideIndex(document) {
  const sections = document.querySelectorAll('[data-guide-section]');
  const index = [];

  sections.forEach(el => {
    const entry = { element: el, id: el.id, fields: [], fieldKeys: new Set() };

    const title = el.getAttribute('data-guide-section');
    const field = searchCore.createField(title, { source: 'title', primary: true, qualifies: true });
    if (field) { entry.fieldKeys.add('p|f|' + field.normalized); entry.fields.push(field); }

    const summary = el.getAttribute('data-guide-summary');
    const sf = searchCore.createField(summary, { source: 'summary', primary: true, qualifies: true });
    if (sf && !entry.fieldKeys.has('p|f|' + sf.normalized)) { entry.fieldKeys.add('p|f|' + sf.normalized); entry.fields.push(sf); }

    const keywords = el.getAttribute('data-search-keywords');
    if (keywords) {
      keywords.split(',').forEach(kw => {
        const af = searchCore.createField(kw.trim(), { source: 'alias', primary: true, qualifies: true, isAlias: true, allowFuzzy: true });
        if (af && !entry.fieldKeys.has('p|a|' + af.normalized)) { entry.fieldKeys.add('p|a|' + af.normalized); entry.fields.push(af); }
      });
    }

    delete entry.fieldKeys;
    index.push(entry);
  });

  return index;
}

function search(index, query) {
  const nq = searchCore.normalizeSearchText(query);
  if (!nq) return { query: '', matches: [], stage: 'none' };
  const strict = searchCore.runSearch(index, nq, searchCore.STRICT_THRESHOLDS, 'strict');
  return strict.matches.length > 0
    ? strict
    : searchCore.runSearch(index, nq, searchCore.FALLBACK_THRESHOLDS, 'fallback');
}

function getMatchIds(index, query) {
  return search(index, query).matches.map(m => m.id);
}

describe('Guide search index', () => {
  let dom, index;

  beforeEach(() => {
    dom = loadGuideDom();
    index = buildGuideIndex(dom.window.document);
  });

  afterEach(() => dom.window.close());

  test('index contains all guide sections and subsections', () => {
    expect(index.length).toBeGreaterThan(10);
    const ids = index.map(e => e.id);
    expect(ids).toContain('quick-start');
    expect(ids).toContain('batch-processing');
    expect(ids).toContain('troubleshooting');
    expect(ids).toContain('text-substitutions');
  });
});

describe('Guide search — exact queries', () => {
  let dom, index;

  beforeEach(() => {
    dom = loadGuideDom();
    index = buildGuideIndex(dom.window.document);
  });

  afterEach(() => dom.window.close());

  test('batch returns batch processing section', () => {
    expect(getMatchIds(index, 'batch')).toContain('batch-processing');
  });

  test('obsidian returns obsidian-related sections', () => {
    const ids = getMatchIds(index, 'obsidian');
    expect(ids).toContain('obsidian-integration');
    expect(ids).toContain('obsidian-actions');
  });

  test('keyboard shortcut returns shortcuts section', () => {
    expect(getMatchIds(index, 'keyboard shortcut')).toContain('keyboard-shortcuts');
  });

  test('troubleshooting returns FAQ section', () => {
    expect(getMatchIds(index, 'troubleshooting')).toContain('troubleshooting');
  });

  test('template returns templates section', () => {
    expect(getMatchIds(index, 'template')).toContain('templates');
  });
});

describe('Guide search — alias queries', () => {
  let dom, index;

  beforeEach(() => {
    dom = loadGuideDom();
    index = buildGuideIndex(dom.window.document);
  });

  afterEach(() => dom.window.close());

  test('faq alias matches troubleshooting', () => {
    expect(getMatchIds(index, 'faq')).toContain('troubleshooting');
  });

  test('getting started alias matches quick start', () => {
    expect(getMatchIds(index, 'getting started')).toContain('quick-start');
  });

  test('clipboard alias matches copy actions', () => {
    expect(getMatchIds(index, 'clipboard')).toContain('copy-actions');
  });

  test('zip alias matches output format', () => {
    expect(getMatchIds(index, 'zip')).toContain('output-format');
  });

  test('hotkey alias matches keyboard shortcuts', () => {
    expect(getMatchIds(index, 'hotkey')).toContain('keyboard-shortcuts');
  });
});

describe('Guide search — acronym and typo tolerance', () => {
  let dom, index;

  beforeEach(() => {
    dom = loadGuideDom();
    index = buildGuideIndex(dom.window.document);
  });

  afterEach(() => dom.window.close());

  test('empty query returns no matches', () => {
    expect(search(index, '').matches.length).toBe(0);
  });

  test('completely irrelevant query returns no matches', () => {
    expect(getMatchIds(index, 'xyzabc123')).toEqual([]);
  });
});

describe('Guide search — fallback behavior', () => {
  let dom, index;

  beforeEach(() => {
    dom = loadGuideDom();
    index = buildGuideIndex(dom.window.document);
  });

  afterEach(() => dom.window.close());

  test('partial query still finds relevant sections', () => {
    const ids = getMatchIds(index, 'download');
    expect(ids.length).toBeGreaterThan(0);
  });
});

describe('Guide DOM structure', () => {
  let dom;

  beforeEach(() => {
    dom = loadGuideDom();
  });

  afterEach(() => dom.window.close());

  test('all guide sections have data-guide-section attribute', () => {
    const sections = dom.window.document.querySelectorAll('.guide-section');
    sections.forEach(s => {
      expect(s.getAttribute('data-guide-section')).toBeTruthy();
    });
  });

  test('all guide sections and subsections have IDs', () => {
    const all = dom.window.document.querySelectorAll('[data-guide-section]');
    all.forEach(el => {
      expect(el.id).toBeTruthy();
    });
  });

  test('TOC links match actual section IDs', () => {
    const tocLinks = dom.window.document.querySelectorAll('.toc-link');
    tocLinks.forEach(link => {
      const href = link.getAttribute('href');
      const targetId = href.replace('#', '');
      const target = dom.window.document.getElementById(targetId);
      expect(target).not.toBeNull();
    });
  });

  test('skip link target exists', () => {
    const skipLink = dom.window.document.querySelector('.skip-link');
    expect(skipLink).not.toBeNull();
    const targetId = skipLink.getAttribute('href').replace('#', '');
    expect(dom.window.document.getElementById(targetId)).not.toBeNull();
  });

  test('search input and results container exist', () => {
    expect(dom.window.document.getElementById('guide-search')).not.toBeNull();
    expect(dom.window.document.getElementById('search-results')).not.toBeNull();
    expect(dom.window.document.getElementById('search-results-list')).not.toBeNull();
    expect(dom.window.document.getElementById('search-no-results')).not.toBeNull();
  });

  test('open settings button exists', () => {
    expect(dom.window.document.getElementById('open-settings')).not.toBeNull();
  });

  test('anchor links are present in section headings', () => {
    const anchors = dom.window.document.querySelectorAll('.anchor-link');
    expect(anchors.length).toBeGreaterThan(5);
  });
});

describe('Guide keyboard shortcuts', () => {
  let dom;

  beforeEach(() => {
    dom = new JSDOM(guideHtml, {
      url: 'https://example.com/guide/guide.html',
      pretendToBeVisual: true,
      runScripts: 'dangerously'
    });

    const defaultOpts = {
      popupTheme: 'system',
      specialTheme: 'none',
      popupAccent: 'sage'
    };

    dom.window.eval(`var defaultOptions = ${JSON.stringify(defaultOpts)};`);
    dom.window.browser = {
      storage: { sync: { get: () => Promise.resolve(defaultOpts) } },
      runtime: { openOptionsPage: () => {} }
    };
    dom.window.eval(searchCoreSource);
    dom.window.eval(guideSource);
  });

  afterEach(() => dom.window.close());

  test('/ key focuses search input', () => {
    const input = dom.window.document.getElementById('guide-search');
    expect(dom.window.document.activeElement).not.toBe(input);

    dom.window.document.dispatchEvent(
      new dom.window.KeyboardEvent('keydown', { key: '/', bubbles: true })
    );

    expect(dom.window.document.activeElement).toBe(input);
  });

  test('Escape clears search input value', () => {
    const input = dom.window.document.getElementById('guide-search');
    input.focus();
    input.value = 'test query';

    dom.window.document.dispatchEvent(
      new dom.window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true })
    );

    expect(input.value).toBe('');
  });
});

describe('Guide theme application', () => {
  test('theme classes are applied from settings', async () => {
    const dom = new JSDOM(guideHtml, {
      url: 'https://example.com/guide/guide.html',
      pretendToBeVisual: true,
      runScripts: 'dangerously'
    });

    const opts = { popupTheme: 'dark', specialTheme: 'claude', popupAccent: 'ocean' };
    dom.window.eval(`var defaultOptions = ${JSON.stringify(opts)};`);
    dom.window.browser = {
      storage: { sync: { get: () => Promise.resolve(opts) } },
      runtime: { openOptionsPage: () => {} }
    };
    dom.window.eval(searchCoreSource);
    dom.window.eval(guideSource);

    // Wait for async storage.sync.get to resolve
    await new Promise(r => setTimeout(r, 50));

    const root = dom.window.document.documentElement;
    expect(root.classList.contains('theme-dark')).toBe(true);
    expect(root.classList.contains('special-theme-claude')).toBe(true);
    expect(root.classList.contains('accent-ocean')).toBe(false);

    dom.window.close();
  });
});
