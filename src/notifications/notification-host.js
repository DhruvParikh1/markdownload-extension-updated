'use strict';

(function () {
  if (window.top !== window) {
    return;
  }

  const DISPLAY_DELAY_MS = (
    location.protocol === 'chrome-extension:' ||
    location.protocol === 'moz-extension:'
  ) ? 0 : 1000;

  function delay(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  function waitForDomReady() {
    if (document.readyState !== 'loading') {
      return Promise.resolve();
    }

    return new Promise((resolve) => {
      window.addEventListener('DOMContentLoaded', resolve, { once: true });
    });
  }

  function getRuntime() {
    if (typeof browser !== 'undefined' && browser.runtime) {
      return browser.runtime;
    }

    if (typeof chrome !== 'undefined' && chrome.runtime) {
      return chrome.runtime;
    }

    return null;
  }

  function sendRuntimeMessage(message) {
    const runtime = getRuntime();
    if (!runtime) {
      return Promise.resolve(null);
    }

    if (typeof browser !== 'undefined' && browser.runtime?.sendMessage) {
      return browser.runtime.sendMessage(message);
    }

    return new Promise((resolve, reject) => {
      runtime.sendMessage(message, (response) => {
        if (chrome.runtime?.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
          return;
        }

        resolve(response);
      });
    });
  }

  class FloatingNotificationCard {
    constructor(notification, options = {}) {
      this.notification = notification;
      this.onRemove = typeof options.onRemove === 'function' ? options.onRemove : () => {};
      this.host = document.createElement('div');
      this.host.style.position = 'fixed';
      this.host.style.top = '20px';
      this.host.style.right = '20px';
      this.host.style.left = 'auto';
      this.host.style.bottom = 'auto';
      this.host.style.zIndex = '2147483647';
      this.host.style.pointerEvents = 'auto';

      this.shadow = this.host.attachShadow({ mode: 'open' });
      this.shadow.appendChild(this.buildStyles());
      this.shadow.appendChild(this.buildCard());
    }

    buildStyles() {
      const style = document.createElement('style');
      style.textContent = `
        :host {
          all: initial;
        }

        .card {
          width: min(340px, calc(100vw - 32px));
          background:
            linear-gradient(180deg, rgba(24, 34, 31, 0.98) 0%, rgba(16, 24, 22, 0.98) 100%);
          color: #f8f6f1;
          border: 1px solid rgba(169, 194, 176, 0.22);
          border-radius: 18px;
          box-shadow: 0 24px 60px rgba(0, 0, 0, 0.34);
          font-family: ui-sans-serif, system-ui, sans-serif;
          overflow: hidden;
        }

        .header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          padding: 14px 16px 12px;
          cursor: move;
          background: linear-gradient(135deg, rgba(110, 142, 116, 0.22), rgba(255, 255, 255, 0));
          border-bottom: 1px solid rgba(255, 255, 255, 0.08);
          user-select: none;
        }

        .eyebrow {
          font-size: 11px;
          font-weight: 700;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          color: rgba(214, 232, 220, 0.72);
        }

        .close {
          border: 0;
          background: transparent;
          color: rgba(255, 255, 255, 0.72);
          font-size: 18px;
          line-height: 1;
          cursor: pointer;
          padding: 0;
        }

        .close:hover {
          color: #ffffff;
        }

        .body {
          padding: 16px;
        }

        .title {
          margin: 0 0 8px;
          font-size: 18px;
          line-height: 1.25;
          font-weight: 700;
          color: #ffffff;
        }

        .message {
          margin: 0;
          font-size: 14px;
          line-height: 1.55;
          color: rgba(248, 246, 241, 0.82);
        }

        .highlights {
          margin: 14px 0 0;
          padding: 0 0 0 18px;
          max-height: 160px;
          overflow: auto;
          color: rgba(248, 246, 241, 0.88);
        }

        .highlights li {
          margin: 0 0 8px;
          line-height: 1.45;
          font-size: 13px;
        }

        .actions {
          display: flex;
          flex-wrap: wrap;
          gap: 10px;
          margin-top: 16px;
        }

        .action {
          appearance: none;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          min-height: 40px;
          padding: 0 14px;
          border-radius: 999px;
          text-decoration: none;
          font-size: 13px;
          font-weight: 700;
          transition: transform 120ms ease, opacity 120ms ease, background 120ms ease;
        }

        .action:hover {
          transform: translateY(-1px);
        }

        .action-primary {
          background: #d7b15e;
          color: #1a1711;
        }

        .action-secondary {
          background: rgba(255, 255, 255, 0.1);
          color: #ffffff;
          border: 1px solid rgba(255, 255, 255, 0.12);
        }
      `;
      return style;
    }

    buildCard() {
      const card = document.createElement('section');
      card.className = 'card';

      const header = document.createElement('div');
      header.className = 'header';

      const eyebrow = document.createElement('div');
      eyebrow.className = 'eyebrow';
      eyebrow.textContent = this.notification.type === 'version-update' ? 'MarkSnip Update' : 'Support MarkSnip';

      const close = document.createElement('button');
      close.className = 'close';
      close.type = 'button';
      close.setAttribute('aria-label', 'Dismiss notification');
      close.textContent = 'x';
      close.addEventListener('pointerdown', (event) => {
        event.stopPropagation();
      });
      close.addEventListener('click', () => {
        void sendRuntimeMessage({
          type: 'dismiss-notification',
          notificationId: this.notification.id
        }).catch(() => {});
        this.remove();
      });

      header.appendChild(eyebrow);
      header.appendChild(close);

      const body = document.createElement('div');
      body.className = 'body';

      const title = document.createElement('h2');
      title.className = 'title';
      title.textContent = this.notification.title || 'MarkSnip notification';

      const message = document.createElement('p');
      message.className = 'message';
      message.textContent = this.notification.message || '';

      body.appendChild(title);
      body.appendChild(message);

      if (Array.isArray(this.notification.highlights) && this.notification.highlights.length > 0) {
        const highlights = document.createElement('ul');
        highlights.className = 'highlights';

        this.notification.highlights.forEach((highlight) => {
          const item = document.createElement('li');
          item.textContent = highlight;
          highlights.appendChild(item);
        });

        body.appendChild(highlights);
      }

      const actions = document.createElement('div');
      actions.className = 'actions';

      if (this.notification.primaryAction?.url) {
        actions.appendChild(this.createAction(this.notification.primaryAction, 'action-primary'));
      }

      if (this.notification.secondaryAction?.url) {
        actions.appendChild(this.createAction(this.notification.secondaryAction, 'action-secondary'));
      }

      if (actions.childNodes.length > 0) {
        body.appendChild(actions);
      }

      card.appendChild(header);
      card.appendChild(body);

      this.enableDragging(header);

      return card;
    }

    createAction(action, variantClass) {
      const anchor = document.createElement('a');
      anchor.className = `action ${variantClass}`;
      anchor.href = action.url;
      anchor.target = '_blank';
      anchor.rel = 'noopener noreferrer';
      anchor.textContent = action.label;
      return anchor;
    }

    enableDragging(handle) {
      let pointerId = null;
      let offsetX = 0;
      let offsetY = 0;

      handle.addEventListener('pointerdown', (event) => {
        pointerId = event.pointerId;
        handle.setPointerCapture(pointerId);

        const rect = this.host.getBoundingClientRect();
        offsetX = event.clientX - rect.left;
        offsetY = event.clientY - rect.top;

        this.host.style.left = `${rect.left}px`;
        this.host.style.top = `${rect.top}px`;
        this.host.style.right = 'auto';
        this.host.style.bottom = 'auto';
      });

      handle.addEventListener('pointermove', (event) => {
        if (pointerId !== event.pointerId) {
          return;
        }

        const maxX = Math.max(0, window.innerWidth - this.host.offsetWidth);
        const maxY = Math.max(0, window.innerHeight - this.host.offsetHeight);
        const nextLeft = Math.min(Math.max(0, event.clientX - offsetX), maxX);
        const nextTop = Math.min(Math.max(0, event.clientY - offsetY), maxY);

        this.host.style.left = `${nextLeft}px`;
        this.host.style.top = `${nextTop}px`;
      });

      const stopDragging = (event) => {
        if (pointerId !== event.pointerId) {
          return;
        }

        handle.releasePointerCapture(pointerId);
        pointerId = null;
      };

      handle.addEventListener('pointerup', stopDragging);
      handle.addEventListener('pointercancel', stopDragging);
    }

    mount() {
      (document.body || document.documentElement).appendChild(this.host);
    }

    remove() {
      this.host.remove();
      this.onRemove();
    }
  }

  function createNotificationHostController() {
    let currentCard = null;
    let currentNotificationId = null;
    let displayTask = null;

    function clearCurrentCard(card) {
      if (currentCard === card) {
        currentCard = null;
        currentNotificationId = null;
      }
    }

    async function showPendingNotification() {
      if (displayTask) {
        return displayTask;
      }

      displayTask = (async () => {
        await waitForDomReady();
        await delay(DISPLAY_DELAY_MS);

        const notification = await sendRuntimeMessage({ type: 'get-pending-notification' }).catch(() => null);
        if (!notification || !notification.id) {
          return false;
        }

        if (
          currentCard &&
          currentNotificationId === notification.id &&
          currentCard.host.isConnected
        ) {
          return true;
        }

        if (currentCard) {
          currentCard.remove();
        }

        const card = new FloatingNotificationCard(notification, {
          onRemove: () => clearCurrentCard(card)
        });

        currentCard = card;
        currentNotificationId = notification.id;
        card.mount();

        void sendRuntimeMessage({
          type: 'mark-notification-shown',
          notificationId: notification.id
        }).catch(() => {});

        return true;
      })().finally(() => {
        displayTask = null;
      });

      return displayTask;
    }

    return {
      showPendingNotification
    };
  }

  const notificationHost = (
    window.markSnipNotificationHost &&
    typeof window.markSnipNotificationHost.showPendingNotification === 'function'
  )
    ? window.markSnipNotificationHost
    : createNotificationHostController();

  window.markSnipNotificationHost = notificationHost;
  void notificationHost.showPendingNotification();
})();
