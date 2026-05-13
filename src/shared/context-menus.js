// create the context menus
function contextMenuMessage(key, substitutions, fallback) {
  return globalThis.markSnipI18n?.t(key, substitutions, fallback) || fallback || key;
}

function contextMenuI18nReady() {
  return globalThis.markSnipI18n?.ready?.().catch(() => {}) || Promise.resolve();
}

async function createMenus() {
  await contextMenuI18nReady();
  const options = await getOptions();

  browser.contextMenus.removeAll();

  if (options.contextMenus) {

    // tab menu (chrome does not support this)
    try {
      browser.contextMenus.create({
        id: "download-markdown-tab",
        title: contextMenuMessage("contextDownloadTab", null, "Download Tab as Markdown"),
        contexts: ["tab"]
      }, () => { });

      browser.contextMenus.create({
        id: "tab-download-markdown-alltabs",
        title: contextMenuMessage("contextDownloadAllTabs", null, "Download All Tabs as Markdown"),
        contexts: ["tab"]
      }, () => { });

      browser.contextMenus.create({
        id: "copy-tab-as-markdown-link-tab",
        title: contextMenuMessage("contextCopyTabLink", null, "Copy Tab URL as Markdown Link"),
        contexts: ["tab"]
      }, () => { });

      browser.contextMenus.create({
        id: "copy-tab-as-markdown-link-all-tab",
        title: contextMenuMessage("contextCopyAllTabLinks", null, "Copy All Tab URLs as Markdown Link List"),
        contexts: ["tab"]
      }, () => { });

      browser.contextMenus.create({
        id: "copy-tab-as-markdown-link-selected-tab",
        title: contextMenuMessage("contextCopySelectedTabLinks", null, "Copy Selected Tab URLs as Markdown Link List"),
        contexts: ["tab"]
      }, () => { });

      browser.contextMenus.create({
        id: "tab-separator-1",
        type: "separator",
        contexts: ["tab"]
      }, () => { });

      browser.contextMenus.create({
        id: "tabtoggle-includeTemplate",
        type: "checkbox",
        title: contextMenuMessage("contextToggleTemplate", null, "Include front/back template"),
        contexts: ["tab"],
        checked: options.includeTemplate
      }, () => { });

      browser.contextMenus.create({
        id: "tabtoggle-downloadImages",
        type: "checkbox",
        title: contextMenuMessage("contextToggleImages", null, "Download Images"),
        contexts: ["tab"],
        checked: options.downloadImages
      }, () => { });
    } catch {

    }
    // add the download all tabs option to the page context menu as well
    browser.contextMenus.create({
      id: "download-markdown-alltabs",
      title: contextMenuMessage("contextDownloadAllTabs", null, "Download All Tabs as Markdown"),
      contexts: ["all"]
    }, () => { });
    browser.contextMenus.create({
      id: "separator-0",
      type: "separator",
      contexts: ["all"]
    }, () => { });

    // download actions
    browser.contextMenus.create({
      id: "download-markdown-selection",
      title: contextMenuMessage("contextDownloadSelection", null, "Download Selection As Markdown"),
      contexts: ["selection"]
    }, () => { });
    browser.contextMenus.create({
      id: "download-markdown-all",
      title: contextMenuMessage("contextDownloadTab", null, "Download Tab As Markdown"),
      contexts: ["all"]
    }, () => { });

    browser.contextMenus.create({
      id: "separator-1",
      type: "separator",
      contexts: ["all"]
    }, () => { });

    // copy to clipboard actions
    browser.contextMenus.create({
      id: "copy-markdown-selection",
      title: contextMenuMessage("contextCopySelection", null, "Copy Selection As Markdown"),
      contexts: ["selection"]
    }, () => { });
    browser.contextMenus.create({
      id: "copy-markdown-link",
      title: contextMenuMessage("contextCopyLink", null, "Copy Link As Markdown"),
      contexts: ["link"]
    }, () => { });
    browser.contextMenus.create({
      id: "copy-markdown-image",
      title: contextMenuMessage("contextCopyImage", null, "Copy Image As Markdown"),
      contexts: ["image"]
    }, () => { });
    browser.contextMenus.create({
      id: "copy-markdown-all",
      title: contextMenuMessage("contextCopyTab", null, "Copy Tab As Markdown"),
      contexts: ["all"]
    }, () => { });
    browser.contextMenus.create({
      id: "copy-tab-as-markdown-link",
      title: contextMenuMessage("contextCopyTabLink", null, "Copy Tab URL as Markdown Link"),
      contexts: ["all"]
    }, () => { });
    browser.contextMenus.create({
      id: "copy-tab-as-markdown-link-all",
      title: contextMenuMessage("contextCopyAllTabLinks", null, "Copy All Tab URLs as Markdown Link List"),
      contexts: ["all"]
    }, () => { });
    browser.contextMenus.create({
      id: "copy-tab-as-markdown-link-selected",
      title: contextMenuMessage("contextCopySelectedTabLinks", null, "Copy Selected Tab URLs as Markdown Link List"),
      contexts: ["all"]
    }, () => { });
  
    browser.contextMenus.create({
      id: "separator-2",
      type: "separator",
      contexts: ["all"]
    }, () => { });

    if(options.obsidianIntegration){
      // copy to clipboard actions
      browser.contextMenus.create({
        id: "copy-markdown-obsidian",
        title: contextMenuMessage("contextSendSelectionObsidian", null, "Send Text selection to Obsidian"),
        contexts: ["selection"]
      }, () => { });
      browser.contextMenus.create({
        id: "copy-markdown-obsall",
        title: contextMenuMessage("contextSendTabObsidian", null, "Send Tab to Obsidian"),
        contexts: ["all"]
      }, () => { });
    }
    browser.contextMenus.create({
      id: "separator-3",
      type: "separator",
      contexts: ["all"]
    }, () => { });

    // options
    browser.contextMenus.create({
      id: "toggle-includeTemplate",
      type: "checkbox",
      title: contextMenuMessage("contextToggleTemplate", null, "Include front/back template"),
      contexts: ["all"],
      checked: options.includeTemplate
    }, () => { });

    browser.contextMenus.create({
      id: "toggle-downloadImages",
      type: "checkbox",
      title: contextMenuMessage("contextToggleImages", null, "Download Images"),
      contexts: ["all"],
      checked: options.downloadImages
    }, () => { });
  }
}
