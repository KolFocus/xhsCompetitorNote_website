/**
 * 基于内容标签的笔记分析统计数据接口
 * GET /api/reports/[id]/tag-analysis/stats?tagSetId=xxx - 获取标签维度统计数据
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';

interface NoteInfoRecord {
  NoteId: string;
  Title: string | null;
  Content: string | null;
  CoverImage: string | null;
  NoteType: string | null;
  IsBusiness: boolean | null;
  IsAdNote: boolean | null;
  PublishTime: string | null;
  LikedCount: number | null;
  CollectedCount: number | null;
  CommentsCount: number | null;
  ViewCount: number | null;
  ShareCount: number | null;
  AdPrice: number | null;
  BloggerId: string;
  BloggerNickName: string | null;
  SmallAvatar: string | null;
  BigAvatar: string | null;
  OfficialVerified: boolean | null;
  Fans: number | null;
  BrandId: string | null;
  BrandIdKey: string | null;
  BrandName: string | null;
  VideoDuration: string | null;
}

interface NoteTagRelation {
  NoteId: string;
  TagId: string;
  CreatedAt: string;
  TagName: string;
  TagSetId: string;
}

interface TagStats {
  tagId: string | null;
  tagName: string;
  notesCount: number;
  notesPercentage: number;
  bloggerCount: number;
  bloggerPercentage: number;
  avgFans: number;
  totalInteraction: number;
  totalInteractionPercentage: number;
  totalLiked: number;
  totalLikedPercentage: number;
  totalCollected: number;
  totalCollectedPercentage: number;
  totalComments: number;
  totalCommentsPercentage: number;
  totalShares: number;
  totalSharesPercentage: number;
  totalAdPrice: number;
  totalAdPricePercentage: number;
  adPricePerNote: number;
}

interface NoteDetail {
  tagName: string;
  noteId: string;
  title: string | null;
  content: string | null;
  coverImage: string | null;
  noteType: string | null;
  isBusiness: boolean | null;
  isAdNote: boolean | null;
  publishTime: string | null;
  likedCount: number | null;
  collectedCount: number | null;
  commentsCount: number | null;
  viewCount: number | null;
  shareCount: number | null;
  fans: number | null;
  adPrice: number | null;
  bloggerId: string;
  bloggerNickName: string | null;
  bloggerSmallAvatar: string | null;
  bloggerBigAvatar: string | null;
  officialVerified: boolean | null;
  brandId: string | null;
  brandIdKey: string | null;
  brandName: string | null;
  videoDuration: string | null;
  status: string | null;
  addedAt: string | null;
}

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
    const searchParams = request.nextUrl.searchParams;
    const tagSetId = searchParams.get('tagSetId');

    if (!tagSetId) {
      return NextResponse.json(
        { success: false, error: 'tagSetId 参数不能为空' },
        { status: 400 }
      );
    }

    // 验证报告存在且属于当前用户
    const { data: report, error: reportError } = await supabase
      .from('qiangua_report')
      .select('ReportId')
      .eq('ReportId', reportId)
      .eq('UserId', user.id)
      .eq('Status', 'active')
      .single();

    if (reportError || !report) {
      return NextResponse.json(
        { success: false, error: '报告不存在或无权访问' },
        { status: 404 }
      );
    }

    // 验证标签系列存在且用户有权访问
    const { data: tagSet, error: tagSetError } = await supabase
      .from('qiangua_tag_set')
      .select('TagSetId, type, UserId')
      .eq('TagSetId', tagSetId)
      .single();

    if (tagSetError || !tagSet) {
      return NextResponse.json(
        { success: false, error: '标签系列不存在' },
        { status: 404 }
      );
    }

    // 检查权限：系统标签系列或用户自己的自定义标签系列
    if (tagSet.type === 'custom' && tagSet.UserId !== user.id) {
      return NextResponse.json(
        { success: false, error: '无权访问该标签系列' },
        { status: 403 }
      );
    }

    // 步骤1：获取报告内所有有效笔记
    const { data: notesData, error: notesError } = await supabase
      .from('qiangua_report_note_rel')
      .select(`
        Status,
        CreatedAt,
        qiangua_note_info (
          NoteId,
          Title,
          Content,
          CoverImage,
          NoteType,
          IsBusiness,
          IsAdNote,
          PublishTime,
          LikedCount,
          CollectedCount,
          CommentsCount,
          ViewCount,
          ShareCount,
          AdPrice,
          BloggerId,
          BloggerNickName,
          SmallAvatar,
          BigAvatar,
          OfficialVerified,
          Fans,
          BrandId,
          BrandIdKey,
          BrandName,
          VideoDuration
        )
      `)
      .eq('ReportId', reportId)
      .eq('Status', 'active');

    if (notesError) {
      console.error('Error fetching notes:', notesError);
      return NextResponse.json(
        { success: false, error: notesError.message },
        { status: 500 }
      );
    }

    // 过滤并格式化笔记数据
    const notes: NoteInfoRecord[] = [];
    const noteMap = new Map<string, NoteInfoRecord>();

    if (Array.isArray(notesData)) {
      for (const rel of notesData) {
        const noteInfo = Array.isArray(rel?.qiangua_note_info)
          ? rel.qiangua_note_info[0]
          : rel?.qiangua_note_info;
        if (noteInfo && noteInfo.NoteId) {
          const note: NoteInfoRecord = {
            NoteId: noteInfo.NoteId,
            Title: noteInfo.Title ?? null,
            Content: noteInfo.Content ?? null,
            CoverImage: noteInfo.CoverImage ?? null,
            NoteType: noteInfo.NoteType ?? null,
            IsBusiness: noteInfo.IsBusiness ?? null,
            IsAdNote: noteInfo.IsAdNote ?? null,
            PublishTime: noteInfo.PublishTime ?? null,
            LikedCount: noteInfo.LikedCount ?? null,
            CollectedCount: noteInfo.CollectedCount ?? null,
            CommentsCount: noteInfo.CommentsCount ?? null,
            ViewCount: noteInfo.ViewCount ?? null,
            ShareCount: noteInfo.ShareCount ?? null,
            AdPrice: noteInfo.AdPrice ?? null,
            BloggerId: noteInfo.BloggerId,
            BloggerNickName: noteInfo.BloggerNickName ?? null,
            SmallAvatar: noteInfo.SmallAvatar ?? null,
            BigAvatar: noteInfo.BigAvatar ?? null,
            OfficialVerified: noteInfo.OfficialVerified ?? null,
            Fans: noteInfo.Fans ?? null,
            BrandId: noteInfo.BrandId ?? null,
            BrandIdKey: noteInfo.BrandIdKey ?? null,
            BrandName: noteInfo.BrandName ?? null,
            VideoDuration: noteInfo.VideoDuration ?? null,
          };
          notes.push(note);
          noteMap.set(note.NoteId, note);
        }
      }
    }

    // 步骤2：获取标签系列下的所有标签ID
    const { data: tagsData, error: tagsError } = await supabase
      .from('qiangua_tag')
      .select('TagId, TagName')
      .eq('TagSetId', tagSetId);

    if (tagsError) {
      console.error('Error fetching tags:', tagsError);
      return NextResponse.json(
        { success: false, error: tagsError.message },
        { status: 500 }
      );
    }

    const tags = tagsData || [];
    const tagIds = tags.map((tag) => tag.TagId);
    const tagMap = new Map<string, string>();
    for (const tag of tags) {
      tagMap.set(tag.TagId, tag.TagName);
    }

    if (tagIds.length === 0) {
      // 如果没有标签，返回空结果
      return NextResponse.json({
        success: true,
        data: {
          rows: [],
          details: [],
        },
      });
    }

    // 步骤3：获取标签关联关系
    const { data: tagRelationsData, error: tagRelationsError } = await supabase
      .from('qiangua_note_tag')
      .select(`
        NoteId,
        TagId,
        CreatedAt
      `)
      .in('TagId', tagIds)
      .in('NoteId', notes.map((n) => n.NoteId));

    if (tagRelationsError) {
      console.error('Error fetching tag relations:', tagRelationsError);
      return NextResponse.json(
        { success: false, error: tagRelationsError.message },
        { status: 500 }
      );
    }

    // 格式化标签关联关系
    const tagRelations: NoteTagRelation[] = [];
    const noteTagMap = new Map<string, NoteTagRelation[]>();

    if (Array.isArray(tagRelationsData)) {
      for (const rel of tagRelationsData) {
        if (rel.NoteId && rel.TagId && tagMap.has(rel.TagId)) {
          const relation: NoteTagRelation = {
            NoteId: rel.NoteId,
            TagId: rel.TagId,
            CreatedAt: rel.CreatedAt,
            TagName: tagMap.get(rel.TagId)!,
            TagSetId: tagSetId,
          };
          tagRelations.push(relation);

          if (!noteTagMap.has(rel.NoteId)) {
            noteTagMap.set(rel.NoteId, []);
          }
          noteTagMap.get(rel.NoteId)!.push(relation);
        }
      }
    }

    // 步骤4：在应用层进行数据聚合和计算
    // 4.1 按标签维度统计（允许重复计算）
    const tagStatsMap = new Map<string, {
      tagId: string;
      tagName: string;
      notes: Set<string>;
      bloggers: Set<string>;
      bloggerFans: Map<string, number>;
      totalInteraction: number;
      totalLiked: number;
      totalCollected: number;
      totalComments: number;
      totalShares: number;
      totalAdPrice: number;
    }>();

    // 初始化所有标签的统计
    for (const tag of tags) {
      tagStatsMap.set(tag.TagId, {
        tagId: tag.TagId,
        tagName: tag.TagName,
        notes: new Set(),
        bloggers: new Set(),
        bloggerFans: new Map(),
        totalInteraction: 0,
        totalLiked: 0,
        totalCollected: 0,
        totalComments: 0,
        totalShares: 0,
        totalAdPrice: 0,
      });
    }

    // 遍历标签关联关系，统计各标签的指标
    for (const relation of tagRelations) {
      const note = noteMap.get(relation.NoteId);
      if (!note) continue;

      const tagStat = tagStatsMap.get(relation.TagId);
      if (!tagStat) continue;

      // 笔记数量（不去重）
      tagStat.notes.add(relation.NoteId);

      // 达人数量（去重）
      tagStat.bloggers.add(note.BloggerId);

      // 达人粉丝数（取最大值）
      const currentFans = note.Fans ?? 0;
      const existingFans = tagStat.bloggerFans.get(note.BloggerId) ?? 0;
      if (currentFans > existingFans) {
        tagStat.bloggerFans.set(note.BloggerId, currentFans);
      }

      // 互动量（不去重）
      const liked = note.LikedCount ?? 0;
      const collected = note.CollectedCount ?? 0;
      const comments = note.CommentsCount ?? 0;
      const shares = note.ShareCount ?? 0;
      const adPrice = note.AdPrice ?? 0;

      tagStat.totalLiked += liked;
      tagStat.totalCollected += collected;
      tagStat.totalComments += comments;
      tagStat.totalShares += shares;
      tagStat.totalAdPrice += adPrice;
      tagStat.totalInteraction += liked + collected + comments;
    }

    // 4.2 统计未打标笔记
    const untaggedNotes = new Set<string>();
    const untaggedBloggers = new Set<string>();
    const untaggedBloggerFans = new Map<string, number>();
    let untaggedTotalInteraction = 0;
    let untaggedTotalLiked = 0;
    let untaggedTotalCollected = 0;
    let untaggedTotalComments = 0;
    let untaggedTotalShares = 0;
    let untaggedTotalAdPrice = 0;

    for (const note of notes) {
      if (!noteTagMap.has(note.NoteId)) {
        untaggedNotes.add(note.NoteId);
        untaggedBloggers.add(note.BloggerId);

        const currentFans = note.Fans ?? 0;
        const existingFans = untaggedBloggerFans.get(note.BloggerId) ?? 0;
        if (currentFans > existingFans) {
          untaggedBloggerFans.set(note.BloggerId, currentFans);
        }

        const liked = note.LikedCount ?? 0;
        const collected = note.CollectedCount ?? 0;
        const comments = note.CommentsCount ?? 0;
        const shares = note.ShareCount ?? 0;
        const adPrice = note.AdPrice ?? 0;

        untaggedTotalLiked += liked;
        untaggedTotalCollected += collected;
        untaggedTotalComments += comments;
        untaggedTotalShares += shares;
        untaggedTotalAdPrice += adPrice;
        untaggedTotalInteraction += liked + collected + comments;
      }
    }

    // 4.3 计算总计行（基于去重后的笔记总数）
    const allUniqueNotes = new Set(notes.map((n) => n.NoteId));
    const allUniqueBloggers = new Set(notes.map((n) => n.BloggerId));
    const allBloggerFans = new Map<string, number>();
    let totalInteraction = 0;
    let totalLiked = 0;
    let totalCollected = 0;
    let totalComments = 0;
    let totalShares = 0;
    let totalAdPrice = 0;

    for (const note of notes) {
      const currentFans = note.Fans ?? 0;
      const existingFans = allBloggerFans.get(note.BloggerId) ?? 0;
      if (currentFans > existingFans) {
        allBloggerFans.set(note.BloggerId, currentFans);
      }

      const liked = note.LikedCount ?? 0;
      const collected = note.CollectedCount ?? 0;
      const comments = note.CommentsCount ?? 0;
      const shares = note.ShareCount ?? 0;
      const adPrice = note.AdPrice ?? 0;

      totalLiked += liked;
      totalCollected += collected;
      totalComments += comments;
      totalShares += shares;
      totalAdPrice += adPrice;
      totalInteraction += liked + collected + comments;
    }

    const totalAvgFans =
      allUniqueBloggers.size > 0
        ? Math.round(
            Array.from(allBloggerFans.values()).reduce((sum, fans) => sum + fans, 0) /
              allUniqueBloggers.size
          )
        : 0;

    // 4.4 计算占比
    const toPercent = (value: number, total: number) => (total > 0 ? (value / total) * 100 : 0);

    // 构建标签行统计数据
    const tagStatsRows: TagStats[] = [];

    for (const tagStat of tagStatsMap.values()) {
      const avgFans =
        tagStat.bloggers.size > 0
          ? Math.round(
              Array.from(tagStat.bloggerFans.values()).reduce((sum, fans) => sum + fans, 0) /
                tagStat.bloggers.size
            )
          : 0;

      tagStatsRows.push({
        tagId: tagStat.tagId,
        tagName: tagStat.tagName,
        notesCount: tagStat.notes.size,
        notesPercentage: toPercent(tagStat.notes.size, allUniqueNotes.size),
        bloggerCount: tagStat.bloggers.size,
        bloggerPercentage: toPercent(tagStat.bloggers.size, allUniqueBloggers.size),
        avgFans,
        totalInteraction: tagStat.totalInteraction,
        totalInteractionPercentage: toPercent(tagStat.totalInteraction, totalInteraction),
        totalLiked: tagStat.totalLiked,
        totalLikedPercentage: toPercent(tagStat.totalLiked, totalLiked),
        totalCollected: tagStat.totalCollected,
        totalCollectedPercentage: toPercent(tagStat.totalCollected, totalCollected),
        totalComments: tagStat.totalComments,
        totalCommentsPercentage: toPercent(tagStat.totalComments, totalComments),
        totalShares: tagStat.totalShares,
        totalSharesPercentage: toPercent(tagStat.totalShares, totalShares),
        totalAdPrice: tagStat.totalAdPrice,
        totalAdPricePercentage: toPercent(tagStat.totalAdPrice, totalAdPrice),
        adPricePerNote:
          tagStat.notes.size > 0 ? tagStat.totalAdPrice / tagStat.notes.size : 0,
      });
    }

    // 添加未打标行
    if (untaggedNotes.size > 0) {
      const untaggedAvgFans =
        untaggedBloggers.size > 0
          ? Math.round(
              Array.from(untaggedBloggerFans.values()).reduce((sum, fans) => sum + fans, 0) /
                untaggedBloggers.size
            )
          : 0;

      tagStatsRows.push({
        tagId: null,
        tagName: '未打标',
        notesCount: untaggedNotes.size,
        notesPercentage: toPercent(untaggedNotes.size, allUniqueNotes.size),
        bloggerCount: untaggedBloggers.size,
        bloggerPercentage: toPercent(untaggedBloggers.size, allUniqueBloggers.size),
        avgFans: untaggedAvgFans,
        totalInteraction: untaggedTotalInteraction,
        totalInteractionPercentage: toPercent(untaggedTotalInteraction, totalInteraction),
        totalLiked: untaggedTotalLiked,
        totalLikedPercentage: toPercent(untaggedTotalLiked, totalLiked),
        totalCollected: untaggedTotalCollected,
        totalCollectedPercentage: toPercent(untaggedTotalCollected, totalCollected),
        totalComments: untaggedTotalComments,
        totalCommentsPercentage: toPercent(untaggedTotalComments, totalComments),
        totalShares: untaggedTotalShares,
        totalSharesPercentage: toPercent(untaggedTotalShares, totalShares),
        totalAdPrice: untaggedTotalAdPrice,
        totalAdPricePercentage: toPercent(untaggedTotalAdPrice, totalAdPrice),
        adPricePerNote: untaggedNotes.size > 0 ? untaggedTotalAdPrice / untaggedNotes.size : 0,
      });
    }

    // 添加总计行
    const totalRow: TagStats = {
      tagId: null,
      tagName: '总计',
      notesCount: allUniqueNotes.size,
      notesPercentage: 100,
      bloggerCount: allUniqueBloggers.size,
      bloggerPercentage: 100,
      avgFans: totalAvgFans,
      totalInteraction,
      totalInteractionPercentage: 100,
      totalLiked,
      totalLikedPercentage: 100,
      totalCollected,
      totalCollectedPercentage: 100,
      totalComments,
      totalCommentsPercentage: 100,
      totalShares,
      totalSharesPercentage: 100,
      totalAdPrice,
      totalAdPricePercentage: 100,
      adPricePerNote: allUniqueNotes.size > 0 ? totalAdPrice / allUniqueNotes.size : 0,
    };

    // 按笔记数量降序排序（总计行除外）
    tagStatsRows.sort((a, b) => {
      if (a.tagName === '总计') return 1;
      if (b.tagName === '总计') return -1;
      return b.notesCount - a.notesCount;
    });

    const rows: TagStats[] = [...tagStatsRows, totalRow];

    // 4.5 生成明细数据
    const details: NoteDetail[] = [];

    for (const note of notes) {
      const relations = noteTagMap.get(note.NoteId) || [];
      let tagNames: string[] = [];

      if (relations.length > 0) {
        // 按关联时间降序排序（后关联的在前）
        const sortedRelations = [...relations].sort(
          (a, b) => new Date(b.CreatedAt).getTime() - new Date(a.CreatedAt).getTime()
        );
        tagNames = sortedRelations.map((r) => r.TagName);
      } else {
        tagNames = ['未打标'];
      }

      const tagNameStr = tagNames.join(',');

      details.push({
        tagName: tagNameStr,
        noteId: note.NoteId,
        title: note.Title,
        content: note.Content,
        coverImage: note.CoverImage,
        noteType: note.NoteType,
        isBusiness: note.IsBusiness,
        isAdNote: note.IsAdNote,
        publishTime: note.PublishTime,
        likedCount: note.LikedCount,
        collectedCount: note.CollectedCount,
        commentsCount: note.CommentsCount,
        viewCount: note.ViewCount,
        shareCount: note.ShareCount,
        fans: note.Fans,
        adPrice: note.AdPrice,
        bloggerId: note.BloggerId,
        bloggerNickName: note.BloggerNickName,
        bloggerSmallAvatar: note.SmallAvatar,
        bloggerBigAvatar: note.BigAvatar,
        officialVerified: note.OfficialVerified,
        brandId: note.BrandId,
        brandIdKey: note.BrandIdKey,
        brandName: note.BrandName,
        videoDuration: note.VideoDuration,
        status: 'active',
        addedAt: null,
      });
    }

    // 按发布时间降序排序
    details.sort((a, b) => {
      if (!a.publishTime && !b.publishTime) return 0;
      if (!a.publishTime) return 1;
      if (!b.publishTime) return -1;
      return new Date(b.publishTime).getTime() - new Date(a.publishTime).getTime();
    });

    return NextResponse.json({
      success: true,
      data: {
        rows,
        details,
      },
    });
  } catch (error: any) {
    console.error('Error in tag analysis stats API:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}


