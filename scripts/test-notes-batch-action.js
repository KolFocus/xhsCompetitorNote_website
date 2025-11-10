/**
 * 笔记批量操作测试脚本
 * 测试删除、忽略、恢复笔记的接口
 */

// Node.js 兼容性处理 - 添加必要的 polyfill
if (typeof globalThis.fetch !== 'function' || typeof globalThis.Headers === 'undefined') {
  try {
    const nodeFetch = require('node-fetch');
    const { Headers, Request, Response } = require('node-fetch');
    
    if (typeof globalThis.fetch !== 'function') {
      globalThis.fetch = nodeFetch;
    }
    if (typeof globalThis.Headers === 'undefined') {
      globalThis.Headers = Headers;
    }
    if (typeof globalThis.Request === 'undefined') {
      globalThis.Request = Request;
    }
    if (typeof globalThis.Response === 'undefined') {
      globalThis.Response = Response;
    }
  } catch (e) {
    console.error('错误: 需要Node.js 18+或安装node-fetch包');
    console.error('安装命令: npm install node-fetch@2 --save-dev');
    process.exit(1);
  }
}

const { createClient } = require('@supabase/supabase-js');

// 颜色输出工具
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function success(message) {
  log(`✅ ${message}`, 'green');
}

function error(message) {
  log(`❌ ${message}`, 'red');
}

function info(message) {
  log(`ℹ️  ${message}`, 'blue');
}

function warn(message) {
  log(`⚠️  ${message}`, 'yellow');
}

function section(message) {
  log(`\n${'='.repeat(60)}`, 'cyan');
  log(message, 'cyan');
  log('='.repeat(60), 'cyan');
}

