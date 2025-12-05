import { NextResponse } from 'next/server';
import { queryPg } from '@/lib/postgres';

export const dynamic = 'force-dynamic';

const isBlank = (v?: string | null) => !v || !v.trim();

export async function PUT(req: Request, { params }: { params: { id: string } }) {
  try {
    const productId = params.id;
    const body = await req.json();
    const { productName, productLink, productImage, productDesc } = body || {};

    if (isBlank(productName)) {
      return NextResponse.json({ success: false, error: 'productName 不能为空' }, { status: 400 });
    }

    // 先查品牌用于去重检查
    const existing = await queryPg(
      `SELECT "BrandId","BrandName" FROM qiangua_product WHERE "ProductId" = $1 LIMIT 1`,
      [productId],
    );
    if (!existing.length) {
      return NextResponse.json({ success: false, error: '商品不存在' }, { status: 404 });
    }
    const brandId = existing[0].BrandId;
    const brandName = existing[0].BrandName;

    const dup = await queryPg(
      `SELECT 1 FROM qiangua_product 
       WHERE "BrandId" = $1 AND "BrandName" = $2 AND "ProductName" = $3 AND "ProductId" <> $4
       LIMIT 1`,
      [brandId, brandName, productName.trim(), productId],
    );
    if (dup.length > 0) {
      return NextResponse.json({ success: false, error: '同品牌下商品名称已存在' }, { status: 409 });
    }

    const updateSql = `
      UPDATE qiangua_product
      SET "ProductName" = $1,
          "ProductLink" = $2,
          "ProductImage" = $3,
          "ProductDesc" = $4,
          "UpdatedAt" = now()
      WHERE "ProductId" = $5
      RETURNING *
    `;
    const rows = await queryPg(updateSql, [
      productName.trim(),
      productLink || null,
      productImage || null,
      productDesc || null,
      productId,
    ]);

    return NextResponse.json({ success: true, data: rows[0] });
  } catch (err: any) {
    console.error('[products:id][PUT] error', err);
    return NextResponse.json({ success: false, error: err.message || 'Internal error' }, { status: 500 });
  }
}


