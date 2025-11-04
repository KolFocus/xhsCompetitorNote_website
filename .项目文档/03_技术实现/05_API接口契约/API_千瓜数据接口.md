# 千瓜数据接口文档

## 概述

本文档描述从千瓜数据平台获取数据的接口格式和数据结构。这些接口由独立的爬虫系统调用，返回的数据将写入 Supabase 数据库。

## 统一响应格式

所有接口遵循统一的响应格式：

```json
{
    "Code": 200,
    "Msg": "Success",
    "Data": { ... }
}
```

### 响应字段说明

| 字段名 | 类型 | 说明 |
|--------|------|------|
| Code | INTEGER | 状态码，200表示成功 |
| Msg | STRING | 响应消息 |
| Data | OBJECT | 响应数据（具体结构见各接口说明） |

### 错误响应示例

```json
{
    "Code": 400,
    "Msg": "参数错误",
    "Data": null
}
```

---

## 接口列表

### 1. getNoteList（获取笔记列表）

获取按品牌归类的笔记列表，支持分页。

#### 请求参数

| 参数名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| brand_id | INTEGER | 否 | 品牌ID，用于筛选特定品牌的笔记 |
| page | INTEGER | 否 | 页码，默认1 |
| page_size | INTEGER | 否 | 每页数量，默认20 |
| date_code | INTEGER | 否 | 日期代码（格式：YYYYMMDD），用于筛选特定日期的笔记 |

#### 响应数据结构

```json
{
    "Code": 200,
    "Msg": "Success",
    "Data": {
        "TotalCount": 6,
        "TotalCountDesc": null,
        "ItemList": [
            {
                "GoodsCount": 0,
                "LevelNumber": 0,
                "LevelName": "金冠薯",
                "Fans": 135759,
                "McnName": "",
                "McnInfoId": 3537,
                "IsBrandPartner": true,
                "OfficialVerified": false,
                "NoteActiveCount": 283,
                "Gender": 0,
                "BigAvatar": "//xsh-img.qian-gua.com/avatar/5fcbbf8569934200017fd52c.jpg-180x240",
                "SmallAvatar": "//xsh-img.qian-gua.com/avatar/5fcbbf8569934200017fd52c.jpg-180x240",
                "Location": " ",
                "TagName": "穿搭",
                "RedId": "423086247",
                "CooperateBindsName": "Ralph Lauren拉夫劳伦",
                "BloggerTagName": "健身",
                "LikeCollect": 208706,
                "AdPrice": 35000,
                "AdPriceUpdateStatus": 0,
                "PriceType": "实时报价",
                "IsAdNote": true,
                "BloggerTags": "健身,潮流资讯,穿搭,健身减肥,运动",
                "LinkInfo": "ansondongqi@126.com",
                "NoteId": 1727038833,
                "DateCode": 20251029,
                "NoteIdKey": "005726",
                "Title": "穿搭，是对未来的预演",
                "LikedCount": 170,
                "CollectedCount": 37,
                "CommentsCount": 76,
                "ViewCount": 6919,
                "ShareCount": 44,
                "CoverImage": "//xsh-qn.qian-gua.com/1040g2sg31o692r7o582g4bk7kqoum9vb0d1ndeg-180x240",
                "SpreadScore": 0.0,
                "Index": 0.0,
                "BloggerId": 63076,
                "BloggerIdKey": "180ce1",
                "BloggerNickName": "Anson董祺",
                "BloggerProp": "腰部达人",
                "PublishTime": "2025-10-29T17:47:41+08:00",
                "CooperateBindList": [
                    {
                        "BrandId": 46899,
                        "BrandIdKey": "ede74d",
                        "BrandName": "Ralph Lauren拉夫劳伦"
                    }
                ],
                "NoteType": "video",
                "IsBusiness": true,
                "Props": 0,
                "PubDate": "2025-10-29",
                "CurrentUserIsFavorite": false,
                "UpdateTime": "2025-11-03T12:00:50.682923+08:00",
                "Lcc": 283,
                "VideoDuration": "1:22"
            }
        ]
    }
}
```

