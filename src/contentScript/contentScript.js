function notifyExtension() {
    // send a message that the content should be clipped
    browser.runtime.sendMessage({ type: "clip", dom: content});
}

function getHTMLOfDocument() {
    // make sure a title tag exists so that pageTitle is not empty and
    // a filename can be genarated.
    if (document.head.getElementsByTagName('title').length == 0) {
        let titleEl = document.createElement('title');
        // prepate a good default text (the text displayed in the window title)
        titleEl.innerText = document.title;
        document.head.append(titleEl);
    }

    // if the document doesn't have a "base" element make one
    // this allows the DOM parser in future steps to fix relative uris

    let baseEls = document.head.getElementsByTagName('base');
    let baseEl;

    if (baseEls.length > 0) {
        baseEl = baseEls[0];
    } else {
        baseEl = document.createElement('base');
        document.head.append(baseEl);
    }

    // make sure the 'base' element always has a good 'href`
    // attribute so that the DOMParser generates usable
    // baseURI and documentURI properties when used in the
    // background context.

    let href = baseEl.getAttribute('href');

    if (!href || !href.startsWith(window.location.origin)) {
        baseEl.setAttribute('href', window.location.href);
    }

    // remove the hidden content from the page
    removeHiddenNodes(document.body);

    // get the content of the page as a string
    return document.documentElement.outerHTML;
}

// code taken from here: https://www.reddit.com/r/javascript/comments/27bcao/anyone_have_a_method_for_finding_all_the_hidden/
function removeHiddenNodes(root) {
    let nodeIterator, node,i = 0;

    nodeIterator = document.createNodeIterator(root, NodeFilter.SHOW_ELEMENT, function(node) {
      let nodeName = node.nodeName.toLowerCase();
      if (nodeName === "script" || nodeName === "style" || nodeName === "noscript" || nodeName === "math") {
        return NodeFilter.FILTER_REJECT;
      }
      if (node.offsetParent === void 0) {
        return NodeFilter.FILTER_ACCEPT;
      }
      let computedStyle = window.getComputedStyle(node, null);
      if (computedStyle.getPropertyValue("visibility") === "hidden" || computedStyle.getPropertyValue("display") === "none") {
        return NodeFilter.FILTER_ACCEPT;
      }
    });

    while ((node = nodeIterator.nextNode()) && ++i) {
      if (node.parentNode instanceof HTMLElement) {
        node.parentNode.removeChild(node);
      }
    }
    return root
  }

// code taken from here: https://stackoverflow.com/a/5084044/304786
function getHTMLOfSelection() {
    var range;
    if (document.selection && document.selection.createRange) {
        range = document.selection.createRange();
        return range.htmlText;
    } else if (window.getSelection) {
        var selection = window.getSelection();
        if (selection.rangeCount > 0) {
            let content = '';
            for (let i = 0; i < selection.rangeCount; i++) {
                range = selection.getRangeAt(0);
                var clonedSelection = range.cloneContents();
                var div = document.createElement('div');
                div.appendChild(clonedSelection);
                content += div.innerHTML;
            }
            return content;
        } else {
            return '';
        }
    } else {
        return '';
    }
}

function getSelectionAndDom() {
    try {
      const dom = getHTMLOfDocument();
      const selection = getHTMLOfSelection();
      
      if (!dom) {
        console.error('Failed to get document HTML');
        return null;
      }
      
      return {
        selection: selection,
        dom: dom
      };
    } catch (error) {
      console.error('Error in getSelectionAndDom:', error);
      return null;
    }
  }

// This function must be called in a visible page, such as a browserAction popup
// or a content script. Calling it in a background page has no effect!
function copyToClipboard(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text);
    } else {
        // Fallback
        const textarea = document.createElement('textarea');
        textarea.value = text;
        textarea.style.position = 'fixed';
        textarea.style.left = '-999999px';
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
    }
}

function downloadMarkdown(filename, text) {
    let datauri = `data:text/markdown;base64,${text}`;
    var link = document.createElement('a');
    link.download = filename;
    link.href = datauri;
    link.click();
}

