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
let templatePreviewListenersBound = false;
const optionsI18n = globalThis.markSnipI18n || null;
const SPECIAL_THEME_CLASS_NAMES = ['special-theme-claude', 'special-theme-perplexity', 'special-theme-openai', 'special-theme-atla', 'special-theme-ben10', 'special-theme-colorblind'];
const COLORBLIND_VARIANT_CLASS_NAMES = ['colorblind-theme-deuteranopia', 'colorblind-theme-protanopia', 'colorblind-theme-tritanopia'];
const ACCENT_CLASS_NAMES = ['accent-sage', 'accent-ocean', 'accent-slate', 'accent-rose', 'accent-amber'];
const POPUP_THEME_CACHE_KEY = 'marksnip-popup-theme-cache-v1';
const DEFAULT_SEND_TO_TARGET = 'chatgpt';
const DEFAULT_SEND_TO_MAX_URL_LENGTH = 3600;
const SITE_RULE_BOOLEAN_FIELD_IDS = {
    includeTemplate: 'siteRuleIncludeTemplate',
    downloadImages: 'siteRuleDownloadImages'
};
const SITE_RULE_ENUM_FIELD_IDS = {
    imageStyle: 'siteRuleImageStyle',
    imageRefStyle: 'siteRuleImageRefStyle'
};
const SITE_RULE_TEXT_FIELD_IDS = {
    frontmatter: { toggleId: 'siteRuleFrontmatterEnabled', inputId: 'siteRuleFrontmatter' },
    backmatter: { toggleId: 'siteRuleBackmatterEnabled', inputId: 'siteRuleBackmatter' },
    title: { toggleId: 'siteRuleTitleEnabled', inputId: 'siteRuleTitle' },
    imagePrefix: { toggleId: 'siteRuleImagePrefixEnabled', inputId: 'siteRuleImagePrefix' },
    mdClipsFolder: { toggleId: 'siteRuleMdClipsFolderEnabled', inputId: 'siteRuleMdClipsFolder' }
};
	const SITE_RULE_TABLE_FIELD_IDS = {
	    stripLinks: 'siteRuleTableStripLinks',
	    stripFormatting: 'siteRuleTableStripFormatting',
	    prettyPrint: 'siteRuleTablePrettyPrint',
	    centerText: 'siteRuleTableCenterText'
	};
	const SITE_RULE_OVERRIDE_LABELS = {
	    includeTemplate: 'Template',
	    downloadImages: 'Download Images',
	    frontmatter: 'Frontmatter',
	    backmatter: 'Backmatter',
	    title: 'Title',
	    imagePrefix: 'Image Prefix',
	    mdClipsFolder: 'Downloads Folder',
	    imageStyle: 'Image Style',
	    imageRefStyle: 'Image Refs',
	    'tableFormatting.stripLinks': 'Strip Links',
	    'tableFormatting.stripFormatting': 'Strip Formatting',
	    'tableFormatting.prettyPrint': 'Pretty Print',
	    'tableFormatting.centerText': 'Center Text'
	};
let siteRuleEditorState = {
	    mode: 'create',
	    ruleId: null
	};

function t(key, substitutions, fallback = null) {
    if (optionsI18n?.t) {
        const value = optionsI18n.t(key, substitutions);
        if (value !== key) {
            return value;
        }
    }
    return fallback ?? key;
}

function tp(keyBase, count, substitutions = {}, fallback = null) {
    if (optionsI18n?.tp) {
        return optionsI18n.tp(keyBase, count, substitutions);
    }
    return fallback ?? String(count);
}

	function getOptionsStateApi() {
	    return globalThis.markSnipOptionsState || null;
	}

function getLibraryStateApi() {
    return globalThis.markSnipLibraryState || null;
}

	function getAgentBridgeStateApi() {
	    return globalThis.markSnipAgentBridgeState || null;
	}

	function getSiteRulesApi() {
	    return globalThis.markSnipSiteRules || null;
	}

	function getTemplateUtils() {
	    return globalThis.markSnipTemplateUtils || null;
	}

	function normalizeSiteRulesState(rules) {
	    const siteRulesApi = getSiteRulesApi();
	    if (siteRulesApi?.normalizeSiteRules) {
	        return siteRulesApi.normalizeSiteRules(rules);
	    }

	    return Array.isArray(rules) ? rules.slice() : [];
	}

	function normalizeSiteRuleOverridesState(overrides) {
	    const siteRulesApi = getSiteRulesApi();
	    if (siteRulesApi?.normalizeSiteRuleOverrides) {
	        return siteRulesApi.normalizeSiteRuleOverrides(overrides);
	    }

	    return overrides && typeof overrides === 'object' ? { ...overrides } : {};
	}

	function validateSiteRulePatternState(pattern) {
	    const siteRulesApi = getSiteRulesApi();
	    if (siteRulesApi?.validateSiteRulePattern) {
	        return siteRulesApi.validateSiteRulePattern(pattern);
	    }

	    const normalizedPattern = String(pattern || '').trim();
	    return {
	        valid: Boolean(normalizedPattern),
	        error: normalizedPattern ? '' : 'Pattern is required',
	        normalizedPattern
	    };
	}

	function buildSiteRuleIdState() {
	    return `site-rule-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
	}

function escapeHtml(value) {
    return String(value || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function setLocalizedInnerHtml(element, key) {
    if (!element) {
        return;
    }
    const fallback = element.innerHTML;
    const localizedHtml = t(key, null, fallback);
    if (localizedHtml && localizedHtml !== key) {
        element.innerHTML = localizedHtml;
    }
}

function applyOptionsStaticLocalization() {
    document.title = t('options_title', null, 'MarkSnip Options');

    [
        ['section-templates', 'options_section_templates_html'],
        ['section-appearance', 'options_section_appearance_html'],
        ['section-downloads', 'options_section_downloads_html'],
        ['section-library', 'options_section_library_html'],
        ['section-markdown', 'options_section_markdown_html'],
        ['section-tables', 'options_section_tables_html'],
        ['section-site-rules', 'options_section_site_rules_html'],
        ['section-import-export', 'options_section_import_export_html']
    ].forEach(([id, key]) => {
        setLocalizedInnerHtml(document.getElementById(id), key);
    });

    optionsI18n?.applyDefinitions?.([
        { selector: '.header-subtitle', textKey: 'options_subtitle' },
        { selector: '.sidebar', ariaLabelKey: 'options_sidebar_aria' },
        { selector: '#settings-search', placeholderKey: 'options_search_placeholder', ariaLabelKey: 'options_search_aria' },
        { selector: '#tab-templates .sidebar-label', textKey: 'options_sidebar_templates' },
        { selector: '#tab-downloads .sidebar-label', textKey: 'options_sidebar_downloads' },
        { selector: '#tab-markdown .sidebar-label', textKey: 'options_sidebar_markdown' },
        { selector: '#tab-appearance .sidebar-label', textKey: 'options_sidebar_appearance' },
        { selector: '#tab-library .sidebar-label', textKey: 'options_sidebar_library' },
        { selector: '#tab-agent-bridge .sidebar-label', textKey: 'options_sidebar_agent_bridge' },
        { selector: '#tab-tables .sidebar-label', textKey: 'options_sidebar_tables' },
        { selector: '#tab-site-rules .sidebar-label', textKey: 'options_sidebar_site_rules' },
        { selector: '#tab-import-export .sidebar-label', textKey: 'options_sidebar_import_export' },
        { selector: '.sidebar-category:first-of-type', textKey: 'options_sidebar_help_resources' },
        { selector: '.sidebar-category:last-of-type', textKey: 'options_sidebar_community' },
        { selector: '#open-guide-link .sidebar-action-label', textKey: 'options_open_user_guide' },
        { selector: '.sidebar-action--coffee .sidebar-action-label', textKey: 'options_sidebar_buy_me_a_coffee' },
        { selector: '#leave-review-link .sidebar-action-label', textKey: 'options_sidebar_leave_review' },
        { selector: '.sidebar-action--issue .sidebar-action-label', textKey: 'options_sidebar_report_issue' },
        { selector: '#section-templates', datasetKeys: { sectionLabel: 'options_sidebar_templates' } },
        { selector: '#section-appearance', datasetKeys: { sectionLabel: 'options_sidebar_appearance' } },
        { selector: '#section-downloads', datasetKeys: { sectionLabel: 'options_sidebar_downloads' } },
        { selector: '#section-library', datasetKeys: { sectionLabel: 'options_sidebar_library' } },
        { selector: '#section-markdown', datasetKeys: { sectionLabel: 'options_sidebar_markdown' } },
        { selector: '#section-tables', datasetKeys: { sectionLabel: 'options_sidebar_tables' } },
        { selector: '#section-site-rules', datasetKeys: { sectionLabel: 'options_sidebar_site_rules' } },
        { selector: '#section-import-export', datasetKeys: { sectionLabel: 'options_sidebar_import_export' } }
    ], document);

    const noResultsText = document.querySelector('#search-no-results p:first-of-type');
    if (noResultsText) {
        noResultsText.innerHTML = `${t('options_search_no_results', null, 'No settings match')} "<span id="search-no-results-query"></span>"`;
    }
    const noResultsLink = document.querySelector('#search-no-results p:last-of-type a');
    if (noResultsLink) {
        noResultsLink.textContent = t('options_search_user_guide', null, 'Search the User Guide instead');
    }
}

async function bootstrapOptionsI18n() {
    if (!optionsI18n?.init) {
        return;
    }

    const stored = typeof browser !== 'undefined' && browser?.storage?.sync
        ? await browser.storage.sync.get({ uiLanguage: 'browser' }).catch(() => ({ uiLanguage: 'browser' }))
        : { uiLanguage: 'browser' };
    await optionsI18n.init({ setting: stored?.uiLanguage || 'browser' });
    optionsI18n.setDocumentLanguage?.(document.documentElement);
    applyOptionsStaticLocalization();
}

function buildCustomSendToTargetId() {
    return `custom-target-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
}

