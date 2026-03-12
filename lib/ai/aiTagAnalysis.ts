/**
 * 笔记内容类型判别（AI 打标）：根据类目与标签系列配置，判定笔记类目与内容类型，结果写入 aiTag。
 */

import type { SupabaseClient } from '@supabase/supabase-js';

import { log } from '@/lib/logger';
import { getServiceSupabaseClient } from '@/lib/supabase/admin';

import type { NoteRecord } from './noteAnalysis';
import { getAiModel, getAiProvider } from './noteAnalysis';

export interface TagSetInfoForAiTag {
  tagSetName: string;
  description: string | null;
  contentTypes: string[];
}

/**
 * 通过 tagSetId 从数据库读取标签系列信息（目标类目、重点商品说明、内容类型列表）
 */
export async function getTagSetInfoByTagSetId(
  supabase: SupabaseClient,
  tagSetId: string,
): Promise<TagSetInfoForAiTag | null> {
  const { data: tagSet, error: setError } = await supabase
    .from('qiangua_tag_set')
    .select('TagSetName, Description')
    .eq('TagSetId', tagSetId)
    .single();

  if (setError || !tagSet) {
    log.warning(
      'getTagSetInfoByTagSetId: 标签系列不存在',
      { tagSetId },
      setError?.message,
    );
    return null;
  }

  const { data: tags, error: tagsError } = await supabase
    .from('qiangua_tag')
    .select('TagName')
    .eq('TagSetId', tagSetId)
    .order('TagName', { ascending: true });

  if (tagsError) {
    log.warning(
      'getTagSetInfoByTagSetId: 查询标签列表失败',
      { tagSetId },
      tagsError.message,
    );
  }

  const contentTypes = (tags || []).map((t: { TagName: string }) => t.TagName);

  return {
    tagSetName: tagSet.TagSetName ?? '',
    description: tagSet.Description ?? null,
    contentTypes,
  };
}

/**
 * 构建「内容类型判别」提示词（参数化类目、重点商品、内容类型列表，并强调至少选一个）
 */
export function buildAiTagPrompt(
  note: NoteRecord,
  tagSetInfo: TagSetInfoForAiTag,
): string {
  const title =
    typeof note.XhsTitle === 'string' && note.XhsTitle.trim().length > 0
      ? note.XhsTitle
      : typeof (note as any).Title === 'string' && (note as any).Title.trim().length > 0
        ? (note as any).Title
        : '（无标题）';
  const body =
    typeof note.XhsContent === 'string' && note.XhsContent.trim().length > 0
      ? note.XhsContent
      : typeof (note as any).Content === 'string' && (note as any).Content.trim().length > 0
        ? (note as any).Content
        : '（无正文）';

  const categoryName = tagSetInfo.tagSetName || '智能安防';
  const keyProducts = tagSetInfo.description || '智能门锁：身份核验、防撬、远程开锁等；监控摄像头：实时查看、移动侦测、异常告警等';
  const contentTypesList =
    tagSetInfo.contentTypes.length > 0
      ? tagSetInfo.contentTypes.join(', ')
      : '决策导购类, 剧情软植, 单品推介, 多品纵测, 好物分享, 家居改造, 本品推介, 本品纵测, 生活记录, 美食类别';

  return [
    '### **# 角色定义**',
    '你是一位顶尖的**小红书内容营销分析专家**。你深入理解小红书平台的推荐算法、用户心智和爆款笔记的底层逻辑，擅长综合分析**笔记标题、正文、图片和视频**，输出精准、专业的分类判定。',
    '',
    '### **# 任务定义**',
    `你的任务是根据用户提供的**小红书笔记完整素材**，首先精准判定其所属的“产品类目”。**如果属于“${categoryName}”类目，则继续深挖具体产品、内容类型及理由，并将所有结果拼接成一段结构化文本返回；如果不是，则仅标明类目并中止分析。**`,
    '',
    '### **# 输入内容**',
    '我将为你提供以下一项或多项组合信息：',
    `1.  **笔记标题 (Title)**: ${title}`,
    `2.  **正文内容 (Body Text)**: ${body}`,
    '3.  **图片或视频 (Visuals)**[通过特定结构设置]',
    '',
    '### **# 核心分析与判定维度**',
    `1.  **产品类目 (Category)**：精准判定笔记所属的大类目。**【重要前提：如果判定类目不是“${categoryName}”，则直接判定结束，无需分析后续维度】**`,
    `2.  **具体产品 (Product)**：（仅限${categoryName}）重点关注：${keyProducts}`,
    `3.  **内容类型 (Content Type)**：（仅限${categoryName}）**可以是一种，也可以是多种类型的结合**。**必须且只能**从以下列表中选择最贴切的项，**至少选一个**，并按内容比重从大到小排列（逗号分隔）：`,
    `    \`[${contentTypesList}]\``,
    `4.  **判定理由 (Reasoning)**：（仅限${categoryName}）简要说明为什么判定为该（或这些）内容类型及其比重排序的依据。`,
    '',
    '### **# 输出格式**',
    '请综合分析我提供的**所有素材**，将上述判定维度的结果进行文本拼接，并放入唯一字段 `aiTag` 中。',
    '',
    '*   **拼接格式要求**：',
    `    *   符合“${categoryName}”类目时：\`类目：[类目名称] | 产品：[产品名称] | 内容类型：[类型1, 类型2...] | 判定理由：[理由简述]\``,
    `    *   不符合“${categoryName}”类目时：\`类目：[类目名称] | 该笔记不属于${categoryName}类目，终止分析。\``,
    '',
    '#### **特别强调：**',
    '请严格遵循以下输出格式，**不要添加任何其他字段**，必须只包含 `aiTag` 这1个字段。',
    '你**只**输出给我下面格式的数据。所有输出内容必须是一个**合法**的JSON对象，并使用 `^DT^` 进行包裹，方便后续进行程序化解析。',
    '',
    '**输出格式示例 1（符合类目，且为复合内容类型）：**',
    '^DT^',
    '{"aiTag": "类目：' +
      categoryName +
      ' | 产品：智能门锁 | 内容类型：剧情软植, 单品推介 | 判定理由：前70%篇幅通过剧情制造焦虑，后30%展示产品功能。"}',
    '^DT^',
    '',
    '**输出格式示例 2（不符合类目）：**',
    '^DT^',
    '{"aiTag": "类目：美妆个护 | 该笔记不属于' + categoryName + '类目，终止分析。"}',
    '^DT^',
  ].join('\n');
}

