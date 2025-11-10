-- 完整修复删除报告RLS策略问题
-- 此脚本会：
-- 1. 检查并删除旧的UPDATE策略
-- 2. 重新创建正确的UPDATE策略
-- 3. 确保策略格式与数据库完全一致

-- ============================================
-- 步骤1: 检查当前策略
-- ============================================
-- 查看当前UPDATE策略（执行前先运行此查询确认）
-- SELECT policyname, cmd, qual, with_check FROM pg_policies 
-- WHERE tablename = 'qiangua_report' AND cmd = 'UPDATE';

-- ============================================
-- 步骤2: 删除旧的UPDATE策略（如果存在）
-- ============================================
DROP POLICY IF EXISTS "Users can update their own reports" ON public.qiangua_report;

-- ============================================
-- 步骤3: 创建新的UPDATE策略
-- ============================================
-- 重要：UPDATE策略需要满足以下条件：
-- 1. USING: 检查更新前的行，只验证UserId（因为更新前的行Status='active'可以通过SELECT策略）
-- 2. WITH CHECK: 检查更新后的行，允许Status为'active'或'hide'
-- 3. 格式必须与数据库现有策略完全一致（包括括号、类型转换等）

CREATE POLICY "Users can update their own reports"
    ON public.qiangua_report
    AS PERMISSIVE
    FOR UPDATE
    TO public
    USING ((auth.uid() = "UserId"))
    WITH CHECK (
        (auth.uid() = "UserId") 
        AND (
            ("Status")::text = 'active'::text 
            OR ("Status")::text = 'hide'::text
        )
    );

-- ============================================
-- 步骤4: 验证策略已创建
-- ============================================
-- 执行以下查询确认策略已正确创建：
-- SELECT 
--     policyname,
--     cmd,
--     qual AS using_clause,
--     with_check AS with_check_clause
-- FROM pg_policies 
-- WHERE tablename = 'qiangua_report' 
--     AND cmd = 'UPDATE'
--     AND policyname = 'Users can update their own reports';

-- ============================================
-- 说明：
-- ============================================
-- 1. USING子句：只检查UserId，不检查Status
--    - 因为更新前的行Status='active'，可以通过SELECT策略
--    - 如果USING也检查Status='active'，会导致无法更新（因为要更新为'hide'）
--
-- 2. WITH CHECK子句：检查更新后的行
--    - 必须验证UserId匹配（防止修改别人的报告）
--    - 允许Status为'active'或'hide'（允许删除操作）
--    - 防止设置其他无效状态
--
-- 3. 为什么需要允许Status='hide'：
--    - 删除操作是将Status从'active'更新为'hide'
--    - 如果WITH CHECK只允许Status='active'，删除操作会失败
--
-- 4. SELECT策略仍然限制只能查询Status='active'的报告
--    - 这是正确的，已删除的报告不应该被查询
--    - 但UPDATE策略需要允许更新Status为'hide'，这就是为什么需要更宽松的WITH CHECK