function downloadImage(filename, url) {

    /* Link with a download attribute? CORS says no.
    var link = document.createElement('a');
    link.download = filename.substring(0, filename.lastIndexOf('.'));
    link.href = url;
    console.log(link);
    link.click();
    */

    /* Try via xhr? Blocked by CORS.
    var xhr = new XMLHttpRequest();
    xhr.open('GET', url, true);
    xhr.responseType = 'blob';
    xhr.onload = () => {
        console.log('onload!')
        var file = new Blob([xhr.response], {type: 'application/octet-stream'});
        var link = document.createElement('a');
        link.download = filename;//.substring(0, filename.lastIndexOf('.'));
        link.href = window.URL.createObjectURL(file);
        console.log(link);
        link.click();
    }
    xhr.send();
    */

    /* draw on canvas? Inscure operation
    let img = new Image();
    img.src = url;
    img.onload = () => {
        let canvas = document.createElement("canvas");
        let ctx = canvas.getContext("2d");
        canvas.width = img.width;
        canvas.height = img.height;
        ctx.drawImage(img, 0, 0);

        var link = document.createElement('a');
        const ext = filename.substring(filename.lastIndexOf('.'));
        link.download = filename;
        link.href = canvas.toDataURL(`image/png`);
        console.log(link);
        link.click();
    }
    */
}

(function loadPageContextScript(){
    var s = document.createElement('script');
    s.src = browser.runtime.getURL('contentScript/pageContext.js');
    (document.head||document.documentElement).appendChild(s);
})()

// ===== Link Picker Feature =====

// Use var to allow redeclaration if script is injected multiple times
if (typeof window.linkPickerState === 'undefined') {
    window.linkPickerState = {
        active: false,
        selectedLinks: new Set(),
        selectedElements: new Set(),
        hoveredElement: null,
        controlPanel: null,
        styleElement: null,
        handlers: {}
    };
}

// Listen for link picker activation message
if (!window.linkPickerMessageListenerAdded) {
    browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
        if (message.type === "ACTIVATE_LINK_PICKER") {
            initLinkPickerMode();
            return Promise.resolve({ success: true });
        }
    });
    window.linkPickerMessageListenerAdded = true;
}

function initLinkPickerMode() {
    if (window.linkPickerState.active) {
        console.log("Link picker already active");
        return;
    }

    window.linkPickerState.active = true;
    window.linkPickerState.selectedLinks = new Set();
    window.linkPickerState.selectedElements = new Set();

    // Inject CSS styles
    injectLinkPickerStyles();

    // Create control panel
    createControlPanel();

    // Add event listeners
    setupLinkPickerEventListeners();

    console.log("Link picker mode activated");
}

function injectLinkPickerStyles() {
    const styles = `
        /* Link Picker Overlay */
        .marksnip-link-picker-overlay {
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(0, 0, 0, 0.3);
            z-index: 999998;
            pointer-events: none;
        }

        /* Highlighted element */
        .marksnip-link-picker-highlight {
            outline: 3px solid #3b82f6 !important;
            outline-offset: 2px !important;
            cursor: pointer !important;
            position: relative !important;
            box-shadow: 0 0 0 4px rgba(59, 130, 246, 0.2) !important;
        }

        /* Selected element indicator */
        .marksnip-link-picker-selected {
            outline: 3px solid #10b981 !important;
            outline-offset: 2px !important;
            box-shadow: 0 0 0 4px rgba(16, 185, 129, 0.2) !important;
        }

        .marksnip-link-picker-selected::after {
            content: '✓';
            position: absolute;
            top: -12px;
            right: -12px;
            width: 24px;
            height: 24px;
            background: #10b981;
            color: white;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            font-weight: bold;
            font-size: 16px;
            box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
            z-index: 999999;
        }

        /* Tooltip */
        .marksnip-link-picker-tooltip {
            position: absolute;
            background: rgba(0, 0, 0, 0.9);
            color: white;
            padding: 8px 12px;
            border-radius: 6px;
            font-size: 13px;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
            pointer-events: none;
            z-index: 1000000;
            white-space: nowrap;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.4);
        }

        /* Control Panel */
        .marksnip-link-picker-panel {
            position: fixed;
            bottom: 24px;
            right: 24px;
            background: white;
            border-radius: 12px;
            padding: 16px 20px;
            box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
            z-index: 1000001;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
            min-width: 280px;
            border: 1px solid rgba(0, 0, 0, 0.1);
        }

        .marksnip-link-picker-panel-title {
            font-size: 14px;
            font-weight: 600;
            color: #1f2937;
            margin-bottom: 12px;
            text-align: center;
        }

        .marksnip-link-picker-panel-info {
            font-size: 13px;
            color: #6b7280;
            margin-bottom: 12px;
            text-align: center;
        }

        .marksnip-link-picker-panel-count {
            font-size: 24px;
            font-weight: 700;
            color: #3b82f6;
            text-align: center;
            margin-bottom: 16px;
        }

        .marksnip-link-picker-panel-buttons {
            display: flex;
            gap: 8px;
        }

        .marksnip-link-picker-btn {
            flex: 1;
            padding: 10px 16px;
            border: none;
            border-radius: 8px;
            font-size: 14px;
            font-weight: 600;
            cursor: pointer;
            transition: all 0.2s;
            font-family: inherit;
        }

        .marksnip-link-picker-btn-done {
            background: #3b82f6;
            color: white;
        }

        .marksnip-link-picker-btn-done:hover {
            background: #2563eb;
            transform: translateY(-1px);
            box-shadow: 0 4px 12px rgba(59, 130, 246, 0.4);
        }

        .marksnip-link-picker-btn-cancel {
            background: #f3f4f6;
            color: #6b7280;
        }

        .marksnip-link-picker-btn-cancel:hover {
            background: #e5e7eb;
            color: #374151;
        }

        .marksnip-link-picker-instructions {
            font-size: 12px;
            color: #9ca3af;
            text-align: center;
            margin-top: 12px;
            line-height: 1.5;
        }
    `;

    window.linkPickerState.styleElement = document.createElement('style');
    window.linkPickerState.styleElement.textContent = styles;
    document.head.appendChild(window.linkPickerState.styleElement);

    // Create overlay
    const overlay = document.createElement('div');
    overlay.className = 'marksnip-link-picker-overlay';
    overlay.id = 'marksnip-link-picker-overlay';
    document.body.appendChild(overlay);
}

