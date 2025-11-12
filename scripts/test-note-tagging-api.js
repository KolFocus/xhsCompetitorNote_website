/**
 * 笔记标签化 API 测试脚本
 * 执行顺序：登录 -> 创建标签系列 -> 标签 CRUD -> 打标接口 -> 批量接口 -> 清理数据
 */

if (typeof globalThis.fetch !== 'function') {
  try {
    const nodeFetch = require('node-fetch');
    const { Headers, Request, Response } = require('node-fetch');
    globalThis.fetch = nodeFetch;
    globalThis.Headers = Headers;
    globalThis.Request = Request;
    globalThis.Response = Response;
  } catch (error) {
    console.error('环境缺少 fetch，请使用 Node.js 18+ 或安装 node-fetch@2');
    process.exit(1);
  }
}

const { createClient } = require('@supabase/supabase-js');

const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

const log = (msg, color = 'reset') =>
  console.log(`${colors[color] || colors.reset}${msg}${colors.reset}`);
const info = (msg) => log(`ℹ️  ${msg}`, 'blue');
const success = (msg) => log(`✅ ${msg}`, 'green');
const warn = (msg) => log(`⚠️  ${msg}`, 'yellow');
const error = (msg) => log(`❌ ${msg}`, 'red');
const section = (title) => {
  log('\n' + '='.repeat(60), 'cyan');
  log(title, 'cyan');
  log('='.repeat(60), 'cyan');
};

const TEST_CONFIG = {
  email: process.env.TEST_EMAIL || '347319299@qq.com',
  password: process.env.TEST_PASSWORD || 'aizan123456',
  baseUrl:
    process.env.NEXT_PUBLIC_SUPABASE_URL ||
    'https://plvjtbzwbxmajnkanhbe.supabase.co',
  anonKey:
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBsdmp0Ynp3YnhtYWpua2FuaGJlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjAzODE4NjUsImV4cCI6MjA3NTk1Nzg2NX0.oQVOyp-dGdUqctn6dfvhWnFp2TUDOwY_y0M5_vl9e7U',
  apiBaseUrl: process.env.API_BASE_URL || 'http://localhost:3000',
};

const supabase = createClient(TEST_CONFIG.baseUrl, TEST_CONFIG.anonKey);

let authToken = null;
let sessionCookies = {};

const results = {
  total: 0,
  passed: 0,
  failed: 0,
  errors: [],
};

const buildCookieHeader = () =>
  Object.entries(sessionCookies)
    .map(([k, v]) => `${k}=${encodeURIComponent(v)}`)
    .join('; ');

async function callAPI(endpoint, options = {}) {
  const url = `${TEST_CONFIG.apiBaseUrl}${endpoint}`;
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {}),
  };

  const cookieHeader = buildCookieHeader();
  if (cookieHeader) {
    headers.Cookie = cookieHeader;
  }
  if (authToken) {
    headers.Authorization = `Bearer ${authToken}`;
  }

  const response = await fetch(url, {
    ...options,
    headers,
  });

  let data = null;
  try {
    data = await response.json();
  } catch {
    // ignore json parse errors
  }

  return {
    ok: response.ok,
    status: response.status,
    data,
  };
}

