
// default variables
var selectedText = null;
var imageList = null;
var sourceImageMap = null;
var mdClipsFolder = '';

const progressUI = {
    container: document.getElementById('progressContainer'),
    bar: document.getElementById('progressBar'),
    count: document.getElementById('progressCount'),
    status: document.getElementById('progressStatus'),
    currentUrl: document.getElementById('currentUrl'),
    
    show() {
        this.container.style.display = 'flex';
    },
    
    hide() {
        this.container.style.display = 'none';
    },
    
    reset() {
        this.bar.style.width = '0%';
        this.count.textContent = '0/0';
        this.status.textContent = 'Processing URLs...';
        this.currentUrl.textContent = '';
    },
    
    cancelBtn: document.getElementById('cancelBatchProgress'),

    updateProgress(current, total, url, title) {
        const percentage = (current / total) * 100;
        this.bar.style.width = `${percentage}%`;
        this.count.textContent = `${current}/${total}`;
        this.currentUrl.textContent = title || url;
    },

    showCancelButton() {
        this.cancelBtn.style.display = 'block';
        this.cancelBtn.disabled = false;
        this.cancelBtn.textContent = 'Cancel';
    },

    hideCancelButton() {
        this.cancelBtn.style.display = 'none';
    },
    
    setStatus(status) {
        this.status.textContent = status;
    }
};

let darkMode = window.matchMedia('(prefers-color-scheme: dark)').matches;

// Theme application
const EDITOR_THEME_MAP = {
    default:   { dark: 'xq-dark',        light: 'xq-light' },
    dracula:   { dark: 'dracula',         light: 'dracula' },
    material:  { dark: 'material-darker', light: 'material' },
    monokai:   { dark: 'monokai',         light: 'xq-light' },
    nord:      { dark: 'nord',            light: 'xq-light' },
    solarized: { dark: 'solarized dark',  light: 'solarized light' },
    twilight:  { dark: 'twilight',         light: 'xq-light' },
};

function resolveEditorTheme(editorTheme, isDark) {
    const entry = EDITOR_THEME_MAP[editorTheme] || EDITOR_THEME_MAP.default;
    return isDark ? entry.dark : entry.light;
}

function applyThemeSettings(options) {
    const root = document.documentElement;

    // Apply theme mode
    root.classList.remove('theme-light', 'theme-dark', 'theme-system');
    root.classList.add('theme-' + (options.popupTheme || 'system'));

    // Apply accent color
    root.classList.remove('accent-sage', 'accent-ocean', 'accent-slate', 'accent-rose', 'accent-amber');
    const accent = options.popupAccent || 'sage';
    if (accent !== 'sage') {
        root.classList.add('accent-' + accent);
    }

    // Compact mode
    document.body.classList.toggle('compact-mode', !!options.compactMode);

    // Update CodeMirror theme based on resolved dark mode + editor theme
    const isDark = options.popupTheme === 'dark' ||
        (options.popupTheme !== 'light' && window.matchMedia('(prefers-color-scheme: dark)').matches);
    darkMode = isDark;
    if (typeof cm !== 'undefined' && cm) {
        cm.setOption('theme', resolveEditorTheme(options.editorTheme || 'default', isDark));
    }
}

// Char/word/token counter
const COUNT_MODES = ['chars', 'words', 'tokens'];
let countMode = 'chars';
let _lastCounterText = '';

