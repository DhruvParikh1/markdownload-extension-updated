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

async function setLibraryStorage(serviceWorker, payload) {
  await serviceWorker.evaluate(async ({ nextState }) => {
    await browser.storage.local.remove(['librarySettings', 'libraryItems']);
    await browser.storage.local.set(nextState);
  }, { nextState: payload });
}

async function getLibraryStorage(serviceWorker) {
  return await serviceWorker.evaluate(async () => {
    return await browser.storage.local.get(['librarySettings', 'libraryItems']);
  });
}

async function setSyncStorage(serviceWorker, payload) {
  await serviceWorker.evaluate(async ({ nextState }) => {
    await browser.storage.sync.set(nextState);
  }, { nextState: payload });
}

async function setLocalStorage(serviceWorker, payload) {
  await serviceWorker.evaluate(async ({ nextState }) => {
    await browser.storage.local.set(nextState);
  }, { nextState: payload });
}

async function setBatchWorkerState(serviceWorker, payload) {
  await serviceWorker.evaluate(({ nextState }) => {
    batchState = nextState ? JSON.parse(JSON.stringify(nextState)) : null;
  }, { nextState: payload });
}

async function clearBatchRestoreState(serviceWorker) {
  await serviceWorker.evaluate(async () => {
    batchState = null;
    await browser.storage.local.remove(['batchUrlList', 'batchSaveMode']);
  });
}

async function installLibraryExportHarness(serviceWorker) {
  await serviceWorker.evaluate(() => {
    if (!self.__markSnipLibraryExportHarnessInstalled) {
      self.__markSnipLibraryExportHarnessInstalled = true;
      self.__markSnipLibraryExportHarnessOriginals = {
        triggerBatchZipDownload: self.triggerBatchZipDownload
      };

      self.triggerBatchZipDownload = async (files, options, fallbackTabId = null, zipFilename = null) => {
        self.__markSnipLibraryExportHarnessState.zipCalls.push({
          files: JSON.parse(JSON.stringify(files || [])),
          options: JSON.parse(JSON.stringify(options || {})),
          fallbackTabId,
          zipFilename
        });
      };
    }

    self.__markSnipLibraryExportHarnessState = {
      zipCalls: []
    };
  });
}