async function login() {
  section('1. 登录 Supabase 用户');
  try {
    const { data, error: authError } = await supabase.auth.signInWithPassword({
      email: TEST_CONFIG.email,
      password: TEST_CONFIG.password,
    });
    if (authError || !data.session) {
      throw authError || new Error('登录失败');
    }
    authToken = data.session.access_token;
    const projectRef = TEST_CONFIG.baseUrl.split('//')[1].split('.')[0];
    const cookieName = `sb-${projectRef}-auth-token`;
    sessionCookies[cookieName] = JSON.stringify({
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
    success(`登录成功 - 用户ID: ${data.user.id}`);
    results.passed += 1;
    return data.user;
  } catch (err) {
    error(`登录失败: ${err.message}`);
    results.failed += 1;
    results.errors.push({ test: '登录', error: err.message });
    throw err;
  } finally {
    results.total += 1;
  }
}

async function ensureApiServer() {
  try {
    const ping = await fetch(`${TEST_CONFIG.apiBaseUrl}/api/notes`);
    if (ping.status === 404 || ping.status === 200 || ping.status === 401) {
      info('API 服务正常');
      return;
    }
    warn(`API 返回状态 ${ping.status}`);
  } catch (err) {
    error(`无法连接到 API 服务: ${err.message}`);
    process.exit(1);
  }
}

async function fetchSampleNoteIds() {
  const { data, error: notesError } = await supabase
    .from('qiangua_note_info')
    .select('NoteId')
    .limit(3);
  if (notesError || !data || data.length === 0) {
    throw new Error('数据库缺少笔记数据，无法执行打标测试');
  }
  return data.map((item) => item.NoteId);
}

async function runTests() {
  section('0. 环境检查');
  await ensureApiServer();
  const user = await login();
  const noteIds = await fetchSampleNoteIds();
  info(`拿到笔记ID: ${noteIds.join(', ')}`);

  let tagSetId = null;
  let tagA = null;
  let tagB = null;

  // 创建标签系列
  section('2. 创建标签系列 (POST /api/tag-sets)');
  const tagSetName = `AutoSet_${Date.now().toString().slice(-6)}`;
  let response = await callAPI('/api/tag-sets', {
    method: 'POST',
    body: JSON.stringify({
      tagSetName,
      description: '自动化脚本创建',
      tags: ['自动化标签A', '自动化标签B'],
    }),
  });
  results.total += 1;
  if (response.ok && response.data?.success) {
    tagSetId = response.data.data.tagSetId;
    tagA = response.data.data.tags?.[0];
    tagB = response.data.data.tags?.[1];
    success(`标签系列创建成功: ${tagSetId}`);
    results.passed += 1;
  } else {
    error(`创建标签系列失败: ${response.data?.error}`);
    results.failed += 1;
    throw new Error('创建标签系列失败，终止测试');
  }

  // 更新标签系列
  section('3. 更新标签系列 (PATCH /api/tag-sets/{id})');
  response = await callAPI(`/api/tag-sets/${tagSetId}`, {
    method: 'PATCH',
    body: JSON.stringify({
      tagSetName: `${tagSetName}_更新`,
      description: '更新后的描述',
    }),
  });
  results.total += 1;
  if (response.ok && response.data?.success) {
    success('标签系列更新成功');
    results.passed += 1;
  } else {
    error(`更新标签系列失败: ${response.data?.error}`);
    results.failed += 1;
  }

  // 新增标签
  section('4. 新增标签 (POST /api/tags)');
  response = await callAPI('/api/tags', {
    method: 'POST',
    body: JSON.stringify({
      tagSetId,
      tagName: '自动化标签C',
    }),
  });
  results.total += 1;
  if (response.ok && response.data?.success) {
    success(`新增标签成功: ${response.data.data.tagId}`);
    results.passed += 1;
    if (!tagB) {
      tagB = response.data.data;
    }
  } else {
    error(`新增标签失败: ${response.data?.error}`);
    results.failed += 1;
  }

  // 重命名标签
  if (tagA) {
    section('5. 重命名标签 (PATCH /api/tags/{id})');
    response = await callAPI(`/api/tags/${tagA.tagId}`, {
      method: 'PATCH',
      body: JSON.stringify({ tagName: `${tagA.tagName}_更新` }),
    });
    results.total += 1;
    if (response.ok && response.data?.success) {
      success('标签重命名成功');
      results.passed += 1;
      tagA = response.data.data;
    } else {
      error(`标签重命名失败: ${response.data?.error}`);
      results.failed += 1;
    }
  }

  // 单笔打标
  section('6. 单笔打标 (POST /api/notes/tagging)');
  const targetNoteId = noteIds[0];
  response = await callAPI('/api/notes/tagging', {
    method: 'POST',
    body: JSON.stringify({
      noteId: targetNoteId,
      tagSetId,
      tagIds: [tagA?.tagId].filter(Boolean),
    }),
  });
  results.total += 1;
  if (response.ok && response.data?.success) {
    success(`单笔打标成功，标签数量: ${response.data.data.tags.length}`);
    results.passed += 1;
  } else {
    error(`单笔打标失败: ${response.data?.error}`);
    results.failed += 1;
  }

  // 查询笔记标签
  section('7. 查询笔记标签 (GET /api/notes/{id}/tags)');
  response = await callAPI(
    `/api/notes/${targetNoteId}/tags?tagSetId=${tagSetId}`,
  );
  results.total += 1;
  if (response.ok && response.data?.success) {
    success(
      `查询标签成功，当前标签: ${response.data.data.tags
        .map((tag) => tag.tagName)
        .join(', ') || '无'}`,
    );
    results.passed += 1;
  } else {
    error(`查询笔记标签失败: ${response.data?.error}`);
    results.failed += 1;
  }

  // 批量打标
  section('8. 批量打标 (POST /api/notes/tagging/bulk)');
  response = await callAPI('/api/notes/tagging/bulk', {
    method: 'POST',
    body: JSON.stringify({
      noteIds,
      tagSetId,
      tagIds: [tagB?.tagId].filter(Boolean),
    }),
  });
  results.total += 1;
  if (response.ok && response.data?.success) {
    const { succeedCount, failed } = response.data.data;
    success(
      `批量打标完成，成功 ${succeedCount} 条，失败 ${failed.length} 条`,
    );
    results.passed += 1;
  } else {
    error(`批量打标失败: ${response.data?.error}`);
    results.failed += 1;
  }

  // 批量清除
  section('9. 批量清除 (DELETE /api/notes/tagging/bulk)');
  response = await callAPI('/api/notes/tagging/bulk', {
    method: 'DELETE',
    body: JSON.stringify({
      noteIds,
      tagSetId,
    }),
  });
  results.total += 1;
  if (response.ok && response.data?.success) {
    success(`批量清除成功，影响 ${response.data.data.succeedCount} 条笔记`);
    results.passed += 1;
  } else {
    error(`批量清除失败: ${response.data?.error}`);
    results.failed += 1;
  }

  // 删除标签
  if (tagB) {
    section('10. 删除标签 (DELETE /api/tags/{id})');
    response = await callAPI(`/api/tags/${tagB.tagId}`, {
      method: 'DELETE',
    });
    results.total += 1;
    if (response.ok && response.data?.success) {
      success('删除标签成功');
      results.passed += 1;
    } else {
      error(`删除标签失败: ${response.data?.error}`);
      results.failed += 1;
    }
  }

  // 删除标签系列
  section('11. 删除标签系列 (DELETE /api/tag-sets/{id})');
  response = await callAPI(`/api/tag-sets/${tagSetId}`, {
    method: 'DELETE',
  });
  results.total += 1;
  if (response.ok && response.data?.success) {
    success('删除标签系列成功');
    results.passed += 1;
  } else {
    error(`删除标签系列失败: ${response.data?.error}`);
    results.failed += 1;
  }

  section('测试总结');
  const passRate =
    results.total === 0
      ? '0'
      : ((results.passed / results.total) * 100).toFixed(2);
  log(`总用例数: ${results.total}`, 'cyan');
  log(`通过: ${results.passed}`, 'green');
  log(`失败: ${results.failed}`, results.failed ? 'red' : 'green');
  log(`通过率: ${passRate}%`, results.failed ? 'yellow' : 'green');

  if (results.errors.length > 0) {
    log('\n失败详情:', 'red');
    results.errors.forEach((item, index) =>
      log(`${index + 1}. ${item.test}: ${item.error}`, 'red'),
    );
  }

  process.exit(results.failed > 0 ? 1 : 0);
}

runTests().catch((err) => {
  error(`测试执行异常: ${err.message}`);
  console.error(err);
  process.exit(1);
});

