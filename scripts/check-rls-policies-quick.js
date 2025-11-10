/**
 * 快速检查RLS策略
 */

const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://plvjtbzwbxmajnkanhbe.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ 缺少环境变量');
  process.exit(1);
}

// 使用service role key来绕过RLS检查策略
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkPolicies() {
  console.log('🔍 检查RLS策略...\n');

  try {
    // 查询UPDATE策略
    const { data: policies, error } = await supabase
      .from('pg_policies')
      .select('*')
      .eq('tablename', 'qiangua_report')
      .eq('policyname', 'Users can update their own reports');

    if (error) {
      // 如果查询失败，尝试直接查询
      console.log('⚠️  无法查询pg_policies表，可能需要直接查询数据库');
      console.log('   请在Supabase SQL Editor中执行以下查询：');
      console.log('');
      console.log("SELECT * FROM pg_policies WHERE tablename = 'qiangua_report' AND policyname = 'Users can update their own reports';");
      return;
    }

    if (policies && policies.length > 0) {
      console.log('✅ 找到UPDATE策略:');
      console.log(JSON.stringify(policies[0], null, 2));
    } else {
      console.log('❌ 未找到UPDATE策略');
      console.log('   请执行修复脚本: scripts/fix-delete-report-rls.sql');
    }

  } catch (error) {
    console.error('❌ 检查失败:', error.message);
  }
}

checkPolicies().catch(console.error);

