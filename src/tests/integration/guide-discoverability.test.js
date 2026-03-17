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

  test('popup has a help/guide button that links to guide.html', () => {
    const guideLink = dom.window.document.getElementById('openGuide');
    expect(guideLink).not.toBeNull();
    expect(guideLink.getAttribute('href')).toBe('/guide/guide.html');
    expect(guideLink.getAttribute('target')).toBe('_blank');
  });

  test('guide button has accessible title', () => {
    const guideLink = dom.window.document.getElementById('openGuide');
    expect(guideLink.getAttribute('title')).toMatch(/guide/i);
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
  test('guide page is registered as a web_accessible_resource', () => {
    const resources = manifestJson.web_accessible_resources || [];
    const guideResource = resources.find(r =>
      r.resources && r.resources.includes('guide/guide.html')
    );
    expect(guideResource).toBeDefined();
  });
});
