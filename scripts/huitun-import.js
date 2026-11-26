#!/usr/bin/env node
/**
 * 灰豚数据阶段 B：从 staging JSON 批量入库（仅 insert，不 update）
 *
 * 用法：
 *   node scripts/huitun-import.js              # 默认 dry-run，只校验
 *   node scripts/huitun-import.js --execute      # 正式写入 Supabase
 *
 * 可选：
 *   --staging <path>   默认 灰豚数据入库/staging_灰豚汇总_待确认.json
 *   --limit N          仅处理前 N 条 insert 行（调试用）
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const DEFAULT_STAGING = path.join(ROOT, '灰豚数据入库', 'staging_灰豚汇总_待确认.json');
const LOG_PATH = path.join(ROOT, '灰豚数据入库', 'import_灰豚结果.json');

const BLOGGER_CHUNK = 10;
const NOTE_CHUNK = 20;
const RETRY = 2;

/**
 * 本批需要在 qiangua_brand 新建的品牌（阶段 B 第 1 步）
 * BrandId / BrandIdKey 在运行时自动生成（max existing + 1）
 */
const NEW_BRAND_DEFINITIONS = [
  { BrandName: 'ERDOS鄂尔多斯' },
  { BrandName: 'Songmont山下有松' },
];

function loadEnvLocal() {
  const envPath = path.join(ROOT, '.env.local');
  if (!fs.existsSync(envPath)) {
    throw new Error('缺少 .env.local，请配置 SUPABASE_SERVICE_ROLE_KEY');
  }
  for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let val = trimmed.slice(eq + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = val;
  }
}

function parseArgs(argv) {
  const args = { execute: false, staging: DEFAULT_STAGING, limit: 0 };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--execute') args.execute = true;
    else if (a === '--dry-run') args.execute = false;
    else if (a === '--staging' && argv[i + 1]) args.staging = path.resolve(argv[++i]);
    else if (a === '--limit' && argv[i + 1]) args.limit = parseInt(argv[++i], 10) || 0;
    else if (a === '--help' || a === '-h') {
      console.log(`用法: node scripts/huitun-import.js [--execute] [--staging path] [--limit N]`);
      process.exit(0);
    }
  }
  return args;
}

