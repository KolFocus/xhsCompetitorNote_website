import { NextResponse } from 'next/server';
import { queryPg } from '@/lib/postgres';
import { PRODUCT_LINKING_DEFAULT_PAGE_SIZE, PRODUCT_LINKING_IGNORE_UUID } from '@/lib/constants/productLinking';
import { parseKeywordExpression } from '@/lib/utils/keywordSearch';

export const dynamic = 'force-dynamic';

type StatusType = 'pending' | 'linked' | 'ignored';

const deriveStatusWhere = (status?: StatusType | 'all') => {
  if (!status || status === 'all') return { clause: '', params: [] as any[] };
  if (status === 'pending') return { clause: `"LinkedProductId" IS NULL`, params: [] };
  if (status === 'ignored') return { clause: `"LinkedProductId" = $X`, params: [PRODUCT_LINKING_IGNORE_UUID] };
  return { clause: `"LinkedProductId" IS NOT NULL AND "LinkedProductId" <> $X`, params: [PRODUCT_LINKING_IGNORE_UUID] };
};

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const brandId = searchParams.get('brandId');
    const brandName = searchParams.get('brandName');
    const noteId = searchParams.get('noteId');
    const status = (searchParams.get('status') as StatusType | 'all' | null) || 'all';
    const keywordRaw = searchParams.get('keyword') || '';
    const page = Math.max(Number(searchParams.get('page') || '1'), 1);
    const pageSize = Math.min(
      Math.max(Number(searchParams.get('pageSize') || PRODUCT_LINKING_DEFAULT_PAGE_SIZE), 1),
      100,
    );

    const filters = parseKeywordExpression(keywordRaw);

    const conditions: string[] = [];
    const params: any[] = [];

    if (brandId) {
      params.push(brandId);
      conditions.push(`c."BrandId" = $${params.length}`);
    }
    if (brandName) {
      params.push(brandName);
      conditions.push(`c."BrandName" = $${params.length}`);
    }
    if (noteId) {
      const trimmed = noteId.trim();
      params.push(`%${trimmed}%`);
      params.push(`%${trimmed}%`);
      const firstIdx = params.length - 1;
      const secondIdx = params.length;
      conditions.push(`(c."NoteId" ILIKE $${firstIdx} OR n."XhsNoteId" ILIKE $${secondIdx})`);
    }

    if (filters.mustInclude?.length) {
      filters.mustInclude.forEach((term) => {
        params.push(`%${term}%`);
        conditions.push(`c."ProductAliasName" ILIKE $${params.length}`);
      });
    }
    if (filters.mustExclude?.length) {
      filters.mustExclude.forEach((term) => {
        params.push(`%${term}%`);
        conditions.push(`c."ProductAliasName" NOT ILIKE $${params.length}`);
      });
    }
    if (filters.optional?.length) {
      const ors: string[] = [];
      filters.optional.forEach((term) => {
        params.push(`%${term}%`);
        ors.push(`c."ProductAliasName" ILIKE $${params.length}`);
      });
      if (ors.length) {
        conditions.push(`(${ors.join(' OR ')})`);
      }
    }

    const statusWhere = deriveStatusWhere(status || undefined);
    if (statusWhere.clause) {
      const clause = statusWhere.clause.replace('$X', `$${params.length + 1}`);
      params.push(...statusWhere.params);
      conditions.push(clause);
    }

    const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const paramsWithPagination = [...params, pageSize, (page - 1) * pageSize];

    const sql = `
      SELECT
        c.*,
        n."NoteType",
        n."VideoDuration",
        n."BloggerNickName",
        n."XhsUserId",
        n."XhsNoteLink",
        n."CoverImage"
      FROM qiangua_note_product_candidate c
      LEFT JOIN qiangua_note_info n ON n."NoteId" = c."NoteId"
      ${whereClause}
      ORDER BY c."CreatedAt" DESC
      LIMIT $${paramsWithPagination.length - 1} OFFSET $${paramsWithPagination.length}
    `;

    const rows = await queryPg(sql, paramsWithPagination);

    // 统计总数（不带分页参数）
    const countSql = `
      SELECT COUNT(*)::int AS total
      FROM qiangua_note_product_candidate c
      LEFT JOIN qiangua_note_info n ON n."NoteId" = c."NoteId"
      ${whereClause}
    `;
    const countRows = await queryPg(countSql, params);
    const total = countRows?.[0]?.total || 0;

    return NextResponse.json({ success: true, data: { list: rows, total } });
  } catch (err: any) {
    console.error('[note-products][GET] error', err);
    return NextResponse.json({ success: false, error: err.message || 'Internal error' }, { status: 500 });
  }
}


