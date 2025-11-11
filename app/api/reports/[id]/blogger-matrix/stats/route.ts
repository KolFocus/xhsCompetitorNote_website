/**
 * 达人矩阵统计数据接口
 * GET /api/reports/[id]/blogger-matrix/stats - 获取达人矩阵统计数据
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { DEFAULT_BLOGGER_LEVELS_WITH_ID } from '@/lib/constants/bloggerMatrix';

interface NoteInfoRecord {
  BloggerId: string;
  OfficialVerified: boolean | null;
  Fans: number | null;
  LikedCount: number | null;
  CollectedCount: number | null;
  CommentsCount: number | null;
  ViewCount: number | null;
  ShareCount: number | null;
  AdPrice: number | null;
}

interface NoteRelation {
  qiangua_note_info: NoteInfoRecord | null;
}

interface LevelStat {
  levelId: string;
  levelName: string;
  minFans: number;
  maxFans: number | null;
  bloggerCount: number;
  bloggerPercentage: number;
  avgFans: number;
  totalInteraction: number;
  totalLiked: number;
  totalCollected: number;
  totalComments: number;
  totalShares: number;
  totalAdPrice: number;
  adPricePerNote: number;
  notesCount: number;
}

interface LevelStatPercentages {
  notesPercentage: number;
  totalInteractionPercentage: number;
  totalLikedPercentage: number;
  totalCollectedPercentage: number;
  totalCommentsPercentage: number;
  totalSharesPercentage: number;
  totalAdPricePercentage: number;
}

type LevelStatWithPercentages = LevelStat & LevelStatPercentages;

interface TotalsBase {
  notesCount: number;
  totalInteraction: number;
  totalLiked: number;
  totalCollected: number;
  totalComments: number;
  totalShares: number;
  totalAdPrice: number;
}

interface AggregatedTotals extends TotalsBase {
  bloggerCount: number;
  avgFansWeighted: number;
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

    // 构建查询：获取报告中的所有有效笔记及其博主信息
    // 达人矩阵分析基于整个报告的有效笔记全集，不受筛选条件影响
    const { data: notesData, error: notesError } = await supabase
      .from('qiangua_report_note_rel')
      .select(`
        qiangua_note_info (
          BloggerId,
          OfficialVerified,
          Fans,
          LikedCount,
          CollectedCount,
          CommentsCount,
          ViewCount,
          ShareCount,
          AdPrice
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
    // 过滤掉没有笔记信息的记录
    const rawNotes: NoteRelation[] = Array.isArray(notesData)
      ? (notesData as any[]).map((rel) => {
          const info = Array.isArray(rel?.qiangua_note_info)
            ? rel.qiangua_note_info[0]
            : rel?.qiangua_note_info;
          return {
            qiangua_note_info: info ?? null,
          };
        })
      : [];
    const filteredNotes = rawNotes.filter(
      (rel): rel is NoteRelation & { qiangua_note_info: NoteInfoRecord } =>
        rel.qiangua_note_info != null
    );

    // 获取配置（如果没有配置，使用默认配置）
    // 实际分层配置存储在 qiangua_report.CustomLevels (JSON)
    const { data: matrixRow, error: matrixError } = await supabase
      .from('qiangua_report')
      .select('CustomLevels')
      .eq('ReportId', reportId)
      .single();
    if (matrixError) {
      // 非致命：读不到配置时后续使用默认分层
      console.warn('Warning: Failed to load CustomLevels from qiangua_report:', matrixError.message);
    }

    // 直接从 qiangua_report.CustomLevels 读取分层
    const customLevels = Array.isArray(matrixRow?.CustomLevels)
      ? matrixRow!.CustomLevels
      : DEFAULT_BLOGGER_LEVELS_WITH_ID;

    // 处理数据：按博主分组统计
    const bloggerMap = new Map<string, {
      bloggerId: string;
      officialVerified: boolean;
      fansCount: number;
      notes: Array<{
        likedCount: number;
        collectedCount: number;
        commentsCount: number;
        shareCount: number;
        adPrice: number;
      }>;
    }>();

    for (const rel of filteredNotes) {
      const noteInfo = rel.qiangua_note_info;
      const bloggerId = noteInfo.BloggerId;
      const isVerified = Boolean(noteInfo.OfficialVerified);
      const fansFromNote = Number(noteInfo.Fans) || 0;

      if (!bloggerMap.has(bloggerId)) {
        bloggerMap.set(bloggerId, {
          bloggerId,
          officialVerified: isVerified,
          fansCount: fansFromNote,
          notes: [],
        });
      }

      const blogger = bloggerMap.get(bloggerId)!;
      // 如果任何一条笔记显示为官方认证，则该达人视为KOL
      if (isVerified) {
        blogger.officialVerified = true;
      }
      // 取该达人在多条笔记中的最大粉丝数，防止偶发低值覆盖
      if (fansFromNote > blogger.fansCount) {
        blogger.fansCount = fansFromNote;
      }
      blogger.notes.push({
        likedCount: noteInfo.LikedCount || 0,
        collectedCount: noteInfo.CollectedCount || 0,
        commentsCount: noteInfo.CommentsCount || 0,
        shareCount: noteInfo.ShareCount || 0,
        adPrice: noteInfo.AdPrice || 0,
      });
    }

    // 先计算KOL（官方认证达人），后续层级需排除这些达人
    const kolBloggers = Array.from(bloggerMap.values()).filter(
      (blogger) => blogger.officialVerified === true
    );
    const kolBloggerIds = new Set(kolBloggers.map((b) => b.bloggerId));

    // 按层级分组统计（排除KOL达人）
    const levelStats: LevelStat[] = [];

    const totalBloggers = bloggerMap.size;

    for (const level of customLevels) {
      const levelBloggers = Array.from(bloggerMap.values()).filter((blogger) => {
        // 排除KOL达人
        if (kolBloggerIds.has(blogger.bloggerId)) return false;
        const fans = blogger.fansCount;
        const minFans = level.minFans || 0;
        const maxFans = level.maxFans;

        if (maxFans === null) {
          return fans >= minFans;
        }
        return fans >= minFans && fans < maxFans;
      });

      let totalInteraction = 0;
      let totalLiked = 0;
      let totalCollected = 0;
      let totalComments = 0;
      let totalShares = 0;
      let totalAdPrice = 0;
      let notesCount = 0;
      let totalFans = 0;

      for (const blogger of levelBloggers) {
        totalFans += blogger.fansCount;
        for (const note of blogger.notes) {
          notesCount++;
          totalLiked += note.likedCount;
          totalCollected += note.collectedCount;
          totalComments += note.commentsCount;
          totalShares += note.shareCount;
          totalAdPrice += note.adPrice;
        }
      }

      // 互动量 = 点赞 + 收藏 + 评论
      totalInteraction = totalLiked + totalCollected + totalComments;

      levelStats.push({
        levelId: level.levelId,
        levelName: level.levelName,
        minFans: level.minFans,
        maxFans: level.maxFans,
        bloggerCount: levelBloggers.length,
        bloggerPercentage: totalBloggers > 0 ? (levelBloggers.length / totalBloggers) * 100 : 0,
        avgFans: levelBloggers.length > 0 ? Math.round(totalFans / levelBloggers.length) : 0,
        totalInteraction,
        totalLiked,
        totalCollected,
        totalComments,
        totalShares,
        totalAdPrice,
        adPricePerNote: notesCount > 0 ? totalAdPrice / notesCount : 0,
        notesCount,
      });
    }

    let kolTotalInteraction = 0;
    let kolTotalLiked = 0;
    let kolTotalCollected = 0;
    let kolTotalComments = 0;
    let kolTotalShares = 0;
    let kolTotalAdPrice = 0;
    let kolNotesCount = 0;
    let kolTotalFans = 0;

    for (const blogger of kolBloggers) {
      kolTotalFans += blogger.fansCount;
      for (const note of blogger.notes) {
        kolNotesCount++;
        kolTotalLiked += note.likedCount;
        kolTotalCollected += note.collectedCount;
        kolTotalComments += note.commentsCount;
        kolTotalShares += note.shareCount;
        kolTotalAdPrice += note.adPrice;
      }
    }

    // 互动量 = 点赞 + 收藏 + 评论
    kolTotalInteraction = kolTotalLiked + kolTotalCollected + kolTotalComments;

    const kolStats: LevelStat = {
      levelId: 'kol',
      levelName: '知名KOL',
      minFans: 0,
      maxFans: null,
      bloggerCount: kolBloggers.length,
      bloggerPercentage: totalBloggers > 0 ? (kolBloggers.length / totalBloggers) * 100 : 0,
      avgFans: kolBloggers.length > 0 ? Math.round(kolTotalFans / kolBloggers.length) : 0,
      totalInteraction: kolTotalInteraction,
      totalLiked: kolTotalLiked,
      totalCollected: kolTotalCollected,
      totalComments: kolTotalComments,
      totalShares: kolTotalShares,
      totalAdPrice: kolTotalAdPrice,
      adPricePerNote: kolNotesCount > 0 ? kolTotalAdPrice / kolNotesCount : 0,
      notesCount: kolNotesCount,
    };

    const sumField = (list: Array<Record<string, any>>, key: string): number =>
      list.reduce((acc, item) => acc + (Number(item[key]) || 0), 0);

    // 汇总总计（包含KOL）
    const totalsAll: TotalsBase = {
      notesCount: sumField(levelStats, 'notesCount') + kolStats.notesCount,
      totalInteraction: sumField(levelStats, 'totalInteraction') + kolStats.totalInteraction,
      totalLiked: sumField(levelStats, 'totalLiked') + kolStats.totalLiked,
      totalCollected: sumField(levelStats, 'totalCollected') + kolStats.totalCollected,
      totalComments: sumField(levelStats, 'totalComments') + kolStats.totalComments,
      totalShares: sumField(levelStats, 'totalShares') + kolStats.totalShares,
      totalAdPrice: sumField(levelStats, 'totalAdPrice') + kolStats.totalAdPrice,
    };

    // 加权平均粉丝（包含KOL）
    const weightedAvgFans =
      totalBloggers > 0
        ? Math.round(
            (levelStats.reduce(
              (acc, cur) => acc + (Number(cur.avgFans) || 0) * (Number(cur.bloggerCount) || 0),
              0
            ) + (Number(kolStats.avgFans) || 0) * (Number(kolStats.bloggerCount) || 0)) /
              totalBloggers
          )
        : 0;

    const toPercent = (value: number, total: number) => (total > 0 ? (value / total) * 100 : 0);

    const applyPercentages = <T extends LevelStat>(
      stat: T,
      baseTotals: TotalsBase
    ): T & LevelStatPercentages => ({
      ...stat,
      notesPercentage: toPercent(stat.notesCount, baseTotals.notesCount),
      totalInteractionPercentage: toPercent(stat.totalInteraction, baseTotals.totalInteraction),
      totalLikedPercentage: toPercent(stat.totalLiked, baseTotals.totalLiked),
      totalCollectedPercentage: toPercent(stat.totalCollected, baseTotals.totalCollected),
      totalCommentsPercentage: toPercent(stat.totalComments, baseTotals.totalComments),
      totalSharesPercentage: toPercent(stat.totalShares, baseTotals.totalShares),
      totalAdPricePercentage: toPercent(stat.totalAdPrice, baseTotals.totalAdPrice),
    });

    // 统一用包含KOL的总计来计算占比
    const kolStatsWithPercentage = applyPercentages(kolStats, totalsAll);
    const levelStatsWithPercentage = levelStats.map((stat) => applyPercentages(stat, totalsAll));

    // 构造总计行，形状与分层一致
    const totalRow: LevelStatWithPercentages = {
      levelId: 'total',
      levelName: '总计',
      minFans: 0,
      maxFans: null,
      bloggerCount: totalBloggers,
      bloggerPercentage: 100,
      avgFans: weightedAvgFans,
      totalInteraction: totalsAll.totalInteraction,
      totalLiked: totalsAll.totalLiked,
      totalCollected: totalsAll.totalCollected,
      totalComments: totalsAll.totalComments,
      totalShares: totalsAll.totalShares,
      totalAdPrice: totalsAll.totalAdPrice,
      adPricePerNote: totalsAll.notesCount > 0 ? totalsAll.totalAdPrice / totalsAll.notesCount : 0,
      notesCount: totalsAll.notesCount,
      // 百分比对总计行即为100%或0%
      notesPercentage: totalsAll.notesCount > 0 ? 100 : 0,
      totalInteractionPercentage: totalsAll.totalInteraction > 0 ? 100 : 0,
      totalLikedPercentage: totalsAll.totalLiked > 0 ? 100 : 0,
      totalCollectedPercentage: totalsAll.totalCollected > 0 ? 100 : 0,
      totalCommentsPercentage: totalsAll.totalComments > 0 ? 100 : 0,
      totalSharesPercentage: totalsAll.totalShares > 0 ? 100 : 0,
      totalAdPricePercentage: totalsAll.totalAdPrice > 0 ? 100 : 0,
    };

    // 扁平化返回顺序：KOL -> 各层级 -> 总计
    const rows: LevelStatWithPercentages[] = [
      kolStatsWithPercentage,
      ...levelStatsWithPercentage,
      totalRow,
    ];

    return NextResponse.json({
      success: true,
      data: {
        rows,
      },
    });
  } catch (error: any) {
    console.error('Error in get blogger matrix stats API:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

