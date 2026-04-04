(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
    return;
  }

  root.markSnipI18n = factory();
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  const SUPPORTED_UI_LOCALES = Object.freeze(['en', 'hi']);
  const DEFAULT_UI_LOCALE = 'en';
  const DEFAULT_UI_LANGUAGE = 'browser';
  const localeCache = new Map();
  const state = {
    setting: DEFAULT_UI_LANGUAGE,
    locale: DEFAULT_UI_LOCALE,
    messages: {},
    defaultMessages: {},
    initialized: false
  };

  function isPlainObject(value) {
    return Object.prototype.toString.call(value) === '[object Object]';
  }

  function normalizeUiLanguage(value, fallbackValue = DEFAULT_UI_LANGUAGE) {
    const normalizedValue = String(value || '').trim();
    return normalizedValue === 'browser' || SUPPORTED_UI_LOCALES.includes(normalizedValue)
      ? normalizedValue
      : fallbackValue;
  }

  function normalizeLocale(value, fallbackValue = DEFAULT_UI_LOCALE) {
    const normalizedValue = String(value || '').trim().toLowerCase().replace(/_/g, '-');
    if (normalizedValue === 'hi' || normalizedValue.startsWith('hi-')) {
      return 'hi';
    }
    if (normalizedValue === 'en' || normalizedValue.startsWith('en-')) {
      return 'en';
    }
    return fallbackValue;
  }

  function resolveUiLocale(setting, browserLocale) {
    const normalizedSetting = normalizeUiLanguage(setting, DEFAULT_UI_LANGUAGE);
    if (normalizedSetting !== 'browser') {
      return normalizedSetting;
    }
    return normalizeLocale(browserLocale, DEFAULT_UI_LOCALE);
  }

  function getBrowserLocale() {
    try {
      if (typeof browser !== 'undefined' && typeof browser?.i18n?.getUILanguage === 'function') {
        return browser.i18n.getUILanguage();
      }
    } catch {}

    if (typeof navigator !== 'undefined' && typeof navigator.language === 'string') {
      return navigator.language;
    }

    return DEFAULT_UI_LOCALE;
  }

  function getRuntimeUrl(relativePath) {
    if (typeof browser !== 'undefined' && typeof browser?.runtime?.getURL === 'function') {
      return browser.runtime.getURL(relativePath);
    }
    if (typeof chrome !== 'undefined' && typeof chrome?.runtime?.getURL === 'function') {
      return chrome.runtime.getURL(relativePath);
    }
    return relativePath;
  }

  async function readLocaleFile(locale) {
    const normalizedLocale = normalizeLocale(locale, DEFAULT_UI_LOCALE);
    if (localeCache.has(normalizedLocale)) {
      return localeCache.get(normalizedLocale);
    }

    let loaderPromise;

    if (typeof fetch === 'function') {
      const url = getRuntimeUrl(`_locales/${normalizedLocale}/messages.json`);
      loaderPromise = fetch(url)
        .then(async (response) => {
          if (!response.ok) {
            throw new Error(`Unexpected status ${response.status}`);
          }
          return await response.json();
        })
        .catch(() => ({}));
    } else if (typeof require === 'function') {
      loaderPromise = Promise.resolve().then(() => {
        try {
          const fs = require('fs');
          const path = require('path');
          const filePath = path.resolve(__dirname, '..', '_locales', normalizedLocale, 'messages.json');
          return JSON.parse(fs.readFileSync(filePath, 'utf8'));
        } catch {
          return {};
        }
      });
    } else {
      loaderPromise = Promise.resolve({});
    }

    localeCache.set(normalizedLocale, loaderPromise);
    return loaderPromise;
  }

  async function loadMessages(locale) {
    return await readLocaleFile(locale);
  }

  async function init(options = {}) {
    const setting = normalizeUiLanguage(options.setting, DEFAULT_UI_LANGUAGE);
    const locale = resolveUiLocale(setting, options.browserLocale || getBrowserLocale());
    const [messages, defaultMessages] = await Promise.all([
      loadMessages(locale),
      loadMessages(DEFAULT_UI_LOCALE)
    ]);

    state.setting = setting;
    state.locale = locale;
    state.messages = isPlainObject(messages) ? messages : {};
    state.defaultMessages = isPlainObject(defaultMessages) ? defaultMessages : {};
    state.initialized = true;
    return api;
  }

  function getEntry(key) {
    return state.messages[key] || state.defaultMessages[key] || null;
  }

  function hasMessage(key) {
    const entry = getEntry(key);
    return Boolean(entry && typeof entry.message === 'string');
  }

  function resolvePlaceholderValue(name, placeholderConfig, substitutions) {
    const normalizedName = String(name || '').trim();
    const placeholderContent = String(placeholderConfig?.content || '').trim();
    const positionalMatch = placeholderContent.match(/^\$(\d+)$/);

    if (Array.isArray(substitutions) && positionalMatch) {
      const index = Number.parseInt(positionalMatch[1], 10) - 1;
      return substitutions[index];
    }

    if (isPlainObject(substitutions)) {
      if (Object.prototype.hasOwnProperty.call(substitutions, normalizedName)) {
        return substitutions[normalizedName];
      }
      const lowerName = normalizedName.toLowerCase();
      if (Object.prototype.hasOwnProperty.call(substitutions, lowerName)) {
        return substitutions[lowerName];
      }
      if (positionalMatch && Object.prototype.hasOwnProperty.call(substitutions, positionalMatch[1])) {
        return substitutions[positionalMatch[1]];
      }
    }

    if (Array.isArray(substitutions)) {
      const directIndex = Number.parseInt(normalizedName, 10) - 1;
      if (Number.isInteger(directIndex) && directIndex >= 0) {
        return substitutions[directIndex];
      }
    }

    return '';
  }

  function formatTemplate(template, entry, substitutions) {
    let output = String(template || '');
    const placeholders = isPlainObject(entry?.placeholders) ? entry.placeholders : {};

    Object.keys(placeholders).forEach((name) => {
      const value = resolvePlaceholderValue(name, placeholders[name], substitutions);
      output = output.replace(new RegExp(`\\$${name}\\$`, 'gi'), String(value ?? ''));
    });

    if (Array.isArray(substitutions)) {
      substitutions.forEach((value, index) => {
        output = output.replace(new RegExp(`\\$${index + 1}\\$`, 'g'), String(value ?? ''));
      });
    } else if (isPlainObject(substitutions)) {
      Object.keys(substitutions).forEach((name) => {
        output = output.replace(new RegExp(`\\$${name}\\$`, 'gi'), String(substitutions[name] ?? ''));
      });
    }

    return output;
  }

  function t(key, substitutions) {
    const entry = getEntry(key);
    if (!entry || typeof entry.message !== 'string') {
      return key;
    }
    return formatTemplate(entry.message, entry, substitutions);
  }

  function tp(keyBase, count, substitutions = {}) {
    const pluralRules = new Intl.PluralRules(state.locale || DEFAULT_UI_LOCALE);
    const category = pluralRules.select(Number(count) || 0);
    const pluralSubstitutions = isPlainObject(substitutions)
      ? { ...substitutions, count }
      : [count];

    for (const key of [`${keyBase}_${category}`, `${keyBase}_other`]) {
      if (hasMessage(key)) {
        return t(key, pluralSubstitutions);
      }
    }

    return String(count);
  }

  function getNodes(rootNode, selector) {
    const rootElement = rootNode?.nodeType === 1 || rootNode?.nodeType === 9
      ? rootNode
      : document;
    const nodes = Array.from(rootElement.querySelectorAll(selector));
    if (rootElement.matches?.(selector)) {
      nodes.unshift(rootElement);
    }
    return nodes;
  }

  function applyI18n(rootNode = document) {
    getNodes(rootNode, '[data-i18n]').forEach((element) => {
      element.textContent = t(element.getAttribute('data-i18n'));
    });

    getNodes(rootNode, '[data-i18n-html]').forEach((element) => {
      element.innerHTML = t(element.getAttribute('data-i18n-html'));
    });

    getNodes(rootNode, '[data-i18n-placeholder]').forEach((element) => {
      element.setAttribute('placeholder', t(element.getAttribute('data-i18n-placeholder')));
    });

    getNodes(rootNode, '[data-i18n-title]').forEach((element) => {
      element.setAttribute('title', t(element.getAttribute('data-i18n-title')));
    });

    getNodes(rootNode, '[data-i18n-aria-label]').forEach((element) => {
      element.setAttribute('aria-label', t(element.getAttribute('data-i18n-aria-label')));
    });

    return rootNode;
  }

  function applyDefinitions(definitions = [], rootNode = document) {
    const rootElement = rootNode?.nodeType === 1 || rootNode?.nodeType === 9
      ? rootNode
      : document;

    definitions.forEach((definition) => {
      const elements = definition.selector
        ? Array.from(rootElement.querySelectorAll(definition.selector))
        : definition.element
          ? [definition.element]
          : [];

      elements.forEach((element) => {
        if (!element) {
          return;
        }

        if (definition.textKey) {
          element.textContent = t(definition.textKey, definition.substitutions);
        }
        if (definition.htmlKey) {
          element.innerHTML = t(definition.htmlKey, definition.substitutions);
        }
        if (definition.titleKey) {
          element.setAttribute('title', t(definition.titleKey, definition.substitutions));
        }
        if (definition.ariaLabelKey) {
          element.setAttribute('aria-label', t(definition.ariaLabelKey, definition.substitutions));
        }
        if (definition.placeholderKey) {
          element.setAttribute('placeholder', t(definition.placeholderKey, definition.substitutions));
        }
        if (definition.datasetKeys && isPlainObject(definition.datasetKeys)) {
          Object.entries(definition.datasetKeys).forEach(([datasetKey, messageKey]) => {
            element.dataset[datasetKey] = t(messageKey, definition.substitutions);
          });
        }
      });
    });

    return rootElement;
  }

  function setDocumentLanguage(documentElement) {
    if (documentElement?.setAttribute) {
      documentElement.setAttribute('lang', state.locale || DEFAULT_UI_LOCALE);
    }
  }

  function getLocale() {
    return state.locale || DEFAULT_UI_LOCALE;
  }

  function getSetting() {
    return state.setting || DEFAULT_UI_LANGUAGE;
  }

  function isInitialized() {
    return state.initialized;
  }

  const api = {
    SUPPORTED_UI_LOCALES,
    DEFAULT_UI_LOCALE,
    DEFAULT_UI_LANGUAGE,
    normalizeLocale,
    normalizeUiLanguage,
    resolveUiLocale,
    getBrowserLocale,
    loadMessages,
    init,
    t,
    tp,
    hasMessage,
    applyI18n,
    applyDefinitions,
    setDocumentLanguage,
    getLocale,
    getSetting,
    isInitialized
  };

  return api;
});
