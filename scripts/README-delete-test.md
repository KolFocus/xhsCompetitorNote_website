# 删除报告功能测试说明

## 前置条件

在运行测试之前，**必须先执行 RLS 策略修复脚本**：

1. 打开 Supabase Dashboard
2. 进入 SQL Editor
3. 执行以下脚本：
   ```sql
   -- 文件: scripts/fix-delete-report-rls.sql
   ```
4. 确认脚本执行成功

## 测试步骤

1. 确保 Next.js 开发服务器正在运行：
   ```bash
   npm run dev
   ```

2. 在另一个终端运行测试：
   ```bash
   node scripts/test-delete-report-api.js
   ```

## 预期结果

- ✅ 登录成功
- ✅ 找到或创建测试报告
- ✅ 删除API调用成功（状态码 200）
- ✅ 报告状态已更新为 'hide'
- ✅ 已删除报告无法通过 GET API 查询（返回 404）

## 如果测试失败

如果看到错误 "new row violates row-level security policy"：

1. **确认 RLS 策略已更新**：
   - 在 Supabase SQL Editor 中执行：
     ```sql
     SELECT * FROM pg_policies 
     WHERE tablename = 'qiangua_report' 
     AND policyname = 'Users can update their own reports';
     ```
   - 检查 `with_check` 列是否包含 `("Status" = 'active' OR "Status" = 'hide')`

2. **重新执行修复脚本**：
   - 确保 `scripts/fix-delete-report-rls.sql` 已完整执行

3. **检查数据库中的状态值**：
   - 确认没有使用旧的状态值 'delete'
   - 如果有，执行迁移脚本：`scripts/migrate-status-delete-to-hide.sql`

