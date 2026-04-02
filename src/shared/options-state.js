(function (root) {
  function getSiteRulesApi() {
    if (root.markSnipSiteRules) {
      return root.markSnipSiteRules;
    }

    if (typeof require === 'function') {
      try {
        return require('./site-rules');
      } catch {
        return null;
      }
    }

    return null;
  }

  function isPlainObject(value) {
    return Object.prototype.toString.call(value) === '[object Object]';
  }

  const POPUP_PRIMARY_ACTIONS = new Set(['markdown', 'text', 'html', 'pdf', 'copy', 'sendTo']);
  const BUILTIN_SEND_TO_TARGETS = new Set(['chatgpt', 'claude', 'perplexity']);
  const DEFAULT_SEND_TO_TARGET = 'chatgpt';
  const DEFAULT_SEND_TO_MAX_URL_LENGTH = 3600;

  function countPromptPlaceholders(value) {
    const matches = String(value || '').match(/\{prompt\}/g);
    return matches ? matches.length : 0;
  }

  function validateSendToUrlTemplate(value) {
    const normalizedValue = String(value || '').trim();
    if (!normalizedValue) {
      return { valid: false, normalizedValue: '', error: 'URL template is required' };
    }

    if (countPromptPlaceholders(normalizedValue) !== 1) {
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

  function normalizeCustomSendToTarget(target, index) {
    if (!isPlainObject(target)) {
      return null;
    }

    const name = String(target.name || '').trim();
    const urlTemplateValue = target.urlTemplate ?? target.url;
    const validation = validateSendToUrlTemplate(urlTemplateValue);
    if (!name || !validation.valid) {
      return null;
    }

    const rawId = String(target.id || '').trim();
    return {
      id: rawId || `custom-target-${index + 1}`,
      name,
      urlTemplate: validation.normalizedValue
    };
  }

  function normalizeCustomSendToTargets(targets) {
    if (!Array.isArray(targets)) {
      return [];
    }

    const seenIds = new Set();
    return targets.reduce((normalizedTargets, target, index) => {
      const normalizedTarget = normalizeCustomSendToTarget(target, index);
      if (!normalizedTarget) {
        return normalizedTargets;
      }

      if (seenIds.has(normalizedTarget.id)) {
        return normalizedTargets;
      }

      seenIds.add(normalizedTarget.id);
      normalizedTargets.push(normalizedTarget);
      return normalizedTargets;
    }, []);
  }

  function normalizePopupPrimaryAction(value, fallbackValue = 'markdown') {
    const normalizedValue = String(value || '').trim();
    return POPUP_PRIMARY_ACTIONS.has(normalizedValue) ? normalizedValue : fallbackValue;
  }

  function normalizeDefaultSendToTarget(targetValue, customTargets = [], fallbackValue = DEFAULT_SEND_TO_TARGET) {
    const normalizedTargetValue = String(targetValue || '').trim();
    if (BUILTIN_SEND_TO_TARGETS.has(normalizedTargetValue)) {
      return normalizedTargetValue;
    }

    const hasMatchingCustomTarget = customTargets.some((target) => target.id === normalizedTargetValue);
    return hasMatchingCustomTarget ? normalizedTargetValue : fallbackValue;
  }

  function normalizeSendToMaxUrlLength(value, fallbackValue = DEFAULT_SEND_TO_MAX_URL_LENGTH) {
    const normalizedFallback = Number.isFinite(Number(fallbackValue)) && Number(fallbackValue) > 0
      ? Math.floor(Number(fallbackValue))
      : DEFAULT_SEND_TO_MAX_URL_LENGTH;
    const parsedValue = Number.parseInt(String(value ?? '').trim(), 10);
    return Number.isFinite(parsedValue) && parsedValue > 0
      ? parsedValue
      : normalizedFallback;
  }

  function deepClone(value) {
    if (Array.isArray(value)) {
      return value.map((item) => deepClone(item));
    }
    if (!isPlainObject(value)) {
      return value;
    }
    const clone = {};
    Object.keys(value).forEach((key) => {
      clone[key] = deepClone(value[key]);
    });
    return clone;
  }

  function getContextMenuTransition(previousOptions = {}, nextOptions = {}) {
    const previousEnabled = Boolean(previousOptions.contextMenus);
    const nextEnabled = Boolean(nextOptions.contextMenus);

    if (previousEnabled === nextEnabled) {
      return 'none';
    }
    return nextEnabled ? 'create' : 'remove';
  }

  function normalizeImportedOptions(importedOptions = {}, defaultOptions = {}) {
    const safeImported = isPlainObject(importedOptions) ? importedOptions : {};
    const safeDefaults = isPlainObject(defaultOptions) ? defaultOptions : {};
    const siteRulesApi = getSiteRulesApi();

    const normalized = {
      ...deepClone(safeDefaults),
      ...deepClone(safeImported)
    };

    const defaultTableFormatting = isPlainObject(safeDefaults.tableFormatting)
      ? deepClone(safeDefaults.tableFormatting)
      : {};
    const importedTableFormatting = isPlainObject(safeImported.tableFormatting)
      ? deepClone(safeImported.tableFormatting)
      : {};

    normalized.tableFormatting = {
      ...defaultTableFormatting,
      ...importedTableFormatting
    };

    if (siteRulesApi?.normalizeSiteRules) {
      normalized.siteRules = siteRulesApi.normalizeSiteRules(normalized.siteRules);
    } else if (!Array.isArray(normalized.siteRules)) {
      normalized.siteRules = [];
    }

    normalized.defaultExportType = normalizePopupPrimaryAction(
      normalized.defaultExportType,
      normalizePopupPrimaryAction(safeDefaults.defaultExportType, 'markdown')
    );

    normalized.sendToCustomTargets = normalizeCustomSendToTargets(normalized.sendToCustomTargets);
    normalized.defaultSendToTarget = normalizeDefaultSendToTarget(
      normalized.defaultSendToTarget,
      normalized.sendToCustomTargets,
      normalizeDefaultSendToTarget(safeDefaults.defaultSendToTarget, normalizeCustomSendToTargets(safeDefaults.sendToCustomTargets))
    );
    normalized.sendToMaxUrlLength = normalizeSendToMaxUrlLength(
      normalized.sendToMaxUrlLength,
      normalizeSendToMaxUrlLength(safeDefaults.sendToMaxUrlLength)
    );

    return normalized;
  }

  function buildExportFilename(date = new Date(), prefix = 'MarkSnip-export') {
    const safeDate = date instanceof Date ? date : new Date(date);
    const timestamp = Number.isNaN(safeDate.getTime()) ? new Date() : safeDate;
    const year = timestamp.getFullYear();
    const month = String(timestamp.getMonth() + 1).padStart(2, '0');
    const day = String(timestamp.getDate()).padStart(2, '0');
    return `${prefix}-${year}-${month}-${day}.json`;
  }

  function resetOptionKeys(currentOptions = {}, defaultOptions = {}, keys = []) {
    const safeDefaults = isPlainObject(defaultOptions) ? defaultOptions : {};
    const normalizedCurrent = normalizeImportedOptions(currentOptions, safeDefaults);
    const nextOptions = deepClone(normalizedCurrent);
    const keyList = Array.isArray(keys) ? keys : String(keys || '').split(',');

    keyList.forEach((rawKey) => {
      const key = String(rawKey || '').trim();
      if (!key) {
        return;
      }

      if (key === 'tableFormatting') {
        nextOptions.tableFormatting = isPlainObject(safeDefaults.tableFormatting)
          ? deepClone(safeDefaults.tableFormatting)
          : {};
        return;
      }

      if (key.startsWith('tableFormatting.')) {
        const tableOption = key.split('.')[1];
        if (!tableOption) {
          return;
        }
        const defaultTableFormatting = isPlainObject(safeDefaults.tableFormatting)
          ? safeDefaults.tableFormatting
          : {};
        if (Object.prototype.hasOwnProperty.call(defaultTableFormatting, tableOption)) {
          nextOptions.tableFormatting[tableOption] = deepClone(defaultTableFormatting[tableOption]);
        } else {
          delete nextOptions.tableFormatting[tableOption];
        }
        return;
      }

      nextOptions[key] = deepClone(safeDefaults[key]);
    });

    const normalizedNext = normalizeImportedOptions(nextOptions, safeDefaults);
    return {
      options: normalizedNext,
      contextMenuAction: getContextMenuTransition(normalizedCurrent, normalizedNext)
    };
  }

  function resetAllOptions(currentOptions = {}, defaultOptions = {}) {
    const safeDefaults = isPlainObject(defaultOptions) ? defaultOptions : {};
    const normalizedCurrent = normalizeImportedOptions(currentOptions, safeDefaults);
    const normalizedDefaults = normalizeImportedOptions({}, safeDefaults);

    return {
      options: normalizedDefaults,
      contextMenuAction: getContextMenuTransition(normalizedCurrent, normalizedDefaults)
    };
  }

  const api = {
    buildExportFilename,
    normalizeImportedOptions,
    getContextMenuTransition,
    resetOptionKeys,
    resetAllOptions,
    validateSendToUrlTemplate,
    normalizeCustomSendToTargets,
    normalizeDefaultSendToTarget,
    normalizeSendToMaxUrlLength
  };

  root.markSnipOptionsState = api;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
})(typeof globalThis !== 'undefined' ? globalThis : this);
