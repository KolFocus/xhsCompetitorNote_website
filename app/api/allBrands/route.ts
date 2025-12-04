/**
 * 获取所有品牌列表接口（新版）
 * GET /api/allBrands
 * 
 * 功能：从 qiangua_all_brands 视图返回所有品牌（不去重）
 * 
 * 响应格式：
 * {
 *   "success": true,
 *   "data": [
 *     { "BrandId": "...", "BrandIdKey": "...", "BrandName": "...", "DateCoverage": [...] },
 *     ...
 *   ]
 * }
 */

import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    // 创建 Supabase 客户端
    const supabase = createServerClient();

    // 查询所有品牌（从视图），按 BrandId 排序
    const { data, error } = await supabase
      .from('qiangua_all_brands')
      .select('BrandId, BrandIdKey, BrandName, DateCoverage')
      .order('BrandId', { ascending: true });

    if (error) {
      console.error('Error fetching all brands:', error);
      return NextResponse.json(
        {
          success: false,
          error: error.message || 'Failed to fetch all brands',
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data: data || [],
    });
  } catch (error: any) {
    console.error('Error in all brands API:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Internal server error',
      },
      { status: 500 }
    );
  }
}

