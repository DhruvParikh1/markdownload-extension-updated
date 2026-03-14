/**
 * Batch processing regression tests.
 * Validates dynamic pages are fully rendered before markdown capture.
 */

const fs = require('fs');
const { test, expect, chromium } = require('@playwright/test');
const path = require('path');

const extensionPath = path.join(__dirname, '../..');
const fixtureDirectory = path.join(__dirname, '../fixtures/e2e-markdown');
const batchSnapshotCases = [
  {
    name: 'matches snapshot for visualmode.dev array argument page',
    url: 'https://www.visualmode.dev/ruby-operators/array-argument',
    fixtureFile: 'visualmode-ruby-operators-array-argument.md',
  },
  {
    name: 'matches snapshot for ruby-doc Data class page',
    url: 'https://ruby-doc.org/3.3.6/Data.html',
    fixtureFile: 'ruby-doc-3.3.6-data.md',
  },
  {
    name: 'matches snapshot for runjs equations blog page',
    url: 'https://runjs.app/blog/equations-that-changed-the-world-rewritten-in-javascript',
    fixtureFile: 'runjs-17-equations.md',
  },
];

function normalizeMarkdown(text) {
  return String(text ?? '')
    .replace(/\r\n/g, '\n')
    .trimEnd();
}

function readExpectedFixture(fixtureFile) {
  return fs.readFileSync(path.join(fixtureDirectory, fixtureFile), 'utf8');
}

async function runSingleUrlBatchCapture(popupPage, url) {
  await popupPage.bringToFront();
  await popupPage.goto(popupPage.url());
  await popupPage.waitForSelector('#batchProcess');

  return popupPage.evaluate(async ({ targetUrl }) => {
    // Keep the popup tab alive and skip actual downloads during test.
    window.__MARKSNIP_FORCE_INLINE_BATCH__ = true;
    window.close = () => {
      window.__testCloseCalled = true;
    };
    window.sendDownloadMessage = async () => {};
    sendDownloadMessage = window.sendDownloadMessage;

    const cmInstance = document.querySelector('.CodeMirror').CodeMirror;
    cmInstance.setValue('');
    document.getElementById('urlList').value = '';
    document.getElementById('urlList').value = targetUrl;
    await handleBatchConversion({ preventDefault() {} });

    return cmInstance.getValue();
  }, {
    targetUrl: url,
  });
}

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

  test('captures later repeated sections for the Sebastian Higgins article', async () => {
    test.setTimeout(240000);

    const previousOptions = await popupPage.evaluate(async () => (
      await browser.storage.sync.get(['downloadImages', 'downloadMode'])
    ));

    await popupPage.evaluate(async () => {
      await browser.storage.sync.set({
        downloadImages: true,
        downloadMode: 'downloadsApi'
      });
    });

    let actualMarkdown;
    try {
      actualMarkdown = await runSingleUrlBatchCapture(
        popupPage,
        'https://sebastian.graphics/blog/16-bit-tiny-model-standalone-c-with-open-watcom.html'
      );
    } finally {
      await popupPage.evaluate(async (options) => {
        const toSet = {};
        const toRemove = [];

        ['downloadImages', 'downloadMode'].forEach((key) => {
          if (Object.prototype.hasOwnProperty.call(options, key)) {
            toSet[key] = options[key];
          } else {
            toRemove.push(key);
          }
        });

        if (Object.keys(toSet).length) {
          await browser.storage.sync.set(toSet);
        }
        if (toRemove.length) {
          await browser.storage.sync.remove(toRemove);
        }
      }, previousOptions);
    }

    const normalizedMarkdown = normalizeMarkdown(actualMarkdown);

    expect(normalizedMarkdown).toContain("A few days ago I've heard that Open Watcom is able to generate");
    expect(normalizedMarkdown).toContain('## Replacing the wrapper');
    expect(normalizedMarkdown).toContain('## Full code');
    expect(normalizedMarkdown).toContain('wrapper.asm');
    expect(normalizedMarkdown).toContain('main.lnk');
  });

  for (const snapshotCase of batchSnapshotCases) {
    test(snapshotCase.name, async () => {
      test.setTimeout(240000);

      const actualMarkdown = await runSingleUrlBatchCapture(popupPage, snapshotCase.url);
      const expectedMarkdown = readExpectedFixture(snapshotCase.fixtureFile);

      expect(normalizeMarkdown(actualMarkdown)).toBe(normalizeMarkdown(expectedMarkdown));
    });
  }
});
