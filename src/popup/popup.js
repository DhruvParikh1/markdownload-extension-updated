
// default variables
var selectedText = null;
var imageList = null;
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
    
    updateProgress(current, total, url) {
        const percentage = (current / total) * 100;
        this.bar.style.width = `${percentage}%`;
        this.count.textContent = `${current}/${total}`;
        this.currentUrl.textContent = url;
    },
    
    setStatus(status) {
        this.status.textContent = status;
    }
};

const darkMode = window.matchMedia('(prefers-color-scheme: dark)').matches;
// set up event handlers
const cm = CodeMirror.fromTextArea(document.getElementById("md"), {
    theme: darkMode ? "xq-dark" : "xq-light",
    mode: "markdown",
    lineWrapping: true
});
cm.on("cursorActivity", (cm) => {
    const somethingSelected = cm.somethingSelected();
    var downloadSelectionButton = document.getElementById("downloadSelection");
    var copySelectionButton = document.getElementById("copySelection");

    if (somethingSelected) {
        if(downloadSelectionButton.style.display != "block") downloadSelectionButton.style.display = "block";
        if(copySelectionButton.style.display != "block") copySelectionButton.style.display = "block";
    }
    else {
        if(downloadSelectionButton.style.display != "none") downloadSelectionButton.style.display = "none";
        if(copySelectionButton.style.display != "none") copySelectionButton.style.display = "none";
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
document.getElementById("multipleFiles").addEventListener("click", toggleBatchOutputMode);
document.getElementById("singleFile").addEventListener("click", toggleBatchOutputMode);

// Save batch URL list to storage
function saveBatchUrls() {
    const urlList = document.getElementById("urlList").value;
    browser.storage.local.set({ batchUrlList: urlList }).catch(err => {
        console.error("Error saving batch URL list:", err);
    });
}

// Load batch URL list from storage
async function loadBatchUrls() {
    try {
        const data = await browser.storage.local.get('batchUrlList');
        if (data.batchUrlList) {
            document.getElementById("urlList").value = data.batchUrlList;
        }
    } catch (err) {
        console.error("Error loading batch URL list:", err);
    }
}

// Add event listener to save URLs as user types
document.getElementById("urlList").addEventListener("input", saveBatchUrls);

async function showBatchProcess(e) {
    e.preventDefault();
    document.getElementById("container").style.display = 'none';
    document.getElementById("batchContainer").style.display = 'flex';

    // Load saved batch output mode preference
    try {
        const { batchOutputMode } = await browser.storage.local.get('batchOutputMode');
        const mode = batchOutputMode || 'multiple';
        const multipleBtn = document.getElementById("multipleFiles");
        const singleBtn = document.getElementById("singleFile");

        if (mode === 'multiple') {
            multipleBtn.classList.add("active");
            singleBtn.classList.remove("active");
        } else {
            singleBtn.classList.add("active");
            multipleBtn.classList.remove("active");
        }
    } catch (err) {
        console.error("Error loading batch output mode:", err);
    }

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

function toggleBatchOutputMode(e) {
    e.preventDefault();
    const multipleBtn = document.getElementById("multipleFiles");
    const singleBtn = document.getElementById("singleFile");

    if (e.target.id === "multipleFiles" || e.target.closest("#multipleFiles")) {
        multipleBtn.classList.add("active");
        singleBtn.classList.remove("active");
        browser.storage.local.set({ batchOutputMode: 'multiple' });
    } else {
        singleBtn.classList.add("active");
        multipleBtn.classList.remove("active");
        browser.storage.local.set({ batchOutputMode: 'single' });
    }
}

const defaultOptions = {
    includeTemplate: false,
    clipSelection: true,
    downloadImages: false
}

// Function to parse markdown links
function parseMarkdownLink(text) {
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

async function handleBatchConversion(e) {
    e.preventDefault();

    const urlText = document.getElementById("urlList").value;
    const urlObjects = processUrlInput(urlText);

    if (urlObjects.length === 0) {
        showError("Please enter valid URLs or markdown links (one per line)", false);
        return;
    }

    // Get output mode preference
    const { batchOutputMode } = await browser.storage.local.get('batchOutputMode');
    const outputMode = batchOutputMode || 'multiple';

    document.getElementById("spinner").style.display = 'flex';
    document.getElementById("convertUrls").style.display = 'none';
    progressUI.show();
    progressUI.reset();

    try {
        const tabs = [];
        const total = urlObjects.length;
        let current = 0;

        console.log(`Starting batch conversion in ${outputMode} mode...`);

        // Create and load all tabs
        for (const urlObj of urlObjects) {
            current++;
            progressUI.updateProgress(current, total, `Loading: ${urlObj.url}`);

            console.log(`Creating tab for ${urlObj.url}`);
            const tab = await browser.tabs.create({
                url: urlObj.url,
                active: false
            });

            if (urlObj.title) {
                tab.customTitle = urlObj.title;
            }

            tabs.push(tab);

            // Wait for tab load
            await new Promise((resolve, reject) => {
                const timeout = setTimeout(() => {
                    reject(new Error(`Timeout loading ${urlObj.url}`));
                }, 30000);

                function listener(tabId, info) {
                    if (tabId === tab.id && info.status === 'complete') {
                        clearTimeout(timeout);
                        browser.tabs.onUpdated.removeListener(listener);
                        console.log(`Tab ${tabId} loaded`);
                        resolve();
                    }
                }
                browser.tabs.onUpdated.addListener(listener);
            });

            // Ensure scripts are injected
            await browser.scripting.executeScript({
                target: { tabId: tab.id },
                files: ["/browser-polyfill.min.js", "/contentScript/contentScript.js"]
            });
        }

        // Reset progress for processing phase
        current = 0;
        progressUI.setStatus('Converting pages to Markdown...');

        // Collect all markdown content if in single file mode
        const collectedContent = [];

        // Process each tab
        for (const tab of tabs) {
            try {
                current++;
                progressUI.updateProgress(current, total, `Converting: ${tab.url}`);
                console.log(`Processing tab ${tab.id}`);

                const displayMdPromise = new Promise((resolve, reject) => {
                    const timeout = setTimeout(() => {
                        reject(new Error('Timeout waiting for markdown generation'));
                    }, 30000);

                    function messageListener(message) {
                        if (message.type === "display.md") {
                            clearTimeout(timeout);
                            browser.runtime.onMessage.removeListener(messageListener);
                            console.log(`Received markdown for tab ${tab.id}`);

                            if (tab.customTitle) {
                                message.article.title = tab.customTitle;
                            }

                            resolve({
                                markdown: message.markdown,
                                title: message.article.title,
                                url: tab.url,
                                imageList: message.imageList,
                                mdClipsFolder: message.mdClipsFolder
                            });
                        }
                    }

                    browser.runtime.onMessage.addListener(messageListener);
                });

                await clipSite(tab.id);
                const result = await displayMdPromise;

                if (outputMode === 'single') {
                    // Collect content for single file mode
                    collectedContent.push(result);
                } else {
                    // Download immediately for multiple files mode
                    cm.setValue(result.markdown);
                    document.getElementById("title").value = result.title;
                    imageList = result.imageList;
                    mdClipsFolder = result.mdClipsFolder;
                    await sendDownloadMessage(cm.getValue());
                }

            } catch (error) {
                console.error(`Error processing tab ${tab.id}:`, error);
                progressUI.setStatus(`Error: ${error.message}`);
                await new Promise(resolve => setTimeout(resolve, 2000)); // Show error briefly
            }
        }

        // If single file mode, combine and download all content
        if (outputMode === 'single' && collectedContent.length > 0) {
            progressUI.setStatus('Combining files...');

            // Combine all markdown with separators
            const combinedMarkdown = collectedContent.map((content, index) => {
                const separator = index > 0 ? '\n\n---\n\n' : '';
                const header = `# ${content.title}\n\nSource: ${content.url}\n\n`;
                return separator + header + content.markdown;
            }).join('');

            // Create combined title
            const combinedTitle = collectedContent.length === 1
                ? collectedContent[0].title
                : `Batch Export - ${new Date().toISOString().split('T')[0]}`;

            // Set values and download
            cm.setValue(combinedMarkdown);
            document.getElementById("title").value = combinedTitle;
            imageList = collectedContent[0].imageList; // Use first page's image list
            mdClipsFolder = collectedContent[0].mdClipsFolder;
            await sendDownloadMessage(cm.getValue());
        }

        // Clean up tabs
        progressUI.setStatus('Cleaning up...');
        console.log('Cleaning up tabs...');
        await Promise.all(tabs.map(tab => browser.tabs.remove(tab.id)));

        progressUI.setStatus('Complete!');
        await new Promise(resolve => setTimeout(resolve, 1000)); // Show completion briefly

        // Clear saved batch URLs after successful completion
        await browser.storage.local.remove('batchUrlList');

        console.log('Batch conversion complete');
        hideBatchProcess(e);
        window.close();

    } catch (error) {
        console.error('Batch processing error:', error);
        progressUI.setStatus(`Error: ${error.message}`);
        document.getElementById("spinner").style.display = 'none';
        document.getElementById("convertUrls").style.display = 'block';
    }
}

const checkInitialSettings = options => {
    // Set checkbox states
    document.querySelector("#includeTemplate").checked = options.includeTemplate || false;
    document.querySelector("#downloadImages").checked = options.downloadImages || false;

    // Set segmented control state
    if (options.clipSelection) {
        document.querySelector("#selected").classList.add("active");
        document.querySelector("#document").classList.remove("active");
    } else {
        document.querySelector("#document").classList.add("active");
        document.querySelector("#selected").classList.remove("active");
    }
}

const toggleClipSelection = options => {
    options.clipSelection = !options.clipSelection;
    document.querySelector("#selected").classList.toggle("active");
    document.querySelector("#document").classList.toggle("active");
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
        func: () => {
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
                selection: result[0].result.selection
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

    // Load batch URL list from storage
    loadBatchUrls();

    // Set up event listeners (unchanged)
    document.getElementById("selected").addEventListener("click", (e) => {
        e.preventDefault();
        toggleClipSelection(options);
    });
    document.getElementById("document").addEventListener("click", (e) => {
        e.preventDefault();
        toggleClipSelection(options);
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
    saveBatchUrls();

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
    navigator.clipboard.writeText(selectedText).then(() => {
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
        const markdown = cm.getValue();
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
        mdClipsFolder = message.mdClipsFolder;
        
        // show the hidden elements
        document.getElementById("container").style.display = 'flex';
        document.getElementById("spinner").style.display = 'none';
         // focus the download button
        document.getElementById("download").focus();
        cm.refresh();
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
