import { NextResponse } from 'next/server';
import { queryPg } from '@/lib/postgres';

export const dynamic = 'force-dynamic';

const handlers = {
  PUT: async (_req: Request, { params }: { params: { id: string } }) => {
    const id = params.id;

    const exists = await queryPg(`SELECT 1 FROM qiangua_note_product_candidate WHERE "Id" = $1`, [id]);
    if (!exists.length) {
      return NextResponse.json({ success: false, error: '记录不存在' }, { status: 404 });
    }

    await queryPg(
      `UPDATE qiangua_note_product_candidate
       SET "LinkedProductId" = NULL, "UpdatedAt" = now()
       WHERE "Id" = $1`,
      [id],
    );

    return NextResponse.json({ success: true });
  },
};

export async function PUT(req: Request, ctx: { params: { id: string } }) {
  try {
    return await handlers.PUT(req, ctx);
  } catch (err: any) {
    console.error('[note-products:id:unlink][PUT] error', err);
    return NextResponse.json({ success: false, error: err.message || 'Internal error' }, { status: 500 });
  }
}


