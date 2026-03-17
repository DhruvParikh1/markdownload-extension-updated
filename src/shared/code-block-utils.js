(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory(root);
    return;
  }

  root.markSnipCodeBlockUtils = factory(root);
})(typeof globalThis !== 'undefined' ? globalThis : this, function (root) {
  function repeat(character, count) {
    return Array(count + 1).join(character);
  }

  function normalizeCodeBlockSpacing(text, maxBlankLines = 2) {
    const lines = text.split('\n');
    const normalizedLines = [];
    let blankLineCount = 0;

    lines.forEach((line) => {
      if (/^[ \t]*$/.test(line)) {
        blankLineCount += 1;
        if (blankLineCount <= maxBlankLines) {
          normalizedLines.push('');
        }
      } else {
        blankLineCount = 0;
        normalizedLines.push(line);
      }
    });

    return normalizedLines.join('\n');
  }

  function detectPreLanguage(node, code, options) {
    const shouldAutoDetectLanguage = options.autoDetectCodeLanguage !== false;
    const idMatch = node.id?.match(/code-lang-(.+)/);
    if (idMatch?.length > 1) {
      return idMatch[1];
    }

    const classTokens = (node.className || '')
      .toLowerCase()
      .split(/\s+/)
      .filter(Boolean);
    const candidates = new Set();

    classTokens.forEach((token) => {
      candidates.add(token);
      if (token.startsWith('language-')) candidates.add(token.substring(9));
      if (token.startsWith('lang-')) candidates.add(token.substring(5));
      if (token.startsWith('source-')) candidates.add(token.substring(7));
      if (token.startsWith('highlight-')) candidates.add(token.substring(10));
    });

    const hljsApi = root.hljs;
    if (hljsApi && typeof hljsApi.getLanguage === 'function') {
      for (const candidate of candidates) {
        if (candidate && hljsApi.getLanguage(candidate)) {
          return candidate;
        }
      }
    }

    if (
      shouldAutoDetectLanguage &&
      hljsApi &&
      typeof hljsApi.highlightAuto === 'function' &&
      code.trim()
    ) {
      try {
        const detected = hljsApi.highlightAuto(code);
        if (
          detected?.language &&
          typeof detected.relevance === 'number' &&
          detected.relevance >= 2
        ) {
          return detected.language;
        }
      } catch {
        return '';
      }
    }

    return '';
  }

  function convertToFencedCodeBlock(node, options) {
    let code;

    if (options.preserveCodeFormatting) {
      code = node.innerHTML.replaceAll('<br-keep></br-keep>', '<br>');
    } else {
      const clonedNode = node.cloneNode(true);
      clonedNode.querySelectorAll('br-keep, br').forEach((br) => {
        br.replaceWith('\n');
      });
      code = clonedNode.textContent || '';
      code = normalizeCodeBlockSpacing(code, 2);
    }
    const language = detectPreLanguage(node, code, options);

    const fenceChar = options.fence.charAt(0);
    let fenceSize = 3;
    const fenceInCodeRegex = new RegExp('^' + fenceChar + '{3,}', 'gm');

    let match;
    while ((match = fenceInCodeRegex.exec(code))) {
      if (match[0].length >= fenceSize) {
        fenceSize = match[0].length + 1;
      }
    }

    const fence = repeat(fenceChar, fenceSize);

    return (
      '\n\n' + fence + language + '\n' +
      code.replace(/\n$/, '') +
      '\n' + fence + '\n\n'
    );
  }

  return {
    repeat,
    convertToFencedCodeBlock
  };
});
