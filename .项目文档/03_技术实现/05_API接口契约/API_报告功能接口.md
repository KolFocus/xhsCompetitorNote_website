# 报告功能API接口文档

## 概述

本文档描述报告功能相关的所有API接口，包括创建报告、获取报告列表、追加笔记、批量操作等。

所有接口遵循统一的响应格式：

```json
{
  "success": true,
  "data": { ... },
  "error": null
}
```

错误响应格式：

```json
{
  "success": false,
  "data": null,
  "error": "错误信息"
}
```

---

## 接口列表

### 1. 创建报告

**接口**: `POST /api/reports`

**功能**: 创建新报告，并批量导入符合条件的笔记。

**请求参数**:

```json
{
  "reportName": "2024年Q1竞品分析报告",
  "brandIds": ["46899", "46900"],
  "startDate": "2024-01-01",
  "endDate": "2024-03-31"
}
```

| 参数名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| reportName | STRING | 是 | 报告名称，8-20个字符 |
| brandIds | ARRAY[STRING] | 是 | 品牌ID数组，至少包含1个品牌 |
| startDate | STRING | 否 | 开始日期，格式：YYYY-MM-DD |
| endDate | STRING | 否 | 结束日期，格式：YYYY-MM-DD |

**响应数据**:

```json
{
  "success": true,
  "data": {
    "reportId": "550e8400-e29b-41d4-a716-446655440000",
    "reportName": "2024年Q1竞品分析报告",
    "createdAt": "2024-01-15T10:30:00Z",
    "notesCount": 125
  },
  "error": null
}
```

**错误响应**:

- `400`: 参数错误（报告名称格式不正确、品牌ID为空等）
- `500`: 服务器错误

---

### 2. 获取报告列表

**接口**: `GET /api/reports`

**功能**: 获取当前用户的所有报告列表。

**查询参数**:

| 参数名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| page | INTEGER | 否 | 页码，默认1 |
| pageSize | INTEGER | 否 | 每页数量，默认20 |

**响应数据**:

```json
{
  "success": true,
  "data": {
    "list": [
      {
        "reportId": "550e8400-e29b-41d4-a716-446655440000",
        "reportName": "2024年Q1竞品分析报告",
        "createdAt": "2024-01-15T10:30:00Z",
        "updatedAt": "2024-01-15T10:30:00Z",
        "activeNotesCount": 125,
        "ignoredNotesCount": 5
      }
    ],
    "total": 10,
    "page": 1,
    "pageSize": 20
  },
  "error": null
}
```

---

### 3. 获取报告详情

**接口**: `GET /api/reports/[id]`

**功能**: 获取指定报告的详细信息，包括统计信息。

**路径参数**:

| 参数名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| id | UUID | 是 | 报告ID |

**响应数据**:

```json
{
  "success": true,
  "data": {
    "reportId": "550e8400-e29b-41d4-a716-446655440000",
    "reportName": "2024年Q1竞品分析报告",
    "createdAt": "2024-01-15T10:30:00Z",
    "updatedAt": "2024-01-15T10:30:00Z",
    "activeNotesCount": 125,
    "ignoredNotesCount": 5,
    "earliestNoteTime": "2024-01-01T08:00:00Z",
    "latestNoteTime": "2024-03-31T23:59:59Z",
    "brands": [
      {
        "brandId": "46899",
        "brandName": "Ralph Lauren拉夫劳伦"
      }
    ]
  },
  "error": null
}
```

**错误响应**:

- `404`: 报告不存在或无权访问

---

### 4. 计算笔记数量（创建报告时）

**接口**: `POST /api/reports/calculate-notes`

**功能**: 计算符合筛选条件的笔记总数（用于创建报告对话框的动态计算）。

**请求参数**:

```json
{
  "brandIds": ["46899", "46900"],
  "startDate": "2024-01-01",
  "endDate": "2024-03-31"
}
```

| 参数名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| brandIds | ARRAY[STRING] | 是 | 品牌ID数组，至少包含1个品牌 |
| startDate | STRING | 否 | 开始日期，格式：YYYY-MM-DD |
| endDate | STRING | 否 | 结束日期，格式：YYYY-MM-DD |

**响应数据**:

```json
{
  "success": true,
  "data": {
    "totalCount": 125
  },
  "error": null
}
```

