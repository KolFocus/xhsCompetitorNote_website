/**
 * 报告管理接口
 * GET /api/reports - 获取报告列表
 * POST /api/reports - 创建报告
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';

// 获取报告列表
export async function GET(request: NextRequest) {
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

    // 获取查询参数
    const searchParams = request.nextUrl.searchParams;
    const page = parseInt(searchParams.get('page') || '1', 10);
    const pageSize = parseInt(searchParams.get('pageSize') || '20', 10);

    // 验证分页参数
    if (page < 1 || pageSize < 1 || pageSize > 100) {
      return NextResponse.json(
        { success: false, error: 'Invalid pagination parameters' },
        { status: 400 }
      );
    }

    // 查询报告列表（仅查询有效报告）
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    const { data: reports, error: reportsError, count } = await supabase
      .from('qiangua_report')
      .select('*', { count: 'exact' })
      .eq('UserId', user.id)
      .eq('Status', 'active')
      .order('CreatedAt', { ascending: false })
      .range(from, to);

    if (reportsError) {
      console.error('Error fetching reports:', reportsError);
      return NextResponse.json(
        { success: false, error: reportsError.message },
        { status: 500 }
      );
    }

    // 获取每个报告的统计信息
    const reportsWithStats = await Promise.all(
      (reports || []).map(async (report) => {
        // 有效笔记数
        const { count: activeCount } = await supabase
          .from('qiangua_report_note_rel')
          .select('*', { count: 'exact', head: true })
          .eq('ReportId', report.ReportId)
          .eq('Status', 'active');

        // 已忽略笔记数
        const { count: ignoredCount } = await supabase
          .from('qiangua_report_note_rel')
          .select('*', { count: 'exact', head: true })
          .eq('ReportId', report.ReportId)
          .eq('Status', 'ignored');

        return {
          reportId: report.ReportId,
          reportName: report.ReportName,
          createdAt: report.CreatedAt,
          updatedAt: report.UpdatedAt,
          activeNotesCount: activeCount || 0,
          ignoredNotesCount: ignoredCount || 0,
        };
      })
    );

    return NextResponse.json({
      success: true,
      data: {
        list: reportsWithStats,
        total: count || 0,
        page,
        pageSize,
      },
    });
  } catch (error: any) {
    console.error('Error in reports API:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

// 创建报告
export async function POST(request: NextRequest) {
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

    const body = await request.json();
    const { reportName, brandIds, startDate, endDate } = body;

    // 验证参数
    if (!reportName || typeof reportName !== 'string') {
      return NextResponse.json(
        { success: false, error: '报告名称不能为空' },
        { status: 400 }
      );
    }

    if (reportName.length < 8 || reportName.length > 20) {
      return NextResponse.json(
        { success: false, error: '报告名称长度必须在8-20个字符之间' },
        { status: 400 }
      );
    }

    if (!brandIds || !Array.isArray(brandIds) || brandIds.length === 0) {
      return NextResponse.json(
        { success: false, error: '至少需要选择1个品牌' },
        { status: 400 }
      );
    }

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
      console.error('Error fetching notes:', notesError);
      return NextResponse.json(
        { success: false, error: notesError.message },
        { status: 500 }
      );
    }

    if (!notes || notes.length === 0) {
      return NextResponse.json(
        { success: false, error: '没有符合条件的笔记' },
        { status: 400 }
      );
    }

    // 创建报告
    const { data: report, error: reportError } = await supabase
      .from('qiangua_report')
      .insert({
        UserId: user.id,
        ReportName: reportName,
        Status: 'active',
      })
      .select()
      .single();

    if (reportError || !report) {
      console.error('Error creating report:', reportError);
      return NextResponse.json(
        { success: false, error: reportError?.message || '创建报告失败' },
        { status: 500 }
      );
    }

    // 批量插入笔记关联（分批处理，每批1000条）
    const batchSize = 1000;
    const noteIds = notes.map((n) => n.NoteId);
    
    for (let i = 0; i < noteIds.length; i += batchSize) {
      const batch = noteIds.slice(i, i + batchSize);
      const reportNotes = batch.map((noteId) => ({
        ReportId: report.ReportId,
        NoteId: noteId,
        Status: 'active',
      }));

      const { error: insertError } = await supabase
        .from('qiangua_report_note_rel')
        .insert(reportNotes)
        .select();

      if (insertError) {
        console.error('Error inserting report notes:', insertError);
        // 如果插入失败，逻辑删除已创建的报告
        await supabase
          .from('qiangua_report')
          .update({ Status: 'hide' })
          .eq('ReportId', report.ReportId);
        return NextResponse.json(
          { success: false, error: '导入笔记失败' },
          { status: 500 }
        );
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        reportId: report.ReportId,
        reportName: report.ReportName,
        createdAt: report.CreatedAt,
        notesCount: noteIds.length,
      },
    });
  } catch (error: any) {
    console.error('Error in create report API:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

