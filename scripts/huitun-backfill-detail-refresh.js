#!/usr/bin/env node
/**
 * 用最新「小红书笔记数据_*.xlsx」刷新已入库笔记的前端相关字段：
 *   XhsImages / CoverImage / XhsNoteLink / XhsContent / XhsVideo / XhsTitle
 *
 * 用法：
 *   node scripts/huitun-backfill-detail-refresh.js
 *   node scripts/huitun-backfill-detail-refresh.js --execute
 *   node scripts/huitun-backfill-detail-refresh.js --file 小红书笔记数据_xxx.xlsx --execute
 */

const fs = require('fs');
const path = require('path');
const XLSX = require('xlsx');

const ROOT = path.join(__dirname, '..');
const DATA_DIR = path.join(ROOT, '灰豚数据入库');
const LOG_PATH = path.join(DATA_DIR, 'backfill_详情刷新_结果.json');
const CHUNK = 20;

function loadEnvLocal() {
  const envPath = path.join(ROOT, '.env.local');
  if (!fs.existsSync(envPath)) throw new Error('缺少 .env.local');
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
  const args = { execute: false, file: '' };
  for (let i = 2; i < argv.length; i++) {
    if (argv[i] === '--execute') args.execute = true;
    else if (argv[i] === '--file' && argv[i + 1]) args.file = argv[++i];
  }
  return args;
}

function resolveDetailFile(explicit) {
  if (explicit) {
    const p = path.isAbsolute(explicit) ? explicit : path.join(DATA_DIR, explicit);
    if (!fs.existsSync(p)) throw new Error(`详情文件不存在: ${p}`);
    return p;
  }
  const files = fs
    .readdirSync(DATA_DIR)
    .filter((n) => n.startsWith('小红书笔记数据_') && n.endsWith('.xlsx'))
    .sort();
  if (!files.length) throw new Error(`未在 ${DATA_DIR} 找到 小红书笔记数据_*.xlsx`);
  return path.join(DATA_DIR, files[files.length - 1]);
}

function firstImageUrl(imageList) {
  const s = String(imageList || '').trim();
  if (!s) return '';
  const m = s.match(/https?:\/\/[^\s,]+/);
  return m ? m[0] : '';
}

function loadDetailMap(filePath) {
  const wb = XLSX.readFile(filePath);
  if (!wb.Sheets['笔记']) throw new Error(`文件无「笔记」Sheet: ${filePath}`);
  const notes = XLSX.utils.sheet_to_json(wb.Sheets['笔记'], { defval: '' });
  const map = new Map();
  for (const n of notes) {
    const id = String(n['笔记ID'] || '').toLowerCase();
    if (!id) continue;
    // CoverImage ← 封面图；XhsImages ← 图片列表（灰豚 OSS，非 rawImageList）
    const images = String(n['图片列表'] || '').trim();
    map.set(id, {
      XhsImages: images || null,
      CoverImage: String(n['封面图'] || '').trim() || firstImageUrl(images) || null,
      XhsNoteLink: String(n['笔记链接'] || '').trim() || null,
      XhsContent: String(n['内容'] || '').trim() || null,
      XhsVideo: String(n['视频链接'] || '').trim() || null,
      XhsTitle: String(n['标题'] || '').trim() || null,
    });
  }
  return map;
}

async function fetchWithRetry(url, options, retry = 2) {
  let lastErr;
  for (let attempt = 0; attempt <= retry; attempt++) {
    try {
      const res = await fetch(url, options);
      if (res.ok || (res.status < 500 && res.status !== 429)) return res;
      lastErr = new Error(`HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`);
      await new Promise((r) => setTimeout(r, 400 * (attempt + 1)));
    } catch (e) {
      lastErr = e;
      if (attempt < retry) await new Promise((r) => setTimeout(r, 400 * (attempt + 1)));
    }
  }
  throw lastErr;
}

async function fetchNotesByIds(baseUrl, key, ids) {
  const found = new Map();
  for (let i = 0; i < ids.length; i += 40) {
    const chunk = ids.slice(i, i + 40);
    const or = chunk.map((id) => `NoteId.eq.${id}`).join(',');
    const url = `${baseUrl}/rest/v1/qiangua_note_info?or=(${or})&select=${encodeURIComponent(
      'NoteId,XhsNoteId,CoverImage,XhsImages,XhsNoteLink,XhsContent,XhsVideo,XhsTitle',
    )}`;
    const res = await fetchWithRetry(url, {
      headers: { apikey: key, Authorization: `Bearer ${key}` },
    });
    if (!res.ok) throw new Error(`查询失败 ${res.status}: ${(await res.text()).slice(0, 200)}`);
    const rows = await res.json();
    for (const r of rows) {
      const id = String(r.NoteId || '').toLowerCase();
      if (id) found.set(id, r);
    }
  }
  return found;
}

