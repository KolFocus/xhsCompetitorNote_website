/**
 * OpenRouter API 测试脚本
 * 
 * 使用方法：
 * node scripts/test-openrouter-api.js
 */

const fetch = require('node-fetch');

const API_URL = 'http://localhost:3000/api/test-openrouter';

async function testOpenRouterAPI() {
  console.log('🚀 开始测试 OpenRouter API...\n');

  try {
    // 测试 1: GET 请求（检查接口是否可访问）
    console.log('📝 测试 1: GET 请求 - 检查接口状态');
    const getResponse = await fetch(API_URL);
    const getResult = await getResponse.json();
    console.log('✅ GET 请求成功:', JSON.stringify(getResult, null, 2));
    console.log('\n' + '='.repeat(60) + '\n');

    // 测试 2: POST 请求（实际调用 OpenRouter）
    console.log('📝 测试 2: POST 请求 - 调用 OpenRouter API');
    console.log('发送消息: "What is the meaning of life?"');
    
    const postResponse = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message: 'What is the meaning of life?',
      }),
    });

    const postResult = await postResponse.json();
    
    if (postResult.success) {
      console.log('✅ POST 请求成功!');
      console.log('\n📊 返回结果:');
      console.log('- 模型:', postResult.data.model);
      console.log('- 回复内容:', postResult.data.content);
      console.log('- Token 使用:', JSON.stringify(postResult.data.usage, null, 2));
    } else {
      console.log('❌ POST 请求失败:', postResult.error);
      if (postResult.details) {
        console.log('详细错误:', JSON.stringify(postResult.details, null, 2));
      }
    }

    console.log('\n' + '='.repeat(60) + '\n');

    // 测试 3: 中文对话测试
    console.log('📝 测试 3: 中文对话测试');
    console.log('发送消息: "请用一句话介绍小红书平台"');
    
    const chineseResponse = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message: '请用一句话介绍小红书平台',
      }),
    });

    const chineseResult = await chineseResponse.json();
    
    if (chineseResult.success) {
      console.log('✅ 中文对话测试成功!');
      console.log('\n📊 返回结果:');
      console.log('- 回复内容:', chineseResult.data.content);
    } else {
      console.log('❌ 中文对话测试失败:', chineseResult.error);
    }

    console.log('\n' + '='.repeat(60) + '\n');
    console.log('🎉 所有测试完成!\n');

  } catch (error) {
    console.error('❌ 测试过程中出现错误:', error.message);
    console.error('\n请确保:');
    console.error('1. 开发服务器正在运行 (npm run dev)');
    console.error('2. OpenRouter API Key 已正确配置');
    console.error('3. 网络连接正常\n');
  }
}

// 运行测试
testOpenRouterAPI();