function parseCooperateBindList(raw) {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw;
  try {
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

function num(val, fallback = 0) {
  const n = parseInt(String(val ?? '').replace(/,/g, ''), 10);
  return Number.isFinite(n) ? n : fallback;
}

function str(val, fallback = '') {
  if (val === undefined || val === null) return fallback;
  return String(val);
}

/** 移除 PostgreSQL text 不支持的字符（NUL、孤立 surrogate） */
function sanitizeUnicode(s) {
  if (typeof s !== 'string' || !s) return s;
  return s
    .replace(/\u0000/g, '')
    .replace(/[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/g, '');
}

function sanitizeRecord(obj) {
  const out = {};
  for (const [k, v] of Object.entries(obj)) {
    if (typeof v === 'string') out[k] = sanitizeUnicode(v);
    else out[k] = v;
  }
  return out;
}

function bool(val, fallback = false) {
  if (typeof val === 'boolean') return val;
  if (val === undefined || val === null || val === '') return fallback;
  const s = String(val).trim().toLowerCase();
  if (['1', 'true', 'yes'].includes(s)) return true;
  if (['0', 'false', 'no'].includes(s)) return false;
  return fallback;
}

function idKey(hex) {
  if (!hex || hex.length < 6) return '';
  return hex.slice(0, 6);
}

function buildCooperateBindList(brand, displayBrandName) {
  if (!brand) return null;
  return [
    {
      BrandId: Number.isFinite(Number(brand.BrandId)) ? Number(brand.BrandId) : brand.BrandId,
      BrandIdKey: brand.BrandIdKey,
      BrandName: displayBrandName || brand.BrandName,
    },
  ];
}

function uniqueBloggerIdKey(xhsUserId, usedKeys) {
  const base = idKey(xhsUserId);
  if (!base) return '';
  if (!usedKeys.has(base)) {
    usedKeys.add(base);
    return base;
  }
  for (const len of [8, 10, 12, 24]) {
    const k = xhsUserId.slice(0, Math.min(len, xhsUserId.length));
    if (!usedKeys.has(k)) {
      usedKeys.add(k);
      return k;
    }
  }
  usedKeys.add(xhsUserId);
  return xhsUserId;
}

async function fetchWithRetry(url, options, retry = RETRY) {
  let lastErr;
  for (let attempt = 0; attempt <= retry; attempt++) {
    try {
      const res = await fetch(url, options);
      if (res.ok) return res;
      const body = await res.text();
      if (res.status >= 500 || res.status === 429) {
        lastErr = new Error(`HTTP ${res.status}: ${body.slice(0, 300)}`);
        await new Promise((r) => setTimeout(r, 500 * (attempt + 1)));
        continue;
      }
      const err = new Error(`HTTP ${res.status}: ${body.slice(0, 500)}`);
      err.status = res.status;
      err.body = body;
      throw err;
    } catch (e) {
      lastErr = e;
      if (attempt < retry) await new Promise((r) => setTimeout(r, 500 * (attempt + 1)));
    }
  }
  throw lastErr;
}

async function fetchAllRest(baseUrl, key, table, select, pageSize = 1000) {
  const rows = [];
  let start = 0;
  while (true) {
    const end = start + pageSize - 1;
    const url = `${baseUrl}/rest/v1/${table}?select=${encodeURIComponent(select)}`;
    const res = await fetchWithRetry(url, {
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
        Prefer: 'count=exact',
        Range: `${start}-${end}`,
      },
    });
    const chunk = await res.json();
    if (!Array.isArray(chunk) || chunk.length === 0) break;
    rows.push(...chunk);
    if (chunk.length < pageSize) break;
    start += pageSize;
  }
  return rows;
}

async function fetchDbContext() {
  const baseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!baseUrl || !key) {
    throw new Error('缺少 NEXT_PUBLIC_SUPABASE_URL 或 SUPABASE_SERVICE_ROLE_KEY');
  }

  const [notes, bloggers, bloggerKeys, brands] = await Promise.all([
    fetchAllRest(baseUrl, key, 'qiangua_note_info', 'NoteId,XhsNoteId'),
    fetchAllRest(baseUrl, key, 'qiangua_blogger', 'BloggerId,BloggerIdKey,XhsUserId'),
    fetchAllRest(baseUrl, key, 'qiangua_blogger', 'BloggerIdKey'),
    fetchAllRest(baseUrl, key, 'qiangua_brand', 'BrandId,BrandIdKey,BrandName'),
  ]);

  const existingXhsNoteIds = new Set();
  const existingNoteIds = new Set();
  for (const r of notes) {
    if (r.XhsNoteId) existingXhsNoteIds.add(String(r.XhsNoteId).toLowerCase());
    if (r.NoteId) existingNoteIds.add(String(r.NoteId).toLowerCase());
  }

  const bloggerByXhsUserId = new Map();
  const existingBloggerIds = new Set();
  const usedBloggerIdKeys = new Set();
  for (const r of bloggers) {
    if (r.BloggerId) existingBloggerIds.add(String(r.BloggerId));
    if (r.XhsUserId) {
      bloggerByXhsUserId.set(String(r.XhsUserId).toLowerCase(), String(r.BloggerId));
    }
  }
  for (const r of bloggerKeys) {
    if (r.BloggerIdKey) usedBloggerIdKeys.add(String(r.BloggerIdKey));
  }

  // 品牌：name → record；同时记录最大 BrandId 用于新建时分配
  const brandByName = new Map();
  let maxBrandId = 0;
  for (const b of brands) {
    brandByName.set(b.BrandName, b);
    const n = parseInt(String(b.BrandId), 10);
    if (Number.isFinite(n) && n > maxBrandId) maxBrandId = n;
  }

  return {
    baseUrl,
    key,
    existingXhsNoteIds,
    existingNoteIds,
    bloggerByXhsUserId,
    existingBloggerIds,
    usedBloggerIdKeys,
    brandByName,
    maxBrandId,
  };
}

function buildBloggerRecord(row, bloggerIdKey) {
  const nick = str(row.BloggerNickName, '未知博主');
  return sanitizeRecord({
    BloggerId: str(row.BloggerId),
    BloggerIdKey: bloggerIdKey,
    BloggerNickName: nick,
    BloggerProp: str(row.BloggerProp) || null,
    Fans: num(row.Fans),
    SmallAvatar: str(row.SmallAvatar) || null,
    LinkInfo: str(row.LinkInfo) || null,
    RedId: str(row.RedId) || null,
    XhsUserId: str(row.XhsUserId),
    DataSource: '灰豚',
    Gender: 0,
    LevelNumber: 0,
    GoodsCount: 0,
    NoteActiveCount: 0,
    IsBrandPartner: false,
    OfficialVerified: false,
    AdPriceUpdateStatus: 0,
  });
}

function normalizePublishTime(raw) {
  const s = str(raw);
  if (!s) return '';
  if (/^\d{4}-\d{2}-\d{2}T/.test(s)) return s;
  const std = s.match(/^(\d{4}-\d{2}-\d{2})\s+(\d{2}:\d{2}:\d{2})/);
  if (std) return `${std[1]}T${std[2]}+08:00`;
  const us = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?)?/);
  if (us) {
    const pad = (n) => String(n).padStart(2, '0');
    return `${us[3]}-${pad(us[1])}-${pad(us[2])}T${pad(us[4] || '0')}:${pad(us[5] || '0')}:${pad(us[6] || '0')}+08:00`;
  }
  return s;
}

