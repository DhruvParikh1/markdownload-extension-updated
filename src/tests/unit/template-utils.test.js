describe('Template utils helpers', () => {

  describe('generateValidFileName', () => {
    const { generateValidFileName } = require('../../shared/template-utils');

    test('removes custom disallowed regex characters when provided', () => {
      const raw = 'Archived [Notes] (2026)';
      const cleaned = generateValidFileName(raw, '[]()');

      expect(cleaned).toBe('Archived Notes 2026');
      expect(cleaned).not.toContain('[');
      expect(cleaned).not.toContain(']');
      expect(cleaned).not.toContain('(');
      expect(cleaned).not.toContain(')');
    });

    test('escapes regex metacharacters inside disallowedChars', () => {
      const raw = 'Funky *file* name';
      const cleaned = generateValidFileName(raw, '*');

      expect(cleaned).toBe('Funky file name');
    });

    test('replaces reserved filename characters when configured', () => {
      const cleaned = generateValidFileName('billing/plans:pro400', '', '_');

      expect(cleaned).toBe('billing_plans_pro400');
    });

    test('replaces custom disallowed characters when configured', () => {
      const cleaned = generateValidFileName('Example [Draft] #2', '[]#', '-');

      expect(cleaned).toBe('Example -Draft- -2');
    });

    test('strips reserved characters from unsafe replacement text', () => {
      const cleaned = generateValidFileName('billing/plans', '', '/');

      expect(cleaned).toBe('billingplans');
    });
  });

  describe('textReplace filename sanitization', () => {
    const { textReplace } = require('../../shared/template-utils');

    test('replaces reserved characters in substituted article values only', () => {
      const result = textReplace(
        '{pageTitle}/archive',
        { pageTitle: 'Billing/Plans:Pro400' },
        '/',
        '_'
      );

      expect(result).toBe('Billing_Plans_Pro400/archive');
    });
  });

  describe('formatDate fallback', () => {
    const originalMoment = global.moment;

    afterEach(() => {
      jest.resetModules();
      jest.dontMock('../../background/moment.min.js');
      global.moment = originalMoment;
    });

    test('falls back to ISO date when moment cannot be loaded', () => {
      jest.resetModules();
      jest.doMock('../../background/moment.min.js', () => {
        throw new Error('Moment unavailable');
      });
      delete global.moment;

      jest.isolateModules(() => {
        const { textReplace } = require('../../shared/template-utils');
        const result = textReplace('Date: {date:YYYY-MM-DD}', {});

        expect(result).toMatch(/^Date: \d{4}-\d{2}-\d{2}$/);
      });
    });
  });
});
