const fs = require('fs');
const path = require('path');

describe('Content Script DOM Capture', () => {
  beforeAll(() => {
    const scriptPath = path.join(__dirname, '../../contentScript/contentScript.js');
    const scriptSource = fs.readFileSync(scriptPath, 'utf8');
    window.eval(scriptSource);
  });

  beforeEach(() => {
    document.documentElement.innerHTML = `
      <head></head>
      <body>
        <main id="root">
          <img id="visible-img" src="/visible.png">
          <img id="hidden-img" src="/hidden.png" style="display: none;">
          <div id="hidden-div" style="visibility: hidden;">Hidden text</div>
          <div id="visible-div">Visible text</div>
        </main>
      </body>
    `;
  });

  test('getSelectionAndDom should not mutate the live document', () => {
    const beforeOuterHTML = document.documentElement.outerHTML;
    const beforeTitleCount = document.head.querySelectorAll('title').length;
    const beforeBaseCount = document.head.querySelectorAll('base').length;
    const beforeHiddenImage = document.getElementById('hidden-img');

    const result = getSelectionAndDom();

    expect(result).toBeTruthy();
    expect(result.dom).toBeTruthy();
    expect(document.documentElement.outerHTML).toBe(beforeOuterHTML);
    expect(document.head.querySelectorAll('title').length).toBe(beforeTitleCount);
    expect(document.head.querySelectorAll('base').length).toBe(beforeBaseCount);
    expect(document.getElementById('hidden-img')).toBe(beforeHiddenImage);
  });

  test('captured DOM should be cleaned while live DOM stays intact', () => {
    const result = getSelectionAndDom();
    const parser = new DOMParser();
    const capturedDocument = parser.parseFromString(result.dom, 'text/html');

    expect(capturedDocument.getElementById('hidden-img')).toBeNull();
    expect(capturedDocument.getElementById('hidden-div')).toBeNull();
    expect(capturedDocument.getElementById('visible-img')).toBeTruthy();
    expect(capturedDocument.getElementById('visible-div')).toBeTruthy();
    expect(document.getElementById('hidden-img')).toBeTruthy();
    expect(document.getElementById('hidden-div')).toBeTruthy();
    expect(document.head.querySelector('base')).toBeNull();
  });

  test('marksnipPrepareForCapture should request MathJax sync for rendered nodes', async () => {
    const mathNode = document.createElement('mjx-container');
    document.getElementById('visible-div').appendChild(mathNode);

    window.marksnipCaptureState.pageContextScriptLoaded = true;
    window.marksnipCaptureState.pageContextLoadPromise = Promise.resolve(true);

    window.addEventListener(window.marksnipCaptureState.mathJaxSyncRequestEventName, () => {
      mathNode.setAttribute('marksnip-latex', 'E=mc^2');
      window.dispatchEvent(new CustomEvent(window.marksnipCaptureState.mathJaxSyncEventName, {
        detail: { taggedCount: 1 }
      }));
    }, { once: true });

    await marksnipPrepareForCapture();

    expect(mathNode.getAttribute('marksnip-latex')).toBe('E=mc^2');
  });
});
