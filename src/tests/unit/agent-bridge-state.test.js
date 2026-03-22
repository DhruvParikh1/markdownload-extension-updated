const agentBridgeState = require('../../shared/agent-bridge-state');

describe('agent-bridge-state helpers', () => {
  test('normalizes settings to disabled by default', () => {
    expect(agentBridgeState.normalizeSettings()).toEqual({ enabled: false });
    expect(agentBridgeState.normalizeSettings({ enabled: true })).toEqual({ enabled: true });
  });

  test('normalizes latest clip and strips hashes from page urls', () => {
    const clip = agentBridgeState.normalizeLatestClip({
      title: 'Doc',
      markdown: '# Hello',
      pageUrl: 'https://example.com/path#intro',
      source: 'popup'
    });

    expect(clip.pageUrl).toBe('https://example.com/path#intro');
    expect(clip.normalizedPageUrl).toBe('https://example.com/path');
    expect(clip.source).toBe('popup');
  });

  test('matches latest clip to the active page using normalized urls', () => {
    const clip = {
      title: 'Doc',
      markdown: '# Hello',
      pageUrl: 'https://example.com/path#intro',
      source: 'popup'
    };

    expect(agentBridgeState.shouldUseLatestClipForPage(clip, 'https://example.com/path#summary')).toBe(true);
    expect(agentBridgeState.shouldUseLatestClipForPage(clip, 'https://example.com/other')).toBe(false);
  });

  test('persists settings and latest clip through storage helpers', async () => {
    const storage = {
      values: {},
      async get(key) {
        return { [key]: this.values[key] };
      },
      async set(payload) {
        this.values = { ...this.values, ...payload };
      },
      async remove(key) {
        delete this.values[key];
      }
    };

    await agentBridgeState.saveSettings({ enabled: true }, storage);
    await agentBridgeState.saveLatestClip({
      title: 'Saved',
      markdown: 'body',
      pageUrl: 'https://example.com/path#part',
      source: 'popup'
    }, storage);

    const settings = await agentBridgeState.loadSettings(storage);
    const latestClip = await agentBridgeState.loadLatestClip(storage);

    expect(settings).toEqual({ enabled: true });
    expect(latestClip.title).toBe('Saved');
    expect(latestClip.normalizedPageUrl).toBe('https://example.com/path');
  });
});
