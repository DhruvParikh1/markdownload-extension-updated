/**
 * URL Processing and Normalization Tests
 * Tests URL validation, resolution, and normalization functionality
 */

describe('URL Processing and Normalization', () => {
  /**
   * validateUri function - copied from offscreen.js for testing
   */
  function validateUri(href, baseURI) {
    // Check if the href is a valid url
    try {
      new URL(href);
    } catch {
      // If it's not a valid url, that likely means we have to prepend the base uri
      const baseUri = new URL(baseURI);

      // If the href starts with '/', we need to go from the origin
      if (href.startsWith('/')) {
        href = baseUri.origin + href;
      }
      // Otherwise we need to go from the local folder
      else {
        href = baseUri.href + (baseUri.href.endsWith('/') ? '' : '/') + href;
      }
    }
    return href;
  }

  /**
   * getImageFilename function - simplified version from offscreen.js
   */
  function getImageFilename(src, options = {}, prependFilePath = true) {
    const slashPos = src.lastIndexOf('/');
    const queryPos = src.indexOf('?');
    let filename = src.substring(slashPos + 1, queryPos > 0 ? queryPos : src.length);

    let imagePrefix = (options.imagePrefix || '');

    if (prependFilePath) {
      filename = imagePrefix + filename;
    }

    return filename;
  }

  describe('Absolute URL Validation', () => {
    test('should keep absolute HTTP URLs unchanged', () => {
      const href = 'http://example.com/page';
      const baseURI = 'http://example.com';
      const result = validateUri(href, baseURI);

      expect(result).toBe('http://example.com/page');
    });

    test('should keep absolute HTTPS URLs unchanged', () => {
      const href = 'https://example.com/page';
      const baseURI = 'https://example.com';
      const result = validateUri(href, baseURI);

      expect(result).toBe('https://example.com/page');
    });

    test('should keep URLs with different domains unchanged', () => {
      const href = 'https://other.com/page';
      const baseURI = 'https://example.com';
      const result = validateUri(href, baseURI);

      expect(result).toBe('https://other.com/page');
    });

    test('should keep URLs with ports unchanged', () => {
      const href = 'https://example.com:8080/page';
      const baseURI = 'https://example.com';
      const result = validateUri(href, baseURI);

      expect(result).toBe('https://example.com:8080/page');
    });
  });

  describe('Relative URL Resolution', () => {
    test('should resolve root-relative URLs', () => {
      const href = '/docs/guide';
      const baseURI = 'https://example.com/blog/post';
      const result = validateUri(href, baseURI);

      expect(result).toBe('https://example.com/docs/guide');
    });

    test('should resolve root-relative URLs with port', () => {
      const href = '/api/data';
      const baseURI = 'https://example.com:3000/app';
      const result = validateUri(href, baseURI);

      expect(result).toBe('https://example.com:3000/api/data');
    });

    test('should resolve path-relative URLs', () => {
      const href = 'page.html';
      const baseURI = 'https://example.com/docs/';
      const result = validateUri(href, baseURI);

      expect(result).toBe('https://example.com/docs/page.html');
    });

    test('should resolve path-relative URLs without trailing slash', () => {
      const href = 'page.html';
      const baseURI = 'https://example.com/docs';
      const result = validateUri(href, baseURI);

      expect(result).toBe('https://example.com/docs/page.html');
    });

    test('should resolve subdirectory relative URLs', () => {
      const href = 'images/photo.jpg';
      const baseURI = 'https://example.com/blog/';
      const result = validateUri(href, baseURI);

      expect(result).toBe('https://example.com/blog/images/photo.jpg');
    });
  });

  describe('Edge Cases', () => {
    test('should handle URLs with query strings', () => {
      const href = 'https://example.com/page?id=123';
      const baseURI = 'https://example.com';
      const result = validateUri(href, baseURI);

      expect(result).toBe('https://example.com/page?id=123');
    });

    test('should handle URLs with fragments', () => {
      const href = 'https://example.com/page#section';
      const baseURI = 'https://example.com';
      const result = validateUri(href, baseURI);

      expect(result).toBe('https://example.com/page#section');
    });

    test('should handle relative URLs with query strings', () => {
      const href = '/page?id=123';
      const baseURI = 'https://example.com/blog';
      const result = validateUri(href, baseURI);

      expect(result).toBe('https://example.com/page?id=123');
    });

    test('should handle relative URLs with fragments', () => {
      const href = '/page#section';
      const baseURI = 'https://example.com/blog';
      const result = validateUri(href, baseURI);

      expect(result).toBe('https://example.com/page#section');
    });

    test('should handle empty path', () => {
      const href = '/';
      const baseURI = 'https://example.com/blog';
      const result = validateUri(href, baseURI);

      expect(result).toBe('https://example.com/');
    });
  });

  describe('Protocol Handling', () => {
    test('should keep data URIs unchanged', () => {
      const href = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAUA';
      const baseURI = 'https://example.com';
      const result = validateUri(href, baseURI);

      expect(result).toBe('data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAUA');
    });

    test('should keep mailto links unchanged', () => {
      const href = 'mailto:test@example.com';
      const baseURI = 'https://example.com';
      const result = validateUri(href, baseURI);

      expect(result).toBe('mailto:test@example.com');
    });

    test('should keep tel links unchanged', () => {
      const href = 'tel:+1234567890';
      const baseURI = 'https://example.com';
      const result = validateUri(href, baseURI);

      expect(result).toBe('tel:+1234567890');
    });
  });

  describe('Image Filename Extraction', () => {
    test('should extract filename from URL', () => {
      const src = 'https://example.com/images/photo.jpg';
      const result = getImageFilename(src);

      expect(result).toBe('photo.jpg');
    });

    test('should extract filename with image prefix', () => {
      const src = 'https://example.com/images/photo.jpg';
      const options = { imagePrefix: 'img-' };
      const result = getImageFilename(src, options);

      expect(result).toBe('img-photo.jpg');
    });

    test('should extract filename without query string', () => {
      const src = 'https://example.com/images/photo.jpg?size=large';
      const result = getImageFilename(src);

      expect(result).toBe('photo.jpg');
    });

    test('should extract filename from complex path', () => {
      const src = 'https://example.com/cdn/v2/assets/images/photo.jpg';
      const result = getImageFilename(src);

      expect(result).toBe('photo.jpg');
    });

    test('should handle filename with multiple dots', () => {
      const src = 'https://example.com/my.image.file.jpg';
      const result = getImageFilename(src);

      expect(result).toBe('my.image.file.jpg');
    });

    test('should handle filename without extension', () => {
      const src = 'https://example.com/images/photo';
      const result = getImageFilename(src);

      expect(result).toBe('photo');
    });

    test('should not prepend prefix when prependFilePath is false', () => {
      const src = 'https://example.com/images/photo.jpg';
      const options = { imagePrefix: 'img-' };
      const result = getImageFilename(src, options, false);

      expect(result).toBe('photo.jpg');
    });
  });

  describe('Base URL Scenarios', () => {
    test('should resolve URLs from blog post', () => {
      const baseURI = 'https://example.com/blog/2024/01/post.html';

      expect(validateUri('/images/photo.jpg', baseURI)).toBe('https://example.com/images/photo.jpg');
      expect(validateUri('photo.jpg', baseURI)).toBe('https://example.com/blog/2024/01/post.html/photo.jpg');
      expect(validateUri('https://cdn.example.com/photo.jpg', baseURI)).toBe('https://cdn.example.com/photo.jpg');
    });

    test('should resolve URLs from documentation page', () => {
      const baseURI = 'https://docs.example.com/v2/api/';

      expect(validateUri('/static/logo.png', baseURI)).toBe('https://docs.example.com/static/logo.png');
      expect(validateUri('reference.html', baseURI)).toBe('https://docs.example.com/v2/api/reference.html');
      expect(validateUri('https://example.com/', baseURI)).toBe('https://example.com/');
    });

    test('should resolve URLs from Obsidian Publish page', () => {
      const baseURI = 'https://publish.obsidian.md/advanced-uri-doc/Actions/Writing';

      expect(validateUri('/advanced-uri-doc/Home', baseURI)).toBe('https://publish.obsidian.md/advanced-uri-doc/Home');
      expect(validateUri('Navigation', baseURI)).toBe('https://publish.obsidian.md/advanced-uri-doc/Actions/Writing/Navigation');
      expect(validateUri('https://obsidian.md', baseURI)).toBe('https://obsidian.md');
    });
  });

  describe('URL Normalization', () => {
    test('should handle double slashes in path', () => {
      const href = 'https://example.com//path//to//page';
      const baseURI = 'https://example.com';
      const result = validateUri(href, baseURI);

      expect(result).toBe('https://example.com//path//to//page');
    });

    test('should preserve URL encoding', () => {
      const href = 'https://example.com/path%20with%20spaces';
      const baseURI = 'https://example.com';
      const result = validateUri(href, baseURI);

      expect(result).toBe('https://example.com/path%20with%20spaces');
    });

    test('should handle URLs with authentication', () => {
      const href = 'https://user:pass@example.com/page';
      const baseURI = 'https://example.com';
      const result = validateUri(href, baseURI);

      expect(result).toBe('https://user:pass@example.com/page');
    });
  });

  describe('Error Cases', () => {
    test('should handle malformed base URI gracefully', () => {
      const href = 'page.html';
      const baseURI = 'not-a-valid-url';

      expect(() => validateUri(href, baseURI)).toThrow();
    });

    test('should handle empty href with valid base', () => {
      const href = '';
      const baseURI = 'https://example.com/blog/';
      const result = validateUri(href, baseURI);

      // Empty string is still added to the base
      expect(result).toBe('https://example.com/blog/');
    });
  });
});
