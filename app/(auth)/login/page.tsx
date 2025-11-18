'use client';

/**
 * 登录/注册页面
 * 使用Tab切换登录和注册表单
 */
import React, { useState, useEffect, Suspense } from 'react';
import { Tabs, Form, Input, Button, Checkbox, message, Alert } from 'antd';
import { UserOutlined, LockOutlined, MailOutlined } from '@ant-design/icons';
import { useRouter, useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

type TabType = 'login' | 'register';

const LoginPageContent: React.FC = () => {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [activeTab, setActiveTab] = useState<TabType>('login');
  const [loginLoading, setLoginLoading] = useState(false);
  const [registerLoading, setRegisterLoading] = useState(false);
  const [pendingEmail, setPendingEmail] = useState<string | null>(null);
  const [resendLoading, setResendLoading] = useState(false);
  const emailRedirectTo = process.env.NEXT_PUBLIC_SUPABASE_EMAIL_REDIRECT_URL;

  // 检查 URL 参数，显示验证成功或失败的消息
  useEffect(() => {
    const verified = searchParams.get('verified');
    const error = searchParams.get('error');

    if (verified === 'success') {
      message.success('邮箱验证成功，现在可以登录了');
      // 清除 URL 参数
      router.replace('/login');
    } else if (error) {
      message.error(decodeURIComponent(error));
      // 清除 URL 参数
      router.replace('/login');
    }
  }, [searchParams, router]);
  
  // 延迟创建 Supabase 客户端（仅在注册功能需要时）
  const getSupabaseClient = () => {
    try {
      return createClient();
    } catch (error) {
      console.error('Supabase client creation failed:', error);
      return null;
    }
  };

  /**
   * 登录处理
   * 使用 Supabase 真实登录
   */
  const handleLogin = async (values: { email: string; password: string; remember?: boolean }) => {
    try {
      setLoginLoading(true);
      
      const supabase = getSupabaseClient();
      if (!supabase) {
        message.error('Supabase 未配置，登录功能暂不可用');
        return;
      }

      const { data, error } = await supabase.auth.signInWithPassword({
        email: values.email,
        password: values.password,
      });

      if (error) {
        const normalizedMessage = error.message?.toLowerCase() || '';
        if (normalizedMessage.includes('email') && normalizedMessage.includes('confirm')) {
          message.warning('邮箱尚未验证，请先前往邮箱点击验证链接');
        } else {
          message.error(error.message || '登录失败，请检查邮箱和密码');
        }
        return;
      }

      if (data.user) {
        message.success('登录成功');
        // 刷新页面以更新认证状态
        router.push('/dashboard');
        router.refresh();
      }
    } catch (error) {
      console.error('Login error:', error);
      message.error('登录失败，请重试');
    } finally {
      setLoginLoading(false);
    }
  };

  /**
   * 注册处理
   * 注册成功后自动登录并跳转到 dashboard
   */
  const handleRegister = async (values: { email: string; password: string; confirmPassword: string }) => {
    try {
      setRegisterLoading(true);

      const supabase = getSupabaseClient();
      if (!supabase) {
        message.error('Supabase 未配置，注册功能暂不可用');
        return;
      }

      if (!emailRedirectTo) {
        message.error('缺少邮箱验证回调地址配置，请联系管理员');
        return;
      }

      const { data, error } = await supabase.auth.signUp({
        email: values.email,
        password: values.password,
        options: {
          emailRedirectTo,
        },
      });

      // 详细日志用于调试
      console.log('注册响应:', {
        error,
        user: data?.user,
        session: data?.session,
        emailConfirmed: data?.user?.email_confirmed_at,
        confirmationSentAt: data?.user?.confirmation_sent_at,
      });

      if (error) {
        console.error('注册错误详情:', error);
        message.error(error.message || '注册失败');
        return;
      }

      if (data.user) {
        // 检查邮箱是否已确认（如果已确认，说明 Supabase 后台可能关闭了邮箱验证）
        if (data.user.email_confirmed_at) {
          message.warning('注册成功，但邮箱已验证（Supabase 后台可能关闭了邮箱验证功能）');
          // 如果已确认，直接跳转
          router.push('/dashboard');
          router.refresh();
        } else {
          // 检查是否已发送确认邮件
          const confirmationSentAt = data.user.confirmation_sent_at;
          if (confirmationSentAt) {
            // 邮件已发送
            message.success({
              content: '注册成功！验证邮件已发送，请查收邮箱（包括垃圾邮件文件夹）',
              duration: 6,
            });
            setPendingEmail(values.email);
            console.log('验证邮件已发送，发送时间:', confirmationSentAt);
          } else {
            // 邮件未发送（可能是配置问题）
            message.warning('注册成功，但验证邮件可能未发送，请尝试重新发送');
            setPendingEmail(values.email);
            console.warn('注册成功但未检测到 confirmation_sent_at，可能邮件未发送');
          }
          
          // 检查是否有 session（如果有，说明可能自动登录了）
          if (data.session) {
            console.warn('注册后获得了 session，可能 Supabase 后台关闭了邮箱验证');
          }
        }
      } else {
        message.error('注册失败：未创建用户');
        console.error('注册失败：data.user 为空', data);
      }
    } catch (error) {
      console.error('Register error:', error);
      message.error('注册失败，请重试');
    } finally {
      setRegisterLoading(false);
    }
  };

  /**
   * 重新发送验证邮件
   */
  const handleResendVerification = async () => {
    if (!pendingEmail) {
      message.warning('请先完成注册，再尝试重新发送验证邮件');
      return;
    }

    try {
      setResendLoading(true);
      const supabase = getSupabaseClient();
      if (!supabase) {
        message.error('Supabase 未配置，暂无法发送验证邮件');
        return;
      }

      const { error } = await supabase.auth.resend({
        type: 'signup',
        email: pendingEmail,
      });

      if (error) {
        message.error(error.message || '重新发送失败，请稍后重试');
        return;
      }

      message.success('验证邮件已重新发送，请查收');
    } catch (error) {
      console.error('Resend verification error:', error);
      message.error('重新发送失败，请稍后重试');
    } finally {
      setResendLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    }}>
      <div style={{
        width: '100%',
        maxWidth: 400,
        padding: '40px',
        background: '#fff',
        borderRadius: '8px',
        boxShadow: '0 4px 20px rgba(0,0,0,0.1)',
      }}>
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <h1 style={{ fontSize: 24, fontWeight: 600, marginBottom: 8 }}>
            小红书竞品笔记监控系统
          </h1>
          <p style={{ color: '#8c8c8c' }}>欢迎使用</p>
        </div>

        <Tabs
          activeKey={activeTab}
          onChange={(key) => setActiveTab(key as TabType)}
          items={[
            {
              key: 'login',
              label: '登录',
              children: (
                <Form
                  name="login"
                  onFinish={handleLogin}
                  autoComplete="off"
                  layout="vertical"
                  size="large"
                >
                  <Form.Item
                    name="email"
                    rules={[
                      { required: true, message: '请输入邮箱' },
                      { type: 'email', message: '请输入有效的邮箱地址' },
                    ]}
                  >
                    <Input
                      prefix={<MailOutlined />}
                      placeholder="邮箱"
                    />
                  </Form.Item>

                  <Form.Item
                    name="password"
                    rules={[{ required: true, message: '请输入密码' }]}
                  >
                    <Input.Password
                      prefix={<LockOutlined />}
                      placeholder="密码"
                    />
                  </Form.Item>

                  <Form.Item>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Form.Item name="remember" valuePropName="checked" noStyle>
                        <Checkbox>记住我</Checkbox>
                      </Form.Item>
                      <a href="#" style={{ fontSize: 14 }}>忘记密码？</a>
                    </div>
                  </Form.Item>

                  <Form.Item>
                    <Button type="primary" htmlType="submit" block loading={loginLoading}>
                      登录
                    </Button>
                  </Form.Item>
                </Form>
              ),
            },
            {
              key: 'register',
              label: '注册',
              children: (
                <Form
                  name="register"
                  onFinish={handleRegister}
                  autoComplete="off"
                  layout="vertical"
                  size="large"
                >
                  <Alert
                    type="info"
                    showIcon
                    message="注册后系统会发送验证邮件，请点击邮件中的链接以激活账号"
                    style={{ marginBottom: 16 }}
                  />
                  <Form.Item
                    name="email"
                    rules={[
                      { required: true, message: '请输入邮箱' },
                      { type: 'email', message: '请输入有效的邮箱地址' },
                    ]}
                  >
                    <Input
                      prefix={<MailOutlined />}
                      placeholder="邮箱"
                    />
                  </Form.Item>

                  <Form.Item
                    name="password"
                    rules={[
                      { required: true, message: '请输入密码' },
                      { min: 6, message: '密码至少6位' },
                    ]}
                  >
                    <Input.Password
                      prefix={<LockOutlined />}
                      placeholder="密码（至少6位）"
                    />
                  </Form.Item>

                  <Form.Item
                    name="confirmPassword"
                    dependencies={['password']}
                    rules={[
                      { required: true, message: '请确认密码' },
                      ({ getFieldValue }) => ({
                        validator(_, value) {
                          if (!value || getFieldValue('password') === value) {
                            return Promise.resolve();
                          }
                          return Promise.reject(new Error('两次输入的密码不一致'));
                        },
                      }),
                    ]}
                  >
                    <Input.Password
                      prefix={<LockOutlined />}
                      placeholder="确认密码"
                    />
                  </Form.Item>

                  {pendingEmail && (
                    <Alert
                      type="success"
                      showIcon
                      style={{ marginBottom: 16 }}
                      message={`验证邮件已发送至 ${pendingEmail}`}
                      description={
                        <div>
                          <div style={{ marginBottom: 8 }}>
                            请尽快查收并点击邮件中的验证链接完成激活。
                          </div>
                          <div style={{ marginBottom: 8, color: '#faad14', fontSize: '13px' }}>
                            ⚠️ 如果未收到邮件，请检查：
                            <ul style={{ margin: '4px 0 0 20px', padding: 0 }}>
                              <li>垃圾邮件/Spam 文件夹</li>
                              <li>邮件是否被拦截或过滤</li>
                              <li>等待几分钟后重试（邮件可能延迟）</li>
                            </ul>
                          </div>
                          <Button
                            type="link"
                            size="small"
                            onClick={handleResendVerification}
                            loading={resendLoading}
                            style={{ padding: 0 }}
                          >
                            未收到？点击重新发送
                          </Button>
                        </div>
                      }
                    />
                  )}

                  <Form.Item>
                    <Button type="primary" htmlType="submit" block loading={registerLoading}>
                      注册
                    </Button>
                  </Form.Item>
                </Form>
              ),
            },
          ]}
        />
      </div>
    </div>
  );
};

const LoginPage: React.FC = () => {
  return (
    <Suspense fallback={
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      }}>
        <div style={{
          width: '100%',
          maxWidth: 400,
          padding: '40px',
          background: '#fff',
          borderRadius: '8px',
          boxShadow: '0 4px 20px rgba(0,0,0,0.1)',
          textAlign: 'center',
        }}>
          <div>加载中...</div>
        </div>
      </div>
    }>
      <LoginPageContent />
    </Suspense>
  );
};

export default LoginPage;

