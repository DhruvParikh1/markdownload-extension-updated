/**
 * Template Processing Tests
 * Tests template variable substitution and text replacement functionality
 */

const moment = require('../../background/moment.min.js');
const {
  textReplace,
  generateValidFileName
} = require('../../shared/template-utils');

describe('Template Processing', () => {
  // Mock article data for testing
  const mockArticle = {
    title: 'Test Article Title',
    author: 'John Doe',
    byline: 'By John Doe',
    description: 'A test article description',
    keywords: ['testing', 'markdown', 'clipper'],
    baseURI: 'https://example.com/article',
    pageURL: 'https://example.com/app/123',
    tabURL: 'https://example.com/app/123',
    pagePathname: '/app/123',
    siteName: 'Example Site'
  };

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

    test('should replace {pageURL} and page URL component variables', () => {
      const template = 'Page: {pageURL} Path: {pagePathname}';
      const result = textReplace(template, mockArticle);

      expect(result).toBe('Page: https://example.com/app/123 Path: /app/123');
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
      const today = moment().format('YYYY-MM-DD');

      expect(result).toBe(`Date: ${today}`);
    });

    test('should handle multiple date placeholders', () => {
      const template = 'Created: {date:YYYY-MM-DD}, Modified: {date:YYYY-MM-DD}';
      const result = textReplace(template, mockArticle);
      const today = moment().format('YYYY-MM-DD');

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
      const today = moment().format('YYYY-MM-DD');

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
      expect(result).toContain(`Date: ${moment().format('YYYY-MM-DD')}`);
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
      const today = moment().format('YYYY-MM-DD');

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
      const today = moment().format('YYYY-MM-DD');

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
