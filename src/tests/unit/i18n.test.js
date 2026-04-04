const { JSDOM } = require('jsdom');
const i18n = require('../../shared/i18n.js');

describe('markSnipI18n', () => {
  beforeEach(async () => {
    browser.i18n._reset();
    window.localStorage.clear();
    await i18n.applyLocalePreference('browser', { persistCache: true });
  });

  test('localizeDocument applies text, html, attributes, and custom data attributes', () => {
    browser.i18n._setLocale('es');

    const dom = new JSDOM(`
      <!DOCTYPE html>
      <title data-i18n="guide_page_title">x</title>
      <p id="text" data-i18n="popup_loading_text">x</p>
      <p id="html" data-i18n-html="guide_search_no_results_html"></p>
      <input id="field" data-i18n-attr-placeholder="options_search_placeholder" />
      <div id="meta" data-i18n-attr-data-guide-section="guide_section_quick_start"></div>
    `);

    i18n.localizeDocument(dom.window.document);

    expect(dom.window.document.title).toBe(browser.i18n.getMessage('guide_page_title'));
    expect(dom.window.document.getElementById('text').textContent).toBe(browser.i18n.getMessage('popup_loading_text'));
    expect(dom.window.document.getElementById('html').innerHTML).toBe(browser.i18n.getMessage('guide_search_no_results_html'));
    expect(dom.window.document.getElementById('field').getAttribute('placeholder')).toBe(browser.i18n.getMessage('options_search_placeholder'));
    expect(dom.window.document.getElementById('meta').dataset.guideSection).toBe(browser.i18n.getMessage('guide_section_quick_start'));
  });

  test('missing keys leave existing content unchanged', () => {
    const dom = new JSDOM(`
      <!DOCTYPE html>
      <p id="text" data-i18n="missing_key">Keep me</p>
      <input id="field" placeholder="Still here" data-i18n-attr-placeholder="missing_placeholder_key" />
    `);

    i18n.localizeDocument(dom.window.document);

    expect(dom.window.document.getElementById('text').textContent).toBe('Keep me');
    expect(dom.window.document.getElementById('field').getAttribute('placeholder')).toBe('Still here');
  });

  test('formatNumber uses the UI locale', () => {
    browser.i18n._setLocale('es');
    expect(i18n.formatNumber(12345)).toBe(new Intl.NumberFormat('es').format(12345));

    browser.i18n._setLocale('de');
    expect(i18n.formatNumber(12345)).toBe(new Intl.NumberFormat('de').format(12345));
  });

  test('applyLocalePreference overrides browser locale for messages and number formatting', async () => {
    browser.i18n._setLocale('en');

    await i18n.applyLocalePreference('fr', { persistCache: true });

    expect(i18n.getLocalePreference()).toBe('fr');
    expect(i18n.getMessage('options_language_title')).toBe('Langue');
    expect(i18n.formatNumber(12345)).toBe(new Intl.NumberFormat('fr').format(12345));
  });
});
