(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory(root);
    return;
  }

  root.markSnipUrlUtils = factory(root);
})(typeof globalThis !== 'undefined' ? globalThis : this, function (root) {
  function getTemplateUtils() {
    if (root.markSnipTemplateUtils) {
      return root.markSnipTemplateUtils;
    }

    if (typeof require === 'function') {
      try {
        return require('./template-utils');
      } catch {
        return {
          generateValidFileName: (value) => value
        };
      }
    }

    return {
      generateValidFileName: (value) => value
    };
  }

  function safeParseUrl(urlString) {
    try {
      return new URL(urlString);
    } catch {
      return null;
    }
  }

  function resolveArticleUrl(domBaseUri, pageUrl) {
    const normalizedPageUrl = typeof pageUrl === 'string' ? pageUrl.trim() : '';
    const preferredUrl = normalizedPageUrl ? safeParseUrl(normalizedPageUrl) : null;
    if (preferredUrl) {
      return preferredUrl;
    }
    return safeParseUrl(domBaseUri);
  }

  function validateUri(href, baseURI) {
    try {
      new URL(href);
    } catch {
      const baseUri = new URL(baseURI);

      if (href.startsWith('/')) {
        href = baseUri.origin + href;
      } else {
        href = baseUri.href + (baseUri.href.endsWith('/') ? '' : '/') + href;
      }
    }
    return href;
  }

  function getImageFilename(src, options, prependFilePath = true) {
    const templateUtils = getTemplateUtils();
    const generateValidFileName = templateUtils.generateValidFileName;
    const effectiveOptions = options || {};

    const slashPos = src.lastIndexOf('/');
    const queryPos = src.indexOf('?');
    let filename = src.substring(slashPos + 1, queryPos > 0 ? queryPos : src.length);

    let imagePrefix = (effectiveOptions.imagePrefix || '');
    const title = String(effectiveOptions.title || '');

    if (prependFilePath && title.includes('/')) {
      imagePrefix = title.substring(0, title.lastIndexOf('/') + 1) + imagePrefix;
    } else if (prependFilePath) {
      imagePrefix = title + (imagePrefix.startsWith('/') ? '' : '/') + imagePrefix;
    }

    if (filename.includes(';base64,')) {
      filename = 'image.' + filename.substring(0, filename.indexOf(';'));
    }

    const extension = filename.substring(filename.lastIndexOf('.'));
    if (extension === filename) {
      filename = filename + '.idunno';
    }

    filename = generateValidFileName(filename, effectiveOptions.disallowedChars);

    return imagePrefix + filename;
  }

  return {
    safeParseUrl,
    resolveArticleUrl,
    validateUri,
    getImageFilename
  };
});