async function getLibraryExportHarnessState(serviceWorker) {
  return await serviceWorker.evaluate(() => (
    JSON.parse(JSON.stringify(self.__markSnipLibraryExportHarnessState || { zipCalls: [] }))
  ));
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
      const initialLibraryCount = await serviceWorker.evaluate(async () => {
        const state = await browser.storage.local.get(['libraryItems']);
        return state.libraryItems?.length || 0;
      });

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
      await popupPage.locator('#libraryViewToggle').click();
      await expect(popupPage.locator('#saveLibraryClip')).toBeHidden();
      await popupPage.locator('#closeLibraryView').click();

      await expect.poll(async () => {
        const state = await getLibraryStorage(serviceWorker);
        return state.libraryItems?.length || 0;
      }, { timeout: 10000 }).toBeGreaterThan(initialLibraryCount);
      const firstLibraryCount = (await getLibraryStorage(serviceWorker)).libraryItems?.length || 0;

      await popupPage.close().catch(() => {});

      const popupAgain = await context.newPage();
      await popupAgain.goto(`chrome-extension://${extensionId}/popup/popup.html`);
      await expect(popupAgain.locator('#container')).toBeVisible();
      await popupAgain.evaluate(async (tabId) => {
        await clipSite(tabId);
      }, fixtureTabId);
      await expect.poll(async () => {
        const state = await getLibraryStorage(serviceWorker);
        return state.libraryItems?.length || 0;
      }, { timeout: 10000 }).toBe(firstLibraryCount);
      await popupAgain.close().catch(() => {});
    } finally {
      await popupPage.close().catch(() => {});
      await fixturePage.close().catch(() => {});
    }
  });

  test('manual-save mode does not auto-save until Save Clip is pressed', async () => {
    await setLibraryStorage(serviceWorker, {
      librarySettings: {
        enabled: true,
        autoSaveOnPopupOpen: false,
        itemsToKeep: 10
      },
      libraryItems: []
    });

    const fixturePage = await context.newPage();
    const popupPage = await context.newPage();

    try {
      await fixturePage.goto(`${fixtureHost}/extension/deterministic-article.html`);
      await fixturePage.waitForLoadState('networkidle');
      await fixturePage.bringToFront();

      await popupPage.goto(`chrome-extension://${extensionId}/popup/popup.html`);
      await expect(popupPage.locator('#libraryViewToggle')).toBeVisible();
      await expect.poll(async () => {
        const state = await getLibraryStorage(serviceWorker);
        return state.libraryItems?.length || 0;
      }, { timeout: 5000 }).toBe(0);

      await popupPage.locator('#libraryViewToggle').click();
      await expect(popupPage.locator('#saveLibraryClip')).toBeVisible();
      await expect(popupPage.locator('#saveLibraryClip')).toBeEnabled();
      await popupPage.locator('#saveLibraryClip').click();

      await expect.poll(async () => {
        const state = await getLibraryStorage(serviceWorker);
        return state.libraryItems?.length || 0;
      }, { timeout: 10000 }).toBe(1);
    } finally {
      await popupPage.close().catch(() => {});
      await fixturePage.close().catch(() => {});
    }
  });

  test('library export all stays disabled when there are no saved clips', async () => {
    await setLibraryStorage(serviceWorker, {
      librarySettings: {
        enabled: true,
        autoSaveOnPopupOpen: false,
        itemsToKeep: 10
      },
      libraryItems: []
    });

    const popupPage = await context.newPage();

    try {
      await popupPage.goto(`chrome-extension://${extensionId}/popup/popup.html`);
      await popupPage.locator('#libraryViewToggle').click();
      await expect(popupPage.locator('#exportLibraryAll')).toBeDisabled();
    } finally {
      await popupPage.close().catch(() => {});
    }
  });

  for (const { label, slug } of [
    { label: 'ATLA', slug: 'atla' },
    { label: 'Ben 10', slug: 'ben10' }
  ]) {
    test(`popup startup loads ${label} dark stylesheet when the special theme is active`, async () => {
      await setSyncStorage(serviceWorker, {
        popupTheme: 'dark',
        specialTheme: slug,
        editorTheme: 'nord'
      });

      const popupPage = await context.newPage();

      try {
        await popupPage.goto(`chrome-extension://${extensionId}/popup/popup.html`);

        await expect.poll(async () => {
          return await popupPage.evaluate(() => {
            return document.getElementById('cm-theme-stylesheet')?.getAttribute('href') || null;
          });
        }, { timeout: 10000 }).toBe(`lib/${slug}-dark.css`);

        const themeLinks = await popupPage.evaluate(() => {
          return Array.from(document.querySelectorAll('link[rel="stylesheet"]'))
            .map((link) => link.getAttribute('href'))
            .filter((href) => href && href.startsWith('lib/') && href !== 'lib/codemirror.css');
        });

        expect(themeLinks).toEqual([`lib/${slug}-dark.css`]);
      } finally {
        await popupPage.close().catch(() => {});
      }
    });

    test(`popup startup loads ${label} light stylesheet when the special theme is active in light mode`, async () => {
      await setSyncStorage(serviceWorker, {
        popupTheme: 'light',
        specialTheme: slug,
        editorTheme: 'nord'
      });

      const popupPage = await context.newPage();

      try {
        await popupPage.goto(`chrome-extension://${extensionId}/popup/popup.html`);

        await expect.poll(async () => {
          return await popupPage.evaluate(() => {
            return document.getElementById('cm-theme-stylesheet')?.getAttribute('href') || null;
          });
        }, { timeout: 10000 }).toBe(`lib/${slug}-light.css`);

        const themeLinks = await popupPage.evaluate(() => {
          return Array.from(document.querySelectorAll('link[rel="stylesheet"]'))
            .map((link) => link.getAttribute('href'))
            .filter((href) => href && href.startsWith('lib/') && href !== 'lib/codemirror.css');
        });

        expect(themeLinks).toEqual([`lib/${slug}-light.css`]);
      } finally {
        await popupPage.close().catch(() => {});
      }
    });
  }

  test('popup startup preserves non-Claude theme resolution when no special theme is active', async () => {
    await setSyncStorage(serviceWorker, {
      popupTheme: 'dark',
      specialTheme: 'none',
      editorTheme: 'nord'
    });

    const popupPage = await context.newPage();

    try {
      await popupPage.goto(`chrome-extension://${extensionId}/popup/popup.html`);

      await expect.poll(async () => {
        return await popupPage.evaluate(() => {
          return document.getElementById('cm-theme-stylesheet')?.getAttribute('href') || null;
        });
      }, { timeout: 10000 }).toBe('lib/nord.css');

      const themeLinks = await popupPage.evaluate(() => {
        return Array.from(document.querySelectorAll('link[rel="stylesheet"]'))
          .map((link) => link.getAttribute('href'))
          .filter((href) => href && href.startsWith('lib/') && href !== 'lib/codemirror.css');
      });

      expect(themeLinks).toEqual(['lib/nord.css']);
    } finally {
      await popupPage.close().catch(() => {});
    }
  });

  test('popup preview renders raw HTML safely without breaking code or linking unsafe images', async () => {
    const fixturePage = await context.newPage();
    const popupPage = await context.newPage();

    try {
      await fixturePage.goto(`${fixtureHost}/extension/deterministic-article.html`);
      await fixturePage.waitForLoadState('networkidle');
      await fixturePage.bringToFront();

      await popupPage.goto(`chrome-extension://${extensionId}/popup/popup.html`);

      await expect.poll(async () => {
        return await popupPage.evaluate(() => Boolean(window.cm && document.querySelector('.CodeMirror')));
      }, { timeout: 15000 }).toBe(true);

      await expect.poll(async () => {
        return await popupPage.locator('#title').inputValue();
      }, { timeout: 15000 }).toContain('Deterministic Markdown Fixture');

      await popupPage.evaluate(() => {
        window.cm.setValue([
          '# Preview test',
          '',
          '`<span>`',
          '',
          '```html',
          '<div class="x">hi</div>',
          '```',
          '',
          '<script>alert(1)</script>',
          '',
          '![bad](javascript:alert(1))',
          '',
          '[good](https://example.com/docs/page)'
        ].join('\n'));
      });

      await popupPage.locator('#previewToggle').click();

      await expect(popupPage.locator('#editorPreview')).toBeVisible();
      await expect.poll(async () => {
        return await popupPage.evaluate(() => {
          return document.querySelector('#editorPreview .markdown-body')?.innerHTML || '';
        });
      }, { timeout: 10000 }).toContain('<pre><code class="language-html">');

      const previewState = await popupPage.evaluate(() => {
        const preview = document.getElementById('editorPreview');
        const codeHtml = preview.querySelector('pre code')?.innerHTML || '';
        const inlineCodeHtml = preview.querySelector('p code')?.innerHTML || '';
        const scriptCount = preview.querySelectorAll('script').length;
        const imageLink = preview.querySelector('.preview-image-placeholder a');
        const normalLink = preview.querySelector('.markdown-body a[href="https://example.com/docs/page"]');

        return {
          codeHtml,
          inlineCodeHtml,
          scriptCount,
          unsafeImageLinkHref: imageLink?.getAttribute('href') || null,
          normalLinkHref: normalLink?.getAttribute('href') || null,
          normalLinkTarget: normalLink?.getAttribute('target') || null,
          normalLinkRel: normalLink?.getAttribute('rel') || null,
          previewText: preview.textContent || ''
        };
      });

      expect(previewState.codeHtml).toContain('&lt;div class="x"&gt;hi&lt;/div&gt;');
      expect(previewState.codeHtml).not.toContain('&amp;lt;');
      expect(previewState.inlineCodeHtml).toContain('&lt;span&gt;');
      expect(previewState.inlineCodeHtml).not.toContain('&amp;lt;');
      expect(previewState.scriptCount).toBe(0);
      expect(previewState.previewText).toContain('<script>alert(1)</script>');
      expect(previewState.unsafeImageLinkHref).toBeNull();
      expect(previewState.normalLinkHref).toBe('https://example.com/docs/page');
      expect(previewState.normalLinkTarget).toBe('_blank');
      expect(previewState.normalLinkRel).toBe('noopener noreferrer');
    } finally {
      await popupPage.close().catch(() => {});
      await fixturePage.close().catch(() => {});
    }
  });

  test('library items stay unrendered until the Library view opens', async () => {
    await setLibraryStorage(serviceWorker, {
      librarySettings: {
        enabled: true,
        autoSaveOnPopupOpen: false,
        itemsToKeep: 10
      },
      libraryItems: [
        { id: 'one', pageUrl: 'https://example.com/alpha', normalizedPageUrl: 'https://example.com/alpha', title: 'Alpha', markdown: '# Alpha', savedAt: '2026-03-20T10:00:00.000Z', previewText: 'Alpha' },
        { id: 'two', pageUrl: 'https://example.com/beta', normalizedPageUrl: 'https://example.com/beta', title: 'Beta', markdown: '# Beta', savedAt: '2026-03-20T09:00:00.000Z', previewText: 'Beta' }
      ]
    });

    const popupPage = await context.newPage();

    try {
      await popupPage.goto(`chrome-extension://${extensionId}/popup/popup.html`);
      await expect(popupPage.locator('#libraryViewToggle')).toBeVisible({ timeout: 10000 });

      await expect.poll(async () => {
        return await popupPage.textContent('#libraryCountBadge');
      }, { timeout: 10000 }).toBe('2');

      expect(await popupPage.locator('#libraryList .library-card').count()).toBe(0);

      await popupPage.locator('#libraryViewToggle').click();
      await expect.poll(async () => {
        return await popupPage.locator('#libraryList .library-card').count();
      }, { timeout: 10000 }).toBe(2);
    } finally {
      await popupPage.close().catch(() => {});
    }
  });

  test('batch restore opens the Batch view on popup startup without being overridden', async () => {
    const fixturePage = await context.newPage();
    const popupPage = await context.newPage();

    try {
      await fixturePage.goto(`${fixtureHost}/extension/deterministic-article.html`);
      await fixturePage.waitForLoadState('networkidle');
      await fixturePage.bringToFront();

      await setLocalStorage(serviceWorker, {
        batchUrlList: [
          `${fixtureHost}/extension/deterministic-article.html`,
          'https://example.com/queued'
        ].join('\n'),
        batchSaveMode: 'zip'
      });
      await setBatchWorkerState(serviceWorker, {
        status: 'loading',
        current: 1,
        total: 2,
        url: `${fixtureHost}/extension/deterministic-article.html`,
        pageTitle: 'Deterministic Markdown Fixture',
        batchSaveMode: 'zip'
      });

      await popupPage.goto(`chrome-extension://${extensionId}/popup/popup.html`);

      await expect(popupPage.locator('#batchContainer')).toBeVisible({ timeout: 10000 });
      await expect(popupPage.locator('#progressContainer')).toBeVisible({ timeout: 10000 });
      await expect(popupPage.locator('#container')).toBeHidden();
      await expect(popupPage.locator('#urlList')).toHaveValue([
        `${fixtureHost}/extension/deterministic-article.html`,
        'https://example.com/queued'
      ].join('\n'));

      await expect.poll(async () => {
        return await popupPage.evaluate(() => document.activeElement?.id || '');
      }, { timeout: 10000 }).toMatch(/^(urlList|convertUrls)$/);
    } finally {
      await clearBatchRestoreState(serviceWorker);
      await popupPage.close().catch(() => {});
      await fixturePage.close().catch(() => {});
    }
  });

  test('deferred popup notifications still render after startup', async () => {
    await setLocalStorage(serviceWorker, {
      pendingNotifications: [
        {
          id: 'popup-deferred-notification',
          type: 'support-milestone',
          title: 'Popup notification test',
          message: 'Deferred popup notification body',
          milestone: 100,
          primaryAction: {
            label: 'View release notes',
            url: 'https://example.com/releases'
          },
          secondaryAction: {
            label: 'Buy Me a Coffee',
            url: 'https://example.com/support'
          }
        }
      ]
    });

    const popupPage = await context.newPage();

    try {
      await popupPage.goto(`chrome-extension://${extensionId}/popup/popup.html`);
      await expect(popupPage.getByText('Popup notification test')).toBeVisible({ timeout: 15000 });
      await expect(popupPage.getByText('Deferred popup notification body')).toBeVisible();
      await expect(popupPage.getByLabel('Dismiss notification')).toBeVisible();
    } finally {
      await popupPage.close().catch(() => {});
    }
  });

  test('library export all routes saved clips through the ZIP export path', async () => {
    await installLibraryExportHarness(serviceWorker);
    await setLibraryStorage(serviceWorker, {
      librarySettings: {
        enabled: true,
        autoSaveOnPopupOpen: false,
        itemsToKeep: 10
      },
      libraryItems: [
        { id: 'one', pageUrl: 'https://example.com/alpha', normalizedPageUrl: 'https://example.com/alpha', title: 'Alpha', markdown: '# Alpha', savedAt: '2026-03-20T10:00:00.000Z', previewText: 'Alpha' },
        { id: 'two', pageUrl: 'https://example.com/beta', normalizedPageUrl: 'https://example.com/beta', title: 'Alpha', markdown: '# Beta', savedAt: '2026-03-20T09:00:00.000Z', previewText: 'Beta' },
        { id: 'three', pageUrl: 'https://example.com/gamma', normalizedPageUrl: 'https://example.com/gamma', title: '', markdown: '# Gamma', savedAt: '2026-03-20T08:00:00.000Z', previewText: 'Gamma' },
        { id: 'four', pageUrl: 'https://example.com/delta', normalizedPageUrl: 'https://example.com/delta', title: 'Fancy:/Title?', markdown: '# Delta', savedAt: '2026-03-20T07:00:00.000Z', previewText: 'Delta' }
      ]
    });

    const popupPage = await context.newPage();

    try {
      await popupPage.goto(`chrome-extension://${extensionId}/popup/popup.html`);
      await popupPage.locator('#libraryViewToggle').click();
      await expect(popupPage.locator('#exportLibraryAll')).toBeEnabled();
      await popupPage.locator('#exportLibraryAll').click();
      await expect(popupPage.locator('#exportDropdownMenu')).toBeVisible();
      await popupPage.locator('[data-export="zip"]').click();

      await expect(popupPage.locator('#libraryStatus')).toContainText('Exported 4 clips to ZIP');

      const harnessState = await getLibraryExportHarnessState(serviceWorker);
      expect(harnessState.zipCalls).toHaveLength(1);

      const latestCall = harnessState.zipCalls[0];
      expect(latestCall.zipFilename).toMatch(/^MarkSnip-library-\d{8}-\d{6}\.zip$/);
      expect(latestCall.files).toEqual([
        { filename: 'Alpha.md', content: '# Alpha' },
        { filename: 'Alpha (2).md', content: '# Beta' },
        { filename: 'Untitled.md', content: '# Gamma' },
        { filename: 'FancyTitle.md', content: '# Delta' }
      ]);
    } finally {
      await popupPage.close().catch(() => {});
    }
  });

  test('popup split export menu exposes print and save as PDF and routes both through the print path', async () => {
    const fixturePage = await context.newPage();
    const popupPage = await context.newPage();

    try {
      await fixturePage.goto(`${fixtureHost}/extension/deterministic-article.html`);
      await fixturePage.waitForLoadState('networkidle');
      await fixturePage.bringToFront();

      await popupPage.goto(`chrome-extension://${extensionId}/popup/popup.html`);
      await expect(popupPage.locator('#container')).toBeVisible();

      await expect.poll(async () => popupPage.inputValue('#title'), { timeout: 10000 })
        .toContain('Deterministic Markdown Fixture');

      await popupPage.evaluate(() => {
        const original = browser.scripting.executeScript.bind(browser.scripting);
        const calls = [];

        browser.scripting.executeScript = async (options) => {
          const payload = options?.args?.[0] || {};
          calls.push({
            target: options?.target || null,
            kind: payload.kind || null,
            hasHtmlDocument: typeof payload.htmlDocument === 'string' && payload.htmlDocument.includes('markdown-body')
          });
          return [];
        };

        window.__markSnipPrintHarness = {
          calls,
          restore() {
            browser.scripting.executeScript = original;
          }
        };
      });

      await popupPage.locator('#splitArrow').click();
      await expect(popupPage.locator('#splitDropdown')).toBeVisible();
      await expect(popupPage.locator('#ddPrint')).toBeVisible();
      await expect(popupPage.locator('#ddPdf')).toBeVisible();
      await popupPage.locator('#ddPrint').click();

      await expect.poll(async () => {
        return await popupPage.evaluate(() => window.__markSnipPrintHarness.calls.length);
      }).toBe(1);

      let harnessState = await popupPage.evaluate(() => window.__markSnipPrintHarness.calls.slice());
      expect(harnessState[0].kind).toBe('print');
      expect(harnessState[0].hasHtmlDocument).toBe(true);

      await popupPage.locator('#splitArrow').click();
      await popupPage.locator('#ddPdf').click();

      await expect.poll(async () => {
        return await popupPage.evaluate(() => window.__markSnipPrintHarness.calls.length);
      }).toBe(2);

      harnessState = await popupPage.evaluate(() => {
        const result = window.__markSnipPrintHarness.calls.slice();
        window.__markSnipPrintHarness.restore();
        return result;
      });

      expect(harnessState[1].kind).toBe('pdf');
      expect(harnessState[1].hasHtmlDocument).toBe(true);
    } finally {
      await popupPage.close().catch(() => {});
      await fixturePage.close().catch(() => {});
    }
  });

  test('disabling the library hides the popup entry point and prevents auto-save', async () => {
    await setLibraryStorage(serviceWorker, {
      librarySettings: {
        enabled: false,
        autoSaveOnPopupOpen: true,
        itemsToKeep: 10
      },
      libraryItems: []
    });

    const fixturePage = await context.newPage();
    const popupPage = await context.newPage();

    try {
      await fixturePage.goto(`${fixtureHost}/extension/deterministic-article.html`);
      await fixturePage.waitForLoadState('networkidle');
      await fixturePage.bringToFront();

      await popupPage.goto(`chrome-extension://${extensionId}/popup/popup.html`);
      await expect(popupPage.locator('#libraryViewToggle')).toBeHidden();
      await expect.poll(async () => {
        const state = await getLibraryStorage(serviceWorker);
        return state.libraryItems?.length || 0;
      }, { timeout: 5000 }).toBe(0);
    } finally {
      await popupPage.close().catch(() => {});
      await fixturePage.close().catch(() => {});
    }
  });

  test('lowering items-to-keep trims stored library items immediately from the options page', async () => {
    await setLibraryStorage(serviceWorker, {
      librarySettings: {
        enabled: true,
        autoSaveOnPopupOpen: true,
        itemsToKeep: 3
      },
      libraryItems: [
        { id: 'one', pageUrl: 'https://example.com/1', normalizedPageUrl: 'https://example.com/1', title: 'One', markdown: 'One', savedAt: '2026-03-20T10:00:00.000Z', previewText: 'One' },
        { id: 'two', pageUrl: 'https://example.com/2', normalizedPageUrl: 'https://example.com/2', title: 'Two', markdown: 'Two', savedAt: '2026-03-20T09:00:00.000Z', previewText: 'Two' },
        { id: 'three', pageUrl: 'https://example.com/3', normalizedPageUrl: 'https://example.com/3', title: 'Three', markdown: 'Three', savedAt: '2026-03-20T08:00:00.000Z', previewText: 'Three' }
      ]
    });

    const optionsPage = await context.newPage();
    try {
      await optionsPage.goto(`chrome-extension://${extensionId}/options/options.html`);
      await optionsPage.locator('#tab-library').click();
      await optionsPage.locator('#libraryItemsToKeep').fill('2');
      await optionsPage.locator('#libraryItemsToKeep').press('Tab');

      await expect.poll(async () => {
        const state = await getLibraryStorage(serviceWorker);
        return state.libraryItems?.length || 0;
      }, { timeout: 10000 }).toBe(2);
    } finally {
      await optionsPage.close().catch(() => {});
    }
  });

  test.describe('shortcuts cheatsheet modal', () => {
    let popupPage;

    test.beforeEach(async () => {
      popupPage = await context.newPage();
      await popupPage.goto(`chrome-extension://${extensionId}/popup/popup.html`);
      await expect(popupPage.locator('#container')).toBeVisible();
    });

    test.afterEach(async () => {
      await popupPage?.close().catch(() => {});
    });

    test('info button opens guide dropdown', async () => {
      await popupPage.locator('#openGuide').click();
      await expect(popupPage.locator('#guideDropdown')).toBeVisible();
      await expect(popupPage.locator('#guideLink')).toBeVisible();
      await expect(popupPage.locator('#showShortcuts')).toBeVisible();
    });

    test('clicking user guide item closes dropdown', async () => {
      await popupPage.locator('#openGuide').click();
      await expect(popupPage.locator('#guideDropdown')).toBeVisible();
      await popupPage.locator('#guideLink').click();
      await expect(popupPage.locator('#guideDropdown')).toBeHidden();
    });

    test('shortcuts modal opens and renders commands from mocked getAll()', async () => {
      await popupPage.evaluate(() => {
        browser.commands.getAll = async () => [
          { name: '_execute_action',          shortcut: 'Alt+Shift+M', description: '' },
          { name: 'download_tab_as_markdown', shortcut: 'Alt+Shift+D', description: 'Save tab' },
          { name: 'copy_selection_as_markdown', shortcut: '',          description: 'Copy sel' },
        ];
      });
      await popupPage.locator('#openGuide').click();
      await popupPage.locator('#showShortcuts').click();

      await expect(popupPage.locator('#shortcutsModal')).toBeVisible();
      await expect(popupPage.locator('#shortcutsModalBody kbd').first()).toBeVisible();
      await expect(popupPage.locator('#shortcutsModalBody')).toContainText('Open MarkSnip popup');
      await expect(popupPage.locator('#shortcutsModalBody')).toContainText('Download tab as Markdown');
      await expect(popupPage.locator('#shortcutsModalBody')).toContainText('Copy selection as Markdown');
      await expect(popupPage.locator('.shortcuts-section-label')).toBeVisible();
    });

    test('Escape closes modal and returns focus to guide button', async () => {
      await popupPage.evaluate(() => {
        browser.commands.getAll = async () => [
          { name: '_execute_action', shortcut: 'Alt+Shift+M', description: '' },
        ];
      });
      await popupPage.locator('#openGuide').click();
      await popupPage.locator('#showShortcuts').click();
      await expect(popupPage.locator('#shortcutsModal')).toBeVisible();

      await popupPage.keyboard.press('Escape');
      await expect(popupPage.locator('#shortcutsModal')).toBeHidden();
      const focusedId = await popupPage.evaluate(() => document.activeElement?.id);
      expect(focusedId).toBe('openGuide');
    });

    test('backdrop click closes modal', async () => {
      await popupPage.evaluate(() => {
        browser.commands.getAll = async () => [];
      });
      await popupPage.locator('#openGuide').click();
      await popupPage.locator('#showShortcuts').click();
      await expect(popupPage.locator('#shortcutsModal')).toBeVisible();

      await popupPage.locator('#shortcutsModalBackdrop').click();
      await expect(popupPage.locator('#shortcutsModal')).toBeHidden();
    });

    test('Tab stays inside modal', async () => {
      await popupPage.evaluate(() => {
        browser.commands.getAll = async () => [];
      });
      await popupPage.locator('#openGuide').click();
      await popupPage.locator('#showShortcuts').click();
      await expect(popupPage.locator('#shortcutsModal')).toBeVisible();

      await popupPage.keyboard.press('Tab');
      const focusedId = await popupPage.evaluate(() => document.activeElement?.id);
      expect(focusedId).toBe('closeShortcutsModal');
    });

    test('Shift+Tab stays inside modal', async () => {
      await popupPage.evaluate(() => {
        browser.commands.getAll = async () => [];
      });
      await popupPage.locator('#openGuide').click();
      await popupPage.locator('#showShortcuts').click();
      await expect(popupPage.locator('#shortcutsModal')).toBeVisible();

      await popupPage.keyboard.press('Shift+Tab');
      const focusedId = await popupPage.evaluate(() => document.activeElement?.id);
      expect(focusedId).toBe('closeShortcutsModal');
    });

    test('API rejection shows error message', async () => {
      await popupPage.evaluate(() => {
        browser.commands.getAll = async () => { throw new Error('API unavailable'); };
      });
      await popupPage.locator('#openGuide').click();
      await popupPage.locator('#showShortcuts').click();
      await expect(popupPage.locator('#shortcutsModal')).toBeVisible();
      await expect(popupPage.locator('#shortcutsModalBody')).toContainText('Could not load shortcuts');
    });
  });
});
