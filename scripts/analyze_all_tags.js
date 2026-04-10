const XLSX = require('xlsx');
const fs = require('fs');

const API_KEY = process.env.OPENROUTER_API_KEY || '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';
const BATCH_SIZE = 50;
const CONCURRENCY = 3;
const MODEL = 'google/gemini-2.5-flash';

// ─── 14 个标签类型的完整描述 ──────────────────────────────────────────────────
const TAG_DEFINITIONS = `
【1. 鞋子类型】
现有选项：板鞋、老爹鞋、帆布鞋、德训鞋、玛丽珍鞋、芭蕾舞鞋、乐福鞋、穆勒鞋、高跟鞋、平底鞋、切尔西靴、马丁靴、骑士靴、袜靴、西部靴、工装靴、运动鞋、休闲鞋
说明：优先参考标题中的品类词，命中则直接选；未命中时按视觉判断：有前带/搭扣→玛丽珍鞋；鞋头圆润宽矮仿芭蕾软鞋造型→芭蕾舞鞋（不限跟高）；无后帮全开放→穆勒鞋；鞋面平整无系带一脚蹬→乐福鞋；板鞋/帆布鞋/老爹鞋/德训鞋等运动鞋型→对应细分类；及踝以上靴型→对应靴类；跟≥5cm无特定造型→高跟鞋；跟＜2cm无特定造型→平底鞋；其余→休闲鞋

【2. 装饰物】
现有选项：无、蝴蝶结、水晶钻饰、珍珠、金属扣饰、品牌logo、花卉、金属链条、皮带扣、踝部绑带
说明：识别鞋面最显眼的一个核心装饰物（实体可见、有明确附着点）；若无明显实体装饰物则填"无"

【3. 装饰位置】
现有选项：无、鞋头、鞋侧、鞋跟、脚背/绑带、全鞋
说明：标注上方"装饰物"所附着的主要位置；若装饰物为"无"则填"无"；若在脚背的带子上则选"脚背/绑带"

【4. 图案装饰元素】
现有选项：无、刺绣、镂空、编织、褶皱、小香风/花呢肌理、波点/波浪、满印/提花/老花、动物纹、条纹
说明：识别作用于鞋面的表面工艺或纹路图案（非单点实体附着物，通常大面积覆盖鞋面）；若无则填"无"

【5. 颜色】
现有选项：黑色、白色、灰色、红色、粉色、橙色、棕色、裸色、蓝色、紫色、绿色、金属色
说明：填视觉面积占比最大的颜色，选最接近的宽泛色系；若鞋面材质为闪粉且视觉偏银色/金属光泽，则填"金属色"

【6. 颜色类型】
现有选项：单色、撞色、相近色、渐变、多色
说明：判断整体配色方案；若老花/满印/细小点缀与主色的边缘/绑带颜色相近（如黑+深棕），视为同一种修饰色，不重复计数

【7. 鞋面材质】
现有选项：网布、皮革、合成革、帆布、麂皮、针织、漆皮、缎面、丝绒、蕾丝、网纱、PVC、毛呢、闪粉
说明：优先以商品标题中明确的材质关键词为准；标题未提及时，依据图片纹理、光泽、质感判断；皮革类统一选"皮革"或"合成革"，不区分牛皮/羊皮等细分皮种

【8. 鞋头形状】
现有选项：圆头、方头、尖头、分趾、漏趾
说明：若鞋头有开口（漏趾）或大拇趾独立分割（分趾），优先选结构特征；否则依据鞋头轮廓的方正/圆润/收窄程度判断

【9. 闭合方式】
现有选项：系带、魔术贴、一脚蹬、拉链、搭扣、后绊带、弹性侧边、绑带
说明：选最主要的闭合结构；若有多种方式并存（如拉链+搭扣），拉链/系带优先级最高；若后绊带/搭扣是唯一的固定结构，则直接选它们；切尔西靴选"弹性侧边"；无任何固定结构直接套入选"一脚蹬"

【10. 鞋面绑带款式】
现有选项：无绑带、一字带、双绑带、交叉绑带、T字带
说明：观察脚背区域可见的带状结构数量与形态；无论功能性还是装饰性，只要视觉可见均计入

【11. 鞋跟款式（仅单鞋）】
现有选项：无跟、细跟、酒杯跟/小猫跟、粗跟、坡跟、方跟、锥形跟
说明：非靴类鞋履必填，靴类填unknown；关注鞋跟本身的形态与截面；前后掌等高无独立跟柱选"无跟"

【12. 鞋跟高度（仅单鞋）】
现有选项：平底（0-1cm）、低跟（1-4cm）、中跟（4-7cm）、高跟（7-10cm）、超高跟（>10cm）
说明：非靴类鞋履必填，靴类填unknown；优先参考商品标题中的数值；若无数值，通过跟高与后跟鞋帮的比例以及脚背倾斜度估算

【13. 鞋底厚薄】
现有选项：薄底（前掌<2cm）、普通底（前掌2-3cm）、厚底（前掌>3cm）
说明：仅观察前脚掌着地处的鞋底厚度，完全排除后跟高度的干扰

【14. 靴筒高度（仅靴类）】
现有选项：踝靴（<15cm）、中筒靴（15-30cm）、及膝靴（30-40cm）、过膝靴（>40cm）
说明：仅靴类鞋履填写，单鞋填unknown；估算靴筒从脚踝到顶端的高度
`;

