/**
 * OTB 鞋类图片打标脚本
 *
 * 读取 Excel 最后一列（sku主图），按 tag.txt 规则调用 AI 打标，
 * 结果写入新 Excel（在原列后追加标签列）。
 *
 * 用法：
 *   node scripts/otb_tag_excel.js \
 *     --in   "otb_打标/xxx.xlsx" \
 *     --cate "浅口单鞋"
 *
 * 可选参数：
 *   --out          输出文件路径（默认 otb_打标/output_{cate}_tagged.xlsx）
 *   --rules        tag 规则文件路径（默认 otb_打标/tag_{cate}.txt）
 *   --cache        缓存文件路径（默认 otb_打标/.cache_{cate}.jsonl）
 *   --provider     AI 提供商：openrouter（默认）或 chatai
 *   --model        模型名称（默认 google/gemini-2.5-flash）
 *   --concurrency  并发数（默认 3）
 *   --dry-run      只解析 tag 文件和 Excel 结构，不调用 AI
 */

'use strict';

const fs   = require('fs');
const path = require('path');
const XLSX = require('xlsx');

// ---------------------------------------------------------------------------
// 命令行参数解析
// ---------------------------------------------------------------------------
function parseArgs(argv) {
  const args = {};
  for (let i = 2; i < argv.length; i++) {
    if (argv[i].startsWith('--')) {
      const key = argv[i].slice(2);
      const val = argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[++i] : true;
      args[key] = val;
    }
  }
  return args;
}

const args = parseArgs(process.argv);

const INPUT_FILE  = args['input'] || args['in'];
const CATE        = args['cate'] || '';
const OUTPUT_FILE = args['output'] || args['out'] || (CATE ? `otb_打标/output_${CATE}_tagged.xlsx` : 'otb_打标/output_tagged.xlsx');
const RULES_FILE  = args['rules'] || (CATE ? `otb_打标/tag_${CATE}.txt` : 'otb_打标/tag.txt');
const MODEL       = args['model']    || 'google/gemini-2.5-flash';
const CONCURRENCY = parseInt(args['concurrency'] || '3', 10);
const CACHE_FILE  = args['cache'] || (CATE ? `otb_打标/.cache_${CATE}.jsonl` : 'otb_打标/.cache.jsonl');
const DRY_RUN     = args['dry-run'] === true || args['dry-run'] === 'true';
const PROVIDER    = (args['provider'] || 'openrouter').toLowerCase();

// 各提供商配置
const PROVIDER_CONFIG = {
  openrouter: {
    url: 'https://openrouter.ai/api/v1/chat/completions',
    defaultKey: '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',
    envKey: 'OPENROUTER_API_KEY',
    headers: {
      'HTTP-Referer': 'https://xhs-competitor-note.com',
      'X-Title': 'OTB Tag Excel',
    },
  },
  chatai: {
    url: 'https://api.viviai.cc/v1/chat/completions',
    defaultKey: 'sk-w6ccCFFCrI5kA5UDZjtFlKLLDQPuPebxzymwgdOe1Nqv6BxO',
    envKey: 'CHATAI_API_KEY',
    headers: {},
  },
};

if (!PROVIDER_CONFIG[PROVIDER]) {
  console.error(`[错误] 不支持的 provider: "${PROVIDER}"，可选值：openrouter / chatai`);
  process.exit(1);
}

const { url: API_URL, defaultKey, envKey, headers: EXTRA_HEADERS } = PROVIDER_CONFIG[PROVIDER];
const API_KEY = process.env[envKey] || defaultKey;

