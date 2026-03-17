const {
  safeParseUrl,
  resolveArticleUrl,
  validateUri,
  getImageFilename
} = require('../../shared/url-utils');

describe('URL utils', () => {
  describe('safeParseUrl', () => {
    test('returns URL instance for valid URLs', () => {
      const parsed = safeParseUrl('https://example.com/page');
      expect(parsed).toBeInstanceOf(URL);
      expect(parsed.hostname).toBe('example.com');
    });

    test('returns null for invalid URLs', () => {
      expect(safeParseUrl('://bad')).toBeNull();
      expect(safeParseUrl('')).toBeNull();
    });
  });

  describe('resolveArticleUrl', () => {
    test('prefers explicit page url when valid', () => {
      const resolved = resolveArticleUrl('https://example.com/base', 'https://example.com/real');
      expect(resolved.href).toBe('https://example.com/real');
    });

    test('falls back to dom base when page url is empty', () => {
      const resolved = resolveArticleUrl('https://example.com/base', '');
      expect(resolved.href).toBe('https://example.com/base');
    });
  });

  describe('validateUri', () => {
    const base = 'https://example.com/folder/';

    test('keeps absolute URLs unchanged', () => {
      expect(validateUri('https://example.com/image.png', base)).toBe('https://example.com/image.png');
    });

    test('resolves root-relative paths', () => {
      const result = validateUri('/assets/pic.jpg', base);
      expect(result).toBe('https://example.com/assets/pic.jpg');
    });

    test('resolves relative paths without leading slash', () => {
      const result = validateUri('images/photo.png', base);
      expect(result).toBe('https://example.com/folder/images/photo.png');
    });
  });

  describe('getImageFilename', () => {
    const realTemplateUtils = global.markSnipTemplateUtils;

    beforeEach(() => {
      global.markSnipTemplateUtils = {
        generateValidFileName: jest.fn((value) => value.replace(/\s+/g, '-'))
      };
    });

    afterEach(() => {
      global.markSnipTemplateUtils = realTemplateUtils;
    });

    test('prefixes filename using title segments and options', () => {
      const options = {
        title: 'Repo/Notes',
        imagePrefix: 'gallery/',
        disallowedChars: '#[]'
      };
      const filename = getImageFilename('https://example.com/path/image.png?foo=1', options);

      expect(filename).toContain('Repo/gallery/');
      expect(global.markSnipTemplateUtils.generateValidFileName).toHaveBeenCalled();
      expect(filename).toMatch(/image\.png$/);
    });

    test('handles base64 data URIs and missing extension', () => {
      const options = { title: 'Clips/Batch' };
      const filename = getImageFilename('https://example.com/path/image;base64,abc', options);

      expect(filename).toContain('image.image');
      expect(filename).toContain('Clips/');
    });

    test('skips prefix when prependFilePath is false', () => {
      const options = {
        title: 'Notes',
        imagePrefix: 'pics/'
      };
      const filename = getImageFilename('https://example.com/photo.jpg', options, false);

      expect(filename).toBe('pics/photo.jpg');
      expect(global.markSnipTemplateUtils.generateValidFileName).toHaveBeenCalledWith('photo.jpg', undefined);
    });

    test('adds fallback extension when the source lacks a dot', () => {
      const options = { title: 'Folder' };
      const filename = getImageFilename('https://example.com/path/image', options);

      expect(filename).toContain('.idunno');
    });

    test('falls back to the bundled template utils when no runtime helper is present', () => {
      delete global.markSnipTemplateUtils;

      jest.isolateModules(() => {
        const { getImageFilename } = require('../../shared/url-utils');
        const filename = getImageFilename('https://example.com/path/image.png', {
          title: 'Docs',
          imagePrefix: 'gallery/'
        });

        expect(filename).toBe('Docs/gallery/image.png');
      });
    });

    test('falls back to identity sanitizers when template utils cannot be required', () => {
      const previousTemplateUtils = global.markSnipTemplateUtils;
      delete global.markSnipTemplateUtils;
      jest.resetModules();
      jest.doMock('../../shared/template-utils', () => {
        throw new Error('template utils unavailable');
      });

      try {
        jest.isolateModules(() => {
          const { getImageFilename } = require('../../shared/url-utils');
          const filename = getImageFilename('https://example.com/path/image', {
            title: 'Docs',
            imagePrefix: 'gallery/'
          });

          expect(filename).toBe('Docs/gallery/image.idunno');
        });
      } finally {
        jest.dontMock('../../shared/template-utils');
        jest.resetModules();
        global.markSnipTemplateUtils = previousTemplateUtils;
      }
    });
  });
});
