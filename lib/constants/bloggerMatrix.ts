/**
 * 达人矩阵默认配置常量
 * 统一管理默认层级配置，避免在多个文件中重复定义
 */

export interface BloggerLevel {
  levelId?: string;
  levelName: string;
  minFans: number;
  maxFans: number | null;
}

/**
 * 默认层级配置（不包含 levelId）
 * 用于配置接口和前端组件
 */
export const DEFAULT_BLOGGER_LEVELS: Omit<BloggerLevel, 'levelId'>[] = [
  {
    levelName: '头部达人',
    minFans: 500000, // 50万
    maxFans: null,
  },
  {
    levelName: '腰部达人',
    minFans: 50000, // 5万
    maxFans: 500000, // 50万
  },
  {
    levelName: '尾部达人',
    minFans: 5000, // 5千
    maxFans: 50000, // 5万
  },
  {
    levelName: 'KOC',
    minFans: 300, // 300
    maxFans: 5000, // 5千
  },
];

/**
 * 默认层级配置（包含 levelId）
 * 用于统计接口，需要 levelId 进行标识
 */
export const DEFAULT_BLOGGER_LEVELS_WITH_ID: BloggerLevel[] = DEFAULT_BLOGGER_LEVELS.map(
  (level, index) => ({
    ...level,
    levelId: String(index + 1),
  })
);