// ---------------------------------------------------------------------------
// 解析 tag.txt → [ { groupName, options: [{value, desc}] } ]
//
// tag.txt 格式：
//   分组名\t分组名（同值说明分组标题行）
//   候选值\t候选说明
//   （空行分隔分组）
// ---------------------------------------------------------------------------
function parseTagFile(filePath) {
  const raw = fs.readFileSync(filePath, 'utf-8');
  const lines = raw.split('\n').map(l => l.replace(/\r$/, ''));

  const groups = [];
  let current = null;

  for (const line of lines) {
    if (!line.trim()) {
      current = null;
      continue;
    }
    const [left, right] = line.split('\t');
    const leftTrim  = (left  || '').trim();
    const rightTrim = (right || '').trim();

    // 分组标题行：left 和 right 的值相同
    if (leftTrim === rightTrim && leftTrim !== '') {
      current = { groupName: leftTrim, desc: '', options: [] };
      groups.push(current);
    } else if (leftTrim === '[说明]' && current) {
      // 分组判别说明行
      current.desc = rightTrim;
    } else if (current && leftTrim) {
      current.options.push({ value: leftTrim, desc: rightTrim });
    }
  }

  return groups;
}

// ---------------------------------------------------------------------------
// 构建 Prompt（纯视觉判断，不再依赖标题）
// ---------------------------------------------------------------------------
function buildPrompt(groups) {
  const lines = [
    '你是一位专业的鞋类商品属性标注专家。',
    '我会给你一张鞋子的产品图，请纯粹根据图片的视觉特征，按以下规则对鞋子进行属性标注。',
    '',
  ];

  lines.push('## 标注规则');
  lines.push('以下是各属性分组及其候选值（格式：候选值 - 说明）：');
  lines.push('');

  for (const g of groups) {
    lines.push(`### ${g.groupName}`);
    if (g.desc) lines.push(`> ${g.desc}`);
    for (const opt of g.options) {
      lines.push(`- ${opt.value}：${opt.desc}`);
    }
    lines.push('');
  }

  lines.push('## 输出要求');
  lines.push('1. 每个分组**只选 1 个最贴近**的候选值；确实无法判断则填 unknown。');
  lines.push('2. **只能从候选值列表中选**，禁止自造新值，也不要自己增加其它未要求的属性字段。');
  lines.push('3. 每个分组输出一个对象，包含 `value`（标签值，必须为候选值之一）和 `reason`（简短判别说明，15字以内）两个字段。');
  lines.push('4. 输出为合法 JSON 对象，并用 ^DT^ 包裹，格式如下：');
  lines.push('');
  lines.push('^DT^');
  const exampleObj = {};
  for (const g of groups) {
    exampleObj[g.groupName] = { value: g.options[0]?.value || 'unknown', reason: '判别说明示例' };
  }
  lines.push(JSON.stringify(exampleObj, null, 2));
  lines.push('^DT^');
  lines.push('');
  lines.push('不要输出任何其他内容，只输出 ^DT^ 包裹的 JSON。');

  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// 解析 AI 响应（提取 ^DT^...^DT^ 之间的 JSON）
// 返回 { tags: { groupName: value }, reasons: { groupName: reason } }
// ---------------------------------------------------------------------------
function parseResponse(content, groups) {
  const match = content.match(/\^DT\^([\s\S]*?)\^DT\^/);
  if (!match) {
    throw new Error('响应未包含 ^DT^ 包裹的 JSON，原文：' + content.slice(0, 200));
  }
  let jsonStr = match[1].trim();
  jsonStr = jsonStr.replace(/^```json\s*/i, '').replace(/\s*```$/, '').trim();

  let parsed;
  try {
    parsed = JSON.parse(jsonStr);
  } catch (e) {
    throw new Error('JSON 解析失败: ' + e.message + '  原文: ' + jsonStr.slice(0, 200));
  }

  const tags    = {};
  const reasons = {};

  for (const g of groups) {
    const entry = parsed[g.groupName];
    let val, reason;

    if (entry && typeof entry === 'object') {
      // 新格式：{ value, reason }
      val    = (entry.value  || '').toString().trim();
      reason = (entry.reason || '').toString().trim();
    } else {
      // 兼容旧格式：纯字符串
      val    = (entry || '').toString().trim();
      reason = '';
    }

    const validValues = g.options.map(o => o.value);
    if (val && val !== 'unknown' && !validValues.includes(val)) {
      console.warn(`  [警告] 分组 "${g.groupName}" 的值 "${val}" 不在候选列表，已替换为 unknown`);
      val = 'unknown';
    }

    tags[g.groupName]    = val || 'unknown';
    reasons[g.groupName] = reason;
  }

  return { tags, reasons };
}

// ---------------------------------------------------------------------------
// 调用 AI API（支持 openrouter / chatai，接口格式相同）
// ---------------------------------------------------------------------------
async function callAI(imageUrl, prompt, model, apiKey) {
  const body = {
    model,
    messages: [
      {
        role: 'user',
        content: [
          { type: 'text', text: prompt },
          { type: 'image_url', image_url: { url: imageUrl } },
        ],
      },
    ],
    stream: false,
  };

  const res = await fetch(API_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      ...EXTRA_HEADERS,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`${PROVIDER} HTTP ${res.status}: ${errText.slice(0, 300)}`);
  }

  const data = await res.json();
  const content = data?.choices?.[0]?.message?.content;
  if (typeof content !== 'string' || !content) {
    throw new Error('响应 content 为空，完整响应：' + JSON.stringify(data).slice(0, 300));
  }
  return content;
}

