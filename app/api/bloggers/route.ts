/**
 * 获取博主列表接口
 * GET /api/bloggers
 * 
 * 功能：返回所有博主，按创建时间升序排序
 * 
 * 响应格式：
 * {
 *   "success": true,
 *   "data": [
 *     { "BloggerId": "...", "BloggerNickName": "..." },
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

    // 查询所有博主，按 CreatedAt 升序排序（NULL 值排在最后）
    const { data, error } = await supabase
      .from('qiangua_blogger')
      .select('BloggerId, BloggerNickName')
      .order('CreatedAt', { ascending: true, nullsFirst: false });

    if (error) {
      console.error('Error fetching bloggers:', error);
      return NextResponse.json(
        {
          success: false,
          error: error.message || 'Failed to fetch bloggers',
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data: data || [],
    });
  } catch (error: any) {
    console.error('Error in bloggers API:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Internal server error',
      },
      { status: 500 }
    );
  }
}

