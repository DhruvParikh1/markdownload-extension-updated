/**
 * Mock implementation of Browser Extension APIs
 * Provides mock objects for chrome.* and browser.* APIs used in the extension
 */

const storageListeners = new Set();

function emitStorageChange(areaName, changes) {
  storageListeners.forEach(listener => listener(changes, areaName));
}

// Storage mock
const storageMock = {
  local: {
    _data: {},
    get: jest.fn((keys, callback) => {
      const result = {};
      if (typeof keys === 'string') {
        result[keys] = storageMock.local._data[keys];
      } else if (Array.isArray(keys)) {
        keys.forEach(key => {
          result[key] = storageMock.local._data[key];
        });
      } else if (typeof keys === 'object') {
        Object.keys(keys).forEach(key => {
          result[key] = storageMock.local._data[key] !== undefined
            ? storageMock.local._data[key]
            : keys[key];
        });
      }
      if (callback) {
        callback(result);
      }
      return Promise.resolve(result);
    }),
    set: jest.fn((items, callback) => {
      const changes = {};
      Object.keys(items || {}).forEach(key => {
        changes[key] = {
          oldValue: storageMock.local._data[key],
          newValue: items[key]
        };
      });
      Object.assign(storageMock.local._data, items);
      emitStorageChange('local', changes);
      if (callback) {
        callback();
      }
      return Promise.resolve();
    }),
    remove: jest.fn((keys, callback) => {
      const changes = {};
      if (typeof keys === 'string') {
        changes[keys] = {
          oldValue: storageMock.local._data[keys],
          newValue: undefined
        };
        delete storageMock.local._data[keys];
      } else if (Array.isArray(keys)) {
        keys.forEach(key => {
          changes[key] = {
            oldValue: storageMock.local._data[key],
            newValue: undefined
          };
          delete storageMock.local._data[key];
        });
      }
      emitStorageChange('local', changes);
      if (callback) {
        callback();
      }
      return Promise.resolve();
    }),
    clear: jest.fn((callback) => {
      const changes = {};
      Object.keys(storageMock.local._data).forEach(key => {
        changes[key] = {
          oldValue: storageMock.local._data[key],
          newValue: undefined
        };
      });
      storageMock.local._data = {};
      emitStorageChange('local', changes);
      if (callback) {
        callback();
      }
      return Promise.resolve();
    }),
    _reset: () => {
      storageMock.local._data = {};
    }
  },
  sync: {
    _data: {},
    get: jest.fn((keys, callback) => {
      const result = {};
      if (typeof keys === 'string') {
        result[keys] = storageMock.sync._data[keys];
      } else if (Array.isArray(keys)) {
        keys.forEach(key => {
          result[key] = storageMock.sync._data[key];
        });
      } else if (typeof keys === 'object') {
        Object.keys(keys).forEach(key => {
          result[key] = storageMock.sync._data[key] !== undefined
            ? storageMock.sync._data[key]
            : keys[key];
        });
      }
      if (callback) {
        callback(result);
      }
      return Promise.resolve(result);
    }),
    set: jest.fn((items, callback) => {
      const changes = {};
      Object.keys(items || {}).forEach(key => {
        changes[key] = {
          oldValue: storageMock.sync._data[key],
          newValue: items[key]
        };
      });
      Object.assign(storageMock.sync._data, items);
      emitStorageChange('sync', changes);
      if (callback) {
        callback();
      }
      return Promise.resolve();
    }),
    remove: jest.fn((keys, callback) => {
      const changes = {};
      if (typeof keys === 'string') {
        changes[keys] = {
          oldValue: storageMock.sync._data[keys],
          newValue: undefined
        };
        delete storageMock.sync._data[keys];
      } else if (Array.isArray(keys)) {
        keys.forEach(key => {
          changes[key] = {
            oldValue: storageMock.sync._data[key],
            newValue: undefined
          };
          delete storageMock.sync._data[key];
        });
      }
      emitStorageChange('sync', changes);
      if (callback) {
        callback();
      }
      return Promise.resolve();
    }),
    _reset: () => {
      storageMock.sync._data = {};
    }
  },
  onChanged: {
    addListener: jest.fn(listener => {
      storageListeners.add(listener);
    }),
    removeListener: jest.fn(listener => {
      storageListeners.delete(listener);
    })
  }
};

// Runtime mock
const runtimeMock = {
  lastError: null,
  id: 'test-extension-id',
  sendMessage: jest.fn((message, callback) => {
    if (callback) {
      callback({ success: true });
    }
    return Promise.resolve({ success: true });
  }),
  onMessage: {
    addListener: jest.fn(),
    removeListener: jest.fn(),
    hasListener: jest.fn()
  },
  getURL: jest.fn((path) => {
    return `chrome-extension://test-extension-id/${path}`;
  }),
  getManifest: jest.fn(() => ({
    name: 'MarkSnip - Markdown Web Clipper',
    version: '4.0.0',
    manifest_version: 3
  })),
  getPlatformInfo: jest.fn(() => Promise.resolve({ os: 'win', arch: 'x86-64' }))
};

