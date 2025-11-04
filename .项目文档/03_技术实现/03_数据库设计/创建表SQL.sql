-- ============================================
-- 小红书竞品笔记监控系统 - 数据库表创建SQL
-- ============================================
-- 说明：本脚本用于创建3张核心数据表
-- 执行顺序：先创建 qiangua_blogger 和 qiangua_brand，再创建 qiangua_note_info（因为外键依赖）
-- ============================================

-- ============================================
-- 1. 创建 qiangua_blogger 表（千瓜博主表）
-- ============================================
CREATE TABLE IF NOT EXISTS qiangua_blogger (
    "BloggerId" VARCHAR(64) NOT NULL,
    "BloggerIdKey" VARCHAR(50) NOT NULL,
    "BloggerNickName" VARCHAR(200) NOT NULL,
    "BloggerProp" VARCHAR(100),
    "BloggerTags" TEXT,
    "BloggerTagName" VARCHAR(200),
    "Fans" INTEGER DEFAULT 0,
    "LevelNumber" INTEGER DEFAULT 0,
    "LevelName" VARCHAR(100),
    "Gender" INTEGER DEFAULT 0,
    "Location" VARCHAR(200),
    "BigAvatar" TEXT,
    "SmallAvatar" TEXT,
    "McnName" TEXT,
    "McnInfoId" VARCHAR(64),
    "IsBrandPartner" BOOLEAN DEFAULT false,
    "OfficialVerified" BOOLEAN DEFAULT false,
    "GoodsCount" INTEGER DEFAULT 0,
    "NoteActiveCount" INTEGER DEFAULT 0,
    "AdPrice" INTEGER,
    "AdPriceUpdateStatus" INTEGER DEFAULT 0,
    "PriceType" VARCHAR(50),
    "LinkInfo" TEXT,
    "CreatedAt" TIMESTAMPTZ DEFAULT NOW(),
    "UpdatedAt" TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT "pk_qiangua_blogger" PRIMARY KEY ("BloggerId"),
    CONSTRAINT "uk_qiangua_blogger_bloggeridkey" UNIQUE ("BloggerIdKey")
);

-- 创建索引
CREATE INDEX IF NOT EXISTS "idx_qiangua_blogger_bloggernickname" ON qiangua_blogger ("BloggerNickName");
CREATE INDEX IF NOT EXISTS "idx_qiangua_blogger_fans" ON qiangua_blogger ("Fans");

-- 添加表注释
COMMENT ON TABLE qiangua_blogger IS '千瓜博主表 - 存储博主相关信息';
COMMENT ON COLUMN qiangua_blogger."BloggerId" IS '博主ID（主键）';
COMMENT ON COLUMN qiangua_blogger."BloggerIdKey" IS '博主ID密钥（唯一键）';
COMMENT ON COLUMN qiangua_blogger."BloggerNickName" IS '博主昵称';
COMMENT ON COLUMN qiangua_blogger."Gender" IS '性别（0-未知，1-男，2-女）';
COMMENT ON COLUMN qiangua_blogger."AdPrice" IS '广告报价（单位：分）';

-- ============================================
-- 2. 创建 qiangua_brand 表（千瓜品牌表）
-- ============================================
CREATE TABLE IF NOT EXISTS qiangua_brand (
    "BrandId" VARCHAR(64) NOT NULL,
    "BrandIdKey" VARCHAR(50) NOT NULL,
    "BrandName" VARCHAR(200) NOT NULL,
    "BrandDescription" TEXT,
    "BrandLogo" TEXT,
    "CreatedAt" TIMESTAMPTZ DEFAULT NOW(),
    "UpdatedAt" TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT "pk_qiangua_brand" PRIMARY KEY ("BrandId"),
    CONSTRAINT "uk_qiangua_brand_brandidkey" UNIQUE ("BrandIdKey")
);

-- 创建索引
CREATE INDEX IF NOT EXISTS "idx_qiangua_brand_brandname" ON qiangua_brand ("BrandName");

-- 添加表注释
COMMENT ON TABLE qiangua_brand IS '千瓜品牌表 - 存储品牌相关信息';
COMMENT ON COLUMN qiangua_brand."BrandId" IS '品牌ID（主键）';
COMMENT ON COLUMN qiangua_brand."BrandIdKey" IS '品牌ID密钥（唯一键）';
COMMENT ON COLUMN qiangua_brand."BrandName" IS '品牌名称';

