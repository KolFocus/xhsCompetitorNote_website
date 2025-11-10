-- 修复删除报告RLS策略问题
-- 问题：UPDATE策略的WITH CHECK在Status更新为'hide'时失败
-- 原因：PostgreSQL RLS在UPDATE时会检查：
--       1. USING: 更新前的行是否可通过SELECT策略（当前SELECT策略要求Status='active'）
--       2. WITH CHECK: 更新后的行是否符合UPDATE策略的WITH CHECK
--       但是，如果UPDATE策略的WITH CHECK不够宽松，或者有其他策略干扰，会导致失败
--       另外，'delete'是SQL保留关键字，可能引发问题
-- 
-- 解决方案：
-- 1. 修改UPDATE策略的WITH CHECK，明确允许Status可以是'active'或'hide'
-- 2. 确保UPDATE策略的USING子句只检查UserId，不检查Status（因为更新前的行Status='active'，可以通过SELECT策略）

-- 删除旧的UPDATE策略（确保使用正确的表名和策略名）
DROP POLICY IF EXISTS "Users can update their own reports" ON public.qiangua_report;

-- 创建新的UPDATE策略
-- USING: 只检查UserId，不检查Status（因为更新前的行Status='active'，可以通过SELECT策略）
-- WITH CHECK: 允许Status可以是'active'或'hide'
CREATE POLICY "Users can update their own reports"
    ON public.qiangua_report
    AS PERMISSIVE
    FOR UPDATE
    TO public
    USING ((auth.uid() = "UserId"))
    WITH CHECK (
        (auth.uid() = "UserId") 
        AND (("Status")::text = 'active'::text OR ("Status")::text = 'hide'::text)
    );

-- 说明：
-- - USING: 检查更新前的行，只验证UserId匹配（不检查Status，因为更新前的行Status='active'可以通过SELECT策略）
-- - WITH CHECK: 检查更新后的行，确保：
--   1. 仍然是自己的报告（UserId匹配）
--   2. Status只能是'active'或'hide'（防止设置无效状态）
-- 注意：
-- - 使用'hide'而不是'delete'，避免SQL保留关键字冲突
-- - SELECT策略仍然限制只能查询Status='active'的报告，这是正确的（已删除的报告不应该被查询）
-- - UPDATE策略允许将Status从'active'更新为'hide'，这是删除操作所需要的

