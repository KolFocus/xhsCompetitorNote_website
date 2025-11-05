'use client';

// 标记为动态渲染
export const dynamic = 'force-dynamic';

/**
 * Dashboard 首页
 * 重定向到笔记页面
 */
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function DashboardPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/dashboard/notes');
  }, [router]);

  return (
    <div style={{ 
      display: 'flex', 
      justifyContent: 'center', 
      alignItems: 'center', 
      height: '100vh' 
    }}>
      <p>正在跳转...</p>
    </div>
  );
}
