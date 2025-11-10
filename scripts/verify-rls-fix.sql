-- 验证 RLS 策略修复是否成功
-- 执行此脚本前，请先执行 fix-delete-report-rls.sql

-- 检查 UPDATE 策略是否正确配置
SELECT 
    policyname,
    cmd,
    qual AS using_clause,
    with_check AS with_check_clause,
    CASE 
        WHEN with_check LIKE '%hide%' AND with_check LIKE '%active%' THEN '✅ 正确配置'
        ELSE '❌ 配置不正确'
    END AS status
FROM pg_policies 
WHERE tablename = 'qiangua_report' 
    AND cmd = 'UPDATE'
    AND policyname = 'Users can update their own reports';

-- 如果上面的查询返回空结果，说明策略不存在或名称不匹配
-- 查看所有 UPDATE 策略
SELECT 
    policyname,
    cmd,
    with_check
FROM pg_policies 
WHERE tablename = 'qiangua_report' 
    AND cmd = 'UPDATE';

