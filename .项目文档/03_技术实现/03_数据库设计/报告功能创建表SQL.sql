-- ============================================
-- 小红书竞品笔记监控系统 - 报告功能表创建SQL
-- ============================================
-- 说明：本脚本用于创建报告功能相关的2张表
-- 执行顺序：先创建 reports 表，再创建 report_notes 表（因为外键依赖）
-- ============================================

-- ============================================
-- 1. 创建 reports 表（报告表）
-- ============================================
CREATE TABLE IF NOT EXISTS reports (
    "ReportId" UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    "UserId" UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    "ReportName" VARCHAR(200) NOT NULL,
    "CreatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "UpdatedAt" TIMESTAMPTZ DEFAULT NOW()
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_reports_user_id ON reports("UserId");
CREATE INDEX IF NOT EXISTS idx_reports_report_name ON reports("ReportName");
CREATE INDEX IF NOT EXISTS idx_reports_created_at ON reports("CreatedAt");

-- 创建更新时间触发器函数（如果不存在）
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW."UpdatedAt" = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- 创建更新时间触发器
DROP TRIGGER IF EXISTS update_reports_updated_at ON reports;
CREATE TRIGGER update_reports_updated_at 
    BEFORE UPDATE ON reports
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- 添加表注释
COMMENT ON TABLE reports IS '报告表 - 存储用户创建的报告基本信息';
COMMENT ON COLUMN reports."ReportId" IS '报告ID（主键，UUID）';
COMMENT ON COLUMN reports."UserId" IS '用户ID（外键，关联 auth.users）';
COMMENT ON COLUMN reports."ReportName" IS '报告名称（8-20个字符）';
COMMENT ON COLUMN reports."CreatedAt" IS '创建时间（带时区）';
COMMENT ON COLUMN reports."UpdatedAt" IS '更新时间（自动更新，带时区）';

-- ============================================
-- 2. 创建 report_notes 表（报告笔记关联表）
-- ============================================
CREATE TABLE IF NOT EXISTS report_notes (
    "ReportNoteId" UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    "ReportId" UUID NOT NULL REFERENCES reports("ReportId") ON DELETE CASCADE,
    "NoteId" VARCHAR(64) NOT NULL REFERENCES qiangua_note_info("NoteId") ON DELETE CASCADE,
    "Status" VARCHAR(20) NOT NULL DEFAULT 'active',
    "CreatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "UpdatedAt" TIMESTAMPTZ DEFAULT NOW(),
    -- 唯一约束：同一笔记不能重复添加到同一报告中
    CONSTRAINT "uk_report_notes_report_note" UNIQUE("ReportId", "NoteId")
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_report_notes_report_id ON report_notes("ReportId");
CREATE INDEX IF NOT EXISTS idx_report_notes_note_id ON report_notes("NoteId");
CREATE INDEX IF NOT EXISTS idx_report_notes_status ON report_notes("Status");
CREATE INDEX IF NOT EXISTS idx_report_notes_created_at ON report_notes("CreatedAt");

-- 复合索引
CREATE INDEX IF NOT EXISTS idx_report_notes_report_status ON report_notes("ReportId", "Status");
CREATE INDEX IF NOT EXISTS idx_report_notes_report_created_at ON report_notes("ReportId", "CreatedAt");

-- 创建更新时间触发器
DROP TRIGGER IF EXISTS update_report_notes_updated_at ON report_notes;
CREATE TRIGGER update_report_notes_updated_at 
    BEFORE UPDATE ON report_notes
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- 添加表注释
COMMENT ON TABLE report_notes IS '报告笔记关联表 - 存储报告与笔记的关联关系（多对多），包含笔记状态';
COMMENT ON COLUMN report_notes."ReportNoteId" IS '关联ID（主键，UUID）';
COMMENT ON COLUMN report_notes."ReportId" IS '报告ID（外键，关联 reports 表）';
COMMENT ON COLUMN report_notes."NoteId" IS '笔记ID（外键，关联 qiangua_note_info 表）';
COMMENT ON COLUMN report_notes."Status" IS '笔记状态：active（有效）、ignored（已忽略）';
COMMENT ON COLUMN report_notes."CreatedAt" IS '创建时间（带时区）';
COMMENT ON COLUMN report_notes."UpdatedAt" IS '更新时间（自动更新，带时区）';

-- ============================================
-- 3. 启用 RLS（行级安全）策略
-- ============================================

-- reports 表 RLS 策略
ALTER TABLE reports ENABLE ROW LEVEL SECURITY;

-- 策略：用户只能查看、创建、更新、删除自己的报告
DROP POLICY IF EXISTS "Users can view their own reports" ON reports;
CREATE POLICY "Users can view their own reports"
    ON reports
    FOR SELECT
    USING (auth.uid() = "UserId");

DROP POLICY IF EXISTS "Users can create their own reports" ON reports;
CREATE POLICY "Users can create their own reports"
    ON reports
    FOR INSERT
    WITH CHECK (auth.uid() = "UserId");

DROP POLICY IF EXISTS "Users can update their own reports" ON reports;
CREATE POLICY "Users can update their own reports"
    ON reports
    FOR UPDATE
    USING (auth.uid() = "UserId")
    WITH CHECK (auth.uid() = "UserId");

DROP POLICY IF EXISTS "Users can delete their own reports" ON reports;
CREATE POLICY "Users can delete their own reports"
    ON reports
    FOR DELETE
    USING (auth.uid() = "UserId");

-- report_notes 表 RLS 策略
ALTER TABLE report_notes ENABLE ROW LEVEL SECURITY;

-- 策略：用户只能操作自己报告中的笔记
DROP POLICY IF EXISTS "Users can view notes in their reports" ON report_notes;
CREATE POLICY "Users can view notes in their reports"
    ON report_notes
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM reports 
            WHERE reports."ReportId" = report_notes."ReportId" 
            AND reports."UserId" = auth.uid()
        )
    );

DROP POLICY IF EXISTS "Users can add notes to their reports" ON report_notes;
CREATE POLICY "Users can add notes to their reports"
    ON report_notes
    FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM reports 
            WHERE reports."ReportId" = report_notes."ReportId" 
            AND reports."UserId" = auth.uid()
        )
    );

DROP POLICY IF EXISTS "Users can update notes in their reports" ON report_notes;
CREATE POLICY "Users can update notes in their reports"
    ON report_notes
    FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM reports 
            WHERE reports."ReportId" = report_notes."ReportId" 
            AND reports."UserId" = auth.uid()
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM reports 
            WHERE reports."ReportId" = report_notes."ReportId" 
            AND reports."UserId" = auth.uid()
        )
    );

DROP POLICY IF EXISTS "Users can delete notes from their reports" ON report_notes;
CREATE POLICY "Users can delete notes from their reports"
    ON report_notes
    FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM reports 
            WHERE reports."ReportId" = report_notes."ReportId" 
            AND reports."UserId" = auth.uid()
        )
    );

-- ============================================
-- 4. 验证表创建
-- ============================================
-- 执行以下查询验证表是否创建成功：
-- SELECT table_name FROM information_schema.tables 
-- WHERE table_schema = 'public' 
-- AND table_name IN ('reports', 'report_notes');

-- ============================================
-- 完成
-- ============================================

