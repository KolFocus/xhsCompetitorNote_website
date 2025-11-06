-- ============================================
-- 小红书竞品笔记监控系统 - 报告功能表创建SQL
-- ============================================
-- 说明：本脚本用于创建报告功能相关的2张表
-- 执行顺序：先创建 qiangua_report 表，再创建 qiangua_report_note_rel 表（因为外键依赖）
-- ============================================

-- ============================================
-- 1. 创建 qiangua_report 表（报告表）
-- ============================================
CREATE TABLE IF NOT EXISTS qiangua_report (
    "ReportId" UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    "UserId" UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    "ReportName" VARCHAR(200) NOT NULL,
    "Status" VARCHAR(20) NOT NULL DEFAULT 'active',
    "CreatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "UpdatedAt" TIMESTAMPTZ DEFAULT NOW()
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_qiangua_report_user_id ON qiangua_report("UserId");
CREATE INDEX IF NOT EXISTS idx_qiangua_report_report_name ON qiangua_report("ReportName");
CREATE INDEX IF NOT EXISTS idx_qiangua_report_status ON qiangua_report("Status");
CREATE INDEX IF NOT EXISTS idx_qiangua_report_created_at ON qiangua_report("CreatedAt");

-- 复合索引
CREATE INDEX IF NOT EXISTS idx_qiangua_report_user_status ON qiangua_report("UserId", "Status");

-- 创建更新时间触发器函数（如果不存在）
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW."UpdatedAt" = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- 创建更新时间触发器
DROP TRIGGER IF EXISTS update_qiangua_report_updated_at ON qiangua_report;
CREATE TRIGGER update_qiangua_report_updated_at 
    BEFORE UPDATE ON qiangua_report
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- 添加表注释
COMMENT ON TABLE qiangua_report IS '报告表 - 存储用户创建的报告基本信息';
COMMENT ON COLUMN qiangua_report."ReportId" IS '报告ID（主键，UUID）';
COMMENT ON COLUMN qiangua_report."UserId" IS '用户ID（外键，关联 auth.users）';
COMMENT ON COLUMN qiangua_report."ReportName" IS '报告名称（8-20个字符）';
COMMENT ON COLUMN qiangua_report."Status" IS '报告状态：active（有效）、hide（已隐藏，逻辑删除）';
COMMENT ON COLUMN qiangua_report."CreatedAt" IS '创建时间（带时区）';
COMMENT ON COLUMN qiangua_report."UpdatedAt" IS '更新时间（自动更新，带时区）';

-- ============================================
-- 2. 创建 qiangua_report_note_rel 表（报告笔记关联表）
-- ============================================
CREATE TABLE IF NOT EXISTS qiangua_report_note_rel (
    "ReportNoteId" UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    "ReportId" UUID NOT NULL REFERENCES qiangua_report("ReportId") ON DELETE CASCADE,
    "NoteId" VARCHAR(64) NOT NULL REFERENCES qiangua_note_info("NoteId") ON DELETE CASCADE,
    "Status" VARCHAR(20) NOT NULL DEFAULT 'active',
    "CreatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "UpdatedAt" TIMESTAMPTZ DEFAULT NOW(),
    -- 唯一约束：同一笔记不能重复添加到同一报告中
    CONSTRAINT "uk_qiangua_report_note_rel_report_note" UNIQUE("ReportId", "NoteId")
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_qiangua_report_note_rel_report_id ON qiangua_report_note_rel("ReportId");
CREATE INDEX IF NOT EXISTS idx_qiangua_report_note_rel_note_id ON qiangua_report_note_rel("NoteId");
CREATE INDEX IF NOT EXISTS idx_qiangua_report_note_rel_status ON qiangua_report_note_rel("Status");
CREATE INDEX IF NOT EXISTS idx_qiangua_report_note_rel_created_at ON qiangua_report_note_rel("CreatedAt");

-- 复合索引
CREATE INDEX IF NOT EXISTS idx_qiangua_report_note_rel_report_status ON qiangua_report_note_rel("ReportId", "Status");
CREATE INDEX IF NOT EXISTS idx_qiangua_report_note_rel_report_created_at ON qiangua_report_note_rel("ReportId", "CreatedAt");

-- 创建更新时间触发器
DROP TRIGGER IF EXISTS update_qiangua_report_note_rel_updated_at ON qiangua_report_note_rel;
CREATE TRIGGER update_qiangua_report_note_rel_updated_at 
    BEFORE UPDATE ON qiangua_report_note_rel
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- 添加表注释
COMMENT ON TABLE qiangua_report_note_rel IS '报告笔记关联表 - 存储报告与笔记的关联关系（多对多），包含笔记状态';
COMMENT ON COLUMN qiangua_report_note_rel."ReportNoteId" IS '关联ID（主键，UUID）';
COMMENT ON COLUMN qiangua_report_note_rel."ReportId" IS '报告ID（外键，关联 qiangua_report 表）';
COMMENT ON COLUMN qiangua_report_note_rel."NoteId" IS '笔记ID（外键，关联 qiangua_note_info 表）';
COMMENT ON COLUMN qiangua_report_note_rel."Status" IS '笔记状态：active（有效）、ignored（已忽略）';
COMMENT ON COLUMN qiangua_report_note_rel."CreatedAt" IS '创建时间（带时区）';
COMMENT ON COLUMN qiangua_report_note_rel."UpdatedAt" IS '更新时间（自动更新，带时区）';

-- ============================================
-- 3. 启用 RLS（行级安全）策略
-- ============================================

-- qiangua_report 表 RLS 策略
ALTER TABLE qiangua_report ENABLE ROW LEVEL SECURITY;

-- 策略：用户只能查看、创建、更新、删除自己的报告（仅查看有效报告）
DROP POLICY IF EXISTS "Users can view their own reports" ON qiangua_report;
CREATE POLICY "Users can view their own reports"
    ON qiangua_report
    FOR SELECT
    USING (auth.uid() = "UserId" AND "Status" = 'active');

DROP POLICY IF EXISTS "Users can create their own reports" ON qiangua_report;
CREATE POLICY "Users can create their own reports"
    ON qiangua_report
    FOR INSERT
    WITH CHECK (auth.uid() = "UserId");

DROP POLICY IF EXISTS "Users can update their own reports" ON qiangua_report;
CREATE POLICY "Users can update their own reports"
    ON qiangua_report
    FOR UPDATE
    USING (auth.uid() = "UserId")
    WITH CHECK (auth.uid() = "UserId");

DROP POLICY IF EXISTS "Users can delete their own reports" ON qiangua_report;
CREATE POLICY "Users can delete their own reports"
    ON qiangua_report
    FOR DELETE
    USING (auth.uid() = "UserId");

-- qiangua_report_note_rel 表 RLS 策略
ALTER TABLE qiangua_report_note_rel ENABLE ROW LEVEL SECURITY;

-- 策略：用户只能操作自己报告中的笔记（仅操作有效报告）
DROP POLICY IF EXISTS "Users can view notes in their reports" ON qiangua_report_note_rel;
CREATE POLICY "Users can view notes in their reports"
    ON qiangua_report_note_rel
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM qiangua_report 
            WHERE qiangua_report."ReportId" = qiangua_report_note_rel."ReportId" 
            AND qiangua_report."UserId" = auth.uid()
            AND qiangua_report."Status" = 'active'
        )
    );

