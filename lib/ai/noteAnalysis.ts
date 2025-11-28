import type { SupabaseClient } from '@supabase/supabase-js';

import { log } from '@/lib/logger';
import { getServiceSupabaseClient } from '@/lib/supabase/admin';
import { getSystemConfig, CONFIG_KEYS } from '@/lib/systemConfig';
import { fixImageUrl } from '@/lib/utils/dataTransform';

// AI 配置常量
export const AI_API_URL = 'https://www.chataiapi.com/v1/chat/completions';
export const AI_API_TOKEN = 'sk-elbujPUOtXGyEC8TnnesrJpXpYJGRPANv9qRGUEaEHiSNwAT';
export const AI_MODEL_DEFAULT = 'gemini-2.5-flash'; // 默认模型

/**
 * 获取当前AI模型配置
 */
export const getAiModel = async (): Promise<string> => {
  const model = await getSystemConfig(CONFIG_KEYS.AI_MODEL);
  return model || AI_MODEL_DEFAULT;
};

/**
 * 获取当前AI提供商配置
 */
export const getAiProvider = async (): Promise<'chatai' | 'openrouter'> => {
  const provider = await getSystemConfig(CONFIG_KEYS.AI_PROVIDER);
  if (provider === 'openrouter') {
    return 'openrouter';
  }
  return 'chatai'; // 默认使用 chatai
};

export interface NoteRecord extends Record<string, any> {
  NoteId: string;
  XhsNoteId?: string | null;
  XhsNoteUrl?: string | null;
  XhsTitle?: string | null;
  XhsContent?: string | null;
  XhsImages?: string | null;
  XhsVideo?: string | null;
  AiStatus?: string | null;
  CreatedAt?: string | null;
}

export interface AiAnalysisResult {
  summary: string;
  contentType: string;
  relatedProducts: string;
  rawJsonBlock: string;
}

const isHttpUrl = (value: string): boolean => /^https?:\/\//i.test(value);

