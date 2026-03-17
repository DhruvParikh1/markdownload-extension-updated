(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory(root);
    return;
  }

  root.markSnipHashtagUtils = factory(root);
})(typeof globalThis !== 'undefined' ? globalThis : this, function (root) {
  const hashtagEscapeSentinel = '\uE000';

  function normalizeHashtagHandlingMode(mode) {
    if (mode === 'remove' || mode === 'escape' || mode === 'keep') {
      return mode;
    }
    return 'keep';
  }

  function replaceHashtagTokensInText(text, mode) {
    if (!text) return text;

    const hashtagTokenRegex = /(^|[^\p{L}\p{N}_\\/])#([\p{L}\p{N}_][\p{L}\p{N}_-]*)/gu;
    return text.replace(hashtagTokenRegex, (match, prefix, tag) => {
      if (mode === 'remove') {
        return `${prefix}${tag}`;
      }
      if (mode === 'escape') {
        return `${prefix}${hashtagEscapeSentinel}${tag}`;
      }
      return match;
    });
  }

  function applyHashtagHandlingToHtml(content, mode) {
    const normalizedMode = normalizeHashtagHandlingMode(mode);
    if (normalizedMode === 'keep' || !content) {
      return content;
    }

    const documentRef = root.document;
    if (!documentRef || typeof documentRef.createElement !== 'function') {
      return content;
    }

    const container = documentRef.createElement('div');
    container.innerHTML = content;
    const excludedParents = new Set(['CODE', 'PRE', 'SCRIPT', 'STYLE', 'NOSCRIPT', 'TEXTAREA']);
    const showText = root.NodeFilter ? root.NodeFilter.SHOW_TEXT : 4;
    const walker = documentRef.createTreeWalker(container, showText);

    let node = walker.nextNode();
    while (node) {
      const parentTag = node.parentElement?.tagName;
      if (!excludedParents.has(parentTag)) {
        node.nodeValue = replaceHashtagTokensInText(node.nodeValue, normalizedMode);
      }
      node = walker.nextNode();
    }

    return container.innerHTML;
  }

  function applyHashtagHandlingToMarkdown(markdown, mode) {
    if (!markdown) return markdown;
    const normalizedMode = normalizeHashtagHandlingMode(mode);
    if (normalizedMode !== 'escape') return markdown;
    return markdown.replaceAll(hashtagEscapeSentinel, '\\#');
  }

  return {
    hashtagEscapeSentinel,
    normalizeHashtagHandlingMode,
    replaceHashtagTokensInText,
    applyHashtagHandlingToHtml,
    applyHashtagHandlingToMarkdown
  };
});
