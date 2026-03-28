const countUtils = require('../../shared/count-utils.js');

describe('count-utils', () => {
  test('includes minRead in the supported counter modes', () => {
    expect(countUtils.COUNT_MODES).toEqual(['chars', 'words', 'minRead', 'tokens']);
  });

  test('formats character and word counts', () => {
    expect(countUtils.formatCountDisplay('hello world', 'chars')).toBe('11 chars');
    expect(countUtils.formatCountDisplay('hello world', 'words')).toBe('2 words');
  });

  test('formats min read with zero and rounded-up minute values', () => {
    const fourHundredWords = Array.from({ length: 400 }, (_, index) => `word${index}`).join(' ');

    expect(countUtils.formatCountDisplay('', 'minRead')).toBe('0 min read');
    expect(countUtils.estimateReadingMinutes('short text')).toBe(1);
    expect(countUtils.formatCountDisplay(fourHundredWords, 'minRead')).toBe('2 min read');
  });

  test('formats token counts using the shared estimator', () => {
    expect(countUtils.formatCountDisplay('hello world', 'tokens')).toBe('3 tokens');
  });
});
