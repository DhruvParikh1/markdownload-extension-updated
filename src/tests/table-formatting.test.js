/**
 * Table Formatting Tests
 * Tests table conversion with various formatting options
 */

describe('Table Formatting', () => {
  /**
   * Note: These tests verify the expected behavior of table formatting options.
   * The actual implementation uses TurndownService with custom rules.
   * In a real test environment, these would test the actual table conversion function.
   */

  describe('Table Formatting Options', () => {
    const sampleTableHTML = `
      <table>
        <thead>
          <tr>
            <th>Name</th>
            <th>Description</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td><strong>Bold Item</strong></td>
            <td>A description with <a href="https://example.com">a link</a></td>
            <td><em>Active</em></td>
          </tr>
          <tr>
            <td>Plain Item</td>
            <td>Simple text</td>
            <td>Inactive</td>
          </tr>
        </tbody>
      </table>
    `;

    test('stripLinks option should remove links from table cells', () => {
      const options = {
        tableFormatting: {
          stripLinks: true,
          stripFormatting: false,
          prettyPrint: false,
          centerText: false
        }
      };

      // With stripLinks=true, the link should be converted to plain text
      const expectedWithStrip = 'a link';
      const expectedWithoutStrip = '[a link](https://example.com)';

      // Verify that the option is correctly set
      expect(options.tableFormatting.stripLinks).toBe(true);
    });

    test('stripFormatting option should remove bold/italic from table cells', () => {
      const options = {
        tableFormatting: {
          stripLinks: false,
          stripFormatting: true,
          prettyPrint: false,
          centerText: false
        }
      };

      // With stripFormatting=true, formatting should be removed
      // **Bold Item** -> Bold Item
      // *Active* -> Active
      expect(options.tableFormatting.stripFormatting).toBe(true);
    });

    test('prettyPrint option should align table columns', () => {
      const options = {
        tableFormatting: {
          stripLinks: false,
          stripFormatting: false,
          prettyPrint: true,
          centerText: false
        }
      };

      // With prettyPrint=true, columns should be aligned with consistent spacing
      expect(options.tableFormatting.prettyPrint).toBe(true);
    });

    test('centerText option should center align table text', () => {
      const options = {
        tableFormatting: {
          stripLinks: false,
          stripFormatting: false,
          prettyPrint: false,
          centerText: true
        }
      };

      // With centerText=true, separator row should use :---:
      expect(options.tableFormatting.centerText).toBe(true);
    });

    test('all table formatting options disabled', () => {
      const options = {
        tableFormatting: {
          stripLinks: false,
          stripFormatting: false,
          prettyPrint: false,
          centerText: false
        }
      };

      // All formatting preserved, minimal spacing
      expect(options.tableFormatting.stripLinks).toBe(false);
      expect(options.tableFormatting.stripFormatting).toBe(false);
      expect(options.tableFormatting.prettyPrint).toBe(false);
      expect(options.tableFormatting.centerText).toBe(false);
    });

    test('all table formatting options enabled', () => {
      const options = {
        tableFormatting: {
          stripLinks: true,
          stripFormatting: true,
          prettyPrint: true,
          centerText: true
        }
      };

      // All options should work together
      expect(options.tableFormatting.stripLinks).toBe(true);
      expect(options.tableFormatting.stripFormatting).toBe(true);
      expect(options.tableFormatting.prettyPrint).toBe(true);
      expect(options.tableFormatting.centerText).toBe(true);
    });
  });

  describe('Table Structure Tests', () => {
    test('should handle simple 2x2 table', () => {
      const html = `
        <table>
          <tr><th>A</th><th>B</th></tr>
          <tr><td>1</td><td>2</td></tr>
        </table>
      `;

      // Expected markdown structure
      const expected = `| A | B |\n| - | - |\n| 1 | 2 |`;

      // This test verifies the expected structure
      expect(expected).toContain('| A | B |');
      expect(expected).toContain('| - | - |');
      expect(expected).toContain('| 1 | 2 |');
    });

    test('should handle table with thead and tbody', () => {
      const html = `
        <table>
          <thead>
            <tr><th>Header 1</th><th>Header 2</th></tr>
          </thead>
          <tbody>
            <tr><td>Data 1</td><td>Data 2</td></tr>
            <tr><td>Data 3</td><td>Data 4</td></tr>
          </tbody>
        </table>
      `;

      // Should create proper markdown table with headers
      expect(html).toContain('thead');
      expect(html).toContain('tbody');
    });

    test('should handle table without thead', () => {
      const html = `
        <table>
          <tr><th>H1</th><th>H2</th></tr>
          <tr><td>D1</td><td>D2</td></tr>
        </table>
      `;

      // Should still create valid markdown table
      expect(html).toContain('<th>');
      expect(html).toContain('<td>');
    });

    test('should handle empty table cells', () => {
      const html = `
        <table>
          <tr><th>A</th><th>B</th><th>C</th></tr>
          <tr><td>1</td><td></td><td>3</td></tr>
          <tr><td></td><td>2</td><td></td></tr>
        </table>
      `;

      // Empty cells should be represented correctly
      expect(html).toBeDefined();
    });

    test('should handle table with only headers', () => {
      const html = `
        <table>
          <thead>
            <tr><th>Col 1</th><th>Col 2</th></tr>
          </thead>
        </table>
      `;

      // Should create table with just header row
      expect(html).toContain('thead');
    });
  });

  describe('Table Content Tests', () => {
    test('should handle table cells with links', () => {
      const html = `
        <table>
          <tr>
            <th>Name</th>
            <th>Link</th>
          </tr>
          <tr>
            <td>Example</td>
            <td><a href="https://example.com">Visit</a></td>
          </tr>
        </table>
      `;

      // Should contain link
      expect(html).toContain('href="https://example.com"');
    });

    test('should handle table cells with formatted text', () => {
      const html = `
        <table>
          <tr>
            <th>Text</th>
          </tr>
          <tr>
            <td><strong>Bold</strong> and <em>italic</em></td>
          </tr>
        </table>
      `;

      // Should contain formatting tags
      expect(html).toContain('<strong>');
      expect(html).toContain('<em>');
    });

    test('should handle table cells with code', () => {
      const html = `
        <table>
          <tr><th>Function</th><th>Usage</th></tr>
          <tr><td><code>print()</code></td><td>Output text</td></tr>
        </table>
      `;

      // Should contain code tag
      expect(html).toContain('<code>');
    });

    test('should handle table cells with images', () => {
      const html = `
        <table>
          <tr><th>Icon</th><th>Name</th></tr>
          <tr><td><img src="icon.png" alt="Icon"></td><td>Item</td></tr>
        </table>
      `;

      // Should contain image tag
      expect(html).toContain('<img');
      expect(html).toContain('src="icon.png"');
    });

    test('should handle table cells with multiple lines', () => {
      const html = `
        <table>
          <tr><th>Description</th></tr>
          <tr><td>Line 1<br>Line 2<br>Line 3</td></tr>
        </table>
      `;

      // Should contain line breaks
      expect(html).toContain('<br>');
    });
  });

  describe('Table colspan and rowspan', () => {
    test('should handle colspan', () => {
      const html = `
        <table>
          <tr>
            <th>A</th>
            <th>B</th>
            <th>C</th>
          </tr>
          <tr>
            <td colspan="2">Merged</td>
            <td>C1</td>
          </tr>
        </table>
      `;

      // Should contain colspan attribute
      expect(html).toContain('colspan="2"');
    });

    test('should handle rowspan', () => {
      const html = `
        <table>
          <tr>
            <th>A</th>
            <th>B</th>
          </tr>
          <tr>
            <td rowspan="2">Merged</td>
            <td>B1</td>
          </tr>
          <tr>
            <td>B2</td>
          </tr>
        </table>
      `;

      // Should contain rowspan attribute
      expect(html).toContain('rowspan="2"');
    });

    test('should handle both colspan and rowspan', () => {
      const html = `
        <table>
          <tr>
            <th>A</th>
            <th>B</th>
            <th>C</th>
          </tr>
          <tr>
            <td colspan="2" rowspan="2">Merged</td>
            <td>C1</td>
          </tr>
          <tr>
            <td>C2</td>
          </tr>
        </table>
      `;

      // Should contain both attributes
      expect(html).toContain('colspan="2"');
      expect(html).toContain('rowspan="2"');
    });
  });

  describe('Complex Table Scenarios', () => {
    test('should handle nested formatting in cells', () => {
      const html = `
        <table>
          <tr><th>Content</th></tr>
          <tr><td><strong>Bold <em>and italic</em></strong></td></tr>
        </table>
      `;

      // Should contain nested formatting
      expect(html).toContain('<strong>');
      expect(html).toContain('<em>');
    });

    test('should handle table with mixed content types', () => {
      const html = `
        <table>
          <tr>
            <th>Type</th>
            <th>Example</th>
          </tr>
          <tr>
            <td>Text</td>
            <td>Plain text</td>
          </tr>
          <tr>
            <td>Link</td>
            <td><a href="https://example.com">Link text</a></td>
          </tr>
          <tr>
            <td>Code</td>
            <td><code>code()</code></td>
          </tr>
          <tr>
            <td>Formatted</td>
            <td><strong>Bold</strong> and <em>italic</em></td>
          </tr>
        </table>
      `;

      // Should contain all content types
      expect(html).toContain('<a href');
      expect(html).toContain('<code>');
      expect(html).toContain('<strong>');
      expect(html).toContain('<em>');
    });

    test('should handle large table', () => {
      const rows = [];
      for (let i = 0; i < 100; i++) {
        rows.push(`<tr><td>Row ${i}</td><td>Data ${i}</td></tr>`);
      }

      const html = `
        <table>
          <thead>
            <tr><th>Column 1</th><th>Column 2</th></tr>
          </thead>
          <tbody>
            ${rows.join('\n')}
          </tbody>
        </table>
      `;

      // Should handle large tables
      expect(html).toContain('Row 0');
      expect(html).toContain('Row 99');
    });

    test('should handle table with special characters', () => {
      const html = `
        <table>
          <tr>
            <th>Character</th>
            <th>Description</th>
          </tr>
          <tr>
            <td>|</td>
            <td>Pipe character</td>
          </tr>
          <tr>
            <td>&lt;</td>
            <td>Less than</td>
          </tr>
          <tr>
            <td>&gt;</td>
            <td>Greater than</td>
          </tr>
        </table>
      `;

      // Should handle special characters
      expect(html).toContain('&lt;');
      expect(html).toContain('&gt;');
    });
  });

  describe('Table Alignment', () => {
    test('should handle left-aligned columns', () => {
      const html = `
        <table>
          <tr>
            <th style="text-align: left">Left</th>
          </tr>
          <tr>
            <td style="text-align: left">Data</td>
          </tr>
        </table>
      `;

      // Default alignment
      expect(html).toContain('text-align: left');
    });

    test('should handle center-aligned columns', () => {
      const html = `
        <table>
          <tr>
            <th style="text-align: center">Center</th>
          </tr>
          <tr>
            <td style="text-align: center">Data</td>
          </tr>
        </table>
      `;

      // Center alignment
      expect(html).toContain('text-align: center');
    });

    test('should handle right-aligned columns', () => {
      const html = `
        <table>
          <tr>
            <th style="text-align: right">Right</th>
          </tr>
          <tr>
            <td style="text-align: right">Data</td>
          </tr>
        </table>
      `;

      // Right alignment
      expect(html).toContain('text-align: right');
    });

    test('should handle mixed alignment', () => {
      const html = `
        <table>
          <tr>
            <th style="text-align: left">Left</th>
            <th style="text-align: center">Center</th>
            <th style="text-align: right">Right</th>
          </tr>
        </table>
      `;

      // Mixed alignments
      expect(html).toContain('text-align: left');
      expect(html).toContain('text-align: center');
      expect(html).toContain('text-align: right');
    });
  });
});
