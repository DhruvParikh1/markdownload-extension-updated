
// default variables
var imageList = null;
var sourceImageMap = null;
var mdClipsFolder = '';
let librarySettings = null;
let libraryItems = [];
let currentClipState = {
    title: '',
    markdown: '',
    pageUrl: ''
};
let libraryExportInProgress = false;
let libraryCardCountMode = 'words';
const autoSavedLibraryUrls = new Set();
let agentBridgeClipPersistTimeout = null;
let cm = null;
let editorInitPromise = null;
let pendingEditorValue = '';
let pendingEditorRefresh = false;
let notificationHostLoadPromise = null;
let libraryStateLoadPromise = null;
let libraryStateLoaded = false;
let batchSettingsLoadPromise = null;
let batchSettingsLoaded = false;
let activeTabPromise = null;
let activeTabCache = null;
let currentOptions = null;
let activeSiteRuleState = {
    matchedRule: null,
    overriddenKeys: [],
    effectiveOptions: null
};
let deferredStartupScheduled = false;
let deferredLibraryWarmupScheduled = false;
let previewActive = false;
let markedLoadPromise = null;
let printStylesPromise = null;
const prefersDarkScheme = window.matchMedia('(prefers-color-scheme: dark)');
const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
const POPUP_VIEW_TRANSITION_MS = 180;
const POPUP_THEME_CACHE_KEY = 'marksnip-popup-theme-cache-v1';
const countUtils = globalThis.markSnipCountUtils;
const COUNT_MODES = Array.isArray(countUtils?.COUNT_MODES) && countUtils.COUNT_MODES.length > 0
    ? countUtils.COUNT_MODES
    : ['chars', 'words', 'minRead', 'tokens'];
let lastRenderedLibraryStateKey = '';
const SPECIAL_THEME_CLASS_NAMES = ['special-theme-claude', 'special-theme-perplexity', 'special-theme-atla', 'special-theme-ben10', 'special-theme-colorblind'];
const COLORBLIND_VARIANT_CLASS_NAMES = ['colorblind-theme-deuteranopia', 'colorblind-theme-protanopia', 'colorblind-theme-tritanopia'];
const ACCENT_CLASS_NAMES = ['accent-sage', 'accent-ocean', 'accent-slate', 'accent-rose', 'accent-amber'];
const EXPORT_TYPE_ORDER = ['markdown', 'text', 'html', 'pdf'];
const EXPORT_TYPE_SET = new Set(EXPORT_TYPE_ORDER);
const EXPORT_BUTTON_ICONS = {
    download: `
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
            <polyline points="7 10 12 15 17 10"/>
            <line x1="12" y1="15" x2="12" y2="3"/>
        </svg>
    `,
    file: `
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
            <polyline points="14 2 14 8 20 8"/>
            <line x1="9" y1="13" x2="15" y2="13"/>
            <line x1="9" y1="17" x2="15" y2="17"/>
        </svg>
    `
};
const EXPORT_TYPE_CONFIG = {
    markdown: {
        mainLabel: 'Download',
        selectionLabel: 'Download Selection',
        dropdownLabel: 'Markdown (.md)',
        icon: 'download'
    },
    text: {
        mainLabel: 'Download TXT',
        selectionLabel: 'Download Selection as TXT',
        dropdownLabel: 'Plain Text (.txt)',
        icon: 'download',
        fileExtension: 'txt',
        mimeType: 'text/plain;charset=utf-8'
    },
    html: {
        mainLabel: 'Download HTML',
        selectionLabel: 'Download Selection as HTML',
        dropdownLabel: 'HTML (.html)',
        icon: 'download',
        fileExtension: 'html',
        mimeType: 'text/html;charset=utf-8'
    },
    pdf: {
        mainLabel: 'Save as PDF',
        selectionLabel: 'Save Selection as PDF',
        dropdownLabel: 'Save as PDF',
        icon: 'file'
    }
};

function normalizeColorBlindTheme(value) {
    return ['deuteranopia', 'protanopia', 'tritanopia'].includes(value) ? value : 'deuteranopia';
}

function getColorBlindThemeClassName(value) {
    return 'colorblind-theme-' + normalizeColorBlindTheme(value);
}

function getResolvedSpecialThemeKey(specialTheme, colorBlindTheme) {
    if (specialTheme === 'colorblind') {
        return 'colorblind-' + normalizeColorBlindTheme(colorBlindTheme);
    }
    return specialTheme;
}
const dom = {
    root: document.documentElement,
    body: document.body,
    spinner: document.getElementById('spinner'),
    container: document.getElementById('container'),
    batchContainer: document.getElementById('batchContainer'),
    editorTextarea: document.getElementById('md'),
    titleInput: document.getElementById('title'),
    charCount: document.getElementById('char-count'),
    downloadButton: document.getElementById('download'),
    downloadSelectionButton: document.getElementById('downloadSelection'),
    copyButton: document.getElementById('copy'),
    copySelectionButton: document.getElementById('copySelection'),
    includeTemplate: document.getElementById('includeTemplate'),
    downloadImages: document.getElementById('downloadImages'),
    includeTemplateRuleHint: document.getElementById('includeTemplateRuleHint'),
    downloadImagesRuleHint: document.getElementById('downloadImagesRuleHint'),
    selectedButton: document.getElementById('selected'),
    documentButton: document.getElementById('document'),
    clipOption: document.getElementById('clipOption'),
    urlList: document.getElementById('urlList'),
    convertUrlsButton: document.getElementById('convertUrls'),
    pickLinksButton: document.getElementById('pickLinks'),
    batchSaveModeToggle: document.getElementById('batchSaveModeToggle'),
    batchProcessButton: document.getElementById('batchProcess'),
    openGuideButton: document.getElementById('openGuide'),
    guideDropdownWrap:      document.getElementById('guideDropdownWrap'),
    guideDropdown:          document.getElementById('guideDropdown'),
    guideLink:              document.getElementById('guideLink'),
    showShortcutsBtn:       document.getElementById('showShortcuts'),
    shortcutsModal:         document.getElementById('shortcutsModal'),
    shortcutsModalBackdrop: document.getElementById('shortcutsModalBackdrop'),
    shortcutsModalBody:     document.getElementById('shortcutsModalBody'),
    closeShortcutsModalBtn: document.getElementById('closeShortcutsModal'),
    sendToObsidianButton: document.getElementById('sendToObsidian'),
    previewToggle: document.getElementById('previewToggle'),
    editorPreview: document.getElementById('editorPreview'),
    splitExport: document.getElementById('splitExport'),
    splitButtonWrap: document.getElementById('splitBtnWrap'),
    splitButtonArrow: document.getElementById('splitArrow'),
    splitDropdown: document.getElementById('splitDropdown'),
    markdownButton: document.getElementById('ddMarkdown'),
    textButton: document.getElementById('ddText'),
    htmlButton: document.getElementById('ddHtml'),
    printButton: document.getElementById('ddPrint'),
    pdfButton: document.getElementById('ddPdf')
};

globalThis.cm = null;

const libraryUI = {
    toggle: document.getElementById('libraryViewToggle'),
    container: document.getElementById('libraryContainer'),
    close: document.getElementById('closeLibraryView'),
    countBadge: document.getElementById('libraryCountBadge'),
    saveButton: document.getElementById('saveLibraryClip'),
    exportButton: document.getElementById('exportLibraryAll'),
    exportDropdown: document.getElementById('exportLibraryAll')?.closest('.export-dropdown'),
    exportDropdownMenu: document.getElementById('exportDropdownMenu'),
    toolbarNote: document.getElementById('libraryToolbarNote'),
    status: document.getElementById('libraryStatus'),
    emptyState: document.getElementById('libraryEmptyState'),
    emptyText: document.getElementById('libraryEmptyText'),
    list: document.getElementById('libraryList')
};

const popupViews = {
    main: dom.container,
    batch: dom.batchContainer,
    library: libraryUI.container
};

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

function resolveDefaultExportType(options = currentOptions) {
    const exportType = String(options?.defaultExportType || '').trim().toLowerCase();
    return EXPORT_TYPE_SET.has(exportType) ? exportType : 'markdown';
}

function getExportTypeConfig(exportType) {
    return EXPORT_TYPE_CONFIG[resolveDefaultExportType({ defaultExportType: exportType })] || EXPORT_TYPE_CONFIG.markdown;
}

function getDropdownExportButtons() {
    return {
        markdown: dom.markdownButton,
        text: dom.textButton,
        html: dom.htmlButton,
        pdf: dom.pdfButton
    };
}

function setExportButtonContent(button, label, iconKey = 'download') {
    if (!button) {
        return;
    }

    const iconMarkup = EXPORT_BUTTON_ICONS[iconKey] || EXPORT_BUTTON_ICONS.download;
    button.innerHTML = `${iconMarkup}${label}`;
}

function updatePopupExportControls(options = currentOptions) {
    const exportType = resolveDefaultExportType(options);
    const config = getExportTypeConfig(exportType);

    setExportButtonContent(dom.downloadButton, config.mainLabel, config.icon);
    setExportButtonContent(dom.downloadSelectionButton, config.selectionLabel, config.icon);

    if (dom.downloadButton) {
        dom.downloadButton.setAttribute('aria-label', config.mainLabel);
        dom.downloadButton.title = config.mainLabel;
    }

    if (dom.downloadSelectionButton) {
        dom.downloadSelectionButton.setAttribute('aria-label', config.selectionLabel);
        dom.downloadSelectionButton.title = config.selectionLabel;
    }

    const dropdownButtons = getDropdownExportButtons();
    EXPORT_TYPE_ORDER.forEach((kind) => {
        const button = dropdownButtons[kind];
        if (!button) {
            return;
        }

        button.hidden = kind === exportType;
    });
}

let popupViewsInitialized = false;
let activePopupView = null;
let lastNonLibraryView = 'main';
let popupViewTransitionToken = 0;

let darkMode = prefersDarkScheme.matches;

function initializePopupViews() {
    if (popupViewsInitialized) {
        return;
    }

    Object.values(popupViews).forEach((viewEl) => {
        if (!viewEl) {
            return;
        }
        viewEl.classList.add('popup-view');
        viewEl.classList.remove('is-active', 'is-entering', 'is-exiting');
    });

    if (libraryUI.container) {
        libraryUI.container.setAttribute('aria-hidden', 'true');
    }

    popupViewsInitialized = true;
}

function syncPopupViewUi(nextView) {
    if (libraryUI.container) {
        libraryUI.container.setAttribute('aria-hidden', String(nextView !== 'library'));
    }

    libraryUI.toggle?.classList.toggle('active', nextView === 'library');
}

function getPopupViewFocusTarget(viewName) {
    switch (viewName) {
        case 'main':
            return dom.downloadButton;
        case 'batch':
            return dom.urlList || dom.convertUrlsButton;
        case 'library':
            return libraryUI.close;
        default:
            return null;
    }
}

