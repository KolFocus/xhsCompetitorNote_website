-- 检查当前 qiangua_report 表的 RLS 策略配置

-- 1. 查看所有策略
SELECT 
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual,
    with_check
FROM pg_policies 
WHERE tablename = 'qiangua_report'
ORDER BY policyname, cmd;

-- 2. 检查 UPDATE 策略的详细配置
SELECT 
    policyname,
    cmd,
    qual AS using_clause,
    with_check AS with_check_clause
FROM pg_policies 
WHERE tablename = 'qiangua_report' 
    AND cmd = 'UPDATE';

-- 3. 检查表是否启用了 RLS
SELECT 
    tablename,
    rowsecurity AS rls_enabled
FROM pg_tables 
WHERE tablename = 'qiangua_report';

