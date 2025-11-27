/**
 * OpenRouter API 测试接口
 * GET /api/test-openrouter?message=你的问题&imageUrls=图片1,图片2（可选）
 * 
 * 查询参数：
 * - message: 用户消息内容（必需）
 * - imageUrls: 图片URL列表，用逗号分隔（可选）
 * - model: 模型名称（可选，默认 openai/gpt-4o）
 * - maxTokens: 最大 token 数（可选）
 * - temperature: 温度参数（可选，0-1）
 * 
 * 响应格式：
 * {
 *   "success": true,
 *   "data": {
 *     "content": "AI 回复内容",
 *     "model": "openai/gpt-4o",
 *     "usage": {...}
 *   }
 * }
 */

import { NextRequest, NextResponse } from 'next/server';
import { createOpenRouterClient } from '@/lib/openrouter';

// 硬编码配置（测试用）
const OPENROUTER_CONFIG = {
  apiKey: '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',
  siteUrl: 'https://xhs-competitor-note.com',
  siteName: 'XHS Competitor Note System',
  defaultModel: 'openai/gpt-4o',
  defaultMaxTokens: 4096,
  defaultTemperature: 0.7,
};

export async function GET(request: NextRequest) {
  try {
    // 从 URL 查询参数获取参数
    const searchParams = request.nextUrl.searchParams;
    const message = searchParams.get('message');
    const imageUrlsParam = searchParams.get('imageUrls');
    const model = searchParams.get('model');
    const maxTokens = searchParams.get('maxTokens');
    const temperature = searchParams.get('temperature');

    // 验证参数
    if (!message || typeof message !== 'string') {
      return NextResponse.json(
        {
          success: false,
          error: '缺少 message 参数或参数格式不正确',
        },
        { status: 400 }
      );
    }

    // 初始化 OpenRouter 客户端
    const client = createOpenRouterClient(OPENROUTER_CONFIG);

    console.log('开始调用 OpenRouter API...');
    console.log('用户消息:', message);

    // 解析图片 URL
    const imageUrls = imageUrlsParam
      ? imageUrlsParam.split(',').map((url) => url.trim()).filter(Boolean)
      : [];

    if (imageUrls.length > 0) {
      console.log('包含图片:', imageUrls.length, '张');
    }

    // 构建选项
    const options = {
      model: model || undefined,
      maxTokens: maxTokens ? parseInt(maxTokens, 10) : undefined,
      temperature: temperature ? parseFloat(temperature) : undefined,
    };

    // 调用 OpenRouter API
    let response;
    if (imageUrls.length > 0) {
      // 多模态调用
      const content = await client.sendMultiModal(message, imageUrls, options);
      response = {
        content,
        model: options.model || OPENROUTER_CONFIG.defaultModel,
      };
    } else {
      // 纯文本调用
      const content = await client.sendText(message, options);
      response = {
        content,
        model: options.model || OPENROUTER_CONFIG.defaultModel,
      };
    }

    console.log('OpenRouter API 调用成功');

    // 返回结果
    return NextResponse.json({
      success: true,
      data: response,
    });
  } catch (error: any) {
    console.error('OpenRouter API 调用失败:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || '调用 OpenRouter API 失败',
        details: error.response?.data || null,
      },
      { status: 500 }
    );
  }
}

// POST 方法用于测试接口说明
export async function POST(request: NextRequest) {
  return NextResponse.json({
    success: true,
    message: 'OpenRouter 测试接口运行正常',
    usage: '使用 GET 方法，通过 URL 参数传入 message 来测试',
    examples: [
      {
        name: '简单文本对话',
        method: 'GET',
        url: '/api/test-openrouter?message=What is the meaning of life?',
      },
      {
        name: '带图片的多模态对话',
        method: 'GET',
        url: '/api/test-openrouter?message=描述这些图片&imageUrls=https://example.com/1.jpg,https://example.com/2.jpg',
      },
      {
        name: '自定义模型和参数',
        method: 'GET',
        url: '/api/test-openrouter?message=你好&model=openai/gpt-4o&maxTokens=2000&temperature=0.5',
      },
    ],
    availableParams: {
      message: '消息内容（必需）',
      imageUrls: '图片URL列表，逗号分隔（可选）',
      model: '模型名称（可选）',
      maxTokens: '最大token数（可选）',
      temperature: '温度参数 0-1（可选）',
    },
  });
}

