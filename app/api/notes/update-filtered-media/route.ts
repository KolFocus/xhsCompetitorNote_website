import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

/**
 * POST /api/notes/update-filtered-media
 * 更新笔记的敏感图片标记
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { noteId, filteredMediaIds } = body;

    if (!noteId || typeof noteId !== 'string') {
      return NextResponse.json(
        { success: false, error: '缺少笔记ID' },
        { status: 400 }
      );
    }

    if (!Array.isArray(filteredMediaIds)) {
      return NextResponse.json(
        { success: false, error: 'filteredMediaIds 必须是数组' },
        { status: 400 }
      );
    }

    // 去重并过滤空值
    const uniqueIds = Array.from(new Set(filteredMediaIds.filter((id: any) => id && typeof id === 'string' && id.trim().length > 0)));
    
    // 转换为逗号分隔的字符串
    const filteredMediaIdStr = uniqueIds.length > 0 ? uniqueIds.join(',') : null;

    // 创建 Supabase 客户端
    const supabase = createServerClient(request);

    // 更新数据库
    const { data, error } = await supabase
      .from('qiangua_note_info')
      .update({
        AiFilterMediaId: filteredMediaIdStr,
      })
      .eq('NoteId', noteId)
      .select('NoteId, AiFilterMediaId')
      .single();

    if (error) {
      console.error('更新敏感图片标记失败:', error);
      return NextResponse.json(
        {
          success: false,
          error: error.message || '更新失败',
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        noteId: data.NoteId,
        filteredMediaIds: data.AiFilterMediaId || '',
      },
    });
  } catch (error: any) {
    console.error('更新敏感图片标记异常:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || '更新失败，请重试',
      },
      { status: 500 }
    );
  }
}