const normalizeUrl = (value: string | null | undefined): string | null => {
  if (!value || typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  const fixed = fixImageUrl(trimmed);
  if (fixed && isHttpUrl(fixed)) {
    return fixed;
  }

  if (trimmed.startsWith('//')) {
    return `https:${trimmed}`;
  }

  return isHttpUrl(trimmed) ? trimmed : null;
};

export const collectMediaUrls = (note: NoteRecord): string[] => {
  const urlSet = new Set<string>();

  // 处理 XhsImages：逗号分隔的图片链接集合，只取前 12 个
  if (note.XhsImages && typeof note.XhsImages === 'string') {
    const imageUrls = note.XhsImages
      .split(',')
      .map((url) => url.trim())
      .filter((url) => url.length > 0)
      .slice(0, 12); // 只取前 12 个链接

    for (const url of imageUrls) {
      const normalized = normalizeUrl(url);
      if (normalized) {
        urlSet.add(normalized);
      }
    }
  }

  // 处理 XhsVideo：视频链接（可能为空）
  if (note.XhsVideo && typeof note.XhsVideo === 'string') {
    const normalized = normalizeUrl(note.XhsVideo);
    if (normalized) {
      urlSet.add(normalized);
    }
  }

  return Array.from(urlSet);
};

/**
 * 分别收集图片和视频URL
 * @param note 笔记记录
 * @returns 包含图片URL数组和视频URL数组的对象
 */
export const collectMediaUrlsSeparated = (note: NoteRecord): {
  imageUrls: string[];
  videoUrls: string[];
} => {
  const imageUrlSet = new Set<string>();
  const videoUrlSet = new Set<string>();

  // 处理 XhsImages：逗号分隔的图片链接集合，只取前 12 个
  if (note.XhsImages && typeof note.XhsImages === 'string') {
    const imageUrls = note.XhsImages
      .split(',')
      .map((url) => url.trim())
      .filter((url) => url.length > 0)
      .slice(0, 12); // 只取前 12 个链接

    for (const url of imageUrls) {
      const normalized = normalizeUrl(url);
      if (normalized) {
        imageUrlSet.add(normalized);
      }
    }
  }

  // 处理 XhsVideo：视频链接（可能为空）
  if (note.XhsVideo && typeof note.XhsVideo === 'string') {
    const normalized = normalizeUrl(note.XhsVideo);
    if (normalized) {
      videoUrlSet.add(normalized);
    }
  }

  return {
    imageUrls: Array.from(imageUrlSet),
    videoUrls: Array.from(videoUrlSet),
  };
};

export const buildNoteAnalysisPrompt = (
  note: NoteRecord,
): string => {
  const title =
    typeof note.XhsTitle === 'string' && note.XhsTitle.trim().length > 0
      ? note.XhsTitle
      : '（无标题）';
  const body =
    typeof note.XhsContent === 'string' && note.XhsContent.length > 0
      ? note.XhsContent
      : '（无正文）';

  return [
    '### **# 角色定义**',
    '你是一位顶尖的**小红书内容营销分析专家**。你不仅精通卖点（USP）和买点（FAB），更深入理解小红书平台的推荐算法、用户心智和爆款笔记的底层逻辑。你擅长综合分析**笔记标题、正文、图片和视频**，输出精准、专业的营销洞察。',
    '',
    '### **# 任务定义**',
    '你的任务是根据用户提供的**小红书笔记完整素材**进行深度营销分析，总结其核心策略，并提炼关键信息。',
    '',
    '### **# 输入内容**',
    '我将为你提供以下一项或多项组合信息：',
    `1.  **笔记标题 (Title)**: ${title}`,
    `2.  **正文内容 (Body Text)**: ${body}`,
    '3.  **图片或视频 (Visuals)** [通过特定结构设置]',
    '',
    '### **# 核心分析维度**',
    '1.  **用户痛点**：笔记精准打击了用户的哪些焦虑、烦恼或不满？',
    '2.  **核心卖点**：笔记着重强调了产品的哪些功能、特性或价值？',
    '3.  **用户利益**：笔记向用户承诺了什么样的美好结果或体验？',
    '4.  **内容类型**：识别这篇笔记的整体类型、风格或创作形式。',
    '',
    '### **# 输出格式**',
    '请综合分析我提供的**所有素材**，并将分析结果整合到一个JSON对象中。',
    '',
    '*   **内容洞察总结 (summary)**：',
    '    请严格遵循 **“内容营销路径”** 框架进行总结，用一句话精准概括：**“[主体是谁] 通过 [什么内容形式]，向 [目标人群] 传递了 [产品的核心价值]，旨在 [激发何种情感或行动]。”**',
    '    *   **主体是谁**：指内容的创作者，如品牌官方、某位博主、某位明星。',
    '    *   **什么内容形式**：即下方 `contentType` 字段的内容。',
    '    *   **目标人群**：指笔记最想影响的用户画像（可从标题、内容、风格推断）。',
    '    *   **产品的核心价值**：指产品解决的核心痛点或提供的核心利益。',
    '    *   **激发何种情感或行动**：指笔记最终想达成的目的，如“激发购买欲望”、“建立品牌信任”、“引导用户收藏模仿”等。',
    '',
    '*   **内容类型 (contentType)**：',
    '    根据笔记的标题、正文结构、视觉风格和营销目的，为其分配一个最核心、最贴切的分类名称（例如：干货教程、好物合集、沉浸式Vlog、剧情短片、生活记录等）。',
    '',
    '*   **相关产品列表 (relatedProducts)**：',
    '    从正文和图片/视频中，提炼出所有被提及或暗示的相关产品。如果多于一个，请使用**英文逗号 (,)** 进行串接，形成一个**单一的字符串**。',
    '',
    '#### **特别强调：**',
    '请严格遵循以下输出格式和字段不要添加任何其他字段，但要保证同时出现 summary、contentType、relatedProducts这三个字段。',
    '你**只**输出给我下面格式的数据。所有输出内容必须是一个**合法**的JSON对象，并使用 `^DT^` 进行包裹，方便后续进行程序化解析。',
    '',
    '**输出格式如下：**',
    '^DT^',
    '  {',
    '    "summary": "内容洞察总结",',
    '    "contentType": "内容类型",',
    '    "relatedProducts": "XX品牌维C精华,XX品牌视黄醇面霜"',
    '  }',
    '^DT^',
  ].join('\n');
};

export const parseAiResponseContent = (content: string): AiAnalysisResult => {
  if (typeof content !== 'string' || content.trim().length === 0) {
    throw new Error('AI 响应为空');
  }

  const match = content.match(/\^DT\^[\s\S]*?\^DT\^/);
  if (!match) {
    throw new Error('AI 响应未包含 ^DT^ 包裹的 JSON 数据');
  }

  const rawJsonBlock = match[0];
  // 去除 ^DT^ 标记
  let jsonPayload = rawJsonBlock.replace(/\^DT\^/g, '').trim();

  // 去除可能的代码块标记（```json 和 ```）
  jsonPayload = jsonPayload.replace(/^```json\s*/i, '').replace(/\s*```$/g, '').trim();

  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonPayload);
  } catch (error) {
    throw new Error(`AI 响应 JSON 解析失败: ${(error as Error).message}`);
  }

  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    throw new Error('AI 响应 JSON 不符合预期对象结构');
  }

  const summary = (parsed as Record<string, unknown>).summary;
  const contentType = (parsed as Record<string, unknown>).contentType;
  const relatedProductsRaw = (parsed as Record<string, unknown>).relatedProducts;

  const normalizedSummary =
    typeof summary === 'string' ? summary.trim() : String(summary ?? '');
  const normalizedContentType =
    typeof contentType === 'string'
      ? contentType.trim()
      : String(contentType ?? '');

  let relatedProducts = '';
  if (Array.isArray(relatedProductsRaw)) {
    relatedProducts = relatedProductsRaw
      .map((item) => (typeof item === 'string' ? item : String(item ?? '')))
      .filter((item) => item.trim().length > 0)
      .join(',');
  } else if (
    typeof relatedProductsRaw === 'string' &&
    relatedProductsRaw.trim().length > 0
  ) {
    relatedProducts = relatedProductsRaw.trim();
  } else if (relatedProductsRaw !== undefined && relatedProductsRaw !== null) {
    relatedProducts = String(relatedProductsRaw);
  }

  if (!normalizedSummary) {
    throw new Error('AI 响应缺少 summary 字段或为空');
  }
  if (!normalizedContentType) {
    throw new Error('AI 响应缺少 contentType 字段或为空');
  }

  return {
    summary: normalizedSummary,
    contentType: normalizedContentType,
    relatedProducts,
    rawJsonBlock,
  };
};

