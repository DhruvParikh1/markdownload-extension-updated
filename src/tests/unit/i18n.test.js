const { JSDOM } = require('jsdom');

describe('shared i18n helpers', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    jest.resetModules();
    global.fetch = originalFetch;
  });

  test('resolveUiLocale maps browser locales to supported languages', () => {
    const i18n = require('../../shared/i18n.js');
    expect(i18n.resolveUiLocale('browser', 'hi-IN')).toBe('hi');
    expect(i18n.resolveUiLocale('browser', 'fr-FR')).toBe('en');
    expect(i18n.resolveUiLocale('en', 'hi-IN')).toBe('en');
  });

  test('init falls back to default locale messages and supports plurals', async () => {
    global.fetch = jest.fn((url) => {
      if (String(url).includes('/hi/messages.json')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            greeting: { message: 'नमस्ते' },
            items_other: {
              message: '$count$ आइटम',
              placeholders: { count: { content: '$1' } }
            }
          })
        });
      }

      return Promise.resolve({
        ok: true,
        json: async () => ({
          greeting: { message: 'Hello' },
          fallback_only: { message: 'Fallback' },
          items_one: {
            message: '$count$ item',
            placeholders: { count: { content: '$1' } }
          },
          items_other: {
            message: '$count$ items',
            placeholders: { count: { content: '$1' } }
          }
        })
      });
    });

    const i18n = require('../../shared/i18n.js');
    await i18n.init({ setting: 'hi', browserLocale: 'hi-IN' });

    expect(i18n.t('greeting')).toBe('नमस्ते');
    expect(i18n.t('fallback_only')).toBe('Fallback');
    expect(i18n.tp('items', 2, { count: 2 })).toBe('2 आइटम');
  });

  test('applyI18n updates DOM hooks', async () => {
    global.fetch = jest.fn(() => Promise.resolve({
      ok: true,
      json: async () => ({
        dom_text: { message: 'Localized text' },
        dom_placeholder: { message: 'Localized placeholder' },
        dom_title: { message: 'Localized title' },
        dom_aria: { message: 'Localized aria' }
      })
    }));

    const i18n = require('../../shared/i18n.js');
    await i18n.init({ setting: 'en', browserLocale: 'en-US' });

    const { window } = new JSDOM(`
      <div>
        <span id="text" data-i18n="dom_text"></span>
        <input id="input" data-i18n-placeholder="dom_placeholder" />
        <button id="button" data-i18n-title="dom_title" data-i18n-aria-label="dom_aria"></button>
      </div>
    `);

    i18n.applyI18n(window.document);

    expect(window.document.getElementById('text').textContent).toBe('Localized text');
    expect(window.document.getElementById('input').getAttribute('placeholder')).toBe('Localized placeholder');
    expect(window.document.getElementById('button').getAttribute('title')).toBe('Localized title');
    expect(window.document.getElementById('button').getAttribute('aria-label')).toBe('Localized aria');
  });
});