function getSendToUrlValidationState(value) {
    const optionsStateApi = getOptionsStateApi();
    if (optionsStateApi?.validateSendToUrlTemplate) {
        return optionsStateApi.validateSendToUrlTemplate(value);
    }

    const normalizedValue = String(value || '').trim();
    if (!normalizedValue) {
        return { valid: false, normalizedValue: '', error: 'URL template is required' };
    }

    const matches = normalizedValue.match(/\{prompt\}/g) || [];
    if (matches.length !== 1) {
        return { valid: false, normalizedValue, error: 'URL template must contain exactly one {prompt} placeholder' };
    }

    const queryStartIndex = normalizedValue.indexOf('?');
    const hashStartIndex = normalizedValue.indexOf('#');
    const promptIndex = normalizedValue.indexOf('{prompt}');
    const queryEndIndex = hashStartIndex === -1 ? normalizedValue.length : hashStartIndex;
    if (queryStartIndex === -1 || promptIndex < queryStartIndex || promptIndex >= queryEndIndex) {
        return { valid: false, normalizedValue, error: '{prompt} must appear in the query portion of the URL' };
    }

    try {
        const parsedUrl = new URL(normalizedValue.replace('{prompt}', '__MARKSNIP_PROMPT__'));
        if (parsedUrl.protocol !== 'https:') {
            return { valid: false, normalizedValue, error: 'URL template must start with https://' };
        }
    } catch {
        return { valid: false, normalizedValue, error: 'URL template must be a valid HTTPS URL' };
    }

    return { valid: true, normalizedValue, error: '' };
}

function normalizeCustomSendToTargetsState(targets) {
    const optionsStateApi = getOptionsStateApi();
    if (optionsStateApi?.normalizeCustomSendToTargets) {
        return optionsStateApi.normalizeCustomSendToTargets(targets);
    }

    if (!Array.isArray(targets)) {
        return [];
    }

    const seenIds = new Set();
    return targets.reduce((normalizedTargets, target, index) => {
        if (!target || typeof target !== 'object') {
            return normalizedTargets;
        }

        const name = String(target.name || '').trim();
        const validation = getSendToUrlValidationState(target.urlTemplate ?? target.url);
        if (!name || !validation.valid) {
            return normalizedTargets;
        }

        const id = String(target.id || '').trim() || `custom-target-${index + 1}`;
        if (seenIds.has(id)) {
            return normalizedTargets;
        }

        seenIds.add(id);
        normalizedTargets.push({
            id,
            name,
            urlTemplate: validation.normalizedValue
        });
        return normalizedTargets;
    }, []);
}

function normalizeDefaultSendToTargetState(value, customTargets = normalizeCustomSendToTargetsState(options?.sendToCustomTargets)) {
    const optionsStateApi = getOptionsStateApi();
    if (optionsStateApi?.normalizeDefaultSendToTarget) {
        return optionsStateApi.normalizeDefaultSendToTarget(value, customTargets, DEFAULT_SEND_TO_TARGET);
    }

    const normalizedValue = String(value || '').trim();
    if (normalizedValue === 'chatgpt' || normalizedValue === 'claude' || normalizedValue === 'perplexity') {
        return normalizedValue;
    }

    return customTargets.some((target) => target.id === normalizedValue)
        ? normalizedValue
        : DEFAULT_SEND_TO_TARGET;
}

function normalizeSendToMaxUrlLengthState(value, fallbackValue = defaultOptions?.sendToMaxUrlLength ?? DEFAULT_SEND_TO_MAX_URL_LENGTH) {
    const optionsStateApi = getOptionsStateApi();
    if (optionsStateApi?.normalizeSendToMaxUrlLength) {
        return optionsStateApi.normalizeSendToMaxUrlLength(value, fallbackValue);
    }

    const normalizedFallback = Number.isFinite(Number(fallbackValue)) && Number(fallbackValue) > 0
        ? Math.floor(Number(fallbackValue))
        : DEFAULT_SEND_TO_MAX_URL_LENGTH;
    const parsedValue = Number.parseInt(String(value ?? '').trim(), 10);
    return Number.isFinite(parsedValue) && parsedValue > 0
        ? parsedValue
        : normalizedFallback;
}

function getNormalizedSendToTargets() {
    const targets = normalizeCustomSendToTargetsState(options?.sendToCustomTargets);
    options.sendToCustomTargets = targets;
    options.defaultSendToTarget = normalizeDefaultSendToTargetState(options?.defaultSendToTarget, targets);
    return targets;
}

