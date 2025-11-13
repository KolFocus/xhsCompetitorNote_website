## 项目名称
AI 笔记内容分析功能开发需求

## 背景与目标
- 自动化分析小红书图文和视频笔记，提炼营销洞察。
- 通过第三方大模型生成结构化结果并写入 `public.qiangua_note_info`。
- 建立可监控、可重试的调度流程。

## 术语说明
- **AI**：第三方大模型 `gemini-2.0-flash`。
- **笔记素材**：标题、正文、图片、视频。
- **`^DT^` 包裹**：用于标记 JSON 返回值边界。

## 功能范围
1. **笔记筛选**
   - 来源：`public.qiangua_note_info`
   - 条件：`XhsNoteLink` 不为空，`AiStatus=待分析`
   - 优先级：按 `CreatedAt` 升序取首条
2. **AI 调用**
   - 构造提示词（角色、任务、输入、输出要求）
   - 支持多媒体素材，以 `image_url` 传递给模型
3. **结果入库**
   - 解析 AI 返回 JSON
   - 写入新增字段并更新状态
4. **调度控制**
   - 定时任务循环执行
   - 避免并发处理同一笔记

## 提示词设计
- 角色：小红书内容营销分析专家，精通 USP/FAB、算法、用户心智。
- 输入说明：标题、正文、图片/视频素材。
- 分析维度：用户痛点、核心卖点、用户利益、内容类型。
- 输出要求：`summary`、`contentType`、`relatedProducts`，格式见下。

## 输出规范
- 使用 `^DT^` 包裹 JSON 数组。
- 字段定义：
  - `summary`：遵循“内容营销路径”模板：“[主体]通过[内容形式]，向[目标人群]传递了[核心价值]，旨在[激发情感或行动]。”
  - `contentType`：内容类型（如“干货教程”“好物合集”等）。
  - `relatedProducts`：涉及产品，多个用英文逗号分隔。
- 示例：
  ```json
  ^DT^
  [
    {
      "summary": "护肤博主[博主名]通过[干货教程]的形式，向[有抗初老需求的年轻用户]传递了[某品牌“早C晚A”组合]的[高效护肤、精准抗老]的核心价值，旨在建立专业信任并激发用户的购买欲望。",
      "contentType": "干货教程",
      "relatedProducts": "XX品牌维C精华,XX品牌视黄醇面霜"
    }
  ]
  ^DT^
  ```

## 数据库变更
- 表：`public.qiangua_note_info`
- 新增字段：
  - `AiStatus`：`待分析`、`分析中`、`分析成功`、`分析失败`，存储类型为 `TEXT`，不额外做枚举约束
  - `AiSummary`：存储 `summary`
  - `AiContentType`：存储 `contentType`
  - `AiRelatedProducts`：存储 `relatedProducts`
  - `AiJson`：存储完整 JSON 响应

## 第三方接口
- **URL**：`https://www.chataiapi.com/v1/chat/completions`
- **方法**：POST
- **Headers**：
  - `Content-Type: application/json`
  - `Authorization: Bearer sk-elbujPUOtXGyEC8TnnesrJpXpYJGRPANv9qRGUEaEHiSNwAT`
- **请求体示例**：
  ```json
  {
    "model": "gemini-2.0-flash",
    "messages": [
      {
        "role": "user",
        "content": [
          {
            "type": "text",
            "text": "这里填充提示词"
          },
          {
            "type": "image_url",
            "image_url": {
              "url": "https://cod-resource.oss-cn-shanghai.aliyuncs.com/17506954522772025-06-24_00-17-32_tempfec6ff093b5247b2aa2156359becc580.webp?x-oss-process=image/format,jpg"
            }
          },
          {
            "type": "image_url",
            "image_url": {
              "url": "https://cod-resource.oss-cn-shanghai.aliyuncs.com/17506954522772025-06-24_00-17-32_tempfec6ff093b5247b2aa2156359becc580.webp?x-oss-process=image/format,jpg"
            }
          }
        ]
      }
    ]
  }
  ```
- `content` 数组可根据素材数量扩展 `image_url`。
- 素材 URL（包含图文与视频）直接传递链接，无数量上限，不做截断或 Base64 转换。
- 提示词中标题、正文、素材等内容均来源于 `public.qiangua_note_info`，不做额外清洗或长度限制。

## 执行流程
1. 定时任务触发，检查是否存在 `AiStatus=分析中` 的记录；若存在则跳过。
2. 若无，则按条件获取一条待分析笔记，状态设为 `分析中`。
3. 调用第三方接口获取分析结果。
4. 处理返回：
   - 成功：写入 `AiSummary`、`AiContentType`、`AiRelatedProducts`、`AiJson`，状态更新为 `分析成功`。
   - 失败：状态更新为 `分析失败`，不保留调用请求或响应详情。
   - 超时策略：依赖系统默认超时控制，不做自动重试，失败后需人工处理。

## 稳定性与监控
- 根据接口频次限制设置调度间隔（默认可用配置即可）。
- 记录状态流转，失败任务标记为 `分析失败`，无需额外告警。
- 对长时间 `分析中` 的任务依赖系统超时，不做自动重试。

## 验收标准
- 正确筛选待分析笔记并触发 AI 分析。
- 返回结果满足格式要求并落库成功。
- 状态流转无误，无重复分析或遗漏。
- 调度、日志、异常处理符合可运维要求。

## 交付范围
- 数据库变更脚本或说明。
- 定时调度与服务实现方案。
- 第三方接口调用与错误处理设计（含硬编码 Token 及失败状态处理）。

