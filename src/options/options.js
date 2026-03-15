let options = defaultOptions;
let keyupTimeout = null;
let notionState = markSnipNotion.normalizeNotionState(markSnipNotion.DEFAULT_NOTION_STATE);
let notionSearchTimeout = null;
const notionSearchState = {
    query: '',
    kind: 'page',
    results: [],
    nextCursor: null,
    loading: false
};

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

function getNotionElements() {
    return {
        badge: document.getElementById('notionConnectionBadge'),
        workspaceIcon: document.getElementById('notionWorkspaceIcon'),
        workspaceName: document.getElementById('notionWorkspaceName'),
        workspaceStatus: document.getElementById('notionWorkspaceStatus'),
        connect: document.getElementById('notionConnect'),
        reconnect: document.getElementById('notionReconnect'),
        disconnect: document.getElementById('notionDisconnect'),
        destinationCard: document.getElementById('notionDestinationCard'),
        mappingsCard: document.getElementById('notionMappingsCard'),
        searchInput: document.getElementById('notionDestinationSearch'),
        searchResults: document.getElementById('notionSearchResults'),
        searchEmpty: document.getElementById('notionSearchEmpty'),
        loadMore: document.getElementById('notionSearchLoadMore'),
        kindPage: document.getElementById('notionDestinationKindPage'),
        kindDataSource: document.getElementById('notionDestinationKindDataSource'),
        selectedName: document.getElementById('notionSelectedDestinationName'),
        selectedMeta: document.getElementById('notionSelectedDestinationMeta'),
        mappingTitle: document.getElementById('notionMappingTitle'),
        mappingSourceUrl: document.getElementById('notionMappingSourceUrl'),
        mappingClippedAt: document.getElementById('notionMappingClippedAt'),
        mappingTags: document.getElementById('notionMappingTags'),
        alsoDownloadMd: document.getElementById('notionAlsoDownloadMd')
    };
}

function setNotionButtonsLoading(isLoading, connectLabel = 'Connect') {
    const elements = getNotionElements();
    if (!elements.connect || !elements.reconnect || !elements.disconnect) return;

    elements.connect.disabled = isLoading;
    elements.reconnect.disabled = isLoading;
    elements.disconnect.disabled = isLoading;
    elements.connect.textContent = isLoading ? connectLabel : 'Connect';
    elements.reconnect.textContent = isLoading ? 'Working...' : 'Reconnect';
}

async function restoreNotionState() {
    const result = await browser.storage.local.get({
        notion: markSnipNotion.DEFAULT_NOTION_STATE
    });

    notionState = markSnipNotion.normalizeNotionState(result.notion);
    renderNotionState();
}

async function persistNotionState(message = null) {
    notionState = markSnipNotion.normalizeNotionState(notionState);
    await browser.storage.local.set({ notion: notionState });
    renderNotionState();
    if (message) {
        showToast(message, 'success');
    }
}

function clearNotionSearchResults() {
    notionSearchState.results = [];
    notionSearchState.nextCursor = null;
    notionSearchState.loading = false;
    renderNotionSearchResults();
}

function renderNotionSearchResults() {
    const elements = getNotionElements();
    if (!elements.searchResults || !elements.searchEmpty || !elements.loadMore) return;

    elements.searchResults.innerHTML = '';

    if (!markSnipNotion.hasConnection(notionState)) {
        elements.searchEmpty.textContent = 'Connect a Notion workspace to search for destinations.';
        elements.loadMore.style.display = 'none';
        return;
    }

    if (notionSearchState.loading) {
        elements.searchEmpty.textContent = 'Searching Notion...';
        elements.loadMore.style.display = 'none';
        return;
    }

    if (!notionSearchState.results.length) {
        elements.searchEmpty.textContent = notionSearchState.query
            ? 'No matching destinations found.'
            : 'Search results will appear here.';
        elements.loadMore.style.display = 'none';
        return;
    }

    elements.searchEmpty.textContent = '';
    notionSearchState.results.forEach(result => {
        const row = document.createElement('div');
        row.className = 'notion-search-result';

        const info = document.createElement('div');
        info.className = 'notion-search-result-info';

        const title = document.createElement('div');
        title.className = 'notion-search-result-title';
        title.textContent = result.name || 'Untitled';

        const meta = document.createElement('div');
        meta.className = 'notion-search-result-meta';
        meta.textContent = result.kind === 'data_source' ? 'Database' : 'Page';

        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'btn';
        button.textContent = 'Select';
        button.addEventListener('click', () => {
            selectNotionDestination(result);
        });

        info.appendChild(title);
        info.appendChild(meta);
        row.appendChild(info);
        row.appendChild(button);
        elements.searchResults.appendChild(row);
    });

    elements.loadMore.style.display = notionSearchState.nextCursor ? 'inline-flex' : 'none';
}

