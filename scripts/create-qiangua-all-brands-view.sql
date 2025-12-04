-- 创建/更新 qiangua_all_brands 视图
-- 包含 DateCoverage 字段（从 qiangua_brand 表获取）

CREATE OR REPLACE VIEW qiangua_all_brands AS
SELECT DISTINCT ON (n."BrandId", n."BrandName")
  n."BrandId",
  b."BrandIdKey",
  n."BrandName",
  b."DateCoverage"::jsonb as "DateCoverage"
FROM qiangua_note_info n
LEFT JOIN qiangua_brand b ON n."BrandId" = b."BrandId"
WHERE n."BrandId" IS NOT NULL
ORDER BY n."BrandId", n."BrandName";

