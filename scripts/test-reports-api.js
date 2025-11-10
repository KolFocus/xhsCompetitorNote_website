/**
 * 报告功能API测试脚本
 * 测试所有报告相关的API接口
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

// 颜色输出工具
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  gray: '\x1b[90m',
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
  apiBaseUrl: 'http://localhost:3000', // Next.js API 基础URL
};

// 测试结果统计
const testResults = {
  total: 0,
  passed: 0,
  failed: 0,
  errors: [],
};

// 创建 Supabase 客户端
const supabase = createClient(TEST_CONFIG.baseUrl, TEST_CONFIG.anonKey);

// 存储认证信息
let authToken = null;
let userId = null;
let sessionCookies = {};

/**
 * 登录用户
 */
async function login() {
  section('1. 用户登录');
  
  try {
    const { data, error } = await supabase.auth.signInWithPassword({
      email: TEST_CONFIG.email,
      password: TEST_CONFIG.password,
    });

    if (error) {
      throw error;
    }

    if (!data.session) {
      throw new Error('登录失败：未获取到会话信息');
    }

    authToken = data.session.access_token;
    userId = data.user.id;
    
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
    
    success(`登录成功 - 用户ID: ${userId}`);
    info(`访问令牌: ${authToken.substring(0, 20)}...`);
    testResults.passed++;
    return true;
  } catch (err) {
    error(`登录失败: ${err.message}`);
    testResults.failed++;
    testResults.errors.push({ test: '登录', error: err.message });
    return false;
  } finally {
    testResults.total++;
  }
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

  // 如果有认证token，也添加到headers（作为备用）
  if (authToken) {
    headers['Authorization'] = `Bearer ${authToken}`;
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
 * 测试：计算笔记数量
 */
async function testCalculateNotes() {
  section('2. 测试：计算笔记数量 (POST /api/reports/calculate-notes)');
  
  try {
    // 先获取一些品牌ID用于测试
    const { data: brands } = await supabase
      .from('qiangua_brand')
      .select('BrandId')
      .limit(2);

    if (!brands || brands.length === 0) {
      warn('数据库中暂无品牌数据，跳过此测试');
      testResults.total++;
      return;
    }

    const brandIds = brands.map(b => b.BrandId);

    const result = await callAPI('/api/reports/calculate-notes', {
      method: 'POST',
      body: JSON.stringify({
        brandIds,
        startDate: '2024-01-01',
        endDate: '2024-12-31',
      }),
    });

    testResults.total++;

    if (result.ok && result.data.success) {
      success(`计算笔记数量成功 - 总数: ${result.data.data.totalCount}`);
      info(`品牌ID: ${brandIds.join(', ')}`);
      testResults.passed++;
    } else {
      error(`计算笔记数量失败 - ${result.data?.error || result.error}`);
      testResults.failed++;
      testResults.errors.push({ 
        test: '计算笔记数量', 
        error: result.data?.error || result.error 
      });
    }
  } catch (err) {
    error(`计算笔记数量异常: ${err.message}`);
    testResults.failed++;
    testResults.errors.push({ test: '计算笔记数量', error: err.message });
  } finally {
    testResults.total++;
  }
}

/**
 * 测试：创建报告
 */
async function testCreateReport() {
  section('3. 测试：创建报告 (POST /api/reports)');
  
  try {
    // 获取品牌ID
    const { data: brands } = await supabase
      .from('qiangua_brand')
      .select('BrandId')
      .limit(2);

    if (!brands || brands.length === 0) {
      warn('数据库中暂无品牌数据，跳过此测试');
      testResults.total++;
      return null;
    }

    const brandIds = brands.map(b => b.BrandId);
    const reportName = `测试报告_${Date.now()}`;

    const result = await callAPI('/api/reports', {
      method: 'POST',
      body: JSON.stringify({
        reportName,
        brandIds,
        startDate: '2024-01-01',
        endDate: '2024-12-31',
      }),
    });

    testResults.total++;

    if (result.ok && result.data.success) {
      success(`创建报告成功 - 报告ID: ${result.data.data.reportId}`);
      info(`报告名称: ${reportName}`);
      info(`笔记数量: ${result.data.data.notesCount}`);
      testResults.passed++;
      return result.data.data.reportId;
    } else {
      error(`创建报告失败 - ${result.data?.error || result.error}`);
      testResults.failed++;
      testResults.errors.push({ 
        test: '创建报告', 
        error: result.data?.error || result.error 
      });
      return null;
    }
  } catch (err) {
    error(`创建报告异常: ${err.message}`);
    testResults.failed++;
    testResults.errors.push({ test: '创建报告', error: err.message });
    return null;
  }
}

/**
 * 测试：获取报告列表
 */
async function testGetReports() {
  section('4. 测试：获取报告列表 (GET /api/reports)');
  
  try {
    const result = await callAPI('/api/reports?page=1&pageSize=20');

    testResults.total++;

    if (result.ok && result.data.success) {
      const { list, total, page, pageSize } = result.data.data;
      success(`获取报告列表成功 - 总数: ${total}, 当前页: ${page}/${pageSize}`);
      info(`报告数量: ${list.length}`);
      
      if (list.length > 0) {
        list.forEach((report, index) => {
          info(`  ${index + 1}. ${report.reportName} (ID: ${report.reportId})`);
          info(`     有效笔记: ${report.activeNotesCount}, 已忽略: ${report.ignoredNotesCount}`);
        });
      }
      
      testResults.passed++;
      return list;
    } else {
      error(`获取报告列表失败 - ${result.data?.error || result.error}`);
      testResults.failed++;
      testResults.errors.push({ 
        test: '获取报告列表', 
        error: result.data?.error || result.error 
      });
      return [];
    }
  } catch (err) {
    error(`获取报告列表异常: ${err.message}`);
    testResults.failed++;
    testResults.errors.push({ test: '获取报告列表', error: err.message });
    return [];
  }
}

/**
 * 测试：获取报告详情
 */
async function testGetReportDetail(reportId) {
  section('5. 测试：获取报告详情 (GET /api/reports/[id])');
  
  if (!reportId) {
    warn('没有报告ID，跳过此测试');
    testResults.total++;
    return;
  }

  try {
    const result = await callAPI(`/api/reports/${reportId}`);

    testResults.total++;

    if (result.ok && result.data.success) {
      const data = result.data.data;
      success(`获取报告详情成功 - ${data.reportName}`);
      info(`报告ID: ${data.reportId}`);
      info(`有效笔记: ${data.activeNotesCount}, 已忽略: ${data.ignoredNotesCount}`);
      info(`时间范围: ${data.earliestNoteTime || 'N/A'} ~ ${data.latestNoteTime || 'N/A'}`);
      info(`品牌数量: ${data.brands?.length || 0}`);
      testResults.passed++;
    } else {
      error(`获取报告详情失败 - ${result.data?.error || result.error}`);
      testResults.failed++;
      testResults.errors.push({ 
        test: '获取报告详情', 
        error: result.data?.error || result.error 
      });
    }
  } catch (err) {
    error(`获取报告详情异常: ${err.message}`);
    testResults.failed++;
    testResults.errors.push({ test: '获取报告详情', error: err.message });
  }
}

/**
 * 测试：计算增量笔记数量
 */
async function testCalculateNewNotes(reportId) {
  section('6. 测试：计算增量笔记数量 (POST /api/reports/[id]/calculate-new-notes)');
  
  if (!reportId) {
    warn('没有报告ID，跳过此测试');
    testResults.total++;
    return;
  }

  try {
    const { data: brands } = await supabase
      .from('qiangua_brand')
      .select('BrandId')
      .limit(2);

    if (!brands || brands.length === 0) {
      warn('数据库中暂无品牌数据，跳过此测试');
      testResults.total++;
      return;
    }

    const brandIds = brands.map(b => b.BrandId);

    const result = await callAPI(`/api/reports/${reportId}/calculate-new-notes`, {
      method: 'POST',
      body: JSON.stringify({
        brandIds,
        startDate: '2024-01-01',
        endDate: '2024-12-31',
      }),
    });

    testResults.total++;

    if (result.ok && result.data.success) {
      success(`计算增量笔记数量成功 - 新增数量: ${result.data.data.newCount}`);
      testResults.passed++;
    } else {
      error(`计算增量笔记数量失败 - ${result.data?.error || result.error}`);
      testResults.failed++;
      testResults.errors.push({ 
        test: '计算增量笔记数量', 
        error: result.data?.error || result.error 
      });
    }
  } catch (err) {
    error(`计算增量笔记数量异常: ${err.message}`);
    testResults.failed++;
    testResults.errors.push({ test: '计算增量笔记数量', error: err.message });
  }
}

/**
 * 测试：获取报告笔记列表
 */
async function testGetReportNotes(reportId) {
  section('7. 测试：获取报告笔记列表 (GET /api/reports/[id]/notes)');
  
  if (!reportId) {
    warn('没有报告ID，跳过此测试');
    testResults.total++;
    return;
  }

  try {
    const result = await callAPI(`/api/reports/${reportId}/notes?page=1&pageSize=10&status=active`);

    testResults.total++;

    if (result.ok && result.data.success) {
      const { list, total } = result.data.data;
      success(`获取报告笔记列表成功 - 总数: ${total}, 当前页: ${list.length}`);
      
      if (list.length > 0) {
        info(`前3条笔记:`);
        list.slice(0, 3).forEach((note, index) => {
          info(`  ${index + 1}. ${note.title || 'N/A'} (ID: ${note.noteId})`);
        });
      }
      
      testResults.passed++;
    } else {
      error(`获取报告笔记列表失败 - ${result.data?.error || result.error}`);
      testResults.failed++;
      testResults.errors.push({ 
        test: '获取报告笔记列表', 
        error: result.data?.error || result.error 
      });
    }
  } catch (err) {
    error(`获取报告笔记列表异常: ${err.message}`);
    testResults.failed++;
    testResults.errors.push({ test: '获取报告笔记列表', error: err.message });
  }
}

/**
 * 测试：批量操作笔记
 */
async function testBatchAction(reportId) {
  section('8. 测试：批量操作笔记 (POST /api/reports/[id]/notes/batch-action)');
  
  if (!reportId) {
    warn('没有报告ID，跳过此测试');
    testResults.total++;
    return;
  }

  try {
    // 先获取一些笔记ID
    const { data: notes } = await supabase
      .from('qiangua_report_note_rel')
      .select('NoteId')
      .eq('ReportId', reportId)
      .eq('Status', 'active')
      .limit(2);

    if (!notes || notes.length === 0) {
      warn('报告中暂无笔记，跳过批量操作测试');
      testResults.total++;
      return;
    }

    const noteIds = notes.map(n => n.NoteId);

    // 测试忽略操作
    const result = await callAPI(`/api/reports/${reportId}/notes/batch-action`, {
      method: 'POST',
      body: JSON.stringify({
        action: 'ignore',
        noteIds,
      }),
    });

    testResults.total++;

    if (result.ok && result.data.success) {
      success(`批量忽略笔记成功 - 成功: ${result.data.data.successCount}, 失败: ${result.data.data.failedCount}`);
      testResults.passed++;

      // 恢复笔记以便后续测试
      const restoreResult = await callAPI(`/api/reports/${reportId}/notes/batch-action`, {
        method: 'POST',
        body: JSON.stringify({
          action: 'restore',
          noteIds,
        }),
      });

      if (restoreResult.ok && restoreResult.data.success) {
        info(`已恢复笔记: ${restoreResult.data.data.successCount} 条`);
      }
    } else {
      error(`批量操作笔记失败 - ${result.data?.error || result.error}`);
      testResults.failed++;
      testResults.errors.push({ 
        test: '批量操作笔记', 
        error: result.data?.error || result.error 
      });
    }
  } catch (err) {
    error(`批量操作笔记异常: ${err.message}`);
    testResults.failed++;
    testResults.errors.push({ test: '批量操作笔记', error: err.message });
  }
}

/**
 * 测试：追加笔记到报告
 */
async function testAddNotes(reportId) {
  section('9. 测试：追加笔记到报告 (POST /api/reports/[id]/add-notes)');
  
  if (!reportId) {
    warn('没有报告ID，跳过此测试');
    testResults.total++;
    return;
  }

  try {
    const { data: brands } = await supabase
      .from('qiangua_brand')
      .select('BrandId')
      .limit(2);

    if (!brands || brands.length === 0) {
      warn('数据库中暂无品牌数据，跳过此测试');
      testResults.total++;
      return;
    }

    const brandIds = brands.map(b => b.BrandId);

    const result = await callAPI(`/api/reports/${reportId}/add-notes`, {
      method: 'POST',
      body: JSON.stringify({
        brandIds,
        startDate: '2024-01-01',
        endDate: '2024-12-31',
      }),
    });

    testResults.total++;

    if (result.ok && result.data.success) {
      success(`追加笔记成功 - 新增: ${result.data.data.addedCount}, 跳过: ${result.data.data.skippedCount}`);
      testResults.passed++;
    } else {
      // 如果没有新增笔记也是正常的（可能都已存在）
      if (result.data?.error?.includes('没有新增笔记')) {
        warn(`追加笔记: ${result.data.error} (这是正常的，说明笔记已存在)`);
        testResults.passed++;
      } else {
        error(`追加笔记失败 - ${result.data?.error || result.error}`);
        testResults.failed++;
        testResults.errors.push({ 
          test: '追加笔记', 
          error: result.data?.error || result.error 
        });
      }
    }
  } catch (err) {
    error(`追加笔记异常: ${err.message}`);
    testResults.failed++;
    testResults.errors.push({ test: '追加笔记', error: err.message });
  }
}

/**
 * 测试：删除报告
 */
async function testDeleteReport(reportId) {
  section('10. 测试：删除报告 (DELETE /api/reports/[id])');
  
  if (!reportId) {
    warn('没有报告ID，跳过此测试');
    testResults.total++;
    return;
  }

  try {
    const result = await callAPI(`/api/reports/${reportId}`, {
      method: 'DELETE',
    });

    testResults.total++;

    if (result.ok && result.data.success) {
      success(`删除报告成功 - 报告ID: ${result.data.data.reportId}`);
      testResults.passed++;
    } else {
      error(`删除报告失败 - ${result.data?.error || result.error}`);
      testResults.failed++;
      testResults.errors.push({ 
        test: '删除报告', 
        error: result.data?.error || result.error 
      });
    }
  } catch (err) {
    error(`删除报告异常: ${err.message}`);
    testResults.failed++;
    testResults.errors.push({ test: '删除报告', error: err.message });
  }
}

/**
 * 打印测试总结
 */
function printSummary() {
  section('测试总结');
  
  const passRate = testResults.total > 0 
    ? ((testResults.passed / testResults.total) * 100).toFixed(2) 
    : 0;

  log(`总测试数: ${testResults.total}`, 'cyan');
  log(`通过: ${testResults.passed}`, 'green');
  log(`失败: ${testResults.failed}`, 'red');
  log(`通过率: ${passRate}%`, passRate >= 80 ? 'green' : 'yellow');

  if (testResults.errors.length > 0) {
    log('\n错误详情:', 'red');
    testResults.errors.forEach((err, index) => {
      log(`${index + 1}. ${err.test}: ${err.error}`, 'red');
    });
  }
}

/**
 * 主测试函数
 */
async function runTests() {
  log('\n🚀 开始测试报告功能API接口\n', 'cyan');
  
  // 检查环境变量
  if (!TEST_CONFIG.baseUrl || !TEST_CONFIG.anonKey) {
    error('请设置环境变量 NEXT_PUBLIC_SUPABASE_URL 和 NEXT_PUBLIC_SUPABASE_ANON_KEY');
    process.exit(1);
  }

  // 检查API服务器是否运行
  try {
    const response = await fetch(`${TEST_CONFIG.apiBaseUrl}/api/reports`);
    if (response.status === 401) {
      // 401是正常的，说明服务器运行中
      info('API服务器运行正常');
    } else if (response.status === 404) {
      throw new Error('API路由不存在');
    }
  } catch (err) {
    error(`无法连接到API服务器 (${TEST_CONFIG.apiBaseUrl})`);
    error('请确保Next.js开发服务器正在运行: npm run dev');
    process.exit(1);
  }

  // 执行测试
  const loginSuccess = await login();
  
  if (!loginSuccess) {
    error('登录失败，无法继续测试');
    printSummary();
    process.exit(1);
  }

  await testCalculateNotes();
  const reportId = await testCreateReport();
  const reportsList = await testGetReports();
  
  // 如果没有创建新报告，使用列表中的第一个报告进行测试
  let testReportId = reportId;
  if (!testReportId && reportsList && reportsList.length > 0) {
    testReportId = reportsList[0].reportId;
    info(`使用现有报告进行测试: ${reportsList[0].reportName} (ID: ${testReportId})`);
  }
  
  if (testReportId) {
    await testGetReportDetail(testReportId);
    await testCalculateNewNotes(testReportId);
    await testGetReportNotes(testReportId);
    await testBatchAction(testReportId);
    await testAddNotes(testReportId);
    // 注意：删除测试会删除报告，如果需要保留测试数据，可以注释掉
    await testDeleteReport(testReportId);
  }

  printSummary();

  // 退出
  process.exit(testResults.failed > 0 ? 1 : 0);
}

// 运行测试
runTests().catch((err) => {
  error(`测试执行失败: ${err.message}`);
  console.error(err);
  process.exit(1);
});

