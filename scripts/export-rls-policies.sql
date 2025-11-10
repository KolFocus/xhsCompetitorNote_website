-- 查询所有表的 RLS 策略
-- 在 Supabase Dashboard > SQL Editor 中执行此查询

-- 1. 查询所有表的 RLS 是否启用
SELECT 
  schemaname,
  tablename,
  rowsecurity as rls_enabled
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY tablename;

-- 2. 查询所有 RLS 策略详情
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd as command_type,
  qual as using_expression,
  with_check as with_check_expression
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;

-- 3. 查询特定表的 RLS 策略（例如 qiangua_report）
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd as command_type,
  qual as using_expression,
  with_check as with_check_expression
FROM pg_policies
WHERE schemaname = 'public' 
  AND tablename = 'qiangua_report'
ORDER BY policyname;

-- 4. 生成创建 RLS 策略的 SQL 语句（用于导出和备份）
SELECT 
  'CREATE POLICY "' || policyname || '" ON ' || schemaname || '.' || tablename ||
  ' AS ' || permissive ||
  ' FOR ' || cmd ||
  CASE 
    WHEN roles IS NOT NULL AND array_length(roles, 1) > 0 
    THEN ' TO ' || array_to_string(roles, ', ')
    ELSE ''
  END ||
  CASE 
    WHEN qual IS NOT NULL AND qual != ''
    THEN ' USING (' || qual || ')'
    ELSE ''
  END ||
  CASE 
    WHEN with_check IS NOT NULL AND with_check != ''
    THEN ' WITH CHECK (' || with_check || ')'
    ELSE ''
  END || ';' as create_policy_sql
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;

