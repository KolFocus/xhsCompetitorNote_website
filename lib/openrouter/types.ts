/**
 * OpenRouter API 类型定义
 * 参考 Java DTO 结构
 */

// 消息内容类型
export interface ContentText {
  type: 'text';
  text: string;
}

export interface ContentImage {
  type: 'image_url';
  image_url: {
    url: string;
  };
}

export type MessageContent = ContentText | ContentImage;

// 消息定义
export interface Message {
  role: 'user' | 'assistant' | 'system';
  content: string | MessageContent[];
}

// 请求参数
export interface ChatRequest {
  model: string;
  messages: Message[];
  max_tokens?: number;
  temperature?: number;
  stream?: boolean;
}

// 响应定义
export interface ChatResponse {
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

// 构建器辅助函数
export class MessageBuilder {
  private contents: MessageContent[] = [];

  addText(text: string): MessageBuilder {
    this.contents.push({
      type: 'text',
      text,
    });
    return this;
  }

  addImage(url: string): MessageBuilder {
    this.contents.push({
      type: 'image_url',
      image_url: { url },
    });
    return this;
  }

  build(role: Message['role'] = 'user'): Message {
    return {
      role,
      content: this.contents,
    };
  }

  static createTextMessage(role: Message['role'], text: string): Message {
    return {
      role,
      content: text,
    };
  }
}

