// In Chrome service workers, importScripts is available; in Firefox background
// scripts, these files are listed in manifest.json background.scripts instead.
if (typeof importScripts === 'function') {
  importScripts(
    'browser-polyfill.min.js',
    'background/moment.min.js',
    'background/apache-mime-types.js',
    'shared/default-options.js',
    'shared/context-menus.js'
  );
}

// Log platform info
browser.runtime.getPlatformInfo().then(async platformInfo => {
  const browserInfo = browser.runtime.getBrowserInfo ? await browser.runtime.getBrowserInfo() : "Can't get browser info"
  console.info(platformInfo, browserInfo);
});

// Initialize listeners synchronously
browser.runtime.onMessage.addListener(handleMessages);
browser.contextMenus.onClicked.addListener(handleContextMenuClick);
browser.commands.onCommand.addListener(handleCommands);
browser.downloads.onChanged.addListener(handleDownloadChange);
browser.storage.onChanged.addListener(handleStorageChange);

// Create context menus when service worker starts
createMenus();

// Track active downloads
const activeDownloads = new Map();
let batchConversionInProgress = false;
let activeBatchSignal = null;
let batchState = null;

// Batch cancellation signal
class BatchCancelledError extends Error {
    constructor() {
        super('Batch cancelled by user');
        this.name = 'BatchCancelledError';
    }
}

function createBatchCancellationSignal() {
    let cancelled = false;
    const listeners = new Set();
    return {
        get cancelled() { return cancelled; },
        cancel() {
            cancelled = true;
            for (const fn of listeners) fn(new BatchCancelledError());
            listeners.clear();
        },
        throwIfCancelled() {
            if (cancelled) throw new BatchCancelledError();
        },
        get promise() {
            if (cancelled) return Promise.reject(new BatchCancelledError());
            return new Promise((_, reject) => { listeners.add(reject); });
        }
    };
}

// Track MarkSnip downloads to handle filename conflicts
const markSnipDownloads = new Map(); // downloadId -> { filename, imageList }
const markSnipUrls = new Map(); // url -> { filename, expectedFilename }
const markSnipBlobUrls = new Set(); // Track blob URLs we've created for positive identification

// Add listener to handle filename conflicts from other extensions
// onDeterminingFilename is Chrome-only
if (browser.downloads.onDeterminingFilename) {
  browser.downloads.onDeterminingFilename.addListener(handleFilenameConflict);
}

/**
 * Handle filename conflicts from other extensions
 * This fixes the Chrome bug where other extensions' onDeterminingFilename listeners
 * override our filename parameter in chrome.downloads.download()
 * 
 * CRITICAL: We only call suggest() for downloads we positively identify as ours.
 * Calling suggest() for untracked downloads causes conflicts with other extensions.
 */
function handleFilenameConflict(downloadItem, suggest) {
  console.log(`onDeterminingFilename called for download ${downloadItem.id}`, downloadItem);
  console.log(`Current markSnipDownloads:`, Array.from(markSnipDownloads.keys()));
  console.log(`Current markSnipUrls:`, Array.from(markSnipUrls.keys()));
  console.log(`Current markSnipBlobUrls:`, Array.from(markSnipBlobUrls));

  // Check tracking methods in order of reliability:
  // 1. Already tracked by download ID (most reliable)
  // 2. Pre-tracked by URL in markSnipUrls (reliable if set before download)
  // 3. Is a blob URL we created (tracked in markSnipBlobUrls)
  const trackedById = markSnipDownloads.has(downloadItem.id);
  const trackedByUrl = downloadItem.url && markSnipUrls.has(downloadItem.url);
  const isOurBlobUrl = downloadItem.url && markSnipBlobUrls.has(downloadItem.url);

  // Only handle downloads we positively identify as ours
  // We do NOT handle arbitrary blob URLs to avoid conflicts with other extensions
  if (trackedById || trackedByUrl || isOurBlobUrl) {
    let filename = null;
    
    if (trackedById) {
      const downloadInfo = markSnipDownloads.get(downloadItem.id);
      filename = downloadInfo?.filename;
    } else if (trackedByUrl) {
      const urlInfo = markSnipUrls.get(downloadItem.url);
      filename = urlInfo?.filename;
    } else if (isOurBlobUrl && trackedByUrl === false) {
      // Blob URL we created but not in markSnipUrls - try to get from markSnipUrls as fallback
      const urlInfo = markSnipUrls.get(downloadItem.url);
      filename = urlInfo?.filename;
    }

    if (filename) {
      console.log(`✅ Suggesting correct filename for MarkSnip download ${downloadItem.id}: ${filename}`);
      suggest({
        filename: filename,
        conflictAction: 'uniquify'
      });
      return true; // Indicate we handled this asynchronously
    }
    
    // We identified it as our download but couldn't get the filename
    // This shouldn't happen, but if it does, don't interfere
    console.warn(`⚠️ MarkSnip download ${downloadItem.id} identified but no filename found`);
  }

  // NOT our download - DO NOT call suggest()
  // Let Chrome use the original filename from download() call
  // This prevents conflicts with other extensions
  console.log(`⏭️ Not a MarkSnip download ${downloadItem.id}, not interfering`);
  return false; // Indicate we're not handling this
}

/**
 * Handle messages from content scripts and popup
 */
async function handleMessages(message, sender, sendResponse) {
  switch (message.type) {
    case "clip":
      await handleClipRequest(message, sender.tab?.id);
      break;
    case "download":
      await handleDownloadRequest(message);
      break;
    case "download-images":
      await handleImageDownloads(message);
      break;
    case "download-images-content-script":
      await handleImageDownloadsContentScript(message);
      break;
    case "track-download-url":
      // Track URL before download starts (from offscreen)
      console.log(`📝 Tracking URL before download: ${message.url} -> ${message.filename}`);
      markSnipUrls.set(message.url, {
        filename: message.filename,
        isMarkdown: message.isMarkdown || false,
        isImage: message.isImage || false
      });
      // Also track as our blob URL if it's a blob URL
      if (message.url && message.url.startsWith('blob:')) {
        markSnipBlobUrls.add(message.url);
        console.log(`📝 Added blob URL to tracking set: ${message.url}`);
      }
      break;
    case "offscreen-ready":
      // The offscreen document is ready - no action needed
      break;
    case "markdown-result":
      await handleMarkdownResult(message);
      break;
    case "download-complete":
      handleDownloadComplete(message);
      break;

    case "get-tab-content":
      await getTabContentForOffscreen(message.tabId, message.selection, message.requestId);
      break;

    case "forward-get-article-content":
      await forwardGetArticleContent(message.tabId, message.selection, message.originalRequestId);
      break;

    case "execute-content-download":
      await executeContentDownload(message.tabId, message.filename, message.content);
      break;
    case "cleanup-blob-url":
      // Forward cleanup request to offscreen document
      await browser.runtime.sendMessage({
        target: 'offscreen',
        type: 'cleanup-blob-url',
        url: message.url
      }).catch(err => {
        console.log('⚠️ Could not forward cleanup to offscreen:', err.message);
      });
      break;
    case "service-worker-download":
      // Offscreen created blob URL, use Downloads API in service worker
      console.log(`🎯 [Service Worker] Received blob URL from offscreen: ${message.blobUrl}`);
      await handleDownloadWithBlobUrl(
        message.blobUrl,
        message.filename,
        message.tabId,
        message.imageList,
        message.mdClipsFolder,
        message.options
      );
      break;
    case "offscreen-download-failed":
      // Legacy fallback - shouldn't be used anymore
      console.log(`⚠️ [Service Worker] Legacy offscreen-download-failed: ${message.error}`);
      break;
    case "open-obsidian-uri":
      await openObsidianUri(message.vault, message.folder, message.title);
      break;
    case "obsidian-integration":
      await handleObsidianIntegration(message);
      break;
    case "start-batch-conversion":
      await handleBatchConversionInServiceWorker(message);
      break;
    case "cancel-batch":
      activeBatchSignal?.cancel();
      break;
    case "get-batch-state":
      return Promise.resolve(batchState);
  }
}

async function sendBatchProgressUpdate(update) {
  batchState = { ...update };
  await browser.runtime.sendMessage({
    type: 'batch-progress',
    ...update
  }).catch(() => {
    // Popup is likely closed while batch runs, which is expected.
  });
}

async function waitForTabLoadCompleteBatch(tabId, timeoutMs = 45000, signal = null) {
  const loadPromise = new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      browser.tabs.onUpdated.removeListener(listener);
      reject(new Error(`Timeout loading tab ${tabId}`));
    }, timeoutMs);

    function listener(updatedTabId, info) {
      if (updatedTabId === tabId && info.status === 'complete') {
        clearTimeout(timeout);
        browser.tabs.onUpdated.removeListener(listener);
        resolve();
      }
    }

    browser.tabs.onUpdated.addListener(listener);
  });

  if (signal) {
    await Promise.race([loadPromise, signal.promise]);
  } else {
    await loadPromise;
  }
}

