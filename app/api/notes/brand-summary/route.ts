import { NextResponse } from 'next/server';
import { queryPg } from '@/lib/postgres';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const sql = `
      SELECT 
        "BrandId",
        "BrandName",
        COUNT(*)::int AS "NoteCount"
      FROM qiangua_note_info
      WHERE "BrandId" IS NOT NULL
      GROUP BY "BrandId", "BrandName"
      ORDER BY "NoteCount" DESC
    `;

    const rows = await queryPg(sql);
    const result =
      rows?.map((item: any) => ({
        BrandId: item.BrandId,
        BrandName: item.BrandName,
        NoteCount: Number(item.NoteCount) || 0,
      })) || [];

    return NextResponse.json({
      success: true,
      data: result,
    });
  } catch (error: any) {
    console.error('Error in brand summary API:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Internal server error',
      },
      { status: 500 },
    );
  }
}

