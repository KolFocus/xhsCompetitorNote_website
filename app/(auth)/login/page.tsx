'use client';

/**
 * 登录/注册页面
 * 使用Tab切换登录和注册表单
 */
import React, { useState } from 'react';
import { Tabs, Form, Input, Button, Checkbox, message } from 'antd';
import { UserOutlined, LockOutlined, MailOutlined } from '@ant-design/icons';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

type TabType = 'login' | 'register';

const LoginPage: React.FC = () => {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<TabType>('login');
  const [loginLoading, setLoginLoading] = useState(false);
  const [registerLoading, setRegisterLoading] = useState(false);
  
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
        message.error(error.message || '登录失败，请检查邮箱和密码');
        return;
      }

      if (data.user) {
        message.success('登录成功，正在跳转...');
        // 刷新页面以更新认证状态
        router.push('/dashboard');
        router.refresh();
        // 不要在 finally 中取消 loading，保持 loading 状态直到页面跳转
        return;
      }
    } catch (error) {
      console.error('Login error:', error);
      message.error('登录失败，请重试');
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

      const { data, error } = await supabase.auth.signUp({
        email: values.email,
        password: values.password,
      });

      if (error) {
        console.error('注册错误详情:', error);
        message.error(error.message || '注册失败');
        return;
      }

      if (data.user && data.session) {
        // 注册成功并自动登录
        message.success('注册成功！正在跳转...');
        router.push('/dashboard');
        router.refresh();
        // 不要在 finally 中取消 loading，保持 loading 状态直到页面跳转
        return;
      } else {
        message.error('注册失败，请重试');
        setRegisterLoading(false);
      }
    } catch (error) {
      console.error('Register error:', error);
      message.error('注册失败，请重试');
      setRegisterLoading(false);
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
          onChange={(key) => {
            // 防止在加载时切换标签
            if (!loginLoading && !registerLoading) {
              setActiveTab(key as TabType);
            }
          }}
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
                      disabled={loginLoading}
                    />
                  </Form.Item>

                  <Form.Item
                    name="password"
                    rules={[{ required: true, message: '请输入密码' }]}
                  >
                    <Input.Password
                      prefix={<LockOutlined />}
                      placeholder="密码"
                      disabled={loginLoading}
                    />
                  </Form.Item>

                  <Form.Item>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Form.Item name="remember" valuePropName="checked" noStyle>
                        <Checkbox disabled={loginLoading}>记住我</Checkbox>
                      </Form.Item>
                      <a 
                        href="#" 
                        style={{ 
                          fontSize: 14,
                          pointerEvents: loginLoading ? 'none' : 'auto',
                          opacity: loginLoading ? 0.5 : 1,
                        }}
                      >
                        忘记密码？
                      </a>
                    </div>
                  </Form.Item>

                  <Form.Item>
                    <Button type="primary" htmlType="submit" block loading={loginLoading} disabled={loginLoading}>
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
                      disabled={registerLoading}
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
                      disabled={registerLoading}
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
                      disabled={registerLoading}
                    />
                  </Form.Item>

                  <Form.Item>
                    <Button type="primary" htmlType="submit" block loading={registerLoading} disabled={registerLoading}>
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

export default LoginPage;

