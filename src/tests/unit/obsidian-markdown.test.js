const {
  buildObsidianFilepath,
  createObsidianAdvancedUri,
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

  test('builds Advanced URI data transport for payloads that fit in the URI budget', () => {
    const result = createObsidianAdvancedUri({
      vault: 'Research Vault',
      folder: 'Clips',
      title: 'Article Title',
      markdown: '# Article Title\n\nBody text',
      maxDataUriLength: 1000
    });

    expect(result.transport).toBe('data');
    expect(result.filepath).toBe('Clips/Article Title.md');
    expect(result.uri).toContain('obsidian://adv-uri?');
    expect(result.uri).toContain('vault=Research%20Vault');
    expect(result.uri).toContain('filepath=Clips%2FArticle%20Title.md');
    expect(result.uri).toContain('data=%23%20Article%20Title%0A%0ABody%20text');
    expect(result.uri).not.toContain('clipboard=true');
  });

  test('falls back to clipboard transport when encoded markdown would make the URI too large', () => {
    const result = createObsidianAdvancedUri({
      vault: 'Vault',
      folder: 'Clips',
      title: 'Large Article.md',
      markdown: 'Long body '.repeat(200),
      maxDataUriLength: 120
    });

    expect(result.transport).toBe('clipboard');
    expect(result.filepath).toBe('Clips/Large Article.md');
    expect(result.uri).toContain('clipboard=true');
    expect(result.uri).not.toContain('data=');
  });

  test('normalizes Obsidian file paths without duplicating markdown extensions', () => {
    expect(buildObsidianFilepath('Folder/Subfolder', 'Note')).toBe('Folder/Subfolder/Note.md');
    expect(buildObsidianFilepath('Folder/Subfolder/', 'Note.md')).toBe('Folder/Subfolder/Note.md');
    expect(buildObsidianFilepath('', '')).toBe('Untitled.md');
  });
});