function renderDefaultSendToTargetOptions() {
    const customContainer = document.getElementById('defaultSendToTargetCustomOptions');
    if (!customContainer) {
        return;
    }

    const defaultTarget = normalizeDefaultSendToTargetState(options?.defaultSendToTarget, getNormalizedSendToTargets());
    const builtInInputs = {
        chatgpt: document.getElementById('send-to-target-chatgpt'),
        claude: document.getElementById('send-to-target-claude'),
        perplexity: document.getElementById('send-to-target-perplexity')
    };
    Object.entries(builtInInputs).forEach(([targetId, input]) => {
        if (input) {
            input.checked = defaultTarget === targetId;
        }
    });

    const targets = getNormalizedSendToTargets();
    customContainer.innerHTML = '';
    targets.forEach((target) => {
        const radioPill = document.createElement('div');
        radioPill.className = 'radio-pill';

        const input = document.createElement('input');
        input.type = 'radio';
        input.name = 'defaultSendToTarget';
        input.id = `send-to-target-${target.id}`;
        input.value = target.id;
        input.checked = defaultTarget === target.id;

        const label = document.createElement('label');
        label.setAttribute('for', input.id);
        label.textContent = target.name;

        radioPill.appendChild(input);
        radioPill.appendChild(label);
        customContainer.appendChild(radioPill);
    });
}

function renderAssistantTargetsList() {
    const list = document.getElementById('assistantTargetsList');
    if (!list) {
        return;
    }

    const targets = getNormalizedSendToTargets();
    list.innerHTML = '';
    if (targets.length === 0) {
        const emptyState = document.createElement('p');
        emptyState.className = 'assistant-targets-empty';
        emptyState.textContent = t(
            'options_runtime_no_custom_targets',
            null,
            'No custom assistant targets yet. ChatGPT, Claude, and Perplexity are always available.'
        );
        list.appendChild(emptyState);
        return;
    }

    targets.forEach((target) => {
        const item = document.createElement('article');
        item.className = 'assistant-target-item';

        const body = document.createElement('div');
        body.className = 'assistant-target-item__body';

        const name = document.createElement('h4');
        name.className = 'assistant-target-item__name';
        name.textContent = target.name;

        const meta = document.createElement('code');
        meta.className = 'assistant-target-item__meta';
        meta.textContent = target.urlTemplate;
        meta.title = target.urlTemplate;

        body.appendChild(name);
        body.appendChild(meta);

        const removeButton = document.createElement('button');
        removeButton.type = 'button';
        removeButton.className = 'btn btn-secondary btn-sm assistant-target-item__remove';
        removeButton.dataset.targetId = target.id;
        removeButton.textContent = t('options_runtime_remove', null, 'Remove');
        removeButton.setAttribute(
            'aria-label',
            t('options_runtime_remove_target', { name: target.name }, `Remove ${target.name}`)
        );

        item.appendChild(body);
        item.appendChild(removeButton);
        list.appendChild(item);
    });
}

function handleDefaultSendToTargetChoice(event) {
    const input = event.target;
    if (!input || input.name !== 'defaultSendToTarget') {
        return;
    }

    options.defaultSendToTarget = normalizeDefaultSendToTargetState(input.value, getNormalizedSendToTargets());
    renderDefaultSendToTargetOptions();
    save();
}

async function handleAddCustomSendToTarget() {
    const nameInput = document.getElementById('customSendToName');
    const urlInput = document.getElementById('customSendToUrl');
    const name = String(nameInput?.value || '').trim();
    const validation = getSendToUrlValidationState(urlInput?.value || '');

    if (!name) {
        showToast(t('options_runtime_enter_target_name', null, 'Please enter a target name'), 'error');
        nameInput?.focus();
        return;
    }

    if (!validation.valid) {
        showToast(validation.error || t('options_runtime_enter_valid_url_template', null, 'Please enter a valid URL template'), 'error');
        urlInput?.focus();
        return;
    }

    const nextTargets = [
        ...getNormalizedSendToTargets(),
        {
            id: buildCustomSendToTargetId(),
            name,
            urlTemplate: validation.normalizedValue
        }
    ];

    options.sendToCustomTargets = normalizeCustomSendToTargetsState(nextTargets);
    options.defaultSendToTarget = normalizeDefaultSendToTargetState(options.defaultSendToTarget, options.sendToCustomTargets);
    renderDefaultSendToTargetOptions();
    renderAssistantTargetsList();

    if (nameInput) {
        nameInput.value = '';
    }
    if (urlInput) {
        urlInput.value = '';
    }

    save({
        message: t('options_runtime_target_added', { name }, `Added "${name}"`),
        type: 'success'
    });
    nameInput?.focus();
}

function removeCustomSendToTarget(targetId) {
    const currentTargets = getNormalizedSendToTargets();
    const removedTarget = currentTargets.find((target) => target.id === targetId);
    if (!removedTarget) {
        return;
    }

    options.sendToCustomTargets = currentTargets.filter((target) => target.id !== targetId);
    options.defaultSendToTarget = normalizeDefaultSendToTargetState(
        options.defaultSendToTarget === targetId ? DEFAULT_SEND_TO_TARGET : options.defaultSendToTarget,
        options.sendToCustomTargets
    );

    renderDefaultSendToTargetOptions();
    renderAssistantTargetsList();
    save({
        message: t('options_runtime_target_removed', { name: removedTarget.name }, `Removed "${removedTarget.name}"`),
        type: 'success'
    });
}

