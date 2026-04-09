/**
 * Real-World Bug Tests
 * Tests for actual bugs found in production use
 */

const { JSDOM } = require('jsdom');
const { createBrowserEnvironment, createTurndownService, parseArticle } = require('../helpers/browser-env');
const htmlSamples = require('../fixtures/html-samples');

function prepareDocumentForRecoveryTest(document, recoveryApi) {
  document.querySelectorAll('a')?.forEach(anchor => {
    const heading = Array.from(anchor.children).find(child =>
      /^H[1-6]$/.test(child.nodeName)
    );
    if (heading && anchor.children.length === 1) {
      anchor.parentNode.insertBefore(heading, anchor);
      anchor.parentNode.removeChild(anchor);
    }
  });

  document.querySelectorAll('h1, h2, h3, h4, h5, h6')?.forEach(header => {
    header.className = '';
    header.outerHTML = header.outerHTML;
  });

  recoveryApi.annotateStructuralAnchors(document);
}

function inspectRecoveryPlan(html, url = 'https://example.com') {
  const env = createBrowserEnvironment();
  const dom = new JSDOM(html, { url });
  prepareDocumentForRecoveryTest(dom.window.document, env.ReadabilityRecovery);

  const firstPassDom = new JSDOM(dom.serialize(), { url });
  const firstPassArticle = new env.Readability(firstPassDom.window.document).parse();
  const recoveryPlan = firstPassArticle?.content
    ? env.ReadabilityRecovery.analyzeNarrowExtraction(dom.window.document, firstPassArticle.content)
    : null;

  return {
    article: firstPassArticle,
    recoveryPlan
  };
}

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
      // Note: Readability may extract different portions depending on content heuristics
      expect(article).not.toBeNull();
      // At minimum, it should extract some content from the main section
      expect(article.content).toBeTruthy();
      // Check for at least one of the expected sections
      const hasExpectedContent =
        article.content.includes('API Documentation') ||
        article.content.includes('Hourly Parameter') ||
        article.content.includes('temperature_2m');
      expect(hasExpectedContent).toBe(true);
    });

    test('should recover repeated section siblings when the first pass lands on an inner body wrapper', () => {
      const html = `
        <!DOCTYPE html>
        <html>
          <head>
            <title>Portable C Toolchain Notes</title>
          </head>
          <body>
            <main id="content">
              <h1 class="title">Portable C Toolchain Notes</h1>
              <hr />
              <p>
                This guide collects the setup notes, memory model caveats, and wrapper details
                required to build a tiny standalone executable with a portable C toolchain.
              </p>

              <section class="doc-section section-1">
                <h2>Explicit FAR pointer</h2>
                <div class="section-body body-1">
                  <p>
                    The segmented 8086 memory model means the tiny memory profile defaults to
                    near pointers, so direct writes to video memory require an explicit far
                    pointer rather than a plain pointer cast.
                  </p>
                  <div class="source-block">
                    <pre><code>void main(void) {
    char* x = (char*) 0xb8000000;
    x[0] = 'A';
}</code></pre>
                  </div>
                  <p>
                    The generated object code makes the mistake visible because the segment half is
                    missing entirely, which proves the compiler treated the value as a near pointer
                    and ignored the upper address component.
                  </p>
                </div>
              </section>

              <section class="doc-section section-2">
                <h2>Replacing the wrapper</h2>
                <div class="section-body body-2">
                  <p>
                    The default startup object pulls in DOS specific behavior, so a true standalone
                    executable needs its own entry point, stack setup, and linker-visible symbols.
                  </p>
                  <blockquote>
                    <p>
                      Tiny model programs are linked with a special initialization object that must
                      appear first on the linker command line.
                    </p>
                  </blockquote>
                  <ul>
                    <li>The wrapper must export <code>_cstart_</code>.</li>
                    <li>The wrapper must export <code>_small_code_</code>.</li>
                    <li>The wrapper may export <code>__STK</code> for stack checks.</li>
                  </ul>
                </div>
              </section>

              <section class="doc-section section-3">
                <h2>Full code</h2>

                <section class="example-section example-1">
                  <h3>wrapper.asm</h3>
                  <div class="example-body body-3">
                    <div class="source-block">
                      <pre><code>.8086
.model tiny
.code
ORG 100h
_cstart_:
  STI
  MOV SP, 0FFFEh
  CALL main_
  RET</code></pre>
                    </div>
                    <p>Compile with <code>wasm wrapper.asm</code>.</p>
                  </div>
                </section>

                <section class="example-section example-2">
                  <h3>main.c</h3>
                  <div class="example-body body-4">
                    <div class="source-block">
                      <pre><code>void main(void) {
    char far* x = (char far*) 0xb8000000;
    x[0] = 'A';
    x[1] = 0x70;
}</code></pre>
                    </div>
                    <p>Compile with <code>wcc -0 -ms main.c</code>.</p>
                  </div>
                </section>

                <section class="example-section example-3">
                  <h3>main.lnk</h3>
                  <div class="example-body body-5">
                    <div class="source-block">
                      <pre><code>format dos com
option map
name main.com
file wrapper.o, main.o</code></pre>
                    </div>
                    <p>
                      Link with <code>wlink @main.lnk</code> and the resulting COM program will
                      place a highlighted A at the top-left corner of the display.
                    </p>
                  </div>
                </section>
              </section>
            </main>
          </body>
        </html>
      `;

      const { article } = parseArticle(html, 'https://example.com/toolchain-notes.html');

      expect(article).not.toBeNull();
      expect(article.content).toContain('This guide collects the setup notes');
      expect(article.content).toContain('Explicit FAR pointer');
      expect(article.content).toContain('Replacing the wrapper');
      expect(article.content).toContain('Full code');
      expect(article.content).toContain('wrapper.asm');
      expect(article.content).toContain('main.lnk');
    });

    test('should recover repeated nested-heading section siblings when the first pass lands on a wrapped body', () => {
      const html = `
        <!DOCTYPE html>
        <html>
          <head><title>Gateway Integration Guide</title></head>
          <body>
            <main class="api-content">
              <h1>Gateway Integration Guide</h1>
              <p>
                This guide explains how merchants can integrate with the gateway, review required
                request formats, and validate signatures before going live.
              </p>

              <div class="doc-section section-1">
                <div class="heading-row row-1">
                  <div class="heading-inner inner-1">
                    <h2>Introduction</h2>
                  </div>
                </div>
                <div class="doc-body body-1">
                  <p>
                    The introduction explains the system roles, the environment split, and the
                    basic checkout flow.
                  </p>
                  <p>
                    It also calls out the most important operational constraints that apply before
                    launch.
                  </p>
                </div>
              </div>

              <div class="doc-section section-2">
                <div class="heading-row row-2">
                  <div class="heading-inner inner-2">
                    <h2>Authentication</h2>
                  </div>
                </div>
                <div class="doc-body body-2">
                  <p>
                    Authentication uses a merchant identifier and a calculated signature over the
                    serialized request.
                  </p>
                  <ul>
                    <li>Sort fields by name.</li>
                    <li>Normalize line endings.</li>
                    <li>Append the signing key before hashing.</li>
                  </ul>
                </div>
              </div>

              <div class="doc-section section-3">
                <div class="heading-row row-3">
                  <div class="heading-inner inner-3">
                    <h2>HTTP Requests</h2>
                  </div>
                </div>
                <div class="doc-body body-3">
                  <p>
                    Requests are sent as URL-encoded form bodies and may include nested field
                    groups.
                  </p>
                  <table>
                    <tr><th>Field</th><th>Description</th></tr>
                    <tr><td>merchantID</td><td>Assigned account identifier.</td></tr>
                    <tr><td>signature</td><td>Request authentication hash.</td></tr>
                  </table>
                </div>
              </div>

              <div class="doc-section section-4">
                <div class="heading-row row-4">
                  <div class="heading-inner inner-4">
                    <h2>Example Integration Code</h2>
                  </div>
                </div>
                <div class="doc-body body-4">
                  <p>
                    This section provides samples of how to integrate with the gateway using direct
                    HTTP requests.
                  </p>
                  <pre><code>const payload = {
  merchantID: '100001',
  action: 'SALE',
  amount: 1001,
  currencyCode: 826,
  orderRef: 'Test purchase',
  transactionUnique: 'abc123',
  redirectURL: 'https://merchant.example/callback'
};

const normalized = serialize(payload);
const signature = sha512(normalized + signingKey);
const response = await postForm('/direct', { ...payload, signature });
const verification = verifyResponse(response, signingKey);
if (!verification.valid) {
  throw new Error('Signature check failed');
}</code></pre>
                  <p>
                    The response handler must verify the signature and store the reference for later
                    actions.
                  </p>
                </div>
              </div>
            </main>
          </body>
        </html>
      `;

      const { article } = parseArticle(html, 'https://example.com/redoc-like.html');
      const { article: firstPassArticle, recoveryPlan } = inspectRecoveryPlan(html, 'https://example.com/redoc-like.html');

      expect(firstPassArticle).not.toBeNull();
      expect(recoveryPlan).not.toBeNull();
      expect(firstPassArticle.content).not.toContain('Introduction');
      expect(firstPassArticle.content).toContain('This section provides samples of how to integrate with the gateway');

      expect(article).not.toBeNull();
      expect(article.content).toContain('This guide explains how merchants can integrate with the gateway');
      expect(article.content).toContain('Introduction');
      expect(article.content).toContain('Authentication');
      expect(article.content).toContain('HTTP Requests');
      expect(article.content).toContain('Example Integration Code');
      expect(article.content).toContain('This section provides samples of how to integrate with the gateway');
      expect((article.content.match(/Introduction/g) || [])).toHaveLength(1);
      expect((article.content.match(/Example Integration Code/g) || [])).toHaveLength(1);
    });

    test('should preserve FAQ questions when headings are wrapped with decorative controls', () => {
      const html = `
        <!DOCTYPE html>
        <html>
          <head><title>Color FAQ Guide</title></head>
          <body>
            <main class="faq-content">
              <h1>Color FAQ Guide</h1>
              <p>
                This guide explains the primary brand colors and answers common questions about
                how the palette is used in the product interface.
              </p>

              <div class="faq-list">
                <div class="faq-item">
                  <div class="faq-question">
                    <h2>What are the main colors in the palette?</h2>
                    <div class="faq-icon"><svg aria-hidden="true"></svg></div>
                  </div>
                  <div class="faq-answer">
                    <p>
                      The main colors are ember orange, slate gray, warm ivory, and white.
                    </p>
                  </div>
                </div>

                <div class="faq-item">
                  <div class="faq-question">
                    <h2>How are the colors used in the product?</h2>
                    <div class="faq-icon"><svg aria-hidden="true"></svg></div>
                  </div>
                  <div class="faq-answer">
                    <p>
                      The palette highlights primary actions, keeps neutral surfaces calm, and
                      preserves contrast for dense interface layouts.
                    </p>
                  </div>
                </div>
              </div>
            </main>
          </body>
        </html>
      `;

      const { article } = parseArticle(html, 'https://example.com/color-faq.html');

      expect(article).not.toBeNull();
      expect(article.content).toContain('What are the main colors in the palette?');
      expect(article.content).toContain('The main colors are ember orange, slate gray, warm ivory, and white.');
      expect(article.content).toContain('How are the colors used in the product?');
      expect(article.content).toContain('The palette highlights primary actions, keeps neutral surfaces calm');
    });

    test('should restore semantic tables when extracted markup is downgraded to ARIA table roles', () => {
      const sourceHtml = `
        <!DOCTYPE html>
        <html>
          <head><title>Brand Palette</title></head>
          <body>
            <main>
              <table>
                <thead>
                  <tr>
                    <th>HEX</th>
                    <th>RGB</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>#c15f3c</td>
                    <td>193, 95, 60</td>
                  </tr>
                </tbody>
              </table>
            </main>
          </body>
        </html>
      `;

      const env = createBrowserEnvironment();
      const dom = new JSDOM(sourceHtml, { url: 'https://example.com/palette.html' });
      prepareDocumentForRecoveryTest(dom.window.document, env.ReadabilityRecovery);

      const sourceTable = dom.window.document.querySelector('table');
      const tableAnchorId = sourceTable.getAttribute(env.ReadabilityRecovery.anchorAttribute);
      const extractedHtml = `
        <div role="table" data-marksnip-node-id="${tableAnchorId}">
          <div role="row">
            <div role="cell"><p>#c15f3c</p></div>
            <div role="cell"><p>193, 95, 60</p></div>
          </div>
        </div>
      `;

      const restoredHtml = env.ReadabilityRecovery.restoreSemanticTables(dom.window.document, extractedHtml);
      const { service } = createTurndownService();
      const markdown = service.turndown(restoredHtml);

      expect(restoredHtml).toContain('<table');
      expect(restoredHtml).toContain('HEX');
      expect(markdown).toContain('| HEX | RGB |');
      expect(markdown).toContain('#c15f3c');
      expect(markdown).toContain('193, 95, 60');
    });

    test('should rebuild semantic tables from role-based source tables with separate header rows', () => {
      const sourceHtml = `
        <!DOCTYPE html>
        <html>
          <head><title>Brand Palette</title></head>
          <body>
            <main>
              <div role="table" class="palette-grid">
                <div class="header-strip">
                  <div role="cell" class="value-box emphasis"><h2>HEX</h2></div>
                  <div role="cell" class="value-box emphasis"><h2>RGB</h2></div>
                  <div role="cell" class="value-box emphasis" style="display: none;"><h2>Hidden column</h2></div>
                </div>
                <div role="row" class="data-line">
                  <div role="cell" class="value-box"><div>#c15f3c</div></div>
                  <div role="cell" class="value-box"><div>193, 95, 60</div></div>
                </div>
              </div>
            </main>
          </body>
        </html>
      `;

      const env = createBrowserEnvironment();
      const dom = new JSDOM(sourceHtml, { url: 'https://example.com/role-table.html' });
      prepareDocumentForRecoveryTest(dom.window.document, env.ReadabilityRecovery);

      const sourceTable = dom.window.document.querySelector('[role="table"]');
      const tableAnchorId = sourceTable.getAttribute(env.ReadabilityRecovery.anchorAttribute);
      const extractedHtml = `
        <div role="table" data-marksnip-node-id="${tableAnchorId}">
          <div role="row">
            <div role="cell"><p>#c15f3c</p></div>
            <div role="cell"><p>193, 95, 60</p></div>
          </div>
        </div>
      `;

      const restoredHtml = env.ReadabilityRecovery.restoreSemanticTables(dom.window.document, extractedHtml);
      const { service } = createTurndownService();
      const markdown = service.turndown(restoredHtml);

      expect(restoredHtml).toContain('<table');
      expect(restoredHtml).toContain('HEX');
      expect(restoredHtml).toContain('RGB');
      expect(restoredHtml).not.toContain('Hidden column');
      expect(markdown).toContain('| HEX | RGB |');
      expect(markdown).toContain('#c15f3c');
      expect(markdown).toContain('193, 95, 60');
    });

    test('should not trigger recovery on repeated card listings', () => {
      const html = `
        <!DOCTYPE html>
        <html>
          <head><title>Tooling Catalog</title></head>
          <body>
            <main class="docs-grid">
              <section class="tool-card card-1">
                <h2>Assembler Basics</h2>
                <div class="card-copy copy-1">
                  <p>
                    This card describes the assembler workflow, the source layout, and how the
                    sample project is organized for quick reading and catalog browsing.
                  </p>
                  <p>
                    The copy is intentionally long so the first card looks article-like, but the
                    page is still a catalog of cards rather than one continuous article.
                  </p>
                </div>
              </section>
              <section class="tool-card card-2">
                <h2>Linker Maps</h2>
                <div class="card-copy copy-2">
                  <p>
                    This card summarizes linker maps, relocation notes, and output layout details
                    for a different topic in the catalog.
                  </p>
                  <p>
                    It should not be merged just because it has the same heading plus body shape.
                  </p>
                </div>
              </section>
              <section class="tool-card card-3">
                <h2>Debugger Tips</h2>
                <div class="card-copy copy-3">
                  <p>
                    This card covers debugger shortcuts, watch windows, and stepping behavior for
                    a third catalog entry.
                  </p>
                </div>
              </section>
            </main>
          </body>
        </html>
      `;

      const { article, recoveryPlan } = inspectRecoveryPlan(html, 'https://example.com/catalog.html');

      expect(article).not.toBeNull();
      expect(recoveryPlan).toBeNull();
      expect(article.content).toContain('Assembler Basics');
      expect(article.content).toContain('Linker Maps');
      expect(article.content).toContain('Debugger Tips');
    });

    test('should not trigger recovery on nested-heading catalog cards', () => {
      const html = `
        <!DOCTYPE html>
        <html>
          <head><title>Tooling Catalog</title></head>
          <body>
            <main class="catalog-grid">
              <div class="catalog-card card-1">
                <div class="heading-row row-1">
                  <div class="heading-inner inner-1">
                    <h2>Assembler Basics</h2>
                  </div>
                </div>
                <div class="catalog-copy copy-1">
                  <p>
                    This card describes the assembler workflow, the source layout, and how the
                    sample project is organized for quick browsing.
                  </p>
                  <p>
                    The nested heading wrapper should not cause card listings to be merged as if
                    they were one long article.
                  </p>
                </div>
              </div>

              <div class="catalog-card card-2">
                <div class="heading-row row-2">
                  <div class="heading-inner inner-2">
                    <h2>Linker Maps</h2>
                  </div>
                </div>
                <div class="catalog-copy copy-2">
                  <p>
                    This card summarizes linker maps, relocation notes, and output layout details
                    for a second catalog entry.
                  </p>
                </div>
              </div>

              <div class="catalog-card card-3">
                <div class="heading-row row-3">
                  <div class="heading-inner inner-3">
                    <h2>Debugger Tips</h2>
                  </div>
                </div>
                <div class="catalog-copy copy-3">
                  <p>
                    This card covers debugger shortcuts, watch windows, and stepping behavior for a
                    third catalog entry.
                  </p>
                </div>
              </div>
            </main>
          </body>
        </html>
      `;

      const { article, recoveryPlan } = inspectRecoveryPlan(html, 'https://example.com/catalog-cards.html');

      expect(article).not.toBeNull();
      expect(recoveryPlan).toBeNull();
      expect(article.content).toContain('assembler workflow');
      expect(article.content).not.toContain('Linker Maps');
      expect(article.content).not.toContain('Debugger Tips');
    });

    test('should restore wrapped catalog headings without duplicating catalog entries', () => {
      const html = `
        <!DOCTYPE html>
        <html>
          <head><title>Design Pattern Catalog</title></head>
          <body>
            <main class="catalog-grid">
              <div class="catalog-card card-1">
                <div class="catalog-heading">
                  <div class="catalog-heading-inner">
                    <h2>Search Patterns</h2>
                  </div>
                  <div class="catalog-icon"><svg aria-hidden="true"></svg></div>
                </div>
                <div class="catalog-copy copy-1">
                  <p>
                    This card summarizes search interfaces, refinement controls, and empty-state
                    guidance for quick browsing in the catalog.
                  </p>
                </div>
              </div>

              <div class="catalog-card card-2">
                <div class="catalog-heading">
                  <div class="catalog-heading-inner">
                    <h2>Checkout Patterns</h2>
                  </div>
                  <div class="catalog-icon"><svg aria-hidden="true"></svg></div>
                </div>
                <div class="catalog-copy copy-2">
                  <p>
                    This card summarizes checkout flows, field grouping, and payment confirmation
                    examples for a separate pattern family.
                  </p>
                </div>
              </div>

              <div class="catalog-card card-3">
                <div class="catalog-heading">
                  <div class="catalog-heading-inner">
                    <h2>Onboarding Patterns</h2>
                  </div>
                  <div class="catalog-icon"><svg aria-hidden="true"></svg></div>
                </div>
                <div class="catalog-copy copy-3">
                  <p>
                    This card summarizes onboarding tours, first-run prompts, and education
                    surfaces for a third pattern family.
                  </p>
                </div>
              </div>
            </main>
          </body>
        </html>
      `;

      const { article: firstPassArticle, recoveryPlan } = inspectRecoveryPlan(html, 'https://example.com/catalog-faq-like.html');
      const { article } = parseArticle(html, 'https://example.com/catalog-faq-like.html');

      expect(article).not.toBeNull();
      expect(firstPassArticle).not.toBeNull();
      expect(recoveryPlan).toBeNull();
      expect(article.content).toContain('search interfaces, refinement controls');
      expect(article.content).toContain('Search Patterns');
      expect(article.content).toContain('Checkout Patterns');
      expect(article.content).toContain('Onboarding Patterns');
      expect((article.content.match(/Search Patterns/g) || [])).toHaveLength(1);
      expect((article.content.match(/Checkout Patterns/g) || [])).toHaveLength(1);
      expect((article.content.match(/Onboarding Patterns/g) || [])).toHaveLength(1);
      expect(firstPassArticle.content).toContain('search interfaces, refinement controls');
      expect(firstPassArticle.content).toContain('checkout flows, field grouping');
      expect(firstPassArticle.content).toContain('onboarding tours, first-run prompts');
    });

    test('should not trigger recovery on high-link-density accordion sections', () => {
      const html = `
        <!DOCTYPE html>
        <html>
          <head><title>Documentation Index</title></head>
          <body>
            <main>
              <p>
                Use this index to jump to the setup, linker, and debugging references most relevant
                to your environment.
              </p>
              <section class="accordion-block block-1">
                <h2>Setup Links</h2>
                <div class="accordion-body body-a">
                  <p><a href="/setup/compiler">Compiler setup reference</a></p>
                  <p><a href="/setup/memory">Memory model reference</a></p>
                  <p><a href="/setup/include-paths">Include path reference</a></p>
                </div>
              </section>
              <section class="accordion-block block-2">
                <h2>Linker Links</h2>
                <div class="accordion-body body-b">
                  <p><a href="/linker/script">Linker script reference</a></p>
                  <p><a href="/linker/maps">Map file reference</a></p>
                  <p><a href="/linker/segments">Segment layout reference</a></p>
                </div>
              </section>
              <section class="accordion-block block-3">
                <h2>Debugger Links</h2>
                <div class="accordion-body body-c">
                  <p><a href="/debugger/breakpoints">Breakpoint reference</a></p>
                  <p><a href="/debugger/memory">Memory inspection reference</a></p>
                  <p><a href="/debugger/registers">Register window reference</a></p>
                </div>
              </section>
            </main>
          </body>
        </html>
      `;

      const { article, recoveryPlan } = inspectRecoveryPlan(html, 'https://example.com/index.html');

      expect(article).not.toBeNull();
      expect(recoveryPlan).toBeNull();
      expect(article.content).toContain('Use this index to jump');
      expect(article.content).toContain('Linker script reference');
      expect(article.content).toContain('Breakpoint reference');
    });

    test('should leave already-correct article extraction unchanged', () => {
      const html = `
        <!DOCTYPE html>
        <html>
          <head><title>Existing Article</title></head>
          <body>
            <article>
              <h1>Existing Article</h1>
              <p>
                This article already has a correct semantic container, enough content, and clear
                section headings without any repeated sibling family that should trigger recovery.
              </p>
              <section>
                <h2>Build steps</h2>
                <p>Compile the wrapper first, then compile the C source, and finally invoke the linker.</p>
              </section>
              <section>
                <h2>Verification</h2>
                <p>Inspect the generated binary and confirm the expected memory writes appear in the output.</p>
              </section>
            </article>
            <aside class="related-links">
              <p>Related content that should stay outside the article.</p>
            </aside>
          </body>
        </html>
      `;

      const { article } = parseArticle(html, 'https://example.com/article.html');
      const { recoveryPlan } = inspectRecoveryPlan(html, 'https://example.com/article.html');

      expect(article).not.toBeNull();
      expect(recoveryPlan).toBeNull();
      expect(article.title).toBe('Existing Article');
      expect(article.content).toContain('Build steps');
      expect(article.content).toContain('Verification');
      expect(article.content).not.toContain('Related content');
      expect((article.content.match(/Build steps/g) || [])).toHaveLength(1);
      expect((article.content.match(/Verification/g) || [])).toHaveLength(1);
    });
  });

  describe('Discussion Thread Recovery', () => {
    test('should append rendered discussion threads that Readability drops', () => {
      const html = `
        <!DOCTYPE html>
        <html>
          <head><title>Forum Thread</title></head>
          <body>
            <article>
              <h1>Forum Thread</h1>
              <p>
                This opening post explains how the archive workflow should preserve source
                material for offline research, quoted references, and personal note review.
                It intentionally contains enough descriptive prose to make the main article
                extraction obvious before the discussion thread begins.
              </p>
              <p>
                The author wants a markdown export that keeps context, preserves useful
                formatting, and still reads cleanly when revisited months later without
                network access or the original host page.
              </p>
              <p>
                They are specifically asking for durable clipping of discussion pages where
                follow-up replies add practical implementation advice that matters as much as
                the first post itself.
              </p>
            </article>
            <section class="discussion-thread comments">
              <article class="comment">
                <div class="comment-meta"><a href="/users/alice">alice</a> • 2d ago</div>
                <div class="comment-body">
                  <p>
                    I keep full discussion exports because the follow-up troubleshooting notes
                    are usually the part I need later, especially when the original question is
                    just setup context for the real fix.
                  </p>
                </div>
                <div class="comment-actions"><button>Reply</button><a href="/comments/1">Share</a></div>
                <article class="comment reply">
                  <div class="comment-meta"><a href="/users/bruno">bruno</a> • 1d ago</div>
                  <div class="comment-body">
                    <p>
                      Same here. Nested replies often contain the corrected command or edge case
                      note that never makes it back into the top answer.
                    </p>
                  </div>
                  <div class="comment-actions"><button>Reply</button></div>
                </article>
              </article>
              <article class="comment">
                <div class="comment-meta"><a href="/users/casey">casey</a> • 1d ago</div>
                <div class="comment-body">
                  <p>
                    My archive tool saves the full rendered thread and strips the site chrome.
                    That keeps the conversation readable without the vote controls, share links,
                    or other interface noise.
                  </p>
                </div>
                <div class="comment-actions"><button>Reply</button><a href="/comments/2">Share</a></div>
              </article>
            </section>
          </body>
        </html>
      `;

      const env = createBrowserEnvironment();
      const firstPassDom = new JSDOM(html, { url: 'https://example.com/forum-thread.html' });
      const firstPassArticle = new env.Readability(firstPassDom.window.document).parse();
      expect(firstPassArticle).not.toBeNull();
      expect(firstPassArticle.content).not.toContain('alice');
      expect(firstPassArticle.content).not.toContain('bruno');
      expect(firstPassArticle.content).not.toContain('casey');

      const { article } = parseArticle(html, 'https://example.com/forum-thread.html');
      const { service } = createTurndownService();
      const markdown = service.turndown(article.content);

      expect(article).not.toBeNull();
      expect(article.content).toContain('Comments');
      expect(markdown).toContain('## Comments');
      expect(markdown).toContain('alice');
      expect(markdown).toContain('bruno');
      expect(markdown).toContain('casey');
      expect(markdown).toContain('Nested replies often contain the corrected command');
      expect(markdown).not.toContain('Reply');
      expect(markdown).not.toContain('Share');
    });

    test('should recover the main post when the first pass lands on the discussion container', () => {
      const html = `
        <!DOCTYPE html>
        <html>
          <head><title>Forum Thread</title></head>
          <body>
            <main class="main-content">
              <forum-post class="post content">
                <div class="post-meta"><a href="/r/ObsidianMD/">r/ObsidianMD</a> â€¢ 8mo ago â€¢ <a href="/user/anonymonymoose/">anonymonymoose</a></div>
                <h1>What do you use to download websites (esp. Reddit)?</h1>
                <div class="post-flair">clipper</div>
                <div class="post-body">
                  <p>
                    I like saving websites as markdown files for offline viewing, and so I can reference a
                    website source without worrying about the site being deleted. It's so annoying when I
                    find something interesting and save a link to it, only to find the link is dead because
                    the host deleted the article.
                  </p>
                  <p>
                    I used to use MarkDownload and it was awesome, but I haven't used it in a while, and
                    now it looks like the Chrome extension is dead. I found MarkSnip which appears to be a
                    branch from MarkDownload and seems to work well with normal websites, but when I try to
                    save a Reddit post it formats weirdly and doesn't save all comment threads.
                  </p>
                  <p>
                    I tried Clipper, but it can only do like 2000 characters, which is fine for just
                    pulling out a quote or excerpt but is not very helpful when I want to download an
                    entire article to read later.
                  </p>
                </div>
              </forum-post>
              <section class="discussion-thread comments" aria-label="Comments">
                <h1 aria-label="Comments Section">Comments Section</h1>
                <article class="comment">
                  <div class="comment-meta"><a href="/user/pixel_sharmana/">pixel_sharmana</a> â€¢ 8mo ago</div>
                  <div class="comment-body">
                    <p>
                      If I really need to download an entire page, and can't really summarize it, I just
                      copy-paste the whole thing and manually clean it. At one point, searching for quick
                      shortcuts all the time made me realize I could just use that time to do it right myself.
                    </p>
                  </div>
                  <article class="comment reply">
                    <div class="comment-meta"><a href="/user/anonymonymoose/">anonymonymoose</a> â€¢ 8mo ago</div>
                    <div class="comment-body">
                      <p>
                        Honestly, I totally get that. There are a ton of things with Obsidian that I could
                        waste countless hours learning and tweaking, which is why I'm usually very minimalist
                        when it comes to plugins and formatting.
                      </p>
                    </div>
                  </article>
                  <a href="/r/ObsidianMD/comments/1mwisbf/comment/n9xrq8r/?force-legacy-sct=1">More replies</a>
                </article>
                <article class="comment">
                  <div class="comment-meta"><a href="/user/JustMeBT/">JustMeBT</a> â€¢ 8mo ago</div>
                  <div class="comment-body">
                    <p>
                      One option would be to use something like Fireshot, then capture the entire page and
                      save it as a PDF. I save webpages all the time that way and the text can still be
                      searched later.
                    </p>
                  </div>
                </article>
                <article class="comment">
                  <div class="comment-meta"><a href="/user/haronclv/">haronclv</a> â€¢ 8mo ago</div>
                  <div class="comment-body">
                    <p>
                      I do not save anything. Just save the URL, anyway I am going to forget about it in two
                      days so my vault is not messed up.
                    </p>
                  </div>
                </article>
                <article class="comment">
                  <div class="comment-meta"><a href="/user/Veradux21/">Veradux21</a> â€¢ 8mo ago</div>
                  <div class="comment-body">
                    <p>
                      The limit for clipper should no longer be accurate after they transitioned from URI to
                      clipboard based saving as of version 1.7.2. Is there another limit that I am unaware of?
                    </p>
                  </div>
                </article>
              </section>
            </main>
          </body>
        </html>
      `;

      const env = createBrowserEnvironment();
      const recoveryApi = env.ReadabilityRecovery;
      const originalDom = new JSDOM(html, { url: 'https://example.com/reddit-thread.html' });
      recoveryApi.annotateStructuralAnchors(originalDom.window.document);

      const wrongArticleHtml = originalDom.window.document.querySelector('section.comments').outerHTML;
      expect(wrongArticleHtml).toContain('Comments Section');
      expect(wrongArticleHtml).not.toContain('I like saving websites as markdown files for offline viewing');

      const recoveryPlan = recoveryApi.analyzeDiscussionTakeover(originalDom.window.document, wrongArticleHtml);
      expect(recoveryPlan).not.toBeNull();

      const secondPassDom = new JSDOM(html, { url: 'https://example.com/reddit-thread.html' });
      recoveryApi.annotateStructuralAnchors(secondPassDom.window.document);
      const suppressionResult = recoveryApi.suppressDiscussionTakeoverCandidates(secondPassDom.window.document, recoveryPlan);
      expect(suppressionResult.changed).toBe(true);

      const recoveredArticle = new env.Readability(secondPassDom.window.document).parse();
      expect(recoveredArticle).not.toBeNull();
      expect(recoveredArticle.content).toContain('I like saving websites as markdown files for offline viewing');
      expect(recoveredArticle.content).not.toContain('Comments Section');

      let recoveredContent = recoveryApi.restoreMissingPrimaryHeadings(originalDom.window.document, recoveredArticle.content) || recoveredArticle.content;
      const discussionRecovery = recoveryApi.recoverDiscussionThread(originalDom.window.document, recoveredContent);
      if (discussionRecovery?.html) {
        recoveredContent = discussionRecovery.html;
      }

      const { service } = createTurndownService();
      const markdown = service.turndown(recoveredContent);

      expect(markdown).toContain('# What do you use to download websites (esp. Reddit)?');
      expect(markdown).toContain('I like saving websites as markdown files for offline viewing');
      expect(markdown).toContain('## Comments');
      expect(markdown).toContain('If I really need to download an entire page');
      expect(markdown).toContain('One option would be to use something like Fireshot');
    });

    test('should ignore tiny noisy comment footers on normal articles', () => {
      const html = `
        <!DOCTYPE html>
        <html>
          <head><title>Normal Article</title></head>
          <body>
            <article>
              <h1>Normal Article</h1>
              <p>
                This guide focuses on the main implementation steps for a deployment checklist
                and should remain an ordinary article clip without discussion recovery.
              </p>
              <p>
                The content is long enough for Readability to confidently identify the primary
                article while a tiny comment footer remains insignificant to the exported result.
              </p>
              <p>
                Readers care about the walkthrough itself, not a one-line footer reaction with
                action buttons attached to it.
              </p>
            </article>
            <section class="comments">
              <article class="comment">
                <div class="comment-meta">zoe • 5h ago</div>
                <div class="comment-body"><p>Nice post.</p></div>
                <div class="comment-actions"><button>Reply</button><a href="/comments/3">Share</a></div>
              </article>
            </section>
          </body>
        </html>
      `;

      const { article } = parseArticle(html, 'https://example.com/normal-article.html');
      const { service } = createTurndownService();
      const markdown = service.turndown(article.content);

      expect(article).not.toBeNull();
      expect(markdown).not.toContain('## Comments');
      expect(markdown).not.toContain('Nice post.');
      expect(markdown).toContain('main implementation steps for a deployment checklist');
    });

  });

  describe('Other Common Markdown Conversion Issues', () => {
    test('should strip images inside table cells when imageStyle is noImage', () => {
      const { service } = createTurndownService({ imageStyle: 'noImage' });
      const html = `
        <table>
          <tr>
            <th>Label</th>
            <th>Value</th>
          </tr>
          <tr>
            <td>Diagram</td>
            <td><img src="https://example.com/diagram.png" alt="Diagram"></td>
          </tr>
        </table>
      `;

      const result = service.turndown(html);

      expect(result).toContain('| Diagram |');
      expect(result).not.toContain('![');
      expect(result).not.toContain('diagram.png');
    });

    test('should strip all image markdown from legacy table-heavy pages when imageStyle is noImage', () => {
      const { service } = createTurndownService({ imageStyle: 'noImage' });
      const result = service.turndown(htmlSamples.legacyTableHeavyPage.html);

      expect(result).toContain('Aether Notes Archive');
      expect(result).toContain('| Year |');
      expect(result).toContain('Notebook summary with inline references.');
      expect(result).toContain('Closing paragraph.');
      expect(result).not.toContain('![');
      expect(result).not.toContain('plate-a.jpg');
      expect(result).not.toContain('1901-chart.png');
      expect(result).not.toContain('plate-b.jpg');
    });

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
