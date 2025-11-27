/**
 * OpenRouter API 客户端封装
 * 参考 Java 版本结构，提供更灵活的函数调用
 */

import { OpenRouter } from '@openrouter/sdk';
import type { ChatRequest, ChatResponse, Message, MessageBuilder } from './types';

export interface OpenRouterConfig {
  apiKey: string;
  siteUrl?: string;
  siteName?: string;
  defaultModel?: string;
  defaultMaxTokens?: number;
  defaultTemperature?: number;
}

export class OpenRouterClient {
  private client: OpenRouter;
  private config: OpenRouterConfig;

  constructor(config: OpenRouterConfig) {
    this.config = config;
    this.client = new OpenRouter({
      apiKey: config.apiKey,
    });
  }

  /**
   * 发送聊天请求
   */
  async chat(request: ChatRequest): Promise<ChatResponse> {
    const response = await this.client.chat.send(
      {
        model: request.model || this.config.defaultModel || 'openai/gpt-4o',
        messages: request.messages as any,
        stream: request.stream ?? false,
        ...(request.max_tokens && { max_tokens: request.max_tokens }),
        ...(request.temperature !== undefined && { temperature: request.temperature }),
      },
      {
        headers: {
          ...(this.config.siteUrl && { 'HTTP-Referer': this.config.siteUrl }),
          ...(this.config.siteName && { 'X-Title': this.config.siteName }),
        },
      }
    );

    return response as ChatResponse;
  }

  /**
   * 简单文本对话
   */
  async sendText(
    message: string,
    options?: {
      model?: string;
      maxTokens?: number;
      temperature?: number;
      systemPrompt?: string;
    }
  ): Promise<string> {
    const messages: Message[] = [];

    if (options?.systemPrompt) {
      messages.push({
        role: 'system',
        content: options.systemPrompt,
      });
    }

    messages.push({
      role: 'user',
      content: message,
    });

    const response = await this.chat({
      model: options?.model || this.config.defaultModel || 'openai/gpt-4o',
      messages,
      max_tokens: options?.maxTokens || this.config.defaultMaxTokens,
      temperature: options?.temperature ?? this.config.defaultTemperature,
    });

    return response.choices[0]?.message?.content || '';
  }

  /**
   * 多模态对话（文本 + 图片）
   */
  async sendMultiModal(
    textPrompt: string,
    imageUrls: string[],
    options?: {
      model?: string;
      maxTokens?: number;
      temperature?: number;
    }
  ): Promise<string> {
    const content: any[] = [
      {
        type: 'text',
        text: textPrompt,
      },
    ];

    imageUrls.forEach((url) => {
      content.push({
        type: 'image_url',
        image_url: { url },
      });
    });

    const messages: Message[] = [
      {
        role: 'user',
        content,
      },
    ];

    const response = await this.chat({
      model: options?.model || this.config.defaultModel || 'openai/gpt-4o',
      messages,
      max_tokens: options?.maxTokens || this.config.defaultMaxTokens,
      temperature: options?.temperature ?? this.config.defaultTemperature,
    });

    return response.choices[0]?.message?.content || '';
  }

  /**
   * 自定义消息列表对话
   */
  async sendMessages(
    messages: Message[],
    options?: {
      model?: string;
      maxTokens?: number;
      temperature?: number;
    }
  ): Promise<ChatResponse> {
    return await this.chat({
      model: options?.model || this.config.defaultModel || 'openai/gpt-4o',
      messages,
      max_tokens: options?.maxTokens || this.config.defaultMaxTokens,
      temperature: options?.temperature ?? this.config.defaultTemperature,
    });
  }
}

/**
 * 创建 OpenRouter 客户端实例
 */
export function createOpenRouterClient(config: OpenRouterConfig): OpenRouterClient {
  return new OpenRouterClient(config);
}

