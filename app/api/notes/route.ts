/**
 * 获取笔记列表接口
 * GET /api/notes
 * 
 * 查询参数：
 * - page: 页码（默认1）
 * - pageSize: 每页数量（默认20）
 * - reportId: 报告ID（可选，如果提供则只返回该报告中的笔记）
 * - brandKey: 品牌筛选键（格式：BrandId#KF#BrandName，可选）
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
import { queryPg } from '@/lib/postgres';

export async function GET(request: NextRequest) {
  try {
    // 获取查询参数
    const searchParams = request.nextUrl.searchParams;
    const page = parseInt(searchParams.get('page') || '1', 10);
    const pageSize = parseInt(searchParams.get('pageSize') || '20', 10);
    const reportId = searchParams.get('reportId');
    const brandKey = searchParams.get('brandKey');
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

    // 使用统一的处理函数（不考虑报告权限验证）
    return await handleNotesQuery({
      tagSetId: tagSetId || null,
      tagFilter: tagFilter || null,
      reportId,
      userId: null, // 不考虑报告权限验证
            page,
            pageSize,
      brandKey,
      bloggerId,
      startDate,
      endDate,
      aiStatus,
      orderBy,
      order,
      showUnanalyzed,
      showMissingContent,
    });
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

/**
 * 统一的 PG 直连查询函数
 * 根据 tagFilter 和 reportId 动态构建不同的子查询条件（SELECT IN SELECT）
 */