// ─── 单批次 prompt ────────────────────────────────────────────────────────────
function buildBatchPrompt(batchIndex, total, batchSize) {
  return `你是一个专业的鞋类产品分析师。以下是第 ${batchIndex + 1} 批共 ${batchSize} 张【浅口单鞋】商品主图（全量共 ${total} 张，分批处理）。

请针对以下 14 个标签类型，逐一分析这批图片中的实际情况。

${TAG_DEFINITIONS}

---

请严格按以下格式输出，每个标签一节，不要省略任何标签：

### T01 鞋子类型
- 出现款式及估算数量：（如"高跟鞋×20、玛丽珍鞋×12、乐福鞋×8、其他×10"）
- 未覆盖/难归类情况：（如有，描述具体款式特征；无则写"无"）
- 边界模糊案例：（如有，举例；无则写"无"）

### T02 装饰物
- 出现类型及估算数量：
- 未覆盖/难归类情况：
- 边界模糊案例：

### T03 装饰位置
- 出现位置及估算数量：
- 未覆盖/难归类情况：
- 边界模糊案例：

### T04 图案装饰元素
- 出现类型及估算数量：
- 未覆盖/难归类情况：
- 边界模糊案例：

### T05 颜色
- 出现颜色及估算数量：
- 未覆盖/难归类情况：
- 边界模糊案例：

### T06 颜色类型
- 出现类型及估算数量：
- 未覆盖/难归类情况：
- 边界模糊案例：

### T07 鞋面材质
- 出现材质及估算数量：
- 未覆盖/难归类情况：
- 边界模糊案例：

### T08 鞋头形状
- 出现形状及估算数量：
- 未覆盖/难归类情况：
- 边界模糊案例：

### T09 闭合方式
- 出现方式及估算数量：
- 未覆盖/难归类情况：
- 边界模糊案例：

### T10 鞋面绑带款式
- 出现款式及估算数量：
- 未覆盖/难归类情况：
- 边界模糊案例：

### T11 鞋跟款式（仅单鞋）
- 出现款式及估算数量：
- 未覆盖/难归类情况：
- 边界模糊案例：

### T12 鞋跟高度（仅单鞋）
- 出现高度及估算数量：
- 未覆盖/难归类情况：
- 边界模糊案例：

### T13 鞋底厚薄
- 出现类型及估算数量：
- 未覆盖/难归类情况：
- 边界模糊案例：

### T14 靴筒高度（仅靴类）
- 出现类型及估算数量：
- 未覆盖/难归类情况：
- 边界模糊案例：`;
}

// ─── 汇总 prompt ──────────────────────────────────────────────────────────────
function buildSummaryPrompt(batchReports, totalImages) {
  const reportsText = batchReports
    .map((r, i) => `=== 批次 ${i + 1} ===\n${r}`)
    .join('\n\n');

  return `你是一个专业的鞋类产品分析师。以下是对 ${totalImages} 张【浅口单鞋】商品主图分 ${batchReports.length} 批进行视觉分析后得到的原始报告。

请将这 ${batchReports.length} 批报告汇总整合，对 14 个标签类型分别给出最终综合分析报告。

${reportsText}

---

请严格按以下格式输出最终报告（每个标签一节）：

## T01 鞋子类型
**汇总分布：** （合并各批数据，给出整体比例估算）
**覆盖度评估：** （现有分类是否完整）
**主要边界模糊点：** （归纳各批中反复出现的混淆问题）
**改进建议：** （具体可操作的建议；无则写"暂无建议"）

（以下各标签同样按此格式输出）
## T02 装饰物
## T03 装饰位置
## T04 图案装饰元素
## T05 颜色
## T06 颜色类型
## T07 鞋面材质
## T08 鞋头形状
## T09 闭合方式
## T10 鞋面绑带款式
## T11 鞋跟款式（仅单鞋）
## T12 鞋跟高度（仅单鞋）
## T13 鞋底厚薄
## T14 靴筒高度（仅靴类）

最后，请在报告末尾增加一节：
## 综合优先级建议
列出最需要修改的 TOP5 标签及具体修改方案。`;
}

