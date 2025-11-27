import { getServiceSupabaseClient } from '@/lib/supabase/admin';

/**
 * 系统配置工具类
 */

export interface SystemConfig {
  config_id: string;
  config_key: string;
  config_value: string;
  config_desc: string | null;
  updated_at: string;
  updated_by: string | null;
}

/**
 * 获取系统配置
 * @param key 配置键
 * @returns 配置值
 */
export const getSystemConfig = async (key: string): Promise<string | null> => {
  try {
    const supabase = getServiceSupabaseClient();
    const { data, error } = await supabase
      .from('system_config')
      .select('config_value')
      .eq('config_key', key)
      .single();

    if (error) {
      console.error(`获取系统配置失败 (${key}):`, error);
      return null;
    }

    return data?.config_value || null;
  } catch (error) {
    console.error(`获取系统配置异常 (${key}):`, error);
    return null;
  }
};

/**
 * 更新系统配置
 * @param key 配置键
 * @param value 配置值
 * @param updatedBy 更新人（可选）
 */
export const updateSystemConfig = async (
  key: string,
  value: string,
  updatedBy?: string,
): Promise<boolean> => {
  try {
    const supabase = getServiceSupabaseClient();
    const { error } = await supabase
      .from('system_config')
      .update({
        config_value: value,
        updated_at: new Date().toISOString(),
        updated_by: updatedBy || null,
      })
      .eq('config_key', key);

    if (error) {
      console.error(`更新系统配置失败 (${key}):`, error);
      return false;
    }

    return true;
  } catch (error) {
    console.error(`更新系统配置异常 (${key}):`, error);
    return false;
  }
};

/**
 * 获取所有系统配置
 */
export const getAllSystemConfigs = async (): Promise<SystemConfig[]> => {
  try {
    const supabase = getServiceSupabaseClient();
    const { data, error } = await supabase
      .from('system_config')
      .select('*')
      .order('config_key');

    if (error) {
      console.error('获取所有系统配置失败:', error);
      return [];
    }

    return data || [];
  } catch (error) {
    console.error('获取所有系统配置异常:', error);
    return [];
  }
};

// 常用配置键常量
export const CONFIG_KEYS = {
  AI_MODEL: 'ai_model',
  AI_ANALYSIS_ENABLED: 'ai_analysis_enabled',
  AI_PROVIDER: 'ai_provider',              // AI提供商: chatai/openrouter
  OPENROUTER_API_KEY: 'openrouter_api_key', // OpenRouter API Key
} as const;

