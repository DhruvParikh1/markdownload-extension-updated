/**
 * Mirrors offscreen option normalization for markdown conversion.
 */

function textReplace(template, article, disallowedChars = '') {
  return String(template || '')
    .replaceAll('{pageTitle}', article.pageTitle || '')
    .replaceAll('{title}', article.title || '')
    .replaceAll('{byline}', article.byline || '')
    .replaceAll('{excerpt}', article.excerpt || '')
    .replaceAll('{pageURL}', article.pageURL || '')
    .replaceAll('{baseURI}', article.baseURI || '')
    .replaceAll('{keywords}', Array.isArray(article.keywords) ? article.keywords.join(', ') : '')
    .replaceAll('{date:YYYY-MM-DD}', '2026-03-14')
    .replace(new RegExp(`[${disallowedChars.replace(/[[\]\\^$.|?*+(){}-]/g, '\\$&')}]`, 'g'), '');
}

function generateValidFileName(title, disallowedChars = null) {
  if (!title) return title;

  let name = String(title).replace(/[\/\?<>\\:\*\|":]/g, '').replace(/\u00A0/g, ' ');

  if (disallowedChars) {
    for (let c of disallowedChars) {
      if (`[\\^$.|?*+()`.includes(c)) c = `\\${c}`;
      name = name.replace(new RegExp(c, 'g'), '');
    }
  }

  return name;
}

function createEffectiveMarkdownOptions(article, providedOptions = null, downloadImages = null) {
  const baseOptions = providedOptions;
  const options = {
    ...baseOptions,
    tableFormatting: baseOptions.tableFormatting
      ? { ...baseOptions.tableFormatting }
      : baseOptions.tableFormatting
  };

  if (downloadImages != null) {
    options.downloadImages = downloadImages;
  }

  if (options.includeTemplate) {
    options.frontmatter = textReplace(options.frontmatter, article) + '\n';
    options.backmatter = '\n' + textReplace(options.backmatter, article);
  } else {
    options.frontmatter = '';
    options.backmatter = '';
  }

  options.imagePrefix = textReplace(options.imagePrefix, article, options.disallowedChars)
    .split('/')
    .map(segment => generateValidFileName(segment, options.disallowedChars))
    .join('/');

  return options;
}

describe('Offscreen markdown option handling', () => {
  const article = {
    title: 'Article Title',
    pageTitle: 'Doc/Page Title',
    excerpt: 'A summary',
    byline: 'Author Name',
    pageURL: 'https://example.com/docs/page',
    baseURI: 'https://example.com/docs/page',
    keywords: ['docs', 'markdown']
  };

  test('creates a derived options object without mutating the caller options', () => {
    const originalOptions = {
      includeTemplate: false,
      downloadImages: true,
      frontmatter: 'front',
      backmatter: 'back',
      imagePrefix: '{pageTitle}/assets',
      disallowedChars: '[]#^',
      tableFormatting: {
        stripLinks: true,
        prettyPrint: true
      }
    };

    const snapshot = JSON.parse(JSON.stringify(originalOptions));
    const derivedOptions = createEffectiveMarkdownOptions(article, originalOptions, false);

    expect(derivedOptions).not.toBe(originalOptions);
    expect(derivedOptions.tableFormatting).not.toBe(originalOptions.tableFormatting);
    expect(derivedOptions.downloadImages).toBe(false);
    expect(derivedOptions.frontmatter).toBe('');
    expect(derivedOptions.backmatter).toBe('');
    expect(derivedOptions.imagePrefix).toBe('Doc/Page Title/assets');
    expect(originalOptions).toEqual(snapshot);
  });

  test('expands templated fields on the derived copy only', () => {
    const originalOptions = {
      includeTemplate: true,
      downloadImages: false,
      frontmatter: 'title: {pageTitle}',
      backmatter: 'source: {pageURL}',
      imagePrefix: '{pageTitle}/images',
      disallowedChars: '[]#^',
      tableFormatting: {
        stripLinks: true
      }
    };

    const derivedOptions = createEffectiveMarkdownOptions(article, originalOptions, null);

    expect(derivedOptions.frontmatter).toBe('title: Doc/Page Title\n');
    expect(derivedOptions.backmatter).toBe('\nsource: https://example.com/docs/page');
    expect(derivedOptions.imagePrefix).toBe('Doc/Page Title/images');
    expect(originalOptions.frontmatter).toBe('title: {pageTitle}');
    expect(originalOptions.backmatter).toBe('source: {pageURL}');
    expect(originalOptions.imagePrefix).toBe('{pageTitle}/images');
  });
});
