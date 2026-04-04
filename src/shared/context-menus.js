function getContextMenuI18nApi() {
  return globalThis.markSnipI18n || null;
}

function getContextMenuMessage(key) {
  return getContextMenuI18nApi()?.getMessage?.(key) || key;
}

// create the context menus
async function createMenus() {
  const options = await getOptions();

  browser.contextMenus.removeAll();

  if (options.contextMenus) {

    // tab menu (chrome does not support this)
    try {
      browser.contextMenus.create({
        id: "download-markdown-tab",
        title: getContextMenuMessage("menu_download_markdown_tab"),
        contexts: ["tab"]
      }, () => { });

      browser.contextMenus.create({
        id: "tab-download-markdown-alltabs",
        title: getContextMenuMessage("menu_tab_download_markdown_alltabs"),
        contexts: ["tab"]
      }, () => { });

      browser.contextMenus.create({
        id: "copy-tab-as-markdown-link-tab",
        title: getContextMenuMessage("menu_copy_tab_as_markdown_link_tab"),
        contexts: ["tab"]
      }, () => { });

      browser.contextMenus.create({
        id: "copy-tab-as-markdown-link-all-tab",
        title: getContextMenuMessage("menu_copy_tab_as_markdown_link_all_tab"),
        contexts: ["tab"]
      }, () => { });

      browser.contextMenus.create({
        id: "copy-tab-as-markdown-link-selected-tab",
        title: getContextMenuMessage("menu_copy_tab_as_markdown_link_selected_tab"),
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
        title: getContextMenuMessage("menu_toggle_include_template"),
        contexts: ["tab"],
        checked: options.includeTemplate
      }, () => { });

      browser.contextMenus.create({
        id: "tabtoggle-downloadImages",
        type: "checkbox",
        title: getContextMenuMessage("menu_toggle_download_images"),
        contexts: ["tab"],
        checked: options.downloadImages
      }, () => { });
    } catch {

    }
    // add the download all tabs option to the page context menu as well
    browser.contextMenus.create({
      id: "download-markdown-alltabs",
      title: getContextMenuMessage("menu_download_markdown_alltabs"),
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
      title: getContextMenuMessage("menu_download_markdown_selection"),
      contexts: ["selection"]
    }, () => { });
    browser.contextMenus.create({
      id: "download-markdown-all",
      title: getContextMenuMessage("menu_download_markdown_all"),
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
      title: getContextMenuMessage("menu_copy_markdown_selection"),
      contexts: ["selection"]
    }, () => { });
    browser.contextMenus.create({
      id: "copy-markdown-link",
      title: getContextMenuMessage("menu_copy_markdown_link"),
      contexts: ["link"]
    }, () => { });
    browser.contextMenus.create({
      id: "copy-markdown-image",
      title: getContextMenuMessage("menu_copy_markdown_image"),
      contexts: ["image"]
    }, () => { });
    browser.contextMenus.create({
      id: "copy-markdown-all",
      title: getContextMenuMessage("menu_copy_markdown_all"),
      contexts: ["all"]
    }, () => { });
    browser.contextMenus.create({
      id: "copy-tab-as-markdown-link",
      title: getContextMenuMessage("menu_copy_tab_as_markdown_link"),
      contexts: ["all"]
    }, () => { });
    browser.contextMenus.create({
      id: "copy-tab-as-markdown-link-all",
      title: getContextMenuMessage("menu_copy_tab_as_markdown_link_all"),
      contexts: ["all"]
    }, () => { });
    browser.contextMenus.create({
      id: "copy-tab-as-markdown-link-selected",
      title: getContextMenuMessage("menu_copy_tab_as_markdown_link_selected"),
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
        title: getContextMenuMessage("menu_copy_markdown_obsidian"),
        contexts: ["selection"]
      }, () => { });
      browser.contextMenus.create({
        id: "copy-markdown-obsall",
        title: getContextMenuMessage("menu_copy_markdown_obsall"),
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
      title: getContextMenuMessage("menu_toggle_include_template"),
      contexts: ["all"],
      checked: options.includeTemplate
    }, () => { });

    browser.contextMenus.create({
      id: "toggle-downloadImages",
      type: "checkbox",
      title: getContextMenuMessage("menu_toggle_download_images"),
      contexts: ["all"],
      checked: options.downloadImages
    }, () => { });
  }
}
