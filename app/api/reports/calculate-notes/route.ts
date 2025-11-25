/**
 * 计算笔记数量接口
 * POST /api/reports/calculate-notes
 * 用于创建报告对话框的动态计算
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { queryPg } from '@/lib/postgres';

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
    const { brandKeys, startDate, endDate } = body;

    // 验证参数
    if (!brandKeys || !Array.isArray(brandKeys) || brandKeys.length === 0) {
      return NextResponse.json({
        success: true,
        data: { totalCount: 0 },
      });
    }

    // 解析 brandKeys 为 (BrandId, BrandName) 对
    const brandPairs = brandKeys.map((key: string) => {
      const [brandId, brandName] = key.split('#KF#');
      return { brandId, brandName };
    });

    // 构建品牌筛选条件（OR条件）
    const brandConditions = brandPairs.map((_: any, index: number) => {
      const baseIdx = index * 2 + 1;
      return `("BrandId" = $${baseIdx} AND "BrandName" = $${baseIdx + 1})`;
    }).join(' OR ');

    const brandParams = brandPairs.flatMap((pair: any) => [pair.brandId, pair.brandName]);

    // 构建完整SQL查询
    const conditions = [brandConditions];
    const queryParams = [...brandParams];
    let paramIndex = brandParams.length + 1;

    if (startDate) {
      conditions.push(`"PubDate" >= $${paramIndex}::date`);
      queryParams.push(startDate);
      paramIndex++;
    }
    if (endDate) {
      conditions.push(`"PubDate" <= $${paramIndex}::date`);
      queryParams.push(endDate);
      paramIndex++;
    }

    const sql = `
      SELECT COUNT(*) as count
      FROM qiangua_note_info
      WHERE ${conditions.join(' AND ')}
    `;

    const result = await queryPg(sql, queryParams);
    const count = result && result.length > 0 ? parseInt(result[0].count) : 0;

    return NextResponse.json({
      success: true,
      data: {
        totalCount: count,
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

