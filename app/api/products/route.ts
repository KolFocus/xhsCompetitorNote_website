import { NextResponse } from 'next/server';
import { queryPg } from '@/lib/postgres';
import { PRODUCT_LINKING_DEFAULT_PAGE_SIZE } from '@/lib/constants/productLinking';

export const dynamic = 'force-dynamic';

const isBlank = (v?: string | null) => !v || !v.trim();

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const brandId = searchParams.get('brandId');
    const brandName = searchParams.get('brandName');
    const keyword = searchParams.get('keyword');
    const page = Math.max(Number(searchParams.get('page') || '1'), 1);
    const pageSize = Math.min(
      Math.max(Number(searchParams.get('pageSize') || PRODUCT_LINKING_DEFAULT_PAGE_SIZE), 1),
      100,
    );

    const conditions: string[] = [];
    const params: any[] = [];

    if (brandId) {
      params.push(brandId);
      conditions.push(`"BrandId" = $${params.length}`);
    }
    if (brandName) {
      params.push(brandName);
      conditions.push(`"BrandName" = $${params.length}`);
    }
    if (keyword) {
      params.push(`%${keyword.trim()}%`);
      conditions.push(`"ProductName" ILIKE $${params.length}`);
    }

    const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    params.push(pageSize);
    params.push((page - 1) * pageSize);

    const sql = `
      SELECT *
      FROM qiangua_product
      ${whereClause}
      ORDER BY "CreatedAt" DESC
      LIMIT $${params.length - 1} OFFSET $${params.length}
    `;

    const rows = await queryPg(sql, params);
    return NextResponse.json({ success: true, data: rows });
  } catch (err: any) {
    console.error('[products][GET] error', err);
    return NextResponse.json({ success: false, error: err.message || 'Internal error' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { productName, brandId, brandName, productLink, productImage, productDesc } = body || {};

    if (isBlank(productName) || isBlank(brandId) || isBlank(brandName)) {
      return NextResponse.json({ success: false, error: 'productName/brandId/brandName 不能为空' }, { status: 400 });
    }

    // 去重检查
    const dup = await queryPg(
      `SELECT 1 FROM qiangua_product WHERE "BrandId" = $1 AND "BrandName" = $2 AND "ProductName" = $3 LIMIT 1`,
      [brandId.trim(), brandName.trim(), productName.trim()],
    );
    if (dup.length > 0) {
      return NextResponse.json({ success: false, error: '同品牌下商品名称已存在' }, { status: 409 });
    }

    const insertSql = `
      INSERT INTO qiangua_product
      ("ProductName","BrandId","BrandName","ProductLink","ProductImage","ProductDesc")
      VALUES ($1,$2,$3,$4,$5,$6)
      RETURNING *
    `;
    const rows = await queryPg(insertSql, [
      productName.trim(),
      brandId.trim(),
      brandName.trim(),
      productLink || null,
      productImage || null,
      productDesc || null,
    ]);

    return NextResponse.json({ success: true, data: rows[0] });
  } catch (err: any) {
    console.error('[products][POST] error', err);
    return NextResponse.json({ success: false, error: err.message || 'Internal error' }, { status: 500 });
  }
}


