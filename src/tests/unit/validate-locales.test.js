const validateLocales = require('../../scripts/validate-locales');

describe('validate-locales script', () => {
  test('locale catalogs stay in sync', () => {
    expect(validateLocales.validateLocaleCatalogs()).toEqual([]);
  });

  test('flags suspicious Hindi corruption patterns', () => {
    const catalogs = validateLocales.loadCatalogs();
    const corrupted = {
      ...catalogs,
      hi: {
        ...catalogs.hi,
        broken_question_runs: { message: '??????????' },
        broken_mojibake: { message: 'à¤¦à¤¿à¤–à¤¾à¤µà¤Ÿ' }
      },
      en: {
        ...catalogs.en,
        broken_question_runs: { message: 'Broken' },
        broken_mojibake: { message: 'Broken' }
      }
    };

    expect(validateLocales.validateLocaleCatalogs(corrupted)).toEqual(
      expect.arrayContaining([
        expect.stringContaining('[hi] Suspicious message content for broken_question_runs'),
        expect.stringContaining('[hi] Suspicious message content for broken_mojibake')
      ])
    );
  });
});