#### 响应字段详细说明

##### Data 对象

| 字段名 | 类型 | 说明 |
|--------|------|------|
| TotalCount | INTEGER | 总记录数 |
| TotalCountDesc | STRING | 总记录数描述（可为null） |
| ItemList | ARRAY | 笔记列表 |

##### ItemList 数组中的笔记对象

**基础信息**

| 字段名 | 类型 | 说明 |
|--------|------|------|
| NoteId | BIGINT | 笔记ID（主键） |
| NoteIdKey | STRING | 笔记ID密钥 |
| DateCode | INTEGER | 日期代码（格式：YYYYMMDD） |
| Title | STRING | 笔记标题 |
| CoverImage | STRING | 封面图片URL |
| NoteType | STRING | 笔记类型（video/image） |
| IsBusiness | BOOLEAN | 是否商业笔记 |
| IsAdNote | BOOLEAN | 是否广告笔记 |
| PublishTime | STRING | 发布时间（ISO 8601格式，包含时区信息，如：2025-10-29T17:47:41+08:00） |
| PubDate | STRING | 发布日期（YYYY-MM-DD） |
| UpdateTime | STRING | 更新时间（ISO 8601格式，包含时区信息，如：2025-11-03T12:00:50.682923+08:00） |

**互动数据**

| 字段名 | 类型 | 说明 |
|--------|------|------|
| LikedCount | INTEGER | 点赞数 |
| CollectedCount | INTEGER | 收藏数 |
| CommentsCount | INTEGER | 评论数 |
| ViewCount | INTEGER | 浏览数 |
| ShareCount | INTEGER | 分享数 |
| LikeCollect | INTEGER | 点赞+收藏总数 |
| Lcc | INTEGER | LCC值 |

**评分数据**

| 字段名 | 类型 | 说明 |
|--------|------|------|
| SpreadScore | DECIMAL | 传播分数 |
| Index | DECIMAL | 指数分数 |

**博主信息**

| 字段名 | 类型 | 说明 |
|--------|------|------|
| BloggerId | BIGINT | 博主ID |
| BloggerIdKey | STRING | 博主ID密钥 |
| BloggerNickName | STRING | 博主昵称 |
| BloggerProp | STRING | 博主属性（如：腰部达人） |
| BloggerTags | STRING | 博主标签（逗号分隔） |
| BloggerTagName | STRING | 博主标签名称 |
| Fans | INTEGER | 粉丝数 |
| LevelNumber | INTEGER | 等级编号 |
| LevelName | STRING | 等级名称（如：金冠薯） |
| Gender | INTEGER | 性别（0-未知，1-男，2-女） |
| Location | STRING | 位置 |
| BigAvatar | STRING | 大头像URL |
| SmallAvatar | STRING | 小头像URL |
| McnName | STRING | MCN名称 |
| McnInfoId | INTEGER | MCN信息ID |
| IsBrandPartner | BOOLEAN | 是否品牌合作伙伴 |
| OfficialVerified | BOOLEAN | 是否官方认证 |
| GoodsCount | INTEGER | 商品数量 |
| NoteActiveCount | INTEGER | 笔记活跃数 |

**品牌合作信息**

| 字段名 | 类型 | 说明 |
|--------|------|------|
| CooperateBindsName | STRING | 合作绑定名称 |
| CooperateBindList | ARRAY | 合作品牌列表 |

**CooperateBindList 数组中的品牌对象**

| 字段名 | 类型 | 说明 |
|--------|------|------|
| BrandId | INTEGER | 品牌ID |
| BrandIdKey | STRING | 品牌ID密钥 |
| BrandName | STRING | 品牌名称 |

**广告报价信息**

| 字段名 | 类型 | 说明 |
|--------|------|------|
| AdPrice | INTEGER | 广告报价（单位：分） |
| AdPriceUpdateStatus | INTEGER | 广告报价更新状态 |
| PriceType | STRING | 价格类型（如：实时报价） |
| LinkInfo | STRING | 联系信息（邮箱等） |

**其他信息**