// ─── 调用 API ─────────────────────────────────────────────────────────────────
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

// ─── 并发控制：每次最多 CONCURRENCY 个并发 ───────────────────────────────────
async function runWithConcurrency(tasks, concurrency) {
  const results = new Array(tasks.length);
  let index = 0;

  async function worker() {
    while (index < tasks.length) {
      const i = index++;
      results[i] = await tasks[i]();
    }
  }

  const workers = Array.from({ length: concurrency }, worker);
  await Promise.all(workers);
  return results;
}

// ─── 主流程 ───────────────────────────────────────────────────────────────────
async function main() {
  console.log('读取 Excel...');
  const wb = XLSX.readFile('otb_打标/20260330_001_披露_浅口单鞋_跟高x年份_TOP100_SKU.xlsx');
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const data = XLSX.utils.sheet_to_json(sheet);

  const urls = [...new Set(data.map(r => r['sku主图'] || r['url']).filter(Boolean))];
  console.log(`共 ${urls.length} 个唯一图片 URL。`);

  // 分批
  const batches = [];
  for (let i = 0; i < urls.length; i += BATCH_SIZE) {
    batches.push(urls.slice(i, i + BATCH_SIZE));
  }
  console.log(`分为 ${batches.length} 批，每批最多 ${BATCH_SIZE} 张，并发数 ${CONCURRENCY}。\n`);

  const batchReports = [];
  const tmpDir = 'otb_打标/tmp_batch_reports';
  if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });

  // 构建所有批次任务
  const tasks = batches.map((batchUrls, i) => async () => {
    const label = `批次${i + 1}/${batches.length}`;
    console.log(`[${label}] 开始，共 ${batchUrls.length} 张图片...`);

    const prompt = buildBatchPrompt(i, urls.length, batchUrls.length);
    const messages = [
      {
        role: 'user',
        content: [
          { type: 'text', text: prompt },
          ...batchUrls.map(url => ({ type: 'image_url', image_url: { url } }))
        ]
      }
    ];

    const report = await callAPI(messages, label);
    console.log(`[${label}] ✅ 完成`);

    // 保存中间结果
    const tmpPath = `${tmpDir}/batch_${String(i + 1).padStart(2, '0')}.md`;
    fs.writeFileSync(tmpPath, `# 批次 ${i + 1}（图片 ${i * BATCH_SIZE + 1}–${i * BATCH_SIZE + batchUrls.length}）\n\n${report}`, 'utf-8');

    return report;
  });

  // 并发执行
  const results = await runWithConcurrency(tasks, CONCURRENCY);
  batchReports.push(...results);

  console.log(`\n所有 ${batches.length} 批分析完成，开始汇总...\n`);

  // 汇总请求
  const summaryPrompt = buildSummaryPrompt(batchReports, urls.length);
  const summaryMessages = [{ role: 'user', content: summaryPrompt }];
  const finalReport = await callAPI(summaryMessages, '汇总');

  // 保存最终报告
  const outputPath = 'otb_打标/analyze_all_tags_report.md';
  const header = `# 全标签类型视觉抽样分析报告（全量汇总版）

生成时间：${new Date().toLocaleString('zh-CN')}
图片总量：${urls.length} 张
批次数量：${batches.length} 批（每批 ${BATCH_SIZE} 张）
数据来源：20260330_001_披露_浅口单鞋_跟高x年份_TOP100_SKU.xlsx

---

`;
  fs.writeFileSync(outputPath, header + finalReport, 'utf-8');

  console.log('\n================ 最终汇总报告 ================');
  console.log(finalReport);
  console.log(`\n✅ 最终报告已保存至 ${outputPath}`);
  console.log(`✅ 各批次中间报告保存在 ${tmpDir}/`);
}

main().catch(console.error);
