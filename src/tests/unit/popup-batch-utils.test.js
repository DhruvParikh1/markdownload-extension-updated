const popupBatchUtils = require('../../shared/popup-batch-utils.js');

describe('popup-batch-utils', () => {
  describe('parseMarkdownLink', () => {
    test('parses markdown link title and url', () => {
      const result = popupBatchUtils.parseMarkdownLink('[Example](example.com/docs)');
      expect(result).toEqual({
        title: 'Example',
        url: 'example.com/docs'
      });
    });

    test('returns null for non-markdown link lines', () => {
      expect(popupBatchUtils.parseMarkdownLink('https://example.com')).toBeNull();
      expect(popupBatchUtils.parseMarkdownLink('')).toBeNull();
      expect(popupBatchUtils.parseMarkdownLink(null)).toBeNull();
    });
  });

  describe('normalizeUrl', () => {
    test('adds https when protocol is missing', () => {
      expect(popupBatchUtils.normalizeUrl('example.com/path')).toBe('https://example.com/path');
    });

    test('preserves existing http/https urls', () => {
      expect(popupBatchUtils.normalizeUrl('http://example.com/test')).toBe('http://example.com/test');
      expect(popupBatchUtils.normalizeUrl('https://example.com/test')).toBe('https://example.com/test');
    });

    test('returns null for invalid urls', () => {
      expect(popupBatchUtils.normalizeUrl('not a valid url')).toBeNull();
      expect(popupBatchUtils.normalizeUrl(undefined)).toBeNull();
    });
  });

  describe('processUrlInput', () => {
    test('parses mixed markdown links and plain urls', () => {
      const result = popupBatchUtils.processUrlInput([
        '[Docs](example.com/docs)',
        'example.com/blog',
        'not a valid url'
      ].join('\n'));

      expect(result).toEqual([
        { title: 'Docs', url: 'https://example.com/docs' },
        { title: null, url: 'https://example.com/blog' }
      ]);
    });

    test('returns empty array for empty input', () => {
      expect(popupBatchUtils.processUrlInput(' \n  \n')).toEqual([]);
    });
  });

  describe('summarizeUrlValidation', () => {
    test('returns zero counts for empty url list', () => {
      const result = popupBatchUtils.summarizeUrlValidation('');
      expect(result).toEqual({
        totalLines: 0,
        validCount: 0,
        invalidCount: 0,
        urlObjects: [],
        shouldDisableConvert: false
      });
    });

    test('counts valid and invalid lines and returns normalized url objects', () => {
      const result = popupBatchUtils.summarizeUrlValidation([
        '[Docs](example.com/docs)',
        'bad url line',
        'https://example.com/ok'
      ].join('\n'));

      expect(result.totalLines).toBe(3);
      expect(result.validCount).toBe(2);
      expect(result.invalidCount).toBe(1);
      expect(result.shouldDisableConvert).toBe(false);
      expect(result.urlObjects).toEqual([
        { title: 'Docs', url: 'https://example.com/docs' },
        { title: null, url: 'https://example.com/ok' }
      ]);
    });

    test('disables conversion when all lines are invalid', () => {
      const result = popupBatchUtils.summarizeUrlValidation('not a valid url');
      expect(result.validCount).toBe(0);
      expect(result.invalidCount).toBe(1);
      expect(result.shouldDisableConvert).toBe(true);
    });
  });

  describe('isLikelyIncompleteMarkdown', () => {
    test('returns true for empty markdown', () => {
      expect(popupBatchUtils.isLikelyIncompleteMarkdown('')).toBe(true);
      expect(popupBatchUtils.isLikelyIncompleteMarkdown('   ')).toBe(true);
    });

    test('returns true for short toc-heavy markdown', () => {
      const markdown = [
        '# On this page',
        '- intro',
        '- usage',
        '- api',
        '## Table of contents'
      ].join('\n');

      expect(popupBatchUtils.isLikelyIncompleteMarkdown(markdown)).toBe(true);
    });

    test('returns false for content-rich markdown', () => {
      const paragraph = 'This is meaningful article content that should not be considered incomplete.';
      const markdown = `# Title\n\n${paragraph.repeat(8)}\n\n## Details\n\n${paragraph.repeat(6)}`;

      expect(popupBatchUtils.isLikelyIncompleteMarkdown(markdown)).toBe(false);
    });
  });
});
