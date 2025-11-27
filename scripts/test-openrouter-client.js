/**
 * OpenRouter 客户端测试脚本
 * 测试新的封装函数
 * 
 * 使用方法：
 * node scripts/test-openrouter-client.js
 */

const fetch = require('node-fetch');

const API_URL = 'http://localhost:3000/api/test-openrouter';

async function testOpenRouterClient() {
  console.log('🚀 开始测试 OpenRouter 客户端封装...\n');

  try {
    // 测试 1: 查看接口说明
    console.log('📝 测试 1: 查看接口说明');
    const infoResponse = await fetch(API_URL, { method: 'POST' });
    const infoResult = await infoResponse.json();
    console.log('✅ 接口说明:', JSON.stringify(infoResult, null, 2));
    console.log('\n' + '='.repeat(60) + '\n');

    // 测试 2: 简单文本对话
    console.log('📝 测试 2: 简单文本对话');
    console.log('发送消息: "用一句话介绍小红书"');
    
    const message1 = encodeURIComponent('用一句话介绍小红书');
    const response1 = await fetch(`${API_URL}?message=${message1}`);
    const result1 = await response1.json();
    
    if (result1.success) {
      console.log('✅ 文本对话成功!');
      console.log('\n📊 返回结果:');
      console.log('- 模型:', result1.data.model);
      console.log('- 回复:', result1.data.content);
    } else {
      console.log('❌ 文本对话失败:', result1.error);
    }

    console.log('\n' + '='.repeat(60) + '\n');

    // 测试 3: 自定义参数
    console.log('📝 测试 3: 自定义参数测试');
    console.log('模型: openai/gpt-4o, MaxTokens: 100, Temperature: 0.3');
    
    const message2 = encodeURIComponent('讲一个笑话');
    const response2 = await fetch(
      `${API_URL}?message=${message2}&model=openai/gpt-4o&maxTokens=100&temperature=0.3`
    );
    const result2 = await response2.json();
    
    if (result2.success) {
      console.log('✅ 自定义参数测试成功!');
      console.log('\n📊 返回结果:');
      console.log('- 模型:', result2.data.model);
      console.log('- 回复:', result2.data.content);
    } else {
      console.log('❌ 自定义参数测试失败:', result2.error);
    }

    console.log('\n' + '='.repeat(60) + '\n');

    // 测试 4: 多模态对话（文本 + 图片）
    console.log('📝 测试 4: 多模态对话测试');
    console.log('消息: "分析这张图片"');
    console.log('图片: https://upload.wikimedia.org/wikipedia/commons/thumb/d/dd/Gfp-wisconsin-madison-the-nature-boardwalk.jpg/2560px-Gfp-wisconsin-madison-the-nature-boardwalk.jpg');
    
    const message3 = encodeURIComponent('详细描述这张图片的内容');
    const imageUrl = encodeURIComponent('https://upload.wikimedia.org/wikipedia/commons/thumb/d/dd/Gfp-wisconsin-madison-the-nature-boardwalk.jpg/2560px-Gfp-wisconsin-madison-the-nature-boardwalk.jpg');
    const response3 = await fetch(
      `${API_URL}?message=${message3}&imageUrls=${imageUrl}`
    );
    const result3 = await response3.json();
    
    if (result3.success) {
      console.log('✅ 多模态对话测试成功!');
      console.log('\n📊 返回结果:');
      console.log('- 模型:', result3.data.model);
      console.log('- 回复:', result3.data.content);
    } else {
      console.log('❌ 多模态对话测试失败:', result3.error);
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
testOpenRouterClient();

