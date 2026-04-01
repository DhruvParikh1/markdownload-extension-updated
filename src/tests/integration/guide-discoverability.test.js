const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

const popupHtml = fs.readFileSync(
  path.join(__dirname, '../../popup/popup.html'),
  'utf8'
);

const optionsHtml = fs.readFileSync(
  path.join(__dirname, '../../options/options.html'),
  'utf8'
);

const manifestJson = JSON.parse(fs.readFileSync(
  path.join(__dirname, '../../manifest.json'),
  'utf8'
));

describe('Guide discoverability — popup', () => {
  let dom;

  beforeEach(() => {
    dom = new JSDOM(popupHtml, { url: 'https://example.com/popup/popup.html' });
  });

  afterEach(() => dom.window.close());

  test('popup has a guide dropdown button', () => {
    const btn = dom.window.document.getElementById('openGuide');
    expect(btn).not.toBeNull();
    expect(btn.tagName).toBe('BUTTON');
    expect(btn.getAttribute('aria-haspopup')).toBe('true');
  });

  test('guide dropdown button has accessible title', () => {
    const btn = dom.window.document.getElementById('openGuide');
    expect(btn.getAttribute('title')).toMatch(/guide/i);
  });

  test('guide dropdown contains a User Guide link', () => {
    const link = dom.window.document.getElementById('guideLink');
    expect(link).not.toBeNull();
    expect(link.getAttribute('href')).toBe('/guide/guide.html');
    expect(link.getAttribute('target')).toBe('_blank');
  });

  test('guide dropdown contains a Keyboard Shortcuts button', () => {
    const btn = dom.window.document.getElementById('showShortcuts');
    expect(btn).not.toBeNull();
    expect(btn.tagName).toBe('BUTTON');
  });

  test('shortcuts modal exists with correct ARIA attributes', () => {
    const modal = dom.window.document.getElementById('shortcutsModal');
    expect(modal).not.toBeNull();
    expect(modal.getAttribute('role')).toBe('dialog');
    expect(modal.getAttribute('aria-modal')).toBe('true');
    expect(modal.getAttribute('aria-labelledby')).toBe('shortcutsModalTitle');
  });

  test('shortcuts modal has a close button', () => {
    const btn = dom.window.document.getElementById('closeShortcutsModal');
    expect(btn).not.toBeNull();
    expect(btn.getAttribute('aria-label')).toMatch(/close/i);
  });
});

describe('Guide discoverability — options', () => {
  let dom;

  beforeEach(() => {
    dom = new JSDOM(optionsHtml, { url: 'https://example.com/options/options.html' });
  });

  afterEach(() => dom.window.close());

  test('options sidebar has a User Guide link', () => {
    const guideLink = dom.window.document.getElementById('open-guide-link');
    expect(guideLink).not.toBeNull();
    expect(guideLink.getAttribute('href')).toBe('/guide/guide.html');
    expect(guideLink.getAttribute('target')).toBe('_blank');
    expect(guideLink.textContent).toMatch(/User Guide/i);
  });

  test('options no-results state has a link to the guide', () => {
    const noResults = dom.window.document.getElementById('search-no-results');
    expect(noResults).not.toBeNull();
    const guideLink = noResults.querySelector('a[href="/guide/guide.html"]');
    expect(guideLink).not.toBeNull();
    expect(guideLink.textContent).toMatch(/guide/i);
  });
});

describe('Guide discoverability — manifest', () => {
  test('guide page is not registered as a web_accessible_resource', () => {
    const resources = manifestJson.web_accessible_resources || [];
    const guideResource = resources.find(r =>
      r.resources && r.resources.includes('guide/guide.html')
    );
    expect(guideResource).toBeUndefined();
  });

  test('page context script is only exposed to page schemes', () => {
    const resources = manifestJson.web_accessible_resources || [];
    const pageContextResource = resources.find(r =>
      r.resources && r.resources.includes('contentScript/pageContext.js')
    );

    expect(pageContextResource).toBeDefined();
    expect(pageContextResource.matches).toEqual(['<all_urls>']);
  });
});
