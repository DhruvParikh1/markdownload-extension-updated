let options = defaultOptions;
let keyupTimeout = null;

function getOptionsStateApi() {
    return globalThis.markSnipOptionsState || null;
}

function normalizeImportedOptionsState(importedOptions) {
    const optionsStateApi = getOptionsStateApi();
    if (optionsStateApi?.normalizeImportedOptions) {
        return optionsStateApi.normalizeImportedOptions(importedOptions, defaultOptions);
    }

    return {
        ...defaultOptions,
        ...(importedOptions || {}),
        tableFormatting: {
            ...(defaultOptions.tableFormatting || {}),
            ...((importedOptions && importedOptions.tableFormatting) || {})
        }
    };
}

function getContextMenuTransitionState(previousOptions, nextOptions) {
    const optionsStateApi = getOptionsStateApi();
    if (optionsStateApi?.getContextMenuTransition) {
        return optionsStateApi.getContextMenuTransition(previousOptions, nextOptions);
    }

    const previousEnabled = Boolean(previousOptions?.contextMenus);
    const nextEnabled = Boolean(nextOptions?.contextMenus);
    if (previousEnabled === nextEnabled) {
        return 'none';
    }
    return nextEnabled ? 'create' : 'remove';
}

function resetOptionKeysState(keys) {
    const optionsStateApi = getOptionsStateApi();
    if (optionsStateApi?.resetOptionKeys) {
        return optionsStateApi.resetOptionKeys(options, defaultOptions, keys);
    }

    const nextOptions = JSON.parse(JSON.stringify(options));
    const keyList = Array.isArray(keys) ? keys : String(keys || '').split(',');
    keyList.forEach((rawKey) => {
        const key = String(rawKey || '').trim();
        if (!key) return;

        if (key === 'tableFormatting') {
            nextOptions.tableFormatting = JSON.parse(JSON.stringify(defaultOptions.tableFormatting || {}));
            return;
        }

        if (key.startsWith('tableFormatting.')) {
            const optionName = key.split('.')[1];
            if (!optionName) return;
            nextOptions.tableFormatting = nextOptions.tableFormatting || {};
            nextOptions.tableFormatting[optionName] = defaultOptions.tableFormatting?.[optionName];
            return;
        }

        nextOptions[key] = typeof defaultOptions[key] === 'object'
            ? JSON.parse(JSON.stringify(defaultOptions[key]))
            : defaultOptions[key];
    });

    return {
        options: normalizeImportedOptionsState(nextOptions),
        contextMenuAction: getContextMenuTransitionState(options, nextOptions)
    };
}

function resetAllOptionsState() {
    const optionsStateApi = getOptionsStateApi();
    if (optionsStateApi?.resetAllOptions) {
        return optionsStateApi.resetAllOptions(options, defaultOptions);
    }

    const nextOptions = JSON.parse(JSON.stringify(defaultOptions));
    return {
        options: nextOptions,
        contextMenuAction: getContextMenuTransitionState(options, nextOptions)
    };
}

function buildExportFilenameState(date) {
    const optionsStateApi = getOptionsStateApi();
    if (optionsStateApi?.buildExportFilename) {
        return optionsStateApi.buildExportFilename(date);
    }

    const d = date instanceof Date ? date : new Date(date);
    const datestring = d.getFullYear() + "-" + ("0" + (d.getMonth() + 1)).slice(-2) + "-" + ("0" + d.getDate()).slice(-2);
    return `MarkSnip-export-${datestring}.json`;
}

function applyContextMenuTransition(action) {
    if (action === 'create') {
        createMenus();
    } else if (action === 'remove') {
        browser.contextMenus.removeAll();
    }
}

// Apply theme mode and accent color to the Options page itself
function applyThemeSettings() {
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
}

