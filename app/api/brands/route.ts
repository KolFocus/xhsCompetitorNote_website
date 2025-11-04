/**
 * 获取品牌列表接口
 * GET /api/brands
 * 
 * 功能：返回所有品牌，按创建时间升序排序
 * 
 * 响应格式：
 * {
 *   "success": true,
 *   "data": [
 *     { "BrandId": "...", "BrandName": "..." },
 *     ...
 *   ]
 * }
 */

import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';

export async function GET() {
  try {
    // 创建 Supabase 客户端
    const supabase = createServerClient();

    // 查询所有品牌，按 CreatedAt 升序排序（NULL 值排在最后）
    const { data, error } = await supabase
      .from('qiangua_brand')
      .select('BrandId, BrandName')
      .order('CreatedAt', { ascending: true, nullsFirst: false });

    if (error) {
      console.error('Error fetching brands:', error);
      return NextResponse.json(
        {
          success: false,
          error: error.message || 'Failed to fetch brands',
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data: data || [],
    });
  } catch (error: any) {
    console.error('Error in brands API:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Internal server error',
      },
      { status: 500 }
    );
  }
}

