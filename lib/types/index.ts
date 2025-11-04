/**
 * 全局类型定义
 */

// 用户类型
export interface User {
  id: string;
  email: string;
  created_at: string;
}

// 菜单项类型
export interface MenuItem {
  key: string;
  label: string;
  icon?: React.ReactNode;
  path?: string;
  children?: MenuItem[];
}