async function waitForTabContentReadyBatch(tabId, maxWaitMs = 15000, pollIntervalMs = 500, signal = null) {
  const start = Date.now();
  let previousTextLength = 0;
  let stablePolls = 0;

  while (Date.now() - start < maxWaitMs) {
    if (signal) signal.throwIfCancelled();
    try {
      const results = await browser.scripting.executeScript({
        target: { tabId },
        func: () => {
          const root = document.querySelector('main, article, [role="main"]') || document.body;
          const text = (root?.innerText || '').replace(/\s+/g, ' ').trim();
          return {
            readyState: document.readyState,
            textLength: text.length,
            paragraphCount: root ? root.querySelectorAll('p').length : 0
          };
        }
      });

      const snapshot = results?.[0]?.result;
      if (snapshot) {
        const elapsed = Date.now() - start;
        const lengthStable = Math.abs(snapshot.textLength - previousTextLength) < 40;
        stablePolls = lengthStable ? stablePolls + 1 : 0;
        const richStable = snapshot.textLength >= 900 && stablePolls >= 2 && elapsed >= 2000;
        const shortStable = snapshot.textLength >= 120 && snapshot.paragraphCount >= 1 && stablePolls >= 3 && elapsed >= 2000;

        if (snapshot.readyState === 'complete' && (richStable || shortStable)) {
          return;
        }

        previousTextLength = snapshot.textLength;
      }
    } catch (err) {
      console.debug(`[Batch] Content readiness poll failed for tab ${tabId}:`, err);
    }

    await new Promise(resolve => setTimeout(resolve, pollIntervalMs));
  }
}

async function activateTabForBatch(tabId, settleMs = 1500) {
  await browser.tabs.update(tabId, { active: true });
  if (settleMs > 0) {
    await new Promise(resolve => setTimeout(resolve, settleMs));
  }
}

function ensureUniqueBatchEntryPath(filePath, usedPaths) {
  let normalized = (filePath || 'untitled.md').replace(/\\/g, '/').replace(/^\/+/, '');
  if (!normalized.endsWith('.md')) normalized += '.md';

  if (!usedPaths.has(normalized)) {
    usedPaths.add(normalized);
    return normalized;
  }

  const lastDot = normalized.lastIndexOf('.');
  const base = lastDot > 0 ? normalized.substring(0, lastDot) : normalized;
  const ext = lastDot > 0 ? normalized.substring(lastDot) : '';
  let suffix = 2;
  let candidate = `${base} (${suffix})${ext}`;
  while (usedPaths.has(candidate)) {
    suffix++;
    candidate = `${base} (${suffix})${ext}`;
  }
  usedPaths.add(candidate);
  return candidate;
}

function createBatchZipFilename() {
  return `MarkSnip-batch-${moment().format('YYYYMMDD-HHmmss')}.zip`;
}

async function triggerBatchZipDownload(files, options, fallbackTabId = null) {
  try {
    await ensureOffscreenDocumentExists();
    console.log(`[Batch] Triggering ZIP download with ${files.length} file(s)`);
    await browser.runtime.sendMessage({
      target: 'offscreen',
      type: 'download-batch-zip',
      files,
      zipFilename: createBatchZipFilename(),
      fallbackTabId: fallbackTabId,
      options: {
        ...options,
        downloadImages: false
      }
    });
    console.log('[Batch] ZIP message dispatched to offscreen');
  } catch (error) {
    console.error('[Batch] Failed to trigger ZIP download:', error);
    throw error;
  }
}

// ===== In-page batch progress overlay =====
// Injected into each batch tab so the user can see progress & cancel
// even though the popup closes when a new tab takes focus.

async function injectBatchProgressOverlay(tabId, current, total, url, pageTitle, accentColors) {
  try {
    await browser.scripting.executeScript({
      target: { tabId },
      func: (current, total, url, pageTitle, colors) => {
        // Remove any previous overlay
        const existing = document.getElementById('marksnip-batch-overlay');
        if (existing) existing.remove();
        const existingStyle = document.getElementById('marksnip-batch-overlay-style');
        if (existingStyle) existingStyle.remove();

        const darker = colors.darker;
        const dark = colors.dark;
        const base = colors.base;

        const style = document.createElement('style');
        style.id = 'marksnip-batch-overlay-style';
        style.textContent = `
          #marksnip-batch-overlay {
            position: fixed;
            bottom: 24px;
            right: 24px;
            background: linear-gradient(150deg, ${darker} 0%, ${dark} 100%);
            border-radius: 12px;
            padding: 16px 20px 14px;
            box-shadow: 0 12px 40px rgba(0,0,0,0.35), 0 2px 8px rgba(0,0,0,0.15);
            z-index: 2147483647;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
            min-width: 260px;
            max-width: 340px;
            border: 1px solid rgba(255,255,255,0.1);
            transform: translateZ(0);
            will-change: transform, opacity;
            animation: marksnip-bo-slideUp 240ms ease-out both;
          }
          #marksnip-batch-overlay * { box-sizing: border-box; margin: 0; padding: 0; }
          .marksnip-bo-title {
            font-size: 11px; font-weight: 600;
            color: rgba(255,255,255,0.7);
            text-transform: uppercase; letter-spacing: 0.08em;
            margin-bottom: 10px; text-align: center;
          }
          .marksnip-bo-count {
            font-size: 22px; font-weight: 700; color: #fff;
            text-align: center; margin-bottom: 6px;
            text-shadow: 0 1px 4px rgba(0,0,0,0.2);
          }
          .marksnip-bo-url {
            font-size: 11px; color: rgba(255,255,255,0.55);
            text-align: center; margin-bottom: 10px;
            white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
          }
          .marksnip-bo-bar-bg {
            height: 5px; background: rgba(255,255,255,0.15);
            border-radius: 3px; overflow: hidden; margin-bottom: 12px;
          }
          .marksnip-bo-bar {
            height: 100%; background: rgba(255,255,255,0.85);
            border-radius: 3px; transition: width 300ms ease;
          }
          .marksnip-bo-cancel {
            width: 100%; padding: 8px 14px; border-radius: 8px;
            font-size: 12px; font-weight: 600; cursor: pointer;
            font-family: inherit; border: 1px solid rgba(255,255,255,0.18);
            background: rgba(255,255,255,0.12); color: rgba(255,255,255,0.8);
            transition: background 140ms ease, color 140ms ease;
          }
          .marksnip-bo-cancel:hover {
            background: rgba(255,255,255,0.25); color: #fff;
          }
          @keyframes marksnip-bo-slideUp {
            from { opacity: 0; transform: translateZ(0) translateY(16px); }
            to   { opacity: 1; transform: translateZ(0) translateY(0); }
          }
        `;
        document.head.appendChild(style);

        const pct = total > 0 ? Math.round((current / total) * 100) : 0;
        const displayText = pageTitle || url;

        const panel = document.createElement('div');
        panel.id = 'marksnip-batch-overlay';
        panel.innerHTML = `
          <div class="marksnip-bo-title">MarkSnip — Batch Processing</div>
          <div class="marksnip-bo-count">${current} / ${total}</div>
          <div class="marksnip-bo-url" title="${url}">${displayText}</div>
          <div class="marksnip-bo-bar-bg"><div class="marksnip-bo-bar" style="width:${pct}%"></div></div>
          <button class="marksnip-bo-cancel" id="marksnip-bo-cancel-btn">Cancel Batch</button>
        `;
        document.body.appendChild(panel);

        document.getElementById('marksnip-bo-cancel-btn').addEventListener('click', () => {
          const btn = document.getElementById('marksnip-bo-cancel-btn');
          if (btn) { btn.textContent = 'Cancelling...'; btn.disabled = true; }
          browser.runtime.sendMessage({ type: 'cancel-batch' }).catch(() => {});
        });
      },
      args: [current, total, url, pageTitle, accentColors]
    });
  } catch (e) {
    console.debug('[Batch] Could not inject progress overlay:', e);
  }
}

async function updateBatchProgressOverlay(tabId, current, total, url, pageTitle, statusText) {
  try {
    await browser.scripting.executeScript({
      target: { tabId },
      func: (current, total, url, pageTitle, statusText) => {
        const panel = document.getElementById('marksnip-batch-overlay');
        if (!panel) return;
        const pct = total > 0 ? Math.round((current / total) * 100) : 0;
        const countEl = panel.querySelector('.marksnip-bo-count');
        const urlEl = panel.querySelector('.marksnip-bo-url');
        const barEl = panel.querySelector('.marksnip-bo-bar');
        const titleEl = panel.querySelector('.marksnip-bo-title');
        if (countEl) countEl.textContent = `${current} / ${total}`;
        if (urlEl) { urlEl.textContent = pageTitle || url; urlEl.title = url; }
        if (barEl) barEl.style.width = `${pct}%`;
        if (titleEl && statusText) titleEl.textContent = `MarkSnip — ${statusText}`;
      },
      args: [current, total, url, pageTitle, statusText]
    });
  } catch (e) {
    // Tab may have navigated or closed
  }
}

