'use client';

import React, { useState, useEffect } from 'react';
import {
  Card,
  Table,
  Button,
  Space,
  message,
  Spin,
  Typography,
} from 'antd';
import {
  SettingOutlined,
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import BloggerMatrixConfigModal from './BloggerMatrixConfigModal';

const { Title } = Typography;

interface LevelStats {
  levelId: string;
  levelName: string;
  minFans: number;
  maxFans: number | null;
  bloggerCount: number;
  bloggerPercentage: number;
  avgFans: number;
  totalInteraction: number;
  totalLiked: number;
  totalCollected: number;
  totalComments: number;
  totalShares: number;
  totalAdPrice: number;
  adPricePerNote: number;
  notesCount: number;
  notesPercentage: number;
  totalInteractionPercentage: number;
  totalLikedPercentage: number;
  totalCollectedPercentage: number;
  totalCommentsPercentage: number;
  totalSharesPercentage: number;
  totalAdPricePercentage: number;
}

interface BloggerMatrixAnalysisProps {
  reportId: string;
  refreshKey?: number;
}

interface LevelTotals {
  bloggerCount: number;
  avgFansWeighted: number;
  notesCount: number;
  totalInteraction: number;
  totalLiked: number;
  totalCollected: number;
  totalComments: number;
  totalViews: number;
  totalShares: number;
}

// 格式化数字
const formatNumber = (num: number): string => {
  if (num >= 100000000) {
    return `${(num / 100000000).toFixed(1)}亿`;
  }
  if (num >= 10000) {
    return `${(num / 10000).toFixed(1)}万`;
  }
  return num.toLocaleString();
};

export default function BloggerMatrixAnalysis({
  reportId,
  refreshKey,
}: BloggerMatrixAnalysisProps) {
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState<LevelStats[]>([]);
  const [configModalVisible, setConfigModalVisible] = useState(false);

  useEffect(() => {
    if (reportId) {
      loadStats();
    }
  }, [reportId, refreshKey]);

  const loadStats = async () => {
    try {
      setLoading(true);
      // 分析基于当前报告的有效笔记全集，不受列表筛选影响
      const response = await fetch(`/api/reports/${reportId}/blogger-matrix/stats`);
      const data = await response.json();
      if (data.success) {
        setStats(data.data.rows || []);
      } else {
        setStats([]);
        message.error(data.error || '加载统计数据失败');
      }
    } catch (error) {
      setStats([]);
      message.error('加载统计数据失败');
    } finally {
      setLoading(false);
    }
  };

  const columns: ColumnsType<LevelStats> = [
    {
      title: '层级',
      dataIndex: 'levelName',
      key: 'levelName',
      width: 120,
      fixed: 'left',
      render: (text: string, record: LevelStats) => {
        const isKol = record.levelId === 'kol';
        return (
          <div>
            <div style={{ fontWeight: isKol ? 600 : 500 }}>{text}</div>
            <div style={{ fontSize: 12, color: '#999' }}>
              {isKol
                ? '加V达人'
                : (
                  <>
                    {record.minFans >= 0 && formatNumber(record.minFans)}
                    {record.maxFans !== null ? ` - ${formatNumber(record.maxFans)}` : '+'}
                  </>
                )}
            </div>
          </div>
        );
      },
    },
    {
      title: '达人数量',
      dataIndex: 'bloggerCount',
      key: 'bloggerCount',
      width: 100,
      align: 'right',
      render: (count: number, record: LevelStats) => {
        const percentage =
          typeof record.bloggerPercentage === 'number' ? record.bloggerPercentage : 0;
        return (
          <div>
            <div>{count}</div>
            <div style={{ fontSize: 12, color: '#999' }}>
              {`${percentage.toFixed(1)}%`}
            </div>
          </div>
        );
      },
    },
    {
      title: '笔记数量',
      dataIndex: 'notesCount',
      key: 'notesCount',
      width: 100,
      align: 'right',
      render: (count: number, record: LevelStats) => {
        const percentage =
          typeof record.notesPercentage === 'number' ? record.notesPercentage : 0;
        return (
          <div>
            <div>{formatNumber(count)}</div>
            <div style={{ fontSize: 12, color: '#999' }}>
              {`${percentage.toFixed(1)}%`}
            </div>
          </div>
        );
      },
    },
    {
      title: '平均粉丝数',
      dataIndex: 'avgFans',
      key: 'avgFans',
      width: 120,
      align: 'right',
      render: (fans: number) => formatNumber(fans),
    },
    {
      title: '投放金额',
      dataIndex: 'totalAdPrice',
      key: 'totalAdPrice',
      width: 120,
      align: 'right',
      render: (amount: number, record: LevelStats) => {
        const percentage =
          typeof record.totalAdPricePercentage === 'number'
            ? record.totalAdPricePercentage
            : 0;
        return (
          <div>
            <div>{formatNumber(amount)}</div>
            <div style={{ fontSize: 12, color: '#999' }}>
              {`${percentage.toFixed(1)}%`}
            </div>
          </div>
        );
      },
    },    
    {
      title: '笔记单价',
      dataIndex: 'adPricePerNote',
      key: 'adPricePerNote',
      width: 120,
      align: 'right',
      render: (value: number) => {
        const amount = Number.isFinite(value) ? Number(value) : 0;
        return (
          <div>
            <div>{formatNumber(amount)}</div>
            <div style={{ fontSize: 12, color: '#999' }}>元/笔记</div>
          </div>
        );
      },
    },
    {
      title: '总互动量',
      dataIndex: 'totalInteraction',
      key: 'totalInteraction',
      width: 120,
      align: 'right',
      render: (interaction: number, record: LevelStats) => {
        const percentage =
          typeof record.totalInteractionPercentage === 'number'
            ? record.totalInteractionPercentage
            : 0;
        return (
          <div>
            <div>{formatNumber(interaction)}</div>
            <div style={{ fontSize: 12, color: '#999' }}>
              {`${percentage.toFixed(1)}%`}
            </div>
          </div>
        );
      },
    },
    {
      title: '点赞',
      dataIndex: 'totalLiked',
      key: 'totalLiked',
      width: 100,
      align: 'right',
      render: (count: number, record: LevelStats) => {
        const percentage =
          typeof record.totalLikedPercentage === 'number' ? record.totalLikedPercentage : 0;
        return (
          <div>
            <div>{formatNumber(count)}</div>
            <div style={{ fontSize: 12, color: '#999' }}>
              {`${percentage.toFixed(1)}%`}
            </div>
          </div>
        );
      },
    },
    {
      title: '收藏',
      dataIndex: 'totalCollected',
      key: 'totalCollected',
      width: 100,
      align: 'right',
      render: (count: number, record: LevelStats) => {
        const percentage =
          typeof record.totalCollectedPercentage === 'number'
            ? record.totalCollectedPercentage
            : 0;
        return (
          <div>
            <div>{formatNumber(count)}</div>
            <div style={{ fontSize: 12, color: '#999' }}>
              {`${percentage.toFixed(1)}%`}
            </div>
          </div>
        );
      },
    },
    {
      title: '评论',
      dataIndex: 'totalComments',
      key: 'totalComments',
      width: 100,
      align: 'right',
      render: (count: number, record: LevelStats) => {
        const percentage =
          typeof record.totalCommentsPercentage === 'number'
            ? record.totalCommentsPercentage
            : 0;
        return (
          <div>
            <div>{formatNumber(count)}</div>
            <div style={{ fontSize: 12, color: '#999' }}>
              {`${percentage.toFixed(1)}%`}
            </div>
          </div>
        );
      },
    },
    {
      title: '分享',
      dataIndex: 'totalShares',
      key: 'totalShares',
      width: 100,
      align: 'right',
      render: (count: number, record: LevelStats) => {
        const percentage =
          typeof record.totalSharesPercentage === 'number'
            ? record.totalSharesPercentage
            : 0;
        return (
          <div>
            <div>{formatNumber(count)}</div>
            <div style={{ fontSize: 12, color: '#999' }}>
              {`${percentage.toFixed(1)}%`}
            </div>
          </div>
        );
      },
    },
  ];

  return (
    <>
      <Card
        title={
          <Space>
            <Title level={5} style={{ margin: 0 }}>
              达人矩阵属性分析
            </Title>
          </Space>
        }
        extra={
          <Button
            icon={<SettingOutlined />}
            onClick={() => setConfigModalVisible(true)}
          >
            配置
          </Button>
        }
      >
        <Spin spinning={loading}>
          {stats.length > 0 ? (
            <Table
              columns={columns}
              dataSource={stats}
              rowKey="levelId"
              pagination={false}
              scroll={{ x: 1000 }}
              size="small"
            />
          ) : (
            <div style={{ textAlign: 'center', padding: 40, color: '#999' }}>
              暂无数据
            </div>
          )}
        </Spin>
      </Card>

      <BloggerMatrixConfigModal
        open={configModalVisible}
        reportId={reportId}
        onCancel={() => setConfigModalVisible(false)}
        onSuccess={() => {
          loadStats();
        }}
      />
    </>
  );
}