---

### 5. 计算增量笔记数量（追加笔记时）

**接口**: `POST /api/reports/[id]/calculate-new-notes`

**功能**: 计算符合筛选条件且不在当前报告中的笔记数量（增量）。

**路径参数**:

| 参数名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| id | UUID | 是 | 报告ID |

**请求参数**:

```json
{
  "brandIds": ["46899", "46900"],
  "startDate": "2024-04-01",
  "endDate": "2024-06-30"
}
```

| 参数名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| brandIds | ARRAY[STRING] | 是 | 品牌ID数组，至少包含1个品牌 |
| startDate | STRING | 否 | 开始日期，格式：YYYY-MM-DD |
| endDate | STRING | 否 | 结束日期，格式：YYYY-MM-DD |

**响应数据**:

```json
{
  "success": true,
  "data": {
    "newCount": 45
  },
  "error": null
}
```

---

### 6. 追加笔记到报告

**接口**: `POST /api/reports/[id]/add-notes`

**功能**: 将符合条件的笔记批量追加到现有报告中（自动去重）。

**路径参数**:

| 参数名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| id | UUID | 是 | 报告ID |

**请求参数**:

```json
{
  "brandIds": ["46899", "46900"],
  "startDate": "2024-04-01",
  "endDate": "2024-06-30"
}
```

| 参数名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| brandIds | ARRAY[STRING] | 是 | 品牌ID数组，至少包含1个品牌 |
| startDate | STRING | 否 | 开始日期，格式：YYYY-MM-DD |
| endDate | STRING | 否 | 结束日期，格式：YYYY-MM-DD |

**响应数据**:

```json
{
  "success": true,
  "data": {
    "addedCount": 45,
    "skippedCount": 0
  },
  "error": null
}
```

**说明**:
- `addedCount`: 成功添加的笔记数量
- `skippedCount`: 跳过的笔记数量（已存在的笔记）

---

### 7. 获取报告笔记列表

**接口**: `GET /api/reports/[id]/notes`

**功能**: 获取报告中的笔记列表，支持筛选、搜索、分页。

**路径参数**:

| 参数名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| id | UUID | 是 | 报告ID |

**查询参数**:

| 参数名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| page | INTEGER | 否 | 页码，默认1 |
| pageSize | INTEGER | 否 | 每页数量，默认20 |
| status | STRING | 否 | 笔记状态，`active` 或 `ignored`，默认 `active` |
| brandId | STRING | 否 | 品牌ID筛选 |
| bloggerId | STRING | 否 | 博主ID筛选 |
| startDate | STRING | 否 | 开始日期，格式：YYYY-MM-DD |
| endDate | STRING | 否 | 结束日期，格式：YYYY-MM-DD |
| search | STRING | 否 | 搜索关键词（标题、品牌名称） |
| orderBy | STRING | 否 | 排序字段，默认 `PublishTime` |
| order | STRING | 否 | 排序方向，`asc` 或 `desc`，默认 `desc` |

**响应数据**:

```json
{
  "success": true,
  "data": {
    "list": [
      {
        "noteId": "1727038833",
        "title": "穿搭，是对未来的预演",
        "coverImage": "//xsh-qn.qian-gua.com/...",
        "noteType": "video",
        "isBusiness": true,
        "isAdNote": true,
        "publishTime": "2024-01-15T10:30:00Z",
        "likedCount": 170,
        "collectedCount": 37,
        "commentsCount": 76,
        "viewCount": 6919,
        "shareCount": 44,
        "bloggerId": "63076",
        "bloggerNickName": "Anson董祺",
        "bloggerSmallAvatar": "//xsh-img.qian-gua.com/...",
        "brandId": "46899",
        "brandName": "Ralph Lauren拉夫劳伦",
        "status": "active",
        "addedAt": "2024-01-15T10:30:00Z"
      }
    ],
    "total": 125,
    "page": 1,
    "pageSize": 20
  },
  "error": null
}
```

---

### 8. 批量操作笔记

**接口**: `POST /api/reports/[id]/notes/batch-action`

**功能**: 批量操作报告中的笔记（忽略、删除、恢复）。

**路径参数**:

| 参数名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| id | UUID | 是 | 报告ID |

**请求参数**:

```json
{
  "action": "ignore",
  "noteIds": ["1727038833", "1727038834"]
}
```