// ---------------------------------------------------------------------------
// 带指数退避的重试
// ---------------------------------------------------------------------------
async function withRetry(fn, retries = 3, baseDelay = 2000) {
  let lastErr;
  for (let i = 0; i < retries; i++) {
    try {
      return await fn();
    } catch (e) {
      lastErr = e;
      if (i < retries - 1) {
        const delay = baseDelay * Math.pow(2, i);
        console.warn(`  [重试 ${i + 1}/${retries - 1}] 等待 ${delay}ms... 错误: ${e.message}`);
        await new Promise(r => setTimeout(r, delay));
      }
    }
  }
  throw lastErr;
}

// ---------------------------------------------------------------------------
// 缓存 读/写（每行一个 JSON 对象，以 imageUrl 为 key）
// ---------------------------------------------------------------------------
function loadCache(cachePath) {
  const cache = new Map();
  if (!fs.existsSync(cachePath)) return cache;
  const lines = fs.readFileSync(cachePath, 'utf-8').split('\n').filter(l => l.trim());
  for (const line of lines) {
    try {
      const obj = JSON.parse(line);
      if (obj.imageUrl) cache.set(obj.imageUrl, obj);
    } catch {}
  }
  console.log(`[缓存] 已加载 ${cache.size} 条已完成记录`);
  return cache;
}

function appendCache(cachePath, record) {
  fs.appendFileSync(cachePath, JSON.stringify(record) + '\n', 'utf-8');
}

// ---------------------------------------------------------------------------
// 并发队列（控制最大并发数）
// ---------------------------------------------------------------------------
async function runWithConcurrency(tasks, concurrency) {
  const results = new Array(tasks.length);
  let idx = 0;

  async function worker() {
    while (idx < tasks.length) {
      const i = idx++;
      results[i] = await tasks[i]();
    }
  }

  const workers = Array.from({ length: concurrency }, worker);
  await Promise.all(workers);
  return results;
}

// ---------------------------------------------------------------------------
// 写输出 Excel（抽成独立函数，方便中断时也能调用）
// outputRows: 去重后的行（不含 yr 列，其余原始列保留）
// urlToResult: Map<url, tagRecord>
// ---------------------------------------------------------------------------
function writeOutputFile(outputRows, urlColIdx, urlToResult, groupNames, header, outputFile) {
  // 每个维度占 2 列：标签值列 + 说明列
  const tagHeaders = groupNames.flatMap(n => [n, `${n}_说明`]);
  const newHeader  = [...header, ...tagHeaders, 'ai_raw', 'error', 'latency_ms'];
  const newRows    = [newHeader];

  outputRows.forEach(row => {
    const imageUrl = (row[urlColIdx] || '').toString().trim();
    const rec      = urlToResult.get(imageUrl) || {};
    const tags     = rec.tags    || {};
    const reasons  = rec.reasons || {};
    const tagCols  = groupNames.flatMap(n => [
      tags[n]    || (rec.error ? '' : (rec.tags ? 'unknown' : '')),
      reasons[n] || '',
    ]);
    const newRow = [
      ...row,
      ...tagCols,
      rec.rawText   || '',
      rec.error     || '',
      rec.latencyMs != null ? rec.latencyMs : '',
    ];
    newRows.push(newRow);
  });

  const outWb = XLSX.utils.book_new();
  const outWs = XLSX.utils.aoa_to_sheet(newRows);
  XLSX.utils.book_append_sheet(outWb, outWs, '打标结果');
  XLSX.writeFile(outWb, outputFile);
}

