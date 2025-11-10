/**
 * 诊断 RLS 策略问题
 * 直接测试 UPDATE 操作，查看详细错误信息
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

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ 缺少环境变量');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function diagnoseRLSIssue() {
  console.log('🔍 诊断 RLS 策略问题\n');

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

    // 2. 获取当前用户信息
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      console.error('❌ 获取用户失败:', userError?.message);
      return;
    }
    console.log('✅ 当前认证用户ID:', user.id);
    console.log('   auth.uid():', user.id);
    console.log('');

    // 3. 获取一个active报告
    console.log('2️⃣ 获取测试报告...');
    const { data: reports, error: reportsError } = await supabase
      .from('qiangua_report')
      .select('ReportId, UserId, Status, ReportName')
      .eq('UserId', user.id)
      .eq('Status', 'active')
      .limit(1);

    if (reportsError) {
      console.error('❌ 查询报告失败:', reportsError);
      return;
    }

    if (!reports || reports.length === 0) {
      console.log('⚠️  没有可用的报告，创建一个...');
      const { data: newReport, error: createError } = await supabase
        .from('qiangua_report')
        .insert({
          ReportName: 'RLS诊断测试报告',
          UserId: user.id,
          Status: 'active'
        })
        .select()
        .single();

      if (createError || !newReport) {
        console.error('❌ 创建报告失败:', createError);
        return;
      }
      console.log('✅ 创建测试报告成功:', newReport.ReportId);
      reports = [newReport];
    }

    const report = reports[0];
    const reportId = report.ReportId;
    console.log('✅ 找到测试报告:');
    console.log('   ReportId:', reportId);
    console.log('   UserId:', report.UserId);
    console.log('   Status:', report.Status);
    console.log('   UserId匹配:', user.id === report.UserId);
    console.log('');

    // 4. 测试UPDATE操作
    console.log('3️⃣ 测试UPDATE Status为hide...');
    console.log('   更新前状态:', report.Status);
    console.log('   目标状态: hide');
    console.log('');

    // 先尝试只更新ReportName（不改变Status）
    console.log('📝 测试1: 更新ReportName（不改变Status）...');
    const { data: updateNameData, error: updateNameError } = await supabase
      .from('qiangua_report')
      .update({ ReportName: '测试更新名称 ' + Date.now() })
      .eq('ReportId', reportId)
      .select();

    if (updateNameError) {
      console.error('❌ 更新ReportName失败:', updateNameError.message);
      console.error('   错误代码:', updateNameError.code);
      console.error('   错误详情:', JSON.stringify(updateNameError, null, 2));
    } else {
      console.log('✅ 更新ReportName成功');
      console.log('   这证明UPDATE策略的USING子句工作正常');
    }
    console.log('');

    // 测试更新Status为hide
    console.log('📝 测试2: 更新Status为hide...');
    const { data: updateStatusData, error: updateStatusError } = await supabase
      .from('qiangua_report')
      .update({ Status: 'hide' })
      .eq('ReportId', reportId)
      .select();

    if (updateStatusError) {
      console.error('❌ 更新Status失败');
      console.error('   错误代码:', updateStatusError.code);
      console.error('   错误消息:', updateStatusError.message);
      console.error('   错误详情:', JSON.stringify(updateStatusError, null, 2));
      console.log('');
      console.log('🔍 分析:');
      if (updateStatusError.message?.includes('row-level security')) {
        console.log('   这是RLS策略错误');
        console.log('   可能的原因:');
        console.log('   1. UPDATE策略的WITH CHECK条件失败');
        console.log('   2. 有其他策略（如INSERT策略）干扰');
        console.log('   3. 策略格式不正确或未正确应用');
      }
      console.log('');
      console.log('💡 建议:');
      console.log('   1. 在Supabase SQL Editor中执行 scripts/check-current-rls-policies.sql');
      console.log('   2. 确认策略是否存在且配置正确');
      console.log('   3. 检查是否有其他策略干扰');
    } else {
      console.log('✅ 更新Status成功！');
      console.log('   更新后的数据:', updateStatusData);
      console.log('');
      
      // 恢复状态
      console.log('🔄 恢复报告状态为active...');
      const { error: restoreError } = await supabase
        .from('qiangua_report')
        .update({ Status: 'active' })
        .eq('ReportId', reportId);

      if (restoreError) {
        console.error('⚠️  恢复失败:', restoreError.message);
        console.log('   注意: 可能需要使用service role权限来恢复');
      } else {
        console.log('✅ 恢复成功');
      }
    }

    console.log('');
    console.log('🎉 诊断完成！');

  } catch (error) {
    console.error('❌ 诊断异常:', error);
    console.error('   堆栈:', error.stack);
  }
}

diagnoseRLSIssue().catch(console.error);

