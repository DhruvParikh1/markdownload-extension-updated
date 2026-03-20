const libraryState = require('../../shared/library-state');

describe('library-state helpers', () => {
  test('normalizes default library settings', () => {
    expect(libraryState.normalizeLibrarySettings()).toEqual({
      enabled: true,
      autoSaveOnPopupOpen: true,
      itemsToKeep: 10
    });
  });

  test('sanitizes invalid itemsToKeep values to a safe positive integer', () => {
    expect(libraryState.sanitizeItemsToKeep('')).toBe(10);
    expect(libraryState.sanitizeItemsToKeep('-5')).toBe(10);
    expect(libraryState.sanitizeItemsToKeep('0')).toBe(10);
    expect(libraryState.sanitizeItemsToKeep('3.9')).toBe(3);
    expect(libraryState.sanitizeItemsToKeep('7')).toBe(7);
  });

  test('builds readable preview text from markdown', () => {
    const preview = libraryState.buildPreviewText([
      '# Heading',
      '',
      'Paragraph with a [link](https://example.com) and `inline code`.',
      '',
      '```js',
      'const hidden = true;',
      '```'
    ].join('\n'));

    expect(preview).toContain('Heading');
    expect(preview).toContain('Paragraph with a link and inline code.');
    expect(preview).not.toContain('const hidden');
  });

  test('upserts a new item at the top of the library', () => {
    const items = libraryState.upsertLibraryItem([], {
      title: 'Example',
      markdown: 'Body copy',
      pageUrl: 'https://example.com/docs'
    }, 10);

    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({
      title: 'Example',
      pageUrl: 'https://example.com/docs',
      normalizedPageUrl: 'https://example.com/docs',
      previewText: 'Body copy'
    });
  });

  test('replaces existing item when the same normalized URL is saved again', () => {
    const firstPass = libraryState.upsertLibraryItem([], {
      id: 'first',
      title: 'Original',
      markdown: 'Old body',
      pageUrl: 'https://example.com/docs#intro'
    }, 10);

    const secondPass = libraryState.upsertLibraryItem(firstPass, {
      id: 'second',
      title: 'Updated',
      markdown: 'New body',
      pageUrl: 'https://example.com/docs'
    }, 10);

    expect(secondPass).toHaveLength(1);
    expect(secondPass[0]).toMatchObject({
      id: 'second',
      title: 'Updated',
      markdown: 'New body',
      normalizedPageUrl: 'https://example.com/docs'
    });
  });

  test('trims to the newest N items', () => {
    const items = [
      { id: 'a', title: 'A' },
      { id: 'b', title: 'B' },
      { id: 'c', title: 'C' }
    ];

    expect(libraryState.trimLibraryItems(items, 2).map((item) => item.id)).toEqual(['a', 'b']);
  });
});
