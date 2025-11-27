# OpenRouter API 测试指南

## 概述
已创建一个 Next.js API 接口来测试 OpenRouter SDK 的调用功能。

## 接口信息

### 接口路径
```
POST /api/test-openrouter
GET  /api/test-openrouter (用于检查接口状态)
```

### 请求示例

#### POST 请求
```bash
curl -X POST http://localhost:3000/api/test-openrouter \
  -H "Content-Type: application/json" \
  -d '{"message": "What is the meaning of life?"}'
```

#### 请求体格式
```json
{
  "message": "你想问的问题"
}
```

### 响应格式

#### 成功响应
```json
{
  "success": true,
  "data": {
    "content": "AI 的回复内容",
    "model": "openai/gpt-4o",
    "usage": {
      "prompt_tokens": 10,
      "completion_tokens": 50,
      "total_tokens": 60
    },
    "id": "gen-xxx",
    "created": 1234567890
  }
}
```

#### 失败响应
```json
{
  "success": false,
  "error": "错误信息",
  "details": {}
}
```

## 使用步骤

### 1. 配置 API Key
编辑 `app/api/test-openrouter/route.ts` 文件，将第 23 行的 API Key 替换为你的真实 API Key：

```typescript
const OPENROUTER_CONFIG = {
  apiKey: 'sk-or-v1-your-actual-api-key-here', // ⚠️ 替换这里
  siteUrl: 'https://xhs-competitor-note.com',
  siteName: '小红书竞品笔记监控系统',
};
```

### 2. 启动开发服务器
```bash
npm run dev
```

### 3. 运行测试

#### 方式 1: 使用测试脚本（推荐）
```bash
node scripts/test-openrouter-api.js
```

#### 方式 2: 使用 curl
```bash
# GET 请求 - 检查接口状态
curl http://localhost:3000/api/test-openrouter

# POST 请求 - 实际调用 OpenRouter
curl -X POST http://localhost:3000/api/test-openrouter \
  -H "Content-Type: application/json" \
  -d '{"message": "请介绍一下小红书平台"}'
```

#### 方式 3: 使用浏览器或 Postman
1. 打开 Postman 或任何 HTTP 客户端
2. 创建 POST 请求到 `http://localhost:3000/api/test-openrouter`
3. 设置 Content-Type 为 `application/json`
4. 在 Body 中添加 JSON：
   ```json
   {
     "message": "你的问题"
   }
   ```

## 测试脚本功能

`test-openrouter-api.js` 脚本会执行 3 个测试：

1. **GET 请求测试** - 检查接口是否可访问
2. **英文对话测试** - 测试基本的 AI 对话功能
3. **中文对话测试** - 测试中文支持

## 注意事项

1. ⚠️ **API Key 安全**
   - 当前 API Key 是硬编码在代码中的（仅用于测试）
   - 生产环境请使用环境变量：`.env.local` 中添加 `OPENROUTER_API_KEY=xxx`

2. 📊 **Token 消费**
   - 每次调用会消耗 OpenRouter 的 Token
   - 可通过返回的 `usage` 字段查看消耗量

3. 🌐 **网络要求**
   - 需要能够访问 OpenRouter API (api.openrouter.ai)
   - 如有代理需求，请配置相应的网络环境

4. 🔧 **模型切换**
   - 当前使用 `openai/gpt-4o` 模型
   - 可在 `route.ts` 中修改 `model` 参数切换其他模型
   - 支持的模型列表：https://openrouter.ai/docs#models

## 常见错误处理

### 401 Unauthorized
```
原因：API Key 无效或未配置
解决：检查 API Key 是否正确
```

### 429 Too Many Requests
```
原因：请求频率超限
解决：降低请求频率或升级套餐
```

### Network Error
```
原因：无法连接到 OpenRouter API
解决：检查网络连接和防火墙设置
```

## 下一步

将此测试接口改造为实际的业务接口：

1. 将 API Key 移到环境变量
2. 添加用户认证和权限控制
3. 实现流式响应（stream: true）
4. 添加对话历史管理
5. 集成到实际的笔记分析功能中

## 相关文档

- OpenRouter 官方文档: https://openrouter.ai/docs
- OpenRouter SDK: https://github.com/OpenRouterTeam/openrouter-sdk-js
- Next.js API Routes: https://nextjs.org/docs/app/building-your-application/routing/route-handlers