function canFocusPopupTarget(target) {
    if (!target || target.disabled) {
        return false;
    }

    const style = window.getComputedStyle(target);
    return style.display !== 'none' &&
        style.visibility !== 'hidden' &&
        target.getClientRects().length > 0;
}

async function focusPopupView(viewName) {
    const target = getPopupViewFocusTarget(viewName);
    await afterNextPaint();
    if (canFocusPopupTarget(target)) {
        target.focus({ preventScroll: true });
    }
}

async function setPopupView(nextView, options = {}) {
    const { immediate = false, focus = true } = options;
    const targetView = popupViews[nextView];
    if (!targetView) {
        return;
    }

    initializePopupViews();

    if (nextView !== 'library') {
        lastNonLibraryView = nextView;
    }

    const previousView = activePopupView;
    activePopupView = nextView;
    const transitionToken = ++popupViewTransitionToken;
    const shouldSkipAnimation = immediate || prefersReducedMotion.matches || !previousView || previousView === nextView;

    if (shouldSkipAnimation) {
        Object.entries(popupViews).forEach(([viewName, viewEl]) => {
            if (!viewEl) {
                return;
            }

            viewEl.classList.remove('is-entering', 'is-exiting');
            viewEl.classList.toggle('is-active', viewName === nextView);
        });

        syncPopupViewUi(nextView);

        if (focus) {
            await focusPopupView(nextView);
        }
        return;
    }

    Object.entries(popupViews).forEach(([viewName, viewEl]) => {
        if (!viewEl) {
            return;
        }

        viewEl.classList.remove('is-active', 'is-entering', 'is-exiting');

        if (viewName === previousView) {
            viewEl.classList.add('is-exiting');
        } else if (viewName === nextView) {
            viewEl.classList.add('is-entering');
        }
    });

    syncPopupViewUi(nextView);

    await new Promise((resolve) => {
        window.setTimeout(resolve, POPUP_VIEW_TRANSITION_MS);
    });

    if (transitionToken !== popupViewTransitionToken || activePopupView !== nextView) {
        return;
    }

    Object.entries(popupViews).forEach(([viewName, viewEl]) => {
        if (!viewEl) {
            return;
        }

        viewEl.classList.remove('is-entering', 'is-exiting');
        viewEl.classList.toggle('is-active', viewName === nextView);
    });

    syncPopupViewUi(nextView);

    if (focus) {
        await focusPopupView(nextView);
    }
}

function getLibraryStateApi() {
    return globalThis.markSnipLibraryState || null;
}

function getAgentBridgeStateApi() {
    return globalThis.markSnipAgentBridgeState || null;
}

function queuePersistAgentBridgeClip(snapshot = currentClipState) {
    const api = getAgentBridgeStateApi();
    if (!api?.saveLatestClip) {
        return;
    }

    const nextSnapshot = {
        title: String(snapshot?.title || '').trim(),
        markdown: String(snapshot?.markdown || ''),
        pageUrl: String(snapshot?.pageUrl || '').trim(),
        source: 'popup'
    };

    if (!nextSnapshot.pageUrl || !nextSnapshot.markdown.trim()) {
        return;
    }

    if (agentBridgeClipPersistTimeout) {
        clearTimeout(agentBridgeClipPersistTimeout);
    }

    agentBridgeClipPersistTimeout = setTimeout(() => {
        api.saveLatestClip(nextSnapshot).catch((error) => {
            console.error('Failed to persist Agent Bridge clip snapshot:', error);
        });
    }, 250);
}

// Theme application
const EDITOR_THEME_MAP = {
    default:   { dark: 'xq-dark',        light: 'xq-light' },
    claude:    { dark: 'claude-dark',    light: 'claude-light' },
    perplexity:{ dark: 'perplexity-dark',light: 'perplexity-light' },
    atla:      { dark: 'atla-dark',      light: 'atla-light' },
    ben10:     { dark: 'ben10-dark',     light: 'ben10-light' },
    'colorblind-deuteranopia': { dark: 'colorblind-deuteranopia-dark', light: 'colorblind-deuteranopia-light' },
    'colorblind-protanopia': { dark: 'colorblind-protanopia-dark', light: 'colorblind-protanopia-light' },
    'colorblind-tritanopia': { dark: 'colorblind-tritanopia-dark', light: 'colorblind-tritanopia-light' },
    dracula:   { dark: 'dracula',         light: 'dracula' },
    material:  { dark: 'material-darker', light: 'material' },
    monokai:   { dark: 'monokai',         light: 'xq-light' },
    nord:      { dark: 'nord',            light: 'xq-light' },
    solarized: { dark: 'solarized dark',  light: 'solarized light' },
    twilight:  { dark: 'twilight',         light: 'xq-light' },
};
const EDITOR_THEME_STYLESHEET_MAP = Object.freeze({
    'xq-dark': 'lib/xq-dark.css',
    'xq-light': 'lib/xq-light.css',
    'claude-dark': 'lib/claude-dark.css',
    'claude-light': 'lib/claude-light.css',
    'perplexity-dark': 'lib/perplexity-dark.css',
    'perplexity-light': 'lib/perplexity-light.css',
    'atla-dark': 'lib/atla-dark.css',
    'atla-light': 'lib/atla-light.css',
    'ben10-dark': 'lib/ben10-dark.css',
    'ben10-light': 'lib/ben10-light.css',
    'colorblind-deuteranopia-dark': 'lib/colorblind-deuteranopia-dark.css',
    'colorblind-deuteranopia-light': 'lib/colorblind-deuteranopia-light.css',
    'colorblind-protanopia-dark': 'lib/colorblind-protanopia-dark.css',
    'colorblind-protanopia-light': 'lib/colorblind-protanopia-light.css',
    'colorblind-tritanopia-dark': 'lib/colorblind-tritanopia-dark.css',
    'colorblind-tritanopia-light': 'lib/colorblind-tritanopia-light.css',
    'dracula': 'lib/dracula.css',
    'material': 'lib/material.css',
    'material-darker': 'lib/material-darker.css',
    'monokai': 'lib/monokai.css',
    'nord': 'lib/nord.css',
    'solarized dark': 'lib/solarized.css',
    'solarized light': 'lib/solarized.css',
    'twilight': 'lib/twilight.css'
});

function getFallbackWordCount(text) {
    const normalized = String(text || '').trim();
    return normalized === '' ? 0 : normalized.split(/\s+/).length;
}

function formatCounterDisplay(text, mode) {
    if (typeof countUtils?.formatCountDisplay === 'function') {
        return countUtils.formatCountDisplay(text, mode);
    }

    const normalized = String(text || '');
    if (mode === 'words') {
        return getFallbackWordCount(normalized).toLocaleString() + ' words';
    }

    if (mode === 'minRead') {
        const words = getFallbackWordCount(normalized);
        const minutes = words === 0 ? 0 : Math.max(1, Math.ceil(words / 200));
        return minutes.toLocaleString() + ' min read';
    }

    if (mode === 'tokens') {
        const remaining = normalized.replace(/\s+/g, ' ').trim();
        return Math.ceil((remaining.length || 0) / 4).toLocaleString() + ' tokens';
    }

    return normalized.length.toLocaleString() + ' chars';
}

function afterNextPaint() {
    return new Promise((resolve) => {
        requestAnimationFrame(() => resolve());
    });
}

function scheduleDeferredTask(task, timeout = 800) {
    if (typeof window.requestIdleCallback === 'function') {
        window.requestIdleCallback(() => {
            Promise.resolve().then(task).catch((error) => {
                console.error('Deferred popup task failed:', error);
            });
        }, { timeout });
        return;
    }

    setTimeout(() => {
        Promise.resolve().then(task).catch((error) => {
            console.error('Deferred popup task failed:', error);
        });
    }, 0);
}

function getEditorThemeStylesheetLink() {
    let link = document.getElementById('cm-theme-stylesheet');
    if (link) {
        return link;
    }

    link = document.createElement('link');
    link.id = 'cm-theme-stylesheet';
    link.rel = 'stylesheet';
    dom.root.querySelector('head')?.appendChild(link);
    return link;
}

function ensureEditorThemeStylesheet(themeName) {
    const href = EDITOR_THEME_STYLESHEET_MAP[themeName];
    if (!href) {
        return;
    }

    const link = getEditorThemeStylesheetLink();
    if (link.getAttribute('href') === href) {
        return;
    }

    link.setAttribute('href', href);
    link.setAttribute('data-theme-name', themeName);
}

function getEditorValue() {
    if (cm?.getValue) {
        return cm.getValue();
    }
    return dom.editorTextarea?.value || pendingEditorValue || currentClipState.markdown || '';
}

function editorHasSelection() {
    return Boolean(cm?.somethingSelected && cm.somethingSelected());
}

function getEditorSelection() {
    return cm?.getSelection ? cm.getSelection() : '';
}

function syncSelectionActionVisibility(showSelectionActions) {
    if (dom.downloadSelectionButton) {
        dom.downloadSelectionButton.style.display = showSelectionActions ? 'block' : 'none';
    }
    if (dom.copySelectionButton) {
        dom.copySelectionButton.style.display = showSelectionActions ? 'block' : 'none';
    }
}

function setEditorValue(value) {
    const nextValue = String(value || '');
    pendingEditorValue = nextValue;
    currentClipState.markdown = nextValue;

    if (cm?.getValue) {
        if (cm.getValue() !== nextValue) {
            cm.setValue(nextValue);
            return;
        }
    } else if (dom.editorTextarea) {
        dom.editorTextarea.value = nextValue;
    }

    updateSaveLibraryButtonState();
    updateCharCount(nextValue);
}

function refreshEditor() {
    if (cm?.refresh) {
        cm.refresh();
        return;
    }
    pendingEditorRefresh = true;
}

function initializeEditor() {
    if (editorInitPromise) {
        return editorInitPromise;
    }

    editorInitPromise = Promise.resolve().then(() => {
        const initialValue = pendingEditorValue || dom.editorTextarea?.value || currentClipState.markdown || '';
        if (dom.editorTextarea) {
            dom.editorTextarea.value = initialValue;
        }

        cm = CodeMirror.fromTextArea(dom.editorTextarea, {
            theme: resolveEditorTheme(
                currentOptions?.editorTheme || 'default',
                darkMode,
                currentOptions?.specialTheme || 'none',
                currentOptions?.colorBlindTheme
            ),
            mode: 'markdown',
            lineWrapping: true
        });
        globalThis.cm = cm;

        cm.on('change', (instance) => {
            const nextValue = instance.getValue();
            pendingEditorValue = nextValue;
            currentClipState.markdown = nextValue;
            updateSaveLibraryButtonState();
            updateCharCount(nextValue);
            queuePersistAgentBridgeClip();
            if (previewActive) {
                renderPreviewContent();
            }
        });

        cm.on('cursorActivity', (instance) => {
            const somethingSelected = instance.somethingSelected();
            syncSelectionActionVisibility(somethingSelected);
            updateCharCount(somethingSelected ? instance.getSelection() : currentClipState.markdown);
        });

        syncSelectionActionVisibility(false);
        updateCharCount(initialValue);

        if (pendingEditorRefresh) {
            pendingEditorRefresh = false;
            requestAnimationFrame(() => cm.refresh());
        }

        return cm;
    });

    return editorInitPromise;
}

