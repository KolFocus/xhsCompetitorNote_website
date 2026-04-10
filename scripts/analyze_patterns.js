const XLSX = require('xlsx');

async function main() {
  console.log('读取 Excel...');
  const wb = XLSX.readFile('otb_打标/20260330_001_披露_浅口单鞋_跟高x年份_TOP100_SKU.xlsx');
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const data = XLSX.utils.sheet_to_json(sheet);
  
  // 提取所有URL，去重
  const urls = [...new Set(data.map(r => r['sku主图'] || r['url']).filter(Boolean))];
  console.log(`共 ${urls.length} 个唯一图片URL。`);

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
          text: `你是一个专业的鞋类产品分析师。现在我给你提供了 ${sampleUrls.length} 张淘宝/小红书上的【浅口单鞋】的商品主图。

请你仔细观察这些图片中**鞋面的表面工艺、纹路图案或肌理特征**（即图案装饰元素）。

我们目前的系统里对“图案装饰元素”的分类只有以下几种：
1. 刺绣：以针线绣制于鞋面的图案或纹样，工艺精致
2. 镂空：鞋面通过切割、冲孔等方式形成的通透空洞设计，有明显露肤感
3. 编织：以皮条、草绳等材质交错编结形成的纹理鞋面（如皮革编织、草编）
4. 褶皱：鞋面材质经过挤压、打褶形成的立体起伏纹理（如抓褶、碎褶肌理）
5. 小香风/花呢肌理：由多色粗毛线交织形成的颗粒感杂色面料肌理
6. 波点/波浪：鞋面规则分布的圆点图案（含波点印花、植绒波点等）或波浪纹理
7. 满印/提花/老花：鞋面大面积覆盖重复的印花、提花或品牌logo图案（含大尺寸几何老花、碎花、字母老花等）
8. 动物纹：模仿动物皮毛纹理的印花或压纹（如豹纹、蛇纹、鳄鱼纹），风格野性
9. 条纹：以等距或渐变线条构成的图案，风格简约
10. 无：鞋面无特殊工艺或图案，纯色素面设计

说明：识别作用于鞋面的表面工艺或纹路图案（非单点实体附着物，通常大面积覆盖鞋面）；若无则填"无"

【你的任务】：
1. 总结这几十张浅口单鞋图片中，实际出现了哪些类型的图案、表面工艺或肌理？
2. 与我们现有的分类体系进行对比分析：
   - 我们现有的分类是否能完全涵盖这些图片中的所有情况？
   - 是否有分类边界模糊、容易混淆的地方？
   - 现实的单鞋中，是否有“格纹”、“拼色几何”、“压花（非动物纹的普通几何压花）”、“水钻满烫（满天星）”、“渐变色晕染（如果作为图案）”、“蕾丝花纹”等不在现有分类中的常见款？
3. 基于你的观察，给出对目前【图案装饰元素】分类的**改进建议或新增分类建议**。

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