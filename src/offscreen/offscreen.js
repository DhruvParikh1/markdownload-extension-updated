// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', initOffscreen);

// Listen for messages
browser.runtime.onMessage.addListener(handleMessages);

// Notify service worker that offscreen document is ready
browser.runtime.sendMessage({ type: 'offscreen-ready' });

/**
 * Initialize offscreen document
 */
function initOffscreen() {
  console.log('MarkSnip offscreen document initialized');
  console.log('🔧 Browser downloads API available:', !!browser.downloads);
  console.log('🔧 Chrome downloads API available:', !!(typeof chrome !== 'undefined' && chrome.downloads));
  TurndownService.prototype.defaultEscape = TurndownService.prototype.escape;
}

/**
 * Handle messages from service worker
 */
async function handleMessages(message, sender) {
  // Handle messages that aren't specifically targeted at offscreen
  if (!message.target || message.target !== 'offscreen') {
    if (message.type === 'article-dom-data') {
      try {
        // Process the DOM into an article
        const article = await getArticleFromDom(message.dom, defaultOptions);
        
        // If selection was provided, replace content
        if (message.selection) {
          article.content = message.selection;
        }
        
        // Send the article back to service worker
        await browser.runtime.sendMessage({
          type: 'article-result',
          requestId: message.requestId,
          article: article
        });
      } catch (error) {
        console.error('Error processing article DOM:', error);
        await browser.runtime.sendMessage({
          type: 'article-result',
          requestId: message.requestId,
          error: error.message
        });
      }
      return;
    }
    return; // Not for this context
  }

  switch (message.type) {
    case 'process-content':
      await processContent(message);
      break;
    case 'download-markdown':
      await downloadMarkdown(
        message.markdown,
        message.title,
        message.tabId,
        message.imageList,
        message.mdClipsFolder,
        message.options
      );
      break;
    case 'process-context-menu':
      await processContextMenu(message);
      break;
    case 'copy-to-clipboard':
      await copyToClipboard(message.text);
      break;
    case 'get-article-content':
      await handleGetArticleContent(message);
      break;
    case 'cleanup-blob-url':
      // Clean up blob URL in offscreen document (has DOM access)
      try {
        URL.revokeObjectURL(message.url);
        console.log('🧹 [Offscreen] Cleaned up blob URL:', message.url);
      } catch (err) {
        console.log('⚠️ [Offscreen] Could not cleanup blob URL:', err.message);
      }
      break;
  }
}

/**
 * Process HTML content to markdown
 */
async function processContent(message) {
  try {
    const { data, requestId, tabId, options } = message;
    
    // Pass options to getArticleFromDom
    const article = await getArticleFromDom(data.dom, options);
    
    // Handle selection if provided
    if (data.selection && data.clipSelection) {
      article.content = data.selection;
    }
    
    // Convert to markdown using passed options
    const { markdown, imageList } = await convertArticleToMarkdown(article, null, options);
    
    // Format title and folder using passed options
    article.title = await formatTitle(article, options);
    const mdClipsFolder = await formatMdClipsFolder(article, options);
    
    // Send results back to service worker
    await browser.runtime.sendMessage({
      type: 'markdown-result',
      requestId: requestId,
      result: {
        markdown,
        article,
        imageList,
        mdClipsFolder
      }
    });
  } catch (error) {
    console.error('Error processing content:', error);
    // Notify service worker of error
    await browser.runtime.sendMessage({
      type: 'process-error',
      error: error.message
    });
  }
}

/**
 * Process context menu actions
 */
async function processContextMenu(message) {
  const { action, info, tabId, options } = message;
  
  try {
    if (action === 'download') {
      await handleContextMenuDownload(info, tabId, options);
    } else if (action === 'copy') {
      await handleContextMenuCopy(info, tabId, options);
    }
  } catch (error) {
    console.error(`Error processing context menu ${action}:`, error);
  }
}

/**
 * Handle context menu download action
 */
async function handleContextMenuDownload(info, tabId, providedOptions = null) {
  console.log(`Starting download for tab ${tabId}`);
  try {
    const options = providedOptions || defaultOptions;
    
    const article = await getArticleFromContent(tabId, 
      info.menuItemId === "download-markdown-selection",
      options
    );
    if (!article?.content) {
      throw new Error(`Failed to get valid article content from tab ${tabId}`);
    }

    console.log(`Got article for tab ${tabId}, processing...`);
    const title = await formatTitle(article, options);
    const { markdown, imageList } = await convertArticleToMarkdown(article, null, options);
    const mdClipsFolder = await formatMdClipsFolder(article, options);
    
    console.log(`Downloading markdown for tab ${tabId}`);
    await downloadMarkdown(markdown, title, tabId, imageList, mdClipsFolder, options);
    
    // Signal completion
    await browser.runtime.sendMessage({
      type: 'process-complete',
      tabId: tabId,
      success: true
    });
  } catch (error) {
    console.error(`Error processing tab ${tabId}:`, error);
    await browser.runtime.sendMessage({
      type: 'process-complete',
      tabId: tabId,
      error: error.message
    });
    throw error;
  }
}

/**
 * Handle context menu copy action
 */