function buildMappingOptions(selectEl, mappingKey) {
    if (!selectEl) return;

    const schemaProperties = notionState.defaultDestination?.schema?.properties || [];
    const eligibleProperties = markSnipNotion.filterEligibleProperties(schemaProperties, mappingKey);
    selectEl.innerHTML = '';

    const emptyOption = document.createElement('option');
    emptyOption.value = '';
    emptyOption.textContent = eligibleProperties.length ? 'Do not map' : 'No compatible properties';
    selectEl.appendChild(emptyOption);

    eligibleProperties.forEach(property => {
        const option = document.createElement('option');
        option.value = property.id;
        option.textContent = `${property.name} (${property.type})`;
        selectEl.appendChild(option);
    });

    selectEl.value = notionState.propertyMappings[mappingKey] || '';
    selectEl.disabled = !eligibleProperties.length || notionState.defaultDestination?.kind !== 'data_source';
  }

function renderNotionMappings() {
    const elements = getNotionElements();
    const isDataSource = notionState.defaultDestination?.kind === 'data_source';
    show(elements.mappingsCard, markSnipNotion.hasConnection(notionState));

    buildMappingOptions(elements.mappingTitle, 'title');
    buildMappingOptions(elements.mappingSourceUrl, 'sourceUrl');
    buildMappingOptions(elements.mappingClippedAt, 'clippedAt');
    buildMappingOptions(elements.mappingTags, 'tags');

    if (!isDataSource) {
        [elements.mappingTitle, elements.mappingSourceUrl, elements.mappingClippedAt, elements.mappingTags].forEach(select => {
            if (!select) return;
            select.value = '';
            select.disabled = true;
        });
    }

    if (elements.alsoDownloadMd) {
        elements.alsoDownloadMd.checked = Boolean(notionState.alsoDownloadMd);
    }
}

function renderNotionState() {
    const elements = getNotionElements();
    if (!elements.badge) return;

    const connected = markSnipNotion.hasConnection(notionState);
    const workspaceName = notionState.workspace?.name || 'Not connected';
    const workspaceIcon = notionState.workspace?.icon;

    elements.badge.textContent = connected ? 'Connected' : 'Disconnected';
    elements.badge.classList.toggle('connected', connected);
    elements.workspaceName.textContent = workspaceName;
    elements.workspaceStatus.textContent = connected
        ? 'Choose a default destination to enable one-click popup saves.'
        : 'Connect once, then choose a default destination.';
    elements.workspaceIcon.textContent = workspaceIcon && workspaceIcon.length <= 2
        ? workspaceIcon
        : (workspaceName[0] || 'N').toUpperCase();

    elements.connect.style.display = connected ? 'none' : 'inline-flex';
    elements.reconnect.style.display = connected ? 'inline-flex' : 'none';
    elements.disconnect.style.display = connected ? 'inline-flex' : 'none';

    show(elements.destinationCard, connected);
    show(elements.mappingsCard, connected);

    if (elements.kindPage && elements.kindDataSource) {
        elements.kindPage.checked = notionSearchState.kind !== 'data_source';
        elements.kindDataSource.checked = notionSearchState.kind === 'data_source';
    }

    if (elements.selectedName && elements.selectedMeta) {
        if (markSnipNotion.hasDefaultDestination(notionState)) {
            elements.selectedName.textContent = notionState.defaultDestination.name || 'Untitled';
            elements.selectedMeta.textContent = notionState.defaultDestination.kind === 'data_source'
                ? 'Database selected for popup saves'
                : 'Page selected for popup saves';
        } else {
            elements.selectedName.textContent = 'None selected';
            elements.selectedMeta.textContent = 'Choose a default destination to enable popup saves.';
        }
    }

    renderNotionSearchResults();
    renderNotionMappings();
}

