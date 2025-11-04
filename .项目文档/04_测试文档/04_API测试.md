# API测试

## 测试目的

验证系统API接口的功能和性能。

## 测试环境

- **Base URL**: `https://your-project.supabase.co`
- **认证方式**: Supabase Auth (Bearer Token)

## API接口列表

### 1. 笔记相关接口

#### GET /rest/v1/qiangua_note_info
**描述**: 获取笔记列表  
**认证**: 需要有效的访问令牌（可选，取决于RLS策略）  
**参数**:
- `select`: 选择字段
- `filter`: 筛选条件
- `order`: 排序
- `limit`: 限制数量
- `offset`: 偏移量

**示例**:
```bash
curl -X GET \
  'https://your-project.supabase.co/rest/v1/qiangua_note_info?select=*&limit=10' \
  -H 'apikey: YOUR_ANON_KEY' \
  -H 'Authorization: Bearer YOUR_TOKEN'
```

**预期结果**: 返回笔记列表JSON数组

### 2. 品牌相关接口

#### GET /rest/v1/qiangua_brand
**描述**: 获取品牌列表  
**认证**: 可选  
**示例**:
```bash
curl -X GET \
  'https://your-project.supabase.co/rest/v1/qiangua_brand?select=*' \
  -H 'apikey: YOUR_ANON_KEY'
```

### 3. 达人相关接口

#### GET /rest/v1/qiangua_blogger
**描述**: 获取达人列表  
**认证**: 可选  
**示例**:
```bash
curl -X GET \
  'https://your-project.supabase.co/rest/v1/qiangua_blogger?select=*&limit=20' \
  -H 'apikey: YOUR_ANON_KEY'
```

## 测试用例

### TC-API-001: 查询笔记列表（无认证）
**步骤**:
1. 使用匿名key调用笔记列表接口
2. 检查返回结果

**预期**: 返回200状态码和笔记列表数据

### TC-API-002: 查询笔记列表（有筛选）
**步骤**:
1. 调用接口时添加筛选条件（如BrandId）
2. 检查筛选结果

**预期**: 返回符合筛选条件的笔记

### TC-API-003: 分页查询
**步骤**:
1. 使用limit和offset参数
2. 检查分页结果

**预期**: 返回指定数量的数据

### TC-API-004: 插入数据（Service Role）
**步骤**:
1. 使用Service Role key尝试插入数据
2. 检查是否成功

**预期**: 成功插入数据

### TC-API-005: 插入数据（匿名用户）
**步骤**:
1. 使用匿名key尝试插入数据
2. 检查是否被拒绝

**预期**: 返回403或401错误（权限不足）

## 性能测试

### 响应时间测试
- 单次查询响应时间 < 500ms
- 批量查询响应时间 < 2s

### 并发测试
- 支持至少50个并发请求
- 无数据丢失

## 测试工具

- **Postman**: API测试和调试
- **curl**: 命令行测试
- **Supabase Dashboard**: 内置API测试工具

## 测试数据

使用测试数据或生产数据的副本进行测试，避免影响生产环境。

## 测试报告模板

| 接口 | 测试结果 | 响应时间 | 备注 |
|------|---------|---------|------|
| GET /qiangua_note_info | ⬜ 通过/失败 | - | |
| GET /qiangua_brand | ⬜ 通过/失败 | - | |
| GET /qiangua_blogger | ⬜ 通过/失败 | - | |

