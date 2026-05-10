(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory(root);
    return;
  }

  root.markSnipTemplateUtils = factory(root);
})(typeof globalThis !== 'undefined' ? globalThis : this, function (root) {
  function getMomentLibrary() {
    if (typeof root.moment === 'function') {
      return root.moment;
    }

    if (typeof require === 'function') {
      try {
        return require('../background/moment.min.js');
      } catch {
        return null;
      }
    }

    return null;
  }

  function formatDate(now, format) {
    const momentLib = getMomentLibrary();
    if (typeof momentLib === 'function') {
      return momentLib(now).format(format);
    }

    if (format === 'YYYY-MM-DD') {
      const year = now.getFullYear();
      const month = String(now.getMonth() + 1).padStart(2, '0');
      const day = String(now.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    }

    return now.toISOString();
  }

  const ILLEGAL_FILENAME_RE = /[\/\?<>\\:\*\|":]/g;
  const NON_BREAKING_SPACE_RE = new RegExp('\u00A0', 'g');

  function escapeRegExp(value) {
    return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  function normalizeFileNameReplacement(replacement = '') {
    if (!replacement) return '';
    return String(replacement)
      .replace(ILLEGAL_FILENAME_RE, '')
      .replace(NON_BREAKING_SPACE_RE, ' ');
  }

  function generateValidFileName(title, disallowedChars = null, disallowedCharReplacement = '') {
    if (!title) return title;
    title = title + '';

    const replacement = normalizeFileNameReplacement(disallowedCharReplacement);
    let name = title
      .replace(ILLEGAL_FILENAME_RE, () => replacement)
      .replace(NON_BREAKING_SPACE_RE, ' ');

    if (disallowedChars) {
      for (let c of disallowedChars) {
        name = name.replace(new RegExp(escapeRegExp(c), 'g'), () => replacement);
      }
    }

    return name;
  }

  function textReplace(string, article, disallowedChars = null, disallowedCharReplacement = '') {
    const shouldSanitizeValues = disallowedChars !== null && disallowedChars !== undefined;

    for (const key in article) {
      if (Object.prototype.hasOwnProperty.call(article, key) && key !== 'content') {
        let s = (article[key] || '') + '';
        if (s && shouldSanitizeValues) s = generateValidFileName(s, disallowedChars, disallowedCharReplacement);

        string = string.replace(new RegExp('{' + key + '}', 'g'), s)
          .replace(new RegExp('{' + key + ':kebab}', 'g'), s.replace(/ /g, '-').toLowerCase())
          .replace(new RegExp('{' + key + ':snake}', 'g'), s.replace(/ /g, '_').toLowerCase())
          .replace(new RegExp('{' + key + ':camel}', 'g'), s.replace(/ ./g, (str) => str.trim().toUpperCase()).replace(/^./, (str) => str.toLowerCase()))
          .replace(new RegExp('{' + key + ':pascal}', 'g'), s.replace(/ ./g, (str) => str.trim().toUpperCase()).replace(/^./, (str) => str.toUpperCase()));
      }
    }

    const now = new Date();
    const dateRegex = /{date:(.+?)}/g;
    const matches = string.match(dateRegex);
    if (matches && matches.forEach) {
      matches.forEach((match) => {
        const format = match.substring(6, match.length - 1);
        const dateString = formatDate(now, format);
        string = string.replaceAll(match, dateString);
      });
    }

    const keywordRegex = /{keywords:?(.*)?}/g;
    const keywordMatches = string.match(keywordRegex);
    if (keywordMatches && keywordMatches.forEach) {
      keywordMatches.forEach((match) => {
        let separator = match.substring(10, match.length - 1);
        try {
          separator = JSON.parse(JSON.stringify(separator).replace(/\\\\/g, '\\'));
        } catch { }
        const keywordsString = (article.keywords || []).join(separator);
        string = string.replace(new RegExp(match.replace(/\\/g, '\\\\'), 'g'), keywordsString);
      });
    }

    const defaultRegex = /{(.*?)}/g;
    string = string.replace(defaultRegex, '');

    return string;
  }

  return {
    textReplace,
    generateValidFileName
  };
});
