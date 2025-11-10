# API_达人矩阵分析接口

## 概述

本文档描述达人矩阵属性分析功能相关的所有API接口，包括获取配置、保存配置等。

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

### 1. 获取达人分层配置

**接口**: `GET /api/reports/[id]/blogger-matrix/config`

**功能**: 获取指定报告的达人分层配置。如果数据库中不存在该报告的配置，返回null，前端使用系统默认配置。

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
    "customLevels": [
      {
        "levelId": "1",
        "levelName": "头部达人",
        "minFans": 500000,
        "maxFans": null
      },
      {
        "levelId": "2",
        "levelName": "腰部达人",
        "minFans": 100000,
        "maxFans": 500000
      },
      {
        "levelId": "3",
        "levelName": "初级达人",
        "minFans": 10000,
        "maxFans": 100000
      },
      {
        "levelId": "4",
        "levelName": "新手达人",
        "minFans": 0,
        "maxFans": 10000
      }
    ]
  },
  "error": null
}
```

**说明**:
- `customLevels`: 自定义层级列表，不包含知名KOL层（固定层级）
- `minFans`: 最小粉丝数（单位：人），如果为null表示无下限
- `maxFans`: 最大粉丝数（单位：人），如果为null表示无上限
- 如果数据库中不存在配置，`data` 为 `null`，前端使用系统默认配置
- 配置存储位置：`qiangua_report.CustomLevels`（按报告维度存储）

**错误响应**:

- `401`: 未认证
- `404`: 报告不存在或无权访问
- `500`: 服务器错误

---

### 2. 保存达人分层配置

**接口**: `POST /api/reports/[id]/blogger-matrix/config`

**功能**: 保存用户自定义的达人分层配置到数据库。配置按报告ID关联存储。

**路径参数**:

| 参数名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| id | UUID | 是 | 报告ID |

**请求参数**:

```json
{
  "customLevels": [
    {
      "levelName": "头部达人",
      "minFans": 500000,
      "maxFans": null
    },
    {
      "levelName": "腰部达人",
      "minFans": 100000,
      "maxFans": 500000
    },
    {
      "levelName": "初级达人",
      "minFans": 10000,
      "maxFans": 100000
    },
    {
      "levelName": "新手达人",
      "minFans": 0,
      "maxFans": 10000
    }
  ]
}
```

| 参数名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| customLevels | ARRAY[OBJECT] | 是 | 自定义层级列表，至少包含1个层级 |
| customLevels[].levelName | STRING | 是 | 层级名称，1-20个字符，不能重复 |
| customLevels[].minFans | INTEGER | 是 | 最小粉丝数（单位：人），≥0 |
| customLevels[].maxFans | INTEGER | 否 | 最大粉丝数（单位：人），如果为null表示无上限，如果设置必须>minFans |

**响应数据**:

```json
{
  "success": true,
  "data": {
    "reportId": "550e8400-e29b-41d4-a716-446655440000",
    "customLevels": [
      {
        "levelId": "1",
        "levelName": "头部达人",
        "minFans": 500000,
        "maxFans": null
      },
      {
        "levelId": "2",
        "levelName": "腰部达人",
        "minFans": 100000,
        "maxFans": 500000
      },
      {
        "levelId": "3",
        "levelName": "初级达人",
        "minFans": 10000,
        "maxFans": 100000
      },
      {
        "levelId": "4",
        "levelName": "新手达人",
        "minFans": 0,
        "maxFans": 10000
      }
    ]
  },
  "error": null
}
```

**验证规则**:

1. **层级名称验证**:
   - 不能为空
   - 长度：1-20个字符
   - 不能重复

2. **粉丝数范围验证**:
   - `minFans` 必须 ≥ 0
   - 如果设置了 `maxFans`，必须 > `minFans`
   - 范围不能与其他层级重叠
   - 所有层级的范围必须连续覆盖（不能留空）

3. **层级数量验证**:
   - 至少包含1个层级
   - 最多支持10个层级

**错误响应**:

- `400`: 参数错误（验证失败）
  ```json
  {
    "success": false,
    "data": null,
    "error": "层级名称不能为空"
  }
  ```
- `401`: 未认证
- `404`: 报告不存在或无权访问
- `500`: 服务器错误

---

### 3. 删除达人分层配置

**接口**: `DELETE /api/reports/[id]/blogger-matrix/config`

**功能**: 删除指定报告的自定义配置。删除后，前端使用系统默认配置。

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

- `401`: 未认证
- `404`: 报告不存在或无权访问，或配置不存在
- `500`: 服务器错误

---

## 数据字段说明

### 配置对象字段

| 字段名 | 类型 | 说明 |
|--------|------|------|
| reportId | UUID | 报告ID |
| customLevels | ARRAY[OBJECT] | 自定义层级列表 |

### 层级对象字段

| 字段名 | 类型 | 说明 |
|--------|------|------|
| levelId | STRING | 层级ID（接口返回的序号或已有ID） |
| levelName | STRING | 层级名称 |
| minFans | INTEGER | 最小粉丝数（单位：人） |
| maxFans | INTEGER \| NULL | 最大粉丝数（单位：人），null表示无上限 |

---

## 错误码说明

| 错误码 | 说明 |
|--------|------|
| 400 | 请求参数错误（验证失败） |
| 401 | 未认证 |
| 403 | 无权限访问 |
| 404 | 资源不存在 |
| 500 | 服务器内部错误 |

---

## 接口调用示例

### TypeScript 示例

```typescript
// 获取配置
const getBloggerMatrixConfig = async (reportId: string) => {
  const response = await fetch(`/api/reports/${reportId}/blogger-matrix/config`);
  return response.json();
};

// 保存配置
const saveBloggerMatrixConfig = async (
  reportId: string,
  customLevels: Array<{
    levelName: string;
    minFans: number;
    maxFans: number | null;
  }>
) => {
  const response = await fetch(`/api/reports/${reportId}/blogger-matrix/config`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ customLevels }),
  });
  return response.json();
};

// 删除配置
const deleteBloggerMatrixConfig = async (reportId: string) => {
  const response = await fetch(`/api/reports/${reportId}/blogger-matrix/config`, {
    method: 'DELETE',
  });
  return response.json();
};
```

---

## 注意事项

1. **认证要求**: 所有接口需要用户认证（通过 Supabase Auth）
2. **权限控制**: 用户只能访问和操作自己创建的报告的配置
3. **数据验证**: 
   - 层级名称：1-20个字符，不能重复
   - 粉丝数范围：不能重叠，必须连续覆盖
4. **默认配置**: 如果数据库中不存在配置，前端使用系统默认配置（写在代码中）
5. **配置存储**: 配置存储在 `qiangua_report.CustomLevels`，按报告ID关联，不同报告可以有不同配置
6. **错误处理**: 所有接口返回统一的错误格式，便于前端统一处理

---

## 更新日志

| 日期 | 版本 | 说明 |
|------|------|------|
| 2024-01-15 | 1.0 | 初始版本，包含所有达人矩阵配置接口 |
| 2025-11-10 | 1.1 | 配置改为存储在 `qiangua_report.CustomLevels`，调整接口返回字段 |

