import { NextRequest, NextResponse } from 'next/server';

import { log } from '@/lib/logger';
import {
  getAllSystemConfigs,
  updateSystemConfig,
  CONFIG_KEYS,
} from '@/lib/systemConfig';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * 获取AI配置
 */
export async function GET() {
  try {
    const configs = await getAllSystemConfigs();
    
    // 过滤出 AI 相关配置
    const aiConfigs = configs.filter(
      (config) =>
        config.config_key === CONFIG_KEYS.AI_MODEL ||
        config.config_key === CONFIG_KEYS.AI_ANALYSIS_ENABLED ||
        config.config_key === CONFIG_KEYS.AI_PROVIDER ||
        config.config_key === CONFIG_KEYS.OPENROUTER_API_KEY,
    );

    return NextResponse.json({
      success: true,
      data: aiConfigs,
    });
  } catch (error: any) {
    log.error('获取AI配置失败', {}, error);
    return NextResponse.json(
      {
        success: false,
        error: error?.message || '获取配置失败',
      },
      { status: 500 },
    );
  }
}

/**
 * 更新AI配置
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { config_key, config_value } = body;

    // 验证参数
    if (!config_key || config_value === undefined) {
      return NextResponse.json(
        {
          success: false,
          error: '缺少必要参数',
        },
        { status: 400 },
      );
    }

    // 验证是否为允许的配置键
    const allowedKeys = [
      CONFIG_KEYS.AI_MODEL,
      CONFIG_KEYS.AI_ANALYSIS_ENABLED,
      CONFIG_KEYS.AI_PROVIDER,
      CONFIG_KEYS.OPENROUTER_API_KEY,
    ];
    if (!allowedKeys.includes(config_key)) {
      return NextResponse.json(
        {
          success: false,
          error: '不允许修改此配置',
        },
        { status: 403 },
      );
    }

    // 验证 AI 模型值
    if (config_key === CONFIG_KEYS.AI_MODEL) {
      const allowedModels = ['gemini-2.0-flash', 'gemini-2.5-flash', 'gemini-2.5-pro'];
      if (!allowedModels.includes(config_value)) {
        return NextResponse.json(
          {
            success: false,
            error: '不支持的AI模型',
          },
          { status: 400 },
        );
      }
    }

    // 验证开关值
    if (config_key === CONFIG_KEYS.AI_ANALYSIS_ENABLED) {
      if (config_value !== 'true' && config_value !== 'false') {
        return NextResponse.json(
          {
            success: false,
            error: '开关值必须为 true 或 false',
          },
          { status: 400 },
        );
      }
    }

    // 验证 AI 提供商值
    if (config_key === CONFIG_KEYS.AI_PROVIDER) {
      const allowedProviders = ['chatai', 'openrouter'];
      if (!allowedProviders.includes(config_value)) {
        return NextResponse.json(
          {
            success: false,
            error: '不支持的AI提供商',
          },
          { status: 400 },
        );
      }
    }

    // 验证 OpenRouter API Key 格式
    if (config_key === CONFIG_KEYS.OPENROUTER_API_KEY) {
      // 允许空值（用于清空配置）
      if (config_value && !config_value.startsWith('sk-or-v1-')) {
        return NextResponse.json(
          {
            success: false,
            error: 'OpenRouter API Key 格式不正确，应以 sk-or-v1- 开头',
          },
          { status: 400 },
        );
      }
    }

    // 更新配置
    const success = await updateSystemConfig(config_key, config_value);

    if (!success) {
      throw new Error('更新配置失败');
    }

    // 记录日志（API Key 只记录前缀，保护安全）
    const logValue = config_key === CONFIG_KEYS.OPENROUTER_API_KEY && config_value
      ? `${config_value.substring(0, 15)}...`
      : config_value;
    
    log.info('AI配置已更新', {
      config_key,
      config_value: logValue,
    });

    return NextResponse.json({
      success: true,
      message: '配置更新成功',
    });
  } catch (error: any) {
    log.error('更新AI配置失败', {}, error);
    return NextResponse.json(
      {
        success: false,
        error: error?.message || '更新配置失败',
      },
      { status: 500 },
    );
  }
}

