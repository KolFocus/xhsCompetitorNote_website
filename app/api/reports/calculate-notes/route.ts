/**
 * 计算笔记数量接口
 * POST /api/reports/calculate-notes
 * 用于创建报告对话框的动态计算
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';

export async function POST(request: NextRequest) {
  try {
    const supabase = createServerClient(request);
    
    // 获取当前用户（验证认证）
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { brandIds, startDate, endDate } = body;

    // 验证参数
    if (!brandIds || !Array.isArray(brandIds) || brandIds.length === 0) {
      return NextResponse.json({
        success: true,
        data: { totalCount: 0 },
      });
    }

    // 构建查询
    let query = supabase
      .from('qiangua_note_info')
      .select('NoteId', { count: 'exact', head: true })
      .in('BrandId', brandIds);

    if (startDate) {
      query = query.gte('PubDate', startDate);
    }
    if (endDate) {
      query = query.lte('PubDate', endDate);
    }

    const { count, error } = await query;

    if (error) {
      console.error('Error calculating notes:', error);
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        totalCount: count || 0,
      },
    });
  } catch (error: any) {
    console.error('Error in calculate notes API:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

