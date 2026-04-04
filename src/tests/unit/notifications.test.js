const notifications = require('../../shared/notifications');

describe('notification helpers', () => {
  test('localizes support notifications with provided translator', () => {
    const notification = notifications.createSupportNotification({
      milestone: 25,
      numberLocale: 'hi-IN',
      t(key, substitutions = {}) {
        const map = {
          notif_support_title: `समर्थन ${substitutions.count}`,
          notif_support_message: `${substitutions.count} पेज`,
          notif_action_buy_me_coffee: 'सपोर्ट करें',
          notif_action_view_release_notes: 'रिलीज़ नोट्स'
        };
        return map[key] || key;
      }
    });

    expect(notification.title).toContain('समर्थन');
    expect(notification.message).toContain('25');
    expect(notification.primaryAction.label).toBe('सपोर्ट करें');
    expect(notification.secondaryAction.label).toBe('रिलीज़ नोट्स');
  });

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
});
