(function (root) {
  function parseMarkdownLink(text) {
    if (typeof text !== 'string') {
      return null;
    }

    const markdownLinkRegex = /\[([^\]]+)\]\(([^)]+)\)/;
    const match = text.match(markdownLinkRegex);
    if (!match) {
      return null;
    }

    return {
      title: match[1].trim(),
      url: match[2].trim()
    };
  }

  function normalizeUrl(url) {
    if (typeof url !== 'string') {
      return null;
    }

    let normalized = url;
    if (!/^https?:\/\//i.test(normalized)) {
      normalized = 'https://' + normalized;
    }

    try {
      return new URL(normalized).href;
    } catch {
      return null;
    }
  }

  function processUrlInput(text) {
    const lines = String(text || '')
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean);

    const urlObjects = [];
    for (const line of lines) {
      const mdLink = parseMarkdownLink(line);
      if (mdLink) {
        const normalizedUrl = normalizeUrl(mdLink.url);
        if (normalizedUrl) {
          urlObjects.push({
            title: mdLink.title,
            url: normalizedUrl
          });
        }
        continue;
      }

      const normalizedUrl = normalizeUrl(line);
      if (normalizedUrl) {
        urlObjects.push({
          title: null,
          url: normalizedUrl
        });
      }
    }

    return urlObjects;
  }

  function summarizeUrlValidation(text) {
    const lines = String(text || '')
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean);

    if (lines.length === 0) {
      return {
        totalLines: 0,
        validCount: 0,
        invalidCount: 0,
        urlObjects: [],
        shouldDisableConvert: false
      };
    }

    const urlObjects = [];
    let validCount = 0;
    let invalidCount = 0;

    for (const line of lines) {
      const mdLink = parseMarkdownLink(line);
      const rawUrl = mdLink ? mdLink.url : line;
      const normalizedUrl = normalizeUrl(rawUrl);

      if (!normalizedUrl) {
        invalidCount += 1;
        continue;
      }

      validCount += 1;
      urlObjects.push({
        title: mdLink ? mdLink.title : null,
        url: normalizedUrl
      });
    }

    return {
      totalLines: lines.length,
      validCount,
      invalidCount,
      urlObjects,
      shouldDisableConvert: validCount === 0
    };
  }

  function isLikelyIncompleteMarkdown(markdown) {
    if (!markdown || !markdown.trim()) return true;

    const normalized = markdown.replace(/\r/g, '');
    const lines = normalized.split('\n').map(line => line.trim()).filter(Boolean);
    const headingLines = lines.filter(line => /^#{1,6}\s/.test(line)).length;
    const listLines = lines.filter(line => /^[-*+]\s/.test(line)).length;
    const nonStructuralLines = lines.filter(line => (
      !/^#{1,6}\s/.test(line) &&
      !/^[-*+]\s/.test(line) &&
      !/^\d+\.\s/.test(line) &&
      !/^>\s/.test(line) &&
      !/^!\[/.test(line)
    ));
    const nonStructuralChars = nonStructuralLines.join(' ').replace(/`/g, '').trim().length;
    const hasTocMarker = /\bOn this page\b/i.test(normalized) || /\bTable of contents\b/i.test(normalized);

    return (
      nonStructuralChars < 320 &&
      (headingLines + listLines) >= 4
    ) || (
      hasTocMarker &&
      nonStructuralChars < 500
    );
  }

  const api = {
    parseMarkdownLink,
    normalizeUrl,
    processUrlInput,
    summarizeUrlValidation,
    isLikelyIncompleteMarkdown
  };

  root.markSnipPopupBatchUtils = api;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
})(typeof globalThis !== 'undefined' ? globalThis : this);