function diffPatch(dbRow, detail) {
  const patch = {};
  const fields = ['XhsImages', 'CoverImage', 'XhsNoteLink', 'XhsContent', 'XhsVideo', 'XhsTitle'];
  for (const f of fields) {
    const next = detail[f];
    if (next == null || next === '') continue;
    const cur = dbRow[f] == null ? '' : String(dbRow[f]);
    if (cur !== String(next)) patch[f] = next;
  }
  return patch;
}

async function patchNote(baseUrl, key, noteId, patch) {
  const url = `${baseUrl}/rest/v1/qiangua_note_info?NoteId=eq.${encodeURIComponent(noteId)}`;
  const res = await fetchWithRetry(url, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      apikey: key,
      Authorization: `Bearer ${key}`,
      Prefer: 'return=minimal',
    },
    body: JSON.stringify(patch),
  });
  if (!res.ok) throw new Error(`PATCH ${noteId}: ${(await res.text()).slice(0, 300)}`);
}

async function main() {
  loadEnvLocal();
  const args = parseArgs(process.argv);
  const baseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!baseUrl || !key) throw new Error('缺少 Supabase 配置');

  const filePath = resolveDetailFile(args.file);
  console.log(`详情文件: ${path.basename(filePath)}`);
  console.log(`模式: ${args.execute ? '正式更新 (--execute)' : 'dry-run'}`);

  const detailMap = loadDetailMap(filePath);
  const ids = [...detailMap.keys()];
  console.log(`XLS 笔记: ${ids.length}`);

  console.log('拉取库内对照…');
  const dbMap = await fetchNotesByIds(baseUrl, key, ids);
  console.log(`库内命中: ${dbMap.size}`);

  const toUpdate = [];
  let unchanged = 0;
  let missing = 0;
  const fieldCounts = {
    XhsImages: 0,
    CoverImage: 0,
    XhsNoteLink: 0,
    XhsContent: 0,
    XhsVideo: 0,
    XhsTitle: 0,
  };

  for (const id of ids) {
    const db = dbMap.get(id);
    if (!db) {
      missing++;
      continue;
    }
    const patch = diffPatch(db, detailMap.get(id));
    if (!Object.keys(patch).length) {
      unchanged++;
      continue;
    }
    for (const k of Object.keys(patch)) fieldCounts[k]++;
    toUpdate.push({ noteId: db.NoteId, patch });
  }

  console.log(`待更新: ${toUpdate.length}，无变化: ${unchanged}，库中无: ${missing}`);
  console.log('字段变更计数:', fieldCounts);
  if (toUpdate[0]) {
    console.log('\n样例 NoteId:', toUpdate[0].noteId);
    console.log('  patch keys:', Object.keys(toUpdate[0].patch).join(', '));
    if (toUpdate[0].patch.XhsImages) {
      console.log('  新首图:', String(toUpdate[0].patch.XhsImages).split(',')[0].slice(0, 100));
    }
  }

  const result = {
    mode: args.execute ? 'execute' : 'dry-run',
    at: new Date().toISOString(),
    file: path.basename(filePath),
    xlsCount: ids.length,
    dbHit: dbMap.size,
    planned: toUpdate.length,
    unchanged,
    missing,
    fieldCounts,
    updated: 0,
    failed: 0,
    errors: [],
  };

  if (!args.execute) {
    console.log(`\n[dry-run] 将更新 ${toUpdate.length} 条`);
    console.log('确认后执行: node scripts/huitun-backfill-detail-refresh.js --execute');
    fs.writeFileSync(LOG_PATH, JSON.stringify(result, null, 2), 'utf8');
    console.log(`预览: ${LOG_PATH}`);
    return;
  }

  let ok = 0;
  let fail = 0;
  for (let i = 0; i < toUpdate.length; i++) {
    const { noteId, patch } = toUpdate[i];
    try {
      await patchNote(baseUrl, key, noteId, patch);
      ok++;
      if (ok % CHUNK === 0 || ok === toUpdate.length) {
        process.stdout.write(`\r  已更新 ${ok}/${toUpdate.length}`);
      }
    } catch (e) {
      fail++;
      result.errors.push({ noteId, message: e.message });
      console.error(`\n  失败 ${noteId}: ${e.message}`);
    }
  }
  process.stdout.write('\n');

  result.updated = ok;
  result.failed = fail;
  fs.writeFileSync(LOG_PATH, JSON.stringify(result, null, 2), 'utf8');
  console.log(`\n完成: 成功 ${ok}，失败 ${fail}`);
  console.log(`结果: ${LOG_PATH}`);
  if (fail) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
