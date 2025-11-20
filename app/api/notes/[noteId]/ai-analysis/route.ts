import { NextRequest, NextResponse } from 'next/server';

import { processNoteAiAnalysis } from '@/lib/ai/noteAnalysis';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(
  request: NextRequest,
  { params }: { params: { noteId: string } }
) {
  const { noteId } = params;

  if (!noteId) {
    return NextResponse.json(
      {
        success: false,
        error: '缺少笔记ID',
      },
      { status: 400 }
    );
  }

  try {
    // 执行完整的AI分析流程（查询 -> 校验 -> 锁定 -> 执行 -> 更新状态）
    const result = await processNoteAiAnalysis(noteId);

    return NextResponse.json({
      success: true,
      data: {
        noteId,
        aiStatus: result.aiStatus,
        aiContentType: result.aiContentType ?? null,
        aiRelatedProducts: result.aiRelatedProducts ?? null,
        aiSummary: result.aiSummary ?? null,
        aiErr: result.aiErr ?? null,
      },
    });
  } catch (error: any) {
    console.error('AI analysis failed for note:', noteId, error);
    return NextResponse.json(
      {
        success: false,
        error: error?.message ?? 'AI 分析失败',
      },
      { status: 500 }
    );
  }
}