function loadScriptOnce(src, id) {
    if (id) {
        const existingById = document.getElementById(id);
        if (existingById) {
            return Promise.resolve(existingById);
        }
    }

    const existing = Array.from(document.scripts).find((script) => script.getAttribute('src') === src);
    if (existing) {
        return Promise.resolve(existing);
    }

    return new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.type = 'application/javascript';
        script.src = src;
        if (id) {
            script.id = id;
        }
        script.addEventListener('load', () => resolve(script), { once: true });
        script.addEventListener('error', () => reject(new Error(`Failed to load script: ${src}`)), { once: true });
        document.body.appendChild(script);
    });
}

function loadStylesheetOnce(href, id) {
    if (id) {
        const existingById = document.getElementById(id);
        if (existingById) {
            return Promise.resolve(existingById);
        }
    }

    const existing = Array.from(document.querySelectorAll('link[rel="stylesheet"]'))
        .find((link) => link.getAttribute('href') === href);
    if (existing) {
        return Promise.resolve(existing);
    }

    return new Promise((resolve, reject) => {
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = href;
        if (id) {
            link.id = id;
        }
        link.addEventListener('load', () => resolve(link), { once: true });
        link.addEventListener('error', () => reject(new Error(`Failed to load stylesheet: ${href}`)), { once: true });
        document.head.appendChild(link);
    });
}

// --- Markdown Preview ---

const UNSAFE_LINK_RE = /^\s*javascript\s*:/i;
const SAFE_PREVIEW_PROTOCOLS = new Set(['http:', 'https:', 'mailto:']);

