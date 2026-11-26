#!/usr/bin/env node
/**
 * 将已入库灰豚笔记的 BrandName / CooperateBindsName / CooperateBindList
 * 回填为灰豚原始品牌名（BrandId / BrandIdKey 不变）
 *
 * 用法：
 *   node scripts/huitun-backfill-brand-name.js           # dry-run
 *   node scripts/huitun-backfill-brand-name.js --execute
 *
 * 可选：
 *   --staging <path>   默认 灰豚数据入库/staging_灰豚汇总_待确认.json
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const DEFAULT_STAGING = path.join(ROOT, '灰豚数据入库', 'staging_灰豚汇总_待确认.json');
const LOG_PATH = path.join(ROOT, '灰豚数据入库', 'backfill_brand_name_结果.json');

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
  const args = { staging: DEFAULT_STAGING, execute: false };
  for (let i = 2; i < argv.length; i++) {
    if (argv[i] === '--execute') args.execute = true;
    else if (argv[i] === '--staging' && argv[i + 1]) {
      args.staging = argv[++i];
    }
  }
  return args;
}

function parseCooperateBindList(raw) {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw;
  try {
    const parsed = JSON.parse(String(raw));
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function buildTargetBindList(row) {
  const binds = parseCooperateBindList(row.CooperateBindList);
  if (binds.length) return binds;
  const brandId = row.BrandId;
  if (!brandId || brandId === '(待创建)') return [];
  return [
    {
      BrandId: Number.isFinite(Number(brandId)) ? Number(brandId) : brandId,
      BrandIdKey: row.BrandIdKey,
      BrandName: row.huitun_brand_name,
    },
  ];
}

function loadStagingMap(stagingPath) {
  const doc = JSON.parse(fs.readFileSync(stagingPath, 'utf8'));
  const map = new Map();
  for (const row of doc.staging || []) {
    const xhsId = String(row.XhsNoteId || '').toLowerCase();
    const displayName = String(row.huitun_brand_name || row.BrandName || '').trim();
    if (!xhsId || !displayName) continue;
    map.set(xhsId, {
      displayName,
      mappedName: String(row.huitun_brand_mapped || '').trim(),
      CooperateBindList: buildTargetBindList(row),
    });
  }
  return map;
}

function bindListBrandName(binds) {
  const first = binds[0];
  return first ? String(first.BrandName || '') : '';
}

function needsUpdate(note, target) {
  const currentName = String(note.BrandName || '').trim();
  if (currentName !== target.displayName) return true;
  const currentBindsName = String(note.CooperateBindsName || '').trim();
  if (currentBindsName !== target.displayName) return true;
  const currentBindName = bindListBrandName(parseCooperateBindList(note.CooperateBindList));
  if (currentBindName !== target.displayName) return true;
  return false;
}

async function fetchAllRest(baseUrl, key, table, select, filter, pageSize = 1000) {
  const rows = [];
  let start = 0;
  while (true) {
    const end = start + pageSize - 1;
    const url = `${baseUrl}/rest/v1/${table}?select=${encodeURIComponent(select)}&${filter}`;
    const res = await fetch(url, {
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
        Prefer: 'count=exact',
        Range: `${start}-${end}`,
      },
    });
    if (!res.ok) throw new Error(await res.text());
    const chunk = await res.json();
    if (!Array.isArray(chunk) || chunk.length === 0) break;
    rows.push(...chunk);
    if (chunk.length < pageSize) break;
    start += pageSize;
  }
  return rows;
}

async function patchNote(baseUrl, key, noteId, payload) {
  const url = `${baseUrl}/rest/v1/qiangua_note_info?NoteId=eq.${encodeURIComponent(noteId)}`;
  const res = await fetch(url, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      apikey: key,
      Authorization: `Bearer ${key}`,
      Prefer: 'return=minimal',
    },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(`PATCH ${noteId}: ${(await res.text()).slice(0, 300)}`);
}

async function main() {
  loadEnvLocal();
  const args = parseArgs(process.argv);
  const baseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!baseUrl || !key) throw new Error('缺少 Supabase 配置');
  if (!fs.existsSync(args.staging)) throw new Error(`staging 不存在: ${args.staging}`);

  const stagingMap = loadStagingMap(args.staging);
  console.log(`staging 品牌映射: ${stagingMap.size} 条`);
  console.log(`模式: ${args.execute ? '正式更新 (--execute)' : 'dry-run'}`);

  const notes = await fetchAllRest(
    baseUrl,
    key,
    'qiangua_note_info',
    'NoteId,XhsNoteId,BrandId,BrandIdKey,BrandName,CooperateBindsName,CooperateBindList,DataSource',
    `DataSource=eq.${encodeURIComponent('灰豚')}`,
  );

  const toUpdate = [];
  const skipped = [];

  for (const note of notes) {
    const xhsId = String(note.XhsNoteId || note.NoteId || '').toLowerCase();
    const target = stagingMap.get(xhsId);
    if (!target) {
      skipped.push({ xhsId, reason: '不在 staging' });
      continue;
    }
    if (!needsUpdate(note, target)) {
      skipped.push({ xhsId, reason: '已是灰豚原名' });
      continue;
    }
    toUpdate.push({
      noteId: note.NoteId,
      xhsId,
      fromBrandName: note.BrandName,
      toBrandName: target.displayName,
      fromMapped: target.mappedName,
      payload: {
        BrandName: target.displayName,
        CooperateBindsName: target.displayName,
        CooperateBindList: target.CooperateBindList,
      },
    });
  }

  console.log(`灰豚笔记 ${notes.length} 条`);
  console.log(`待 PATCH: ${toUpdate.length}，跳过: ${skipped.length}`);
  toUpdate.slice(0, 5).forEach((u) => {
    console.log(`  ${u.xhsId}: ${u.fromBrandName} → ${u.toBrandName} (alias→${u.fromMapped})`);
  });

  const result = {
    mode: args.execute ? 'execute' : 'dry-run',
    staging: args.staging,
    at: new Date().toISOString(),
    totalHuitunNotes: notes.length,
    planned: toUpdate.length,
    skipped: skipped.length,
    updated: 0,
    failed: 0,
    errors: [],
    samples: toUpdate.slice(0, 10).map((u) => ({
      XhsNoteId: u.xhsId,
      from: u.fromBrandName,
      to: u.toBrandName,
    })),
  };

  if (!args.execute) {
    fs.writeFileSync(LOG_PATH, JSON.stringify(result, null, 2), 'utf8');
    console.log(`\n预览结果: ${LOG_PATH}`);
    console.log('确认后执行: node scripts/huitun-backfill-brand-name.js --execute');
    return;
  }

  let ok = 0;
  for (const u of toUpdate) {
    try {
      await patchNote(baseUrl, key, u.noteId, u.payload);
      ok++;
      if (ok % 20 === 0) process.stdout.write(`\r  已更新 ${ok}/${toUpdate.length}`);
    } catch (e) {
      result.failed++;
      result.errors.push({ noteId: u.noteId, xhsId: u.xhsId, error: e.message });
      console.error(`\n  失败 ${u.noteId}: ${e.message}`);
    }
  }

  result.updated = ok;
  fs.writeFileSync(LOG_PATH, JSON.stringify(result, null, 2), 'utf8');
  console.log(`\n完成: 成功 ${ok}，失败 ${result.failed}`);
  console.log(`结果: ${LOG_PATH}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
