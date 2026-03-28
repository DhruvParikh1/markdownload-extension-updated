let options = defaultOptions;
let librarySettings = {
    enabled: true,
    autoSaveOnPopupOpen: true,
    itemsToKeep: 10
};
let agentBridgeSettings = {
    enabled: false
};
let agentBridgeStatus = {
    enabled: false,
    permissionGranted: false,
    connecting: false,
    connected: false,
    hostInstalled: false,
    browser: '',
    hostVersion: '',
    lastError: '',
    updatedAt: ''
};
let agentBridgeInstallCommand = 'marksnip install-host';
let keyupTimeout = null;
const SPECIAL_THEME_CLASS_NAMES = ['special-theme-claude', 'special-theme-perplexity', 'special-theme-atla', 'special-theme-ben10'];
const ACCENT_CLASS_NAMES = ['accent-sage', 'accent-ocean', 'accent-slate', 'accent-rose', 'accent-amber'];
const POPUP_THEME_CACHE_KEY = 'marksnip-popup-theme-cache-v1';

function getOptionsStateApi() {
    return globalThis.markSnipOptionsState || null;
}

function getLibraryStateApi() {
    return globalThis.markSnipLibraryState || null;
}

function getAgentBridgeStateApi() {
    return globalThis.markSnipAgentBridgeState || null;
}

function usesOptionalNativeMessagingPermission() {
    const optionalPermissions = browser.runtime?.getManifest?.().optional_permissions || [];
    return Array.isArray(optionalPermissions) && optionalPermissions.includes('nativeMessaging');
}

function isNativeMessagingApiAvailable() {
    return Boolean(
        browser.runtime?.connectNative ||
        (typeof chrome !== 'undefined' && chrome.runtime?.connectNative)
    );
}

function getAgentBridgeInstallCommandForPlatform(platformOs) {
    switch (String(platformOs || '').trim().toLowerCase()) {
        case 'win':
            return '.\\marksnip.exe install-host';
        case 'mac':
        case 'linux':
            return './marksnip install-host';
        default:
            return 'marksnip install-host';
    }
}

function renderAgentBridgeInstallCommand() {
    const commandEl = document.getElementById('agentBridgeInstallCommand');
    if (commandEl) {
        commandEl.textContent = agentBridgeInstallCommand;
    }
}

function updateAgentBridgeActionButton(state = 'disabled') {
    const button = document.getElementById('refreshAgentBridgeStatus');
    if (!button) {
        return;
    }

    if (state === 'permission-needed') {
        button.textContent = 'Grant Permission';
        button.setAttribute('aria-label', 'Grant native messaging permission for Agent Bridge');
        return;
    }

    button.textContent = 'Check Connection';
    button.setAttribute('aria-label', 'Check Agent Bridge connection status');
}

async function resolveAgentBridgeInstallCommand() {
    const platformInfo = await browser.runtime?.getPlatformInfo?.().catch(() => null);
    agentBridgeInstallCommand = getAgentBridgeInstallCommandForPlatform(platformInfo?.os);
    renderAgentBridgeInstallCommand();
    return agentBridgeInstallCommand;
}

function normalizeLibrarySettingsState(settings) {
    const libraryApi = getLibraryStateApi();
    if (libraryApi?.normalizeLibrarySettings) {
        return libraryApi.normalizeLibrarySettings(settings);
    }

    return {
        enabled: settings?.enabled !== false,
        autoSaveOnPopupOpen: settings?.autoSaveOnPopupOpen !== false,
        itemsToKeep: Math.max(1, Number.parseInt(settings?.itemsToKeep ?? 10, 10) || 10)
    };
}

async function saveLibrarySettingsState(nextSettings) {
    const libraryApi = getLibraryStateApi();
    librarySettings = normalizeLibrarySettingsState(nextSettings);

    if (libraryApi?.saveLibrarySettings) {
        librarySettings = await libraryApi.saveLibrarySettings(librarySettings);
    } else {
        await browser.storage.local.set({ librarySettings });
    }

    return librarySettings;
}

async function loadLibrarySettingsState() {
    const libraryApi = getLibraryStateApi();
    if (libraryApi?.loadLibrarySettings) {
        librarySettings = await libraryApi.loadLibrarySettings();
    } else {
        const result = await browser.storage.local.get('librarySettings');
        librarySettings = normalizeLibrarySettingsState(result.librarySettings);
    }

    return librarySettings;
}