// Tabs mock
const tabsMock = {
  _tabs: [],
  query: jest.fn((queryInfo, callback) => {
    let results = tabsMock._tabs;
    if (queryInfo.active) {
      results = results.filter(tab => tab.active);
    }
    if (queryInfo.currentWindow) {
      results = results.filter(tab => tab.windowId === 1);
    }
    if (callback) {
      callback(results);
    }
    return Promise.resolve(results);
  }),
  get: jest.fn((tabId, callback) => {
    const tab = tabsMock._tabs.find(t => t.id === tabId);
    if (callback) {
      callback(tab);
    }
    return Promise.resolve(tab);
  }),
  create: jest.fn((createProperties, callback) => {
    const newTab = {
      id: tabsMock._tabs.length + 1,
      windowId: 1,
      active: createProperties.active !== false,
      url: createProperties.url || 'about:blank',
      title: '',
      ...createProperties
    };
    tabsMock._tabs.push(newTab);
    if (callback) {
      callback(newTab);
    }
    return Promise.resolve(newTab);
  }),
  update: jest.fn((tabId, updateProperties, callback) => {
    const tab = tabsMock._tabs.find(t => t.id === tabId) || tabsMock._tabs[0];
    if (tab) Object.assign(tab, updateProperties);
    if (callback) {
      callback(tab);
    }
    return Promise.resolve(tab);
  }),
  remove: jest.fn((tabId, callback) => {
    tabsMock._tabs = tabsMock._tabs.filter(tab => tab.id !== tabId);
    if (callback) {
      callback();
    }
    return Promise.resolve();
  }),
  reload: jest.fn((tabId, callback) => {
    if (callback) {
      callback();
    }
    return Promise.resolve();
  }),
  onUpdated: {
    addListener: jest.fn(),
    removeListener: jest.fn()
  },
  sendMessage: jest.fn((tabId, message, callback) => {
    if (callback) {
      callback({ success: true });
    }
    return Promise.resolve({ success: true });
  }),
  executeScript: jest.fn((tabId, details, callback) => {
    if (callback) {
      callback([]);
    }
    return Promise.resolve([]);
  }),
  _reset: () => {
    tabsMock._tabs = [
      {
        id: 1,
        windowId: 1,
        active: true,
        url: 'https://example.com',
        title: 'Example Domain'
      }
    ];
  }
};

// Downloads mock
const downloadsMock = {
  _downloads: [],
  download: jest.fn((options, callback) => {
    const downloadId = downloadsMock._downloads.length + 1;
    downloadsMock._downloads.push({
      id: downloadId,
      ...options
    });
    if (callback) {
      callback(downloadId);
    }
    return Promise.resolve(downloadId);
  }),
  onChanged: {
    addListener: jest.fn(),
    removeListener: jest.fn()
  },
  _reset: () => {
    downloadsMock._downloads = [];
  }
};

// Context Menus mock
const contextMenusMock = {
  _menus: [],
  create: jest.fn((createProperties, callback) => {
    const menuId = createProperties.id || `menu-${contextMenusMock._menus.length + 1}`;
    contextMenusMock._menus.push({
      ...createProperties,
      id: menuId
    });
    if (callback) {
      callback();
    }
    return menuId;
  }),
  update: jest.fn((id, updateProperties, callback) => {
    const menu = contextMenusMock._menus.find(m => m.id === id);
    if (menu) {
      Object.assign(menu, updateProperties);
    }
    if (callback) {
      callback();
    }
    return Promise.resolve();
  }),
  remove: jest.fn((menuItemId, callback) => {
    contextMenusMock._menus = contextMenusMock._menus.filter(m => m.id !== menuItemId);
    if (callback) {
      callback();
    }
    return Promise.resolve();
  }),
  removeAll: jest.fn((callback) => {
    contextMenusMock._menus = [];
    if (callback) {
      callback();
    }
    return Promise.resolve();
  }),
  onClicked: {
    addListener: jest.fn(),
    removeListener: jest.fn()
  },
  _reset: () => {
    contextMenusMock._menus = [];
  }
};

// Scripting mock
const scriptingMock = {
  executeScript: jest.fn((injection) => {
    return Promise.resolve([{ result: null }]);
  }),
  insertCSS: jest.fn((injection) => {
    return Promise.resolve();
  })
};

// Clipboard mock
const clipboardMock = {
  writeText: jest.fn((text) => {
    clipboardMock._lastText = text;
    return Promise.resolve();
  }),
  _lastText: null,
  _reset: () => {
    clipboardMock._lastText = null;
  }
};

// Commands mock
const commandsMock = {
  onCommand: {
    addListener: jest.fn(),
    removeListener: jest.fn()
  }
};

// Offscreen mock
const offscreenMock = {
  createDocument: jest.fn((parameters) => {
    return Promise.resolve();
  }),
  closeDocument: jest.fn(() => {
    return Promise.resolve();
  })
};

const identityMock = {
  getRedirectURL: jest.fn((path = '') => `https://example.chromiumapp.org/${path}`),
  launchWebAuthFlow: jest.fn(() => Promise.resolve('https://example.chromiumapp.org/notion?code=test-code&state=test-state'))
};

// Main browser API object
const browserAPI = {
  storage: storageMock,
  runtime: runtimeMock,
  tabs: tabsMock,
  downloads: downloadsMock,
  contextMenus: contextMenusMock,
  scripting: scriptingMock,
  clipboard: clipboardMock,
  commands: commandsMock,
  offscreen: offscreenMock,
  identity: identityMock,

  // Helper to reset all mocks
  _resetAll: () => {
    storageMock.local._reset();
    storageMock.sync._reset();
    tabsMock._reset();
    downloadsMock._reset();
    contextMenusMock._reset();
    clipboardMock._reset();
    storageListeners.clear();
    jest.clearAllMocks();
  }
};

// Initialize with some default data
tabsMock._reset();

module.exports = browserAPI;