-- ============================================
-- 3. 创建 qiangua_note_info 表（千瓜笔记信息表）
-- ============================================
CREATE TABLE IF NOT EXISTS qiangua_note_info (
    "NoteId" VARCHAR(64) NOT NULL,
    "DateCode" VARCHAR(64) NOT NULL,
    "NoteIdKey" VARCHAR(50),
    "Title" TEXT,
    "Content" TEXT,
    "CoverImage" TEXT,
    "XhsNoteUrl" TEXT,
    "NoteType" VARCHAR(50),
    "IsBusiness" BOOLEAN DEFAULT false,
    "IsAdNote" BOOLEAN DEFAULT false,
    "PublishTime" TIMESTAMPTZ NOT NULL,
    "PubDate" DATE,
    "LikedCount" INTEGER DEFAULT 0,
    "CollectedCount" INTEGER DEFAULT 0,
    "CommentsCount" INTEGER DEFAULT 0,
    "ViewCount" INTEGER DEFAULT 0,
    "ShareCount" INTEGER DEFAULT 0,
    "LikeCollect" INTEGER DEFAULT 0,
    "SpreadScore" DECIMAL(10,2),
    "Index" DECIMAL(10,2),
    "Lcc" INTEGER,
    "VideoDuration" VARCHAR(20),
    "Props" INTEGER DEFAULT 0,
    "BloggerId" VARCHAR(64) NOT NULL,
    "BloggerNickName" VARCHAR(200),
    "BloggerProp" VARCHAR(100),
    "BloggerTags" TEXT,
    "BloggerTagName" VARCHAR(200),
    "Fans" INTEGER DEFAULT 0,
    "LevelNumber" INTEGER DEFAULT 0,
    "LevelName" VARCHAR(100),
    "Gender" INTEGER DEFAULT 0,
    "Location" VARCHAR(200),
    "BigAvatar" TEXT,
    "SmallAvatar" TEXT,
    "McnName" TEXT,
    "McnInfoId" VARCHAR(64),
    "IsBrandPartner" BOOLEAN DEFAULT false,
    "OfficialVerified" BOOLEAN DEFAULT false,
    "GoodsCount" INTEGER DEFAULT 0,
    "NoteActiveCount" INTEGER DEFAULT 0,
    "AdPrice" INTEGER,
    "AdPriceUpdateStatus" INTEGER DEFAULT 0,
    "PriceType" VARCHAR(50),
    "LinkInfo" TEXT,
    "CooperateBindsName" TEXT,
    "CooperateBindList" JSONB,
    "BrandId" VARCHAR(64),
    "BrandIdKey" VARCHAR(50),
    "BrandName" VARCHAR(200),
    "CurrentUserIsFavorite" BOOLEAN DEFAULT false,
    "UpdateTime" TIMESTAMPTZ,
    "CreatedAt" TIMESTAMPTZ DEFAULT NOW(),
    "UpdatedAt" TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT "pk_qiangua_note_info" PRIMARY KEY ("NoteId"),
    CONSTRAINT "fk_qiangua_note_info_blogger" FOREIGN KEY ("BloggerId") 
        REFERENCES qiangua_blogger("BloggerId") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "fk_qiangua_note_info_brand" FOREIGN KEY ("BrandId") 
        REFERENCES qiangua_brand("BrandId") ON DELETE SET NULL ON UPDATE CASCADE
);

-- 创建单列索引
CREATE INDEX IF NOT EXISTS "idx_qiangua_note_info_datecode" ON qiangua_note_info ("DateCode");
CREATE INDEX IF NOT EXISTS "idx_qiangua_note_info_publishtime" ON qiangua_note_info ("PublishTime");
CREATE INDEX IF NOT EXISTS "idx_qiangua_note_info_pubdate" ON qiangua_note_info ("PubDate");
CREATE INDEX IF NOT EXISTS "idx_qiangua_note_info_bloggerid" ON qiangua_note_info ("BloggerId");
CREATE INDEX IF NOT EXISTS "idx_qiangua_note_info_brandid" ON qiangua_note_info ("BrandId");
CREATE INDEX IF NOT EXISTS "idx_qiangua_note_info_updatetime" ON qiangua_note_info ("UpdateTime");

-- 创建复合索引
CREATE INDEX IF NOT EXISTS "idx_qiangua_note_info_datecode_publishtime" ON qiangua_note_info ("DateCode", "PublishTime");
CREATE INDEX IF NOT EXISTS "idx_qiangua_note_info_isbusiness_publishtime" ON qiangua_note_info ("IsBusiness", "PublishTime");
CREATE INDEX IF NOT EXISTS "idx_qiangua_note_info_bloggerid_publishtime" ON qiangua_note_info ("BloggerId", "PublishTime");
CREATE INDEX IF NOT EXISTS "idx_qiangua_note_info_brandid_publishtime" ON qiangua_note_info ("BrandId", "PublishTime");

