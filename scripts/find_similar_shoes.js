'use strict';

/**
 * 鞋靴竞品同款/同模具视觉匹配脚本
 *
 * 核心目标：在 961 个热销 SKU 中，寻找与指定“参考图”骨架/模具极其相似的竞品。
 * 强制要求 AI 忽略颜色、材质、表面软装，只关注：
 * 1. 鞋底模具（几何钻石切割厚底）- 权重 60%
 * 2. 鞋身骨架（流线型复古跑鞋拼接结构）- 权重 30%
 * 3. 鞋面细节（鞋口/鞋带/鞋舌排布）- 权重 10%
 *
 * 用法：
 *   node scripts/find_similar_shoes.js
 */

const XLSX = require('xlsx');
const fs   = require('fs');
const path = require('path');

// --- 配置区 ---
const API_KEY     = process.env.OPENROUTER_API_KEY || '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';
const API_URL     = 'https://openrouter.ai/api/v1/chat/completions';
const MODEL       = 'google/gemini-2.5-flash';
const CONCURRENCY = 3;

// 参考图 URL
const REFERENCE_IMAGE_URL = 'https://cod-resource.oss-cn-shanghai.aliyuncs.com/ai/d4695866c45d58a9ef43b80e9f8665fb.png';

// 输入与输出
const INPUT_FILE  = 'otb_打标/output_tagged_时尚休闲鞋.xlsx'; // 用刚打完标的文件
const OUTPUT_FILE = 'otb_打标/similar_shoes_report.xlsx';
const CACHE_FILE  = 'otb_打标/.cache_similar_shoes.jsonl';

// --- Prompt 构建 ---
const SYSTEM_PROMPT = `
你是一个专业的鞋履开发设计师和开模工程师。
你的任务是对比【目标商品图】与我给你的【参考图片】，判断两者的“开模版型/骨架结构”是否相似。

【极其重要的前提（必须严格遵守）】：
绝对、完全忽略颜色（Color）、材质（Material，如漆皮/网布/金属织物）、图案和表面小装饰（Logo/挂饰）。
你只看“骨头（Shape/Silhouette/Mold）”，不看“皮（Skin/Surface）”。

【你要寻找的核心特征（基于参考图）】：
1. 鞋底模具（Sole Mold）：这是最核心的！参考图的鞋底非常厚，中底侧面有极其明显的「立体几何切割面/钻石切面/菱格切面」，并且前后脚掌底部连贯呈波浪形。
2. 鞋身骨架（Body Silhouette）：低帮领口，后跟有提拉环，整体线条流畅，鞋头微微上翘，属于典型的复古跑鞋/流线型运动休闲鞋廓形。
3. 拼接结构（Overlay Structure）：大面积基础层外，有一圈U型/流线型的包边（覆盖鞋头、鞋带孔、后跟）。

请按以下三个维度分别打分（0-10分，必须是整数），并给出简短理由（15字以内）：
- sole_score: 鞋底几何切割模具相似度（0=完全不同，10=近乎同模具的立体几何厚底）
- body_score: 鞋身流线与拼接骨架相似度（0=完全不同，10=廓形和包边走向高度一致）
- detail_score: 鞋带系统与鞋舌细节相似度（0=完全不同，10=排布方式一致）

输出要求：
只输出一个合法的 JSON 对象，不要任何 Markdown 标记（不要 \`\`\`json ），必须包含以下字段：
{
  "sole_score": 8,
  "sole_reason": "底部有明显的几何切面",
  "body_score": 9,
  "body_reason": "复古跑鞋拼接结构极度相似",
  "detail_score": 10,
  "detail_reason": "鞋带和鞋舌结构一致",
  "remark": "虽然颜色不同，但开模版型极度相似，属于高仿/同款" // 如发现重大结构差异（如它是高帮的），写在这里
}
`;

// --- 工具函数 ---
async function callAI(targetImageUrl) {
  const body = {
    model: MODEL,
    messages: [
      {
        role: 'system',
        content: SYSTEM_PROMPT
      },
      {
        role: 'user',
        content: [
          { type: 'text', text: '【参考图片】（以此为基准找同款版型）：' },
          { type: 'image_url', image_url: { url: REFERENCE_IMAGE_URL } },
          { type: 'text', text: '【目标商品图】（评估这双鞋）：' },
          { type: 'image_url', image_url: { url: targetImageUrl } }
        ]
      }
    ],
    temperature: 0.1 // 降低随机性
  };

  const res = await fetch(API_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${API_KEY}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://xhs-competitor-note.com',
      'X-Title': 'Shoe Matcher'
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`API 报错 ${res.status}: ${errText.slice(0, 200)}`);
  }

  const data = await res.json();
  let content = data?.choices?.[0]?.message?.content || '';
  
  // 清理可能带的 Markdown 标记
  content = content.replace(/^```json\s*/i, '').replace(/\s*```$/, '').trim();
  
  try {
    return JSON.parse(content);
  } catch (e) {
    throw new Error('解析 JSON 失败: ' + content.slice(0, 100));
  }
}

async function withRetry(fn, retries = 3) {
  let lastErr;
  for (let i = 0; i < retries; i++) {
    try {
      return await fn();
    } catch (e) {
      lastErr = e;
      if (i < retries - 1) await new Promise(r => setTimeout(r, 2000 * Math.pow(2, i)));
    }
  }
  throw lastErr;
}

