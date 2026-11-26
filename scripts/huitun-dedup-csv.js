#!/usr/bin/env node
/**
 * 灰豚商业笔记列表与数据库去重，合并输出单张 CSV（字段与原始灰豚导出一致）
 *
 * 支持源文件：
 *   - xhs_export_*.csv
 *   - *商业合作笔记*.xlsx / *商业笔记*.xlsx
 *
 * 用法：node scripts/huitun-dedup-csv.js
 */

const fs = require('fs');
const path = require('path');
const XLSX = require('xlsx');

const ROOT = path.join(__dirname, '..');
const DATA_DIR = path.join(ROOT, '灰豚数据入库');
const OUT_CSV = path.join(DATA_DIR, '灰豚汇总_去重后.csv');

const CSV_HEADERS = [
  '笔记标题',
  '笔记封面',
  '商业合作品牌',
  '笔记提及品牌',
  '预估阅读量',
  '点赞数',
  '收藏数',
  '评论数',
  '分享数',
  '预估投放报价',
  '发布时间',
  '链接地址',
  '达人名称',
  '粉丝数',
  '小红书号',
  '达人主页链接',
  '联系方式',
  '笔记类型',
  '商业笔记',
  '是否参与付费推广',
  '达人等级',
  '图文报价',
  '视频报价',
];

function loadEnvLocal() {
  const envPath = path.join(ROOT, '.env.local');
  if (!fs.existsSync(envPath)) {
    throw new Error('缺少 .env.local，请配置 Supabase 相关变量');
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
  // 去掉 UTF-8 BOM，避免首列名变成 \uFEFF...
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

function csvEscape(value) {
  const s = value == null ? '' : String(value);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function rowToCsvLine(row) {
  return CSV_HEADERS.map((h) => csvEscape(row[h] ?? '')).join(',');
}

function isSourceFile(name) {
  const outName = path.basename(OUT_CSV);
  if (name === outName || name.startsWith('staging_')) return false;
  if (name.endsWith('.csv') && name.startsWith('xhs_export_')) return true;
  if (!name.endsWith('.xlsx')) return false;
  if (name.includes('小红书笔记数据') || name.startsWith('staging_')) return false;
  // 旧版商业笔记列表，或「竞品笔记投放数据源」等多 Sheet 汇总表
  return (
    name.includes('商业合作笔记') ||
    name.includes('商业笔记') ||
    name.includes('竞品笔记投放') ||
    name.includes('投放数据源')
  );
}

/** 读取 xlsx 全部 Sheet，合并旧版 23 列商业笔记行 */
function loadXlsxRows(filePath) {
  const wb = XLSX.readFile(filePath);
  const all = [];
  for (const sheetName of wb.SheetNames) {
    const rows = XLSX.utils.sheet_to_json(wb.Sheets[sheetName], { defval: '' });
    if (!rows.length || !isLegacyCommercialSchema(rows[0])) {
      console.log(`  跳过 Sheet「${sheetName}」（非旧版商业笔记列）`);
      continue;
    }
    console.log(`  Sheet「${sheetName}」: ${rows.length} 条`);
    for (const row of rows) all.push(row);
  }
  return all;
}

/** 仅接受旧版 23 列商业笔记（含 链接地址 + 商业合作品牌）；新版 21 列不支持 */
function isLegacyCommercialSchema(row) {
  if (!row || typeof row !== 'object') return false;
  return (
    Object.prototype.hasOwnProperty.call(row, '链接地址') &&
    Object.prototype.hasOwnProperty.call(row, '商业合作品牌')
  );
}

function loadSourceRows() {
  const files = fs.readdirSync(DATA_DIR).filter(isSourceFile).sort();
  if (!files.length) {
    throw new Error(
      `未在 ${DATA_DIR} 找到源文件（xhs_export_*.csv 或 *商业合作笔记*.xlsx）`
    );
  }
  const all = [];
  const used = [];
  const skipped = [];
  for (const file of files) {
    const filePath = path.join(DATA_DIR, file);
    const rows = file.endsWith('.xlsx')
      ? loadXlsxRows(filePath)
      : parseCsv(fs.readFileSync(filePath, 'utf8'));
    if (!rows.length || !isLegacyCommercialSchema(rows[0])) {
      skipped.push(file);
      continue;
    }
    used.push(file);
    for (const row of rows) {
      all.push({ row, _sourceFile: file });
    }
  }
  if (skipped.length) {
    console.log(`跳过非旧版格式 ${skipped.length} 个文件（不支持新版 21 列导出）:`);
    for (const f of skipped) console.log(`  - ${f}`);
  }
  if (!used.length) {
    throw new Error(
      `未找到旧版商业笔记文件（需含「链接地址」「商业合作品牌」列）`
    );
  }
  return { files: used, rows: all };
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

async function fetchExistingNoteIds() {
  const baseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!baseUrl || !key) {
    throw new Error('缺少 NEXT_PUBLIC_SUPABASE_URL 或 SUPABASE_SERVICE_ROLE_KEY');
  }

  console.log('  拉取库内已有笔记 ID…');
  const notes = await fetchAllRest(baseUrl, key, 'qiangua_note_info', 'NoteId,XhsNoteId');
  const existing = new Set();
  for (const r of notes) {
    if (r.XhsNoteId) existing.add(String(r.XhsNoteId).toLowerCase());
    if (r.NoteId) existing.add(String(r.NoteId).toLowerCase());
  }
  return { existing, dbNoteCount: notes.length };
}

function normalizeRow(raw) {
  const row = {};
  for (const h of CSV_HEADERS) {
    const v = raw[h];
    // xlsx 可能给出 number（发布时间序列、粉丝数、小红书号等）
    row[h] = v == null || v === '' ? '' : String(v);
  }
  return row;
}

async function main() {
  loadEnvLocal();

  const { files, rows: sourceRows } = loadSourceRows();
  console.log(`读取 ${files.length} 个源文件，共 ${sourceRows.length} 条`);
  for (const f of files) console.log(`  - ${f}`);

  const { existing, dbNoteCount } = await fetchExistingNoteIds();
  console.log(`  库内笔记 ${dbNoteCount} 条，去重键 ${existing.size} 个`);

  const kept = [];
  const seenInBatch = new Set();
  const stats = {
    total: sourceRows.length,
    skippedInDb: 0,
    skippedDupInBatch: 0,
    skippedNoNoteId: 0,
    kept: 0,
  };

  for (const { row: raw } of sourceRows) {
    const row = normalizeRow(raw);
    const xhsNoteId = extractNoteIdFromUrl(row['链接地址']);

    if (!xhsNoteId) {
      stats.skippedNoNoteId++;
      continue;
    }
    if (existing.has(xhsNoteId)) {
      stats.skippedInDb++;
      continue;
    }
    if (seenInBatch.has(xhsNoteId)) {
      stats.skippedDupInBatch++;
      continue;
    }

    seenInBatch.add(xhsNoteId);
    kept.push(row);
    stats.kept++;
  }

  const lines = ['\uFEFF' + CSV_HEADERS.join(','), ...kept.map(rowToCsvLine)];
  fs.writeFileSync(OUT_CSV, lines.join('\n') + '\n', 'utf8');

  console.log('\n=== 去重完成 ===');
  console.log(`  源数据:     ${stats.total}`);
  console.log(`  库内已有:   ${stats.skippedInDb}`);
  console.log(`  批次重复:   ${stats.skippedDupInBatch}`);
  console.log(`  无法解析ID: ${stats.skippedNoNoteId}`);
  console.log(`  保留:       ${stats.kept}`);
  console.log(`\n输出: ${OUT_CSV}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