async function resetLibrarySettingsState() {
    const libraryApi = getLibraryStateApi();
    if (libraryApi?.resetLibrarySettings) {
        librarySettings = await libraryApi.resetLibrarySettings();
        return librarySettings;
    }

    librarySettings = normalizeLibrarySettingsState();
    await browser.storage.local.set({ librarySettings });
    return librarySettings;
}

async function trimLibraryItemsState(itemsToKeep) {
    const libraryApi = getLibraryStateApi();
    if (libraryApi?.trimStoredLibraryItems) {
        return await libraryApi.trimStoredLibraryItems(itemsToKeep);
    }

    return [];
}

async function clearLibraryItemsState() {
    const libraryApi = getLibraryStateApi();
    if (libraryApi?.clearLibraryItems) {
        return await libraryApi.clearLibraryItems();
    }

    await browser.storage.local.remove('libraryItems');
    return [];
}

function normalizeAgentBridgeSettingsState(settings) {
    const bridgeApi = getAgentBridgeStateApi();
    if (bridgeApi?.normalizeSettings) {
        return bridgeApi.normalizeSettings(settings);
    }

    return {
        enabled: settings?.enabled === true
    };
}

function normalizeAgentBridgeStatusState(status) {
    const bridgeApi = getAgentBridgeStateApi();
    if (bridgeApi?.normalizeStatus) {
        return bridgeApi.normalizeStatus(status);
    }

    return {
        enabled: status?.enabled === true,
        permissionGranted: status?.permissionGranted === true,
        connecting: status?.connecting === true,
        connected: status?.connected === true,
        hostInstalled: status?.hostInstalled === true,
        browser: typeof status?.browser === 'string' ? status.browser.trim().toLowerCase() : '',
        hostVersion: typeof status?.hostVersion === 'string' ? status.hostVersion.trim() : '',
        lastError: typeof status?.lastError === 'string' ? status.lastError.trim() : '',
        updatedAt: typeof status?.updatedAt === 'string' ? status.updatedAt.trim() : ''
    };
}

async function saveAgentBridgeSettingsState(nextSettings) {
    const bridgeApi = getAgentBridgeStateApi();
    agentBridgeSettings = normalizeAgentBridgeSettingsState(nextSettings);

    if (bridgeApi?.saveSettings) {
        agentBridgeSettings = await bridgeApi.saveSettings(agentBridgeSettings);
    } else {
        await browser.storage.local.set({ agentBridgeSettings });
    }

    return agentBridgeSettings;
}

async function loadAgentBridgeSettingsState() {
    const bridgeApi = getAgentBridgeStateApi();
    if (bridgeApi?.loadSettings) {
        agentBridgeSettings = await bridgeApi.loadSettings();
    } else {
        const result = await browser.storage.local.get('agentBridgeSettings');
        agentBridgeSettings = normalizeAgentBridgeSettingsState(result.agentBridgeSettings);
    }

    return agentBridgeSettings;
}

async function loadAgentBridgeStatusState() {
    const bridgeApi = getAgentBridgeStateApi();
    if (bridgeApi?.loadStatus) {
        agentBridgeStatus = await bridgeApi.loadStatus();
    } else {
        const result = await browser.storage.local.get('agentBridgeStatus');
        agentBridgeStatus = normalizeAgentBridgeStatusState(result.agentBridgeStatus);
    }

    return agentBridgeStatus;
}

async function refreshAgentBridgeStatusState() {
    if (!browser.runtime?.sendMessage) {
        await loadAgentBridgeStatusState();
        return agentBridgeStatus;
    }

    try {
        const status = await browser.runtime.sendMessage({
            type: 'refresh-agent-bridge-status'
        });
        agentBridgeStatus = normalizeAgentBridgeStatusState(status);
    } catch (error) {
        console.warn('Failed to refresh Agent Bridge status:', error);
        await loadAgentBridgeStatusState();
    }

    return agentBridgeStatus;
}

async function requestAgentBridgePermission() {
    if (!browser.permissions?.request) {
        showToast("This browser cannot request native messaging permission here", "error");
        return { granted: false, reloadRequired: false };
    }

    const granted = await browser.permissions.request({
        permissions: ['nativeMessaging']
    }).catch((error) => {
        console.error('Failed to request native messaging permission:', error);
        return false;
    });

    if (!granted) {
        showToast("Agent Bridge permission was not granted", "error");
        return { granted: false, reloadRequired: false };
    }

    return {
        granted: true,
        reloadRequired: usesOptionalNativeMessagingPermission() && !isNativeMessagingApiAvailable()
    };
}

