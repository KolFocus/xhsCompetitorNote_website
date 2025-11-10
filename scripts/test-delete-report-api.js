/**
 * 测试删除报告API端点
 * 测试 DELETE /api/reports/[id]
 */

// Node.js 16 兼容性处理
if (typeof globalThis.fetch !== 'function') {
  try {
    const nodeFetch = require('node-fetch');
    const { Headers, Request, Response } = require('node-fetch');
    
    globalThis.fetch = nodeFetch;
    globalThis.Headers = Headers;
    globalThis.Request = Request;
    globalThis.Response = Response;
  } catch (e) {
    console.error('错误: 需要Node.js 18+或安装node-fetch包');
    process.exit(1);
  }
}

const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://plvjtbzwbxmajnkanhbe.supabase.co';
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBsdmp0Ynp3YnhtYWpua2FuaGJlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjAzODE4NjUsImV4cCI6MjA3NTk1Nzg2NX0.oQVOyp-dGdUqctn6dfvhWnFp2TUDOwY_y0M5_vl9e7U';
const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ 缺少环境变量');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function testDeleteReportAPI() {
  console.log('🔍 开始测试删除报告API\n');
  console.log('API基础URL:', apiBaseUrl);
  console.log('');

  try {
    // 1. 登录
    console.log('1️⃣ 登录用户...');
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email: '347319299@qq.com',
      password: 'aizan123456'
    });

    if (authError || !authData.user) {
      console.error('❌ 登录失败:', authError?.message);
      return;
    }
    console.log('✅ 登录成功，用户ID:', authData.user.id);
    console.log('');

    // 2. 获取或创建测试报告
    console.log('2️⃣ 准备测试报告...');
    let reportId = await getOrCreateTestReport(authData.user.id);
    
    if (!reportId) {
      console.error('❌ 无法获取或创建测试报告');
      return;
    }
    console.log('✅ 测试报告ID:', reportId);
    console.log('');

    // 3. 获取 session token（用于 API 调用）
    console.log('3️⃣ 获取认证token...');
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    
    if (sessionError || !session) {
      console.error('❌ 获取session失败:', sessionError?.message);
      return;
    }
    console.log('✅ 获取session成功');
    
    // 构建Supabase SSR使用的cookie
    const projectRef = supabaseUrl.split('//')[1].split('.')[0];
    const cookieName = `sb-${projectRef}-auth-token`;
    const cookieValue = JSON.stringify({
      access_token: session.access_token,
      refresh_token: session.refresh_token,
      expires_at: session.expires_at,
      expires_in: session.expires_in,
      token_type: session.token_type,
      user: {
        id: authData.user.id,
        email: authData.user.email,
      },
    });
    const cookieString = `${cookieName}=${encodeURIComponent(cookieValue)}`;
    console.log('✅ Cookie已构建');
    console.log('');

    // 4. 测试删除API
    console.log('4️⃣ 调用删除报告API...');
    console.log('   DELETE', `${apiBaseUrl}/api/reports/${reportId}`);
    console.log('');

    const deleteResponse = await fetch(`${apiBaseUrl}/api/reports/${reportId}`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': cookieString,
        'Authorization': `Bearer ${session.access_token}`,
      },
    });

    const deleteResult = await deleteResponse.json();
    
    console.log('📊 API响应:');
    console.log('   状态码:', deleteResponse.status);
    console.log('   响应体:', JSON.stringify(deleteResult, null, 2));
    console.log('');

    if (!deleteResponse.ok) {
      console.error('❌ 删除失败');
      console.error('   错误:', deleteResult.error);
      return;
    }

    console.log('✅ 删除API调用成功');
    console.log('');

    // 5. 验证报告状态已更新为 'hide'
    console.log('5️⃣ 验证报告状态...');
    const { data: report, error: reportError } = await supabase
      .from('qiangua_report')
      .select('ReportId, Status')
      .eq('ReportId', reportId)
      .single();

    if (reportError) {
      console.error('❌ 查询报告失败:', reportError.message);
      return;
    }

    console.log('   报告ID:', report.ReportId);
    console.log('   报告状态:', report.Status);
    console.log('');

    if (report.Status === 'hide') {
      console.log('✅ 验证成功：报告状态已更新为 "hide"');
    } else {
      console.error('❌ 验证失败：报告状态为', report.Status, '，期望为 "hide"');
    }

    // 6. 验证通过GET API无法查询到已删除的报告
    console.log('');
    console.log('6️⃣ 验证已删除报告无法通过GET API查询...');
    const getResponse = await fetch(`${apiBaseUrl}/api/reports/${reportId}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': cookieString,
        'Authorization': `Bearer ${session.access_token}`,
      },
    });

    const getResult = await getResponse.json();
    console.log('   GET API状态码:', getResponse.status);
    
    if (getResponse.status === 404) {
      console.log('✅ 验证成功：已删除报告无法通过GET API查询（404）');
    } else {
      console.log('⚠️  警告：GET API返回状态码', getResponse.status);
      console.log('   响应:', JSON.stringify(getResult, null, 2));
    }

    console.log('');
    console.log('🎉 测试完成！');

  } catch (error) {
    console.error('❌ 测试异常:', error);
    console.error('   堆栈:', error.stack);
  }
}

async function getOrCreateTestReport(userId) {
  // 先尝试获取一个active状态的报告
  const { data: reports, error: reportsError } = await supabase
    .from('qiangua_report')
    .select('ReportId, Status')
    .eq('UserId', userId)
    .eq('Status', 'active')
    .limit(1);

  if (reportsError) {
    console.error('   查询报告失败:', reportsError.message);
    return null;
  }

  if (reports && reports.length > 0) {
    console.log('   ✅ 找到可用报告:', reports[0].ReportId);
    return reports[0].ReportId;
  }

  // 如果没有active报告，创建一个
  console.log('   ⚠️  没有active报告，创建一个测试报告...');
  const { data: newReport, error: createError } = await supabase
    .from('qiangua_report')
    .insert({
      ReportName: 'API删除测试报告',
      UserId: userId,
      Status: 'active'
    })
    .select()
    .single();

  if (createError || !newReport) {
    console.error('   创建报告失败:', createError?.message);
    return null;
  }

  console.log('   ✅ 创建测试报告成功:', newReport.ReportId);
  return newReport.ReportId;
}

// 运行测试
testDeleteReportAPI().catch(console.error);

