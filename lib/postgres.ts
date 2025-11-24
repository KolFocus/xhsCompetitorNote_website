/**
 * PostgreSQL 直连工具
 * 仅用于测试和特殊场景
 */

import { Pool, PoolClient } from 'pg';

// Supabase 数据库连接配置
// Session mode (端口 5432) - 适合持久连接
// 格式: postgres://postgres.{project-ref}:[PASSWORD]@aws-{n}-{region}.pooler.supabase.com:5432/postgres
// 
// 注意：
// - pool_mode: session 是服务器端配置，客户端不需要设置
// - 连接到端口 5432 时，Supabase 会自动使用 Session mode
// - Session mode 支持 prepared statements，无需特殊配置
// 
// 获取连接信息：
// 1. 登录 Supabase Dashboard: https://supabase.com/dashboard
// 2. 选择项目 → Settings → Database
// 3. 点击 "Connect" 按钮
// 4. 选择 "Session mode" 连接字符串
// 5. 复制密码（如果忘记密码，可以重置）
const pool = new Pool({
  host: 'aws-1-us-east-2.pooler.supabase.com',
  port: 5432, // Session mode 端口
  database: 'postgres',
  user: 'postgres.plvjtbzwbxmajnkanhbe', // Session mode 使用 postgres.{project-ref} 格式
  password: '0dYWcWASm1u9w43U', // ⚠️ 如果认证失败，请检查此密码是否正确
  ssl: {
    rejectUnauthorized: false, // Supabase 需要 SSL
  },
  max: 10, // 连接池最大连接数
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 30000, // 30 秒
  statement_timeout: 30000, // SQL 语句超时 30 秒
  query_timeout: 30000, // 查询超时 30 秒
  keepAlive: true, // 保持连接活跃
  keepAliveInitialDelayMillis: 10000, // 10秒后开始发送 keepalive
});

/**
 * 执行 SQL 查询
 */
export async function queryPg<T = any>(
  sql: string,
  params: any[] = []
): Promise<T[]> {
  let client: PoolClient | null = null;
  const startTime = Date.now();
  
  try {
    console.log('┌─ [PG Pool] 开始连接数据库');
    console.log('│  Host:', pool.options.host);
    console.log('│  Port:', pool.options.port);
    console.log('│  Database:', pool.options.database);
    console.log('│  User:', pool.options.user);
    console.log('│  超时设置:', pool.options.connectionTimeoutMillis, 'ms');
    console.log('│  开始时间:', new Date().toISOString());
    
    const connectStartTime = Date.now();
    client = await pool.connect();
    const connectTime = Date.now() - connectStartTime;
    console.log('│  ✓ 连接成功！耗时:', connectTime, 'ms');
    console.log('│  连接时间:', new Date().toISOString());
    
    console.log('│  SQL:', sql.replace(/\s+/g, ' ').substring(0, 150));
    console.log('│  参数:', params);
    
    const queryStartTime = Date.now();
    const result = await client.query(sql, params);
    const queryTime = Date.now() - queryStartTime;
    
    console.log('│  ✓ 查询成功！');
    console.log('│  返回行数:', result.rows.length);
    console.log('│  查询耗时:', queryTime, 'ms');
    console.log('│  总耗时:', Date.now() - startTime, 'ms');
    console.log('└─ [PG Pool] 完成');
    
    return result.rows;
  } catch (error: any) {
    const elapsed = Date.now() - startTime;
    console.error('┌─ [PG Pool] ❌ 错误发生');
    console.error('│  错误类型:', error.constructor.name);
    console.error('│  错误代码:', error.code || 'N/A');
    console.error('│  错误消息:', error.message);
    console.error('│  总耗时:', elapsed, 'ms');
    console.error('│  错误时间:', new Date().toISOString());
    
    if (error.message?.includes('password authentication failed') || error.message?.includes('authentication failed')) {
      console.error('│  ⚠️  密码认证失败！');
      console.error('│  当前配置:');
      console.error('│    Host:', pool.options.host);
      console.error('│    Port:', pool.options.port);
      console.error('│    User:', pool.options.user);
      console.error('│    Database:', pool.options.database);
      console.error('│  可能原因:');
      console.error('│    1. 数据库密码不正确');
      console.error('│    2. 用户名格式错误（Session mode 需要使用 postgres.{project-ref}）');
      console.error('│    3. 连接配置与 Supabase Dashboard 中的不一致');
      console.error('│  建议:');
      console.error('│    - 在 Supabase Dashboard → Settings → Database 中重置密码');
      console.error('│    - 确认使用 Session mode 连接字符串');
      console.error('│    - 验证用户名格式：postgres.plvjtbzwbxmajnkanhbe');
    } else if (error.message?.includes('timeout') || error.message?.includes('Connection terminated')) {
      console.error('│  ⚠️  连接超时！');
      console.error('│  可能原因:');
      console.error('│    1. 网络连接慢或不稳定');
      console.error('│    2. Supabase 项目可能暂停或不可用');
      console.error('│    3. 防火墙或代理阻止连接');
      console.error('│    4. 连接配置错误（host/port/user）');
      console.error('│  建议:');
      console.error('│    - 检查 Supabase Dashboard 项目状态');
      console.error('│    - 验证网络连接');
      console.error('│    - 确认连接字符串正确');
    } else if (error.code === 'ECONNRESET' || error.code === 'ETIMEDOUT') {
      console.error('│  ⚠️  连接被重置或超时');
    }
    
    if (error.stack) {
      console.error('│  堆栈:', error.stack.split('\n').slice(0, 3).join('\n│  '));
    }
    console.error('└─ [PG Pool] 错误结束');
    
    throw error;
  } finally {
    if (client) {
      client.release();
      console.log('[PG Pool] 连接已释放回连接池');
    }
  }
}


/**
 * 关闭连接池（应用关闭时调用）
 */
export async function closePgPool() {
  await pool.end();
}

export default pool;