function estimateTokens(text) {
    if (!text) return 0;

    let total = 0;

    // 1. Markdown links & images: [text](url) — count URL part at URL rate
    text = text.replace(/!?\[([^\]]*)\]\((https?:\/\/[^\s\)]+)\)/g, (_, label, url) => {
        total += Math.ceil(url.length / 2.5);  // URL tokens
        total += 2;                             // [] () syntax tokens
        return label;                           // label counted as prose later
    });

    // 2. Standalone URLs (~2.5 chars/token — paths & domains split into many pieces)
    text = text.replace(/https?:\/\/[^\s\)>\]]+/g, (url) => {
        total += Math.ceil(url.length / 2.5);
        return '';
    });

    // 3. Fenced code blocks (~3 chars/token — symbols & short identifiers tokenize densely)
    text = text.replace(/```[\s\S]*?```/g, (block) => {
        total += Math.ceil(block.length / 3);
        return '';
    });

    // 4. Inline code (~3.5 chars/token)
    text = text.replace(/`[^`\n]+`/g, (code) => {
        total += Math.ceil(code.length / 3.5);
        return '';
    });

    // 5. HTML entities (&amp; &lt; &#123; etc.) — each is typically 1 token
    text = text.replace(/&(?:#\d+|#x[\da-fA-F]+|[a-zA-Z]+);/g, () => {
        total += 1;
        return '';
    });

    // 6. Non-ASCII / Unicode (CJK, emoji, accented chars — often 1-3 tokens per character)
    text = text.replace(/[^\x00-\x7F]+/g, (chunk) => {
        total += Math.ceil(chunk.length * 1.5);
        return '';
    });

    // 7. Standalone numbers & dates (each digit group ≈ 1-2 tokens)
    text = text.replace(/\b\d[\d.,:\-\/]*\b/g, (num) => {
        total += Math.ceil(num.length / 2);
        return '';
    });

    // 8. Markdown heading markers, bold/italic, list bullets, blockquote markers
    //    (##, **, __, *, -, >) — each marker is ~1 token
    text = text.replace(/^#{1,6}\s/gm, () => { total += 1; return ''; });
    text = text.replace(/(\*{1,3}|_{1,3})/g, () => { total += 1; return ''; });
    text = text.replace(/^[\-\*\+]\s/gm, () => { total += 1; return ''; });
    text = text.replace(/^\d+\.\s/gm, () => { total += 1; return ''; });
    text = text.replace(/^>\s?/gm, () => { total += 1; return ''; });

    // 9. Remaining prose (~4 chars/token)
    const remaining = text.replace(/\s+/g, ' ').trim();
    if (remaining.length > 0) {
        total += Math.ceil(remaining.length / 4);
    }

    return total;
}

function updateCharCount(value) {
    _lastCounterText = value;
    const charCountEl = document.getElementById('char-count');
    if (!charCountEl) return;
    let display;
    if (countMode === 'chars') {
        display = value.length.toLocaleString() + ' chars';
    } else if (countMode === 'words') {
        const words = value.trim() === '' ? 0 : value.trim().split(/\s+/).length;
        display = words.toLocaleString() + ' words';
    } else {
        display = estimateTokens(value).toLocaleString() + ' tokens';
    }
    charCountEl.textContent = display;
}

document.getElementById('char-count').addEventListener('click', () => {
    const idx = COUNT_MODES.indexOf(countMode);
    countMode = COUNT_MODES[(idx + 1) % COUNT_MODES.length];
    updateCharCount(_lastCounterText);
    browser.storage.local.set({ countMode });
});

// Restore persisted count mode
browser.storage.local.get('countMode').then(data => {
    if (data.countMode && COUNT_MODES.includes(data.countMode)) {
        countMode = data.countMode;
    }
});

// set up event handlers
const cm = CodeMirror.fromTextArea(document.getElementById("md"), {
    theme: resolveEditorTheme('default', darkMode),
    mode: "markdown",
    lineWrapping: true
});
cm.on("change", (instance) => {
    updateCharCount(instance.getValue());
});
cm.on("cursorActivity", (cm) => {
    const somethingSelected = cm.somethingSelected();
    var downloadSelectionButton = document.getElementById("downloadSelection");
    var copySelectionButton = document.getElementById("copySelection");

    if (somethingSelected) {
        if(downloadSelectionButton.style.display != "block") downloadSelectionButton.style.display = "block";
        if(copySelectionButton.style.display != "block") copySelectionButton.style.display = "block";
        updateCharCount(cm.getSelection());
    }
    else {
        if(downloadSelectionButton.style.display != "none") downloadSelectionButton.style.display = "none";
        if(copySelectionButton.style.display != "none") copySelectionButton.style.display = "none";
        updateCharCount(cm.getValue());
    }
});
document.getElementById("download").addEventListener("click", download);
document.getElementById("downloadSelection").addEventListener("click", downloadSelection);

document.getElementById("copy").addEventListener("click", copyToClipboard);
document.getElementById("copySelection").addEventListener("click", copySelectionToClipboard);

document.getElementById("sendToObsidian").addEventListener("click", sendToObsidian);

document.getElementById("batchProcess").addEventListener("click", showBatchProcess);
document.getElementById("convertUrls").addEventListener("click", handleBatchConversion);
document.getElementById("cancelBatch").addEventListener("click", hideBatchProcess);
document.getElementById("pickLinks").addEventListener("click", activateLinkPicker);
document.getElementById("batchSaveModeToggle").addEventListener("change", saveBatchSettings);
document.getElementById("cancelBatchProgress").addEventListener("click", () => {
    browser.runtime.sendMessage({ type: 'cancel-batch' }).catch(() => {});
    document.getElementById("cancelBatchProgress").disabled = true;
    document.getElementById("cancelBatchProgress").textContent = 'Cancelling...';
});

function getSelectedBatchSaveMode() {
    const toggle = document.getElementById("batchSaveModeToggle");
    return toggle?.checked ? 'individual' : 'zip';
}

function setSelectedBatchSaveMode(mode) {
    const toggle = document.getElementById("batchSaveModeToggle");
    if (toggle) toggle.checked = mode === 'individual';
}

// Save batch settings to storage
function saveBatchSettings() {
    const urlList = document.getElementById("urlList").value;
    const batchSaveMode = getSelectedBatchSaveMode();
    browser.storage.local.set({
        batchUrlList: urlList,
        batchSaveMode
    }).catch(err => {
        console.error("Error saving batch settings:", err);
    });
}

// Load batch settings from storage
async function loadBatchSettings() {
    try {
        const data = await browser.storage.local.get(['batchUrlList', 'batchSaveMode']);
        if (data.batchUrlList) {
            document.getElementById("urlList").value = data.batchUrlList;
        }
        setSelectedBatchSaveMode(data.batchSaveMode || 'zip');
        validateAndPreviewUrls();
    } catch (err) {
        console.error("Error loading batch settings:", err);
    }
}

// Save batch URL list as user types and validate
document.getElementById("urlList").addEventListener("input", () => {
    saveBatchSettings();
    debouncedValidateUrls();
});

async function showBatchProcess(e) {
    e.preventDefault();
    document.getElementById("container").style.display = 'none';
    document.getElementById("batchContainer").style.display = 'flex';

    // Check if there are pending link picker results from storage
    try {
        const result = await browser.storage.local.get(['linkPickerResults', 'linkPickerTimestamp']);
        if (result.linkPickerResults && result.linkPickerResults.length > 0) {
            // Check if results are recent (within last 30 seconds)
            const age = Date.now() - (result.linkPickerTimestamp || 0);
            if (age < 30000) {
                console.log(`Found ${result.linkPickerResults.length} links from link picker`);
                handleLinkPickerComplete(result.linkPickerResults);
                // Clear the stored results after using them
                await browser.storage.local.remove(['linkPickerResults', 'linkPickerTimestamp']);
            }
        }
    } catch (err) {
        console.error("Error checking for link picker results:", err);
    }
}

function hideBatchProcess(e) {
    e.preventDefault();
    document.getElementById("container").style.display = 'flex';
    document.getElementById("batchContainer").style.display = 'none';
}

async function activateLinkPicker(e) {
    e.preventDefault();

    try {
        // Get the current active tab
        const tabs = await browser.tabs.query({ currentWindow: true, active: true });
        if (!tabs || tabs.length === 0) {
            console.error("No active tab found");
            return;
        }

        const activeTab = tabs[0];

        // Ensure content script is injected
        await browser.scripting.executeScript({
            target: { tabId: activeTab.id },
            files: ["/browser-polyfill.min.js", "/contentScript/contentScript.js"]
        }).catch(err => {
            // Script might already be injected, that's okay
            console.log("Content script may already be injected:", err);
        });

        // Send message to activate link picker mode
        await browser.tabs.sendMessage(activeTab.id, {
            type: "ACTIVATE_LINK_PICKER"
        });

        // Focus the tab to bring it to front
        await browser.tabs.update(activeTab.id, { active: true });

    } catch (error) {
        console.error("Error activating link picker:", error);
        alert("Failed to activate link picker. Please try again.");
    }
}

const defaultOptions = {
    includeTemplate: false,
    clipSelection: true,
    downloadImages: false,
    obsidianIntegration: false,
    popupTheme: 'system',
    popupAccent: 'sage',
    compactMode: false,
    editorTheme: 'default',
}

const updateObsidianButtonVisibility = (options) => {
    const obsidianButton = document.getElementById("sendToObsidian");
    if (!obsidianButton) return;
    obsidianButton.style.display = options.obsidianIntegration ? "inline-flex" : "none";
}

function getPopupBatchUtilsApi() {
    return globalThis.markSnipPopupBatchUtils || null;
}

// Function to parse markdown links
function parseMarkdownLink(text) {
    const sharedApi = getPopupBatchUtilsApi();
    if (sharedApi?.parseMarkdownLink) {
        return sharedApi.parseMarkdownLink(text);
    }

    const markdownLinkRegex = /\[([^\]]+)\]\(([^)]+)\)/;
    const match = text.match(markdownLinkRegex);
    if (match) {
        return {
            title: match[1].trim(),
            url: match[2].trim()
        };
    }
    return null;
}

// Function to validate and normalize URL
function normalizeUrl(url) {
    const sharedApi = getPopupBatchUtilsApi();
    if (sharedApi?.normalizeUrl) {
        return sharedApi.normalizeUrl(url);
    }

    // Add https:// if no protocol specified
    if (!/^https?:\/\//i.test(url)) {
        url = 'https://' + url;
    }
    
    try {
        const urlObj = new URL(url);
        return urlObj.href;
    } catch (e) {
        return null;
    }
}

// Function to process URLs from textarea
function processUrlInput(text) {
    const sharedApi = getPopupBatchUtilsApi();
    if (sharedApi?.processUrlInput) {
        return sharedApi.processUrlInput(text);
    }

    const lines = text.split('\n').map(line => line.trim()).filter(line => line);
    const urlObjects = [];

    for (const line of lines) {
        // Try to parse as markdown link first
        const mdLink = parseMarkdownLink(line);
        
        if (mdLink) {
            const normalizedUrl = normalizeUrl(mdLink.url);
            if (normalizedUrl) {
                urlObjects.push({
                    title: mdLink.title,
                    url: normalizedUrl
                });
            }
        } else if (line) {
            // Try as regular URL
            const normalizedUrl = normalizeUrl(line);
            if (normalizedUrl) {
                urlObjects.push({
                    title: null, // Will be extracted from page
                    url: normalizedUrl
                });
            }
        }
    }

    return urlObjects;
}

// URL validation preview
let _urlValidationTimer = null;

function validateAndPreviewUrls() {
    const urlValidation = document.getElementById('urlValidation');
    const convertBtn = document.getElementById('convertUrls');
    const text = document.getElementById('urlList').value;
    const lines = text.split('\n').map(l => l.trim()).filter(l => l);
    const sharedApi = getPopupBatchUtilsApi();
    const summary = sharedApi?.summarizeUrlValidation
        ? sharedApi.summarizeUrlValidation(text)
        : null;

    if ((summary?.totalLines ?? lines.length) === 0) {
        urlValidation.style.display = 'none';
        convertBtn.disabled = false;
        return;
    }

    let validCount = summary?.validCount;
    let invalidCount = summary?.invalidCount;

    if (validCount == null || invalidCount == null) {
        validCount = 0;
        invalidCount = 0;

        for (const line of lines) {
            const mdLink = parseMarkdownLink(line);
            const url = mdLink ? normalizeUrl(mdLink.url) : normalizeUrl(line);
            if (url) {
                validCount++;
            } else {
                invalidCount++;
            }
        }
    }

    urlValidation.style.display = 'block';
    urlValidation.classList.remove('has-invalid', 'all-invalid');

    if (validCount === 0) {
        urlValidation.textContent = `${invalidCount} invalid line${invalidCount !== 1 ? 's' : ''} — no valid URLs`;
        urlValidation.classList.add('all-invalid');
        convertBtn.disabled = true;
    } else if (invalidCount > 0) {
        urlValidation.textContent = `${validCount} valid URL${validCount !== 1 ? 's' : ''}, ${invalidCount} invalid line${invalidCount !== 1 ? 's' : ''}`;
        urlValidation.classList.add('has-invalid');
        convertBtn.disabled = false;
    } else {
        urlValidation.textContent = `${validCount} valid URL${validCount !== 1 ? 's' : ''}`;
        convertBtn.disabled = false;
    }
}

function debouncedValidateUrls() {
    clearTimeout(_urlValidationTimer);
    _urlValidationTimer = setTimeout(validateAndPreviewUrls, 300);
}

// Wait for dynamically-rendered pages to populate meaningful content before clipping.
// Some docs sites report `status: complete` before the main article hydrates.
async function waitForTabContentReady(tabId, maxWaitMs = 12000, pollIntervalMs = 500) {
    const start = Date.now();
    let previousTextLength = 0;
    let stablePolls = 0;

    while (Date.now() - start < maxWaitMs) {
        try {
            const results = await browser.scripting.executeScript({
                target: { tabId },
                func: () => {
                    const root = document.querySelector('main, article, [role="main"]') || document.body;
                    const text = (root?.innerText || '').replace(/\s+/g, ' ').trim();

                    return {
                        readyState: document.readyState,
                        textLength: text.length,
                        paragraphCount: root ? root.querySelectorAll('p').length : 0,
                        headingCount: root ? root.querySelectorAll('h1, h2, h3').length : 0
                    };
                }
            });

            const snapshot = results?.[0]?.result;
            if (snapshot) {
                const elapsed = Date.now() - start;
                const lengthStable = Math.abs(snapshot.textLength - previousTextLength) < 40;
                stablePolls = lengthStable ? stablePolls + 1 : 0;

                const richContentStable =
                    snapshot.textLength >= 900 &&
                    stablePolls >= 2 &&
                    elapsed >= 2000;

                const shortPageStable =
                    snapshot.textLength >= 120 &&
                    snapshot.paragraphCount >= 1 &&
                    stablePolls >= 3 &&
                    elapsed >= 2000;

                if (snapshot.readyState === 'complete' && (richContentStable || shortPageStable)) {
                    return;
                }

                previousTextLength = snapshot.textLength;
            }
        } catch (error) {
            // Ignore intermittent scripting issues and continue polling until timeout.
            console.debug(`Content readiness check failed for tab ${tabId}:`, error);
        }

        await new Promise(resolve => setTimeout(resolve, pollIntervalMs));
    }
}

async function waitForTabLoadComplete(tabId, timeoutMs = 30000) {
    return new Promise((resolve, reject) => {
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
}

async function activateTabForCapture(tabId, settleMs = 1500) {
    await browser.tabs.update(tabId, { active: true });
    if (settleMs > 0) {
        await new Promise(resolve => setTimeout(resolve, settleMs));
    }
}

function isLikelyIncompleteMarkdown(markdown) {
    const sharedApi = getPopupBatchUtilsApi();
    if (sharedApi?.isLikelyIncompleteMarkdown) {
        return sharedApi.isLikelyIncompleteMarkdown(markdown);
    }

    if (!markdown || !markdown.trim()) return true;

    const normalized = markdown.replace(/\r/g, '');
    const lines = normalized.split('\n').map(line => line.trim()).filter(Boolean);
    const headingLines = lines.filter(line => /^#{1,6}\s/.test(line)).length;
    const listLines = lines.filter(line => /^[-*+]\s/.test(line)).length;
    const nonStructuralLines = lines.filter(line => (
        !/^#{1,6}\s/.test(line) &&
        !/^[-*+]\s/.test(line) &&
        !/^\d+\.\s/.test(line) &&
        !/^>\s/.test(line) &&
        !/^!\[/.test(line)
    ));
    const nonStructuralChars = nonStructuralLines.join(' ').replace(/`/g, '').trim().length;
    const hasTocMarker = /\bOn this page\b/i.test(normalized) || /\bTable of contents\b/i.test(normalized);

    return (
        nonStructuralChars < 320 &&
        (headingLines + listLines) >= 4
    ) || (
        hasTocMarker &&
        nonStructuralChars < 500
    );
}

