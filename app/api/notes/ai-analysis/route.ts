import { NextResponse } from 'next/server';

import {
  buildNoteAnalysisPrompt,
  collectMediaUrls,
  fetchNextPendingNote,
  parseAiResponseContent,
  type NoteRecord,
} from '@/lib/ai/noteAnalysis';
import { getServiceSupabaseClient } from '@/lib/supabase/admin';

const AI_API_URL = 'https://www.chataiapi.com/v1/chat/completions';
const AI_API_TOKEN = 'sk-elbujPUOtXGyEC8TnnesrJpXpYJGRPANv9qRGUEaEHiSNwAT';
const AI_MODEL = 'gemini-2.0-flash';
const MAX_CONCURRENT_ANALYSIS = 20; // 最大并发分析数量

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic'; // 禁用缓存，确保每次请求都执行

const buildAiRequestPayload = (prompt: string, mediaUrls: string[]) => {
  const content: Array<Record<string, any>> = [
    {
      type: 'text',
      text: prompt,
    },
  ];

  for (const url of mediaUrls) {
    content.push({
      type: 'image_url',
      image_url: {
        url,
      },
    });
  }

  const req = {
    model: AI_MODEL,
    messages: [
      {
        role: 'user',
        content,
      },
    ],
  };

  return req
};

const extractMessageText = (responseBody: any): string => {
  const choice = responseBody?.choices?.[0];
  const message = choice?.message;

  if (!message) {
    throw new Error('AI 响应缺少 message 字段');
  }

  const { content } = message;

  if (typeof content === 'string') {
    return content;
  }

  if (Array.isArray(content)) {
    const merged = content
      .map((item: any) => {
        if (!item || typeof item !== 'object') {
          return '';
        }
        if (typeof item.text === 'string') {
          return item.text;
        }
        if (typeof item.content === 'string') {
          return item.content;
        }
        return '';
      })
      .join('');

    if (merged.trim().length === 0) {
      throw new Error('AI 响应 content 数组不包含文本内容');
    }

    return merged;
  }

  throw new Error('AI 响应 content 类型未知');
};

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

const markAnalysisStatus = async (
  noteId: string,
  nextStatus: string,
  payload: Record<string, any> = {},
) => {
  const supabase = getServiceSupabaseClient();
  const { error } = await supabase
    .from('qiangua_note_info')
    .update({
      AiStatus: nextStatus,
      ...payload,
    })
    .eq('NoteId', noteId);

  if (error) {
    throw new Error(
      `更新笔记 ${noteId} 状态为 ${nextStatus} 失败: ${error.message}`,
    );
  }
};

const lockNoteForAnalysis = async (note: NoteRecord) => {
  const supabase = getServiceSupabaseClient();

  let query = supabase
    .from('qiangua_note_info')
    .update({ AiStatus: '分析中' })
    .eq('NoteId', note.NoteId)
    .lt('CreatedAt', new Date().toISOString());

  if (note.AiStatus === null || note.AiStatus === undefined) {
    query = query.is('AiStatus', null);
  } else {
    query = query.eq('AiStatus', note.AiStatus);
  }

  const { error, data } = await query.select('NoteId');

  if (error) {
    throw new Error(`锁定笔记 ${note.NoteId} 失败: ${error.message}`);
  }

  if (!data || data.length === 0) {
    throw new Error(`笔记 ${note.NoteId} 已被其他任务处理`);
  }
};

const processAiAnalysis = async (note: NoteRecord) => {
  console.log('song processAiAnalysis begin')
  const supabase = getServiceSupabaseClient();

  try {
    const mediaUrls = collectMediaUrls(note);
    const prompt = buildNoteAnalysisPrompt(note);
    console.log('song processAiAnalysis 01')
    const aiResponse = await fetch(AI_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${AI_API_TOKEN}`,
      },
      body: JSON.stringify(buildAiRequestPayload(prompt, mediaUrls)),
    });
    if (!aiResponse.ok) {
      let errorText: string | null = null;
      try {
        errorText = await aiResponse.text();
      } catch {
        errorText = aiResponse.statusText;
      }
      console.log('song processAiAnalysis err:', errorText)
      throw new Error(
        `AI 接口返回错误: ${aiResponse.status} ${errorText ?? ''}`.trim(),
      );
    }

    let responseBody: any;
    let responseText: string;
    try {
      responseText = await aiResponse.text();
      console.log('song processAiAnalysis responseText:', responseText)
      responseBody = JSON.parse(responseText);
      console.log('song processAiAnalysis 03')
    } catch (error: any) {
      throw new Error(`AI 接口响应解析失败: ${error.message}`);
    }
    console.log('song processAiAnalysis end')
    const messageText = extractMessageText(responseBody);
    const aiResult = parseAiResponseContent(messageText);

    const { error: updateError } = await supabase
      .from('qiangua_note_info')
      .update({
        AiStatus: '分析成功',
        AiSummary: aiResult.summary,
        AiContentType: aiResult.contentType,
        AiRelatedProducts: aiResult.relatedProducts,
        AiJson: responseText,
      })
      .eq('NoteId', note.NoteId);
    if (updateError) {
      throw new Error(
        `写入笔记 ${note.NoteId} AI 分析结果失败: ${
          updateError.message ?? '未知错误'
        }`,
      );
    }
  } catch (error: any) {
    try {
      await markAnalysisStatus(note.NoteId, '分析失败', {
        AiSummary: null,
        AiContentType: null,
        AiRelatedProducts: null,
        AiJson: null,
      });
    } catch (statusError) {
      console.error(
        `Failed to mark note ${note.NoteId} as 分析失败:`,
        statusError,
      );
    }
  }
};

export async function GET() {
  const supabase = getServiceSupabaseClient();
  let currentNote: NoteRecord | null = null;

  try {
    const {
      data: inProgress,
      error: inProgressError,
      count: inProgressCount,
    } = await supabase
      .from('qiangua_note_info')
      .select('NoteId', { count: 'exact' })
      .eq('AiStatus', '分析中')
      .lt('CreatedAt', new Date().toISOString());

    console.log('song inProgressCount：', inProgressCount)

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

    currentNote = await fetchNextPendingNote(supabase);

    if (!currentNote) {
      return createResponse({
        success: true,
        data: null,
        message: '暂无待分析笔记',
      });
    }

    await lockNoteForAnalysis(currentNote);

    // 发起 AI 分析请求，不等待结果，在后台异步处理
    processAiAnalysis(currentNote).catch((error) => {
      console.error(`异步处理 AI 分析失败:`, error);
    });

    // 立即返回成功响应
    return createResponse({
      success: true,
      data: {
        noteId: currentNote.NoteId,
        message: 'AI 分析任务已启动，正在后台处理',
      },
    });
  } catch (error: any) {
    console.error('AI note analysis failed:', error);

    if (error?.message?.includes('笔记') && error?.message?.includes('处理')) {
      return createResponse(
        {
          success: false,
          error: error.message,
        },
        409,
      );
    }

    if (currentNote?.NoteId) {
      try {
        await markAnalysisStatus(currentNote.NoteId, '分析失败', {
          AiSummary: null,
          AiContentType: null,
          AiRelatedProducts: null,
          AiJson: null,
        });
      } catch (statusError) {
        console.error(
          `Failed to mark note ${currentNote.NoteId} as 分析失败:`,
          statusError,
        );
      }
    }

    return createResponse(
      {
        success: false,
        error: error?.message ?? 'AI 分析失败',
      },
      500,
    );
  }
}


