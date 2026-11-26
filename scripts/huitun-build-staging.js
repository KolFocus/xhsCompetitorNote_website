#!/usr/bin/env node
/**
 * 灰豚数据阶段 A：拉取 DB 对照 + 合并 CSV/XLS → 输出 staging 汇总表
 *
 * 用法：node scripts/huitun-build-staging.js
 * 依赖：.env.local 中 SUPABASE_PG_* 配置
 */

const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');
const XLSX = require('xlsx');

const ROOT = path.join(__dirname, '..');
const DATA_DIR = path.join(ROOT, '灰豚数据入库');
const OUT_XLSX = path.join(DATA_DIR, 'staging_灰豚汇总_待确认.xlsx');
const OUT_JSON = path.join(DATA_DIR, 'staging_灰豚汇总_待确认.json');

function loadEnvLocal() {
  const envPath = path.join(ROOT, '.env.local');
  if (!fs.existsSync(envPath)) {
    throw new Error('缺少 .env.local，请配置 SUPABASE_PG_*');
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

function parseCsv(text) {
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);

  const rows = [];
  let i = 0;
  const len = text.length;

  function readField() {
    if (i >= len) return null;
    if (text[i] === '"') {
      i++;
      let field = '';
      while (i < len) {
        if (text[i] === '"') {
          if (text[i + 1] === '"') {
            field += '"';
            i += 2;
          } else {
            i++;
            break;
          }
        } else {
          field += text[i++];
        }
      }
      if (text[i] === ',') i++;
      return field;
    }
    let field = '';
    while (i < len && text[i] !== '\n' && text[i] !== '\r' && text[i] !== ',') {
      field += text[i++];
    }
    if (text[i] === ',') i++;
    return field;
  }

  const headers = [];
  while (i < len) {
    const f = readField();
    if (f === null) break;
    headers.push(f);
    if (text[i - 1] !== ',' && (text[i] === '\n' || text[i] === '\r')) break;
  }
  if (text[i] === '\r') i++;
  if (text[i] === '\n') i++;

  while (i < len) {
    while (i < len && (text[i] === '\n' || text[i] === '\r')) i++;
    if (i >= len) break;
    const row = {};
    let empty = true;
    for (let h = 0; h < headers.length; h++) {
      const f = readField();
      const v = f == null ? '' : f;
      if (v) empty = false;
      row[headers[h]] = v;
    }
    if (!empty) rows.push(row);
    while (i < len && text[i] !== '\n' && text[i] !== '\r') i++;
  }
  return rows;
}

function extractNoteIdFromUrl(url) {
  if (!url) return '';
  const m = url.match(/\/(?:item|explore)\/([a-f0-9]{24})/i);
  return m ? m[1].toLowerCase() : '';
}

function extractUserIdFromUrl(url) {
  if (!url) return '';
  const m = url.match(/\/user\/profile\/([a-f0-9]{24})/i);
  return m ? m[1].toLowerCase() : '';
}

function excelSerialToIso(serial) {
  const n = typeof serial === 'number' ? serial : parseFloat(String(serial).trim());
  if (!Number.isFinite(n) || n < 30000) return '';
  const utcMs = (n - 25569) * 86400000;
  const d = new Date(utcMs);
  const pad = (x) => String(x).padStart(2, '0');
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}T${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())}+08:00`;
}

function parsePublishTime(csvTime, xlsTime) {
  const raw = csvTime || xlsTime || '';
  if (!raw) return '';
  // 毫秒时间戳（灰豚「小红书博文」英文导出）
  const ms =
    typeof raw === 'number' && raw > 1e12
      ? raw
      : /^\d{13}$/.test(String(raw).trim())
        ? Number(String(raw).trim())
        : NaN;
  if (Number.isFinite(ms)) {
    const d = new Date(ms);
    if (!Number.isNaN(d.getTime())) {
      const pad = (n) => String(n).padStart(2, '0');
      // 按东八区展示
      const utc = d.getTime() + 8 * 3600 * 1000;
      const e = new Date(utc);
      return `${e.getUTCFullYear()}-${pad(e.getUTCMonth() + 1)}-${pad(e.getUTCDate())}T${pad(e.getUTCHours())}:${pad(e.getUTCMinutes())}:${pad(e.getUTCSeconds())}+08:00`;
    }
  }
  const serial =
    typeof raw === 'number'
      ? raw
      : /^\d{5}(\.\d+)?$/.test(String(raw).trim())
        ? parseFloat(String(raw).trim())
        : NaN;
  if (Number.isFinite(serial)) {
    const iso = excelSerialToIso(serial);
    if (iso) return iso;
  }
  const cn = String(raw).match(/(\d{4})年(\d{2})月(\d{2})日\s*(\d{2}):(\d{2}):(\d{2})/);
  if (cn) {
    return `${cn[1]}-${cn[2]}-${cn[3]}T${cn[4]}:${cn[5]}:${cn[6]}+08:00`;
  }
  const std = String(raw).match(/^(\d{4}-\d{2}-\d{2})\s+(\d{2}:\d{2}:\d{2})/);
  if (std) return `${std[1]}T${std[2]}+08:00`;
  // 美式日期：M/D/YYYY H:mm 或 M/D/YYYY H:mm:ss（Excel/CSV 常见）
  const us = String(raw).match(
    /^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?)?/,
  );
  if (us) {
    const pad = (n) => String(n).padStart(2, '0');
    const y = us[3];
    const mo = pad(us[1]);
    const d = pad(us[2]);
    const hh = pad(us[4] || '0');
    const mm = pad(us[5] || '0');
    const ss = pad(us[6] || '0');
    return `${y}-${mo}-${d}T${hh}:${mm}:${ss}+08:00`;
  }
  return String(raw);
}

function toDateCode(iso) {
  if (!iso) return '';
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${m[1]}${m[2]}${m[3]}` : '';
}

