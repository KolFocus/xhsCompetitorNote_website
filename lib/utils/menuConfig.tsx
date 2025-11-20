/**
 * 菜单配置
 * 定义侧边栏菜单结构和路由映射
 */
import {
  FileTextOutlined,
  TagsOutlined,
  BarChartOutlined,
  TagOutlined,
  AppstoreOutlined,
  SettingOutlined,
  RobotOutlined,
} from '@ant-design/icons';
import { MenuItem } from '../types';

export const menuItems: MenuItem[] = [
  {
    key: 'notes-all',
    label: '全部笔记',
    icon: <FileTextOutlined />,
    path: '/dashboard/notes',
  },
  // {
  //   key: 'brands-list',
  //   label: '品牌列表',
  //   icon: <TagsOutlined />,
  //   path: '/dashboard/brands',
  // },
  {
    key: 'content-tag',
    label: '内容标签',
    icon: <TagOutlined />,
    children: [
      {
        key: 'content-tag-management',
        label: '标签管理',
        icon: <AppstoreOutlined />,
        path: '/dashboard/tags',
      },
      {
        key: 'content-tag-note-tagging',
        label: '笔记标签',
        icon: <TagsOutlined />,
        path: '/dashboard/notes/tagging',
      },
    ],
  },
  {
    key: 'reports',
    label: '分析报告',
    icon: <BarChartOutlined />,
    path: '/dashboard/reports',
  },
  {
    key: 'system',
    label: '系统管理',
    icon: <SettingOutlined />,
    children: [
      {
        key: 'system-ai-analysis',
        label: 'AI分析',
        icon: <RobotOutlined />,
        path: '/dashboard/system/ai-analysis',
      },
    ],
  },
];

/**
 * 根据路径查找菜单项
 */
export const findMenuItemByPath = (path: string): MenuItem | undefined => {
  for (const item of menuItems) {
    if (item.path === path) {
      return item;
    }
    if (item.children) {
      const found = item.children.find((child) => child.path === path);
      if (found) {
        return found;
      }
    }
  }
  return undefined;
};

/**
 * 获取当前选中的菜单key（包括父级）
 */
export const getSelectedKeys = (pathname: string): string[] => {
  const keys: string[] = [];
  
  for (const item of menuItems) {
    if (item.path === pathname) {
      keys.push(item.key);
      return keys;
    }
    if (item.children) {
      const child = item.children.find((child) => child.path === pathname);
      if (child) {
        keys.push(item.key);
        keys.push(child.key);
        return keys;
      }
    }
  }
  
  return keys;
};

/**
 * 获取当前打开的菜单key（用于SubMenu）
 */
export const getOpenKeys = (pathname: string): string[] => {
  for (const item of menuItems) {
    if (item.children) {
      const child = item.children.find((child) => child.path === pathname);
      if (child) {
        return [item.key];
      }
    }
  }
  return [];
};

