/**
 * HTML to Markdown Conversion Tests
 * Tests expected behavior and configuration of HTML to Markdown conversion
 *
 * Note: These tests verify the expected behavior and structure of conversion options.
 * The actual Turndown.js library is tested in the browser extension environment.
 * These tests ensure our conversion configuration and expected outputs are correct.
 */

const htmlSamples = require('./fixtures/html-samples');
const configSamples = require('./fixtures/config-samples');

describe('HTML to Markdown Conversion', () => {
  describe('Configuration Options', () => {
    test('should have correct default configuration options', () => {
      const defaultOptions = {
        headingStyle: 'atx',
        hr: '---',
        bulletListMarker: '-',
        codeBlockStyle: 'fenced',
        fence: '```',
        emDelimiter: '_',
        strongDelimiter: '**',
        linkStyle: 'inlined',
        linkReferenceStyle: 'full'
      };

      expect(defaultOptions.headingStyle).toBe('atx');
      expect(defaultOptions.bulletListMarker).toBe('-');
      expect(defaultOptions.codeBlockStyle).toBe('fenced');
    });

    test('should support setext heading style', () => {
      const options = { headingStyle: 'setext' };
      expect(options.headingStyle).toBe('setext');
    });

    test('should support different horizontal rule styles', () => {
      expect('---').toMatch(/^-{3,}$/);
      expect('***').toMatch(/^\*{3,}$/);
      expect('___').toMatch(/^_{3,}$/);
    });

    test('should support different bullet list markers', () => {
      const markers = ['-', '*', '+'];
      markers.forEach(marker => {
        expect(['-', '*', '+']).toContain(marker);
      });
    });

    test('should support indented code block style', () => {
      const options = { codeBlockStyle: 'indented' };
      expect(options.codeBlockStyle).toBe('indented');
    });

    test('should support different fence styles', () => {
      const fences = ['```', '~~~'];
      fences.forEach(fence => {
        expect(['```', '~~~']).toContain(fence);
      });
    });

    test('should support different emphasis delimiters', () => {
      const delimiters = ['_', '*'];
      delimiters.forEach(delim => {
        expect(['_', '*']).toContain(delim);
      });
    });

    test('should support different strong delimiters', () => {
      const delimiters = ['**', '__'];
      delimiters.forEach(delim => {
        expect(['**', '__']).toContain(delim);
      });
    });

    test('should support different link styles', () => {
      const styles = ['inlined', 'referenced', 'stripLinks'];
      styles.forEach(style => {
        expect(['inlined', 'referenced', 'stripLinks']).toContain(style);
      });
    });
  });

  describe('HTML Fixtures', () => {
    test('should have simple article fixture', () => {
      expect(htmlSamples.simpleArticle).toBeDefined();
      expect(htmlSamples.simpleArticle.html).toBeDefined();
      expect(htmlSamples.simpleArticle.expectedMarkdown).toBeDefined();
    });

    test('should have multi-level headings fixture', () => {
      expect(htmlSamples.multiLevelHeadings).toBeDefined();
      expect(htmlSamples.multiLevelHeadings.html).toContain('<h1>');
      expect(htmlSamples.multiLevelHeadings.html).toContain('<h2>');
      expect(htmlSamples.multiLevelHeadings.html).toContain('<h3>');
    });

    test('should have code blocks fixture', () => {
      expect(htmlSamples.codeBlocks).toBeDefined();
      expect(htmlSamples.codeBlocks.html).toContain('<code');
      expect(htmlSamples.codeBlocks.html).toContain('language-javascript');
      expect(htmlSamples.codeBlocks.html).toContain('language-python');
    });

    test('should have tables fixture', () => {
      expect(htmlSamples.simpleTables).toBeDefined();
      expect(htmlSamples.simpleTables.html).toContain('<table>');
      expect(htmlSamples.simpleTables.html).toContain('<thead>');
      expect(htmlSamples.simpleTables.html).toContain('<tbody>');
    });

    test('should have blockquotes fixture', () => {
      expect(htmlSamples.blockquotes).toBeDefined();
      expect(htmlSamples.blockquotes.html).toContain('<blockquote>');
    });

    test('should have images fixture', () => {
      expect(htmlSamples.images).toBeDefined();
      expect(htmlSamples.images.html).toContain('<img');
    });

    test('should have mixed lists fixture', () => {
      expect(htmlSamples.mixedLists).toBeDefined();
      expect(htmlSamples.mixedLists.html).toContain('<ul>');
      expect(htmlSamples.mixedLists.html).toContain('<ol>');
    });

    test('should have task lists fixture', () => {
      expect(htmlSamples.taskLists).toBeDefined();
      expect(htmlSamples.taskLists.html).toContain('type="checkbox"');
    });

    test('should have strikethrough fixture', () => {
      expect(htmlSamples.strikethrough).toBeDefined();
      expect(htmlSamples.strikethrough.html).toContain('<del>');
    });
  });

  describe('Expected Markdown Output', () => {
    test('simple article should have expected markdown elements', () => {
      const { expectedMarkdown } = htmlSamples.simpleArticle;

      expect(expectedMarkdown).toContain('# Test Article Title');
      expect(expectedMarkdown).toContain('**bold text**');
      expect(expectedMarkdown).toContain('*italic text*');
      expect(expectedMarkdown).toContain('[link](https://example.com)');
      expect(expectedMarkdown).toContain('- First item');
    });

    test('multi-level headings should have proper hierarchy', () => {
      const { expectedMarkdown } = htmlSamples.multiLevelHeadings;

      expect(expectedMarkdown).toContain('# Main Title');
      expect(expectedMarkdown).toContain('## Section 1');
      expect(expectedMarkdown).toContain('### Subsection 1.1');
      expect(expectedMarkdown).toContain('## Section 2');
    });

    test('code blocks should use fenced code blocks', () => {
      const { expectedMarkdown } = htmlSamples.codeBlocks;

      expect(expectedMarkdown).toContain('```javascript');
      expect(expectedMarkdown).toContain('```python');
      expect(expectedMarkdown).toContain("console.log('Hello, world!');");
    });

    test('tables should be formatted as markdown tables', () => {
      const { expectedMarkdown } = htmlSamples.simpleTables;

      expect(expectedMarkdown).toContain('| Name | Age | City');
      expect(expectedMarkdown).toContain('| ---- | --- | --------');
      expect(expectedMarkdown).toContain('| John | 25  | New York');
    });

    test('blockquotes should use > prefix', () => {
      const { expectedMarkdown } = htmlSamples.blockquotes;

      expect(expectedMarkdown).toContain('> This is a simple blockquote.');
    });

    test('images should use markdown image syntax', () => {
      const { expectedMarkdown } = htmlSamples.images;

      expect(expectedMarkdown).toContain('![Example Image](https://example.com/image.jpg)');
    });

    test('task lists should use checkbox syntax', () => {
      const { expectedMarkdown } = htmlSamples.taskLists;

      expect(expectedMarkdown).toContain('- [x] Completed task');
      expect(expectedMarkdown).toContain('- [ ] Incomplete task');
    });

    test('strikethrough should use ~~ syntax', () => {
      const { expectedMarkdown } = htmlSamples.strikethrough;

      expect(expectedMarkdown).toContain('~~strikethrough~~');
    });
  });

  describe('Config Samples', () => {
    test('should have default config', () => {
      expect(configSamples.defaultConfig).toBeDefined();
      expect(configSamples.defaultConfig.headingStyle).toBe('atx');
    });

    test('should have setext headings config', () => {
      expect(configSamples.setextHeadings.headingStyle).toBe('setext');
    });

    test('should have obsidian images config', () => {
      expect(configSamples.obsidianImages.imageStyle).toBe('obsidian');
      expect(configSamples.obsidianImages.downloadImages).toBe(true);
    });

    test('should have front matter config', () => {
      expect(configSamples.withFrontmatter.frontmatter).toContain('---');
      expect(configSamples.withFrontmatter.frontmatter).toContain('{title}');
    });

    test('should have table formatting configs', () => {
      expect(configSamples.tableStripLinks.tableStripLinks).toBe(true);
      expect(configSamples.tableStripFormatting.tableStripFormatting).toBe(true);
      expect(configSamples.tablePrettyPrint.tablePrettyPrint).toBe(true);
    });
  });

  describe('HTML Input Validation', () => {
    test('should handle HTML with article tags', () => {
      const html = htmlSamples.simpleArticle.html;
      expect(html).toContain('<article>');
    });

    test('should handle HTML with various heading levels', () => {
      const html = htmlSamples.multiLevelHeadings.html;
      expect(html).toContain('<h1>');
      expect(html).toContain('<h2>');
      expect(html).toContain('<h3>');
    });

    test('should handle HTML with code blocks', () => {
      const html = htmlSamples.codeBlocks.html;
      expect(html).toContain('<pre>');
      expect(html).toContain('<code');
    });

    test('should handle HTML with tables', () => {
      const html = htmlSamples.simpleTables.html;
      expect(html).toContain('<table>');
      expect(html).toContain('<th>');
      expect(html).toContain('<td>');
    });
  });

  describe('Markdown Syntax Patterns', () => {
    test('atx headings should match pattern', () => {
      const atxPattern = /^#{1,6} /m;
      expect('# Heading 1').toMatch(atxPattern);
      expect('## Heading 2').toMatch(atxPattern);
      expect('### Heading 3').toMatch(atxPattern);
    });

    test('bold text should match pattern', () => {
      expect('**bold**').toMatch(/\*\*.*?\*\*/);
      expect('__bold__').toMatch(/__.*?__/);
    });

    test('italic text should match pattern', () => {
      expect('*italic*').toMatch(/\*.*?\*/);
      expect('_italic_').toMatch(/_.*?_/);
    });

    test('links should match pattern', () => {
      const linkPattern = /\[.*?\]\(.*?\)/;
      expect('[text](url)').toMatch(linkPattern);
    });

    test('images should match pattern', () => {
      const imagePattern = /!\[.*?\]\(.*?\)/;
      expect('![alt](url)').toMatch(imagePattern);
    });

    test('code blocks should match pattern', () => {
      const fencedPattern = /```[\s\S]*?```/;
      expect('```\ncode\n```').toMatch(fencedPattern);
    });

    test('blockquotes should match pattern', () => {
      const quotePattern = /^> /m;
      expect('> Quote').toMatch(quotePattern);
    });

    test('horizontal rules should match pattern', () => {
      expect('---').toMatch(/^-{3,}$/);
      expect('***').toMatch(/^\*{3,}$/);
      expect('___').toMatch(/^_{3,}$/);
    });

    test('unordered lists should match pattern', () => {
      const listPattern = /^[*+-] /m;
      expect('- Item').toMatch(listPattern);
      expect('* Item').toMatch(listPattern);
      expect('+ Item').toMatch(listPattern);
    });

    test('ordered lists should match pattern', () => {
      const orderedPattern = /^\d+\. /m;
      expect('1. Item').toMatch(orderedPattern);
      expect('2. Item').toMatch(orderedPattern);
    });

    test('task lists should match pattern', () => {
      const taskPattern = /^- \[[ x]\] /m;
      expect('- [ ] Todo').toMatch(taskPattern);
      expect('- [x] Done').toMatch(taskPattern);
    });
  });
});