function createControlPanel() {
    const panel = document.createElement('div');
    panel.className = 'marksnip-link-picker-panel';
    panel.id = 'marksnip-link-picker-panel';
    panel.innerHTML = `
        <div class="marksnip-link-picker-panel-title">Link Picker</div>
        <div class="marksnip-link-picker-panel-info">Hover over elements to find links</div>
        <div class="marksnip-link-picker-panel-count" id="marksnip-link-count">0 links</div>
        <div class="marksnip-link-picker-panel-buttons">
            <button class="marksnip-link-picker-btn marksnip-link-picker-btn-cancel" id="marksnip-link-picker-cancel">
                Cancel
            </button>
            <button class="marksnip-link-picker-btn marksnip-link-picker-btn-done" id="marksnip-link-picker-done">
                Done
            </button>
        </div>
        <div class="marksnip-link-picker-instructions">
            Click elements to select links<br>
            Press ESC to cancel
        </div>
    `;
    document.body.appendChild(panel);
    window.linkPickerState.controlPanel = panel;

    // Add button event listeners
    document.getElementById('marksnip-link-picker-done').addEventListener('click', finishLinkPicker);
    document.getElementById('marksnip-link-picker-cancel').addEventListener('click', cancelLinkPicker);
}

function setupLinkPickerEventListeners() {
    // Mouse move handler
    window.linkPickerState.handlers.mousemove = function(e) {
        // Ignore if hovering over control panel or its children
        if (e.target.closest('#marksnip-link-picker-panel')) {
            removeHighlight();
            return;
        }

        const element = e.target;

        // Don't highlight if it's our overlay or already selected
        if (element.id === 'marksnip-link-picker-overlay' ||
            window.linkPickerState.selectedElements.has(element)) {
            return;
        }

        highlightElement(element, e.clientX, e.clientY);
    };

    // Click handler
    window.linkPickerState.handlers.click = function(e) {
        // Ignore clicks on control panel
        if (e.target.closest('#marksnip-link-picker-panel')) {
            return;
        }

        e.preventDefault();
        e.stopPropagation();

        const element = e.target;

        // Toggle selection
        if (window.linkPickerState.selectedElements.has(element)) {
            deselectElement(element);
        } else {
            selectElement(element);
        }
    };

    // Keyboard handler
    window.linkPickerState.handlers.keydown = function(e) {
        if (e.key === 'Escape') {
            e.preventDefault();
            cancelLinkPicker();
        }
    };

    // Add listeners
    document.addEventListener('mousemove', window.linkPickerState.handlers.mousemove, true);
    document.addEventListener('click', window.linkPickerState.handlers.click, true);
    document.addEventListener('keydown', window.linkPickerState.handlers.keydown, true);
}

function highlightElement(element, mouseX, mouseY) {
    // Remove previous highlight
    removeHighlight();

    // Don't highlight selected elements
    if (window.linkPickerState.selectedElements.has(element)) {
        return;
    }

    element.classList.add('marksnip-link-picker-highlight');
    window.linkPickerState.hoveredElement = element;

    // Count links in this element
    const linkCount = extractLinksFromElement(element).length;

    if (linkCount > 0) {
        showTooltip(`${linkCount} link${linkCount !== 1 ? 's' : ''} found`, mouseX, mouseY);
    } else {
        showTooltip('No links in this element', mouseX, mouseY);
    }
}