function toPubDate(iso) {
  if (!iso) return '';
  const m = iso.match(/^(\d{4}-\d{2}-\d{2})/);
  return m ? m[1] : '';
}

function yesNo(val) {
  return String(val || '').trim() === '是';
}

function pickAdPrice(row) {
  const candidates = [
    row['预估投放报价'],
    row['视频报价'],
    row['图文报价'],
  ];
  for (const c of candidates) {
    const n = parseInt(String(c || '').replace(/,/g, ''), 10);
    if (Number.isFinite(n) && n > 0) return n;
  }
  return null;
}

function noteTypeFromCsv(csvType, xlsType) {
  if (csvType === '视频笔记' || xlsType === 'video') return 'video';
  return 'normal';
}

function idKey(hex) {
  if (!hex || hex.length < 6) return '';
  return hex.slice(0, 6);
}

/**
 * 品牌名称 alias：灰豚 CSV 名 → DB BrandName（仅用于查 BrandId/Key）
 * 笔记入库时 BrandName / CooperateBindsName 仍用灰豚原始名 huitun_brand_name
 */
const BRAND_ALIAS = {
  'Jimmy Choo': 'JimmyChoo',
  '华伦天奴': 'VALENTINO华伦天奴',
  'Maison Margiela 梅森马吉拉': 'Maison Margiela 马吉拉',
  'McQueen': 'Alexander McQueen',
  'SAINTLAURENT圣罗兰': 'YSL圣罗兰美妆',
  '香奈儿CHANEL': '香奈儿美妆',
};

/**
 * 本批新建品牌（DB 中尚不存在，阶段 B 第 1 步创建）
 * 使用 alias 映射后的规范名称
 */
const NEW_BRAND_NAMES = new Set(['ERDOS鄂尔多斯', 'Songmont山下有松']);

/** 非品牌平台，直接剔除 */
const EXCLUDED_PLATFORMS = new Set(['珍品网']);

/**
 * 判断是否需要剔除（子线 / 非品牌平台）
 * 子线关键词：美妆、香氛、香水美妆、腕表、儿童服饰
 */
function isExcludedBrand(name) {
  const n = String(name || '').trim();
  if (!n) return false;
  if (EXCLUDED_PLATFORMS.has(n)) return true;
  return (
    n.includes('美妆') ||
    n.includes('香氛') ||
    n.includes('香水美妆') ||
    n.includes('腕表') ||
    n.includes('儿童服饰')
  );
}

/** 只读取本批已合并去重的单一 CSV */
function loadCsvRows() {
  const file = '灰豚汇总_去重后.csv';
  const text = fs.readFileSync(path.join(DATA_DIR, file), 'utf8');
  return parseCsv(text);
}

/**
 * 将「小红书博文」英文表头行规范为旧版「笔记」Sheet 中文列名，供下游统一读取。
 * 图片只取 raw_image_list → rawImageList，不用 image_list 回退。
 */
