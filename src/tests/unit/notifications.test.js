const notifications = require('../../shared/notifications');
require('../../shared/i18n.js');

describe('notification helpers', () => {
  test('queues only the next unseen support threshold when exports jump', () => {
    let state = notifications.applyMetricDelta(
      notifications.ensureNotificationState(),
      { exports: 500, batchUrls: 500 }
    );

    state = notifications.queueNextSupportNotification(state, {});

    expect(state.shownSupportThresholds).toEqual([25]);
    expect(state.pendingNotifications).toHaveLength(1);
    expect(state.pendingNotifications[0]).toEqual(
      expect.objectContaining({
        id: 'support-milestone:25',
        milestone: 25,
        type: 'support-milestone'
      })
    );
    expect(notifications.getNextSupportThreshold(state)).toBe(100);
  });

  test('dismissing a support card unlocks the next queued threshold', () => {
    let state = notifications.applyMetricDelta(
      notifications.ensureNotificationState(),
      { exports: 500 }
    );

    state = notifications.queueNextSupportNotification(state, {});
    state = notifications.dismissNotification(state, 'support-milestone:25');
    state = notifications.queueNextSupportNotification(state, {});

    expect(state.shownSupportThresholds).toEqual([25, 100]);
    expect(state.pendingNotifications).toHaveLength(1);
    expect(state.pendingNotifications[0].id).toBe('support-milestone:100');
  });

  test('prioritizes version updates ahead of support cards', () => {
    let state = notifications.applyMetricDelta(
      notifications.ensureNotificationState(),
      { exports: 25 }
    );

    state = notifications.queueNextSupportNotification(state, {});
    state = notifications.queueVersionUpdate(state, {
      previousVersion: '4.1.0',
      currentVersion: '4.1.1',
      highlights: ['Selection capture fix'],
      buyMeACoffeeUrl: notifications.BUY_ME_A_COFFEE_URL,
      releaseNotesUrl: notifications.RELEASES_URL
    });

    const nextNotification = notifications.getNextPendingNotification(state);

    expect(nextNotification).toEqual(
      expect.objectContaining({
        id: 'version-update:4.1.1',
        type: 'version-update',
        currentVersion: '4.1.1'
      })
    );
  });

  test('marks a notification as shown without removing it', () => {
    let state = notifications.queueVersionUpdate(
      notifications.ensureNotificationState(),
      {
        previousVersion: '4.1.0',
        currentVersion: '4.1.1',
        highlights: [],
        buyMeACoffeeUrl: notifications.BUY_ME_A_COFFEE_URL,
        releaseNotesUrl: notifications.RELEASES_URL
      }
    );

    state = notifications.markNotificationShown(state, 'version-update:4.1.1', 12345);

    expect(state.pendingNotifications).toHaveLength(1);
    expect(state.pendingNotifications[0]).toEqual(
      expect.objectContaining({
        id: 'version-update:4.1.1',
        showCount: 1,
        lastShownAt: 12345
      })
    );
  });

  test('creates spanish support notifications with localized copy and locale-aware counts', () => {
    browser.i18n._setLocale('es');

    const notification = notifications.createSupportNotification({ milestone: 12345 });

    expect(notification.title).toBe(browser.i18n.getMessage('notification_support_title', new Intl.NumberFormat('es').format(12345)));
    expect(notification.message).toContain(new Intl.NumberFormat('es').format(12345));
    expect(notification.primaryAction.label).toBe(browser.i18n.getMessage('notification_action_support'));

    browser.i18n._reset();
  });
});
