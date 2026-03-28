(function (root) {
  const COUNT_MODES = Object.freeze(['chars', 'words', 'minRead', 'tokens']);
  const DEFAULT_READING_WORDS_PER_MINUTE = 200;

  function normalizeText(text) {
    return String(text || '');
  }

  function getWordCount(text) {
    const normalized = normalizeText(text).trim();
    return normalized === '' ? 0 : normalized.split(/\s+/).length;
  }

  function estimateTokens(text) {
    text = normalizeText(text);
    if (!text) return 0;

    let total = 0;

    text = text.replace(/!?\[([^\]]*)\]\((https?:\/\/[^\s\)]+)\)/g, (_, label, url) => {
      total += Math.ceil(url.length / 2.5);
      total += 2;
      return label;
    });

    text = text.replace(/https?:\/\/[^\s\)>\]]+/g, (url) => {
      total += Math.ceil(url.length / 2.5);
      return '';
    });

    text = text.replace(/```[\s\S]*?```/g, (block) => {
      total += Math.ceil(block.length / 3);
      return '';
    });

    text = text.replace(/`[^`\n]+`/g, (code) => {
      total += Math.ceil(code.length / 3.5);
      return '';
    });

    text = text.replace(/&(?:#\d+|#x[\da-fA-F]+|[a-zA-Z]+);/g, () => {
      total += 1;
      return '';
    });

    text = text.replace(/[^\x00-\x7F]+/g, (chunk) => {
      total += Math.ceil(chunk.length * 1.5);
      return '';
    });

    text = text.replace(/\b\d[\d.,:\-\/]*\b/g, (num) => {
      total += Math.ceil(num.length / 2);
      return '';
    });

    text = text.replace(/^#{1,6}\s/gm, () => {
      total += 1;
      return '';
    });
    text = text.replace(/(\*{1,3}|_{1,3})/g, () => {
      total += 1;
      return '';
    });
    text = text.replace(/^[\-\*\+]\s/gm, () => {
      total += 1;
      return '';
    });
    text = text.replace(/^\d+\.\s/gm, () => {
      total += 1;
      return '';
    });
    text = text.replace(/^>\s?/gm, () => {
      total += 1;
      return '';
    });

    const remaining = text.replace(/\s+/g, ' ').trim();
    if (remaining.length > 0) {
      total += Math.ceil(remaining.length / 4);
    }

    return total;
  }

  function estimateReadingMinutes(text, wordsPerMinute = DEFAULT_READING_WORDS_PER_MINUTE) {
    const words = getWordCount(text);
    const normalizedWordsPerMinute = Number.isFinite(wordsPerMinute) && wordsPerMinute > 0
      ? wordsPerMinute
      : DEFAULT_READING_WORDS_PER_MINUTE;

    if (words === 0) {
      return 0;
    }

    return Math.max(1, Math.ceil(words / normalizedWordsPerMinute));
  }

  function formatCountDisplay(text, mode) {
    const normalized = normalizeText(text);

    if (mode === 'words') {
      return getWordCount(normalized).toLocaleString() + ' words';
    }

    if (mode === 'minRead') {
      return estimateReadingMinutes(normalized).toLocaleString() + ' min read';
    }

    if (mode === 'tokens') {
      return estimateTokens(normalized).toLocaleString() + ' tokens';
    }

    return normalized.length.toLocaleString() + ' chars';
  }

  const api = {
    COUNT_MODES,
    DEFAULT_READING_WORDS_PER_MINUTE,
    getWordCount,
    estimateTokens,
    estimateReadingMinutes,
    formatCountDisplay
  };

  root.markSnipCountUtils = api;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
})(typeof globalThis !== 'undefined' ? globalThis : this);
