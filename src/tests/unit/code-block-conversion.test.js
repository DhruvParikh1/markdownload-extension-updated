/**
 * Code block conversion regression tests
 * Uses the shared production helper.
 */

const { JSDOM } = require('jsdom');
const { convertToFencedCodeBlock } = require('../../shared/code-block-utils');

describe('Code Block Conversion', () => {
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
