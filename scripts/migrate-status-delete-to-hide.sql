-- ============================================
-- 迁移脚本：将Status从'delete'改为'hide'
-- ============================================
-- 说明：如果数据库中已有Status='delete'的记录，需要迁移为'hide'
-- 执行时机：在修复RLS策略之前或之后执行都可以
-- ============================================

-- 检查是否有Status='delete'的记录
DO $$
DECLARE
    delete_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO delete_count
    FROM qiangua_report
    WHERE "Status" = 'delete';
    
    IF delete_count > 0 THEN
        RAISE NOTICE '发现 % 条Status=''delete''的记录，将迁移为''hide''', delete_count;
        
        -- 更新所有Status='delete'的记录为'hide'
        UPDATE qiangua_report
        SET "Status" = 'hide'
        WHERE "Status" = 'delete';
        
        RAISE NOTICE '迁移完成：% 条记录已更新', delete_count;
    ELSE
        RAISE NOTICE '未发现Status=''delete''的记录，无需迁移';
    END IF;
END $$;

-- 验证迁移结果
SELECT 
    "Status",
    COUNT(*) as count
FROM qiangua_report
GROUP BY "Status"
ORDER BY "Status";