async function clipTabWithRetry(tab, maxAttempts = 2) {
    let lastMessage = null;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        const displayMdPromise = new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
                browser.runtime.onMessage.removeListener(messageListener);
                reject(new Error('Timeout waiting for markdown generation'));
            }, 45000);

            function messageListener(message) {
                if (message.type === "display.md") {
                    clearTimeout(timeout);
                    browser.runtime.onMessage.removeListener(messageListener);

                    if (tab.customTitle) {
                        message.article.title = tab.customTitle;
                    }

                    cm.setValue(message.markdown);
                    updateCharCount(message.markdown);
                    document.getElementById("title").value = message.article.title;
                    imageList = message.imageList;
                    sourceImageMap = message.sourceImageMap;
                    mdClipsFolder = message.mdClipsFolder;

                    resolve(message);
                }
            }

            browser.runtime.onMessage.addListener(messageListener);
        });

        await waitForTabContentReady(tab.id, attempt === 1 ? 12000 : 20000, 500);
        await clipSite(tab.id);
        lastMessage = await displayMdPromise;

        const markdownLength = (lastMessage?.markdown || '').length;
        const incomplete = isLikelyIncompleteMarkdown(lastMessage.markdown);
        console.log(`[Batch] Tab ${tab.id} attempt ${attempt}/${maxAttempts}: markdownLength=${markdownLength}, incomplete=${incomplete}`);

        if (!incomplete) {
            return lastMessage;
        }

        if (attempt < maxAttempts) {
            progressUI.setStatus(`Detected partial content. Retrying ${attempt + 1}/${maxAttempts}...`);
            await browser.tabs.reload(tab.id);
            await waitForTabLoadComplete(tab.id, 45000);
            await browser.scripting.executeScript({
                target: { tabId: tab.id },
                files: ["/browser-polyfill.min.js", "/contentScript/contentScript.js"]
            });
        }
    }

    return lastMessage;
}

