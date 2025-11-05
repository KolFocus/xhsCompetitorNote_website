'use client';

// 标记为动态渲染，避免静态生成时需要环境变量
export const dynamic = 'force-dynamic';

/**
 * Dashboard 布局
 * 复用 (dashboard) 路由组的布局组件
 */
import React, { useState, useEffect } from 'react';
import { Layout, Button, Avatar, Dropdown, Space } from 'antd';
import {
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  LogoutOutlined,
  UserOutlined,
} from '@ant-design/icons';
import { useRouter } from 'next/navigation';
import SidebarMenu from '@/components/layout/SidebarMenu';
import { createClient } from '@/lib/supabase/client';
import type { User } from '@supabase/supabase-js';

const { Header, Sider, Content } = Layout;

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [collapsed, setCollapsed] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  
  // 延迟创建 Supabase 客户端（仅在需要时）
  const getSupabaseClient = () => {
    try {
      return createClient();
    } catch (error) {
      console.error('Supabase client creation failed:', error);
      return null;
    }
  };

  // 获取当前用户信息
  useEffect(() => {
    const loadUser = async () => {
      try {
        const supabase = getSupabaseClient();
        if (supabase) {
          const { data: { user }, error } = await supabase.auth.getUser();
          if (error) {
            console.error('Failed to get user:', error);
          } else {
            setUser(user);
          }
        }
      } catch (error) {
        console.error('Error loading user:', error);
      } finally {
        setLoading(false);
      }
    };

    loadUser();
  }, []);

  /**
   * 退出登录
   */
  const handleLogout = async () => {
    try {
      const supabase = getSupabaseClient();
      if (supabase) {
        await supabase.auth.signOut();
      }
      router.push('/login');
      router.refresh();
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  /**
   * 用户菜单
   */
  const userMenuItems = [
    {
      key: 'profile',
      label: '个人资料',
      icon: <UserOutlined />,
    },
    {
      type: 'divider' as const,
    },
    {
      key: 'logout',
      label: '退出登录',
      icon: <LogoutOutlined />,
      danger: true,
      onClick: handleLogout,
    },
  ];

  return (
    <Layout style={{ minHeight: '100vh' }}>
      {/* 侧边栏 */}
      <Sider
        trigger={null}
        collapsible
        collapsed={collapsed}
        width={200}
        style={{
          overflow: 'auto',
          height: '100vh',
          position: 'fixed',
          left: 0,
          top: 0,
          bottom: 0,
        }}
      >
        <div
          style={{
            height: 64,
            margin: 16,
            display: 'flex',
            alignItems: 'center',
            justifyContent: collapsed ? 'center' : 'flex-start',
            color: '#fff',
            fontSize: collapsed ? 20 : 18,
            fontWeight: 600,
          }}
        >
          {collapsed ? '📊' : '📊 笔记监控'}
        </div>
        <SidebarMenu collapsed={collapsed} />
      </Sider>

      {/* 主布局 */}
      <Layout style={{ marginLeft: collapsed ? 80 : 200, transition: 'margin-left 0.2s' }}>
        {/* 顶部导航栏 */}
        <Header
          style={{
            padding: '0 24px',
            background: '#fff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
            position: 'sticky',
            top: 0,
            zIndex: 100,
          }}
        >
          <Button
            type="text"
            icon={collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
            onClick={() => setCollapsed(!collapsed)}
            style={{
              fontSize: 16,
              width: 64,
              height: 64,
            }}
          />

          <Space>
            <Dropdown menu={{ items: userMenuItems }} placement="bottomRight">
              <Space style={{ cursor: 'pointer' }}>
                <Avatar icon={<UserOutlined />} src={user?.user_metadata?.avatar_url} />
                <span>
                  {loading 
                    ? '加载中...' 
                    : user?.user_metadata?.name || user?.user_metadata?.full_name || user?.email || '用户'
                  }
                </span>
              </Space>
            </Dropdown>
          </Space>
        </Header>

        {/* 主内容区 */}
        <Content
          style={{
            margin: '24px',
            padding: 24,
            background: '#fff',
            borderRadius: 8,
            minHeight: 'calc(100vh - 112px)',
          }}
        >
          {children}
        </Content>
      </Layout>
    </Layout>
  );
}