async function handleContextMenuCopy(info, tabId, providedOptions = null) {
  const platformOS = navigator.platform;
  const folderSeparator = platformOS.indexOf("Win") === 0 ? "\\" : "/";
  const options = providedOptions || defaultOptions;

  if (info.menuItemId === "copy-markdown-link") {
    // Don't call getOptions() - use the passed options
    const localOptions = {...options};
    localOptions.frontmatter = localOptions.backmatter = '';
    const article = await getArticleFromContent(tabId, false, options);  // Added options
    const { markdown } = turndown(
      `<a href="${info.linkUrl}">${info.linkText || info.selectionText}</a>`,
      { ...localOptions, downloadImages: false },
      article
    );
    await copyToClipboard(markdown);
  }
  else if (info.menuItemId === "copy-markdown-image") {
    await copyToClipboard(`![](${info.srcUrl})`);
  }
  else if (info.menuItemId === "copy-markdown-obsidian") {
    const article = await getArticleFromContent(tabId, true, options);  // Added options
    const title = article.title;
    // Don't call getOptions()
    const obsidianVault = options.obsidianVault;
    const obsidianFolder = await formatObsidianFolder(article, options);
    const { markdown } = await convertArticleToMarkdown(article, false, options);

    console.log('[Offscreen] Sending markdown to service worker for Obsidian integration...');
    // Offscreen document can't access clipboard, send to service worker to handle
    await browser.runtime.sendMessage({
      type: 'obsidian-integration',
      markdown: markdown,
      tabId: tabId,
      vault: obsidianVault,
      folder: obsidianFolder,
      title: generateValidFileName(title, options.disallowedChars)
    });
  }
  else if (info.menuItemId === "copy-markdown-obsall") {
    const article = await getArticleFromContent(tabId, false, options);  // Added options
    const title = article.title;
    // Don't call getOptions()
    const obsidianVault = options.obsidianVault;
    const obsidianFolder = await formatObsidianFolder(article, options);
    const { markdown } = await convertArticleToMarkdown(article, false, options);

    console.log('[Offscreen] Sending markdown to service worker for Obsidian integration...');
    // Offscreen document can't access clipboard, send to service worker to handle
    await browser.runtime.sendMessage({
      type: 'obsidian-integration',
      markdown: markdown,
      tabId: tabId,
      vault: obsidianVault,
      folder: obsidianFolder,
      title: generateValidFileName(title, options.disallowedChars)
    });
  }
  else {
    const article = await getArticleFromContent(tabId, info.menuItemId === "copy-markdown-selection", options);  // Added options
    const { markdown } = await convertArticleToMarkdown(article, false, options);
    await copyToClipboard(markdown);
  }
}


/**
 * Copy text to clipboard
 */
async function copyToClipboard(text) {
  // Try modern Clipboard API first (but it usually fails in offscreen documents)
  if (navigator.clipboard && navigator.clipboard.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      console.log('✅ [Offscreen] Successfully copied to clipboard using Clipboard API:', text.substring(0, 100) + '...');
      return true;
    } catch (clipboardError) {
      console.log('⚠️ [Offscreen] Clipboard API failed (document not focused), falling back to execCommand:', clipboardError.message);
      // Fall through to execCommand method
    }
  }

  // Fallback to execCommand method (works in offscreen documents)
  try {
    const textArea = document.getElementById('clipboard-text');
    if (!textArea) {
      console.error('❌ [Offscreen] Clipboard textarea not found');
      return false;
    }

    textArea.value = text;
    textArea.focus();
    textArea.select();

    // Try to copy using execCommand
    const success = document.execCommand('copy');

    if (success) {
      console.log('✅ [Offscreen] Successfully copied to clipboard using execCommand:', text.substring(0, 100) + '...');
      return true;
    } else {
      console.error('❌ [Offscreen] Failed to copy to clipboard using execCommand');
      return false;
    }
  } catch (error) {
    console.error('❌ [Offscreen] Error in execCommand fallback:', error);
    return false;
  }
}

/**
 * Convert article to markdown with options provided
 */
async function convertArticleToMarkdown(article, downloadImages = null, providedOptions = null) {
  // Use provided options or fallback to default options
  const options = providedOptions || defaultOptions;
  
  if (downloadImages != null) {
    options.downloadImages = downloadImages;
  }

  // Substitute front and backmatter templates if necessary
  if (options.includeTemplate) {
    options.frontmatter = textReplace(options.frontmatter, article) + '\n';
    options.backmatter = '\n' + textReplace(options.backmatter, article);
  }
  else {
    options.frontmatter = options.backmatter = '';
  }

  options.imagePrefix = textReplace(options.imagePrefix, article, options.disallowedChars)
    .split('/').map(s => generateValidFileName(s, options.disallowedChars)).join('/');

  let result = turndown(article.content, options, article);
  if (options.downloadImages && options.downloadMode === 'downloadsApi') {
    // Pre-download the images
    result = await preDownloadImages(result.imageList, result.markdown);
  }
  return result;
}

function processCodeBlock(node, options) {
  // If preserveCodeFormatting is enabled, return original HTML content
  if (options.preserveCodeFormatting) {
    return {
      code: node.innerHTML,
      language: getCodeLanguage(node)
    };
  }

  // Get the raw text content
  let code = node.textContent.trim();
  
  // Detect language
  let language = getCodeLanguage(node);
  
  // If no language detected and auto-detection is needed
  if (!language) {
    try {
      const result = hljs.highlightAuto(code);
      language = result.language || '';
    } catch (e) {
      console.warn('Language detection failed:', e);
    }
  }
  
  return {
    code: code,
    language: language
  };
}

function getCodeLanguage(node) {
  // Check for explicit language class
  const languageMatch = node.className.match(/language-(\w+)/);
  if (languageMatch) {
    return languageMatch[1];
  }
  
  // Check for highlight.js classes
  const hljsMatch = node.className.match(/hljs\s+(\w+)/);
  if (hljsMatch) {
    return hljsMatch[1];
  }
  
  return '';
}

/**
 * Turndown HTML to Markdown conversion
 */
