# AI 提供商功能测试指南

本指南用于测试 ChatAI 和 OpenRouter 双提供商功能是否正常工作。

## 前置准备

### 1. 执行数据库迁移

```bash
# 连接到数据库并执行迁移脚本
psql -h your-host -U your-user -d your-database -f scripts/migration-add-ai-provider.sql
```

或者在 Supabase SQL Editor 中直接执行 `scripts/migration-add-ai-provider.sql` 的内容。

### 2. 验证数据库变更

```sql
-- 验证字段是否添加成功
SELECT 
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns
WHERE table_name = 'qiangua_note_info'
    AND column_name = 'AiProvider';

-- 验证系统配置是否添加成功
SELECT * FROM system_config 
WHERE config_key IN ('ai_provider', 'openrouter_api_key');
```

### 3. 准备测试数据

确保数据库中有待分析的笔记：

```sql
-- 查看待分析笔记数量
SELECT COUNT(*) FROM qiangua_note_info 
WHERE "AiStatus" = '待分析' 
  AND "XhsNoteLink" IS NOT NULL;

-- 如果没有，可以重置一些笔记用于测试
UPDATE qiangua_note_info 
SET "AiStatus" = '待分析', "AiProvider" = NULL
WHERE "NoteId" IN (
  SELECT "NoteId" FROM qiangua_note_info 
  WHERE "AiStatus" = '分析成功' 
  LIMIT 5
);
```

## 测试步骤

### 测试 1：前端配置界面

#### 1.1 访问配置页面

1. 启动开发服务器：`npm run dev`
2. 访问：http://localhost:3000/dashboard/system/ai-analysis
3. 确认页面正常加载，没有报错

#### 1.2 验证提供商配置显示

- [ ] 能看到"AI提供商配置"卡片
- [ ] 显示两个选项：
  - ChatAI (Gemini 官方渠道)
  - OpenRouter (多渠道)
- [ ] 默认选中 ChatAI
- [ ] 切换到 OpenRouter 时，显示 API Key 配置区域

#### 1.3 测试 OpenRouter API Key 配置

1. 切换到 OpenRouter
2. 输入 API Key：`sk-or-v1-xxx`（你的真实 API Key）
3. 点击"保存"按钮
4. 确认显示"保存成功"提示
5. 刷新页面，确认 API Key 仍然保留

#### 1.4 测试输入验证

1. 尝试输入格式错误的 API Key（不以 sk-or-v1- 开头）
2. 点击保存
3. 确认显示格式错误提示

### 测试 2：ChatAI 提供商（默认）

#### 2.1 配置 ChatAI

1. 在前端选择"ChatAI"提供商
2. 选择模型"gemini-2.5-flash"
3. 确认 AI 分析开关为"运行中"

#### 2.2 触发分析

查看服务器日志，确认：
- 使用的提供商：`chatai`
- 使用的模型：`gemini-2.5-flash`

#### 2.3 验证结果

```sql
-- 查看最近分析的笔记
SELECT 
  "NoteId",
  "Title",
  "AiStatus",
  "AiProvider",
  "AiContentType",
  LEFT("AiSummary", 50) as "Summary预览",
  "CreatedAt"
FROM qiangua_note_info
WHERE "AiProvider" IS NOT NULL
ORDER BY "CreatedAt" DESC
LIMIT 10;
```

确认：
- [ ] `AiProvider` = 'chatai'
- [ ] `AiStatus` = '分析成功'
- [ ] `AiSummary`、`AiContentType`、`AiRelatedProducts` 有值

### 测试 3：OpenRouter 提供商

#### 3.1 配置 OpenRouter

1. 在前端选择"OpenRouter"提供商
2. 输入真实的 OpenRouter API Key
3. 点击保存
4. 确认切换提供商成功
5. 选择模型"gemini-2.5-flash"

#### 3.2 重置测试笔记

```sql
-- 重置几条笔记用于测试
UPDATE qiangua_note_info 
SET "AiStatus" = '待分析', "AiProvider" = NULL
WHERE "NoteId" IN (
  SELECT "NoteId" FROM qiangua_note_info 
  WHERE "AiStatus" = '分析成功' 
  LIMIT 3
);
```

#### 3.3 触发分析

查看服务器日志，确认：
- 使用的提供商：`openrouter`
- 使用的模型：`google/gemini-2.5-flash`（已自动转换）
- 日志中包含"OpenRouter 分析"

#### 3.4 验证结果

```sql
-- 查看 OpenRouter 分析的笔记
SELECT 
  "NoteId",
  "Title",
  "AiStatus",
  "AiProvider",
  "AiContentType",
  LEFT("AiSummary", 50) as "Summary预览"
FROM qiangua_note_info
WHERE "AiProvider" = 'openrouter'
ORDER BY "CreatedAt" DESC
LIMIT 10;
```