async function removeBatchProgressOverlay(tabId) {
  try {
    await browser.scripting.executeScript({
      target: { tabId },
      func: () => {
        document.getElementById('marksnip-batch-overlay')?.remove();
        document.getElementById('marksnip-batch-overlay-style')?.remove();
      }
    });
  } catch (e) { /* ignore */ }
}

async function processBatchTab(urlObj, index, total, options, batchSaveMode = 'zip', signal = null, accentColors = null) {
  const collectOnly = batchSaveMode === 'zip';
  const effectiveOptions = collectOnly
    ? { ...options, downloadImages: false }
    : options;
  if (signal) signal.throwIfCancelled();
  const tab = await browser.tabs.create({
    url: urlObj.url,
    active: true
  });

  let lastResult = null;

  try {
    await sendBatchProgressUpdate({
      status: 'loading',
      current: index,
      total,
      url: urlObj.url
    });

    await waitForTabLoadCompleteBatch(tab.id, 45000, signal);

    // Read page title after load
    let pageTitle = null;
    try {
      const tabInfo = await browser.tabs.get(tab.id);
      pageTitle = tabInfo.title || null;
    } catch (e) { /* ignore */ }

    await sendBatchProgressUpdate({
      status: 'loading',
      current: index,
      total,
      url: urlObj.url,
      pageTitle
    });

    await ensureScripts(tab.id);

    // Inject the in-page progress overlay with cancel button
    const overlayColors = accentColors || { darker: '#3F5441', dark: '#56735A', base: '#6B8E6F' };
    await injectBatchProgressOverlay(tab.id, index, total, urlObj.url, pageTitle, overlayColors);

    await activateTabForBatch(tab.id, 1500);

    for (let attempt = 1; attempt <= 2; attempt++) {
      if (signal) signal.throwIfCancelled();
      await waitForTabContentReadyBatch(tab.id, attempt === 1 ? 15000 : 22000, 500, signal);

      await sendBatchProgressUpdate({
        status: 'converting',
        current: index,
        total,
        url: urlObj.url,
        pageTitle,
        attempt
      });

      await updateBatchProgressOverlay(tab.id, index, total, urlObj.url, pageTitle, 'Converting...');

      const info = { menuItemId: 'download-markdown-all' };
      const result = await downloadMarkdownFromContext(
        info,
        tab,
        urlObj.title || null,
        effectiveOptions,
        collectOnly,
        signal
      );
      lastResult = result;
      const likelyIncomplete = !!result?.likelyIncomplete;
      console.log(`[Batch] ${urlObj.url} attempt ${attempt}: likelyIncomplete=${likelyIncomplete}, markdownLength=${result?.markdownLength || 0}`);

      if (!likelyIncomplete || attempt === 2) {
        if (likelyIncomplete) {
          await sendBatchProgressUpdate({
            status: 'warning',
            current: index,
            total,
            url: urlObj.url,
            message: 'Content may still be partial after retry'
          });
        }
        return {
          likelyIncomplete,
          result: lastResult
        };
      }

      await sendBatchProgressUpdate({
        status: 'retrying',
        current: index,
        total,
        url: urlObj.url,
        pageTitle,
        attempt: attempt + 1
      });

      await browser.tabs.reload(tab.id);
      await waitForTabLoadCompleteBatch(tab.id, 45000, signal);
      await ensureScripts(tab.id);
      // Re-inject overlay after reload (previous DOM is gone)
      await injectBatchProgressOverlay(tab.id, index, total, urlObj.url, pageTitle, overlayColors);
      await activateTabForBatch(tab.id, 1500);
    }
    return {
      likelyIncomplete: !!lastResult?.likelyIncomplete,
      result: lastResult
    };
  } finally {
    await browser.tabs.remove(tab.id).catch(() => {});
  }
}

async function handleBatchConversionInServiceWorker(message) {
  const urlObjects = message.urlObjects || [];
  if (!urlObjects.length) {
    throw new Error('No URLs to process');
  }

  if (batchConversionInProgress) {
    throw new Error('Batch conversion already in progress');
  }

  const batchSaveMode = message.batchSaveMode === 'individual' ? 'individual' : 'zip';

  batchConversionInProgress = true;
  const signal = createBatchCancellationSignal();
  activeBatchSignal = signal;
  const startedAt = Date.now();
  const options = await getOptions();

  // Resolve accent colors for the in-page overlay
  const BATCH_ACCENT_COLORS = {
    sage:  { darker: '#3F5441', dark: '#56735A', base: '#6B8E6F' },
    ocean: { darker: '#385D6F', dark: '#4A7A92', base: '#5B8FA8' },
    slate: { darker: '#414D5C', dark: '#56657A', base: '#6B7B8E' },
    rose:  { darker: '#7A4A4A', dark: '#965C5C', base: '#B07070' },
    amber: { darker: '#7A6030', dark: '#967840', base: '#B08E50' }
  };
  const accentColors = BATCH_ACCENT_COLORS[options.popupAccent] || BATCH_ACCENT_COLORS.sage;

  let originalTabId = message.originalTabId || null;
  if (!originalTabId) {
    const activeTabs = await browser.tabs.query({ currentWindow: true, active: true });
    originalTabId = activeTabs?.[0]?.id || null;
  }

  const failures = [];
  const collectedFiles = [];
  const usedPaths = new Set();

  try {
    await sendBatchProgressUpdate({
      status: 'started',
      total: urlObjects.length,
      batchSaveMode
    });

    for (let i = 0; i < urlObjects.length; i++) {
      if (signal.cancelled) break;
      const urlObj = urlObjects[i];
      const current = i + 1;
      try {
        const { result } = await processBatchTab(urlObj, current, urlObjects.length, options, batchSaveMode, signal, accentColors);

        if (batchSaveMode === 'zip' && result?.markdown && result?.fullFilename) {
          const uniquePath = ensureUniqueBatchEntryPath(result.fullFilename, usedPaths);
          collectedFiles.push({
            filename: uniquePath,
            content: result.markdown
          });
        }
      } catch (error) {
        if (error instanceof BatchCancelledError) throw error;
        failures.push({ url: urlObj.url, error: error.message });
        console.error(`[Batch] Failed processing ${urlObj.url}:`, error);
        await sendBatchProgressUpdate({
          status: 'item-error',
          current,
          total: urlObjects.length,
          url: urlObj.url,
          error: error.message
        });
      }
    }

    if (batchSaveMode === 'zip' && collectedFiles.length > 0) {
      await sendBatchProgressUpdate({
        status: 'zipping',
        total: urlObjects.length
      });

      await triggerBatchZipDownload(collectedFiles, options, originalTabId);
    }

    await browser.storage.local.remove('batchUrlList').catch(() => {});

    await sendBatchProgressUpdate({
      status: 'finished',
      total: urlObjects.length,
      failed: failures.length,
      failures,
      batchSaveMode,
      durationMs: Date.now() - startedAt
    });
  } catch (error) {
    if (error instanceof BatchCancelledError) {
      await sendBatchProgressUpdate({
        status: 'cancelled',
        total: urlObjects.length,
        batchSaveMode
      });
    } else {
      await sendBatchProgressUpdate({
        status: 'failed',
        total: urlObjects.length,
        error: error.message,
        batchSaveMode
      });
      throw error;
    }
  } finally {
    if (originalTabId) {
      await browser.tabs.update(originalTabId, { active: true }).catch(() => {});
    }
    batchConversionInProgress = false;
    activeBatchSignal = null;
    batchState = null;
  }
}

/**
 * Get tab content for offscreen document
 * @param {number} tabId - Tab ID to get content from
 *  @param {boolean} selection - Whether to get selection or full content
 * @param {string} requestId - Request ID to track this specific request
 */
async function getTabContentForOffscreen(tabId, selection, requestId) {
  try {
    console.log(`Getting tab content for ${tabId}`);
    await ensureScripts(tabId);
    const tabInfo = await browser.tabs.get(tabId).catch(() => null);
    const fallbackPageUrl = tabInfo?.url || null;
    
    const results = await browser.scripting.executeScript({
      target: { tabId: tabId },
      func: async () => {
        if (typeof marksnipPrepareForCapture === 'function') {
          await marksnipPrepareForCapture();
        }
        if (typeof getSelectionAndDom === 'function') {
          return getSelectionAndDom();
        }
        console.warn('getSelectionAndDom not found');
        return null;
      }
    });
    
    console.log(`Script execution results for tab ${tabId}:`, results);
    
    if (results && results[0]?.result) {
      console.log(`Sending content result for tab ${tabId}`);
      await browser.runtime.sendMessage({
        type: 'article-content-result',
        requestId: requestId,
        article: {
          dom: results[0].result.dom,
          selection: selection ? results[0].result.selection : null,
          pageUrl: results[0].result.pageUrl || fallbackPageUrl
        }
      });
    } else {
      throw new Error(`Failed to get content from tab ${tabId} - getSelectionAndDom returned null`);
    }
  } catch (error) {
    console.error(`Error getting tab content for ${tabId}:`, error);
    await browser.runtime.sendMessage({
      type: 'article-content-result',
      requestId: requestId,
      error: error.message
    });
  }
}


