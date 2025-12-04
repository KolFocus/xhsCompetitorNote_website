'use client';

/**
 * 侧边栏菜单组件
 * 支持二级菜单和收起功能
 */
import React, { useState, useEffect, useMemo } from 'react';
import { Menu } from 'antd';
import type { MenuProps } from 'antd';
import { usePathname, useRouter } from 'next/navigation';
import { menuItems, getSelectedKeys, getOpenKeys } from '@/lib/utils/menuConfig';
import type { MenuItem } from '@/lib/types';

interface SidebarMenuProps {
  collapsed: boolean;
}

const SidebarMenu: React.FC<SidebarMenuProps> = ({ collapsed }) => {
  const pathname = usePathname();
  const router = useRouter();
  const [selectedKeys, setSelectedKeys] = useState<string[]>([]);
  const [openKeys, setOpenKeys] = useState<string[]>([]);

  useEffect(() => {
    const selected = getSelectedKeys(pathname);
    const open = getOpenKeys(pathname);
    setSelectedKeys(selected);
    setOpenKeys(open);
  }, [pathname]);

  /**
   * 将 MenuItem 转换为 Ant Design Menu 的 items 格式
   */
  const convertToMenuItems = (items: MenuItem[]): MenuProps['items'] => {
    return items.map((item) => {
      const menuItem: MenuProps['items'][0] = {
        key: item.key,
        icon: item.icon,
        label: item.label,
        onClick: item.path ? () => router.push(item.path) : undefined,
      };

      // 如果有子菜单，递归转换
      if (item.children && item.children.length > 0) {
        menuItem.children = convertToMenuItems(item.children);
      }

      return menuItem;
    });
  };

  const menuItemsData = useMemo(() => convertToMenuItems(menuItems), [collapsed, router]);

  /**
   * 菜单点击处理
   */
  const handleMenuClick: MenuProps['onClick'] = ({ key }) => {
    // 查找菜单项并跳转
    const findItem = (items: MenuItem[]): MenuItem | null => {
      for (const item of items) {
        if (item.key === key && item.path) {
          return item;
        }
        if (item.children) {
          const found = findItem(item.children);
          if (found) return found;
        }
      }
      return null;
    };

    const item = findItem(menuItems);
    if (item?.path) {
      router.push(item.path);
    }
  };

  /**
   * SubMenu展开/收起处理
   */
  const handleOpenChange = (keys: string[]) => {
    setOpenKeys(keys);
  };

  return (
    <Menu
      mode="inline"
      selectedKeys={selectedKeys}
      openKeys={openKeys}
      inlineCollapsed={collapsed}
      onClick={handleMenuClick}
      onOpenChange={handleOpenChange}
      style={{ height: '100%', borderRight: 0 }}
      items={menuItemsData}
    />
  );
};

export default SidebarMenu;

