import type { PostgrestFilterBuilder } from '@supabase/postgrest-js';
import type { KeywordFilters } from '@/lib/utils/keywordSearch';
import { KEYWORD_SEARCH_COLUMNS, escapePostgrestFilterValue } from '@/lib/utils/keywordSearch';

type SupabaseQuery = PostgrestFilterBuilder<any, any, any, any, any, any, any>;

const buildOrClause = (term: string) => {
  const escaped = escapePostgrestFilterValue(`%${term}%`);
  return KEYWORD_SEARCH_COLUMNS.map((column) => `${column}.ilike.${escaped}`).join(',');
};

export const applyKeywordFiltersToSupabaseQuery = (
  query: SupabaseQuery,
  filters: KeywordFilters,
) => {
  if (filters.optional.length > 0) {
    const clause = filters.optional.map((term) => buildOrClause(term)).join(',');
    query = query.or(clause);
  }

  filters.mustInclude.forEach((term) => {
    const clause = buildOrClause(term);
    query = query.or(clause);
  });

  filters.mustExclude.forEach((term) => {
    const pattern = `%${term}%`;
    KEYWORD_SEARCH_COLUMNS.forEach((column) => {
      query = query.not(column, 'ilike', pattern);
    });
  });

  return query;
};

