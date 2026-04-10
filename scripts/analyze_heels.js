const XLSX = require('xlsx');

async function main() {
  console.log('读取 Excel...');
  const wb = XLSX.readFile('otb_打标/20260330_001_披露_浅口单鞋_跟高x年份_TOP100_SKU.xlsx');
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const data = XLSX.utils.sheet_to_json(sheet);
  
  // 找出高跟鞋
  const highHeels = data.filter(r => 
    (r['鞋跟高度'] && r['鞋跟高度'].includes('高跟')) || 
    (r['商品名称'] && r['商品名称'].includes('高跟'))
  );
  
  // 提取URL，去重
  const urls = [...new Set(highHeels.map(r => r['sku主图'] || r['url']).filter(Boolean))];
  console.log(`找到 ${highHeels.length} 条高跟鞋记录，共 ${urls.length} 个唯一图片URL。`);

  // 取前50个进行抽样分析（避免图片过多导致API报错）
  const sampleUrls = urls.slice(0, 50);
  console.log(`抽样其中 ${sampleUrls.length} 张图片交由大模型进行视觉总结分析...`);

  // 准备发送给 API 的图片和文本
  const messages = [
    {
      role: 'user',
      content: [
        {
          type: 'text',
          text: `你是一个专业的鞋类产品分析师。现在我给你提供了 ${sampleUrls.length} 张淘宝/小红书上的【高跟鞋】（浅口单鞋）的商品主图。

请你仔细观察这些图片中**鞋跟的形状与结构**。

我们目前的系统里对“鞋跟款式”的分类只有以下几种：
1. 细跟（跟径细长直立，常见于高细跟/针跟）
2. 酒杯跟/小猫跟（鞋跟中间明显收细、底端微张，呈复古沙漏或酒杯状）
3. 粗跟（跟部宽大，稳重舒适）
4. 坡跟（鞋底前低后高整体倾斜，无独立跟柱）
5. 方跟（截面为方形的直立跟柱）
6. 锥形跟（上细下粗的锥状跟柱）

【你的任务】：
1. 总结这几十张高跟鞋图片中，实际出现了哪些类型的鞋跟？
2. 与我们现有的分类体系进行对比分析：
   - 我们现有的分类是否能完全涵盖这些图片中的所有鞋跟类型？
   - 是否有分类边界模糊、容易混淆的地方？
   - 现实的高跟鞋中，是否有“异形跟”、“异材质拼接跟”、“防水台高跟里的粗跟/细跟”、“马蹄跟”等不在现有分类中的常见款？
3. 基于你的观察，给出对 @otb_打标/tag.txt 中【鞋跟款式】分类的**改进建议或新增分类建议**（如果有的话）。

请给出详尽且具有洞察力的分析报告。`
        },
        ...sampleUrls.map(url => ({
          type: 'image_url',
          image_url: { url }
        }))
      ]
    }
  ];

  // 调用 OpenRouter API
  const API_KEY = process.env.OPENROUTER_API_KEY || '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';
  
  console.log('正在调用 OpenRouter API (google/gemini-2.5-flash)... 这需要大约半分钟到一分钟时间。');
  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${API_KEY}`,
      'HTTP-Referer': 'https://xhs-competitor-note.com',
      'X-Title': 'OTB Analyzer'
    },
    body: JSON.stringify({
      model: 'google/gemini-2.5-flash',
      messages: messages,
      temperature: 0.2
    })
  });

  if (!response.ok) {
    const err = await response.text();
    console.error('API Error:', response.status, err);
    return;
  }

  const result = await response.json();
  console.log('\n================ 分析报告 ================');
  console.log(result.choices[0].message.content);
  console.log('==========================================\n');
}

main().catch(console.error);