/**
 * Real-World Bug Tests
 * Tests for actual bugs found in production use
 */

const { createTurndownService } = require('../helpers/browser-env');
const { parseArticle } = require('../helpers/browser-env');

describe('Real-World Bug Fixes', () => {
  describe('Weather API Documentation Bug', () => {
    test('should convert <mark> tags to inline code', () => {
      const { service } = createTurndownService();
      const html = '<p>The API endpoint <mark>/v1/forecast</mark> accepts coordinates.</p>';
      const result = service.turndown(html);

      // Currently fails - <mark> is not converted to code
      expect(result).toContain('`/v1/forecast`');
    });

    test('should not wrap headings in links when they contain anchors', () => {
      const { service } = createTurndownService();
      const html = `
        <div>
          <a href="#api_documentation">
            <h2 id="api_documentation">API Documentation</h2>
          </a>
        </div>
      `;
      const result = service.turndown(html);

      // Should be clean heading, not wrapped in link syntax
      expect(result).toContain('## API Documentation');
      expect(result).not.toContain('[##');
      expect(result).not.toContain('](#api');
    });

    test('should handle <br> in table cells correctly', () => {
      const { service } = createTurndownService();
      const html = `
        <table>
          <tr>
            <th>Variable</th>
            <th>Description</th>
          </tr>
          <tr>
            <td>wind_speed_10m<br />wind_speed_80m<br />wind_speed_120m</td>
            <td>Wind speed at different heights</td>
          </tr>
        </table>
      `;
      const result = service.turndown(html);

      // Should convert line breaks to something readable
      // Either commas or preserve line breaks, but not break table formatting
      expect(result).toContain('wind_speed');
      expect(result).toContain('|');
    });

    test('should not escape underscores in table cells', () => {
      const { service } = createTurndownService();
      const html = `
        <table>
          <tr><th>Variable</th></tr>
          <tr><td>temperature_2m</td></tr>
          <tr><td>apparent_temperature</td></tr>
        </table>
      `;
      const result = service.turndown(html);

      // Should NOT have escaped underscores
      expect(result).toContain('temperature_2m');
      expect(result).toContain('apparent_temperature');
      expect(result).not.toContain('temperature\\_2m');
      expect(result).not.toContain('apparent\\_temperature');
    });

    test('should convert complete weather API docs correctly', () => {
      const { service } = createTurndownService();
      const html = `
        <div class="mt-6 md:mt-12">
          <a href="#api_documentation">
            <h2 id="api_documentation">API Documentation</h2>
          </a>
          <div class="mt-2 md:mt-4">
            <p>
              The API endpoint <mark>/v1/forecast</mark> accepts a geographical coordinate, a list of
              weather variables and responds with a JSON hourly weather forecast for 7 days. If
              <mark>&forecast_days=16</mark> is set, up to 16 days of forecast can be returned.
            </p>
            <table>
              <thead>
                <tr>
                  <th>Parameter</th>
                  <th>Format</th>
                  <th>Required</th>
                  <th>Description</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <th>latitude, longitude</th>
                  <td>Floating point</td>
                  <td>Yes</td>
                  <td>Geographical WGS84 coordinates. E.g. <mark>&latitude=52.52</mark></td>
                </tr>
                <tr>
                  <th>temperature_unit</th>
                  <td>String</td>
                  <td>No</td>
                  <td>If <mark>fahrenheit</mark> is set, all temperature values are converted.</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      `;

      const result = service.turndown(html);

      // Verify correct conversion
      expect(result).toContain('## API Documentation');
      expect(result).not.toContain('[##');
      expect(result).toContain('`/v1/forecast`');
      expect(result).toContain('`&forecast_days=16`');
      expect(result).toContain('`&latitude=52.52`');
      expect(result).toContain('`fahrenheit`');
      expect(result).toContain('temperature_unit');
      expect(result).not.toContain('temperature\\_unit');
    });
  });

  describe('Readability Detection for Technical Docs', () => {
    test('should extract API documentation as main content', () => {
      const html = `
        <!DOCTYPE html>
        <html>
          <head><title>Weather API Documentation</title></head>
          <body>
            <header>
              <nav>Site Navigation</nav>
            </header>
            <main>
              <div class="mt-6 md:mt-12">
                <h2 id="api_documentation">API Documentation</h2>
                <p>The API endpoint /v1/forecast accepts a geographical coordinate...</p>
                <table>
                  <tr><th>Parameter</th><th>Description</th></tr>
                  <tr><td>latitude</td><td>Geographical coordinates</td></tr>
                </table>
              </div>
              <div class="mt-6 md:mt-12">
                <h3>Hourly Parameter Definition</h3>
                <p>The parameter &hourly= accepts the following values...</p>
                <table>
                  <tr><th>Variable</th><th>Description</th></tr>
                  <tr><td>temperature_2m</td><td>Air temperature</td></tr>
                </table>
              </div>
            </main>
          </body>
        </html>
      `;

      const { article } = parseArticle(html);

      // Should extract the API documentation
      expect(article).not.toBeNull();
      expect(article.content).toContain('API Documentation');
      expect(article.content).toContain('latitude');
      expect(article.content).toContain('temperature_2m');
    });
  });

  describe('Other Common Markdown Conversion Issues', () => {
    test('should handle nested emphasis in tables', () => {
      const { service } = createTurndownService();
      const html = `
        <table>
          <tr>
            <td><strong>Bold text</strong> with <em>italic</em></td>
          </tr>
        </table>
      `;
      const result = service.turndown(html);

      expect(result).toContain('**Bold text**');
      expect(result).toContain('*italic*');
    });

    test('should preserve code blocks in tables', () => {
      const { service } = createTurndownService();
      const html = `
        <table>
          <tr>
            <td><code>code example</code></td>
          </tr>
        </table>
      `;
      const result = service.turndown(html);

      expect(result).toContain('`code example`');
    });

    test('should handle complex table headers with scope attributes', () => {
      const { service } = createTurndownService();
      const html = `
        <table>
          <thead>
            <tr>
              <th scope="col">Parameter</th>
              <th scope="col">Format</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <th scope="row">latitude</th>
              <td>Floating point</td>
            </tr>
          </tbody>
        </table>
      `;
      const result = service.turndown(html);

      expect(result).toContain('Parameter');
      expect(result).toContain('Format');
      expect(result).toContain('latitude');
      expect(result).toContain('Floating point');
    });
  });
});