| 字段名 | 类型 | 说明 |
|--------|------|------|
| TagName | STRING | 标签名称 |
| RedId | STRING | 小红书ID |
| Props | INTEGER | 属性值 |
| CurrentUserIsFavorite | BOOLEAN | 当前用户是否收藏 |
| VideoDuration | STRING | 视频时长（格式：M:SS） |

---

### 2. getSimpleNote（获取简单笔记信息）

获取笔记的详细信息，包括完整内容。

#### 请求参数

| 参数名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| note_id | BIGINT | 是 | 笔记ID |
| note_id_key | STRING | 否 | 笔记ID密钥（可选） |

#### 响应数据结构

```json
{
    "Code": 200,
    "Msg": "Success",
    "Data": {
        "NoteId": 1727038833,
        "DateCode": 20251029,
        "Title": "穿搭，是对未来的预演",
        "CoverImage": "//xsh-qn.qian-gua.com/1040g2sg31o692r7o582g4bk7kqoum9vb0d1ndeg-180x240",
        "Content": "职场的瓶颈，不只是等待破局的节点。\n穿搭，是一种心理暗示——提醒自己不退场。\n当你看起来像那个角色，你就更容易成为他。\n心怀峰景，便无惧征程。\n#拉夫劳伦美好生活DNA[话题]# #拉夫劳伦宝藏单品[话题]# #拉夫劳伦OOTD[话题]# #拉夫劳伦外套[话题]#\n#RalphLauren[话题]# #PoloRalphLauren[话题]# #职场穿搭的尽头是拉夫劳伦[话题]##精英职场风[话题]# #POLO真我宣言[话题]##穿polo拿offer[话题]#\n#复古穿搭[话题]# #vintage[话题]# #绅装骑行[话题]# #CORTIS风[话题]# #绅士穿搭[话题]# #大叔[话题]# #西装[话题]# #老钱风[话题]#",
        "BloggerId": 63076,
        "BloggerIdKey": "180ce1",
        "BloggerNickName": "Anson董祺",
        "BloggerSmallAvatar": "//xsh-img.qian-gua.com/avatar/5fcbbf8569934200017fd52c.jpg-50x50",
        "PublishTime": "2025-10-29T17:47:41+08:00",
        "NoteType": "video",
        "XhsNoteUrl": "https://www.xiaohongshu.com/discovery/item/69009d13000000000303bf93"
    }
}
```

#### 响应字段详细说明

##### Data 对象

| 字段名 | 类型 | 说明 |
|--------|------|------|
| NoteId | BIGINT | 笔记ID |
| DateCode | INTEGER | 日期代码（格式：YYYYMMDD） |
| Title | STRING | 笔记标题 |
| CoverImage | STRING | 封面图片URL |
| Content | STRING | 笔记完整内容（包含换行符和话题标签） |
| BloggerId | BIGINT | 博主ID |
| BloggerIdKey | STRING | 博主ID密钥 |
| BloggerNickName | STRING | 博主昵称 |
| BloggerSmallAvatar | STRING | 博主小头像URL |
| LikedCountDesc | STRING | 点赞数描述（格式化后的字符串） |
| CollectedCountDesc | STRING | 收藏数描述（格式化后的字符串） |
| CommentsCountDesc | STRING | 评论数描述（格式化后的字符串） |
| PublishTime | STRING | 发布时间（ISO 8601格式，包含时区信息，如：2025-10-29T17:47:41+08:00） |
| NoteType | STRING | 笔记类型（video/image） |
| XhsNoteUrl | STRING | 小红书笔记完整URL |

---

## 数据字段映射关系

### getNoteList 到数据库表 qiangua_note_info 的映射

**笔记基础信息字段**

| 接口字段 | 数据库字段 | 说明 |
|----------|------------|------|
| NoteId | NoteId | 主键，API返回BIGINT需转换为VARCHAR(64) |
| DateCode | DateCode | API返回INTEGER需转换为VARCHAR(64) |
| NoteIdKey | NoteIdKey | |
| Title | Title | |
| CoverImage | CoverImage | |
| NoteType | NoteType | |
| IsBusiness | IsBusiness | |
| IsAdNote | IsAdNote | |
| PublishTime | PublishTime | 需要转换为 TIMESTAMPTZ（带时区） |
| PubDate | PubDate | 需要转换为 DATE |
| UpdateTime | UpdateTime | 需要转换为 TIMESTAMPTZ（带时区） |

