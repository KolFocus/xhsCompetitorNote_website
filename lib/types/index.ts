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

export type TagSetType = 'system' | 'custom';

export interface TagDTO {
  tagId: string;
  tagSetId: string;
  tagName: string;
  userId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface TagSetDTO {
  tagSetId: string;
  tagSetName: string;
  description: string | null;
  type: TagSetType;
  userId: string | null;
  createdAt: string;
  updatedAt: string;
  tags?: TagDTO[];
}

export interface NoteTaggingResult {
  noteId: string;
  tagSetId: string;
  tags: TagDTO[];
}

export interface BulkTaggingResult {
  succeedCount: number;
  failed: Array<{ noteId: string; reason: string }>;
}

