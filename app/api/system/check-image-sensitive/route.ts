import { NextRequest, NextResponse } from 'next/server';
import { getSystemConfig, CONFIG_KEYS } from '@/lib/systemConfig';
import { getAiProvider, getAiModel } from '@/lib/ai/noteAnalysis';
import { AI_API_URL, AI_API_TOKEN } from '@/lib/ai/noteAnalysis';
import { OpenRouter } from '@openrouter/sdk';

export const dynamic = 'force-dynamic';

/**
 * 提取图片 ID（纯 imageId，不含前缀）
 */
function extractImageId(imageUrl: string): string | null {
  try {
    const url = new URL(imageUrl);
    const segments = url.pathname.split('/').filter(Boolean);
    
    if (segments.length >= 2) {
      const last = segments[segments.length - 1];
      // 去掉 ! 及之后的部分
      const bangIndex = last.indexOf('!');
      const imageId = bangIndex >= 0 ? last.slice(0, bangIndex) : last;
      return imageId;
    }
    
    // 兜底：正则提取
    const match = url.pathname.match(/\/([^\/]+?)(?:!|$)/);
    return match ? match[1] : null;
  } catch {
    return null;
  }
}

/**
 * 构建图片敏感检测提示词
 */
function buildImageSensitiveCheckPrompt(): string {
  return [
    '### **# 任务定义**',
    '用一句话描述图片的主要内容。',
    '',
    '#### **特别强调：**',
    '请严格遵循以下输出格式和字段不要添加任何其他字段，保证出现 summary字段。',
    '你**只**输出给我下面格式的数据。所有输出内容必须是一个**合法**的JSON对象，并使用 `^DT^` 进行包裹，方便后续进行程序化解析。',
    '',
    '**输出格式如下：**',    
    '^DT^',
    '  {',
    '    "summary": "一句话描述",',
    '  }',
    '^DT^',
  ].join('\n');
}

/**
 * 解析 AI 响应，判断是否敏感
 */
function parseSensitiveCheckResponse(content: string): { description: string; isSensitive: boolean } {
  const trimmed = typeof content === 'string' ? content.trim() : '';

  // 如果返回 'ext'，视为敏感
  if (trimmed === 'ext') {
    return { description: '', isSensitive: true };
  }

  // 尝试解析 JSON
  const match = content.match(/\^DT\^[\s\S]*?\^DT\^/);
  if (!match) {
    // 无法解析 JSON，视为敏感
    return { description: '', isSensitive: true };
  }

  const rawJsonBlock = match[0];
  let jsonPayload = rawJsonBlock.replace(/\^DT\^/g, '').trim();
  jsonPayload = jsonPayload.replace(/^```json\s*/i, '').replace(/\s*```$/g, '').trim();

  try {
    const parsed = JSON.parse(jsonPayload);
    if (typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)) {
      const summary = (parsed as Record<string, unknown>).summary;
      if (typeof summary === 'string' && summary.trim().length > 0) {
        return { description: summary.trim(), isSensitive: false };
      }
    }
  } catch {
    // JSON 解析失败，视为敏感
    return { description: '', isSensitive: true };
  }

  // 其他情况视为敏感
  return { description: '', isSensitive: true };
}

/**
 * 使用 ChatAI 检测图片敏感内容
 */
async function checkWithChatAI(imageUrl: string, model: string): Promise<string> {
  const prompt = buildImageSensitiveCheckPrompt();
  
  const payload = {
    model,
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'text',
            text: prompt,
          },
          {
            type: 'image_url',
            image_url: {
              url: imageUrl,
            },
          },
        ],
      },
    ],
  };

  const response = await fetch(AI_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${AI_API_TOKEN}`,
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => response.statusText);
    throw new Error(`ChatAI 接口返回错误: ${response.status} ${errorText}`);
  }

  const responseBody = await response.json();
  const choice = responseBody?.choices?.[0];
  const message = choice?.message;

  if (!message) {
    throw new Error('ChatAI 响应缺少 message 字段');
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
}

/**
 * 使用 OpenRouter 检测图片敏感内容
 */
async function checkWithOpenRouter(imageUrl: string, model: string): Promise<string> {
  const apiKey = await getSystemConfig(CONFIG_KEYS.OPENROUTER_API_KEY);
  if (!apiKey || apiKey.trim().length === 0) {
    throw new Error('OpenRouter API Key 未配置');
  }

  const client = new OpenRouter({
    apiKey: apiKey.trim(),
  });

  const prompt = buildImageSensitiveCheckPrompt();
  
  // 转换模型名称
  const openRouterModel = model.startsWith('google/') 
    ? model 
    : `google/${model}`;

  const messageContent: any[] = [
    {
      type: 'text',
      text: prompt,
    },
    {
      type: 'image_url',
      imageUrl: { url: imageUrl },
    },
  ];

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

  const content = (completion.choices[0]?.message?.content as string) || '';
  return content;
}

/**
 * POST /api/system/check-image-sensitive
 * 检测单张图片是否敏感
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { imageUrl, noteId } = body;

    if (!imageUrl || typeof imageUrl !== 'string') {
      return NextResponse.json(
        { success: false, error: '缺少图片URL' },
        { status: 400 }
      );
    }

    // 提取图片 ID
    const imageId = extractImageId(imageUrl);
    if (!imageId) {
      return NextResponse.json(
        { success: false, error: '无法提取图片ID' },
        { status: 400 }
      );
    }

    // 获取 AI 配置
    const provider = await getAiProvider();
    const model = await getAiModel();

    // 调用 AI 检测
    let aiResponse: string;
    try {
      if (provider === 'openrouter') {
        aiResponse = await checkWithOpenRouter(imageUrl, model);
      } else {
        aiResponse = await checkWithChatAI(imageUrl, model);
      }
    } catch (error: any) {
      // AI 调用失败，视为敏感
      return NextResponse.json({
        success: true,
        data: {
          imageUrl,
          imageId,
          description: '',
          isSensitive: true,
          error: error.message || 'AI检测失败',
        },
      });
    }

    // 解析响应
    const { description, isSensitive } = parseSensitiveCheckResponse(aiResponse);

    return NextResponse.json({
      success: true,
      data: {
        imageUrl,
        imageId,
        description,
        isSensitive,
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        success: false,
        error: error.message || '检测失败，请重试',
      },
      { status: 500 }
    );
  }
}

