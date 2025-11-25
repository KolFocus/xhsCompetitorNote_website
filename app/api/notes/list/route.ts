/**
 * 基础笔记列表接口
 * GET /api/notes/list
 * 
 * 用于笔记列表页面（/dashboard/notes）
 * 
 * 查询参数：
 * - page: 页码（默认1）
 * - pageSize: 每页数量（默认20）
 * - brandKey: 品牌筛选键（格式：BrandId#KF#BrandName，可选）
 * - bloggerId: 博主ID（可选）
 * - startDate: 开始日期（可选，格式：YYYY-MM-DD）
 * - endDate: 结束日期（可选，格式：YYYY-MM-DD）
 * - orderBy: 排序字段（默认：PublishTime）
 * - order: 排序方向（asc/desc，默认：desc）
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  try {
    // 获取查询参数
    const searchParams = request.nextUrl.searchParams;
    const page = parseInt(searchParams.get('page') || '1', 10);
    const pageSize = parseInt(searchParams.get('pageSize') || '20', 10);
    const brandKey = searchParams.get('brandKey');
    const bloggerId = searchParams.get('bloggerId');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const orderBy = searchParams.get('orderBy') || 'PublishTime';
    const order = searchParams.get('order') || 'desc';

    // 验证分页参数
    if (page < 1 || pageSize < 1 || pageSize > 100) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid pagination parameters',
        },
        { status: 400 }
      );
    }

    // 创建 Supabase 客户端
    const supabase = createServerClient(request);

    // 构建查询
    let query = supabase
      .from('qiangua_note_info')
      .select(
        'NoteId, DateCode, Title, Content, CoverImage, NoteType, IsBusiness, IsAdNote, PublishTime, PubDate, LikedCount, CollectedCount, CommentsCount, ViewCount, ShareCount, BloggerId, BloggerNickName, BloggerProp, BigAvatar, SmallAvatar, BrandId, BrandIdKey, BrandName, VideoDuration, CurrentUserIsFavorite, Fans, AdPrice, OfficialVerified, XhsContent, XhsNoteLink, AiContentType, AiRelatedProducts, AiSummary, AiStatus, AiErr',
        { count: 'exact' }
      );

    // 应用过滤条件
    if (brandKey) {
      const [brandId, brandName] = brandKey.split('#KF#');
      query = query.eq('BrandId', brandId).eq('BrandName', brandName);
    }
    if (bloggerId) {
      query = query.eq('BloggerId', bloggerId);
    }
    if (startDate) {
      query = query.gte('PubDate', startDate);
    }
    if (endDate) {
      query = query.lte('PubDate', endDate);
    }

    // 应用排序
    const ascending = order === 'asc';
    query = query.order(orderBy, { ascending, nullsFirst: false });

    // 应用分页
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;
    query = query.range(from, to);

    // 执行查询
    const { data, error, count } = await query;

    if (error) {
      console.error('Error fetching notes:', error);
      return NextResponse.json(
        {
          success: false,
          error: error.message || 'Failed to fetch notes',
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        list: data || [],
        total: count || 0,
        page,
        pageSize,
      },
    });
  } catch (error: any) {
    console.error('Error in notes list API:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Internal server error',
      },
      { status: 500 }
    );
  }
}

