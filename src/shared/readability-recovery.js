(function(global) {
  const ANCHOR_ATTRIBUTE = 'data-marksnip-node-id';
  const DISCUSSION_ID_ATTRIBUTE = 'data-marksnip-discussion-id';
  const STRUCTURAL_SELECTOR = 'article, section, main, div, aside, blockquote, pre, table, ul, ol';
  const WRAPPER_TAGS = new Set(['DIV', 'SECTION', 'ARTICLE', 'ASIDE']);
  const LAYOUT_CLASS_TOKENS = new Set(['clearfix', 'container', 'wrapper', 'row', 'col']);
  const EXCLUDED_PATTERN = /\b(nav|menu|toc|table-of-contents|breadcrumb|comment|comments|sidebar|share|social|promo|advert|ads?|pagination|related|recommend|accordion|tabs?|card|cards|grid|listing)\b/i;
  const HEADING_TAG_PATTERN = /^H[1-6]$/;
  const MEDIA_SELECTOR = 'img, picture, figure, video, iframe, svg, canvas';
  const DISCUSSION_CLUSTER_PATTERN = /\b(comment|comments|reply|replies|discussion|discuss|thread|threads|forum|conversation)\b/i;
  const DISCUSSION_ITEM_PATTERN = /\b(comment|reply|message|response)\b/i;
  const DISCUSSION_CONTAINER_PATTERN = /\b(comments|replies|discussion|discuss|thread|threads|forum|conversation|tree|list)\b/i;
  const DISCUSSION_ACTION_PATTERN = /\b(reply|share|report|award|give award|save|follow|sort by|permalink|copy link|upvote|downvote|vote|more replies|load more|show more|see more|collapse|expand)\b/i;
  const PRIMARY_CONTENT_PATTERN = /\b(post|article|story|entry|question|submission|content|body)\b/i;
  const DISCUSSION_CONTROL_TAGS = new Set([
    'SCRIPT',
    'STYLE',
    'NOSCRIPT',
    'TEMPLATE',
    'BUTTON',
    'FORM',
    'INPUT',
    'TEXTAREA',
    'SELECT',
    'OPTION',
    'LABEL',
    'MENU',
    'NAV',
    'FOOTER',
    'PICTURE',
    'IMG',
    'VIDEO',
    'AUDIO',
    'IFRAME',
    'SVG',
    'CANVAS'
  ]);
  const DISCUSSION_INLINE_TAGS = new Set(['P', 'SPAN', 'A', 'TIME', 'SMALL', 'STRONG', 'EM', 'B', 'I', 'CODE']);

  function normalizeWhitespace(text) {
    return String(text || '').replace(/\s+/g, ' ').trim();
  }

  function meaningfulTextLength(node) {
    return normalizeWhitespace(node?.textContent || '').length;
  }

  function linkTextLength(node) {
    if (!node?.querySelectorAll) {
      return 0;
    }

    let total = 0;
    node.querySelectorAll('a').forEach(anchor => {
      total += normalizeWhitespace(anchor.textContent).length;
    });
    return total;
  }

  function linkDensity(node) {
    const textLength = meaningfulTextLength(node);
    if (!textLength) {
      return 0;
    }
    return linkTextLength(node) / textLength;
  }

  function normalizeClassTokens(value) {
    return Array.from(new Set(String(value || '')
      .split(/\s+/)
      .map(token => token.trim())
      .filter(Boolean)
      .map(token => token.replace(/[-_]*\d+$/g, ''))
      .map(token => token.toLowerCase())
      .filter(token => token && !LAYOUT_CLASS_TOKENS.has(token))
    )).sort();
  }

  function normalizedClassSignature(node) {
    return normalizeClassTokens(node?.className).join('.');
  }

  function semanticSignature(node) {
    if (!node?.tagName) {
      return '';
    }

    return normalizeWhitespace([
      node.tagName,
      node.getAttribute?.('id') || '',
      typeof node.className === 'string' ? node.className : '',
      node.getAttribute?.('role') || '',
      node.getAttribute?.('data-testid') || '',
      node.getAttribute?.('aria-label') || '',
      node.getAttribute?.('name') || '',
      node.getAttribute?.('slot') || ''
    ].join(' ')).toLowerCase();
  }

  function looksExcludedContainer(node) {
    if (!node) {
      return false;
    }

    const classTokens = normalizeClassTokens(node.className).join(' ');
    const idValue = String(node.getAttribute?.('id') || '').toLowerCase();
    const combined = `${classTokens} ${idValue}`.trim();

    if (EXCLUDED_PATTERN.test(combined)) {
      return true;
    }

    return linkDensity(node) > 0.5;
  }

  function meaningfulDirectChildren(node) {
    if (!node?.children) {
      return [];
    }

    return Array.from(node.children).filter(child => {
      if (child.tagName === 'SCRIPT' || child.tagName === 'STYLE' || child.tagName === 'NOSCRIPT') {
        return false;
      }

      return meaningfulTextLength(child) > 0;
    });
  }

  function directHeadingChild(node) {
    return meaningfulDirectChildren(node).find(child => HEADING_TAG_PATTERN.test(child.tagName)) || null;
  }

  function headingWrapperDescriptor(node) {
    if (!node || !WRAPPER_TAGS.has(node.tagName) || looksExcludedContainer(node)) {
      return null;
    }

    let current = node;
    for (let depth = 0; depth <= 1 && current; depth += 1) {
      const heading = directHeadingChild(current);
      if (heading) {
        const informativeSiblings = meaningfulDirectChildren(current).filter(child => (
          child !== heading &&
          !HEADING_TAG_PATTERN.test(child.tagName) &&
          meaningfulTextLength(child) >= 30
        ));
        if (informativeSiblings.length) {
          return null;
        }

        return {
          heading,
          level: Number(heading.tagName.substring(1)),
          wrapper: node
        };
      }

      const children = meaningfulDirectChildren(current);
      if (children.length !== 1) {
        return null;
      }

      const next = children[0];
      if (!WRAPPER_TAGS.has(next.tagName) || looksExcludedContainer(next)) {
        return null;
      }

      current = next;
    }

    return null;
  }

  function primaryHeadingDescriptor(node) {
    const heading = directHeadingChild(node);
    if (heading) {
      return {
        heading,
        level: Number(heading.tagName.substring(1)),
        wrapper: null
      };
    }

    for (const child of meaningfulDirectChildren(node)) {
      const descriptor = headingWrapperDescriptor(child);
      if (descriptor) {
        return descriptor;
      }
    }

    return null;
  }

  function primaryHeadingLevel(node) {
    const descriptor = primaryHeadingDescriptor(node);
    if (!descriptor) {
      return null;
    }

    return descriptor.level;
  }

  function restoreMissingPrimaryHeadings(document, articleHtml) {
    if (!articleHtml) {
      return null;
    }

    const extractedDocument = parseArticleHtml(document, articleHtml);
    let changed = false;
    const restoredContainerIds = new Set();

    function resolveInsertionTarget(node) {
      if (!node) {
        return null;
      }

      if (WRAPPER_TAGS.has(node.tagName) || node.matches?.('main, blockquote, pre, table, ul, ol')) {
        return node;
      }

      return node.parentElement || null;
    }

    function findRecoveryCandidate(sourceNode) {
      let current = sourceNode;

      for (let depth = 0; depth < 3 && current; depth += 1) {
        if (!looksExcludedContainer(current)) {
          const directDescriptor = primaryHeadingDescriptor(current);
          if (directDescriptor) {
            return {
              container: current,
              descriptor: directDescriptor
            };
          }
        }

        const parent = current.parentElement;
        if (!parent) {
          break;
        }

        if (!looksExcludedContainer(parent)) {
          const parentDescriptor = primaryHeadingDescriptor(parent);
          const dominance = dominantNonHeadingChild(parent);
          if (
            parentDescriptor &&
            dominance?.child &&
            (dominance.child === current || dominance.child.contains(current))
          ) {
            return {
              container: parent,
              descriptor: parentDescriptor
            };
          }
        }

        current = parent;
      }

      return null;
    }

    extractedDocument.body.querySelectorAll(`[${ANCHOR_ATTRIBUTE}]`).forEach(extractedNode => {
      const sourceNodeId = extractedNode.getAttribute(ANCHOR_ATTRIBUTE);
      if (!sourceNodeId) {
        return;
      }

      const sourceNode = document.querySelector(`[${ANCHOR_ATTRIBUTE}="${sourceNodeId}"]`);
      if (!sourceNode || looksExcludedContainer(sourceNode)) {
        return;
      }

      const recoveryCandidate = findRecoveryCandidate(sourceNode);
      if (!recoveryCandidate) {
        return;
      }

      const containerId = recoveryCandidate.container.getAttribute(ANCHOR_ATTRIBUTE) || sourceNodeId;
      if (containerId && restoredContainerIds.has(containerId)) {
        return;
      }

      const representedContainer = containerId
        ? extractedDocument.body.querySelector(`[${ANCHOR_ATTRIBUTE}="${containerId}"]`)
        : null;
      const targetNode = resolveInsertionTarget(representedContainer || extractedNode);
      if (!targetNode || primaryHeadingDescriptor(targetNode)) {
        return;
      }

      const headingText = normalizeWhitespace(recoveryCandidate.descriptor.heading.textContent);
      if (!headingText) {
        return;
      }

      const extractedText = normalizeWhitespace(targetNode.textContent);
      if (extractedText.startsWith(headingText)) {
        return;
      }

      const dominance = dominantNonHeadingChild(recoveryCandidate.container);
      if (dominance?.child) {
        const witnessId = dominance.child.getAttribute(ANCHOR_ATTRIBUTE);
        const representsContainer = containerId && (
          targetNode.getAttribute?.(ANCHOR_ATTRIBUTE) === containerId ||
          !!targetNode.querySelector(`[${ANCHOR_ATTRIBUTE}="${containerId}"]`)
        );
        const representsWitness = witnessId && (
          targetNode.getAttribute?.(ANCHOR_ATTRIBUTE) === witnessId ||
          !!targetNode.querySelector(`[${ANCHOR_ATTRIBUTE}="${witnessId}"]`)
        );
        if (witnessId && !representsWitness && !representsContainer) {
          return;
        }
      }

      targetNode.insertBefore(recoveryCandidate.descriptor.heading.cloneNode(true), targetNode.firstChild);
      if (containerId) {
        restoredContainerIds.add(containerId);
      }
      changed = true;
    });

    return changed ? extractedDocument.body.innerHTML : null;
  }

  function restoreSemanticTables(document, articleHtml) {
    if (!articleHtml) {
      return null;
    }

    const extractedDocument = parseArticleHtml(document, articleHtml);
    let changed = false;

    function extractRowDescriptors(node) {
      if (!node?.children) {
        return [];
      }

      function isVisuallyHidden(element) {
        if (!element) {
          return false;
        }

        if (element.hidden || element.getAttribute?.('aria-hidden') === 'true') {
          return true;
        }

        const styleValue = String(element.getAttribute?.('style') || '').toLowerCase();
        return styleValue.includes('display: none') || styleValue.includes('visibility: hidden');
      }

      const rows = [];
      Array.from(node.children).forEach(child => {
        const childRole = child.getAttribute?.('role');
        if (isVisuallyHidden(child)) {
          return;
        }

        const childCells = Array.from(child.children || []).filter(cell => {
          const role = cell.getAttribute?.('role');
          if (isVisuallyHidden(cell)) {
            return false;
          }
          return role === 'cell' || role === 'columnheader' || role === 'rowheader';
        });

        if (childRole === 'row' || childCells.length > 0) {
          rows.push(child);
          return;
        }

        if (childRole === 'rowgroup') {
          Array.from(child.children).forEach(grandchild => {
            const grandchildRole = grandchild.getAttribute?.('role');
            if (isVisuallyHidden(grandchild)) {
              return;
            }

            const grandchildCells = Array.from(grandchild.children || []).filter(cell => {
              const role = cell.getAttribute?.('role');
              if (isVisuallyHidden(cell)) {
                return false;
              }
              return role === 'cell' || role === 'columnheader' || role === 'rowheader';
            });

            if (grandchildRole === 'row' || grandchildCells.length > 0) {
              rows.push(grandchild);
            }
          });
        }
      });

      return rows.map(row => ({
        row,
        cells: Array.from(row.children).filter(cell => {
          const role = cell.getAttribute?.('role');
          const className = String(cell.className || '').toLowerCase();
          if (isVisuallyHidden(cell)) {
            return false;
          }
          return role === 'cell' || role === 'columnheader' || role === 'rowheader' || /\bcell\b/.test(className);
        })
      })).filter(descriptor => descriptor.cells.length > 0);
    }

    function isHeaderRow(descriptor) {
      return descriptor.cells.some(cell => {
        const role = cell.getAttribute?.('role');
        return role === 'columnheader' || role === 'rowheader';
      }) || (
        descriptor.cells.length > 0 &&
        descriptor.cells.every(cell => !!cell.querySelector?.('h1, h2, h3, h4, h5, h6'))
      );
    }

    function sanitizeCellHtml(cell) {
      const clone = cell.cloneNode(true);
      clone.querySelectorAll('script, style, noscript, [hidden], [aria-hidden="true"]').forEach(element => {
        element.remove();
      });
      clone.querySelectorAll('[style]').forEach(element => {
        const styleValue = String(element.getAttribute('style') || '').toLowerCase();
        if (styleValue.includes('display: none') || styleValue.includes('visibility: hidden')) {
          element.remove();
        }
      });

      if (
        clone.children.length === 1 &&
        clone.firstElementChild?.getAttribute?.('role') === 'cell' &&
        normalizeWhitespace(clone.firstElementChild.textContent) === normalizeWhitespace(clone.textContent)
      ) {
        return clone.firstElementChild.innerHTML;
      }

      return clone.innerHTML;
    }

    function buildSemanticTable(sourceNode, extractedTable) {
      if (sourceNode?.tagName === 'TABLE') {
        return sourceNode.cloneNode(true);
      }

      const sourceRows = extractRowDescriptors(sourceNode);
      const extractedRows = extractRowDescriptors(extractedTable);
      if (!sourceRows.length && !extractedRows.length) {
        return null;
      }

      const sourceHeaderRow = sourceRows.find(isHeaderRow) || null;
      const extractedHeaderRow = extractedRows.find(isHeaderRow) || null;
      const headerRow = sourceHeaderRow || extractedHeaderRow;
      const extractedDataRows = extractedRows.filter(descriptor => descriptor !== extractedHeaderRow);
      const sourceDataRows = sourceRows.filter(descriptor => descriptor !== sourceHeaderRow);
      const dataRows = extractedDataRows.length ? extractedDataRows : sourceDataRows;

      const semanticTable = extractedDocument.createElement('table');

      if (headerRow?.cells?.length) {
        const thead = extractedDocument.createElement('thead');
        const tr = extractedDocument.createElement('tr');
        headerRow.cells.forEach(cell => {
          const th = extractedDocument.createElement('th');
          th.textContent = normalizeWhitespace(cell.textContent);
          tr.appendChild(th);
        });
        thead.appendChild(tr);
        semanticTable.appendChild(thead);
      }

      if (dataRows.length) {
        const tbody = extractedDocument.createElement('tbody');
        dataRows.forEach(descriptor => {
          const tr = extractedDocument.createElement('tr');
          descriptor.cells.forEach(cell => {
            const td = extractedDocument.createElement('td');
            td.innerHTML = sanitizeCellHtml(cell);
            tr.appendChild(td);
          });
          tbody.appendChild(tr);
        });
        semanticTable.appendChild(tbody);
      }

      return semanticTable.children.length ? semanticTable : null;
    }

    extractedDocument.body.querySelectorAll(`[role="table"][${ANCHOR_ATTRIBUTE}]`).forEach(extractedTable => {
      const sourceNodeId = extractedTable.getAttribute(ANCHOR_ATTRIBUTE);
      if (!sourceNodeId) {
        return;
      }

      const sourceNode = document.querySelector(`[${ANCHOR_ATTRIBUTE}="${sourceNodeId}"]`);
      if (!sourceNode) {
        return;
      }

      const semanticTable = buildSemanticTable(sourceNode, extractedTable);
      if (!semanticTable) {
        return;
      }

      extractedTable.replaceWith(semanticTable);
      changed = true;
    });

    return changed ? extractedDocument.body.innerHTML : null;
  }

  function childRole(child) {
    if (!child) {
      return 'other';
    }

    if (HEADING_TAG_PATTERN.test(child.tagName)) {
      return 'heading';
    }

    if (child.matches?.('pre') || child.querySelector?.('pre, code')) {
      return 'code';
    }

    if (child.matches?.('ul, ol') || child.querySelector?.('ul, ol')) {
      return 'list';
    }

    if (child.matches?.('table') || child.querySelector?.('table')) {
      return 'table';
    }

    if (child.matches?.('blockquote, q') || child.querySelector?.('blockquote, q')) {
      return 'quote';
    }

    if (child.matches?.(MEDIA_SELECTOR) || child.querySelector?.(MEDIA_SELECTOR)) {
      return 'media';
    }

    if (meaningfulTextLength(child) >= 40) {
      return 'content';
    }

    return 'other';
  }

  function shallowChildRoleSignature(node) {
    if (!node?.children?.length) {
      return '';
    }

    return Array.from(node.children).slice(0, 6).map(childRole).join('|');
  }

  function hasRichStructure(node) {
    if (!node?.querySelector) {
      return false;
    }

    if (node.querySelector('pre, table, blockquote')) {
      return true;
    }

    const listCount = node.querySelectorAll('li').length;
    return listCount >= 2;
  }

  function isContentRich(node) {
    const textLength = meaningfulTextLength(node);
    if (textLength >= 180) {
      return true;
    }

    return textLength >= 120 && hasRichStructure(node);
  }

  function directNonHeadingChildren(container) {
    const descriptor = primaryHeadingDescriptor(container);
    return meaningfulDirectChildren(container).filter(child => {
      if (HEADING_TAG_PATTERN.test(child.tagName)) {
        return false;
      }

      return descriptor?.wrapper !== child;
    });
  }

  function dominantNonHeadingChild(container) {
    const candidates = directNonHeadingChildren(container).map(child => ({
      child,
      textLength: meaningfulTextLength(child)
    }));

    if (!candidates.length) {
      return null;
    }

    candidates.sort((left, right) => right.textLength - left.textLength);
    const totalText = candidates.reduce((sum, candidate) => sum + candidate.textLength, 0);
    const dominant = candidates[0];
    const second = candidates[1] || null;

    return {
      child: dominant.child,
      ratio: totalText ? dominant.textLength / totalText : 0,
      totalText,
      secondLength: second?.textLength || 0
    };
  }

  function familySignatureMatches(reference, candidate) {
    const referenceHeading = primaryHeadingLevel(reference);
    const candidateHeading = primaryHeadingLevel(candidate);
    if (referenceHeading && candidateHeading && referenceHeading !== candidateHeading) {
      return false;
    }
    if (referenceHeading && !candidateHeading) {
      return false;
    }

    const referenceClassSignature = normalizedClassSignature(reference);
    const candidateClassSignature = normalizedClassSignature(candidate);
    const classMatch = referenceClassSignature && referenceClassSignature === candidateClassSignature;

    const referenceRoleSignature = shallowChildRoleSignature(reference);
    const candidateRoleSignature = shallowChildRoleSignature(candidate);
    const roleMatch = referenceRoleSignature && referenceRoleSignature === candidateRoleSignature;

    return classMatch || roleMatch;
  }

  function parseArticleHtml(document, articleHtml) {
    const parsedDocument = document.implementation.createHTMLDocument('');
    parsedDocument.body.innerHTML = articleHtml || '';
    return parsedDocument;
  }

  function normalizedTextIncludes(text, snippet) {
    const normalizedText = normalizeWhitespace(text).toLowerCase();
    const normalizedSnippet = normalizeWhitespace(snippet).toLowerCase();
    return !!normalizedSnippet && normalizedText.includes(normalizedSnippet);
  }

  function isWithinNodes(node, nodes) {
    return nodes.some(candidate => candidate === node || candidate.contains(node));
  }

  function collectTopDiscussionRoots(document) {
    const roots = collectDiscussionRootCandidates(document).filter(node => node.getAttribute?.(ANCHOR_ATTRIBUTE));
    return roots.filter(root => !roots.some(candidate => candidate !== root && candidate.contains(root)));
  }

  function findPrimaryContentWitness(document, discussionRoots) {
    if (!document?.querySelectorAll) {
      return null;
    }

    const candidates = Array.from(document.querySelectorAll(STRUCTURAL_SELECTOR)).filter(node => {
      if (
        !node.parentElement ||
        looksExcludedContainer(node) ||
        isLikelyDiscussionActionNode(node) ||
        isWithinNodes(node, discussionRoots) ||
        discussionRoots.some(root => node.contains(root))
      ) {
        return false;
      }

      const textLength = meaningfulTextLength(node);
      if (textLength < 220 || linkDensity(node) > 0.4) {
        return false;
      }

      return true;
    });

    if (!candidates.length) {
      return null;
    }

    const ranked = candidates.map((node, index) => {
      const signature = semanticSignature(node);
      let score = meaningfulTextLength(node);

      if (node.querySelector?.('h1')) {
        score += 900;
      }
      if (PRIMARY_CONTENT_PATTERN.test(signature)) {
        score += 500;
      }
      if (node.matches?.('article, main')) {
        score += 300;
      }

      score -= index * 5;

      return { node, score };
    }).sort((left, right) => right.score - left.score);

    const witnessText = normalizeWhitespace(ranked[0]?.node?.textContent || '');
    if (!witnessText || witnessText.length < 140) {
      return null;
    }

    return witnessText.slice(0, 220);
  }

  function analyzeDiscussionTakeover(document, articleHtml) {
    if (!articleHtml || !document?.querySelectorAll) {
      return null;
    }

    const extractedDocument = parseArticleHtml(document, articleHtml);
    const extractedAnchors = Array.from(extractedDocument.body.querySelectorAll(`[${ANCHOR_ATTRIBUTE}]`));
    if (!extractedAnchors.length) {
      return null;
    }

    const discussionRoots = collectTopDiscussionRoots(document);
    if (!discussionRoots.length) {
      return null;
    }

    const extractedNodes = extractedAnchors
      .map(element => document.querySelector(`[${ANCHOR_ATTRIBUTE}="${element.getAttribute(ANCHOR_ATTRIBUTE)}"]`))
      .filter(Boolean);
    if (!extractedNodes.length) {
      return null;
    }

    const rootCounts = new Map();
    extractedNodes.forEach(node => {
      const root = discussionRoots.find(candidate => candidate === node || candidate.contains(node));
      if (root) {
        rootCounts.set(root, (rootCounts.get(root) || 0) + 1);
      }
    });

    const rankedRoots = Array.from(rootCounts.entries()).sort((left, right) => right[1] - left[1]);
    const dominantEntry = rankedRoots[0];
    if (!dominantEntry) {
      return null;
    }

    const [dominantRoot, dominantCount] = dominantEntry;
    const dominantRatio = dominantCount / extractedNodes.length;
    const extractedText = normalizeWhitespace(extractedDocument.body.textContent);
    const leadingHeading = normalizeWhitespace(extractedDocument.body.querySelector('h1, h2, h3')?.textContent || '');
    const leadingText = extractedText.slice(0, 320);
    const hasDiscussionHeading = (
      (leadingHeading && DISCUSSION_CLUSTER_PATTERN.test(leadingHeading)) ||
      DISCUSSION_CLUSTER_PATTERN.test(leadingText)
    );
    const primaryContentWitness = findPrimaryContentWitness(document, discussionRoots);
    const missingPrimaryContent = primaryContentWitness && !normalizedTextIncludes(extractedText, primaryContentWitness);
    const dominantRootTextLength = meaningfulTextLength(dominantRoot);
    const extractedTextLength = meaningfulTextLength(extractedDocument.body);

    if (!hasDiscussionHeading || !missingPrimaryContent) {
      return null;
    }

    if (dominantRatio < 0.55 && !(dominantRoot === extractedNodes[0] || dominantRoot.contains(extractedNodes[0]))) {
      return null;
    }

    if (dominantRootTextLength < Math.max(500, extractedTextLength * 0.5)) {
      return null;
    }

    return {
      dominantDiscussionRootId: dominantRoot.getAttribute(ANCHOR_ATTRIBUTE),
      discussionRootIds: discussionRoots
        .map(root => root.getAttribute(ANCHOR_ATTRIBUTE))
        .filter(Boolean),
      primaryContentWitness,
      minimumRecoveredLength: Math.max(350, Math.min(900, Math.floor((primaryContentWitness?.length || 0) * 2.5)))
    };
  }

  function suppressDiscussionTakeoverCandidates(document, recoveryPlan) {
    if (!document?.querySelector || !recoveryPlan?.discussionRootIds?.length) {
      return { changed: false, removedIds: [] };
    }

    const removedIds = [];
    recoveryPlan.discussionRootIds.forEach(anchorId => {
      const root = document.querySelector(`[${ANCHOR_ATTRIBUTE}="${anchorId}"]`);
      if (!root) {
        return;
      }

      root.remove();
      removedIds.push(anchorId);
    });

    return {
      changed: removedIds.length > 0,
      removedIds
    };
  }

  function clearDiscussionAnnotations(document) {
    document?.querySelectorAll?.(`[${DISCUSSION_ID_ATTRIBUTE}]`).forEach(element => {
      element.removeAttribute(DISCUSSION_ID_ATTRIBUTE);
    });
  }

  function nearestNodeInSet(node, nodeSet, boundary) {
    let current = node?.parentElement || null;

    while (current && current !== boundary) {
      if (nodeSet.has(current)) {
        return current;
      }
      current = current.parentElement;
    }

    return nodeSet.has(boundary) ? boundary : null;
  }

  function isLikelyDiscussionActionText(text) {
    const normalized = normalizeWhitespace(text).toLowerCase();
    if (!normalized || normalized.length > 80) {
      return false;
    }

    if (!DISCUSSION_ACTION_PATTERN.test(normalized)) {
      return false;
    }

    const wordCount = normalized.split(/\s+/).filter(Boolean).length;
    return wordCount <= 8 || !/[.!?]/.test(normalized);
  }

  function isLikelyDiscussionActionNode(node) {
    if (!node?.tagName) {
      return false;
    }

    if (DISCUSSION_CONTROL_TAGS.has(node.tagName)) {
      return true;
    }

    if (node.matches?.('[role="button"], [role="menu"], [role="menuitem"], [role="tab"], [role="tablist"], [role="toolbar"], [hidden], [aria-hidden="true"]')) {
      return true;
    }

    const text = normalizeWhitespace(node.textContent);
    const signature = semanticSignature(node);
    if (!text) {
      return /\b(loader|spinner|toolbar|menu|avatar|icon|permalink)\b/i.test(signature);
    }

    if (isLikelyDiscussionActionText(text)) {
      return true;
    }

    if (text.length <= 30 && /\b(permalink|sort|toolbar|actions?|vote|share|reply|award)\b/i.test(signature)) {
      return true;
    }

    if (node.matches?.('a, button, [role="button"]') && text.length <= 80 && /\b(permalink|sort|vote|share|reply|award)\b/i.test(signature)) {
      return true;
    }

    return false;
  }

  function collectDiscussionRootCandidates(document) {
    if (!document?.body?.querySelectorAll) {
      return [];
    }

    return Array.from(document.body.querySelectorAll('*')).filter(node => (
      meaningfulTextLength(node) >= 250 &&
      DISCUSSION_CLUSTER_PATTERN.test(semanticSignature(node)) &&
      !isLikelyDiscussionActionNode(node)
    ));
  }

  function collectInitialDiscussionCandidates(root) {
    if (!root?.querySelectorAll) {
      return [];
    }

    const nodes = Array.from(root.querySelectorAll('*'));
    return nodes.filter(node => {
      if (!node.parentElement || DISCUSSION_INLINE_TAGS.has(node.tagName)) {
        return false;
      }

      const contentWeight = meaningfulTextLength(node);
      if (contentWeight < 60 || linkDensity(node) > 0.45) {
        return false;
      }

      const signature = semanticSignature(node);
      return DISCUSSION_ITEM_PATTERN.test(signature) || DISCUSSION_CLUSTER_PATTERN.test(signature);
    });
  }

  function buildDiscussionCandidatePlan(root) {
    const initialCandidates = collectInitialDiscussionCandidates(root);
    if (initialCandidates.length < 2) {
      return null;
    }

    const finalCandidates = initialCandidates.filter(node => {
      const directChildren = Array.from(node.children || []).filter(child => meaningfulTextLength(child) > 0);
      const hasFrame = directChildren.length >= 2 ||
        directChildren.some(child => DISCUSSION_ITEM_PATTERN.test(semanticSignature(child))) ||
        directChildren.some(child => isLikelyDiscussionActionNode(child));
      const hasBodyLikeContent = directChildren.some(child => (
        !isLikelyDiscussionActionNode(child) &&
        (meaningfulTextLength(child) >= 40 || hasRichStructure(child))
      )) || meaningfulTextLength(node) >= 120;
      const signature = semanticSignature(node);
      const isContainerOnly = !DISCUSSION_ITEM_PATTERN.test(signature) &&
        DISCUSSION_CONTAINER_PATTERN.test(signature) &&
        directChildren.some(child => DISCUSSION_ITEM_PATTERN.test(semanticSignature(child)));

      if (!hasFrame || !hasBodyLikeContent || meaningfulTextLength(node) < 60 || isLikelyDiscussionActionNode(node)) {
        return false;
      }

      if (isContainerOnly) {
        return false;
      }

      return true;
    });

    if (finalCandidates.length < 2) {
      return null;
    }

    clearDiscussionAnnotations(root.ownerDocument);

    finalCandidates.forEach((node, index) => {
      node.setAttribute(DISCUSSION_ID_ATTRIBUTE, `md-discussion-${index}`);
    });

    const finalSet = new Set(finalCandidates);
    const childMap = new Map();
    const topLevelNodes = [];

    finalCandidates.forEach(node => {
      childMap.set(node.getAttribute(DISCUSSION_ID_ATTRIBUTE), []);
    });

    finalCandidates.forEach(node => {
      const parentItem = nearestNodeInSet(node, finalSet, root);
      if (!parentItem) {
        topLevelNodes.push(node);
        return;
      }

      childMap.get(parentItem.getAttribute(DISCUSSION_ID_ATTRIBUTE))?.push(node);
    });

    if (topLevelNodes.length < 2) {
      clearDiscussionAnnotations(root.ownerDocument);
      return null;
    }

    return {
      root,
      childMap,
      topLevelNodes
    };
  }

  function pruneDiscussionClone(node, isRoot = false) {
    if (!node?.querySelectorAll) {
      return;
    }

    Array.from(node.children || []).forEach(child => {
      pruneDiscussionClone(child);
    });

    node.removeAttribute?.(DISCUSSION_ID_ATTRIBUTE);
    node.removeAttribute?.(ANCHOR_ATTRIBUTE);

    if (isRoot) {
      return;
    }

    if (isLikelyDiscussionActionNode(node)) {
      node.remove();
      return;
    }

    if (!normalizeWhitespace(node.textContent) && !node.querySelector?.('br, hr')) {
      node.remove();
      return;
    }
  }

  function createDiscussionContentWrapper(document, sourceNode) {
    const clone = sourceNode.cloneNode(true);
    clone.querySelectorAll(`[${DISCUSSION_ID_ATTRIBUTE}]`).forEach(descendant => {
      descendant.remove();
    });

    pruneDiscussionClone(clone, true);

    const wrapper = document.createElement('div');
    while (clone.firstChild) {
      wrapper.appendChild(clone.firstChild);
    }

    if (!meaningfulTextLength(wrapper)) {
      const fallbackText = normalizeWhitespace(clone.textContent);
      if (fallbackText) {
        const paragraph = document.createElement('p');
        paragraph.textContent = fallbackText;
        wrapper.appendChild(paragraph);
      }
    }

    if (!meaningfulTextLength(wrapper)) {
      return null;
    }

    pruneDiscussionClone(wrapper, true);
    return meaningfulTextLength(wrapper) ? wrapper : null;
  }

  function buildDiscussionDedupSignature(text) {
    const normalized = normalizeWhitespace(text).toLowerCase();
    if (normalized.length < 80) {
      return '';
    }

    return normalized.slice(0, 160);
  }

  function buildDiscussionListItems(document, sourceNode, childMap, articleText) {
    const sourceId = sourceNode.getAttribute(DISCUSSION_ID_ATTRIBUTE);
    const childNodes = (childMap.get(sourceId) || [])
      .flatMap(child => buildDiscussionListItems(document, child, childMap, articleText));
    const contentWrapper = createDiscussionContentWrapper(document, sourceNode);
    const contentText = normalizeWhitespace(contentWrapper?.textContent || '');
    const dedupeSignature = buildDiscussionDedupSignature(contentText);
    const isDuplicate = dedupeSignature && articleText.includes(dedupeSignature);
    const lacksSubstantiveContent = !contentWrapper || contentText.length < 40;

    if ((lacksSubstantiveContent || isDuplicate) && !childNodes.length) {
      return [];
    }

    if (lacksSubstantiveContent || isDuplicate) {
      return childNodes;
    }

    const listItem = document.createElement('li');
    listItem.appendChild(contentWrapper);

    if (childNodes.length) {
      const childList = document.createElement('ul');
      childNodes.forEach(result => {
        childList.appendChild(result.element);
      });
      listItem.appendChild(childList);
    }

    return [{
      element: listItem,
      itemCount: 1 + childNodes.reduce((sum, child) => sum + child.itemCount, 0)
    }];
  }

  function buildDiscussionRecoveryCandidate(document, articleHtml, root) {
    const plan = buildDiscussionCandidatePlan(root);
    if (!plan) {
      return null;
    }

    const articleText = normalizeWhitespace(parseArticleHtml(document, articleHtml).body.textContent).toLowerCase();
    const section = document.createElement('section');
    const heading = document.createElement('h2');
    heading.textContent = 'Comments';
    section.appendChild(heading);

    const list = document.createElement('ul');
    let itemCount = 0;

    plan.topLevelNodes.forEach(node => {
      const results = buildDiscussionListItems(document, node, plan.childMap, articleText);
      results.forEach(result => {
        list.appendChild(result.element);
        itemCount += result.itemCount;
      });
    });

    clearDiscussionAnnotations(document);

    if (!list.children.length || itemCount < 2) {
      return null;
    }

    section.appendChild(list);
    const fragmentHtml = section.outerHTML;
    const articleTextLength = meaningfulTextLength(parseArticleHtml(document, articleHtml).body);
    const addedTextLength = meaningfulTextLength(section);
    const growthThreshold = Math.max(350, articleTextLength * 0.25);
    if (addedTextLength < growthThreshold) {
      return null;
    }

    const mergedHtml = `${articleHtml}${fragmentHtml}`;
    const mergedDocument = parseArticleHtml(document, mergedHtml);
    if (linkDensity(mergedDocument.body) > 0.45) {
      return null;
    }

    return {
      html: mergedHtml,
      fragmentHtml,
      itemCount,
      topLevelCount: list.children.length,
      addedTextLength,
      score: (list.children.length * 1000) + (itemCount * 100) + addedTextLength
    };
  }

  function recoverDiscussionThread(document, articleHtml) {
    if (!articleHtml || !document?.body) {
      return null;
    }

    const rootCandidates = collectDiscussionRootCandidates(document);
    if (!rootCandidates.length) {
      return null;
    }

    let bestCandidate = null;
    rootCandidates.forEach(root => {
      const candidate = buildDiscussionRecoveryCandidate(document, articleHtml, root);
      if (!candidate) {
        return;
      }

      if (!bestCandidate || candidate.score > bestCandidate.score) {
        bestCandidate = candidate;
      }
    });

    clearDiscussionAnnotations(document);
    return bestCandidate;
  }

  function collectAnchorIds(node) {
    if (!node?.querySelectorAll) {
      return [];
    }

    const ids = [];
    if (node.getAttribute?.(ANCHOR_ATTRIBUTE)) {
      ids.push(node.getAttribute(ANCHOR_ATTRIBUTE));
    }

    node.querySelectorAll(`[${ANCHOR_ATTRIBUTE}]`).forEach(element => {
      ids.push(element.getAttribute(ANCHOR_ATTRIBUTE));
    });

    return ids.filter(Boolean);
  }

  function buildFamilyPlan(sectionContainer, extractedAnchorIds, extractedTextLength) {
    const parent = sectionContainer?.parentElement;
    if (!parent) {
      return null;
    }

    const family = Array.from(parent.children).filter(sibling => {
      if (sibling === sectionContainer) {
        return true;
      }

      if (sibling.tagName !== sectionContainer.tagName) {
        return false;
      }

      if (looksExcludedContainer(sibling)) {
        return false;
      }

      return familySignatureMatches(sectionContainer, sibling);
    });

    if (family.length < 2) {
      return null;
    }

    const familySummaries = family.map(container => {
      const dominant = dominantNonHeadingChild(container);
      const anchorIds = collectAnchorIds(container);
      const represented = anchorIds.some(id => extractedAnchorIds.has(id));
      const textLength = meaningfulTextLength(container);
      return {
        containerId: container.getAttribute(ANCHOR_ATTRIBUTE),
        dominantChildId: dominant?.child?.getAttribute(ANCHOR_ATTRIBUTE) || null,
        witnessIds: Array.from(new Set([
          container.getAttribute(ANCHOR_ATTRIBUTE),
          dominant?.child?.getAttribute(ANCHOR_ATTRIBUTE)
        ].filter(Boolean))),
        textLength,
        represented,
        isContentRich: isContentRich(container),
        linkDensity: linkDensity(container)
      };
    });

    const missingFamilyMembers = familySummaries.filter(summary => (
      !summary.represented &&
      summary.isContentRich &&
      summary.linkDensity <= 0.35
    ));

    if (!missingFamilyMembers.length) {
      return null;
    }

    const projectedGrowth = missingFamilyMembers.reduce((sum, summary) => sum + summary.textLength, 0);
    if (projectedGrowth < Math.max(400, extractedTextLength * 0.35)) {
      return null;
    }

    return {
      familyContainerIds: familySummaries.map(summary => summary.containerId).filter(Boolean),
      familyMembers: familySummaries,
      missingContainerIds: missingFamilyMembers.map(summary => summary.containerId),
      missingWitnessIds: missingFamilyMembers.flatMap(summary => summary.witnessIds),
      projectedGrowth
    };
  }

  function annotateStructuralAnchors(document) {
    let index = 0;
    document.querySelectorAll(`[${ANCHOR_ATTRIBUTE}]`).forEach(element => {
      element.removeAttribute(ANCHOR_ATTRIBUTE);
    });

    document.querySelectorAll(STRUCTURAL_SELECTOR).forEach(element => {
      element.setAttribute(ANCHOR_ATTRIBUTE, `ms-${index++}`);
    });

    return index;
  }

  function analyzeNarrowExtraction(document, articleHtml) {
    if (!articleHtml) {
      return null;
    }

    const extractedDocument = parseArticleHtml(document, articleHtml);
    const extractedAnchors = Array.from(extractedDocument.body.querySelectorAll(`[${ANCHOR_ATTRIBUTE}]`));
    const firstAnchor = extractedAnchors[0];
    if (!firstAnchor) {
      return null;
    }

    const sourceNodeId = firstAnchor.getAttribute(ANCHOR_ATTRIBUTE);
    const sourceNode = document.querySelector(`[${ANCHOR_ATTRIBUTE}="${sourceNodeId}"]`);
    if (!sourceNode) {
      return null;
    }

    const extractedAnchorIds = new Set(extractedAnchors
      .map(element => element.getAttribute(ANCHOR_ATTRIBUTE))
      .filter(Boolean));
    const extractedTextLength = meaningfulTextLength(extractedDocument.body);

    let current = sourceNode;
    for (let depth = 0; depth < 3 && current?.parentElement; depth += 1) {
      const sectionContainer = current.parentElement;
      if (!sectionContainer?.parentElement) {
        current = sectionContainer;
        continue;
      }

      if (looksExcludedContainer(sectionContainer)) {
        current = sectionContainer;
        continue;
      }

      if (!primaryHeadingLevel(sectionContainer)) {
        current = sectionContainer;
        continue;
      }

      const dominance = dominantNonHeadingChild(sectionContainer);
      if (!dominance || dominance.child !== current || dominance.ratio < 0.6) {
        current = sectionContainer;
        continue;
      }

      const familyPlan = buildFamilyPlan(sectionContainer, extractedAnchorIds, extractedTextLength);
      if (familyPlan) {
        return {
          anchorId: sourceNodeId,
          sectionContainerId: sectionContainer.getAttribute(ANCHOR_ATTRIBUTE),
          dominantChildId: current.getAttribute(ANCHOR_ATTRIBUTE),
          extractedAnchorIds: Array.from(extractedAnchorIds),
          extractedTextLength,
          ...familyPlan
        };
      }

      current = sectionContainer;
    }

    return null;
  }

  function applyRepeatedSectionPromotion(document, recoveryPlan) {
    if (!recoveryPlan?.familyContainerIds?.length) {
      return { changed: false, promotedIds: [] };
    }

    const promotedIds = [];
    recoveryPlan.familyContainerIds.forEach(containerId => {
      const container = document.querySelector(`[${ANCHOR_ATTRIBUTE}="${containerId}"]`);
      if (!container || looksExcludedContainer(container) || !primaryHeadingLevel(container)) {
        return;
      }

      const dominance = dominantNonHeadingChild(container);
      if (!dominance || dominance.ratio < 0.6 || dominance.secondLength > 80) {
        return;
      }

      const wrapper = dominance.child;
      if (!WRAPPER_TAGS.has(wrapper.tagName) || looksExcludedContainer(wrapper)) {
        return;
      }

      while (wrapper.firstChild) {
        container.insertBefore(wrapper.firstChild, wrapper);
      }
      wrapper.remove();
      promotedIds.push(containerId);
    });

    return {
      changed: promotedIds.length > 0,
      promotedIds
    };
  }

  function isIntroLikeContextNode(node) {
    if (!node || looksExcludedContainer(node)) {
      return false;
    }

    if (HEADING_TAG_PATTERN.test(node.tagName) || node.tagName === 'HR') {
      return false;
    }

    const textLength = meaningfulTextLength(node);
    if (!textLength || linkDensity(node) > 0.35) {
      return false;
    }

    if (node.tagName === 'P') {
      return textLength >= 40;
    }

    if (node.matches?.('blockquote, pre, ul, ol')) {
      return textLength >= 40 || hasRichStructure(node);
    }

    return isContentRich(node);
  }

  function buildRepeatedSectionFragment(document, recoveryPlan) {
    if (!recoveryPlan?.familyContainerIds?.length) {
      return null;
    }

    const familyContainers = recoveryPlan.familyContainerIds
      .map(containerId => document.querySelector(`[${ANCHOR_ATTRIBUTE}="${containerId}"]`))
      .filter(Boolean);
    if (!familyContainers.length) {
      return null;
    }

    const wrapper = document.createElement('div');
    const firstFamilyContainer = familyContainers[0];
    const familyIds = new Set(recoveryPlan.familyContainerIds);

    const leadingContext = [];
    let current = firstFamilyContainer.previousElementSibling;
    let inspected = 0;

    while (current && inspected < 4) {
      inspected += 1;

      const currentId = current.getAttribute?.(ANCHOR_ATTRIBUTE);
      if (currentId && familyIds.has(currentId)) {
        break;
      }

      if (current.tagName === 'HR') {
        current = current.previousElementSibling;
        continue;
      }

      if (!isIntroLikeContextNode(current)) {
        break;
      }

      leadingContext.push(current.cloneNode(true));
      current = current.previousElementSibling;
    }

    leadingContext.reverse().forEach(node => {
      wrapper.appendChild(node);
    });

    familyContainers.forEach(container => {
      wrapper.appendChild(container.cloneNode(true));
    });

    return {
      html: wrapper.innerHTML,
      includedContainerIds: familyContainers
        .map(container => container.getAttribute(ANCHOR_ATTRIBUTE))
        .filter(Boolean)
    };
  }

  function stripStructuralAnchorsFromHtml(articleHtml) {
    return String(articleHtml || '')
      .replace(/\sdata-marksnip-node-id=(?:"[^"]*"|'[^']*'|[^\s>]+)/g, '')
      .replace(/\sdata-marksnip-discussion-id=(?:"[^"]*"|'[^']*'|[^\s>]+)/g, '');
  }

  const api = {
    anchorAttribute: ANCHOR_ATTRIBUTE,
    annotateStructuralAnchors,
    analyzeDiscussionTakeover,
    analyzeNarrowExtraction,
    applyRepeatedSectionPromotion,
    buildRepeatedSectionFragment,
    recoverDiscussionThread,
    restoreSemanticTables,
    restoreMissingPrimaryHeadings,
    suppressDiscussionTakeoverCandidates,
    stripStructuralAnchorsFromHtml
  };

  global.MarkSnipReadabilityRecovery = api;

  if (typeof module === 'object' && module.exports) {
    module.exports = api;
  }
})(typeof globalThis !== 'undefined' ? globalThis : window);
