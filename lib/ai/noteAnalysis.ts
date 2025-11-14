import type { SupabaseClient } from '@supabase/supabase-js';

import { fixImageUrl } from '@/lib/utils/dataTransform';

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


