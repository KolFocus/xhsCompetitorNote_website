#!/usr/bin/env node

/**
 * 从测试数据文件导入数据到数据库
 * 按照从上到下的顺序，每次读取一个接口返回的数据并调用API
 */

const fs = require('fs');
const path = require('path');

// 配置文件路径
const TEST_DATA_FILE = path.join(__dirname, '..', '.项目文档', '04_测试文档', '06_测试数据.md');
const API_URL = 'http://localhost:3002/api/data/init-test-data';

// 判断JSON对象是列表响应还是详情响应
function isListResponse(obj) {
  return obj?.Data?.ItemList !== undefined;
}

function isDetailResponse(obj) {
  return obj?.Data?.NoteId !== undefined && obj?.Data?.Content !== undefined;
}

// 解析文件中的JSON对象
function parseJsonObjects(content) {
  const objects = [];
  let currentJson = '';
  let braceCount = 0;
  let inString = false;
  let escapeNext = false;

  for (let i = 0; i < content.length; i++) {
    const char = content[i];
    
    if (escapeNext) {
      escapeNext = false;
      currentJson += char;
      continue;
    }

    if (char === '\\') {
      escapeNext = true;
      currentJson += char;
      continue;
    }

    if (char === '"' && !escapeNext) {
      inString = !inString;
      currentJson += char;
      continue;
    }

    if (!inString) {
      if (char === '{') {
        if (braceCount === 0) {
          currentJson = '{';
        } else {
          currentJson += char;
        }
        braceCount++;
      } else if (char === '}') {
        currentJson += char;
        braceCount--;
        if (braceCount === 0) {
          try {
            const obj = JSON.parse(currentJson);
            objects.push(obj);
          } catch (e) {
            console.error(`解析JSON失败: ${e.message}`);
            console.error(`JSON片段: ${currentJson.substring(0, 200)}...`);
          }
          currentJson = '';
        }
      } else if (braceCount > 0) {
        currentJson += char;
      }
    } else {
      currentJson += char;
    }
  }

  return objects;
}

// 调用API
async function callAPI(data) {
  try {
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });

    const result = await response.json();
    return { success: response.ok, result };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

// 主函数
async function main() {
  console.log('开始读取测试数据文件...');
  console.log(`文件路径: ${TEST_DATA_FILE}`);
  
  if (!fs.existsSync(TEST_DATA_FILE)) {
    console.error(`文件不存在: ${TEST_DATA_FILE}`);
    process.exit(1);
  }

  const content = fs.readFileSync(TEST_DATA_FILE, 'utf-8');
  const objects = parseJsonObjects(content);

  console.log(`\n找到 ${objects.length} 个JSON对象\n`);

  let successCount = 0;
  let failCount = 0;

  for (let i = 0; i < objects.length; i++) {
    const obj = objects[i];
    
    // 跳过Code不为200的响应
    if (obj.Code !== 200) {
      console.log(`[${i + 1}/${objects.length}] 跳过 Code=${obj.Code} 的响应`);
      continue;
    }

    let requestData = {};
    let type = '';

    if (isListResponse(obj)) {
      requestData = { noteListResponses: [obj] };
      type = '列表';
      const itemCount = obj.Data?.ItemList?.length || 0;
      console.log(`[${i + 1}/${objects.length}] 处理${type}响应 - 包含 ${itemCount} 条笔记`);
    } else if (isDetailResponse(obj)) {
      requestData = { noteDetailResponses: [obj] };
      type = '详情';
      const noteId = obj.Data?.NoteId || 'unknown';
      console.log(`[${i + 1}/${objects.length}] 处理${type}响应 - NoteId: ${noteId}`);
    } else {
      console.log(`[${i + 1}/${objects.length}] 未知类型的响应，跳过`);
      continue;
    }

    // 调用API
    const { success, result, error } = await callAPI(requestData);

    if (success) {
      successCount++;
      const stats = result.data || {};
      const notes = stats.notes || {};
      const bloggers = stats.bloggers || {};
      const brands = stats.brands || {};
      
      console.log(`  ✅ 成功 - 笔记: ${notes.inserted || 0}新增/${notes.updated || 0}更新/${notes.detailsUpdated || 0}详情更新, ` +
                  `博主: ${bloggers.inserted || 0}新增/${bloggers.updated || 0}更新, ` +
                  `品牌: ${brands.inserted || 0}新增/${brands.updated || 0}更新`);
      
      // 显示错误（如果有）
      if (result.errors && Object.keys(result.errors).length > 0) {
        const errors = result.errors;
        if (errors.bloggers && errors.bloggers.length > 0) {
          console.log(`  ⚠️  博主错误: ${errors.bloggers.length} 个`);
        }
        if (errors.brands && errors.brands.length > 0) {
          console.log(`  ⚠️  品牌错误: ${errors.brands.length} 个`);
        }
        if (errors.notes && errors.notes.length > 0) {
          console.log(`  ⚠️  笔记错误: ${errors.notes.length} 个`);
        }
      }
    } else {
      failCount++;
      console.log(`  ❌ 失败: ${error || JSON.stringify(result)}`);
    }

    // 添加延迟，避免请求过快
    if (i < objects.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 200));
    }
  }

  console.log(`\n完成! 成功: ${successCount}, 失败: ${failCount}`);
}

// 运行
main().catch(error => {
  console.error('执行失败:', error);
  process.exit(1);
});

