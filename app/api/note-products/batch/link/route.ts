import { NextResponse } from 'next/server';
import { queryPg } from '@/lib/postgres';

export const dynamic = 'force-dynamic';

const handlers = {
  POST: async (req: Request) => {
    const body = await req.json();
    const ids: string[] = body?.ids || [];
    const productId: string = body?.productId;

    if (!Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json({ success: false, error: 'ids 不能为空' }, { status: 400 });
    }
    if (!productId || !String(productId).trim()) {
      return NextResponse.json({ success: false, error: 'productId 不能为空' }, { status: 400 });
    }

    // 校验所有记录存在 & 品牌一致
    const rows = await queryPg(
      `SELECT "Id","BrandId","BrandName" FROM qiangua_note_product_candidate WHERE "Id" = ANY($1::uuid[])`,
      [ids],
    );
    if (rows.length !== ids.length) {
      return NextResponse.json({ success: false, error: '部分记录不存在' }, { status: 404 });
    }
    const brandKeys = new Set(rows.map((r) => `${r.BrandId}#${r.BrandName}`));
    if (brandKeys.size > 1) {
      return NextResponse.json({ success: false, error: '批量关联仅支持同品牌记录' }, { status: 400 });
    }
    const [brandKey] = Array.from(brandKeys);
    const [brandId, brandName] = brandKey.split('#');

    const productRows = await queryPg(
      `SELECT 1 FROM qiangua_product WHERE "ProductId" = $1 AND "BrandId" = $2 AND "BrandName" = $3 LIMIT 1`,
      [productId, brandId, brandName],
    );
    if (!productRows.length) {
      return NextResponse.json({ success: false, error: '商品不存在或品牌不一致' }, { status: 400 });
    }

    await queryPg(
      `UPDATE qiangua_note_product_candidate
       SET "LinkedProductId" = $1, "UpdatedAt" = now()
       WHERE "Id" = ANY($2::uuid[])`,
      [productId, ids],
    );

    return NextResponse.json({ success: true });
  },
};

export async function POST(req: Request) {
  try {
    return await handlers.POST(req);
  } catch (err: any) {
    console.error('[note-products:batch:link][POST] error', err);
    return NextResponse.json({ success: false, error: err.message || 'Internal error' }, { status: 500 });
  }
}