function configureReviewLink() {
    const reviewLink = document.getElementById("leave-review-link");
    if (!reviewLink || !browser?.runtime?.getURL) return;

    const chromeUrl = reviewLink.dataset.chromeUrl;
    const firefoxUrl = reviewLink.dataset.firefoxUrl;
    const extensionUrl = browser.runtime.getURL("/");
    const isFirefox = extensionUrl.startsWith("moz-extension://");

    reviewLink.href = isFirefox ? firefoxUrl : chromeUrl;
}


const saveOptions = e => {
    e.preventDefault();

    options = {
        frontmatter: document.querySelector("[name='frontmatter']").value,
        backmatter: document.querySelector("[name='backmatter']").value,
        title: document.querySelector("[name='title']").value,
        disallowedChars: document.querySelector("[name='disallowedChars']").value,
        includeTemplate: document.querySelector("[name='includeTemplate']").checked,
        saveAs: document.querySelector("[name='saveAs']").checked,
        downloadImages: document.querySelector("[name='downloadImages']").checked,
        imagePrefix: document.querySelector("[name='imagePrefix']").value,
        mdClipsFolder: document.querySelector("[name='mdClipsFolder']").value,
        turndownEscape: document.querySelector("[name='turndownEscape']").checked,
        hashtagHandling: getCheckedValue(document.querySelectorAll("input[name='hashtagHandling']")),
        contextMenus: document.querySelector("[name='contextMenus']").checked,
        obsidianIntegration: document.querySelector("[name='obsidianIntegration']").checked,
        obsidianVault: document.querySelector("[name='obsidianVault']").value,
        obsidianFolder: document.querySelector("[name='obsidianFolder']").value,

        preserveCodeFormatting: document.querySelector("[name='preserveCodeFormatting']").checked,
        autoDetectCodeLanguage: document.querySelector("[name='autoDetectCodeLanguage']").checked,

        // Add table formatting options
        tableFormatting: {
            stripLinks: document.querySelector("[name='tableFormatting.stripLinks']").checked,
            stripFormatting: document.querySelector("[name='tableFormatting.stripFormatting']").checked,
            prettyPrint: document.querySelector("[name='tableFormatting.prettyPrint']").checked,
            centerText: document.querySelector("[name='tableFormatting.centerText']").checked
        },

        headingStyle: getCheckedValue(document.querySelectorAll("input[name='headingStyle']")),
        hr: getCheckedValue(document.querySelectorAll("input[name='hr']")),
        bulletListMarker: getCheckedValue(document.querySelectorAll("input[name='bulletListMarker']")),
        codeBlockStyle: getCheckedValue(document.querySelectorAll("input[name='codeBlockStyle']")),
        fence: getCheckedValue(document.querySelectorAll("input[name='fence']")),
        emDelimiter: getCheckedValue(document.querySelectorAll("input[name='emDelimiter']")),
        strongDelimiter: getCheckedValue(document.querySelectorAll("input[name='strongDelimiter']")),
        linkStyle: getCheckedValue(document.querySelectorAll("input[name='linkStyle']")),
        linkReferenceStyle: getCheckedValue(document.querySelectorAll("input[name='linkReferenceStyle']")),
        imageStyle: getCheckedValue(document.querySelectorAll("input[name='imageStyle']")),
        imageRefStyle: getCheckedValue(document.querySelectorAll("input[name='imageRefStyle']")),
        downloadMode: getCheckedValue(document.querySelectorAll("input[name='downloadMode']")),
        popupTheme: getCheckedValue(document.querySelectorAll("input[name='popupTheme']")),
        popupAccent: getCheckedValue(document.querySelectorAll("input[name='popupAccent']")),
        compactMode: document.querySelector("[name='compactMode']").checked,
        editorTheme: getCheckedValue(document.querySelectorAll("input[name='editorTheme']")),
    }

    save();
}

