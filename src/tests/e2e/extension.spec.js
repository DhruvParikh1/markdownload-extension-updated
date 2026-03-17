/**
 * End-to-End Tests for MarkSnip Extension
 * Tests the extension in a real browser environment using Playwright
 */

const fs = require('fs');
const { test, expect, chromium } = require('@playwright/test');
const path = require('path');

// Path to the extension
const extensionPath = path.join(__dirname, '../..');
const fixtureHost = 'https://fixtures.marksnip.test';
const fixtureFiles = {
  '/extension/deterministic-article.html': path.join(__dirname, '../fixtures/e2e-pages/extension/deterministic-article.html')
};

async function installFixtureRoutes(context) {
  await context.route(`${fixtureHost}/**`, async (route) => {
    const url = new URL(route.request().url());
    const fixturePath = fixtureFiles[url.pathname];

    if (!fixturePath) {
      await route.fulfill({
        status: 404,
        contentType: 'text/plain; charset=utf-8',
        body: `Fixture not found for ${url.pathname}`
      });
      return;
    }

    await route.fulfill({
      status: 200,
      contentType: 'text/html; charset=utf-8',
      body: fs.readFileSync(fixturePath, 'utf8')
    });
  });
}

test.describe('MarkSnip Extension E2E', () => {
  let browser;
  let context;
  let serviceWorker;
  let extensionId;

  test.beforeAll(async () => {
    // Launch browser with extension loaded
    browser = await chromium.launchPersistentContext('', {
      headless: false, // Extensions require headed mode
      args: [
        `--disable-extensions-except=${extensionPath}`,
        `--load-extension=${extensionPath}`,
      ],
    });

    context = browser;
    await installFixtureRoutes(context);

    [serviceWorker] = context.serviceWorkers();
    if (!serviceWorker) {
      serviceWorker = await context.waitForEvent('serviceworker', { timeout: 15000 });
    }
    extensionId = new URL(serviceWorker.url()).host;
  });

  test.afterAll(async () => {
    await browser?.close();
  });

  test('extension should load successfully', async () => {
    // Verify service worker is running and extension pages are reachable.
    expect(extensionId).toBeTruthy();

    const popupPage = await context.newPage();
    try {
      await popupPage.goto(`chrome-extension://${extensionId}/popup/popup.html`);
      await expect(popupPage.locator('#container')).toBeVisible();
    } finally {
      await popupPage.close().catch(() => {});
    }
  });

  test('clips deterministic fixture page through popup flow and produces markdown', async () => {
    const fixturePage = await context.newPage();
    const popupPage = await context.newPage();

    try {
      await fixturePage.goto(`${fixtureHost}/extension/deterministic-article.html`);
      await fixturePage.waitForLoadState('networkidle');
      await expect(fixturePage.getByRole('heading', { name: 'Deterministic Markdown Fixture' })).toBeVisible();
      await fixturePage.bringToFront();

      const fixtureTabId = await serviceWorker.evaluate(async ({ targetUrl }) => {
        const tabs = await browser.tabs.query({});
        return tabs.find((tab) => tab.url === targetUrl)?.id || null;
      }, { targetUrl: fixturePage.url() });
      expect(fixtureTabId).toBeTruthy();

      await popupPage.goto(`chrome-extension://${extensionId}/popup/popup.html`);
      await expect(popupPage.locator('#container')).toBeVisible();

      await popupPage.evaluate(async (tabId) => {
        await clipSite(tabId);
      }, fixtureTabId);

      await expect.poll(async () => {
        return await popupPage.evaluate(() => {
          if (typeof cm !== 'undefined' && cm?.getValue) {
            return cm.getValue();
          }
          return document.getElementById('md')?.value || '';
        });
      }, { timeout: 45000 }).toContain('This page is routed by Playwright for deterministic extension E2E tests.');

      const markdown = await popupPage.evaluate(() => {
        if (typeof cm !== 'undefined' && cm?.getValue) {
          return cm.getValue();
        }
        return document.getElementById('md')?.value || '';
      });

      expect(markdown).toContain('This page is routed by Playwright for deterministic extension E2E tests.');
      expect(markdown).toContain('It contains stable content that does not depend on external networks.');
      expect(markdown).not.toContain('Error clipping the page');

      await expect.poll(async () => popupPage.inputValue('#title'), { timeout: 10000 })
        .toContain('Deterministic Markdown Fixture');
    } finally {
      await popupPage.close().catch(() => {});
      await fixturePage.close().catch(() => {});
    }
  });
});
