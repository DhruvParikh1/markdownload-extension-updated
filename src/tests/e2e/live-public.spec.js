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
const { liveClipCases } = require('../helpers/live-public-cases');

const extensionPath = path.join(__dirname, '../..');
const repoRoot = path.resolve(extensionPath, '..');
const livePublicArtifactRoot = path.join(repoRoot, 'test-artifacts', 'live-public');

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