const save = () => {
    const spinner = document.getElementById("spinner");
    spinner.style.display = "block";

    const safeUpdateMenu = (id, update) => {
        if (!browser.contextMenus || typeof browser.contextMenus.update !== "function") {
            return Promise.resolve();
        }
        return browser.contextMenus.update(id, update).catch((err) => {
            const message = String(err?.message || err || "");
            if (!message.includes("Cannot find menu item")) {
                console.warn(`Failed to update context menu '${id}':`, err);
            }
        });
    };

    browser.storage.sync.set(options)
        .then(() => {
            if (!options.contextMenus) {
                return Promise.resolve();
            }
            return Promise.allSettled([
                safeUpdateMenu("toggle-includeTemplate", {
                    checked: options.includeTemplate
                }),
                safeUpdateMenu("tabtoggle-includeTemplate", {
                    checked: options.includeTemplate
                }),
                safeUpdateMenu("toggle-downloadImages", {
                    checked: options.downloadImages
                }),
                safeUpdateMenu("tabtoggle-downloadImages", {
                    checked: options.downloadImages
                })
            ]);
        })
        .then(() => {
            showToast("Options Saved 💾", "success");
            spinner.style.display = "none";
        })
        .catch(err => {
            showToast(String(err), "error");
            spinner.style.display = "none";
        });
}

// Toast notification system
function showToast(message, type) {
    const toast = document.getElementById("status");
    toast.textContent = message;
    toast.className = "toast " + type + " visible";
    clearTimeout(toast._hideTimeout);
    toast._hideTimeout = setTimeout(() => {
        toast.classList.remove("visible");
    }, 3000);
}

function hideToast() {
    this.classList.remove("visible");
}

const setCurrentChoice = result => {
    options = normalizeImportedOptionsState(result);

    // if browser doesn't support the download api (i.e. Safari)
    // we have to use contentLink download mode
    if (!browser.downloads) {
        options.downloadMode = 'contentLink';
        document.querySelectorAll("[name='downloadMode']").forEach(el => el.disabled = true)
        document.querySelector('#downloadMode .card-desc').innerText = "The Downloads API is unavailable in this browser."
    }

    const downloadImages = options.downloadImages && options.downloadMode == 'downloadsApi';

    if (!downloadImages && (options.imageStyle == 'markdown' || options.imageStyle.startsWith('obsidian'))) {
        options.imageStyle = 'originalSource';
    }

    options.preserveCodeFormatting = options.preserveCodeFormatting === true;
    options.autoDetectCodeLanguage = options.autoDetectCodeLanguage !== false;

    document.querySelector("[name='frontmatter']").value = options.frontmatter;
    document.querySelector("[name='backmatter']").value = options.backmatter;
    document.querySelector("[name='title']").value = options.title;
    document.querySelector("[name='disallowedChars']").value = options.disallowedChars;
    document.querySelector("[name='includeTemplate']").checked = options.includeTemplate;
    document.querySelector("[name='saveAs']").checked = options.saveAs;
    document.querySelector("[name='downloadImages']").checked = options.downloadImages;
    document.querySelector("[name='imagePrefix']").value = options.imagePrefix;
    document.querySelector("[name='mdClipsFolder']").value = result.mdClipsFolder;
    document.querySelector("[name='turndownEscape']").checked = options.turndownEscape;
    document.querySelector("[name='contextMenus']").checked = options.contextMenus;
    document.querySelector("[name='obsidianIntegration']").checked = options.obsidianIntegration;
    document.querySelector("[name='obsidianVault']").value = options.obsidianVault;
    document.querySelector("[name='obsidianFolder']").value = options.obsidianFolder;

    // Set preserveCodeFormatting checkbox
    document.querySelector("[name='preserveCodeFormatting']").checked = options.preserveCodeFormatting;
    document.querySelector("[name='autoDetectCodeLanguage']").checked = options.autoDetectCodeLanguage;

    // Set table formatting checkboxes
    document.querySelector("[name='tableFormatting.stripLinks']").checked = Boolean(options.tableFormatting.stripLinks);
    document.querySelector("[name='tableFormatting.stripFormatting']").checked = Boolean(options.tableFormatting.stripFormatting);
    document.querySelector("[name='tableFormatting.prettyPrint']").checked = Boolean(options.tableFormatting.prettyPrint);
    document.querySelector("[name='tableFormatting.centerText']").checked = Boolean(options.tableFormatting.centerText);

    setCheckedValue(document.querySelectorAll("[name='headingStyle']"), options.headingStyle);
    setCheckedValue(document.querySelectorAll("[name='hr']"), options.hr);
    setCheckedValue(document.querySelectorAll("[name='bulletListMarker']"), options.bulletListMarker);
    setCheckedValue(document.querySelectorAll("[name='codeBlockStyle']"), options.codeBlockStyle);
    setCheckedValue(document.querySelectorAll("[name='fence']"), options.fence);
    setCheckedValue(document.querySelectorAll("[name='emDelimiter']"), options.emDelimiter);
    setCheckedValue(document.querySelectorAll("[name='strongDelimiter']"), options.strongDelimiter);
    setCheckedValue(document.querySelectorAll("[name='linkStyle']"), options.linkStyle);
    setCheckedValue(document.querySelectorAll("[name='linkReferenceStyle']"), options.linkReferenceStyle);
    setCheckedValue(document.querySelectorAll("[name='imageStyle']"), options.imageStyle);
    setCheckedValue(document.querySelectorAll("[name='imageRefStyle']"), options.imageRefStyle);
    setCheckedValue(document.querySelectorAll("[name='hashtagHandling']"), options.hashtagHandling || 'keep');
    setCheckedValue(document.querySelectorAll("[name='downloadMode']"), options.downloadMode);

    setCheckedValue(document.querySelectorAll("[name='popupTheme']"), options.popupTheme || 'system');
    setCheckedValue(document.querySelectorAll("[name='popupAccent']"), options.popupAccent || 'sage');
    document.querySelector("[name='compactMode']").checked = options.compactMode || false;
    setCheckedValue(document.querySelectorAll("[name='editorTheme']"), options.editorTheme || 'default');

    refreshElements();
    applyThemeSettings();
}

