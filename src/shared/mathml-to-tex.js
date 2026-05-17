(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
    return;
  }

  root.MarkSnipMathML = factory();
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  const operatorMap = {
    '\u00b1': '\\pm',
    '\u2213': '\\mp',
    '\u00d7': '\\times',
    '\u22c5': '\\cdot',
    '\u00f7': '\\div',
    '\u2212': '-',
    '\u2260': '\\ne',
    '\u2264': '\\le',
    '\u2265': '\\ge',
    '\u2248': '\\approx',
    '\u221e': '\\infty',
    '\u2202': '\\partial',
    '\u2207': '\\nabla',
    '\u2208': '\\in',
    '\u2209': '\\notin',
    '\u2211': '\\sum',
    '\u220f': '\\prod',
    '\u222b': '\\int',
    '\u222e': '\\oint',
    '\u2192': '\\to',
    '\u2190': '\\leftarrow',
    '\u2194': '\\leftrightarrow',
    '\u21d2': '\\Rightarrow',
    '\u21d4': '\\Leftrightarrow',
    '\u2227': '\\land',
    '\u2228': '\\lor',
    '\u00ac': '\\neg',
    '\u2229': '\\cap',
    '\u222a': '\\cup',
    '\u2282': '\\subset',
    '\u2286': '\\subseteq',
    '\u2295': '\\oplus',
    '\u2297': '\\otimes',
    '\u221d': '\\propto',
    '\u2200': '\\forall',
    '\u2203': '\\exists',
    '\u2205': '\\emptyset',
    '\u2062': '',
    '\u2061': '',
    '\u00b0': '^\\circ',
    '\u2032': '\\prime'
  };

  const greekMap = {
    '\u0391': 'A',
    '\u0392': 'B',
    '\u0393': '\\Gamma',
    '\u0394': '\\Delta',
    '\u0395': 'E',
    '\u0396': 'Z',
    '\u0397': 'H',
    '\u0398': '\\Theta',
    '\u0399': 'I',
    '\u039a': 'K',
    '\u039b': '\\Lambda',
    '\u039c': 'M',
    '\u039d': 'N',
    '\u039e': '\\Xi',
    '\u039f': 'O',
    '\u03a0': '\\Pi',
    '\u03a1': 'P',
    '\u03a3': '\\Sigma',
    '\u03a4': 'T',
    '\u03a5': '\\Upsilon',
    '\u03a6': '\\Phi',
    '\u03a7': 'X',
    '\u03a8': '\\Psi',
    '\u03a9': '\\Omega',
    '\u03b1': '\\alpha',
    '\u03b2': '\\beta',
    '\u03b3': '\\gamma',
    '\u03b4': '\\delta',
    '\u03b5': '\\epsilon',
    '\u03b6': '\\zeta',
    '\u03b7': '\\eta',
    '\u03b8': '\\theta',
    '\u03b9': '\\iota',
    '\u03ba': '\\kappa',
    '\u03bb': '\\lambda',
    '\u03bc': '\\mu',
    '\u03bd': '\\nu',
    '\u03be': '\\xi',
    '\u03bf': 'o',
    '\u03c0': '\\pi',
    '\u03c1': '\\rho',
    '\u03c2': '\\varsigma',
    '\u03c3': '\\sigma',
    '\u03c4': '\\tau',
    '\u03c5': '\\upsilon',
    '\u03c6': '\\phi',
    '\u03c7': '\\chi',
    '\u03c8': '\\psi',
    '\u03c9': '\\omega',
    '\u03d5': '\\varphi',
    '\u03d1': '\\vartheta',
    '\u03f5': '\\varepsilon'
  };

  const accentMap = {
    '^': '\\hat',
    '\u02c6': '\\hat',
    '~': '\\tilde',
    '\u02dc': '\\tilde',
    '\u00af': '\\bar',
    '\u203e': '\\bar',
    '\u2192': '\\vec',
    '.': '\\dot',
    '..': '\\ddot'
  };

  function localName(node) {
    const name = String(node?.localName || node?.nodeName || '').toLowerCase();
    return name.includes(':') ? name.split(':').pop() : name;
  }

  function elementChildren(node) {
    return Array.from(node?.childNodes || []).filter(child => child.nodeType === 1);
  }

  function normalizedText(node) {
    return String(node?.textContent || '').replace(/\s+/g, ' ').trim();
  }

  function escapeTextMode(value) {
    return String(value || '')
      .replace(/\\/g, '\\backslash{}')
      .replace(/([{}#$%&_])/g, '\\$1')
      .replace(/\^/g, '\\^{}')
      .replace(/~/g, '\\~{}');
  }

  function brace(value) {
    return `{${value || ''}}`;
  }

  function wrapBase(value) {
    const tex = value || '';
    if (
      /^[A-Za-z0-9]$/.test(tex) ||
      /^\\[A-Za-z]+$/.test(tex) ||
      /^\\[A-Za-z]+\{.*\}$/.test(tex) ||
      /^\{.*\}$/.test(tex)
    ) {
      return tex;
    }
    return brace(tex);
  }

  function normalizeTex(value) {
    return String(value || '')
      .replace(/[ \t\r\n]+/g, ' ')
      .replace(/\s+([,.;:])/g, '$1')
      .trim();
  }

  function isAnnotationNode(node) {
    const name = localName(node);
    return name === 'annotation' || name === 'annotation-xml';
  }

  function extractAnnotatedTex(node) {
    const annotations = elementChildren(node).filter(isAnnotationNode);
    for (const annotation of annotations) {
      const encoding = String(annotation.getAttribute('encoding') || '').toLowerCase();
      if (encoding.includes('tex') || encoding.includes('latex')) {
        const tex = normalizedText(annotation);
        if (tex) return tex;
      }
    }
    return null;
  }

  function convertIdentifier(node) {
    const value = normalizedText(node);
    if (!value) return '';
    if (greekMap[value]) return greekMap[value];
    if (value.length === 1) return value;
    return `\\mathrm{${escapeTextMode(value)}}`;
  }

  function convertOperator(node) {
    const value = normalizedText(node);
    if (!value) return '';
    if (operatorMap[value] !== undefined) return operatorMap[value];
    if (value === '{') return '\\{';
    if (value === '}') return '\\}';
    if (value === '\u2329') return '\\langle';
    if (value === '\u232a') return '\\rangle';
    return value;
  }

  function convertWordLikeMrow(children) {
    let value = '';
    let letterCount = 0;

    for (const child of children) {
      const name = localName(child);
      const text = normalizedText(child);

      if (name === 'mi' && /^[A-Za-z]+$/.test(text)) {
        value += text;
        letterCount += text.length;
        continue;
      }

      if (name === 'mn' && /^[0-9]+$/.test(text)) {
        value += text;
        continue;
      }

      if (name === 'mo' && text === '_') {
        value += '\\_';
        continue;
      }

      if (name === 'mspace' && value) {
        value += '\\,';
        continue;
      }

      return null;
    }

    return letterCount > 1 ? `\\mathrm{${value}}` : null;
  }

  function isFenceOperator(node, fence) {
    return localName(node) === 'mo' && normalizedText(node) === fence;
  }

  function convertMrow(node) {
    const children = elementChildren(node);
    const wordLike = convertWordLikeMrow(children);
    if (wordLike) return wordLike;

    const significantChildren = children.filter(child => localName(child) !== 'mspace');
    if (significantChildren.length >= 2 && isFenceOperator(significantChildren[0], '{')) {
      const table = significantChildren.find(child => localName(child) === 'mtable');
      if (table) return convertMtable(table, 'cases');
    }

    return children.map(convertNode).join('');
  }

  function convertMtable(node, environment) {
    const rows = elementChildren(node)
      .filter(child => localName(child) === 'mtr' || localName(child) === 'mlabeledtr')
      .map(row => {
        const cells = elementChildren(row)
          .filter(child => localName(child) === 'mtd')
          .map(cell => convertChildren(cell));
        return cells.join(' & ');
      })
      .filter(Boolean);

    const env = environment || 'matrix';
    return `\\begin{${env}}${rows.join(' \\\\ ')}\\end{${env}}`;
  }

  function convertMfenced(node) {
    const open = node.getAttribute('open') || '(';
    const close = node.getAttribute('close') || ')';
    const separators = node.getAttribute('separators') || ',';
    const separator = separators.charAt(0) || ',';
    const content = elementChildren(node).map(convertNode).join(separator);
    return `\\left${open}${content}\\right${close}`;
  }

  function convertMover(node) {
    const children = elementChildren(node);
    const base = convertNode(children[0]);
    const over = convertNode(children[1]);
    const accent = accentMap[normalizedText(children[1])];
    return accent ? `${accent}{${base}}` : `\\overset{${over}}{${base}}`;
  }

  function convertMunder(node) {
    const children = elementChildren(node);
    const base = convertNode(children[0]);
    const under = convertNode(children[1]);
    if (/^\\(sum|prod|int|oint)$/.test(base)) {
      return `${base}_{${under}}`;
    }
    return `\\underset{${under}}{${base}}`;
  }

  function convertMunderover(node) {
    const children = elementChildren(node);
    const base = convertNode(children[0]);
    const under = convertNode(children[1]);
    const over = convertNode(children[2]);
    if (/^\\(sum|prod|int|oint)$/.test(base)) {
      return `${base}_{${under}}^{${over}}`;
    }
    return `\\overset{${over}}{\\underset{${under}}{${base}}}`;
  }

  function convertChildren(node) {
    return elementChildren(node).map(convertNode).join('');
  }

  function convertNode(node) {
    if (!node) return '';

    const name = localName(node);
    switch (name) {
      case 'math':
      case 'mrow':
        return convertMrow(node);
      case 'semantics': {
        const annotatedTex = extractAnnotatedTex(node);
        if (annotatedTex) return annotatedTex;
        const presentationChild = elementChildren(node).find(child => !isAnnotationNode(child));
        return convertNode(presentationChild);
      }
      case 'mi':
        return convertIdentifier(node);
      case 'mn':
        return normalizedText(node);
      case 'mo':
        return convertOperator(node);
      case 'mtext':
        return `\\text{${escapeTextMode(normalizedText(node))}}`;
      case 'mspace':
        return '\\,';
      case 'msub': {
        const children = elementChildren(node);
        return `${wrapBase(convertNode(children[0]))}_${brace(convertNode(children[1]))}`;
      }
      case 'msup': {
        const children = elementChildren(node);
        return `${wrapBase(convertNode(children[0]))}^${brace(convertNode(children[1]))}`;
      }
      case 'msubsup': {
        const children = elementChildren(node);
        return `${wrapBase(convertNode(children[0]))}_${brace(convertNode(children[1]))}^${brace(convertNode(children[2]))}`;
      }
      case 'mfrac': {
        const children = elementChildren(node);
        const numerator = convertNode(children[0]);
        const denominator = convertNode(children[1]);
        return node.getAttribute('bevelled') === 'true'
          ? `${wrapBase(numerator)}/${wrapBase(denominator)}`
          : `\\frac{${numerator}}{${denominator}}`;
      }
      case 'msqrt':
        return `\\sqrt{${convertChildren(node)}}`;
      case 'mroot': {
        const children = elementChildren(node);
        return `\\sqrt[${convertNode(children[1])}]{${convertNode(children[0])}}`;
      }
      case 'mfenced':
        return convertMfenced(node);
      case 'mtable':
        return convertMtable(node);
      case 'mtr':
      case 'mlabeledtr':
        return elementChildren(node).filter(child => localName(child) === 'mtd').map(convertNode).join(' & ');
      case 'mtd':
        return convertChildren(node);
      case 'mover':
        return convertMover(node);
      case 'munder':
        return convertMunder(node);
      case 'munderover':
        return convertMunderover(node);
      case 'mpadded':
      case 'mstyle':
      case 'mphantom':
      case 'menclose':
        return convertChildren(node);
      default:
        return convertChildren(node) || normalizedText(node);
    }
  }

  function mathmlToTex(mathNode) {
    return normalizeTex(convertNode(mathNode));
  }

  function isDisplayMath(mathNode) {
    return String(mathNode?.getAttribute?.('display') || '').toLowerCase() === 'block';
  }

  return {
    mathmlToTex,
    isDisplayMath
  };
});
