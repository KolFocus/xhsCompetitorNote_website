/**
 * 计算增量笔记数量接口
 * POST /api/reports/[id]/calculate-new-notes
 * 用于追加笔记对话框的动态计算
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
    const { brandIds, startDate, endDate } = body;

    // 验证参数
    if (!brandIds || !Array.isArray(brandIds) || brandIds.length === 0) {
      return NextResponse.json({
        success: true,
        data: { newCount: 0 },
      });
    }

    // 获取报告中已有的笔记ID（无论状态）
    const { data: existingNotes } = await supabase
      .from('qiangua_report_note_rel')
      .select('NoteId')
      .eq('ReportId', reportId);

    const existingNoteIds = existingNotes?.map((n) => n.NoteId) || [];

    // 查询符合条件的笔记
    let notesQuery = supabase
      .from('qiangua_note_info')
      .select('NoteId')
      .in('BrandId', brandIds);

    if (startDate) {
      notesQuery = notesQuery.gte('PubDate', startDate);
    }
    if (endDate) {
      notesQuery = notesQuery.lte('PubDate', endDate);
    }

    const { data: notes, error: notesError } = await notesQuery;

    if (notesError) {
      console.error('Error calculating new notes:', notesError);
      return NextResponse.json(
        { success: false, error: notesError.message },
        { status: 500 }
      );
    }

    // 过滤掉已在报告中的笔记
    const newNotes = notes?.filter((note) => !existingNoteIds.includes(note.NoteId)) || [];

    return NextResponse.json({
      success: true,
      data: {
        newCount: newNotes.length,
      },
    });
  } catch (error: any) {
    console.error('Error in calculate new notes API:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

