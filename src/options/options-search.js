(function(root) {
  const SCORE_PRIMARY_EXACT = 100;
  const SCORE_EXACT_ALIAS = 90;
  const SCORE_PRIMARY_SUBSTRING = 80;
  const SCORE_ACRONYM = 70;
  const SCORE_SUBSEQUENCE = 65;
  const SCORE_TYPO = 60;
  const SCORE_SECONDARY_EXACT = 45;
  const SCORE_SECONDARY_SUBSTRING = 25;
  const STRICT_THRESHOLDS = {
    minTokenScore: 60,
    minAverageScore: 70
  };
  const FALLBACK_THRESHOLDS = {
    minTokenScore: 60,
    minAverageScore: 65
  };

  function normalizeSearchText(value) {
    return String(value || '')
      .normalize('NFKD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
      .replace(/[_./-]+/g, ' ')
      .toLowerCase()
      .replace(/[^\p{L}\p{N}]+/gu, ' ')
      .trim()
      .replace(/\s+/g, ' ');
  }

  function toWords(value) {
    const normalized = normalizeSearchText(value);
    return normalized ? normalized.split(' ') : [];
  }

  function toCondensed(value) {
    return toWords(value).join('');
  }

  function buildAcronym(words) {
    if (!words.length) return '';
    return words.map(word => word[0]).join('');
  }

  function getCleanText(element, selectorsToRemove) {
    if (!element) return '';
    const clone = element.cloneNode(true);
    (selectorsToRemove || []).forEach(selector => {
      clone.querySelectorAll(selector).forEach(node => node.remove());
    });
    return clone.textContent || '';
  }

  function createField(rawText, options) {
    const normalized = normalizeSearchText(rawText);
    if (!normalized) return null;

    const words = normalized.split(' ');
    const condensed = words.join('');
    const isShortField = words.length <= 4 || condensed.length <= 24;

    return {
      rawText,
      normalized,
      words,
      condensed,
      acronym: buildAcronym(words),
      source: options.source,
      qualifies: options.qualifies !== false,
      primary: options.primary !== false,
      isAlias: Boolean(options.isAlias),
      allowFuzzy: options.allowFuzzy != null ? options.allowFuzzy : isShortField
    };
  }

  function addField(entry, rawText, options) {
    const field = createField(rawText, options);
    if (!field) return;
    const dedupeKey = [
      field.primary ? 'primary' : 'secondary',
      field.qualifies ? 'qualifies' : 'boost',
      field.isAlias ? 'alias' : 'field',
      field.normalized
    ].join('|');

    if (entry.fieldKeys.has(dedupeKey)) return;
    entry.fieldKeys.add(dedupeKey);
    entry.fields.push(field);
  }

  function addFieldsFromNodeList(entry, nodes, options) {
    nodes.forEach(node => addField(entry, options.clean ? options.clean(node) : node.textContent, options));
  }

  function addControlFields(entry, card) {
    card.querySelectorAll('input, textarea, select').forEach(control => {
      addField(entry, control.name, {
        source: 'control-name',
        primary: true,
        qualifies: true,
        allowFuzzy: true
      });
      addField(entry, control.id, {
        source: 'control-id',
        primary: true,
        qualifies: true,
        allowFuzzy: true
      });
    });
  }

  function addAliasFields(entry, card) {
    const rawKeywords = card.dataset.searchKeywords;
    if (!rawKeywords) return;
    rawKeywords.split(',').forEach(keyword => {
      addField(entry, keyword, {
        source: 'alias',
        primary: true,
        qualifies: true,
        isAlias: true,
        allowFuzzy: true
      });
    });
  }

  function createEntry(card, section, sectionTitle) {
    const entry = {
      card,
      section,
      fields: [],
      fieldKeys: new Set()
    };

    addField(entry, sectionTitle, {
      source: 'section-title',
      primary: true,
      qualifies: false,
      allowFuzzy: true
    });

    addField(entry, card.querySelector('.card-title')?.textContent, {
      source: 'card-title',
      primary: true,
      qualifies: true
    });

    addFieldsFromNodeList(entry, card.querySelectorAll('.toggle-label-text'), {
      source: 'toggle-label',
      primary: true,
      qualifies: true
    });

    addFieldsFromNodeList(entry, card.querySelectorAll('.input-label'), {
      source: 'input-label',
      primary: true,
      qualifies: true
    });

    addFieldsFromNodeList(entry, card.querySelectorAll('.radio-card-title'), {
      source: 'radio-card-title',
      primary: true,
      qualifies: true
    });

    addFieldsFromNodeList(entry, card.querySelectorAll('.radio-pill label'), {
      source: 'radio-pill-label',
      primary: true,
      qualifies: true,
      clean: label => getCleanText(label, ['.radio-pill-tooltip'])
    });

    addControlFields(entry, card);
    addAliasFields(entry, card);

    addFieldsFromNodeList(entry, card.querySelectorAll('.card-desc'), {
      source: 'card-desc',
      primary: false,
      qualifies: false,
      allowFuzzy: false,
      clean: node => getCleanText(node, ['a'])
    });

    addFieldsFromNodeList(entry, card.querySelectorAll('.toggle-hint'), {
      source: 'toggle-hint',
      primary: false,
      qualifies: false,
      allowFuzzy: false
    });

    addFieldsFromNodeList(entry, card.querySelectorAll('.option-note'), {
      source: 'option-note',
      primary: false,
      qualifies: false,
      allowFuzzy: false
    });

    delete entry.fieldKeys;
    return entry;
  }

  function buildSearchIndex(rootNode) {
    const rootElement = rootNode?.querySelectorAll ? rootNode : document;
    const sections = Array.from(rootElement.querySelectorAll('.section'));
    const index = [];

    sections.forEach(section => {
      const sectionTitle = section.querySelector('.section-title')?.textContent || section.dataset.sectionLabel || '';
      section.querySelectorAll('.setting-card').forEach(card => {
        index.push(createEntry(card, section, sectionTitle));
      });
    });

    return index;
  }

  function isPrimaryWordStart(field, token) {
    return field.words.some(word => word === token || word.startsWith(token));
  }

  function getSubsequenceSpan(query, target) {
    let start = -1;
    let end = -1;
    let queryIndex = 0;

    for (let targetIndex = 0; targetIndex < target.length; targetIndex += 1) {
      if (target[targetIndex] !== query[queryIndex]) continue;
      if (start === -1) start = targetIndex;
      end = targetIndex;
      queryIndex += 1;
      if (queryIndex === query.length) {
        return (end - start) + 1;
      }
    }

    return 0;
  }

  function isSingleEditMatch(query, candidate) {
    const queryLength = query.length;
    const candidateLength = candidate.length;
    const lengthDelta = Math.abs(queryLength - candidateLength);

    if (lengthDelta > 1 || query === candidate) return false;

    let queryIndex = 0;
    let candidateIndex = 0;
    let mismatchCount = 0;

    while (queryIndex < queryLength && candidateIndex < candidateLength) {
      if (query[queryIndex] === candidate[candidateIndex]) {
        queryIndex += 1;
        candidateIndex += 1;
        continue;
      }

      mismatchCount += 1;
      if (mismatchCount > 1) return false;

      if (queryLength > candidateLength) {
        queryIndex += 1;
      } else if (candidateLength > queryLength) {
        candidateIndex += 1;
      } else {
        queryIndex += 1;
        candidateIndex += 1;
      }
    }

    if (queryIndex < queryLength || candidateIndex < candidateLength) {
      mismatchCount += 1;
    }

    return mismatchCount === 1;
  }

  function scorePrimaryField(field, token, tokenCondensed) {
    if (field.isAlias && (field.normalized === token || field.condensed === tokenCondensed)) {
      return SCORE_EXACT_ALIAS;
    }

    if (field.normalized === token || isPrimaryWordStart(field, token)) {
      return SCORE_PRIMARY_EXACT;
    }

    if (token.length >= 3 && (field.normalized.includes(token) || field.condensed.includes(tokenCondensed))) {
      return SCORE_PRIMARY_SUBSTRING;
    }

    if (!field.allowFuzzy) return 0;

    if (field.acronym && tokenCondensed === field.acronym) {
      return SCORE_ACRONYM;
    }

    if (tokenCondensed.length >= 4) {
      const span = getSubsequenceSpan(tokenCondensed, field.condensed);
      if (span && span <= tokenCondensed.length * 1.8) {
        return SCORE_SUBSEQUENCE;
      }
    }

    if (tokenCondensed.length >= 5) {
      const candidates = new Set([field.condensed, ...field.words]);
      for (const candidate of candidates) {
        if (isSingleEditMatch(tokenCondensed, candidate)) {
          return SCORE_TYPO;
        }
      }
    }

    return 0;
  }

  function scoreSecondaryField(field, token, tokenCondensed) {
    if (field.normalized === token || field.condensed === tokenCondensed) {
      return SCORE_SECONDARY_EXACT;
    }

    if (token.length >= 3 && (field.normalized.includes(token) || field.condensed.includes(tokenCondensed))) {
      return SCORE_SECONDARY_SUBSTRING;
    }

    return 0;
  }

  function scoreField(field, token) {
    const tokenCondensed = token.replace(/\s+/g, '');
    if (!tokenCondensed) return 0;
    return field.primary
      ? scorePrimaryField(field, token, tokenCondensed)
      : scoreSecondaryField(field, token, tokenCondensed);
  }

  function evaluateEntry(entry, tokens, thresholds) {
    let totalScore = 0;
    let hasQualifierMatch = false;

    const tokenMatches = tokens.map(token => {
      let bestField = null;
      let bestScore = 0;
      let bestQualifierScore = 0;

      entry.fields.forEach(field => {
        const score = scoreField(field, token);
        if (!score) return;
        if (score > bestScore) {
          bestScore = score;
          bestField = field;
        }
        if (field.qualifies && score > bestQualifierScore) {
          bestQualifierScore = score;
        }
      });

      if (bestQualifierScore >= thresholds.minTokenScore) {
        hasQualifierMatch = true;
      }

      totalScore += bestScore;

      return {
        token,
        score: bestScore,
        qualifierScore: bestQualifierScore,
        fieldSource: bestField?.source || null
      };
    });

    const averageScore = tokens.length ? totalScore / tokens.length : 0;
    const matches = (
      tokens.length > 0 &&
      hasQualifierMatch &&
      tokenMatches.every(match => match.score >= thresholds.minTokenScore) &&
      averageScore >= thresholds.minAverageScore
    );

    return {
      ...entry,
      matches,
      score: averageScore,
      tokenMatches
    };
  }

  function runSearch(index, normalizedQuery, thresholds, stage) {
    const tokens = normalizedQuery ? normalizedQuery.split(' ') : [];
    const results = index.map(entry => evaluateEntry(entry, tokens, thresholds));
    const matches = results.filter(result => result.matches);

    return {
      query: normalizedQuery,
      tokens,
      stage,
      results,
      matches
    };
  }

  function searchSettings(index, query) {
    const normalizedQuery = normalizeSearchText(query);

    if (!normalizedQuery) {
      return {
        query: '',
        tokens: [],
        stage: 'none',
        results: index.map(entry => ({
          ...entry,
          matches: false,
          score: 0,
          tokenMatches: []
        })),
        matches: []
      };
    }

    const strictSearch = runSearch(index, normalizedQuery, STRICT_THRESHOLDS, 'strict');
    if (strictSearch.matches.length > 0) {
      return strictSearch;
    }

    return runSearch(index, normalizedQuery, FALLBACK_THRESHOLDS, 'fallback');
  }

  const api = {
    buildSearchIndex,
    normalizeSearchText,
    searchSettings
  };

  root.markSnipOptionsSearch = api;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
})(typeof globalThis !== 'undefined' ? globalThis : this);