| 参数名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| action | STRING | 是 | 操作类型：`ignore`（忽略）、`delete`（删除）、`restore`（恢复） |
| noteIds | ARRAY[STRING] | 是 | 笔记ID数组 |

**响应数据**:

```json
{
  "success": true,
  "data": {
    "successCount": 2,
    "failedCount": 0
  },
  "error": null
}
```

**操作说明**:
- `ignore`: 将笔记状态更新为 `ignored`
- `delete`: 物理删除 `report_notes` 记录
- `restore`: 将笔记状态更新为 `active`

**错误响应**:

- `400`: 参数错误（无效的操作类型、笔记ID为空等）
- `404`: 报告不存在或无权访问

---

### 9. 删除报告

**接口**: `DELETE /api/reports/[id]`

**功能**: 删除指定报告（级联删除所有关联的笔记记录）。

**路径参数**:

| 参数名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| id | UUID | 是 | 报告ID |

**响应数据**:

```json
{
  "success": true,
  "data": {
    "reportId": "550e8400-e29b-41d4-a716-446655440000"
  },
  "error": null
}
```

**错误响应**:

- `404`: 报告不存在或无权访问

---

## 数据字段说明

### 报告对象字段

| 字段名 | 类型 | 说明 |
|--------|------|------|
| reportId | UUID | 报告ID |
| reportName | STRING | 报告名称 |
| createdAt | TIMESTAMPTZ | 创建时间 |
| updatedAt | TIMESTAMPTZ | 更新时间 |
| activeNotesCount | INTEGER | 有效笔记数 |
| ignoredNotesCount | INTEGER | 已忽略笔记数 |

### 笔记对象字段

参考 `/api/notes` 接口返回的笔记对象字段，额外包含：

| 字段名 | 类型 | 说明 |
|--------|------|------|
| status | STRING | 笔记在报告中的状态：`active`、`ignored` |
| addedAt | TIMESTAMPTZ | 笔记添加到报告的时间 |

---

## 错误码说明

| 错误码 | 说明 |
|--------|------|
| 400 | 请求参数错误 |
| 401 | 未认证 |
| 403 | 无权限访问 |
| 404 | 资源不存在 |
| 500 | 服务器内部错误 |

---

## 接口调用示例

### TypeScript 示例

```typescript
// 创建报告
const createReport = async (data: {
  reportName: string;
  brandIds: string[];
  startDate?: string;
  endDate?: string;
}) => {
  const response = await fetch('/api/reports', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data),
  });
  return response.json();
};

// 获取报告列表
const getReports = async (page = 1, pageSize = 20) => {
  const response = await fetch(`/api/reports?page=${page}&pageSize=${pageSize}`);
  return response.json();
};

// 计算笔记数量
const calculateNotes = async (data: {
  brandIds: string[];
  startDate?: string;
  endDate?: string;
}) => {
  const response = await fetch('/api/reports/calculate-notes', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data),
  });
  return response.json();
};

// 追加笔记
const addNotes = async (reportId: string, data: {
  brandIds: string[];
  startDate?: string;
  endDate?: string;
}) => {
  const response = await fetch(`/api/reports/${reportId}/add-notes`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data),
  });
  return response.json();
};

// 批量操作笔记
const batchAction = async (reportId: string, data: {
  action: 'ignore' | 'delete' | 'restore';
  noteIds: string[];
}) => {
  const response = await fetch(`/api/reports/${reportId}/notes/batch-action`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data),
  });
  return response.json();
};
```

---

## 注意事项

1. **认证要求**: 所有接口需要用户认证（通过 Supabase Auth）
2. **权限控制**: 用户只能访问和操作自己创建的报告
3. **数据验证**: 
   - 报告名称：8-20个字符
   - 品牌ID数组：至少包含1个品牌
4. **去重处理**: 追加笔记时自动去重（基于 `(ReportId, NoteId)` 唯一约束）
5. **性能优化**: 
   - 批量操作使用事务确保一致性
   - 分页查询使用索引优化
6. **错误处理**: 所有接口返回统一的错误格式，便于前端统一处理

---

## 更新日志

| 日期 | 版本 | 说明 |
|------|------|------|
| 2024-01-15 | 1.0 | 初始版本，包含所有报告功能接口 |

