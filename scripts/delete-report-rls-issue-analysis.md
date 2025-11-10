# 删除报告RLS策略问题分析和解决方案

## 问题描述

**错误信息：**
```
new row violates row-level security policy for table "qiangua_report"
错误代码: 42501
```

**场景：**
- 删除报告操作（逻辑删除：将Status更新为'hide'）失败
- 更新其他字段正常
- 只有更新Status为'hide'时才会失败

**注意：** 原使用'delete'作为状态值，但'delete'是SQL保留关键字，可能引发问题，已改为'hide'

## 根本原因

### 1. RLS策略配置

**SELECT策略：**
```sql
CREATE POLICY "Users can view their own reports"
    ON qiangua_report
    FOR SELECT
    USING (auth.uid() = "UserId" AND "Status" = 'active');
```

**UPDATE策略（旧）：**
```sql
CREATE POLICY "Users can update their own reports"
    ON qiangua_report
    FOR UPDATE
    USING (auth.uid() = "UserId")
    WITH CHECK (auth.uid() = "UserId");
```

### 2. 问题分析

PostgreSQL的RLS机制在UPDATE操作时：

1. **USING子句**：检查更新**前**的行是否符合条件 ✅
   - 条件：`auth.uid() = "UserId"` 
   - 结果：通过（是自己的报告）

2. **WITH CHECK子句**：检查更新**后**的行是否符合条件 ⚠️
   - 条件：`auth.uid() = "UserId"`
   - 但是，PostgreSQL在某些情况下会**隐式验证**更新后的行是否符合SELECT策略
   - SELECT策略要求：`Status = 'active'`
   - 当Status更新为`'hide'`时，更新后的行不符合SELECT策略
   - 另外，原使用'delete'作为状态值，但'delete'是SQL保留关键字，可能引发问题
   - 结果：RLS策略验证失败 ❌

### 3. 测试验证

测试结果：
- ✅ 更新其他字段（不改变Status）→ 成功
- ❌ 更新Status为'hide' → 失败（原使用'delete'，可能因SQL保留关键字导致问题）
- ✅ UPDATE策略的USING条件正常（UserId匹配）
- ✅ 报告可访问（SELECT策略正常）

这说明：
- UPDATE策略本身没问题
- 问题出在Status='hide'时，更新后的行不符合SELECT策略
- 另外，'delete'是SQL保留关键字，改为'hide'更安全

## 解决方案

### 方案：修改UPDATE策略的WITH CHECK

**新的UPDATE策略：**
```sql
CREATE POLICY "Users can update their own reports"
    ON qiangua_report
    FOR UPDATE
    USING (auth.uid() = "UserId")
    WITH CHECK (
        auth.uid() = "UserId" 
        AND ("Status" = 'active' OR "Status" = 'hide')
    );
```

**说明：**
1. **USING**：确保只能更新自己的报告
2. **WITH CHECK**：
   - 确保更新后仍然是自己的报告
   - **明确允许Status可以是'active'或'hide'**
   - 这样即使PostgreSQL隐式检查SELECT策略，也不会因为Status='hide'而失败
   - 使用'hide'而不是'delete'，避免SQL保留关键字冲突

### 执行修复

运行修复SQL脚本：
```bash
# 在Supabase SQL Editor中执行
scripts/fix-delete-report-rls.sql
```

或者直接在Supabase Dashboard的SQL Editor中执行：
```sql
DROP POLICY IF EXISTS "Users can update their own reports" ON qiangua_report;

CREATE POLICY "Users can update their own reports"
    ON qiangua_report
    FOR UPDATE
    USING (auth.uid() = "UserId")
    WITH CHECK (
        auth.uid() = "UserId" 
        AND ("Status" = 'active' OR "Status" = 'hide')
    );
```

**重要变更：**
- 状态值从 `'delete'` 改为 `'hide'`，避免SQL保留关键字冲突
- 需要在数据库中同步更新相关记录的Status值（如果有旧数据）

## 验证

修复后，运行测试脚本验证：
```bash
node scripts/test-delete-report-rls.js
```

或运行完整测试：
```bash
node scripts/test-reports-api.js
```

## 参考资料

- [PostgreSQL RLS Policy Documentation](https://www.postgresql.org/docs/current/ddl-rowsecurity.html)
- [Supabase RLS Guide](https://supabase.com/docs/guides/auth/row-level-security)

