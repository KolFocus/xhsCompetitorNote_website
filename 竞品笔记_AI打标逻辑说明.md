# AI 打标（内容类型智能判别）逻辑说明

## 一、整体流程

```
POST /api/notes/ai-tagging
  { noteId, tagSetId }
       ↓
processNoteAiTagging()
  1. 从 qiangua_note_info 读取笔记（标题 + 正文）
  2. 从 qiangua_tag_set + qiangua_tag 读取标签系列配置
  3. buildAiTagPrompt() 拼接提示词
  4. 调用 AI（openrouter 或 chatai）
  5. parseAiTagResponse() 解析结果
  6. updateNoteAiTag() 写回 qiangua_note_info.AiTag
```

**涉及文件：**

| 文件 | 说明 |
|------|------|
| `app/api/notes/ai-tagging/route.ts` | HTTP 入口，接收 `noteId` + `tagSetId` |
| `lib/ai/aiTagAnalysis.ts` | 核心逻辑：提示词构建、AI 调用、结果解析、写库 |
| `lib/ai/providers/openrouter.ts` | OpenRouter 提供商适配 |
| `lib/ai/providers/chatai.ts` | ChatAI 提供商适配 |

---

## 二、提示词逻辑（`buildAiTagPrompt`）

提示词由三个参数驱动，全部来自数据库，换 `tagSetId` 即可适配不同行业：

| 参数 | 数据库来源 | 含义 |
|------|-----------|------|
| `categoryName` | `qiangua_tag_set.TagSetName` | 目标大类目，如「时尚休闲鞋」 |
| `keyProducts` | `qiangua_tag_set.Description` | 重点商品描述 |
| `contentTypesList` | `qiangua_tag.TagName`（该系列下所有标签） | 内容类型候选列表 |

### 提示词结构

```
### 角色定义
你是一位顶尖的小红书内容营销分析专家……

### 任务定义
判定笔记是否属于"${categoryName}"类目：
  - 属于 → 继续分析产品、内容类型、判定理由
  - 不属于 → 只标明类目，终止分析

### 输入内容
1. 笔记标题 (Title)
2. 正文内容 (Body Text)
3. 图片或视频 (Visuals)（可选）

### 核心分析与判定维度
1. 产品类目 → 不是目标类目则直接终止
2. 具体产品 → 重点关注：${keyProducts}
3. 内容类型 → 必须从 [${contentTypesList}] 中选，至少 1 个，按内容比重从大到小排列（逗号分隔）
4. 判定理由 → 简要说明分类依据

### 输出格式
使用 ^DT^ 包裹 JSON，只含 aiTag 一个字段：

符合类目：
^DT^
{"aiTag": "类目：XX | 产品：XX | 内容类型：XX, XX | 判定理由：XX"}
^DT^

不符合类目：
^DT^
{"aiTag": "类目：XX | 该笔记不属于XX类目，终止分析。"}
^DT^
```

---

## 三、响应解析（`parseAiTagResponse`）

1. 用正则匹配 `^DT^...^DT^` 包裹的内容
2. 去除可能存在的 ` ```json ``` ` 包裹
3. `JSON.parse()` 解析，提取 `aiTag` 字符串

> 用 `^DT^` 作分隔符，是为了避免 AI 在正文中输出 `{}` 干扰解析。

---

## 四、写库

```ts
supabase
  .from('qiangua_note_info')
  .update({ AiTag: aiTag })
  .eq('NoteId', noteId)
```

结果写入 `qiangua_note_info.AiTag` 字段，是一段结构化文本，**不写关联表**。

---

## 五、关键设计点

1. **完全参数化**：类目、商品描述、内容类型候选表均来自数据库，换 `tagSetId` 即可适配不同行业，无需改代码。

2. **两步判断**：先判类目是否匹配，不匹配直接终止，避免对非目标笔记做无效深度分析。

3. **强制候选列表**：内容类型必须从预设列表中选，至少选 1 个，防止 AI 自由发挥。

4. **AI 打标 vs 结构化标签**：AI 打标结果是非结构化文本字符串（写 `AiTag` 字段），便于展示但不能做结构化筛选；结构化标签（人工/批量）写 `qiangua_note_tag` 关联表，支持按标签筛选。

---

## 六、AiTag 字段示例

```
类目：时尚休闲鞋 | 产品：帆布鞋 | 内容类型：好物分享, 单品推介 | 判定理由：前60%通过日常穿搭展示，后40%重点介绍产品细节与购买渠道。
```

```
类目：美妆个护 | 该笔记不属于时尚休闲鞋类目，终止分析。
```
