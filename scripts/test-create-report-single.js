/**
 * 单次测试：创建报告
 * 使用用户提供的具体参数
 */

// Node.js 16 兼容性处理 - 添加必要的 polyfill
if (typeof globalThis.fetch !== 'function') {
  // Node.js 16 需要 node-fetch 和 polyfill
  try {
    const nodeFetch = require('node-fetch');
    const { Headers, Request, Response } = require('node-fetch');
    
    // 设置全局 polyfill
    globalThis.fetch = nodeFetch;
    globalThis.Headers = Headers;
    globalThis.Request = Request;
    globalThis.Response = Response;
  } catch (e) {
    console.error('错误: 需要Node.js 18+或安装node-fetch包');
    console.error('安装命令: npm install node-fetch@2 --save-dev');
    process.exit(1);
  }
}

const { createClient } = require('@supabase/supabase-js');

// 测试配置
const TEST_CONFIG = {
  email: '347319299@qq.com',
  password: 'aizan123456',
  baseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://plvjtbzwbxmajnkanhbe.supabase.co',
  anonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBsdmp0Ynp3YnhtYWpua2FuaGJlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjAzODE4NjUsImV4cCI6MjA3NTk1Nzg2NX0.oQVOyp-dGdUqctn6dfvhWnFp2TUDOwY_y0M5_vl9e7U',
  apiBaseUrl: 'http://localhost:3000', // Next.js API 基础URL
};

// 用户提供的参数
const REPORT_DATA = {
  reportName: '2025年Q1品牌竞品分析报告',
  brandIds: ['807917'],
  // startDate 和 endDate 不传（可选）
};

// 创建 Supabase 客户端
const supabase = createClient(TEST_CONFIG.baseUrl, TEST_CONFIG.anonKey);

let sessionCookies = {};

/**
 * 登录用户
 */
async function login() {
  console.log('🔐 正在登录...');
  
  const { data, error } = await supabase.auth.signInWithPassword({
    email: TEST_CONFIG.email,
    password: TEST_CONFIG.password,
  });

  if (error) {
    console.error('❌ 登录失败:', error.message);
    return false;
  }

  if (data.session) {
    // 构建Supabase SSR使用的cookie
    // Supabase SSR使用特定的cookie格式
    const projectRef = TEST_CONFIG.baseUrl.split('//')[1].split('.')[0];
    const cookieName = `sb-${projectRef}-auth-token`;
    const cookieValue = JSON.stringify({
      access_token: data.session.access_token,
      refresh_token: data.session.refresh_token,
      expires_at: data.session.expires_at,
      expires_in: data.session.expires_in,
      token_type: data.session.token_type,
      user: {
        id: data.user.id,
        email: data.user.email,
      },
    });
    
    sessionCookies[cookieName] = cookieValue;
    
    console.log('✅ 登录成功');
    return true;
  }

  return false;
}

/**
 * 调用API接口
 */
async function callAPI(endpoint, options = {}) {
  const url = `${TEST_CONFIG.apiBaseUrl}${endpoint}`;
  const headers = {
    'Content-Type': 'application/json',
    ...options.headers,
  };

  // 构建cookie字符串
  const cookieStrings = Object.entries(sessionCookies).map(
    ([name, value]) => `${name}=${encodeURIComponent(value)}`
  );
  
  if (cookieStrings.length > 0) {
    headers['Cookie'] = cookieStrings.join('; ');
  }

  try {
    const response = await fetch(url, {
      ...options,
      headers,
    });

    const data = await response.json();
    return {
      ok: response.ok,
      status: response.status,
      data,
    };
  } catch (err) {
    return {
      ok: false,
      status: 0,
      error: err.message,
    };
  }
}

/**
 * 测试创建报告
 */
async function testCreateReport() {
  console.log('\n📊 开始创建报告...');
  console.log('参数:');
  console.log(`  报告名称: ${REPORT_DATA.reportName}`);
  console.log(`  品牌ID: ${REPORT_DATA.brandIds.join(', ')}`);
  console.log(`  日期范围: 不选（全部）`);
  
  const result = await callAPI('/api/reports', {
    method: 'POST',
    body: JSON.stringify(REPORT_DATA),
  });

  console.log(`\n状态码: ${result.status}`);
  
  if (result.ok && result.data.success) {
    console.log('✅ 创建报告成功！');
    console.log('\n报告详情:');
    console.log(`  报告ID: ${result.data.data.reportId}`);
    console.log(`  报告名称: ${result.data.data.reportName}`);
    console.log(`  笔记数量: ${result.data.data.notesCount}`);
    console.log(`  创建时间: ${result.data.data.createdAt}`);
    return result.data.data.reportId;
  } else {
    console.error('❌ 创建报告失败！');
    console.error('错误信息:', result.data?.error || result.error);
    if (result.data) {
      console.error('完整响应:', JSON.stringify(result.data, null, 2));
    }
    return null;
  }
}

/**
 * 主函数
 */
async function main() {
  console.log('🚀 开始测试创建报告API\n');
  console.log('='.repeat(60));
  
  // 检查环境变量
  if (!TEST_CONFIG.baseUrl || !TEST_CONFIG.anonKey) {
    console.error('❌ 请设置环境变量 NEXT_PUBLIC_SUPABASE_URL 和 NEXT_PUBLIC_SUPABASE_ANON_KEY');
    process.exit(1);
  }

  // 检查API服务器
  try {
    const response = await fetch(`${TEST_CONFIG.apiBaseUrl}/api/reports`);
    if (response.status === 401 || response.status === 200) {
      console.log('✅ API服务器运行正常');
    } else {
      throw new Error('API服务器异常');
    }
  } catch (err) {
    console.error('❌ 无法连接到API服务器');
    console.error('请确保Next.js开发服务器正在运行: npm run dev');
    process.exit(1);
  }

  // 登录
  const loginSuccess = await login();
  if (!loginSuccess) {
    console.error('❌ 登录失败，无法继续测试');
    process.exit(1);
  }

  // 创建报告
  const reportId = await testCreateReport();
  
  if (reportId) {
    console.log('\n' + '='.repeat(60));
    console.log('✅ 测试完成！报告创建成功');
    console.log(`报告ID: ${reportId}`);
  } else {
    console.log('\n' + '='.repeat(60));
    console.log('❌ 测试失败！请检查错误信息');
    process.exit(1);
  }
}

// 运行测试
main().catch((err) => {
  console.error('测试执行失败:', err.message);
  process.exit(1);
});

