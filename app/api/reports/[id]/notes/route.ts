/**
 * 获取报告笔记列表接口
 * GET /api/reports/[id]/notes
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { parseKeywordFiltersFromParams, KEYWORD_SEARCH_COLUMNS } from '@/lib/utils/keywordSearch';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = createServerClient(request);

    // 获取当前用户
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const reportId = params.id;

    // 验证报告存在且属于当前用户（仅查询有效报告）
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

    // 获取查询参数
    const searchParams = request.nextUrl.searchParams;
    const page = parseInt(searchParams.get('page') || '1', 10);
    const pageSize = parseInt(searchParams.get('pageSize') || '20', 10);
    const status = searchParams.get('status') || 'active';
    const brandKey = searchParams.get('brandKey');
    const bloggerId = searchParams.get('bloggerId');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const search = searchParams.get('search');
    const keywordFilters = parseKeywordFiltersFromParams(searchParams);
    const hasKeywordFilters =
      keywordFilters.mustInclude.length > 0 ||
      keywordFilters.mustExclude.length > 0 ||
      keywordFilters.optional.length > 0;
    const orderBy = searchParams.get('orderBy') || 'PublishTime';
    const order = searchParams.get('order') || 'desc';

    // 验证分页参数
    if (page < 1 || pageSize < 1 || pageSize > 100) {
      return NextResponse.json(
        { success: false, error: 'Invalid pagination parameters' },
        { status: 400 }
      );
    }

    // 构建查询 - 从 qiangua_report_note_rel 开始，关联 qiangua_note_info
    // 注意：先查询所有符合条件的记录，然后在内存中筛选和分页
    let query = supabase
      .from('qiangua_report_note_rel')
      .select(`
        NoteId,
        Status,
        CreatedAt,
        qiangua_note_info (
          NoteId,
          Title,
          Content,
          XhsTitle,
          XhsContent,
          CoverImage,
          XhsNoteUrl,
          NoteType,
          IsBusiness,
          IsAdNote,
          PublishTime,
          PubDate,
          LikedCount,
          CollectedCount,
          CommentsCount,
          ViewCount,
          ShareCount,
          BloggerId,
          BloggerNickName,
          BigAvatar,
          SmallAvatar,
          BrandId,
          BrandIdKey,
          BrandName,
          VideoDuration,
          Fans,
          AdPrice,
          OfficialVerified,
          XhsNoteLink,
          XhsUserId,
          XhsNoteInvalid,
          AiContentType,
          AiRelatedProducts,
          AiSummary
        )
      `, { count: 'exact' })
      .eq('ReportId', reportId)
      .eq('Status', status);

    // 先查询所有符合条件的记录（不使用 range，因为需要在内存中筛选）
    const { data, error, count } = await query;

    if (error) {
      console.error('Error fetching report notes:', error);
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      );
    }

    // 解析 brandKey
    let brandId: string | null = null;
    let brandName: string | null = null;
    if (brandKey) {
      [brandId, brandName] = brandKey.split('#KF#');
    }

    const matchesKeywordFilters = (note: any) => {
      if (!hasKeywordFilters) {
        return true;
      }
      const texts = KEYWORD_SEARCH_COLUMNS.map((column) =>
        String(note[column] ?? '').toLowerCase(),
      );
      const includesTerm = (term: string) => {
        const lower = term.toLowerCase();
        if (!lower) {
          return true;
        }
        return texts.some((text) => text.includes(lower));
      };

      if (keywordFilters.mustInclude.some((term) => !includesTerm(term))) {
        return false;
      }
      if (keywordFilters.mustExclude.some((term) => includesTerm(term))) {
        return false;
      }
      if (
        keywordFilters.optional.length > 0 &&
        !keywordFilters.optional.some((term) => includesTerm(term))
      ) {
        return false;
      }
      return true;
    };

    // 处理数据格式
    const notes = (data || [])
      .map((item: any) => {
        const note = item.qiangua_note_info;
        if (!note) return null;

        // 应用筛选（在内存中，因为 Supabase 子查询限制）
        if (brandId && note.BrandId !== brandId) return null;
        if (brandName && note.BrandName !== brandName) return null;
        if (bloggerId && note.BloggerId !== bloggerId) return null;
        if (startDate && note.PubDate < startDate) return null;
        if (endDate && note.PubDate > endDate) return null;
        if (search) {
          const searchLower = search.toLowerCase();
          if (
            !note.Title?.toLowerCase().includes(searchLower) &&
            !note.BrandName?.toLowerCase().includes(searchLower)
          ) {
            return null;
          }
        }
        if (!matchesKeywordFilters(note)) {
          return null;
        }

        return {
          noteId: note.NoteId,
          title: note.Title,
          content: note.Content,
          xhsContent: note.XhsContent,
          coverImage: note.CoverImage,
          xhsNoteLink: note.XhsNoteLink ?? null,
          xhsNoteInvalid: note.XhsNoteInvalid ?? false,
          noteType: note.NoteType,
          isBusiness: note.IsBusiness,
          isAdNote: note.IsAdNote,
          publishTime: note.PublishTime,
          likedCount: note.LikedCount,
          collectedCount: note.CollectedCount,
          commentsCount: note.CommentsCount,
          viewCount: note.ViewCount,
          shareCount: note.ShareCount,
          fans: note.Fans ?? null,
          adPrice: note.AdPrice ?? null,
          bloggerId: note.BloggerId,
          bloggerNickName: note.BloggerNickName,
          bloggerSmallAvatar: note.SmallAvatar,
          bloggerBigAvatar: note.BigAvatar,
          xhsUserId: note.XhsUserId ?? null,
          officialVerified: note.OfficialVerified ?? null,
          brandId: note.BrandId,
          brandIdKey: note.BrandIdKey,
          brandName: note.BrandName,
          videoDuration: note.VideoDuration,
          status: item.Status,
          addedAt: item.CreatedAt,
          aiContentType: note.AiContentType ?? null,
          aiRelatedProducts: note.AiRelatedProducts ?? null,
          aiSummary: note.AiSummary ?? null,
        };
      })
      .filter((note: any) => note !== null);

    // 应用排序
    const fieldMap: Record<string, string> = {
      'publishtime': 'publishTime',
      'likedcount': 'likedCount',
      'viewcount': 'viewCount',
      'commentscount': 'commentsCount',
      'sharecount': 'shareCount',
      'fans': 'fans',
      'adprice': 'adPrice',
    };
    const mappedField = fieldMap[orderBy.toLowerCase()] || orderBy.toLowerCase();
    notes.sort((a: any, b: any) => {
      const aVal = a[mappedField] || 0;
      const bVal = b[mappedField] || 0;
      if (typeof aVal === 'string' && typeof bVal === 'string') {
        return order === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
      }
      return order === 'asc' ? aVal - bVal : bVal - aVal;
    });

    // 计算筛选后的总数
    const totalCount = notes.length;

    // 重新分页（因为筛选在内存中进行）
    const from = (page - 1) * pageSize;
    const to = from + pageSize;
    const paginatedNotes = notes.slice(from, to);

    return NextResponse.json({
      success: true,
      data: {
        list: paginatedNotes,
        total: totalCount, // 筛选后的总数
        page,
        pageSize,
      },
    });
  } catch (error: any) {
    console.error('Error in get report notes API:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