const restoreOptions = () => {
    

    const onError = error => {
        console.error(error);
    }

    browser.storage.sync.get(defaultOptions).then(setCurrentChoice, onError);
}

const show = (el, visible) => {
    if (!el) return;
    el.style.display = visible ? "" : "none";
    el.style.opacity = visible ? "1" : "0";
}

const refreshElements = () => {
    // Apply theme/accent to Options page live
    applyThemeSettings();

    document.getElementById("downloadModeGroup").querySelectorAll('.setting-card').forEach(container => {
        show(container, options.downloadMode == 'downloadsApi')
    });

    show(document.getElementById("mdClipsFolder"), options.downloadMode == 'downloadsApi');

    show(document.getElementById("linkReferenceStyle"), (options.linkStyle == "referenced"));

    show(document.getElementById("imageRefOptions"), (!options.imageStyle.startsWith("obsidian") && options.imageStyle != "noImage"));

    show(document.getElementById("fence"), (options.codeBlockStyle == "fenced"));

    const downloadImages = options.downloadImages && options.downloadMode == 'downloadsApi';

    show(document.getElementById("imagePrefix"), downloadImages);

    document.getElementById('markdown').disabled = !downloadImages;
    document.getElementById('base64').disabled = !downloadImages;
    document.getElementById('obsidian').disabled = !downloadImages;
    document.getElementById('obsidian-nofolder').disabled = !downloadImages;

    
}

