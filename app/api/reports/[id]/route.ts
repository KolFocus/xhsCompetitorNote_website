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

    // 查询报告（仅查询有效报告）
    const { data: report, error: reportError } = await supabase
      .from('qiangua_report')
      .select('*')
      .eq('ReportId', reportId)
      .eq('UserId', user.id)
      .eq('Status', 'active')
      .single();

    if (reportError || !report) {
      return NextResponse.json(
        { success: false, error: '报告不存在或无权访问' },
        { status: 404 }
      );
    }

    // 获取统计信息
    const { count: activeCount } = await supabase
      .from('qiangua_report_note_rel')
      .select('*', { count: 'exact', head: true })
      .eq('ReportId', reportId)
      .eq('Status', 'active');

    const { count: ignoredCount } = await supabase
      .from('qiangua_report_note_rel')
      .select('*', { count: 'exact', head: true })
      .eq('ReportId', reportId)
      .eq('Status', 'ignored');

    // 获取时间范围（包括所有笔记）
    const { data: timeRangeData } = await supabase
      .from('qiangua_report_note_rel')
      .select('qiangua_note_info(PublishTime)')
      .eq('ReportId', reportId);

    // 从查询结果中提取所有有效的发布时间
    const publishTimes = timeRangeData
      ?.map((item: any) => item.qiangua_note_info?.PublishTime)
      .filter((time: any) => time != null) || [];

    // 计算最早和最晚时间
    let earliestNoteTime: string | null = null;
    let latestNoteTime: string | null = null;
    
    if (publishTimes.length > 0) {
      const sortedTimes = publishTimes.sort((a: string, b: string) => 
        new Date(a).getTime() - new Date(b).getTime()
      );
      earliestNoteTime = sortedTimes[0];
      latestNoteTime = sortedTimes[sortedTimes.length - 1];
    }

    // 获取品牌列表（不去重）
    const { data: brandsData } = await supabase
      .from('qiangua_report_note_rel')
      .select('qiangua_note_info(BrandId, BrandName)')
      .eq('ReportId', reportId)
      .not('qiangua_note_info.BrandId', 'is', null);

    const brands: Array<{ brandId: string; brandName: string }> = [];
    const brandSet = new Set<string>(); // 用于去重相同的 BrandId+BrandName 组合
    brandsData?.forEach((item: any) => {
      const brand = item.qiangua_note_info;
      if (brand && brand.BrandId) {
        const brandKey = `${brand.BrandId}#KF#${brand.BrandName}`;
        if (!brandSet.has(brandKey)) {
          brandSet.add(brandKey);
          brands.push({
            brandId: brand.BrandId,
            brandName: brand.BrandName,
          });
        }
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
        earliestNoteTime,
        latestNoteTime,
        brands: brands,
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
    const { data: report, error: reportError } = await supabase
      .from('qiangua_report')
      .select('ReportId')
      .eq('ReportId', reportId)
      .eq('UserId', user.id)
      .eq('Status', 'active')
      .single();

    if (reportError || !report) {
      return NextResponse.json(
        { success: false, error: '报告不存在或无权访问' },
        { status: 404 }
      );
    }

    // 逻辑删除报告（更新状态为 'hide'）
    const { error: deleteError } = await supabase
      .from('qiangua_report')
      .update({ Status: 'hide' })
      .eq('ReportId', reportId)
      .eq('UserId', user.id);

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

