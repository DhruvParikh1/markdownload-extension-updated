/**
 * Command and download regression tests.
 * Covers service worker routing and download mode behavior.
 */

const fs = require('fs');
const { test, expect, chromium } = require('@playwright/test');
const path = require('path');

const extensionPath = path.join(__dirname, '../..');
const fixtureHost = 'https://fixtures.marksnip.test';
const fixturePath = '/command-download/host.html';
const fixtureFile = path.join(__dirname, '../fixtures/e2e-pages/command-download/host.html');

async function installFixtureRoutes(context) {
  await context.route(`${fixtureHost}/**`, async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname !== fixturePath) {
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
      body: fs.readFileSync(fixtureFile, 'utf8')
    });
  });
}

test.describe('Command And Download Regression E2E', () => {
  let context;
  let serviceWorker;

  test.beforeAll(async () => {
    context = await chromium.launchPersistentContext('', {
      headless: false,
      args: [
        `--disable-extensions-except=${extensionPath}`,
        `--load-extension=${extensionPath}`,
      ],
    });
    await installFixtureRoutes(context);

    [serviceWorker] = context.serviceWorkers();
    if (!serviceWorker) {
      serviceWorker = await context.waitForEvent('serviceworker', { timeout: 15000 });
    }
  });

  test.afterAll(async () => {
    await context?.close();
  });

  test('routes keyboard commands to expected service worker handlers', async () => {
    const page = await context.newPage();
    await page.goto(`${fixtureHost}${fixturePath}`);
    await page.bringToFront();

    const calls = await serviceWorker.evaluate(async () => {
      const requiredFns = [
        'handleCommands',
        'downloadMarkdownFromContext',
        'copyMarkdownFromContext',
        'copyTabAsMarkdownLink',
        'copySelectedTabAsMarkdownLink',
      ];
      for (const fn of requiredFns) {
        if (typeof self[fn] !== 'function') {
          throw new Error(`Missing function in service worker: ${fn}`);
        }
      }

      const originals = {};
      const calls = [];

      const spy = (name, projector) => {
        originals[name] = self[name];
        self[name] = async (...args) => {
          calls.push({ fn: name, ...projector(args) });
          return { ok: true };
        };
      };

      spy('downloadMarkdownFromContext', ([info, tab]) => ({
        menuItemId: info?.menuItemId ?? null,
        tabId: tab?.id ?? null,
      }));
      spy('copyMarkdownFromContext', ([info, tab]) => ({
        menuItemId: info?.menuItemId ?? null,
        tabId: tab?.id ?? null,
      }));
      spy('copyTabAsMarkdownLink', ([tab]) => ({ tabId: tab?.id ?? null }));
      spy('copySelectedTabAsMarkdownLink', ([tab]) => ({ tabId: tab?.id ?? null }));

      try {
        await handleCommands('download_tab_as_markdown');
        await handleCommands('copy_tab_as_markdown');
        await handleCommands('copy_selection_as_markdown');
        await handleCommands('copy_tab_as_markdown_link');
        await handleCommands('copy_selected_tab_as_markdown_link');
        await handleCommands('copy_selection_to_obsidian');
        await handleCommands('copy_tab_to_obsidian');
      } finally {
        for (const [name, original] of Object.entries(originals)) {
          self[name] = original;
        }
      }

      return calls;
    });

    expect(calls).toHaveLength(7);
    expect(calls).toEqual([
      expect.objectContaining({ fn: 'downloadMarkdownFromContext', menuItemId: 'download-markdown-all' }),
      expect.objectContaining({ fn: 'copyMarkdownFromContext', menuItemId: 'copy-markdown-all' }),
      expect.objectContaining({ fn: 'copyMarkdownFromContext', menuItemId: 'copy-markdown-selection' }),
      expect.objectContaining({ fn: 'copyTabAsMarkdownLink' }),
      expect.objectContaining({ fn: 'copySelectedTabAsMarkdownLink' }),
      expect.objectContaining({ fn: 'copyMarkdownFromContext', menuItemId: 'copy-markdown-obsidian' }),
      expect.objectContaining({ fn: 'copyMarkdownFromContext', menuItemId: 'copy-markdown-obsall' }),
    ]);
  });

  test('routes context menu actions to expected handlers', async () => {
    const calls = await serviceWorker.evaluate(async ({ fixtureUrl }) => {
      const requiredFns = [
        'handleContextMenuClick',
        'downloadMarkdownFromContext',
        'copyMarkdownFromContext',
        'downloadMarkdownForAllTabs',
        'copyTabAsMarkdownLinkAll',
        'copySelectedTabAsMarkdownLink',
        'copyTabAsMarkdownLink',
        'toggleSetting',
      ];
      for (const fn of requiredFns) {
        if (typeof self[fn] !== 'function') {
          throw new Error(`Missing function in service worker: ${fn}`);
        }
      }

      const originals = {};
      const calls = [];

      const spy = (name, projector) => {
        originals[name] = self[name];
        self[name] = async (...args) => {
          calls.push({ fn: name, ...projector(args) });
          return { ok: true };
        };
      };

      spy('downloadMarkdownFromContext', ([info, tab]) => ({
        menuItemId: info?.menuItemId ?? null,
        tabId: tab?.id ?? null,
      }));
      spy('copyMarkdownFromContext', ([info, tab]) => ({
        menuItemId: info?.menuItemId ?? null,
        tabId: tab?.id ?? null,
      }));
      spy('downloadMarkdownForAllTabs', ([info]) => ({ menuItemId: info?.menuItemId ?? null }));
      spy('copyTabAsMarkdownLinkAll', ([tab]) => ({ tabId: tab?.id ?? null }));
      spy('copySelectedTabAsMarkdownLink', ([tab]) => ({ tabId: tab?.id ?? null }));
      spy('copyTabAsMarkdownLink', ([tab]) => ({ tabId: tab?.id ?? null }));
      spy('toggleSetting', ([setting]) => ({ setting }));

      const tab = { id: 42, url: fixtureUrl };

      try {
        await handleContextMenuClick({ menuItemId: 'copy-markdown-all' }, tab);
        await handleContextMenuClick({ menuItemId: 'download-markdown-all' }, tab);
        await handleContextMenuClick({ menuItemId: 'download-markdown-alltabs' }, tab);
        await handleContextMenuClick({ menuItemId: 'copy-tab-as-markdown-link-all' }, tab);
        await handleContextMenuClick({ menuItemId: 'copy-tab-as-markdown-link-selected' }, tab);
        await handleContextMenuClick({ menuItemId: 'copy-tab-as-markdown-link' }, tab);
        await handleContextMenuClick({ menuItemId: 'toggle-includeTemplate' }, tab);
      } finally {
        for (const [name, original] of Object.entries(originals)) {
          self[name] = original;
        }
      }

      return calls;
    }, { fixtureUrl: `${fixtureHost}${fixturePath}` });

    expect(calls).toHaveLength(7);
    expect(calls).toEqual([
      expect.objectContaining({ fn: 'copyMarkdownFromContext', menuItemId: 'copy-markdown-all' }),
      expect.objectContaining({ fn: 'downloadMarkdownFromContext', menuItemId: 'download-markdown-all' }),
      expect.objectContaining({ fn: 'downloadMarkdownForAllTabs', menuItemId: 'download-markdown-alltabs' }),
      expect.objectContaining({ fn: 'copyTabAsMarkdownLinkAll' }),
      expect.objectContaining({ fn: 'copySelectedTabAsMarkdownLink' }),
      expect.objectContaining({ fn: 'copyTabAsMarkdownLink' }),
      expect.objectContaining({ fn: 'toggleSetting', setting: 'includeTemplate' }),
    ]);
  });

  test('uses offscreen messaging path for downloadsApi mode', async () => {
    const result = await serviceWorker.evaluate(async () => {
      if (typeof self.downloadMarkdown !== 'function') {
        throw new Error('Missing function in service worker: downloadMarkdown');
      }

      const originals = {
        getOptions: self.getOptions,
        ensureOffscreenDocumentExists: self.ensureOffscreenDocumentExists,
        sendMessage: browser.runtime.sendMessage,
      };

      let ensuredCount = 0;
      const messages = [];

      try {
        self.getOptions = async () => ({
          ...defaultOptions,
          downloadMode: 'downloadsApi',
          saveAs: false,
          downloadImages: false,
          disallowedChars: '[]#^',
        });

        self.ensureOffscreenDocumentExists = async () => {
          ensuredCount += 1;
        };

        browser.runtime.sendMessage = async (message) => {
          messages.push(message);
          return { ok: true };
        };

        await downloadMarkdown('# content', 'SpecTitle', 777, {}, 'SpecFolder/');
      } finally {
        self.getOptions = originals.getOptions;
        self.ensureOffscreenDocumentExists = originals.ensureOffscreenDocumentExists;
        browser.runtime.sendMessage = originals.sendMessage;
      }

      return { ensuredCount, messages };
    });

    expect(result.ensuredCount).toBe(1);
    expect(result.messages.length).toBeGreaterThan(0);
    expect(result.messages[0]).toEqual(
      expect.objectContaining({
        target: 'offscreen',
        type: 'download-markdown',
        title: 'SpecTitle',
        tabId: 777,
        mdClipsFolder: 'SpecFolder/',
      }),
    );
  });

  test('uses content script fallback path for contentLink mode', async () => {
    const result = await serviceWorker.evaluate(async () => {
      if (typeof self.downloadMarkdown !== 'function') {
        throw new Error('Missing function in service worker: downloadMarkdown');
      }

      const originals = {
        getOptions: self.getOptions,
        ensureScripts: self.ensureScripts,
        executeScript: browser.scripting.executeScript,
        recordNotificationMetrics: self.recordNotificationMetrics,
      };

      let ensureScriptsTabId = null;
      const executeCalls = [];
      const metricCalls = [];

      try {
        self.getOptions = async () => ({
          ...defaultOptions,
          downloadMode: 'contentLink',
          saveAs: false,
          downloadImages: false,
          disallowedChars: '[]#^',
        });

        self.ensureScripts = async (tabId) => {
          ensureScriptsTabId = tabId;
        };

        browser.scripting.executeScript = async (payload) => {
          executeCalls.push(payload);
          return [{ result: true }];
        };
        self.recordNotificationMetrics = async (delta, options) => {
          metricCalls.push({ delta, options });
          return { ok: true };
        };

        await downloadMarkdown('# content', 'Content Link Title', 313, {}, 'Clips/');
      } finally {
        self.getOptions = originals.getOptions;
        self.ensureScripts = originals.ensureScripts;
        browser.scripting.executeScript = originals.executeScript;
        self.recordNotificationMetrics = originals.recordNotificationMetrics;
      }

      return { ensureScriptsTabId, executeCalls, metricCalls };
    });

    expect(result.ensureScriptsTabId).toBe(313);
    expect(result.executeCalls).toHaveLength(1);
    expect(result.executeCalls[0].target).toEqual({ tabId: 313 });
    expect(result.executeCalls[0].args[0]).toMatch(/^Clips\/.+\.md$/);
    expect(result.executeCalls[0].args[1].length).toBeGreaterThan(10);
    expect(result.metricCalls).toEqual([
      {
        delta: { downloads: 1, exports: 1 },
        options: { tabId: 313 },
      },
    ]);
  });

  test('records metrics when offscreen delegates a content download through the service worker', async () => {
    const result = await serviceWorker.evaluate(async () => {
      if (typeof self.executeContentDownload !== 'function') {
        throw new Error('Missing function in service worker: executeContentDownload');
      }

      const originals = {
        executeScript: browser.scripting.executeScript,
        recordNotificationMetrics: self.recordNotificationMetrics,
      };

      const executeCalls = [];
      const metricCalls = [];

      try {
        browser.scripting.executeScript = async (payload) => {
          executeCalls.push(payload);
          return [{ result: true }];
        };
        self.recordNotificationMetrics = async (delta, options) => {
          metricCalls.push({ delta, options });
          return { ok: true };
        };

        await executeContentDownload(444, 'Offscreen Clip.md', 'Zm9v', { downloads: 1, exports: 1 });
      } finally {
        browser.scripting.executeScript = originals.executeScript;
        self.recordNotificationMetrics = originals.recordNotificationMetrics;
      }

      return { executeCalls, metricCalls };
    });

    expect(result.executeCalls).toHaveLength(1);
    expect(result.executeCalls[0].target).toEqual({ tabId: 444 });
    expect(result.metricCalls).toEqual([
      {
        delta: { downloads: 1, exports: 1 },
        options: { tabId: 444 },
      },
    ]);
  });

  test('records copy metrics only after offscreen confirms clipboard success', async () => {
    const result = await serviceWorker.evaluate(async () => {
      if (typeof self.copyMarkdownFromContext !== 'function') {
        throw new Error('Missing function in service worker: copyMarkdownFromContext');
      }

      const originals = {
        ensureScripts: self.ensureScripts,
        ensureOffscreenDocumentExists: self.ensureOffscreenDocumentExists,
        sendMessage: browser.runtime.sendMessage,
        recordNotificationMetrics: self.recordNotificationMetrics,
      };

      const metricCalls = [];
      const sentMessages = [];
      const responses = [{ ok: false }, { ok: true }];

      try {
        self.ensureScripts = async () => {};
        self.ensureOffscreenDocumentExists = async () => {};
        browser.runtime.sendMessage = async (message) => {
          sentMessages.push(message);
          return responses.shift() || { ok: false };
        };
        self.recordNotificationMetrics = async (delta, options) => {
          metricCalls.push({ delta, options });
          return { ok: true };
        };

        await copyMarkdownFromContext({ menuItemId: 'copy-markdown-all' }, { id: 901 });
        await copyMarkdownFromContext({ menuItemId: 'copy-markdown-all' }, { id: 902 });
      } finally {
        self.ensureScripts = originals.ensureScripts;
        self.ensureOffscreenDocumentExists = originals.ensureOffscreenDocumentExists;
        browser.runtime.sendMessage = originals.sendMessage;
        self.recordNotificationMetrics = originals.recordNotificationMetrics;
      }

      return { metricCalls, sentMessages };
    });

    expect(result.sentMessages).toHaveLength(2);
    expect(result.metricCalls).toEqual([
      {
        delta: { copies: 1, exports: 1 },
        options: { tabId: 902 },
      },
    ]);
  });
});
