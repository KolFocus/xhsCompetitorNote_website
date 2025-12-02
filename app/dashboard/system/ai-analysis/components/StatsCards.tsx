'use client';

import React from 'react';
import { Card, Row, Col, Statistic, Button, Dropdown, Typography } from 'antd';
import {
  ReloadOutlined,
  MoreOutlined,
  EyeOutlined,
  RedoOutlined,
  DownloadOutlined,
} from '@ant-design/icons';
import type { AiStats } from '../types';

const { Text } = Typography;

interface StatsCardsProps {
  stats: AiStats | null;
  loading: boolean;
  countdown: number;
  exporting: boolean;
  exportingNoContent: boolean;
  exportingNoteInvalid: boolean;
  onRefresh: () => void;
  onViewPendingList: () => void;
  onResetProcessing: () => void;
  onViewFailedList: () => void;
  onResetFailed: () => void;
  onExportFailed: () => void;
  onExportNoContent: () => void;
  onExportNoteInvalid: () => void;
}

export function StatsCards({
  stats,
  loading,
  countdown,
  exporting,
  exportingNoContent,
  exportingNoteInvalid,
  onRefresh,
  onViewPendingList,
  onResetProcessing,
  onViewFailedList,
  onResetFailed,
  onExportFailed,
  onExportNoContent,
  onExportNoteInvalid,
}: StatsCardsProps) {
  return (
    <Card
      title="当前分析情况"
      extra={
        <Button icon={<ReloadOutlined />} onClick={onRefresh} loading={loading}>
          刷新 ({countdown}s)
        </Button>
      }
      style={{ marginBottom: 24 }}
    >
      <Row gutter={[16, 16]}>
        <Col xs={24} sm={12} md={6}>
          <Card>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <Statistic
                title="待分析"
                value={stats?.pending || 0}
                valueStyle={{ color: '#1890ff' }}
              />
              <Dropdown
                menu={{
                  items: [
                    {
                      key: 'view',
                      label: '查看列表',
                      icon: <EyeOutlined />,
                    },
                  ],
                  onClick: ({ key }) => {
                    if (key === 'view') {
                      onViewPendingList();
                    }
                  },
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
                  onClick: () => onResetProcessing(),
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
                      key: 'view',
                      label: '查看列表',
                      icon: <EyeOutlined />,
                    },
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
                    if (key === 'view') {
                      onViewFailedList();
                    } else if (key === 'reset') {
                      onResetFailed();
                    } else if (key === 'export') {
                      onExportFailed();
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
                      onExportNoContent();
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

        <Col xs={24} sm={12} md={6}>
          <Card>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <Statistic
                title="笔记不可见"
                value={stats?.noteInvalid || 0}
                valueStyle={{ color: '#d4380d' }}
                suffix={
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    (已删除/下架)
                  </Text>
                }
              />
              <Dropdown
                menu={{
                  items: [
                    {
                      key: 'export',
                      label: '导出列表',
                      icon: <DownloadOutlined />,
                      disabled: exportingNoteInvalid,
                    },
                  ],
                  onClick: ({ key }) => {
                    if (key === 'export') {
                      onExportNoteInvalid();
                    }
                  },
                }}
                placement="bottomRight"
              >
                <Button
                  type="default"
                  size="small"
                  icon={<MoreOutlined />}
                  loading={exportingNoteInvalid}
                />
              </Dropdown>
            </div>
          </Card>
        </Col>
      </Row>
    </Card>
  );
}

