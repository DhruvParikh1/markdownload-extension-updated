const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

describe('Popup startup assets', () => {
  test('popup HTML no longer eagerly loads all CodeMirror theme styles or the notification host', () => {
    const popupHtml = fs.readFileSync(
      path.join(__dirname, '../../popup/popup.html'),
      'utf8'
    );
    const dom = new JSDOM(popupHtml, {
      url: 'https://example.com/popup/popup.html'
    });
    const document = dom.window.document;

    const stylesheetHrefs = Array.from(document.querySelectorAll('link[rel="stylesheet"]'))
      .map((link) => link.getAttribute('href'));

    expect(stylesheetHrefs).toContain('lib/codemirror.css');
    expect(stylesheetHrefs).not.toContain('lib/xq-dark.css');
    expect(stylesheetHrefs).not.toContain('lib/xq-light.css');
    expect(stylesheetHrefs).not.toContain('lib/dracula.css');
    expect(stylesheetHrefs).not.toContain('lib/material.css');
    expect(stylesheetHrefs).not.toContain('lib/material-darker.css');
    expect(stylesheetHrefs).not.toContain('lib/monokai.css');
    expect(stylesheetHrefs).not.toContain('lib/nord.css');
    expect(stylesheetHrefs).not.toContain('lib/solarized.css');
    expect(stylesheetHrefs).not.toContain('lib/twilight.css');

    // marked must not be eagerly loaded — it is lazy-loaded on first Preview toggle
    expect(stylesheetHrefs).not.toContain('lib/github-markdown.css');

    const scriptHrefs = Array.from(document.querySelectorAll('script[src]'))
      .map((script) => script.getAttribute('src'));

    expect(scriptHrefs).toContain('popup.js');
    expect(scriptHrefs).not.toContain('../notifications/notification-host.js');
    expect(scriptHrefs).not.toContain('lib/marked.min.js');
  });
});