/**
 * @deprecated 已移至 providers/chatai.ts，保留用于向后兼容
 * 构建AI请求的payload
 */
export const buildAiRequestPayload = async (prompt: string, mediaUrls: string[]) => {
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

  // 从数据库获取当前配置的模型
  const model = await getAiModel();

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
 * @deprecated 已移至 providers/chatai.ts，保留用于向后兼容
 * 从AI响应中提取文本内容
 */
export const extractMessageText = (responseBody: any): string => {
  const choice = responseBody?.choices?.[0];
  const message = choice?.message;

  if (!message) {
    // 打印完整的 responseBody 用于调试
    const responseBodyStr = JSON.stringify(responseBody, null, 2);
    console.error('AI 响应缺少 message 字段，完整响应:', responseBodyStr);
    throw new Error(`AI 响应缺少 message 字段。完整响应: ${responseBodyStr}`);
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

/**
 * 锁定笔记进行AI分析（内部函数）
 * @param supabase Supabase客户端
 * @param noteId 笔记ID
 * @param currentStatus 当前AI状态
 * @throws 如果锁定失败抛出特殊错误 'LOCK_CONFLICT'
 */
const lockNoteForAnalysis = async (
  supabase: SupabaseClient,
  noteId: string,
  currentStatus: string | null | undefined,
) => {
  let query = supabase
    .from('qiangua_note_info')
    .update({ AiStatus: '分析中' })
    .eq('NoteId', noteId)
    .lt('CreatedAt', new Date().toISOString()); // 始终检查创建时间

  // 动态处理当前状态
  if (currentStatus === null || currentStatus === undefined) {
    query = query.is('AiStatus', null);
  } else {
    query = query.eq('AiStatus', currentStatus);
  }

  const { error, data } = await query.select('NoteId');

  if (error) {
    throw new Error(`锁定笔记 ${noteId} 失败: ${error.message}`);
  }

  if (!data || data.length === 0) {
    // 乐观锁冲突：其他进程已经锁定了这个笔记
    const lockError = new Error(`笔记 ${noteId} 状态已变更，无法锁定`);
    (lockError as any).code = 'LOCK_CONFLICT';
    throw lockError;
  }
};

/**
 * 执行AI分析的核心逻辑（根据提供商自动选择实现）
 * @param note 笔记记录
 * @returns 分析结果、响应文本和使用的提供商
 */
export const executeAiAnalysis = async (note: NoteRecord) => {
  // 动态导入提供商实现，避免循环依赖
  const { executeChatAiAnalysis } = await import('./providers/chatai');
  const { executeOpenRouterAnalysis } = await import('./providers/openrouter');

  // 获取配置
  const provider = await getAiProvider();
  const model = await getAiModel();

  console.log(`AI分析: 提供商=${provider}, 模型=${model}`);

  // 根据提供商调用不同的实现
  let result: {
    aiResult: AiAnalysisResult;
    responseText: string;
  };

  if (provider === 'openrouter') {
    result = await executeOpenRouterAnalysis(note, model);
  } else {
    result = await executeChatAiAnalysis(note, model);
  }

  return {
    ...result,
    provider, // 返回使用的提供商
  };
};

/**
 * 更新分析成功状态到数据库
 * @param supabase Supabase客户端
 * @param noteId 笔记ID
 * @param aiResult AI分析结果
 * @param responseText AI响应的原始JSON文本
 * @param provider AI提供商
 */
export const updateAiAnalysisSuccess = async (
  supabase: SupabaseClient,
  noteId: string,
  aiResult: AiAnalysisResult,
  responseText: string,
  provider: string,
) => {
  const { error } = await supabase
    .from('qiangua_note_info')
    .update({
      AiStatus: '分析成功',
      AiSummary: aiResult.summary,
      AiContentType: aiResult.contentType,
      AiRelatedProducts: aiResult.relatedProducts,
      AiJson: responseText,
      AiProvider: provider, // 记录使用的提供商
      AiErr: null,
    })
    .eq('NoteId', noteId);

  if (error) {
    throw new Error(
      `写入笔记 ${noteId} AI 分析结果失败: ${error.message ?? '未知错误'}`,
    );
  }
};

// AI 错误类型常量
export const AI_ERROR_TYPES = {
  MEDIA_EXPIRED: 'MediaExpired',      // 媒体文件过期（不可重试）
  CHANNEL_BLOCKED: 'ChannelBlocked',  // 渠道被封禁（可重试）
  NO_CHANNEL: 'NoChannel',            // 无可用渠道（可重试）
  PARSE_ERROR: 'ParseError',          // AI响应解析失败（不可重试）
  NETWORK_ERROR: 'NetworkError',      // 网络/接口错误（可重试）
  CONTENT_EMPTY: 'ContentEmpty',      // 内容为空（不可重试）
  LOCK_CONFLICT: 'LockConflict',      // 锁定冲突（特殊处理）
  UNKNOWN: 'Unknown',                 // 未知错误（可重试）
} as const;

// 可重试的错误类型列表
const RETRYABLE_ERROR_TYPES: readonly string[] = [
  AI_ERROR_TYPES.CHANNEL_BLOCKED,
  AI_ERROR_TYPES.NO_CHANNEL,
  AI_ERROR_TYPES.NETWORK_ERROR,
  AI_ERROR_TYPES.UNKNOWN,
];

/**
 * 根据错误消息分类错误类型
 * @param errorMessage 错误消息
 * @returns 错误类型
 */
export const classifyErrorType = (errorMessage: string): string => {
  if (!errorMessage || typeof errorMessage !== 'string') {
    return AI_ERROR_TYPES.UNKNOWN;
  }

  const message = errorMessage.toLowerCase();

  // 媒体文件过期
  if (message.includes('failed to download file')) {
    return AI_ERROR_TYPES.MEDIA_EXPIRED;
  }

  // 渠道被封禁
  if (message.includes('被封禁')) {
    return AI_ERROR_TYPES.CHANNEL_BLOCKED;
  }

  // 无可用渠道
  if (message.includes('无可用渠道')) {
    return AI_ERROR_TYPES.NO_CHANNEL;
  }

  // 解析错误
  if (message.includes('解析失败') || message.includes('ai 响应')) {
    return AI_ERROR_TYPES.PARSE_ERROR;
  }

  // 网络错误
  if (message.includes('接口返回错误') || message.includes('ai 接口')) {
    return AI_ERROR_TYPES.NETWORK_ERROR;
  }

  // 内容为空
  if (message.includes('内容为空')) {
    return AI_ERROR_TYPES.CONTENT_EMPTY;
  }

  // 默认未知错误
  return AI_ERROR_TYPES.UNKNOWN;
};

/**
 * 判断错误类型是否可重试
 * @param errorType 错误类型
 * @returns 是否可重试
 */
const isRetryableError = (errorType: string): boolean => {
  return RETRYABLE_ERROR_TYPES.includes(errorType);
};

/**
 * 更新分析失败状态到数据库
 * @param supabase Supabase客户端
 * @param noteId 笔记ID
 * @param errorMessage 错误信息
 * @param errorType 错误类型
 */
export const updateAiAnalysisFailure = async (
  supabase: SupabaseClient,
  noteId: string,
  errorMessage: string,
  errorType: string,
) => {
  // 判断是否为可重试的错误
  const canRetry = isRetryableError(errorType);
  
  await supabase
    .from('qiangua_note_info')
    .update({
      AiStatus: canRetry ? '待分析' : '分析失败',
      AiSummary: null,
      AiContentType: null,
      AiRelatedProducts: null,
      AiJson: null,
      AiErr: errorMessage,
      AiErrType: errorType,
    })
    .eq('NoteId', noteId);
};

/**
 * 执行完整的AI分析流程（查询 -> 校验 -> 锁定 -> 执行 -> 更新状态）
 * @param noteIdOrRecord 笔记ID或笔记记录对象
 * @returns 分析结果
 */
export const processNoteAiAnalysis = async (
  noteIdOrRecord: string | NoteRecord,
) => {
  const supabase = getServiceSupabaseClient();
  const startTime = Date.now();
  
  try {
    let note: NoteRecord;

    // 如果传入的是字符串ID，则查询笔记
    if (typeof noteIdOrRecord === 'string') {
      const noteId = noteIdOrRecord;
      const { data, error: fetchError } = await supabase
        .from('qiangua_note_info')
        .select('*')
        .eq('NoteId', noteId)
        .single();

      if (fetchError || !data) {
        log.error('笔记查询失败', { noteId }, fetchError?.message || '笔记不存在');
        throw new Error('笔记不存在');
      }

      note = data as NoteRecord;
    } else {
      // 直接使用传入的笔记对象
      note = noteIdOrRecord;
    }

    log.info('AI分析开始', { noteId: note.NoteId, aiStatus: note.AiStatus });

    // 执行状态和内容校验（始终校验）
    if (note.AiStatus !== '待分析' && note.AiStatus !== '分析失败') {
      const error = `笔记当前状态为"${note.AiStatus}"，无法进行分析`;
      log.warning('AI分析状态校验失败', { noteId: note.NoteId, aiStatus: note.AiStatus }, error);
      throw new Error(error);
    }

    const content = note.XhsContent || note.Content;
    if (!content || content.trim().length === 0) {
      log.warning('AI分析内容校验失败', { noteId: note.NoteId }, '笔记内容为空');
      throw new Error('笔记内容为空，无法进行分析');
    }

    // 1. 锁定笔记
    try {
      await lockNoteForAnalysis(supabase, note.NoteId, note.AiStatus);
    } catch (lockError: any) {
      // 如果是锁定冲突，说明其他进程正在处理，静默忽略
      if (lockError.code === 'LOCK_CONFLICT') {
        log.info('笔记已被其他进程锁定，跳过', {
          noteId: note.NoteId,
          duration: `${Date.now() - startTime}ms`,
        });
        return {
          success: false,
          aiStatus: '分析中' as const,
          aiErr: '笔记已被其他进程锁定',
          aiContentType: null,
          aiRelatedProducts: null,
          aiSummary: null,
        };
      }
      // 其他锁定错误继续抛出
      throw lockError;
    }

    // 2. 执行AI分析
    const { aiResult, responseText, provider } = await executeAiAnalysis(note);

    // 3. 更新成功状态
    await updateAiAnalysisSuccess(supabase, note.NoteId, aiResult, responseText, provider);

    const duration = Date.now() - startTime;
    log.info('AI分析成功', {
      noteId: note.NoteId,
      provider, // 记录提供商
      model: await getAiModel(), // 记录模型
      duration: `${duration}ms`,
      contentType: aiResult.contentType,
    });

    return {
      success: true,
      aiStatus: '分析成功' as const,
      aiContentType: aiResult.contentType,
      aiRelatedProducts: aiResult.relatedProducts,
      aiSummary: aiResult.summary,
    };
  } catch (error: any) {
    // 更新失败状态
    const errorMessage = error?.message || '未知错误';
    const noteId = typeof noteIdOrRecord === 'string' 
      ? noteIdOrRecord 
      : noteIdOrRecord.NoteId;
    
    // 分类错误类型
    const errorType = classifyErrorType(errorMessage);
    const canRetry = isRetryableError(errorType);
    
    // 更新失败状态到数据库
    await updateAiAnalysisFailure(supabase, noteId, errorMessage, errorType);

    const duration = Date.now() - startTime;
    
    // 获取当前配置用于日志记录
    const provider = await getAiProvider();
    const model = await getAiModel();
    
    // 根据是否可重试记录不同级别的日志
    if (canRetry) {
      log.warning('AI分析失败(可重试)', {
        noteId,
        provider, // 记录提供商
        model,    // 记录模型
        duration: `${duration}ms`,
        errorType,
        willRetry: true,
      }, error);
    } else {
      log.error('AI分析失败(不可重试)', {
        noteId,
        provider, // 记录提供商
        model,    // 记录模型
        duration: `${duration}ms`,
        errorType,
        willRetry: false,
      }, error);
    }

    return {
      success: false,
      aiStatus: canRetry ? '待分析' as const : '分析失败' as const,
      aiErr: errorMessage,
      aiContentType: null,
      aiRelatedProducts: null,
      aiSummary: null,
    };
  }
};

export const fetchNextPendingNote = async (
  supabase: SupabaseClient,
): Promise<NoteRecord | null> => {
  const query = supabase
    .from('qiangua_note_info')
    .select('*')
    .not('XhsNoteLink', 'is', null)
    .eq('AiStatus', '待分析')
    .lt('CreatedAt', new Date().toISOString())
    .order('CreatedAt', { ascending: true })
    .limit(1);

  const { data, error } = await query.maybeSingle();

  if (error) {
    throw error;
  }

  if (!data) {
    return null;
  }

  if (!data.NoteId) {
    throw new Error('待分析笔记缺少 NoteId');
  }

  return data as NoteRecord;
};

