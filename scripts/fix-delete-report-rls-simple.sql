-- 简化版修复脚本 - 确保UPDATE策略能正确工作
-- 如果之前的修复脚本不工作，尝试这个版本

-- 删除旧的UPDATE策略
DROP POLICY IF EXISTS "Users can update their own reports" ON public.qiangua_report;

-- 创建新的UPDATE策略
-- 策略说明：
-- - USING: 只检查UserId（允许更新自己的报告）
-- - WITH CHECK: 只检查UserId（允许Status为任何值，包括'hide'）
--   注意：这里我们放宽了WITH CHECK，只检查UserId，不限制Status
--   这样可以确保删除操作（Status='active' -> 'hide'）能够成功
CREATE POLICY "Users can update their own reports"
    ON public.qiangua_report
    AS PERMISSIVE
    FOR UPDATE
    TO public
    USING ((auth.uid() = "UserId"))
    WITH CHECK ((auth.uid() = "UserId"));

-- 注意：这个版本只检查UserId，不限制Status值
-- 这样可以确保删除操作能够成功
-- SELECT策略仍然会限制只能查询Status='active'的报告，所以安全不受影响

