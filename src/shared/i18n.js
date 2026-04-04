(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory(root);
    return;
  }

  root.markSnipI18n = factory(root);
})(typeof globalThis !== 'undefined' ? globalThis : this, function (root) {
  const ATTRIBUTE_PREFIX = 'data-i18n-attr-';
  const BROWSER_LOCALE_PREFERENCE = 'browser';
  const LOCALE_STORAGE_KEY = 'uiLanguage';
  const LOCALE_CACHE_KEY = 'marksnip-i18n-state-v1';
  const SUPPORTED_LOCALES = Object.freeze(['en', 'es', 'fr', 'de']);
  const SUPPORTED_LOCALE_SET = new Set(SUPPORTED_LOCALES);
  let fallbackMessages = null;
  let localeCatalogs = null;
  let initializePromise = null;

  if (typeof require === 'function') {
    try {
      localeCatalogs = {
        en: require('../_locales/en/messages.json'),
        es: require('../_locales/es/messages.json'),
        fr: require('../_locales/fr/messages.json'),
        de: require('../_locales/de/messages.json')
      };
      fallbackMessages = localeCatalogs.en;
    } catch {
      localeCatalogs = null;
      fallbackMessages = null;
    }
  }

  function normalizeLocaleTag(locale) {
    return String(locale || '')
      .trim()
      .replace(/_/g, '-')
      .toLowerCase();
  }

  function normalizeSupportedLocale(locale) {
    const normalizedLocale = normalizeLocaleTag(locale);
    if (!normalizedLocale) {
      return 'en';
    }

    if (SUPPORTED_LOCALE_SET.has(normalizedLocale)) {
      return normalizedLocale;
    }

    const baseLocale = normalizedLocale.split('-')[0];
    return SUPPORTED_LOCALE_SET.has(baseLocale) ? baseLocale : 'en';
  }

  function normalizeLocalePreference(locale) {
    const normalizedLocale = normalizeLocaleTag(locale);
    if (!normalizedLocale || normalizedLocale === BROWSER_LOCALE_PREFERENCE || normalizedLocale === 'default' || normalizedLocale === 'system') {
      return BROWSER_LOCALE_PREFERENCE;
    }

    const baseLocale = normalizedLocale.split('-')[0];
    return SUPPORTED_LOCALE_SET.has(baseLocale) ? baseLocale : BROWSER_LOCALE_PREFERENCE;
  }

  function isPlainObject(value) {
    return Object.prototype.toString.call(value) === '[object Object]';
  }

  function getLocalStorage() {
    try {
      return root?.localStorage || null;
    } catch {
      return null;
    }
  }

  function getLocaleCatalogs() {
    if (localeCatalogs) {
      return localeCatalogs;
    }

    if (isPlainObject(root.markSnipLocaleCatalogs)) {
      localeCatalogs = root.markSnipLocaleCatalogs;
      if (!fallbackMessages && localeCatalogs.en) {
        fallbackMessages = localeCatalogs.en;
      }
    }

    return localeCatalogs;
  }

  function readCachedState() {
    const storage = getLocalStorage();
    if (!storage) {
      return {
        preference: BROWSER_LOCALE_PREFERENCE,
        catalog: null
      };
    }

    try {
      const rawValue = storage.getItem(LOCALE_CACHE_KEY);
      if (!rawValue) {
        return {
          preference: BROWSER_LOCALE_PREFERENCE,
          catalog: null
        };
      }

      const parsedValue = JSON.parse(rawValue);
      const preference = normalizeLocalePreference(parsedValue?.preference);
      if (preference === BROWSER_LOCALE_PREFERENCE) {
        return {
          preference,
          catalog: null
        };
      }

      return {
        preference,
        catalog: isPlainObject(parsedValue?.catalog) ? parsedValue.catalog : null
      };
    } catch {
      return {
        preference: BROWSER_LOCALE_PREFERENCE,
        catalog: null
      };
    }
  }

  const cachedState = readCachedState();
  let localePreference = cachedState.preference;
  let overrideCatalog = cachedState.catalog;

  function getBrowserApi() {
    if (typeof browser !== 'undefined' && browser?.i18n) {
      return browser;
    }
    if (typeof chrome !== 'undefined' && chrome?.i18n) {
      return chrome;
    }
    return null;
  }

  function normalizeKey(key) {
    return String(key || '')
      .trim()
      .replace(/[.\-]+/g, '_');
  }

  function normalizeSubstitutions(substitutions) {
    if (substitutions == null) {
      return [];
    }
    return Array.isArray(substitutions) ? substitutions : [substitutions];
  }

  function applySubstitutions(message, substitutions) {
    return normalizeSubstitutions(substitutions).reduce((result, value, index) => {
      return result.replaceAll(`$${index + 1}`, String(value));
    }, String(message || ''));
  }

  function persistCachedState(preference, catalog) {
    const storage = getLocalStorage();
    if (!storage) {
      return;
    }

    try {
      if (preference === BROWSER_LOCALE_PREFERENCE || !catalog) {
        storage.removeItem(LOCALE_CACHE_KEY);
        return;
      }

      storage.setItem(LOCALE_CACHE_KEY, JSON.stringify({
        preference,
        catalog
      }));
    } catch {
      // Ignore cache write failures. The override still applies in-memory.
    }
  }

  function getBrowserUiLocale() {
    const browserApi = getBrowserApi();
    const locale =
      browserApi?.i18n?.getUILanguage?.() ||
      root?.navigator?.language ||
      'en';
    return String(locale || 'en').trim() || 'en';
  }

  function getCatalogMessageFromCatalog(catalog, key, substitutions) {
    const entry = catalog?.[key];
    if (!entry?.message) {
      return '';
    }
    return applySubstitutions(entry.message, substitutions);
  }

  function getFallbackMessage(key, substitutions) {
    return getCatalogMessageFromCatalog(fallbackMessages, key, substitutions);
  }

  function getActiveCatalog() {
    if (localePreference !== BROWSER_LOCALE_PREFERENCE) {
      return overrideCatalog;
    }

    const catalogs = getLocaleCatalogs();
    if (!catalogs) {
      return null;
    }

    return catalogs[normalizeSupportedLocale(getBrowserUiLocale())] || null;
  }

  async function loadLocaleCatalog(locale) {
    const normalizedLocale = normalizeSupportedLocale(locale);
    const catalogs = getLocaleCatalogs();
    if (catalogs?.[normalizedLocale]) {
      return catalogs[normalizedLocale];
    }

    if (normalizedLocale === 'en' && fallbackMessages) {
      return fallbackMessages;
    }

    const browserApi = getBrowserApi();
    const localeUrl = browserApi?.runtime?.getURL?.(`_locales/${normalizedLocale}/messages.json`);
    if (!localeUrl || typeof fetch !== 'function') {
      return normalizedLocale === 'en' ? fallbackMessages : null;
    }

    const response = await fetch(localeUrl);
    if (!response.ok) {
      throw new Error(`Failed to load locale catalog for ${normalizedLocale}: ${response.status}`);
    }

    const catalog = await response.json();
    if (!localeCatalogs) {
      localeCatalogs = {};
    }
    localeCatalogs[normalizedLocale] = catalog;
    if (!fallbackMessages && localeCatalogs.en) {
      fallbackMessages = localeCatalogs.en;
    }
    return catalog;
  }

  async function applyLocalePreference(preference, options = {}) {
    const normalizedPreference = normalizeLocalePreference(preference);

    if (normalizedPreference === BROWSER_LOCALE_PREFERENCE) {
      localePreference = BROWSER_LOCALE_PREFERENCE;
      overrideCatalog = null;
      if (options.persistCache) {
        persistCachedState(localePreference, null);
      }
      return {
        preference: localePreference,
        locale: getUiLocale(),
        changed: true
      };
    }

    const nextCatalog = await loadLocaleCatalog(normalizedPreference);
    localePreference = normalizedPreference;
    overrideCatalog = nextCatalog;
    if (options.persistCache) {
      persistCachedState(localePreference, overrideCatalog);
    }

    return {
      preference: localePreference,
      locale: getUiLocale(),
      changed: true
    };
  }

  async function initialize(options = {}) {
    if (options.force) {
      initializePromise = null;
    }

    if (initializePromise) {
      return initializePromise;
    }

    const startingPreference = localePreference;
    initializePromise = (async () => {
      if (Object.prototype.hasOwnProperty.call(options, 'preference')) {
        const result = await applyLocalePreference(options.preference, {
          persistCache: options.persistCache !== false
        });
        return {
          ...result,
          changed: startingPreference !== localePreference
        };
      }

      const browserApi = getBrowserApi();
      if (!browserApi?.storage?.sync?.get) {
        return {
          preference: localePreference,
          locale: getUiLocale(),
          changed: false
        };
      }

      let storedPreference = localePreference;
      try {
        const storedValues = await browserApi.storage.sync.get({
          [LOCALE_STORAGE_KEY]: BROWSER_LOCALE_PREFERENCE
        });
        storedPreference = normalizeLocalePreference(storedValues?.[LOCALE_STORAGE_KEY]);
      } catch {
        storedPreference = localePreference;
      }

      const result = await applyLocalePreference(storedPreference, {
        persistCache: options.persistCache !== false
      });
      return {
        ...result,
        changed: startingPreference !== localePreference
      };
    })();

    return initializePromise;
  }

  function getLocalePreference() {
    return localePreference;
  }

  function getMessage(key, substitutions) {
    const normalizedKey = normalizeKey(key);
    if (!normalizedKey) {
      return '';
    }

    const activeCatalog = getActiveCatalog();
    const catalogMessage = getCatalogMessageFromCatalog(activeCatalog, normalizedKey, substitutions);
    if (catalogMessage) {
      return catalogMessage;
    }

    const browserApi = getBrowserApi();
    const runtimeMessage =
      localePreference === BROWSER_LOCALE_PREFERENCE
        ? browserApi?.i18n?.getMessage?.(normalizedKey, normalizeSubstitutions(substitutions))
        : '';
    if (typeof runtimeMessage === 'string' && runtimeMessage.length > 0) {
      return runtimeMessage;
    }

    return getFallbackMessage(normalizedKey, substitutions);
  }

  function getUiLocale() {
    return localePreference === BROWSER_LOCALE_PREFERENCE
      ? getBrowserUiLocale()
      : localePreference;
  }

  function formatNumber(value) {
    return new Intl.NumberFormat(getUiLocale()).format(Number(value) || 0);
  }

  function localizeNode(node) {
    if (!node?.getAttributeNames) {
      return;
    }

    const textKey = node.getAttribute('data-i18n');
    if (textKey) {
      const message = getMessage(textKey);
      if (message) {
        node.textContent = message;
      }
    }

    const htmlKey = node.getAttribute('data-i18n-html');
    if (htmlKey) {
      const message = getMessage(htmlKey);
      if (message) {
        node.innerHTML = message;
      }
    }

    node.getAttributeNames().forEach((attributeName) => {
      if (!attributeName.startsWith(ATTRIBUTE_PREFIX)) {
        return;
      }
      const targetAttribute = attributeName.slice(ATTRIBUTE_PREFIX.length);
      const messageKey = node.getAttribute(attributeName);
      if (!targetAttribute || !messageKey) {
        return;
      }
      const message = getMessage(messageKey);
      if (message) {
        node.setAttribute(targetAttribute, message);
      }
    });
  }

  function hasI18nAttributes(node) {
    if (!node?.getAttributeNames) {
      return false;
    }

    const attributeNames = node.getAttributeNames();
    return attributeNames.some((attributeName) => {
      return (
        attributeName === 'data-i18n' ||
        attributeName === 'data-i18n-html' ||
        attributeName.startsWith(ATTRIBUTE_PREFIX)
      );
    });
  }

  function localizeDocument(rootNode = document) {
    if (!rootNode?.querySelectorAll) {
      return rootNode;
    }

    if (rootNode.nodeType === 1 && hasI18nAttributes(rootNode)) {
      localizeNode(rootNode);
    }

    rootNode.querySelectorAll('*').forEach((node) => {
      if (hasI18nAttributes(node)) {
        localizeNode(node);
      }
    });

    return rootNode;
  }

  const api = {
    applyLocalePreference,
    formatNumber,
    getMessage,
    getLocalePreference,
    getUiLocale,
    initialize,
    localizeDocument,
    normalizeKey,
    normalizeLocalePreference,
    supportedLocales: SUPPORTED_LOCALES.slice()
  };

  root.markSnipI18n = api;
  return api;
});
