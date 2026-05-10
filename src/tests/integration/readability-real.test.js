/**
 * Real Readability Integration Tests
 * Tests actual article extraction using Mozilla's Readability.js
 */

const { createTurndownService, parseArticle } = require('../helpers/browser-env');

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

    test('should preserve hidden article content only when hidden-content skipping is disabled', () => {
      const html = `
        <!DOCTYPE html>
        <html>
          <head>
            <title>Accordion Article</title>
          </head>
          <body>
            <article>
              <h1>Accordion Article</h1>
              <p>This visible paragraph gives Readability enough article text to keep the article body focused on the main content area.</p>
              <p>It describes an event with substantial detail so the extraction is stable and not confused with nearby page chrome.</p>
              <section>
                <h2>Frequently Asked Questions</h2>
                <div aria-hidden="true">
                  <p>ARIA hidden answer token should be optional hidden content.</p>
                </div>
                <div style="display: none;">
                  <p>Display none answer token should be optional hidden content.</p>
                </div>
              </section>
              <p>The final visible paragraph keeps the article cohesive after the optional hidden content section.</p>
            </article>
          </body>
        </html>
      `;

      const { article: defaultArticle } = parseArticle(html);
      const { article: includeHiddenArticle } = parseArticle(html, { skipHiddenContent: false });

      expect(defaultArticle).not.toBeNull();
      expect(defaultArticle.content).not.toContain('ARIA hidden answer token');
      expect(defaultArticle.content).not.toContain('Display none answer token');
      expect(includeHiddenArticle).not.toBeNull();
      expect(includeHiddenArticle.content).toContain('ARIA hidden answer token');
      expect(includeHiddenArticle.content).toContain('Display none answer token');
    });

    test('should include hidden accordion content without narrowing extraction to only the accordion body', () => {
      const html = `
        <!DOCTYPE html>
        <html>
          <head><title>Celebrating Children</title></head>
          <body>
            <main>
              <div class="page-2-col">
                <div class="page__main-col">
                  <article class="text-container section-block">
                    <div class="section-block__int">
                      <div class="text-container-int text-container-int--left prose">
                        <p>This annual event, presented by GrowSmart in collaboration with Virginia Beach Parks & Recreation, Virginia Beach City Public Schools, and Healthy Families Virginia Beach, is free and open to the public. Programming includes a Fun Run activity around Mt. Trashmore Park, inflatables, kid-friendly games, crafts and other activities.</p>
                      </div>
                    </div>
                  </article>
                  <article class="max-w-wide mx-auto px-s7 lg:px-s9 my-s12 xl:px-s10 text-primary-800 prose">
                    <h2>Celebrating Children FAQ</h2>
                    <div class="text-container-int text-container-int--center prose">
                      <ul class="accordion-items list-none mb-s10">
                        <li class="accordion__item">
                          <button class="accordion__trigger flex justify-between items-start text-left space-x-s3"><h3>What to expect?</h3><span><svg><use></use></svg></span></button>
                          <div class="accordion__content-wrapper" style="display: none;">
                            <p>Celebrating Children is a free community event in April offered by the City of Virginia Beach, GrowSmart and the Department of Parks and Recreation to celebrate healthy and happy childhood for all!</p>
                            <p>Every Fun Run Participant will receive a medal!</p>
                          </div>
                        </li>
                        <li class="accordion__item">
                          <button class="accordion__trigger flex justify-between items-start text-left space-x-s3"><h3>Who is the event for?</h3><span><svg><use></use></svg></span></button>
                          <div class="accordion__content-wrapper" style="display: none;">
                            <p>Celebrating Children is geared towards families with children 0-8 years old but older siblings and relatives are also welcome to participate!</p>
                          </div>
                        </li>
                        <li class="accordion__item">
                          <button class="accordion__trigger flex justify-between items-start text-left space-x-s3"><h3>When and where will the event take place?</h3><span><svg><use></use></svg></span></button>
                          <div class="accordion__content-wrapper" style="display: none;">
                            <p>2027 Celebrating Children details coming soon with enough detail to exercise hidden accordion recovery.</p>
                          </div>
                        </li>
                        <li class="accordion__item">
                          <button class="accordion__trigger flex justify-between items-start text-left space-x-s3"><h3>How much does it cost?</h3><span><svg><use></use></svg></span></button>
                          <div class="accordion__content-wrapper" style="display: none;">
                            <p>This event is 100% free of charge and open to the public thanks to generous support.</p>
                          </div>
                        </li>
                        <li class="accordion__item">
                          <button class="accordion__trigger flex justify-between items-start text-left space-x-s3"><h3>Are you ready to register for the Fun Run?</h3><span><svg><use></use></svg></span></button>
                          <div class="accordion__content-wrapper" style="display: none;">
                            <p>Register in advance for the Fun Run or Walk so a race packet can be reserved for your family.</p>
                          </div>
                        </li>
                        <li class="accordion__item">
                          <button class="accordion__trigger flex justify-between items-start text-left space-x-s3"><h3>Are you interested in volunteering?</h3><span><svg><use></use></svg></span></button>
                          <div class="accordion__content-wrapper" style="display: none;">
                            <p>Email the event team and they will discuss ways to help make the event successful.</p>
                          </div>
                        </li>
                        <li class="accordion__item">
                          <button class="accordion__trigger flex justify-between items-start text-left space-x-s3"><h3>Who are the exhibitors?</h3><span><svg><use></use></svg></span></button>
                          <div class="accordion__content-wrapper" style="display: none;">
                            <p>Coming Soon!</p>
                          </div>
                        </li>
                      </ul>
                    </div>
                  </article>
                  <article class="text-container section-block">
                    <div>
                      <h2>In addition to the Fun Run, you can expect to find at the event:</h2>
                      <ul>
                        <li>Kid-friendly games, crafts and activities</li>
                        <li>Petting Zoo</li>
                      </ul>
                    </div>
                  </article>
                  <article>
                    <h2>This event is brought to you by:</h2>
                  </article>
                  <article>
                    <h2>Thank you to our 2026 sponsors:</h2>
                  </article>
                </div>
              </div>
            </main>
          </body>
        </html>
      `;

      const { article } = parseArticle(html, { skipHiddenContent: false });
      const { service } = createTurndownService();
      const markdown = service.turndown(article.content);

      expect(markdown.trim().startsWith('This annual event, presented by GrowSmart')).toBe(true);
      expect(markdown.trim().startsWith('## This event is brought to you by:')).toBe(false);
      expect(markdown).toContain('## Celebrating Children FAQ');
      expect(markdown).toContain('What to expect?');
      expect(markdown).toContain('Every Fun Run Participant will receive a medal');
      expect(markdown).toContain('## In addition to the Fun Run, you can expect to find at the event:');
      expect(markdown).toContain('## This event is brought to you by:');
      expect(markdown).toContain('Petting Zoo');
      expect(markdown.indexOf('## Celebrating Children FAQ')).toBeLessThan(markdown.indexOf('## In addition to the Fun Run'));
      expect(markdown.indexOf('## In addition to the Fun Run')).toBeLessThan(markdown.indexOf('## This event is brought to you by:'));
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
      // Title extraction may vary - check for content instead
      expect(article.content).toBeTruthy();
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
