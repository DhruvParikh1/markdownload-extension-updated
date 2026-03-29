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
    resetAllOptions
  };

  root.markSnipOptionsState = api;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
})(typeof globalThis !== 'undefined' ? globalThis : this);
