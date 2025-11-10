-- 验证 UPDATE 策略是否正确应用
-- 执行此脚本确认策略配置

-- 1. 查看所有 qiangua_report 表的策略
SELECT 
    policyname,
    cmd,
    permissive,
    roles,
    qual AS using_clause,
    with_check AS with_check_clause
FROM pg_policies 
WHERE tablename = 'qiangua_report'
ORDER BY cmd, policyname;

-- 2. 重点检查 UPDATE 策略
SELECT 
    policyname,
    cmd,
    qual AS using_clause,
    with_check AS with_check_clause,
    CASE 
        WHEN with_check IS NULL THEN '❌ 没有WITH CHECK（可能有问题）'
        WHEN with_check LIKE '%hide%' AND with_check LIKE '%active%' THEN '✅ 正确配置（允许active和hide）'
        WHEN with_check LIKE '%hide%' THEN '⚠️  只允许hide（可能有问题）'
        WHEN with_check LIKE '%active%' THEN '⚠️  只允许active（会导致删除失败）'
        ELSE '⚠️  未知配置'
    END AS status_check
FROM pg_policies 
WHERE tablename = 'qiangua_report' 
    AND cmd = 'UPDATE'
    AND policyname = 'Users can update their own reports';

-- 3. 如果没有找到策略，说明策略不存在
-- 如果找到了但WITH CHECK不包含'hide'，说明需要重新运行修复脚本

