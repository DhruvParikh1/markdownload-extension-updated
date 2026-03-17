/**
 * Selection capture behavior tests.
 * Uses the shared production helper.
 */

const { buildDomWithSelection } = require('../../shared/selection-utils');

describe('Selection Capture', () => {
  test('replaces body with selection html when selection mode is enabled', () => {
    const fullDom = '<html><head><title>T</title><base href="https://example.com/x"></head><body><p>full page</p></body></html>';
    const resultDom = buildDomWithSelection(fullDom, '<p>selected text</p>', true);
    const doc = new DOMParser().parseFromString(resultDom, 'text/html');

    expect(doc.head.querySelector('title')?.textContent).toBe('T');
    expect(doc.head.querySelector('base')?.getAttribute('href')).toBe('https://example.com/x');
    expect(doc.body.innerHTML).toBe('<p>selected text</p>');
  });

  test('keeps original dom when selection mode is disabled', () => {
    const fullDom = '<html><head><title>T</title></head><body><p>full page</p></body></html>';
    const resultDom = buildDomWithSelection(fullDom, '<p>selected text</p>', false);
    const doc = new DOMParser().parseFromString(resultDom, 'text/html');

    expect(doc.body.innerHTML).toBe('<p>full page</p>');
  });

  test('keeps original dom when selection html is empty', () => {
    const fullDom = '<html><head><title>T</title></head><body><p>full page</p></body></html>';
    const resultDom = buildDomWithSelection(fullDom, '   ', true);
    const doc = new DOMParser().parseFromString(resultDom, 'text/html');

    expect(doc.body.innerHTML).toBe('<p>full page</p>');
  });
});

describe('Selection Capture edge cases', () => {
  const originalDOMParser = global.DOMParser;

  afterEach(() => {
    global.DOMParser = originalDOMParser;
  });

  test('falls back when DOMParser is unavailable', () => {
    delete global.DOMParser;
    const dom = '<html><body><p>source</p></body></html>';
    const result = buildDomWithSelection(dom, '<p>select</p>', true);

    expect(result).toBe(dom);
  });

  test('falls back when parser reports a parsererror document', () => {
    global.DOMParser = class {
      parseFromString() {
        return { documentElement: { nodeName: 'parsererror' } };
      }
    };
    const dom = '<html><body><p>source</p></body></html>';
    const result = buildDomWithSelection(dom, '<p>select</p>', true);

    expect(result).toBe(dom);
  });

  test('falls back when parser throws', () => {
    global.DOMParser = class {
      parseFromString() {
        throw new Error('boom');
      }
    };
    const dom = '<html><body><p>source</p></body></html>';
    const result = buildDomWithSelection(dom, '<p>select</p>', true);

    expect(result).toBe(dom);
  });
});
