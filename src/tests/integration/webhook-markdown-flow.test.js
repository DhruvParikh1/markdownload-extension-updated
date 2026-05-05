const { createTurndownService } = require('../helpers/browser-env');
const { createEffectiveMarkdownOptions } = require('../../shared/markdown-options');
const { buildWebhookFetchRequest } = require('../../shared/webhook-utils');

describe('Webhook markdown flow', () => {
  test('reuses the already-templated markdown from the clip pipeline without duplicating frontmatter or body content', () => {
    const article = {
      title: 'Test Clip',
      byline: 'Author: Example',
      excerpt: 'A compact excerpt',
      pageURL: 'https://example.com/articles/test-clip',
      keywords: ['clip', 'test'],
      date: '2026-05-05T10:09:52.000Z'
    };
    const markdownOptions = createEffectiveMarkdownOptions(article, {
      includeTemplate: true,
      frontmatter: '---\ncreated: {date:YYYY-MM-DD}\nsource: {pageURL}\nauthor: {byline}\n---',
      backmatter: '\n---\nexcerpt: {excerpt}',
      imagePrefix: '',
      tableFormatting: {}
    });
    const { service } = createTurndownService({ headingStyle: 'atx' });
    const html = '<h1>Test Clip</h1><p>Body paragraph.</p>';
    const bodyMarkdown = service.turndown(html);
    const finalMarkdown = markdownOptions.frontmatter + bodyMarkdown + markdownOptions.backmatter;

    const request = buildWebhookFetchRequest({
      target: {
        url: 'https://example.com/hooks/notes',
        method: 'POST',
        headers: [],
        bodyTemplate: JSON.stringify({
          title: '{title}',
          content: '{content}'
        })
      },
      article: {
        ...article,
        content: finalMarkdown
      }
    });

    const payload = JSON.parse(request.body);

    expect(payload.title).toBe('Test Clip');
    expect(payload.content).toBe(finalMarkdown);
    expect(payload.content).toContain('created: 2026-05-05');
    expect(payload.content).toContain('# Test Clip');
    expect(payload.content).toContain('Body paragraph.');
    expect(payload.content).toContain('excerpt: A compact excerpt');
    expect(payload.content.match(/created: 2026-05-05/g)).toHaveLength(1);
    expect(payload.content.match(/# Test Clip/g)).toHaveLength(1);
    expect(payload.content.match(/Body paragraph\./g)).toHaveLength(1);
    expect(payload.content.match(/excerpt: A compact excerpt/g)).toHaveLength(1);
  });
});
