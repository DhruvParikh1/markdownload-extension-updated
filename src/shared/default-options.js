// these are the default options
const defaultOptions = {
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
  frontmatter: "---\ncreated: {date:YYYY-MM-DDTHH:mm:ss} (UTC {date:Z})\ntags: [{keywords}]\nsource: {baseURI}\nauthor: {byline}\n---\n\n# {pageTitle}\n\n> ## Excerpt\n> {excerpt}\n\n---",
  backmatter: "",
  title: "{pageTitle}",
  includeTemplate: false,
  saveAs: false,
  downloadImages: false,
  imagePrefix: '{pageTitle}/',
  mdClipsFolder: null,
  disallowedChars: '[]#^',
  downloadMode: 'downloadsApi',
  turndownEscape: true,
  hashtagHandling: 'keep',
  contextMenus: true,
  obsidianIntegration: false,
  obsidianVault: "",
  obsidianFolder: "",
  popupTheme: 'system',
  popupAccent: 'sage',
  compactMode: false,
  editorTheme: 'default',
}

// function to get the options from storage and substitute default options if it fails
async function getOptions() {
  let options = defaultOptions;
  try {
    options = await browser.storage.sync.get(defaultOptions);
  } catch (err) {
    console.error(err);
  }
  if (!browser.downloads) options.downloadMode = 'contentLink';
  return options;
}