function normalizeBowenRow(row) {
  return {
    笔记ID: row.note_id || row['笔记ID'] || '',
    博主ID: row.user_id || row['博主ID'] || '',
    标题: row.title || row['标题'] || '',
    内容: row.content || row['内容'] || '',
    笔记链接: row.note_url || row['笔记链接'] || '',
    视频链接: row.video_url || row['视频链接'] || '',
    封面图: row.cover_image || row['封面图'] || '',
    rawImageList: row.raw_image_list || row.rawImageList || '',
    博主昵称: row.nickname || row['博主昵称'] || '',
    博主头像: row.avatar || row['博主头像'] || '',
    类型: row.type || row['类型'] || '',
    笔记发布: row.note_post_time || row['笔记发布'] || '',
  };
}

function isBowenSheet(sheetName, sampleRow) {
  if (sheetName === '小红书博文') return true;
  if (!sampleRow || typeof sampleRow !== 'object') return false;
  return (
    Object.prototype.hasOwnProperty.call(sampleRow, 'note_id') ||
    Object.prototype.hasOwnProperty.call(sampleRow, 'raw_image_list')
  );
}

/** 自动发现目录内笔记详情文件（按文件名排序，先出现的笔记/博主优先） */
function discoverDetailFiles() {
  return fs
    .readdirSync(DATA_DIR)
    .filter((name) => {
      if (name.startsWith('staging_') || name.startsWith('import_') || name.startsWith('backfill_')) {
        return false;
      }
      if (name.includes('商业合作笔记') || name.includes('商业笔记')) {
        // 列表导出，不是详情
        if (!name.startsWith('小红书笔记数据') && !name.startsWith('小红书博文') && name !== '小红书笔记详情.xls') {
          return false;
        }
      }
      const lower = name.toLowerCase();
      if (!lower.endsWith('.xls') && !lower.endsWith('.xlsx')) return false;
      return (
        name.startsWith('小红书笔记数据') ||
        name.startsWith('小红书博文') ||
        name === '小红书笔记详情.xls'
      );
    })
    .sort();
}

/**
 * 加载 XLS 详情（先后加载，笔记/博主均以第一次出现为准）
 * 兼容：
 *   1) 旧版 Sheet「笔记」+「博主」（中文列名）
 *   2) 新版 Sheet「小红书博文」（英文列名，无独立博主 Sheet）
 */
function loadXlsMaps() {
  const XLS_FILES = discoverDetailFiles();

  if (!XLS_FILES.length) {
    throw new Error(
      `未在 ${DATA_DIR} 找到可用的笔记详情（小红书笔记数据_*.xlsx / 小红书博文_*.xls）`
    );
  }

  const noteMap = new Map();
  const bloggerMap = new Map();
  let noteCount = 0;
  let bloggerCount = 0;

  for (const file of XLS_FILES) {
    const wb = XLSX.readFile(path.join(DATA_DIR, file));
    console.log(`  读取详情: ${file}（Sheets: ${wb.SheetNames.join(', ')}）`);

    if (wb.Sheets['笔记']) {
      const notes = XLSX.utils.sheet_to_json(wb.Sheets['笔记'], { defval: '' });
      for (const n of notes) {
        const id = String(n['笔记ID'] || '').toLowerCase();
        if (id && !noteMap.has(id)) {
          noteMap.set(id, n);
          noteCount++;
        }
      }
    }

    if (wb.Sheets['博主']) {
      const bloggers = XLSX.utils.sheet_to_json(wb.Sheets['博主'], { defval: '' });
      for (const b of bloggers) {
        const id = String(b['用户ID'] || '').toLowerCase();
        if (id && !bloggerMap.has(id)) {
          bloggerMap.set(id, b);
          bloggerCount++;
        }
      }
    }

    // 英文「小红书博文」或同结构 Sheet
    for (const sheetName of wb.SheetNames) {
      if (sheetName === '笔记' || sheetName === '博主') continue;
      const rawRows = XLSX.utils.sheet_to_json(wb.Sheets[sheetName], { defval: '' });
      if (!rawRows.length || !isBowenSheet(sheetName, rawRows[0])) continue;
      for (const raw of rawRows) {
        const n = normalizeBowenRow(raw);
        const id = String(n['笔记ID'] || '').toLowerCase();
        if (id && !noteMap.has(id)) {
          noteMap.set(id, n);
          noteCount++;
        }
      }
    }
  }

  return { noteMap, bloggerMap, noteCount, bloggerCount };
}