function buildNoteRecord(row, bloggerId) {
  const publishTime = normalizePublishTime(row.PublishTime);
  const pubDate =
    str(row.PubDate) ||
    (publishTime.match(/^(\d{4}-\d{2}-\d{2})/) || [])[1] ||
    '';
  const dateCode = str(row.DateCode) || pubDate.replace(/-/g, '');
  const liked = num(row.LikedCount);
  const collected = num(row.CollectedCount);
  const binds = parseCooperateBindList(row.CooperateBindList);

  return sanitizeRecord({
    NoteId: str(row.NoteId),
    NoteIdKey: str(row.NoteIdKey) || idKey(row.NoteId),
    DateCode: dateCode,
    Title: str(row.Title) || null,
    XhsTitle: str(row.XhsTitle) || str(row.Title) || null,
    Content: null,
    XhsContent: str(row.XhsContent) || null,
    CoverImage: str(row.CoverImage) || null,
    XhsImages: str(row.XhsImages) || null,
    XhsVideo: str(row.XhsVideo) || null,
    XhsNoteLink: str(row.XhsNoteLink) || null,
    XhsNoteId: str(row.XhsNoteId),
    XhsUserId: str(row.XhsUserId),
    NoteType: str(row.NoteType) || 'normal',
    IsBusiness: bool(row.IsBusiness),
    IsAdNote: bool(row.IsAdNote),
    PublishTime: publishTime,
    PubDate: pubDate,
    UpdateTime: publishTime,
    LikedCount: liked,
    CollectedCount: collected,
    CommentsCount: num(row.CommentsCount),
    ViewCount: num(row.ViewCount),
    ShareCount: num(row.ShareCount),
    LikeCollect: liked + collected,
    Props: 0,
    BloggerId: bloggerId,
    BloggerNickName: str(row.BloggerNickName) || null,
    BloggerProp: str(row.BloggerProp) || null,
    Fans: num(row.Fans),
    SmallAvatar: str(row.SmallAvatar) || null,
    RedId: str(row.RedId) || null,
    LinkInfo: str(row.LinkInfo) || null,
    AdPrice: row.AdPrice === '' || row.AdPrice == null ? null : num(row.AdPrice),
    CooperateBindsName: str(row.CooperateBindsName) || null,
    CooperateBindList: binds.length ? binds : null,
    BrandId: str(row.BrandId),
    BrandIdKey: str(row.BrandIdKey) || null,
    BrandName: str(row.BrandName) || null,
    AiStatus: '待分析',
    XhsNoteInvalid: false,
    DataSource: '灰豚',
    Gender: 0,
    LevelNumber: 0,
    GoodsCount: 0,
    NoteActiveCount: 0,
    IsBrandPartner: false,
    OfficialVerified: false,
    AdPriceUpdateStatus: 0,
    CurrentUserIsFavorite: false,
  });
}