**笔记互动数据字段**

| 接口字段 | 数据库字段 | 说明 |
|----------|------------|------|
| LikedCount | LikedCount | |
| CollectedCount | CollectedCount | |
| CommentsCount | CommentsCount | |
| ViewCount | ViewCount | |
| ShareCount | ShareCount | |
| LikeCollect | LikeCollect | |
| Lcc | Lcc | |

**笔记评分数据字段**

| 接口字段 | 数据库字段 | 说明 |
|----------|------------|------|
| SpreadScore | SpreadScore | |
| Index | Index | |

**笔记关联信息字段**

| 接口字段 | 数据库字段 | 说明 |
|----------|------------|------|
| BloggerId | BloggerId | 外键，关联 qiangua_blogger 表，API返回BIGINT需转换为VARCHAR(64) |
| CooperateBindsName | CooperateBindsName | |
| CooperateBindList | CooperateBindList | JSONB格式 |

**博主信息冗余字段（保留笔记发布时的快照）**

| 接口字段 | 数据库字段 | 说明 |
|----------|------------|------|
| BloggerNickName | BloggerNickName | 博主昵称（冗余字段） |
| BloggerProp | BloggerProp | 博主属性（冗余字段） |
| BloggerTags | BloggerTags | 博主标签（冗余字段） |
| BloggerTagName | BloggerTagName | 博主标签名称（冗余字段） |
| Fans | Fans | 博主粉丝数（冗余字段，保留历史值） |
| LevelNumber | LevelNumber | 博主等级编号（冗余字段） |
| LevelName | LevelName | 博主等级名称（冗余字段） |
| Gender | Gender | 博主性别（冗余字段） |
| Location | Location | 博主位置（冗余字段） |
| BigAvatar | BigAvatar | 博主大头像URL（冗余字段） |
| SmallAvatar | SmallAvatar | 博主小头像URL（冗余字段） |
| McnName | McnName | 博主MCN名称（冗余字段） |
| McnInfoId | McnInfoId | 博主MCN信息ID（冗余字段），API返回INTEGER需转换为VARCHAR(64) |
| IsBrandPartner | IsBrandPartner | 博主是否品牌合作伙伴（冗余字段） |
| OfficialVerified | OfficialVerified | 博主是否官方认证（冗余字段） |
| GoodsCount | GoodsCount | 博主商品数量（冗余字段） |
| NoteActiveCount | NoteActiveCount | 博主笔记活跃数（冗余字段） |
| AdPrice | AdPrice | 博主广告报价（冗余字段，保留历史值，单位：分） |
| AdPriceUpdateStatus | AdPriceUpdateStatus | 博主广告报价更新状态（冗余字段） |
| PriceType | PriceType | 博主价格类型（冗余字段） |
| LinkInfo | LinkInfo | 博主联系信息（冗余字段） |

**笔记其他字段**

| 接口字段 | 数据库字段 | 说明 |
|----------|------------|------|
| VideoDuration | VideoDuration | |
| Props | Props | |
| CurrentUserIsFavorite | CurrentUserIsFavorite | |

**注意**: 
- `getNoteList` 接口不包含 `Content` 和 `XhsNoteUrl` 字段，这些字段需要通过 `getSimpleNote` 接口获取。
- 博主详细信息在 `qiangua_note_info` 表中以冗余字段形式存储（包括 `BloggerId`、`BloggerNickName`、`BloggerProp`、`BloggerTags`、`BloggerTagName` 以及 `Fans`、`LevelNumber`、`LevelName`、`Gender`、`Location`、`BigAvatar`、`SmallAvatar`、`McnName`、`McnInfoId`、`IsBrandPartner`、`OfficialVerified`、`GoodsCount`、`NoteActiveCount`、`AdPrice`、`AdPriceUpdateStatus`、`PriceType`、`LinkInfo` 等字段），这些字段保留笔记发布时的快照数据，不会随 `qiangua_blogger` 表的更新而更新。这样设计的好处是：
  - 方便查询：无需关联 `qiangua_blogger` 表即可获取博主信息
  - 保留历史：可以查看博主在笔记发布时的粉丝数、价格等数据，这些数据可能会随时间变化
  - 性能优化：减少JOIN操作，提高查询效率
