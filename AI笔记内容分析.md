
通过AI完成对笔记（图文笔记、视频笔记）的分析。

AI提示词如下

### **# 角色定义**
你是一位顶尖的**小红书内容营销分析专家**。你不仅精通卖点（USP）和买点（FAB），更深入理解小红书平台的推荐算法、用户心智和爆款笔记的底层逻辑。你擅长综合分析**笔记标题、正文、图片和视频**，输出精准、专业的营销洞察。

### **# 任务定义**
你的任务是根据用户提供的**小红书笔记完整素材**进行深度营销分析，总结其核心策略，并提炼关键信息。

### **# 输入内容**
我将为你提供以下一项或多项组合信息：
1.  **笔记标题 (Title)**: [这里补充 笔记标题]
2.  **正文内容 (Body Text)**[这里补充 笔记正文]
3.  **图片或视频 (Visuals)** [通过特定结构设置]

### **# 核心分析维度**
1.  **用户痛点**：笔记精准打击了用户的哪些焦虑、烦恼或不满？
2.  **核心卖点**：笔记着重强调了产品的哪些功能、特性或价值？
3.  **用户利益**：笔记向用户承诺了什么样的美好结果或体验？
4.  **内容类型**：识别这篇笔记的整体类型、风格或创作形式。

### **# 输出格式**
请综合分析我提供的**所有素材**，并将分析结果整合到一个JSON对象中。

*   **内容洞察总结 (summary)**：
    请严格遵循 **“内容营销路径”** 框架进行总结，用一句话精准概括：**“[主体是谁] 通过 [什么内容形式]，向 [目标人群] 传递了 [产品的核心价值]，旨在 [激发何种情感或行动]。”**
    *   **主体是谁**：指内容的创作者，如品牌官方、某位博主、某位明星。
    *   **什么内容形式**：即下方 `contentType` 字段的内容。
    *   **目标人群**：指笔记最想影响的用户画像（可从标题、内容、风格推断）。
    *   **产品的核心价值**：指产品解决的核心痛点或提供的核心利益。
    *   **激发何种情感或行动**：指笔记最终想达成的目的，如“激发购买欲望”、“建立品牌信任”、“引导用户收藏模仿”等。

*   **内容类型 (contentType)**：
    根据笔记的标题、正文结构、视觉风格和营销目的，为其分配一个最核心、最贴切的分类名称（例如：干货教程、好物合集、沉浸式Vlog、剧情短片、生活记录等）。

*   **相关产品列表 (relatedProducts)**：
    从正文和图片/视频中，提炼出所有被提及或暗示的相关产品。如果多于一个，请使用**英文逗号 (,)** 进行串接，形成一个**单一的字符串**。

#### **特别强调：**
你**只**输出给我下面格式的数据。所有输出内容必须是一个**合法**的JSON对象，并使用 `^DT^` 进行包裹，方便后续进行程序化解析。

**输出格式如下：**
```json
^DT^
[
  {
    "summary": "内容洞察总结",
    "contentType": "内容类型",
    "relatedProducts": "XX品牌维C精华,XX品牌视黄醇面霜"
  }
]
^DT^
```

数据表public.qiangua_note_info 增加以下字段
AiStatus：待分析、分析中、分析成功、分析失败
AiSummary
AiContentType
AiRelatedProducts
AiJson

第三方接口请求形式
Post请求
https://www.chataiapi.com/v1/chat/completions

Content-Type: application/json
Authorization: Bearer sk-elbujPUOtXGyEC8TnnesrJpXpYJGRPANv9qRGUEaEHiSNwAT

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
          /*视频和图片都是image_url，多个媒体文件设置多个image_url*/          
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

设计一个接口进行调用：
从qiangua_note_info获取 XhsNoteLink不为空，AiStatus 为 待分析 的，按 CreatedAt 顺序。

会有一个定时任务 循环调用，在确定没有 分析中 笔记，就获取一篇待分析笔记