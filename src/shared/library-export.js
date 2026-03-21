(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory(root);
    return;
  }

  root.markSnipLibraryExport = factory(root);
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

  function padNumber(value) {
    return String(value).padStart(2, '0');
  }

  function createLibraryExportZipFilename(date = new Date(), prefix = 'MarkSnip-library') {
    return [
      prefix,
      `${date.getFullYear()}${padNumber(date.getMonth() + 1)}${padNumber(date.getDate())}-${padNumber(date.getHours())}${padNumber(date.getMinutes())}${padNumber(date.getSeconds())}`
    ].join('-') + '.zip';
  }

  function ensureUniqueLibraryExportPath(filePath, usedPaths) {
    const registry = usedPaths instanceof Set ? usedPaths : new Set();
    let normalized = String(filePath || 'untitled.md').replace(/\\/g, '/').replace(/^\/+/, '');
    if (!normalized.endsWith('.md')) {
      normalized += '.md';
    }

    if (!registry.has(normalized)) {
      registry.add(normalized);
      return normalized;
    }

    const lastDot = normalized.lastIndexOf('.');
    const base = lastDot > 0 ? normalized.substring(0, lastDot) : normalized;
    const ext = lastDot > 0 ? normalized.substring(lastDot) : '';
    let suffix = 2;
    let candidate = `${base} (${suffix})${ext}`;
    while (registry.has(candidate)) {
      suffix += 1;
      candidate = `${base} (${suffix})${ext}`;
    }
    registry.add(candidate);
    return candidate;
  }

  function createLibraryExportFiles(items = [], options = {}) {
    const templateUtils = getTemplateUtils();
    const generateValidFileName = options.generateValidFileName || templateUtils.generateValidFileName || ((value) => value);
    const ensureUniquePath = options.ensureUniquePath || ensureUniqueLibraryExportPath;
    const usedPaths = options.usedPaths instanceof Set ? options.usedPaths : new Set();
    const disallowedChars = options.disallowedChars || null;

    return (Array.isArray(items) ? items : []).map((item) => {
      const normalizedTitle = String(item?.title || '').trim() || 'Untitled';
      const sanitizedTitle = String(generateValidFileName(normalizedTitle, disallowedChars) || '').trim() || 'Untitled';
      const filename = ensureUniquePath(`${sanitizedTitle}.md`, usedPaths);

      return {
        filename,
        content: String(item?.markdown || '')
      };
    });
  }

  return {
    createLibraryExportZipFilename,
    ensureUniqueLibraryExportPath,
    createLibraryExportFiles
  };
});
