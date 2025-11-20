import { NextResponse } from 'next/server';

import {
  fetchNextPendingNote,
  processNoteAiAnalysis,
  type NoteRecord,
} from '@/lib/ai/noteAnalysis';
import { log } from '@/lib/logger';
import { getServiceSupabaseClient } from '@/lib/supabase/admin';
import { getSystemConfig, CONFIG_KEYS } from '@/lib/systemConfig';

const MAX_CONCURRENT_ANALYSIS = 20; // 最大并发分析数量
const BATCH_SIZE = 5; // 每次批量启动的任务数量
const REQUEST_INTERVAL = 4000; // 请求之间的延时（毫秒）

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic'; // 禁用缓存，确保每次请求都执行

// 创建带缓存控制的响应
const createResponse = (data: any, status: number = 200) => {
  return NextResponse.json(data, {
    status,
    headers: {
      'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0',
    },
  });
};


// 延时函数
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// 后台批量启动AI分析任务
const startBatchAnalysis = async () => {
  const supabase = getServiceSupabaseClient();
  const startedNotes: string[] = [];

  log.info('AI批量分析开始', { batchSize: BATCH_SIZE });

  for (let i = 0; i < BATCH_SIZE; i++) {
    try {
      // 每次循环前检查当前"分析中"的数量
      const { count } = await supabase
        .from('qiangua_note_info')
        .select('NoteId', { count: 'exact', head: true })
        .eq('AiStatus', '分析中');

      const currentCount = count ?? 0;

      // 如果已达上限，停止启动新任务
      if (currentCount >= MAX_CONCURRENT_ANALYSIS) {
        log.warning('AI批量分析达到并发上限', {
          currentCount,
          maxConcurrent: MAX_CONCURRENT_ANALYSIS,
          iteration: i + 1,
        });
        break;
      }

      // 获取下一个待分析笔记
      const note = await fetchNextPendingNote(supabase);
      
      if (!note) {
        log.info('AI批量分析无待分析笔记', { iteration: i + 1 });
        break;
      }

      // 异步启动分析任务（不等待完成）
      processNoteAiAnalysis(note).catch((error) => {
        log.error('AI分析任务执行失败', { noteId: note.NoteId }, error);
      });

      startedNotes.push(note.NoteId);
      log.info('AI分析任务已启动', {
        noteId: note.NoteId,
        iteration: i + 1,
        totalStarted: startedNotes.length,
      });

      // 如果不是最后一次循环，延时1秒
      if (i < BATCH_SIZE - 1) {
        await sleep(REQUEST_INTERVAL);
      }
    } catch (error: any) {
      log.error('批量启动任务出错', { iteration: i + 1 }, error);
      // 出错后继续下一次循环
    }
  }

  log.info('AI批量分析完成', {
    totalStarted: startedNotes.length,
    noteIds: startedNotes,
  });
};

export async function GET() {
  const supabase = getServiceSupabaseClient();

  try {
    // 检查AI分析总开关
    const aiEnabled = await getSystemConfig(CONFIG_KEYS.AI_ANALYSIS_ENABLED);
    if (aiEnabled === 'false') {
      return createResponse({
        success: true,
        data: null,
        message: 'AI 分析已停止',
      });
    }

    // 检查当前分析中的数量
    const {
      data: inProgress,
      error: inProgressError,
      count: inProgressCount,
    } = await supabase
      .from('qiangua_note_info')
      .select('NoteId', { count: 'exact' })
      .eq('AiStatus', '分析中');

    if (inProgressError) {
      throw new Error(
        `检查分析中笔记失败: ${inProgressError.message ?? '未知错误'}`,
      );
    }

    const currentInProgressCount = inProgressCount ?? (inProgress?.length ?? 0);

    if (currentInProgressCount >= MAX_CONCURRENT_ANALYSIS) {
      return createResponse({
        success: true,
        data: null,
        message: `已达到最大并发分析数量 (${MAX_CONCURRENT_ANALYSIS})，跳过本次任务`,
      });
    }

    // 检查是否有待分析笔记
    const firstNote = await fetchNextPendingNote(supabase);
    if (!firstNote) {
      return createResponse({
        success: true,
        data: null,
        message: '暂无待分析笔记',
      });
    }

    // 在后台异步启动批量分析（不等待完成）
    startBatchAnalysis().catch((error) => {
      log.error('批量启动AI分析任务失败', {}, error);
    });

    // 立即返回成功响应
    return createResponse({
      success: true,
      data: {
        message: `批量 AI 分析任务已启动，将在后台处理最多 ${BATCH_SIZE} 个笔记`,
        maxBatchSize: BATCH_SIZE,
        currentInProgress: currentInProgressCount,
        maxConcurrent: MAX_CONCURRENT_ANALYSIS,
      },
    });
  } catch (error: any) {
    log.error('AI批量分析API调用失败', {}, error);

    return createResponse(
      {
        success: false,
        error: error?.message ?? 'AI 分析失败',
      },
      500,
    );
  }
}


