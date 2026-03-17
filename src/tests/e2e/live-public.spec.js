/**
 * Live smoke tests for public websites.
 * These tests intentionally hit public pages to restore the old live-site signal.
 */

const { test, expect, chromium } = require('@playwright/test');
const path = require('path');
const {
  createSnapshotRecord,
  loadLatestSuccessfulRun,
  buildComparison,
  persistSnapshotRun,
  formatComparisonForFailure,
  attachSnapshotArtifacts
} = require('../helpers/live-public-artifacts');

const extensionPath = path.join(__dirname, '../..');
const livePublicArtifactRoot = path.join(extensionPath, 'test-artifacts', 'live-public');
const liveClipCases = [
  {
    id: 'example-domain',
    name: 'clips Example.com via popup flow and returns markdown',
    url: 'https://example.com/',
    selector: 'h1',
    titleContains: 'Example Domain',
    snippets: [
      'This domain is for use in documentation examples without needing permission.',
      'Learn more'
    ]
  },
  {
    id: 'wikipedia-markdown',
    name: 'clips the live Wikipedia Markdown article via popup flow',
    url: 'https://en.wikipedia.org/wiki/Markdown',
    selector: '#firstHeading',
    titleContains: 'Markdown',
    snippets: [
      'Markdown',
      'lightweight markup language'
    ]
  },
  {
    id: 'obsidian-links',
    name: 'clips the live Obsidian links help page via popup flow',
    url: 'https://help.obsidian.md/links',
    selector: 'h1',
    titleContains: 'Internal links',
    snippets: [
      'Learn how to link to notes, attachments, and other files from your notes'
    ]
  },
  {
    id: 'sebastian-open-watcom',
    name: 'clips the live Sebastian graphics Open Watcom article via popup flow',
    url: 'https://sebastian.graphics/blog/16-bit-tiny-model-standalone-c-with-open-watcom.html',
    selector: 'h1',
    titleContains: 'Open Watcom',
    snippets: [
      "A few days ago I've heard that Open Watcom is able to generate",
      '## Replacing the wrapper',
      'wrapper.asm'
    ]
  },
  {
    id: 'visualmode-array-argument',
    name: 'clips the live Visualmode array argument article via popup flow',
    url: 'https://www.visualmode.dev/ruby-operators/array-argument',
    selector: 'h1',
    titleContains: 'Argument',
    snippets: [
      'Here is an example of a method that can accept any number of (positional) arguments',
      'def odd_finder(*items)'
    ]
  },
  {
    id: 'ruby-data-docs',
    name: 'clips the live Ruby Data docs page via popup flow',
    url: 'https://ruby-doc.org/3.3.6/Data.html',
    selector: 'h1',
    titleContains: 'Data',
    snippets: [
      'Class Data provides a convenient way to define simple classes for value-alike objects.',
      'Measure = Data.define(:amount, :unit)'
    ]
  },
  {
    id: 'runjs-equations',
    name: 'clips the live RunJS equations article via popup flow',
    url: 'https://runjs.app/blog/equations-that-changed-the-world-rewritten-in-javascript',
    selector: 'h1',
    titleContains: 'Equations',
    snippets: [
      '17 Equations That Changed The World',
      '## The Pythagorean Theorem'
    ]
  }
];

async function getTabIdForUrl(serviceWorker, url) {
  return await serviceWorker.evaluate(async ({ targetUrl }) => {
    const tabs = await browser.tabs.query({});
    return tabs.find((tab) => tab.url === targetUrl)?.id || null;
  }, { targetUrl: url });
}

async function captureLivePageState(livePage, liveCase, responseStatus = null) {
  const html = await livePage.content();
  const meta = await livePage.evaluate(({ selector, responseStatus }) => {
    const normalize = (value) => String(value || '')
      .replace(/\s+/g, ' ')
      .trim();

    const mainRoot = document.querySelector('article, main, [role="main"]') || document.body || document.documentElement;
    const selectorText = document.querySelector(selector)?.textContent || '';
    const headings = Array.from(document.querySelectorAll('h1, h2, h3'))
      .map((heading) => normalize(heading.textContent))
      .filter(Boolean)
      .slice(0, 20);

    return {
      responseStatus,
      finalUrl: window.location.href,
      pageTitle: document.title || '',
      selectorText: normalize(selectorText),
      headings,
      mainTextExcerpt: normalize(mainRoot?.innerText || mainRoot?.textContent || '').slice(0, 1200),
      bodyTextExcerpt: normalize(document.body?.innerText || document.body?.textContent || '').slice(0, 1200)
    };
  }, {
    selector: liveCase.selector,
    responseStatus
  });

  return { html, meta };
}

