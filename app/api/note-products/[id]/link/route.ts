import { NextResponse } from 'next/server';
import { queryPg } from '@/lib/postgres';

export const dynamic = 'force-dynamic';

const handlers = {
  PUT: async (req: Request, { params }: { params: { id: string } }) => {
    const id = params.id;
    const body = await req.json();
    const productId = body?.productId;

    if (!productId || !String(productId).trim()) {
      return NextResponse.json({ success: false, error: 'productId 不能为空' }, { status: 400 });
    }

    // 校验品牌一致
    const candidateRows = await queryPg(
      `SELECT "BrandId","BrandName" FROM qiangua_note_product_candidate WHERE "Id" = $1 LIMIT 1`,
      [id],
    );
    if (!candidateRows.length) {
      return NextResponse.json({ success: false, error: '记录不存在' }, { status: 404 });
    }
    const { BrandId, BrandName } = candidateRows[0];

    const productRows = await queryPg(
      `SELECT 1 FROM qiangua_product WHERE "ProductId" = $1 AND "BrandId" = $2 AND "BrandName" = $3 LIMIT 1`,
      [productId, BrandId, BrandName],
    );
    if (!productRows.length) {
      return NextResponse.json({ success: false, error: '商品不存在或品牌不一致' }, { status: 400 });
    }

    await queryPg(
      `UPDATE qiangua_note_product_candidate 
       SET "LinkedProductId" = $1, "UpdatedAt" = now()
       WHERE "Id" = $2`,
      [productId, id],
    );

    return NextResponse.json({ success: true });
  },
};

export async function PUT(req: Request, ctx: { params: { id: string } }) {
  try {
    return await handlers.PUT(req, ctx);
  } catch (err: any) {
    console.error('[note-products:id:link][PUT] error', err);
    return NextResponse.json({ success: false, error: err.message || 'Internal error' }, { status: 500 });
  }
}


