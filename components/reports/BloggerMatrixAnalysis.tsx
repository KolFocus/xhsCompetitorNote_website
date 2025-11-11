'use client';

import React, { useState, useEffect, useMemo } from 'react';
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
  refreshKey?: number;
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
  const [totalBloggers, setTotalBloggers] = useState(0);
  const [configModalVisible, setConfigModalVisible] = useState(false);

  const totals = useMemo(() => {
    const sum = <T extends keyof LevelStats>(list: LevelStats[], key: T): number =>
      list.reduce((acc, cur) => acc + (Number(cur[key]) || 0), 0);
    // 由于 KOL 行与其他层级重叠，合计时排除 KOL 行，避免双计
    const rowsWithoutKOL = stats.filter((s) => s.levelId !== 'kol');
    const bloggerTotal = totalBloggers || sum(stats, 'bloggerCount');
    return {
      bloggerCount: bloggerTotal,
      avgFansWeighted:
        bloggerTotal > 0
          ? Math.round(
              rowsWithoutKOL.reduce(
                (acc, cur) => acc + (cur.avgFans || 0) * (cur.bloggerCount || 0),
                0
              ) / bloggerTotal
            )
          : 0,
      notesCount: sum(rowsWithoutKOL, 'notesCount'),
      totalInteraction: sum(rowsWithoutKOL, 'totalInteraction'),
      totalLiked: sum(rowsWithoutKOL, 'totalLiked'),
      totalCollected: sum(rowsWithoutKOL, 'totalCollected'),
      totalComments: sum(rowsWithoutKOL, 'totalComments'),
      totalViews: sum(rowsWithoutKOL, 'totalViews'),
      totalShares: sum(rowsWithoutKOL, 'totalShares'),
    };
  }, [stats, totalBloggers]);

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
      render: (count: number) => (
        <div>
          <div>{formatNumber(count)}</div>
          <div style={{ fontSize: 12, color: '#999' }}>
            {totals.notesCount > 0 ? `${((count / totals.notesCount) * 100).toFixed(1)}%` : '0%'}
          </div>
        </div>
      ),
    },
    {
      title: '总互动量',
      dataIndex: 'totalInteraction',
      key: 'totalInteraction',
      width: 120,
      align: 'right',
      render: (interaction: number) => (
        <div>
          <div>{formatNumber(interaction)}</div>
          <div style={{ fontSize: 12, color: '#999' }}>
            {totals.totalInteraction > 0
              ? `${((interaction / totals.totalInteraction) * 100).toFixed(1)}%`
              : '0%'}
          </div>
        </div>
      ),
    },
    {
      title: '点赞',
      dataIndex: 'totalLiked',
      key: 'totalLiked',
      width: 100,
      align: 'right',
      render: (count: number) => (
        <div>
          <div>{formatNumber(count)}</div>
          <div style={{ fontSize: 12, color: '#999' }}>
            {totals.totalLiked > 0 ? `${((count / totals.totalLiked) * 100).toFixed(1)}%` : '0%'}
          </div>
        </div>
      ),
    },
    {
      title: '收藏',
      dataIndex: 'totalCollected',
      key: 'totalCollected',
      width: 100,
      align: 'right',
      render: (count: number) => (
        <div>
          <div>{formatNumber(count)}</div>
          <div style={{ fontSize: 12, color: '#999' }}>
            {totals.totalCollected > 0
              ? `${((count / totals.totalCollected) * 100).toFixed(1)}%`
              : '0%'}
          </div>
        </div>
      ),
    },
    {
      title: '评论',
      dataIndex: 'totalComments',
      key: 'totalComments',
      width: 100,
      align: 'right',
      render: (count: number) => (
        <div>
          <div>{formatNumber(count)}</div>
          <div style={{ fontSize: 12, color: '#999' }}>
            {totals.totalComments > 0
              ? `${((count / totals.totalComments) * 100).toFixed(1)}%`
              : '0%'}
          </div>
        </div>
      ),
    },
    {
      title: '浏览',
      dataIndex: 'totalViews',
      key: 'totalViews',
      width: 100,
      align: 'right',
      render: (count: number) => (
        <div>
          <div>{formatNumber(count)}</div>
          <div style={{ fontSize: 12, color: '#999' }}>
            {totals.totalViews > 0 ? `${((count / totals.totalViews) * 100).toFixed(1)}%` : '0%'}
          </div>
        </div>
      ),
    },
    {
      title: '分享',
      dataIndex: 'totalShares',
      key: 'totalShares',
      width: 100,
      align: 'right',
      render: (count: number) => (
        <div>
          <div>{formatNumber(count)}</div>
          <div style={{ fontSize: 12, color: '#999' }}>
            {totals.totalShares > 0
              ? `${((count / totals.totalShares) * 100).toFixed(1)}%`
              : '0%'}
          </div>
        </div>
      ),
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
              summary={(pageData) => {
                const sum = <T extends keyof LevelStats>(key: T): number =>
                  pageData.reduce((acc, cur) => acc + (Number(cur[key]) || 0), 0);
                // 合计时排除 KOL 行，避免与其他层级重叠导致双计
                const rowsWithoutKOL = pageData.filter((row) => row.levelId !== 'kol');
                const sumNoKOL = <T extends keyof LevelStats>(key: T): number =>
                  rowsWithoutKOL.reduce((acc, cur) => acc + (Number(cur[key]) || 0), 0);
                const totalBloggerCount = totalBloggers || sum('bloggerCount');
                const weightedAvgFans =
                  totalBloggerCount > 0
                    ? Math.round(
                        rowsWithoutKOL.reduce(
                          (acc, cur) => acc + (cur.avgFans || 0) * (cur.bloggerCount || 0),
                          0
                        ) / totalBloggerCount
                      )
                    : 0;
                const totalNotes = sumNoKOL('notesCount');
                const totalInteraction = sumNoKOL('totalInteraction');
                const totalLiked = sumNoKOL('totalLiked');
                const totalCollected = sumNoKOL('totalCollected');
                const totalComments = sumNoKOL('totalComments');
                const totalViews = sumNoKOL('totalViews');
                const totalShares = sumNoKOL('totalShares');
                return (
                  <Table.Summary fixed>
                    <Table.Summary.Row>
                      <Table.Summary.Cell index={0}>
                        <span style={{ fontWeight: 600 }}>总计</span>
                      </Table.Summary.Cell>
                      <Table.Summary.Cell index={1} align="right">
                        <div>{formatNumber(totalBloggerCount)}</div>
                        <div style={{ fontSize: 12, color: '#999' }}>
                          {totalBloggerCount > 0 ? '100.0%' : '0%'}
                        </div>
                      </Table.Summary.Cell>
                      <Table.Summary.Cell index={2} align="right">
                        {formatNumber(weightedAvgFans)}
                      </Table.Summary.Cell>
                      <Table.Summary.Cell index={3} align="right">
                        <div>{formatNumber(totalNotes)}</div>
                        <div style={{ fontSize: 12, color: '#999' }}>
                          {totalNotes > 0 ? '100.0%' : '0%'}
                        </div>
                      </Table.Summary.Cell>
                      <Table.Summary.Cell index={4} align="right">
                        <div>{formatNumber(totalInteraction)}</div>
                        <div style={{ fontSize: 12, color: '#999' }}>
                          {totalInteraction > 0 ? '100.0%' : '0%'}
                        </div>
                      </Table.Summary.Cell>
                      <Table.Summary.Cell index={5} align="right">
                        <div>{formatNumber(totalLiked)}</div>
                        <div style={{ fontSize: 12, color: '#999' }}>
                          {totalLiked > 0 ? '100.0%' : '0%'}
                        </div>
                      </Table.Summary.Cell>
                      <Table.Summary.Cell index={6} align="right">
                        <div>{formatNumber(totalCollected)}</div>
                        <div style={{ fontSize: 12, color: '#999' }}>
                          {totalCollected > 0 ? '100.0%' : '0%'}
                        </div>
                      </Table.Summary.Cell>
                      <Table.Summary.Cell index={7} align="right">
                        <div>{formatNumber(totalComments)}</div>
                        <div style={{ fontSize: 12, color: '#999' }}>
                          {totalComments > 0 ? '100.0%' : '0%'}
                        </div>
                      </Table.Summary.Cell>
                      <Table.Summary.Cell index={8} align="right">
                        <div>{formatNumber(totalViews)}</div>
                        <div style={{ fontSize: 12, color: '#999' }}>
                          {totalViews > 0 ? '100.0%' : '0%'}
                        </div>
                      </Table.Summary.Cell>
                      <Table.Summary.Cell index={9} align="right">
                        <div>{formatNumber(totalShares)}</div>
                        <div style={{ fontSize: 12, color: '#999' }}>
                          {totalShares > 0 ? '100.0%' : '0%'}
                        </div>
                      </Table.Summary.Cell>
                    </Table.Summary.Row>
                  </Table.Summary>
                );
              }}
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

