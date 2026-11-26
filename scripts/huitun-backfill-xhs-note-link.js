#!/usr/bin/env node
/**
 * 将已入库灰豚笔记的 XhsNoteLink 回填为 XLS「笔记链接」
 *
 * 用法：
 *   node scripts/huitun-backfill-xhs-note-link.js           # dry-run
 *   node scripts/huitun-backfill-xhs-note-link.js --execute
 */

const fs = require('fs');
const path = require('path');
const XLSX = require('xlsx');

const ROOT = path.join(__dirname, '..');
const XLS_PATH = path.join(ROOT, '灰豚数据入库', '小红书笔记详情.xls');

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

function loadXlsNoteLinkMap() {
  const wb = XLSX.readFile(XLS_PATH);
  const notes = XLSX.utils.sheet_to_json(wb.Sheets['笔记'], { defval: '' });
  const map = new Map();
  for (const n of notes) {
    const id = String(n['笔记ID'] || '').toLowerCase();
    const link = String(n['笔记链接'] || '').trim();
    if (id && link) map.set(id, link);
  }
  return map;
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

async function patchNote(baseUrl, key, noteId, xhsNoteLink) {
  const url = `${baseUrl}/rest/v1/qiangua_note_info?NoteId=eq.${encodeURIComponent(noteId)}`;
  const res = await fetch(url, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      apikey: key,
      Authorization: `Bearer ${key}`,
      Prefer: 'return=minimal',
    },
    body: JSON.stringify({ XhsNoteLink: xhsNoteLink }),
  });
  if (!res.ok) throw new Error(`PATCH ${noteId}: ${await res.text()}`);
}

async function main() {
  loadEnvLocal();
  const execute = process.argv.includes('--execute');
  const baseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!baseUrl || !key) throw new Error('缺少 Supabase 配置');

  const xlsMap = loadXlsNoteLinkMap();
  console.log(`XLS 笔记链接: ${xlsMap.size} 条`);
  console.log(`模式: ${execute ? '正式更新' : 'dry-run'}`);

  const notes = await fetchAllRest(
    baseUrl,
    key,
    'qiangua_note_info',
    'NoteId,XhsNoteId,XhsNoteLink,DataSource',
    `DataSource=eq.${encodeURIComponent('灰豚')}`,
  );

  const toUpdate = [];
  for (const n of notes) {
    const xhsId = String(n.XhsNoteId || n.NoteId || '').toLowerCase();
    const xlsLink = xlsMap.get(xhsId);
    if (!xlsLink) continue;
    const current = String(n.XhsNoteLink || '').trim();
    if (current === xlsLink) continue;
    toUpdate.push({ noteId: n.NoteId, xhsId, from: current, to: xlsLink });
  }

  console.log(`灰豚笔记 ${notes.length} 条，需更新 XhsNoteLink: ${toUpdate.length}`);
  toUpdate.slice(0, 3).forEach((u) => {
    console.log(`  ${u.xhsId}`);
    console.log(`    现: ${u.from.slice(0, 80)}...`);
    console.log(`    新: ${u.to.slice(0, 80)}...`);
  });

  if (!execute) {
    console.log('\n确认后执行: node scripts/huitun-backfill-xhs-note-link.js --execute');
    return;
  }

  let ok = 0;
  let fail = 0;
  for (const u of toUpdate) {
    try {
      await patchNote(baseUrl, key, u.noteId, u.to);
      ok++;
      if (ok % 20 === 0) process.stdout.write(`\r  已更新 ${ok}/${toUpdate.length}`);
    } catch (e) {
      fail++;
      console.error(`\n  失败 ${u.noteId}: ${e.message}`);
    }
  }
  console.log(`\n完成: 成功 ${ok}，失败 ${fail}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
