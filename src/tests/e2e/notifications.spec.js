/**
 * Notification E2E tests.
 * Validates that queued notifications render only after successful extension use.
 */

const fs = require('fs');
const { test, expect, chromium } = require('@playwright/test');
const path = require('path');

const extensionPath = path.join(__dirname, '../..');
const fixtureHost = 'https://fixtures.marksnip.test';
const notificationHostPath = '/notifications/host.html';
const notificationHostUrl = `${fixtureHost}${notificationHostPath}`;
const notificationHostFixture = path.join(__dirname, '../fixtures/e2e-pages/notifications/host.html');

async function installFixtureRoutes(context) {
  await context.route(`${fixtureHost}/**`, async (route) => {
    const url = new URL(route.request().url());

    if (url.pathname !== notificationHostPath) {
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
      body: fs.readFileSync(notificationHostFixture, 'utf8')
    });
  });
}

async function loadExtensionContext() {
  const context = await chromium.launchPersistentContext('', {
    headless: false,
    args: [
      `--disable-extensions-except=${extensionPath}`,
      `--load-extension=${extensionPath}`,
    ],
  });

  const serviceWorkerPromise = context.waitForEvent('serviceworker', { timeout: 60000 }).catch(() => null);
  await installFixtureRoutes(context);

  let [serviceWorker] = context.serviceWorkers();
  if (!serviceWorker) {
    serviceWorker = await serviceWorkerPromise;
  }

  serviceWorker = serviceWorker || context.serviceWorkers()[0];
  if (!serviceWorker) {
    throw new Error('Failed to load MarkSnip service worker for notifications E2E');
  }

  const extensionId = new URL(serviceWorker.url()).host;
  return { context, serviceWorker, extensionId };
}

async function resetNotificationState(serviceWorker) {
  const version = await serviceWorker.evaluate(() => browser.runtime.getManifest().version);

  await serviceWorker.evaluate(async ({ currentVersion }) => {
    await browser.storage.local.clear();
    await browser.storage.local.set({
      lastInstalledVersion: currentVersion,
      successfulExportsCount: 0,
      successfulDownloadsCount: 0,
      successfulCopiesCount: 0,
      successfulObsidianSendsCount: 0,
      successfulBatchUrlsCount: 0,
      shownSupportThresholds: [],
      shownUpdateVersions: [],
      pendingNotifications: []
    });
  }, { currentVersion: version });
}

async function getFirstSupportThreshold(serviceWorker) {
  return await serviceWorker.evaluate(() => self.markSnipNotifications.SUPPORT_NOTIFICATION_THRESHOLDS[0]);
}

async function getTabIdForUrl(serviceWorker, url) {
  return await serviceWorker.evaluate(async ({ targetUrl }) => {
    const tabs = await browser.tabs.query({});
    return tabs.find((tab) => tab.url === targetUrl)?.id || null;
  }, { targetUrl: url });
}

async function recordMetrics(serviceWorker, delta, tabId) {
  return await serviceWorker.evaluate(async ({ metricDelta, targetTabId }) => {
    return await recordNotificationMetrics(metricDelta, {
      tabId: targetTabId
    });
  }, {
    metricDelta: delta,
    targetTabId: tabId
  });
}

async function queueVersionUpdateNotification(serviceWorker, previousVersion) {
  return await serviceWorker.evaluate(async ({ priorVersion }) => {
    await handleInstalled({
      reason: 'update',
      previousVersion: priorVersion
    });

    return await browser.storage.local.get([
      'lastInstalledVersion',
      'shownUpdateVersions',
      'pendingNotifications'
    ]);
  }, { priorVersion: previousVersion });
}

async function triggerInstallOnboarding(serviceWorker) {
  return await serviceWorker.evaluate(async () => {
    const guideUrl = browser.runtime.getURL('guide/guide.html?welcome=true');
    await handleInstalled({
      reason: 'install'
    });
    return { guideUrl };
  });
}

