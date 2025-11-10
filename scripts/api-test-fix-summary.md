# API 测试用例失败原因分析及修复

## 问题原因

API 测试用例运行失败的根本原因是：**Supabase 客户端在 API Route Handler 中无法正确读取 Cookie 认证信息**。

### 具体问题

1. **Cookie 读取方式不正确**：
   - `lib/supabase/server.ts` 中的 `createServerClient()` 使用了 `cookies()` from `next/headers`
   - 在 API Route Handler 中，这种方式无法正确读取从测试脚本发送的 Cookie
   - 测试脚本通过 HTTP 请求发送的 Cookie 需要通过 `NextRequest.cookies` 来读取

2. **RLS 策略限制**：
   - 所有 API 都需要用户认证（`auth.uid()`）
   - 如果认证失败，RLS 策略会阻止数据库操作
   - 之前由于 Cookie 读取失败，导致 `supabase.auth.getUser()` 返回 `null`，从而触发 401 错误

## 修复方案

### 1. 更新 `lib/supabase/server.ts`

修改 `createServerClient` 函数，支持两种使用方式：

- **Server Components**: `createServerClient()` - 使用 `cookies()` from `next/headers`
- **API Route Handlers**: `createServerClient(request)` - 使用 `request.cookies` from `NextRequest`

```typescript
export const createServerClient = (request?: NextRequest) => {
  // 如果在 API Route Handler 中使用，从 request 读取 cookies
  if (request) {
    return createSupabaseServerClient(..., {
      cookies: {
        get(name: string) {
          return request.cookies.get(name)?.value;
        },
        // ...
      },
    });
  }
  
  // 在 Server Components 中使用
  const cookieStore = cookies();
  // ...
};
```

### 2. 更新所有 API Route Handlers

将所有报告相关的 API 路由中的 `createServerClient()` 改为 `createServerClient(request)`：

- ✅ `app/api/reports/route.ts` (GET, POST)
- ✅ `app/api/reports/[id]/route.ts` (GET, DELETE)
- ✅ `app/api/reports/calculate-notes/route.ts` (POST)
- ✅ `app/api/reports/[id]/calculate-new-notes/route.ts` (POST)
- ✅ `app/api/reports/[id]/notes/route.ts` (GET)
- ✅ `app/api/reports/[id]/notes/batch-action/route.ts` (POST)
- ✅ `app/api/reports/[id]/add-notes/route.ts` (POST)

## 测试验证

修复后，测试脚本应该能够：

1. ✅ 正确发送 Cookie 认证信息
2. ✅ API 路由正确读取 Cookie
3. ✅ `supabase.auth.getUser()` 返回正确的用户信息
4. ✅ RLS 策略允许数据库操作（因为用户已认证）

## 如何测试

运行测试脚本：

```bash
# 确保 Next.js 开发服务器正在运行
npm run dev

# 在另一个终端运行测试
node scripts/test-reports-api.js
node scripts/test-create-report-single.js
node scripts/test-notes-batch-action.js
```

## 注意事项

1. **Cookie 格式**：测试脚本构建的 Cookie 格式必须符合 Supabase SSR 的要求：
   - Cookie 名称：`sb-{project-ref}-auth-token`
   - Cookie 值：JSON 字符串，包含 `access_token`, `refresh_token`, `expires_at` 等

2. **认证流程**：
   - 测试脚本首先通过 `supabase.auth.signInWithPassword()` 登录
   - 获取 session 后，构建 Cookie 并发送到 API
   - API 路由通过 `createServerClient(request)` 读取 Cookie
   - Supabase SSR 自动解析 Cookie 并获取用户信息

3. **RLS 策略**：
   - 所有策略都要求 `auth.uid() = UserId`
   - 修复后，认证信息可以正确传递，RLS 策略会正常工作

## 相关文件

- `lib/supabase/server.ts` - Supabase 服务端客户端配置
- `app/api/reports/**/*.ts` - 所有报告相关的 API 路由
- `scripts/test-*.js` - 测试脚本
- `scripts/rls-policies-backup.sql` - RLS 策略备份

