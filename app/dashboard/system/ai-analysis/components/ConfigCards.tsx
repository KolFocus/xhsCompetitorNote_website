'use client';

import React from 'react';
import { Card, Space, Radio, Switch, Input, Button, Tag, Typography, Divider } from 'antd';
import type { RadioChangeEvent } from 'antd';
import {
  CheckCircleOutlined,
  CloseCircleOutlined,
  SaveOutlined,
} from '@ant-design/icons';

const { Text } = Typography;

interface ConfigCardsProps {
  aiProvider: string;
  aiModel: string;
  aiEnabled: boolean;
  openrouterApiKey: string;
  onProviderChange: (e: RadioChangeEvent) => void;
  onModelChange: (e: RadioChangeEvent) => void;
  onToggle: (checked: boolean) => void;
  onApiKeyChange: (value: string) => void;
  onApiKeySave: () => void;
}

export function ConfigCards({
  aiProvider,
  aiModel,
  aiEnabled,
  openrouterApiKey,
  onProviderChange,
  onModelChange,
  onToggle,
  onApiKeyChange,
  onApiKeySave,
}: ConfigCardsProps) {
  return (
    <>
      {/* AI提供商配置 */}
      <Card title="AI提供商配置" style={{ marginBottom: 24 }}>
        <Space direction="vertical" size="large" style={{ width: '100%' }}>
          <div>
            <Text strong style={{ marginRight: 16 }}>
              当前使用提供商：
            </Text>
            <Radio.Group value={aiProvider} onChange={onProviderChange}>
              <Space direction="vertical">
                <Radio value="chatai">ChatAI (淘宝商家)</Radio>
                <Radio value="openrouter">OpenRouter (多渠道)</Radio>
              </Space>
            </Radio.Group>
          </div>

          {/* 当选择 OpenRouter 时显示 API Key 配置 */}
          {aiProvider === 'openrouter' && (
            <div style={{ 
              paddingLeft: 24, 
              borderLeft: '3px solid #1890ff',
              backgroundColor: '#f0f5ff',
              padding: 16,
              borderRadius: 4,
            }}>
              <Space direction="vertical" style={{ width: '100%' }}>
                <div>
                  <Text strong>OpenRouter API Key 配置：</Text>
                  {!openrouterApiKey && (
                    <Tag color="warning" style={{ marginLeft: 8 }}>需要配置</Tag>
                  )}
                  {openrouterApiKey && (
                    <Tag color="success" style={{ marginLeft: 8 }}>已配置</Tag>
                  )}
                </div>
                <Space.Compact style={{ width: '100%', maxWidth: 600 }}>
                  <Input.Password
                    placeholder="sk-or-v1-xxx"
                    value={openrouterApiKey}
                    onChange={(e) => onApiKeyChange(e.target.value)}
                    autoComplete="off"
                  />
                  <Button
                    type="primary"
                    icon={<SaveOutlined />}
                    onClick={onApiKeySave}
                  >
                    保存并启用
                  </Button>
                </Space.Compact>
                <Text type="secondary" style={{ fontSize: 12 }}>
                  • API Key 格式：sk-or-v1-xxx
                  <br />
                  • 保存后将自动切换到 OpenRouter 提供商
                  <br />
                  • 获取 API Key：<a href="https://openrouter.ai/keys" target="_blank" rel="noopener noreferrer">https://openrouter.ai/keys</a>
                </Text>
              </Space>
            </div>
          )}
        </Space>
      </Card>

      {/* AI模型配置 */}
      <Card title="AI模型配置" style={{ marginBottom: 24 }}>
        <Text strong style={{ marginRight: 16 }}>
          当前使用模型：
        </Text>
        <Radio.Group value={aiModel} onChange={onModelChange}>
          <Space direction="vertical">
            <Radio value="gemini-2.0-flash">gemini-2.0-flash</Radio>
            <Radio value="gemini-2.5-flash">gemini-2.5-flash (推荐)</Radio>
            <Radio value="gemini-2.5-pro">gemini-2.5-pro</Radio>
          </Space>
        </Radio.Group>
      </Card>

      {/* AI分析控制 */}
      <Card title="AI分析控制">
        <Space direction="vertical" size="large" style={{ width: '100%' }}>
          <div>
            <Space align="center">
              <Text strong>分析状态：</Text>
              <Switch
                checked={aiEnabled}
                onChange={onToggle}
                checkedChildren={<CheckCircleOutlined />}
                unCheckedChildren={<CloseCircleOutlined />}
              />
              <Text type={aiEnabled ? 'success' : 'danger'}>
                {aiEnabled ? '运行中' : '已停止'}
              </Text>
            </Space>
          </div>

          <Divider style={{ margin: '12px 0' }} />

          <Text type="secondary">
            {aiEnabled
              ? '• 调度器正在运行，会自动处理待分析的笔记'
              : '• 调度器已停止，不会启动新的分析任务（正在运行的任务不受影响）'}
          </Text>
        </Space>
      </Card>
    </>
  );
}