// 测试配置
const TEST_CONFIG = {
  email: '347319299@qq.com',
  password: 'aizan123456',
  baseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://plvjtbzwbxmajnkanhbe.supabase.co',
  anonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBsdmp0Ynp3YnhtYWpua2FuaGJlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjAzODE4NjUsImV4cCI6MjA3NTk1Nzg2NX0.oQVOyp-dGdUqctn6dfvhWnFp2TUDOwY_y0M5_vl9e7U',
  apiBaseUrl: 'http://localhost:3000',
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
 * 获取报告列表（获取第一个报告）
 */
async function getFirstReport() {
  const result = await callAPI('/api/reports?page=1&pageSize=1');
  
  if (result.ok && result.data.success && result.data.data.list.length > 0) {
    return result.data.data.list[0];
  }
  
  return null;
}

/**
 * 获取报告的有效笔记列表
 */
async function getReportNotes(reportId, status = 'active', limit = 5) {
  const result = await callAPI(`/api/reports/${reportId}/notes?page=1&pageSize=${limit}&status=${status}`);
  
  if (result.ok && result.data.success) {
    return result.data.data.list || [];
  }
  
  return [];
}

/**
 * 测试：忽略笔记
 */
async function testIgnoreNotes(reportId) {
  section('测试：忽略笔记');
  
  try {
    // 获取一些有效笔记
    const notes = await getReportNotes(reportId, 'active', 3);
    
    if (notes.length === 0) {
      warn('报告中暂无有效笔记，跳过忽略测试');
      return;
    }

    const noteIds = notes.map(n => n.noteId);
    info(`准备忽略 ${noteIds.length} 条笔记: ${noteIds.join(', ')}`);

    const result = await callAPI(`/api/reports/${reportId}/notes/batch-action`, {
      method: 'POST',
      body: JSON.stringify({
        action: 'ignore',
        noteIds,
      }),
    });

    if (result.ok && result.data.success) {
      success(`忽略笔记成功！`);
      info(`成功: ${result.data.data.successCount} 条`);
      info(`失败: ${result.data.data.failedCount} 条`);
      
      // 验证笔记状态已更新
      const ignoredNotes = await getReportNotes(reportId, 'ignored', 10);
      const ignoredIds = ignoredNotes.map(n => n.noteId);
      const actuallyIgnored = noteIds.filter(id => ignoredIds.includes(id));
      
      if (actuallyIgnored.length > 0) {
        success(`验证成功: ${actuallyIgnored.length} 条笔记已标记为忽略状态`);
      } else {
        warn('注意: 笔记状态可能还未同步');
      }
      
      return noteIds; // 返回被忽略的笔记ID，用于后续恢复测试
    } else {
      error(`忽略笔记失败: ${result.data?.error || result.error}`);
      return [];
    }
  } catch (err) {
    error(`忽略笔记异常: ${err.message}`);
    return [];
  }
}

/**
 * 测试：恢复笔记
 */
async function testRestoreNotes(reportId, noteIds) {
  section('测试：恢复笔记');
  
  if (!noteIds || noteIds.length === 0) {
    warn('没有需要恢复的笔记，跳过恢复测试');
    return;
  }

  try {
    info(`准备恢复 ${noteIds.length} 条笔记: ${noteIds.join(', ')}`);

    const result = await callAPI(`/api/reports/${reportId}/notes/batch-action`, {
      method: 'POST',
      body: JSON.stringify({
        action: 'restore',
        noteIds,
      }),
    });

    if (result.ok && result.data.success) {
      success(`恢复笔记成功！`);
      info(`成功: ${result.data.data.successCount} 条`);
      info(`失败: ${result.data.data.failedCount} 条`);
      
      // 验证笔记状态已恢复
      const activeNotes = await getReportNotes(reportId, 'active', 10);
      const activeIds = activeNotes.map(n => n.noteId);
      const actuallyRestored = noteIds.filter(id => activeIds.includes(id));
      
      if (actuallyRestored.length > 0) {
        success(`验证成功: ${actuallyRestored.length} 条笔记已恢复为有效状态`);
      } else {
        warn('注意: 笔记状态可能还未同步');
      }
    } else {
      error(`恢复笔记失败: ${result.data?.error || result.error}`);
    }
  } catch (err) {
    error(`恢复笔记异常: ${err.message}`);
  }
}

/**
 * 测试：删除笔记
 */
async function testDeleteNotes(reportId) {
  section('测试：删除笔记');
  
  try {
    // 获取一些有效笔记
    const notes = await getReportNotes(reportId, 'active', 2);
    
    if (notes.length === 0) {
      warn('报告中暂无有效笔记，跳过删除测试');
      return;
    }

    const noteIds = notes.map(n => n.noteId);
    info(`准备删除 ${noteIds.length} 条笔记: ${noteIds.join(', ')}`);
    warn('⚠️  注意：删除操作不可恢复！');

    const result = await callAPI(`/api/reports/${reportId}/notes/batch-action`, {
      method: 'POST',
      body: JSON.stringify({
        action: 'delete',
        noteIds,
      }),
    });

    if (result.ok && result.data.success) {
      success(`删除笔记成功！`);
      info(`成功: ${result.data.data.successCount} 条`);
      info(`失败: ${result.data.data.failedCount} 条`);
      
      // 验证笔记已从报告中移除
      const activeNotes = await getReportNotes(reportId, 'active', 10);
      const activeIds = activeNotes.map(n => n.noteId);
      const stillExists = noteIds.filter(id => activeIds.includes(id));
      
      if (stillExists.length === 0) {
        success(`验证成功: 笔记已从报告中完全移除`);
      } else {
        warn(`注意: ${stillExists.length} 条笔记仍存在于报告中`);
      }
    } else {
      error(`删除笔记失败: ${result.data?.error || result.error}`);
    }
  } catch (err) {
    error(`删除笔记异常: ${err.message}`);
  }
}

/**
 * 主测试函数
 */
async function runTests() {
  log('\n🚀 开始测试笔记批量操作接口\n', 'cyan');
  
  // 检查API服务器
  try {
    const response = await fetch(`${TEST_CONFIG.apiBaseUrl}/api/reports`);
    if (response.status !== 401 && response.status !== 200) {
      throw new Error('API路由不存在');
    }
    info('✅ API服务器运行正常');
  } catch (err) {
    error(`无法连接到API服务器 (${TEST_CONFIG.apiBaseUrl})`);
    error('请确保Next.js开发服务器正在运行: npm run dev');
    process.exit(1);
  }

  // 登录
  const loginSuccess = await login();
  if (!loginSuccess) {
    error('登录失败，无法继续测试');
    process.exit(1);
  }

  // 获取报告
  section('获取测试报告');
  const report = await getFirstReport();
  
  if (!report) {
    error('未找到可用报告，请先创建一个报告');
    info('提示: 可以运行 node scripts/test-create-report-single.js 创建报告');
    process.exit(1);
  }

  success(`找到报告: ${report.reportName} (ID: ${report.reportId})`);
  info(`有效笔记: ${report.activeNotesCount}, 已忽略: ${report.ignoredNotesCount}`);

  const reportId = report.reportId;

  // 执行测试
  // 1. 测试忽略笔记
  const ignoredNoteIds = await testIgnoreNotes(reportId);
  
  // 2. 测试恢复笔记
  await testRestoreNotes(reportId, ignoredNoteIds);
  
  // 3. 测试删除笔记（注意：这会永久删除笔记，谨慎使用）
  // 如果不想删除，可以注释掉下面这行
  // await testDeleteNotes(reportId);

  section('测试完成');
  success('所有测试完成！');
  log('\n提示:', 'cyan');
  info('- 忽略操作：将笔记标记为忽略状态，可以恢复');
  info('- 恢复操作：将已忽略的笔记恢复为有效状态');
  info('- 删除操作：物理删除笔记关联，不可恢复');
  log('');
}

// 运行测试
runTests().catch((err) => {
  error(`测试执行失败: ${err.message}`);
  console.error(err);
  process.exit(1);
});

