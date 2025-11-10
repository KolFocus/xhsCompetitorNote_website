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
  totalViews: number;
  totalShares: number;
  notesCount: number;
}

interface BloggerMatrixAnalysisProps {
  reportId: string;
  brandId?: string | null;
  bloggerId?: string | null;
  startDate?: string | null;
  endDate?: string | null;
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
  brandId,
  bloggerId,
  startDate,
  endDate,
}: BloggerMatrixAnalysisProps) {
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState<LevelStats[]>([]);
  const [totalBloggers, setTotalBloggers] = useState(0);
  const [configModalVisible, setConfigModalVisible] = useState(false);

  useEffect(() => {
    if (reportId) {
      loadStats();
    }
  }, [reportId, brandId, bloggerId, startDate, endDate]);

  const loadStats = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (brandId) params.set('brandId', brandId);
      if (bloggerId) params.set('bloggerId', bloggerId);
      if (startDate) params.set('startDate', startDate);
      if (endDate) params.set('endDate', endDate);

      const response = await fetch(`/api/reports/${reportId}/blogger-matrix/stats?${params}`);
      const data = await response.json();
      if (data.success) {
        setStats(data.data.levels || []);
        setTotalBloggers(data.data.totalBloggers || 0);
      } else {
        message.error(data.error || '加载统计数据失败');
      }
    } catch (error) {
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
      render: (count: number, record: LevelStats) => (
        <div>
          <div>{count}</div>
          <div style={{ fontSize: 12, color: '#999' }}>
            {totalBloggers > 0 ? `${((count / totalBloggers) * 100).toFixed(1)}%` : '0%'}
          </div>
        </div>
      ),
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
      title: '笔记数量',
      dataIndex: 'notesCount',
      key: 'notesCount',
      width: 100,
      align: 'right',
      render: (count: number) => formatNumber(count),
    },
    {
      title: '总互动量',
      dataIndex: 'totalInteraction',
      key: 'totalInteraction',
      width: 120,
      align: 'right',
      render: (interaction: number) => formatNumber(interaction),
    },
    {
      title: '点赞',
      dataIndex: 'totalLiked',
      key: 'totalLiked',
      width: 100,
      align: 'right',
      render: (count: number) => formatNumber(count),
    },
    {
      title: '收藏',
      dataIndex: 'totalCollected',
      key: 'totalCollected',
      width: 100,
      align: 'right',
      render: (count: number) => formatNumber(count),
    },
    {
      title: '评论',
      dataIndex: 'totalComments',
      key: 'totalComments',
      width: 100,
      align: 'right',
      render: (count: number) => formatNumber(count),
    },
    {
      title: '浏览',
      dataIndex: 'totalViews',
      key: 'totalViews',
      width: 100,
      align: 'right',
      render: (count: number) => formatNumber(count),
    },
    {
      title: '分享',
      dataIndex: 'totalShares',
      key: 'totalShares',
      width: 100,
      align: 'right',
      render: (count: number) => formatNumber(count),
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

