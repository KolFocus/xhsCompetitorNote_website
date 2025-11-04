import { NextResponse } from 'next/server';

export async function POST() {
  // 设置 fake 登录 cookie
  const expires = new Date();
  expires.setTime(expires.getTime() + 30 * 24 * 60 * 60 * 1000); // 30 天
  
  const response = NextResponse.json({ success: true });
  
  response.cookies.set('fake_auth', 'true', {
    expires,
    path: '/',
    httpOnly: false, // 允许客户端 JavaScript 访问
    sameSite: 'lax',
  });

  return response;
}