function turndown(content, options, article) {
  console.log("Starting turndown with options:", options.tableFormatting); // Debug log

  if (options.turndownEscape) TurndownService.prototype.escape = TurndownService.prototype.defaultEscape;
  else TurndownService.prototype.escape = s => s;

  var turndownService = new TurndownService(options);

  // Add only non-table GFM features
  turndownService.use([
    turndownPluginGfm.highlightedCodeBlock,
    turndownPluginGfm.strikethrough,
    turndownPluginGfm.taskListItems
  ]);

  // Add our custom table rule
  turndownService.addRule('table', {
    filter: 'table',
    replacement: function(content, node) {
      try {
        // Create a mini-turndown instance for cell content processing
        const cellTurndownService = new TurndownService({
          ...options,
          headingStyle: options.headingStyle,
          hr: options.hr,
          bulletListMarker: options.bulletListMarker,
          codeBlockStyle: options.codeBlockStyle,
          fence: options.fence,
          emDelimiter: options.emDelimiter,
          strongDelimiter: options.strongDelimiter,
          linkStyle: options.tableFormatting?.stripLinks ? 'stripLinks' : options.linkStyle,
          linkReferenceStyle: options.linkReferenceStyle,
          // Reset frontmatter/backmatter to avoid duplication
          frontmatter: '',
          backmatter: ''
        });
        
        // Apply necessary plugins
        cellTurndownService.use([
          turndownPluginGfm.strikethrough,
          turndownPluginGfm.taskListItems
        ]);
        
        // Add custom rules for images, links, etc. to the cell turndown instance
        if (options.tableFormatting?.stripLinks) {
          cellTurndownService.addRule('links', {
            filter: (node, tdopts) => {
              return node.nodeName === 'A' && node.getAttribute('href');
            },
            replacement: (content, node, tdopts) => {
              return content;
            }
          });
        }
        
        // Process table structure
        const thead = node.querySelector('thead');
        const tbody = node.querySelector('tbody');
        const headerRow = thead?.querySelector('tr');
        const rows = headerRow ? 
          [headerRow, ...(tbody ? Array.from(tbody.children) : [])] :
          (tbody ? Array.from(tbody.children) : Array.from(node.querySelectorAll('tr')));
        
        let tableMatrix = Array.from({ length: rows.length }, () => []);
        let columnWidths = [];
        
        // Process each row
        rows.forEach((row, rowIndex) => {
          Array.from(row.children).forEach(cell => {
            // Process cell content using the cell-specific turndown service
            let processedContent = '';
            
            // Create a container for the cell content
            const cellContainer = document.createElement('div');
            cellContainer.innerHTML = cell.innerHTML;
            
            // Apply formatting stripping if configured
            if (options.tableFormatting?.stripFormatting) {
              // Replace formatting elements with their text content
              ['b', 'strong', 'i', 'em', 'u', 'mark', 'sub', 'sup'].forEach(tag => {
                const elements = cellContainer.getElementsByTagName(tag);
                // We need to convert to array because the collection changes as we modify
                Array.from(elements).forEach(el => {
                  el.replaceWith(document.createTextNode(el.textContent.trim()));
                });
              });
            }
            
            // Process the cell content through turndown
            processedContent = cellTurndownService.turndown(cellContainer.innerHTML);
            
            // Handle rowspan and colspan (keeping original behavior)
            const colspan = parseInt(cell.getAttribute('colspan')) || 1;
            const rowspan = parseInt(cell.getAttribute('rowspan')) || 1;
            
            // Add content to the matrix - keep existing behavior for rowspan/colspan
            for (let i = 0; i < rowspan; i++) {
              for (let j = 0; j < colspan; j++) {
                const targetRow = rowIndex + i;
                if (!tableMatrix[targetRow]) {
                  tableMatrix[targetRow] = [];
                }
                const targetCol = tableMatrix[targetRow].length;
                
                // Use the same content for all spanned cells (original behavior)
                tableMatrix[targetRow][targetCol] = processedContent;
                
                // Calculate column width based on visible content
                const simplifiedContent = processedContent
                  .replace(/\n/g, ' ')
                  .replace(/!?\[([^\]]*)\]\([^)]*\)/g, '$1') // Links
                  .replace(/[*_~`]+(.*?)[*_~`]+/g, '$1');    // Formatting
                
                const visibleLength = simplifiedContent.length;
                
                if (!columnWidths[targetCol] || visibleLength > columnWidths[targetCol]) {
                  columnWidths[targetCol] = visibleLength;
                }
              }
            }
          });
        });
        
        // Build markdown table
        let markdown = '\n\n';
        
        // Format cells with proper alignment and spacing
        const formatCell = (content, columnIndex) => {
          // Ensure content is a string
          const safeContent = content || '';
          
          if (!options.tableFormatting?.prettyPrint) {
            return ` ${safeContent} `;
          }
          
          // Ensure columnIndex is valid
          if (columnIndex === undefined || !Array.isArray(columnWidths) || columnIndex >= columnWidths.length) {
            return ` ${safeContent} `;
          }
          
          // For multi-line content, preserve structure but don't pad
          if (safeContent.includes('\n')) {
            return ` ${safeContent} `;
          }
          
          // Calculate visible length for centering - account for markdown syntax
          const visibleText = safeContent
            .replace(/!?\[([^\]]*)\]\([^)]*\)/g, '$1') // Links
            .replace(/[*_~`]+(.*?)[*_~`]+/g, '$1');    // Formatting
          const visibleLength = visibleText.length;
          
          const width = columnWidths[columnIndex] || 0;
          const totalWidth = width + 2; // Add 2 for standard padding
          
          if (!options.tableFormatting?.centerText) {
            return ` ${safeContent}${' '.repeat(Math.max(0, totalWidth - visibleLength - 1))}`;
          }
          
          // Center content
          const leftSpace = ' '.repeat(Math.floor(Math.max(0, totalWidth - visibleLength) / 2));
          const rightSpace = ' '.repeat(Math.ceil(Math.max(0, totalWidth - visibleLength) / 2));
          return leftSpace + safeContent + rightSpace;
        };
        
        // Build header row and separator
        if (tableMatrix.length > 0 && tableMatrix[0] && Array.isArray(tableMatrix[0])) {
          const headerContent = tableMatrix[0].map((cell, i) => formatCell(cell, i)).join('|');
          markdown += '|' + headerContent + '|\n';
          
          // Build separator with proper column widths
          const separator = columnWidths.map(width => {
            const minWidth = Math.max(3, width);
            return '-'.repeat(minWidth + 2); // +2 for padding
          }).join('|');
          
          markdown += '|' + separator + '|\n';
          
          // Build data rows
          for (let i = 1; i < tableMatrix.length; i++) {
            if (tableMatrix[i] && Array.isArray(tableMatrix[i])) {
              const row = tableMatrix[i].map((cell, j) => formatCell(cell, j)).join('|');
              markdown += '|' + row + '|\n';
            }
          }
        } else {
          // Fallback for tables with no rows or invalid structure
          markdown += '| No data available |\n|-|\n';
        }
        
        return markdown;
      } catch (error) {
        console.error('Error in table conversion:', error);
        return content;
      }
    }
  });

  turndownService.keep(['iframe', 'sub', 'sup', 'u', 'ins', 'del', 'small', 'big']);

  let imageList = {};
  // add an image rule
  turndownService.addRule('images', {
    filter: function (node, tdopts) {
      // if we're looking at an img node with a src
      if (node.nodeName == 'IMG' && node.getAttribute('src')) {
        
        // get the original src
        let src = node.getAttribute('src')
        // set the new src
        node.setAttribute('src', validateUri(src, article.baseURI));
        
        // if we're downloading images, there's more to do.
        if (options.downloadImages) {
          // generate a file name for the image
          let imageFilename = getImageFilename(src, options, false);
          if (!imageList[src] || imageList[src] != imageFilename) {
            // if the imageList already contains this file, add a number to differentiate
            let i = 1;
            while (Object.values(imageList).includes(imageFilename)) {
              const parts = imageFilename.split('.');
              if (i == 1) parts.splice(parts.length - 1, 0, i++);
              else parts.splice(parts.length - 2, 1, i++);
              imageFilename = parts.join('.');
            }
            // add it to the list of images to download later
            imageList[src] = imageFilename;
          }
          // check if we're doing an obsidian style link
          const obsidianLink = options.imageStyle.startsWith("obsidian");
          // figure out the (local) src of the image
          const localSrc = options.imageStyle === 'obsidian-nofolder'
            // if using "nofolder" then we just need the filename, no folder
            ? imageFilename.substring(imageFilename.lastIndexOf('/') + 1)
            // otherwise we may need to modify the filename to uri encode parts for a pure markdown link
            : imageFilename.split('/').map(s => obsidianLink ? s : encodeURI(s)).join('/')
          
          // set the new src attribute to be the local filename
          if(options.imageStyle != 'originalSource' && options.imageStyle != 'base64') node.setAttribute('src', localSrc);
          // pass the filter if we're making an obsidian link (or stripping links)
          return true;
        }
        else return true
      }
      // don't pass the filter, just output a normal markdown link
      return false;
    },
    replacement: function (content, node, tdopts) {
      // if we're stripping images, output nothing
      if (options.imageStyle == 'noImage') return '';
      // if this is an obsidian link, so output that
      else if (options.imageStyle.startsWith('obsidian')) return `![[${node.getAttribute('src')}]]`;
      // otherwise, output the normal markdown link
      else {
        var alt = cleanAttribute(node.getAttribute('alt'));
        var src = node.getAttribute('src') || '';
        var title = cleanAttribute(node.getAttribute('title'));
        var titlePart = title ? ' "' + title + '"' : '';
        if (options.imageRefStyle == 'referenced') {
          var id = this.references.length + 1;
          this.references.push('[fig' + id + ']: ' + src + titlePart);
          return '![' + alt + '][fig' + id + ']';
        }
        else return src ? '![' + alt + ']' + '(' + src + titlePart + ')' : ''
      }
    },
    references: [],
    append: function (options) {
      var references = '';
      if (this.references.length) {
        references = '\n\n' + this.references.join('\n') + '\n\n';
        this.references = []; // Reset references
      }
      return references
    }

  });

  // Utility function to check if an element is inside a table
  function isInsideTable(node) {
    let parent = node.parentNode;
    while (parent) {
      if (parent.nodeName === 'TABLE') {
        return true;
      }
      parent = parent.parentNode;
    }
    return false;
  }

  // add a rule for links
  turndownService.addRule('links', {
    filter: (node, tdopts) => {
      // Only process links if linkStyle is NOT 'referenced'
      // This allows the built-in referenceLink rule to handle referenced links
      return node.nodeName == 'A' && 
            node.getAttribute('href') && 
            tdopts.linkStyle !== 'referenced'
    },
    replacement: (content, node, tdopts) => {
      // get the href
      const href = validateUri(node.getAttribute('href'), article.baseURI);
      
      // If we're in a table AND strip links is enabled, OR if linkStyle is set to stripLinks
      // just return the text content without the link
      if ((isInsideTable(node) && options.tableFormatting?.stripLinks === true) || 
          options.linkStyle === "stripLinks") {
        return content;
      }
      
      // Otherwise, convert to proper markdown link format
      const title = cleanAttribute(node.getAttribute('title'));
      const titlePart = title ? ` "${title}"` : '';
      return `[${content}](${href}${titlePart})`
    }
  });

  // handle multiple lines math
  turndownService.addRule('mathjax', {
    filter(node, options) {
      return article.math.hasOwnProperty(node.id);
    },
    replacement(content, node, options) {
      const math = article.math[node.id];
      let tex = math.tex.trim().replaceAll('\xa0', '');

      if (math.inline) {
        tex = tex.replaceAll('\n', ' ');
        return `$${tex}$`;
      }
      else
        return `$$\n${tex}\n$$`;
    }
  });

  function repeat(character, count) {
    return Array(count + 1).join(character);
  }

  function convertToFencedCodeBlock(node, options) {
    node.innerHTML = node.innerHTML.replaceAll('<br-keep></br-keep>', '<br>');
    const langMatch = node.id?.match(/code-lang-(.+)/);
    const language = langMatch?.length > 0 ? langMatch[1] : '';

    var code;

    if (language) {
      var div = document.createElement('div');
      document.body.appendChild(div);
      div.appendChild(node);
      code = node.innerText;
      div.remove();
    } else {
      code = node.innerHTML;
    }

    var fenceChar = options.fence.charAt(0);
    var fenceSize = 3;
    var fenceInCodeRegex = new RegExp('^' + fenceChar + '{3,}', 'gm');

    var match;
    while ((match = fenceInCodeRegex.exec(code))) {
      if (match[0].length >= fenceSize) {
        fenceSize = match[0].length + 1;
      }
    }

    var fence = repeat(fenceChar, fenceSize);

    return (
      '\n\n' + fence + language + '\n' +
      code.replace(/\n$/, '') +
      '\n' + fence + '\n\n'
    )
  }

  turndownService.addRule('fencedCodeBlock', {
    filter: function (node, options) {
      return (
        options.codeBlockStyle === 'fenced' &&
        node.nodeName === 'PRE' &&
        node.firstChild &&
        node.firstChild.nodeName === 'CODE'
      )
    },
    replacement: function (content, node, options) {
      const codeNode = node.firstChild;
      const processedCode = processCodeBlock(codeNode, options);
      
      const fenceChar = options.fence.charAt(0);
      const fenceSize = 3;
      const fence = repeat(fenceChar, fenceSize);
      
      return (
        '\n\n' + 
        fence + 
        processedCode.language + 
        '\n' + 
        processedCode.code +
        '\n' + 
        fence + 
        '\n\n'
      )
    }
  });

  // handle <pre> as code blocks
  turndownService.addRule('pre', {
    filter: (node, tdopts) => node.nodeName == 'PRE' && (!node.firstChild || node.firstChild.nodeName != 'CODE'),
    replacement: (content, node, tdopts) => {
      return convertToFencedCodeBlock(node, tdopts);
    }
  });

  let markdown = options.frontmatter + turndownService.turndown(content)
      + options.backmatter;

  // strip out non-printing special characters which CodeMirror displays as a red dot
  // see: https://codemirror.net/doc/manual.html#option_specialChars
  markdown = markdown.replace(/[\u0000-\u0009\u000b\u000c\u000e-\u001f\u007f-\u009f\u00ad\u061c\u200b-\u200f\u2028\u2029\ufeff\ufff9-\ufffc]/g, '');
  
  return { markdown: markdown, imageList: imageList };
}

