/**
 * ChatAI 提供商实现
 * 使用 ChatAI 的 Gemini API 进行笔记分析
 */

import type { NoteRecord, AiAnalysisResult } from '../noteAnalysis';
import {
  collectMediaUrls,
  buildNoteAnalysisPrompt,
  parseAiResponseContent,
  AI_API_URL,
  AI_API_TOKEN,
} from '../noteAnalysis';

/**
 * 构建 ChatAI 请求的 payload
 */
const buildChatAiRequestPayload = (prompt: string, mediaUrls: string[], model: string) => {
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
    model,
    messages: [
      {
        role: 'user',
        content,
      },
    ],
  };
};

/**
 * 从 ChatAI 响应中提取文本内容
 */
const extractChatAiMessageText = (responseBody: any): string => {
  const choice = responseBody?.choices?.[0];
  const message = choice?.message;

  if (!message) {
    const responseBodyStr = JSON.stringify(responseBody, null, 2);
    console.error('ChatAI 响应缺少 message 字段，完整响应:', responseBodyStr);
    throw new Error(`ChatAI 响应缺少 message 字段。完整响应: ${responseBodyStr}`);
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
      throw new Error('ChatAI 响应 content 数组不包含文本内容');
    }

    return merged;
  }

  throw new Error('ChatAI 响应 content 类型未知');
};

/**
 * 执行 ChatAI 分析
 * @param note 笔记记录
 * @param model 模型名称
 * @returns 分析结果和响应文本
 */
export const executeChatAiAnalysis = async (
  note: NoteRecord,
  model: string,
): Promise<{
  aiResult: AiAnalysisResult;
  responseText: string;
}> => {
  // 1. 收集媒体 URL
  const mediaUrls = collectMediaUrls(note);

  // 2. 构建 Prompt
  const prompt = buildNoteAnalysisPrompt(note);

  // 3. 构建请求 payload
  const payload = buildChatAiRequestPayload(prompt, mediaUrls, model);

  // 4. 调用 ChatAI API
  const aiResponse = await fetch(AI_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${AI_API_TOKEN}`,
    },
    body: JSON.stringify(payload),
  });

  if (!aiResponse.ok) {
    let errorText: string | null = null;
    try {
      errorText = await aiResponse.text();
    } catch {
      errorText = aiResponse.statusText;
    }
    throw new Error(
      `ChatAI 接口返回错误: ${aiResponse.status} ${errorText ?? ''}\nPayload: ${JSON.stringify(payload)}`.trim(),
    );
  }

  // 5. 解析响应
  let responseBody: any;
  let responseText: string;
  try {
    responseText = await aiResponse.text();
    responseBody = JSON.parse(responseText);
  } catch (error: any) {
    throw new Error(`ChatAI 接口响应解析失败: ${error.message}\nPayload: ${JSON.stringify(payload)}`);
  }

  // 6. 提取消息文本
  const messageText = extractChatAiMessageText(responseBody);

  // 7. 解析 AI 响应内容
  const aiResult = parseAiResponseContent(messageText);

  return {
    aiResult,
    responseText,
  };
};