const inputChange = e => {
    if (e) {
        let key = e.target.name;
        let value = e.target.value;
        if (key == "import-file") {
            fr = new FileReader();
            fr.onload = (ev) => {
                let lines = ev.target.result;
                const previousOptions = options;
                options = normalizeImportedOptionsState(JSON.parse(lines));
                setCurrentChoice(options);
                applyContextMenuTransition(getContextMenuTransitionState(previousOptions, options));
                save();            
                refreshElements();
            };
            fr.readAsText(e.target.files[0])
        }
        else {
            if (e.target.type == "checkbox") value = e.target.checked;
            
            // Handle nested table formatting options
            if (key.startsWith('tableFormatting.')) {
                const optionName = key.split('.')[1];
                options.tableFormatting = options.tableFormatting || {};
                options.tableFormatting[optionName] = value;
            } else {
                options[key] = value;
            }
 
            if (key == "contextMenus") {
                if (value) { createMenus() }
                else { browser.contextMenus.removeAll() }
            }
    
            save();
            refreshElements();
        }
    }
 }

const inputKeyup = (e) => {
    if (keyupTimeout) clearTimeout(keyupTimeout);
    keyupTimeout = setTimeout(inputChange, 500, e);
}

const buttonClick = (e) => {
    if (e.target.id == "import" || e.target.closest('#import')) {
        document.getElementById("import-file").click();
    }
    else if (e.target.id == "export" || e.target.closest('#export')) {
        console.log("export");
        const json = JSON.stringify(options, null, 2);
        var blob = new Blob([json], { type: "text/json" });
        var url = URL.createObjectURL(blob);
        browser.downloads.download({
            url: url,
            saveAs: true,
            filename: buildExportFilenameState(new Date())
        });
    }
}

// ── Sidebar Navigation ──
function initSidebar() {
    const sidebarItems = Array.from(document.querySelectorAll('.sidebar-item'));
    const sections = Array.from(document.querySelectorAll('.section'));

    // Restore last active tab from sessionStorage
    const lastActive = sessionStorage.getItem('marksnip-options-tab') || 'templates';

    function switchSection(sectionId) {
        // Update sidebar
        sidebarItems.forEach(item => {
            const isActive = item.dataset.section === sectionId;
            item.classList.toggle('active', isActive);
            item.setAttribute('aria-selected', String(isActive));
            item.tabIndex = isActive ? 0 : -1;
        });
        const activeItem = document.querySelector(`.sidebar-item[data-section="${sectionId}"]`);

        // Update sections
        sections.forEach(section => {
            const isActive = section.id === `section-${sectionId}`;
            section.classList.toggle('active', isActive);
            section.setAttribute('aria-hidden', String(!isActive));
        });
        const activeSection = document.getElementById(`section-${sectionId}`);

        // Persist
        sessionStorage.setItem('marksnip-options-tab', sectionId);

        return { activeItem, activeSection };
    }

    function activateSidebarItem(item, shouldFocus = false) {
        if (!item) {
            return;
        }

        const searchInput = document.getElementById('settings-search');
        if (searchInput && searchInput.value) {
            searchInput.value = '';
            searchInput.dispatchEvent(new Event('input'));
        }

        const { activeItem } = switchSection(item.dataset.section);
        if (shouldFocus && activeItem) {
            activeItem.focus();
        }
    }

    sidebarItems.forEach(item => {
        item.addEventListener('click', () => {
            activateSidebarItem(item);
        });

        item.addEventListener('keydown', (event) => {
            const currentIndex = sidebarItems.indexOf(item);
            let targetIndex = currentIndex;

            if (event.key === 'ArrowDown' || event.key === 'ArrowRight') {
                targetIndex = (currentIndex + 1) % sidebarItems.length;
            } else if (event.key === 'ArrowUp' || event.key === 'ArrowLeft') {
                targetIndex = (currentIndex - 1 + sidebarItems.length) % sidebarItems.length;
            } else if (event.key === 'Home') {
                targetIndex = 0;
            } else if (event.key === 'End') {
                targetIndex = sidebarItems.length - 1;
            } else if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                activateSidebarItem(item);
                return;
            } else {
                return;
            }

            event.preventDefault();
            activateSidebarItem(sidebarItems[targetIndex], true);
        });
    });

    // Initialize to last active
    switchSection(lastActive);
}

// ── Per-card and global reset ──