/**
* Get article from DOM string
*/
async function getArticleFromDom(domString, options) {
  if (!domString) {
    throw new Error('Invalid DOM string provided');
  }
  
  const parser = new DOMParser();
  const dom = parser.parseFromString(domString, "text/html");
  
  // Now options is defined
  if (!options.preserveCodeFormatting) {
    dom.querySelectorAll('pre code').forEach(codeBlock => {
      const processed = processCodeBlock(codeBlock, options);
      // Replace content with clean version
      codeBlock.textContent = processed.code;
      // Add language class if detected
      if (processed.language) {
        codeBlock.className = `language-${processed.language}`;
      }
    });
  }

 if (dom.documentElement.nodeName == "parsererror") {
   console.error("Error while parsing DOM");
 }

 const math = {};

 const storeMathInfo = (el, mathInfo) => {
   let randomId = URL.createObjectURL(new Blob([]));
   randomId = randomId.substring(randomId.length - 36);
   el.id = randomId;
   math[randomId] = mathInfo;
 };

 // Process MathJax elements (same as original)
 dom.body.querySelectorAll('script[id^=MathJax-Element-]')?.forEach(mathSource => {
   const type = mathSource.attributes.type.value
   storeMathInfo(mathSource, {
     tex: mathSource.innerText,
     inline: type ? !type.includes('mode=display') : false
   });
 });

 // Process MathJax 3 elements
 dom.body.querySelectorAll('[marksnip-latex]')?.forEach(mathJax3Node => {
   // Same implementation as original
   const tex = mathJax3Node.getAttribute('marksnip-latex');
   const display = mathJax3Node.getAttribute('display');
   const inline = !(display && display === 'true');

   const mathNode = document.createElement(inline ? "i" : "p");
   mathNode.textContent = tex;
   mathJax3Node.parentNode.insertBefore(mathNode, mathJax3Node.nextSibling);
   mathJax3Node.parentNode.removeChild(mathJax3Node);

   storeMathInfo(mathNode, {
     tex: tex,
     inline: inline
   });
 });

 // Process KaTeX elements
 dom.body.querySelectorAll('.katex-mathml')?.forEach(kaTeXNode => {
   storeMathInfo(kaTeXNode, {
     tex: kaTeXNode.querySelector('annotation').textContent,
     inline: true
   });
 });

 // Process code highlight elements
 dom.body.querySelectorAll('[class*=highlight-text],[class*=highlight-source]')?.forEach(codeSource => {
   const language = codeSource.className.match(/highlight-(?:text|source)-([a-z0-9]+)/)?.[1];
   if (codeSource.firstChild && codeSource.firstChild.nodeName == "PRE") {
     codeSource.firstChild.id = `code-lang-${language}`;
   }
 });

 // Process language-specific code elements
 dom.body.querySelectorAll('[class*=language-]')?.forEach(codeSource => {
   const language = codeSource.className.match(/language-([a-z0-9]+)/)?.[1];
   codeSource.id = `code-lang-${language}`;
 });

 // Process BR tags in PRE elements
 dom.body.querySelectorAll('pre br')?.forEach(br => {
   // We need to keep <br> tags because they are removed by Readability.js
   br.outerHTML = '<br-keep></br-keep>';
 });

 // Process code highlight elements with no language
 dom.body.querySelectorAll('.codehilite > pre')?.forEach(codeSource => {
   if (codeSource.firstChild && codeSource.firstChild.nodeName !== 'CODE' && !codeSource.className.includes('language')) {
     codeSource.id = `code-lang-text`;
   }
 });

 // Process headers to avoid Readability.js stripping them
 dom.body.querySelectorAll('h1, h2, h3, h4, h5, h6')?.forEach(header => {
   header.className = '';
   header.outerHTML = header.outerHTML;
 });

 // Process callouts to prevent Readability.js from stripping them
 // Callouts are often in structures like: <div class="el-div"><div class="callout">...</div></div>
 const callouts = dom.body.querySelectorAll('.callout, [data-callout]');
 console.log('[MarkSnip Debug] Found callouts:', callouts.length);
 callouts?.forEach(callout => {
   console.log('[MarkSnip Debug] Processing callout:', callout.getAttribute('data-callout'), callout.className);

   // Unwrap from el-div first if wrapped
   const parent = callout.parentElement;
   if (parent && parent.classList.contains('el-div')) {
     console.log('[MarkSnip Debug] Unwrapping callout from el-div');
     parent.parentElement?.insertBefore(callout, parent);
     parent.remove();
   }

   // Wrap in a section tag with article/content classes for Readability
   const section = dom.createElement('section');
   section.className = 'article content main marksnip-callout';
   section.setAttribute('data-marksnip-preserve', 'callout');
   callout.parentElement?.insertBefore(section, callout);
   section.appendChild(callout);
 });

 // Process table wrapper divs to prevent Readability.js from stripping them
 // Unwrap tables from their el-table wrapper divs
 const tableWrappers = dom.body.querySelectorAll('.el-table');
 console.log('[MarkSnip Debug] Found table wrappers:', tableWrappers.length);
 tableWrappers?.forEach(tableWrapper => {
   const table = tableWrapper.querySelector('table');
   if (table) {
     console.log('[MarkSnip Debug] Unwrapping table from el-table wrapper');
     // Unwrap: replace the wrapper with the table
     tableWrapper.parentElement?.insertBefore(table, tableWrapper);
     tableWrapper.remove();

     // Wrap table in a section tag with article/content classes
     const section = dom.createElement('section');
     section.className = 'article content main marksnip-table';
     section.setAttribute('data-marksnip-preserve', 'table');
     table.parentElement?.insertBefore(section, table);
     section.appendChild(table);
   }
 });

 // Process any remaining semantic container divs
 dom.body.querySelectorAll('.el-div')?.forEach(container => {
   // Check if it contains important content
   const hasImportantContent = container.querySelector('.callout, [data-callout], table, pre, code');
   if (hasImportantContent) {
     // Unwrap: move children up and remove the wrapper
     while (container.firstChild) {
       container.parentElement?.insertBefore(container.firstChild, container);
     }
     container.remove();
   }
 });

 // Simplify the DOM into an article with class preservation options
 console.log('[MarkSnip Debug] Before Readability - callouts:', dom.body.querySelectorAll('.callout, [data-callout]').length);
 console.log('[MarkSnip Debug] Before Readability - tables:', dom.body.querySelectorAll('table').length);

 const article = new Readability(dom, {
   classesToPreserve: ['callout', 'callout-title', 'callout-content', 'callout-icon', 'language-', 'highlight'],
   keepClasses: true,  // Keep all classes
   charThreshold: 0   // Lower threshold to include more content
 }).parse();

 if (article && article.content) {
   const tempDiv = document.createElement('div');
   tempDiv.innerHTML = article.content;
   console.log('[MarkSnip Debug] After Readability - callouts:', tempDiv.querySelectorAll('.callout, [data-callout]').length);
   console.log('[MarkSnip Debug] After Readability - tables:', tempDiv.querySelectorAll('table').length);
   console.log('[MarkSnip Debug] After Readability - content length:', article.content.length);
 }

 // Add essential metadata
 article.baseURI = dom.baseURI;
 article.pageTitle = dom.title;
 
 // Extract URL information
 const url = new URL(dom.baseURI);
 article.hash = url.hash;
 article.host = url.host;
 article.origin = url.origin;
 article.hostname = url.hostname;
 article.pathname = url.pathname;
 article.port = url.port;
 article.protocol = url.protocol;
 article.search = url.search;

 // Extract meta tags if head exists
 if (dom.head) {
   // Extract keywords
   article.keywords = dom.head.querySelector('meta[name="keywords"]')?.content?.split(',')?.map(s => s.trim());

   // Add all meta tags for template variables
   dom.head.querySelectorAll('meta[name][content], meta[property][content]')?.forEach(meta => {
     const key = (meta.getAttribute('name') || meta.getAttribute('property'));
     const val = meta.getAttribute('content');
     if (key && val && !article[key]) {
       article[key] = val;
     }
   });
 }

 article.math = math;

 return article;
}

