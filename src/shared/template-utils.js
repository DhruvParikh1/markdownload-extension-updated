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

  function generateValidFileName(title, disallowedChars = null) {
    if (!title) return title;
    title = title + '';

    const illegalRe = /[\/\?<>\\:\*\|":]/g;
    let name = title.replace(illegalRe, '').replace(new RegExp('\u00A0', 'g'), ' ');

    if (disallowedChars) {
      for (let c of disallowedChars) {
        if (`[\\^$.|?*+()`.includes(c)) c = `\\${c}`;
        name = name.replace(new RegExp(c, 'g'), '');
      }
    }

    return name;
  }

  function textReplace(string, article, disallowedChars = null) {
    for (const key in article) {
      if (Object.prototype.hasOwnProperty.call(article, key) && key !== 'content') {
        let s = (article[key] || '') + '';
        if (s && disallowedChars) s = generateValidFileName(s, disallowedChars);

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
