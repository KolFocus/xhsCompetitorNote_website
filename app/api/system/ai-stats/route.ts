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

    // 并发执行所有查询以提高效率
    const [
      { count: pendingCount },
      { count: processingCount },
      { count: failedCount },
      { count: noContentCount },
    ] = await Promise.all([
      // 1. 待分析（排除 XhsNoteLink 为空）
      supabase
        .from('qiangua_note_info')
        .select('NoteId', { count: 'exact', head: true })
        .eq('AiStatus', '待分析')
        .not('XhsNoteLink', 'is', null)
        .neq('XhsNoteLink', ''),

      // 2. 分析中（排除 XhsNoteLink 为空）
      supabase
        .from('qiangua_note_info')
        .select('NoteId', { count: 'exact', head: true })
        .eq('AiStatus', '分析中')
        .not('XhsNoteLink', 'is', null)
        .neq('XhsNoteLink', ''),

      // 3. 分析失败（排除 XhsNoteLink 为空）
      supabase
        .from('qiangua_note_info')
        .select('NoteId', { count: 'exact', head: true })
        .eq('AiStatus', '分析失败')
        .not('XhsNoteLink', 'is', null)
        .neq('XhsNoteLink', ''),

      // 4. 无内容（XhsNoteLink 为空）
      supabase
        .from('qiangua_note_info')
        .select('NoteId', { count: 'exact', head: true })
        .or('XhsNoteLink.is.null,XhsNoteLink.eq.'),
    ]);

    const stats = {
      pending: pendingCount || 0,
      processing: processingCount || 0,
      failed: failedCount || 0,
      noContent: noContentCount || 0,
      total: 0, // 前端暂不显示总数，避免额外查询开销
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