function removeHighlight() {
    if (window.linkPickerState.hoveredElement) {
        window.linkPickerState.hoveredElement.classList.remove('marksnip-link-picker-highlight');
        window.linkPickerState.hoveredElement = null;
    }
    removeTooltip();
}

function showTooltip(text, x, y) {
    removeTooltip();

    const tooltip = document.createElement('div');
    tooltip.className = 'marksnip-link-picker-tooltip';
    tooltip.id = 'marksnip-link-picker-tooltip';
    tooltip.textContent = text;
    tooltip.style.left = (x + 10) + 'px';
    tooltip.style.top = (y + 10) + 'px';
    document.body.appendChild(tooltip);
}

function removeTooltip() {
    const tooltip = document.getElementById('marksnip-link-picker-tooltip');
    if (tooltip) {
        tooltip.remove();
    }
}

function selectElement(element) {
    const links = extractLinksFromElement(element);

    if (links.length === 0) {
        return;
    }

    // Add links to set
    links.forEach(link => window.linkPickerState.selectedLinks.add(link));

    // Mark element as selected
    window.linkPickerState.selectedElements.add(element);
    element.classList.remove('marksnip-link-picker-highlight');
    element.classList.add('marksnip-link-picker-selected');

    updateLinkCount();
}

function deselectElement(element) {
    const links = extractLinksFromElement(element);

    // Remove links from set
    links.forEach(link => window.linkPickerState.selectedLinks.delete(link));

    // Unmark element
    window.linkPickerState.selectedElements.delete(element);
    element.classList.remove('marksnip-link-picker-selected');

    updateLinkCount();
}

function extractLinksFromElement(element) {
    const links = new Set();
    const anchors = Array.from(element.querySelectorAll('a[href]'));

    // Also check if the element itself is a link
    if (element.tagName === 'A' && element.href) {
        anchors.push(element);
    }

    anchors.forEach(a => {
        try {
            const href = a.getAttribute('href');
            if (!href) return;

            // Convert to absolute URL
            const absolute = new URL(href, window.location.href);

            // Filter out non-http(s) protocols
            if (absolute.protocol === 'http:' || absolute.protocol === 'https:') {
                links.add(absolute.href);
            }
        } catch (e) {
            // Invalid URL, skip
            console.debug('Invalid URL:', e);
        }
    });

    return Array.from(links);
}

function updateLinkCount() {
    const count = window.linkPickerState.selectedLinks.size;
    const countElement = document.getElementById('marksnip-link-count');
    if (countElement) {
        countElement.textContent = `${count} link${count !== 1 ? 's' : ''}`;
    }
}

function finishLinkPicker() {
    const links = Array.from(window.linkPickerState.selectedLinks);

    // Send links back to popup
    browser.runtime.sendMessage({
        type: "LINK_PICKER_COMPLETE",
        links: links
    });

    cleanupLinkPicker();
}

function cancelLinkPicker() {
    // Send empty result
    browser.runtime.sendMessage({
        type: "LINK_PICKER_COMPLETE",
        links: []
    });

    cleanupLinkPicker();
}

function cleanupLinkPicker() {
    // Remove event listeners
    if (window.linkPickerState.handlers.mousemove) {
        document.removeEventListener('mousemove', window.linkPickerState.handlers.mousemove, true);
    }
    if (window.linkPickerState.handlers.click) {
        document.removeEventListener('click', window.linkPickerState.handlers.click, true);
    }
    if (window.linkPickerState.handlers.keydown) {
        document.removeEventListener('keydown', window.linkPickerState.handlers.keydown, true);
    }

    // Remove highlights from selected elements
    window.linkPickerState.selectedElements.forEach(element => {
        element.classList.remove('marksnip-link-picker-selected');
    });

    // Remove highlight from hovered element
    removeHighlight();

    // Remove control panel
    if (window.linkPickerState.controlPanel) {
        window.linkPickerState.controlPanel.remove();
    }

    // Remove overlay
    const overlay = document.getElementById('marksnip-link-picker-overlay');
    if (overlay) {
        overlay.remove();
    }

    // Remove styles
    if (window.linkPickerState.styleElement) {
        window.linkPickerState.styleElement.remove();
    }

    // Reset state
    window.linkPickerState = {
        active: false,
        selectedLinks: new Set(),
        selectedElements: new Set(),
        hoveredElement: null,
        controlPanel: null,
        styleElement: null,
        handlers: {}
    };

    console.log("Link picker mode deactivated");
}
