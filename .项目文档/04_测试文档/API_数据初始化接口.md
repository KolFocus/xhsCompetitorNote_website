# 数据初始化接口文档

## 接口说明

**接口路径**: `POST /api/data/init-test-data`

**功能**: 接收 `getNoteList` 和 `getSimpleNote` 的 JSON 响应数据，自动处理数据转换、去重和批量插入到数据库。

**认证**: 
- 开发环境：无需认证
- 生产环境：需要 Service Role Key 认证（待实现）

## 请求格式

### 请求体结构

```json
{
  "noteListResponses": [
    {
      "Code": 200,
      "Msg": "Success",
      "Data": {
        "TotalCount": 6,
        "ItemList": [
          {
            "NoteId": 1727038833,
            "BloggerId": 423086247,
            "CooperateBindList": [
              {
                "BrandId": 46899,
                "BrandIdKey": "Ralph Lauren",
                "BrandName": "Ralph Lauren拉夫劳伦"
              }
            ],
            // ... 其他字段
          }
        ]
      }
    }
  ],
  "noteDetailResponses": [
    {
      "Code": 200,
      "Msg": "Success",
      "Data": {
        "NoteId": 1727038833,
        "Content": "笔记完整内容...",
        "XhsNoteUrl": "https://www.xiaohongshu.com/...",
        "BloggerId": 423086247,
        "BloggerNickName": "博主昵称",
        "BloggerSmallAvatar": "//xsh-img.qian-gua.com/..."
        // ... 其他字段
      }
    }
  ]
}
```

### 字段说明

| 字段名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| noteListResponses | Array | 否 | getNoteList 接口的响应数组，可包含多个响应 |
| noteDetailResponses | Array | 否 | getSimpleNote 接口的响应数组，可包含多个响应 |

**注意**: 
- `noteListResponses` 和 `noteDetailResponses` 至少需要提供一个
- 每个响应必须遵循统一的 API 响应格式：`{ Code, Msg, Data }`
- 只有 `Code === 200` 的响应才会被处理

## 响应格式

### 成功响应

```json
{
  "success": true,
  "data": {
    "bloggers": {
      "inserted": 15,
      "updated": 0,
      "total": 15
    },
    "brands": {
      "inserted": 2,
      "updated": 0,
      "total": 2
    },
    "notes": {
      "inserted": 53,
      "updated": 0,
      "detailsUpdated": 12,
      "total": 53
    }
  },
  "errors": {
    "bloggers": [],
    "brands": [],
    "notes": []
  }
}
```

### 部分错误响应

```json
{
  "success": false,
  "data": {
    "bloggers": {
      "inserted": 14,
      "updated": 1,
      "total": 15
    },
    "brands": {
      "inserted": 2,
      "updated": 0,
      "total": 2
    },
    "notes": {
      "inserted": 52,
      "updated": 1,
      "detailsUpdated": 12,
      "total": 53
    }
  },
  "errors": {
    "bloggers": [
      "Blogger 423086247: duplicate key value violates unique constraint"
    ],
    "brands": [],
    "notes": [
      "Note 1727038833: foreign key constraint violation"
    ]
  }
}
```

### 响应字段说明

| 字段名 | 类型 | 说明 |
|--------|------|------|
| success | Boolean | 是否完全成功（无任何错误） |
| data | Object | 处理结果统计 |
| data.bloggers | Object | 博主处理统计 |
| data.bloggers.inserted | Number | 新插入的博主数量 |
| data.bloggers.updated | Number | 更新的博主数量 |
| data.bloggers.total | Number | 处理的博主总数（去重后） |
| data.brands | Object | 品牌处理统计 |
| data.brands.inserted | Number | 新插入的品牌数量 |
| data.brands.updated | Number | 更新的品牌数量 |
| data.brands.total | Number | 处理的品牌总数（去重后） |
| data.notes | Object | 笔记处理统计 |
| data.notes.inserted | Number | 新插入的笔记数量 |
| data.notes.updated | Number | 更新的笔记数量 |
| data.notes.detailsUpdated | Number | 更新了详情的笔记数量（Content 和 XhsNoteUrl） |
| data.notes.total | Number | 处理的笔记总数（去重后） |
| errors | Object | 错误信息集合 |
| errors.bloggers | Array | 博主处理错误列表 |
| errors.brands | Array | 品牌处理错误列表 |
| errors.notes | Array | 笔记处理错误列表 |

## 处理流程

接口按以下顺序处理数据：

1. **提取博主数据**（从 `noteListResponses` 的 `ItemList` 中提取）
   - 自动去重（基于 `BloggerId`）
   - 使用 `upsert` 操作（存在则更新，不存在则插入）

2. **提取品牌数据**（从 `noteListResponses` 的 `ItemList[].CooperateBindList` 中提取）
   - 自动去重（基于 `BrandId`）
   - 支持多个品牌（从所有笔记的 `CooperateBindList` 中收集）
   - 使用 `upsert` 操作

3. **插入笔记列表**（从 `noteListResponses` 的 `ItemList` 中提取）
   - 自动去重（基于 `NoteId`）
   - 批量插入（每批 50 条）
   - 关联博主外键（`BloggerId`）
   - 保存品牌信息（从 `CooperateBindList` 的第一个元素提取）
   - 保存博主冗余字段快照