确认：
- [ ] `AiProvider` = 'openrouter'
- [ ] `AiStatus` = '分析成功'
- [ ] 分析结果格式与 ChatAI 一致

### 测试 4：提供商切换

#### 4.1 从 ChatAI 切换到 OpenRouter

1. 当前使用 ChatAI
2. 切换到 OpenRouter
3. 触发新的分析任务
4. 确认新任务使用 OpenRouter

#### 4.2 从 OpenRouter 切换回 ChatAI

1. 当前使用 OpenRouter
2. 切换到 ChatAI
3. 触发新的分析任务
4. 确认新任务使用 ChatAI

### 测试 5：错误处理

#### 5.1 OpenRouter API Key 未配置

1. 删除 OpenRouter API Key 配置（或设为空）
2. 选择 OpenRouter 提供商
3. 触发分析
4. 确认日志显示错误："OpenRouter API Key 未配置"
5. 确认笔记状态更新为"分析失败"或"待分析"（根据错误类型）

#### 5.2 OpenRouter API Key 无效

1. 配置无效的 OpenRouter API Key
2. 触发分析
3. 确认日志显示 API 认证错误
4. 确认错误类型正确分类

### 测试 6：统计与追溯

#### 6.1 查看提供商使用统计

```sql
-- 统计各提供商的使用情况
SELECT 
  "AiProvider",
  "AiStatus",
  COUNT(*) as count
FROM qiangua_note_info
WHERE "AiProvider" IS NOT NULL
GROUP BY "AiProvider", "AiStatus"
ORDER BY "AiProvider", "AiStatus";
```

#### 6.2 查看日志记录

确认服务器日志中包含：
- 每次分析的提供商信息
- 每次分析的模型信息
- 失败日志也包含提供商和模型信息

### 测试 7：模型转换

#### 7.1 测试所有模型

分别测试三个模型，确认 OpenRouter 正确转换：

| 配置模型 | OpenRouter 转换后 |
|---------|------------------|
| gemini-2.0-flash | google/gemini-2.0-flash-exp |
| gemini-2.5-flash | google/gemini-2.5-flash |
| gemini-2.5-pro | google/gemini-2.5-pro |

查看日志确认模型转换正确。

## 回归测试

确保原有功能不受影响：

- [ ] AI 分析开关正常工作
- [ ] 模型切换正常工作
- [ ] 统计数据显示正确
- [ ] 失败列表功能正常
- [ ] 导出功能正常
- [ ] 重置状态功能正常

## 性能测试

### 对比两个提供商的性能

```sql
-- 统计分析耗时（需要在日志中查看）
-- 统计成功率
SELECT 
  "AiProvider",
  COUNT(*) FILTER (WHERE "AiStatus" = '分析成功') as success_count,
  COUNT(*) FILTER (WHERE "AiStatus" = '分析失败') as fail_count,
  ROUND(
    COUNT(*) FILTER (WHERE "AiStatus" = '分析成功')::numeric / 
    COUNT(*)::numeric * 100, 
    2
  ) as success_rate
FROM qiangua_note_info
WHERE "AiProvider" IS NOT NULL
GROUP BY "AiProvider";
```

## 测试清单总结

- [ ] 数据库迁移成功
- [ ] 前端配置界面正常显示
- [ ] OpenRouter API Key 配置功能正常
- [ ] ChatAI 提供商分析正常
- [ ] OpenRouter 提供商分析正常
- [ ] 提供商切换功能正常
- [ ] 错误处理正确
- [ ] 数据库记录提供商信息
- [ ] 日志包含提供商和模型信息
- [ ] 模型名称转换正确
- [ ] 原有功能不受影响

## 常见问题排查

### 问题 1：前端无法加载配置

检查：
1. 数据库中是否有 `ai_provider` 和 `openrouter_api_key` 配置项
2. API `/api/system/ai-config` 是否返回正确数据

### 问题 2：OpenRouter 分析失败

检查：
1. API Key 是否正确配置
2. API Key 是否有效
3. 网络是否能访问 OpenRouter API
4. 模型名称是否正确转换

### 问题 3：提供商信息未记录

检查：
1. `AiProvider` 字段是否存在
2. `updateAiAnalysisSuccess` 函数是否传入 provider 参数
3. 数据库是否有权限更新该字段

### 问题 4：日志中缺少提供商信息

检查：
1. `log.info` 和 `log.error` 调用是否包含 provider 和 model 参数
2. 日志配置是否正确

## 测试完成

测试完成后，填写以下信息：

- 测试时间：____________________
- 测试人：____________________
- ChatAI 提供商：✅ / ❌
- OpenRouter 提供商：✅ / ❌
- 提供商切换：✅ / ❌
- 错误处理：✅ / ❌
- 回归测试：✅ / ❌

备注：
_______________________
_______________________