async function handleBatchConversion(e) {
    e.preventDefault();
    
    const urlText = document.getElementById("urlList").value;
    const urlObjects = processUrlInput(urlText);
    
    if (urlObjects.length === 0) {
        showError("Please enter valid URLs or markdown links (one per line)", false);
        return;
    }
    const batchSaveMode = getSelectedBatchSaveMode();

    // Default path: run batch in service worker so popup lifecycle doesn't interrupt processing.
    // Keep inline mode for e2e tests by setting window.__MARKSNIP_FORCE_INLINE_BATCH__ = true.
    if (!window.__MARKSNIP_FORCE_INLINE_BATCH__) {
        document.getElementById("spinner").style.display = 'flex';
        document.getElementById("convertUrls").style.display = 'none';
        progressUI.show();
        progressUI.reset();
        progressUI.setStatus('Starting background batch...');

        try {
            const activeTabs = await browser.tabs.query({
                currentWindow: true,
                active: true
            });
            const originalTabId = activeTabs?.[0]?.id || null;

            browser.runtime.sendMessage({
                type: 'start-batch-conversion',
                urlObjects,
                originalTabId,
                batchSaveMode
            }).catch(error => {
                console.error('Background batch failed to start:', error);
            });

            progressUI.setStatus('Batch started. Tabs will be visited automatically.');
            setTimeout(() => window.close(), 350);
        } catch (error) {
            console.error('Failed to start background batch:', error);
            progressUI.setStatus(`Error: ${error.message}`);
            document.getElementById("spinner").style.display = 'none';
            document.getElementById("convertUrls").style.display = 'block';
        }
        return;
    }

    document.getElementById("spinner").style.display = 'flex';
    document.getElementById("convertUrls").style.display = 'none';
    progressUI.show();
    progressUI.reset();

    let originalTabId = null;
    const restoreOriginalTab = async () => {
        if (originalTabId) {
            await browser.tabs.update(originalTabId, { active: true }).catch(() => {});
        }
    };

    try {
        const currentTabs = await browser.tabs.query({
            currentWindow: true,
            active: true
        });
        originalTabId = currentTabs?.[0]?.id || null;

        const total = urlObjects.length;
        let current = 0;
        
        console.log('Starting batch conversion...');

        for (const urlObj of urlObjects) {
            let tab = null;
            try {
                current++;
                progressUI.updateProgress(current, total, `Loading: ${urlObj.url}`);
                progressUI.setStatus('Loading pages...');

                console.log(`Creating tab for ${urlObj.url}`);
                tab = await browser.tabs.create({
                    url: urlObj.url,
                    active: true
                });

                if (urlObj.title) {
                    tab.customTitle = urlObj.title;
                }

                await waitForTabLoadComplete(tab.id, 45000);

                await browser.scripting.executeScript({
                    target: { tabId: tab.id },
                    files: ["/browser-polyfill.min.js", "/contentScript/contentScript.js"]
                });

                await activateTabForCapture(tab.id, 1500);

                progressUI.updateProgress(current, total, `Converting: ${urlObj.url}`);
                progressUI.setStatus('Converting pages to Markdown...');
                console.log(`Processing tab ${tab.id}`);

                const message = await clipTabWithRetry(tab, 2);
                await sendDownloadMessage(message?.markdown || cm.getValue());

            } catch (error) {
                console.error(`Error processing URL ${urlObj.url}:`, error);
                progressUI.setStatus(`Error: ${error.message}`);
                await new Promise(resolve => setTimeout(resolve, 2000)); // Show error briefly
            } finally {
                if (tab && tab.id) {
                    await browser.tabs.remove(tab.id).catch(() => {});
                }
            }
        }

        progressUI.setStatus('Complete!');
        await new Promise(resolve => setTimeout(resolve, 1000)); // Show completion briefly

        // Clear saved batch URLs after successful completion
        await browser.storage.local.remove('batchUrlList');

        await restoreOriginalTab();

        console.log('Batch conversion complete');
        hideBatchProcess(e);
        window.close();

    } catch (error) {
        await restoreOriginalTab();
        console.error('Batch processing error:', error);
        progressUI.setStatus(`Error: ${error.message}`);
        document.getElementById("spinner").style.display = 'none';
        document.getElementById("convertUrls").style.display = 'block';
    }
}

