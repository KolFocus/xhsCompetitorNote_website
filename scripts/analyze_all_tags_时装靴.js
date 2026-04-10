'use strict';

/**
 * 时尚休闲鞋 全标签视觉抽样分析脚本
 *
 * - 读取 Excel 的 `url` 列（图片主图）
 * - 从 tag_时尚休闲鞋.txt 动态读取标签定义
 * - 每批 50 张，并发 3，分批发给 AI 分析
 * - 最后汇总输出 Markdown 报告
 *
 * 用法：
 *   node scripts/analyze_all_tags_时尚休闲鞋.js
 */

const XLSX    = require('xlsx');
const fs      = require('fs');
const path    = require('path');

const API_KEY     = process.env.OPENROUTER_API_KEY || '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';
const BATCH_SIZE  = 50;
const CONCURRENCY = 3;
const MODEL       = 'google/gemini-2.5-flash';

const EXCEL_PATH  = 'otb_打标/20260409_001_类目价格带_24_25_TOP_SKU_主图列表_+披露.xlsx';
const TAG_PATH    = 'otb_打标/tag_时装靴.txt';
const OUTPUT_PATH = 'otb_打标/analyze_all_tags_时装靴_report.md';
const TMP_DIR     = 'otb_打标/tmp_batch_reports_时装靴';
const URL_COLUMN  = 'url';
const CATEGORY    = '时装靴';

// ---------------------------------------------------------------------------
// 解析 tag_时尚休闲鞋.txt → 生成 TAG_DEFINITIONS 字符串
// ---------------------------------------------------------------------------
function parseTagFile(filePath) {
  const raw = fs.readFileSync(filePath, 'utf-8');
  const lines = raw.split('\n').map(l => l.trimEnd());

  const groups = [];
  let current = null;

  for (const line of lines) {
    if (!line.trim()) continue;

    const parts = line.split('\t');
    if (parts.length < 2) continue;

    const [key, value] = parts;

    if (key === '[说明]') {
      if (current) current.description = value;
      continue;
    }

    // 如果 key === value，说明是新分组标题
    if (key === value) {
      current = { name: key, description: '', options: [] };
      groups.push(current);
    } else {
      if (current) current.options.push({ label: key, desc: value });
    }
  }

  return groups
    .map((g, i) => {
      const optionList = g.options.map(o => o.label).join('、');
      const optionDetails = g.options.map(o => `  - ${o.label}：${o.desc}`).join('\n');
      return `【${i + 1}. ${g.name}】\n现有选项：${optionList}\n说明：${g.description}\n选项说明：\n${optionDetails}`;
    })
    .join('\n\n');
}

// ---------------------------------------------------------------------------
// Prompt 构建
// ---------------------------------------------------------------------------
function buildBatchPrompt(tagDefs, batchIndex, total, batchSize) {
  return `你是一个专业的鞋类产品分析师。以下是第 ${batchIndex + 1} 批共 ${batchSize} 张【${CATEGORY}】商品主图（全量共 ${total} 张，分批处理）。

请针对以下 ${tagDefs.split(/^【/m).length - 1} 个标签类型，逐一分析这批图片中的实际情况。

${tagDefs}

---

请严格按以下格式输出，每个标签一节，不要省略任何标签：

（每节格式）
### T0X 标签名
- 出现款式/颜色/材质及估算数量：（如"板鞋×15、运动鞋×20、休闲鞋×10、其他×5"）
- 未覆盖/难归类情况：（如有，描述具体特征；无则写"无"）
- 边界模糊案例：（如有，举例；无则写"无"）`;
}

function buildSummaryPrompt(tagDefs, batchReports, totalImages) {
  const reportsText = batchReports
    .map((r, i) => `=== 批次 ${i + 1} ===\n${r}`)
    .join('\n\n');

  const tagCount = tagDefs.split(/^【/m).length - 1;

  return `你是一个专业的鞋类产品分析师。以下是对 ${totalImages} 张【${CATEGORY}】商品主图分 ${batchReports.length} 批进行视觉分析后得到的原始报告。

请将这 ${batchReports.length} 批报告汇总整合，对 ${tagCount} 个标签类型分别给出最终综合分析报告。

${reportsText}

---

请严格按以下格式输出最终报告（每个标签一节）：

## T0X 标签名
**汇总分布：** （合并各批数据，给出整体比例估算）
**覆盖度评估：** （现有分类是否完整）
**主要边界模糊点：** （归纳各批中反复出现的混淆问题）
**改进建议：** （具体可操作的建议；无则写"暂无建议"）

最后，请在报告末尾增加一节：
## 综合优先级建议
列出最需要修改的 TOP3 标签及具体修改方案。`;
}