4. **更新笔记详情**（从 `noteDetailResponses` 的 `Data` 中提取）
   - 更新 `Content` 和 `XhsNoteUrl` 字段
   - 如果包含博主信息，也更新冗余字段（`BloggerNickName`、`SmallAvatar`）
   - 同时更新博主表（如果包含博主信息）

## 数据转换规则

### 类型转换

- **BIGINT → VARCHAR(64)**: `NoteId`、`BloggerId`
- **INTEGER → VARCHAR(64)**: `DateCode`、`BrandId`、`McnInfoId`
- **ISO 8601 → TIMESTAMPTZ**: `PublishTime`、`UpdateTime`
- **STRING → DATE**: `PubDate`（YYYY-MM-DD 格式）
- **ARRAY → JSONB**: `CooperateBindList`

### 图片 URL 处理

- 自动修复以 `//` 开头的 URL，添加 `https:` 前缀
- 例如：`//xsh-img.qian-gua.com/...` → `https://xsh-img.qian-gua.com/...`

### 品牌信息提取

- 从 `CooperateBindList` 数组的第一个元素提取：
  - `BrandId`（主键，用于关联）
  - `BrandIdKey`（唯一键）
  - `BrandName`（品牌名称）
- 完整的 `CooperateBindList` 数组保存为 JSONB 格式

### 博主信息处理

- 从 `getNoteList` 提取完整博主信息
- 从 `getSimpleNote` 提取基础博主信息（`BloggerId`、`BloggerIdKey`、`BloggerNickName`、`BloggerSmallAvatar`）
- 注意：`getSimpleNote` 返回的是 `BloggerSmallAvatar`，自动映射到 `SmallAvatar`

## 使用示例

### cURL 示例

```bash
curl -X POST http://localhost:3000/api/data/init-test-data \
  -H "Content-Type: application/json" \
  -d '{
    "noteListResponses": [
      {
        "Code": 200,
        "Msg": "Success",
        "Data": {
          "ItemList": [
            {
              "NoteId": 1727038833,
              "BloggerId": 423086247,
              "BloggerNickName": "博主昵称",
              "Title": "笔记标题",
              "PublishTime": "2025-10-29T17:47:41+08:00",
              "CooperateBindList": [
                {
                  "BrandId": 46899,
                  "BrandIdKey": "Ralph Lauren",
                  "BrandName": "Ralph Lauren拉夫劳伦"
                }
              ]
            }
          ]
        }
      }
    ],
    "noteDetailResponses": [
      {
        "Code": 200,
        "Msg": "Success",
        "Data": {
          "NoteId": 1727038833,
          "Content": "笔记完整内容...",
          "XhsNoteUrl": "https://www.xiaohongshu.com/..."
        }
      }
    ]
  }'
```

### JavaScript/TypeScript 示例

```typescript
async function initTestData() {
  const response = await fetch('/api/data/init-test-data', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      noteListResponses: [
        {
          Code: 200,
          Msg: 'Success',
          Data: {
            ItemList: [
              // ... 笔记列表数据
            ],
          },
        },
      ],
      noteDetailResponses: [
        {
          Code: 200,
          Msg: 'Success',
          Data: {
            NoteId: 1727038833,
            Content: '笔记完整内容...',
            XhsNoteUrl: 'https://www.xiaohongshu.com/...',
          },
        },
      ],
    }),
  });

  const result = await response.json();
  console.log('处理结果:', result);
}
```

### 直接粘贴 JSON 数据

如果你有完整的 JSON 响应数据，可以直接粘贴到请求体中：

```json
{
  "noteListResponses": [
    // 直接粘贴 getNoteList 的完整响应
    {
      "Code": 200,
      "Msg": "Success",
      "Data": { ... }
    }
  ],
  "noteDetailResponses": [
    // 直接粘贴 getSimpleNote 的完整响应
    {
      "Code": 200,
      "Msg": "Success",
      "Data": { ... }
    }
  ]
}
```

## 错误处理

### 错误策略

- **继续处理**: 遇到错误时，不会中断整个处理流程，而是继续处理剩余数据
- **错误收集**: 所有错误信息都会被收集到 `errors` 对象中
- **部分成功**: 即使部分数据插入失败，也会返回成功的结果统计

### 常见错误

1. **外键约束错误**: 确保博主数据先于笔记数据插入（接口已自动处理）
2. **唯一约束错误**: 检查是否有重复的 `BloggerIdKey` 或 `BrandIdKey`
3. **数据类型错误**: 检查时间格式是否为 ISO 8601 格式
4. **空值错误**: 确保必填字段（`NoteId`、`DateCode`、`PublishTime`、`BloggerId`）不为空

## 注意事项

1. **数据去重**: 接口会自动处理重复数据（基于主键去重）
2. **批量处理**: 笔记数据会分批插入（每批 50 条），避免单次请求过大
3. **事务处理**: 每个步骤独立处理，不保证原子性（继续处理错误策略）
4. **性能优化**: 对于大量数据，建议分多次调用接口，而不是一次性传入所有数据
5. **数据完整性**: 确保 `noteDetailResponses` 中的 `NoteId` 在 `noteListResponses` 中存在

## 开发环境测试

在开发环境中，接口无需认证即可使用。启动开发服务器后：

```bash
npm run dev
```

然后访问 `http://localhost:3000/api/data/init-test-data` 进行测试。

## 生产环境

在生产环境中，建议添加 Service Role Key 认证（待实现）。当前版本在生产环境中也无需认证，请谨慎使用。