const checkInitialSettings = options => {
    // Apply theme settings
    applyThemeSettings(options);

    // Set checkbox states
    document.querySelector("#includeTemplate").checked = options.includeTemplate || false;
    document.querySelector("#downloadImages").checked = options.downloadImages || false;
    updateObsidianButtonVisibility(options);

    // Set segmented control state
    setClipSelectionState(options.clipSelection);
}

const setClipSelectionState = clipSelection => {
    const selectedButton = document.querySelector("#selected");
    const documentButton = document.querySelector("#document");

    selectedButton.classList.toggle("active", clipSelection);
    selectedButton.setAttribute("aria-pressed", String(clipSelection));

    documentButton.classList.toggle("active", !clipSelection);
    documentButton.setAttribute("aria-pressed", String(!clipSelection));
}

const setClipSelection = (options, clipSelection) => {
    if (options.clipSelection === clipSelection) {
        setClipSelectionState(clipSelection);
        return;
    }

    options.clipSelection = clipSelection;
    setClipSelectionState(clipSelection);
    browser.storage.sync.set(options).then(() => clipSite()).catch((error) => {
        console.error(error);
    });
}

const toggleIncludeTemplate = options => {
    const el = document.getElementById("includeTemplate");
    if (el) {
        options.includeTemplate = el.checked;
    }

    browser.storage.sync.set(options).then(() => {
        // Re-clip the site to update the preview
        return browser.tabs.query({ currentWindow: true, active: true });
    }).then((tabs) => {
        if (tabs && tabs[0]) {
            return clipSite(tabs[0].id);
        }
    }).catch((error) => {
        console.error("Error toggling include template:", error);
    });
}

