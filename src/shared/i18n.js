(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory(root);
    return;
  }

  root.markSnipI18n = factory(root);
})(typeof globalThis !== 'undefined' ? globalThis : this, function (root) {
  const MESSAGE_TOKEN_RE = /\$([A-Z0-9_]+)\$/g;
  const ATTRIBUTES = ['title', 'aria-label', 'placeholder', 'alt', 'data-guide-section', 'data-guide-summary', 'data-section-label'];
  const ELEMENT_TEXT_TAGS = new Set([
    'CAPTION', 'DD', 'DIV', 'DT', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6',
    'LI', 'P', 'SPAN', 'TD', 'TH'
  ]);
  const INLINE_TEXT_TAGS = new Set(['CODE', 'EM', 'KBD', 'SPAN', 'STRONG']);
  const SKIP_TAGS = new Set(['SCRIPT', 'STYLE', 'SVG', 'PATH', 'TEXTAREA']);
  const INTERACTIVE_SELECTOR = 'a,button,input,select,textarea,[role="button"],[role="menuitem"]';
  const ELEMENT_NODE = root.Node?.ELEMENT_NODE || 1;

  let englishMessagesPromise = null;
  let englishMessages = null;
  let exactMessageMap = null;
  let observer = null;
  let overrideLocale = null;
  let overrideMessages = null;
  let overridePreferencePromise = null;

  function getRuntime() {
    if (root.browser?.runtime) {
      return root.browser.runtime;
    }
    if (root.chrome?.runtime) {
      return root.chrome.runtime;
    }
    return null;
  }

  function getI18nApi() {
    if (root.chrome?.i18n?.getMessage) {
      return root.chrome.i18n;
    }
    if (root.browser?.i18n?.getMessage) {
      return root.browser.i18n;
    }
    return null;
  }

  function getMessageUrl(locale = 'en') {
    const runtime = getRuntime();
    const path = `_locales/${locale}/messages.json`;
    return runtime?.getURL ? runtime.getURL(path) : `../${path}`;
  }

  async function loadEnglishMessages() {
    if (englishMessages) {
      return englishMessages;
    }
    if (!englishMessagesPromise) {
      englishMessagesPromise = fetch(getMessageUrl('en'))
        .then((response) => {
          if (!response.ok) {
            throw new Error(`Unable to load English locale (${response.status})`);
          }
          return response.json();
        })
        .then((messages) => {
          englishMessages = messages || {};
          exactMessageMap = buildExactMessageMap(englishMessages);
          return englishMessages;
        })
        .catch(() => {
          englishMessages = {};
          exactMessageMap = new Map();
          return englishMessages;
        });
    }
    return englishMessagesPromise;
  }

  function buildExactMessageMap(messages) {
    const map = new Map();
    Object.entries(messages || {}).forEach(([key, entry]) => {
      const message = typeof entry?.message === 'string' ? entry.message.trim() : '';
      if (!message || MESSAGE_TOKEN_RE.test(message)) {
        MESSAGE_TOKEN_RE.lastIndex = 0;
        return;
      }
      MESSAGE_TOKEN_RE.lastIndex = 0;
      if (!map.has(message)) {
        map.set(message, []);
      }
      map.get(message).push(key);
    });
    return map;
  }

  function getStorage() {
    if (root.browser?.storage?.sync) {
      return {
        api: root.browser.storage.sync,
        usesPromises: true
      };
    }
    if (root.chrome?.storage?.sync) {
      return {
        api: root.chrome.storage.sync,
        usesPromises: false
      };
    }
    return null;
  }

  function getStorageValue(storage, defaults) {
    if (storage.usesPromises) {
      return storage.api.get(defaults);
    }

    return new Promise((resolve, reject) => {
      storage.api.get(defaults, (data) => {
        const err = root.chrome?.runtime?.lastError;
        if (err) {
          reject(err);
        } else {
          resolve(data);
        }
      });
    });
  }

  async function loadLocaleMessages(localeId) {
    if (!localeId || localeId === 'auto') {
      overrideLocale = null;
      overrideMessages = null;
      return null;
    }
    try {
      const response = await fetch(getMessageUrl(localeId));
      if (!response.ok) {
        throw new Error(`Unable to load locale ${localeId} (${response.status})`);
      }
      const messages = await response.json();
      overrideLocale = localeId;
      overrideMessages = messages || {};
      return overrideMessages;
    } catch (_error) {
      overrideLocale = null;
      overrideMessages = null;
      return null;
    }
  }

  async function loadOverridePreference() {
    const storage = getStorage();
    if (!storage) {
      return;
    }
    try {
      const result = await getStorageValue(storage, { uiLanguage: 'auto' });
      await loadLocaleMessages(result?.uiLanguage || 'auto');
    } catch (_error) {}
  }

  function ensureOverridePreference() {
    if (!overridePreferencePromise) {
      overridePreferencePromise = loadOverridePreference();
    }
    return overridePreferencePromise;
  }

  async function setUiLanguage(localeId) {
    overridePreferencePromise = (async () => {
      await loadEnglishMessages();
      await loadLocaleMessages(localeId);
    })();
    return overridePreferencePromise;
  }

  async function ready() {
    await Promise.all([loadEnglishMessages(), ensureOverridePreference()]);
  }

  function getPlaceholderOrder(key) {
    const placeholders = englishMessages?.[key]?.placeholders;
    if (!placeholders || typeof placeholders !== 'object') {
      return [];
    }

    return Object.entries(placeholders)
      .map(([name, config]) => {
        const slot = String(config?.content || '').match(/^\$(\d+)$/);
        return {
          name,
          index: slot ? Number(slot[1]) : Number.MAX_SAFE_INTEGER
        };
      })
      .sort((left, right) => left.index - right.index)
      .map((entry) => entry.name);
  }

  function normalizeSubstitutions(key, substitutions) {
    if (substitutions == null) {
      return undefined;
    }
    if (Array.isArray(substitutions)) {
      return substitutions.map((value) => String(value));
    }
    if (typeof substitutions !== 'object') {
      return String(substitutions);
    }

    const order = getPlaceholderOrder(key);
    const keys = order.length > 0 ? order : Object.keys(substitutions);
    return keys.map((name) => String(substitutions[name] ?? ''));
  }

  function formatFallback(key, message, substitutions) {
    if (!message) {
      return '';
    }
    const values = Array.isArray(substitutions)
      ? substitutions
      : substitutions == null
        ? []
        : [substitutions];
    const placeholders = englishMessages?.[key]?.placeholders || {};
    const tokenSlots = Object.entries(placeholders).reduce((slots, [name, config]) => {
      const slot = String(config?.content || '').match(/^\$(\d+)$/);
      if (slot) {
        slots[name.toUpperCase()] = Number(slot[1]) - 1;
      }
      return slots;
    }, {});

    return String(message).replace(MESSAGE_TOKEN_RE, (_token, tokenName) => {
      const index = Number(tokenName);
      if (Number.isInteger(index) && index > 0) {
        return values[index - 1] ?? '';
      }
      if (Object.prototype.hasOwnProperty.call(tokenSlots, tokenName)) {
        return values[tokenSlots[tokenName]] ?? '';
      }
      return '';
    });
  }

  function t(key, substitutions, fallback = '') {
    const i18n = getI18nApi();
    const normalizedSubstitutions = normalizeSubstitutions(key, substitutions);
    const valuesArray = Array.isArray(normalizedSubstitutions)
      ? normalizedSubstitutions
      : normalizedSubstitutions == null ? [] : [normalizedSubstitutions];

    const overrideMessage = overrideMessages?.[key]?.message;
    if (overrideMessage) {
      return formatFallback(key, overrideMessage, valuesArray);
    }

    try {
      const localized = i18n?.getMessage(key, normalizedSubstitutions);
      if (localized) {
        return localized;
      }
    } catch (_error) {}

    const fallbackMessage = fallback || englishMessages?.[key]?.message || key;
    return formatFallback(key, fallbackMessage, valuesArray);
  }

  function locale() {
    if (overrideLocale) {
      return overrideLocale;
    }
    try {
      return getI18nApi()?.getMessage('@@ui_locale') || 'en';
    } catch (_error) {
      return 'en';
    }
  }

  function number(value) {
    try {
      return new Intl.NumberFormat(locale().replace(/_/g, '-')).format(value);
    } catch (_error) {
      return new Intl.NumberFormat('en-US').format(value);
    }
  }

  function getExactMessageKey(message) {
    const keys = message && exactMessageMap?.get(message.trim());
    if (!keys?.length) {
      return null;
    }
    if (keys.length === 1) {
      return keys[0];
    }

    const localizedValues = keys.map((key) => t(key));
    const firstValue = localizedValues[0];
    return localizedValues.every((value) => value === firstValue) ? keys[0] : null;
  }

  function replaceElementContent(element, key) {
    const localized = t(key);
    if (!localized || localized === key) {
      return false;
    }

    if (/<[a-z][\s\S]*>/i.test(localized)) {
      if (element.innerHTML === localized) {
        return false;
      }
      element.innerHTML = localized;
    } else {
      if (element.textContent === localized) {
        return false;
      }
      element.textContent = localized;
    }
    return true;
  }

  function selectElements(base, selector) {
    const matches = base.matches?.(selector) ? [base] : [];
    return matches.concat(Array.from(base.querySelectorAll(selector)));
  }

  function localizeExplicit(rootNode) {
    const base = rootNode?.querySelectorAll ? rootNode : root.document;
    if (!base?.querySelectorAll) {
      return;
    }

    selectElements(base, '[data-i18n]').forEach((element) => {
      const key = element.getAttribute('data-i18n');
      if (key) {
        const localized = t(key);
        if (element.textContent !== localized) {
          element.textContent = localized;
        }
      }
    });

    selectElements(base, '[data-i18n-html]').forEach((element) => {
      const key = element.getAttribute('data-i18n-html');
      if (key) {
        const localized = t(key);
        if (element.innerHTML !== localized) {
          element.innerHTML = localized;
        }
      }
    });

    ATTRIBUTES.forEach((attr) => {
      selectElements(base, `[data-i18n-${attr}]`).forEach((element) => {
        const key = element.getAttribute(`data-i18n-${attr}`);
        if (key) {
          const localized = t(key);
          if (element.getAttribute(attr) !== localized) {
            element.setAttribute(attr, localized);
          }
        }
      });
    });
  }

  function localizeAttributeValue(element, attr) {
    const value = element.getAttribute(attr);
    const key = getExactMessageKey(value);
    if (key) {
      const localized = t(key);
      if (value !== localized) {
        element.setAttribute(attr, localized);
      }
    }
  }

  function isSkippable(node) {
    const element = node.nodeType === ELEMENT_NODE ? node : node.parentElement;
    if (!element) {
      return true;
    }
    return Boolean(element.closest('script,style,svg,textarea,pre,code,[data-i18n-skip]'));
  }

  function localizeTextNode(node) {
    if (!node?.nodeValue || isSkippable(node)) {
      return;
    }
    const trimmed = node.nodeValue.trim();
    const key = getExactMessageKey(trimmed);
    if (!key) {
      return;
    }

    const leading = node.nodeValue.match(/^\s*/)?.[0] || '';
    const trailing = node.nodeValue.match(/\s*$/)?.[0] || '';
    const localizedValue = `${leading}${t(key)}${trailing}`;
    if (node.nodeValue !== localizedValue) {
      node.nodeValue = localizedValue;
    }
  }

  function canReplaceWholeElement(element) {
    if (!element || element.closest('[data-i18n-skip]')) {
      return false;
    }
    const tag = (element.tagName || '').toUpperCase();
    if (SKIP_TAGS.has(tag)) {
      return false;
    }
    if (!ELEMENT_TEXT_TAGS.has(tag)) {
      return false;
    }
    if (element.querySelector(INTERACTIVE_SELECTOR)) {
      return false;
    }
    const childElements = Array.from(element.children || []);
    if (childElements.some((child) => !INLINE_TEXT_TAGS.has((child.tagName || '').toUpperCase()))) {
      return false;
    }
    return true;
  }

  function localizeExact(rootNode, options = {}) {
    const base = rootNode?.querySelectorAll ? rootNode : root.document;
    if (!base?.querySelectorAll || !exactMessageMap) {
      return;
    }

    selectElements(base, '*').forEach((element) => {
      ATTRIBUTES.forEach((attr) => localizeAttributeValue(element, attr));

      if (!options.replaceElementContent || !canReplaceWholeElement(element)) {
        return;
      }

      const htmlKey = getExactMessageKey(element.innerHTML);
      if (htmlKey && replaceElementContent(element, htmlKey)) {
        return;
      }

      if (element.childElementCount > 0) {
        return;
      }

      const textKey = getExactMessageKey(element.textContent);
      if (textKey) {
        replaceElementContent(element, textKey);
      }
    });

    const walker = root.document.createTreeWalker(base, root.NodeFilter?.SHOW_TEXT || 4);
    const textNodes = [];
    while (walker.nextNode()) {
      textNodes.push(walker.currentNode);
    }
    textNodes.forEach(localizeTextNode);
  }

  async function localizeDocument(rootNode = root.document, options = {}) {
    if (!rootNode?.querySelectorAll) {
      return;
    }

    await ready();
    localizeExplicit(rootNode);
    localizeExact(rootNode, {
      replaceElementContent: options.replaceElementContent !== false
    });

    if (root.document?.documentElement) {
      root.document.documentElement.lang = locale().replace(/_/g, '-');
    }
  }

  function observeDocument(rootNode = root.document) {
    if (!rootNode?.body || typeof MutationObserver === 'undefined' || observer) {
      return;
    }

    observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        mutation.addedNodes.forEach((node) => {
          if (node.nodeType === ELEMENT_NODE) {
            localizeExplicit(node);
          }
        });
      });
    });

    observer.observe(rootNode.body, {
      childList: true,
      subtree: true
    });
  }

  function autoLocalizeExtensionPage() {
    const protocol = root.location?.protocol;
    if (protocol !== 'chrome-extension:' && protocol !== 'moz-extension:') {
      return;
    }

    const run = () => {
      localizeDocument(root.document).then(() => observeDocument(root.document));
    };

    if (root.document?.readyState === 'loading') {
      root.document.addEventListener('DOMContentLoaded', run, { once: true });
    } else {
      run();
    }
  }

  const api = {
    loadEnglishMessages,
    localizeDocument,
    locale,
    number,
    observeDocument,
    ready,
    setUiLanguage,
    t
  };

  autoLocalizeExtensionPage();

  return api;
});
