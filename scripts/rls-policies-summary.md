# RLS 策略总结文档

## 策略概览

本文档总结了数据库中所有表的 RLS (Row Level Security) 策略。

---

## qiangua_blogger 表

### 策略列表

1. **Service role can write bloggers** (INSERT)
   - 允许 service_role 角色插入数据
   - 条件: `auth.role() = 'service_role'`

2. **Users can read bloggers** (SELECT)
   - 所有用户可读取
   - 条件: `true` (无限制)

---

## qiangua_brand 表

### 策略列表

1. **Service role can write brands** (INSERT)
   - 允许 service_role 角色插入数据
   - 条件: `auth.role() = 'service_role'`

2. **Users can read brands** (SELECT)
   - 所有用户可读取
   - 条件: `true` (无限制)

---

## qiangua_report 表 ⭐

### 策略列表

1. **Users can create their own reports** (INSERT)
   - 用户只能创建自己的报告
   - 条件: `auth.uid() = UserId`

2. **Users can view their own reports** (SELECT)
   - 用户只能查看自己的报告
   - 条件: `auth.uid() = UserId AND Status = 'active'`
   - ⚠️ **注意**: 只能查看状态为 'active' 的报告

3. **Users can update their own reports** (UPDATE)
   - 用户只能更新自己的报告
   - 条件: `auth.uid() = UserId` (USING 和 WITH CHECK)

4. **Users can delete their own reports** (DELETE)
   - 用户只能删除自己的报告
   - 条件: `auth.uid() = UserId`

### 安全分析

✅ **优点**:
- 用户隔离完善，每个用户只能操作自己的报告
- SELECT 策略限制了只能查看 active 状态的报告，提供了软删除支持

⚠️ **注意事项**:
- 如果报告被标记为非 'active' 状态，用户将无法通过 SELECT 查询到该报告
- 这符合设计文档中"删除报告后不显示在下拉列表中"的需求

---

## qiangua_report_note_rel 表 ⭐

### 策略列表

1. **Users can add notes to their reports** (INSERT)
   - 用户只能向自己的活跃报告添加笔记
   - 条件: 报告必须属于当前用户且状态为 'active'

2. **Users can view notes in their reports** (SELECT)
   - 用户只能查看自己活跃报告中的笔记
   - 条件: 报告必须属于当前用户且状态为 'active'

3. **Users can update notes in their reports** (UPDATE)
   - 用户只能更新自己活跃报告中的笔记
   - 条件: 报告必须属于当前用户且状态为 'active'

4. **Users can delete notes from their reports** (DELETE)
   - 用户只能从自己的活跃报告中删除笔记
   - 条件: 报告必须属于当前用户且状态为 'active'

### 安全分析

✅ **优点**:
- 通过子查询确保操作权限，只有报告所有者才能管理报告中的笔记
- 自动关联报告状态，非活跃报告无法操作

✅ **符合设计需求**:
- 策略确保只有报告所有者可以管理笔记
- 支持报告级别的权限控制

---

## user_login_history 表

### 策略列表

1. **Authenticated users can view login history** (SELECT)
   - 认证用户可查看登录历史
   - 条件: `auth.role() = 'authenticated'`

2. **System can insert login history** (INSERT)
   - 系统可以插入登录历史
   - 条件: `true` (无限制)

3. **System can update login history** (UPDATE)
   - 系统可以更新登录历史
   - 条件: `true` (无限制)

---

## user_profiles 表

### 策略列表

1. **Users can insert own profile** (INSERT)
   - 用户只能创建自己的档案
   - 条件: `auth.uid() = id`

2. **Users can view own profile** (SELECT)
   - 用户只能查看自己的档案
   - 条件: `auth.uid() = id`

3. **Users can update own profile** (UPDATE)
   - 用户只能更新自己的档案
   - 条件: `auth.uid() = id`

---

## 其他表

### 品牌离线导入_kos销售数据
- **策略**: 所有人可读写 (ALL)
- 条件: `true` (无限制)

### 用户品牌表
- **策略**: 认证用户可以管理 (ALL)
- 条件: `auth.role() = 'authenticated'`

### 用户平台表
- **策略**: 认证用户可以管理 (ALL)
- 条件: `auth.role() = 'authenticated'`

---

## 总结

### 核心表策略完整性

✅ **qiangua_report**: 
- 完整的 CRUD 策略
- 用户隔离完善
- 支持状态过滤

✅ **qiangua_report_note_rel**: 
- 完整的 CRUD 策略
- 通过关联查询确保权限
- 自动检查报告状态

### 安全建议

1. ✅ 报告和笔记关系表的策略设计合理，符合业务需求
2. ✅ 用户数据隔离完善，每个用户只能操作自己的数据
3. ⚠️ 注意：如果需要在服务端（使用 Service Role）操作报告数据，需要确保正确设置 UserId

### 潜在问题

1. **服务端插入报告**: 如果使用 Service Role Key 插入报告，需要手动设置正确的 UserId
2. **软删除报告**: SELECT 策略已支持，删除报告后用户将无法看到（符合需求）