async function restInsert(baseUrl, key, table, rows, { onConflict } = {}) {
  if (!rows.length) return { inserted: 0, errors: [] };
  const qs = onConflict ? `?on_conflict=${encodeURIComponent(onConflict)}` : '';
  const prefer = onConflict
    ? 'return=minimal,resolution=ignore-duplicates'
    : 'return=minimal';
  const url = `${baseUrl}/rest/v1/${table}${qs}`;
  const res = await fetchWithRetry(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      apikey: key,
      Authorization: `Bearer ${key}`,
      Prefer: prefer,
    },
    body: JSON.stringify(rows),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`${table} insert 失败 ${res.status}: ${body.slice(0, 500)}`);
  }
  return { inserted: rows.length, errors: [] };
}

async function restInsertOneByOne(baseUrl, key, table, rows, label) {
  let inserted = 0;
  const errors = [];
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    try {
      await restInsert(baseUrl, key, table, [row]);
      inserted++;
      if ((i + 1) % 20 === 0 || i === rows.length - 1) {
        process.stdout.write(`\r  ${label}: ${i + 1}/${rows.length}`);
      }
    } catch (e) {
      const id = row.NoteId || row.BloggerId || `#${i}`;
      errors.push({ id, message: e.message });
      console.error(`\n  [失败] ${label} ${id}: ${e.message}`);
    }
  }
  if (rows.length) process.stdout.write('\n');
  return { inserted, errors };
}

async function restInsertChunks(baseUrl, key, table, rows, chunkSize, label) {
  let inserted = 0;
  const errors = [];
  for (let start = 0; start < rows.length; start += chunkSize) {
    const chunk = rows.slice(start, start + chunkSize);
    try {
      const r = await restInsert(baseUrl, key, table, chunk);
      inserted += r.inserted;
      process.stdout.write(`\r  ${label}: ${Math.min(start + chunk.length, rows.length)}/${rows.length}`);
    } catch (e) {
      const fallback = await restInsertOneByOne(baseUrl, key, table, chunk, `${label}(逐条)`);
      inserted += fallback.inserted;
      errors.push(...fallback.errors);
    }
  }
  if (rows.length) process.stdout.write('\n');
  return { inserted, errors };
}

function resolveBloggerId(row, db) {
  const xhsUserId = str(row.XhsUserId).toLowerCase();
  if (db.bloggerByXhsUserId.has(xhsUserId)) {
    return db.bloggerByXhsUserId.get(xhsUserId);
  }
  if (row.match_blogger === 'new') {
    return str(row.BloggerId) || str(row.XhsUserId);
  }
  return str(row.BloggerId);
}

/**
 * 第 1 步：在 qiangua_brand 中创建本批新品牌
 * - 仅创建 DB 中尚不存在的品牌
 * - BrandId = max(现有 BrandId) + 1, +2, …
 * - BrandIdKey = BrandId 十六进制表示（6 位，前补 0）
 * - 创建后更新 db.brandByName，供后续行使用
 */
