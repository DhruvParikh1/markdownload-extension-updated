function getI18nApi() {
  return globalThis.markSnipI18n || null;
}

function buildDefaultFrontmatter(i18nApi = getI18nApi()) {
  const excerptLabel = i18nApi?.getMessage?.('options_template_preview_excerpt_heading') || 'Excerpt';
  return `---\ncreated: {date:YYYY-MM-DDTHH:mm:ss} (UTC {date:Z})\ntags: [{keywords}]\nsource: {pageURL}\nauthor: {byline}\n---\n\n# {pageTitle}\n\n> ## ${excerptLabel}\n> {excerpt}\n\n---`;
}

function createDefaultOptions(i18nApi = getI18nApi()) {
  return {
    headingStyle: "atx",
    hr: "___",
    bulletListMarker: "-",
    codeBlockStyle: "fenced",
    fence: "```",
    preserveCodeFormatting: false,
    autoDetectCodeLanguage: true,
    emDelimiter: "_",
    strongDelimiter: "**",
    linkStyle: "inlined",
    linkReferenceStyle: "full",
    imageStyle: "markdown",
    imageRefStyle: "inlined",
    tableFormatting: {
      stripLinks: true,
      stripFormatting: false,
      prettyPrint: true,
      centerText: true
    },
    frontmatter: buildDefaultFrontmatter(i18nApi),
    backmatter: "",
    title: "{pageTitle}",
    includeTemplate: false,
    saveAs: false,
    downloadImages: false,
    imagePrefix: '{pageTitle}/',
    mdClipsFolder: null,
    disallowedChars: '[]#^',
    downloadMode: 'downloadsApi',
    defaultExportType: 'markdown',
    defaultSendToTarget: 'chatgpt',
    sendToCustomTargets: [],
    sendToMaxUrlLength: 3600,
    turndownEscape: true,
    hashtagHandling: 'keep',
    contextMenus: true,
    batchProcessingEnabled: true,
    uiLanguage: 'browser',
    obsidianIntegration: false,
    obsidianVault: "",
    obsidianFolder: "",
    popupTheme: 'system',
    specialTheme: 'none',
    colorBlindTheme: 'deuteranopia',
    specialThemeIcon: true,
    popupAccent: 'sage',
    compactMode: false,
    showThemeToggleInPopup: true,
    showUserGuideIcon: true,
    editorTheme: 'default',
    siteRules: [],
  };
}

const defaultOptions = createDefaultOptions();
globalThis.defaultOptions = defaultOptions;

const LEGACY_DEFAULT_FRONTMATTER = "---\ncreated: {date:YYYY-MM-DDTHH:mm:ss} (UTC {date:Z})\ntags: [{keywords}]\nsource: {baseURI}\nauthor: {byline}\n---\n\n# {pageTitle}\n\n> ## Excerpt\n> {excerpt}\n\n---";

function getSiteRulesApi() {
  if (globalThis.markSnipSiteRules) {
    return globalThis.markSnipSiteRules;
  }

  if (typeof require === 'function') {
    try {
      return require('./site-rules');
    } catch {
      return null;
    }
  }

  return null;
}

// function to get the options from storage and substitute default options if it fails
async function getOptions() {
  const defaults = createDefaultOptions();
  let options = defaults;
  try {
    options = await browser.storage.sync.get(defaults);
  } catch (err) {
    console.error(err);
  }
  if (options.frontmatter === LEGACY_DEFAULT_FRONTMATTER) {
    options.frontmatter = defaults.frontmatter;
  }
  const siteRulesApi = getSiteRulesApi();
  if (siteRulesApi?.normalizeSiteRules) {
    options.siteRules = siteRulesApi.normalizeSiteRules(options.siteRules);
  } else if (!Array.isArray(options.siteRules)) {
    options.siteRules = [];
  }
  if (!browser.downloads) options.downloadMode = 'contentLink';
  return options;
}