- 同时，博主信息也会同步到 `qiangua_blogger` 表中，该表存储博主的最新信息，通过 `BloggerId` 外键关联。

### getNoteList 到数据库表 qiangua_blogger 的映射

**博主基础信息字段**

| 接口字段 | 数据库字段 | 说明 |
|----------|------------|------|
| BloggerId | BloggerId | 主键，API返回BIGINT需转换为VARCHAR(64) |
| BloggerIdKey | BloggerIdKey | 唯一键 |
| BloggerNickName | BloggerNickName | |
| BloggerProp | BloggerProp | |
| BloggerTags | BloggerTags | |
| BloggerTagName | BloggerTagName | |

**博主统计信息字段**

| 接口字段 | 数据库字段 | 说明 |
|----------|------------|------|
| Fans | Fans | |
| LevelNumber | LevelNumber | |
| LevelName | LevelName | |
| NoteActiveCount | NoteActiveCount | |
| GoodsCount | GoodsCount | |
| Gender | Gender | 0-未知，1-男，2-女 |
| Location | Location | |

**博主头像字段**

| 接口字段 | 数据库字段 | 说明 |
|----------|------------|------|
| BigAvatar | BigAvatar | |
| SmallAvatar | SmallAvatar | |

**MCN信息字段**

| 接口字段 | 数据库字段 | 说明 |
|----------|------------|------|
| McnName | McnName | |
| McnInfoId | McnInfoId | API返回INTEGER需转换为VARCHAR(64) |

**认证信息字段**

| 接口字段 | 数据库字段 | 说明 |
|----------|------------|------|
| IsBrandPartner | IsBrandPartner | |
| OfficialVerified | OfficialVerified | |

**广告报价信息字段**

| 接口字段 | 数据库字段 | 说明 |
|----------|------------|------|
| AdPrice | AdPrice | 单位：分 |
| AdPriceUpdateStatus | AdPriceUpdateStatus | |
| PriceType | PriceType | |
| LinkInfo | LinkInfo | |

### getSimpleNote 到数据库表 qiangua_note_info 的映射

**笔记基础信息字段**

| 接口字段 | 数据库字段 | 说明 |
|----------|------------|------|
| NoteId | NoteId | 主键（用于更新），API返回BIGINT需转换为VARCHAR(64) |
| Content | Content | 仅在此接口中提供 |
| XhsNoteUrl | XhsNoteUrl | 仅在此接口中提供 |

**博主信息冗余字段（如果接口返回了博主信息）**

| 接口字段 | 数据库字段 | 说明 |
|----------|------------|------|
| BloggerNickName | BloggerNickName | 博主昵称（冗余字段，如果接口返回） |
| BloggerSmallAvatar | SmallAvatar | 博主小头像URL（冗余字段，如果接口返回，注意：getSimpleNote 返回的是 BloggerSmallAvatar，需要映射到 SmallAvatar） |

**注意**: `getSimpleNote` 接口返回的博主信息较少，主要包含基础字段。如果需要在笔记中保存完整的博主快照信息，建议优先使用 `getNoteList` 接口获取完整博主信息。

### getSimpleNote 到数据库表 qiangua_blogger 的映射

**注意**: `getSimpleNote` 接口返回的博主信息较少，仅包含基础字段。如果博主信息已存在，则更新；如果不存在，需要先通过 `getNoteList` 接口获取完整博主信息。

