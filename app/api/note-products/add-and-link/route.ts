import { NextResponse } from 'next/server';
import { queryPg } from '@/lib/postgres';
import { PRODUCT_LINKING_IGNORE_UUID } from '@/lib/constants/productLinking';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const noteId = body?.noteId;
    const productId = body?.productId;
    if (!noteId || !productId) {
      return NextResponse.json({ success: false, error: 'noteId 与 productId 均不能为空' }, { status: 400 });
    }

    // 查笔记信息
    const noteSql = `
      SELECT
        "NoteId",
        "XhsNoteId",
        "XhsNoteLink",
        "Title" AS "NoteTitle",
        "CoverImage",
        "NoteType",
        "VideoDuration",
        "BloggerNickName",
        "XhsUserId",
        "BrandId",
        "BrandName"
      FROM qiangua_note_info
      WHERE "NoteId" = $1
      LIMIT 1
    `;
    const noteRows = await queryPg(noteSql, [noteId]);
    const note = noteRows?.[0];
    if (!note) {
      return NextResponse.json({ success: false, error: '笔记不存在' }, { status: 404 });
    }

    // 查商品信息
    const productSql = `
      SELECT "ProductId","ProductName","BrandId","BrandName"
      FROM qiangua_product
      WHERE "ProductId" = $1
      LIMIT 1
    `;
    const productRows = await queryPg(productSql, [productId]);
    const product = productRows?.[0];
    if (!product) {
      return NextResponse.json({ success: false, error: '商品不存在' }, { status: 404 });
    }

    // 校验品牌一致
    if (note.BrandId && note.BrandId !== product.BrandId) {
      return NextResponse.json({ success: false, error: '笔记品牌与商品品牌不一致，无法关联' }, { status: 400 });
    }

    // 检查重复候选（NoteId + ProductAliasName）
    const dupSql = `
      SELECT "Id"
      FROM qiangua_note_product_candidate
      WHERE "NoteId" = $1 AND "ProductAliasName" = $2
      LIMIT 1
    `;
    const dupRows = await queryPg(dupSql, [noteId, product.ProductName]);
    if (dupRows && dupRows.length > 0) {
      return NextResponse.json({ success: false, error: '该笔记已存在同名候选，无法重复创建' }, { status: 400 });
    }

    // 插入候选并绑定
    const insertSql = `
      INSERT INTO qiangua_note_product_candidate (
        "NoteId",
        "ProductAliasName",
        "BrandId",
        "BrandName",
        "LinkedProductId",
        "XhsNoteId",
        "XhsNoteLink",
        "NoteTitle",
        "CoverImage"
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9
      )
      RETURNING *
    `;
    const insertParams = [
      noteId,
      product.ProductName,
      product.BrandId,
      product.BrandName,
      product.ProductId,
      note.XhsNoteId,
      note.XhsNoteLink,
      note.NoteTitle,
      note.CoverImage,
    ];
    const inserted = await queryPg(insertSql, insertParams);

    return NextResponse.json({ success: true, data: inserted?.[0] });
  } catch (err: any) {
    console.error('[note-products][add-and-link] error', err);
    return NextResponse.json({ success: false, error: err.message || 'Internal error' }, { status: 500 });
  }
}


