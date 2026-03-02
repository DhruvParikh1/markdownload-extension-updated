/**
 * Code block conversion regression tests
 * Mirrors the convertToFencedCodeBlock logic in offscreen.js
 */

const { JSDOM } = require('jsdom');

describe('Code Block Conversion', () => {
  function repeat(character, count) {
    return Array(count + 1).join(character);
  }

  // Copied from offscreen.js for unit testing.
  function convertToFencedCodeBlock(node, options) {
    function normalizeCodeBlockSpacing(text, maxBlankLines = 2) {
      const lines = text.split('\n');
      const normalizedLines = [];
      let blankLineCount = 0;

      lines.forEach(line => {
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

    function detectPreLanguage(node, code) {
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

      classTokens.forEach(token => {
        candidates.add(token);
        if (token.startsWith('language-')) candidates.add(token.substring(9));
        if (token.startsWith('lang-')) candidates.add(token.substring(5));
        if (token.startsWith('source-')) candidates.add(token.substring(7));
        if (token.startsWith('highlight-')) candidates.add(token.substring(10));
      });

      if (typeof hljs !== 'undefined' && typeof hljs.getLanguage === 'function') {
        for (const candidate of candidates) {
          if (candidate && hljs.getLanguage(candidate)) {
            return candidate;
          }
        }
      }

      if (
        shouldAutoDetectLanguage &&
        typeof hljs !== 'undefined' &&
        typeof hljs.highlightAuto === 'function' &&
        code.trim()
      ) {
        const detected = hljs.highlightAuto(code);
        if (
          detected?.language &&
          typeof detected.relevance === 'number' &&
          detected.relevance >= 2
        ) {
          return detected.language;
        }
      }

      return '';
    }

    let code;

    if (options.preserveCodeFormatting) {
      code = node.innerHTML.replaceAll('<br-keep></br-keep>', '<br>');
    } else {
      const clonedNode = node.cloneNode(true);
      clonedNode.querySelectorAll('br-keep, br').forEach(br => {
        br.replaceWith('\n');
      });
      code = clonedNode.textContent || '';
      code = normalizeCodeBlockSpacing(code, 2);
    }
    const language = detectPreLanguage(node, code);

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
    return '\n\n' + fence + language + '\n' + code.replace(/\n$/, '') + '\n' + fence + '\n\n';
  }

  test('strips syntax-highlighter spans from pre blocks', () => {
    const dom = new JSDOM('<!doctype html><html><body></body></html>');
    const node = dom.window.document.createElement('pre');
    node.className = 'ruby';
    node.innerHTML = '<span class="ruby-constant">Measure</span> = <span class="ruby-constant">Data</span>.<span class="ruby-identifier">define</span>(<span class="ruby-value">:amount</span>, <span class="ruby-value">:unit</span>)';

    const result = convertToFencedCodeBlock(node, {
      fence: '```',
      preserveCodeFormatting: false
    });

    expect(result).toContain('Measure = Data.define(:amount, :unit)');
    expect(result).not.toContain('<span');
  });

  test('preserves line breaks represented by br-keep tags', () => {
    const dom = new JSDOM('<!doctype html><html><body></body></html>');
    const node = dom.window.document.createElement('pre');
    node.innerHTML = 'line 1<br-keep></br-keep>line 2';

    const result = convertToFencedCodeBlock(node, {
      fence: '```',
      preserveCodeFormatting: false
    });

    expect(result).toContain('line 1\nline 2');
  });

  test('collapses runs of 3+ blank lines to 2 in non-preserve mode', () => {
    const dom = new JSDOM('<!doctype html><html><body></body></html>');
    const node = dom.window.document.createElement('pre');
    node.innerHTML = 'line 1\n\n\n\nline 2';

    const result = convertToFencedCodeBlock(node, {
      fence: '```',
      preserveCodeFormatting: false
    });

    expect(result).toContain('line 1\n\n\nline 2');
    expect(result).not.toContain('line 1\n\n\n\nline 2');
  });

  test('does not normalize blank lines when preserveCodeFormatting is enabled', () => {
    const dom = new JSDOM('<!doctype html><html><body></body></html>');
    const node = dom.window.document.createElement('pre');
    node.innerHTML = 'line 1\n\n\n\nline 2';

    const result = convertToFencedCodeBlock(node, {
      fence: '```',
      preserveCodeFormatting: true
    });

    expect(result).toContain('line 1\n\n\n\nline 2');
  });

  test('uses explicit language from pre id when available', () => {
    const dom = new JSDOM('<!doctype html><html><body></body></html>');
    const node = dom.window.document.createElement('pre');
    node.id = 'code-lang-text';
    node.className = 'ruby';
    node.innerHTML = 'puts "hello"';

    global.hljs = {
      getLanguage: jest.fn(() => true),
      highlightAuto: jest.fn(() => ({ language: 'ruby', relevance: 10 }))
    };

    const result = convertToFencedCodeBlock(node, {
      fence: '```',
      preserveCodeFormatting: false
    });

    expect(result).toContain('```text');
    delete global.hljs;
  });

  test('infers language from recognized pre class token', () => {
    const dom = new JSDOM('<!doctype html><html><body></body></html>');
    const node = dom.window.document.createElement('pre');
    node.className = 'ruby example';
    node.innerHTML = 'puts "hello"';

    global.hljs = {
      getLanguage: jest.fn((lang) => lang === 'ruby'),
      highlightAuto: jest.fn(() => ({ language: 'javascript', relevance: 20 }))
    };

    const result = convertToFencedCodeBlock(node, {
      fence: '```',
      preserveCodeFormatting: false
    });

    expect(result).toContain('```ruby');
    delete global.hljs;
  });

  test('falls back to auto detection when class is not a language', () => {
    const dom = new JSDOM('<!doctype html><html><body></body></html>');
    const node = dom.window.document.createElement('pre');
    node.className = 'example snippet';
    node.innerHTML = 'const a = 1;';

    global.hljs = {
      getLanguage: jest.fn(() => false),
      highlightAuto: jest.fn(() => ({ language: 'javascript', relevance: 8 }))
    };

    const result = convertToFencedCodeBlock(node, {
      fence: '```',
      preserveCodeFormatting: false
    });

    expect(result).toContain('```javascript');
    delete global.hljs;
  });

  test('does not auto-detect language when autoDetectCodeLanguage is disabled', () => {
    const dom = new JSDOM('<!doctype html><html><body></body></html>');
    const node = dom.window.document.createElement('pre');
    node.className = 'example snippet';
    node.innerHTML = 'const a = 1;';

    global.hljs = {
      getLanguage: jest.fn(() => false),
      highlightAuto: jest.fn(() => ({ language: 'javascript', relevance: 8 }))
    };

    const result = convertToFencedCodeBlock(node, {
      fence: '```',
      preserveCodeFormatting: false,
      autoDetectCodeLanguage: false
    });

    expect(result).toContain('```\nconst a = 1;\n```');
    expect(global.hljs.highlightAuto).not.toHaveBeenCalled();
    delete global.hljs;
  });
});