| 接口字段 | 数据库字段 | 说明 |
|----------|------------|------|
| BloggerId | BloggerId | 主键（用于更新），API返回BIGINT需转换为VARCHAR(64) |
| BloggerIdKey | BloggerIdKey | 唯一键 |
| BloggerNickName | BloggerNickName | |
| BloggerSmallAvatar | SmallAvatar | 小头像URL |

### CooperateBindList 到数据库表 qiangua_brand 的映射

| 接口字段 | 数据库字段 | 说明 |
|----------|------------|------|
| BrandId | BrandId | 主键，API返回INTEGER需转换为VARCHAR(64) |
| BrandIdKey | BrandIdKey | 唯一键 |
| BrandName | BrandName | |

---

## 数据同步流程

### 1. 笔记列表同步

1. 调用 `getNoteList` 接口获取笔记列表
2. 遍历 `ItemList` 数组，对每个笔记执行：
   
   **步骤 2.1：同步博主信息**
   - 提取笔记中的博主信息（BloggerId, BloggerIdKey, BloggerNickName 等）
   - 检查 `qiangua_blogger` 表中是否存在该 `BloggerId`
   - 如果不存在，插入新博主记录
   - 如果存在，更新博主信息（使用 `ON CONFLICT` 实现 upsert）
   
   **步骤 2.2：同步品牌信息**
   - 对于每个笔记的 `CooperateBindList`：
     - 遍历品牌列表，对每个品牌执行：
       - 检查 `qiangua_brand` 表中是否存在该 `BrandId`
       - 如果不存在，插入新品牌记录
       - 如果存在，更新品牌信息
   
   **步骤 2.3：同步笔记信息**
   - 检查 `qiangua_note_info` 表中是否存在该 `NoteId`
   - 如果不存在，插入新记录（关联 `BloggerId` 外键，同时保存博主信息的冗余字段快照）
   - 如果存在，更新记录（使用 `ON CONFLICT` 实现 upsert，注意：冗余字段的值在首次插入时保存，后续更新时保持快照值不变）
   - **重要**：博主冗余字段（以 `Blogger` 开头的字段）在笔记首次同步时保存，后续更新时通常不更新这些字段，以保留笔记发布时的历史快照。如果需要更新快照数据，可以显式地在更新时覆盖这些字段。

### 2. 笔记详情同步

1. 调用 `getSimpleNote` 接口获取笔记详情
2. **同步博主信息**（如果接口返回了博主信息）：
   - 使用 `BloggerId` 更新 `qiangua_blogger` 表中的对应记录
   - 如果博主不存在，则仅更新基础字段（建议优先使用 `getNoteList` 获取完整博主信息）
3. **同步笔记信息**：
   - 使用 `NoteId` 更新 `qiangua_note_info` 表中的对应记录
   - 更新 `Content` 和 `XhsNoteUrl` 字段

### 3. 数据去重策略

- **笔记表去重**：
  - 使用 `NoteId` 作为唯一标识
  - 使用 `ON CONFLICT ("NoteId") DO UPDATE` 实现 upsert 操作
  
- **博主表去重**：
  - 使用 `BloggerId` 作为唯一标识
  - 使用 `ON CONFLICT ("BloggerId") DO UPDATE` 实现博主 upsert 操作
  
- **品牌表去重**：
  - 使用 `BrandId` 作为品牌唯一标识
  - 使用 `ON CONFLICT ("BrandId") DO UPDATE` 实现品牌 upsert 操作

### 4. 同步顺序建议

为了确保数据完整性，建议按以下顺序同步：

1. **先同步博主信息**（`qiangua_blogger`）
2. **再同步品牌信息**（`qiangua_brand`）
3. **最后同步笔记信息**（`qiangua_note_info`），确保外键 `BloggerId` 已存在

**注意**: 
- 由于 PostgreSQL 对大小写敏感，使用 PascalCase 字段名时，SQL 语句中需要用双引号包裹字段名。
- 在插入 `qiangua_note_info` 记录前，必须确保对应的 `BloggerId` 在 `qiangua_blogger` 表中已存在，否则会触发外键约束错误。

---

## 注意事项

