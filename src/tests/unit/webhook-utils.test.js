const {
  buildWebhookFetchRequest
} = require('../../shared/webhook-utils');

describe('Webhook utilities', () => {
  test('builds a valid JSON webhook request from a JSON template and multiline markdown content', () => {
    const request = buildWebhookFetchRequest({
      target: {
        url: 'https://example.com/hooks/notes',
        method: 'POST',
        headers: [],
        bodyTemplate: JSON.stringify({
          vault: 'Obsidian Vault',
          path: 'Obsidian Vault/Clippings/{title}.md',
          content: '{content}'
        }, null, 2)
      },
      article: {
        title: 'Sample Title',
        content: '# heading\n- item\n```js\nconsole.log("x")\nconst payload = { ok: true };\n```',
        pageURL: 'https://example.com/post',
        excerpt: '',
        byline: '',
        keywords: [],
        date: '2026-05-05T00:00:00.000Z'
      }
    });

    expect(request.method).toBe('POST');
    expect(request.url).toBe('https://example.com/hooks/notes');
    expect(request.headers['Content-Type']).toBe('application/json');

    expect(JSON.parse(request.body)).toEqual({
      vault: 'Obsidian Vault',
      path: 'Obsidian Vault/Clippings/Sample Title.md',
      content: '# heading\n- item\n```js\nconsole.log("x")\nconst payload = { ok: true };\n```'
    });
  });

  test('preserves an explicit content-type header while rendering header templates', () => {
    const request = buildWebhookFetchRequest({
      target: {
        url: 'https://example.com/hooks/notes/{title:kebab}',
        method: 'PATCH',
        headers: [
          { key: 'Content-Type', value: 'application/vnd.api+json' },
          { key: 'X-Clip-Title', value: '{title}' }
        ],
        bodyTemplate: JSON.stringify({
          content: '{content}'
        })
      },
      article: {
        title: 'Quoted Title',
        content: 'plain body',
        pageURL: 'https://example.com/post',
        excerpt: '',
        byline: '',
        keywords: [],
        date: '2026-05-05T00:00:00.000Z'
      }
    });

    expect(request.method).toBe('PATCH');
    expect(request.url).toBe('https://example.com/hooks/notes/quoted-title');
    expect(request.headers).toEqual({
      'Content-Type': 'application/vnd.api+json',
      'X-Clip-Title': 'Quoted Title'
    });
    expect(JSON.parse(request.body)).toEqual({
      content: 'plain body'
    });
  });
});
