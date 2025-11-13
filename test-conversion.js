// Test script to debug the conversion issue
const fs = require('fs');
const { JSDOM } = require('jsdom');

// Read the test HTML
const html = fs.readFileSync('./test-obsidian.html', 'utf8');

// Parse with JSDOM
const dom = new JSDOM(html);
const document = dom.window.document;

console.log('=== BEFORE PRE-PROCESSING ===');
console.log('Callouts found:', document.querySelectorAll('.callout, [data-callout]').length);
console.log('Tables found:', document.querySelectorAll('table').length);
console.log('El-table wrappers found:', document.querySelectorAll('.el-table').length);
console.log('El-div wrappers found:', document.querySelectorAll('.el-div').length);

// Simulate the pre-processing from offscreen.js
console.log('\n=== RUNNING PRE-PROCESSING ===');

// Process callouts
document.querySelectorAll('.callout, [data-callout]').forEach(callout => {
  console.log('Processing callout:', callout.getAttribute('data-callout'));
  callout.setAttribute('data-marksnip-preserve', 'callout');
  callout.classList.add('article', 'content', 'main');

  const parent = callout.parentElement;
  if (parent && parent.classList.contains('el-div')) {
    console.log('  - Unwrapping from el-div');
    parent.parentElement?.insertBefore(callout, parent);
    parent.remove();
  }
});

// Process table wrappers
document.querySelectorAll('.el-table').forEach(tableWrapper => {
  const table = tableWrapper.querySelector('table');
  console.log('Processing table wrapper');
  if (table) {
    console.log('  - Found table, unwrapping');
    table.setAttribute('data-marksnip-preserve', 'table');
    table.classList.add('article', 'content', 'main');
    tableWrapper.parentElement?.insertBefore(table, tableWrapper);
    tableWrapper.remove();
  }
});

// Process remaining el-div containers
document.querySelectorAll('.el-div').forEach(container => {
  const hasImportantContent = container.querySelector('.callout, [data-callout], table, pre, code');
  console.log('Processing el-div, has important content:', !!hasImportantContent);
  if (hasImportantContent) {
    console.log('  - Unwrapping el-div');
    while (container.firstChild) {
      container.parentElement?.insertBefore(container.firstChild, container);
    }
    container.remove();
  }
});

console.log('\n=== AFTER PRE-PROCESSING ===');
console.log('Callouts found:', document.querySelectorAll('.callout, [data-callout]').length);
console.log('Tables found:', document.querySelectorAll('table').length);
console.log('El-table wrappers found:', document.querySelectorAll('.el-table').length);
console.log('El-div wrappers found:', document.querySelectorAll('.el-div').length);

// Load Readability
const { Readability } = require('./src/background/Readability.js');

console.log('\n=== RUNNING READABILITY ===');
const article = new Readability(dom.window.document, {
  classesToPreserve: ['callout', 'callout-title', 'callout-content', 'callout-icon', 'language-', 'highlight'],
  debug: true
}).parse();

if (article) {
  console.log('\n=== READABILITY OUTPUT ===');
  console.log('Title:', article.title);
  console.log('Content length:', article.content.length);
  console.log('\nExtracted content:');
  console.log(article.content.substring(0, 1000));

  // Check what made it through
  const resultDOM = new JSDOM(article.content);
  const resultDoc = resultDOM.window.document;
  console.log('\n=== WHAT MADE IT THROUGH ===');
  console.log('Callouts in result:', resultDoc.querySelectorAll('.callout, [data-callout]').length);
  console.log('Tables in result:', resultDoc.querySelectorAll('table').length);
  console.log('Paragraphs in result:', resultDoc.querySelectorAll('p').length);
  console.log('Code blocks in result:', resultDoc.querySelectorAll('pre').length);
} else {
  console.log('ERROR: Readability returned null');
}
