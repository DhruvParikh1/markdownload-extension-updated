const {
  buildMappedPropertyPayload,
  buildNotionClipMetadata,
  getNotionTransportOptions,
  splitMarkdownIntoChunks,
  stripRenderedTemplate
} = require('../../shared/notion-utils');

describe('Notion helpers', () => {
  test('forces Notion transport to disable templates and local image rewriting', () => {
    expect(
      getNotionTransportOptions({
        includeTemplate: true,
        downloadImages: true,
        imageStyle: 'obsidian'
      })
    ).toEqual(expect.objectContaining({
      includeTemplate: false,
      frontmatter: '',
      backmatter: '',
      downloadImages: false,
      imageStyle: 'markdown'
    }));
  });

  test('strips only exact rendered wrappers from edited markdown', () => {
    const markdown = '---\ntitle: Example\n---\n\nBody\n\nFooter';
    expect(
      stripRenderedTemplate(markdown, '---\ntitle: Example\n---\n\n', '\n\nFooter')
    ).toBe('Body');
    expect(
      stripRenderedTemplate(markdown, '---\ntitle: Different\n---\n\n', '\n\nFooter')
    ).toBe('---\ntitle: Example\n---\n\nBody');
  });

  test('builds mapped property payloads using property ids and compatible types', () => {
    const destination = {
      id: 'ds_123',
      kind: 'data_source',
      name: 'Clips',
      schema: {
        id: 'ds_123',
        properties: [
          { id: 'prop_title', name: 'Name', type: 'title' },
          { id: 'prop_url', name: 'Source', type: 'url' },
          { id: 'prop_date', name: 'Clipped At', type: 'date' },
          { id: 'prop_tags', name: 'Tags', type: 'multi_select' }
        ]
      }
    };

    const payload = buildMappedPropertyPayload({
      destination,
      propertyMappings: {
        title: 'prop_title',
        sourceUrl: 'prop_url',
        clippedAt: 'prop_date',
        tags: 'prop_tags'
      },
      clipMeta: {
        title: 'Example Title',
        sourceUrl: 'https://example.com/post',
        clippedAt: '2026-03-15T12:00:00.000Z',
        tags: ['docs', 'reference']
      },
      titleOverride: 'Edited Title'
    });

    expect(payload).toEqual([
      expect.objectContaining({
        propertyId: 'prop_title',
        propertyType: 'title',
        value: 'Edited Title'
      }),
      expect.objectContaining({
        propertyId: 'prop_url',
        propertyType: 'url',
        value: 'https://example.com/post'
      }),
      expect.objectContaining({
        propertyId: 'prop_date',
        propertyType: 'date',
        value: '2026-03-15T12:00:00.000Z'
      }),
      expect.objectContaining({
        propertyId: 'prop_tags',
        propertyType: 'multi_select',
        value: ['docs', 'reference']
      })
    ]);
  });

  test('builds clip metadata from article fields and keywords', () => {
    expect(
      buildNotionClipMetadata({
        title: 'Example',
        pageURL: 'https://example.com',
        keywords: ['alpha', 'beta']
      }, {
        clippedAt: '2026-03-15T00:00:00.000Z'
      })
    ).toEqual({
      title: 'Example',
      sourceUrl: 'https://example.com',
      clippedAt: '2026-03-15T00:00:00.000Z',
      tags: ['alpha', 'beta']
    });
  });

  test('chunks long markdown without dropping content', () => {
    const markdown = [
      '# Title',
      '',
      'Paragraph one.',
      '',
      '```js',
      'console.log("hello");',
      '```',
      '',
      'Paragraph two.',
      '',
      'Paragraph three.'
    ].join('\n').repeat(80);

    const chunks = splitMarkdownIntoChunks(markdown, 500);

    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks.join('')).toContain('console.log("hello");');
    expect(chunks.join('\n')).toContain('Paragraph three.');
  });
});
