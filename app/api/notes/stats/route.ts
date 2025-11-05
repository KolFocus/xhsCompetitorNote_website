/**
 * 获取笔记统计信息接口
 * GET /api/notes/stats
 * 
 * 查询参数（与 /api/notes 相同，用于应用相同的过滤条件）：
 * - brandId: 品牌ID（可选）
 * - bloggerId: 博主ID（可选）
 * - startDate: 开始日期（可选，格式：YYYY-MM-DD）
 * - endDate: 结束日期（可选，格式：YYYY-MM-DD）
 * 
 * 响应格式：
 * {
 *   "success": true,
 *   "data": {
 *     "totalNotes": 100,
 *     "totalBrands": 45,
 *     "totalBloggers": 23,
 *     "missingContent": 15
 *   }
 * }
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  try {
    // 获取查询参数（用于过滤条件）
    const searchParams = request.nextUrl.searchParams;
    const brandId = searchParams.get('brandId');
    const bloggerId = searchParams.get('bloggerId');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    // 创建 Supabase 客户端
    const supabase = createServerClient();

    // 1. 获取笔记总数（应用过滤条件）
    let notesQuery = supabase
      .from('qiangua_note_info')
      .select('NoteId', { count: 'exact', head: true });

    if (brandId) {
      notesQuery = notesQuery.eq('BrandId', brandId);
    }
    if (bloggerId) {
      notesQuery = notesQuery.eq('BloggerId', bloggerId);
    }
    if (startDate) {
      notesQuery = notesQuery.gte('PubDate', startDate);
    }
    if (endDate) {
      notesQuery = notesQuery.lte('PubDate', endDate);
    }

    const { count: totalNotes } = await notesQuery;

    // 2. 获取缺失内容的笔记数（Content 为 null 或空字符串）
    let missingContentQuery = supabase
      .from('qiangua_note_info')
      .select('NoteId', { count: 'exact', head: true })
      .is('Content', null);

    if (brandId) {
      missingContentQuery = missingContentQuery.eq('BrandId', brandId);
    }
    if (bloggerId) {
      missingContentQuery = missingContentQuery.eq('BloggerId', bloggerId);
    }
    if (startDate) {
      missingContentQuery = missingContentQuery.gte('PubDate', startDate);
    }
    if (endDate) {
      missingContentQuery = missingContentQuery.lte('PubDate', endDate);
    }

    const { count: missingContent } = await missingContentQuery;

    // 3. 获取品牌数量（应用过滤条件，获取不重复的品牌）
    let brandsQuery = supabase
      .from('qiangua_note_info')
      .select('BrandId');

    if (brandId) {
      brandsQuery = brandsQuery.eq('BrandId', brandId);
    }
    if (bloggerId) {
      brandsQuery = brandsQuery.eq('BloggerId', bloggerId);
    }
    if (startDate) {
      brandsQuery = brandsQuery.gte('PubDate', startDate);
    }
    if (endDate) {
      brandsQuery = brandsQuery.lte('PubDate', endDate);
    }

    const { data: brandsData } = await brandsQuery;
    
    // 计算不重复的品牌数量
    const totalBrands = brandsData
      ? new Set(brandsData.filter((item: any) => item.BrandId).map((item: any) => item.BrandId)).size
      : 0;

    // 4. 获取达人数量（应用过滤条件，获取不重复的达人）
    let bloggersQuery = supabase
      .from('qiangua_note_info')
      .select('BloggerId');

    if (brandId) {
      bloggersQuery = bloggersQuery.eq('BrandId', brandId);
    }
    if (bloggerId) {
      bloggersQuery = bloggersQuery.eq('BloggerId', bloggerId);
    }
    if (startDate) {
      bloggersQuery = bloggersQuery.gte('PubDate', startDate);
    }
    if (endDate) {
      bloggersQuery = bloggersQuery.lte('PubDate', endDate);
    }

    const { data: bloggersData } = await bloggersQuery;
    
    // 计算不重复的达人数量
    const totalBloggers = bloggersData
      ? new Set(bloggersData.map((item: any) => item.BloggerId)).size
      : 0;

    return NextResponse.json({
      success: true,
      data: {
        totalNotes: totalNotes || 0,
        totalBrands,
        totalBloggers,
        missingContent: missingContent || 0,
      },
    });
  } catch (error: any) {
    console.error('Error in notes stats API:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Internal server error',
      },
      { status: 500 }
    );
  }
}

