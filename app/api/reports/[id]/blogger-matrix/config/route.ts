/**
 * 达人矩阵配置接口
 * GET /api/reports/[id]/blogger-matrix/config - 获取配置
 * POST /api/reports/[id]/blogger-matrix/config - 保存配置
 * DELETE /api/reports/[id]/blogger-matrix/config - 删除配置
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';

// 默认配置
const DEFAULT_CONFIG = {
  customLevels: [
    {
      levelName: '头部达人',
      minFans: 500000, // 50万
      maxFans: null,
    },
    {
      levelName: '腰部达人',
      minFans: 100000, // 10万
      maxFans: 500000, // 50万
    },
    {
      levelName: '初级达人',
      minFans: 10000, // 1万
      maxFans: 100000, // 10万
    },
    {
      levelName: '新手达人',
      minFans: 0,
      maxFans: 10000, // 1万
    },
  ],
};

// 验证配置
function validateConfig(customLevels: any[]): string | null {
  if (!Array.isArray(customLevels) || customLevels.length === 0) {
    return '至少需要1个自定义层级';
  }
  if (customLevels.length > 10) {
    return '最多支持10个自定义层级';
  }

  const levelNames = new Set<string>();
  const ranges: Array<{ min: number; max: number | null }> = [];

  for (const level of customLevels) {
    // 验证层级名称
    if (!level.levelName || typeof level.levelName !== 'string') {
      return '层级名称不能为空';
    }
    const levelName = level.levelName.trim();
    if (levelName.length === 0 || levelName.length > 20) {
      return '层级名称长度必须在1-20个字符之间';
    }
    if (levelNames.has(levelName)) {
      return `层级名称"${levelName}"已存在，请使用其他名称`;
    }
    levelNames.add(levelName);

    // 验证粉丝数范围
    if (typeof level.minFans !== 'number' || level.minFans < 0) {
      return '最小粉丝数必须大于等于0';
    }
    if (level.maxFans !== null && (typeof level.maxFans !== 'number' || level.maxFans <= level.minFans)) {
      return '最大值必须大于最小值';
    }
    ranges.push({ min: level.minFans, max: level.maxFans });
  }

  // 验证范围不重叠
  for (let i = 0; i < ranges.length; i++) {
    for (let j = i + 1; j < ranges.length; j++) {
      const range1 = ranges[i];
      const range2 = ranges[j];
      if (rangesOverlap(range1.min, range1.max, range2.min, range2.max)) {
        return '粉丝数范围与其他层级重叠，请调整';
      }
    }
  }

  // 验证范围连续性
  const sortedRanges = [...ranges].sort((a, b) => a.min - b.min);
  if (sortedRanges[0].min !== 0) {
    return '层级之间不能留空，请确保所有粉丝数范围连续覆盖（从0开始）';
  }
  for (let i = 0; i < sortedRanges.length - 1; i++) {
    const current = sortedRanges[i];
    const next = sortedRanges[i + 1];
    if (current.max === null) {
      return '不能有多个无上限的层级';
    }
    if (current.max !== next.min) {
      return '层级之间不能留空，请确保所有粉丝数范围连续覆盖';
    }
  }

  return null;
}

// 检查范围是否重叠
function rangesOverlap(
  min1: number,
  max1: number | null,
  min2: number,
  max2: number | null
): boolean {
  if (max1 === null && max2 === null) {
    return true; // 两个都是无上限，重叠
  }
  if (max1 === null) {
    return min1 <= max2!; // 第一个无上限
  }
  if (max2 === null) {
    return min2 <= max1; // 第二个无上限
  }
  return !(max1 <= min2 || max2 <= min1); // 有重叠
}

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

    // 验证报告存在且属于当前用户
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

    // 查询配置：从 qiangua_report.CustomLevels 读取
    const { data: reportRow, error: reportError2 } = await supabase
      .from('qiangua_report')
      .select('ReportId, CustomLevels')
      .eq('ReportId', reportId)
      .single();

    if (reportError2 && reportError2.code !== 'PGRST116') {
      console.error('Error fetching report custom levels:', reportError2);
      return NextResponse.json(
        { success: false, error: reportError2.message },
        { status: 500 }
      );
    }

    // 如果配置不存在，返回null，前端使用默认配置
    if (!reportRow || !reportRow.CustomLevels) {
      return NextResponse.json({
        success: true,
        data: null,
      });
    }

    return NextResponse.json({
      success: true,
      data: {
        reportId: reportRow.ReportId,
        customLevels: reportRow.CustomLevels,
      },
    });
  } catch (error: any) {
    console.error('Error in get blogger matrix config API:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

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

    // 验证报告存在且属于当前用户
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

    // 解析请求体
    const body = await request.json();
    const { customLevels } = body;

    // 验证配置
    const validationError = validateConfig(customLevels);
    if (validationError) {
      return NextResponse.json(
        { success: false, error: validationError },
        { status: 400 }
      );
    }

    // 为每个层级生成 levelId（如果不存在）
    const levelsWithId = customLevels.map((level: any, index: number) => ({
      ...level,
      levelId: level.levelId || String(index + 1),
    }));

    // 保存配置到 qiangua_report.CustomLevels
    const { data: updatedRow, error: saveError } = await supabase
      .from('qiangua_report')
      .update({ CustomLevels: levelsWithId })
      .eq('ReportId', reportId)
      .select('ReportId, CustomLevels')
      .single();

    if (saveError) {
      console.error('Error saving config:', saveError);
      return NextResponse.json(
        { success: false, error: saveError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        reportId: updatedRow.ReportId,
        customLevels: updatedRow.CustomLevels,
      },
    });
  } catch (error: any) {
    console.error('Error in save blogger matrix config API:', error);
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

    // 验证报告存在且属于当前用户
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

    // 删除配置：将 qiangua_report.CustomLevels 置空
    const { error: deleteError } = await supabase
      .from('qiangua_report')
      .update({ CustomLevels: null })
      .eq('ReportId', reportId);

    if (deleteError) {
      console.error('Error deleting config:', deleteError);
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
    console.error('Error in delete blogger matrix config API:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

