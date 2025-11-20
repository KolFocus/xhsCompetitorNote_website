import { getServiceSupabaseClient } from '@/lib/supabase/admin';
import os from 'os';

// 产品名称（硬编码）
const PRODUCT_ALIAS = 'xhs_competitor_note';

// 获取设备名称（机器名）
const DEVICE_NAME = os.hostname();

// 日志级别类型
type LogLevel = 'info' | 'warning' | 'error';

/**
 * 日志工具类
 */
class Logger {
  private productAlias: string;
  private device: string;

  constructor(productAlias: string, device: string) {
    this.productAlias = productAlias;
    this.device = device;
  }

  /**
   * 写入日志到数据库
   * @param level 日志级别
   * @param eventName 事件名称
   * @param eventParam 事件参数/上下文
   * @param eventBody 事件内容/错误信息
   */
  private async writeLog(
    level: LogLevel,
    eventName: string,
    eventParam?: string | Record<string, any>,
    eventBody?: string | Error | Record<string, any>,
  ) {
    try {
      const supabase = getServiceSupabaseClient();

      // 格式化参数
      const formattedParam = typeof eventParam === 'object' 
        ? JSON.stringify(eventParam, null, 2) 
        : eventParam;

      // 格式化内容（处理 Error 对象）
      let formattedBody: string | undefined;
      if (eventBody instanceof Error) {
        formattedBody = `${eventBody.message}\n\nStack:\n${eventBody.stack}`;
      } else if (typeof eventBody === 'object') {
        formattedBody = JSON.stringify(eventBody, null, 2);
      } else {
        formattedBody = eventBody;
      }

      // 写入数据库
      const { error } = await supabase.from('event_info').insert({
        product_alias: this.productAlias,
        device: this.device,
        log_level: level,
        event_name: eventName,
        event_param: formattedParam || null,
        event_body: formattedBody || null,
      });

      if (error) {
        // 写入日志失败，输出到控制台
        console.error('写入日志失败:', error);
      }
    } catch (error) {
      // 捕获异常，避免日志记录失败影响主流程
      console.error('Logger error:', error);
    }
  }

  /**
   * 记录信息日志
   * @param eventName 事件名称
   * @param eventParam 事件参数/上下文
   * @param eventBody 事件内容
   */
  info(
    eventName: string,
    eventParam?: string | Record<string, any>,
    eventBody?: string | Record<string, any>,
  ) {
    console.log(`[INFO] ${eventName}`, eventParam || '', eventBody || '');
    this.writeLog('info', eventName, eventParam, eventBody);
  }

  /**
   * 记录警告日志
   * @param eventName 事件名称
   * @param eventParam 事件参数/上下文
   * @param eventBody 警告内容
   */
  warning(
    eventName: string,
    eventParam?: string | Record<string, any>,
    eventBody?: string | Record<string, any>,
  ) {
    console.warn(`[WARNING] ${eventName}`, eventParam || '', eventBody || '');
    this.writeLog('warning', eventName, eventParam, eventBody);
  }

  /**
   * 记录错误日志
   * @param eventName 事件名称
   * @param eventParam 事件参数/上下文
   * @param eventBody 错误内容
   */
  error(
    eventName: string,
    eventParam?: string | Record<string, any>,
    eventBody?: string | Error | Record<string, any>,
  ) {
    console.error(`[ERROR] ${eventName}`, eventParam || '', eventBody || '');
    this.writeLog('error', eventName, eventParam, eventBody);
  }
}

// 导出单例实例
export const log = new Logger(PRODUCT_ALIAS, DEVICE_NAME);

