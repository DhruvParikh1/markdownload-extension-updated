/**
 * HTML Test Fixtures
 * Sample HTML documents for testing conversion to Markdown
 */

module.exports = {
  // Simple article with basic formatting
  simpleArticle: {
    html: `
      <article>
        <h1>Test Article Title</h1>
        <p>This is a simple paragraph with <strong>bold text</strong> and <em>italic text</em>.</p>
        <p>Another paragraph with a <a href="https://example.com">link</a>.</p>
        <ul>
          <li>First item</li>
          <li>Second item</li>
          <li>Third item</li>
        </ul>
      </article>
    `,
    expectedMarkdown: `# Test Article Title

This is a simple paragraph with **bold text** and *italic text*.

Another paragraph with a [link](https://example.com).

- First item
- Second item
- Third item`
  },

  // Article with headings at multiple levels
  multiLevelHeadings: {
    html: `
      <article>
        <h1>Main Title</h1>
        <h2>Section 1</h2>
        <p>Content under section 1</p>
        <h3>Subsection 1.1</h3>
        <p>Content under subsection 1.1</p>
        <h2>Section 2</h2>
        <p>Content under section 2</p>
      </article>
    `,
    expectedMarkdown: `# Main Title

## Section 1

Content under section 1

### Subsection 1.1

Content under subsection 1.1

## Section 2

Content under section 2`
  },

  // Code blocks with syntax highlighting
  codeBlocks: {
    html: `
      <article>
        <h1>Code Examples</h1>
        <p>Here's some inline <code>code</code> in a paragraph.</p>
        <pre><code class="language-javascript">function hello() {
  console.log('Hello, world!');
}</code></pre>
        <pre><code class="language-python">def hello():
    print('Hello, world!')</code></pre>
      </article>
    `,
    expectedMarkdown: `# Code Examples

Here's some inline \`code\` in a paragraph.

\`\`\`javascript
function hello() {
  console.log('Hello, world!');
}
\`\`\`

\`\`\`python
def hello():
    print('Hello, world!')
\`\`\``
  },

  // Tables with various content
  simpleTables: {
    html: `
      <article>
        <h1>Table Example</h1>
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Age</th>
              <th>City</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>John</td>
              <td>25</td>
              <td>New York</td>
            </tr>
            <tr>
              <td>Jane</td>
              <td>30</td>
              <td>London</td>
            </tr>
          </tbody>
        </table>
      </article>
    `,
    expectedMarkdown: `# Table Example

| Name | Age | City     |
| ---- | --- | -------- |
| John | 25  | New York |
| Jane | 30  | London   |`
  },

  // Complex table with formatting
  complexTable: {
    html: `
      <table>
        <thead>
          <tr>
            <th>Feature</th>
            <th>Description</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td><strong>Bold Feature</strong></td>
            <td>A feature with <a href="https://example.com">a link</a></td>
            <td><em>Active</em></td>
          </tr>
          <tr>
            <td>Plain Feature</td>
            <td>Simple description</td>
            <td>Inactive</td>
          </tr>
        </tbody>
      </table>
    `,
    expectedMarkdown: `| Feature              | Description                                 | Status     |
| -------------------- | ------------------------------------------- | ---------- |
| **Bold Feature**     | A feature with [a link](https://example.com) | *Active*   |
| Plain Feature        | Simple description                          | Inactive   |`
  },

  // Blockquotes
  blockquotes: {
    html: `
      <article>
        <h1>Quotes</h1>
        <blockquote>
          <p>This is a simple blockquote.</p>
        </blockquote>
        <blockquote>
          <p>This is a multi-paragraph blockquote.</p>
          <p>Second paragraph in the blockquote.</p>
        </blockquote>
      </article>
    `,
    expectedMarkdown: `# Quotes

> This is a simple blockquote.

> This is a multi-paragraph blockquote.
>
> Second paragraph in the blockquote.`
  },

  // Images
  images: {
    html: `
      <article>
        <h1>Images</h1>
        <p>Here's an image:</p>
        <img src="https://example.com/image.jpg" alt="Example Image">
        <p>Image with title:</p>
        <img src="https://example.com/image2.jpg" alt="Another Image" title="Image Title">
      </article>
    `,
    expectedMarkdown: `# Images

Here's an image:

![Example Image](https://example.com/image.jpg)

Image with title:

![Another Image](https://example.com/image2.jpg "Image Title")`
  },

  // Ordered and unordered lists
  mixedLists: {
    html: `
      <article>
        <h1>Lists</h1>
        <ol>
          <li>First ordered item</li>
          <li>Second ordered item</li>
          <li>Third ordered item</li>
        </ol>
        <ul>
          <li>Unordered item 1</li>
          <li>Unordered item 2
            <ul>
              <li>Nested item 1</li>
              <li>Nested item 2</li>
            </ul>
          </li>
          <li>Unordered item 3</li>
        </ul>
      </article>
    `,
    expectedMarkdown: `# Lists

1. First ordered item
2. Second ordered item
3. Third ordered item

- Unordered item 1
- Unordered item 2
  - Nested item 1
  - Nested item 2
- Unordered item 3`
  },

  // Horizontal rules
  horizontalRules: {
    html: `
      <article>
        <h1>Section 1</h1>
        <p>Content of section 1</p>
        <hr>
        <h1>Section 2</h1>
        <p>Content of section 2</p>
      </article>
    `,
    expectedMarkdown: `# Section 1

Content of section 1

---

# Section 2

Content of section 2`
  },

  // Task lists (GitHub Flavored Markdown)
  taskLists: {
    html: `
      <article>
        <h1>Todo List</h1>
        <ul>
          <li><input type="checkbox" checked> Completed task</li>
          <li><input type="checkbox"> Incomplete task</li>
          <li><input type="checkbox"> Another incomplete task</li>
        </ul>
      </article>
    `,
    expectedMarkdown: `# Todo List

- [x] Completed task
- [ ] Incomplete task
- [ ] Another incomplete task`
  },

  // Strikethrough
  strikethrough: {
    html: `
      <article>
        <p>This text has <del>strikethrough</del> formatting.</p>
        <p>This also uses <s>strikethrough</s> tag.</p>
      </article>
    `,
    expectedMarkdown: `This text has ~~strikethrough~~ formatting.

This also uses ~~strikethrough~~ tag.`
  },

  // Obsidian documentation page (simplified version of user's example)
  obsidianDocPage: {
    html: `
      <article>
        <h1 class="page-header">Writing</h1>
        <div data-callout="caution" class="callout">
          <div class="callout-title">Caution</div>
          <div class="callout-content">
            <p>Make sure your values are properly <a href="https://publish.obsidian.md/advanced-uri-doc/Concepts/Encoding">encoded</a></p>
          </div>
        </div>
        <div data-callout="info" class="callout">
          <div class="callout-title">Info</div>
          <div class="callout-content">
            <p>The <code>data</code> parameter can be replaced with <code>clipboard=true</code> to get the content from the clipboard.</p>
          </div>
        </div>
        <table>
          <thead>
            <tr>
              <th>/</th>
              <th>parameters</th>
              <th>explanation</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>write</td>
              <td>&lt;identification&gt;, data</td>
              <td>Only writes <code>data</code> to the file if the file is not already present</td>
            </tr>
            <tr>
              <td>overwrite</td>
              <td>&lt;identification&gt;, data, mode=overwrite</td>
              <td>Writes <code>data</code> to <code>filepath</code> even if the file already exists</td>
            </tr>
            <tr>
              <td>append</td>
              <td>&lt;identification&gt;, data, mode=append</td>
              <td>Only appends <code>data</code> to the file</td>
            </tr>
          </tbody>
        </table>
      </article>
    `,
    metadata: {
      title: 'Writing - Advanced URI Documentation',
      url: 'https://publish.obsidian.md/advanced-uri-doc/Actions/Writing'
    }
  },

  // Relative URLs that need resolution
  relativeUrls: {
    html: `
      <article>
        <h1>Relative Links</h1>
        <p>Link to <a href="/docs/guide">guide</a>.</p>
        <p>Link to <a href="../about">about page</a>.</p>
        <img src="/images/logo.png" alt="Logo">
        <img src="../assets/photo.jpg" alt="Photo">
      </article>
    `,
    baseUrl: 'https://example.com/blog/post',
    expectedMarkdown: `# Relative Links

Link to [guide](https://example.com/docs/guide).

Link to [about page](https://example.com/about).

![Logo](https://example.com/images/logo.png)

![Photo](https://example.com/assets/photo.jpg)`
  },

  // Article with metadata
  articleWithMetadata: {
    html: `
      <html>
        <head>
          <title>Test Article</title>
          <meta name="author" content="John Doe">
          <meta name="description" content="A test article for MarkSnip">
          <meta name="keywords" content="test, markdown, clipper">
          <meta property="og:title" content="Test Article - OG">
          <meta property="article:published_time" content="2024-01-15T10:00:00Z">
        </head>
        <body>
          <article>
            <h1>Test Article</h1>
            <p>This is the content.</p>
          </article>
        </body>
      </html>
    `,
    metadata: {
      title: 'Test Article',
      author: 'John Doe',
      description: 'A test article for MarkSnip',
      keywords: ['test', 'markdown', 'clipper'],
      publishedTime: '2024-01-15T10:00:00Z'
    }
  }
};
