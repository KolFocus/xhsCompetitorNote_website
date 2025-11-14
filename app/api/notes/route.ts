/**
 * 获取笔记列表接口
 * GET /api/notes
 * 
 * 查询参数：
 * - page: 页码（默认1）
 * - pageSize: 每页数量（默认20）
 * - reportId: 报告ID（可选，如果提供则只返回该报告中的笔记）
 * - brandId: 品牌ID（可选）
 * - bloggerId: 博主ID（可选）
 * - startDate: 开始日期（可选，格式：YYYY-MM-DD）
 * - endDate: 结束日期（可选，格式：YYYY-MM-DD）
 * - orderBy: 排序字段（默认：PublishTime）
 * - order: 排序方向（asc/desc，默认：desc）
 * 
 * 响应格式：
 * {
 *   "success": true,
 *   "data": {
 *     "list": [...],
 *     "total": 100,
 *     "page": 1,
 *     "pageSize": 20
 *   }
 * }
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  try {
    // 获取查询参数
    const searchParams = request.nextUrl.searchParams;
    const page = parseInt(searchParams.get('page') || '1', 10);
    const pageSize = parseInt(searchParams.get('pageSize') || '20', 10);
    const reportId = searchParams.get('reportId');
    const brandId = searchParams.get('brandId');
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

    // 如果提供了 reportId，需要验证报告存在且属于当前用户
    if (reportId) {
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) {
        return NextResponse.json(
          { success: false, error: 'Unauthorized' },
          { status: 401 }
        );
      }

      // 验证报告存在且属于当前用户
      const { data: report } = await supabase
        .from('qiangua_report')
        .select('ReportId')
        .eq('ReportId', reportId)
        .eq('UserId', user.id)
        .eq('Status', 'active')
        .single();

      if (!report) {
        return NextResponse.json(
          { success: false, error: '报告不存在或无权访问' },
          { status: 404 }
        );
      }

      // 从报告关联表中获取笔记ID列表
      const { data: reportNotes, error: reportNotesError } = await supabase
        .from('qiangua_report_note_rel')
        .select('NoteId')
        .eq('ReportId', reportId)
        .eq('Status', 'active');

      if (reportNotesError) {
        console.error('Error fetching report notes:', reportNotesError);
        return NextResponse.json(
          {
            success: false,
            error: reportNotesError.message || 'Failed to fetch report notes',
          },
          { status: 500 }
        );
      }

      const noteIds = (reportNotes || []).map((item) => item.NoteId);
      
      if (noteIds.length === 0) {
        return NextResponse.json({
          success: true,
          data: {
            list: [],
            total: 0,
            page,
            pageSize,
          },
        });
      }

      // 构建查询，限制在报告笔记范围内
      let query = supabase
        .from('qiangua_note_info')
        .select(
          'NoteId, DateCode, Title, Content, CoverImage, NoteType, IsBusiness, IsAdNote, PublishTime, PubDate, LikedCount, CollectedCount, CommentsCount, ViewCount, ShareCount, BloggerId, BloggerNickName, BloggerProp, BigAvatar, SmallAvatar, BrandId, BrandIdKey, BrandName, VideoDuration, CurrentUserIsFavorite, Fans, AdPrice, OfficialVerified, XhsContent, XhsNoteLink, AiContentType, AiRelatedProducts, AiSummary',
          { count: 'exact' }
        )
        .in('NoteId', noteIds);

      // 应用其他过滤条件
      if (brandId) {
        query = query.eq('BrandId', brandId);
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
    } else {
      // 没有 reportId 时的原有逻辑
      // 构建查询
      let query = supabase
        .from('qiangua_note_info')
        .select(
          'NoteId, DateCode, Title, Content, CoverImage, NoteType, IsBusiness, IsAdNote, PublishTime, PubDate, LikedCount, CollectedCount, CommentsCount, ViewCount, ShareCount, BloggerId, BloggerNickName, BloggerProp, BigAvatar, SmallAvatar, BrandId, BrandIdKey, BrandName, VideoDuration, CurrentUserIsFavorite, Fans, AdPrice, OfficialVerified, XhsContent, XhsNoteLink, AiContentType, AiRelatedProducts, AiSummary',
          { count: 'exact' }
        );

      // 应用过滤条件
      if (brandId) {
        query = query.eq('BrandId', brandId);
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
    }
  } catch (error: any) {
    console.error('Error in notes API:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Internal server error',
      },
      { status: 500 }
    );
  }
}

