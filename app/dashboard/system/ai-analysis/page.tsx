'use client';

import React, { useState, useEffect, useCallback } from 'react';
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
  Dropdown,
} from 'antd';
import type { MenuProps } from 'antd';
import {
  RobotOutlined,
  ReloadOutlined,
  ExclamationCircleOutlined,
  DownloadOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  MoreOutlined,
  RedoOutlined,
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
  const [exportingNoContent, setExportingNoContent] = useState(false);
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

  // 自动刷新和倒计时
  useEffect(() => {
    // 倒计时定时器
    const countdownTimer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          // 倒计时到0时，刷新数据并重置倒计时
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
    setCountdown(60); // 重置倒计时
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
    if (exporting) {
      console.log('正在导出中，请稍候...');
      return;
    }
    
    try {
      setExporting(true);
      console.log('开始导出失败列表...');

      // 分页获取所有失败记录
      const allNotes: FailedNote[] = [];
      let page = 1;
      const pageSize = 100; // API 限制最大 100
      let hasMore = true;

      while (hasMore) {
        const params = new URLSearchParams({
          aiStatus: '分析失败',
          page: String(page),
          pageSize: String(pageSize),
        });

        console.log(`请求第 ${page} 页数据:`, `/api/notes/ai-analysis?${params.toString()}`);
        const response = await fetch(`/api/notes/ai-analysis?${params.toString()}`);
        
        if (!response.ok) {
          throw new Error(`API请求失败: ${response.status} ${response.statusText}`);
        }
        
        const result = await response.json();

        if (!result.success) {
          throw new Error(result.error || '获取数据失败');
        }

        const notes: FailedNote[] = result.data.list || [];
        const total = result.data.total || 0;
        
        console.log(`第 ${page} 页获取到 ${notes.length} 条记录，总共 ${total} 条`);
        
        allNotes.push(...notes);
        
        // 判断是否还有更多数据
        if (allNotes.length >= total || notes.length < pageSize) {
          hasMore = false;
        } else {
          page++;
        }
      }

      console.log(`总共获取到 ${allNotes.length} 条失败记录`);

      if (allNotes.length === 0) {
        message.warning('暂无失败记录可导出');
        return;
      }

      // 动态导入 xlsx
      console.log('开始导入 xlsx 库...');
      const XLSX = await import('xlsx');
      console.log('xlsx 库导入成功');

      // 准备导出数据
      const exportData = allNotes.map((note) => ({
        笔记ID: note.NoteId,
        标题: note.Title || '',
        博主: note.BloggerNickName || '',
        品牌: note.BrandName || '',
        发布时间: note.PublishTime || '',
        错误原因: note.AiErr || '',
      }));

      console.log('准备创建工作表...');
      // 创建工作表
      const worksheet = XLSX.utils.json_to_sheet(exportData);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'AI分析失败列表');

      // 生成文件名
      const now = new Date();
      const pad = (n: number) => (n < 10 ? `0${n}` : `${n}`);
      const timestamp = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
      const filename = `AI分析失败列表_${timestamp}.xlsx`;

      console.log('开始下载文件:', filename);
      // 下载文件
      XLSX.writeFile(workbook, filename);
      console.log('文件下载完成');
      
      message.success(`导出成功，共 ${allNotes.length} 条记录`);
    } catch (error) {
      console.error('导出失败 - 详细错误:', error);
      const errorMsg = error instanceof Error ? error.message : '未知错误';
      message.error(`导出失败: ${errorMsg}`);
    } finally {
      setExporting(false);
      console.log('导出流程结束');
    }
  };

  // 导出笔记详情缺失列表
  const handleExportNoContent = async () => {
    if (exportingNoContent) {
      console.log('正在导出中，请稍候...');
      return;
    }
    
    try {
      setExportingNoContent(true);
      console.log('开始导出笔记详情缺失列表...');

      // 分页获取所有无内容记录
      const allNotes: FailedNote[] = [];
      let page = 1;
      const pageSize = 100; // API 限制最大 100
      let hasMore = true;

      while (hasMore) {
        const params = new URLSearchParams({
          aiStatus: '无内容',
          page: String(page),
          pageSize: String(pageSize),
        });

        console.log(`请求第 ${page} 页数据:`, `/api/notes/ai-analysis?${params.toString()}`);
        const response = await fetch(`/api/notes/ai-analysis?${params.toString()}`);
        
        if (!response.ok) {
          throw new Error(`API请求失败: ${response.status} ${response.statusText}`);
        }
        
        const result = await response.json();

        if (!result.success) {
          throw new Error(result.error || '获取数据失败');
        }

        const notes: FailedNote[] = result.data.list || [];
        const total = result.data.total || 0;
        
        console.log(`第 ${page} 页获取到 ${notes.length} 条记录，总共 ${total} 条`);
        
        allNotes.push(...notes);
        
        // 判断是否还有更多数据
        if (allNotes.length >= total || notes.length < pageSize) {
          hasMore = false;
        } else {
          page++;
        }
      }

      console.log(`总共获取到 ${allNotes.length} 条笔记详情缺失记录`);

      if (allNotes.length === 0) {
        message.warning('暂无笔记详情缺失记录可导出');
        return;
      }

      // 动态导入 xlsx
      console.log('开始导入 xlsx 库...');
      const XLSX = await import('xlsx');
      console.log('xlsx 库导入成功');

      // 准备导出数据
      const exportData = allNotes.map((note) => ({
        笔记ID: note.NoteId,
        标题: note.Title || '',
        博主: note.BloggerNickName || '',
        品牌: note.BrandName || '',
        发布时间: note.PublishTime || '',
      }));

      console.log('准备创建工作表...');
      // 创建工作表
      const worksheet = XLSX.utils.json_to_sheet(exportData);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, '笔记详情缺失列表');

      // 生成文件名
      const now = new Date();
      const pad = (n: number) => (n < 10 ? `0${n}` : `${n}`);
      const timestamp = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
      const filename = `笔记详情缺失列表_${timestamp}.xlsx`;

      console.log('开始下载文件:', filename);
      // 下载文件
      XLSX.writeFile(workbook, filename);
      console.log('文件下载完成');
      
      message.success(`导出成功，共 ${allNotes.length} 条记录`);
    } catch (error) {
      console.error('导出失败 - 详细错误:', error);
      const errorMsg = error instanceof Error ? error.message : '未知错误';
      message.error(`导出失败: ${errorMsg}`);
    } finally {
      setExportingNoContent(false);
      console.log('导出流程结束');
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
            <Button icon={<ReloadOutlined />} onClick={handleRefresh} loading={loading}>
              刷新 ({countdown}s)
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
                  valueStyle={{ color: '#1890ff' }}
                />
              </Card>
            </Col>

            <Col xs={24} sm={12} md={6}>
              <Card>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <Statistic
                    title="分析中"
                    value={stats?.processing || 0}
                    valueStyle={{ color: '#faad14' }}
                  />
                  <Dropdown
                    menu={{
                      items: [
                        {
                          key: 'reset',
                          label: '重置状态',
                          icon: <RedoOutlined />,
                        },
                      ],
                      onClick: () => handleReset('分析中', '分析中'),
                    }}
                    placement="bottomRight"
                  >
                    <Button
                      type="default"
                      size="small"
                      icon={<MoreOutlined />}
                    />
                  </Dropdown>
                </div>
              </Card>
            </Col>

            <Col xs={24} sm={12} md={6}>
              <Card>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <Statistic
                    title="分析失败"
                    value={stats?.failed || 0}
                    valueStyle={{ color: '#ff4d4f' }}
                  />
                  <Dropdown
                    menu={{
                      items: [
                        {
                          key: 'reset',
                          label: '重置状态',
                          icon: <RedoOutlined />,
                        },
                        {
                          key: 'export',
                          label: '导出列表',
                          icon: <DownloadOutlined />,
                          disabled: exporting,
                        },
                      ],
                      onClick: ({ key }) => {
                        if (key === 'reset') {
                          handleReset('分析失败', '分析失败');
                        } else if (key === 'export') {
                          handleExport();
                        }
                      },
                    }}
                    placement="bottomRight"
                  >
                    <Button
                      type="default"
                      size="small"
                      icon={<MoreOutlined />}
                      loading={exporting}
                    />
                  </Dropdown>
                </div>
              </Card>
            </Col>

            <Col xs={24} sm={12} md={6}>
              <Card>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <Statistic
                    title="笔记详情缺失"
                    value={stats?.noContent || 0}
                    valueStyle={{ color: '#8c8c8c' }}
                  />
                  <Dropdown
                    menu={{
                      items: [
                        {
                          key: 'export',
                          label: '导出列表',
                          icon: <DownloadOutlined />,
                          disabled: exportingNoContent,
                        },
                      ],
                      onClick: ({ key }) => {
                        if (key === 'export') {
                          handleExportNoContent();
                        }
                      },
                    }}
                    placement="bottomRight"
                  >
                    <Button
                      type="default"
                      size="small"
                      icon={<MoreOutlined />}
                      loading={exportingNoContent}
                    />
                  </Dropdown>
                </div>
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

