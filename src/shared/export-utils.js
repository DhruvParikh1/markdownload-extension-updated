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

  function createRemoteSourceImageMap(imageList = {}) {
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

  function prepareMarkdownForRemoteImages(markdown, sourceImageMap = {}) {
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

  function stripRenderedWrappers(markdown, renderedFrontmatter = '', renderedBackmatter = '') {
    if (typeof markdown !== 'string' || markdown.length === 0) {
      return markdown;
    }

    let nextMarkdown = markdown;

    if (renderedFrontmatter && nextMarkdown.startsWith(renderedFrontmatter)) {
      nextMarkdown = nextMarkdown.slice(renderedFrontmatter.length);
    }

    if (renderedBackmatter && nextMarkdown.endsWith(renderedBackmatter)) {
      nextMarkdown = nextMarkdown.slice(0, -renderedBackmatter.length);
    }

    return nextMarkdown;
  }

  const api = {
    createRemoteSourceImageMap,
    encodePathSegments,
    getBasename,
    isUrlLike,
    normalizeTarget,
    prepareMarkdownForRemoteImages,
    resolveImageTarget,
    stripRenderedWrappers,
    tryDecodeUri
  };

  root.markSnipExportUtils = api;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
})(typeof globalThis !== 'undefined' ? globalThis : this);