DROP POLICY IF EXISTS "Users can add notes to their reports" ON qiangua_report_note_rel;
CREATE POLICY "Users can add notes to their reports"
    ON qiangua_report_note_rel
    FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM qiangua_report 
            WHERE qiangua_report."ReportId" = qiangua_report_note_rel."ReportId" 
            AND qiangua_report."UserId" = auth.uid()
            AND qiangua_report."Status" = 'active'
        )
    );

DROP POLICY IF EXISTS "Users can update notes in their reports" ON qiangua_report_note_rel;
CREATE POLICY "Users can update notes in their reports"
    ON qiangua_report_note_rel
    FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM qiangua_report 
            WHERE qiangua_report."ReportId" = qiangua_report_note_rel."ReportId" 
            AND qiangua_report."UserId" = auth.uid()
            AND qiangua_report."Status" = 'active'
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM qiangua_report 
            WHERE qiangua_report."ReportId" = qiangua_report_note_rel."ReportId" 
            AND qiangua_report."UserId" = auth.uid()
            AND qiangua_report."Status" = 'active'
        )
    );

DROP POLICY IF EXISTS "Users can delete notes from their reports" ON qiangua_report_note_rel;
CREATE POLICY "Users can delete notes from their reports"
    ON qiangua_report_note_rel
    FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM qiangua_report 
            WHERE qiangua_report."ReportId" = qiangua_report_note_rel."ReportId" 
            AND qiangua_report."UserId" = auth.uid()
            AND qiangua_report."Status" = 'active'
        )
    );

-- ============================================
-- 4. 验证表创建
-- ============================================
-- 执行以下查询验证表是否创建成功：
-- SELECT table_name FROM information_schema.tables 
-- WHERE table_schema = 'public' 
-- AND table_name IN ('qiangua_report', 'qiangua_report_note_rel');

-- ============================================
-- 完成
-- ============================================