async function readPopupClipState(popupPage) {
  return await popupPage.evaluate(() => {
    const markdown = typeof cm?.getValue === 'function'
      ? cm.getValue()
      : document.getElementById('md')?.value || '';

    return {
      markdown,
      title: document.getElementById('title')?.value || ''
    };
  });
}

async function clipPageThroughPopup(context, extensionId, serviceWorker, liveCase, testInfo) {
  const livePage = await context.newPage();
  const popupPage = await context.newPage();
  const previousSnapshot = loadLatestSuccessfulRun(livePublicArtifactRoot, liveCase);
  let pageCapture = null;
  let clipCapture = null;

  try {
    const response = await livePage.goto(liveCase.url, { waitUntil: 'domcontentloaded' });
    await livePage.waitForSelector(liveCase.selector);
    pageCapture = await captureLivePageState(
      livePage,
      liveCase,
      typeof response?.status === 'function' ? response.status() : null
    );
    await livePage.bringToFront();

    const tabId = await getTabIdForUrl(serviceWorker, livePage.url());
    expect(tabId).toBeTruthy();

    await popupPage.goto(`chrome-extension://${extensionId}/popup/popup.html`);
    await popupPage.waitForSelector('#container', { state: 'visible' });

    await popupPage.evaluate(async (targetTabId) => {
      await clipSite(targetTabId);
    }, tabId);

    await expect.poll(async () => {
      return await popupPage.evaluate(() => {
        if (typeof cm?.getValue === 'function') {
          return cm.getValue();
        }
        return document.getElementById('md')?.value || '';
      });
    }, { timeout: 45000 }).toContain(liveCase.snippets[0]);

    clipCapture = await readPopupClipState(popupPage);

    liveCase.snippets.forEach((snippet) => {
      expect(clipCapture.markdown).toContain(snippet);
    });

    expect(clipCapture.markdown).not.toContain('Error clipping the page');
    expect(clipCapture.title).toContain(liveCase.titleContains);

    const passedRecord = createSnapshotRecord(liveCase, pageCapture, clipCapture, {
      status: 'passed'
    });
    const comparison = buildComparison(previousSnapshot, passedRecord);
    const persistedArtifacts = persistSnapshotRun(
      livePublicArtifactRoot,
      liveCase,
      passedRecord,
      pageCapture,
      clipCapture,
      comparison
    );
    await attachSnapshotArtifacts(testInfo, persistedArtifacts);
  } catch (error) {
    if (!pageCapture && !livePage.isClosed()) {
      try {
        pageCapture = await captureLivePageState(livePage, liveCase, null);
      } catch {
        // Preserve the original failure if the fallback capture also fails.
      }
    }

    if (!clipCapture && !popupPage.isClosed()) {
      try {
        clipCapture = await readPopupClipState(popupPage);
      } catch {
        // Preserve the original failure if the popup state is unavailable.
      }
    }

    const failureMessage = error instanceof Error ? error.message : String(error);
    const failedRecord = createSnapshotRecord(liveCase, pageCapture, clipCapture, {
      status: 'failed',
      failureMessage
    });
    const comparison = buildComparison(previousSnapshot, failedRecord);
    const persistedArtifacts = persistSnapshotRun(
      livePublicArtifactRoot,
      liveCase,
      failedRecord,
      pageCapture,
      clipCapture,
      comparison
    );
    await attachSnapshotArtifacts(testInfo, persistedArtifacts);

    const comparisonText = formatComparisonForFailure(comparison, persistedArtifacts.runDir);
    if (error instanceof Error) {
      error.message = `${error.message}\n\n${comparisonText}`;
      throw error;
    }
    throw new Error(`${failureMessage}\n\n${comparisonText}`);
  } finally {
    await popupPage.close().catch(() => {});
    await livePage.close().catch(() => {});
  }
}

test.describe('Live Public E2E', () => {
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

    const serviceWorkerPromise = context.waitForEvent('serviceworker', { timeout: 60000 }).catch(() => null);
    [serviceWorker] = context.serviceWorkers();
    if (!serviceWorker) {
      serviceWorker = await serviceWorkerPromise;
    }

    serviceWorker = serviceWorker || context.serviceWorkers()[0];
    if (!serviceWorker) {
      throw new Error('Live manual spec could not find the extension service worker.');
    }

    extensionId = new URL(serviceWorker.url()).host;
  });

  test.afterAll(async () => {
    await context?.close();
  });

  for (const liveCase of liveClipCases) {
    test(liveCase.name, async ({}, testInfo) => {
      test.setTimeout(120000);
      await clipPageThroughPopup(context, extensionId, serviceWorker, liveCase, testInfo);
    });
  }
});
