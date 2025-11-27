# OpenRouter 客户端封装

参考 Java 版本 DTO 结构，提供灵活的 OpenRouter API 调用封装。

## 功能特性

- ✅ 完整的类型定义（TypeScript）
- ✅ 支持纯文本对话
- ✅ 支持多模态对话（文本 + 图片）
- ✅ 支持自定义消息列表
- ✅ 灵活的配置选项
- ✅ 类似 Java Builder 模式的消息构建器

## 基础使用

### 1. 创建客户端

```typescript
import { createOpenRouterClient } from '@/lib/openrouter';

const client = createOpenRouterClient({
  apiKey: 'your-api-key',
  siteUrl: 'https://your-site.com',
  siteName: 'Your Site Name',
  defaultModel: 'openai/gpt-4o',
  defaultMaxTokens: 4096,
  defaultTemperature: 0.7,
});
```

### 2. 简单文本对话

```typescript
// 最简单的用法
const response = await client.sendText('你好，请介绍一下你自己');
console.log(response);

// 带参数
const response = await client.sendText('解释量子力学', {
  model: 'anthropic/claude-3.5-sonnet',
  maxTokens: 2000,
  temperature: 0.5,
  systemPrompt: '你是一个物理学教授',
});
```

### 3. 多模态对话（文本 + 图片）

```typescript
const response = await client.sendMultiModal(
  '请分析这些图片中的内容',
  [
    'https://example.com/image1.jpg',
    'https://example.com/image2.jpg',
  ],
  {
    model: 'openai/gpt-4o',
    maxTokens: 4096,
  }
);
```

### 4. 自定义消息列表

```typescript
import { MessageBuilder } from '@/lib/openrouter';

// 多轮对话
const response = await client.sendMessages([
  { role: 'system', content: '你是一个有帮助的助手' },
  { role: 'user', content: '什么是 AI？' },
  { role: 'assistant', content: 'AI 是人工智能的缩写...' },
  { role: 'user', content: '它有什么应用？' },
]);

console.log(response.choices[0].message.content);
console.log('Token 使用:', response.usage);
```

### 5. 使用消息构建器

```typescript
import { MessageBuilder } from '@/lib/openrouter';

// 构建复杂的多模态消息
const message = new MessageBuilder()
  .addText('请分析以下图片：')
  .addImage('https://example.com/image1.jpg')
  .addImage('https://example.com/image2.jpg')
  .addText('重点关注色彩和构图')
  .build('user');

const response = await client.sendMessages([message]);
```

## 类型定义

### ChatRequest

```typescript
interface ChatRequest {
  model: string;                    // 模型名称
  messages: Message[];              // 消息列表
  max_tokens?: number;              // 最大 token 数
  temperature?: number;             // 温度参数 (0-1)
  stream?: boolean;                 // 是否流式响应
}
```

### Message

```typescript
interface Message {
  role: 'user' | 'assistant' | 'system';
  content: string | MessageContent[];
}

type MessageContent = ContentText | ContentImage;

interface ContentText {
  type: 'text';
  text: string;
}

interface ContentImage {
  type: 'image_url';
  image_url: { url: string };
}
```

### ChatResponse

```typescript
interface ChatResponse {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: {
    index: number;
    message: {
      role: string;
      content: string;
    };
    finish_reason: string;
  }[];
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}
```

## 在 API 路由中使用

```typescript
// app/api/your-api/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createOpenRouterClient } from '@/lib/openrouter';

export async function POST(request: NextRequest) {
  const { message, imageUrls } = await request.json();

  const client = createOpenRouterClient({
    apiKey: process.env.OPENROUTER_API_KEY!,
    siteUrl: 'https://your-site.com',
    siteName: 'Your Site',
  });

  try {
    let content;
    if (imageUrls && imageUrls.length > 0) {
      content = await client.sendMultiModal(message, imageUrls);
    } else {
      content = await client.sendText(message);
    }

    return NextResponse.json({
      success: true,
      data: { content },
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
```

## 支持的模型

常用模型：
- `openai/gpt-4o` - GPT-4 Omni
- `anthropic/claude-3.5-sonnet` - Claude 3.5 Sonnet
- `google/gemini-2.0-flash-exp` - Gemini 2.0 Flash
- `meta-llama/llama-3.1-70b-instruct` - Llama 3.1 70B

更多模型请参考：https://openrouter.ai/docs#models

## 注意事项

1. **API Key 安全**：请使用环境变量存储 API Key
2. **HTTP 头部限制**：`siteUrl` 和 `siteName` 不支持中文字符
3. **Token 消耗**：注意监控 `usage` 字段，控制成本
4. **图片格式**：支持公开可访问的 HTTP(S) 图片 URL

## 完整示例

参考测试接口：`app/api/test-openrouter/route.ts`

