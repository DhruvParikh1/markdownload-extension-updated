/**
 * Selection capture behavior tests.
 * Mirrors buildDomWithSelection in offscreen/offscreen.js.
 */

function buildDomWithSelection(domString, selectionHtml, shouldUseSelection = true) {
  if (!shouldUseSelection || typeof selectionHtml !== 'string' || !selectionHtml.trim()) {
    return domString;
  }

  try {
    const parser = new DOMParser();
    const dom = parser.parseFromString(domString, 'text/html');
    if (dom.documentElement.nodeName === 'parsererror') {
      return domString;
    }

    if (dom.body) {
      dom.body.innerHTML = selectionHtml;
      return dom.documentElement.outerHTML;
    }
  } catch (error) {
    return domString;
  }

  return domString;
}

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
