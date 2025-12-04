/**
 * 获取笔记统计信息接口
 * GET /api/notes/stats
 * 
 * 查询参数（与 /api/notes 相同，用于应用相同的过滤条件）：
 * - brandKey: 品牌筛选键（格式：BrandId#KF#BrandName，可选）
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

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    // 获取查询参数（用于过滤条件）
    const searchParams = request.nextUrl.searchParams;
    const brandKey = searchParams.get('brandKey');
    const bloggerId = searchParams.get('bloggerId');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    // 解析 brandKey
    let brandId: string | null = null;
    let brandName: string | null = null;
    if (brandKey) {
      [brandId, brandName] = brandKey.split('#KF#');
    }

    // 创建 Supabase 客户端
    const supabase = createServerClient();

    // 辅助函数：应用过滤条件
    const applyFilters = (query: any) => {
      if (brandId) query = query.eq('BrandId', brandId);
      if (brandName) query = query.eq('BrandName', brandName);
      if (bloggerId) query = query.eq('BloggerId', bloggerId);
      if (startDate) query = query.gte('PubDate', startDate);
      if (endDate) query = query.lte('PubDate', endDate);
      return query;
    };

    // 辅助函数：获取去重计数
    const fetchDistinctCount = async (column: string) => {
      const uniqueValues = new Set<string>();
      let page = 0;
      const pageSize = 1000;
      
      while (true) {
        let query = supabase
          .from('qiangua_note_info')
          .select(column)
          .range(page * pageSize, (page + 1) * pageSize - 1);
        
        query = applyFilters(query);
        
        const { data, error } = await query;
        
        if (error) {
          console.error(`Error fetching distinct ${column}:`, error);
          break;
        }
        
        if (!data || data.length === 0) break;
        
        data.forEach((item: any) => {
          if (item[column]) uniqueValues.add(item[column]);
        });
        
        if (data.length < pageSize) break;
        page++;
      }
      return uniqueValues.size;
    };

    // 1. 获取笔记总数（应用过滤条件）
    let notesQuery = supabase
      .from('qiangua_note_info')
      .select('NoteId', { count: 'exact', head: true });
    
    notesQuery = applyFilters(notesQuery);

    const { count: totalNotes } = await notesQuery;

    // 2. 获取缺失内容的笔记数（XhsNoteLink 为空）
    let missingContentQuery = supabase
      .from('qiangua_note_info')
      .select('NoteId', { count: 'exact', head: true })
      .or('XhsNoteLink.is.null,XhsNoteLink.eq.');

    missingContentQuery = applyFilters(missingContentQuery);

    const { count: missingContent } = await missingContentQuery;

    // 3. 获取品牌数量
    const totalBrands = await fetchDistinctCount('BrandId');

    // 4. 获取达人数量
    const totalBloggers = await fetchDistinctCount('BloggerId');

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

