(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
    return;
  }

  root.markSnipNotifications = factory();
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  const SUPPORT_NOTIFICATION_THRESHOLDS = Object.freeze([25, 100, 500, 1000, 2500, 5000, 10000]);
  const RELEASES_URL = 'https://github.com/DhruvParikh1/markdownload-extension-updated/releases';
  const BUY_ME_A_COFFEE_URL = 'https://buymeacoffee.com/dhruvparikh';
  const STORAGE_DEFAULTS = Object.freeze({
    lastInstalledVersion: null,
    successfulExportsCount: 0,
    successfulDownloadsCount: 0,
    successfulCopiesCount: 0,
    successfulObsidianSendsCount: 0,
    successfulBatchUrlsCount: 0,
    shownSupportThresholds: [],
    shownUpdateVersions: [],
    pendingNotifications: []
  });
  const STORAGE_KEYS = Object.freeze(Object.keys(STORAGE_DEFAULTS));
  const NOTIFICATION_TYPE_PRIORITY = Object.freeze({
    'version-update': 0,
    'support-milestone': 1
  });

  function toNonNegativeInteger(value) {
    const normalized = Number(value);
    if (!Number.isFinite(normalized) || normalized <= 0) {
      return 0;
    }
    return Math.floor(normalized);
  }

  function normalizeTimestamp(value) {
    const normalized = Number(value);
    if (!Number.isFinite(normalized) || normalized <= 0) {
      return null;
    }
    return Math.floor(normalized);
  }

  function normalizeStringArray(value) {
    if (!Array.isArray(value)) {
      return [];
    }

    return value
      .filter((entry) => typeof entry === 'string' && entry.trim().length > 0)
      .map((entry) => entry.trim());
  }

  function normalizeNumericArray(value) {
    if (!Array.isArray(value)) {
      return [];
    }

    return value
      .map(toNonNegativeInteger)
      .filter((entry) => entry > 0);
  }

  function sanitizeAction(action) {
    if (!action || typeof action !== 'object' || typeof action.url !== 'string' || !action.url.trim()) {
      return null;
    }

    return {
      label: typeof action.label === 'string' && action.label.trim()
        ? action.label.trim()
        : 'Open link',
      url: action.url.trim()
    };
  }

  function sanitizeHighlights(highlights) {
    if (!Array.isArray(highlights)) {
      return [];
    }

    return highlights
      .filter((entry) => typeof entry === 'string' && entry.trim().length > 0)
      .map((entry) => entry.trim())
      .slice(0, 5);
  }

  function sanitizeNotification(notification) {
    const createdAt = normalizeTimestamp(notification?.createdAt) || Date.now();

    return {
      id: typeof notification?.id === 'string' && notification.id.trim()
        ? notification.id.trim()
        : `notification:${createdAt}`,
      type: typeof notification?.type === 'string' ? notification.type : 'support-milestone',
      createdAt,
      title: typeof notification?.title === 'string' ? notification.title : '',
      message: typeof notification?.message === 'string' ? notification.message : '',
      previousVersion: typeof notification?.previousVersion === 'string' ? notification.previousVersion : null,
      currentVersion: typeof notification?.currentVersion === 'string' ? notification.currentVersion : null,
      milestone: toNonNegativeInteger(notification?.milestone) || null,
      highlights: sanitizeHighlights(notification?.highlights),
      primaryAction: sanitizeAction(notification?.primaryAction),
      secondaryAction: sanitizeAction(notification?.secondaryAction),
      showCount: toNonNegativeInteger(notification?.showCount),
      lastShownAt: normalizeTimestamp(notification?.lastShownAt)
    };
  }

  function ensureNotificationState(rawState) {
    const raw = rawState && typeof rawState === 'object' ? rawState : {};

    return {
      lastInstalledVersion: typeof raw.lastInstalledVersion === 'string' && raw.lastInstalledVersion.trim()
        ? raw.lastInstalledVersion.trim()
        : null,
      successfulExportsCount: toNonNegativeInteger(raw.successfulExportsCount),
      successfulDownloadsCount: toNonNegativeInteger(raw.successfulDownloadsCount),
      successfulCopiesCount: toNonNegativeInteger(raw.successfulCopiesCount),
      successfulObsidianSendsCount: toNonNegativeInteger(raw.successfulObsidianSendsCount),
      successfulBatchUrlsCount: toNonNegativeInteger(raw.successfulBatchUrlsCount),
      shownSupportThresholds: normalizeNumericArray(raw.shownSupportThresholds),
      shownUpdateVersions: normalizeStringArray(raw.shownUpdateVersions),
      pendingNotifications: Array.isArray(raw.pendingNotifications)
        ? raw.pendingNotifications.map(sanitizeNotification)
        : []
    };
  }

  function formatCount(value) {
    return new Intl.NumberFormat('en-US').format(toNonNegativeInteger(value));
  }

  function hasPendingNotificationType(state, type) {
    return ensureNotificationState(state).pendingNotifications.some((notification) => notification.type === type);
  }

  function sortPendingNotifications(notifications) {
    return [...notifications].sort((left, right) => {
      const leftPriority = NOTIFICATION_TYPE_PRIORITY[left.type] ?? 99;
      const rightPriority = NOTIFICATION_TYPE_PRIORITY[right.type] ?? 99;
      if (leftPriority !== rightPriority) {
        return leftPriority - rightPriority;
      }
      return left.createdAt - right.createdAt;
    });
  }

  function getNextPendingNotification(state) {
    const nextState = ensureNotificationState(state);
    return sortPendingNotifications(nextState.pendingNotifications)[0] || null;
  }

  function upsertNotification(state, notification) {
    const nextState = ensureNotificationState(state);
    const sanitizedNotification = sanitizeNotification(notification);
    const withoutExisting = nextState.pendingNotifications.filter(
      (entry) => entry.id !== sanitizedNotification.id
    );

    withoutExisting.push(sanitizedNotification);

    return {
      ...nextState,
      pendingNotifications: withoutExisting
    };
  }

  function dismissNotification(state, notificationId) {
    const nextState = ensureNotificationState(state);

    return {
      ...nextState,
      pendingNotifications: nextState.pendingNotifications.filter((entry) => entry.id !== notificationId)
    };
  }

  function markNotificationShown(state, notificationId, shownAt) {
    const nextState = ensureNotificationState(state);
    const normalizedShownAt = normalizeTimestamp(shownAt) || Date.now();

    return {
      ...nextState,
      pendingNotifications: nextState.pendingNotifications.map((entry) => {
        if (entry.id !== notificationId) {
          return entry;
        }

        return {
          ...entry,
          showCount: entry.showCount + 1,
          lastShownAt: normalizedShownAt
        };
      })
    };
  }

  function createVersionUpdateNotification(config) {
    const previousVersion = typeof config?.previousVersion === 'string' ? config.previousVersion : null;
    const currentVersion = typeof config?.currentVersion === 'string' ? config.currentVersion : null;

    return sanitizeNotification({
      id: `version-update:${currentVersion}`,
      type: 'version-update',
      createdAt: Date.now(),
      title: `MarkSnip updated to v${currentVersion}`,
      message: previousVersion
        ? `Updated from v${previousVersion} to v${currentVersion}.`
        : `MarkSnip updated to v${currentVersion}.`,
      previousVersion,
      currentVersion,
      highlights: sanitizeHighlights(config?.highlights),
      primaryAction: {
        label: 'Buy Me a Coffee',
        url: config?.buyMeACoffeeUrl || BUY_ME_A_COFFEE_URL
      },
      secondaryAction: {
        label: 'View release notes',
        url: config?.releaseNotesUrl || RELEASES_URL
      }
    });
  }

  function createSupportNotification(config) {
    const milestone = toNonNegativeInteger(config?.milestone);
    const formattedMilestone = formatCount(milestone);

    return sanitizeNotification({
      id: `support-milestone:${milestone}`,
      type: 'support-milestone',
      createdAt: Date.now(),
      title: `${formattedMilestone} pages exported`,
      message: `MarkSnip has helped export over ${formattedMilestone} pages. If it has been useful, support ongoing development.`,
      milestone,
      primaryAction: {
        label: 'Buy Me a Coffee',
        url: config?.buyMeACoffeeUrl || BUY_ME_A_COFFEE_URL
      },
      secondaryAction: {
        label: 'View release notes',
        url: config?.releaseNotesUrl || RELEASES_URL
      }
    });
  }

  function queueVersionUpdate(state, config) {
    const nextState = ensureNotificationState(state);
    const currentVersion = typeof config?.currentVersion === 'string' ? config.currentVersion : null;

    if (!currentVersion || nextState.shownUpdateVersions.includes(currentVersion)) {
      return nextState;
    }

    const withTrackedVersion = {
      ...nextState,
      shownUpdateVersions: [...nextState.shownUpdateVersions, currentVersion]
    };

    return upsertNotification(withTrackedVersion, createVersionUpdateNotification(config));
  }

  function applyMetricDelta(state, delta) {
    const nextState = ensureNotificationState(state);
    const changes = delta && typeof delta === 'object' ? delta : {};

    return {
      ...nextState,
      successfulExportsCount: nextState.successfulExportsCount + toNonNegativeInteger(changes.exports),
      successfulDownloadsCount: nextState.successfulDownloadsCount + toNonNegativeInteger(changes.downloads),
      successfulCopiesCount: nextState.successfulCopiesCount + toNonNegativeInteger(changes.copies),
      successfulObsidianSendsCount: nextState.successfulObsidianSendsCount + toNonNegativeInteger(changes.obsidianSends),
      successfulBatchUrlsCount: nextState.successfulBatchUrlsCount + toNonNegativeInteger(changes.batchUrls)
    };
  }

  function getNextSupportThreshold(state) {
    const nextState = ensureNotificationState(state);

    for (const threshold of SUPPORT_NOTIFICATION_THRESHOLDS) {
      if (
        nextState.successfulExportsCount >= threshold &&
        !nextState.shownSupportThresholds.includes(threshold)
      ) {
        return threshold;
      }
    }

    return null;
  }

  function queueNextSupportNotification(state, config) {
    const nextState = ensureNotificationState(state);

    if (hasPendingNotificationType(nextState, 'support-milestone')) {
      return nextState;
    }

    const nextThreshold = getNextSupportThreshold(nextState);
    if (!nextThreshold) {
      return nextState;
    }

    const withTrackedThreshold = {
      ...nextState,
      shownSupportThresholds: [...nextState.shownSupportThresholds, nextThreshold]
    };

    return upsertNotification(
      withTrackedThreshold,
      createSupportNotification({
        ...config,
        milestone: nextThreshold
      })
    );
  }

  return {
    BUY_ME_A_COFFEE_URL,
    RELEASES_URL,
    STORAGE_DEFAULTS,
    STORAGE_KEYS,
    SUPPORT_NOTIFICATION_THRESHOLDS,
    applyMetricDelta,
    createSupportNotification,
    createVersionUpdateNotification,
    dismissNotification,
    ensureNotificationState,
    getNextPendingNotification,
    getNextSupportThreshold,
    hasPendingNotificationType,
    markNotificationShown,
    queueNextSupportNotification,
    queueVersionUpdate,
    sortPendingNotifications,
    upsertNotification
  };
});