async function searchNotionDestinations(append = false) {
    if (!markSnipNotion.hasConnection(notionState)) {
        clearNotionSearchResults();
        return;
    }

    notionSearchState.loading = true;
    renderNotionSearchResults();

    const response = await browser.runtime.sendMessage({
        type: 'notion-search-destinations',
        query: notionSearchState.query,
        kind: notionSearchState.kind,
        startCursor: append ? notionSearchState.nextCursor : null
    });

    notionSearchState.loading = false;

    if (!response?.ok) {
        clearNotionSearchResults();
        showToast(response?.error?.message || 'Failed to search Notion destinations.', 'error');
        return;
    }

    notionSearchState.results = append
        ? notionSearchState.results.concat(response.results || [])
        : (response.results || []);
    notionSearchState.nextCursor = response.nextCursor || null;
    renderNotionSearchResults();
}

async function selectNotionDestination(result) {
    const shouldResetMappings = notionState.defaultDestination?.id !== result.id;
    let destination = {
        id: result.id,
        name: result.name,
        kind: result.kind,
        schema: null
    };

    if (result.kind === 'data_source') {
        const response = await browser.runtime.sendMessage({
            type: 'notion-get-data-source',
            id: result.id
        });

        if (!response?.ok) {
            showToast(response?.error?.message || 'Failed to load database schema.', 'error');
            return;
        }

        destination = {
            ...destination,
            schema: response.dataSource
        };
    }

    notionState.defaultDestination = destination;
    if (shouldResetMappings) {
        notionState.propertyMappings = {
            title: '',
            sourceUrl: '',
            clippedAt: '',
            tags: ''
        };
    }
    await persistNotionState('Notion destination saved');
}

async function handleNotionAuth() {
    setNotionButtonsLoading(true, 'Connecting...');

    try {
        const response = await browser.runtime.sendMessage({ type: 'notion-auth-start' });
        if (!response?.ok) {
            showToast(response?.error?.message || 'Failed to connect Notion.', 'error');
            return;
        }

        notionState = markSnipNotion.normalizeNotionState(response.notion);
        clearNotionSearchResults();
        renderNotionState();
        showToast('Notion workspace connected', 'success');
    } finally {
        setNotionButtonsLoading(false);
    }
}

async function handleNotionDisconnect() {
    setNotionButtonsLoading(true, 'Disconnecting...');

    try {
        const response = await browser.runtime.sendMessage({ type: 'notion-disconnect' });
        if (!response?.ok) {
            showToast(response?.error?.message || 'Failed to disconnect Notion.', 'error');
            return;
        }

        notionState = markSnipNotion.normalizeNotionState(response.notion);
        notionSearchState.query = '';
        const elements = getNotionElements();
        if (elements.searchInput) {
            elements.searchInput.value = '';
        }
        clearNotionSearchResults();
        renderNotionState();
        showToast('Notion workspace disconnected', 'success');
    } finally {
        setNotionButtonsLoading(false);
    }
}

function initNotionIntegration() {
    const elements = getNotionElements();
    if (!elements.connect) return;

    elements.connect.addEventListener('click', handleNotionAuth);
    elements.reconnect.addEventListener('click', handleNotionAuth);
    elements.disconnect.addEventListener('click', handleNotionDisconnect);
    elements.loadMore.addEventListener('click', () => {
        searchNotionDestinations(true);
    });

    [elements.kindPage, elements.kindDataSource].forEach(input => {
        if (!input) return;
        input.addEventListener('change', () => {
            notionSearchState.kind = input.value;
            clearNotionSearchResults();
            if (notionSearchState.query.trim()) {
                searchNotionDestinations(false);
            }
        });
    });

    if (elements.searchInput) {
        elements.searchInput.addEventListener('input', (event) => {
            notionSearchState.query = event.target.value.trim();
            clearTimeout(notionSearchTimeout);
            notionSearchTimeout = setTimeout(() => {
                searchNotionDestinations(false);
            }, 250);
        });
    }

    const mappingInputs = [
        ['title', elements.mappingTitle],
        ['sourceUrl', elements.mappingSourceUrl],
        ['clippedAt', elements.mappingClippedAt],
        ['tags', elements.mappingTags]
    ];

    mappingInputs.forEach(([mappingKey, select]) => {
        if (!select) return;
        select.addEventListener('change', async (event) => {
            notionState.propertyMappings[mappingKey] = event.target.value;
            await persistNotionState('Notion property mapping updated');
        });
    });

    if (elements.alsoDownloadMd) {
        elements.alsoDownloadMd.addEventListener('change', async (event) => {
            notionState.alsoDownloadMd = event.target.checked;
            await persistNotionState('Notion download preference updated');
        });
    }

    browser.storage.onChanged.addListener((changes, areaName) => {
        if (areaName !== 'local' || !changes.notion) return;
        notionState = markSnipNotion.normalizeNotionState(changes.notion.newValue);
        renderNotionState();
    });

    restoreNotionState().catch(error => {
        console.error('Failed to restore Notion state:', error);
        showToast('Failed to load Notion integration settings', 'error');
    });
}

