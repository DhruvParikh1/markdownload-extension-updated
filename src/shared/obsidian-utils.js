(function(root) {
  function encodePathSegments(path) {
    return String(path || '')
      .split('/')
      .map(segment => encodeURI(segment))
      .join('/');
  }

  function getBasename(path) {
    const parts = String(path || '').split('/');
    return parts[parts.length - 1] || '';
  }

  function tryDecodeUri(value) {
    try {
      return decodeURI(value);
    } catch {
      return value;
    }
  }

  function isUrlLike(value) {
    return /^(?:[a-z][a-z0-9+.-]*:|\/\/)/i.test(value);
  }

  function normalizeTarget(target) {
    return String(target || '').trim().replace(/^<|>$/g, '');
  }

  function resolveImageTarget(target, sourceImageMap = {}) {
    const normalized = normalizeTarget(target);
    if (!normalized) return null;

    if (sourceImageMap[normalized]) {
      return sourceImageMap[normalized];
    }

    const decoded = tryDecodeUri(normalized);
    if (sourceImageMap[decoded]) {
      return sourceImageMap[decoded];
    }

    if (isUrlLike(normalized)) {
      return normalized;
    }

    return null;
  }

  function getObsidianTransportOptions(options = {}) {
    const nextOptions = {
      ...options,
      downloadImages: false
    };

    if (nextOptions.imageStyle !== 'noImage') {
      nextOptions.imageStyle = 'markdown';
    }

    return nextOptions;
  }

  const DEFAULT_OBSIDIAN_DATA_URI_MAX_LENGTH = 6000;

  function ensureMarkdownExtension(title) {
    const value = String(title || 'Untitled').trim() || 'Untitled';
    return value.endsWith('.md') ? value : `${value}.md`;
  }

  function buildObsidianFilepath(folder, title) {
    let folderPath = String(folder || '');
    if (folderPath && !folderPath.endsWith('/')) {
      folderPath += '/';
    }

    return folderPath + ensureMarkdownExtension(title);
  }

  function encodeQueryParameter(key, value) {
    return `${encodeURIComponent(key)}=${encodeURIComponent(String(value ?? ''))}`;
  }

  function buildAdvancedUri(parameters) {
    return `obsidian://adv-uri?${Object.entries(parameters)
      .map(([key, value]) => encodeQueryParameter(key, value))
      .join('&')}`;
  }

  function createObsidianAdvancedUri({
    vault = '',
    folder = '',
    title = 'Untitled',
    markdown = '',
    maxDataUriLength = DEFAULT_OBSIDIAN_DATA_URI_MAX_LENGTH
  } = {}) {
    const filepath = buildObsidianFilepath(folder, title);
    const baseParameters = {
      vault,
      filepath,
      mode: 'new'
    };

    const dataUri = buildAdvancedUri({
      ...baseParameters,
      data: markdown
    });

    if (markdown && dataUri.length <= maxDataUriLength) {
      return {
        uri: dataUri,
        transport: 'data',
        filepath,
        length: dataUri.length
      };
    }

    const clipboardUri = buildAdvancedUri({
      ...baseParameters,
      clipboard: 'true'
    });

    return {
      uri: clipboardUri,
      transport: 'clipboard',
      filepath,
      length: clipboardUri.length
    };
  }

  function createObsidianSourceImageMap(imageList = {}) {
    const sourceImageMap = {};

    for (const [src, filename] of Object.entries(imageList || {})) {
      if (!src || !filename) continue;

      sourceImageMap[filename] = src;
      sourceImageMap[encodePathSegments(filename)] = src;

      const basename = getBasename(filename);
      if (basename) {
        sourceImageMap[basename] = src;
        sourceImageMap[encodeURI(basename)] = src;
      }
    }

    return sourceImageMap;
  }

  function prepareMarkdownForObsidian(markdown, sourceImageMap = {}) {
    if (typeof markdown !== 'string' || markdown.length === 0) {
      return markdown;
    }

    let nextMarkdown = markdown;

    nextMarkdown = nextMarkdown.replace(/!\[\[([^\]\|]+)(?:\|[^\]]+)?\]\]/g, (match, target) => {
      const resolved = resolveImageTarget(target, sourceImageMap);
      return resolved ? `![](${resolved})` : match;
    });

    nextMarkdown = nextMarkdown.replace(/!\[([^\]]*)\]\(([^)\s]+)([^)]*)\)/g, (match, alt, target, suffix) => {
      const resolved = resolveImageTarget(target, sourceImageMap);
      return resolved ? `![${alt}](${resolved}${suffix || ''})` : match;
    });

    nextMarkdown = nextMarkdown.replace(/^(\[[^\]]+\]:\s*)(\S+)(.*)$/gm, (match, prefix, target, suffix) => {
      const resolved = resolveImageTarget(target, sourceImageMap);
      return resolved ? `${prefix}${resolved}${suffix}` : match;
    });

    return nextMarkdown;
  }

  const api = {
    DEFAULT_OBSIDIAN_DATA_URI_MAX_LENGTH,
    buildObsidianFilepath,
    createObsidianAdvancedUri,
    createObsidianSourceImageMap,
    getObsidianTransportOptions,
    prepareMarkdownForObsidian
  };

  root.markSnipObsidian = api;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
})(typeof globalThis !== 'undefined' ? globalThis : this);