-- 创建JSONB字段的GIN索引（用于优化CooperateBindList的查询）
CREATE INDEX IF NOT EXISTS "idx_qiangua_note_info_cooperatebindlist" ON qiangua_note_info USING GIN ("CooperateBindList");

-- 添加表注释
COMMENT ON TABLE qiangua_note_info IS '千瓜笔记信息表 - 存储从千瓜平台获取的笔记详细信息';
COMMENT ON COLUMN qiangua_note_info."NoteId" IS '笔记ID（主键）';
COMMENT ON COLUMN qiangua_note_info."DateCode" IS '日期代码（格式：YYYYMMDD）';
COMMENT ON COLUMN qiangua_note_info."BloggerId" IS '博主ID（外键，关联qiangua_blogger表）';
COMMENT ON COLUMN qiangua_note_info."BrandId" IS '品牌ID（外键，关联qiangua_brand表，从CooperateBindList第一个元素提取）';
COMMENT ON COLUMN qiangua_note_info."AdPrice" IS '博主广告报价（冗余字段，保留笔记发布时的快照，单位：分）';
COMMENT ON COLUMN qiangua_note_info."CooperateBindList" IS '合作品牌列表（JSON数组，存储为JSONB格式）';

-- ============================================
-- 4. 创建自动更新 UpdatedAt 字段的触发器函数
-- ============================================
-- 创建通用触发器函数（适用于所有表）
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW."UpdatedAt" = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 为 qiangua_blogger 表创建触发器
DROP TRIGGER IF EXISTS "trg_qiangua_blogger_updated_at" ON qiangua_blogger;
CREATE TRIGGER "trg_qiangua_blogger_updated_at"
    BEFORE UPDATE ON qiangua_blogger
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- 为 qiangua_brand 表创建触发器
DROP TRIGGER IF EXISTS "trg_qiangua_brand_updated_at" ON qiangua_brand;
CREATE TRIGGER "trg_qiangua_brand_updated_at"
    BEFORE UPDATE ON qiangua_brand
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- 为 qiangua_note_info 表创建触发器
DROP TRIGGER IF EXISTS "trg_qiangua_note_info_updated_at" ON qiangua_note_info;
CREATE TRIGGER "trg_qiangua_note_info_updated_at"
    BEFORE UPDATE ON qiangua_note_info
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- 5. 启用 RLS（行级安全）策略
-- ============================================
-- 启用 RLS
ALTER TABLE qiangua_note_info ENABLE ROW LEVEL SECURITY;
ALTER TABLE qiangua_brand ENABLE ROW LEVEL SECURITY;
ALTER TABLE qiangua_blogger ENABLE ROW LEVEL SECURITY;

-- qiangua_note_info 表策略
DROP POLICY IF EXISTS "Users can read notes" ON qiangua_note_info;
CREATE POLICY "Users can read notes"
    ON qiangua_note_info
    FOR SELECT
    USING (true);  -- 允许所有人访问（包括未登录用户）

DROP POLICY IF EXISTS "Service role can write notes" ON qiangua_note_info;
CREATE POLICY "Service role can write notes"
    ON qiangua_note_info
    FOR INSERT
    WITH CHECK (auth.role() = 'service_role');

-- qiangua_brand 表策略
DROP POLICY IF EXISTS "Users can read brands" ON qiangua_brand;
CREATE POLICY "Users can read brands"
    ON qiangua_brand
    FOR SELECT
    USING (true);  -- 允许所有人访问（包括未登录用户）

DROP POLICY IF EXISTS "Service role can write brands" ON qiangua_brand;
CREATE POLICY "Service role can write brands"
    ON qiangua_brand
    FOR INSERT
    WITH CHECK (auth.role() = 'service_role');

-- qiangua_blogger 表策略
DROP POLICY IF EXISTS "Users can read bloggers" ON qiangua_blogger;
CREATE POLICY "Users can read bloggers"
    ON qiangua_blogger
    FOR SELECT
    USING (true);  -- 允许所有人访问（包括未登录用户）

DROP POLICY IF EXISTS "Service role can write bloggers" ON qiangua_blogger;
CREATE POLICY "Service role can write bloggers"
    ON qiangua_blogger
    FOR INSERT
    WITH CHECK (auth.role() = 'service_role');

-- ============================================
-- 完成
-- ============================================
-- 所有表、索引、约束、触发器和RLS策略已创建完成
-- 注意：
-- 1. PostgreSQL字段名大小写敏感，使用双引号包裹PascalCase字段名
-- 2. 插入数据时，需要先插入qiangua_blogger和qiangua_brand的数据，再插入qiangua_note_info（保证外键约束）
-- 3. 使用ON CONFLICT实现upsert操作，避免重复数据
-- ============================================