function escapeHtml(str) {
    return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function getPreviewBaseUrl() {
    if (currentClipState?.pageUrl) {
        return currentClipState.pageUrl;
    }

    return window.location.href;
}

function resolveSafePreviewHref(href) {
    const nextHref = String(href || '').trim();
    if (!nextHref || UNSAFE_LINK_RE.test(nextHref)) {
        return null;
    }

    try {
        const resolved = new URL(nextHref, getPreviewBaseUrl());
        if (!SAFE_PREVIEW_PROTOCOLS.has(resolved.protocol)) {
            return null;
        }

        return resolved.href;
    } catch (_error) {
        return null;
    }
}

function ensureMarkedLoaded() {
    if (markedLoadPromise) {
        return markedLoadPromise;
    }

    markedLoadPromise = Promise.all([
        loadScriptOnce('lib/marked.min.js', 'marked-script'),
        loadStylesheetOnce('lib/github-markdown.css', 'github-markdown-css')
    ]).then(() => {
        if (typeof marked === 'undefined' || !marked.parse) {
            throw new Error('marked library failed to initialize');
        }
    }).catch((error) => {
        markedLoadPromise = null;
        throw error;
    });

    return markedLoadPromise;
}

function resolveSafePrintAssetHref(href) {
    const nextHref = String(href || '').trim();
    if (!nextHref || UNSAFE_LINK_RE.test(nextHref)) {
        return null;
    }

    try {
        const resolved = new URL(nextHref, getPreviewBaseUrl());
        if (!['http:', 'https:', 'data:'].includes(resolved.protocol)) {
            return null;
        }

        return resolved.href;
    } catch (_error) {
        return null;
    }
}

function buildMarkedRenderer({ renderImages = false } = {}) {
    const renderer = new marked.Renderer();

    renderer.html = function ({ text }) {
        return escapeHtml(text || '');
    };

    renderer.image = function ({ href, title, text }) {
        const alt = escapeHtml(text || '');
        const safeSrc = resolveSafePrintAssetHref(href);
        const titleAttr = title ? ` title="${escapeHtml(title)}"` : '';

        if (!safeSrc) {
            return `<span class="preview-image-placeholder">[image: ${alt || 'image'}]</span>`;
        }

        if (!renderImages) {
            return `<span class="preview-image-placeholder">[image: <a href="${escapeHtml(safeSrc)}" target="_blank" rel="noopener noreferrer"${titleAttr}>${alt || escapeHtml(safeSrc)}</a>]</span>`;
        }

        return `<img src="${escapeHtml(safeSrc)}" alt="${alt}" loading="eager"${titleAttr}>`;
    };

    renderer.link = function ({ href, title, tokens }) {
        const text = this.parser.parseInline(tokens);
        const safeHref = resolveSafePreviewHref(href);
        if (!safeHref) {
            return text;
        }

        const titleAttr = title ? ` title="${escapeHtml(title)}"` : '';
        return `<a href="${escapeHtml(safeHref)}" target="_blank" rel="noopener noreferrer"${titleAttr}>${text}</a>`;
    };

    return renderer;
}

function renderMarkdownToHtml(raw, options = {}) {
    return marked.parse(raw, {
        renderer: buildMarkedRenderer(options)
    });
}

function renderPreviewContent() {
    if (!previewActive || !dom.editorPreview) {
        return;
    }

    const raw = getEditorValue();

    const body = dom.editorPreview.querySelector('.markdown-body');
    if (!body) {
        return;
    }

    try {
        body.innerHTML = renderMarkdownToHtml(raw);
    } catch (err) {
        body.textContent = 'Preview rendering failed: ' + err.message;
    }
}

async function togglePreview() {
    previewActive = !previewActive;

    if (dom.previewToggle) {
        dom.previewToggle.setAttribute('aria-pressed', String(previewActive));
        dom.previewToggle.classList.toggle('active', previewActive);
    }

    if (previewActive) {
        try {
            await ensureMarkedLoaded();
        } catch (err) {
            console.error('Failed to load preview dependencies:', err);
            previewActive = false;
            if (dom.previewToggle) {
                dom.previewToggle.setAttribute('aria-pressed', 'false');
                dom.previewToggle.classList.remove('active');
            }
            return;
        }
        renderPreviewContent();
    }

    // Toggle visibility: hide editor, show preview (or vice versa)
    const cmWrapper = document.querySelector('.editor-section .CodeMirror');
    const textarea = dom.editorTextarea;

    if (previewActive) {
        if (cmWrapper) cmWrapper.style.display = 'none';
        else if (textarea) textarea.style.display = 'none';
        if (dom.editorPreview) dom.editorPreview.hidden = false;
    } else {
        if (cmWrapper) cmWrapper.style.display = '';
        else if (textarea) textarea.style.display = '';
        if (dom.editorPreview) dom.editorPreview.hidden = true;
        // Refresh CodeMirror after re-showing to fix layout
        if (cm?.refresh) {
            requestAnimationFrame(() => cm.refresh());
        }
    }
}

dom.previewToggle?.addEventListener('click', togglePreview);

async function getPrintStyles() {
    if (printStylesPromise) {
        return printStylesPromise;
    }

    const assetPaths = ['popup/lib/github-markdown.css', 'print/print.css'];
    printStylesPromise = Promise.all(assetPaths.map(async (assetPath) => {
        const response = await fetch(browser.runtime.getURL(assetPath));
        if (!response.ok) {
            throw new Error(`Failed to load print asset: ${assetPath}`);
        }

        return await response.text();
    })).then((parts) => parts.join('\n\n')).catch((error) => {
        printStylesPromise = null;
        throw error;
    });

    return printStylesPromise;
}

function buildPrintableDocument({ title, bodyHtml, styles }) {
    const safeTitle = escapeHtml(title || 'Untitled');
    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${safeTitle}</title>
  <style>${styles}</style>
</head>
<body>
  <main class="print-shell">
    <article class="markdown-body">
      ${bodyHtml}
    </article>
  </main>
</body>
</html>`;
}

function getCurrentExportTitle() {
    return String(dom.titleInput?.value || currentClipState.title || 'Untitled').trim() || 'Untitled';
}

function renderHtmlToPlainText(bodyHtml) {
    const parser = new DOMParser();
    const parsedDocument = parser.parseFromString(`<body>${bodyHtml}</body>`, 'text/html');
    const rawText = typeof parsedDocument.body.innerText === 'string'
        ? parsedDocument.body.innerText
        : (parsedDocument.body.textContent || '');

    return rawText
        .replace(/\r\n/g, '\n')
        .replace(/\n{3,}/g, '\n\n')
        .trim();
}

async function buildHtmlExportDocument(markdown, title) {
    const nextMarkdown = String(markdown || '').trim();
    if (!nextMarkdown) {
        throw new Error('No Markdown content available to export');
    }

    await ensureMarkedLoaded();
    const [styles] = await Promise.all([
        getPrintStyles()
    ]);
    const bodyHtml = renderMarkdownToHtml(nextMarkdown, { renderImages: true });

    return buildPrintableDocument({
        title,
        bodyHtml,
        styles
    });
}

async function buildGeneratedExport(kind, markdown, title) {
    const nextMarkdown = String(markdown || '').trim();
    if (!nextMarkdown) {
        throw new Error('No Markdown content available to export');
    }

    const exportType = resolveDefaultExportType({ defaultExportType: kind });
    const config = getExportTypeConfig(exportType);

    if (exportType === 'text') {
        await ensureMarkedLoaded();
        const bodyHtml = renderMarkdownToHtml(nextMarkdown, { renderImages: false });
        return {
            content: renderHtmlToPlainText(bodyHtml),
            fileExtension: config.fileExtension,
            mimeType: config.mimeType
        };
    }

    if (exportType === 'html') {
        return {
            content: await buildHtmlExportDocument(nextMarkdown, title),
            fileExtension: config.fileExtension,
            mimeType: config.mimeType
        };
    }

    throw new Error(`Unsupported generated export type: ${kind}`);
}

async function executePrintDocument(tabId, htmlDocument, kind) {
    return browser.scripting.executeScript({
        target: { tabId },
        func: async ({ htmlDocument: nextHtmlDocument, kind: nextKind }) => {
            const cleanupExisting = () => {
                document.getElementById('__marksnip-print-frame__')?.remove();
            };

            cleanupExisting();

            const iframe = document.createElement('iframe');
            iframe.id = '__marksnip-print-frame__';
            iframe.setAttribute('aria-hidden', 'true');
            iframe.style.position = 'fixed';
            iframe.style.width = '0';
            iframe.style.height = '0';
            iframe.style.opacity = '0';
            iframe.style.pointerEvents = 'none';
            iframe.style.border = '0';
            iframe.style.right = '0';
            iframe.style.bottom = '0';
            iframe.dataset.printKind = nextKind || 'print';
            iframe.srcdoc = nextHtmlDocument;
            document.documentElement.appendChild(iframe);

            const waitForFrameLoad = () => new Promise((resolve, reject) => {
                const timeout = setTimeout(() => reject(new Error('Timed out while preparing print document')), 10000);
                iframe.addEventListener('load', () => {
                    clearTimeout(timeout);
                    resolve();
                }, { once: true });
            });

            const waitForImages = async (frameDocument) => {
                const images = Array.from(frameDocument.images || []).filter((image) => !image.complete);
                if (images.length === 0) {
                    return;
                }

                await Promise.race([
                    Promise.all(images.map((image) => new Promise((resolve) => {
                        image.addEventListener('load', resolve, { once: true });
                        image.addEventListener('error', resolve, { once: true });
                    }))),
                    new Promise((resolve) => setTimeout(resolve, 1500))
                ]);
            };

            try {
                await waitForFrameLoad();
                const frameWindow = iframe.contentWindow;
                const frameDocument = frameWindow?.document;
                if (!frameWindow || !frameDocument) {
                    throw new Error('Print frame is unavailable');
                }

                await waitForImages(frameDocument);
                await new Promise((resolve) => setTimeout(resolve, 100));

                const cleanup = () => {
                    setTimeout(cleanupExisting, 250);
                };

                frameWindow.addEventListener('afterprint', cleanup, { once: true });
                setTimeout(cleanup, 10000);
                frameWindow.focus();
                frameWindow.print();
                return { ok: true };
            } catch (error) {
                cleanupExisting();
                throw error;
            }
        },
        args: [{
            htmlDocument,
            kind
        }]
    });
}

async function handlePrintExport(kind = 'print', { markdown = getEditorValue(), title = getCurrentExportTitle() } = {}) {
    closeSplitDropdown();

    const nextMarkdown = String(markdown || '').trim();
    if (!nextMarkdown) {
        throw new Error('No Markdown content available to print');
    }

    const nextTitle = String(title || '').trim() || 'Untitled';
    const [htmlDocument, activeTab] = await Promise.all([
        buildHtmlExportDocument(nextMarkdown, nextTitle),
        getActiveTab()
    ]);

    if (!activeTab?.id) {
        throw new Error('No active tab found');
    }

    await executePrintDocument(activeTab.id, htmlDocument, kind);
}

function loadNotificationHostDeferred() {
    if (notificationHostLoadPromise) {
        return notificationHostLoadPromise;
    }

    notificationHostLoadPromise = loadScriptOnce('../notifications/notification-host.js', 'notification-host-script').catch((error) => {
        console.error('Failed to load notification host:', error);
        throw error;
    });
    return notificationHostLoadPromise;
}

async function getActiveTab(forceRefresh = false) {
    if (!forceRefresh && activeTabCache) {
        return activeTabCache;
    }

    if (!forceRefresh && activeTabPromise) {
        return activeTabPromise;
    }

    activeTabPromise = browser.tabs.query({
        currentWindow: true,
        active: true
    }).then((tabs) => {
        activeTabCache = tabs?.[0] || null;
        return activeTabCache;
    }).finally(() => {
        activeTabPromise = null;
    });

    return activeTabPromise;
}

async function getActiveTabId(forceRefresh = false) {
    return (await getActiveTab(forceRefresh))?.id ?? null;
}

function resolveEditorTheme(editorTheme, isDark, specialTheme = 'none', colorBlindTheme = currentOptions?.colorBlindTheme) {
    const resolvedSpecialTheme = getResolvedSpecialThemeKey(specialTheme, colorBlindTheme);
    if (specialTheme !== 'none' && EDITOR_THEME_MAP[resolvedSpecialTheme]) {
        const specialEntry = EDITOR_THEME_MAP[resolvedSpecialTheme];
        return isDark ? specialEntry.dark : specialEntry.light;
    }

    const entry = EDITOR_THEME_MAP[editorTheme] || EDITOR_THEME_MAP.default;
    return isDark ? entry.dark : entry.light;
}

function buildPopupThemeCacheSnapshot(options = currentOptions || defaultOptions) {
    return {
        popupTheme: options?.popupTheme || 'system',
        specialTheme: options?.specialTheme || 'none',
        colorBlindTheme: normalizeColorBlindTheme(options?.colorBlindTheme),
        specialThemeIcon: options?.specialThemeIcon !== false,
        popupAccent: options?.popupAccent || 'sage',
        editorTheme: options?.editorTheme || 'default'
    };
}

function persistPopupThemeCache(options = currentOptions || defaultOptions) {
    try {
        localStorage.setItem(POPUP_THEME_CACHE_KEY, JSON.stringify(buildPopupThemeCacheSnapshot(options)));
    } catch (error) {
        console.debug('Unable to persist popup theme cache:', error);
    }
}

function applyThemeSettings(options) {
    const specialTheme = options.specialTheme || 'none';

    // Apply theme mode
    dom.root.classList.remove('theme-light', 'theme-dark', 'theme-system');
    dom.root.classList.add('theme-' + (options.popupTheme || 'system'));

    dom.root.classList.remove(...SPECIAL_THEME_CLASS_NAMES);
    dom.root.classList.remove(...COLORBLIND_VARIANT_CLASS_NAMES);
    if (specialTheme !== 'none') {
        dom.root.classList.add('special-theme-' + specialTheme);
        if (specialTheme === 'colorblind') {
            dom.root.classList.add(getColorBlindThemeClassName(options.colorBlindTheme));
        }
    }

    dom.root.classList.toggle('hide-theme-icon', options.specialThemeIcon === false);

    // Apply accent color
    dom.root.classList.remove(...ACCENT_CLASS_NAMES);
    const accent = options.popupAccent || 'sage';
    if (specialTheme === 'none' && accent !== 'sage') {
        dom.root.classList.add('accent-' + accent);
    }

    // Compact mode
    dom.body.classList.toggle('compact-mode', !!options.compactMode);

    // Update CodeMirror theme based on resolved dark mode + editor theme
    const isDark = options.popupTheme === 'dark' ||
        (options.popupTheme !== 'light' && prefersDarkScheme.matches);
    darkMode = isDark;
    const themeName = resolveEditorTheme(options.editorTheme || 'default', isDark, specialTheme, options.colorBlindTheme);
    ensureEditorThemeStylesheet(themeName);
    if (typeof cm !== 'undefined' && cm) {
        cm.setOption('theme', themeName);
    }

    // Re-render preview if active (theme classes affect preview styling)
    if (previewActive) {
        renderPreviewContent();
    }

    persistPopupThemeCache(options);
}

// Char/word/token counter
let countMode = 'chars';
let _lastCounterText = '';

function updateCharCount(value) {
    _lastCounterText = value;
    if (!dom.charCount) return;
    dom.charCount.textContent = formatCounterDisplay(value, countMode);
}

dom.charCount?.addEventListener('click', () => {
    const idx = COUNT_MODES.indexOf(countMode);
    countMode = COUNT_MODES[(idx + 1) % COUNT_MODES.length];
    updateCharCount(_lastCounterText);
    browser.storage.local.set({ countMode });
});

function getCardCountDisplay(markdown, mode) {
    return formatCounterDisplay(markdown, mode);
}

function updateAllCardCountBadges() {
    if (!libraryUI.list) return;
    libraryUI.list.querySelectorAll('.library-card-count-badge').forEach((badge) => {
        const id = badge.dataset.itemId;
        const entry = libraryItems.find((i) => i.id === id);
        if (entry !== undefined) {
            badge.textContent = getCardCountDisplay(entry.markdown || '', libraryCardCountMode);
        }
    });
}
dom.downloadButton?.addEventListener("click", download);
dom.downloadSelectionButton?.addEventListener("click", downloadSelection);
dom.titleInput?.addEventListener("input", (event) => {
    currentClipState.title = event.target.value;
    queuePersistAgentBridgeClip();
});

dom.copyButton?.addEventListener("click", copyToClipboard);
dom.copySelectionButton?.addEventListener("click", copySelectionToClipboard);

dom.sendToObsidianButton?.addEventListener("click", sendToObsidian);
dom.splitButtonArrow?.addEventListener("click", toggleSplitDropdown);
dom.markdownButton?.addEventListener("click", async (event) => {
    event.preventDefault();
    try {
        await handleExplicitExport('markdown');
    } catch (error) {
        console.error('Error exporting Markdown:', error);
    }
});
dom.textButton?.addEventListener("click", async (event) => {
    event.preventDefault();
    try {
        await handleExplicitExport('text');
    } catch (error) {
        console.error('Error exporting plain text:', error);
    }
});
dom.htmlButton?.addEventListener("click", async (event) => {
    event.preventDefault();
    try {
        await handleExplicitExport('html');
    } catch (error) {
        console.error('Error exporting HTML:', error);
    }
});
dom.printButton?.addEventListener("click", async (event) => {
    event.preventDefault();
    try {
        await handleExplicitExport('print');
    } catch (error) {
        console.error('Error starting print flow:', error);
    }
});
dom.pdfButton?.addEventListener("click", async (event) => {
    event.preventDefault();
    try {
        await handleExplicitExport('pdf');
    } catch (error) {
        console.error('Error starting PDF flow:', error);
    }
});

document.getElementById("batchProcess").addEventListener("click", showBatchProcess);
dom.convertUrlsButton?.addEventListener("click", handleBatchConversion);
document.getElementById("cancelBatch").addEventListener("click", hideBatchProcess);
libraryUI.toggle?.addEventListener("click", showLibraryView);
libraryUI.close?.addEventListener("click", hideLibraryView);
libraryUI.saveButton?.addEventListener("click", handleManualLibrarySave);
libraryUI.exportButton?.addEventListener("click", toggleExportDropdown);
libraryUI.exportDropdownMenu?.addEventListener("click", handleExportDropdownChoice);
document.addEventListener("click", closeExportDropdownOnOutsideClick);
document.addEventListener("keydown", handlePopupKeydown);
dom.openGuideButton?.addEventListener('click', toggleGuideDropdown);
dom.guideLink?.addEventListener('click', closeGuideDropdown);
dom.showShortcutsBtn?.addEventListener('click', showShortcutsModal);
dom.closeShortcutsModalBtn?.addEventListener('click', closeShortcutsModal);
dom.shortcutsModalBackdrop?.addEventListener('click', closeShortcutsModal);
dom.shortcutsModalBody?.addEventListener('click', (e) => {
    if (e.target.closest('[data-action="open-shortcut-settings"]')) {
        browser.tabs.create({ url: 'chrome://extensions/shortcuts' });
    }
});
dom.pickLinksButton?.addEventListener("click", activateLinkPicker);
dom.batchSaveModeToggle?.addEventListener("change", saveBatchSettings);
progressUI.cancelBtn?.addEventListener("click", () => {
    browser.runtime.sendMessage({ type: 'cancel-batch' }).catch(() => {});
    progressUI.cancelBtn.disabled = true;
    progressUI.cancelBtn.textContent = 'Cancelling...';
});

function getSelectedBatchSaveMode() {
    return dom.batchSaveModeToggle?.checked ? 'individual' : 'zip';
}

function setSelectedBatchSaveMode(mode) {
    if (dom.batchSaveModeToggle) dom.batchSaveModeToggle.checked = mode === 'individual';
}

// Save batch settings to storage
function saveBatchSettings() {
    const urlList = dom.urlList?.value || '';
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
        if (data.batchUrlList && dom.urlList) {
            dom.urlList.value = data.batchUrlList;
        }
        setSelectedBatchSaveMode(data.batchSaveMode || 'zip');
        validateAndPreviewUrls();
        batchSettingsLoaded = true;
        return data;
    } catch (err) {
        console.error("Error loading batch settings:", err);
        return null;
    }
}

function ensureBatchSettingsLoaded() {
    if (batchSettingsLoaded) {
        return Promise.resolve();
    }

    if (batchSettingsLoadPromise) {
        return batchSettingsLoadPromise;
    }

    batchSettingsLoadPromise = loadBatchSettings().finally(() => {
        batchSettingsLoadPromise = null;
    });
    return batchSettingsLoadPromise;
}

// Save batch URL list as user types and validate
dom.urlList?.addEventListener("input", () => {
    saveBatchSettings();
    debouncedValidateUrls();
});

async function showBatchProcess(e) {
    e.preventDefault();
    if (currentOptions?.batchProcessingEnabled === false) {
        showError("Batch Processing is disabled in Options", false);
        return;
    }

    showBatchView();
    await ensureBatchSettingsLoaded();

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
    showMainView();
}

async function activateLinkPicker(e) {
    e.preventDefault();

    try {
        const activeTab = await getActiveTab();
        if (!activeTab?.id) {
            console.error("No active tab found");
            return;
        }

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
    defaultExportType: 'markdown',
    obsidianIntegration: false,
    batchProcessingEnabled: true,
    popupTheme: 'system',
    specialTheme: 'none',
    colorBlindTheme: 'deuteranopia',
    specialThemeIcon: true,
    popupAccent: 'sage',
    compactMode: false,
    showUserGuideIcon: true,
    editorTheme: 'default',
}
currentOptions = { ...defaultOptions };

const updateObsidianButtonVisibility = (options) => {
    if (!dom.sendToObsidianButton) return;
    dom.sendToObsidianButton.style.display = options.obsidianIntegration ? "inline-flex" : "none";
}

const updateGuideButtonVisibility = (options) => {
    if (!dom.guideDropdownWrap) return;
    const shouldShow = options.showUserGuideIcon !== false;
    dom.guideDropdownWrap.hidden = !shouldShow;
    dom.guideDropdownWrap.style.display = shouldShow ? "" : "none";
    dom.guideDropdownWrap.setAttribute("aria-hidden", String(!shouldShow));
}

const updateBatchProcessButtonVisibility = (options) => {
    if (!dom.batchProcessButton) return;

    const batchProcessingEnabled = options.batchProcessingEnabled !== false;
    dom.batchProcessButton.hidden = !batchProcessingEnabled;
    dom.batchProcessButton.style.display = batchProcessingEnabled ? "" : "none";
    dom.batchProcessButton.setAttribute("aria-hidden", String(!batchProcessingEnabled));

    if (!batchProcessingEnabled && activePopupView === 'batch' && progressUI.container?.style.display !== 'flex') {
        showMainView();
    }
}

function resolveClipPageUrl(article = {}) {
    const api = getLibraryStateApi();
    const candidates = [
        article?.pageURL,
        article?.tabURL,
        article?.pageUrl,
        article?.baseURI
    ];

    for (const candidate of candidates) {
        if (!candidate) continue;
        const normalized = api?.normalizePageUrl ? api.normalizePageUrl(candidate) : String(candidate).trim();
        if (normalized) {
            return normalized;
        }
    }

    return '';
}

function updateCurrentClipState(nextState = {}) {
    currentClipState = {
        title: String(nextState.title || '').trim(),
        markdown: String(nextState.markdown || ''),
        pageUrl: String(nextState.pageUrl || '').trim()
    };
    updateSaveLibraryButtonState();
    queuePersistAgentBridgeClip(currentClipState);
}

function clonePopupOptionsSnapshot(source = currentOptions || defaultOptions) {
    const nextOptions = {
        ...(source || {})
    };
    if (source?.tableFormatting && typeof source.tableFormatting === 'object') {
        nextOptions.tableFormatting = {
            ...source.tableFormatting
        };
    }
    if (Array.isArray(source?.siteRules)) {
        nextOptions.siteRules = source.siteRules.map((rule) => ({ ...rule }));
    }
    return nextOptions;
}

function isActiveRuleOverriding(fieldName) {
    return Array.isArray(activeSiteRuleState.overriddenKeys) &&
        activeSiteRuleState.overriddenKeys.includes(fieldName);
}

function getPopupExportOptions() {
    const base = activeSiteRuleState.effectiveOptions || currentOptions || defaultOptions;
    const nextOptions = clonePopupOptionsSnapshot(base);

    if (dom.includeTemplate) {
        nextOptions.includeTemplate = dom.includeTemplate.checked;
    }
    if (dom.downloadImages) {
        nextOptions.downloadImages = dom.downloadImages.checked;
    }

    return nextOptions;
}

function updateRuleOverrideHint(fieldName, hintEl, inputEl) {
    if (!hintEl || !inputEl) {
        return;
    }

    const overridden = isActiveRuleOverriding(fieldName);
    const ruleName = activeSiteRuleState.matchedRule?.name || 'Site Rule';
    hintEl.hidden = !overridden;
    hintEl.textContent = overridden ? `Overridden by ${ruleName}` : '';
    inputEl.disabled = overridden;
    inputEl.closest('.toggle-label')?.classList.toggle('is-locked', overridden);
}

function applyActiveSiteRuleUi(sourceOptions = currentOptions || defaultOptions) {
    const effectiveOptions = activeSiteRuleState.effectiveOptions || sourceOptions || defaultOptions;

    if (dom.includeTemplate) {
        dom.includeTemplate.checked = Boolean(effectiveOptions.includeTemplate);
    }
    if (dom.downloadImages) {
        dom.downloadImages.checked = Boolean(effectiveOptions.downloadImages);
    }

    updateRuleOverrideHint('includeTemplate', dom.includeTemplateRuleHint, dom.includeTemplate);
    updateRuleOverrideHint('downloadImages', dom.downloadImagesRuleHint, dom.downloadImages);
}

function setActiveSiteRuleState(matchedRule = null, overriddenKeys = [], effectiveOptions = null) {
    activeSiteRuleState = {
        matchedRule: matchedRule && typeof matchedRule === 'object'
            ? {
                id: matchedRule.id || '',
                name: matchedRule.name || '',
                pattern: matchedRule.pattern || ''
            }
            : null,
        overriddenKeys: Array.isArray(overriddenKeys) ? overriddenKeys.slice() : [],
        effectiveOptions: effectiveOptions ? clonePopupOptionsSnapshot(effectiveOptions) : null
    };

    applyActiveSiteRuleUi(currentOptions || defaultOptions);
}

function hasSavableClip() {
    return Boolean(currentClipState.pageUrl && currentClipState.markdown.trim());
}

function updateSaveLibraryButtonState() {
    if (!libraryUI.saveButton) {
        return;
    }

    const manualMode = librarySettings?.enabled && !librarySettings?.autoSaveOnPopupOpen;
    libraryUI.saveButton.hidden = !manualMode;
    libraryUI.saveButton.style.display = manualMode ? 'flex' : 'none';
    libraryUI.saveButton.disabled = !manualMode || !hasSavableClip();
}

function updateLibraryExportButtonState() {
    if (!libraryUI.exportButton) {
        return;
    }

    const hasItems = libraryItems.length > 0;
    libraryUI.exportButton.disabled = libraryExportInProgress || !hasItems;
    libraryUI.exportButton.innerHTML = `
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
            <polyline points="7 10 12 15 17 10"/>
            <line x1="12" y1="15" x2="12" y2="3"/>
        </svg>
        ${libraryExportInProgress ? 'Exporting...' : 'Export All'}
        <svg class="export-dropdown-chevron" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
            <polyline points="6 9 12 15 18 9"/>
        </svg>
    `;

    if (libraryExportInProgress) {
        closeExportDropdown();
    }
}

function setLibraryStatus(message = '', isError = false) {
    if (!libraryUI.status) {
        return;
    }

    libraryUI.status.textContent = message;
    libraryUI.status.style.color = isError ? 'var(--error)' : 'var(--accent-dark)';
}

function formatSavedAt(savedAt) {
    if (!savedAt) {
        return '';
    }

    const date = new Date(savedAt);
    if (Number.isNaN(date.getTime())) {
        return '';
    }

    return date.toLocaleString([], {
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit'
    });
}

async function copyLibraryItemMarkdown(itemId, buttonElement) {
    const item = libraryItems.find((entry) => entry.id === itemId);
    if (!item?.markdown) {
        return;
    }

    try {
        await navigator.clipboard.writeText(item.markdown);

        if (buttonElement) {
            const originalHTML = buttonElement.innerHTML;
            buttonElement.innerHTML = `
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <polyline points="20 6 9 17 4 12"/>
                </svg>
                Copied!
            `;
            buttonElement.classList.add("success");
            setTimeout(() => {
                buttonElement.innerHTML = originalHTML;
                buttonElement.classList.remove("success");
            }, 2000);
        }
    } catch (error) {
        console.error('Failed to copy library item:', error);

        if (buttonElement) {
            const originalHTML = buttonElement.innerHTML;
            buttonElement.innerHTML = `
                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M13,13H11V7H13M13,17H11V15H13M12,2A10,10 0 0,0 2,12A10,10 0 0,0 12,22A10,10 0 0,0 22,12A10,10 0 0,0 12,2Z"/>
                </svg>
                Failed
            `;
            buttonElement.classList.add("error");
            setTimeout(() => {
                buttonElement.innerHTML = originalHTML;
                buttonElement.classList.remove("error");
            }, 2000);
        }
    }
}

async function deleteLibraryItem(itemId) {
    const api = getLibraryStateApi();
    if (!api) {
        return;
    }

    const item = libraryItems.find((entry) => entry.id === itemId);
    const itemTitle = item?.title || 'Untitled';
    const filtered = libraryItems.filter((entry) => entry.id !== itemId);

    try {
        libraryItems = await api.saveLibraryItems(filtered);
        syncLibrarySummaryUi();
        if (isLibraryViewVisible()) {
            renderLibraryItems();
        }
        setLibraryStatus(`Removed "${itemTitle}"`);
    } catch (error) {
        console.error('Failed to delete library item:', error);
        setLibraryStatus('Failed to remove clip', true);
    }
}

function animateDeleteLibraryItem(itemId, cardEl) {
    cardEl.classList.add('library-card--removing');
    let settled = false;
    function proceed() {
        if (settled) return;
        settled = true;
        deleteLibraryItem(itemId);
    }
    cardEl.addEventListener('animationend', proceed, { once: true });
    setTimeout(proceed, 400);
}

function syncLibrarySummaryUi() {
    if (libraryUI.countBadge) {
        libraryUI.countBadge.textContent = String(libraryItems.length);
    }
    updateLibraryExportButtonState();
}

function getLibraryRenderStateKey() {
    return JSON.stringify({
        items: libraryItems.map((item) => ({
            id: item.id,
            title: item.title,
            markdown: item.markdown,
            pageUrl: item.pageUrl,
            previewText: item.previewText,
            savedAt: item.savedAt
        })),
        autoSaveEnabled: librarySettings?.autoSaveOnPopupOpen !== false,
        currentPageUrl: currentClipState.pageUrl,
        countMode: libraryCardCountMode
    });
}

function renderLibraryItems(options = {}) {
    const { force = false } = options;
    if (!libraryUI.list || !libraryUI.emptyState || !libraryUI.emptyText || !libraryUI.countBadge) {
        return;
    }

    syncLibrarySummaryUi();

    const autoSaveEnabled = librarySettings?.autoSaveOnPopupOpen !== false;
    libraryUI.emptyText.textContent = autoSaveEnabled
        ? 'Open the popup on any page and the current clip will be saved here automatically.'
        : 'Manual mode is on. Use "Save Clip" to add the current page to your local library.';
    libraryUI.emptyState.hidden = libraryItems.length > 0;

    const nextRenderStateKey = getLibraryRenderStateKey();
    if (!force && nextRenderStateKey === lastRenderedLibraryStateKey) {
        return;
    }

    lastRenderedLibraryStateKey = nextRenderStateKey;
    libraryUI.list.innerHTML = '';

    const api = getLibraryStateApi();
    const currentNormalized = api?.normalizePageUrl(currentClipState.pageUrl) || '';

    libraryItems.forEach((item, index) => {
        const card = document.createElement('article');
        card.className = 'library-card';
        card.setAttribute('role', 'listitem');
        card.style.animationDelay = `${index * 40}ms`;

        const itemNormalized = item.normalizedPageUrl || (api?.normalizePageUrl(item.pageUrl) ?? '');
        if (currentNormalized && itemNormalized && currentNormalized === itemNormalized) {
            card.classList.add('library-card--current');
        }

        const header = document.createElement('div');
        header.className = 'library-card-header';

        const title = document.createElement('h3');
        title.className = 'library-card-title';
        title.textContent = item.title || 'Untitled';

        const timestamp = document.createElement('time');
        timestamp.className = 'library-card-time';
        timestamp.dateTime = item.savedAt || '';
        timestamp.textContent = formatSavedAt(item.savedAt);

        header.appendChild(title);
        header.appendChild(timestamp);

        const preview = document.createElement('p');
        preview.className = 'library-card-preview';
        preview.textContent = item.previewText || '';

        const source = document.createElement('a');
        source.className = 'library-card-source';
        source.href = item.pageUrl;
        source.target = '_blank';
        source.rel = 'noopener noreferrer';
        source.textContent = item.pageUrl;

        const actions = document.createElement('div');
        actions.className = 'library-card-actions';

        const copyButton = document.createElement('button');
        copyButton.type = 'button';
        copyButton.className = 'btn btn-secondary btn-sm';
        copyButton.textContent = 'Copy';
        copyButton.addEventListener('click', () => {
            copyLibraryItemMarkdown(item.id, copyButton);
        });

        const deleteButton = document.createElement('button');
        deleteButton.type = 'button';
        deleteButton.className = 'btn btn-sm library-card-delete';
        deleteButton.setAttribute('aria-label', `Delete clip: ${item.title || 'Untitled'}`);
        deleteButton.innerHTML = `
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
                <polyline points="3 6 5 6 21 6"/>
                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
            </svg>
            Delete
        `;
        deleteButton.addEventListener('click', () => {
            animateDeleteLibraryItem(item.id, card);
        });

        actions.appendChild(deleteButton);
        actions.appendChild(copyButton);

        const metaRow = document.createElement('div');
        metaRow.className = 'library-card-meta';
        const countBadge = document.createElement('button');
        countBadge.type = 'button';
        countBadge.className = 'library-card-count-badge';
        countBadge.dataset.itemId = item.id;
        countBadge.textContent = getCardCountDisplay(item.markdown || '', libraryCardCountMode);
        countBadge.addEventListener('click', () => {
            const idx = COUNT_MODES.indexOf(libraryCardCountMode);
            libraryCardCountMode = COUNT_MODES[(idx + 1) % COUNT_MODES.length];
            updateAllCardCountBadges();
        });
        metaRow.appendChild(countBadge);

        card.appendChild(header);
        card.appendChild(metaRow);
        if (card.classList.contains('library-card--current')) {
            const badge = document.createElement('span');
            badge.className = 'library-card-current-badge';
            badge.textContent = 'Current page';
            card.appendChild(badge);
        }
        if (item.previewText) {
            card.appendChild(preview);
        }
        card.appendChild(source);
        card.appendChild(actions);
        libraryUI.list.appendChild(card);
    });
}

function updateLibraryUIState() {
    const enabled = librarySettings?.enabled !== false;
    const manualMode = enabled && !librarySettings?.autoSaveOnPopupOpen;

    if (libraryUI.toggle) {
        libraryUI.toggle.style.display = enabled ? 'flex' : 'none';
    }

    if (!enabled) {
        hideLibraryView();
    }

    if (libraryUI.toolbarNote) {
        libraryUI.toolbarNote.textContent = manualMode
            ? 'Manual mode is on. Press Save Clip to save the current page.'
            : 'Library saves the current page automatically the first time this popup loads it.';
    }

    updateSaveLibraryButtonState();
    syncLibrarySummaryUi();
    if (isLibraryViewVisible()) {
        renderLibraryItems();
    }
}

function showMainView() {
    return setPopupView('main');
}

function isLibraryViewVisible() {
    return activePopupView === 'library';
}

function showBatchView() {
    return setPopupView('batch');
}

async function showLibraryView(e) {
    if (e) {
        e.preventDefault();
    }
    if (librarySettings?.enabled === false || !libraryUI.container) {
        return;
    }

    await ensureLibraryStateLoaded();
    await setPopupView('library');
    renderLibraryItems();
}

function hideLibraryView(e) {
    if (e) {
        e.preventDefault();
    }

    closeExportDropdown();
    return setPopupView(lastNonLibraryView);
}

async function loadLibraryState() {
    const api = getLibraryStateApi();
    if (!api) {
        return;
    }

    try {
        const [settings, items] = await Promise.all([
            api.loadLibrarySettings(),
            api.loadLibraryItems()
        ]);
        librarySettings = settings;
        libraryItems = items;
        libraryStateLoaded = true;
        updateLibraryUIState();
        await maybeAutoSaveCurrentClip();
    } catch (error) {
        console.error('Failed to load library state:', error);
    }
}

function ensureLibraryStateLoaded() {
    if (libraryStateLoaded) {
        return Promise.resolve();
    }

    if (libraryStateLoadPromise) {
        return libraryStateLoadPromise;
    }

    libraryStateLoadPromise = loadLibraryState().finally(() => {
        libraryStateLoadPromise = null;
    });
    return libraryStateLoadPromise;
}

async function persistLibrarySnapshot(snapshot, successMessage) {
    const api = getLibraryStateApi();
    if (!api || !librarySettings?.enabled) {
        return null;
    }

    const nextItems = api.upsertLibraryItem(libraryItems, snapshot, librarySettings.itemsToKeep);
    libraryItems = await api.saveLibraryItems(nextItems);
    syncLibrarySummaryUi();
    if (isLibraryViewVisible()) {
        renderLibraryItems();
    }
    if (successMessage) {
        setLibraryStatus(successMessage);
    }
    return nextItems[0] || null;
}

async function handleManualLibrarySave(e) {
    e.preventDefault();
    const snapshot = {
        title: dom.titleInput?.value || currentClipState.title,
        markdown: getEditorValue(),
        pageUrl: currentClipState.pageUrl
    };

    if (!snapshot.pageUrl || !String(snapshot.markdown || '').trim()) {
        return;
    }

    try {
        updateCurrentClipState(snapshot);
        await persistLibrarySnapshot(snapshot, 'Saved current clip to Library');
    } catch (error) {
        console.error('Failed to save library item:', error);
        setLibraryStatus('Failed to save clip to Library', true);
    }
}

async function resolveLibraryExportTabId() {
    return await getActiveTabId();
}

function toggleExportDropdown(e) {
    e.preventDefault();
    e.stopPropagation();
    if (libraryExportInProgress || libraryItems.length === 0) return;

    const dropdown = libraryUI.exportDropdown;
    const menu = libraryUI.exportDropdownMenu;
    if (!dropdown || !menu) return;

    const isOpen = !menu.hidden;
    if (isOpen) {
        closeExportDropdown();
    } else {
        menu.hidden = false;
        dropdown.classList.add('open');
    }
}

function closeExportDropdown() {
    const dropdown = libraryUI.exportDropdown;
    const menu = libraryUI.exportDropdownMenu;
    if (menu) menu.hidden = true;
    if (dropdown) dropdown.classList.remove('open');
}

function closeExportDropdownOnOutsideClick(e) {
    if (!libraryUI.exportDropdown?.contains(e.target)) {
        closeExportDropdown();
    }

    if (!dom.splitButtonWrap?.contains(e.target)) {
        closeSplitDropdown();
    }

    if (!dom.guideDropdownWrap?.contains(e.target)) {
        closeGuideDropdown();
    }
}

function toggleSplitDropdown(e) {
    e.preventDefault();
    e.stopPropagation();

    if (!dom.splitDropdown || !dom.splitButtonArrow) {
        return;
    }

    const isOpen = !dom.splitDropdown.hidden;
    if (isOpen) {
        closeSplitDropdown();
        return;
    }

    closeExportDropdown();
    dom.splitDropdown.hidden = false;
    dom.splitButtonArrow.setAttribute('aria-expanded', 'true');
    dom.splitExport?.classList.add('open');
}

function closeSplitDropdown() {
    if (dom.splitDropdown) {
        dom.splitDropdown.hidden = true;
    }
    if (dom.splitButtonArrow) {
        dom.splitButtonArrow.setAttribute('aria-expanded', 'false');
    }
    dom.splitExport?.classList.remove('open');
}

function toggleGuideDropdown(e) {
    e.stopPropagation();
    if (!dom.guideDropdown) return;
    if (!dom.guideDropdown.hidden) {
        closeGuideDropdown();
    } else {
        closeExportDropdown();
        closeSplitDropdown();
        dom.guideDropdown.hidden = false;
        dom.openGuideButton?.setAttribute('aria-expanded', 'true');
    }
}

function closeGuideDropdown() {
    if (dom.guideDropdown) dom.guideDropdown.hidden = true;
    dom.openGuideButton?.setAttribute('aria-expanded', 'false');
}

async function showShortcutsModal() {
    closeGuideDropdown();
    if (!dom.shortcutsModal || !dom.shortcutsModalBody) return;

    const loading = document.createElement('p');
    loading.className = 'shortcuts-loading';
    loading.textContent = 'Loading\u2026';
    dom.shortcutsModalBody.replaceChildren(loading);

    dom.shortcutsModal.hidden = false;
    document.querySelectorAll('body > :not(#shortcutsModal)').forEach(el => { el.inert = true; });
    dom.closeShortcutsModalBtn?.focus();

    try {
        const commands = await browser.commands.getAll();
        const fragment = globalThis.markSnipPopupShortcuts.buildShortcutsFragment(document, commands);
        dom.shortcutsModalBody.replaceChildren(fragment);
    } catch {
        const err = document.createElement('p');
        err.className = 'shortcuts-modal__error';
        err.textContent = 'Could not load shortcuts.';
        dom.shortcutsModalBody.replaceChildren(err);
    }
}

function closeShortcutsModal() {
    if (!dom.shortcutsModal || dom.shortcutsModal.hidden) return;
    dom.shortcutsModal.hidden = true;
    document.querySelectorAll('body > :not(#shortcutsModal)').forEach(el => { el.inert = false; });
    dom.openGuideButton?.focus();
}

function trapShortcutsModalTab(event) {
    if (!dom.shortcutsModal || dom.shortcutsModal.hidden) return;
    const focusable = Array.from(
        dom.shortcutsModal.querySelectorAll(
            'button:not([disabled]), [href], [tabindex]:not([tabindex="-1"])'
        )
    );
    if (!focusable.length) { event.preventDefault(); return; }
    const first = focusable[0], last = focusable[focusable.length - 1];
    const active = document.activeElement;
    if (event.shiftKey) {
        if (active === first || !dom.shortcutsModal.contains(active)) {
            event.preventDefault(); last.focus();
        }
    } else {
        if (active === last || !dom.shortcutsModal.contains(active)) {
            event.preventDefault(); first.focus();
        }
    }
}

function handlePopupKeydown(event) {
    if (event.key === 'Escape') {
        if (!dom.shortcutsModal?.hidden) {
            closeShortcutsModal();
        } else {
            closeExportDropdown();
            closeSplitDropdown();
            closeGuideDropdown();
        }
        return;
    }
    if (event.key === 'Tab') {
        trapShortcutsModalTab(event);
    }
}

async function handleExportDropdownChoice(e) {
    const item = e.target.closest('[data-export]');
    if (!item) return;

    closeExportDropdown();
    const mode = item.dataset.export;

    if (mode === 'links') {
        handleLibraryExportLinks();
        return;
    }

    if (mode === 'zip') {
        await handleLibraryExportZip();
    } else if (mode === 'individual') {
        await handleLibraryExportIndividual();
    }
}

async function handleLibraryExportZip() {
    if (libraryExportInProgress || libraryItems.length === 0) return;

    libraryExportInProgress = true;
    updateLibraryExportButtonState();
    setLibraryStatus('Exporting library as ZIP...');

    try {
        const tabId = await resolveLibraryExportTabId();
        const result = await browser.runtime.sendMessage({
            type: 'export-library-items',
            items: libraryItems.map((item) => ({
                title: item?.title || '',
                markdown: item?.markdown || '',
                savedAt: item?.savedAt || '',
                pageUrl: item?.pageUrl || ''
            })),
            tabId
        });

        const exportedCount = Number(result?.exportedCount || 0);
        if (exportedCount > 0) {
            setLibraryStatus(`Exported ${exportedCount} clip${exportedCount === 1 ? '' : 's'} to ZIP`);
        } else {
            setLibraryStatus('No saved clips to export', true);
        }
    } catch (error) {
        console.error('Failed to export library items:', error);
        setLibraryStatus('Failed to export Library', true);
    } finally {
        libraryExportInProgress = false;
        updateLibraryExportButtonState();
    }
}

async function handleLibraryExportIndividual() {
    if (libraryExportInProgress || libraryItems.length === 0) return;

    libraryExportInProgress = true;
    updateLibraryExportButtonState();
    setLibraryStatus('Exporting individual files...');

    try {
        const tabId = await resolveLibraryExportTabId();
        const result = await browser.runtime.sendMessage({
            type: 'export-library-items-individual',
            items: libraryItems.map((item) => ({
                title: item?.title || '',
                markdown: item?.markdown || '',
                savedAt: item?.savedAt || '',
                pageUrl: item?.pageUrl || ''
            })),
            tabId
        });

        const exportedCount = Number(result?.exportedCount || 0);
        if (exportedCount > 0) {
            setLibraryStatus(`Exported ${exportedCount} individual file${exportedCount === 1 ? '' : 's'}`);
        } else {
            setLibraryStatus('No saved clips to export', true);
        }
    } catch (error) {
        console.error('Failed to export individual files:', error);
        setLibraryStatus('Failed to export files', true);
    } finally {
        libraryExportInProgress = false;
        updateLibraryExportButtonState();
    }
}

function handleLibraryExportLinks() {
    if (libraryItems.length === 0) return;

    const links = libraryItems
        .map((item) => item?.pageUrl || '')
        .filter(Boolean);

    if (links.length === 0) {
        setLibraryStatus('No links found in library clips', true);
        return;
    }

    const text = links.join('\n');
    navigator.clipboard.writeText(text).then(() => {
        setLibraryStatus(`Copied ${links.length} link${links.length === 1 ? '' : 's'} to clipboard`);
    }).catch(() => {
        setLibraryStatus('Failed to copy links to clipboard', true);
    });
}

async function maybeAutoSaveCurrentClip() {
    const api = getLibraryStateApi();
    if (!api || !librarySettings?.enabled || !librarySettings?.autoSaveOnPopupOpen || !hasSavableClip()) {
        return;
    }

    const normalizedUrl = api.normalizePageUrl(currentClipState.pageUrl);
    if (!normalizedUrl || autoSavedLibraryUrls.has(normalizedUrl)) {
        return;
    }

    autoSavedLibraryUrls.add(normalizedUrl);

    try {
        await persistLibrarySnapshot(currentClipState);
    } catch (error) {
        autoSavedLibraryUrls.delete(normalizedUrl);
        console.error('Failed to auto-save library item:', error);
    }
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
    const convertBtn = dom.convertUrlsButton;
    const text = dom.urlList?.value || '';
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

                    updateCurrentClipState({
                        title: message.article?.title,
                        markdown: message.markdown,
                        pageUrl: resolveClipPageUrl(message.article)
                    });
                    setEditorValue(message.markdown);
                    if (dom.titleInput) {
                        dom.titleInput.value = message.article.title;
                    }
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

    if (currentOptions?.batchProcessingEnabled === false) {
        showError("Batch Processing is disabled in Options", false);
        return;
    }
    
    const urlText = dom.urlList?.value || '';
    const urlObjects = processUrlInput(urlText);
    
    if (urlObjects.length === 0) {
        showError("Please enter valid URLs or markdown links (one per line)", false);
        return;
    }
    const batchSaveMode = getSelectedBatchSaveMode();

    // Default path: run batch in service worker so popup lifecycle doesn't interrupt processing.
    // Keep inline mode for e2e tests by setting window.__MARKSNIP_FORCE_INLINE_BATCH__ = true.
    if (!window.__MARKSNIP_FORCE_INLINE_BATCH__) {
        dom.spinner.style.display = 'flex';
        dom.convertUrlsButton.style.display = 'none';
        progressUI.show();
        progressUI.reset();
        progressUI.setStatus('Starting background batch...');

        try {
            const originalTabId = await getActiveTabId();

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
            dom.spinner.style.display = 'none';
            dom.convertUrlsButton.style.display = 'block';
        }
        return;
    }

    dom.spinner.style.display = 'flex';
    dom.convertUrlsButton.style.display = 'none';
    progressUI.show();
    progressUI.reset();

    let originalTabId = null;
    const restoreOriginalTab = async () => {
        if (originalTabId) {
            await browser.tabs.update(originalTabId, { active: true }).catch(() => {});
        }
    };

    try {
        originalTabId = await getActiveTabId();

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
                await sendDownloadMessage(message?.markdown || getEditorValue());

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
        dom.spinner.style.display = 'none';
        dom.convertUrlsButton.style.display = 'block';
    }
}

const checkInitialSettings = options => {
    currentOptions = {
        ...defaultOptions,
        ...options
    };

    // Apply theme settings
    applyThemeSettings(currentOptions);

    setActiveSiteRuleState(null, [], null);
    applyActiveSiteRuleUi(currentOptions);
    updateObsidianButtonVisibility(currentOptions);
    updateGuideButtonVisibility(currentOptions);
    updateBatchProcessButtonVisibility(currentOptions);
    updatePopupExportControls(currentOptions);

    // Set segmented control state
    setClipSelectionState(currentOptions.clipSelection);
}

const setClipSelectionState = clipSelection => {
    dom.selectedButton?.classList.toggle("active", clipSelection);
    dom.selectedButton?.setAttribute("aria-pressed", String(clipSelection));

    dom.documentButton?.classList.toggle("active", !clipSelection);
    dom.documentButton?.setAttribute("aria-pressed", String(!clipSelection));
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
    if (dom.includeTemplate) {
        options.includeTemplate = dom.includeTemplate.checked;
    }

    browser.storage.sync.set(options).then(() => {
        return getActiveTab();
    }).then((tab) => {
        if (tab?.id) {
            return clipSite(tab.id);
        }
    }).catch((error) => {
        console.error("Error toggling include template:", error);
    });
}

const toggleDownloadImages = options => {
    if (dom.downloadImages) {
        options.downloadImages = dom.downloadImages.checked;
    }

    browser.storage.sync.set(options).catch((error) => {
        console.error("Error updating options:", error);
    });
}

const showOrHideClipOption = selection => {
    if (selection) {
        dom.clipOption.style.display = "flex";
    }
    else {
        dom.clipOption.style.display = "none";
    }
}

// Updated clipSite function to use scripting API
const clipSite = id => {
    // If no id is provided, get the active tab's id first
    if (!id) {
        return getActiveTab().then(tab => {
            if (tab?.id) {
                return clipSite(tab.id);
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
            if (currentOptions) {
                return browser.runtime.sendMessage({
                    ...message,
                    ...currentOptions
                });
            }
            return browser.storage.sync.get(defaultOptions).then(options => {
                currentOptions = {
                    ...defaultOptions,
                    ...options
                };
                return browser.runtime.sendMessage({
                    ...message,
                    ...currentOptions
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

function ensureContentScriptInjected(tabId) {
    return browser.scripting.executeScript({
        target: { tabId },
        files: ["/browser-polyfill.min.js"]
    }).then(() => {
        return browser.scripting.executeScript({
            target: { tabId },
            files: ["/contentScript/contentScript.js"]
        });
    });
}

function scheduleDeferredLibraryWarmup() {
    if (deferredLibraryWarmupScheduled) {
        return;
    }

    deferredLibraryWarmupScheduled = true;
    scheduleDeferredTask(() => ensureLibraryStateLoaded(), 1200);
}

function scheduleDeferredStartupTasks() {
    if (deferredStartupScheduled) {
        return;
    }

    deferredStartupScheduled = true;
    setTimeout(() => {
        restoreBatchState().catch(() => {});
    }, 0);
    scheduleDeferredTask(() => ensureBatchSettingsLoaded(), 1000);
    scheduleDeferredTask(() => ensureLibraryStateLoaded(), 1200);
    scheduleDeferredTask(() => loadNotificationHostDeferred(), 1500);
}

async function restoreBatchState() {
    const state = await browser.runtime.sendMessage({ type: 'get-batch-state' }).catch(() => null);
    if (!state || !['started', 'loading', 'converting', 'retrying'].includes(state.status)) {
        return;
    }

    await ensureBatchSettingsLoaded();
    await setPopupView('batch', { immediate: true });
    dom.spinner.style.display = 'none';
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

async function initializePopup() {
    try {
        const [options, localState, activeTab] = await Promise.all([
            browser.storage.sync.get(defaultOptions).catch(() => ({ ...defaultOptions })),
            browser.storage.local.get('countMode').catch(() => ({})),
            getActiveTab()
        ]);

        if (localState.countMode && COUNT_MODES.includes(localState.countMode)) {
            countMode = localState.countMode;
        }

        checkInitialSettings(options);
        updateCharCount(getEditorValue());
        syncSelectionActionVisibility(false);

        dom.selectedButton?.addEventListener("click", (e) => {
            e.preventDefault();
            setClipSelection(currentOptions, true);
        });
        dom.documentButton?.addEventListener("click", (e) => {
            e.preventDefault();
            setClipSelection(currentOptions, false);
        });
        dom.includeTemplate?.addEventListener("click", () => {
            toggleIncludeTemplate(currentOptions);
        });
        dom.downloadImages?.addEventListener("click", () => {
            toggleDownloadImages(currentOptions);
        });

        await afterNextPaint();

        const editorPromise = initializeEditor();
        scheduleDeferredStartupTasks();

        if (!activeTab?.id) {
            throw new Error("No active tab found");
        }

        const clipPromise = ensureContentScriptInjected(activeTab.id).then(() => {
            console.info("Successfully injected MarkSnip content script");
            return clipSite(activeTab.id);
        });

        await Promise.all([editorPromise, clipPromise]);
    } catch (error) {
        console.error(error);
        showError(error);
        scheduleDeferredStartupTasks();
    }
}

initializePopup();

// listen for notifications from the background page
browser.runtime.onMessage.addListener(notify);

browser.storage.onChanged.addListener((changes, areaName) => {
    if (areaName === "sync") {
        const themeSettingKeys = ['popupTheme', 'specialTheme', 'colorBlindTheme', 'specialThemeIcon', 'popupAccent', 'compactMode', 'editorTheme'];
        if (themeSettingKeys.some((key) => Object.prototype.hasOwnProperty.call(changes, key))) {
            currentOptions = {
                ...defaultOptions,
                ...currentOptions,
                ...themeSettingKeys.reduce((nextOptions, key) => {
                    if (Object.prototype.hasOwnProperty.call(changes, key)) {
                        nextOptions[key] = changes[key].newValue;
                    }
                    return nextOptions;
                }, {})
            };
            applyThemeSettings(currentOptions);
        }
        if (changes.batchProcessingEnabled) {
            currentOptions = {
                ...currentOptions,
                batchProcessingEnabled: changes.batchProcessingEnabled.newValue !== false
            };
            updateBatchProcessButtonVisibility(currentOptions);
        }
        if (changes.defaultExportType) {
            currentOptions = {
                ...currentOptions,
                defaultExportType: changes.defaultExportType.newValue || 'markdown'
            };
            updatePopupExportControls(currentOptions);
        }
        if (changes.obsidianIntegration) {
            updateObsidianButtonVisibility({ obsidianIntegration: changes.obsidianIntegration.newValue });
        }
        if (changes.showUserGuideIcon) {
            updateGuideButtonVisibility({ showUserGuideIcon: changes.showUserGuideIcon.newValue });
        }
        return;
    }

    if (areaName !== "local") {
        return;
    }

    const libraryApi = getLibraryStateApi();
    if (!libraryApi) {
        return;
    }

    if (changes.librarySettings) {
        librarySettings = libraryApi.normalizeLibrarySettings(changes.librarySettings.newValue);
        libraryStateLoaded = true;
        updateLibraryUIState();
    }

    if (changes.libraryItems) {
        libraryItems = Array.isArray(changes.libraryItems.newValue) ? changes.libraryItems.newValue : [];
        libraryStateLoaded = true;
        syncLibrarySummaryUi();
        if (isLibraryViewVisible()) {
            renderLibraryItems();
        }
    }
});

// Listen for link picker results
browser.runtime.onMessage.addListener((message) => {
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
    const urlListTextarea = dom.urlList;
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
    const pickLinksBtn = dom.pickLinksButton;
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
function sendDownloadMessage(text, title = dom.titleInput?.value || '') {
    if (text != null) {
        return getActiveTab().then(tab => {
            if (!tab?.id) {
                throw new Error('No active tab found');
            }
            const message = {
                type: "download",
                markdown: text,
                title,
                tab,
                imageList: imageList,
                mdClipsFolder: mdClipsFolder,
                options: getPopupExportOptions()
            };
            return browser.runtime.sendMessage(message);
        });
    }
}

function shouldClosePopupAfterExport(kind) {
    return kind === 'markdown' || kind === 'text' || kind === 'html';
}

async function sendGeneratedDownloadMessage(kind, markdown, title = getCurrentExportTitle()) {
    const nextTitle = String(title || '').trim() || 'Untitled';
    const exportType = resolveDefaultExportType({ defaultExportType: kind });
    const config = getExportTypeConfig(exportType);
    const { content, fileExtension, mimeType } = await buildGeneratedExport(exportType, markdown, nextTitle);
    const activeTab = await getActiveTab();

    if (!activeTab?.id) {
        throw new Error('No active tab found');
    }

    return browser.runtime.sendMessage({
        type: 'download-generated-file',
        content,
        title: nextTitle,
        tabId: activeTab.id,
        mdClipsFolder: mdClipsFolder,
        fileExtension: fileExtension || config.fileExtension,
        mimeType: mimeType || config.mimeType,
        notificationDelta: {
            downloads: 1,
            exports: 1
        }
    });
}

async function exportCurrentContent(kind, { selectionOnly = false, closeAfter = false } = {}) {
    if (selectionOnly && !editorHasSelection()) {
        return;
    }

    const exportKind = kind === 'print'
        ? 'print'
        : resolveDefaultExportType({ defaultExportType: kind });
    const markdown = selectionOnly ? getEditorSelection() : getEditorValue();
    const title = getCurrentExportTitle();

    if (exportKind === 'markdown') {
        await sendDownloadMessage(markdown, dom.titleInput?.value || '');
        if (closeAfter) {
            window.close();
        }
        return;
    }

    if (exportKind === 'pdf' || exportKind === 'print') {
        await handlePrintExport(exportKind, { markdown, title });
        return;
    }

    await sendGeneratedDownloadMessage(exportKind, markdown, title);
    if (closeAfter) {
        window.close();
    }
}

async function handleExplicitExport(kind) {
    closeSplitDropdown();
    await exportCurrentContent(kind, {
        closeAfter: shouldClosePopupAfterExport(kind)
    });
}

// Download event handler - updated to use promises
async function download(e) {
    e.preventDefault();
    const exportKind = resolveDefaultExportType(currentOptions);
    try {
        await exportCurrentContent(exportKind, {
            closeAfter: shouldClosePopupAfterExport(exportKind)
        });
    } catch (error) {
        console.error("Error exporting content:", error);
    }
}

// Download selection handler - updated to use promises
async function downloadSelection(e) {
    e.preventDefault();
    const exportKind = resolveDefaultExportType(currentOptions);
    try {
        await exportCurrentContent(exportKind, {
            selectionOnly: true
        });
    } catch (error) {
        console.error("Error exporting selected content:", error);
    }
}

async function recordSuccessfulCopyMetric() {
    const tabId = await getActiveTabId();

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
    const copyButton = dom.copyButton;
    if (!copyButton) return;

    try {
        const hasSelection = editorHasSelection();
        const textToCopy = hasSelection ? getEditorSelection() : getEditorValue();

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
    const copySelButton = dom.copySelectionButton;
    if (!editorHasSelection() || !copySelButton) return;

    const selectedText = getEditorSelection();
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
    const obsidianButton = dom.sendToObsidianButton;
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
            getEditorValue(),
            sourceImageMap || {}
        );
        const title = dom.titleInput?.value || 'Untitled';

        const currentTab = await getActiveTab();
        if (!currentTab?.id) {
            throw new Error('No active tab found');
        }

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
        setActiveSiteRuleState(message.matchedSiteRule, message.overriddenKeys, message.effectiveOptions || message.options);
        imageList = message.imageList;
        sourceImageMap = message.sourceImageMap;
        mdClipsFolder = message.mdClipsFolder;
        updateCurrentClipState({
            title: message.article?.title,
            markdown: message.markdown,
            pageUrl: resolveClipPageUrl(message.article)
        });
        if (dom.titleInput) {
            dom.titleInput.value = message.article.title;
        }
        setEditorValue(message.markdown);
        applyActiveSiteRuleUi(message.effectiveOptions || currentOptions);

        const shouldRevealMainView = activePopupView === null;
        if (shouldRevealMainView) {
            setPopupView('main', { immediate: true }).catch((error) => {
                console.error('Failed to show main popup view:', error);
            });
        }
        dom.spinner.style.display = 'none';
        maybeAutoSaveCurrentClip().catch((error) => {
            console.error('Failed during popup library auto-save:', error);
        });
        scheduleDeferredLibraryWarmup();

        if (!shouldRevealMainView && activePopupView === 'main') {
            dom.downloadButton?.focus();
        }
        refreshEditor();
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
                dom.spinner.style.display = 'none';
                dom.convertUrlsButton.style.display = 'block';
                break;
            case 'failed':
                progressUI.setStatus(`Batch failed: ${message.error || 'Unknown error'}`);
                progressUI.hideCancelButton();
                dom.spinner.style.display = 'none';
                dom.convertUrlsButton.style.display = 'block';
                break;
            case 'finished':
                if (message.failed > 0) {
                    progressUI.setStatus(`Finished with ${message.failed} error(s)`);
                } else {
                    progressUI.setStatus(message.batchSaveMode === 'zip' ? 'ZIP downloaded' : 'Batch complete');
                }
                progressUI.hideCancelButton();
                dom.spinner.style.display = 'none';
                dom.convertUrlsButton.style.display = 'block';
                break;
        }
    }
}

function showError(err, useEditor = true) {
    setPopupView('main', { immediate: true }).catch((error) => {
        console.error('Failed to show main popup view after error:', error);
    });
    dom.spinner.style.display = 'none';
    
    if (useEditor) {
        setEditorValue(`Error clipping the page\n\n${err}`);
    } else {
        const currentContent = getEditorValue();
        setEditorValue(`${currentContent}\n\nError: ${err}`);
    }
    refreshEditor();
}
