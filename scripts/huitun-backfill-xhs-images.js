#!/usr/bin/env node
/**
 * 从灰豚笔记详情 XLSX 回填 qiangua_note_info.XhsImages（rawImageList → XHS CDN）
 *
 * 用法：
 *   node scripts/huitun-backfill-xhs-images.js           # dry-run
 *   node scripts/huitun-backfill-xhs-images.js --execute
 *
 * 可选：
 *   --staging <path>   默认 灰豚数据入库/staging_灰豚汇总_待确认.json（取 import_action=insert）
 */

const fs = require('fs');
const path = require('path');
const XLSX = require('xlsx');

const ROOT = path.join(__dirname, '..');
const DATA_DIR = path.join(ROOT, '灰豚数据入库');
const DEFAULT_STAGING = path.join(DATA_DIR, 'staging_灰豚汇总_待确认.json');
const LOG_PATH = path.join(DATA_DIR, 'import_灰豚回填图片结果.json');

const XLSX_FILES = [
  '小红书笔记数据_加云20260706_2026-07-06_18-30-17.xlsx',
];

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
  const args = { staging: DEFAULT_STAGING };
  for (let i = 2; i < argv.length; i++) {
    if (argv[i] === '--staging' && argv[i + 1]) args.staging = path.resolve(argv[++i]);
  }
  return args;
}

function loadRawImageMap() {
  const map = new Map();
  for (const file of XLSX_FILES) {
    const filePath = path.join(DATA_DIR, file);
    if (!fs.existsSync(filePath)) {
      throw new Error(`缺少详情文件: ${filePath}`);
    }
    const wb = XLSX.readFile(filePath);
    const notes = XLSX.utils.sheet_to_json(wb.Sheets['笔记'], { defval: '' });
    for (const n of notes) {
      const id = String(n['笔记ID'] || '').toLowerCase();
      const images = String(n.rawImageList || '').trim();
      if (id && !map.has(id)) map.set(id, images);
    }
  }
  return map;
}

function loadInsertNoteIds(stagingPath) {
  if (!fs.existsSync(stagingPath)) {
    throw new Error(`staging 文件不存在: ${stagingPath}`);
  }
  const doc = JSON.parse(fs.readFileSync(stagingPath, 'utf8'));
  const ids = (doc.staging || [])
    .filter((r) => r.import_action === 'insert')
    .map((r) => String(r.XhsNoteId || r.NoteId || '').toLowerCase())
    .filter(Boolean);
  return [...new Set(ids)];
}

async function patchNote(baseUrl, key, noteId, xhsImages) {
  const url = `${baseUrl}/rest/v1/qiangua_note_info?NoteId=eq.${encodeURIComponent(noteId)}`;
  const res = await fetch(url, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      apikey: key,
      Authorization: `Bearer ${key}`,
      Prefer: 'return=minimal',
    },
    body: JSON.stringify({ XhsImages: xhsImages }),
  });
  if (!res.ok) throw new Error(`PATCH ${noteId}: ${(await res.text()).slice(0, 300)}`);
}

async function main() {
  loadEnvLocal();
  const execute = process.argv.includes('--execute');
  const args = parseArgs(process.argv);
  const baseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!baseUrl || !key) throw new Error('缺少 Supabase 配置');

  const rawImageMap = loadRawImageMap();
  const insertNoteIds = loadInsertNoteIds(args.staging);

  const toUpdate = [];
  const skipped = [];

  for (const noteId of insertNoteIds) {
    const images = rawImageMap.get(noteId);
    if (!images) {
      skipped.push({ noteId, reason: '新 XLSX 无 rawImageList' });
      continue;
    }
    toUpdate.push({ noteId, images, urlCount: (images.match(/https?:\/\//g) || []).length });
  }

  console.log(`模式: ${execute ? '正式更新 (--execute)' : 'dry-run'}`);
  console.log(`staging insert 笔记: ${insertNoteIds.length}`);
  console.log(`新 XLSX rawImageList: ${rawImageMap.size} 条`);
  console.log(`待 PATCH: ${toUpdate.length}，跳过: ${skipped.length}`);

  if (toUpdate.length) {
    const sample = toUpdate[0];
    console.log('\n样例:');
    console.log(`  NoteId: ${sample.noteId}`);
    console.log(`  URL 数: ${sample.urlCount}`);
    console.log(`  长度: ${sample.images.length}`);
    console.log(`  首图: ${sample.images.split(',')[0].slice(0, 90)}...`);
  }

  const result = {
    mode: execute ? 'execute' : 'dry-run',
    at: new Date().toISOString(),
    staging: args.staging,
    xlsxFiles: XLSX_FILES,
    planned: toUpdate.length,
    skipped,
    updated: 0,
    failed: 0,
    errors: [],
  };

  if (!execute) {
    console.log(`\n[dry-run] 将更新 ${toUpdate.length} 条笔记的 XhsImages`);
    console.log('确认后执行: node scripts/huitun-backfill-xhs-images.js --execute');
    fs.writeFileSync(LOG_PATH, JSON.stringify(result, null, 2), 'utf8');
    console.log(`\n预览: ${LOG_PATH}`);
    return;
  }

  let ok = 0;
  let fail = 0;
  for (const { noteId, images } of toUpdate) {
    try {
      await patchNote(baseUrl, key, noteId, images);
      ok++;
      if (ok % 20 === 0 || ok === toUpdate.length) {
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
