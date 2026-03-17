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
