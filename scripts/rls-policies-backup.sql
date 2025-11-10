-- RLS 策略备份文件
-- 生成时间: 2024-12-XX
-- 说明: 此文件包含所有表的 RLS 策略，可用于重新创建策略

-- ============================================
-- qiangua_blogger 表策略
-- ============================================

CREATE POLICY "Service role can write bloggers" ON public.qiangua_blogger 
AS PERMISSIVE FOR INSERT TO public 
WITH CHECK ((auth.role() = 'service_role'::text));

CREATE POLICY "Users can read bloggers" ON public.qiangua_blogger 
AS PERMISSIVE FOR SELECT TO public 
USING (true);

-- ============================================
-- qiangua_brand 表策略
-- ============================================

CREATE POLICY "Service role can write brands" ON public.qiangua_brand 
AS PERMISSIVE FOR INSERT TO public 
WITH CHECK ((auth.role() = 'service_role'::text));

CREATE POLICY "Users can read brands" ON public.qiangua_brand 
AS PERMISSIVE FOR SELECT TO public 
USING (true);

-- ============================================
-- qiangua_report 表策略
-- ============================================

CREATE POLICY "Users can create their own reports" ON public.qiangua_report 
AS PERMISSIVE FOR INSERT TO public 
WITH CHECK ((auth.uid() = "UserId"));

CREATE POLICY "Users can delete their own reports" ON public.qiangua_report 
AS PERMISSIVE FOR DELETE TO public 
USING ((auth.uid() = "UserId"));

CREATE POLICY "Users can update their own reports" ON public.qiangua_report 
AS PERMISSIVE FOR UPDATE TO public 
USING ((auth.uid() = "UserId")) 
WITH CHECK ((auth.uid() = "UserId"));

CREATE POLICY "Users can view their own reports" ON public.qiangua_report 
AS PERMISSIVE FOR SELECT TO public 
USING (((auth.uid() = "UserId") AND (("Status")::text = 'active'::text)));

-- ============================================
-- qiangua_report_note_rel 表策略
-- ============================================

CREATE POLICY "Users can add notes to their reports" ON public.qiangua_report_note_rel 
AS PERMISSIVE FOR INSERT TO public 
WITH CHECK ((EXISTS ( 
  SELECT 1
  FROM qiangua_report
  WHERE ((qiangua_report."ReportId" = qiangua_report_note_rel."ReportId") 
    AND (qiangua_report."UserId" = auth.uid()) 
    AND ((qiangua_report."Status")::text = 'active'::text))
)));

CREATE POLICY "Users can delete notes from their reports" ON public.qiangua_report_note_rel 
AS PERMISSIVE FOR DELETE TO public 
USING ((EXISTS ( 
  SELECT 1
  FROM qiangua_report
  WHERE ((qiangua_report."ReportId" = qiangua_report_note_rel."ReportId") 
    AND (qiangua_report."UserId" = auth.uid()) 
    AND ((qiangua_report."Status")::text = 'active'::text))
)));

CREATE POLICY "Users can update notes in their reports" ON public.qiangua_report_note_rel 
AS PERMISSIVE FOR UPDATE TO public 
USING ((EXISTS ( 
  SELECT 1
  FROM qiangua_report
  WHERE ((qiangua_report."ReportId" = qiangua_report_note_rel."ReportId") 
    AND (qiangua_report."UserId" = auth.uid()) 
    AND ((qiangua_report."Status")::text = 'active'::text))
))) 
WITH CHECK ((EXISTS ( 
  SELECT 1
  FROM qiangua_report
  WHERE ((qiangua_report."ReportId" = qiangua_report_note_rel."ReportId") 
    AND (qiangua_report."UserId" = auth.uid()) 
    AND ((qiangua_report."Status")::text = 'active'::text))
)));

CREATE POLICY "Users can view notes in their reports" ON public.qiangua_report_note_rel 
AS PERMISSIVE FOR SELECT TO public 
USING ((EXISTS ( 
  SELECT 1
  FROM qiangua_report
  WHERE ((qiangua_report."ReportId" = qiangua_report_note_rel."ReportId") 
    AND (qiangua_report."UserId" = auth.uid()) 
    AND ((qiangua_report."Status")::text = 'active'::text))
)));

-- ============================================
-- user_login_history 表策略
-- ============================================

CREATE POLICY "Authenticated users can view login history" ON public.user_login_history 
AS PERMISSIVE FOR SELECT TO public 
USING ((auth.role() = 'authenticated'::text));

CREATE POLICY "System can insert login history" ON public.user_login_history 
AS PERMISSIVE FOR INSERT TO public 
WITH CHECK (true);

CREATE POLICY "System can update login history" ON public.user_login_history 
AS PERMISSIVE FOR UPDATE TO public 
USING (true);

-- ============================================
-- user_profiles 表策略
-- ============================================

CREATE POLICY "Users can insert own profile" ON public.user_profiles 
AS PERMISSIVE FOR INSERT TO public 
WITH CHECK ((auth.uid() = id));

CREATE POLICY "Users can update own profile" ON public.user_profiles 
AS PERMISSIVE FOR UPDATE TO public 
USING ((auth.uid() = id));

CREATE POLICY "Users can view own profile" ON public.user_profiles 
AS PERMISSIVE FOR SELECT TO public 
USING ((auth.uid() = id));

-- ============================================
-- 品牌离线导入_kos销售数据 表策略
-- ============================================

CREATE POLICY "销售数据_所有人可读写" ON public."品牌离线导入_kos销售数据" 
AS PERMISSIVE FOR ALL TO public 
USING (true) 
WITH CHECK (true);

-- ============================================
-- 用户品牌表 策略
-- ============================================

CREATE POLICY "认证用户可以管理品牌表" ON public."用户品牌表" 
AS PERMISSIVE FOR ALL TO public 
USING ((auth.role() = 'authenticated'::text));

-- ============================================
-- 用户平台表 策略
-- ============================================

CREATE POLICY "认证用户可以管理平台表" ON public."用户平台表" 
AS PERMISSIVE FOR ALL TO public 
USING ((auth.role() = 'authenticated'::text));