async function fetchAllRest(baseUrl, key, table, select, pageSize = 1000) {
  const rows = [];
  let start = 0;
  while (true) {
    const end = start + pageSize - 1;
    const url = `${baseUrl}/rest/v1/${table}?select=${encodeURIComponent(select)}`;
    const res = await fetch(url, {
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
        Prefer: 'count=exact',
        Range: `${start}-${end}`,
      },
    });
    if (!res.ok) {
      const body = await res.text();
      throw new Error(`REST ${table} 失败 ${res.status}: ${body.slice(0, 200)}`);
    }
    const chunk = await res.json();
    if (!Array.isArray(chunk) || chunk.length === 0) break;
    rows.push(...chunk);
    if (chunk.length < pageSize) break;
    start += pageSize;
  }
  return rows;
}

async function fetchDbContextRest() {
  const baseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!baseUrl || !key) {
    throw new Error('缺少 NEXT_PUBLIC_SUPABASE_URL 或 SUPABASE_SERVICE_ROLE_KEY');
  }

  console.log('  使用 Supabase REST 拉取对照数据…');
  const brands = await fetchAllRest(baseUrl, key, 'qiangua_brand', 'BrandId,BrandIdKey,BrandName');
  const notes = await fetchAllRest(baseUrl, key, 'qiangua_note_info', 'NoteId,XhsNoteId,XhsUserId,BloggerId');

  const brandByName = new Map();
  for (const b of brands) brandByName.set(b.BrandName, b);

  const existingXhsNoteIds = new Set();
  const existingNoteIds = new Set();
  const bloggerMap = new Map();
  for (const r of notes) {
    if (r.XhsNoteId) existingXhsNoteIds.add(String(r.XhsNoteId).toLowerCase());
    if (r.NoteId) existingNoteIds.add(String(r.NoteId).toLowerCase());
    if (r.XhsUserId && r.BloggerId) {
      const uid = String(r.XhsUserId).toLowerCase();
      if (!bloggerMap.has(uid)) bloggerMap.set(uid, String(r.BloggerId));
    }
  }

  try {
    const bloggers = await fetchAllRest(baseUrl, key, 'qiangua_blogger', 'BloggerId,XhsUserId');
    for (const r of bloggers) {
      if (r.XhsUserId) bloggerMap.set(String(r.XhsUserId).toLowerCase(), String(r.BloggerId));
    }
  } catch (_) {
    // blogger 表可能无 XhsUserId 列
  }

  return {
    brandByName,
    existingXhsNoteIds,
    existingNoteIds,
    bloggerByXhsUserId: bloggerMap,
    brandCount: brands.length,
    noteCount: notes.length,
  };
}

async function fetchDbContextPg(pool) {
  const brandsRes = await pool.query(
    'SELECT "BrandId", "BrandIdKey", "BrandName" FROM qiangua_brand ORDER BY "BrandName"'
  );
  const brandByName = new Map();
  for (const b of brandsRes.rows) {
    brandByName.set(b.BrandName, b);
  }

  const notesRes = await pool.query(
    'SELECT "NoteId", "XhsNoteId" FROM qiangua_note_info WHERE "XhsNoteId" IS NOT NULL OR "NoteId" IS NOT NULL'
  );
  const existingXhsNoteIds = new Set();
  const existingNoteIds = new Set();
  for (const r of notesRes.rows) {
    if (r.XhsNoteId) existingXhsNoteIds.add(String(r.XhsNoteId).toLowerCase());
    if (r.NoteId) existingNoteIds.add(String(r.NoteId).toLowerCase());
  }

  const bloggerMap = new Map();
  try {
    const bloggerRes = await pool.query(
      'SELECT "BloggerId", "XhsUserId" FROM qiangua_blogger WHERE "XhsUserId" IS NOT NULL'
    );
    for (const r of bloggerRes.rows) {
      bloggerMap.set(String(r.XhsUserId).toLowerCase(), String(r.BloggerId));
    }
  } catch (_) {
    // XhsUserId 列可能尚未在 blogger 表
  }

  const noteBloggerRes = await pool.query(`
    SELECT DISTINCT "XhsUserId", "BloggerId"
    FROM qiangua_note_info
    WHERE "XhsUserId" IS NOT NULL AND "BloggerId" IS NOT NULL
  `);
  for (const r of noteBloggerRes.rows) {
    const uid = String(r.XhsUserId).toLowerCase();
    if (!bloggerMap.has(uid)) {
      bloggerMap.set(uid, String(r.BloggerId));
    }
  }

  return {
    brandByName,
    existingXhsNoteIds,
    existingNoteIds,
    bloggerByXhsUserId: bloggerMap,
    brandCount: brandsRes.rows.length,
    noteCount: notesRes.rows.length,
  };
}