const setCurrentChoice = result => {
    options = result;

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

    options.preserveCodeFormatting = result.preserveCodeFormatting;
    options.autoDetectCodeLanguage = result.autoDetectCodeLanguage !== false;

    // Initialize tableFormatting with default values if it doesn't exist
    options.tableFormatting = {
        stripLinks: false, // Default to false
        stripFormatting: false,
        prettyPrint: true,
        centerText: true,
        ...options.tableFormatting  // Merge with any existing settings
    };

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
            if (e.target?.dataset?.localOnly === 'true') {
                return;
            }
	        let key = e.target.name;
            if (!key) {
                return;
            }
	        let value = e.target.value;
	        if (key == "import-file") {
            fr = new FileReader();
            fr.onload = (ev) => {
                let lines = ev.target.result;
                options = JSON.parse(lines);
                setCurrentChoice(options);
                browser.contextMenus.removeAll()
                createMenus()
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
        var d = new Date();

        var datestring = d.getFullYear() + "-" + ("0" + (d.getMonth() + 1)).slice(-2) + "-" + ("0" + d.getDate()).slice(-2);
        browser.downloads.download({
            url: url,
            saveAs: true,
            filename: `MarkSnip-export-${datestring}.json`
        });
    }
}

// ── Sidebar Navigation ──
function initSidebar() {
    const sidebarItems = document.querySelectorAll('.sidebar-item');
    const sections = document.querySelectorAll('.section');

    // Restore last active tab from sessionStorage
    const lastActive = sessionStorage.getItem('marksnip-options-tab') || 'templates';

    function switchSection(sectionId) {
        // Update sidebar
        sidebarItems.forEach(item => item.classList.remove('active'));
        const activeItem = document.querySelector(`.sidebar-item[data-section="${sectionId}"]`);
        if (activeItem) activeItem.classList.add('active');

        // Update sections
        sections.forEach(section => section.classList.remove('active'));
        const activeSection = document.getElementById(`section-${sectionId}`);
        if (activeSection) activeSection.classList.add('active');

        // Persist
        sessionStorage.setItem('marksnip-options-tab', sectionId);
    }

    // Click handlers
    sidebarItems.forEach(item => {
        item.addEventListener('click', () => {
            // Clear search when navigating via sidebar
            const searchInput = document.getElementById('settings-search');
            if (searchInput && searchInput.value) {
                searchInput.value = '';
                searchInput.dispatchEvent(new Event('input'));
            }
            const sectionId = item.dataset.section;
            switchSection(sectionId);
        });
    });

    // Initialize to last active
    switchSection(lastActive);
}

const loaded = () => {
	    // Initialize sidebar navigation
	    initSidebar();
	    initSearch();
	    configureReviewLink();
        initNotionIntegration();

	    // Restore saved options
	    restoreOptions();

	    // Attach event listeners (skip the search input)
	    document.querySelectorAll('input,textarea,button').forEach(input => {
	        if (input.id === 'settings-search' || input.dataset.localOnly === 'true') return;
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

        sidebarItems.forEach(item => item.classList.remove('active'));
        const activeItem = document.querySelector(`.sidebar-item[data-section="${activeTab}"]`);
        if (activeItem) activeItem.classList.add('active');

        allSections.forEach(section => section.classList.remove('active'));
        const activeSection = document.getElementById(`section-${activeTab}`);
        if (activeSection) activeSection.classList.add('active');

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