/**
 * Forward get article content to offscreen document
 * @param {number} tabId - Tab ID to forward content from
 * @param {boolean} selection - Whether to get selection or full content
 * @param {string} originalRequestId - Original request ID to track this specific request
 * */
async function forwardGetArticleContent(tabId, selection, originalRequestId) {
  try {
    await ensureScripts(tabId);
    const tabInfo = await browser.tabs.get(tabId).catch(() => null);
    const fallbackPageUrl = tabInfo?.url || null;
    
    const results = await browser.scripting.executeScript({
      target: { tabId: tabId },
      func: async () => {
        if (typeof marksnipPrepareForCapture === 'function') {
          await marksnipPrepareForCapture();
        }
        if (typeof getSelectionAndDom === 'function') {
          return getSelectionAndDom();
        }
        return null;
      }
    });
    
    if (results && results[0]?.result) {
      // Forward the DOM data to the offscreen document for processing
      await browser.runtime.sendMessage({
        type: 'article-dom-data',
        requestId: originalRequestId,
        dom: results[0].result.dom,
        selection: selection ? results[0].result.selection : null,
        pageUrl: results[0].result.pageUrl || fallbackPageUrl
      });
    } else {
      throw new Error('Failed to get content from tab');
    }
  } catch (error) {
    console.error("Error forwarding article content:", error);
  }
}

/**
 * Execute content download, helper function for offscreen document
 * @param {number} tabId - Tab ID to execute download in
 * @param {string} filename - Filename for download
 * @param {string} base64Content - Base64 encoded content to download
 */
async function executeContentDownload(tabId, filename, base64Content) {
  try {
    await browser.scripting.executeScript({
      target: { tabId: tabId },
      func: (filename, content) => {
        const decoded = atob(content);
        const dataUri = `data:text/markdown;base64,${btoa(decoded)}`;
        const link = document.createElement('a');
        link.download = filename;
        link.href = dataUri;
        link.click();
      },
      args: [filename, base64Content]
    });
  } catch (error) {
    console.error("Failed to execute download script:", error);
  }
}

/**
 * Handle image downloads from offscreen document (Downloads API method)
 */
async function handleImageDownloads(message) {
  const { imageList, mdClipsFolder, title, options } = message;
  
  try {
    console.log('🖼️ Service worker handling image downloads:', Object.keys(imageList).length, 'images');
    
    // Calculate the destination path for images
    const destPath = mdClipsFolder + title.substring(0, title.lastIndexOf('/'));
    const adjustedDestPath = destPath && !destPath.endsWith('/') ? destPath + '/' : destPath;
    
    // Download each image
    for (const [src, filename] of Object.entries(imageList)) {
      try {
        console.log('🖼️ Downloading image:', src, '->', filename);
        
        const fullImagePath = adjustedDestPath ? adjustedDestPath + filename : filename;
        
        // If this is a blob URL (pre-processed image), track it by URL
        if (src.startsWith('blob:')) {
          markSnipUrls.set(src, {
            filename: fullImagePath,
            isImage: true
          });
        }
        
        const imgId = await browser.downloads.download({
          url: src,
          filename: fullImagePath,
          saveAs: false
        });

        // Track the download
        activeDownloads.set(imgId, src);
        
        // For non-blob URLs, track by ID since we can't pre-track by URL
        if (!src.startsWith('blob:')) {
          markSnipDownloads.set(imgId, { 
            filename: fullImagePath,
            isImage: true,
            url: src
          });
        }
        
        console.log('✅ Image download started:', imgId, filename);
      } catch (imgErr) {
        console.error('❌ Failed to download image:', src, imgErr);
        // Continue with other images even if one fails
      }
    }
    
    console.log('🎯 All image downloads initiated');
  } catch (error) {
    console.error('❌ Error handling image downloads:', error);
  }
}

/**
 * Handle image downloads for content script method
 */
async function handleImageDownloadsContentScript(message) {
  const { imageList, tabId, options } = message;
  
  try {
    console.log('Service worker handling image downloads via content script');
    
    // For content script method, we need to convert images to data URIs
    // and trigger downloads through the content script
    for (const [src, filename] of Object.entries(imageList)) {
      try {
        // Fetch the image in the service worker context (has proper CORS permissions)
        const response = await fetch(src);
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        const blob = await response.blob();
        const reader = new FileReader();
        
        reader.onloadend = async () => {
          // Send the image data to content script for download
          await browser.scripting.executeScript({
            target: { tabId: tabId },
            func: (filename, dataUri) => {
              const link = document.createElement('a');
              link.download = filename;
              link.href = dataUri;
              link.click();
            },
            args: [filename, reader.result]
          });
        };
        
        reader.readAsDataURL(blob);
        console.log('Image processed for content script download:', filename);
      } catch (imgErr) {
        console.error('Failed to process image for content script:', src, imgErr);
      }
    }
  } catch (error) {
    console.error('Error handling content script image downloads:', error);
  }
}

/**
 * Track the Firefox offscreen extension page tab
 */
let firefoxOffscreenTabId = null;

/**
 * Ensures the offscreen document exists (Chrome) or an equivalent
 * extension page is loaded (Firefox).
 */
async function ensureOffscreenDocumentExists() {
  if (typeof chrome !== 'undefined' && chrome.offscreen) {
    // Chrome — use native offscreen API
    const offscreenUrl = chrome.runtime.getURL('offscreen/offscreen.html');
    const existingContexts = await chrome.runtime.getContexts({
      contextTypes: ['OFFSCREEN_DOCUMENT'],
      documentUrls: [offscreenUrl]
    });
    
    if (existingContexts.length > 0) return;
    
    await chrome.offscreen.createDocument({
      url: 'offscreen/offscreen.html',
      reasons: ['DOM_PARSER', 'CLIPBOARD', 'BLOBS'],
      justification: 'HTML to Markdown conversion'
    });
  } else {
    // Firefox — load offscreen.html as a regular extension page.
    // Check if we already have a live tab for it.
    if (firefoxOffscreenTabId != null) {
      try {
        await browser.tabs.get(firefoxOffscreenTabId);
        return; // tab still exists
      } catch {
        firefoxOffscreenTabId = null;
      }
    }

    // Also check by URL in case the variable was lost
    const offscreenUrl = browser.runtime.getURL('offscreen/offscreen.html');
    const existing = await browser.tabs.query({ url: offscreenUrl });
    if (existing.length > 0) {
      firefoxOffscreenTabId = existing[0].id;
      return;
    }

    // Create a new pinned tab for the offscreen page
    const tab = await browser.tabs.create({
      url: 'offscreen/offscreen.html',
      active: false,
      pinned: true
    });
    firefoxOffscreenTabId = tab.id;

    // Wait briefly for the page to initialise
    await new Promise(resolve => setTimeout(resolve, 500));
  }
}

/**
 * Handle clip request — uses offscreen document on both Chrome and Firefox.
 */
async function handleClipRequest(message, tabId) {
  await ensureOffscreenDocumentExists();

  const options = await getOptions();
  const requestId = generateRequestId();
  let pageUrl = message?.pageUrl || null;
  if (!pageUrl && Number.isInteger(tabId)) {
    const tabInfo = await browser.tabs.get(tabId).catch(() => null);
    pageUrl = tabInfo?.url || null;
  }

  await browser.runtime.sendMessage({
    target: 'offscreen',
    type: 'process-content',
    requestId: requestId,
    data: {
      ...message,
      pageUrl
    },
    tabId: tabId,
    options: options
  });
}

/**
 * Generate unique request ID
 */
function generateRequestId() {
  return Date.now().toString(36) + Math.random().toString(36).substring(2);
}

/**
 * Process markdown result from offscreen document
 */
async function handleMarkdownResult(message) {
  const { result, requestId } = message;
  
  // Forward the result to the popup
  await browser.runtime.sendMessage({
    type: "display.md",
    markdown: result.markdown,
    article: result.article,
    imageList: result.imageList,
    sourceImageMap: result.sourceImageMap,
    mdClipsFolder: result.mdClipsFolder,
    options: await getOptions()
  });
}

/**
 * Handle download request
 */
