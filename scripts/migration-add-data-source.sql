-- ============================================================================
-- 数据来源字段迁移脚本
-- 用途：区分千瓜插件入库 vs 灰豚离线下载入库
-- 创建时间：2026-06-30
-- ============================================================================

-- ============================================================================
-- 第一部分：qiangua_note_info
-- ============================================================================

ALTER TABLE qiangua_note_info
ADD COLUMN IF NOT EXISTS "DataSource" VARCHAR(32);

COMMENT ON COLUMN qiangua_note_info."DataSource"
IS '数据来源：千瓜（插件/API 入库）、灰豚（离线下载导入）；历史数据可为 NULL';

CREATE INDEX IF NOT EXISTS "idx_qiangua_note_info_datasource"
ON qiangua_note_info ("DataSource");

-- ============================================================================
-- 第二部分：qiangua_blogger
-- ============================================================================

ALTER TABLE qiangua_blogger
ADD COLUMN IF NOT EXISTS "DataSource" VARCHAR(32);

COMMENT ON COLUMN qiangua_blogger."DataSource"
IS '数据来源：千瓜（插件/API 入库）、灰豚（离线下载导入）；历史数据可为 NULL';

CREATE INDEX IF NOT EXISTS "idx_qiangua_blogger_datasource"
ON qiangua_blogger ("DataSource");

-- ============================================================================
-- 第三部分：可选约束（限定枚举值，NULL 表示历史未标记）
-- ============================================================================

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'check_qiangua_note_info_datasource'
          AND conrelid = 'qiangua_note_info'::regclass
    ) THEN
        ALTER TABLE qiangua_note_info
        ADD CONSTRAINT check_qiangua_note_info_datasource
        CHECK ("DataSource" IN ('千瓜', '灰豚') OR "DataSource" IS NULL);
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'check_qiangua_blogger_datasource'
          AND conrelid = 'qiangua_blogger'::regclass
    ) THEN
        ALTER TABLE qiangua_blogger
        ADD CONSTRAINT check_qiangua_blogger_datasource
        CHECK ("DataSource" IN ('千瓜', '灰豚') OR "DataSource" IS NULL);
    END IF;
END $$;

-- ============================================================================
-- 第四部分：验证查询
-- ============================================================================

SELECT
    table_name,
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name IN ('qiangua_note_info', 'qiangua_blogger')
  AND column_name = 'DataSource'
ORDER BY table_name;

-- ============================================================================
-- 回滚（谨慎执行）
-- ============================================================================
/*
ALTER TABLE qiangua_note_info DROP CONSTRAINT IF EXISTS check_qiangua_note_info_datasource;
ALTER TABLE qiangua_blogger DROP CONSTRAINT IF EXISTS check_qiangua_blogger_datasource;
DROP INDEX IF EXISTS "idx_qiangua_note_info_datasource";
DROP INDEX IF EXISTS "idx_qiangua_blogger_datasource";
ALTER TABLE qiangua_note_info DROP COLUMN IF EXISTS "DataSource";
ALTER TABLE qiangua_blogger DROP COLUMN IF EXISTS "DataSource";
*/
