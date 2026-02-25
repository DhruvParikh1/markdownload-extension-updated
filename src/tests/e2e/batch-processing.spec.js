/**
 * Batch processing regression tests.
 * Validates dynamic pages are fully rendered before markdown capture.
 */

const { test, expect, chromium } = require('@playwright/test');
const path = require('path');

const extensionPath = path.join(__dirname, '../..');

test.describe('Batch Processing E2E', () => {
  let context;
  let popupPage;
  let extensionId;

  test.beforeAll(async () => {
    context = await chromium.launchPersistentContext('', {
      headless: false,
      args: [
        `--disable-extensions-except=${extensionPath}`,
        `--load-extension=${extensionPath}`,
      ],
    });

    let [serviceWorker] = context.serviceWorkers();
    if (!serviceWorker) {
      serviceWorker = await context.waitForEvent('serviceworker', { timeout: 15000 });
    }
    extensionId = new URL(serviceWorker.url()).host;

    popupPage = await context.newPage();
    await popupPage.goto(`chrome-extension://${extensionId}/popup/popup.html`);
    await popupPage.waitForSelector('#batchProcess');
  });

  test.afterAll(async () => {
    await context?.close();
  });

  test('captures full content for Obsidian links page in batch flow', async () => {
    test.setTimeout(240000);

    const result = await popupPage.evaluate(async ({ urls }) => {
      // Keep the popup tab alive and skip actual downloads during test.
      window.__MARKSNIP_FORCE_INLINE_BATCH__ = true;
      window.close = () => {
        window.__testCloseCalled = true;
      };
      window.sendDownloadMessage = async () => {};
      sendDownloadMessage = window.sendDownloadMessage;

      document.getElementById('urlList').value = urls.join('\n');
      await handleBatchConversion({ preventDefault() {} });

      const markdown = document.querySelector('.CodeMirror').CodeMirror.getValue();
      return {
        markdownLength: markdown.length,
        hasLeadSentence: markdown.includes('Learn how to link to notes, attachments, and other files from your notes'),
        hasBlockDescription: markdown.includes('A block is a unit of text in your note'),
        hasPreviewNote: markdown.includes('To preview linked files, you first need to enable'),
        hasTocOnlySignature: markdown.includes('Interactive graph') && markdown.includes('On this page'),
        preview: markdown.slice(0, 500),
      };
    }, {
      urls: [
        'https://example.com/',
        'https://www.wikipedia.org/',
        'https://help.obsidian.md/links',
      ],
    });

    expect(result.hasLeadSentence).toBeTruthy();
    expect(result.hasBlockDescription).toBeTruthy();
    expect(result.hasPreviewNote).toBeTruthy();
    expect(result.hasTocOnlySignature).toBeFalsy();
  });
});