1. **数据类型转换**: 
   - **ID字段转换**：
     - `NoteId`、`BloggerId`：API返回BIGINT类型，需转换为VARCHAR(64)字符串存储
     - `BrandId`：API返回INTEGER类型，需转换为VARCHAR(64)字符串存储
     - `DateCode`：API返回INTEGER类型（如20251029），需转换为VARCHAR(64)字符串存储
     - `McnInfoId`：API返回INTEGER类型，需转换为VARCHAR(64)字符串存储
   - **时间格式转换**：
     - `PublishTime` 和 `UpdateTime` 为 ISO 8601 格式字符串（包含时区信息，如：`2025-10-29T17:47:41+08:00`），需要转换为 PostgreSQL `TIMESTAMPTZ` (TIMESTAMP WITH TIME ZONE) 类型
     - `PubDate` 为 `YYYY-MM-DD` 格式字符串，需要转换为 PostgreSQL `DATE` 类型

2. **图片URL处理**: 
   - 图片URL可能为相对路径（以 `//` 开头），需要根据实际情况补充协议（`https:`）
   - 博主头像字段 `BigAvatar` 和 `SmallAvatar` 需要统一处理

3. **JSON数据存储**: 
   - `CooperateBindList` 需要存储为 JSONB 格式，便于查询和索引

4. **数据精度**: 
   - `AdPrice` 单位为"分"，存储时注意单位转换
   - `SpreadScore` 和 `Index` 为小数，使用 `DECIMAL` 类型

5. **空值处理**: 
   - 某些字段可能为 `null` 或空字符串，需要根据业务需求设置默认值
   - 博主信息中的 `McnName`、`Location` 等字段可能为空

6. **字符编码**: 
   - 确保所有文本字段使用 UTF-8 编码

7. **外键约束**: 
   - 在插入 `qiangua_note_info` 记录前，必须确保对应的 `BloggerId` 在 `qiangua_blogger` 表中已存在
   - `BrandId`、`BrandIdKey`、`BrandName` 字段可为空（从 `CooperateBindList` 提取，如果不存在则为空）
   - 如果 `BrandId` 存在，则必须确保对应的 `BrandId` 在 `qiangua_brand` 表中已存在
   - 建议使用事务确保数据一致性，或先同步博主信息，再同步笔记信息
   - **注意**：由于数据库设计使用VARCHAR(64)存储ID字段，而API返回的是数字类型，在同步数据前需要先将数字转换为字符串，确保类型匹配

8. **博主信息更新**: 
   - 博主信息可能会发生变化（如粉丝数、等级等），同步时应该更新现有记录而不是跳过
   - 使用 `ON CONFLICT` 子句实现 upsert 操作，确保数据最新

---

## 接口调用示例

### Python 示例

```python
import requests
import json

# 获取笔记列表
def get_note_list(brand_id=None, page=1, page_size=20):
    url = "https://api.example.com/getNoteList"
    params = {
        "page": page,
        "page_size": page_size
    }
    if brand_id:
        params["brand_id"] = brand_id
    
    response = requests.get(url, params=params)
    data = response.json()
    
    if data["Code"] == 200:
        return data["Data"]
    else:
        raise Exception(f"API Error: {data['Msg']}")

# 获取笔记详情
def get_simple_note(note_id):
    url = "https://api.example.com/getSimpleNote"
    params = {
        "note_id": note_id
    }
    
    response = requests.get(url, params=params)
    data = response.json()
    
    if data["Code"] == 200:
        return data["Data"]
    else:
        raise Exception(f"API Error: {data['Msg']}")
```

---

## 更新日志

| 日期 | 版本 | 说明 |
|------|------|------|
| 2025-11-03 | 1.2 | 在 qiangua_note_info 表中添加冗余的博主信息字段，保留笔记发布时的快照数据（粉丝数、价格等） |
| 2025-11-03 | 1.1 | 更新字段映射关系，添加 qiangua_blogger 表映射，从 qiangua_note_info 映射中移除博主详细信息字段 |
| 2025-11-03 | 1.0 | 初始版本，包含 getNoteList 和 getSimpleNote 接口文档 |