function initSendToControls() {
    document.getElementById('defaultSendToTargetOptions')?.addEventListener('change', handleDefaultSendToTargetChoice);
    document.getElementById('addSendToCustomTarget')?.addEventListener('click', () => {
        handleAddCustomSendToTarget().catch((error) => {
            console.error('Failed to add custom assistant target:', error);
            showToast(t('options_runtime_failed_add_target', null, 'Failed to add assistant target'), 'error');
        });
    });
    document.getElementById('assistantTargetsList')?.addEventListener('click', (event) => {
        const removeButton = event.target.closest('[data-target-id]');
        if (!removeButton) {
            return;
        }
        removeCustomSendToTarget(removeButton.dataset.targetId);
    });

    ['customSendToName', 'customSendToUrl'].forEach((inputId) => {
        document.getElementById(inputId)?.addEventListener('keydown', (event) => {
            if (event.key !== 'Enter') {
                return;
            }
            event.preventDefault();
            handleAddCustomSendToTarget().catch((error) => {
                console.error('Failed to add custom assistant target:', error);
                showToast(t('options_runtime_failed_add_target', null, 'Failed to add assistant target'), 'error');
            });
        });
    });
}

	function getSiteRulesList() {
	    return normalizeSiteRulesState(options?.siteRules);
	}

	function setSiteRules(nextRules) {
	    options.siteRules = normalizeSiteRulesState(nextRules);
	}

	function findSiteRule(ruleId) {
	    return getSiteRulesList().find((rule) => rule.id === ruleId) || null;
	}

	function readTriStateBoolean(id) {
	    const value = document.getElementById(id)?.value || 'inherit';
	    if (value === 'true') return true;
	    if (value === 'false') return false;
	    return undefined;
	}

	function setTriStateBoolean(id, value) {
	    const input = document.getElementById(id);
	    if (!input) return;
	    input.value = value === true ? 'true' : value === false ? 'false' : 'inherit';
	}

	function setTextOverrideControl(toggleId, inputId, value) {
	    const toggle = document.getElementById(toggleId);
	    const input = document.getElementById(inputId);
	    const enabled = value !== undefined;
	    if (toggle) {
	        toggle.checked = enabled;
	    }
	    if (input) {
	        input.value = enabled ? String(value) : '';
	        input.disabled = !enabled;
	    }
	}

	function refreshSiteRuleTextOverrideStates() {
	    Object.values(SITE_RULE_TEXT_FIELD_IDS).forEach(({ toggleId, inputId }) => {
	        const toggle = document.getElementById(toggleId);
	        const input = document.getElementById(inputId);
	        if (!toggle || !input) return;
	        input.disabled = !toggle.checked;
	        input.closest('.site-rule-text-override')?.classList.toggle('is-disabled', !toggle.checked);
	    });
	}

	function clearSiteRuleEditorFeedback() {
	    const feedback = document.getElementById('siteRulePatternFeedback');
	    const patternInput = document.getElementById('siteRulePattern');
	    if (feedback) {
	        feedback.textContent = '';
	        feedback.classList.remove('is-error', 'is-success');
	    }
	    if (patternInput) {
	        patternInput.classList.remove('is-invalid');
	    }
	}

	function resetSiteRuleEditor() {
	    siteRuleEditorState = { mode: 'create', ruleId: null };
	    document.getElementById('siteRuleEditorTitle').textContent = t('options_runtime_site_rule_add', null, 'Add Site Rule');
	    document.getElementById('siteRuleName').value = '';
	    document.getElementById('siteRulePattern').value = '';
	    document.getElementById('siteRuleEnabled').checked = true;

	    Object.values(SITE_RULE_BOOLEAN_FIELD_IDS).forEach((id) => setTriStateBoolean(id, undefined));
	    Object.values(SITE_RULE_ENUM_FIELD_IDS).forEach((id) => {
	        const input = document.getElementById(id);
	        if (input) input.value = 'inherit';
	    });
	    Object.values(SITE_RULE_TABLE_FIELD_IDS).forEach((id) => setTriStateBoolean(id, undefined));
	    Object.values(SITE_RULE_TEXT_FIELD_IDS).forEach(({ toggleId, inputId }) => {
	        setTextOverrideControl(toggleId, inputId, undefined);
	    });

	    clearSiteRuleEditorFeedback();
	    refreshSiteRuleTextOverrideStates();
	}

	function openSiteRuleEditor(ruleId = null) {
	    resetSiteRuleEditor();
	    const editor = document.getElementById('siteRuleEditor');
	    if (!editor) {
	        return;
	    }

	    if (ruleId) {
	        const rule = findSiteRule(ruleId);
	        if (rule) {
	            siteRuleEditorState = { mode: 'edit', ruleId };
	            document.getElementById('siteRuleEditorTitle').textContent = t('options_runtime_site_rule_edit', null, 'Edit Site Rule');
	            document.getElementById('siteRuleName').value = rule.name || '';
	            document.getElementById('siteRulePattern').value = rule.pattern || '';
	            document.getElementById('siteRuleEnabled').checked = rule.enabled !== false;

	            Object.keys(SITE_RULE_BOOLEAN_FIELD_IDS).forEach((key) => {
	                setTriStateBoolean(SITE_RULE_BOOLEAN_FIELD_IDS[key], rule.overrides?.[key]);
	            });
	            Object.keys(SITE_RULE_ENUM_FIELD_IDS).forEach((key) => {
	                const input = document.getElementById(SITE_RULE_ENUM_FIELD_IDS[key]);
	                if (input) {
	                    input.value = rule.overrides?.[key] || 'inherit';
	                }
	            });
	            Object.keys(SITE_RULE_TABLE_FIELD_IDS).forEach((key) => {
	                setTriStateBoolean(SITE_RULE_TABLE_FIELD_IDS[key], rule.overrides?.tableFormatting?.[key]);
	            });
	            Object.keys(SITE_RULE_TEXT_FIELD_IDS).forEach((key) => {
	                const config = SITE_RULE_TEXT_FIELD_IDS[key];
	                setTextOverrideControl(config.toggleId, config.inputId, rule.overrides?.[key]);
	            });
	        }
	    }

	    editor.hidden = false;
	    refreshSiteRuleTextOverrideStates();
	    document.getElementById('siteRuleName')?.focus();
	}

	function closeSiteRuleEditor() {
	    document.getElementById('siteRuleEditor')?.setAttribute('hidden', '');
	    const editor = document.getElementById('siteRuleEditor');
	    if (editor) {
	        editor.hidden = true;
	    }
	    resetSiteRuleEditor();
	}

	function buildSiteRuleOverridesFromEditor() {
	    const overrides = {};

	    Object.keys(SITE_RULE_BOOLEAN_FIELD_IDS).forEach((key) => {
	        const value = readTriStateBoolean(SITE_RULE_BOOLEAN_FIELD_IDS[key]);
	        if (value !== undefined) {
	            overrides[key] = value;
	        }
	    });

	    Object.keys(SITE_RULE_ENUM_FIELD_IDS).forEach((key) => {
	        const value = document.getElementById(SITE_RULE_ENUM_FIELD_IDS[key])?.value || 'inherit';
	        if (value !== 'inherit') {
	            overrides[key] = value;
	        }
	    });

	    Object.keys(SITE_RULE_TEXT_FIELD_IDS).forEach((key) => {
	        const { toggleId, inputId } = SITE_RULE_TEXT_FIELD_IDS[key];
	        if (document.getElementById(toggleId)?.checked) {
	            overrides[key] = document.getElementById(inputId)?.value ?? '';
	        }
	    });

	    const tableFormatting = {};
	    Object.keys(SITE_RULE_TABLE_FIELD_IDS).forEach((key) => {
	        const value = readTriStateBoolean(SITE_RULE_TABLE_FIELD_IDS[key]);
	        if (value !== undefined) {
	            tableFormatting[key] = value;
	        }
	    });
	    if (Object.keys(tableFormatting).length > 0) {
	        overrides.tableFormatting = tableFormatting;
	    }

	    return normalizeSiteRuleOverridesState(overrides);
	}

	function getSiteRuleOverrideLabels(rule) {
	    const siteRulesApi = getSiteRulesApi();
	    const overrideKeys = siteRulesApi?.collectOverrideKeys
	        ? siteRulesApi.collectOverrideKeys(rule?.overrides)
	        : [];

	    return overrideKeys.map((key) => SITE_RULE_OVERRIDE_LABELS[key] || key);
	}

	function updateSiteRulesSummary(rules) {
	    const summary = document.getElementById('siteRulesSummary');
	    if (!summary) {
	        return;
	    }

	    const enabledCount = rules.filter((rule) => rule.enabled !== false).length;
	    summary.textContent = `${rules.length} rule${rules.length === 1 ? '' : 's'} • ${enabledCount} enabled`;
	}

	function renderSiteRules() {
	    const rules = getSiteRulesList();
	    const list = document.getElementById('siteRulesList');
	    const empty = document.getElementById('siteRulesEmpty');
	    if (!list || !empty) {
	        return;
	    }

	    updateSiteRulesSummary(rules);
	    empty.hidden = rules.length > 0;
	    list.innerHTML = rules.map((rule, index) => {
	        const validation = validateSiteRulePatternState(rule.pattern);
	        const overrideLabels = getSiteRuleOverrideLabels(rule);
	        const chips = overrideLabels.length > 0
	            ? overrideLabels.map((label) => `<span class="site-rule-chip">${escapeHtml(label)}</span>`).join('')
	            : `<span class="site-rule-chip site-rule-chip--muted">${escapeHtml(t('options_runtime_no_overrides', null, 'No overrides'))}</span>`;

	        return `
	            <article class="site-rule-item${rule.enabled === false ? ' is-disabled' : ''}">
	                <div class="site-rule-item__body">
	                    <div class="site-rule-item__header">
	                        <div>
	                            <h4 class="site-rule-item__title">${index + 1}. ${escapeHtml(rule.name)}</h4>
	                            <code class="site-rule-item__pattern">${escapeHtml(rule.pattern)}</code>
	                        </div>
	                        <label class="site-rule-toggle-inline">
	                            <input type="checkbox" data-site-rule-toggle="${escapeHtml(rule.id)}" ${rule.enabled === false ? '' : 'checked'} />
	                            <span>${escapeHtml(t('options_runtime_enabled', null, 'Enabled'))}</span>
	                        </label>
	                    </div>
	                    <div class="site-rule-chip-list">${chips}</div>
	                    ${validation.valid ? '' : `<p class="site-rule-item__error">${escapeHtml(t('options_runtime_invalid_pattern_prefix', null, 'Invalid pattern:'))} ${escapeHtml(validation.error)}</p>`}
	                </div>
	                <div class="site-rule-item__actions">
	                    <button type="button" class="btn btn-secondary btn-sm" data-site-rule-action="move-up" data-rule-id="${escapeHtml(rule.id)}" ${index === 0 ? 'disabled' : ''}>${escapeHtml(t('options_runtime_up', null, 'Up'))}</button>
	                    <button type="button" class="btn btn-secondary btn-sm" data-site-rule-action="move-down" data-rule-id="${escapeHtml(rule.id)}" ${index === rules.length - 1 ? 'disabled' : ''}>${escapeHtml(t('options_runtime_down', null, 'Down'))}</button>
	                    <button type="button" class="btn btn-secondary btn-sm" data-site-rule-action="edit" data-rule-id="${escapeHtml(rule.id)}">${escapeHtml(t('options_runtime_edit', null, 'Edit'))}</button>
	                    <button type="button" class="btn btn-danger btn-sm" data-site-rule-action="delete" data-rule-id="${escapeHtml(rule.id)}">${escapeHtml(t('options_runtime_delete', null, 'Delete'))}</button>
	                </div>
	            </article>
	        `;
	    }).join('');

	    if (siteRuleEditorState.ruleId && !findSiteRule(siteRuleEditorState.ruleId)) {
	        closeSiteRuleEditor();
	    }
	}

	async function saveSiteRuleEditor() {
	    const patternInput = document.getElementById('siteRulePattern');
	    const rawPattern = patternInput?.value || '';
	    const validation = validateSiteRulePatternState(rawPattern);
	    const feedback = document.getElementById('siteRulePatternFeedback');

	    if (!validation.valid) {
	        if (patternInput) {
	            patternInput.classList.add('is-invalid');
	            patternInput.focus();
	        }
	        if (feedback) {
	            feedback.textContent = validation.error;
	            feedback.classList.remove('is-success');
	            feedback.classList.add('is-error');
	        }
	        showToast(validation.error || t('options_runtime_invalid_site_rule_pattern', null, 'Invalid site rule pattern'), 'error');
	        return;
	    }

	    const nextRule = {
	        id: siteRuleEditorState.mode === 'edit' && siteRuleEditorState.ruleId
	            ? siteRuleEditorState.ruleId
	            : buildSiteRuleIdState(),
	        name: String(document.getElementById('siteRuleName')?.value || '').trim() || validation.normalizedPattern,
	        enabled: document.getElementById('siteRuleEnabled')?.checked !== false,
	        pattern: validation.normalizedPattern,
	        overrides: buildSiteRuleOverridesFromEditor()
	    };

	    const rules = getSiteRulesList();
	    const nextRules = siteRuleEditorState.mode === 'edit'
	        ? rules.map((rule) => rule.id === siteRuleEditorState.ruleId ? nextRule : rule)
	        : [...rules, nextRule];

	    setSiteRules(nextRules);
	    renderSiteRules();
	    closeSiteRuleEditor();
	    save();
	}

	function moveSiteRule(ruleId, direction) {
	    const rules = getSiteRulesList();
	    const index = rules.findIndex((rule) => rule.id === ruleId);
	    if (index < 0) {
	        return;
	    }

	    const targetIndex = direction === 'up' ? index - 1 : index + 1;
	    if (targetIndex < 0 || targetIndex >= rules.length) {
	        return;
	    }

	    const nextRules = rules.slice();
	    const [rule] = nextRules.splice(index, 1);
	    nextRules.splice(targetIndex, 0, rule);
	    setSiteRules(nextRules);
	    renderSiteRules();
	    save();
	}

	function deleteSiteRule(ruleId) {
	    const nextRules = getSiteRulesList().filter((rule) => rule.id !== ruleId);
	    setSiteRules(nextRules);
	    renderSiteRules();
	    if (siteRuleEditorState.ruleId === ruleId) {
	        closeSiteRuleEditor();
	    }
	    save();
	}

	function toggleSiteRuleEnabled(ruleId, enabled) {
	    const nextRules = getSiteRulesList().map((rule) => (
	        rule.id === ruleId ? { ...rule, enabled: enabled !== false } : rule
	    ));
	    setSiteRules(nextRules);
	    renderSiteRules();
	    save();
	}

	function initSiteRuleControls() {
	    document.getElementById('addSiteRule')?.addEventListener('click', () => openSiteRuleEditor());
	    document.getElementById('cancelSiteRule')?.addEventListener('click', () => closeSiteRuleEditor());
	    document.getElementById('saveSiteRule')?.addEventListener('click', () => {
	        saveSiteRuleEditor().catch((error) => {
	            console.error('Failed to save site rule:', error);
	            showToast(String(error), 'error');
	        });
	    });
	    document.getElementById('siteRulePattern')?.addEventListener('input', (event) => {
	        const validation = validateSiteRulePatternState(event.target.value);
	        const feedback = document.getElementById('siteRulePatternFeedback');
	        event.target.classList.toggle('is-invalid', !validation.valid && event.target.value.trim().length > 0);
	        if (!feedback) {
	            return;
	        }
	        if (!event.target.value.trim()) {
	            feedback.textContent = '';
	            feedback.classList.remove('is-error', 'is-success');
	            return;
	        }
	        feedback.textContent = validation.valid ? `Matches as ${validation.normalizedPattern}` : validation.error;
	        feedback.classList.toggle('is-error', !validation.valid);
	        feedback.classList.toggle('is-success', validation.valid);
	    });

	    Object.values(SITE_RULE_TEXT_FIELD_IDS).forEach(({ toggleId }) => {
	        document.getElementById(toggleId)?.addEventListener('change', refreshSiteRuleTextOverrideStates);
	    });

	    document.getElementById('siteRulesList')?.addEventListener('click', (event) => {
	        const button = event.target.closest('[data-site-rule-action]');
	        if (!button) {
	            return;
	        }

	        const ruleId = button.dataset.ruleId;
	        const action = button.dataset.siteRuleAction;
	        if (!ruleId || !action) {
	            return;
	        }

	        if (action === 'edit') {
	            openSiteRuleEditor(ruleId);
	            return;
	        }
	        if (action === 'move-up') {
	            moveSiteRule(ruleId, 'up');
	            return;
	        }
	        if (action === 'move-down') {
	            moveSiteRule(ruleId, 'down');
	            return;
	        }
	        if (action === 'delete') {
	            deleteSiteRule(ruleId);
	        }
	    });

	    document.getElementById('siteRulesList')?.addEventListener('change', (event) => {
	        const toggle = event.target.closest('[data-site-rule-toggle]');
	        if (!toggle) {
	            return;
	        }
	        toggleSiteRuleEnabled(toggle.dataset.siteRuleToggle, toggle.checked);
	    });

	    resetSiteRuleEditor();
	    renderSiteRules();
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
        button.textContent = t('options_runtime_grant_permission', null, 'Grant Permission');
        button.setAttribute(
            'aria-label',
            t(
                'options_runtime_grant_permission_aria',
                null,
                'Grant native messaging permission for Agent Bridge'
            )
        );
        return;
    }

    button.textContent = t('options_runtime_check_connection', null, 'Check Connection');
    button.setAttribute(
        'aria-label',
        t('options_runtime_check_connection_aria', null, 'Check Agent Bridge connection status')
    );
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
        showToast(t('options_runtime_browser_cannot_request_permission', null, 'This browser cannot request native messaging permission here'), "error");
        return { granted: false, reloadRequired: false };
    }

    const granted = await browser.permissions.request({
        permissions: ['nativeMessaging']
    }).catch((error) => {
        console.error('Failed to request native messaging permission:', error);
        return false;
    });

    if (!granted) {
        showToast(t('options_runtime_permission_not_granted', null, 'Agent Bridge permission was not granted'), "error");
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
        continueBtn.textContent = t('options_runtime_requesting', null, 'Requesting...');
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
        showToast(t('options_runtime_agent_bridge_enabled', null, 'Agent Bridge enabled'), "success");
    } catch (error) {
        console.error('Failed to request Agent Bridge permission:', error);
        showPermissionPanel('denied');
    } finally {
        if (continueBtn) {
            continueBtn.disabled = false;
            continueBtn.textContent = t('options_runtime_continue', null, 'Continue');
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

    const normalizedOptions = {
        ...defaultOptions,
        ...(importedOptions || {}),
        tableFormatting: {
            ...(defaultOptions.tableFormatting || {}),
            ...((importedOptions && importedOptions.tableFormatting) || {})
        }
    };

    normalizedOptions.sendToCustomTargets = normalizeCustomSendToTargetsState(normalizedOptions.sendToCustomTargets);
    normalizedOptions.defaultSendToTarget = normalizeDefaultSendToTargetState(
        normalizedOptions.defaultSendToTarget,
        normalizedOptions.sendToCustomTargets
    );
    normalizedOptions.sendToMaxUrlLength = normalizeSendToMaxUrlLengthState(
        normalizedOptions.sendToMaxUrlLength,
        defaultOptions?.sendToMaxUrlLength
    );

    const validPrimaryActions = new Set(['markdown', 'text', 'html', 'pdf', 'copy', 'sendTo']);
    normalizedOptions.defaultExportType = validPrimaryActions.has(normalizedOptions.defaultExportType)
        ? normalizedOptions.defaultExportType
        : defaultOptions.defaultExportType;

    return normalizedOptions;
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
        colorBlindTheme: normalizeColorBlindTheme(source?.colorBlindTheme),
        specialThemeIcon: source?.specialThemeIcon !== false,
        popupAccent: source?.popupAccent || 'sage',
        showThemeToggleInPopup: source?.showThemeToggleInPopup !== false,
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

function normalizeColorBlindTheme(value) {
    return ['deuteranopia', 'protanopia', 'tritanopia'].includes(value) ? value : 'deuteranopia';
}

function getColorBlindThemeClassName(value = options?.colorBlindTheme) {
    return 'colorblind-theme-' + normalizeColorBlindTheme(value);
}

const CB_DROPDOWN_LABELS = { deuteranopia: 'Deuteranopia', protanopia: 'Protanopia', tritanopia: 'Tritanopia' };

function updateCbDropdownLabel(value) {
    const labelEl = document.getElementById('colorBlindThemeBtnLabel');
    if (labelEl) labelEl.textContent = CB_DROPDOWN_LABELS[value] || 'Deuteranopia';
    const panel = document.getElementById('colorBlindThemePanel');
    if (panel) {
        panel.querySelectorAll('.dd-item[data-value]').forEach(item => {
            item.setAttribute('aria-selected', String(item.dataset.value === value));
        });
    }
}

function toggleCbDropdown(e) {
    e.stopPropagation();
    const panel = document.getElementById('colorBlindThemePanel');
    const btn = document.getElementById('colorBlindThemeBtn');
    if (!panel || !btn) return;
    const willOpen = panel.hidden;
    panel.hidden = !willOpen;
    btn.setAttribute('aria-expanded', String(willOpen));
}

function closeCbDropdown() {
    const panel = document.getElementById('colorBlindThemePanel');
    const btn = document.getElementById('colorBlindThemeBtn');
    if (panel) panel.hidden = true;
    if (btn) btn.setAttribute('aria-expanded', 'false');
}

// Apply theme mode and accent color to the Options page itself
function applyThemeSettings() {
    const root = document.documentElement;
    const specialTheme = options.specialTheme || 'none';

    // Apply theme mode
    root.classList.remove('theme-light', 'theme-dark', 'theme-system');
    root.classList.add('theme-' + (options.popupTheme || 'system'));

    root.classList.remove(...SPECIAL_THEME_CLASS_NAMES);
    root.classList.remove(...COLORBLIND_VARIANT_CLASS_NAMES);
    if (specialTheme !== 'none') {
        root.classList.add('special-theme-' + specialTheme);
        if (specialTheme === 'colorblind') {
            root.classList.add(getColorBlindThemeClassName(options.colorBlindTheme));
        }
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
    const colorBlindThemeActive = specialTheme === 'colorblind';
    const themeHasIcon = specialTheme === 'atla' || specialTheme === 'ben10' || specialTheme === 'claude' || specialTheme === 'perplexity' || specialTheme === 'openai';
    const accentGroup = document.getElementById('popupAccentGroup');
    const editorThemeGroup = document.getElementById('editorThemeGroup');
    const accentNote = document.getElementById('popupAccentThemeNote');
    const editorThemeNote = document.getElementById('editorThemeLockNote');
    const iconRow = document.getElementById('specialThemeIconRow');
    const iconInput = document.querySelector("[name='specialThemeIcon']");
    const colorBlindThemeRow = document.getElementById('colorBlindThemeRow');
    const colorBlindThemeInput = document.querySelector("[name='colorBlindTheme']");

    if (iconRow) iconRow.classList.toggle('is-disabled', !themeHasIcon);
    if (iconInput) iconInput.disabled = !themeHasIcon;
    if (colorBlindThemeRow) {
        colorBlindThemeRow.hidden = !colorBlindThemeActive;
        colorBlindThemeRow.classList.toggle('is-disabled', !colorBlindThemeActive);
        colorBlindThemeRow.setAttribute('aria-hidden', String(!colorBlindThemeActive));
    }
    if (colorBlindThemeInput) {
        colorBlindThemeInput.disabled = !colorBlindThemeActive;
        colorBlindThemeInput.value = normalizeColorBlindTheme(options.colorBlindTheme);
    }
    const colorBlindThemeBtn = document.getElementById('colorBlindThemeBtn');
    if (colorBlindThemeBtn) {
        colorBlindThemeBtn.disabled = !colorBlindThemeActive;
        updateCbDropdownLabel(normalizeColorBlindTheme(options.colorBlindTheme));
        if (!colorBlindThemeActive) closeCbDropdown();
    }

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

    const customSendToTargets = normalizeCustomSendToTargetsState(options.sendToCustomTargets);
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
        defaultSendToTarget: normalizeDefaultSendToTargetState(
            getCheckedValue(document.querySelectorAll("input[name='defaultSendToTarget']")) || DEFAULT_SEND_TO_TARGET,
            customSendToTargets
        ),
        sendToCustomTargets: customSendToTargets,
        sendToMaxUrlLength: normalizeSendToMaxUrlLengthState(
            document.querySelector("[name='sendToMaxUrlLength']")?.value,
            defaultOptions?.sendToMaxUrlLength
        ),
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
        colorBlindTheme: normalizeColorBlindTheme(document.querySelector("[name='colorBlindTheme']")?.value),
        specialThemeIcon: document.querySelector("[name='specialThemeIcon']").checked,
	        popupAccent: getCheckedValue(document.querySelectorAll("input[name='popupAccent']")),
	        compactMode: document.querySelector("[name='compactMode']").checked,
	        showThemeToggleInPopup: document.querySelector("[name='showThemeToggleInPopup']").checked,
	        showUserGuideIcon: document.querySelector("[name='showUserGuideIcon']").checked,
	        editorTheme: getCheckedValue(document.querySelectorAll("input[name='editorTheme']")),
	        siteRules: normalizeSiteRulesState(options.siteRules),
	    }

    save();
}

const save = (feedback = { message: t('options_runtime_options_saved', null, 'Options Saved'), type: "success" }) => {
	    const spinner = document.getElementById("spinner");
	    spinner.style.display = "block";
        options = normalizeImportedOptionsState(options);
	    options.siteRules = normalizeSiteRulesState(options.siteRules);

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

	    return browser.storage.sync.set(options)
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
                if (feedback !== false) {
	                    showToast(feedback?.message || t('options_runtime_options_saved', null, 'Options Saved'), feedback?.type || "success");
                }
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

function buildTemplatePreviewSampleArticle() {
    const sampleUrl = new URL('https://example.com/article');
    const samplePageUrl = new URL('https://example.com/article');

    return {
        title: 'Example Article',
        pageTitle: 'Example Article',
        length: '1842',
        excerpt: 'A compact sample summary for template preview output.',
        description: 'A compact sample summary for template preview output.',
        byline: 'Jane Doe',
        author: 'Jane Doe',
        dir: 'ltr',
        keywords: ['example', 'markdown', 'templates'],
        siteName: 'Example Site',
        baseURI: sampleUrl.href,
        pageURL: samplePageUrl.href,
        tabURL: samplePageUrl.href,
        origin: sampleUrl.origin,
        host: sampleUrl.host,
        hostname: sampleUrl.hostname,
        port: sampleUrl.port,
        protocol: sampleUrl.protocol,
        pathname: sampleUrl.pathname,
        search: sampleUrl.search,
        hash: sampleUrl.hash,
        pageOrigin: samplePageUrl.origin,
        pageHost: samplePageUrl.host,
        pageHostname: samplePageUrl.hostname,
        pagePort: samplePageUrl.port,
        pageProtocol: samplePageUrl.protocol,
        pagePathname: samplePageUrl.pathname,
        pageSearch: samplePageUrl.search,
        pageHash: samplePageUrl.hash
    };
}

function renderTemplatePreviewOutput(outputId, templateValue) {
    const output = document.getElementById(outputId);
    if (!output) {
        return;
    }

    const normalizedTemplate = String(templateValue || '');
    if (!normalizedTemplate.trim()) {
        output.textContent = t('options_runtime_nothing_to_preview', null, 'Nothing to preview yet.');
        output.classList.add('is-empty');
        return;
    }

    const templateUtils = getTemplateUtils();
    const renderedText = typeof templateUtils?.textReplace === 'function'
        ? templateUtils.textReplace(normalizedTemplate, buildTemplatePreviewSampleArticle())
        : normalizedTemplate;

    output.textContent = renderedText;
    output.classList.toggle('is-empty', !renderedText.trim());
}

function renderTemplatePreviews() {
    const frontmatterInput = document.getElementById('frontmatter');
    const backmatterInput = document.getElementById('backmatter');

    renderTemplatePreviewOutput('frontmatter-preview-output', frontmatterInput?.value || '');
    renderTemplatePreviewOutput('backmatter-preview-output', backmatterInput?.value || '');
}

function bindTemplatePreviewListeners() {
    if (templatePreviewListenersBound) {
        return;
    }

    ['frontmatter', 'backmatter'].forEach((id) => {
        const input = document.getElementById(id);
        if (!input) {
            return;
        }

        input.addEventListener('input', renderTemplatePreviews);
    });

    templatePreviewListenersBound = true;
}

const setCurrentChoice = result => {
    options = normalizeImportedOptionsState(result);

    // if browser doesn't support the download api (i.e. Safari)
    // we have to use contentLink download mode
    if (!browser.downloads) {
        options.downloadMode = 'contentLink';
        document.querySelectorAll("[name='downloadMode']").forEach(el => el.disabled = true)
        document.querySelector('#downloadMode .card-desc').innerText = t(
            'options_runtime_download_unavailable',
            null,
            'The Downloads API is unavailable in this browser.'
        );
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
    document.querySelector("[name='sendToMaxUrlLength']").value = options.sendToMaxUrlLength;

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
        renderDefaultSendToTargetOptions();
        renderAssistantTargetsList();
    const uiLanguageSelect = document.querySelector("[name='uiLanguage']");
    if (uiLanguageSelect) {
        uiLanguageSelect.value = options.uiLanguage || 'browser';
    }

	    setCheckedValue(document.querySelectorAll("[name='popupTheme']"), options.popupTheme || 'system');
    setCheckedValue(document.querySelectorAll("[name='specialTheme']"), options.specialTheme || 'none');
    document.querySelector("[name='colorBlindTheme']").value = normalizeColorBlindTheme(options.colorBlindTheme);
    document.querySelector("[name='specialThemeIcon']").checked = options.specialThemeIcon !== false;
    setCheckedValue(document.querySelectorAll("[name='popupAccent']"), options.popupAccent || 'sage');
    document.querySelector("[name='compactMode']").checked = options.compactMode || false;
    document.querySelector("[name='showThemeToggleInPopup']").checked = options.showThemeToggleInPopup !== false;
    document.querySelector("[name='showUserGuideIcon']").checked = options.showUserGuideIcon !== false;
    setCheckedValue(document.querySelectorAll("[name='editorTheme']"), options.editorTheme || 'default');

	    updateSpecialThemeControlState();
	    refreshElements();
	    applyThemeSettings();
	    renderSiteRules();
        renderTemplatePreviews();
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

    let text = t('options_runtime_disabled', null, 'Disabled');
    let hint = t('options_runtime_bridge_hint_disabled', null, 'Enable the Agent Bridge to let MarkSnip connect to the local companion.');
    let state = 'disabled';

    if (usesOptionalNativeMessagingPermission() && agentBridgeSettings.enabled && !agentBridgeStatus.permissionGranted) {
        text = t('options_runtime_permission_needed', null, 'Permission needed');
        hint = t('options_runtime_bridge_hint_permission', null, 'Grant native messaging permission to let MarkSnip connect to the local companion.');
        state = 'permission-needed';
    } else if (agentBridgeSettings.enabled && agentBridgeStatus.connecting) {
        text = t('options_runtime_checking_connection', null, 'Checking connection');
        hint = t('options_runtime_bridge_hint_connecting', null, 'MarkSnip is waiting for the local companion to respond.');
        state = 'starting';
    } else if (agentBridgeSettings.enabled && agentBridgeStatus.connected) {
        text = agentBridgeStatus.browser
            ? t('options_runtime_connected_via', { browser: agentBridgeStatus.browser }, `Connected via ${agentBridgeStatus.browser}`)
            : t('options_runtime_connected', null, 'Connected');
        hint = t('options_runtime_bridge_hint_connected', null, 'The local CLI can request the current page while this browser is open.');
        state = 'connected';
    } else if (agentBridgeSettings.enabled && agentBridgeStatus.lastError) {
        text = t('options_runtime_waiting_for_companion', null, 'Waiting for companion');
        hint = t('options_runtime_bridge_hint_waiting', null, 'The local companion could not be reached. Check the setup guide and try again.');
        state = 'waiting';
    } else if (agentBridgeSettings.enabled) {
        text = t('options_runtime_starting', null, 'Starting');
        hint = t('options_runtime_bridge_hint_starting', null, 'MarkSnip is trying to connect to the local companion.');
        state = 'starting';
    } else if (!agentBridgeSettings.enabled && agentBridgeStatus.permissionGranted) {
        // Disabled after prior grant
        hint = t('options_runtime_bridge_hint_disabled_after_grant', null, 'MarkSnip will not use the local connection while disabled, even if the browser-level permission remains granted.');
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
            toggleHint.textContent = t('options_runtime_toggle_hint_on', null, 'MarkSnip opens a native messaging connection while this toggle is on.');
        } else {
            toggleHint.textContent = t('options_runtime_toggle_hint_off', null, 'When off, MarkSnip will not open a local companion connection.');
        }
    }

    if (versionEl) {
        if (agentBridgeStatus.hostVersion) {
            versionEl.textContent = t('options_runtime_host_version', { version: agentBridgeStatus.hostVersion }, `Host ${agentBridgeStatus.hostVersion}`);
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

    show(document.getElementById("defaultSendToTargetCard"), options.defaultExportType === 'sendTo');

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
            showToast(t('options_runtime_library_saved', null, 'Library settings saved'), "success");
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
            showToast(
                nextEnabled
                    ? t('options_runtime_agent_bridge_enabled', null, 'Agent Bridge enabled')
                    : t('options_runtime_agent_bridge_disabled', null, 'Agent Bridge disabled'),
                "success"
            );
        }
        else {
            if (e.target.type == "checkbox") value = e.target.checked;
            if (key === 'sendToMaxUrlLength') {
                value = normalizeSendToMaxUrlLengthState(value, defaultOptions?.sendToMaxUrlLength);
                e.target.value = value;
            }
            
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

            const savePromise = save();
            refreshElements();

            if (key === 'uiLanguage') {
                savePromise.then(() => {
                    window.location.reload();
                });
            }
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
                showToast(t('options_runtime_permission_granted', null, 'Agent Bridge permission granted'), "success");
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
                showToast(t('options_runtime_status_refreshed', null, 'Agent Bridge status refreshed'), "success");
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
                showToast(t('options_runtime_install_command_copied', null, 'Install command copied'), "success");
            })
            .catch((error) => {
                console.error('Failed to copy Agent Bridge install command:', error);
                showToast(t('options_runtime_install_command_failed', null, 'Failed to copy install command'), "error");
            });
    }
}

// ── Sidebar Navigation ──
async function clearLibraryItems() {
    if (!confirm(t('options_runtime_confirm_clear_library', null, 'Delete all saved Library clips from this browser? This cannot be undone.'))) {
        return;
    }

    try {
        await clearLibraryItemsState();
        showToast(t('options_runtime_library_cleared', null, 'Library cleared'), "success");
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
        showToast(t('options_runtime_setting_reset', null, 'Setting reset to default'), "success");
        return;
    }

    const keys = card.dataset.settingKey.split(',');
    const resetResult = resetOptionKeysState(keys);
    options = resetResult.options;
    setCurrentChoice(options);
    applyContextMenuTransition(resetResult.contextMenuAction);
    save();
    showToast(t('options_runtime_setting_reset', null, 'Setting reset to default'), "success");
}

async function resetAllSettings() {
    if (!confirm(t('options_runtime_confirm_reset_all', null, 'Reset all settings to defaults? This cannot be undone.'))) return;
    const resetResult = resetAllOptionsState();
    options = resetResult.options;
    setCurrentChoice(options);
    applyContextMenuTransition(resetResult.contextMenuAction);
    await resetLibrarySettingsState();
    setCurrentLibraryChoice(librarySettings);
    save();
    showToast(t('options_runtime_all_settings_reset', null, 'All settings reset to defaults'), "success");
}

const loaded = async () => {
    try {
        await bootstrapOptionsI18n();
    } catch (error) {
        console.error('Failed to initialize options i18n:', error);
    }

    // Initialize sidebar navigation
	    initSidebar();
	    initSearch();
	    configureReviewLink();
	    bindTemplatePreviewListeners();
	    renderTemplatePreviews();
        initSendToControls();

	    // Restore saved options
	    restoreOptions();
	    initSiteRuleControls();

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
		    document.querySelectorAll('input,textarea,button,select').forEach(input => {
		        if (input.id === 'settings-search') return;
		        if (input.closest('#siteRulesCard')) return;
                if (input.closest('#defaultSendToTargetCard') || input.closest('#assistantTargetsCard')) return;
		        // Skip permission panel buttons (they have their own handlers)
		        if (['agentBridgePermContinue', 'agentBridgePermCancel', 'agentBridgePermRetry', 'agentBridgePermDismiss'].includes(input.id)) return;
	        // Skip colorblind theme dropdown (has its own handlers)
	        if (input.id === 'colorBlindThemeBtn' || input.closest('#colorBlindThemePanel')) return;
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

    // Colorblind theme custom dropdown
    document.getElementById('colorBlindThemeBtn')?.addEventListener('click', toggleCbDropdown);
    document.getElementById('colorBlindThemePanel')?.addEventListener('click', (e) => {
        const item = e.target.closest('.dd-item[data-value]');
        if (!item) return;
        const value = item.dataset.value;
        const hiddenInput = document.querySelector("[name='colorBlindTheme']");
        if (hiddenInput) hiddenInput.value = value;
        options.colorBlindTheme = value;
        closeCbDropdown();
        save();
        refreshElements();
    });
    document.addEventListener('click', (e) => {
        if (!document.getElementById('colorBlindDropdownWrap')?.contains(e.target)) {
            closeCbDropdown();
        }
    });
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') closeCbDropdown();
    });

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
    const searchStatus = document.getElementById('settings-search-status');
    const contentPanel = document.querySelector('.content-panel');
    const noResults = document.getElementById('search-no-results');
    const noResultsQuery = document.getElementById('search-no-results-query');
    const searchApi = globalThis.markSnipOptionsSearch;

    if (!searchInput || !contentPanel || !noResults || !noResultsQuery || !searchApi) {
        return;
    }

    const sections = document.querySelectorAll('.section');
    const searchIndex = searchApi.buildSearchIndex(document);
    const totalSettings = searchIndex.length;
    let searchTimeout = null;

    function updateSearchStatus(message) {
        if (!searchStatus) {
            return;
        }
        const nextMessage = String(message || '');
        searchStatus.textContent = nextMessage;
        searchStatus.hidden = nextMessage === '';
    }

    function restoreDefaultView() {
        contentPanel.classList.remove('search-active');
        noResults.classList.remove('visible');
        updateSearchStatus('');

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
                        card.dataset.searchAlias = t(
                            'options_runtime_search_matched_via',
                            { keywords: matchedKeywords.slice(0, 2).join(', ') },
                            `matched via: ${matchedKeywords.slice(0, 2).join(', ')}`
                        );
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
            noResultsQuery.textContent = query.trim();
            noResults.classList.add('visible');
            updateSearchStatus(t('options_runtime_search_no_results', { query: query.trim() }, `No settings match "${query.trim()}"`));
        } else {
            noResults.classList.remove('visible');
            updateSearchStatus(
                t(
                    'options_runtime_search_results',
                    { shown: totalMatches, total: totalSettings },
                    `Showing ${totalMatches} of ${totalSettings} settings`
                )
            );
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