async function queryNotesWithPg(params: {
  tagSetId?: string | null;
  tagFilter?: string | null; // '__untagged__' | tagId | null
  reportId?: string | null; // 报告ID（使用子查询，不考虑权限验证）
  userId?: string | null; // 用户ID（已废弃，保留以兼容，但不使用）
  page: number;
  pageSize: number;
  brandKey?: string | null; // 格式：BrandId#KF#BrandName
  bloggerId?: string | null;
  startDate?: string | null;
  endDate?: string | null;
  aiStatus?: string | null;
  orderBy: string;
  order: string;
  showUnanalyzed: boolean;
  showMissingContent: boolean;
}) {
  try {
    const {
      tagSetId,
      tagFilter,
      reportId,
      userId,
      page,
      pageSize,
      brandKey,
      bloggerId,
      startDate,
      endDate,
      aiStatus,
      orderBy,
      order,
      showUnanalyzed,
      showMissingContent,
    } = params;
    
    const offset = (page - 1) * pageSize;
    const orderDir = order.toLowerCase() === 'asc' ? 'ASC' : 'DESC';
    
    // 构建 WHERE 条件
    const conditions: string[] = [];
    const queryParams: any[] = [];
    let paramIndex = 1;
    
    // 根据 tagFilter 类型构建不同的标签筛选条件（SELECT IN SELECT）
    if (tagFilter === '__untagged__' && tagSetId) {
      // 未打标条件：NOT EXISTS (SELECT ...)
      conditions.push(`
        NOT EXISTS (
          SELECT 1 
          FROM qiangua_note_tag nt
          INNER JOIN qiangua_tag t ON nt."TagId" = t."TagId"
          WHERE nt."NoteId" = n."NoteId" 
            AND t."TagSetId" = $${paramIndex}::uuid
        )
      `);
      queryParams.push(tagSetId);
      paramIndex++;
      
      // 排除空 XhsNoteLink
      conditions.push(`(n."XhsNoteLink" IS NOT NULL AND n."XhsNoteLink" != '')`);
    } else if (tagFilter && tagFilter !== '__untagged__') {
      // 有特定标签条件：EXISTS (SELECT ...)
      conditions.push(`
        EXISTS (
          SELECT 1 
          FROM qiangua_note_tag nt
          WHERE nt."NoteId" = n."NoteId" 
            AND nt."TagId" = $${paramIndex}::uuid
        )
      `);
      queryParams.push(tagFilter);
      paramIndex++;
    }
    // tagFilter 为空时不添加标签筛选条件
    
    // 如果有 reportId，使用子查询限制在报告笔记范围内（SELECT IN SELECT）
    // 不考虑报告权限验证，只检查报告关联状态
    if (reportId) {
      conditions.push(`
        EXISTS (
          SELECT 1 
          FROM qiangua_report_note_rel rnr
          WHERE rnr."NoteId" = n."NoteId" 
            AND rnr."ReportId" = $${paramIndex}
            AND rnr."Status" = 'active'
        )
      `);
      queryParams.push(reportId);
      paramIndex++;
    }
    
    // 其他过滤条件
    if (brandKey) {
      const [brandId, brandName] = brandKey.split('#KF#');
      conditions.push(`n."BrandId" = $${paramIndex}`);
      queryParams.push(brandId);
      paramIndex++;
      conditions.push(`n."BrandName" = $${paramIndex}`);
      queryParams.push(brandName);
      paramIndex++;
    }
    
    if (bloggerId) {
      conditions.push(`n."BloggerId" = $${paramIndex}`);
      queryParams.push(bloggerId);
      paramIndex++;
    }
    
    if (startDate) {
      conditions.push(`n."PubDate" >= $${paramIndex}::date`);
      queryParams.push(startDate);
      paramIndex++;
    }
    
    if (endDate) {
      conditions.push(`n."PubDate" <= $${paramIndex}::date`);
      queryParams.push(endDate);
      paramIndex++;
    }
    
    if (aiStatus) {
      conditions.push(`n."AiStatus" = $${paramIndex}`);
      queryParams.push(aiStatus);
      paramIndex++;
    }
    
    // 未分析筛选
    if (showUnanalyzed) {
      conditions.push(`n."AiContentType" IS NULL`);
      conditions.push(`n."AiRelatedProducts" IS NULL`);
      conditions.push(`n."AiSummary" IS NULL`);
      conditions.push(`n."AiStatus" != '分析中'`);
    }
    
    // 缺失内容筛选
    if (showMissingContent) {
      conditions.push(`(n."XhsNoteLink" IS NULL OR n."XhsNoteLink" = '')`);
    }
    
    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    
    // 保存用于 count 查询的参数（不包含 LIMIT 和 OFFSET）
    const countParams = [...queryParams];
    
    // 添加 LIMIT 和 OFFSET 到 notes 查询参数
    queryParams.push(pageSize, offset);
    
    // 查询笔记列表
    const notesSql = `
      SELECT 
        n."NoteId", n."DateCode", n."Title", n."Content", n."CoverImage", 
        n."NoteType", n."IsBusiness", n."IsAdNote", n."PublishTime", n."PubDate",
        n."LikedCount", n."CollectedCount", n."CommentsCount", n."ViewCount", 
        n."ShareCount", n."BloggerId", n."BloggerNickName", n."BloggerProp",
        n."BigAvatar", n."SmallAvatar", n."BrandId", n."BrandIdKey", n."BrandName",
        n."VideoDuration", n."CurrentUserIsFavorite", n."Fans", n."AdPrice",
        n."OfficialVerified", n."XhsContent", n."XhsNoteLink",
        n."AiContentType", n."AiRelatedProducts", n."AiSummary", n."AiStatus", n."AiErr"
      FROM qiangua_note_info n
      ${whereClause}
      ORDER BY n."${orderBy}" ${orderDir}
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;
    
    // 查询总数
    const countSql = `
      SELECT COUNT(*) as "total"
      FROM qiangua_note_info n
      ${whereClause}
    `;
    
    const [notesResult, countResult] = await Promise.all([
      queryPg(notesSql, queryParams),
      queryPg(countSql, countParams),
    ]);
    
    return {
      notes: notesResult || [],
      totalCount: parseInt(countResult[0]?.total || '0', 10),
      error: null,
    };
  } catch (error: any) {
    return {
      notes: [],
      totalCount: 0,
      error: error.message,
    };
  }
}

/**
 * 查询标签数据（使用 PG 直连）
 */
async function fetchNoteTags(tagSetId: string, noteIds: string[]): Promise<Record<string, any[]>> {
  const noteTags: Record<string, any[]> = {};
  
  if (!tagSetId || !noteIds || noteIds.length === 0) {
    return noteTags;
  }

  // 查询标签系列中的所有标签
  const tagsSql = `
    SELECT "TagId", "TagName", "TagSetId"
    FROM qiangua_tag
    WHERE "TagSetId" = $1::uuid
  `;
  const tagsInSet = await queryPg(tagsSql, [tagSetId]);
  
  if (tagsInSet && tagsInSet.length > 0) {
    const tagIds = tagsInSet.map((t: any) => t.TagId);
    const tagMap = new Map(tagsInSet.map((t: any) => [t.TagId, t]));
    
    // 查询笔记标签关联关系
    const relationsSql = `
      SELECT "NoteId", "TagId"
      FROM qiangua_note_tag
      WHERE "NoteId" = ANY($1::text[])
        AND "TagId" = ANY($2::uuid[])
    `;
    const noteTagRelations = await queryPg(relationsSql, [noteIds, tagIds]);
    
    if (noteTagRelations) {
      for (const rel of noteTagRelations) {
        if (!noteTags[rel.NoteId]) {
          noteTags[rel.NoteId] = [];
        }
        const tag = tagMap.get(rel.TagId) as any;
        if (tag) {
          noteTags[rel.NoteId].push({
            tagId: tag.TagId,
            tagName: tag.TagName,
          });
        }
      }
    }
  }

  return noteTags;
}

/**
 * 统一的笔记查询处理函数
 * 合并了所有查询场景：未打标、具体标签、无标签筛选
 * 所有场景都使用统一的 PG 直连查询，通过不同的子查询条件实现
 */
async function handleNotesQuery(params: {
  tagSetId?: string | null;
  tagFilter?: string | null; // '__untagged__' | tagId | null
  reportId?: string | null;
  userId?: string | null;
  page: number;
  pageSize: number;
  brandKey?: string | null; // 格式：BrandId#KF#BrandName
  bloggerId?: string | null;
  startDate?: string | null;
  endDate?: string | null;
  aiStatus?: string | null;
  orderBy: string;
  order: string;
  showUnanalyzed: boolean;
  showMissingContent: boolean;
}) {
  const {
    tagSetId,
    tagFilter,
    reportId,
    userId,
    page,
    pageSize,
    brandKey,
    bloggerId,
    startDate,
    endDate,
    aiStatus,
    orderBy,
    order,
    showUnanalyzed,
    showMissingContent,
  } = params;

  // 使用统一的 PG 查询函数
  const pgResult = await queryNotesWithPg({
    tagSetId,
    tagFilter,
    reportId,
    userId,
    page,
    pageSize,
    brandKey,
    bloggerId,
    startDate,
    endDate,
    aiStatus,
    orderBy,
    order,
    showUnanalyzed,
    showMissingContent,
  });

  // 处理结果
  if (pgResult.error) {
    return NextResponse.json(
      {
        success: false,
        error: pgResult.error || '查询失败',
      },
      { status: 500 }
    );
  }

  // 查询标签数据（如果提供了 tagSetId）
  const noteTags = tagSetId 
    ? await fetchNoteTags(tagSetId, pgResult.notes.map((n: any) => n.NoteId))
    : {};

  return NextResponse.json({
    success: true,
    data: {
      list: pgResult.notes || [],
      total: pgResult.totalCount || 0,
      page,
      pageSize,
      noteTags,
    },
  });
}