async function handleDownloadRequest(message) {
  const options = await getOptions();
  console.log(`🔧 [Service Worker] Download request: downloadMode=${options.downloadMode}, offscreen=${typeof chrome !== 'undefined' && chrome.offscreen}`);
  
  if (typeof chrome !== 'undefined' && chrome.offscreen && options.downloadMode === 'downloadsApi') {
    // Chrome - try offscreen document first
    await ensureOffscreenDocumentExists();
    
    console.log(`📤 [Service Worker] Sending download request to offscreen document`);
    
    try {
      // Send download request to offscreen
      await browser.runtime.sendMessage({
        target: 'offscreen',
        type: 'download-markdown',
        markdown: message.markdown,
        title: message.title,
        tabId: message.tab.id,
        imageList: message.imageList,
        mdClipsFolder: message.mdClipsFolder,
        options: options
      });
    } catch (error) {
      console.error(`❌ [Service Worker] Offscreen download failed, trying service worker direct:`, error);
      // Fallback: try download directly in service worker
      await downloadMarkdown(
        message.markdown,
        message.title,
        message.tab.id,
        message.imageList,
        message.mdClipsFolder
      );
    }
  } else {
    // Firefox or downloadMode is not downloadsApi - handle download directly
    console.log(`🔧 [Service Worker] Handling download directly`);
    await downloadMarkdown(
      message.markdown,
      message.title,
      message.tab.id,
      message.imageList,
      message.mdClipsFolder
    );
  }
}

/**
 * Download listener function factory
 */
function downloadListener(id, url) {
  activeDownloads.set(id, url);
  return function handleChange(delta) {
    if (delta.id === id && delta.state && delta.state.current === "complete") {
      // Only revoke blob URLs that we control (created in offscreen)
      if (url.startsWith('blob:chrome-extension://')) {
        // Send message to offscreen to clean up the blob URL
        browser.runtime.sendMessage({
          type: 'cleanup-blob-url',
          url: url
        }).catch(err => {
          console.log('⚠️ Could not cleanup blob URL (offscreen may be closed):', err.message);
        });
      }
      activeDownloads.delete(id);
      markSnipDownloads.delete(id); // Clean up filename tracking
      markSnipBlobUrls.delete(url); // Clean up blob URL tracking
    }
  };
}

/**
 * Enhanced download listener to handle image downloads
 */
function handleDownloadChange(delta) {
  if (activeDownloads.has(delta.id)) {
    if (delta.state && delta.state.current === "complete") {
      console.log('✅ Download completed:', delta.id);
      const url = activeDownloads.get(delta.id);
      
      // Only revoke blob URLs that we control (created in offscreen)
      if (url.startsWith('blob:chrome-extension://')) {
        // Send message to offscreen to clean up the blob URL
        browser.runtime.sendMessage({
          type: 'cleanup-blob-url',
          url: url
        }).catch(err => {
          console.log('⚠️ Could not cleanup blob URL (offscreen may be closed):', err.message);
        });
      }
      
      activeDownloads.delete(delta.id);
      markSnipDownloads.delete(delta.id); // Clean up filename tracking
      markSnipBlobUrls.delete(url); // Clean up blob URL tracking

      // Also clean up markSnipUrls by URL if still present
      if (url && markSnipUrls.has(url)) {
        markSnipUrls.delete(url);
      }
    } else if (delta.state && delta.state.current === "interrupted") {
      console.error('❌ Download interrupted:', delta.id, delta.error);
      const url = activeDownloads.get(delta.id);
      
      // Only revoke blob URLs that we control
      if (url.startsWith('blob:chrome-extension://')) {
        // Send message to offscreen to clean up the blob URL
        browser.runtime.sendMessage({
          type: 'cleanup-blob-url',
          url: url
        }).catch(err => {
          console.log('⚠️ Could not cleanup blob URL (offscreen may be closed):', err.message);
        });
      }
      
      activeDownloads.delete(delta.id);
      markSnipDownloads.delete(delta.id); // Clean up filename tracking
      markSnipBlobUrls.delete(url); // Clean up blob URL tracking

      // Also clean up markSnipUrls by URL if still present
      if (url && markSnipUrls.has(url)) {
        markSnipUrls.delete(url);
      }
    }
  }

  // Also clean up any remaining URL tracking
  if (markSnipDownloads.has(delta.id)) {
    const downloadInfo = markSnipDownloads.get(delta.id);
    if (downloadInfo.url && markSnipUrls.has(downloadInfo.url)) {
      markSnipUrls.delete(downloadInfo.url);
    }
  }
}

/**
 * Handle download complete notification from offscreen
 */
function handleDownloadComplete(message) {
  const { downloadId, url } = message;
  if (downloadId && url) {
    activeDownloads.set(downloadId, url);
  }
}

/**
 * Handle context menu clicks
 */
async function handleContextMenuClick(info, tab) {
  // One of the copy to clipboard commands
  if (info.menuItemId.startsWith("copy-markdown")) {
    await copyMarkdownFromContext(info, tab);
  }
  else if (info.menuItemId === "download-markdown-alltabs" || info.menuItemId === "tab-download-markdown-alltabs") {
    await downloadMarkdownForAllTabs(info);
  }
  // One of the download commands
  else if (info.menuItemId.startsWith("download-markdown")) {
    await downloadMarkdownFromContext(info, tab);
  }
  // Copy all tabs as markdown links
  else if (info.menuItemId === "copy-tab-as-markdown-link-all") {
    await copyTabAsMarkdownLinkAll(tab);
  }
  // Copy only selected tabs as markdown links
  else if (info.menuItemId === "copy-tab-as-markdown-link-selected") {
    await copySelectedTabAsMarkdownLink(tab);
  }
  // Copy single tab as markdown link
  else if (info.menuItemId === "copy-tab-as-markdown-link") {
    await copyTabAsMarkdownLink(tab);
  }
  // A settings toggle command
  else if (info.menuItemId.startsWith("toggle-") || info.menuItemId.startsWith("tabtoggle-")) {
    await toggleSetting(info.menuItemId.split('-')[1]);
  }
}

async function getCommandTargetTab() {
  const queryStrategies = [
    { active: true, lastFocusedWindow: true },
    { active: true, currentWindow: true },
    { active: true }
  ];

  for (const queryInfo of queryStrategies) {
    const tabs = await browser.tabs.query(queryInfo);
    if (tabs && tabs[0]?.id != null) {
      return tabs[0];
    }
  }

  return null;
}

function isRestrictedTabUrl(url) {
  if (!url) return false;
  return (
    url.startsWith('chrome://') ||
    url.startsWith('edge://') ||
    url.startsWith('about:') ||
    url.startsWith('moz-extension://') ||
    url.startsWith('chrome-extension://') ||
    url.startsWith('view-source:')
  );
}

/**
 * Handle keyboard commands
 */
async function handleCommands(command) {
  try {
    const tab = await getCommandTargetTab();
    if (!tab) {
      console.warn(`[Commands] No active tab found for command "${command}"`);
      return;
    }

    if (isRestrictedTabUrl(tab.url || '')) {
      console.warn(`[Commands] Ignoring command "${command}" on restricted URL: ${tab.url}`);
      return;
    }

    if (command == "download_tab_as_markdown") {
      const info = { menuItemId: "download-markdown-all" };
      await downloadMarkdownFromContext(info, tab);
    }
    else if (command == "copy_tab_as_markdown") {
      const info = { menuItemId: "copy-markdown-all" };
      await copyMarkdownFromContext(info, tab);
    }
    else if (command == "copy_selection_as_markdown") {
      const info = { menuItemId: "copy-markdown-selection" };
      await copyMarkdownFromContext(info, tab);
    }
    else if (command == "copy_tab_as_markdown_link") {
      await copyTabAsMarkdownLink(tab);
    }
    else if (command == "copy_selected_tab_as_markdown_link") {
      await copySelectedTabAsMarkdownLink(tab);
    }
    else if (command == "copy_selection_to_obsidian") {
      const info = { menuItemId: "copy-markdown-obsidian" };
      await copyMarkdownFromContext(info, tab);
    }
    else if (command == "copy_tab_to_obsidian") {
      const info = { menuItemId: "copy-markdown-obsall" };
      await copyMarkdownFromContext(info, tab);
    }
  } catch (error) {
    console.error(`[Commands] Failed to execute "${command}":`, error);
  }
}

/**
 * Handle storage changes - recreate menus when options change
 */
async function handleStorageChange(changes, areaName) {
  // Only handle sync storage changes
  if (areaName === 'sync') {
    console.log('Options changed, recreating context menus...');
    // Recreate all context menus with updated options
    await createMenus();
  }
}

/**
 * Open Obsidian URI in current tab
 */
