export interface KeywordFilters {
  mustInclude: string[];
  mustExclude: string[];
  optional: string[];
}

export const KEYWORD_SEARCH_COLUMNS = [
  'Title',
  'XhsTitle',
  'XhsContent',
  'AiSummary',
  'AiContentType',
  'AiRelatedProducts',
];

const normalizeTerm = (term?: string | null) => term?.trim() || '';

const dedupe = (values: string[]) => {
  const seen = new Set<string>();
  values.forEach((value) => {
    if (value) {
      seen.add(value);
    }
  });
  return Array.from(seen);
};

export function parseKeywordExpression(input?: string | null): KeywordFilters {
  const mustInclude: string[] = [];
  const mustExclude: string[] = [];
  const optional: string[] = [];

  if (!input) {
    return { mustInclude, mustExclude, optional };
  }

  const tokens = input
    .split(/\s+/)
    .map((token) => token.trim())
    .filter(Boolean);

  tokens.forEach((token) => {
    if (!token) return;

    if (token.startsWith('+')) {
      const value = normalizeTerm(token.slice(1));
      if (value) {
        mustInclude.push(value);
      }
      return;
    }

    if (token.startsWith('-')) {
      const value = normalizeTerm(token.slice(1));
      if (value) {
        mustExclude.push(value);
      }
      return;
    }

    const parts = token.split('|').map((part) => normalizeTerm(part)).filter(Boolean);
    if (parts.length === 0) {
      return;
    }
    parts.forEach((part) => optional.push(part));
  });

  return {
    mustInclude: dedupe(mustInclude),
    mustExclude: dedupe(mustExclude),
    optional: dedupe(optional),
  };
}

export function parseKeywordFiltersFromParams(searchParams: URLSearchParams): KeywordFilters {
  const mustInclude = searchParams
    .getAll('keywordMust')
    .map((value) => normalizeTerm(value))
    .filter(Boolean);
  const mustExclude = searchParams
    .getAll('keywordMustNot')
    .map((value) => normalizeTerm(value))
    .filter(Boolean);
  const optional: string[] = [];

  searchParams.getAll('keywordAny').forEach((group) => {
    group
      .split('|')
      .map((value) => normalizeTerm(value))
      .filter(Boolean)
      .forEach((value) => optional.push(value));
  });

  if (mustInclude.length === 0 && mustExclude.length === 0 && optional.length === 0) {
    const fallback = parseKeywordExpression(searchParams.get('keyword'));
    mustInclude.push(...fallback.mustInclude);
    mustExclude.push(...fallback.mustExclude);
    optional.push(...fallback.optional);
  }

  return {
    mustInclude: dedupe(mustInclude),
    mustExclude: dedupe(mustExclude),
    optional: dedupe(optional),
  };
}

export function escapePostgrestFilterValue(value: string): string {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/,/g, '\\,')
    .replace(/\(/g, '\\(')
    .replace(/\)/g, '\\)')
    .replace(/\*/g, '\\*');
}

