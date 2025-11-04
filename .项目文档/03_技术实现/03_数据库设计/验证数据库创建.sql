-- ============================================
-- 数据库创建验证脚本
-- 用于检查所有表、索引、触发器和RLS策略是否已正确创建
-- ============================================

-- ============================================
-- 1. 检查表是否存在
-- ============================================
SELECT 
    '表检查' AS "检查项",
    table_name AS "对象名称",
    CASE 
        WHEN table_name IN ('qiangua_blogger', 'qiangua_brand', 'qiangua_note_info') THEN '✅ 存在'
        ELSE '❌ 缺失'
    END AS "状态"
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN ('qiangua_blogger', 'qiangua_brand', 'qiangua_note_info')
ORDER BY table_name;

-- ============================================
-- 2. 检查主键约束
-- ============================================
SELECT 
    '主键约束' AS "检查项",
    tc.table_name AS "表名",
    tc.constraint_name AS "约束名",
    '✅ 存在' AS "状态"
FROM information_schema.table_constraints tc
WHERE tc.constraint_type = 'PRIMARY KEY'
  AND tc.table_schema = 'public'
  AND tc.table_name IN ('qiangua_blogger', 'qiangua_brand', 'qiangua_note_info')
ORDER BY tc.table_name;

-- ============================================
-- 3. 检查外键约束
-- ============================================
SELECT 
    '外键约束' AS "检查项",
    tc.table_name AS "表名",
    tc.constraint_name AS "约束名",
    kcu.column_name AS "列名",
    ccu.table_name AS "引用表",
    '✅ 存在' AS "状态"
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu 
    ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage ccu 
    ON ccu.constraint_name = tc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY'
  AND tc.table_schema = 'public'
  AND tc.table_name = 'qiangua_note_info'
ORDER BY tc.constraint_name;

-- ============================================
-- 4. 检查索引
-- ============================================
SELECT 
    '索引检查' AS "检查项",
    schemaname AS "模式",
    tablename AS "表名",
    indexname AS "索引名",
    '✅ 存在' AS "状态"
FROM pg_indexes
WHERE schemaname = 'public'
  AND tablename IN ('qiangua_blogger', 'qiangua_brand', 'qiangua_note_info')
ORDER BY tablename, indexname;

-- ============================================
-- 5. 检查触发器函数
-- ============================================
SELECT 
    '触发器函数' AS "检查项",
    routine_name AS "函数名",
    routine_type AS "类型",
    '✅ 存在' AS "状态"
FROM information_schema.routines
WHERE routine_schema = 'public'
  AND routine_name = 'update_updated_at_column';

-- ============================================
-- 6. 检查触发器
-- ============================================
SELECT 
    '触发器检查' AS "检查项",
    event_object_table AS "表名",
    trigger_name AS "触发器名",
    event_manipulation AS "事件",
    action_timing AS "时机",
    '✅ 存在' AS "状态"
FROM information_schema.triggers
WHERE event_object_schema = 'public'
  AND event_object_table IN ('qiangua_blogger', 'qiangua_brand', 'qiangua_note_info')
  AND trigger_name LIKE 'trg_%updated_at'
ORDER BY event_object_table;

-- ============================================
-- 7. 检查RLS是否启用
-- ============================================
SELECT 
    'RLS启用状态' AS "检查项",
    schemaname AS "模式",
    tablename AS "表名",
    CASE 
        WHEN rowsecurity THEN '✅ 已启用'
        ELSE '❌ 未启用'
    END AS "状态"
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN ('qiangua_blogger', 'qiangua_brand', 'qiangua_note_info')
ORDER BY tablename;

-- ============================================
-- 8. 检查RLS策略
-- ============================================
SELECT 
    'RLS策略' AS "检查项",
    schemaname AS "模式",
    tablename AS "表名",
    policyname AS "策略名",
    permissive AS "类型",
    roles AS "角色",
    cmd AS "操作",
    qual AS "USING表达式",
    with_check AS "WITH CHECK表达式",
    '✅ 存在' AS "状态"
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN ('qiangua_blogger', 'qiangua_brand', 'qiangua_note_info')
ORDER BY tablename, policyname;

-- ============================================
-- 9. 检查表字段数量（验证表结构完整性）
-- ============================================
SELECT 
    '表字段数量' AS "检查项",
    table_name AS "表名",
    COUNT(*) AS "字段数量",
    CASE 
        WHEN table_name = 'qiangua_blogger' AND COUNT(*) >= 35 THEN '✅ 完整'
        WHEN table_name = 'qiangua_brand' AND COUNT(*) >= 6 THEN '✅ 完整'
        WHEN table_name = 'qiangua_note_info' AND COUNT(*) >= 40 THEN '✅ 完整'
        ELSE '⚠️  字段可能缺失'
    END AS "状态"
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name IN ('qiangua_blogger', 'qiangua_brand', 'qiangua_note_info')
GROUP BY table_name
ORDER BY table_name;

-- ============================================
-- 10. 汇总检查结果
-- ============================================
SELECT 
    '汇总' AS "检查项",
    COUNT(DISTINCT t.table_name) || '/3' AS "表数量",
    COUNT(DISTINCT pk.constraint_name) || '/3' AS "主键数量",
    COUNT(DISTINCT fk.constraint_name) || '/2' AS "外键数量",
    COUNT(DISTINCT idx.indexname) || '/15+' AS "索引数量",
    COUNT(DISTINCT trg.trigger_name) || '/3' AS "触发器数量",
    COUNT(DISTINCT pol.policyname) || '/6' AS "RLS策略数量",
    CASE 
        WHEN COUNT(DISTINCT t.table_name) = 3 
         AND COUNT(DISTINCT pk.constraint_name) = 3
         AND COUNT(DISTINCT fk.constraint_name) = 2
         AND COUNT(DISTINCT trg.trigger_name) = 3
         AND COUNT(DISTINCT pol.policyname) >= 6
        THEN '✅ 所有对象已创建'
        ELSE '⚠️  部分对象可能缺失'
    END AS "总体状态"
FROM information_schema.tables t
LEFT JOIN information_schema.table_constraints pk 
    ON t.table_name = pk.table_name AND pk.constraint_type = 'PRIMARY KEY'
LEFT JOIN information_schema.table_constraints fk 
    ON t.table_name = fk.table_name AND fk.constraint_type = 'FOREIGN KEY'
LEFT JOIN pg_indexes idx 
    ON t.table_name = idx.tablename
LEFT JOIN information_schema.triggers trg 
    ON t.table_name = trg.event_object_table
LEFT JOIN pg_policies pol 
    ON t.table_name = pol.tablename
WHERE t.table_schema = 'public'
  AND t.table_name IN ('qiangua_blogger', 'qiangua_brand', 'qiangua_note_info');

-- ============================================
-- 验证完成
-- ============================================
-- 如果所有检查项都显示 ✅，说明数据库创建成功
-- 如果有 ❌ 或 ⚠️，请检查对应的对象是否缺失
-- ============================================