// ---------------------------------------------------------------------------
// API 调用
// ---------------------------------------------------------------------------
async function callAPI(messages, label) {
  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${API_KEY}`,
      'HTTP-Referer': 'https://xhs-competitor-note.com',
      'X-Title': 'OTB Analyzer'
    },
    body: JSON.stringify({ model: MODEL, messages, temperature: 0.2 })
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`[${label}] API Error ${response.status}: ${err}`);
  }

  const result = await response.json();
  return result.choices[0].message.content;
}

// ---------------------------------------------------------------------------
// 并发控制
// ---------------------------------------------------------------------------
async function runWithConcurrency(tasks, concurrency) {
  const results = new Array(tasks.length);
  let index = 0;

  async function worker() {
    while (index < tasks.length) {
      const i = index++;
      results[i] = await tasks[i]();
    }
  }

  await Promise.all(Array.from({ length: concurrency }, worker));
  return results;
}

// ---------------------------------------------------------------------------
// 主流程
// ---------------------------------------------------------------------------
async function main() {
  // 读取标签定义
  console.log(`读取标签文件：${TAG_PATH}`);
  const tagDefs = parseTagFile(TAG_PATH);
  const tagCount = tagDefs.split(/^【/m).length - 1;
  console.log(`共解析到 ${tagCount} 个标签分组。\n`);

  // 读取 Excel
  console.log(`读取 Excel：${EXCEL_PATH}`);
  const wb   = XLSX.readFile(EXCEL_PATH);
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const data  = XLSX.utils.sheet_to_json(sheet);

  // 尝试过滤出“时尚休闲鞋”类目的数据（适配可能的列名）
  const filteredData = data.filter(r => {
    const cat = r['cate_name'] || r['叶子类目'] || r['类目'] || r['商品类目'] || r['category'];
    // 如果找不到类目列，默认全量跑；如果找到了，只跑时尚休闲鞋
    return !cat || cat === CATEGORY || cat.includes(CATEGORY);
  });

  const urls = [...new Set(filteredData.map(r => r[URL_COLUMN]).filter(Boolean))];
  console.log(`共 ${urls.length} 个唯一图片 URL。`);

  // 分批
  const batches = [];
  for (let i = 0; i < urls.length; i += BATCH_SIZE) {
    batches.push(urls.slice(i, i + BATCH_SIZE));
  }
  console.log(`分为 ${batches.length} 批，每批最多 ${BATCH_SIZE} 张，并发数 ${CONCURRENCY}。\n`);

  if (!fs.existsSync(TMP_DIR)) fs.mkdirSync(TMP_DIR, { recursive: true });

  // 分批分析
  const tasks = batches.map((batchUrls, i) => async () => {
    const label = `批次${i + 1}/${batches.length}`;
    console.log(`[${label}] 开始，共 ${batchUrls.length} 张图片...`);

    const prompt   = buildBatchPrompt(tagDefs, i, urls.length, batchUrls.length);
    const messages = [{
      role: 'user',
      content: [
        { type: 'text', text: prompt },
        ...batchUrls.map(url => ({ type: 'image_url', image_url: { url } }))
      ]
    }];

    try {
      const report  = await callAPI(messages, label);
      console.log(`[${label}] ✅ 完成`);

      const tmpPath = path.join(TMP_DIR, `batch_${String(i + 1).padStart(2, '0')}.md`);
      fs.writeFileSync(tmpPath, `# 批次 ${i + 1}（图片 ${i * BATCH_SIZE + 1}–${i * BATCH_SIZE + batchUrls.length}）\n\n${report}`, 'utf-8');

      return report;
    } catch (err) {
      console.error(`[${label}] ⚠️ 跳过，错误：${err.message}`);
      return null;
    }
  });

  const allResults   = await runWithConcurrency(tasks, CONCURRENCY);
  const batchReports = allResults.filter(Boolean);
  const skipped      = allResults.length - batchReports.length;
  if (skipped > 0) console.log(`⚠️ 共 ${skipped} 批因错误被跳过。`);

  console.log(`\n${batchReports.length} 批分析完成，开始汇总...\n`);

  // 汇总
  const summaryPrompt    = buildSummaryPrompt(tagDefs, batchReports, urls.length);
  const summaryMessages  = [{ role: 'user', content: summaryPrompt }];
  const finalReport      = await callAPI(summaryMessages, '汇总');

  // 写入最终报告
  const header = `# ${CATEGORY} 全标签视觉抽样分析报告

生成时间：${new Date().toLocaleString('zh-CN')}
图片总量：${urls.length} 张
批次数量：${batches.length} 批（每批 ${BATCH_SIZE} 张）
数据来源：${path.basename(EXCEL_PATH)}
标签定义：${path.basename(TAG_PATH)}

---

`;
  fs.writeFileSync(OUTPUT_PATH, header + finalReport, 'utf-8');

  console.log('\n================ 最终汇总报告 ================');
  console.log(finalReport);
  console.log(`\n✅ 最终报告已保存至 ${OUTPUT_PATH}`);
  console.log(`✅ 各批次中间报告保存在 ${TMP_DIR}/`);
}

main().catch(console.error);
