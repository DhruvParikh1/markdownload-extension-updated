/**
 * Browser Environment Setup for Tests
 * Loads browser libraries (Turndown, Readability) in a JSDOM environment
 */

const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

/**
 * Create a browser-like environment with required libraries loaded
 */
function createBrowserEnvironment() {
  // Create JSDOM instance
  const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>', {
    url: 'https://example.com',
    contentType: 'text/html',
    runScripts: 'dangerously',
    resources: 'usable'
  });

  const { window } = dom;
  const { document } = window;

  // Load Turndown library
  const turndownPath = path.join(__dirname, '../../background/turndown.js');
  const turndownCode = fs.readFileSync(turndownPath, 'utf8');

  // Load Turndown GFM plugin
  const gfmPath = path.join(__dirname, '../../background/turndown-plugin-gfm.js');
  const gfmCode = fs.readFileSync(gfmPath, 'utf8');

  // Load Readability library
  const readabilityPath = path.join(__dirname, '../../background/Readability.js');
  const readabilityCode = fs.readFileSync(readabilityPath, 'utf8');

  // Load shared readability recovery helpers
  const readabilityRecoveryPath = path.join(__dirname, '../../shared/readability-recovery.js');
  const readabilityRecoveryCode = fs.readFileSync(readabilityRecoveryPath, 'utf8');

  // Execute in JSDOM context
  const script = dom.window.document.createElement('script');
  script.textContent = `
    ${turndownCode}
    ${gfmCode}
    ${readabilityCode}
    ${readabilityRecoveryCode}
  `;
  dom.window.document.head.appendChild(script);

  return {
    window,
    document,
    TurndownService: dom.window.TurndownService,
    turndownPluginGfm: dom.window.turndownPluginGfm,
    Readability: dom.window.Readability,
    ReadabilityRecovery: dom.window.MarkSnipReadabilityRecovery
  };
}

/**
 * Create a configured TurndownService instance
 */
function createTurndownService(options = {}) {
  const env = createBrowserEnvironment();

  const defaultOptions = {
    headingStyle: 'atx',
    hr: '---',
    bulletListMarker: '-',
    codeBlockStyle: 'fenced',
    fence: '```',
    emDelimiter: '*',
    strongDelimiter: '**',
    linkStyle: 'inlined',
    linkReferenceStyle: 'full'
  };

  const mergedOptions = { ...defaultOptions, ...options };

  // Disable escaping to prevent underscore escaping in all content including tables
  const service = new env.TurndownService(mergedOptions);
  service.escape = function(text) { return text; };

  // Add GFM plugins (excluding tables - we'll use a custom implementation)
  if (env.turndownPluginGfm) {
    service.use([
      env.turndownPluginGfm.highlightedCodeBlock,
      env.turndownPluginGfm.strikethrough,
      env.turndownPluginGfm.taskListItems
    ]);
  }

  // Add rule to convert <mark> tags to inline code (matching production)
  service.addRule('mark', {
    filter: ['mark'],
    replacement: function(content) {
      return '`' + content + '`';
    }
  });

  // Add rule to prevent wrapping headings in links (matching production)
  service.addRule('headingLinks', {
    filter: function(node) {
      // Check if this is a link containing a heading
      if (node.nodeName === 'A') {
        const hasHeading = Array.from(node.children).some(child =>
          /^H[1-6]$/.test(child.nodeName)
        );
        return hasHeading;
      }
      return false;
    },
    replacement: function(content) {
      // Just return the content (the heading) without link syntax
      return content;
    }
  });

  // Add custom table rule that handles all tables (including those without headers)
  service.addRule('customTables', {
    filter: 'table',
    replacement: function(content, node) {
      const rows = Array.from(node.querySelectorAll('tr'));
      if (rows.length === 0) return '';

      // Check if first row has th elements
      const firstRow = rows[0];
      const hasHeaderRow = firstRow.querySelector('th') !== null;

      let markdown = '\n\n';

      // Process each row
      rows.forEach((row, rowIndex) => {
        const cells = Array.from(row.querySelectorAll('th, td'));
        const cellContents = cells.map(cell => {
          // Get the text content, preserving basic formatting
          const tempService = new env.TurndownService(mergedOptions);
          tempService.escape = function(text) { return text; };

          // Add mark rule to cell service
          tempService.addRule('mark', {
            filter: ['mark'],
            replacement: function(content) {
              return '`' + content + '`';
            }
          });

          // Match production behavior: strip images when noImage is selected.
          if (mergedOptions.imageStyle === 'noImage') {
            tempService.addRule('images', {
              filter: (node) => node.nodeName === 'IMG',
              replacement: () => ''
            });
          }

          return tempService.turndown(cell.innerHTML).trim().replace(/\n/g, '<br>');
        });

        // Build row
        markdown += '| ' + cellContents.join(' | ') + ' |\n';

        // Add separator after first row (header row)
        if (rowIndex === 0) {
          const separator = cellContents.map(() => '---').join(' | ');
          markdown += '| ' + separator + ' |\n';
        }
      });

      markdown += '\n';
      return markdown;
    }
  });

  return { service, env };
}

/**
 * Parse HTML using Readability
 */
function normalizeMeaningfulText(text) {
  return String(text || '').replace(/\s+/g, ' ').trim();
}

