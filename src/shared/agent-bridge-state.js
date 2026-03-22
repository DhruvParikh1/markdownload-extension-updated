(function (root) {
  const STORAGE_KEYS = Object.freeze({
    SETTINGS: 'agentBridgeSettings',
    STATUS: 'agentBridgeStatus',
    LATEST_CLIP: 'bridgeLatestClip'
  });

  const DEFAULT_SETTINGS = Object.freeze({
    enabled: false
  });

  const DEFAULT_STATUS = Object.freeze({
    enabled: false,
    permissionGranted: false,
    connecting: false,
    connected: false,
    hostInstalled: false,
    browser: '',
    hostVersion: '',
    lastError: '',
    updatedAt: ''
  });

  const DEFAULT_LATEST_CLIP = Object.freeze({
    title: '',
    markdown: '',
    pageUrl: '',
    normalizedPageUrl: '',
    updatedAt: '',
    source: 'popup'
  });

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

  function normalizeSettings(settings = {}) {
    return {
      enabled: settings?.enabled === true
    };
  }

  function normalizeStatus(status = {}) {
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

  function normalizeLatestClip(snapshot = {}) {
    const pageUrl = String(snapshot?.pageUrl || '').trim();
    const normalizedPageUrl = normalizePageUrl(snapshot?.normalizedPageUrl || pageUrl);
    const source = snapshot?.source === 'popup' ? 'popup' : 'popup';

    return {
      title: String(snapshot?.title || '').trim(),
      markdown: String(snapshot?.markdown || ''),
      pageUrl,
      normalizedPageUrl,
      updatedAt: typeof snapshot?.updatedAt === 'string' && snapshot.updatedAt.trim()
        ? snapshot.updatedAt.trim()
        : new Date().toISOString(),
      source
    };
  }

  function hasUsableLatestClip(snapshot) {
    const clip = normalizeLatestClip(snapshot);
    return Boolean(clip.normalizedPageUrl && clip.markdown.trim());
  }

  function shouldUseLatestClipForPage(snapshot, pageUrl) {
    if (!hasUsableLatestClip(snapshot)) {
      return false;
    }

    const clip = normalizeLatestClip(snapshot);
    return clip.normalizedPageUrl === normalizePageUrl(pageUrl);
  }

  async function loadSettings(storage = root.browser?.storage?.local) {
    if (!storage?.get) {
      return normalizeSettings();
    }

    const stored = await storage.get(STORAGE_KEYS.SETTINGS);
    return normalizeSettings(stored?.[STORAGE_KEYS.SETTINGS]);
  }

  async function saveSettings(settings, storage = root.browser?.storage?.local) {
    const normalized = normalizeSettings(settings);
    if (storage?.set) {
      await storage.set({ [STORAGE_KEYS.SETTINGS]: normalized });
    }
    return normalized;
  }

  async function loadStatus(storage = root.browser?.storage?.local) {
    if (!storage?.get) {
      return normalizeStatus();
    }

    const stored = await storage.get(STORAGE_KEYS.STATUS);
    return normalizeStatus(stored?.[STORAGE_KEYS.STATUS]);
  }

  async function saveStatus(status, storage = root.browser?.storage?.local) {
    const normalized = normalizeStatus(status);
    if (storage?.set) {
      await storage.set({ [STORAGE_KEYS.STATUS]: normalized });
    }
    return normalized;
  }

  async function loadLatestClip(storage = root.browser?.storage?.local) {
    if (!storage?.get) {
      return normalizeLatestClip(DEFAULT_LATEST_CLIP);
    }

    const stored = await storage.get(STORAGE_KEYS.LATEST_CLIP);
    return normalizeLatestClip(stored?.[STORAGE_KEYS.LATEST_CLIP]);
  }

  async function saveLatestClip(snapshot, storage = root.browser?.storage?.local) {
    const normalized = normalizeLatestClip(snapshot);
    if (storage?.set) {
      await storage.set({ [STORAGE_KEYS.LATEST_CLIP]: normalized });
    }
    return normalized;
  }

  async function clearLatestClip(storage = root.browser?.storage?.local) {
    if (storage?.remove) {
      await storage.remove(STORAGE_KEYS.LATEST_CLIP);
    }
    return normalizeLatestClip(DEFAULT_LATEST_CLIP);
  }

  const api = {
    STORAGE_KEYS,
    DEFAULT_SETTINGS,
    DEFAULT_STATUS,
    DEFAULT_LATEST_CLIP,
    normalizePageUrl,
    normalizeSettings,
    normalizeStatus,
    normalizeLatestClip,
    hasUsableLatestClip,
    shouldUseLatestClipForPage,
    loadSettings,
    saveSettings,
    loadStatus,
    saveStatus,
    loadLatestClip,
    saveLatestClip,
    clearLatestClip
  };

  root.markSnipAgentBridgeState = api;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
})(typeof globalThis !== 'undefined' ? globalThis : this);
