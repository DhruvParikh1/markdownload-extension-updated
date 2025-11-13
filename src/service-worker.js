importScripts(
  'browser-polyfill.min.js',
  'background/moment.min.js',
  'background/apache-mime-types.js',
  'shared/default-options.js',
  'shared/context-menus.js'
);

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

// Track MarkSnip downloads to handle filename conflicts
const markSnipDownloads = new Map(); // downloadId -> { filename, imageList }
const markSnipUrls = new Map(); // url -> { filename, expectedFilename }

// Add listener to handle filename conflicts from other extensions
browser.downloads.onDeterminingFilename.addListener(handleFilenameConflict);

/**
 * Handle filename conflicts from other extensions
 * This fixes the Chrome bug where other extensions' onDeterminingFilename listeners
 * override our filename parameter in chrome.downloads.download()
 */
function handleFilenameConflict(downloadItem, suggest) {
  console.log(`onDeterminingFilename called for download ${downloadItem.id}`, downloadItem);
  console.log(`Current markSnipDownloads:`, Array.from(markSnipDownloads.keys()));
  
  // Check if this is a MarkSnip download by URL pattern (blob URLs we create)
  const isMarkSnipDownload = markSnipDownloads.has(downloadItem.id) || 
                            (downloadItem.url && downloadItem.url.startsWith('blob:'));
  
  if (isMarkSnipDownload && markSnipDownloads.has(downloadItem.id)) {
    const downloadInfo = markSnipDownloads.get(downloadItem.id);
    console.log(`✅ Suggesting correct filename for MarkSnip download ${downloadItem.id}: ${downloadInfo.filename}`);
    
    // Suggest the correct filename with subfolder path
    suggest({
      filename: downloadInfo.filename,
      conflictAction: 'uniquify'
    });
  } else if (isMarkSnipDownload) {
    // This is likely a MarkSnip download but we don't have it tracked yet
    // This shouldn't happen, but let's not interfere
    console.log(`⚠️  MarkSnip download ${downloadItem.id} not tracked, using original filename: ${downloadItem.filename}`);
    suggest();
  } else {
    // Not our download - let other extensions handle it
    console.log(`❌ Not a MarkSnip download ${downloadItem.id}, passing through`);
    suggest();
  }
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
    
    const results = await browser.scripting.executeScript({
      target: { tabId: tabId },
      func: () => {
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
          selection: selection ? results[0].result.selection : null
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
    
    const results = await browser.scripting.executeScript({
      target: { tabId: tabId },
      func: () => {
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
        selection: selection ? results[0].result.selection : null
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
 * Ensures the offscreen document exists
 */
async function ensureOffscreenDocumentExists() {
  // Check if offscreen document exists already
  if (typeof chrome !== 'undefined' && chrome.offscreen) {
    const existingContexts = await chrome.runtime.getContexts({
      contextTypes: ['OFFSCREEN_DOCUMENT']
    });
    
    if (existingContexts.length > 0) return;
    
    // Create offscreen document
    await chrome.offscreen.createDocument({
      url: 'offscreen/offscreen.html',
      reasons: ['DOM_PARSER', 'CLIPBOARD'],
      justification: 'HTML to Markdown conversion'
    });
  } else {
    // Firefox doesn't support offscreen API, use a different approach
    // Firefox still allows DOM access in background scripts/service workers
    importScripts(
      'background/turndown.js',
      'background/turndown-plugin-gfm.js',
      'background/Readability.js'
    );
  }
}

/**
 * Handle clip request - Send to offscreen document or process directly in Firefox
 */
async function handleClipRequest(message, tabId) {
  if (typeof chrome !== 'undefined' && chrome.offscreen) {
    // Chrome - use offscreen document
    await ensureOffscreenDocumentExists();
    
    // Get options to pass to offscreen document
    const options = await getOptions();
    
    // Generate request ID to track this specific request
    const requestId = generateRequestId();
    
    // Send to offscreen for processing with options included
    await browser.runtime.sendMessage({
      target: 'offscreen',
      type: 'process-content',
      requestId: requestId,
      data: message,
      tabId: tabId,
      options: options  // Pass options directly
    });
  } else {
    // Firefox - process directly (Firefox allows DOM access in service workers)
    const article = await getArticleFromDom(message.dom);
    
    // Handle selection if provided
    if (message.selection && message.clipSelection) {
      article.content = message.selection;
    }
    
    // Convert article to markdown
    const { markdown, imageList } = await convertArticleToMarkdown(article);
    
    // Format title and folder
    article.title = await formatTitle(article);
    const mdClipsFolder = await formatMdClipsFolder(article);
    
    // Send results to popup
    await browser.runtime.sendMessage({
      type: "display.md",
      markdown: markdown,
      article: article,
      imageList: imageList,
      mdClipsFolder: mdClipsFolder,
      options: await getOptions()
    });
  }
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

/**
 * Handle keyboard commands
 */
async function handleCommands(command) {
  const tab = await browser.tabs.getCurrent();
  
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
async function downloadMarkdownFromContext(info, tab) {
  await ensureScripts(tab.id);
  
  if (typeof chrome !== 'undefined' && chrome.offscreen) {
    await ensureOffscreenDocumentExists();
    
    // Create a promise to wait for completion
    const processComplete = new Promise((resolve, reject) => {
      const messageListener = (message) => {
        if (message.type === 'process-complete' && message.tabId === tab.id) {
          browser.runtime.onMessage.removeListener(messageListener);
          if (message.error) {
            reject(new Error(message.error));
          } else {
            resolve();
          }
        }
      };
      
      browser.runtime.onMessage.addListener(messageListener);
      
      // Timeout after 30 seconds
      setTimeout(() => {
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
      options: await getOptions()
    });
    
    // Wait for completion
    await processComplete;
  } else {
    // Firefox - process directly
    const article = await getArticleFromContent(tab.id, info.menuItemId == "download-markdown-selection");
    const title = await formatTitle(article);
    const { markdown, imageList } = await convertArticleToMarkdown(article);
    const mdClipsFolder = await formatMdClipsFolder(article);
    await downloadMarkdown(markdown, title, tab.id, imageList, mdClipsFolder);
  }
}

/**
 * Copy markdown from context menu
 */
async function copyMarkdownFromContext(info, tab) {
  await ensureScripts(tab.id);
  
  if (typeof chrome !== 'undefined' && chrome.offscreen) {
    // Chrome - use offscreen document
    await ensureOffscreenDocumentExists();
    
    await browser.runtime.sendMessage({
      target: 'offscreen',
      type: 'process-context-menu',
      action: 'copy',
      info: info,
      tabId: tab.id,
      options: await getOptions()
    });
  } else {
    try {
      // Firefox - handle directly
      const platformOS = navigator.platform;
      var folderSeparator = "";
      if(platformOS.indexOf("Win") === 0){
        folderSeparator = "\\";
      } else {
        folderSeparator = "/";
      }

      if (info.menuItemId == "copy-markdown-link") {
        const options = await getOptions();
        options.frontmatter = options.backmatter = '';
        const article = await getArticleFromContent(tab.id, false);
        const { markdown } = turndown(`<a href="${info.linkUrl}">${info.linkText || info.selectionText}</a>`, { ...options, downloadImages: false }, article);
        await browser.scripting.executeScript({
          target: { tabId: tab.id },
          func: (markdownText) => {
            if (typeof copyToClipboard === 'function') {
              copyToClipboard(markdownText);
            } else {
              // Fallback clipboard implementation
              const textarea = document.createElement('textarea');
              textarea.value = markdownText;
              textarea.style.position = 'fixed';
              textarea.style.left = '-999999px';
              document.body.appendChild(textarea);
              textarea.select();
              document.execCommand('copy');
              document.body.removeChild(textarea);
            }
          },
          args: [markdown]
        });
      }
      else if (info.menuItemId == "copy-markdown-image") {
        await browser.scripting.executeScript({
          target: { tabId: tab.id },
          func: (imageUrl) => {
            if (typeof copyToClipboard === 'function') {
              copyToClipboard(`![](${imageUrl})`);
            } else {
              // Fallback clipboard implementation
              const textarea = document.createElement('textarea');
              textarea.value = `![](${imageUrl})`;
              textarea.style.position = 'fixed';
              textarea.style.left = '-999999px';
              document.body.appendChild(textarea);
              textarea.select();
              document.execCommand('copy');
              document.body.removeChild(textarea);
            }
          },
          args: [info.srcUrl]
        });
      }
      else if(info.menuItemId == "copy-markdown-obsidian") {
        const article = await getArticleFromContent(tab.id, true);
        const title = article.title;
        const options = await getOptions();
        const obsidianVault = options.obsidianVault;
        const obsidianFolder = await formatObsidianFolder(article);
        const { markdown } = await convertArticleToMarkdown(article, false);
        
        await browser.scripting.executeScript({
          target: { tabId: tab.id },
          func: (markdownText) => {
            if (typeof copyToClipboard === 'function') {
              copyToClipboard(markdownText);
            } else {
              // Fallback clipboard implementation
              const textarea = document.createElement('textarea');
              textarea.value = markdownText;
              textarea.style.position = 'fixed';
              textarea.style.left = '-999999px';
              document.body.appendChild(textarea);
              textarea.select();
              document.execCommand('copy');
              document.body.removeChild(textarea);
            }
          },
          args: [markdown]
        });
        
        await browser.tabs.update({
          url: `obsidian://advanced-uri?vault=${encodeURIComponent(obsidianVault)}&clipboard=true&mode=new&filepath=${encodeURIComponent(obsidianFolder + generateValidFileName(title))}`
        });
      }
      else if(info.menuItemId == "copy-markdown-obsall") {
        const article = await getArticleFromContent(tab.id, false);
        const title = article.title;
        const options = await getOptions();
        const obsidianVault = options.obsidianVault;
        const obsidianFolder = await formatObsidianFolder(article);
        const { markdown } = await convertArticleToMarkdown(article, false);
        
        await browser.scripting.executeScript({
          target: { tabId: tab.id },
          func: (markdownText) => {
            if (typeof copyToClipboard === 'function') {
              copyToClipboard(markdownText);
            } else {
              // Fallback clipboard implementation
              const textarea = document.createElement('textarea');
              textarea.value = markdownText;
              textarea.style.position = 'fixed';
              textarea.style.left = '-999999px';
              document.body.appendChild(textarea);
              textarea.select();
              document.execCommand('copy');
              document.body.removeChild(textarea);
            }
          },
          args: [markdown]
        });
        
        await browser.tabs.update({
          url: `obsidian://advanced-uri?vault=${encodeURIComponent(obsidianVault)}&clipboard=true&mode=new&filepath=${encodeURIComponent(obsidianFolder + generateValidFileName(title))}`
        });
      }
      else {
        const article = await getArticleFromContent(tab.id, info.menuItemId == "copy-markdown-selection");
        const { markdown } = await convertArticleToMarkdown(article, false);
        
        await browser.scripting.executeScript({
          target: { tabId: tab.id },
          func: (markdownText) => {
            if (typeof copyToClipboard === 'function') {
              copyToClipboard(markdownText);
            } else {
              // Fallback clipboard implementation
              const textarea = document.createElement('textarea');
              textarea.value = markdownText;
              textarea.style.position = 'fixed';
              textarea.style.left = '-999999px';
              document.body.appendChild(textarea);
              textarea.select();
              document.execCommand('copy');
              document.body.removeChild(textarea);
            }
          },
          args: [markdown]
        });
      }
    } catch (error) {
      console.error("Failed to copy text:", error);
    }
  }
}

/**
 * Copy tab as markdown link
 */
async function copyTabAsMarkdownLink(tab) {
  try {
    await ensureScripts(tab.id);
    const options = await getOptions();  // Get options first
    const article = await getArticleFromContent(tab.id, false, options);
    const title = await formatTitle(article, options);
    
    if (typeof chrome !== 'undefined' && chrome.offscreen) {
      await ensureOffscreenDocumentExists();
      await browser.runtime.sendMessage({
        target: 'offscreen',
        type: 'copy-to-clipboard',
        text: `[${title}](${article.baseURI})`,
        options: options
      });
    } else {
      await browser.scripting.executeScript({
        target: { tabId: tab.id },
        func: (text) => {
          if (typeof copyToClipboard === 'function') {
            copyToClipboard(text);
          } else {
            const textarea = document.createElement('textarea');
            textarea.value = text;
            textarea.style.position = 'fixed';
            textarea.style.left = '-999999px';
            document.body.appendChild(textarea);
            textarea.select();
            document.execCommand('copy');
            document.body.removeChild(textarea);
          }
        },
        args: [`[${title}](${article.baseURI})`]
      });
    }
  } catch (error) {
    console.error("Failed to copy as markdown link:", error);
  }
}

/**
 * Copy all tabs as markdown links
 */
async function copyTabAsMarkdownLinkAll(tab) {
  try {
    const options = await getOptions();
    const tabs = await browser.tabs.query({
      currentWindow: true
    });
    
    const links = [];
    for (const currentTab of tabs) {
      await ensureScripts(currentTab.id);
      const article = await getArticleFromContent(currentTab.id, false, options);
      const title = await formatTitle(article, options);
      const link = `${options.bulletListMarker} [${title}](${article.baseURI})`;
      links.push(link);
    }
    
    const markdown = links.join('\n');
    
    if (typeof chrome !== 'undefined' && chrome.offscreen) {
      await ensureOffscreenDocumentExists();
      await browser.runtime.sendMessage({
        target: 'offscreen',
        type: 'copy-to-clipboard',
        text: markdown,
        options: options
      });
    } else {
      await browser.scripting.executeScript({
        target: { tabId: tab.id },
        func: (text) => {
          if (typeof copyToClipboard === 'function') {
            copyToClipboard(text);
          } else {
            const textarea = document.createElement('textarea');
            textarea.value = text;
            textarea.style.position = 'fixed';
            textarea.style.left = '-999999px';
            document.body.appendChild(textarea);
            textarea.select();
            document.execCommand('copy');
            document.body.removeChild(textarea);
          }
        },
        args: [markdown]
      });
    }
  } catch (error) {
    console.error("Failed to copy all tabs as markdown links:", error);
  }
}

/**
 * Copy selected tabs as markdown links
 */
async function copySelectedTabAsMarkdownLink(tab) {
  try {
    const options = await getOptions();
    options.frontmatter = options.backmatter = '';
    
    const tabs = await browser.tabs.query({
      currentWindow: true,
      highlighted: true
    });

    const links = [];
    for (const selectedTab of tabs) {
      await ensureScripts(selectedTab.id);
      const article = await getArticleFromContent(selectedTab.id);
      const title = await formatTitle(article);
      const link = `${options.bulletListMarker} [${title}](${article.baseURI})`;
      links.push(link);
    }

    const markdown = links.join(`\n`);
    
    if (typeof chrome !== 'undefined' && chrome.offscreen) {
      // Chrome - use offscreen document for clipboard operations
      await ensureOffscreenDocumentExists();
      await browser.runtime.sendMessage({
        target: 'offscreen',
        type: 'copy-to-clipboard',
        text: markdown,
        options: await getOptions()
      });
    } else {
      // Firefox - use content script
      await browser.scripting.executeScript({
        target: { tabId: tab.id },
        func: (markdownText) => {
          if (typeof copyToClipboard === 'function') {
            copyToClipboard(markdownText);
          } else {
            // Fallback clipboard method
            const textarea = document.createElement('textarea');
            textarea.value = markdownText;
            textarea.style.position = 'fixed';
            textarea.style.left = '-999999px';
            document.body.appendChild(textarea);
            textarea.select();
            document.execCommand('copy');
            document.body.removeChild(textarea);
          }
        },
        args: [markdown]
      });
    }
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
    // For Chrome: orchestrate through offscreen document
    if (typeof chrome !== 'undefined' && chrome.offscreen) {
      await ensureOffscreenDocumentExists();
      
      // Get options if not provided
      if (!options) {
        options = await getOptions();
      }
      
      // Generate a unique request ID
      const requestId = generateRequestId();
      
      // Create a promise that will be resolved when the result comes back
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
        
        // Set timeout
        setTimeout(() => {
          browser.runtime.onMessage.removeListener(messageListener);
          reject(new Error('Timeout getting article content'));
        }, 30000);
        
        browser.runtime.onMessage.addListener(messageListener);
      });
      
      // Request the article from offscreen document
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
    } 
    else {
      // For Firefox: direct execution
      await ensureScripts(tabId);
      
      const results = await browser.scripting.executeScript({
        target: { tabId: tabId },
        func: () => {
          if (typeof getSelectionAndDom === 'function') {
            return getSelectionAndDom();
          }
          return null;
        }
      });
      
      if (!results?.[0]?.result) {
        throw new Error('Failed to get DOM content');
      }
      
      const article = await getArticleFromDom(results[0].result.dom, options);
      
      if (selection && results[0].result.selection) {
        article.content = results[0].result.selection;
      }
      
      return article;
    }
  } catch (error) {
    console.error("Error in getArticleFromContent:", error);
    throw error; // Re-throw to handle in calling function
  }
}

/**
 * Handle download using blob URL created by offscreen document
 */
async function handleDownloadWithBlobUrl(blobUrl, filename, tabId, imageList = {}, mdClipsFolder = '', options = null) {
  if (!options) options = await getOptions();
  
  console.log(`🚀 [Service Worker] Using Downloads API with blob URL: ${blobUrl} -> ${filename}`);
  
  if (browser.downloads || (typeof chrome !== 'undefined' && chrome.downloads)) {
    const downloadsAPI = browser.downloads || chrome.downloads;
    
    try {
      // CRITICAL: Set up URL tracking BEFORE calling download API
      markSnipUrls.set(blobUrl, {
        filename: filename,
        isMarkdown: true
      });
      
      // Start download using pre-made blob URL
      const id = await downloadsAPI.download({
        url: blobUrl,
        filename: filename,
        saveAs: false  // EXPLICITLY set to false to avoid save dialog
      });
      
      console.log(`✅ [Service Worker] Download started with ID: ${id} for file: ${filename} (saveAs: false)`);
      console.log(`🔧 [Service Worker] Download options used:`, { 
        url: blobUrl.substring(0, 50) + '...', 
        filename: filename, 
        saveAs: false 
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
      markSnipUrls.set(url, {
        filename: fullFilename,
        isMarkdown: true
      });
      
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
      markSnipUrls.set(url, {
        filename: fullFilename,
        isMarkdown: true
      });
      
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