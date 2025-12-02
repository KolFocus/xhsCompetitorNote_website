import { useState, useEffect, useCallback } from 'react';
import { Modal, message } from 'antd';
import { ExclamationCircleOutlined } from '@ant-design/icons';
import type { RadioChangeEvent } from 'antd';
import type { AiStats, SystemConfig } from '../types';

export function useAiConfig() {
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState<AiStats | null>(null);
  const [aiModel, setAiModel] = useState<string>('gemini-2.5-flash');
  const [aiProvider, setAiProvider] = useState<string>('chatai');
  const [openrouterApiKey, setOpenrouterApiKey] = useState<string>('');
  const [aiEnabled, setAiEnabled] = useState<boolean>(true);
  const [countdown, setCountdown] = useState(60);

  // 加载统计数据
  const loadStats = useCallback(async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/system/ai-stats');
      const data = await response.json();

      if (data.success) {
        setStats(data.data);
      } else {
        message.error(data.error || '加载统计数据失败');
      }
    } catch (error) {
      console.error('加载统计数据失败:', error);
      message.error('加载统计数据失败');
    } finally {
      setLoading(false);
    }
  }, []);

  // 加载配置
  const loadConfig = async () => {
    try {
      const response = await fetch('/api/system/ai-config');
      const data = await response.json();

      if (data.success) {
        const configs: SystemConfig[] = data.data;
        
        const modelConfig = configs.find((c) => c.config_key === 'ai_model');
        if (modelConfig) {
          setAiModel(modelConfig.config_value);
        }

        const providerConfig = configs.find((c) => c.config_key === 'ai_provider');
        if (providerConfig) {
          setAiProvider(providerConfig.config_value || 'chatai');
        }

        const apiKeyConfig = configs.find((c) => c.config_key === 'openrouter_api_key');
        if (apiKeyConfig) {
          setOpenrouterApiKey(apiKeyConfig.config_value || '');
        }

        const enabledConfig = configs.find((c) => c.config_key === 'ai_analysis_enabled');
        if (enabledConfig) {
          setAiEnabled(enabledConfig.config_value === 'true');
        }
      } else {
        message.error(data.error || '加载配置失败');
      }
    } catch (error) {
      console.error('加载配置失败:', error);
      message.error('加载配置失败');
    }
  };

  // 自动刷新和倒计时
  useEffect(() => {
    loadStats();
    loadConfig();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const countdownTimer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          loadStats();
          return 60;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      clearInterval(countdownTimer);
    };
  }, [loadStats]);

  // 手动刷新
  const handleRefresh = () => {
    loadStats();
    setCountdown(60);
  };

  // 重置状态
  const handleReset = (status: string, statusLabel: string) => {
    Modal.confirm({
      title: `确认重置"${statusLabel}"状态？`,
      icon: <ExclamationCircleOutlined />,
      content: `此操作将把所有"${statusLabel}"的笔记重置为"待分析"状态，下次调度时会重新分析。`,
      okText: '确认重置',
      okType: 'danger',
      cancelText: '取消',
      onOk: async () => {
        try {
          const response = await fetch('/api/system/ai-reset', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status }),
          });

          const data = await response.json();

          if (data.success) {
            message.success(data.data.message);
            loadStats();
          } else {
            message.error(data.error || '重置失败');
          }
        } catch (error) {
          console.error('重置失败:', error);
          message.error('重置失败');
        }
      },
    });
  };

  // 更新模型配置
  const handleModelChange = (e: RadioChangeEvent) => {
    const newModel = e.target.value;

    Modal.confirm({
      title: '确认切换AI模型？',
      icon: <ExclamationCircleOutlined />,
      content: `即将切换到 ${newModel}，新的分析任务将使用此模型。`,
      okText: '确认切换',
      cancelText: '取消',
      onOk: async () => {
        try {
          const response = await fetch('/api/system/ai-config', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              config_key: 'ai_model',
              config_value: newModel,
            }),
          });

          const data = await response.json();

          if (data.success) {
            setAiModel(newModel);
            message.success('模型切换成功');
          } else {
            message.error(data.error || '切换失败');
          }
        } catch (error) {
          console.error('切换模型失败:', error);
          message.error('切换模型失败');
        }
      },
      onCancel: () => {
        setAiModel(aiModel);
      },
    });
  };

  // 更新提供商配置
  const handleProviderChange = (e: RadioChangeEvent) => {
    const newProvider = e.target.value;

    if (newProvider === 'openrouter' && !openrouterApiKey) {
      setAiProvider(newProvider);
      message.warning({
        content: '请先在下方配置 OpenRouter API Key，保存后才能使用',
        duration: 5,
      });
      return;
    }

    Modal.confirm({
      title: '确认切换AI提供商？',
      icon: <ExclamationCircleOutlined />,
      content: `即将切换到 ${newProvider === 'chatai' ? 'ChatAI (淘宝商家)' : 'OpenRouter (多渠道)'}，新的分析任务将使用此提供商。`,
      okText: '确认切换',
      cancelText: '取消',
      onOk: async () => {
        try {
          const response = await fetch('/api/system/ai-config', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              config_key: 'ai_provider',
              config_value: newProvider,
            }),
          });

          const data = await response.json();

          if (data.success) {
            setAiProvider(newProvider);
            message.success('提供商切换成功');
          } else {
            message.error(data.error || '切换失败');
          }
        } catch (error) {
          console.error('切换提供商失败:', error);
          message.error('切换提供商失败');
        }
      },
      onCancel: () => {
        setAiProvider(aiProvider);
      },
    });
  };

  // 更新 OpenRouter API Key
  const handleApiKeySave = async () => {
    if (!openrouterApiKey.trim()) {
      message.warning('请输入 OpenRouter API Key');
      return;
    }

    if (!openrouterApiKey.trim().startsWith('sk-or-v1-')) {
      message.warning('API Key 格式不正确，应以 sk-or-v1- 开头');
      return;
    }

    try {
      const response = await fetch('/api/system/ai-config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          config_key: 'openrouter_api_key',
          config_value: openrouterApiKey.trim(),
        }),
      });

      const data = await response.json();

      if (data.success) {
        message.success('OpenRouter API Key 保存成功');
        
        if (aiProvider === 'openrouter') {
          Modal.confirm({
            title: '确认切换到 OpenRouter？',
            icon: <ExclamationCircleOutlined />,
            content: 'API Key 已保存，是否现在正式切换到 OpenRouter 提供商？',
            okText: '确认切换',
            cancelText: '暂不切换',
            onOk: async () => {
              try {
                const switchResponse = await fetch('/api/system/ai-config', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    config_key: 'ai_provider',
                    config_value: 'openrouter',
                  }),
                });

                const switchData = await switchResponse.json();

                if (switchData.success) {
                  message.success('已切换到 OpenRouter 提供商');
                } else {
                  message.error(switchData.error || '切换失败');
                }
              } catch (error) {
                console.error('切换提供商失败:', error);
                message.error('切换提供商失败');
              }
            },
          });
        }
      } else {
        message.error(data.error || '保存失败');
      }
    } catch (error) {
      console.error('保存 API Key 失败:', error);
      message.error('保存失败');
    }
  };

  // 切换总开关
  const handleToggle = (checked: boolean) => {
    Modal.confirm({
      title: checked ? '确认启动AI分析？' : '确认停止AI分析？',
      icon: <ExclamationCircleOutlined />,
      content: checked
        ? '启动后，调度器将继续处理待分析的笔记。'
        : '停止后，调度器将不再启动新的分析任务（正在运行的任务不受影响）。',
      okText: '确认',
      cancelText: '取消',
      onOk: async () => {
        try {
          const response = await fetch('/api/system/ai-config', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              config_key: 'ai_analysis_enabled',
              config_value: String(checked),
            }),
          });

          const data = await response.json();

          if (data.success) {
            setAiEnabled(checked);
            message.success(checked ? 'AI分析已启动' : 'AI分析已停止');
          } else {
            message.error(data.error || '操作失败');
          }
        } catch (error) {
          console.error('切换开关失败:', error);
          message.error('操作失败');
        }
      },
      onCancel: () => {
        setAiEnabled(aiEnabled);
      },
    });
  };

  return {
    loading,
    stats,
    aiModel,
    aiProvider,
    openrouterApiKey,
    aiEnabled,
    countdown,
    setOpenrouterApiKey,
    loadStats,
    handleRefresh,
    handleReset,
    handleModelChange,
    handleProviderChange,
    handleApiKeySave,
    handleToggle,
  };
}