/**
* Get article from tab content
*/
async function getArticleFromContent(tabId, selection = false, options = null) {  // Add options parameter
  try {
    console.log(`Getting article content for tab ${tabId}`);
    const requestId = Date.now().toString(36) + Math.random().toString(36).substring(2);
    
    const resultPromise = new Promise((resolve, reject) => {
      const messageListener = (message) => {
        if (message.type === 'article-content-result' && message.requestId === requestId) {
          console.log(`Received article content result for tab ${tabId}:`, message);
          browser.runtime.onMessage.removeListener(messageListener);
          if (message.error) {
            reject(new Error(message.error));
          } else {
            resolve(message.article);
          }
        }
      };
      
      setTimeout(() => {
        browser.runtime.onMessage.removeListener(messageListener);
        reject(new Error(`Timeout getting article content for tab ${tabId}`));
      }, 30000);
      
      browser.runtime.onMessage.addListener(messageListener);
    });
    
    await browser.runtime.sendMessage({
      type: "get-tab-content",
      tabId: tabId,
      selection: selection,
      requestId: requestId
    });
    
    const article = await resultPromise;
    if (!article?.dom) {
      throw new Error(`Missing DOM content for tab ${tabId}`);
    }
    
    console.log(`Processing DOM content for tab ${tabId}`);
    return await getArticleFromDom(article.dom, options);  // Pass options here
  } catch (error) {
    console.error(`Error getting content from tab ${tabId}:`, error);
    return null;
  }
}

