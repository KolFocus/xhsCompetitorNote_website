'use client';

/**
 * 侧边栏菜单组件
 * 支持二级菜单和收起功能
 */
import React, { useState, useEffect } from 'react';
import { Menu, Tooltip } from 'antd';
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
   * 渲染菜单项
   */
  const renderMenuItem = (item: MenuItem): React.ReactNode => {
    const menuItem = (
      <Menu.Item key={item.key} icon={item.icon} onClick={() => item.path && router.push(item.path)}>
        {!collapsed && item.label}
      </Menu.Item>
    );

    // 收起时显示Tooltip
    if (collapsed) {
      return (
        <Tooltip title={item.label} placement="right" key={item.key}>
          {menuItem}
        </Tooltip>
      );
    }

    return menuItem;
  };

  /**
   * 渲染子菜单
   */
  const renderSubMenu = (item: MenuItem): React.ReactNode => {
    if (!item.children || item.children.length === 0) {
      return renderMenuItem(item);
    }

    const subMenuItems = item.children.map((child) => renderMenuItem(child));

    if (collapsed) {
      // 收起时，有二级菜单的项目显示为带Tooltip的MenuItem
      // 点击后通过Popover显示子菜单（antd Menu会自动处理）
      return (
        <Tooltip title={item.label} placement="right" key={item.key}>
          <Menu.SubMenu key={item.key} icon={item.icon} title={item.label} popupClassName="collapsed-submenu">
            {subMenuItems}
          </Menu.SubMenu>
        </Tooltip>
      );
    }

    return (
      <Menu.SubMenu key={item.key} icon={item.icon} title={item.label}>
        {subMenuItems}
      </Menu.SubMenu>
    );
  };

  /**
   * 菜单点击处理
   */
  const handleMenuClick = ({ key }: { key: string }) => {
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
    >
      {menuItems.map((item) => (
        item.children ? renderSubMenu(item) : renderMenuItem(item)
      ))}
    </Menu>
  );
};

export default SidebarMenu;

