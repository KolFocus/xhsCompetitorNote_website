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

function parsePublishTime(csvTime, xlsTime) {
  const raw = csvTime || xlsTime || '';
  if (!raw) return '';
  const cn = raw.match(/(\d{4})年(\d{2})月(\d{2})日\s*(\d{2}):(\d{2}):(\d{2})/);
  if (cn) {
    return `${cn[1]}-${cn[2]}-${cn[3]}T${cn[4]}:${cn[5]}:${cn[6]}+08:00`;
  }
  const std = raw.match(/^(\d{4}-\d{2}-\d{2})\s+(\d{2}:\d{2}:\d{2})/);
  if (std) return `${std[1]}T${std[2]}+08:00`;
  return raw;
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

/** 剔除美妆/香氛子线（不入库） */
function isExcludedSubBrand(cooperateBrandName) {
  const n = String(cooperateBrandName || '').trim();
  if (!n) return false;
  return n.includes('美妆') || n.includes('香氛') || n.includes('香水美妆');
}

function loadCsvRows() {
  const files = fs.readdirSync(DATA_DIR).filter((f) => f.endsWith('.csv'));
  const all = [];
  for (const file of files.sort()) {
    const text = fs.readFileSync(path.join(DATA_DIR, file), 'utf8');
    const rows = parseCsv(text);
    for (const row of rows) {
      all.push({ ...row, _sourceCsv: file });
    }
  }
  return all;
}

function loadXlsMaps() {
  const wb = XLSX.readFile(path.join(DATA_DIR, '小红书笔记详情.xls'));
  const notes = XLSX.utils.sheet_to_json(wb.Sheets['笔记'], { defval: '' });
  const bloggers = XLSX.utils.sheet_to_json(wb.Sheets['博主'], { defval: '' });
  const noteMap = new Map();
  for (const n of notes) {
    const id = String(n['笔记ID'] || '').toLowerCase();
    if (id) noteMap.set(id, n);
  }
  const bloggerMap = new Map();
  for (const b of bloggers) {
    const id = String(b['用户ID'] || '').toLowerCase();
    if (id) bloggerMap.set(id, b);
  }
  return { noteMap, bloggerMap, noteCount: notes.length, bloggerCount: bloggers.length };
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

function buildCooperateBindList(brand) {
  if (!brand) return '';
  return JSON.stringify([
    {
      BrandId: Number.isFinite(Number(brand.BrandId)) ? Number(brand.BrandId) : brand.BrandId,
      BrandIdKey: brand.BrandIdKey,
      BrandName: brand.BrandName,
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
  console.log('  品牌匹配：CSV「商业合作品牌」→ DB BrandName；剔除含美妆/香氛子线');

  const staging = [];
  const stats = {
    total: 0,
    skip: 0,
    insert: 0,
    excludedSubBrand: 0,
    brandUnmapped: 0,
    missingXlsNote: 0,
    missingXhsUserId: 0,
    newBloggers: 0,
    hitBloggers: 0,
  };
  const brandUnmappedNames = new Set();

  for (const csv of csvRows) {
    stats.total++;
    const xhsNoteId = extractNoteIdFromUrl(csv['链接地址']) || '';
    const xlsNote = noteMap.get(xhsNoteId) || null;
    if (!xlsNote) stats.missingXlsNote++;

    const xhsUserId = String(xlsNote?.['博主ID'] || '').toLowerCase();
    if (!xhsUserId) stats.missingXhsUserId++;

    const brandNameRaw = (csv['商业合作品牌'] || '').trim();
    const excludedSubBrand = isExcludedSubBrand(brandNameRaw);
    const brand = excludedSubBrand ? null : db.brandByName.get(brandNameRaw) || null;
    const brandMapped = !!brand;
    if (excludedSubBrand) {
      stats.excludedSubBrand++;
    } else if (!brandMapped && brandNameRaw) {
      stats.brandUnmapped++;
      brandUnmappedNames.add(brandNameRaw);
    }

    const filePrefixMatch = String(csv._sourceCsv || '').match(/^(.+?)_商业笔记_/);
    const filePrefix = filePrefixMatch ? filePrefixMatch[1].trim() : '';

    let importAction = 'insert';
    let skipReason = '';
    if (excludedSubBrand) {
      importAction = 'skip';
      skipReason = '剔除子线（美妆/香氛）';
    } else if (xhsNoteId && db.existingXhsNoteIds.has(xhsNoteId)) {
      importAction = 'skip';
      skipReason = 'XhsNoteId 已存在于库';
    } else if (xhsNoteId && db.existingNoteIds.has(xhsNoteId)) {
      importAction = 'skip';
      skipReason = 'NoteId 已存在于库';
    } else if (!brandMapped) {
      importAction = 'skip';
      skipReason = '品牌未映射';
    } else if (!xhsNoteId) {
      importAction = 'skip';
      skipReason = '无法解析笔记ID';
    }

    if (importAction === 'skip') stats.skip++;
    else stats.insert++;

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
      match_blogger: matchBlogger,
      brand_mapped: brandMapped ? 'yes' : 'no',
      brand_match_via: excludedSubBrand ? 'excluded' : 'csv_cooperate_brand',
      excluded_sub_brand: excludedSubBrand ? 'yes' : 'no',
      source_file_prefix: filePrefix,
      XhsNoteId: xhsNoteId,
      NoteId: importAction === 'insert' ? xhsNoteId : '',
      NoteIdKey: importAction === 'insert' ? idKey(xhsNoteId) : '',
      XhsUserId: xhsUserId,
      BloggerId: bloggerId,
      BloggerIdKey: matchBlogger === 'new' && xhsUserId ? idKey(xhsUserId) : '',
      BrandId: brand?.BrandId || '',
      BrandIdKey: brand?.BrandIdKey || '',
      BrandName: brand?.BrandName || '',
      huitun_brand_name: brandNameRaw,
      CooperateBindsName: brandNameRaw,
      CooperateBindList: brand ? buildCooperateBindList(brand) : '',
      Title: xlsNote?.['标题'] || csv['笔记标题'] || '',
      XhsTitle: xlsNote?.['标题'] || csv['笔记标题'] || '',
      XhsContent: xlsNote?.['内容'] || '',
      CoverImage: csv['笔记封面'] || xlsNote?.['封面图'] || '',
      XhsImages: xlsNote?.['图片列表'] || '',
      XhsVideo: xlsNote?.['视频链接'] || '',
      XhsNoteLink: csv['链接地址'] || xlsNote?.['笔记链接'] || '',
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
      source_csv: csv._sourceCsv,
      xls_joined: xlsNote ? 'yes' : 'no',
    };

    staging.push(row);
  }

  // 汇总 sheet
  const summaryRows = [
    { metric: '灰豚 CSV 总行数', value: stats.total },
    { metric: '待入库 insert', value: stats.insert },
    { metric: '跳过 skip', value: stats.skip },
    { metric: '剔除子线（美妆/香氛）', value: stats.excludedSubBrand },
    { metric: '品牌未映射 skip', value: stats.brandUnmapped },
    { metric: '缺 XLS 笔记行', value: stats.missingXlsNote },
    { metric: '缺 XhsUserId', value: stats.missingXhsUserId },
    { metric: 'insert 中新博主', value: stats.newBloggers },
    { metric: 'insert 中命中博主', value: stats.hitBloggers },
    { metric: 'DB 品牌数', value: db.brandCount },
    { metric: 'DB 笔记数', value: db.noteCount },
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

  const unmappedBrandRows = [...brandUnmappedNames].sort().map((name) => {
    const cnt = staging.filter((r) => r.huitun_brand_name === name).length;
    const suggestions = [...db.brandByName.keys()]
      .filter((bn) => bn.includes(name.slice(0, 4)) || name.includes(bn.slice(0, 4)))
      .slice(0, 5);
    return {
      huitun_brand_name: name,
      row_count: cnt,
      db_suggestions: suggestions.join(' | ') || '(无相近名称，需在 qiangua_brand 新建或配置 alias)',
    };
  });
  if (unmappedBrandRows.length) {
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(unmappedBrandRows), '品牌未映射');
  }

  XLSX.writeFile(wb, OUT_XLSX);
  fs.writeFileSync(
    OUT_JSON,
    JSON.stringify({ generatedAt: new Date().toISOString(), stats, staging }, null, 2),
    'utf8'
  );

  console.log('\n=== 汇总完成 ===');
  console.log(`  总条数: ${stats.total}`);
  console.log(`  待入库: ${stats.insert}`);
  console.log(`  跳过:   ${stats.skip}`);
  console.log(`  剔除美妆/香氛: ${stats.excludedSubBrand}`);
  console.log(`  品牌未映射: ${stats.brandUnmapped}`);
  if (brandUnmappedNames.size) {
    console.log(`  未映射品牌: ${[...brandUnmappedNames].join(', ')}`);
  }
  console.log(`\n输出:\n  ${OUT_XLSX}\n  ${OUT_JSON}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
