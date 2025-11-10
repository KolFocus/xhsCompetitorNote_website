/**
 * 测试删除报告的RLS策略问题
 */

// Node.js 16 兼容性处理 - 添加必要的 polyfill
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

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ 缺少环境变量');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function testDeleteReport() {
  console.log('🔍 开始测试删除报告的RLS策略问题\n');

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

    // 2. 获取一个报告
    console.log('2️⃣ 获取测试报告...');
    const { data: reports, error: reportsError } = await supabase
      .from('qiangua_report')
      .select('ReportId, UserId, Status')
      .eq('UserId', authData.user.id)
      .eq('Status', 'active')
      .limit(1);

    if (reportsError) {
      console.error('❌ 查询报告失败:', reportsError);
      return;
    }

    if (!reports || reports.length === 0) {
      console.log('⚠️  没有可用的报告，创建一个...');
      // 创建一个测试报告
      const { data: newReport, error: createError } = await supabase
        .from('qiangua_report')
        .insert({
          ReportName: '测试删除报告',
          UserId: authData.user.id,
          Status: 'active'
        })
        .select()
        .single();

      if (createError || !newReport) {
        console.error('❌ 创建报告失败:', createError);
        return;
      }
      console.log('✅ 创建测试报告成功:', newReport.ReportId);
      console.log('');

      const reportId = newReport.ReportId;
      await testUpdate(reportId, authData.user.id);
    } else {
      const reportId = reports[0].ReportId;
      console.log('✅ 找到测试报告:', reportId);
      console.log('   报告状态:', reports[0].Status);
      console.log('   用户ID:', reports[0].UserId);
      console.log('');

      await testUpdate(reportId, authData.user.id);
    }
  } catch (error) {
    console.error('❌ 测试异常:', error);
  }
}

async function testUpdate(reportId, userId) {
  console.log('3️⃣ 测试更新Status为hide...');
  console.log('   报告ID:', reportId);
  console.log('   用户ID:', userId);
  console.log('');

  // 测试1: 直接UPDATE
  console.log('📝 测试1: 直接UPDATE Status为hide');
  const { data: updateData, error: updateError } = await supabase
    .from('qiangua_report')
    .update({ Status: 'hide' })
    .eq('ReportId', reportId)
    .eq('UserId', userId)
    .select();

  if (updateError) {
    console.error('❌ UPDATE失败');
    console.error('   错误代码:', updateError.code);
    console.error('   错误消息:', updateError.message);
    console.error('   错误详情:', JSON.stringify(updateError, null, 2));
    console.log('');

    // 分析错误
    if (updateError.code === '42501' || updateError.message?.includes('row-level security')) {
      console.log('🔍 分析: 这是RLS策略错误');
      console.log('   可能的原因:');
      console.log('   1. UPDATE策略的WITH CHECK条件失败');
      console.log('   2. 其他策略或触发器干扰');
      console.log('');
    }

    // 测试2: 使用service role (如果可用)
    console.log('📝 测试2: 检查UPDATE策略条件');
    await checkUpdatePolicy(reportId, userId);
  } else {
    console.log('✅ UPDATE成功');
    console.log('   更新后的数据:', updateData);
    console.log('');

    // 恢复状态以便下次测试
    console.log('🔄 恢复报告状态为active...');
    const { error: restoreError } = await supabase
      .from('qiangua_report')
      .update({ Status: 'active' })
      .eq('ReportId', reportId)
      .eq('UserId', userId);

    if (restoreError) {
      console.error('⚠️  恢复失败:', restoreError.message);
    } else {
      console.log('✅ 恢复成功');
    }
  }
}

async function checkUpdatePolicy(reportId, userId) {
  console.log('   🔍 检查UPDATE策略条件...');
  
  // 检查当前用户
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) {
    console.error('   ❌ 无法获取当前用户');
    return;
  }
  
  console.log('   ✅ 当前用户ID:', user.id);
  console.log('   ✅ 报告用户ID:', userId);
  console.log('   ✅ 用户ID匹配:', user.id === userId);
  console.log('');

  // 检查报告是否存在且可访问
  const { data: report, error: reportError } = await supabase
    .from('qiangua_report')
    .select('ReportId, UserId, Status')
    .eq('ReportId', reportId)
    .eq('UserId', user.id)
    .eq('Status', 'active')
    .single();

  if (reportError || !report) {
    console.error('   ❌ 无法查询报告:', reportError?.message);
    return;
  }

  console.log('   ✅ 报告可访问');
  console.log('   报告状态:', report.Status);
  console.log('');

  // 尝试只更新一个无关字段看看是否成功
  console.log('📝 测试3: 更新其他字段（不改变Status）...');
  const { error: updateOtherError } = await supabase
    .from('qiangua_report')
    .update({ ReportName: '测试更新名称' })
    .eq('ReportId', reportId)
    .eq('UserId', user.id);

  if (updateOtherError) {
    console.error('   ❌ 更新其他字段也失败:', updateOtherError.message);
  } else {
    console.log('   ✅ 更新其他字段成功');
    console.log('   💡 这说明UPDATE策略本身没问题');
    console.log('   💡 问题可能是Status=\'hide\'触发了某些检查');
  }
}

testDeleteReport().catch(console.error);