function buildCooperateBindList(brand, displayBrandName) {
  if (!brand) return '';
  return JSON.stringify([
    {
      BrandId: Number.isFinite(Number(brand.BrandId)) ? Number(brand.BrandId) : brand.BrandId,
      BrandIdKey: brand.BrandIdKey,
      BrandName: displayBrandName || brand.BrandName,
    },
  ]);
}

async function main() {
  loadEnvLocal();

  let db;
  const useRest = process.env.HUITUN_USE_PG !== '1';
  if (useRest) {
    console.log('连接数据库（REST）…');
    db = await fetchDbContextRest();
  } else {
    const pool = new Pool({
      host: process.env.SUPABASE_PG_HOST,
      port: 5432,
      database: process.env.SUPABASE_PG_DATABASE,
      user: process.env.SUPABASE_PG_USER,
      password: process.env.SUPABASE_PG_PASSWORD,
      ssl: { rejectUnauthorized: false },
      connectionTimeoutMillis: 30000,
    });
    console.log('连接数据库（PG）…');
    db = await fetchDbContextPg(pool);
    await pool.end();
  }
  console.log(`  品牌 ${db.brandCount}，笔记 ${db.noteCount}，博主映射 ${db.bloggerByXhsUserId.size}`);

  const csvRows = loadCsvRows();
  const { noteMap, bloggerMap, noteCount, bloggerCount } = loadXlsMaps();
  console.log(`灰豚 CSV ${csvRows.length} 条，XLS 笔记 ${noteCount}，XLS 博主 ${bloggerCount}`);
  console.log('  品牌匹配：alias → DB BrandName；剔除子线/非品牌；新品牌标记待创建');

  const staging = [];
  const stats = {
    total: 0,
    skip: 0,
    insert: 0,
    insertNewBrand: 0,
    excludedBrand: 0,
    brandUnmapped: 0,
    missingXlsNote: 0,
    missingXhsUserId: 0,
    newBloggers: 0,
    hitBloggers: 0,
  };
  const brandUnmappedNames = new Set();

  for (const csv of csvRows) {
    stats.total++;

    // 笔记 ID：优先用 CSV 直接字段，退路从 URL 解析
    const xhsNoteId = (
      String(csv['笔记id'] || '').toLowerCase() ||
      extractNoteIdFromUrl(csv['链接地址'])
    );

    const xlsNote = noteMap.get(xhsNoteId) || null;
    if (!xlsNote) stats.missingXlsNote++;

    // 博主 ID：优先 CSV 直接字段 → 主页链接 → XLS
    const xhsUserId = (
      String(csv['博主id'] || '').toLowerCase() ||
      extractUserIdFromUrl(csv['达人主页链接']) ||
      String(xlsNote?.['博主ID'] || '').toLowerCase()
    );
    if (!xhsUserId) stats.missingXhsUserId++;

    // 品牌名：先 alias 映射，再查 DB
    const brandNameRaw = (csv['商业合作品牌'] || '').trim();
    const brandNameMapped = BRAND_ALIAS[brandNameRaw] || brandNameRaw;
    const excluded = isExcludedBrand(brandNameRaw);
    const isNewBrand = !excluded && NEW_BRAND_NAMES.has(brandNameMapped);
    const brand = excluded || isNewBrand ? null : db.brandByName.get(brandNameMapped) || null;
    const brandResolved = !!brand || isNewBrand;

    if (excluded) {
      stats.excludedBrand++;
    } else if (!brandResolved && brandNameMapped) {
      stats.brandUnmapped++;
      brandUnmappedNames.add(brandNameRaw);
    }

    // brand_action 标记
    let brandAction = 'existing';
    if (excluded) brandAction = 'excluded';
    else if (isNewBrand) brandAction = 'new';
    else if (!brand) brandAction = 'unmapped';

    // 决策 import_action（顺序有意义，不要调换）
    let importAction = 'insert';
    let skipReason = '';
    if (excluded) {
      importAction = 'skip';
      skipReason = '剔除子线/非品牌';
    } else if (!xhsNoteId) {
      importAction = 'skip';
      skipReason = '无法解析笔记ID';
    } else if (!xlsNote) {
      importAction = 'skip';
      skipReason = '缺XLS详情';
    } else if (!xhsUserId) {
      importAction = 'skip';
      skipReason = '无法解析博主ID';
    } else if (db.existingXhsNoteIds.has(xhsNoteId)) {
      importAction = 'skip';
      skipReason = 'XhsNoteId 已存在于库';
    } else if (db.existingNoteIds.has(xhsNoteId)) {
      importAction = 'skip';
      skipReason = 'NoteId 已存在于库';
    } else if (!brandResolved) {
      importAction = 'skip';
      skipReason = '品牌未映射';
    }

    if (importAction === 'skip') {
      stats.skip++;
    } else {
      stats.insert++;
      if (isNewBrand) stats.insertNewBrand++;
    }

    let matchBlogger = 'new';
    let bloggerId = xhsUserId;
    if (xhsUserId && db.bloggerByXhsUserId.has(xhsUserId)) {
      matchBlogger = 'hit';
      bloggerId = db.bloggerByXhsUserId.get(xhsUserId);
      stats.hitBloggers++;
    } else if (importAction === 'insert' && xhsUserId) {
      stats.newBloggers++;
    }

    const publishTime = parsePublishTime(csv['发布时间'], xlsNote?.['笔记发布']);
    const noteType = noteTypeFromCsv(csv['笔记类型'], xlsNote?.['类型']);
    const adPrice = pickAdPrice(csv);

    const row = {
      import_action: importAction,
      skip_reason: skipReason,
      brand_action: brandAction,
      match_blogger: matchBlogger,
      XhsNoteId: xhsNoteId,
      NoteId: importAction === 'insert' ? xhsNoteId : '',
      NoteIdKey: importAction === 'insert' ? idKey(xhsNoteId) : '',
      XhsUserId: xhsUserId,
      BloggerId: bloggerId,
      BloggerIdKey: matchBlogger === 'new' && xhsUserId ? idKey(xhsUserId) : '',
      BrandId: brand?.BrandId || (isNewBrand ? '(待创建)' : ''),
      BrandIdKey: brand?.BrandIdKey || (isNewBrand ? '(待创建)' : ''),
      BrandName: brandNameRaw,
      huitun_brand_name: brandNameRaw,
      huitun_brand_mapped: brandNameMapped,
      CooperateBindsName: brandNameRaw,
      CooperateBindList: brand ? buildCooperateBindList(brand, brandNameRaw) : '',
      Title: xlsNote?.['标题'] || csv['笔记标题'] || '',
      XhsTitle: xlsNote?.['标题'] || csv['笔记标题'] || '',
      XhsContent: xlsNote?.['内容'] || '',
      CoverImage: csv['笔记封面'] || xlsNote?.['封面图'] || '',
      XhsImages: xlsNote?.['rawImageList'] || '',
      XhsVideo: xlsNote?.['视频链接'] || '',
      XhsNoteLink: xlsNote?.['笔记链接'] || csv['链接地址'] || '',
      NoteType: noteType,
      IsBusiness: yesNo(csv['商业笔记']),
      IsAdNote: yesNo(csv['是否参与付费推广']),
      PublishTime: publishTime,
      PubDate: toPubDate(publishTime),
      DateCode: toDateCode(publishTime),
      ViewCount: parseInt(String(csv['预估阅读量'] || '0').replace(/,/g, ''), 10) || 0,
      LikedCount: parseInt(String(csv['点赞数'] || '0').replace(/,/g, ''), 10) || 0,
      CollectedCount: parseInt(String(csv['收藏数'] || '0').replace(/,/g, ''), 10) || 0,
      CommentsCount: parseInt(String(csv['评论数'] || '0').replace(/,/g, ''), 10) || 0,
      ShareCount: parseInt(String(csv['分享数'] || '0').replace(/,/g, ''), 10) || 0,
      AdPrice: adPrice ?? '',
      BloggerNickName: csv['达人名称'] || xlsNote?.['博主昵称'] || '',
      BloggerProp: csv['达人等级'] || '',
      Fans: parseInt(String(csv['粉丝数'] || '0').replace(/,/g, ''), 10) || 0,
      RedId: csv['小红书号'] || '',
      LinkInfo: csv['联系方式'] && csv['联系方式'] !== '--' ? csv['联系方式'] : '',
      SmallAvatar: xlsNote?.['博主头像'] || '',
      DataSource: '灰豚',
      xls_joined: xlsNote ? 'yes' : 'no',
    };

    staging.push(row);
  }

  // 汇总 sheet
  const summaryRows = [
    { metric: '灰豚 CSV 总行数', value: stats.total },
    { metric: '待入库 insert（合计）', value: stats.insert },
    { metric: '  其中：新品牌笔记（需先创建品牌）', value: stats.insertNewBrand },
    { metric: '跳过 skip（合计）', value: stats.skip },
    { metric: '  剔除子线/非品牌', value: stats.excludedBrand },
    { metric: '  缺 XLS 详情', value: stats.missingXlsNote - (stats.excludedBrand > 0 ? 0 : 0) },
    { metric: '  品牌未映射', value: stats.brandUnmapped },
    { metric: 'insert 中新博主', value: stats.newBloggers },
    { metric: 'insert 中命中博主', value: stats.hitBloggers },
    { metric: 'DB 品牌数', value: db.brandCount },
    { metric: 'DB 笔记数（已有）', value: db.noteCount },
    { metric: '本批新品牌', value: [...NEW_BRAND_NAMES].join(' | ') },
    { metric: 'alias 映射', value: Object.entries(BRAND_ALIAS).map(([k, v]) => `${k} → ${v}`).join(' | ') },
    { metric: '未映射品牌名', value: [...brandUnmappedNames].join(' | ') || '(无)' },
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(summaryRows), '汇总统计');
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(staging), '待确认明细');

  // insert-only sheet for easy review
  const insertOnly = staging.filter((r) => r.import_action === 'insert');
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(insertOnly), '仅待入库');

  const skipOnly = staging.filter((r) => r.import_action === 'skip');
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(skipOnly), '跳过明细');

  // 新品牌汇总 sheet
  const newBrandRows = [...NEW_BRAND_NAMES].sort().map((name) => {
    const cnt = staging.filter((r) => r.huitun_brand_mapped === name && r.import_action === 'insert').length;
    return {
      BrandName: name,
      insert_count: cnt,
      note: '阶段B第1步需先在 qiangua_brand 创建此品牌',
    };
  });
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(newBrandRows), '待创建品牌');

  if (brandUnmappedNames.size) {
    const unmappedBrandRows = [...brandUnmappedNames].sort().map((name) => {
      const cnt = staging.filter((r) => r.huitun_brand_name === name).length;
      const suggestions = [...db.brandByName.keys()]
        .filter((bn) => bn.includes(name.slice(0, 4)) || name.includes(bn.slice(0, 4)))
        .slice(0, 5);
      return {
        huitun_brand_name: name,
        row_count: cnt,
        db_suggestions: suggestions.join(' | ') || '(无相近名称)',
      };
    });
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(unmappedBrandRows), '品牌未映射');
  }

  XLSX.writeFile(wb, OUT_XLSX);
  fs.writeFileSync(
    OUT_JSON,
    JSON.stringify({ generatedAt: new Date().toISOString(), stats, staging }, null, 2),
    'utf8'
  );

  console.log('\n=== 汇总完成 ===');
  console.log(`  总条数:       ${stats.total}`);
  console.log(`  待入库:       ${stats.insert}（其中新品牌笔记 ${stats.insertNewBrand} 条）`);
  console.log(`  跳过:         ${stats.skip}`);
  console.log(`    剔除子线/非品牌: ${stats.excludedBrand}`);
  console.log(`    缺XLS详情:       ${stats.missingXlsNote}`);
  console.log(`    品牌未映射:      ${stats.brandUnmapped}`);
  console.log(`  新博主: ${stats.newBloggers}，命中博主: ${stats.hitBloggers}`);
  if (brandUnmappedNames.size) {
    console.log(`  未映射品牌: ${[...brandUnmappedNames].join(', ')}`);
  }
  console.log(`\n输出:\n  ${OUT_XLSX}\n  ${OUT_JSON}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
