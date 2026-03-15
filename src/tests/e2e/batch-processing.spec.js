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

async function installBatchHarness(serviceWorker) {
  await serviceWorker.evaluate(() => {
    if (!self.__markSnipBatchHarnessInstalled) {
      self.__markSnipBatchHarnessInstalled = true;
      self.__markSnipBatchHarnessOriginals = {
        sendBatchProgressUpdate: self.sendBatchProgressUpdate,
        triggerBatchZipDownload: self.triggerBatchZipDownload
      };

      self.sendBatchProgressUpdate = async (update) => {
        const snapshot = JSON.parse(JSON.stringify(update ?? null));
        self.__markSnipBatchHarnessState.progress.push(snapshot);
        return self.__markSnipBatchHarnessOriginals.sendBatchProgressUpdate(update);
      };

      self.triggerBatchZipDownload = async (files, options, fallbackTabId = null) => {
        self.__markSnipBatchHarnessState.zipCalls.push({
          files: JSON.parse(JSON.stringify(files || [])),
          options: JSON.parse(JSON.stringify(options || {})),
          fallbackTabId
        });
      };
    }

    self.__markSnipBatchHarnessState = {
      progress: [],
      zipCalls: []
    };
  });
}

async function waitForBatchHarnessCompletion(serviceWorker) {
  await expect.poll(async () => (
    await serviceWorker.evaluate(() => {
      const progress = self.__markSnipBatchHarnessState?.progress || [];
      return progress.length ? progress[progress.length - 1].status : null;
    })
  ), { timeout: 240000 }).toBe('finished');
}

async function runBatchCapture(context, extensionId, serviceWorker, urls) {
  await installBatchHarness(serviceWorker);

  const popupPage = await context.newPage();
  await popupPage.goto(`chrome-extension://${extensionId}/popup/popup.html`);
  await popupPage.waitForSelector('#batchProcess');

  try {
    await popupPage.evaluate(async ({ targetUrls }) => {
      document.getElementById('urlList').value = targetUrls.join('\n');
      const batchSaveModeToggle = document.getElementById('batchSaveModeToggle');
      if (batchSaveModeToggle) batchSaveModeToggle.checked = false;
      await handleBatchConversion({ preventDefault() {} });
    }, {
      targetUrls: urls,
    });

    await waitForBatchHarnessCompletion(serviceWorker);

    return serviceWorker.evaluate(() => (
      JSON.parse(JSON.stringify(self.__markSnipBatchHarnessState || { progress: [], zipCalls: [] }))
    ));
  } finally {
    if (!popupPage.isClosed()) {
      await popupPage.close().catch(() => {});
    }
  }
}

async function runSingleUrlBatchCapture(context, extensionId, serviceWorker, url) {
  const state = await runBatchCapture(context, extensionId, serviceWorker, [url]);
  const lastZipCall = state.zipCalls[state.zipCalls.length - 1];
  if (!lastZipCall?.files?.length) {
    throw new Error(`No batch ZIP payload captured for ${url}`);
  }
  return lastZipCall.files[0].content;
}

test.describe('Batch Processing E2E', () => {
  let context;
  let extensionId;
  let serviceWorker;

  test.beforeAll(async () => {
    context = await chromium.launchPersistentContext('', {
      headless: false,
      args: [
        `--disable-extensions-except=${extensionPath}`,
        `--load-extension=${extensionPath}`,
      ],
    });

    [serviceWorker] = context.serviceWorkers();
    if (!serviceWorker) {
      serviceWorker = await context.waitForEvent('serviceworker', { timeout: 15000 });
    }
    extensionId = new URL(serviceWorker.url()).host;
  });

  test.afterAll(async () => {
    await context?.close();
  });

  test('captures full content for Obsidian links page in batch flow', async () => {
    test.setTimeout(240000);

    const state = await runBatchCapture(context, extensionId, serviceWorker, [
      'https://example.com/',
      'https://www.wikipedia.org/',
      'https://help.obsidian.md/links',
    ]);
    const capturedFiles = state.zipCalls[state.zipCalls.length - 1]?.files || [];
    const obsidianMarkdown = capturedFiles
      .map(file => file.content)
      .find(markdown => markdown.includes('Learn how to link to notes, attachments, and other files from your notes'));

    expect(capturedFiles).toHaveLength(3);
    expect(obsidianMarkdown).toBeTruthy();
    expect(obsidianMarkdown).toContain('A block is a unit of text in your note');
    expect(obsidianMarkdown).toContain('To preview linked files, you first need to enable');
    expect(obsidianMarkdown.includes('Interactive graph') && obsidianMarkdown.includes('On this page')).toBeFalsy();
  });

  test('captures later repeated sections for the Sebastian Higgins article', async () => {
    test.setTimeout(240000);

    const popupPage = await context.newPage();
    await popupPage.goto(`chrome-extension://${extensionId}/popup/popup.html`);
    const previousOptions = await popupPage.evaluate(async () => (
      await browser.storage.sync.get(['downloadImages', 'downloadMode'])
    ));

    let actualMarkdown;
    try {
      await popupPage.evaluate(async () => {
        await browser.storage.sync.set({
          downloadImages: true,
          downloadMode: 'downloadsApi'
        });
      });

      actualMarkdown = await runSingleUrlBatchCapture(
        context,
        extensionId,
        serviceWorker,
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
      if (!popupPage.isClosed()) {
        await popupPage.close().catch(() => {});
      }
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

      const actualMarkdown = await runSingleUrlBatchCapture(
        context,
        extensionId,
        serviceWorker,
        snapshotCase.url
      );
      const expectedMarkdown = readExpectedFixture(snapshotCase.fixtureFile);

      expect(normalizeMarkdown(actualMarkdown)).toBe(normalizeMarkdown(expectedMarkdown));
    });
  }
});