async function openObsidianUri(vault, folder, title) {
  try {
    // Ensure folder ends with / if it's not empty
    let folderPath = folder || '';
    if (folderPath && !folderPath.endsWith('/')) {
      folderPath += '/';
    }

    // Ensure title has .md extension
    const filename = title.endsWith('.md') ? title : title + '.md';
    const filepath = folderPath + filename;

    // Use correct URI scheme: adv-uri (not advanced-uri)
    const uri = `obsidian://adv-uri?vault=${encodeURIComponent(vault)}&filepath=${encodeURIComponent(filepath)}&clipboard=true&mode=new`;

    console.log('Opening Obsidian URI:', uri);
    await browser.tabs.update({ url: uri });
  } catch (error) {
    console.error('Failed to open Obsidian URI:', error);
  }
}

/**
 * Handle Obsidian integration - copy to clipboard in tab and open URI
 */
async function handleObsidianIntegration(message) {
  const { markdown, tabId, vault, folder, title } = message;

  try {
    console.log('[Service Worker] Copying markdown to clipboard in tab:', tabId);

    // Ensure content script is loaded
    await ensureScripts(tabId);

    // Copy to clipboard using execCommand (doesn't require user gesture)
    await browser.scripting.executeScript({
      target: { tabId: tabId },
      func: (markdownText) => {
        // Use execCommand directly since Clipboard API requires user gesture
        // and user gestures don't transfer from popup to tab
        const textarea = document.createElement('textarea');
        textarea.value = markdownText;
        textarea.style.position = 'fixed';
        textarea.style.left = '-999999px';
        textarea.style.top = '-999999px';
        document.body.appendChild(textarea);
        textarea.focus();
        textarea.select();

        try {
          const success = document.execCommand('copy');
          console.log('[Tab] ' + (success ? '✅' : '❌') + ' Copied to clipboard using execCommand');
          return success;
        } catch (e) {
          console.error('[Tab] ❌ Failed to copy:', e);
          return false;
        } finally {
          document.body.removeChild(textarea);
        }
      },
      args: [markdown]
    });

    console.log('[Service Worker] Clipboard copy initiated, waiting for clipboard to sync...');

    // Wait for clipboard to fully sync to system before navigating away
    // This ensures Obsidian can read the clipboard when it opens
    // 200ms should be enough for the async clipboard operation to complete
    await new Promise(resolve => setTimeout(resolve, 200));

    console.log('[Service Worker] Opening Obsidian URI...');

    // Open Obsidian URI
    await openObsidianUri(vault, folder, title);
  } catch (error) {
    console.error('[Service Worker] Failed Obsidian integration:', error);
  }
}

/**
 * Toggle extension setting
 */
async function toggleSetting(setting, options = null) {
  if (options == null) {
    await toggleSetting(setting, await getOptions());
  }
  else {
    options[setting] = !options[setting];
    await browser.storage.sync.set(options);
    if (setting == "includeTemplate") {
      browser.contextMenus.update("toggle-includeTemplate", {
        checked: options.includeTemplate
      });
      try {
        browser.contextMenus.update("tabtoggle-includeTemplate", {
          checked: options.includeTemplate
        });
      } catch { }
    }
    
    if (setting == "downloadImages") {
      browser.contextMenus.update("toggle-downloadImages", {
        checked: options.downloadImages
      });
      try {
        browser.contextMenus.update("tabtoggle-downloadImages", {
          checked: options.downloadImages
        });
      } catch { }
    }
  }
}

/**
* Replace placeholder strings with article info
*/
function textReplace(string, article, disallowedChars = null) {
  // Replace values from article object
  for (const key in article) {
    if (article.hasOwnProperty(key) && key != "content") {
      let s = (article[key] || '') + '';
      if (s && disallowedChars) s = generateValidFileName(s, disallowedChars);

      string = string.replace(new RegExp('{' + key + '}', 'g'), s)
        .replace(new RegExp('{' + key + ':kebab}', 'g'), s.replace(/ /g, '-').toLowerCase())
        .replace(new RegExp('{' + key + ':snake}', 'g'), s.replace(/ /g, '_').toLowerCase())
        .replace(new RegExp('{' + key + ':camel}', 'g'), s.replace(/ ./g, (str) => str.trim().toUpperCase()).replace(/^./, (str) => str.toLowerCase()))
        .replace(new RegExp('{' + key + ':pascal}', 'g'), s.replace(/ ./g, (str) => str.trim().toUpperCase()).replace(/^./, (str) => str.toUpperCase()));
    }
  }

  // Replace date formats
  const now = new Date();
  const dateRegex = /{date:(.+?)}/g;
  const matches = string.match(dateRegex);
  if (matches && matches.forEach) {
    matches.forEach(match => {
      const format = match.substring(6, match.length - 1);
      const dateString = moment(now).format(format);
      string = string.replaceAll(match, dateString);
    });
  }

  // Replace keywords
  const keywordRegex = /{keywords:?(.*)?}/g;
  const keywordMatches = string.match(keywordRegex);
  if (keywordMatches && keywordMatches.forEach) {
    keywordMatches.forEach(match => {
      let seperator = match.substring(10, match.length - 1);
      try {
        seperator = JSON.parse(JSON.stringify(seperator).replace(/\\\\/g, '\\'));
      }
      catch { }
      const keywordsString = (article.keywords || []).join(seperator);
      string = string.replace(new RegExp(match.replace(/\\/g, '\\\\'), 'g'), keywordsString);
    });
  }

  // Replace anything left in curly braces
  const defaultRegex = /{(.*?)}/g;
  string = string.replace(defaultRegex, '');

  return string;
}

