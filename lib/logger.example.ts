/**
 * 日志工具使用示例
 * 
 * 数据库表结构：event_info
 * - event_id: uuid (主键)
 * - product_alias: text (产品名称, 硬编码为 'xhs_competitor_note')
 * - device: text (设备名称/机器名, 自动获取)
 * - log_level: text ('info' | 'warning' | 'error')
 * - event_name: text (事件名称)
 * - event_param: text (参数/上下文, JSON字符串)
 * - event_body: text (内容/错误信息)
 * - created_at: timestamp (自动生成)
 */

import { log } from '@/lib/logger';

// ============ 使用示例 ============

// 1. 记录信息日志（info）
log.info('用户登录成功', { userId: '12345', username: 'admin' });

log.info('数据导出完成', {
  recordCount: 100,
  exportTime: '2024-01-01 10:00:00',
});

// 2. 记录警告日志（warning）
log.warning('API调用超时', {
  endpoint: '/api/notes',
  timeout: 5000,
}, '请求超时，已自动重试');

log.warning('并发数接近上限', {
  current: 18,
  max: 20,
});

// 3. 记录错误日志（error）
log.error('数据库连接失败', {
  host: 'localhost',
  port: 5432,
}, new Error('Connection timeout'));

log.error('AI分析失败', {
  noteId: 'note-123',
  retry: 3,
}, 'AI API 返回错误: 500 Internal Server Error');

// 4. 记录复杂对象
log.info('用户操作', {
  action: 'update',
  resource: 'note',
  changes: {
    title: { old: '旧标题', new: '新标题' },
    status: { old: 'draft', new: 'published' },
  },
});

// 5. 在 try-catch 中使用
async function exampleFunction() {
  try {
    // 业务逻辑
    log.info('开始执行任务', { taskId: 'task-001' });
    
    // ... 业务代码 ...
    
    log.info('任务执行成功', { taskId: 'task-001', result: 'success' });
  } catch (error: any) {
    log.error('任务执行失败', { taskId: 'task-001' }, error);
    throw error;
  }
}

// 6. 记录性能指标
const startTime = Date.now();
// ... 执行某些操作 ...
const duration = Date.now() - startTime;

log.info('操作完成', {
  operation: 'data-sync',
  duration: `${duration}ms`,
  recordsProcessed: 1000,
});

