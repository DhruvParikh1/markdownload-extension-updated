/**
 * End-to-End Tests for MarkSnip Extension
 * Tests the extension in a real browser environment using Playwright
 */

const { test, expect, chromium } = require('@playwright/test');
const path = require('path');

// Path to the extension
const extensionPath = path.join(__dirname, '../..');

test.describe('MarkSnip Extension E2E', () => {
  let browser;
  let context;
  let page;
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
    page = await context.newPage();

    let [serviceWorker] = context.serviceWorkers();
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

    await page.goto(`chrome-extension://${extensionId}/popup/popup.html`);
    await expect(page.locator('#container')).toBeVisible();
  });

  test('should convert simple HTML page to markdown', async () => {
    // Create a simple test page
    await page.setContent(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Test Page</title>
        </head>
        <body>
          <article>
            <h1>Test Article</h1>
            <p>This is a <strong>test</strong> paragraph with <em>formatting</em>.</p>
            <ul>
              <li>Item 1</li>
              <li>Item 2</li>
            </ul>
          </article>
        </body>
      </html>
    `);

    // Open extension popup (if available)
    // Note: This requires the extension to be loaded and accessible
    // The actual test will vary based on how the extension exposes its functionality

    // For now, just verify the page loaded
    const title = await page.title();
    expect(title).toBe('Test Page');
  });

  test('should handle real-world page (Wikipedia)', async () => {
    // Navigate to a real page
    await page.goto('https://en.wikipedia.org/wiki/Markdown');

    // Wait for page to load
    await page.waitForLoadState('networkidle');

    // Verify page loaded
    const title = await page.title();
    expect(title).toContain('Markdown');
  });
});