/**
 * Format title using template with provided options
 */
async function formatTitle(article, providedOptions = null) {
  const options = providedOptions || defaultOptions;
  
  let title = textReplace(options.title, article, options.disallowedChars + '/');
  title = title.split('/').map(s => generateValidFileName(s, options.disallowedChars)).join('/');
  return title;
}

/**
 * Format Markdown clips folder with provided options
 */
async function formatMdClipsFolder(article, providedOptions = null) {
  const options = providedOptions || defaultOptions;

  let mdClipsFolder = '';
  if (options.mdClipsFolder && options.downloadMode == 'downloadsApi') {
    mdClipsFolder = textReplace(options.mdClipsFolder, article, options.disallowedChars);
    mdClipsFolder = mdClipsFolder.split('/').map(s => generateValidFileName(s, options.disallowedChars)).join('/');
    if (!mdClipsFolder.endsWith('/')) mdClipsFolder += '/';
  }

  return mdClipsFolder;
}

/**
 * Format Obsidian folder with provided options
 */
async function formatObsidianFolder(article, providedOptions = null) {
  const options = providedOptions || defaultOptions;

  let obsidianFolder = '';
  if (options.obsidianFolder) {
    obsidianFolder = textReplace(options.obsidianFolder, article, options.disallowedChars);
    obsidianFolder = obsidianFolder.split('/').map(s => generateValidFileName(s, options.disallowedChars)).join('/');
    if (!obsidianFolder.endsWith('/')) obsidianFolder += '/';
  }

  return obsidianFolder;
}

/**
* Replace placeholder strings with article info
*/
function textReplace(string, article, disallowedChars = null) {
 // Same implementation as original
 for (const key in article) {
   if (article.hasOwnProperty(key) && key != "content") {
     let s = (article[key] || '') + '';
     if (s && disallowedChars) s = generateValidFileName(s, disallowedChars);

     string = string.replace(new RegExp('{' + key + '}', 'g'), s)
       .replace(new RegExp('{' + key + ':kebab}', 'g'), s.replace(/ /g, '-').toLowerCase())
       .replace(new RegExp('{' + key + ':snake}', 'g'), s.replace(/ /g, '_').toLowerCase())
       .replace(new RegExp('{' + key + ':camel}', 'g'), s.replace(/ ./g, (str) => str.trim().toUpperCase()).replace(/^./, (str) => str.toLowerCase()))
       .replace(new RegExp('{' + key + ':pascal}', 'g'), s.replace(/ ./g, (str) => str.trim().toUpperCase()).replace(/^./, (str) => str.toUpperCase()));
   }
 }

 // Replace date formats
 const now = new Date();
 const dateRegex = /{date:(.+?)}/g;
 const matches = string.match(dateRegex);
 if (matches && matches.forEach) {
   matches.forEach(match => {
     const format = match.substring(6, match.length - 1);
     const dateString = moment(now).format(format);
     string = string.replaceAll(match, dateString);
   });
 }

 // Replace keywords
 const keywordRegex = /{keywords:?(.*)?}/g;
 const keywordMatches = string.match(keywordRegex);
 if (keywordMatches && keywordMatches.forEach) {
   keywordMatches.forEach(match => {
     let seperator = match.substring(10, match.length - 1);
     try {
       seperator = JSON.parse(JSON.stringify(seperator).replace(/\\\\/g, '\\'));
     }
     catch { }
     const keywordsString = (article.keywords || []).join(seperator);
     string = string.replace(new RegExp(match.replace(/\\/g, '\\\\'), 'g'), keywordsString);
   });
 }

 // Replace anything left in curly braces
 const defaultRegex = /{(.*?)}/g;
 string = string.replace(defaultRegex, '');

 return string;
}