const toggleDownloadImages = options => {
    const el = document.getElementById("downloadImages");
    if (el) {
        options.downloadImages = el.checked;
    }

    browser.storage.sync.set(options).catch((error) => {
        console.error("Error updating options:", error);
    });
}

const showOrHideClipOption = selection => {
    if (selection) {
        document.getElementById("clipOption").style.display = "flex";
    }
    else {
        document.getElementById("clipOption").style.display = "none";
    }
}

// Updated clipSite function to use scripting API
const clipSite = id => {
    // If no id is provided, get the active tab's id first
    if (!id) {
        return browser.tabs.query({
            currentWindow: true,
            active: true
        }).then(tabs => {
            if (tabs && tabs.length > 0) {
                return clipSite(tabs[0].id);
            }
            throw new Error("No active tab found");
        });
    }

    // Rest of the function remains the same
    return browser.scripting.executeScript({
        target: { tabId: id },
        func: async () => {
            if (typeof marksnipPrepareForCapture === 'function') {
                await marksnipPrepareForCapture();
            }
            if (typeof getSelectionAndDom === 'function') {
                return getSelectionAndDom();
            }
            return null;
        }
    })
    .then((result) => {
        if (result && result[0]?.result) {
            showOrHideClipOption(result[0].result.selection);
            let message = {
                type: "clip",
                dom: result[0].result.dom,
                selection: result[0].result.selection,
                pageUrl: result[0].result.pageUrl || null
            }
            return browser.storage.sync.get(defaultOptions).then(options => {
                browser.runtime.sendMessage({
                    ...message,
                    ...options
                });
            }).catch(err => {
                console.error(err);
                showError(err)
                return browser.runtime.sendMessage({
                    ...message,
                    ...defaultOptions
                });
            });
        }
    }).catch(err => {
        console.error(err);
        showError(err)
    });
}

// Inject the necessary scripts - updated for Manifest V3
browser.storage.sync.get(defaultOptions).then(options => {
    checkInitialSettings(options);

    // Load batch settings from storage
    loadBatchSettings();

    // Check for in-progress batch and auto-switch to batch view
    browser.runtime.sendMessage({ type: 'get-batch-state' }).then(state => {
        if (state && ['started', 'loading', 'converting', 'retrying'].includes(state.status)) {
            document.getElementById("container").style.display = 'none';
            document.getElementById("batchContainer").style.display = 'flex';
            document.getElementById("spinner").style.display = 'none';
            progressUI.show();
            progressUI.showCancelButton();
            const current = state.current || 0;
            const total = state.total || 0;
            if (total > 0) {
                progressUI.updateProgress(current, total, state.url || '', state.pageTitle || null);
            }
            progressUI.setStatus(state.status === 'loading' ? 'Loading page...' :
                                 state.status === 'converting' ? 'Converting page...' :
                                 state.status === 'retrying' ? 'Retrying page capture...' : 'Processing...');
        }
    }).catch(() => {});

    // Set up event listeners (unchanged)
    document.getElementById("selected").addEventListener("click", (e) => {
        e.preventDefault();
        setClipSelection(options, true);
    });
    document.getElementById("document").addEventListener("click", (e) => {
        e.preventDefault();
        setClipSelection(options, false);
    });
    document.getElementById("includeTemplate").addEventListener("click", () => {
        toggleIncludeTemplate(options);
    });
    document.getElementById("downloadImages").addEventListener("click", () => {
        toggleDownloadImages(options);
    });
    
    return browser.tabs.query({
        currentWindow: true,
        active: true
    });
}).then((tabs) => {
    var id = tabs[0].id;
    var url = tabs[0].url;
    
    // Use scripting API instead of executeScript
    browser.scripting.executeScript({
        target: { tabId: id },
        files: ["/browser-polyfill.min.js"]
    })
    .then(() => {
        return browser.scripting.executeScript({
            target: { tabId: id },
            files: ["/contentScript/contentScript.js"]
        });
    }).then(() => {
        console.info("Successfully injected MarkSnip content script");
        return clipSite(id);
    }).catch((error) => {
        console.error(error);
        showError(error);
    });
});

