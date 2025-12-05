import { NextResponse } from 'next/server';
import { queryPg } from '@/lib/postgres';
import { PRODUCT_LINKING_IGNORE_UUID } from '@/lib/constants/productLinking';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const ids: string[] = body?.ids || [];
    if (!Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json({ success: false, error: 'ids 不能为空' }, { status: 400 });
    }

    await queryPg(
      `UPDATE qiangua_note_product_candidate
       SET "LinkedProductId" = $1, "UpdatedAt" = now()
       WHERE "Id" = ANY($2::uuid[])`,
      [PRODUCT_LINKING_IGNORE_UUID, ids],
    );

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error('[note-products:batch:ignore][POST] error', err);
    return NextResponse.json({ success: false, error: err.message || 'Internal error' }, { status: 500 });
  }
}


