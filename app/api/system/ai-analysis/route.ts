/**
 * AI分析笔记查询接口
 * GET /api/system/ai-analysis
 * 
 * 用于AI分析页面（/dashboard/system/ai-analysis）
 * 
 * 查询参数：
 * - page: 页码（默认1）
 * - pageSize: 每页数量（默认20，最大100）
 * - aiStatus: AI状态筛选（必需，如：'分析失败'、'无内容'）
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  try {
    // 获取查询参数
    const searchParams = request.nextUrl.searchParams;
    const page = parseInt(searchParams.get('page') || '1', 10);
    const pageSize = parseInt(searchParams.get('pageSize') || '20', 10);
    const aiStatus = searchParams.get('aiStatus');

    // 验证必需参数
    if (!aiStatus) {
      return NextResponse.json(
        {
          success: false,
          error: 'aiStatus is required',
        },
        { status: 400 }
      );
    }

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
      )
      .eq('AiStatus', aiStatus);

    // 应用排序（默认按发布时间降序）
    query = query.order('PublishTime', { ascending: false, nullsFirst: false });

    // 应用分页
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;
    query = query.range(from, to);

    // 执行查询
    const { data, error, count } = await query;

    if (error) {
      console.error('Error fetching AI analysis notes:', error);
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
    console.error('Error in AI analysis notes API:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Internal server error',
      },
      { status: 500 }
    );
  }
}