// listen for notifications from the background page
browser.runtime.onMessage.addListener(notify);

browser.storage.onChanged.addListener((changes, areaName) => {
    if (areaName !== "sync" || !changes.obsidianIntegration) return;
    updateObsidianButtonVisibility({ obsidianIntegration: changes.obsidianIntegration.newValue });
});

// Listen for link picker results
browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === "LINK_PICKER_COMPLETE") {
        handleLinkPickerComplete(message.links);
    }
});

function handleLinkPickerComplete(links) {
    if (!links || links.length === 0) {
        console.log("No links collected");
        return;
    }

    // Get current textarea value
    const urlListTextarea = document.getElementById("urlList");
    const currentUrls = urlListTextarea.value.trim();

    // Combine existing URLs with new ones (deduplicate)
    const existingUrls = currentUrls ? currentUrls.split('\n') : [];
    const allUrls = [...new Set([...existingUrls, ...links])];

    // Update textarea
    urlListTextarea.value = allUrls.join('\n');

    // Save to storage
    saveBatchSettings();
    validateAndPreviewUrls();

    // Show success message
    console.log(`Added ${links.length} links to batch processor`);

    // Optional: Show temporary success indicator
    const pickLinksBtn = document.getElementById("pickLinks");
    const originalText = pickLinksBtn.innerHTML;
    pickLinksBtn.innerHTML = `
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="20 6 9 17 4 12"/>
        </svg>
        Added ${links.length} links!
    `;
    pickLinksBtn.classList.add("success");

    setTimeout(() => {
        pickLinksBtn.innerHTML = originalText;
        pickLinksBtn.classList.remove("success");
    }, 2000);
}

//function to send the download message to the background page
function sendDownloadMessage(text) {
    if (text != null) {

        return browser.tabs.query({
            currentWindow: true,
            active: true
        }).then(tabs => {
            var message = {
                type: "download",
                markdown: text,
                title: document.getElementById("title").value,
                tab: tabs[0],
                imageList: imageList,
                mdClipsFolder: mdClipsFolder
            };
            return browser.runtime.sendMessage(message);
        });
    }
}

// Download event handler - updated to use promises
async function download(e) {
    e.preventDefault();
    try {
        await sendDownloadMessage(cm.getValue());
        window.close();
    } catch (error) {
        console.error("Error sending download message:", error);
    }
}

// Download selection handler - updated to use promises
async function downloadSelection(e) {
    e.preventDefault();
    if (cm.somethingSelected()) {
        try {
            await sendDownloadMessage(cm.getSelection());
        } catch (error) {
            console.error("Error sending selection download message:", error);
        }
    }
}

async function recordSuccessfulCopyMetric() {
    const tabs = await browser.tabs.query({
        currentWindow: true,
        active: true
    }).catch(() => []);
    const tabId = tabs?.[0]?.id ?? null;

    return browser.runtime.sendMessage({
        type: 'record-notification-metrics',
        tabId,
        delta: {
            copies: 1,
            exports: 1
        }
    }).catch(() => {});
}

// Function to handle copying text to clipboard
async function copyToClipboard(e) {
    e.preventDefault();
    const copyButton = document.getElementById("copy");
    if (!cm || !copyButton) return;

    try {
        const hasSelection = cm.somethingSelected();
        const textToCopy = hasSelection ? cm.getSelection() : cm.getValue();

        if (!textToCopy.trim()) {
            return;
        }

        await navigator.clipboard.writeText(textToCopy);
        await recordSuccessfulCopyMetric();

        // Show success feedback
        const originalHTML = copyButton.innerHTML;
        copyButton.innerHTML = `
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="20 6 9 17 4 12"/>
            </svg>
            Copied!
        `;
        copyButton.classList.add("success");

        // Reset button after 2 seconds
        setTimeout(() => {
            copyButton.innerHTML = originalHTML;
            copyButton.classList.remove("success");
        }, 2000);

    } catch (error) {
        console.error('Failed to copy text:', error);

        // Show error feedback
        const originalHTML = copyButton.innerHTML;
        copyButton.innerHTML = `
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                <path d="M13,13H11V7H13M13,17H11V15H13M12,2A10,10 0 0,0 2,12A10,10 0 0,0 12,22A10,10 0 0,0 22,12A10,10 0 0,0 12,2Z"/>
            </svg>
            Failed
        `;
        copyButton.classList.add("error");

        setTimeout(() => {
            copyButton.innerHTML = originalHTML;
            copyButton.classList.remove("error");
        }, 2000);
    }
}

function copySelectionToClipboard(e) {
    e.preventDefault();
    const copySelButton = document.getElementById("copySelection");
    if (!cm || !cm.somethingSelected() || !copySelButton) return;

    const selectedText = cm.getSelection();
    navigator.clipboard.writeText(selectedText).then(async () => {
        await recordSuccessfulCopyMetric();

        // Show success feedback
        const originalHTML = copySelButton.innerHTML;
        copySelButton.innerHTML = `
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="20 6 9 17 4 12"/>
            </svg>
            Copied!
        `;
        copySelButton.classList.add("success");

        setTimeout(() => {
            copySelButton.innerHTML = originalHTML;
            copySelButton.classList.remove("success");
        }, 2000);
    }).catch(err => {
        console.error("Error copying selection:", err);
    });
}

