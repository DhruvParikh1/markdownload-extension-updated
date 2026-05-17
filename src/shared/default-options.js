// these are the default options
const defaultOptions = {
  headingStyle: "atx",
  hr: "___",
  bulletListMarker: "-",
  codeBlockStyle: "fenced",
  fence: "```",
  preserveCodeFormatting: false,
  autoDetectCodeLanguage: true,
  skipHiddenContent: false,
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
  frontmatter: "---\ncreated: {date:YYYY-MM-DDTHH:mm:ss} (UTC {date:Z})\ntags: [{keywords}]\nsource: {pageURL}\nauthor: {byline}\n---\n\n# {pageTitle}\n\n> ## Excerpt\n> {excerpt}\n\n---",
  backmatter: "",
  title: "{pageTitle}",
  includeTemplate: false,
  saveAs: false,
  downloadImages: false,
  imagePrefix: '{pageTitle}/',
  mdClipsFolder: null,
  disallowedChars: '[]#^',
  disallowedCharReplacement: '',
  downloadMode: 'downloadsApi',
  defaultExportType: 'markdown',
  defaultSendToTarget: 'chatgpt',
  sendToCustomTargets: [],
  sendToMaxUrlLength: 3600,
  defaultWebhookBodyTemplate: JSON.stringify({
    vault: 'Obsidian Vault',
    path: 'Clippings/{title}.md',
    content: '{content}'
  }, null, 2),
  webhookTargets: [],
  turndownEscape: true,
  hashtagHandling: 'keep',
  contextMenus: true,
  batchProcessingEnabled: true,
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
  uiLanguage: 'auto',
  siteRules: [],
}

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
  let options = defaultOptions;
  try {
    options = await browser.storage.sync.get(defaultOptions);
  } catch (err) {
    console.error(err);
  }
  if (options.frontmatter === LEGACY_DEFAULT_FRONTMATTER) {
    options.frontmatter = defaultOptions.frontmatter;
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

if (typeof globalThis !== 'undefined') {
  globalThis.defaultOptions = defaultOptions;
}

if (typeof module === 'object' && module.exports) {
  module.exports = {
    defaultOptions,
    LEGACY_DEFAULT_FRONTMATTER,
    getOptions
  };
}
