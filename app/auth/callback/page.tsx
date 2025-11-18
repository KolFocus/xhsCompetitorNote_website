'use client';

import React, { useEffect, useState, Suspense } from 'react';
import { Button, Result, Spin } from 'antd';
import { useRouter, useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

type VerifyStatus = 'pending' | 'success' | 'error';
type VerifyOtpType = 'signup' | 'recovery' | 'magiclink' | 'email_change' | 'invite';

const normalizeOtpType = (raw: string | null): VerifyOtpType => {
  if (
    raw === 'recovery' ||
    raw === 'magiclink' ||
    raw === 'email_change' ||
    raw === 'invite'
  ) {
    return raw;
  }
  return 'signup';
};

const AuthCallbackPageContent: React.FC = () => {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [status, setStatus] = useState<VerifyStatus>('pending');
  const [description, setDescription] = useState('正在验证邮箱，请稍候...');

  useEffect(() => {
    const verifyEmail = async () => {
      const tokenHash = searchParams.get('token_hash');
      const code = searchParams.get('code');
      const otpType = normalizeOtpType(searchParams.get('type'));

      // 如果有 code 参数，说明是从 Supabase 验证端点重定向过来的
      // 这种情况下，应该使用服务端 API 来处理（因为需要 PKCE）
      if (code) {
        try {
          // 使用服务端 API 处理验证
          const response = await fetch(`/api/auth/callback?code=${encodeURIComponent(code)}&type=${otpType}`);
          
          if (response.redirected) {
            // 如果重定向了，说明验证成功或失败，重定向到登录页面
            window.location.href = response.url;
            return;
          }

          const result = await response.json();
          if (!result.success) {
            throw new Error(result.error || '邮箱验证失败');
          }

          setStatus('success');
          setDescription('邮箱验证成功，正在跳转到登录页面...');
          setTimeout(() => {
            router.push('/login?verified=success');
          }, 2000);
        } catch (error) {
          console.error('Email verification error:', error);
          setStatus('error');
          setDescription(
            (error as Error)?.message || '邮箱验证失败，请重试或重新请求验证邮件',
          );
        }
        return;
      }

      // 处理 token_hash（旧版链接格式）
      if (tokenHash) {
        let supabase;
        try {
          supabase = createClient();
        } catch (error) {
          console.error('Supabase client creation failed:', error);
          setStatus('error');
          setDescription('无法初始化 Supabase 客户端，请检查配置');
          return;
        }

        try {
          const { error } = await supabase.auth.verifyOtp({
            type: otpType,
            token_hash: tokenHash,
          });

          if (error) {
            throw error;
          }

          setStatus('success');
          setDescription('邮箱验证成功，现在可以返回登录页面');
        } catch (error) {
          console.error('Email verification error:', error);
          setStatus('error');
          setDescription(
            (error as Error)?.message || '邮箱验证失败，请重试或重新请求验证邮件',
          );
        }
        return;
      }

      // 既没有 code 也没有 token_hash
      setStatus('error');
      setDescription('缺少验证参数，请直接从邮箱中的链接进入此页面');
    };

    verifyEmail();
  }, [searchParams, router]);

  useEffect(() => {
    if (status === 'success') {
      const timer = setTimeout(() => {
        router.push('/login');
      }, 3000);

      return () => clearTimeout(timer);
    }
  }, [router, status]);

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        padding: 24,
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: 480,
          background: '#fff',
          borderRadius: 8,
          boxShadow: '0 4px 20px rgba(0,0,0,0.1)',
          padding: 32,
        }}
      >
        {status === 'pending' ? (
          <div style={{ textAlign: 'center' }}>
            <Spin tip="正在验证邮箱..." size="large" />
            <p style={{ marginTop: 16, color: '#8c8c8c' }}>
              请稍等片刻，正在确认您的邮箱
            </p>
          </div>
        ) : (
          <Result
            status={status === 'success' ? 'success' : 'error'}
            title={status === 'success' ? '邮箱验证成功' : '邮箱验证失败'}
            subTitle={description}
            extra={
              <Button type="primary" onClick={() => router.push('/login')}>
                返回登录
              </Button>
            }
          />
        )}
      </div>
    </div>
  );
};

const AuthCallbackPage: React.FC = () => {
  return (
    <Suspense
      fallback={
        <div
          style={{
            minHeight: '100vh',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            padding: 24,
          }}
        >
          <div
            style={{
              width: '100%',
              maxWidth: 480,
              background: '#fff',
              borderRadius: 8,
              boxShadow: '0 4px 20px rgba(0,0,0,0.1)',
              padding: 32,
              textAlign: 'center',
            }}
          >
            <Spin tip="加载中..." size="large" />
          </div>
        </div>
      }
    >
      <AuthCallbackPageContent />
    </Suspense>
  );
};

export default AuthCallbackPage;


