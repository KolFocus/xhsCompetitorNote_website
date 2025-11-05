/**
 * 报告详情接口
 * GET /api/reports/[id] - 获取报告详情
 * DELETE /api/reports/[id] - 删除报告
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = createServerClient();
    
    // 获取当前用户
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const reportId = params.id;

    // 查询报告
    const { data: report, error: reportError } = await supabase
      .from('reports')
      .select('*')
      .eq('ReportId', reportId)
      .eq('UserId', user.id)
      .single();

    if (reportError || !report) {
      return NextResponse.json(
        { success: false, error: '报告不存在或无权访问' },
        { status: 404 }
      );
    }

    // 获取统计信息
    const { count: activeCount } = await supabase
      .from('report_notes')
      .select('*', { count: 'exact', head: true })
      .eq('ReportId', reportId)
      .eq('Status', 'active');

    const { count: ignoredCount } = await supabase
      .from('report_notes')
      .select('*', { count: 'exact', head: true })
      .eq('ReportId', reportId)
      .eq('Status', 'ignored');

    // 获取时间范围
    const { data: timeRange } = await supabase
      .from('report_notes')
      .select('qiangua_note_info(PublishTime)')
      .eq('ReportId', reportId)
      .order('qiangua_note_info.PublishTime', { ascending: true })
      .limit(1);

    const { data: timeRangeMax } = await supabase
      .from('report_notes')
      .select('qiangua_note_info(PublishTime)')
      .eq('ReportId', reportId)
      .order('qiangua_note_info.PublishTime', { ascending: false })
      .limit(1);

    // 获取品牌列表
    const { data: brandsData } = await supabase
      .from('report_notes')
      .select('qiangua_note_info(BrandId, BrandName)')
      .eq('ReportId', reportId)
      .not('qiangua_note_info.BrandId', 'is', null);

    const brandsMap = new Map();
    brandsData?.forEach((item: any) => {
      const brand = item.qiangua_note_info;
      if (brand && brand.BrandId) {
        brandsMap.set(brand.BrandId, {
          brandId: brand.BrandId,
          brandName: brand.BrandName,
        });
      }
    });

    return NextResponse.json({
      success: true,
      data: {
        reportId: report.ReportId,
        reportName: report.ReportName,
        createdAt: report.CreatedAt,
        updatedAt: report.UpdatedAt,
        activeNotesCount: activeCount || 0,
        ignoredNotesCount: ignoredCount || 0,
        earliestNoteTime: timeRange?.[0]?.qiangua_note_info?.PublishTime || null,
        latestNoteTime: timeRangeMax?.[0]?.qiangua_note_info?.PublishTime || null,
        brands: Array.from(brandsMap.values()),
      },
    });
  } catch (error: any) {
    console.error('Error in get report API:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = createServerClient();
    
    // 获取当前用户
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const reportId = params.id;

    // 验证报告存在且属于当前用户
    const { data: report, error: reportError } = await supabase
      .from('reports')
      .select('ReportId')
      .eq('ReportId', reportId)
      .eq('UserId', user.id)
      .single();

    if (reportError || !report) {
      return NextResponse.json(
        { success: false, error: '报告不存在或无权访问' },
        { status: 404 }
      );
    }

    // 删除报告（级联删除关联的 report_notes）
    const { error: deleteError } = await supabase
      .from('reports')
      .delete()
      .eq('ReportId', reportId);

    if (deleteError) {
      console.error('Error deleting report:', deleteError);
      return NextResponse.json(
        { success: false, error: deleteError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        reportId,
      },
    });
  } catch (error: any) {
    console.error('Error in delete report API:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