/**
* Generate valid filename
*/
function generateValidFileName(title, disallowedChars = null) {
 if (!title) return title;
 else title = title + '';
 // Remove < > : " / \ | ? * 
 var illegalRe = /[\/\?<>\\:\*\|":]/g;
 // And non-breaking spaces
 var name = title.replace(illegalRe, "").replace(new RegExp('\u00A0', 'g'), ' ');
 
 if (disallowedChars) {
   for (let c of disallowedChars) {
     if (`[\\^$.|?*+()`.includes(c)) c = `\\${c}`;
     name = name.replace(new RegExp(c, 'g'), '');
   }
 }
 
 return name;
}

/**
* Clean attribute
*/
function cleanAttribute(attribute) {
 return attribute ? attribute.replace(/(\n+\s*)+/g, '\n') : '';
}

/**
* Validate URI
*/
function validateUri(href, baseURI) {
 // Check if the href is a valid url
 try {
   new URL(href);
 }
 catch {
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
* Get image filename
*/
function getImageFilename(src, options, prependFilePath = true) {
 const slashPos = src.lastIndexOf('/');
 const queryPos = src.indexOf('?');
 let filename = src.substring(slashPos + 1, queryPos > 0 ? queryPos : src.length);

 let imagePrefix = (options.imagePrefix || '');

 if (prependFilePath && options.title.includes('/')) {
   imagePrefix = options.title.substring(0, options.title.lastIndexOf('/') + 1) + imagePrefix;
 }
 else if (prependFilePath) {
   imagePrefix = options.title + (imagePrefix.startsWith('/') ? '' : '/') + imagePrefix;
 }
 
 if (filename.includes(';base64,')) {
   // This is a base64 encoded image
   filename = 'image.' + filename.substring(0, filename.indexOf(';'));
 }
 
 let extension = filename.substring(filename.lastIndexOf('.'));
 if (extension == filename) {
   // There is no extension, give it an 'idunno' extension
   filename = filename + '.idunno';
 }

 filename = generateValidFileName(filename, options.disallowedChars);

 return imagePrefix + filename;
}

/**
* Pre-download images
*/
async function preDownloadImages(imageList, markdown, providedOptions = null) {
  const options = providedOptions || defaultOptions;
  let newImageList = {};

 // Process all images in parallel
 await Promise.all(Object.entries(imageList).map(([src, filename]) => new Promise(async (resolve, reject) => {
   try {
     // Fetch the image using fetch instead of XMLHttpRequest
     const response = await fetch(src);
     const blob = await response.blob();

     if (options.imageStyle == 'base64') {
       // Convert to base64
       const reader = new FileReader();
       reader.onloadend = () => {
         markdown = markdown.replaceAll(src, reader.result);
         resolve();
       };
       reader.readAsDataURL(blob);
     } else {
       let newFilename = filename;
       
       // Handle unknown extensions
       if (newFilename.endsWith('.idunno')) {
         const mimeType = blob.type || 'application/octet-stream';
         const extension = mimedb[mimeType] || 'bin';
         newFilename = filename.replace('.idunno', `.${extension}`);

         // Update filename in markdown
         if (!options.imageStyle.startsWith("obsidian")) {
           markdown = markdown.replaceAll(
             filename.split('/').map(s => encodeURI(s)).join('/'),
             newFilename.split('/').map(s => encodeURI(s)).join('/')
           );
         } else {
           markdown = markdown.replaceAll(filename, newFilename);
         }
       }

       // Create object URL for the blob
       const blobUrl = URL.createObjectURL(blob);
       newImageList[blobUrl] = newFilename;
       resolve();
     }
   } catch (error) {
     console.error('Error pre-downloading image:', error);
     reject(`A network error occurred attempting to download ${src}`);
   }
 })));

 return { imageList: newImageList, markdown: markdown };
}

/**
* Download Markdown file
*/
async function downloadMarkdown(markdown, title, tabId, imageList = {}, mdClipsFolder = '', providedOptions = null) {
  const options = providedOptions || defaultOptions;
  
  console.log(`📁 [Offscreen] Downloading markdown: title="${title}", folder="${mdClipsFolder}", saveAs=${options.saveAs}`);
  console.log(`🔧 [Offscreen] Download mode: ${options.downloadMode}, browser.downloads available: ${!!browser.downloads}`);
 
 // Check if Downloads API is available in offscreen context
 const hasDownloadsAPI = !!(browser.downloads || (typeof chrome !== 'undefined' && chrome.downloads));
 
 if (options.downloadMode === 'downloadsApi' && hasDownloadsAPI) {
   // Downloads API is available in offscreen - use it directly
   const downloadsAPI = browser.downloads || chrome.downloads;
   
   try {
     // Create blob for markdown content
     const blob = new Blob([markdown], { type: "text/markdown;charset=utf-8" });
     const url = URL.createObjectURL(blob);
     
     if(mdClipsFolder && !mdClipsFolder.endsWith('/')) mdClipsFolder += '/';
     
     const fullFilename = mdClipsFolder + title + ".md";
     
     console.log(`🚀 [Offscreen] Starting Downloads API download: URL=${url}, filename="${fullFilename}"`);
     
     // CRITICAL: Notify service worker to track this URL BEFORE starting download
     await browser.runtime.sendMessage({
       type: 'track-download-url',
       url: url,
       filename: fullFilename,
       isMarkdown: true
     });
     
     // Start the markdown download using the available API
     const id = await downloadsAPI.download({
       url: url,
       filename: fullFilename,
       saveAs: options.saveAs
     });

     console.log(`✅ [Offscreen] Downloads API download started with ID: ${id}`);
     
     // Notify service worker about download completion
     browser.runtime.sendMessage({
       type: 'download-complete',
       downloadId: id,
       url: url,
       filename: fullFilename
     });

     // FIXED: Delegate image downloads to service worker instead of handling here
     if (options.downloadImages && Object.keys(imageList).length > 0) {
       console.log('🖼️ [Offscreen] Delegating image downloads to service worker:', Object.keys(imageList).length, 'images');
       
       // Send image download request to service worker
       await browser.runtime.sendMessage({
         type: 'download-images',
         imageList: imageList,
         mdClipsFolder: mdClipsFolder,
         title: title,
         options: options
       });
     }
   } catch (err) {
     console.error("❌ [Offscreen] Downloads API failed, notifying service worker to take over:", err);
     
     // Signal service worker to take over the download
     await browser.runtime.sendMessage({
       type: 'offscreen-download-failed',
       markdown: markdown,
       title: title,
       tabId: tabId,
       imageList: imageList,
       mdClipsFolder: mdClipsFolder,
       options: options,
       error: err.message
     });
   }
 } else if (options.downloadMode === 'downloadsApi') {
   // Downloads API requested but not available in offscreen - create blob and delegate to service worker
   console.log(`🔄 [Offscreen] Downloads API not available in offscreen, creating blob and delegating to service worker`);
   
   try {
     // Create blob URL in offscreen document (has DOM access)
     const blob = new Blob([markdown], { type: "text/markdown;charset=utf-8" });
     const url = URL.createObjectURL(blob);
     
     if(mdClipsFolder && !mdClipsFolder.endsWith('/')) mdClipsFolder += '/';
     const fullFilename = mdClipsFolder + title + ".md";
     
     console.log(`🎯 [Offscreen] Created blob URL: ${url}, delegating to service worker`);
     
     // Send blob URL to service worker for Downloads API
     await browser.runtime.sendMessage({
       type: 'service-worker-download',
       blobUrl: url,
       filename: fullFilename,
       tabId: tabId,
       imageList: imageList,
       mdClipsFolder: mdClipsFolder,
       options: options
     });
   } catch (err) {
     console.error("❌ [Offscreen] Failed to create blob, falling back to content script:", err);
     await downloadViaContentScript(markdown, title, tabId, imageList, mdClipsFolder, options);
   }
 } else {
    // Use content script method via service worker
    console.log(`🔗 [Offscreen] Using content script method (downloadMode: ${options.downloadMode})`);
    await downloadViaContentScript(markdown, title, tabId, imageList, mdClipsFolder, options);
  }
}

/**
 * Download via content script method (fallback when Downloads API not available)
 */
async function downloadViaContentScript(markdown, title, tabId, imageList, mdClipsFolder, options) {
  try {
    // For content script downloads, we need to handle the subfolder differently
    // since data URI downloads don't support subfolders
    let filename;
    if (mdClipsFolder) {
      // Flatten the path by including folder in filename
      filename = `${mdClipsFolder.replace(/\//g, '_')}${generateValidFileName(title, options.disallowedChars)}.md`;
      console.log(`🔗 [Offscreen] Flattening subfolder path: "${mdClipsFolder}" + "${title}" -> "${filename}"`);
    } else {
      filename = generateValidFileName(title, options.disallowedChars) + ".md";
    }
    
    const base64Content = base64EncodeUnicode(markdown);
    
    console.log(`🔗 [Offscreen] Using content script download: ${filename}`);
    
    // Send message to service worker to handle the download
    await browser.runtime.sendMessage({
      type: "execute-content-download",
      tabId: tabId,
      filename: filename,
      content: base64Content
    });

    // Handle image downloads for content script method
    if (options.downloadImages && Object.keys(imageList).length > 0) {
      await browser.runtime.sendMessage({
        type: 'download-images-content-script',
        imageList: imageList,
        tabId: tabId,
        options: options
      });
    }
  } catch (error) {
    console.error("❌ [Offscreen] Failed to initiate content script download:", error);
  }
}

/**
* Base64 encode Unicode string
*/
function base64EncodeUnicode(str) {
 // Encode UTF-8 string to base64
 const utf8Bytes = encodeURIComponent(str).replace(/%([0-9A-F]{2})/g, function (match, p1) {
   return String.fromCharCode('0x' + p1);
 });

 return btoa(utf8Bytes);
}

/**
* Convert to fenced code block
*/
function convertToFencedCodeBlock(node, options) {
 node.innerHTML = node.innerHTML.replaceAll('<br-keep></br-keep>', '<br>');
 const langMatch = node.id?.match(/code-lang-(.+)/);
 const language = langMatch?.length > 0 ? langMatch[1] : '';

 var code;

 if (language) {
   var div = document.createElement('div');
   document.body.appendChild(div);
   div.appendChild(node);
   code = node.innerText;
   div.remove();
 } else {
   code = node.innerHTML;
 }

 var fenceChar = options.fence.charAt(0);
 var fenceSize = 3;
 var fenceInCodeRegex = new RegExp('^' + fenceChar + '{3,}', 'gm');

 var match;
 while ((match = fenceInCodeRegex.exec(code))) {
   if (match[0].length >= fenceSize) {
     fenceSize = match[0].length + 1;
   }
 }

 var fence = repeat(fenceChar, fenceSize);

 return (
   '\n\n' + fence + language + '\n' +
   code.replace(/\n$/, '') +
   '\n' + fence + '\n\n'
 );
}

/**
* Repeat string
*/
function repeat(character, count) {
 return Array(count + 1).join(character);
}

/**
 * Get article content from tab
 */
async function handleGetArticleContent(message) {
  try {
    const { tabId, selection, requestId } = message;
    
    // Forward the request to the service worker
    await browser.runtime.sendMessage({
      type: 'forward-get-article-content',
      originalRequestId: requestId,
      tabId: tabId,
      selection: selection
    });
    
  } catch (error) {
    console.error('Error handling get article content:', error);
    await browser.runtime.sendMessage({
      type: 'article-error',
      requestId: message.requestId,
      error: error.message
    });
  }
}