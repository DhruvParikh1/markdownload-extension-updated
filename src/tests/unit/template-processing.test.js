/**
 * Template Processing Tests
 * Tests template variable substitution and text replacement functionality
 */

describe('Template Processing', () => {
  // Mock article data for testing
  const mockArticle = {
    title: 'Test Article Title',
    author: 'John Doe',
    byline: 'By John Doe',
    description: 'A test article description',
    keywords: ['testing', 'markdown', 'clipper'],
    baseURI: 'https://example.com/article',
    siteName: 'Example Site'
  };

  /**
   * textReplace function - copied from offscreen.js for testing
   * In production, this should be imported from the actual module
   */
  function textReplace(string, article, disallowedChars = null) {
    // Replace article properties
    for (const key in article) {
      if (article.hasOwnProperty(key) && key != "content") {
        let s = (article[key] || '') + '';
        if (s && disallowedChars) s = generateValidFileName(s, disallowedChars);

        string = string.replace(new RegExp('{' + key + '}', 'g'), s)
          .replace(new RegExp('{' + key + ':kebab}', 'g'), s.replace(/ /g, '-').toLowerCase())
          .replace(new RegExp('{' + key + ':snake}', 'g'), s.replace(/ /g, '_').toLowerCase())
          .replace(new RegExp('{' + key + ':camel}', 'g'), s.replace(/ ./g, (str) => str.trim().toUpperCase()).replace(/^./, (str) => str.toLowerCase()))
          .replace(new RegExp('{' + key + ':pascal}', 'g'), s.replace(/ ./g, (str) => str.trim().toUpperCase()).replace(/^./, (str) => str.toUpperCase()));
      }
    }

    // Replace date formats (using a simplified version without moment.js for testing)
    const now = new Date();
    const dateRegex = /{date:(.+?)}/g;
    const matches = string.match(dateRegex);
    if (matches && matches.forEach) {
      matches.forEach(match => {
        const format = match.substring(6, match.length - 1);
        // For testing, use a simple date format
        const dateString = format === 'YYYY-MM-DD'
          ? now.toISOString().split('T')[0]
          : now.toISOString();
        string = string.replaceAll(match, dateString);
      });
    }

    // Replace keywords
    const keywordRegex = /{keywords:?(.*)?}/g;
    const keywordMatches = string.match(keywordRegex);
    if (keywordMatches && keywordMatches.forEach) {
      keywordMatches.forEach(match => {
        let separator = match.substring(10, match.length - 1);
        try {
          separator = JSON.parse(JSON.stringify(separator).replace(/\\\\/g, '\\'));
        } catch { }
        const keywordsString = (article.keywords || []).join(separator);
        string = string.replace(new RegExp(match.replace(/\\/g, '\\\\'), 'g'), keywordsString);
      });
    }

    // Replace anything left in curly braces
    const defaultRegex = /{(.*?)}/g;
    string = string.replace(defaultRegex, '');

    return string;
  }

  /**
   * generateValidFileName function - copied from offscreen.js for testing
   */
  function generateValidFileName(title, disallowedChars = null) {
    if (!title) return title;
    else title = title + '';

    // Remove < > : " / \ | ? *
    var illegalRe = /[\/\?<>\\:\*\|":]/g;
    // And non-breaking spaces
    var name = title.replace(illegalRe, "").replace(new RegExp('\u00A0', 'g'), ' ');

    if (disallowedChars) {
      for (let c of disallowedChars) {
        if (`[\\^$.|?*+()`.includes(c)) c = `\\${c}`;
        name = name.replace(new RegExp(c, 'g'), '');
      }
    }

    return name;
  }

  describe('Basic Variable Substitution', () => {
    test('should replace {title} with article title', () => {
      const template = 'Title: {title}';
      const result = textReplace(template, mockArticle);

      expect(result).toBe('Title: Test Article Title');
    });

    test('should replace {author} with article author', () => {
      const template = 'Author: {author}';
      const result = textReplace(template, mockArticle);

      expect(result).toBe('Author: John Doe');
    });

    test('should replace {baseURI} with article URL', () => {
      const template = 'Source: {baseURI}';
      const result = textReplace(template, mockArticle);

      expect(result).toBe('Source: https://example.com/article');
    });

    test('should replace multiple variables in one template', () => {
      const template = 'Title: {title}\nAuthor: {author}\nURL: {baseURI}';
      const result = textReplace(template, mockArticle);

      expect(result).toContain('Title: Test Article Title');
      expect(result).toContain('Author: John Doe');
      expect(result).toContain('URL: https://example.com/article');
    });

    test('should handle missing article properties', () => {
      const articleWithoutAuthor = { title: 'Test' };
      const template = 'Title: {title}, Author: {author}';
      const result = textReplace(template, articleWithoutAuthor);

      expect(result).toBe('Title: Test, Author: ');
    });

    test('should remove unknown variables', () => {
      const template = 'Title: {title}, Unknown: {unknownVar}';
      const result = textReplace(template, mockArticle);

      expect(result).toBe('Title: Test Article Title, Unknown: ');
    });
  });

  describe('Case Transformation', () => {
    test('should convert title to kebab-case', () => {
      const template = '{title:kebab}';
      const result = textReplace(template, mockArticle);

      expect(result).toBe('test-article-title');
    });

    test('should convert title to snake_case', () => {
      const template = '{title:snake}';
      const result = textReplace(template, mockArticle);

      expect(result).toBe('test_article_title');
    });

    test('should convert title to camelCase', () => {
      const template = '{title:camel}';
      const result = textReplace(template, mockArticle);

      expect(result).toBe('testArticleTitle');
    });

    test('should convert title to PascalCase', () => {
      const template = '{title:pascal}';
      const result = textReplace(template, mockArticle);

      expect(result).toBe('TestArticleTitle');
    });

    test('should support multiple case transformations', () => {
      const template = 'kebab: {title:kebab}, snake: {title:snake}';
      const result = textReplace(template, mockArticle);

      expect(result).toContain('kebab: test-article-title');
      expect(result).toContain('snake: test_article_title');
    });
  });

  describe('Date Formatting', () => {
    test('should replace {date:YYYY-MM-DD} with current date', () => {
      const template = 'Date: {date:YYYY-MM-DD}';
      const result = textReplace(template, mockArticle);
      const today = new Date().toISOString().split('T')[0];

      expect(result).toBe(`Date: ${today}`);
    });

    test('should handle multiple date placeholders', () => {
      const template = 'Created: {date:YYYY-MM-DD}, Modified: {date:YYYY-MM-DD}';
      const result = textReplace(template, mockArticle);
      const today = new Date().toISOString().split('T')[0];

      expect(result).toBe(`Created: ${today}, Modified: ${today}`);
    });
  });

  describe('Keywords Formatting', () => {
    test('should replace {keywords} with comma-separated list', () => {
      const template = 'Tags: {keywords}';
      const result = textReplace(template, mockArticle);

      // Default separator is comma without space
      expect(result).toBe('Tags: testing,markdown,clipper');
    });

    test('should handle empty keywords array', () => {
      const articleNoKeywords = { ...mockArticle, keywords: [] };
      const template = 'Tags: {keywords}';
      const result = textReplace(template, articleNoKeywords);

      expect(result).toBe('Tags: ');
    });

    test('should handle missing keywords property', () => {
      const articleNoKeywords = { title: 'Test' };
      const template = 'Tags: {keywords}';
      const result = textReplace(template, articleNoKeywords);

      expect(result).toBe('Tags: ');
    });
  });

  describe('Front Matter Templates', () => {
    test('should generate valid YAML front matter', () => {
      const frontmatter = `---
title: {title}
author: {author}
source: {baseURI}
tags: [{keywords}]
---`;

      const result = textReplace(frontmatter, mockArticle);

      expect(result).toContain('title: Test Article Title');
      expect(result).toContain('author: John Doe');
      expect(result).toContain('source: https://example.com/article');
      expect(result).toContain('tags: [testing,markdown,clipper]');
    });

    test('should generate front matter with date', () => {
      const frontmatter = `---
title: {title}
date: {date:YYYY-MM-DD}
---`;

      const result = textReplace(frontmatter, mockArticle);
      const today = new Date().toISOString().split('T')[0];

      expect(result).toContain('title: Test Article Title');
      expect(result).toContain(`date: ${today}`);
    });
  });

  describe('Back Matter Templates', () => {
    test('should generate valid back matter', () => {
      const backmatter = `

---
*Clipped from: {baseURI}*
*Date: {date:YYYY-MM-DD}*`;

      const result = textReplace(backmatter, mockArticle);

      expect(result).toContain('Clipped from: https://example.com/article');
      expect(result).toContain(`Date: ${new Date().toISOString().split('T')[0]}`);
    });
  });

  describe('Filename Generation', () => {
    test('should remove illegal filename characters', () => {
      const filename = 'Test/File:Name*With?Illegal<Chars>';
      const result = generateValidFileName(filename);

      expect(result).toBe('TestFileNameWithIllegalChars');
      expect(result).not.toContain('/');
      expect(result).not.toContain(':');
      expect(result).not.toContain('*');
      expect(result).not.toContain('?');
      expect(result).not.toContain('<');
      expect(result).not.toContain('>');
    });

    test('should remove disallowed custom characters', () => {
      const filename = 'Test [File] #Name ^With Special';
      const result = generateValidFileName(filename, '[]#^');

      expect(result).toBe('Test File Name With Special');
      expect(result).not.toContain('[');
      expect(result).not.toContain(']');
      expect(result).not.toContain('#');
      expect(result).not.toContain('^');
    });

    test('should remove non-breaking spaces', () => {
      const filename = `Test\u00A0File\u00A0Name`;
      const result = generateValidFileName(filename);

      expect(result).toBe('Test File Name');
    });

    test('should handle empty filename', () => {
      const result = generateValidFileName('');

      expect(result).toBe('');
    });

    test('should handle null filename', () => {
      const result = generateValidFileName(null);

      expect(result).toBeNull();
    });
  });

  describe('Title Formatting', () => {
    test('should format title with template', () => {
      const titleTemplate = '{title}';
      const result = textReplace(titleTemplate, mockArticle);

      expect(result).toBe('Test Article Title');
    });

    test('should format title with date', () => {
      const titleTemplate = '{title} - {date:YYYY-MM-DD}';
      const result = textReplace(titleTemplate, mockArticle);
      const today = new Date().toISOString().split('T')[0];

      expect(result).toBe(`Test Article Title - ${today}`);
    });

    test('should format title with site name', () => {
      const titleTemplate = '{title} - {siteName}';
      const result = textReplace(titleTemplate, mockArticle);

      expect(result).toBe('Test Article Title - Example Site');
    });

    test('should remove illegal characters from formatted title', () => {
      const articleWithIllegalChars = {
        ...mockArticle,
        title: 'Test: Article <Title> With/Illegal*Chars'
      };
      const titleTemplate = '{title}';
      const result = textReplace(titleTemplate, articleWithIllegalChars, '[]#^/');
      const cleaned = generateValidFileName(result, '[]#^/');

      expect(cleaned).not.toContain(':');
      expect(cleaned).not.toContain('<');
      expect(cleaned).not.toContain('>');
      expect(cleaned).not.toContain('/');
      expect(cleaned).not.toContain('*');
    });
  });

  describe('Complex Templates', () => {
    test('should handle complex multi-line template', () => {
      const template = `---
title: {title}
author: {author}
url: {baseURI}
date: {date:YYYY-MM-DD}
tags: [{keywords}]
slug: {title:kebab}
---

# {title}

Source: {baseURI}`;

      const result = textReplace(template, mockArticle);
      const today = new Date().toISOString().split('T')[0];

      expect(result).toContain('title: Test Article Title');
      expect(result).toContain('author: John Doe');
      expect(result).toContain('url: https://example.com/article');
      expect(result).toContain(`date: ${today}`);
      expect(result).toContain('tags: [testing,markdown,clipper]');
      expect(result).toContain('slug: test-article-title');
      expect(result).toContain('# Test Article Title');
      expect(result).toContain('Source: https://example.com/article');
    });

    test('should handle template with all transformation types', () => {
      const template = `
Title: {title}
Kebab: {title:kebab}
Snake: {title:snake}
Camel: {title:camel}
Pascal: {title:pascal}
Author: {author}
Tags: {keywords}
Date: {date:YYYY-MM-DD}
URL: {baseURI}
`;

      const result = textReplace(template, mockArticle);

      expect(result).toContain('Title: Test Article Title');
      expect(result).toContain('Kebab: test-article-title');
      expect(result).toContain('Snake: test_article_title');
      expect(result).toContain('Camel: testArticleTitle');
      expect(result).toContain('Pascal: TestArticleTitle');
      expect(result).toContain('Author: John Doe');
      expect(result).toContain('Tags: testing,markdown,clipper');
      expect(result).toContain('URL: https://example.com/article');
    });
  });
});