async function createNewBrandsStep(db, execute) {
  const toCreate = NEW_BRAND_DEFINITIONS.filter((def) => !db.brandByName.has(def.BrandName));

  if (!toCreate.length) {
    console.log('  所有新品牌已存在于 DB，跳过创建步骤');
    return;
  }

  let nextId = db.maxBrandId + 1;
  const created = [];

  for (const def of toCreate) {
    const brandId = nextId++;
    const brandIdKey = brandId.toString(16).padStart(6, '0').slice(0, 6);
    const record = { BrandId: brandId, BrandIdKey: brandIdKey, BrandName: def.BrandName };
    console.log(
      `  ${execute ? '创建' : '[dry-run] 将创建'} 品牌: BrandId=${brandId}  BrandIdKey=${brandIdKey}  BrandName=${def.BrandName}`
    );
    if (execute) {
      await restInsert(db.baseUrl, db.key, 'qiangua_brand', [record]);
    }
    // 写入内存 map，供后续笔记行使用（dry-run 也写，以便校验数量正确）
    db.brandByName.set(def.BrandName, record);
    created.push(record);
  }

  console.log(`  品牌步骤完成（${execute ? '已写入' : 'dry-run'}）: ${created.length} 条`);
  return created;
}

async function main() {
  loadEnvLocal();
  const args = parseArgs(process.argv);

  if (!fs.existsSync(args.staging)) {
    throw new Error(`staging 文件不存在: ${args.staging}`);
  }

  const stagingDoc = JSON.parse(fs.readFileSync(args.staging, 'utf8'));
  let insertRows = (stagingDoc.staging || []).filter((r) => r.import_action === 'insert');
  if (args.limit > 0) insertRows = insertRows.slice(0, args.limit);

  console.log(`模式: ${args.execute ? '正式入库 (--execute)' : 'dry-run（加 --execute 才写入）'}`);
  console.log(`staging: ${args.staging}`);
  console.log(`待处理 insert 行: ${insertRows.length}`);

  console.log('\n拉取 DB 对照…');
  const db = await fetchDbContext();

  // --- 第 1 步：新建品牌 ---
  console.log('\n--- 第1步：新建品牌 ---');
  await createNewBrandsStep(db, args.execute);

  // --- 第 2 步：收集博主 / 笔记 ---
  const usedKeys = new Set(db.usedBloggerIdKeys);
  const bloggersToInsert = new Map();
  const notesToInsert = [];
  const skipped = [];

  for (const row of insertRows) {
    const xhsNoteId = str(row.XhsNoteId).toLowerCase();
    const noteId = str(row.NoteId).toLowerCase();

    if (xhsNoteId && db.existingXhsNoteIds.has(xhsNoteId)) {
      skipped.push({ XhsNoteId: row.XhsNoteId, reason: 'XhsNoteId 已存在于库' });
      continue;
    }
    if (noteId && db.existingNoteIds.has(noteId)) {
      skipped.push({ XhsNoteId: row.XhsNoteId, reason: 'NoteId 已存在于库' });
      continue;
    }
    if (!row.XhsNoteId || !row.XhsUserId) {
      skipped.push({ XhsNoteId: row.XhsNoteId, reason: '缺少 XhsNoteId / XhsUserId' });
      continue;
    }

    // 解析品牌：用 huitun_brand_mapped（alias 后的 DB 名）查 BrandId；笔记 BrandName 保留灰豚原名
    const brandLookupName = str(row.huitun_brand_mapped) || str(row.BrandName);
    const displayBrandName = str(row.huitun_brand_name) || str(row.BrandName);
    const resolvedBrand = db.brandByName.get(brandLookupName) || null;
    const resolvedBrandId = resolvedBrand ? str(resolvedBrand.BrandId) : str(row.BrandId);

    if (!resolvedBrandId || resolvedBrandId === '(待创建)') {
      skipped.push({ XhsNoteId: row.XhsNoteId, reason: `品牌未能解析: ${brandLookupName}` });
      continue;
    }

    const xhsUserId = str(row.XhsUserId).toLowerCase();
    let bloggerId = resolveBloggerId(row, db);

    if (row.match_blogger === 'new' && !db.bloggerByXhsUserId.has(xhsUserId)) {
      if (!bloggersToInsert.has(xhsUserId)) {
        const bloggerIdKey = uniqueBloggerIdKey(xhsUserId, usedKeys);
        bloggersToInsert.set(
          xhsUserId,
          buildBloggerRecord({ ...row, BloggerId: bloggerId, BloggerIdKey: bloggerIdKey }, bloggerIdKey)
        );
      }
      bloggerId = bloggersToInsert.get(xhsUserId).BloggerId;
    }

    // BrandId/Key 来自 DB；BrandName 保留灰豚原始名
    const resolvedRow = resolvedBrand
      ? {
          ...row,
          BrandId: str(resolvedBrand.BrandId),
          BrandIdKey: str(resolvedBrand.BrandIdKey),
          BrandName: displayBrandName,
          CooperateBindList: JSON.stringify(buildCooperateBindList(resolvedBrand, displayBrandName)),
          CooperateBindsName: displayBrandName,
        }
      : row;

    notesToInsert.push({ row: resolvedRow, bloggerId });
  }

  const bloggerList = [...bloggersToInsert.values()];

  console.log('\n=== 校验结果 ===');
  console.log(`  待插入博主: ${bloggerList.length}`);
  console.log(`  待插入笔记: ${notesToInsert.length}`);
  console.log(`  运行时跳过: ${skipped.length}`);

  if (bloggerList.length) {
    console.log('\n新博主样例（前 3）:');
    bloggerList.slice(0, 3).forEach((b) => {
      console.log(`  ${b.BloggerId} | ${b.BloggerNickName} | XhsUserId=${b.XhsUserId}`);
    });
  }
  if (notesToInsert.length) {
    console.log('\n笔记样例（前 3）:');
    notesToInsert.slice(0, 3).forEach(({ row, bloggerId }) => {
      console.log(`  ${row.XhsNoteId} | ${row.BrandName} | BloggerId=${bloggerId}`);
    });
  }

  const result = {
    mode: args.execute ? 'execute' : 'dry-run',
    staging: args.staging,
    at: new Date().toISOString(),
    planned: {
      brands: NEW_BRAND_DEFINITIONS.filter((d) => !db.brandByName.has(d.BrandName)).length,
      bloggers: bloggerList.length,
      notes: notesToInsert.length,
      skipped: skipped.length,
    },
    skipped,
    brands: { inserted: 0, errors: [] },
    bloggers: { inserted: 0, errors: [] },
    notes: { inserted: 0, errors: [] },
  };

  if (!args.execute) {
    console.log('\n[dry-run] 未写入数据库。确认无误后执行:');
    console.log('  node scripts/huitun-import.js --execute');
    fs.writeFileSync(LOG_PATH, JSON.stringify(result, null, 2), 'utf8');
    console.log(`\n预览结果: ${LOG_PATH}`);
    return;
  }

  console.log('\n开始写入…');

  // --- 第 2 步：插入博主 ---
  if (bloggerList.length) {
    console.log('\n--- 第2步：插入 qiangua_blogger ---');
    const br = await restInsertChunks(
      db.baseUrl, db.key, 'qiangua_blogger', bloggerList, BLOGGER_CHUNK, '博主'
    );
    result.bloggers = br;
    for (const b of bloggerList) {
      db.bloggerByXhsUserId.set(String(b.XhsUserId).toLowerCase(), String(b.BloggerId));
      db.existingBloggerIds.add(String(b.BloggerId));
    }
  }

  // --- 第 3 步：插入笔记 ---
  const noteRecords = notesToInsert.map(({ row, bloggerId }) => buildNoteRecord(row, bloggerId));

  console.log('\n--- 第3步：插入 qiangua_note_info ---');
  const nr = await restInsertChunks(
    db.baseUrl, db.key, 'qiangua_note_info', noteRecords, NOTE_CHUNK, '笔记'
  );
  result.notes = nr;

  console.log('\n=== 入库完成 ===');
  console.log(`  博主: ${result.bloggers.inserted}/${bloggerList.length}（失败 ${result.bloggers.errors.length}）`);
  console.log(`  笔记: ${result.notes.inserted}/${noteRecords.length}（失败 ${result.notes.errors.length}）`);

  fs.writeFileSync(LOG_PATH, JSON.stringify(result, null, 2), 'utf8');
  console.log(`\n结果日志: ${LOG_PATH}`);

  if (result.bloggers.errors.length || result.notes.errors.length) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
