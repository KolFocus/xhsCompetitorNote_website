/**
 * 达人矩阵统计数据接口
 * GET /api/reports/[id]/blogger-matrix/stats - 获取达人矩阵统计数据
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';

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

    // 获取筛选参数（可选）
    const { searchParams } = new URL(request.url);
    const brandId = searchParams.get('brandId');
    const bloggerId = searchParams.get('bloggerId');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    // 构建查询：获取报告中的有效笔记及其博主信息
    // 先查询符合条件的笔记ID
    let notesQuery = supabase
      .from('qiangua_report_note_rel')
      .select(`
        NoteId,
        qiangua_note_info (
          NoteId,
          BloggerId,
          Fans,
          LikedCount,
          CollectedCount,
          CommentsCount,
          ViewCount,
          ShareCount,
          PublishTime,
          BrandId
        )
      `)
      .eq('ReportId', reportId)
      .eq('Status', 'active');

    const { data: notesData, error: notesError } = await notesQuery;

    if (notesError) {
      console.error('Error fetching notes:', notesError);
      return NextResponse.json(
        { success: false, error: notesError.message },
        { status: 500 }
      );
    }

    // 在内存中应用筛选条件
    let filteredNotes = (notesData || []).filter((rel: any) => {
      const noteInfo = rel.qiangua_note_info;
      if (!noteInfo) return false;

      if (brandId && noteInfo.BrandId !== brandId) return false;
      if (bloggerId && noteInfo.BloggerId !== bloggerId) return false;
      if (startDate && noteInfo.PublishTime < startDate) return false;
      if (endDate && noteInfo.PublishTime > endDate) return false;

      return true;
    });

    // 直接使用笔记表中的 Fans 字段进行统计（避免依赖可能缺失的 blogger 表）

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

    // 默认配置
    const defaultLevels = [
      {
        levelId: '1',
        levelName: '头部达人',
        minFans: 500000,
        maxFans: null,
      },
      {
        levelId: '2',
        levelName: '腰部达人',
        minFans: 100000,
        maxFans: 500000,
      },
      {
        levelId: '3',
        levelName: '初级达人',
        minFans: 10000,
        maxFans: 100000,
      },
      {
        levelId: '4',
        levelName: '新手达人',
        minFans: 0,
        maxFans: 10000,
      },
    ];

    // 直接从 qiangua_report.CustomLevels 读取分层
    const customLevels = Array.isArray(matrixRow?.CustomLevels)
      ? matrixRow!.CustomLevels
      : defaultLevels;

    // 处理数据：按博主分组统计
    const bloggerMap = new Map<string, {
      bloggerId: string;
      fansCount: number;
      notes: Array<{
        likedCount: number;
        collectedCount: number;
        commentsCount: number;
        viewCount: number;
        shareCount: number;
      }>;
    }>();

    if (filteredNotes) {
      for (const rel of filteredNotes) {
        const noteInfo = rel.qiangua_note_info;
        if (!noteInfo) continue;

        const bloggerId = noteInfo.BloggerId;
        const fansFromNote = Number(noteInfo.Fans) || 0;

        if (!bloggerMap.has(bloggerId)) {
          bloggerMap.set(bloggerId, {
            bloggerId,
            fansCount: fansFromNote,
            notes: [],
          });
        }

        const blogger = bloggerMap.get(bloggerId)!;
        // 取该达人在多条笔记中的最大粉丝数，防止偶发低值覆盖
        if (fansFromNote > blogger.fansCount) {
          blogger.fansCount = fansFromNote;
        }
        blogger.notes.push({
          likedCount: noteInfo.LikedCount || 0,
          collectedCount: noteInfo.CollectedCount || 0,
          commentsCount: noteInfo.CommentsCount || 0,
          viewCount: noteInfo.ViewCount || 0,
          shareCount: noteInfo.ShareCount || 0,
        });
      }
    }

    // 按层级分组统计
    const levelStats: Array<{
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
      totalViews: number;
      totalShares: number;
      notesCount: number;
    }> = [];

    const totalBloggers = bloggerMap.size;

    for (const level of customLevels) {
      const levelBloggers = Array.from(bloggerMap.values()).filter((blogger) => {
        const fans = blogger.fansCount;
        const minFans = level.minFans || 0;
        const maxFans = level.maxFans;

        if (maxFans === null) {
          return fans >= minFans;
        }
        return fans >= minFans && fans < maxFans;
      });

      const levelBloggerIds = new Set(levelBloggers.map((b) => b.bloggerId));
      let totalInteraction = 0;
      let totalLiked = 0;
      let totalCollected = 0;
      let totalComments = 0;
      let totalViews = 0;
      let totalShares = 0;
      let notesCount = 0;
      let totalFans = 0;

      for (const blogger of levelBloggers) {
        totalFans += blogger.fansCount;
        for (const note of blogger.notes) {
          notesCount++;
          totalLiked += note.likedCount;
          totalCollected += note.collectedCount;
          totalComments += note.commentsCount;
          totalViews += note.viewCount;
          totalShares += note.shareCount;
        }
      }

      totalInteraction = totalLiked + totalCollected + totalComments + totalViews + totalShares;

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
        totalViews,
        totalShares,
        notesCount,
      });
    }

    // 知名KOL层（固定层级，粉丝数>=100万）
    const kolBloggers = Array.from(bloggerMap.values()).filter(
      (blogger) => blogger.fansCount >= 1000000
    );
    const kolBloggerIds = new Set(kolBloggers.map((b) => b.bloggerId));
    let kolTotalInteraction = 0;
    let kolTotalLiked = 0;
    let kolTotalCollected = 0;
    let kolTotalComments = 0;
    let kolTotalViews = 0;
    let kolTotalShares = 0;
    let kolNotesCount = 0;
    let kolTotalFans = 0;

    for (const blogger of kolBloggers) {
      kolTotalFans += blogger.fansCount;
      for (const note of blogger.notes) {
        kolNotesCount++;
        kolTotalLiked += note.likedCount;
        kolTotalCollected += note.collectedCount;
        kolTotalComments += note.commentsCount;
        kolTotalViews += note.viewCount;
        kolTotalShares += note.shareCount;
      }
    }

    kolTotalInteraction = kolTotalLiked + kolTotalCollected + kolTotalComments + kolTotalViews + kolTotalShares;

    const kolStats = {
      levelId: 'kol',
      levelName: '知名KOL',
      minFans: 1000000,
      maxFans: null,
      bloggerCount: kolBloggers.length,
      bloggerPercentage: totalBloggers > 0 ? (kolBloggers.length / totalBloggers) * 100 : 0,
      avgFans: kolBloggers.length > 0 ? Math.round(kolTotalFans / kolBloggers.length) : 0,
      totalInteraction: kolTotalInteraction,
      totalLiked: kolTotalLiked,
      totalCollected: kolTotalCollected,
      totalComments: kolTotalComments,
      totalViews: kolTotalViews,
      totalShares: kolTotalShares,
      notesCount: kolNotesCount,
    };

    // 返回统计数据（知名KOL层在最前面）
    return NextResponse.json({
      success: true,
      data: {
        levels: [kolStats, ...levelStats],
        totalBloggers,
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