function injectResetLinks() {
    document.querySelectorAll('.setting-card[data-setting-key]').forEach(card => {
        // Skip if already injected
        if (card.querySelector('.reset-setting-link')) return;

        const resetBtn = document.createElement('button');
        resetBtn.type = 'button';
        resetBtn.className = 'reset-setting-link';
        resetBtn.textContent = 'Reset';
        resetBtn.title = 'Reset to default';

        // If card has a card-title, wrap title + reset in a row
        const titleEl = card.querySelector(':scope > .card-title');
        if (titleEl) {
            const row = document.createElement('div');
            row.className = 'card-title-row';
            titleEl.before(row);
            row.appendChild(titleEl);
            row.appendChild(resetBtn);
        } else {
            // For toggle-only cards, insert as first child (positioned absolutely via CSS)
            card.insertBefore(resetBtn, card.firstChild);
        }

        resetBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            resetSettingByCard(card);
        });
    });
}

function resetSettingByCard(card) {
    const keys = card.dataset.settingKey.split(',');
    const resetResult = resetOptionKeysState(keys);
    options = resetResult.options;
    setCurrentChoice(options);
    applyContextMenuTransition(resetResult.contextMenuAction);
    save();
    showToast("Setting reset to default", "success");
}

function resetAllSettings() {
    if (!confirm('Reset all settings to defaults? This cannot be undone.')) return;
    const resetResult = resetAllOptionsState();
    options = resetResult.options;
    setCurrentChoice(options);
    applyContextMenuTransition(resetResult.contextMenuAction);
    save();
    showToast("All settings reset to defaults", "success");
}

const loaded = () => {
    // Initialize sidebar navigation
    initSidebar();
    initSearch();
    configureReviewLink();

    // Restore saved options
    restoreOptions();

    // Inject per-card reset links
    injectResetLinks();

    // Reset All button
    const resetAllBtn = document.getElementById('reset-all');
    if (resetAllBtn) {
        resetAllBtn.addEventListener('click', resetAllSettings);
    }

    // Attach event listeners (skip the search input)
    document.querySelectorAll('input,textarea,button').forEach(input => {
        if (input.id === 'settings-search') return;
        if (input.tagName == "TEXTAREA" || input.type == "text") {
            input.addEventListener('keyup', inputKeyup);
        }
        else if (input.tagName == "BUTTON") {
            input.addEventListener('click', buttonClick);
        }
        else input.addEventListener('change', inputChange);
    })
}

