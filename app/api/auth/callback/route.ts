import { NextRequest, NextResponse } from 'next/server';
import { createServerClient as createSupabaseServerClient } from '@supabase/ssr';

/**
 * 服务端邮箱验证回调 API
 * 处理 Supabase 邮箱验证链接重定向后的 code 参数
 * 
 * Supabase 的验证流程：
 * 1. 用户点击邮件中的链接：https://xxx.supabase.co/auth/v1/verify?token=...&redirect_to=...
 * 2. Supabase 验证 token，然后重定向到我们的回调页面，传递 code 参数
 * 3. 我们需要使用 exchangeCodeForSession 来交换 code 获取 session
 */
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const code = searchParams.get('code');
  const type = searchParams.get('type') || 'signup';

  if (!code) {
    // 如果没有 code，重定向到登录页面
    return NextResponse.redirect(new URL('/login?error=missing_code', request.url));
  }

  // 创建响应对象，用于设置 cookie
  const response = NextResponse.redirect(new URL('/login?verified=success', request.url));

  try {
    // 创建 Supabase 服务端客户端，支持设置 cookie
    const supabase = createSupabaseServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get(name: string) {
            return request.cookies.get(name)?.value;
          },
          set(name: string, value: string, options: any) {
            // 在响应中设置 cookie
            response.cookies.set({
              name,
              value,
              ...options,
            });
          },
          remove(name: string, options: any) {
            response.cookies.set({
              name,
              value: '',
              ...options,
            });
          },
        },
      }
    );

    // 使用 exchangeCodeForSession 交换 code 获取 session
    // 这个方法在服务端可以正常工作，因为 Supabase 会处理 PKCE
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);

    if (error) {
      console.error('exchangeCodeForSession error:', error);
      // 验证失败，重定向到登录页面并显示错误
      return NextResponse.redirect(
        new URL(`/login?error=${encodeURIComponent(error.message)}`, request.url)
      );
    }

    // 验证成功，session 已通过 cookie 设置
    // 重定向到登录页面，显示成功消息
    return response;
  } catch (error) {
    console.error('Email verification error:', error);
    return NextResponse.redirect(
      new URL(
        `/login?error=${encodeURIComponent((error as Error)?.message || '邮箱验证失败')}`,
        request.url
      )
    );
  }
}

