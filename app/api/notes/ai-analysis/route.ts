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
const AI_REQUEST_TIMEOUT_MS = 60_000;

export const runtime = 'nodejs';

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

  return {
    model: AI_MODEL,
    messages: [
      {
        role: 'user',
        content,
      },
    ],
  };
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
    .eq('NoteId', note.NoteId);

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

export async function POST() {
  const supabase = getServiceSupabaseClient();
  let currentNote: NoteRecord | null = null;

  try {
    const {
      data: inProgress,
      error: inProgressError,
    } = await supabase
      .from('qiangua_note_info')
      .select('NoteId')
      .eq('AiStatus', '分析中')
      .limit(1);

    if (inProgressError) {
      throw new Error(
        `检查分析中笔记失败: ${inProgressError.message ?? '未知错误'}`,
      );
    }

    if (Array.isArray(inProgress) && inProgress.length > 0) {
      return NextResponse.json({
        success: true,
        data: null,
        message: '存在分析中的笔记，跳过本次任务',
      });
    }

    currentNote = await fetchNextPendingNote(supabase);

    if (!currentNote) {
      return NextResponse.json({
        success: true,
        data: null,
        message: '暂无待分析笔记',
      });
    }

    await lockNoteForAnalysis(currentNote);

    const mediaUrls = collectMediaUrls(currentNote);
    const prompt = buildNoteAnalysisPrompt(currentNote, mediaUrls);

    const controller = new AbortController();
    const timeoutId = setTimeout(
      () => controller.abort(),
      AI_REQUEST_TIMEOUT_MS,
    );

    let aiResponse;
    try {
      aiResponse = await fetch(AI_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${AI_API_TOKEN}`,
        },
        body: JSON.stringify(buildAiRequestPayload(prompt, mediaUrls)),
        signal: controller.signal,
      });
    } catch (error: any) {
      if (error?.name === 'AbortError') {
        throw new Error('AI 请求超时');
      }
      throw error;
    } finally {
      clearTimeout(timeoutId);
    }

    if (!aiResponse.ok) {
      let errorText: string | null = null;
      try {
        errorText = await aiResponse.text();
      } catch {
        errorText = aiResponse.statusText;
      }

      throw new Error(
        `AI 接口返回错误: ${aiResponse.status} ${errorText ?? ''}`.trim(),
      );
    }

    let responseBody: any;
    try {
      responseBody = await aiResponse.json();
    } catch (error: any) {
      throw new Error(`AI 接口响应解析失败: ${error.message}`);
    }

    const messageText = extractMessageText(responseBody);
    const aiResult = parseAiResponseContent(messageText);

    const { error: updateError } = await supabase
      .from('qiangua_note_info')
      .update({
        AiStatus: '分析成功',
        AiSummary: aiResult.summary,
        AiContentType: aiResult.contentType,
        AiRelatedProducts: aiResult.relatedProducts,
        AiJson: aiResult.rawJsonBlock,
      })
      .eq('NoteId', currentNote.NoteId);

    if (updateError) {
      throw new Error(
        `写入笔记 ${currentNote.NoteId} AI 分析结果失败: ${
          updateError.message ?? '未知错误'
        }`,
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        noteId: currentNote.NoteId,
        summary: aiResult.summary,
        contentType: aiResult.contentType,
        relatedProducts: aiResult.relatedProducts,
        aiJson: aiResult.rawJsonBlock,
        mediaCount: mediaUrls.length,
      },
    });
  } catch (error: any) {
    console.error('AI note analysis failed:', error);

    if (error?.message?.includes('笔记') && error?.message?.includes('处理')) {
      return NextResponse.json(
        {
          success: false,
          error: error.message,
        },
        { status: 409 },
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

    return NextResponse.json(
      {
        success: false,
        error: error?.message ?? 'AI 分析失败',
      },
      { status: 500 },
    );
  }
}


