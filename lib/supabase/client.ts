/**
 * Supabase客户端配置
 * 用于客户端组件的Supabase操作
 */
import { createBrowserClient } from '@supabase/ssr';

export const createClient = () => {
  // 确保环境变量存在
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  
  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Missing Supabase environment variables');
  }
  
  return createBrowserClient(supabaseUrl, supabaseAnonKey);
};

