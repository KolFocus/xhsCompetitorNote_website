import { NextResponse } from 'next/server';
import { queryPg } from '@/lib/postgres';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const brandId = searchParams.get('brandId');
    const brandName = searchParams.get('brandName');

    if (!brandId || !brandName) {
      return NextResponse.json({ success: false, error: 'brandId 与 brandName 不能为空' }, { status: 400 });
    }

    const sql = `
      SELECT
        p."ProductId",
        p."ProductName",
        COUNT(c."NoteId")::int AS "NoteCount"
      FROM qiangua_product p
      LEFT JOIN qiangua_note_product_candidate c
        ON c."LinkedProductId" = p."ProductId"
      WHERE p."BrandId" = $1 AND p."BrandName" = $2
      GROUP BY p."ProductId", p."ProductName"
      ORDER BY "NoteCount" DESC, p."ProductName" ASC
    `;

    const rows = await queryPg(sql, [brandId, brandName]);
    return NextResponse.json({ success: true, data: rows });
  } catch (err: any) {
    console.error('[products/with-note-count][GET] error', err);
    return NextResponse.json({ success: false, error: err.message || 'Internal error' }, { status: 500 });
  }
}