function loadCache() {
  const cache = new Map();
  if (fs.existsSync(CACHE_FILE)) {
    const lines = fs.readFileSync(CACHE_FILE, 'utf-8').split('\\n').filter(l => l.trim());
    for (const line of lines) {
      try {
        const obj = JSON.parse(line);
        if (obj.url) cache.set(obj.url, obj);
      } catch {}
    }
  }
  return cache;
}

function appendCache(record) {
  fs.appendFileSync(CACHE_FILE, JSON.stringify(record) + '\\n', 'utf-8');
}

// --- 主流程 ---
async function main() {
  console.log('=== 竞品同模具匹配脚本 ===');
  console.log(`参考图: ${REFERENCE_IMAGE_URL}`);
  
  // 1. 读取带标签的 Excel
  const wb = XLSX.readFile(INPUT_FILE);
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1 });
  
  const header = rows[0];
  const dataRows = rows.slice(1).filter(r => r && r.length > 0);
  
  // 找 url 列 (假设第5列，稳妥起见动态找)
  let urlIdx = header.indexOf('url');
  if (urlIdx < 0) urlIdx = 4;

  const cache = loadCache();
  console.log(`读取 Excel 成功，共 ${dataRows.length} 条数据，已缓存 ${cache.size} 条。`);

  const results = new Array(dataRows.length).fill(null);
  let hitCache = 0;

  // 填入缓存
  dataRows.forEach((r, i) => {
    const url = r[urlIdx];
    if (url && cache.has(url)) {
      results[i] = cache.get(url);
      hitCache++;
    }
  });

  const pendingIndexes = dataRows.map((_, i) => i).filter(i => results[i] === null);
  let done = hitCache;
  let success = 0;
  let failed = 0;

  console.log(`待处理: ${pendingIndexes.length} 条 (并发 ${CONCURRENCY})\\n`);

  // 并发任务队列
  const tasks = pendingIndexes.map(i => async () => {
    const row = dataRows[i];
    const url = row[urlIdx];
    
    if (!url) {
      results[i] = { url: '', error: 'URL为空' };
      return;
    }

    try {
      const start = Date.now();
      const aiData = await withRetry(() => callAI(url));
      
      // 计算加权总分 (60% + 30% + 10%)
      const sole = Number(aiData.sole_score) || 0;
      const body = Number(aiData.body_score) || 0;
      const detail = Number(aiData.detail_score) || 0;
      const totalScore = parseFloat(((sole * 0.6) + (body * 0.3) + (detail * 0.1)).toFixed(2));
      
      // 判断是否高度相似候选项 (总分>7.5 或 鞋底模具>8)
      const isCandidate = totalScore >= 7.5 || sole >= 8;

      const record = {
        url,
        sole_score: sole,
        sole_reason: aiData.sole_reason || '',
        body_score: body,
        body_reason: aiData.body_reason || '',
        detail_score: detail,
        detail_reason: aiData.detail_reason || '',
        remark: aiData.remark || '',
        total_score: totalScore,
        is_candidate: isCandidate,
        latency: Date.now() - start
      };

      results[i] = record;
      appendCache(record);
      done++;
      success++;
      console.log(`[${done}/${dataRows.length}] 行${i+2} OK | 总分:${totalScore} (底:${sole} 身:${body}) | ${isCandidate ? '🔥高匹配' : '不匹配'}`);
    } catch (e) {
      done++;
      failed++;
      results[i] = { url, error: e.message };
      console.log(`[${done}/${dataRows.length}] 行${i+2} FAIL: ${e.message}`);
    }
  });

  // 执行并发
  const workers = Array.from({ length: CONCURRENCY }, async () => {
    let task;
    while ((task = tasks.shift())) await task();
  });
  await Promise.all(workers);

  // --- 导出新 Excel ---
  console.log('\\n处理完成，开始生成 Excel...');
  
  const newHeader = [
    ...header,
    '是否高度相似候选项',
    '总匹配度(加权)',
    '鞋底模具分(60%)',
    '鞋底评分理由',
    '鞋身骨架分(30%)',
    '鞋身评分理由',
    '细节结构分(10%)',
    '细节评分理由',
    'AI备注/差异点',
    'Error'
  ];

  const outRows = [newHeader];
  
  dataRows.forEach((row, i) => {
    const r = results[i] || {};
    outRows.push([
      ...row,
      r.is_candidate ? 'TRUE' : 'FALSE',
      r.total_score != null ? r.total_score : '',
      r.sole_score != null ? r.sole_score : '',
      r.sole_reason || '',
      r.body_score != null ? r.body_score : '',
      r.body_reason || '',
      r.detail_score != null ? r.detail_score : '',
      r.detail_reason || '',
      r.remark || '',
      r.error || ''
    ]);
  });

  // 不排序，直接按原表顺序输出
  const finalOutRows = [newHeader, ...outRows.slice(1)];

  const outWb = XLSX.utils.book_new();
  const outWs = XLSX.utils.aoa_to_sheet(finalOutRows);
  XLSX.utils.book_append_sheet(outWb, outWs, '竞品匹配雷达');
  XLSX.writeFile(outWb, OUTPUT_FILE);

  console.log(`成功: ${success} | 失败: ${failed} | 缓存命中: ${hitCache}`);
  console.log(`结果已保存至: ${OUTPUT_FILE} (已按总匹配度降序排列)`);
}

main().catch(console.error);
