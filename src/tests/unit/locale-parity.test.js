const en = require('../../_locales/en/messages.json');
const es = require('../../_locales/es/messages.json');
const fr = require('../../_locales/fr/messages.json');
const de = require('../../_locales/de/messages.json');

const catalogs = { en, es, fr, de };

function extractReservedTokens(message) {
  return {
    placeholders: (String(message || '').match(/\{[A-Za-z0-9]+\}/g) || []).sort(),
    substitutions: (String(message || '').match(/\$[1-9]\d*/g) || []).sort()
  };
}

describe('locale catalog parity', () => {
  const canonicalKeys = Object.keys(en).sort();

  test('all locales have the same message keys as english', () => {
    Object.entries(catalogs).forEach(([locale, catalog]) => {
      expect(Object.keys(catalog).sort()).toEqual(canonicalKeys);
    });
  });

  test('reserved tokens and substitutions match the english catalog', () => {
    canonicalKeys.forEach((key) => {
      const expectedTokens = extractReservedTokens(en[key]?.message);

      Object.entries(catalogs).forEach(([locale, catalog]) => {
        expect(extractReservedTokens(catalog[key]?.message)).toEqual(expectedTokens);
      });
    });
  });
});
