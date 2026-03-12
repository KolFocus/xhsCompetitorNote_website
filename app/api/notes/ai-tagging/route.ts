/**
 * 笔记内容类型判别（AI 打标）
 * POST /api/notes/ai-tagging
 * Body: { noteId: string, tagSetId: string }
 * 根据 tagSetId 标签系列配置与笔记内容，调用 AI 判定类目与内容类型，结果写入笔记的 aiTag 字段。
 */

import { NextRequest, NextResponse } from 'next/server';

import { processNoteAiTagging } from '@/lib/ai/aiTagAnalysis';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const noteId =
      typeof body.noteId === 'string' ? body.noteId.trim() : '';
    const tagSetId =
      typeof body.tagSetId === 'string' ? body.tagSetId.trim() : '';

    if (!noteId || !tagSetId) {
      return NextResponse.json(
        { success: false, error: '缺少 noteId 或 tagSetId' },
        { status: 400 },
      );
    }

    const result = await processNoteAiTagging(noteId, tagSetId);

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error ?? 'AI 打标失败' },
        { status: 400 },
      );
    }

    return NextResponse.json({
      success: true,
      data: { noteId, tagSetId, aiTag: result.aiTag },
    });
  } catch (error: any) {
    console.error('AI 打标接口异常', error);
    return NextResponse.json(
      { success: false, error: error?.message ?? '服务器错误' },
      { status: 500 },
    );
  }
}
