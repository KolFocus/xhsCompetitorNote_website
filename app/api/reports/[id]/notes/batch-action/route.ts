/**
 * 批量操作笔记接口
 * POST /api/reports/[id]/notes/batch-action
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = createServerClient(request);
    
    // 获取当前用户
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const reportId = params.id;

    // 验证报告存在且属于当前用户（仅查询有效报告）
    const { data: report } = await supabase
      .from('qiangua_report')
      .select('ReportId')
      .eq('ReportId', reportId)
      .eq('UserId', user.id)
      .eq('Status', 'active')
      .single();

    if (!report) {
      return NextResponse.json(
        { success: false, error: '报告不存在或无权访问' },
        { status: 404 }
      );
    }

    const body = await request.json();
    const { action, noteIds } = body;

    // 验证参数
    if (!action || !['ignore', 'delete', 'restore'].includes(action)) {
      return NextResponse.json(
        { success: false, error: '无效的操作类型' },
        { status: 400 }
      );
    }

    if (!noteIds || !Array.isArray(noteIds) || noteIds.length === 0) {
      return NextResponse.json(
        { success: false, error: '笔记ID数组不能为空' },
        { status: 400 }
      );
    }

    let result;
    let successCount = 0;
    let failedCount = 0;

    if (action === 'delete') {
      // 删除操作：物理删除
      const { error: deleteError } = await supabase
        .from('qiangua_report_note_rel')
        .delete()
        .eq('ReportId', reportId)
        .in('NoteId', noteIds);

      if (deleteError) {
        console.error('Error deleting notes:', deleteError);
        return NextResponse.json(
          { success: false, error: deleteError.message },
          { status: 500 }
        );
      }

      successCount = noteIds.length;
    } else if (action === 'ignore') {
      // 忽略操作：更新状态为 ignored（只更新 active 状态的笔记）
      const { error: updateError } = await supabase
        .from('qiangua_report_note_rel')
        .update({ Status: 'ignored' })
        .eq('ReportId', reportId)
        .eq('Status', 'active')
        .in('NoteId', noteIds);

      if (updateError) {
        console.error('Error ignoring notes:', updateError);
        return NextResponse.json(
          { success: false, error: updateError.message },
          { status: 500 }
        );
      }

      successCount = noteIds.length;
    } else if (action === 'restore') {
      // 恢复操作：更新状态为 active（只更新 ignored 状态的笔记）
      const { error: updateError } = await supabase
        .from('qiangua_report_note_rel')
        .update({ Status: 'active' })
        .eq('ReportId', reportId)
        .eq('Status', 'ignored')
        .in('NoteId', noteIds);

      if (updateError) {
        console.error('Error restoring notes:', updateError);
        return NextResponse.json(
          { success: false, error: updateError.message },
          { status: 500 }
        );
      }

      successCount = noteIds.length;
    }

    return NextResponse.json({
      success: true,
      data: {
        successCount,
        failedCount,
      },
    });
  } catch (error: any) {
    console.error('Error in batch action API:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

