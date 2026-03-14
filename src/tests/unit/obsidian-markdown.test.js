const {
  createObsidianSourceImageMap,
  getObsidianTransportOptions,
  prepareMarkdownForObsidian
} = require('../../shared/obsidian-utils');

describe('Obsidian markdown helpers', () => {
  test('forces send-to-obsidian conversions to avoid local attachment styles', () => {
    expect(
      getObsidianTransportOptions({
        downloadImages: true,
        imageStyle: 'obsidian'
      })
    ).toEqual(
      expect.objectContaining({
        downloadImages: false,
        imageStyle: 'markdown'
      })
    );

    expect(
      getObsidianTransportOptions({
        downloadImages: true,
        imageStyle: 'noImage'
      })
    ).toEqual(
      expect.objectContaining({
        downloadImages: false,
        imageStyle: 'noImage'
      })
    );
  });

  test('builds replacement entries for encoded local image paths', () => {
    const sourceImageMap = createObsidianSourceImageMap({
      'https://example.com/image path.png': 'Article/image path.png'
    });

    expect(sourceImageMap['Article/image path.png']).toBe('https://example.com/image path.png');
    expect(sourceImageMap['Article/image%20path.png']).toBe('https://example.com/image path.png');
    expect(sourceImageMap['image%20path.png']).toBe('https://example.com/image path.png');
  });

  test('rewrites local markdown image paths back to remote urls', () => {
    const markdown = '![hero](Article/image%20path.png)\n\n[fig1]: Article/image%20path.png';
    const sourceImageMap = createObsidianSourceImageMap({
      'https://example.com/image path.png': 'Article/image path.png'
    });

    expect(prepareMarkdownForObsidian(markdown, sourceImageMap)).toBe(
      '![hero](https://example.com/image path.png)\n\n[fig1]: https://example.com/image path.png'
    );
  });

  test('converts obsidian embeds to normal markdown image links', () => {
    const localMarkdown = '![[Article/image path.png]]';
    const remoteMarkdown = '![[https://cdn.example.com/image.png]]';
    const sourceImageMap = createObsidianSourceImageMap({
      'https://example.com/image path.png': 'Article/image path.png'
    });

    expect(prepareMarkdownForObsidian(localMarkdown, sourceImageMap)).toBe(
      '![](https://example.com/image path.png)'
    );
    expect(prepareMarkdownForObsidian(remoteMarkdown, {})).toBe(
      '![](https://cdn.example.com/image.png)'
    );
  });
});