// Function to send markdown to Obsidian
async function sendToObsidian(e) {
    e.preventDefault();
    const obsidianButton = document.getElementById("sendToObsidian");
    if (!obsidianButton) return;

    const originalHTML = obsidianButton.innerHTML;

    try {
        // Get current options including Obsidian settings
        const options = await browser.storage.sync.get();

        // Check if Obsidian integration is enabled
        if (!options.obsidianIntegration) {
            // Show error state
            obsidianButton.innerHTML = `
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M13,13H11V7H13M13,17H11V15H13M12,2A10,10 0 0,0 2,12A10,10 0 0,0 12,22A10,10 0 0,0 22,12A10,10 0 0,0 12,2Z"/>
                </svg>
                Not Enabled
            `;
            obsidianButton.classList.add("error");

            setTimeout(() => {
                obsidianButton.innerHTML = originalHTML;
                obsidianButton.classList.remove("error");
            }, 3000);
            return;
        }

        // Get markdown content
        const markdown = markSnipObsidian.prepareMarkdownForObsidian(
            cm.getValue(),
            sourceImageMap || {}
        );
        const title = document.getElementById("title").value || 'Untitled';

        // Get current tab
        const tabs = await browser.tabs.query({ currentWindow: true, active: true });
        const currentTab = tabs[0];

        // Send message to service worker to handle Obsidian integration
        await browser.runtime.sendMessage({
            type: 'obsidian-integration',
            markdown: markdown,
            tabId: currentTab.id,
            vault: options.obsidianVault || '',
            folder: options.obsidianFolder || '',
            title: title
        });

        // Show success state
        obsidianButton.innerHTML = `
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="20 6 9 17 4 12"/>
            </svg>
            Sent to Obsidian!
        `;
        obsidianButton.classList.add("success");

        // Close popup after showing success
        setTimeout(() => {
            window.close();
        }, 1500);

    } catch (error) {
        console.error('Error sending to Obsidian:', error);

        // Show error state
        obsidianButton.innerHTML = `
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                <path d="M13,13H11V7H13M13,17H11V15H13M12,2A10,10 0 0,0 2,12A10,10 0 0,0 12,22A10,10 0 0,0 22,12A10,10 0 0,0 12,2Z"/>
            </svg>
            Failed
        `;
        obsidianButton.classList.add("error");

        setTimeout(() => {
            obsidianButton.innerHTML = originalHTML;
            obsidianButton.classList.remove("error");
        }, 3000);
    }
}

//function that handles messages from the injected script into the site
function notify(message) {
    // message for displaying markdown
    if (message.type == "display.md") {

        // set the values from the message
        //document.getElementById("md").value = message.markdown;
        cm.setValue(message.markdown);
        document.getElementById("title").value = message.article.title;
        imageList = message.imageList;
        sourceImageMap = message.sourceImageMap;
        mdClipsFolder = message.mdClipsFolder;
        
        // show the hidden elements
        document.getElementById("container").style.display = 'flex';
        document.getElementById("spinner").style.display = 'none';
         // focus the download button
        document.getElementById("download").focus();
        cm.refresh();
    }
    else if (message.type === "batch-progress") {
        progressUI.show();

        const total = message.total || 0;
        const current = message.current || 0;
        const url = message.url || '';
        const pageTitle = message.pageTitle || null;

        if (total > 0) {
            progressUI.updateProgress(current, total, url, pageTitle);
        }

        switch (message.status) {
            case 'started':
                progressUI.setStatus(message.batchSaveMode === 'zip' ? 'Batch started (ZIP mode)...' : 'Batch started...');
                progressUI.showCancelButton();
                break;
            case 'loading':
                progressUI.setStatus('Loading page...');
                break;
            case 'converting':
                progressUI.setStatus('Converting page...');
                break;
            case 'retrying':
                progressUI.setStatus('Retrying page capture...');
                break;
            case 'zipping':
                progressUI.setStatus('Creating ZIP archive...');
                break;
            case 'warning':
                progressUI.setStatus(message.message || 'Warning during conversion');
                break;
            case 'item-error':
                progressUI.setStatus(`Error: ${message.error || 'Failed URL'}`);
                break;
            case 'cancelled':
                progressUI.setStatus('Batch cancelled');
                progressUI.hideCancelButton();
                document.getElementById("spinner").style.display = 'none';
                document.getElementById("convertUrls").style.display = 'block';
                break;
            case 'failed':
                progressUI.setStatus(`Batch failed: ${message.error || 'Unknown error'}`);
                progressUI.hideCancelButton();
                document.getElementById("spinner").style.display = 'none';
                document.getElementById("convertUrls").style.display = 'block';
                break;
            case 'finished':
                if (message.failed > 0) {
                    progressUI.setStatus(`Finished with ${message.failed} error(s)`);
                } else {
                    progressUI.setStatus(message.batchSaveMode === 'zip' ? 'ZIP downloaded' : 'Batch complete');
                }
                progressUI.hideCancelButton();
                document.getElementById("spinner").style.display = 'none';
                document.getElementById("convertUrls").style.display = 'block';
                break;
        }
    }
}

function showError(err, useEditor = true) {
    // show the hidden elements
    document.getElementById("container").style.display = 'flex';
    document.getElementById("spinner").style.display = 'none';
    
    if (useEditor) {
        // Original behavior - show error in CodeMirror
        cm.setValue(`Error clipping the page\n\n${err}`);
    } else {
        // Batch processing error - show in CodeMirror but don't disrupt UI
        const currentContent = cm.getValue();
        cm.setValue(`${currentContent}\n\nError: ${err}`);
    }
}