// ── Settings Search ──
function initSearch() {
    const searchInput = document.getElementById('settings-search');
    const contentPanel = document.querySelector('.content-panel');
    const noResults = document.getElementById('search-no-results');
    const noResultsQuery = document.getElementById('search-no-results-query');
    const searchApi = globalThis.markSnipOptionsSearch;

    if (!searchInput || !contentPanel || !noResults || !noResultsQuery || !searchApi) {
        return;
    }

    const sections = document.querySelectorAll('.section');
    const searchIndex = searchApi.buildSearchIndex(document);
    let searchTimeout = null;

    function restoreDefaultView() {
        contentPanel.classList.remove('search-active');
        noResults.classList.remove('visible');

        searchIndex.forEach(({ card }) => {
            card.classList.remove('search-hidden', 'search-match');
            card.style.removeProperty('display');
            card.style.removeProperty('opacity');
        });

        document.querySelectorAll('[data-search-force-shown]').forEach(el => {
            el.style.removeProperty('display');
            el.style.removeProperty('opacity');
            el.removeAttribute('data-search-force-shown');
        });

        sections.forEach(section => section.classList.remove('search-section-empty'));

        const activeTab = sessionStorage.getItem('marksnip-options-tab') || 'templates';
        const sidebarItems = document.querySelectorAll('.sidebar-item');
        const allSections = document.querySelectorAll('.section');

        sidebarItems.forEach(item => {
            const isActive = item.dataset.section === activeTab;
            item.classList.toggle('active', isActive);
            item.setAttribute('aria-selected', String(isActive));
            item.tabIndex = isActive ? 0 : -1;
        });
        const activeItem = document.querySelector(`.sidebar-item[data-section="${activeTab}"]`);

        allSections.forEach(section => {
            const isActive = section.id === `section-${activeTab}`;
            section.classList.toggle('active', isActive);
            section.setAttribute('aria-hidden', String(!isActive));
        });
        const activeSection = document.getElementById(`section-${activeTab}`);

        refreshElements();
    }

    function performSearch(query) {
        const normalizedQuery = searchApi.normalizeSearchText(query);

        if (!normalizedQuery) {
            restoreDefaultView();
            return;
        }

        contentPanel.classList.add('search-active');

        const searchResults = searchApi.searchSettings(searchIndex, normalizedQuery);
        let totalMatches = 0;

        searchResults.results.forEach(({ card, matches }) => {
            card.classList.toggle('search-hidden', !matches);
            card.classList.toggle('search-match', matches);

            if (matches) {
                totalMatches++;
                card.style.display = '';
                card.style.opacity = '1';

                let parent = card.parentElement;
                while (parent && parent !== contentPanel) {
                    if (parent.style.display === 'none') {
                        parent.style.display = '';
                        parent.style.opacity = '1';
                        parent.setAttribute('data-search-force-shown', '');
                    }
                    parent = parent.parentElement;
                }
            }
        });

        sections.forEach(section => {
            const hasVisible = section.querySelector('.setting-card.search-match');
            section.classList.toggle('search-section-empty', !hasVisible);
            section.setAttribute('aria-hidden', String(!hasVisible));
        });

        if (totalMatches === 0) {
            noResultsQuery.textContent = normalizedQuery;
            noResults.classList.add('visible');
        } else {
            noResults.classList.remove('visible');
        }
    }

    searchInput.addEventListener('input', () => {
        clearTimeout(searchTimeout);
        searchTimeout = setTimeout(() => performSearch(searchInput.value), 150);
    });

    document.addEventListener('keydown', (e) => {
        if (e.key === '/' && !e.ctrlKey && !e.metaKey && !e.altKey) {
            const tag = document.activeElement?.tagName;
            if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
            e.preventDefault();
            searchInput.focus();
        }

        if (e.key === 'Escape' && document.activeElement === searchInput) {
            searchInput.value = '';
            performSearch('');
            searchInput.blur();
        }
    });
}

