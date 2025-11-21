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
 * - tagSetId: 标签系列ID（可选，用于标签筛选）
 * - tagFilter: 标签筛选（可选，'__untagged__' 表示未打标，具体tagId表示有该标签）
 * - showUnanalyzed: 是否只显示未AI分析的笔记（可选，'true'/'false'）
 * - showMissingContent: 是否只显示缺失内容的笔记（可选，'true'/'false'）
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
    const aiStatus = searchParams.get('aiStatus'); // 新增：AI状态筛选
    const tagSetId = searchParams.get('tagSetId'); // 标签系列ID
    const tagFilter = searchParams.get('tagFilter'); // 标签筛选
    const showUnanalyzed = searchParams.get('showUnanalyzed') === 'true'; // 只显示未分析
    const showMissingContent = searchParams.get('showMissingContent') === 'true'; // 只显示缺失内容

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

    // 处理标签筛选：获取需要排除或包含的笔记ID
    let tagFilteredNoteIds: string[] | null = null;
    let shouldExcludeTaggedNotes = false;
    
    if (tagSetId && tagFilter) {
      console.log('[Tag Filter] TagSetId:', tagSetId, 'TagFilter:', tagFilter);
      
      if (tagFilter === '__untagged__') {
        // 获取该标签系列下所有已打标的笔记ID
        // 先获取该标签系列下的所有标签ID
        const { data: tagsInSet, error: tagsErr } = await supabase
          .from('qiangua_tag')
          .select('TagId')
          .eq('TagSetId', tagSetId);
        
        if (tagsErr) {
          console.error('[Tag Filter] Error fetching tags:', tagsErr);
        }
        
        console.log('[Tag Filter] Tags in set:', tagsInSet?.length || 0);
        
        if (tagsInSet && tagsInSet.length > 0) {
          const tagIds = tagsInSet.map(t => t.TagId);
          
          // 对于"未打标"筛选，我们需要获取已打标的笔记ID
          // 但为了避免一次性获取太多，我们使用特殊标记
          // 稍后在查询时使用内存过滤
          tagFilteredNoteIds = tagIds; // 临时存储标签ID
          shouldExcludeTaggedNotes = true;
          console.log('[Tag Filter] Will EXCLUDE notes with', tagIds.length, 'tags');
        }
      } else {
        // 获取有该标签的笔记ID（获取所有，不分页）
        const allTaggedNotes: string[] = [];
        let tagPage = 0;
        const tagBatchSize = 1000;
        
        while (tagPage < 20) { // 最多20批，即20000条
          const { data: taggedNotes, error: taggedErr } = await supabase
            .from('qiangua_note_tag')
            .select('NoteId')
            .eq('TagId', tagFilter)
            .range(tagPage * tagBatchSize, (tagPage + 1) * tagBatchSize - 1);
          
          if (taggedErr) {
            console.error('[Tag Filter] Error fetching notes with tag batch', tagPage, ':', taggedErr);
            break;
          }
          
          if (!taggedNotes || taggedNotes.length === 0) {
            break;
          }
          
          allTaggedNotes.push(...taggedNotes.map(item => item.NoteId));
          
          if (taggedNotes.length < tagBatchSize) {
            break;
          }
          
          tagPage++;
        }
        
        console.log('[Tag Filter] Notes with specific tag:', allTaggedNotes.length);
        
        if (allTaggedNotes.length > 0) {
          tagFilteredNoteIds = [...new Set(allTaggedNotes)]; // 去重
          shouldExcludeTaggedNotes = false;
          console.log('[Tag Filter] Will INCLUDE', tagFilteredNoteIds.length, 'unique notes');
        } else {
          // 如果没有笔记有该标签，直接返回空结果
          console.log('[Tag Filter] No notes with this tag, returning empty');
          return NextResponse.json({
            success: true,
            data: {
              list: [],
              total: 0,
              page,
              pageSize,
              noteTags: {},
            },
          });
        }
      }
    }

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

      let noteIds = (reportNotes || []).map((item) => item.NoteId);
      console.log('[Tag Filter - With ReportId] Initial note count:', noteIds.length);
      
      // 应用标签筛选到 noteIds
      if (tagFilteredNoteIds !== null) {
        if (shouldExcludeTaggedNotes) {
          // 排除已打标的笔记
          const beforeCount = noteIds.length;
          noteIds = noteIds.filter(id => !tagFilteredNoteIds.includes(id));
          console.log('[Tag Filter - With ReportId] Excluded', beforeCount - noteIds.length, 'tagged notes, remaining:', noteIds.length);
        } else {
          // 只包含有指定标签的笔记
          const beforeCount = noteIds.length;
          noteIds = noteIds.filter(id => tagFilteredNoteIds.includes(id));
          console.log('[Tag Filter - With ReportId] Filtered to', noteIds.length, 'notes with specific tag (from', beforeCount, ')');
        }
      }
      
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
          'NoteId, DateCode, Title, Content, CoverImage, NoteType, IsBusiness, IsAdNote, PublishTime, PubDate, LikedCount, CollectedCount, CommentsCount, ViewCount, ShareCount, BloggerId, BloggerNickName, BloggerProp, BigAvatar, SmallAvatar, BrandId, BrandIdKey, BrandName, VideoDuration, CurrentUserIsFavorite, Fans, AdPrice, OfficialVerified, XhsContent, XhsNoteLink, AiContentType, AiRelatedProducts, AiSummary, AiStatus, AiErr',
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
      if (aiStatus) {
        query = query.eq('AiStatus', aiStatus);
      }

      // 应用未分析筛选
      if (showUnanalyzed) {
        query = query
          .is('AiContentType', null)
          .is('AiRelatedProducts', null)
          .is('AiSummary', null)
          .neq('AiStatus', '分析中');
      }

      // 应用缺失内容筛选
      if (showMissingContent) {
        query = query
          .or('Content.is.null,Content.eq.')
          .or('XhsContent.is.null,XhsContent.eq.');
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

      // 批量查询笔记标签（如果提供了 tagSetId）
      const noteTags: Record<string, any[]> = {};
      if (tagSetId && data && data.length > 0) {
        console.log('[NoteTags - With ReportId] Fetching tags for', data.length, 'notes, tagSetId:', tagSetId);
        const noteIds = data.map((note: any) => note.NoteId);
        
        // 获取该标签系列下的所有标签ID
        const { data: tagsInSet, error: tagsError } = await supabase
          .from('qiangua_tag')
          .select('TagId, TagName, TagSetId')
          .eq('TagSetId', tagSetId);
        
        if (tagsError) {
          console.error('[NoteTags - With ReportId] Error fetching tags:', tagsError);
        }
        
        console.log('[NoteTags - With ReportId] Found', tagsInSet?.length || 0, 'tags in set');
        
        if (tagsInSet && tagsInSet.length > 0) {
          const tagIds = tagsInSet.map(t => t.TagId);
          const tagMap = new Map(tagsInSet.map(t => [t.TagId, t]));
          
          // 批量查询这些笔记的标签关联
          const { data: noteTagRelations, error: relError } = await supabase
            .from('qiangua_note_tag')
            .select('NoteId, TagId')
            .in('NoteId', noteIds)
            .in('TagId', tagIds);
          
          if (relError) {
            console.error('[NoteTags - With ReportId] Error fetching note tag relations:', relError);
          }
          
          console.log('[NoteTags - With ReportId] Found', noteTagRelations?.length || 0, 'tag relations');
          
          // 组织数据
          if (noteTagRelations) {
            for (const rel of noteTagRelations) {
              if (!noteTags[rel.NoteId]) {
                noteTags[rel.NoteId] = [];
              }
              const tag = tagMap.get(rel.TagId);
              if (tag) {
                noteTags[rel.NoteId].push({
                  tagId: tag.TagId,
                  tagName: tag.TagName,
                });
              }
            }
          }
          console.log('[NoteTags - With ReportId] Built noteTags map with', Object.keys(noteTags).length, 'notes');
        }
      }

      return NextResponse.json({
        success: true,
        data: {
          list: data || [],
          total: count || 0,
          page,
          pageSize,
          noteTags,
        },
      });
    } else {
      // 没有 reportId 时的原有逻辑
      // 构建查询
      let query = supabase
        .from('qiangua_note_info')
        .select(
          'NoteId, DateCode, Title, Content, CoverImage, NoteType, IsBusiness, IsAdNote, PublishTime, PubDate, LikedCount, CollectedCount, CommentsCount, ViewCount, ShareCount, BloggerId, BloggerNickName, BloggerProp, BigAvatar, SmallAvatar, BrandId, BrandIdKey, BrandName, VideoDuration, CurrentUserIsFavorite, Fans, AdPrice, OfficialVerified, XhsContent, XhsNoteLink, AiContentType, AiRelatedProducts, AiSummary, AiStatus, AiErr',
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
      if (aiStatus) {
        query = query.eq('AiStatus', aiStatus);
      }

      // 对于"未打标"筛选（shouldExcludeTaggedNotes = true），使用数据库函数（LEFT JOIN）
      if (shouldExcludeTaggedNotes && tagFilteredNoteIds !== null && tagFilteredNoteIds.length > 0) {
        // tagFilteredNoteIds 现在存储的是标签ID（但我们不需要了，直接用 tagSetId）
        console.log('[Tag Filter - No ReportId] Using database function for untagged notes, tagSetId:', tagSetId);
        
        // 调用数据库函数获取数据
        const { data: notes, error: notesError } = await supabase.rpc(
          'get_untagged_notes_with_filters',
          {
            p_tag_set_id: tagSetId,
            p_page: page,
            p_page_size: pageSize,
            p_brand_id: brandId || null,
            p_blogger_id: bloggerId || null,
            p_start_date: startDate || null,
            p_end_date: endDate || null,
            p_ai_status: aiStatus || null,
            p_order_by: orderBy,
            p_order_dir: order,
            p_show_unanalyzed: showUnanalyzed,
            p_show_missing_content: showMissingContent,
          }
        );
        
        if (notesError) {
          console.error('[Tag Filter - No ReportId] RPC error:', notesError);
          return NextResponse.json(
            {
              success: false,
              error: notesError.message || 'Failed to fetch untagged notes',
            },
            { status: 500 }
          );
        }
        
        // 调用数据库函数获取总数
        const { data: totalCount, error: countError } = await supabase.rpc(
          'count_untagged_notes_with_filters',
          {
            p_tag_set_id: tagSetId,
            p_brand_id: brandId || null,
            p_blogger_id: bloggerId || null,
            p_start_date: startDate || null,
            p_end_date: endDate || null,
            p_ai_status: aiStatus || null,
            p_show_unanalyzed: showUnanalyzed,
            p_show_missing_content: showMissingContent,
          }
        );
        
        if (countError) {
          console.error('[Tag Filter - No ReportId] Count RPC error:', countError);
        }
        
        console.log('[Tag Filter - No ReportId] Result:', notes?.length || 0, 'notes, total:', totalCount);
        
        // 查询标签数据（未打标的笔记理论上不应该有标签，但保持一致性）
        const noteTags: Record<string, any[]> = {};
        
        return NextResponse.json({
          success: true,
          data: {
            list: notes || [],
            total: totalCount || 0,
            page,
            pageSize,
            noteTags,
          },
        });
      }
      
      // 对于"特定标签"筛选
      if (tagFilteredNoteIds !== null && tagFilteredNoteIds.length > 0) {
        if (!shouldExcludeTaggedNotes) {
          // 这里 tagFilteredNoteIds 应该是笔记ID（需要在前面修复）
          console.log('[Tag Filter - No ReportId] Including only notes with specific tag');
          query = query.in('NoteId', tagFilteredNoteIds);
        }
      } else if (tagFilteredNoteIds !== null && tagFilteredNoteIds.length === 0 && !shouldExcludeTaggedNotes) {
        // 如果要筛选指定标签但没有笔记有该标签，返回空结果
        console.log('[Tag Filter - No ReportId] No notes with tag, returning empty');
        return NextResponse.json({
          success: true,
          data: {
            list: [],
            total: 0,
            page,
            pageSize,
            noteTags: {},
          },
        });
      }

      // 应用未分析筛选
      if (showUnanalyzed) {
        query = query
          .is('AiContentType', null)
          .is('AiRelatedProducts', null)
          .is('AiSummary', null)
          .neq('AiStatus', '分析中');
      }

      // 应用缺失内容筛选
      if (showMissingContent) {
        query = query
          .or('Content.is.null,Content.eq.')
          .or('XhsContent.is.null,XhsContent.eq.');
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

      // 批量查询笔记标签（如果提供了 tagSetId）
      const noteTags: Record<string, any[]> = {};
      if (tagSetId && data && data.length > 0) {
        console.log('[NoteTags - No ReportId] Fetching tags for', data.length, 'notes, tagSetId:', tagSetId);
        const noteIds = data.map((note: any) => note.NoteId);
        
        // 获取该标签系列下的所有标签ID
        const { data: tagsInSet, error: tagsError } = await supabase
          .from('qiangua_tag')
          .select('TagId, TagName, TagSetId')
          .eq('TagSetId', tagSetId);
        
        if (tagsError) {
          console.error('[NoteTags - No ReportId] Error fetching tags:', tagsError);
        }
        
        console.log('[NoteTags - No ReportId] Found', tagsInSet?.length || 0, 'tags in set');
        
        if (tagsInSet && tagsInSet.length > 0) {
          const tagIds = tagsInSet.map(t => t.TagId);
          const tagMap = new Map(tagsInSet.map(t => [t.TagId, t]));
          
          // 批量查询这些笔记的标签关联
          const { data: noteTagRelations, error: relError } = await supabase
            .from('qiangua_note_tag')
            .select('NoteId, TagId')
            .in('NoteId', noteIds)
            .in('TagId', tagIds);
          
          if (relError) {
            console.error('[NoteTags - No ReportId] Error fetching note tag relations:', relError);
          }
          
          console.log('[NoteTags - No ReportId] Found', noteTagRelations?.length || 0, 'tag relations');
          
          // 组织数据
          if (noteTagRelations) {
            for (const rel of noteTagRelations) {
              if (!noteTags[rel.NoteId]) {
                noteTags[rel.NoteId] = [];
              }
              const tag = tagMap.get(rel.TagId);
              if (tag) {
                noteTags[rel.NoteId].push({
                  tagId: tag.TagId,
                  tagName: tag.TagName,
                });
              }
            }
          }
          console.log('[NoteTags - No ReportId] Built noteTags map with', Object.keys(noteTags).length, 'notes');
        }
      }

      return NextResponse.json({
        success: true,
        data: {
          list: data || [],
          total: count || 0,
          page,
          pageSize,
          noteTags,
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