function parseArticleHtmlFragment(window, articleHtml) {
  const parser = new window.DOMParser();
  return parser.parseFromString(`<!DOCTYPE html><html><body>${articleHtml || ''}</body></html>`, 'text/html');
}

function meaningfulTextLengthFromArticleHtml(window, articleHtml) {
  const documentFragment = parseArticleHtmlFragment(window, articleHtml);
  return normalizeMeaningfulText(documentFragment.body.textContent).length;
}

function linkDensityFromArticleHtml(window, articleHtml) {
  const documentFragment = parseArticleHtmlFragment(window, articleHtml);
  const textLength = meaningfulTextLengthFromArticleHtml(window, articleHtml);
  if (!textLength) {
    return 0;
  }

  let linkTextLength = 0;
  documentFragment.body.querySelectorAll('a').forEach(anchor => {
    linkTextLength += normalizeMeaningfulText(anchor.textContent).length;
  });
  return linkTextLength / textLength;
}

function articleHtmlContainsAnyWitness(window, articleHtml, witnessIds, anchorAttribute) {
  if (!witnessIds?.length) {
    return false;
  }

  const documentFragment = parseArticleHtmlFragment(window, articleHtml);
  return witnessIds.some(witnessId => (
    !!documentFragment.body.querySelector(`[${anchorAttribute}="${witnessId}"]`)
  ));
}

function buildRecoveredArticle(window, firstPassArticle, recoveredHtml) {
  const documentFragment = parseArticleHtmlFragment(window, recoveredHtml);
  const textContent = normalizeMeaningfulText(documentFragment.body.textContent);

  return {
    ...firstPassArticle,
    content: recoveredHtml,
    textContent,
    length: textContent.length,
    excerpt: textContent.substring(0, 200)
  };
}

function prepareDocumentForReadability(document, recoveryApi) {
  // Unwrap headers from anchor tags to prevent Readability from filtering them
  // (matching production code behavior)
  document.querySelectorAll('a')?.forEach(anchor => {
    const heading = Array.from(anchor.children).find(child =>
      /^H[1-6]$/.test(child.nodeName)
    );
    if (heading && anchor.children.length === 1) {
      // If the anchor only contains a heading, unwrap it
      anchor.parentNode.insertBefore(heading, anchor);
      anchor.parentNode.removeChild(anchor);
    }
  });

  // Process headers to avoid Readability.js stripping them
  // (matching production code behavior)
  document.querySelectorAll('h1, h2, h3, h4, h5, h6')?.forEach(header => {
    header.className = '';
    header.outerHTML = header.outerHTML;
  });

  recoveryApi.annotateStructuralAnchors(document);
}

function parseArticle(html, url = 'https://example.com') {
  const env = createBrowserEnvironment();
  const recoveryApi = env.ReadabilityRecovery;

  // Parse HTML in JSDOM
  const dom = new JSDOM(html, { url });
  prepareDocumentForReadability(dom.window.document, recoveryApi);

  const firstPassDom = new JSDOM(dom.serialize(), { url });
  const firstPassReader = new env.Readability(firstPassDom.window.document);
  const firstPassArticle = firstPassReader.parse();

  let article = firstPassArticle;

  if (firstPassArticle?.content) {
    const recoveryPlan = recoveryApi.analyzeNarrowExtraction(dom.window.document, firstPassArticle.content);
    if (recoveryPlan) {
      const secondPassDom = new JSDOM(html, { url });
      prepareDocumentForReadability(secondPassDom.window.document, recoveryApi);

      const recoveryResult = recoveryApi.applyRepeatedSectionPromotion(secondPassDom.window.document, recoveryPlan);
      if (recoveryResult.changed) {
        const recoveryFragment = recoveryApi.buildRepeatedSectionFragment
          ? recoveryApi.buildRepeatedSectionFragment(secondPassDom.window.document, recoveryPlan)
          : null;
        const secondPassArticle = recoveryFragment?.html
          ? buildRecoveredArticle(secondPassDom.window, firstPassArticle, recoveryFragment.html)
          : null;

        if (secondPassArticle?.content) {
          const secondPassTextLength = meaningfulTextLengthFromArticleHtml(secondPassDom.window, secondPassArticle.content);
          const firstPassTextLength = recoveryPlan.extractedTextLength || meaningfulTextLengthFromArticleHtml(dom.window, firstPassArticle.content);
          const recoveredGrowth = secondPassTextLength - firstPassTextLength;
          const recoveredMissingContent = articleHtmlContainsAnyWitness(
            secondPassDom.window,
            secondPassArticle.content,
            recoveryPlan.missingWitnessIds,
            recoveryApi.anchorAttribute
          );
          const recoveredLinkDensity = linkDensityFromArticleHtml(secondPassDom.window, secondPassArticle.content);
          const keepsComparableLength = secondPassTextLength >= firstPassTextLength * 0.9;

          if (
            recoveredGrowth >= Math.max(400, firstPassTextLength * 0.2) &&
            recoveredMissingContent &&
            recoveredLinkDensity <= 0.4 &&
            keepsComparableLength
          ) {
            article = secondPassArticle;
          }
        }
      }
    }
  }

  if (article?.content) {
    article.content = recoveryApi.stripStructuralAnchorsFromHtml(article.content);
  }

  return { article, env };
}

module.exports = {
  createBrowserEnvironment,
  createTurndownService,
  parseArticle
};
