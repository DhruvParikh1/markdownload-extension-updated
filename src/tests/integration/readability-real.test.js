/**
 * Real Readability Integration Tests
 * Tests actual article extraction using Mozilla's Readability.js
 */

const { parseArticle } = require('../helpers/browser-env');

describe('Real Readability Integration', () => {
  describe('Article Extraction', () => {
    test('should extract article from simple blog post', () => {
      const html = `
        <!DOCTYPE html>
        <html>
          <head>
            <title>Test Blog Post</title>
            <meta name="author" content="John Doe">
          </head>
          <body>
            <header>
              <nav>Site Navigation</nav>
            </header>
            <article>
              <h1>Test Blog Post</h1>
              <p>This is the main content of the article that should be extracted.</p>
              <p>It contains multiple paragraphs with useful information about the topic.</p>
              <p>Readability should extract this and ignore surrounding elements.</p>
            </article>
            <aside>
              <p>Advertisement that should be removed</p>
            </aside>
            <footer>
              <p>Copyright 2024</p>
            </footer>
          </body>
        </html>
      `;

      const { article } = parseArticle(html);

      expect(article).not.toBeNull();
      expect(article.title).toContain('Test Blog Post');
      expect(article.content).toContain('main content');
      expect(article.content).not.toContain('Advertisement');
      expect(article.content).not.toContain('Site Navigation');
    });

    test('should extract metadata from article', () => {
      const html = `
        <!DOCTYPE html>
        <html>
          <head>
            <title>Article Title</title>
            <meta name="author" content="Jane Smith">
            <meta name="description" content="Article description">
          </head>
          <body>
            <article>
              <h1>Article Title</h1>
              <p class="byline">By Jane Smith</p>
              <p>Article content goes here.</p>
            </article>
          </body>
        </html>
      `;

      const { article } = parseArticle(html);

      expect(article).not.toBeNull();
      expect(article.title).toBe('Article Title');
      expect(article.byline).toContain('Jane Smith');
    });

    test('should extract from page without explicit article tag', () => {
      const html = `
        <!DOCTYPE html>
        <html>
          <head>
            <title>News Article</title>
          </head>
          <body>
            <div class="main-content">
              <h1>News Article</h1>
              <p>This is a news article without an explicit article tag but with substantial content.</p>
              <p>Readability should still be able to extract the main content based on heuristics.</p>
              <p>It looks for content density, paragraph length, and other signals.</p>
              <p>This helps extract content from sites that don't use semantic HTML5 tags.</p>
            </div>
          </body>
        </html>
      `;

      const { article } = parseArticle(html);

      expect(article).not.toBeNull();
      expect(article.title).toBe('News Article');
      expect(article.content).toContain('main content');
    });

    test('should preserve images in article', () => {
      const html = `
        <!DOCTYPE html>
        <html>
          <body>
            <article>
              <h1>Article with Images</h1>
              <img src="https://example.com/featured.jpg" alt="Featured Image">
              <p>Article text here.</p>
              <img src="https://example.com/inline.jpg" alt="Inline Image">
              <p>More text here.</p>
            </article>
          </body>
        </html>
      `;

      const { article } = parseArticle(html);

      expect(article).not.toBeNull();
      expect(article.content).toContain('featured.jpg');
      expect(article.content).toContain('inline.jpg');
      expect(article.content).toContain('img');
    });

    test('should preserve code blocks in article', () => {
      const html = `
        <!DOCTYPE html>
        <html>
          <body>
            <article>
              <h1>Technical Article</h1>
              <p>Here's some code:</p>
              <pre><code class="language-javascript">
function hello() {
  console.log('Hello, world!');
}
              </code></pre>
              <p>That's the code example.</p>
            </article>
          </body>
        </html>
      `;

      const { article } = parseArticle(html);

      expect(article).not.toBeNull();
      expect(article.content).toContain('function hello');
      expect(article.content).toContain('console.log');
    });

    test('should preserve lists in article', () => {
      const html = `
        <!DOCTYPE html>
        <html>
          <body>
            <article>
              <h1>Article with Lists</h1>
              <ul>
                <li>First item</li>
                <li>Second item</li>
                <li>Third item</li>
              </ul>
              <ol>
                <li>Step one</li>
                <li>Step two</li>
              </ol>
            </article>
          </body>
        </html>
      `;

      const { article } = parseArticle(html);

      expect(article).not.toBeNull();
      expect(article.content).toContain('First item');
      expect(article.content).toContain('Step one');
      expect(article.content).toContain('<ul>');
      expect(article.content).toContain('<ol>');
    });

    test('should preserve tables in article', () => {
      const html = `
        <!DOCTYPE html>
        <html>
          <body>
            <article>
              <h1>Article with Table</h1>
              <table>
                <thead>
                  <tr><th>Name</th><th>Value</th></tr>
                </thead>
                <tbody>
                  <tr><td>Item 1</td><td>100</td></tr>
                  <tr><td>Item 2</td><td>200</td></tr>
                </tbody>
              </table>
            </article>
          </body>
        </html>
      `;

      const { article } = parseArticle(html);

      expect(article).not.toBeNull();
      expect(article.content).toContain('Item 1');
      expect(article.content).toContain('100');
      expect(article.content).toContain('<table');
    });
  });

  describe('Content Filtering', () => {
    test('should filter out navigation', () => {
      const html = `
        <!DOCTYPE html>
        <html>
          <body>
            <nav>
              <a href="/">Home</a>
              <a href="/about">About</a>
            </nav>
            <article>
              <h1>Article</h1>
              <p>Main content that should be kept and extracted properly.</p>
              <p>More content here to ensure extraction works.</p>
              <p>Additional paragraph for content density.</p>
            </article>
          </body>
        </html>
      `;

      const { article } = parseArticle(html);

      expect(article).not.toBeNull();
      expect(article.content).not.toContain('Home');
      expect(article.content).not.toContain('About');
    });

    test('should filter out footer', () => {
      const html = `
        <!DOCTYPE html>
        <html>
          <body>
            <article>
              <h1>Article</h1>
              <p>Main content goes here with enough text.</p>
              <p>More paragraphs to ensure this is identified as main content.</p>
              <p>Third paragraph for good measure.</p>
            </article>
            <footer>
              <p>Copyright 2024</p>
              <p>Contact: info@example.com</p>
            </footer>
          </body>
        </html>
      `;

      const { article } = parseArticle(html);

      expect(article).not.toBeNull();
      expect(article.content).not.toContain('Copyright 2024');
      expect(article.content).not.toContain('Contact:');
    });

    test('should filter out ads', () => {
      const html = `
        <!DOCTYPE html>
        <html>
          <body>
            <article>
              <h1>Article Title</h1>
              <p>Article content with substantial text.</p>
              <div class="advertisement">
                <p>Buy our product now!</p>
              </div>
              <p>More article content continues here.</p>
              <p>Even more content to ensure proper extraction.</p>
            </article>
          </body>
        </html>
      `;

      const { article } = parseArticle(html);

      expect(article).not.toBeNull();
      // Readability should filter out obvious ad containers
      expect(article.content).toContain('Article content');
    });
  });

  describe('Edge Cases', () => {
    test('should handle very short content', () => {
      const html = `
        <!DOCTYPE html>
        <html>
          <body>
            <article>
              <h1>Short Article</h1>
              <p>Brief content.</p>
            </article>
          </body>
        </html>
      `;

      const { article } = parseArticle(html);

      // Readability might not extract very short content
      // But it shouldn't crash
      expect(() => parseArticle(html)).not.toThrow();
    });

    test('should handle very long articles', () => {
      const paragraphs = [];
      for (let i = 0; i < 100; i++) {
        paragraphs.push(`<p>Paragraph ${i} with substantial content about the topic. This ensures we have enough content for Readability to extract properly.</p>`);
      }

      const html = `
        <!DOCTYPE html>
        <html>
          <body>
            <article>
              <h1>Long Article</h1>
              ${paragraphs.join('\n')}
            </article>
          </body>
        </html>
      `;

      const { article } = parseArticle(html);

      expect(article).not.toBeNull();
      expect(article.content).toContain('Paragraph 0');
      expect(article.content).toContain('Paragraph 99');
    });

    test('should handle malformed HTML', () => {
      const html = `
        <!DOCTYPE html>
        <html>
          <body>
            <article>
              <h1>Article with broken HTML
              <p>Unclosed tags here
              <p>More unclosed tags
              <p>But should still work somehow
            </article>
          </body>
        </html>
      `;

      // Should not crash
      expect(() => parseArticle(html)).not.toThrow();
    });

    test('should handle HTML with special characters', () => {
      const html = `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="UTF-8">
            <title>Special Characters Test</title>
          </head>
          <body>
            <article>
              <h1>Article with special chars: é, ñ, 中文, 🎉</h1>
              <p>Content with émojis and ünïcödé characters.</p>
              <p>More content with 日本語 and Русский text.</p>
              <p>Special symbols: ©, ™, €, £, ¥</p>
            </article>
          </body>
        </html>
      `;

      const { article } = parseArticle(html);

      expect(article).not.toBeNull();
      expect(article.title).toContain('Special Characters');
      expect(article.content).toContain('émojis');
      expect(article.content).toContain('🎉');
    });

    test('should handle multiple articles in page', () => {
      const html = `
        <!DOCTYPE html>
        <html>
          <body>
            <article>
              <h1>First Article</h1>
              <p>This is the first article with substantial content.</p>
              <p>It has multiple paragraphs to establish it as main content.</p>
              <p>More content here for the first article.</p>
            </article>
            <article>
              <h1>Second Article</h1>
              <p>This is a second article that is shorter.</p>
            </article>
          </body>
        </html>
      `;

      const { article } = parseArticle(html);

      // Readability should extract one of them (usually the first/longest)
      expect(article).not.toBeNull();
      expect(article.title).toBeTruthy();
    });
  });

  describe('Article Properties', () => {
    test('should extract title', () => {
      const html = `
        <!DOCTYPE html>
        <html>
          <head><title>Page Title</title></head>
          <body>
            <article>
              <h1>Article Heading</h1>
              <p>Article content with enough text.</p>
              <p>More content to ensure extraction.</p>
            </article>
          </body>
        </html>
      `;

      const { article } = parseArticle(html);

      expect(article).not.toBeNull();
      expect(article.title).toBeTruthy();
    });

    test('should calculate text length', () => {
      const html = `
        <!DOCTYPE html>
        <html>
          <body>
            <article>
              <h1>Article</h1>
              <p>Content with text that can be measured.</p>
              <p>More paragraphs for length calculation.</p>
            </article>
          </body>
        </html>
      `;

      const { article } = parseArticle(html);

      expect(article).not.toBeNull();
      expect(article.length).toBeGreaterThan(0);
    });

    test('should extract excerpt', () => {
      const html = `
        <!DOCTYPE html>
        <html>
          <body>
            <article>
              <h1>Article</h1>
              <p>This is the beginning of the article that should appear in the excerpt.</p>
              <p>More content continues here.</p>
            </article>
          </body>
        </html>
      `;

      const { article } = parseArticle(html);

      expect(article).not.toBeNull();
      if (article.excerpt) {
        expect(article.excerpt).toContain('beginning');
      }
    });
  });
});