/**
* Generate valid filename
*/
function generateValidFileName(title, disallowedChars = null) {
  if (!title) return title;
  else title = title + '';
  // Remove < > : " / \ | ? * 
  var illegalRe = /[\/\?<>\\:\*\|":]/g;
  // And non-breaking spaces
  var name = title.replace(illegalRe, "").replace(new RegExp('\u00A0', 'g'), ' ');
  
  if (disallowedChars) {
    for (let c of disallowedChars) {
      if (`[\\^$.|?*+()`.includes(c)) c = `\\${c}`;
      name = name.replace(new RegExp(c, 'g'), '');
    }
  }
  
  return name;
}

async function formatTitle(article, providedOptions = null) {
  const options = providedOptions || defaultOptions;
  let title = textReplace(options.title, article, options.disallowedChars + '/');
  title = title.split('/').map(s => generateValidFileName(s, options.disallowedChars)).join('/');
  return title;
}

function getArticlePageUrl(article, tab = null) {
  const candidates = [
    article?.pageURL,
    article?.tabURL,
    tab?.url,
    article?.baseURI
  ];

  for (const candidate of candidates) {
    if (!candidate) continue;
    try {
      return new URL(candidate).href;
    } catch {
      // Try next candidate.
    }
  }

  return article?.baseURI || tab?.url || '';
}

/**
 * Ensure content script is loaded
 */
async function ensureScripts(tabId) {
  try {
      // First check if scripts are already loaded
      const results = await browser.scripting.executeScript({
          target: { tabId: tabId },
          func: () => {
              return typeof getSelectionAndDom === 'function' && typeof browser !== 'undefined';
          }
      });
      
      // If either script is missing, inject both in correct order
      if (!results || !results[0]?.result) {
          await browser.scripting.executeScript({
              target: { tabId: tabId },
              files: [
                  "/browser-polyfill.min.js",
                  "/contentScript/contentScript.js"
              ]
          });
      }

      // Verify injection was successful
      const verification = await browser.scripting.executeScript({
          target: { tabId: tabId },
          func: () => {
              return {
                  hasPolyfill: typeof browser !== 'undefined',
                  hasContentScript: typeof getSelectionAndDom === 'function'
              };
          }
      });

      if (!verification[0]?.result?.hasPolyfill || !verification[0]?.result?.hasContentScript) {
          throw new Error('Script injection verification failed');
      }

  } catch (error) {
      console.error("Failed to ensure scripts:", error);
      throw error; // Re-throw to handle in calling function
  }
}

/**
 * Download markdown from context menu
 */
async function downloadMarkdownFromContext(info, tab, customTitle = null, providedOptions = null, collectOnly = false, signal = null) {
  await ensureScripts(tab.id);
  await ensureOffscreenDocumentExists();
  const options = providedOptions || await getOptions();

  // Create a promise to wait for completion
  let timeoutHandle;
  let messageListener;
  const processComplete = new Promise((resolve, reject) => {
    messageListener = (message) => {
      if (message.type === 'process-complete' && message.tabId === tab.id) {
        browser.runtime.onMessage.removeListener(messageListener);
        clearTimeout(timeoutHandle);
        if (message.error) {
          reject(new Error(message.error));
        } else {
          resolve(message);
        }
      }
    };

    browser.runtime.onMessage.addListener(messageListener);

    // Timeout after 30 seconds
    timeoutHandle = setTimeout(() => {
      browser.runtime.onMessage.removeListener(messageListener);
      reject(new Error(`Timeout processing tab ${tab.id}`));
    }, 30000);
  });

  // Send message to offscreen
  await browser.runtime.sendMessage({
    target: 'offscreen',
    type: 'process-context-menu',
    action: 'download',
    info: info,
    tabId: tab.id,
    options: options,
    customTitle: customTitle,
    collectOnly: collectOnly
  });

  // Wait for completion, racing against cancellation signal
  if (signal) {
    try {
      await Promise.race([processComplete, signal.promise]);
    } catch (err) {
      browser.runtime.onMessage.removeListener(messageListener);
      clearTimeout(timeoutHandle);
      throw err;
    }
    return await processComplete;
  }
  return await processComplete;
}

/**
 * Copy markdown from context menu
 */
async function copyMarkdownFromContext(info, tab) {
  await ensureScripts(tab.id);
  await ensureOffscreenDocumentExists();
  
  await browser.runtime.sendMessage({
    target: 'offscreen',
    type: 'process-context-menu',
    action: 'copy',
    info: info,
    tabId: tab.id,
    options: await getOptions()
  });
}

/**
 * Copy tab as markdown link
 */
async function copyTabAsMarkdownLink(tab) {
  try {
    await ensureScripts(tab.id);
    await ensureOffscreenDocumentExists();
    const options = await getOptions();
    const article = await getArticleFromContent(tab.id, false, options);
    const title = await formatTitle(article, options);
    const pageUrl = getArticlePageUrl(article, tab);
    
    await browser.runtime.sendMessage({
      target: 'offscreen',
      type: 'copy-to-clipboard',
      text: `[${title}](${pageUrl})`,
      options: options
    });
  } catch (error) {
    console.error("Failed to copy as markdown link:", error);
  }
}

/**
 * Copy all tabs as markdown links
 */
async function copyTabAsMarkdownLinkAll(tab) {
  try {
    await ensureOffscreenDocumentExists();
    const options = await getOptions();
    const tabs = await browser.tabs.query({
      currentWindow: true
    });
    
    const links = [];
    for (const currentTab of tabs) {
      await ensureScripts(currentTab.id);
      const article = await getArticleFromContent(currentTab.id, false, options);
      const title = await formatTitle(article, options);
      const pageUrl = getArticlePageUrl(article, currentTab);
      const link = `${options.bulletListMarker} [${title}](${pageUrl})`;
      links.push(link);
    }
    
    const markdown = links.join('\n');
    
    await browser.runtime.sendMessage({
      target: 'offscreen',
      type: 'copy-to-clipboard',
      text: markdown,
      options: options
    });
  } catch (error) {
    console.error("Failed to copy all tabs as markdown links:", error);
  }
}

/**
 * Copy selected tabs as markdown links
 */
async function copySelectedTabAsMarkdownLink(tab) {
  try {
    await ensureOffscreenDocumentExists();
    const options = await getOptions();
    options.frontmatter = options.backmatter = '';
    
    const tabs = await browser.tabs.query({
      currentWindow: true,
      highlighted: true
    });

    const links = [];
    for (const selectedTab of tabs) {
      await ensureScripts(selectedTab.id);
      const article = await getArticleFromContent(selectedTab.id, false, options);
      const title = await formatTitle(article, options);
      const pageUrl = getArticlePageUrl(article, selectedTab);
      const link = `${options.bulletListMarker} [${title}](${pageUrl})`;
      links.push(link);
    }

    const markdown = links.join(`\n`);
    
    await browser.runtime.sendMessage({
      target: 'offscreen',
      type: 'copy-to-clipboard',
      text: markdown,
      options: options
    });
  } catch (error) {
    console.error("Failed to copy selected tabs as markdown links:", error);
  }
}

/**
 * Download markdown for all tabs
 */
async function downloadMarkdownForAllTabs(info) {
  const tabs = await browser.tabs.query({
    currentWindow: true
  });
  
  for (const tab of tabs) {
    await downloadMarkdownFromContext(info, tab);
  }
}

/**
 * Get article from content of the tab
 */
async function getArticleFromContent(tabId, selection = false, options = null) {
  try {
    await ensureOffscreenDocumentExists();
    
    if (!options) {
      options = await getOptions();
    }
    
    const requestId = generateRequestId();
    
    const resultPromise = new Promise((resolve, reject) => {
      const messageListener = (message) => {
        if (message.type === 'article-result' && message.requestId === requestId) {
          browser.runtime.onMessage.removeListener(messageListener);
          if (message.error) {
            reject(new Error(message.error));
          } else {
            resolve(message.article);
          }
        }
      };
      
      setTimeout(() => {
        browser.runtime.onMessage.removeListener(messageListener);
        reject(new Error('Timeout getting article content'));
      }, 30000);
      
      browser.runtime.onMessage.addListener(messageListener);
    });
    
    await browser.runtime.sendMessage({
      target: 'offscreen',
      type: 'get-article-content',
      tabId: tabId,
      selection: selection,
      requestId: requestId,
      options: options
    });
    
    const article = await resultPromise;
    if (!article) {
      throw new Error('Failed to get article content');
    }
    return article;
  } catch (error) {
    console.error("Error in getArticleFromContent:", error);
    throw error;
  }
}

/**
 * Handle download using blob URL created by offscreen document
 */
async function handleDownloadWithBlobUrl(blobUrl, filename, tabId, imageList = {}, mdClipsFolder = '', options = null) {
  if (!options) options = await getOptions();
  
  // CRITICAL: Ensure filename is never empty
  if (!filename || filename.trim() === '' || filename === '.md') {
    console.warn('⚠️ [Service Worker] Empty filename detected, using fallback');
    filename = 'Untitled-' + Date.now() + '.md';
  }
  
  console.log(`🚀 [Service Worker] Using Downloads API with blob URL: ${blobUrl} -> ${filename}`);
  
  if (browser.downloads || (typeof chrome !== 'undefined' && chrome.downloads)) {
    const downloadsAPI = browser.downloads || chrome.downloads;
    
    try {
      // CRITICAL: Set up URL tracking BEFORE calling download API
      // Track in both Maps for redundancy
      markSnipUrls.set(blobUrl, {
        filename: filename,
        isMarkdown: true
      });
      markSnipBlobUrls.add(blobUrl);
      console.log(`📝 [Service Worker] Pre-tracked blob URL: ${blobUrl} -> ${filename}`);
      
      // Start download using pre-made blob URL
      const id = await downloadsAPI.download({
        url: blobUrl,
        filename: filename,
        saveAs: !!options.saveAs
      });
      
      console.log(`✅ [Service Worker] Download started with ID: ${id} for file: ${filename} (saveAs: ${!!options.saveAs})`);
      console.log(`🔧 [Service Worker] Download options used:`, { 
        url: blobUrl.substring(0, 50) + '...', 
        filename: filename, 
        saveAs: !!options.saveAs 
      });
      
      // Move from URL tracking to ID tracking
      if (markSnipUrls.has(blobUrl)) {
        const urlInfo = markSnipUrls.get(blobUrl);
        markSnipDownloads.set(id, {
          ...urlInfo,
          url: blobUrl
        });
        markSnipUrls.delete(blobUrl);
      }
      
      // Add download listener for cleanup
      browser.downloads.onChanged.addListener(downloadListener(id, blobUrl));
      
      // Handle images if needed
      if (options.downloadImages) {
        await handleImageDownloadsDirectly(imageList, mdClipsFolder, filename.replace('.md', ''), options);
      }
      
    } catch (err) {
      console.error("❌ [Service Worker] Downloads API with blob URL failed:", err);
      
      // Final fallback: use blob URL with content script
      await ensureScripts(tabId);
      
      await browser.scripting.executeScript({
        target: { tabId: tabId },
        func: (blobUrl, filename) => {
          // Use the blob URL directly for download
          const link = document.createElement('a');
          link.download = filename;
          link.href = blobUrl;
          link.click();
        },
        args: [blobUrl, filename.split('/').pop()] // Just the filename, not path
      });
    }
  } else {
    console.error("❌ [Service Worker] No Downloads API available");
  }
}

/**
 * Handle download directly in service worker (bypass offscreen routing)
 * Used when offscreen document can't use Downloads API
 */
async function handleDownloadDirectly(markdown, title, tabId, imageList = {}, mdClipsFolder = '', options = null) {
  if (!options) options = await getOptions();
  
  // CRITICAL: Ensure title is never empty
  if (!title || title.trim() === '') {
    console.warn('⚠️ [Service Worker] Empty title detected, using fallback');
    title = 'Untitled-' + Date.now();
  }
  
  console.log(`🚀 [Service Worker] Handling download directly: title="${title}", folder="${mdClipsFolder}"`);
  
  if (options.downloadMode === 'downloadsApi' && (browser.downloads || (typeof chrome !== 'undefined' && chrome.downloads))) {
    // Use Downloads API directly
    const downloadsAPI = browser.downloads || chrome.downloads;
    
    try {
      // Create blob URL
      const blob = new Blob([markdown], { type: "text/markdown;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      
      if (mdClipsFolder && !mdClipsFolder.endsWith('/')) mdClipsFolder += '/';
      
      const fullFilename = mdClipsFolder + title + ".md";
      
      console.log(`🎯 [Service Worker] Starting Downloads API: URL=${url}, filename="${fullFilename}"`);
      
      // CRITICAL: Set up URL tracking BEFORE calling download API
      // Track in both Maps for redundancy
      markSnipUrls.set(url, {
        filename: fullFilename,
        isMarkdown: true
      });
      markSnipBlobUrls.add(url);
      console.log(`📝 [Service Worker] Pre-tracked blob URL: ${url} -> ${fullFilename}`);
      
      // Start download
      const id = await downloadsAPI.download({
        url: url,
        filename: fullFilename,
        saveAs: options.saveAs
      });
      
      console.log(`✅ [Service Worker] Download started with ID: ${id}`);
      
      // Move from URL tracking to ID tracking
      if (markSnipUrls.has(url)) {
        const urlInfo = markSnipUrls.get(url);
        markSnipDownloads.set(id, {
          ...urlInfo,
          url: url
        });
        markSnipUrls.delete(url);
      }
      
      // Add download listener for cleanup
      browser.downloads.onChanged.addListener(downloadListener(id, url));
      
      // Handle images if needed
      if (options.downloadImages) {
        await handleImageDownloadsDirectly(imageList, mdClipsFolder, title, options);
      }
      
    } catch (err) {
      console.error("❌ [Service Worker] Downloads API failed, falling back to content script", err);
      
      // Final fallback: content script method
      await ensureScripts(tabId);
      const filename = mdClipsFolder + generateValidFileName(title, options.disallowedChars) + ".md";
      const base64Content = base64EncodeUnicode(markdown);
      
      await browser.scripting.executeScript({
        target: { tabId: tabId },
        func: (filename, content) => {
          const decoded = atob(content);
          const dataUri = `data:text/markdown;base64,${btoa(decoded)}`;
          const link = document.createElement('a');
          link.download = filename;
          link.href = dataUri;
          link.click();
        },
        args: [filename, base64Content]
      });
    }
  } else {
    // Content script fallback
    console.log(`🔗 [Service Worker] Using content script fallback`);
    
    await ensureScripts(tabId);
    const filename = mdClipsFolder + generateValidFileName(title, options.disallowedChars) + ".md";
    const base64Content = base64EncodeUnicode(markdown);
    
    await browser.scripting.executeScript({
      target: { tabId: tabId },
      func: (filename, content) => {
        const decoded = atob(content);
        const dataUri = `data:text/markdown;base64,${btoa(decoded)}`;
        const link = document.createElement('a');
        link.download = filename;
        link.href = dataUri;
        link.click();
      },
      args: [filename, base64Content]
    });
  }
}

/**
 * Download markdown for a tab
 * This function orchestrates with the offscreen document in Chrome
 * or handles directly in Firefox
 */
async function downloadMarkdown(markdown, title, tabId, imageList = {}, mdClipsFolder = '') {
  const options = await getOptions();
  
  // CRITICAL: Ensure title is never empty
  if (!title || title.trim() === '') {
    console.warn('⚠️ [Service Worker] Empty title detected, using fallback');
    title = 'Untitled-' + Date.now();
  }
  
  console.log(`📁 [Service Worker] Downloading markdown: title="${title}", folder="${mdClipsFolder}", saveAs=${options.saveAs}`);
  console.log(`🔧 [Service Worker] Download mode: ${options.downloadMode}, browser.downloads: ${!!browser.downloads}, chrome.downloads: ${!!(typeof chrome !== 'undefined' && chrome.downloads)}`);
  
  if (typeof chrome !== 'undefined' && chrome.offscreen && options.downloadMode === 'downloadsApi') {
    // Chrome with offscreen - but offscreen will delegate back if Downloads API not available
    await ensureOffscreenDocumentExists();
    
    await browser.runtime.sendMessage({
      target: 'offscreen',
      type: 'download-markdown',
      markdown: markdown,
      title: title,
      tabId: tabId,
      imageList: imageList,
      mdClipsFolder: mdClipsFolder,
      options: await getOptions()
    });
  } 
  else if (options.downloadMode === 'downloadsApi' && (browser.downloads || (typeof chrome !== 'undefined' && chrome.downloads))) {
    // Direct Downloads API handling (Firefox or when offscreen delegates back)
    const downloadsAPI = browser.downloads || chrome.downloads;
    
    try {
      // Create blob URL
      const blob = new Blob([markdown], { type: "text/markdown;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      
      if (mdClipsFolder && !mdClipsFolder.endsWith('/')) mdClipsFolder += '/';
      
      const fullFilename = mdClipsFolder + title + ".md";
      
      console.log(`🚀 [Service Worker] Starting Downloads API download: URL=${url}, filename="${fullFilename}"`);
      
      // CRITICAL: Set up URL tracking BEFORE calling download API
      // Track in both Maps for redundancy
      markSnipUrls.set(url, {
        filename: fullFilename,
        isMarkdown: true
      });
      markSnipBlobUrls.add(url);
      console.log(`📝 [Service Worker] Pre-tracked blob URL: ${url} -> ${fullFilename}`);
      
      // Start download
      const id = await downloadsAPI.download({
        url: url,
        filename: fullFilename,
        saveAs: options.saveAs
      });
      
      console.log(`✅ [Service Worker] Downloads API download started with ID: ${id}`);
      
      // Move from URL tracking to ID tracking
      if (markSnipUrls.has(url)) {
        const urlInfo = markSnipUrls.get(url);
        markSnipDownloads.set(id, {
          ...urlInfo,
          url: url
        });
        markSnipUrls.delete(url);
      }
      
      // Add download listener for cleanup
      browser.downloads.onChanged.addListener(downloadListener(id, url));
      
      // Handle images if needed
      if (options.downloadImages) {
        await handleImageDownloadsDirectly(imageList, mdClipsFolder, title, options);
      }
    } catch (err) {
      console.error("❌ [Service Worker] Downloads API failed", err);
    }
  }
  else {
    // Content link mode - use content script
    try {
      await ensureScripts(tabId);
      const filename = mdClipsFolder + generateValidFileName(title, options.disallowedChars) + ".md";
      const base64Content = base64EncodeUnicode(markdown);
      
      console.log(`🔗 [Service Worker] Using content script download: ${filename}`);
      
      await browser.scripting.executeScript({
        target: { tabId: tabId },
        func: (filename, content) => {
          // Implementation of downloadMarkdown in content script
          const decoded = atob(content);
          const dataUri = `data:text/markdown;base64,${btoa(decoded)}`;
          const link = document.createElement('a');
          link.download = filename;
          link.href = dataUri;
          link.click();
        },
        args: [filename, base64Content]
      });
    } catch (error) {
      console.error("Failed to execute script:", error);
    }
  }
}

/**
 * Handle image downloads directly (for Firefox path)
 */
async function handleImageDownloadsDirectly(imageList, mdClipsFolder, title, options) {
  const destPath = mdClipsFolder + title.substring(0, title.lastIndexOf('/'));
  const adjustedDestPath = destPath && !destPath.endsWith('/') ? destPath + '/' : destPath;
  
  for (const [src, filename] of Object.entries(imageList)) {
    try {
      const fullImagePath = adjustedDestPath ? adjustedDestPath + filename : filename;
      
      console.log(`🖼️ Starting image download: ${src} -> ${fullImagePath}`);
      
      // For external URLs, we can't pre-track by URL since we don't create them
      // So we'll track by download ID after the fact
      const imgId = await browser.downloads.download({
        url: src,
        filename: fullImagePath,
        saveAs: false
      });
      
      console.log(`📝 Tracking image download ${imgId} with filename: ${fullImagePath}`);
      markSnipDownloads.set(imgId, { 
        filename: fullImagePath,
        isImage: true,
        url: src
      });
      
      browser.downloads.onChanged.addListener(downloadListener(imgId, src));
      
    } catch (imgErr) {
      console.error('❌ Failed to download image:', src, imgErr);
    }
  }
}

// Add polyfill for String.prototype.replaceAll if needed
if (!String.prototype.replaceAll) {
  String.prototype.replaceAll = function(str, newStr) {
    if (Object.prototype.toString.call(str).toLowerCase() === '[object regexp]') {
      return this.replace(str, newStr);
    }
    return this.replace(new RegExp(str, 'g'), newStr);
  };
}

/**
* Base64 encode Unicode string
*/
function base64EncodeUnicode(str) {
 // Encode UTF-8 string to base64
 const utf8Bytes = encodeURIComponent(str).replace(/%([0-9A-F]{2})/g, function (match, p1) {
   return String.fromCharCode('0x' + p1);
 });

 return btoa(utf8Bytes);
}