// ---------------------------------------------------------------------------
// 主流程
// ---------------------------------------------------------------------------
async function main() {
  console.log('=== OTB 鞋类图片打标脚本 ===');
  console.log(`[提供商] ${PROVIDER} | 模型: ${MODEL} | 接口: ${API_URL}\n`);

  // 0. 参数校验
  if (!INPUT_FILE) {
    console.error('[错误] 请通过 --in 指定输入 Excel 文件');
    process.exit(1);
  }
  if (!CATE) {
    console.error('[错误] 请通过 --cate 指定类目名称，如：--cate "浅口单鞋"');
    process.exit(1);
  }
  console.log(`[类目] ${CATE}`);
  console.log(`[规则] ${RULES_FILE}`);
  console.log(`[缓存] ${CACHE_FILE}`);
  console.log(`[输出] ${OUTPUT_FILE}\n`);

  // 1. 读取 tag 规则文件
  if (!require('fs').existsSync(RULES_FILE)) {
    console.error(`[错误] 规则文件不存在：${RULES_FILE}`);
    process.exit(1);
  }
  const groups = parseTagFile(RULES_FILE);
  console.log(`[规则] 解析完成，共 ${groups.length} 个标签分组：`);
  for (const g of groups) {
    console.log(`  - ${g.groupName}：${g.options.length} 个候选值 [${g.options.map(o => o.value).join(' / ')}]`);
  }
  console.log('');

  // 2. 读取 Excel，按 cate_name 过滤，保留所有原始列（含 yr），按 url 去重调用 AI，但输出保留所有原始行
  const wb = XLSX.readFile(INPUT_FILE);
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1 });

  const rawHeader = rows[0];
  const allDataRows = rows.slice(1).filter(r => r && r.length > 0);

  // 找 cate_name 列
  const cateColIdx = rawHeader.indexOf('cate_name');

  // 过滤当前类目的行
  let cateRows = allDataRows;
  if (cateColIdx >= 0) {
    cateRows = allDataRows.filter(r => (r[cateColIdx] || '').toString().trim() === CATE);
  }
  console.log(`[Excel] 类目"${CATE}"共 ${cateRows.length} 行（含跨年重复）`);

  // 输出表头：保留所有原始列
  const header = [...rawHeader];

  // 图片/URL 列
  const IMG_COL_CANDIDATES = ['sku主图', 'url', 'img_url', 'image_url'];
  let imgColIdxRaw = IMG_COL_CANDIDATES.reduce((found, name) => found >= 0 ? found : rawHeader.indexOf(name), -1);
  if (imgColIdxRaw < 0) imgColIdxRaw = rawHeader.length - 1;
  const imgColName = rawHeader[imgColIdxRaw];

  // 输出行：保留所有原始行（含跨年重复），不去重
  const outputRows = cateRows.map(row => [...row]);
  const urlColInOutput = imgColIdxRaw;

  // AI 调用只对唯一 url 去重（节省 API 费用），打标结果按 url 映射回每一行
  const seenUrls = new Set();
  const uniqueUrls = [];
  for (const row of cateRows) {
    const imageUrl = (row[imgColIdxRaw] || '').toString().trim();
    if (!imageUrl || seenUrls.has(imageUrl)) continue;
    seenUrls.add(imageUrl);
    uniqueUrls.push(imageUrl);
  }

  console.log(`[去重] 唯一图片 URL ${uniqueUrls.length} 条，输出保留全部 ${outputRows.length} 行（含跨年重复）`);
  console.log(`[列] 图片列 = "${imgColName}"（原第 ${imgColIdxRaw + 1} 列）\n`);

  // 3. Dry-run 模式
  if (DRY_RUN) {
    console.log('[dry-run] 展示前 3 条图片 URL：');
    uniqueUrls.slice(0, 3).forEach((url, i) => console.log(`  [${i + 1}] ${url}`));
    console.log('\n[dry-run] Prompt 预览（前 70 行）：');
    buildPrompt(groups).split('\n').slice(0, 70).forEach(l => console.log('  ' + l));
    console.log('\n[dry-run] 完成，未调用 AI。');
    return;
  }

  // 4. 检查 API Key
  if (!API_KEY) {
    console.error('[错误] 未设置 API Key。');
    process.exit(1);
  }

  // 5. 加载缓存
  const cache = loadCache(CACHE_FILE);

  // 6. 构建任务：urlToResult 存放最终结果（key = imageUrl）
  const groupNames = groups.map(g => g.groupName);
  const urlToResult = new Map();  // imageUrl → tagRecord
  const pendingMap  = new Map();  // imageUrl → Promise（防并发重复请求）
  let hitCount = 0;

  // 缓存命中
  for (const url of uniqueUrls) {
    if (cache.has(url)) {
      urlToResult.set(url, cache.get(url));
      hitCount++;
    }
  }

  const totalUnique = uniqueUrls.length;
  console.log(`[进度] 缓存命中 ${hitCount} 条，需调用 AI ${totalUnique - hitCount} 条\n`);

  let done    = hitCount;
  let success = hitCount;
  let failed  = 0;
  const prompt = buildPrompt(groups);

  // 7. 构建并发任务（只处理未命中的 unique url）
  const pendingUrls = uniqueUrls.filter(url => !urlToResult.has(url));

  const tasks = pendingUrls.map(imageUrl => async () => {
    // 防止并发下重复请求同一 URL（理论上去重后不会出现，但保险起见）
    if (pendingMap.has(imageUrl)) {
      const rec = await pendingMap.get(imageUrl);
      urlToResult.set(imageUrl, rec);
      return;
    }

    const startAt = Date.now();
    const taskPromise = (async () => {
      try {
        const rawText           = await withRetry(() => callAI(imageUrl, prompt, MODEL, API_KEY));
        const { tags, reasons } = parseResponse(rawText, groups);
        const rec = { imageUrl, tags, reasons, rawText, error: null, latencyMs: Date.now() - startAt };
        appendCache(CACHE_FILE, rec);
        done++; success++;
        const tagStr = groupNames.map(n => `${n}:${tags[n] || 'unknown'}`).join(' | ');
        console.log(`[${done}/${totalUnique}] OK (${rec.latencyMs}ms) ${tagStr}`);
        return rec;
      } catch (e) {
        const rec = { imageUrl, tags: {}, error: e.message, latencyMs: Date.now() - startAt };
        done++; failed++;
        console.error(`[${done}/${totalUnique}] FAIL: ${e.message.slice(0, 120)}`);
        return rec;
      }
    })();

    pendingMap.set(imageUrl, taskPromise);
    const rec = await taskPromise;
    urlToResult.set(imageUrl, rec);
    pendingMap.delete(imageUrl);
  });

  // 注册中断信号处理
  let interrupted = false;
  const writeOutput = () => {
    if (interrupted) return;
    interrupted = true;
    console.log('\n[中断] 正在写出已完成的结果...');
    writeOutputFile(outputRows, urlColInOutput, urlToResult, groupNames, header, OUTPUT_FILE);
    console.log(`[中断] 已写出 ${urlToResult.size} 条结果到 ${OUTPUT_FILE}`);
    process.exit(0);
  };
  process.on('SIGINT',  writeOutput);
  process.on('SIGTERM', writeOutput);

  await runWithConcurrency(tasks, CONCURRENCY);

  process.off('SIGINT',  writeOutput);
  process.off('SIGTERM', writeOutput);

  // 8. 写输出 Excel
  writeOutputFile(outputRows, urlColInOutput, urlToResult, groupNames, header, OUTPUT_FILE);

  console.log(`\n=== 完成 ===`);
  console.log(`成功: ${success} | 失败: ${failed} | 总计: ${totalUnique}`);
  console.log(`输出文件：${OUTPUT_FILE}`);
  if (failed > 0) {
    console.log('提示：失败行未写入缓存，重新运行脚本即可自动重试失败行。');
  }
}

main().catch(e => {
  console.error('\n[致命错误]', e.message);
  process.exit(1);
});