test.describe('Notifications E2E', () => {
  let context;
  let serviceWorker;
  let extensionId;

  test.beforeAll(async () => {
    ({ context, serviceWorker, extensionId } = await loadExtensionContext());
  });

  test.beforeEach(async () => {
    await resetNotificationState(serviceWorker);
  });

  test.afterAll(async () => {
    await context?.close();
  });

  test('install opens the guide with the welcome banner visible', async () => {
    const guidePagePromise = context.waitForEvent('page');
    const { guideUrl } = await triggerInstallOnboarding(serviceWorker);
    const guidePage = await guidePagePromise;
    await guidePage.waitForLoadState('domcontentloaded');
    expect(guidePage.url()).toBe(guideUrl);

    try {
      await expect(guidePage.locator('#welcome-banner')).toBeVisible();
      await expect(guidePage.getByText('Welcome to MarkSnip!')).toBeVisible();

      await guidePage.getByLabel('Dismiss welcome message').click();
      await expect(guidePage.locator('#welcome-banner')).toBeHidden();
    } finally {
      await guidePage?.close().catch(() => {});
    }
  });

  test('shows the support milestone card after the first threshold is reached', async () => {
    const firstThreshold = await getFirstSupportThreshold(serviceWorker);
    expect(firstThreshold).toBeGreaterThan(0);

    const page = await context.newPage();

    try {
      await page.goto(notificationHostUrl);
      const pageTabId = await getTabIdForUrl(serviceWorker, page.url());

      expect(pageTabId).toBeTruthy();
      await page.waitForTimeout(1500);
      await expect(page.getByLabel('Dismiss notification')).toHaveCount(0);

      await recordMetrics(serviceWorker, { exports: firstThreshold }, pageTabId);

      await expect.poll(async () => {
        const notificationState = await serviceWorker.evaluate(async () => {
          return await browser.storage.local.get([
            'successfulExportsCount',
            'shownSupportThresholds',
            'pendingNotifications'
          ]);
        });

        return {
          exports: notificationState.successfulExportsCount,
          shownThreshold: notificationState.shownSupportThresholds?.[0] || null,
          pendingType: notificationState.pendingNotifications?.[0]?.type || null,
          pendingMilestone: notificationState.pendingNotifications?.[0]?.milestone || null
        };
      }).toEqual({
        exports: firstThreshold,
        shownThreshold: firstThreshold,
        pendingType: 'support-milestone',
        pendingMilestone: firstThreshold
      });

      const title = `${firstThreshold.toLocaleString('en-US')} pages exported`;
      await expect(page.getByText(title)).toBeVisible({ timeout: 15000 });
      await expect(page.getByRole('link', { name: 'Buy Me a Coffee' })).toBeVisible();
      await expect(page.getByRole('link', { name: 'View release notes' })).toBeVisible();

      await expect.poll(async () => {
        const notificationState = await serviceWorker.evaluate(async () => {
          const state = await browser.storage.local.get(['pendingNotifications']);
          return state.pendingNotifications?.[0] || null;
        });

        return notificationState?.showCount || 0;
      }).toBe(1);

      await page.getByLabel('Dismiss notification').click();

      await expect.poll(async () => {
        const notificationState = await serviceWorker.evaluate(async () => {
          const state = await browser.storage.local.get(['pendingNotifications']);
          return state.pendingNotifications || [];
        });

        return notificationState.length;
      }).toBe(0);
    } finally {
      await page.close().catch(() => {});
    }
  });

  test('shows the version update card only after the next successful use', async () => {
    const currentVersion = await serviceWorker.evaluate(() => browser.runtime.getManifest().version);
    const previousVersion = '4.1.0';
    const page = await context.newPage();

    try {
      await page.goto(notificationHostUrl);
      const pageTabId = await getTabIdForUrl(serviceWorker, page.url());
      expect(pageTabId).toBeTruthy();

      const notificationState = await queueVersionUpdateNotification(serviceWorker, previousVersion);
      const pendingUpdate = notificationState.pendingNotifications?.[0] || null;

      expect(notificationState.lastInstalledVersion).toBe(currentVersion);
      expect(notificationState.shownUpdateVersions).toContain(currentVersion);
      expect(pendingUpdate?.type).toBe('version-update');
      expect(pendingUpdate?.currentVersion).toBe(currentVersion);
      expect(pendingUpdate?.previousVersion).toBe(previousVersion);
      expect(Array.isArray(pendingUpdate?.highlights)).toBeTruthy();
      expect(pendingUpdate?.highlights.length).toBeGreaterThan(0);

      await page.waitForTimeout(1500);
      await expect(page.getByLabel('Dismiss notification')).toHaveCount(0);

      await recordMetrics(serviceWorker, { copies: 1, exports: 0 }, pageTabId);

      await expect(page.getByText(`MarkSnip updated to v${currentVersion}`)).toBeVisible({ timeout: 15000 });
      await expect(page.getByText(`Updated from v${previousVersion} to v${currentVersion}.`)).toBeVisible();
      await expect(page.getByText(pendingUpdate.highlights[0])).toBeVisible();
      await expect(page.getByRole('link', { name: 'Buy Me a Coffee' })).toBeVisible();
      await expect(page.getByRole('link', { name: 'View release notes' })).toBeVisible();

      await expect.poll(async () => {
        const state = await serviceWorker.evaluate(async () => {
          const result = await browser.storage.local.get(['pendingNotifications']);
          return result.pendingNotifications?.[0] || null;
        });

        return state?.showCount || 0;
      }).toBe(1);

      await page.getByLabel('Dismiss notification').click();

      await expect.poll(async () => {
        const state = await serviceWorker.evaluate(async () => {
          const result = await browser.storage.local.get(['pendingNotifications']);
          return result.pendingNotifications || [];
        });

        return state.length;
      }).toBe(0);
    } finally {
      await page.close().catch(() => {});
    }
  });
});
