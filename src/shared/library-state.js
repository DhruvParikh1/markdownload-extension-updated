(function (root) {
  const STORAGE_KEYS = Object.freeze({
    SETTINGS: 'librarySettings',
    ITEMS: 'libraryItems'
  });

  const DEFAULT_LIBRARY_SETTINGS = Object.freeze({
    enabled: true,
    autoSaveOnPopupOpen: true,
    itemsToKeep: 10
  });

  function deepClone(value) {
    if (Array.isArray(value)) {
      return value.map((item) => deepClone(item));
    }
    if (!value || typeof value !== 'object') {
      return value;
    }

    const next = {};
    Object.keys(value).forEach((key) => {
      next[key] = deepClone(value[key]);
    });
    return next;
  }

  function sanitizeItemsToKeep(value, fallback = DEFAULT_LIBRARY_SETTINGS.itemsToKeep) {
    const parsed = Number.parseInt(String(value ?? '').trim(), 10);
    if (!Number.isFinite(parsed) || parsed < 1) {
      return fallback;
    }
    return parsed;
  }

  function normalizeLibrarySettings(settings = {}) {
    const merged = {
      ...deepClone(DEFAULT_LIBRARY_SETTINGS),
      ...(settings && typeof settings === 'object' ? deepClone(settings) : {})
    };

    return {
      enabled: merged.enabled !== false,
      autoSaveOnPopupOpen: merged.autoSaveOnPopupOpen !== false,
      itemsToKeep: sanitizeItemsToKeep(merged.itemsToKeep)
    };
  }

  function normalizePageUrl(url) {
    if (!url || typeof url !== 'string') {
      return '';
    }

    try {
      const parsed = new URL(url);
      parsed.hash = '';
      return parsed.href;
    } catch (error) {
      return String(url).trim();
    }
  }

  function stripMarkdown(markdown = '') {
    return String(markdown || '')
      .replace(/```[\s\S]*?```/g, ' ')
      .replace(/`([^`]+)`/g, '$1')
      .replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '$1')
      .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '$1')
      .replace(/^>\s?/gm, '')
      .replace(/^#{1,6}\s+/gm, '')
      .replace(/[*_~]+/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function buildPreviewText(markdown = '', maxLength = 180) {
    const plainText = stripMarkdown(markdown);
    if (!plainText) {
      return '';
    }
    if (plainText.length <= maxLength) {
      return plainText;
    }

    return plainText.slice(0, Math.max(0, maxLength - 1)).trimEnd() + '…';
  }

  function trimLibraryItems(items = [], itemsToKeep = DEFAULT_LIBRARY_SETTINGS.itemsToKeep) {
    const maxItems = sanitizeItemsToKeep(itemsToKeep);
    return (Array.isArray(items) ? items : []).slice(0, maxItems).map((item) => deepClone(item));
  }

  function createLibraryItem(snapshot = {}, savedAt = new Date().toISOString()) {
    const pageUrl = String(snapshot.pageUrl || '').trim();
    const normalizedPageUrl = normalizePageUrl(pageUrl);
    const title = String(snapshot.title || '').trim() || 'Untitled';
    const markdown = String(snapshot.markdown || '');
    const timestamp = savedAt || new Date().toISOString();

    return {
      id: snapshot.id || `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
      pageUrl,
      normalizedPageUrl,
      title,
      markdown,
      savedAt: timestamp,
      previewText: buildPreviewText(markdown)
    };
  }

  function upsertLibraryItem(items = [], nextItem, itemsToKeep = DEFAULT_LIBRARY_SETTINGS.itemsToKeep) {
    const preparedItem = createLibraryItem(nextItem, nextItem?.savedAt);
    const normalizedUrl = preparedItem.normalizedPageUrl;
    const existingItems = Array.isArray(items) ? items : [];
    const dedupedItems = existingItems.filter((item) => {
      if (!normalizedUrl) {
        return item?.id !== preparedItem.id;
      }
      return normalizePageUrl(item?.normalizedPageUrl || item?.pageUrl || '') !== normalizedUrl;
    });

    return trimLibraryItems([preparedItem, ...dedupedItems], itemsToKeep);
  }

  async function loadLibrarySettings(storage = root.browser?.storage?.local) {
    if (!storage?.get) {
      return normalizeLibrarySettings();
    }

    const stored = await storage.get(STORAGE_KEYS.SETTINGS);
    return normalizeLibrarySettings(stored?.[STORAGE_KEYS.SETTINGS]);
  }

  async function saveLibrarySettings(settings, storage = root.browser?.storage?.local) {
    const normalized = normalizeLibrarySettings(settings);
    if (storage?.set) {
      await storage.set({ [STORAGE_KEYS.SETTINGS]: normalized });
    }
    return normalized;
  }

  async function resetLibrarySettings(storage = root.browser?.storage?.local) {
    return await saveLibrarySettings(DEFAULT_LIBRARY_SETTINGS, storage);
  }

  async function loadLibraryItems(storage = root.browser?.storage?.local) {
    if (!storage?.get) {
      return [];
    }

    const stored = await storage.get(STORAGE_KEYS.ITEMS);
    return Array.isArray(stored?.[STORAGE_KEYS.ITEMS])
      ? stored[STORAGE_KEYS.ITEMS].map((item) => deepClone(item))
      : [];
  }

  async function saveLibraryItems(items, storage = root.browser?.storage?.local) {
    const normalizedItems = Array.isArray(items)
      ? items.map((item) => deepClone(item))
      : [];

    if (storage?.set) {
      await storage.set({ [STORAGE_KEYS.ITEMS]: normalizedItems });
    }
    return normalizedItems;
  }

  async function clearLibraryItems(storage = root.browser?.storage?.local) {
    if (storage?.remove) {
      await storage.remove(STORAGE_KEYS.ITEMS);
    }
    return [];
  }

  async function trimStoredLibraryItems(itemsToKeep, storage = root.browser?.storage?.local) {
    const currentItems = await loadLibraryItems(storage);
    const trimmedItems = trimLibraryItems(currentItems, itemsToKeep);
    return await saveLibraryItems(trimmedItems, storage);
  }

  const api = {
    STORAGE_KEYS,
    DEFAULT_LIBRARY_SETTINGS,
    sanitizeItemsToKeep,
    normalizeLibrarySettings,
    normalizePageUrl,
    buildPreviewText,
    createLibraryItem,
    upsertLibraryItem,
    trimLibraryItems,
    loadLibrarySettings,
    saveLibrarySettings,
    resetLibrarySettings,
    loadLibraryItems,
    saveLibraryItems,
    clearLibraryItems,
    trimStoredLibraryItems
  };

  root.markSnipLibraryState = api;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
})(typeof globalThis !== 'undefined' ? globalThis : this);