function initSearchLegacy() {
    const searchInput = document.getElementById('settings-search');
    const contentPanel = document.querySelector('.content-panel');
    const noResults = document.getElementById('search-no-results');
    const noResultsQuery = document.getElementById('search-no-results-query');
    const shortcutHint = document.getElementById('search-shortcut-hint');

    // Build search index: collect all setting-cards with their searchable text
    // Also include the downloadModeGroup's inner cards as individual entries
    const sections = document.querySelectorAll('.section');
    const searchIndex = [];

    sections.forEach(section => {
        // Get direct setting-cards and also cards inside #downloadModeGroup
        const cards = section.querySelectorAll('.setting-card');
        cards.forEach(card => {
            const text = card.textContent.toLowerCase();
            searchIndex.push({ card, section, text });
        });
    });

    let searchTimeout = null;

    function performSearch(query) {
        query = query.trim().toLowerCase();

        if (!query) {
            // Exit search mode — restore normal sidebar navigation
            contentPanel.classList.remove('search-active');
            noResults.classList.remove('visible');
            searchIndex.forEach(({ card }) => {
                card.classList.remove('search-hidden', 'search-match');
                card.style.removeProperty('display');
                card.style.removeProperty('opacity');
            });
            // Also restore parent wrappers that may have been force-shown
            document.querySelectorAll('[data-search-force-shown]').forEach(el => {
                el.removeAttribute('data-search-force-shown');
            });
            sections.forEach(s => s.classList.remove('search-section-empty'));
            // Re-trigger sidebar to show correct section
            const activeTab = sessionStorage.getItem('marksnip-options-tab') || 'templates';
            const sidebarItems = document.querySelectorAll('.sidebar-item');
            const allSections = document.querySelectorAll('.section');
            sidebarItems.forEach(item => item.classList.remove('active'));
            const activeItem = document.querySelector(`.sidebar-item[data-section="${activeTab}"]`);
            if (activeItem) activeItem.classList.add('active');
            allSections.forEach(s => s.classList.remove('active'));
            const activeSection = document.getElementById(`section-${activeTab}`);
            if (activeSection) activeSection.classList.add('active');
            // Restore conditional visibility
            refreshElements();
            return;
        }

        // Enter search mode
        contentPanel.classList.add('search-active');

        const terms = query.split(/\s+/).filter(Boolean);
        let totalMatches = 0;

        searchIndex.forEach(({ card, text }) => {
            const matches = terms.every(term => text.includes(term));
            card.classList.toggle('search-hidden', !matches);
            card.classList.toggle('search-match', matches);
            if (matches) {
                totalMatches++;
                // Override any inline display:none from show() / refreshElements()
                card.style.display = '';
                card.style.opacity = '1';
                // Also ensure parent wrappers (like #downloadModeGroup) are visible
                let parent = card.parentElement;
                while (parent && parent !== contentPanel) {
                    if (parent.style.display === 'none') {
                        parent.style.display = '';
                        parent.style.opacity = '1';
                        parent.setAttribute('data-search-force-shown', '');
                    }
                    parent = parent.parentElement;
                }
            }
        });

        // Mark sections that have zero visible cards
        sections.forEach(section => {
            const hasVisible = section.querySelector('.setting-card.search-match');
            section.classList.toggle('search-section-empty', !hasVisible);
        });

        // Show/hide no-results message
        if (totalMatches === 0) {
            noResultsQuery.textContent = query;
            noResults.classList.add('visible');
        } else {
            noResults.classList.remove('visible');
        }
    }

    searchInput.addEventListener('input', () => {
        clearTimeout(searchTimeout);
        searchTimeout = setTimeout(() => performSearch(searchInput.value), 150);
    });

    // "/" keyboard shortcut to focus search
    document.addEventListener('keydown', (e) => {
        if (e.key === '/' && !e.ctrlKey && !e.metaKey && !e.altKey) {
            const tag = document.activeElement?.tagName;
            if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
            e.preventDefault();
            searchInput.focus();
        }
        // Escape to clear search
        if (e.key === 'Escape' && document.activeElement === searchInput) {
            searchInput.value = '';
            performSearch('');
            searchInput.blur();
        }
    });
}

document.addEventListener("DOMContentLoaded", loaded);
document.getElementById("status").addEventListener("click", hideToast);

/// https://www.somacon.com/p143.php
// return the value of the radio button that is checked
// return an empty string if none are checked, or
// there are no radio buttons
function getCheckedValue(radioObj) {
    if (!radioObj)
        return "";
    var radioLength = radioObj.length;
    if (radioLength == undefined)
        if (radioObj.checked)
            return radioObj.value;
        else
            return "";
    for (var i = 0; i < radioLength; i++) {
        if (radioObj[i].checked) {
            return radioObj[i].value;
        }
    }
    return "";
}

// set the radio button with the given value as being checked
// do nothing if there are no radio buttons
// if the given value does not exist, all the radio buttons
// are reset to unchecked
function setCheckedValue(radioObj, newValue) {
    if (!radioObj)
        return;
    var radioLength = radioObj.length;
    if (radioLength == undefined) {
        radioObj.checked = (radioObj.value == newValue.toString());
        return;
    }
    for (var i = 0; i < radioLength; i++) {
        radioObj[i].checked = false;
        if (radioObj[i].value == newValue.toString()) {
            radioObj[i].checked = true;
        }
    }
}
