/**
 * Supabase服务端客户端配置
 * 用于Server Components和Server Actions的Supabase操作
 * 
 * 支持两种使用方式：
 * 1. Server Components: createServerClient()
 * 2. API Route Handlers: createServerClient(request)
 */
import { createServerClient as createSupabaseServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { NextRequest } from 'next/server';

export const createServerClient = (request?: NextRequest) => {
  // 如果在 API Route Handler 中使用，从 request 读取 cookies
  if (request) {
    return createSupabaseServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get(name: string) {
            return request.cookies.get(name)?.value;
          },
          set(name: string, value: string, options: any) {
            // 在 API Route Handler 中，set 操作通常不需要
            // 因为认证由 middleware 处理
          },
          remove(name: string, options: any) {
            // 在 API Route Handler 中，remove 操作通常不需要
          },
        },
      }
    );
  }
  
  // 在 Server Components 中使用
  const cookieStore = cookies();
  
  return createSupabaseServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
        set(name: string, value: string, options: any) {
          try {
            cookieStore.set(name, value, options);
          } catch {
            // The `set` method was called from a Server Component.
            // This can be ignored if you have middleware refreshing
            // user sessions.
          }
        },
        remove(name: string, options: any) {
          try {
            cookieStore.set(name, '', { ...options, maxAge: 0 });
          } catch {
            // The `remove` method was called from a Server Component.
            // This can be ignored if you have middleware refreshing
            // user sessions.
          }
        },
      },
    }
  );
};