async function reloadExtensionForAgentBridgePermissionGrant() {
    const container = document.getElementById('agent-bridge-container');
    const statusHint = document.getElementById('agentBridgeStatusHint');
    const statusText = document.getElementById('agentBridgeStatusText');
    const refreshBtn = document.getElementById('refreshAgentBridgeStatus');

    if (container) {
        container.dataset.bridgeState = 'starting';
        container.dataset.permissionState = 'idle';
    }
    hidePermissionPanel();
    if (statusText) {
        statusText.textContent = 'Reloading extension';
    }
    if (statusHint) {
        statusHint.textContent = 'Permission granted. MarkSnip is reloading once to finish enabling the Agent Bridge.';
    }
    if (refreshBtn) {
        refreshBtn.disabled = true;
        refreshBtn.textContent = 'Reloading...';
    }

    await new Promise((resolve) => setTimeout(resolve, 150));
    browser.runtime?.reload?.();
}

/* ── Permission Panel Management ── */

function showPermissionPanel(panelState) {
    const panel = document.getElementById('agentBridgePermissionPanel');
    const container = document.getElementById('agent-bridge-container');
    if (!panel) return;

    panel.hidden = false;
    panel.querySelectorAll('.permission-panel-state').forEach(el => {
        el.classList.toggle('is-active', el.dataset.panelState === panelState);
    });

    if (container) {
        container.dataset.permissionState = panelState;
    }
}

function hidePermissionPanel() {
    const panel = document.getElementById('agentBridgePermissionPanel');
    const container = document.getElementById('agent-bridge-container');
    if (panel) {
        panel.hidden = true;
        panel.querySelectorAll('.permission-panel-state').forEach(el => {
            el.classList.remove('is-active');
        });
    }
    if (container) {
        container.dataset.permissionState = 'idle';
    }
}

async function handlePermissionContinue() {
    const continueBtn = document.getElementById('agentBridgePermContinue');
    if (continueBtn) {
        continueBtn.disabled = true;
        continueBtn.textContent = 'Requesting...';
    }

    try {
        const permissionResult = await requestAgentBridgePermission();

        if (!permissionResult.granted) {
            // Show denied state
            showPermissionPanel('denied');
            return;
        }

        // Permission granted
        hidePermissionPanel();
        agentBridgeSettings.enabled = true;
        await saveAgentBridgeSettingsState(agentBridgeSettings);

        if (permissionResult.reloadRequired) {
            await reloadExtensionForAgentBridgePermissionGrant();
            return;
        }

        const toggle = document.querySelector("[name='agentBridgeEnabled']");
        if (toggle) toggle.checked = true;

        const refreshedStatus = await refreshAgentBridgeStatusState();
        setCurrentAgentBridgeChoice(agentBridgeSettings, refreshedStatus);
        showToast("Agent Bridge enabled", "success");
    } catch (error) {
        console.error('Failed to request Agent Bridge permission:', error);
        showPermissionPanel('denied');
    } finally {
        if (continueBtn) {
            continueBtn.disabled = false;
            continueBtn.textContent = 'Continue';
        }
    }
}

function handlePermissionCancel() {
    hidePermissionPanel();
    const toggle = document.querySelector("[name='agentBridgeEnabled']");
    if (toggle) toggle.checked = false;
    agentBridgeSettings.enabled = false;
    setCurrentAgentBridgeChoice(agentBridgeSettings, agentBridgeStatus);
}

async function handlePermissionRetry() {
    showPermissionPanel('preflight');
}

