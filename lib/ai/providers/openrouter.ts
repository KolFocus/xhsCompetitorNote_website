/**
 * OpenRouter 提供商实现
 * 使用 OpenRouter 的多渠道 API 进行笔记分析
 */

import type { NoteRecord, AiAnalysisResult } from '../noteAnalysis';
import {
  collectMediaUrlsSeparated,
  buildNoteAnalysisPrompt,
  parseAiResponseContent,
} from '../noteAnalysis';
import { OpenRouter } from '@openrouter/sdk';
import { getSystemConfig, CONFIG_KEYS } from '@/lib/systemConfig';
import { log } from '@/lib/logger';

/**
 * 下载远程视频并转为 Base64 Data URI
 */
async function fetchVideoAsBase64(url: string): Promise<string> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`视频下载失败: ${response.status} ${response.statusText}`);
  }

  const contentType = response.headers.get('content-type') || 'video/mp4';
  const arrayBuffer = await response.arrayBuffer();
  const base64 = Buffer.from(arrayBuffer).toString('base64');

  return `data:${contentType};base64,${base64}`;
}

/**
 * 执行 OpenRouter 分析
 * @param note 笔记记录
 * @param model 模型名称（gemini-2.0-flash / gemini-2.5-flash / gemini-2.5-pro）
 * @returns 分析结果和响应文本
 */
export const executeOpenRouterAnalysis = async (
  note: NoteRecord,
  model: string,
): Promise<{
  aiResult: AiAnalysisResult;
  responseText: string;
}> => {
  // 1. 从数据库获取 OpenRouter API Key
  const apiKey = await getSystemConfig(CONFIG_KEYS.OPENROUTER_API_KEY);
  if (!apiKey || apiKey.trim().length === 0) {
    throw new Error('OpenRouter API Key 未配置，请在系统设置中配置');
  }

  const trimmedApiKey = apiKey.trim();
  
  // 记录 API Key 信息（只显示前后几位）
  log.info('OpenRouter API Key 检查', {
    keyLength: trimmedApiKey.length,
    keyPrefix: trimmedApiKey.substring(0, 12),
    keySuffix: trimmedApiKey.substring(trimmedApiKey.length - 4),
    startsWithCorrectPrefix: trimmedApiKey.startsWith('sk-or-v1-'),
  });

  // 2. 创建 OpenRouter 客户端
  const client = new OpenRouter({
    apiKey: trimmedApiKey,
  });

  // 3. 分别收集图片和视频 URL
  const { imageUrls, videoUrls } = collectMediaUrlsSeparated(note);

  // 4. 构建 Prompt
  const prompt = buildNoteAnalysisPrompt(note);

  // 5. 将模型名称转换为 OpenRouter 格式
  const openRouterModel = convertToOpenRouterModel(model);

  log.info('OpenRouter 分析开始', {
    noteId: note.NoteId,
    model: openRouterModel,
    imageCount: imageUrls.length,
    videoCount: videoUrls.length,
  });

  // 6. 构建消息内容
  const messageContent: any[] = [
    {
      type: 'text',
      text: prompt,
    },
  ];

  // 添加图片（注意：OpenRouter SDK 使用驼峰命名 imageUrl）
  imageUrls.forEach((url) => {
    messageContent.push({
      type: 'image_url',
      imageUrl: { url },  // 使用 imageUrl 而不是 image_url
    });
  });

  // 添加视频：将视频下载为 Base64 Data URI，再传递给模型
  for (const url of videoUrls) {
    try {
      const base64Video = await fetchVideoAsBase64(url);
      messageContent.push({
        type: 'video_url',
        videoUrl: { url: base64Video },
      });
    } catch (error: any) {
      log.error('下载视频失败', { noteId: note.NoteId, videoUrl: url }, error?.message || error);
      throw new Error(`下载视频失败，无法传递给模型: ${url}`);
    }
  }

  // 7. 调用 OpenRouter API
  const completion = await client.chat.send(
    {
      model: openRouterModel,
      messages: [
        {
          role: 'user',
          content: messageContent as any,
        },
      ],
      stream: false,
    },
    {
      headers: {
        'HTTP-Referer': 'https://xhs-competitor-note.com',
        'X-Title': 'XHS Competitor Note System',
      },
    }
  );
  console.log('OpenRouter 响应:', JSON.stringify(completion));

  const content = (completion.choices[0]?.message?.content as string) || '';

  // 8. 解析 AI 响应内容
  const aiResult = parseAiResponseContent(content);

  return {
    aiResult,
    responseText: content,
  };
};

/**
 * 将模型名称转换为 OpenRouter 格式
 * @param model 原始模型名称
 * @returns OpenRouter 模型名称
 */
function convertToOpenRouterModel(model: string): string {
  const modelMap: Record<string, string> = {
    'gemini-2.0-flash': 'google/gemini-2.0-flash',
    'gemini-2.5-flash': 'google/gemini-2.5-flash',
    'gemini-2.5-pro': 'google/gemini-2.5-pro',
  };

  // 如果已经是 google/ 开头的格式，直接返回
  if (model.startsWith('google/')) {
    return model;
  }

  // 转换为 OpenRouter 格式
  const converted = modelMap[model];
  if (!converted) {
    console.warn(`未知的模型名称: ${model}, 使用默认模型 google/gemini-2.5-flash`);
    return 'google/gemini-2.5-flash';
  }

  return converted;
}

