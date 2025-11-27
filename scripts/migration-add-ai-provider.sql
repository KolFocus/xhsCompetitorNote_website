-- ============================================================================
-- AI 提供商功能数据库迁移脚本
-- 用途：支持在 ChatAI 和 OpenRouter 之间切换 AI 提供商
-- 创建时间：2025-11-27
-- ============================================================================

-- ============================================================================
-- 第一部分：添加笔记表字段
-- ============================================================================

-- 1. 在 qiangua_note_info 表中添加 AiProvider 字段
ALTER TABLE qiangua_note_info 
ADD COLUMN IF NOT EXISTS "AiProvider" TEXT;

-- 2. 添加字段注释
COMMENT ON COLUMN qiangua_note_info."AiProvider" 
IS 'AI分析使用的提供商: chatai(ChatAI官方渠道) 或 openrouter(OpenRouter多渠道)';

-- 3. 添加检查约束（可选，确保数据完整性）
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'check_ai_provider' 
        AND conrelid = 'qiangua_note_info'::regclass
    ) THEN
        ALTER TABLE qiangua_note_info
        ADD CONSTRAINT check_ai_provider 
        CHECK ("AiProvider" IN ('chatai', 'openrouter') OR "AiProvider" IS NULL);
    END IF;
END $$;

-- ============================================================================
-- 第二部分：添加系统配置项
-- ============================================================================

-- 1. 插入 AI 提供商配置（默认为 chatai）
INSERT INTO public.system_config (config_key, config_value, config_desc, updated_by) 
VALUES (
    'ai_provider', 
    'chatai',
    'AI分析提供商: chatai(ChatAI官方渠道) 或 openrouter(OpenRouter多渠道)',
    'system_migration'
)
ON CONFLICT (config_key) DO NOTHING;

-- 2. 插入 OpenRouter API Key 配置项（初始为空，需在前端配置）
INSERT INTO public.system_config (config_key, config_value, config_desc, updated_by) 
VALUES (
    'openrouter_api_key', 
    '',
    'OpenRouter API Key (格式: sk-or-v1-xxx)，在使用 OpenRouter 提供商时必填',
    'system_migration'
)
ON CONFLICT (config_key) DO NOTHING;

-- ============================================================================
-- 第三部分：数据验证查询（执行后可用于验证）
-- ============================================================================

-- 查询所有 AI 相关配置
SELECT 
    config_key,
    config_value,
    config_desc,
    updated_at,
    updated_by
FROM public.system_config
WHERE config_key IN ('ai_provider', 'ai_model', 'openrouter_api_key')
ORDER BY config_key;

-- 查询 qiangua_note_info 表结构（验证字段是否添加成功）
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_name = 'qiangua_note_info'
    AND column_name = 'AiProvider';

-- 统计各提供商的使用情况（迁移后可能都是 NULL）
SELECT 
    "AiProvider",
    "AiStatus",
    COUNT(*) as count
FROM qiangua_note_info
WHERE "AiProvider" IS NOT NULL
GROUP BY "AiProvider", "AiStatus"
ORDER BY "AiProvider", "AiStatus";

-- ============================================================================
-- 回滚脚本（如需回滚，请执行以下语句）
-- ============================================================================
-- 注意：回滚会删除字段和配置，请谨慎使用

/*
-- 删除约束
ALTER TABLE qiangua_note_info DROP CONSTRAINT IF EXISTS check_ai_provider;

-- 删除字段
ALTER TABLE qiangua_note_info DROP COLUMN IF EXISTS "AiProvider";

-- 删除配置项
DELETE FROM public.system_config WHERE config_key IN ('ai_provider', 'openrouter_api_key');
*/

-- ============================================================================
-- 迁移完成
-- ============================================================================

