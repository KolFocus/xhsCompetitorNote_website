import { NextResponse } from 'next/server';

import { log } from '@/lib/logger';
import { getServiceSupabaseClient } from '@/lib/supabase/admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * 获取AI分析统计数据
 */
export async function GET() {
  try {
    const supabase = getServiceSupabaseClient();

    // 1. 待分析
    const { count: pendingCount } = await supabase
      .from('qiangua_note_info')
      .select('NoteId', { count: 'exact', head: true })
      .eq('AiStatus', '待分析');

    // 2. 分析中
    const { count: processingCount } = await supabase
      .from('qiangua_note_info')
      .select('NoteId', { count: 'exact', head: true })
      .eq('AiStatus', '分析中');

    // 3. 分析失败
    const { count: failedCount } = await supabase
      .from('qiangua_note_info')
      .select('NoteId', { count: 'exact', head: true })
      .eq('AiStatus', '分析失败');

    // 4. 无内容（Content 和 XhsContent 都为空）
    const { count: noContentCount } = await supabase
      .from('qiangua_note_info')
      .select('NoteId', { count: 'exact', head: true })
      .or('Content.is.null,Content.eq.')
      .or('XhsContent.is.null,XhsContent.eq.');

    // 5. 总数
    const { count: totalCount } = await supabase
      .from('qiangua_note_info')
      .select('NoteId', { count: 'exact', head: true });

    const stats = {
      pending: pendingCount || 0,
      processing: processingCount || 0,
      failed: failedCount || 0,
      noContent: noContentCount || 0,
      total: totalCount || 0,
    };

    return NextResponse.json({
      success: true,
      data: stats,
    });
  } catch (error: any) {
    log.error('获取AI统计数据失败', {}, error);
    return NextResponse.json(
      {
        success: false,
        error: error?.message || '获取统计数据失败',
      },
      { status: 500 },
    );
  }
}

