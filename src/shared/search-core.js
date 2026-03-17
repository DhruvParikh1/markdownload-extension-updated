/**
 * MarkSnip — Shared Fuzzy Search Core
 *
 * Extracted from options-search.js so both the Settings page and
 * the User Guide can share the same scoring / normalization engine.
 *
 * Public API (attached to root.markSnipSearchCore):
 *   normalizeSearchText(value)  → string
 *   toWords(value)              → string[]
 *   toCondensed(value)          → string
 *   buildAcronym(words)         → string
 *   getSubsequenceSpan(q, t)    → number
 *   isSingleEditMatch(a, b)     → boolean
 *   scorePrimaryField(field, token, tokenCondensed)   → number
 *   scoreSecondaryField(field, token, tokenCondensed) → number
 *   scoreField(field, token)    → number
 *   createField(rawText, opts)  → object | null
 *   evaluateEntry(entry, tokens, thresholds) → object
 *   runSearch(index, normalizedQuery, thresholds, stage) → object
 *   STRICT_THRESHOLDS, FALLBACK_THRESHOLDS
 *   SCORES  (bag of score constants)
 */
(function (root) {
  /* ── Score Constants ── */
  const SCORES = {
    PRIMARY_EXACT:        100,
    EXACT_ALIAS:           90,
    PRIMARY_SUBSTRING:     80,
    ACRONYM:               70,
    SUBSEQUENCE:           65,
    TYPO:                  60,
    SECONDARY_EXACT:       45,
    SECONDARY_SUBSTRING:   25
  };

  const STRICT_THRESHOLDS  = { minTokenScore: 60, minAverageScore: 70 };
  const FALLBACK_THRESHOLDS = { minTokenScore: 60, minAverageScore: 65 };

  /* ── Text helpers ── */
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
    const n = normalizeSearchText(value);
    return n ? n.split(' ') : [];
  }

  function toCondensed(value) {
    return toWords(value).join('');
  }

  function buildAcronym(words) {
    if (!words.length) return '';
    return words.map(w => w[0]).join('');
  }

  /* ── Field factory ── */
  function createField(rawText, options) {
    const normalized = normalizeSearchText(rawText);
    if (!normalized) return null;

    const words     = normalized.split(' ');
    const condensed = words.join('');
    const isShort   = words.length <= 4 || condensed.length <= 24;

    return {
      rawText,
      normalized,
      words,
      condensed,
      acronym:    buildAcronym(words),
      source:     options.source,
      qualifies:  options.qualifies !== false,
      primary:    options.primary   !== false,
      isAlias:    Boolean(options.isAlias),
      allowFuzzy: options.allowFuzzy != null ? options.allowFuzzy : isShort
    };
  }

  /* ── Matching helpers ── */
  function isPrimaryWordStart(field, token) {
    return field.words.some(w => w === token || w.startsWith(token));
  }

  function getSubsequenceSpan(query, target) {
    let start = -1, end = -1, qi = 0;
    for (let ti = 0; ti < target.length; ti++) {
      if (target[ti] !== query[qi]) continue;
      if (start === -1) start = ti;
      end = ti;
      qi++;
      if (qi === query.length) return (end - start) + 1;
    }
    return 0;
  }

  function isSingleEditMatch(query, candidate) {
    const ql = query.length, cl = candidate.length;
    if (Math.abs(ql - cl) > 1 || query === candidate) return false;

    let qi = 0, ci = 0, mismatches = 0;
    while (qi < ql && ci < cl) {
      if (query[qi] === candidate[ci]) { qi++; ci++; continue; }
      mismatches++;
      if (mismatches > 1) return false;
      if (ql > cl) qi++;
      else if (cl > ql) ci++;
      else { qi++; ci++; }
    }
    if (qi < ql || ci < cl) mismatches++;
    return mismatches === 1;
  }

  /* ── Scoring ── */
  function scorePrimaryField(field, token, tokenCondensed) {
    if (field.isAlias && (field.normalized === token || field.condensed === tokenCondensed))
      return SCORES.EXACT_ALIAS;

    if (field.normalized === token || isPrimaryWordStart(field, token))
      return SCORES.PRIMARY_EXACT;

    if (token.length >= 3 && (field.normalized.includes(token) || field.condensed.includes(tokenCondensed)))
      return SCORES.PRIMARY_SUBSTRING;

    if (!field.allowFuzzy) return 0;

    if (field.acronym && tokenCondensed === field.acronym)
      return SCORES.ACRONYM;

    if (tokenCondensed.length >= 4) {
      const span = getSubsequenceSpan(tokenCondensed, field.condensed);
      if (span && span <= tokenCondensed.length * 1.8) return SCORES.SUBSEQUENCE;
    }

    if (tokenCondensed.length >= 5) {
      const candidates = new Set([field.condensed, ...field.words]);
      for (const c of candidates) {
        if (isSingleEditMatch(tokenCondensed, c)) return SCORES.TYPO;
      }
    }
    return 0;
  }

  function scoreSecondaryField(field, token, tokenCondensed) {
    if (field.normalized === token || field.condensed === tokenCondensed)
      return SCORES.SECONDARY_EXACT;
    if (token.length >= 3 && (field.normalized.includes(token) || field.condensed.includes(tokenCondensed)))
      return SCORES.SECONDARY_SUBSTRING;
    return 0;
  }

  function scoreField(field, token) {
    const tc = token.replace(/\s+/g, '');
    if (!tc) return 0;
    return field.primary
      ? scorePrimaryField(field, token, tc)
      : scoreSecondaryField(field, token, tc);
  }

  /* ── Entry evaluation ── */
  function evaluateEntry(entry, tokens, thresholds) {
    let total = 0, hasQualifier = false;

    const tokenMatches = tokens.map(token => {
      let bestField = null, bestScore = 0, bestQS = 0;
      entry.fields.forEach(field => {
        const s = scoreField(field, token);
        if (!s) return;
        if (s > bestScore) { bestScore = s; bestField = field; }
        if (field.qualifies && s > bestQS) bestQS = s;
      });
      if (bestQS >= thresholds.minTokenScore) hasQualifier = true;
      total += bestScore;
      return { token, score: bestScore, qualifierScore: bestQS, fieldSource: bestField?.source || null };
    });

    const avg = tokens.length ? total / tokens.length : 0;
    const matches = (
      tokens.length > 0 &&
      hasQualifier &&
      tokenMatches.every(m => m.score >= thresholds.minTokenScore) &&
      avg >= thresholds.minAverageScore
    );

    return { ...entry, matches, score: avg, tokenMatches };
  }

  function runSearch(index, normalizedQuery, thresholds, stage) {
    const tokens  = normalizedQuery ? normalizedQuery.split(' ') : [];
    const results = index.map(e => evaluateEntry(e, tokens, thresholds));
    return { query: normalizedQuery, tokens, stage, results, matches: results.filter(r => r.matches) };
  }

  /* ── Public API ── */
  const api = {
    SCORES,
    STRICT_THRESHOLDS,
    FALLBACK_THRESHOLDS,
    normalizeSearchText,
    toWords,
    toCondensed,
    buildAcronym,
    createField,
    getSubsequenceSpan,
    isSingleEditMatch,
    scorePrimaryField,
    scoreSecondaryField,
    scoreField,
    evaluateEntry,
    runSearch
  };

  root.markSnipSearchCore = api;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
})(typeof globalThis !== 'undefined' ? globalThis : this);