function handlePermissionDismiss() {
    hidePermissionPanel();
    const toggle = document.querySelector("[name='agentBridgeEnabled']");
    if (toggle) toggle.checked = false;
    agentBridgeSettings.enabled = false;
    setCurrentAgentBridgeChoice(agentBridgeSettings, agentBridgeStatus);
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

function buildExportPayload() {
    return {
        ...options,
        librarySettings: normalizeLibrarySettingsState(librarySettings)
    };
}

function applyContextMenuTransition(action) {
    if (action === 'create') {
        createMenus();
    } else if (action === 'remove') {
        browser.contextMenus.removeAll();
    }
}

function buildPopupThemeCacheSnapshot(source = options || defaultOptions) {
    return {
        popupTheme: source?.popupTheme || 'system',
        specialTheme: source?.specialTheme || 'none',
        specialThemeIcon: source?.specialThemeIcon !== false,
        popupAccent: source?.popupAccent || 'sage',
        editorTheme: source?.editorTheme || 'default'
    };
}

function persistPopupThemeCache(source = options || defaultOptions) {
    try {
        localStorage.setItem(POPUP_THEME_CACHE_KEY, JSON.stringify(buildPopupThemeCacheSnapshot(source)));
    } catch (error) {
        console.debug('Unable to persist popup theme cache:', error);
    }
}

// Apply theme mode and accent color to the Options page itself
function applyThemeSettings() {
    const root = document.documentElement;
    const specialTheme = options.specialTheme || 'none';

    // Apply theme mode
    root.classList.remove('theme-light', 'theme-dark', 'theme-system');
    root.classList.add('theme-' + (options.popupTheme || 'system'));

    root.classList.remove(...SPECIAL_THEME_CLASS_NAMES);
    if (specialTheme !== 'none') {
        root.classList.add('special-theme-' + specialTheme);
    }

    root.classList.toggle('hide-theme-icon', options.specialThemeIcon === false);

    // Apply accent color
    root.classList.remove(...ACCENT_CLASS_NAMES);
    const accent = options.popupAccent || 'sage';
    if (specialTheme === 'none' && accent !== 'sage') {
        root.classList.add('accent-' + accent);
    }

    persistPopupThemeCache(options);
}

function updateSpecialThemeControlState() {
    const specialTheme = options.specialTheme || 'none';
    const specialThemeActive = specialTheme !== 'none';
    const themeHasIcon = specialTheme === 'atla' || specialTheme === 'ben10';
    const accentGroup = document.getElementById('popupAccentGroup');
    const editorThemeGroup = document.getElementById('editorThemeGroup');
    const accentNote = document.getElementById('popupAccentThemeNote');
    const editorThemeNote = document.getElementById('editorThemeLockNote');
    const iconRow = document.getElementById('specialThemeIconRow');
    const iconInput = document.querySelector("[name='specialThemeIcon']");

    if (iconRow) iconRow.classList.toggle('is-disabled', !themeHasIcon);
    if (iconInput) iconInput.disabled = !themeHasIcon;

    [accentGroup, editorThemeGroup].forEach((group) => {
        group?.classList.toggle('is-disabled', specialThemeActive);
        group?.setAttribute('aria-disabled', String(specialThemeActive));
    });

    if (accentNote) {
        accentNote.hidden = !specialThemeActive;
    }

    if (editorThemeNote) {
        editorThemeNote.hidden = !specialThemeActive;
    }

    document.querySelectorAll("input[name='popupAccent']").forEach((input) => {
        input.disabled = specialThemeActive;
    });

    document.querySelectorAll("input[name='editorTheme']").forEach((input) => {
        input.disabled = specialThemeActive;
    });
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
        defaultExportType: getCheckedValue(document.querySelectorAll("input[name='defaultExportType']")) || 'markdown',
        turndownEscape: document.querySelector("[name='turndownEscape']").checked,
        hashtagHandling: getCheckedValue(document.querySelectorAll("input[name='hashtagHandling']")),
        contextMenus: document.querySelector("[name='contextMenus']").checked,
        batchProcessingEnabled: document.querySelector("[name='batchProcessingEnabled']").checked,
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
        specialTheme: getCheckedValue(document.querySelectorAll("input[name='specialTheme']")) || 'none',
        specialThemeIcon: document.querySelector("[name='specialThemeIcon']").checked,
        popupAccent: getCheckedValue(document.querySelectorAll("input[name='popupAccent']")),
        compactMode: document.querySelector("[name='compactMode']").checked,
        showUserGuideIcon: document.querySelector("[name='showUserGuideIcon']").checked,
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
    document.querySelector("[name='batchProcessingEnabled']").checked = options.batchProcessingEnabled !== false;
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
    setCheckedValue(document.querySelectorAll("[name='defaultExportType']"), options.defaultExportType || 'markdown');

    setCheckedValue(document.querySelectorAll("[name='popupTheme']"), options.popupTheme || 'system');
    setCheckedValue(document.querySelectorAll("[name='specialTheme']"), options.specialTheme || 'none');
    document.querySelector("[name='specialThemeIcon']").checked = options.specialThemeIcon !== false;
    setCheckedValue(document.querySelectorAll("[name='popupAccent']"), options.popupAccent || 'sage');
    document.querySelector("[name='compactMode']").checked = options.compactMode || false;
    document.querySelector("[name='showUserGuideIcon']").checked = options.showUserGuideIcon !== false;
    setCheckedValue(document.querySelectorAll("[name='editorTheme']"), options.editorTheme || 'default');

    updateSpecialThemeControlState();
    refreshElements();
    applyThemeSettings();
}

const setCurrentLibraryChoice = (result) => {
    librarySettings = normalizeLibrarySettingsState(result);
    document.querySelector("[name='libraryEnabled']").checked = librarySettings.enabled;
    document.querySelector("[name='libraryAutoSaveOnPopupOpen']").checked = librarySettings.autoSaveOnPopupOpen;
    document.querySelector("[name='libraryItemsToKeep']").value = librarySettings.itemsToKeep;
    refreshElements();
}

const setCurrentAgentBridgeChoice = (settingsResult, statusResult = agentBridgeStatus) => {
    agentBridgeSettings = normalizeAgentBridgeSettingsState(settingsResult);
    agentBridgeStatus = normalizeAgentBridgeStatusState(statusResult);

    const toggle = document.querySelector("[name='agentBridgeEnabled']");
    if (toggle) {
        toggle.checked = agentBridgeSettings.enabled;
    }

    const container = document.getElementById('agent-bridge-container');
    const statusText = document.getElementById('agentBridgeStatusText');
    const statusHint = document.getElementById('agentBridgeStatusHint');
    const toggleHint = document.getElementById('agentBridgeToggleHint');
    const versionEl = document.getElementById('agentBridgeHostVersion');

    let text = 'Disabled';
    let hint = 'Enable the Agent Bridge to let MarkSnip connect to the local companion.';
    let state = 'disabled';

    if (usesOptionalNativeMessagingPermission() && agentBridgeSettings.enabled && !agentBridgeStatus.permissionGranted) {
        text = 'Permission needed';
        hint = 'Grant native messaging permission to let MarkSnip connect to the local companion.';
        state = 'permission-needed';
    } else if (agentBridgeSettings.enabled && agentBridgeStatus.connecting) {
        text = 'Checking connection';
        hint = 'MarkSnip is waiting for the local companion to respond.';
        state = 'starting';
    } else if (agentBridgeSettings.enabled && agentBridgeStatus.connected) {
        text = `Connected${agentBridgeStatus.browser ? ` via ${agentBridgeStatus.browser}` : ''}`;
        hint = 'The local CLI can request the current page while this browser is open.';
        state = 'connected';
    } else if (agentBridgeSettings.enabled && agentBridgeStatus.lastError) {
        text = 'Waiting for companion';
        hint = 'The local companion could not be reached. Check the setup guide and try again.';
        state = 'waiting';
    } else if (agentBridgeSettings.enabled) {
        text = 'Starting';
        hint = 'MarkSnip is trying to connect to the local companion.';
        state = 'starting';
    } else if (!agentBridgeSettings.enabled && agentBridgeStatus.permissionGranted) {
        // Disabled after prior grant
        hint = 'MarkSnip will not use the local connection while disabled, even if the browser-level permission remains granted.';
    }

    if (container) {
        container.dataset.bridgeState = state;
    }
    updateAgentBridgeActionButton(state);

    if (statusText) {
        statusText.textContent = text;
    }
    if (statusHint) {
        statusHint.textContent = hint;
    }

    // Update toggle hint based on enabled state
    if (toggleHint) {
        if (agentBridgeSettings.enabled) {
            toggleHint.textContent = 'MarkSnip opens a native messaging connection while this toggle is on.';
        } else {
            toggleHint.textContent = 'When off, MarkSnip will not open a local companion connection.';
        }
    }

    if (versionEl) {
        if (agentBridgeStatus.hostVersion) {
            versionEl.textContent = `Host ${agentBridgeStatus.hostVersion}`;
            versionEl.hidden = false;
        } else {
            versionEl.textContent = '';
            versionEl.hidden = true;
        }
    }
}

const restoreOptions = () => {
    const onError = error => {
        console.error(error);
    }

    resolveAgentBridgeInstallCommand().catch(onError);

    Promise.all([
        browser.storage.sync.get(defaultOptions),
        loadLibrarySettingsState(),
        loadAgentBridgeSettingsState(),
        loadAgentBridgeStatusState()
    ]).then(([syncOptions, localLibrarySettings, localAgentBridgeSettings, localAgentBridgeStatus]) => {
        setCurrentChoice(syncOptions);
        setCurrentLibraryChoice(localLibrarySettings);
        setCurrentAgentBridgeChoice(localAgentBridgeSettings, localAgentBridgeStatus);
        refreshAgentBridgeStatusState().then((status) => {
            setCurrentAgentBridgeChoice(agentBridgeSettings, status);
        }).catch(onError);
    }, onError);
}

const show = (el, visible) => {
    if (!el) return;
    el.style.display = visible ? "" : "none";
    el.style.opacity = visible ? "1" : "0";
}

const refreshElements = () => {
    // Apply theme/accent to Options page live
    applyThemeSettings();
    updateSpecialThemeControlState();

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

    show(document.getElementById("libraryAutoSave-container"), librarySettings.enabled);
    show(document.getElementById("libraryItemsToKeep-container"), librarySettings.enabled);
}

const inputChange = async (e) => {
    if (e) {
        let key = e.target.name;
        let value = e.target.value;
        if (key == "import-file") {
            fr = new FileReader();
            fr.onload = async (ev) => {
                let lines = ev.target.result;
                const importedPayload = JSON.parse(lines);
                const importedLibrarySettings = importedPayload?.librarySettings;
                const importedOptions = { ...importedPayload };
                delete importedOptions.librarySettings;
                delete importedOptions.libraryItems;
                const previousOptions = options;
                options = normalizeImportedOptionsState(importedOptions);
                setCurrentChoice(options);
                applyContextMenuTransition(getContextMenuTransitionState(previousOptions, options));
                if (importedLibrarySettings) {
                    await saveLibrarySettingsState(importedLibrarySettings);
                    setCurrentLibraryChoice(librarySettings);
                }
                save();
                refreshElements();
            };
            fr.readAsText(e.target.files[0])
        }
        else if (key === 'libraryEnabled' || key === 'libraryAutoSaveOnPopupOpen' || key === 'libraryItemsToKeep') {
            if (e.target.type == "checkbox") value = e.target.checked;

            if (key === 'libraryEnabled') {
                librarySettings.enabled = Boolean(value);
            } else if (key === 'libraryAutoSaveOnPopupOpen') {
                librarySettings.autoSaveOnPopupOpen = Boolean(value);
            } else if (key === 'libraryItemsToKeep') {
                librarySettings.itemsToKeep = normalizeLibrarySettingsState({
                    ...librarySettings,
                    itemsToKeep: value
                }).itemsToKeep;
                document.querySelector("[name='libraryItemsToKeep']").value = librarySettings.itemsToKeep;
                await trimLibraryItemsState(librarySettings.itemsToKeep);
            }

            await saveLibrarySettingsState(librarySettings);
            setCurrentLibraryChoice(librarySettings);
            showToast("Library settings saved", "success");
        }
        else if (key === 'agentBridgeEnabled') {
            const nextEnabled = Boolean(e.target.checked);
            let reloadRequired = false;

            if (nextEnabled && usesOptionalNativeMessagingPermission() && !agentBridgeStatus.permissionGranted) {
                // Don't immediately request permission — show the preflight panel
                e.target.checked = false;
                showPermissionPanel('preflight');
                return;
            }

            agentBridgeSettings.enabled = nextEnabled;
            hidePermissionPanel();
            await saveAgentBridgeSettingsState(agentBridgeSettings);
            if (reloadRequired) {
                await reloadExtensionForAgentBridgePermissionGrant();
                return;
            }
            const refreshedStatus = await refreshAgentBridgeStatusState();
            setCurrentAgentBridgeChoice(agentBridgeSettings, refreshedStatus);
            showToast(nextEnabled ? "Agent Bridge enabled" : "Agent Bridge disabled", "success");
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

const buttonClick = async (e) => {
    if (e.target.id == "import" || e.target.closest('#import')) {
        document.getElementById("import-file").click();
    }
    else if (e.target.id == "export" || e.target.closest('#export')) {
        console.log("export");
        const json = JSON.stringify(buildExportPayload(), null, 2);
        var blob = new Blob([json], { type: "text/json" });
        var url = URL.createObjectURL(blob);
        browser.downloads.download({
            url: url,
            saveAs: true,
            filename: buildExportFilenameState(new Date())
        });
    }
    else if (e.target.id == "clear-library" || e.target.closest('#clear-library')) {
        clearLibraryItems();
    }
    else if (e.target.id == "refreshAgentBridgeStatus" || e.target.closest('#refreshAgentBridgeStatus')) {
        const refreshBtn = document.getElementById('refreshAgentBridgeStatus');
        const needsPermission = usesOptionalNativeMessagingPermission() && agentBridgeSettings.enabled && !agentBridgeStatus.permissionGranted;

        if (needsPermission) {
            if (refreshBtn) {
                refreshBtn.disabled = true;
                refreshBtn.textContent = 'Granting...';
            }

            try {
                const permissionResult = await requestAgentBridgePermission();
                if (!permissionResult.granted) {
                    setCurrentAgentBridgeChoice(agentBridgeSettings, agentBridgeStatus);
                    return;
                }

                if (permissionResult.reloadRequired) {
                    await reloadExtensionForAgentBridgePermissionGrant();
                    return;
                }

                const status = await refreshAgentBridgeStatusState();
                setCurrentAgentBridgeChoice(agentBridgeSettings, status);
                showToast("Agent Bridge permission granted", "success");
            } catch (error) {
                console.error('Failed to request Agent Bridge permission:', error);
                setCurrentAgentBridgeChoice(agentBridgeSettings, agentBridgeStatus);
                showToast(String(error), "error");
            } finally {
                if (refreshBtn) {
                    refreshBtn.disabled = false;
                }
                updateAgentBridgeActionButton(document.getElementById('agent-bridge-container')?.dataset.bridgeState || 'disabled');
            }
            return;
        }

        if (refreshBtn) {
            refreshBtn.disabled = true;
            refreshBtn.textContent = 'Checking...';
        }
        setCurrentAgentBridgeChoice(agentBridgeSettings, {
            ...agentBridgeStatus,
            connecting: true,
            connected: false,
            lastError: ''
        });

        refreshAgentBridgeStatusState()
            .then((status) => {
                setCurrentAgentBridgeChoice(agentBridgeSettings, status);
                showToast("Agent Bridge status refreshed", "success");
            })
            .catch((error) => {
                console.error('Failed to refresh Agent Bridge status:', error);
                setCurrentAgentBridgeChoice(agentBridgeSettings, agentBridgeStatus);
                showToast(String(error), "error");
            })
            .finally(() => {
                if (refreshBtn) {
                    refreshBtn.disabled = false;
                }
                updateAgentBridgeActionButton(document.getElementById('agent-bridge-container')?.dataset.bridgeState || 'disabled');
            });
    }
    else if (e.target.id == "copyAgentBridgeCommand" || e.target.closest('#copyAgentBridgeCommand')) {
        const command = document.getElementById('agentBridgeInstallCommand')?.textContent?.trim() || agentBridgeInstallCommand;
        navigator.clipboard.writeText(command)
            .then(() => {
                showToast("Install command copied", "success");
            })
            .catch((error) => {
                console.error('Failed to copy Agent Bridge install command:', error);
                showToast("Failed to copy install command", "error");
            });
    }
}

// ── Sidebar Navigation ──
async function clearLibraryItems() {
    if (!confirm('Delete all saved Library clips from this browser? This cannot be undone.')) {
        return;
    }

    try {
        await clearLibraryItemsState();
        showToast("Library cleared", "success");
    } catch (error) {
        console.error('Failed to clear library:', error);
        showToast(String(error), "error");
    }
}

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
    document.querySelectorAll('.setting-card[data-setting-key], .setting-card[data-local-setting-key]').forEach(card => {
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

async function resetSettingByCard(card) {
    const localKey = card.dataset.localSettingKey;

    if (localKey) {
        const defaults = normalizeLibrarySettingsState();
        librarySettings = {
            ...librarySettings,
            [localKey]: defaults[localKey]
        };
        if (localKey === 'itemsToKeep') {
            await trimLibraryItemsState(librarySettings.itemsToKeep);
        }
        await saveLibrarySettingsState(librarySettings);
        setCurrentLibraryChoice(librarySettings);
        showToast("Setting reset to default", "success");
        return;
    }

    const keys = card.dataset.settingKey.split(',');
    const resetResult = resetOptionKeysState(keys);
    options = resetResult.options;
    setCurrentChoice(options);
    applyContextMenuTransition(resetResult.contextMenuAction);
    save();
    showToast("Setting reset to default", "success");
}

async function resetAllSettings() {
    if (!confirm('Reset all settings to defaults? This cannot be undone.')) return;
    const resetResult = resetAllOptionsState();
    options = resetResult.options;
    setCurrentChoice(options);
    applyContextMenuTransition(resetResult.contextMenuAction);
    await resetLibrarySettingsState();
    setCurrentLibraryChoice(librarySettings);
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

    browser.storage.onChanged?.addListener?.((changes, areaName) => {
        if (areaName !== 'local') {
            return;
        }

        const bridgeApi = getAgentBridgeStateApi();
        const settingsKey = bridgeApi?.STORAGE_KEYS?.SETTINGS;
        const statusKey = bridgeApi?.STORAGE_KEYS?.STATUS;

        if (settingsKey && changes[settingsKey]) {
            agentBridgeSettings = normalizeAgentBridgeSettingsState(changes[settingsKey].newValue);
            setCurrentAgentBridgeChoice(agentBridgeSettings, agentBridgeStatus);
        }

        if (statusKey && changes[statusKey]) {
            agentBridgeStatus = normalizeAgentBridgeStatusState(changes[statusKey].newValue);
            setCurrentAgentBridgeChoice(agentBridgeSettings, agentBridgeStatus);
        }
    });

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
        // Skip permission panel buttons (they have their own handlers)
        if (['agentBridgePermContinue', 'agentBridgePermCancel', 'agentBridgePermRetry', 'agentBridgePermDismiss'].includes(input.id)) return;
        if (input.tagName == "TEXTAREA" || input.type == "text") {
            input.addEventListener('keyup', inputKeyup);
        }
        else if (input.type == "number") {
            input.addEventListener('keyup', inputKeyup);
            input.addEventListener('change', inputChange);
        }
        else if (input.tagName == "BUTTON") {
            input.addEventListener('click', buttonClick);
        }
        else input.addEventListener('change', inputChange);
    })

    // Wire up permission panel buttons
    const permContinue = document.getElementById('agentBridgePermContinue');
    const permCancel = document.getElementById('agentBridgePermCancel');
    const permRetry = document.getElementById('agentBridgePermRetry');
    const permDismiss = document.getElementById('agentBridgePermDismiss');
    const permGuideLink = document.getElementById('agentBridgePermGuideLink');

    if (permContinue) permContinue.addEventListener('click', handlePermissionContinue);
    if (permCancel) permCancel.addEventListener('click', handlePermissionCancel);
    if (permRetry) permRetry.addEventListener('click', handlePermissionRetry);
    if (permDismiss) permDismiss.addEventListener('click', handlePermissionDismiss);
    if (permGuideLink) {
        permGuideLink.addEventListener('click', (e) => {
            e.preventDefault();
            const setupGuide = document.getElementById('agentBridgeSetupGuide');
            if (setupGuide) {
                setupGuide.open = true;
                setupGuide.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            }
        });
    }
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
            delete card.dataset.searchBreadcrumb;
            delete card.dataset.searchAlias;
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

        searchResults.results.forEach(({ card, section, matches, tokenMatches }) => {
            card.classList.toggle('search-hidden', !matches);
            card.classList.toggle('search-match', matches);

            // Always clear previous annotations so stale data doesn't linger on non-matches
            delete card.dataset.searchBreadcrumb;
            delete card.dataset.searchAlias;

            if (matches) {
                totalMatches++;
                card.style.display = '';
                card.style.opacity = '1';

                const sectionLabel = section.querySelector('.section-title')?.textContent?.trim()
                    || section.dataset.sectionLabel || '';
                const cardTitle = card.querySelector('.card-title')?.textContent?.trim() || '';
                if (sectionLabel) {
                    card.dataset.searchBreadcrumb = sectionLabel + (cardTitle ? ' \u203a ' + cardTitle : '');
                }

                const aliasSources = tokenMatches.filter(m => m.fieldSource === 'alias');
                if (aliasSources.length > 0) {
                    const rawKeywords = card.dataset.searchKeywords || '';
                    const keywords = rawKeywords.split(',').map(k => k.trim()).filter(Boolean);
                    const matchedKeywords = keywords.filter(kw => {
                        const normKw = searchApi.normalizeSearchText(kw);
                        return aliasSources.some(m => normKw.includes(m.token) || normKw.startsWith(m.token));
                    });
                    if (matchedKeywords.length > 0) {
                        card.dataset.searchAlias = 'matched via: ' + matchedKeywords.slice(0, 2).join(', ');
                    }
                }

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
