'use client';

import React, { useState, useEffect } from 'react';
import {
  Card,
  Row,
  Col,
  Statistic,
  Button,
  Radio,
  Switch,
  Space,
  message,
  Modal,
  Spin,
  Typography,
  Divider,
} from 'antd';
import {
  RobotOutlined,
  ReloadOutlined,
  ExclamationCircleOutlined,
  DownloadOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
} from '@ant-design/icons';
import type { RadioChangeEvent } from 'antd';

const { Title, Text } = Typography;

interface AiStats {
  pending: number;
  processing: number;
  failed: number;
  noContent: number;
  total: number;
}

interface SystemConfig {
  config_id: string;
  config_key: string;
  config_value: string;
  config_desc: string | null;
}

interface FailedNote {
  NoteId: string;
  Title: string;
  AiStatus: string;
  AiErr: string;
  PublishTime: string;
  BloggerNickName: string;
  BrandName: string | null;
}

export default function AiAnalysisPage() {
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState<AiStats | null>(null);
  const [aiModel, setAiModel] = useState<string>('gemini-2.5-flash');
  const [aiEnabled, setAiEnabled] = useState<boolean>(true);
  const [exporting, setExporting] = useState(false);

  // 加载统计数据
  const loadStats = async () => {
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
  };

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

  useEffect(() => {
    loadStats();
    loadConfig();
  }, []);

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
            loadStats(); // 重新加载统计
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

  // 导出失败列表
  const handleExport = async () => {
    if (exporting) return;
    
    try {
      setExporting(true);

      // 查询所有分析失败的笔记
      const params = new URLSearchParams({
        aiStatus: '分析失败',
        page: '1',
        pageSize: '10000',
      });

      const response = await fetch(`/api/notes?${params.toString()}`);
      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error || '获取数据失败');
      }

      const notes: FailedNote[] = result.data.list || [];

      if (notes.length === 0) {
        message.warning('暂无失败记录可导出');
        return;
      }

      // 动态导入 xlsx
      const XLSX = await import('xlsx');

      // 准备导出数据
      const exportData = notes.map((note) => ({
        笔记ID: note.NoteId,
        标题: note.Title || '',
        博主: note.BloggerNickName || '',
        品牌: note.BrandName || '',
        发布时间: note.PublishTime || '',
        错误原因: note.AiErr || '',
      }));

      // 创建工作表
      const worksheet = XLSX.utils.json_to_sheet(exportData);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'AI分析失败列表');

      // 生成文件名
      const now = new Date();
      const pad = (n: number) => (n < 10 ? `0${n}` : `${n}`);
      const timestamp = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
      const filename = `AI分析失败列表_${timestamp}.xlsx`;

      // 下载文件
      XLSX.writeFile(workbook, filename);
      message.success(`导出成功，共 ${notes.length} 条记录`);
    } catch (error) {
      console.error('导出失败:', error);
      message.error('导出失败，请稍后重试');
    } finally {
      setExporting(false);
    }
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
        // 取消时恢复原值
        setAiModel(aiModel);
      },
    });
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
        // 取消时恢复原值
        setAiEnabled(aiEnabled);
      },
    });
  };

  // 计算百分比
  const getPercentage = (count: number): number => {
    if (!stats || stats.total === 0) return 0;
    return Math.round((count / stats.total) * 100);
  };

  return (
    <div style={{ padding: 24 }}>
      <Title level={2}>
        <RobotOutlined /> AI 分析管理
      </Title>

      <Spin spinning={loading}>
        {/* 统计数据 */}
        <Card
          title="当前分析情况"
          extra={
            <Button icon={<ReloadOutlined />} onClick={loadStats}>
              刷新
            </Button>
          }
          style={{ marginBottom: 24 }}
        >
          <Row gutter={[16, 16]}>
            <Col xs={24} sm={12} md={6}>
              <Card>
                <Statistic
                  title="待分析"
                  value={stats?.pending || 0}
                  suffix={`/ ${getPercentage(stats?.pending || 0)}%`}
                  valueStyle={{ color: '#1890ff' }}
                />
              </Card>
            </Col>

            <Col xs={24} sm={12} md={6}>
              <Card>
                <Statistic
                  title="分析中"
                  value={stats?.processing || 0}
                  suffix={`/ ${getPercentage(stats?.processing || 0)}%`}
                  valueStyle={{ color: '#faad14' }}
                />
                <Button
                  type="link"
                  size="small"
                  onClick={() => handleReset('分析中', '分析中')}
                  style={{ marginTop: 8, padding: 0 }}
                >
                  重置状态
                </Button>
              </Card>
            </Col>

            <Col xs={24} sm={12} md={6}>
              <Card>
                <Statistic
                  title="分析失败"
                  value={stats?.failed || 0}
                  suffix={`/ ${getPercentage(stats?.failed || 0)}%`}
                  valueStyle={{ color: '#ff4d4f' }}
                />
                <Space style={{ marginTop: 8 }}>
                  <Button
                    type="link"
                    size="small"
                    onClick={() => handleReset('分析失败', '分析失败')}
                    style={{ padding: 0 }}
                  >
                    重置状态
                  </Button>
                  <Button
                    type="link"
                    size="small"
                    icon={<DownloadOutlined />}
                    onClick={handleExport}
                    loading={exporting}
                    style={{ padding: 0 }}
                  >
                    导出列表
                  </Button>
                </Space>
              </Card>
            </Col>

            <Col xs={24} sm={12} md={6}>
              <Card>
                <Statistic
                  title="无内容"
                  value={stats?.noContent || 0}
                  suffix={`/ ${getPercentage(stats?.noContent || 0)}%`}
                  valueStyle={{ color: '#8c8c8c' }}
                />
                <Text type="secondary" style={{ fontSize: 12 }}>
                  笔记内容缺失
                </Text>
              </Card>
            </Col>
          </Row>
        </Card>

        {/* AI模型配置 */}
        <Card title="AI模型配置" style={{ marginBottom: 24 }}>
          <Text strong style={{ marginRight: 16 }}>
            当前使用模型：
          </Text>
          <Radio.Group value={aiModel} onChange={handleModelChange}>
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
                  onChange={handleToggle}
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
      </Spin>
    </div>
  );
}