/**
 * 从 AI 原始响应中解析 ^DT^ 包裹的 JSON，提取 aiTag 字符串
 */
export function parseAiTagResponse(content: string): string {
  const trimmed = typeof content === 'string' ? content.trim() : '';
  if (!trimmed) {
    throw new Error('AI 响应为空');
  }

  const match = trimmed.match(/\^DT\^[\s\S]*?\^DT\^/);
  if (!match) {
    throw new Error('AI 响应未包含 ^DT^ 包裹的 JSON：' + trimmed.slice(0, 200));
  }

  let jsonPayload = match[0].replace(/\^DT\^/g, '').trim();
  jsonPayload = jsonPayload.replace(/^```json\s*/i, '').replace(/\s*```$/g, '').trim();

  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonPayload);
  } catch (e) {
    throw new Error('AI 响应 JSON 解析失败: ' + (e as Error).message);
  }

  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    throw new Error('AI 响应 JSON 不符合预期对象结构');
  }

  const aiTag = (parsed as Record<string, unknown>).aiTag;
  if (typeof aiTag !== 'string' || aiTag.trim().length === 0) {
    throw new Error('AI 响应缺少 aiTag 字段或为空');
  }

  return aiTag.trim();
}

/**
 * 执行内容类型判别：根据当前 AI 配置调用对应 provider，返回 aiTag 字符串
 */
export async function executeAiTagAnalysis(
  note: NoteRecord,
  tagSetInfo: TagSetInfoForAiTag,
): Promise<{ aiTag: string }> {
  const { executeChatAiTagAnalysis } = await import('./providers/chatai');
  const { executeOpenRouterAiTagAnalysis } = await import('./providers/openrouter');

  const provider = await getAiProvider();
  const model = await getAiModel();
  const prompt = buildAiTagPrompt(note, tagSetInfo);

  let rawText: string;
  if (provider === 'openrouter') {
    rawText = await executeOpenRouterAiTagAnalysis(note, prompt, model);
  } else {
    rawText = await executeChatAiTagAnalysis(note, prompt, model);
  }

  const aiTag = parseAiTagResponse(rawText);
  return { aiTag };
}

/**
 * 将 aiTag 写入笔记（仅更新 aiTag 字段）
 */
export async function updateNoteAiTag(
  supabase: SupabaseClient,
  noteId: string,
  aiTag: string,
): Promise<void> {
  const { error } = await supabase
    .from('qiangua_note_info')
    .update({ AiTag: aiTag })
    .eq('NoteId', noteId);

  if (error) {
    throw new Error(`写入笔记 ${noteId} aiTag 失败: ${error.message}`);
  }
}

/**
 * 完整流程：根据 noteId + tagSetId 执行内容类型判别并写回 aiTag；失败时不写 aiTag
 */
export async function processNoteAiTagging(
  noteId: string,
  tagSetId: string,
): Promise<{ success: boolean; aiTag?: string; error?: string }> {
  const supabase = getServiceSupabaseClient();

  const { data: noteRow, error: noteError } = await supabase
    .from('qiangua_note_info')
    .select('*')
    .eq('NoteId', noteId)
    .single();

  if (noteError || !noteRow) {
    log.warning('processNoteAiTagging: 笔记不存在', { noteId }, noteError?.message);
    return { success: false, error: '笔记不存在' };
  }

  const note = noteRow as NoteRecord;
  const tagSetInfo = await getTagSetInfoByTagSetId(supabase, tagSetId);
  if (!tagSetInfo) {
    return { success: false, error: '标签或标签系列不存在' };
  }

  const content = note.XhsContent || (note as any).Content;
  if (!content || String(content).trim().length === 0) {
    return { success: false, error: '笔记内容为空，无法进行分析' };
  }

  try {
    const { aiTag } = await executeAiTagAnalysis(note, tagSetInfo);
    await updateNoteAiTag(supabase, noteId, aiTag);
    log.info('AI 打标成功', { noteId, tagSetId, aiTag: aiTag.slice(0, 80) });
    return { success: true, aiTag };
  } catch (error: any) {
    log.warning('AI 打标失败，不写入 aiTag', { noteId, tagSetId }, error?.message);
    return { success: false, error: error?.message ?? 'AI 打标失败' };
  }
}
