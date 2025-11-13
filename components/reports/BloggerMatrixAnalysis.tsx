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
// XLSX 将在导出时动态导入，避免类型依赖问题

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

  const slugify = (name: string): string => {
    return (name || '')
      .replace(/[\\/:*?"<>|]/g, '')
      .replace(/\s+/g, '_')
      .slice(0, 80);
  };

  const getReportName = async (): Promise<string | null> => {
    try {
      const res = await fetch(`/api/reports`);
      const data = await res.json();
      if (!data?.success) return null;
      const list: Array<{ reportId: string; reportName: string }> = data.data?.list || [];
      const found = list.find((r) => r.reportId === reportId);
      return found?.reportName || null;
    } catch {
      return null;
    }
  };

  const formatFansRange = (minFans: number, maxFans: number | null): string => {
    const toText = (n: number) => {
      if (n >= 100000000) return `${(n / 100000000).toFixed(1)}亿`;
      if (n >= 10000) return `${(n / 10000).toFixed(1)}万`;
      return `${n}`;
    };
    const minText = toText(minFans >= 0 ? minFans : 0);
    const maxText = maxFans !== null ? toText(maxFans) : '+';
    return maxFans !== null ? `${minText}-${maxText}` : `${minText}+`;
  };

  const handleExport = async () => {
    try {
      setLoading(true);
      // @ts-ignore 动态引入，无类型声明也可运行
      const XLSX: any = await import('xlsx');
      // 重新获取，包含 details
      const res = await fetch(`/api/reports/${reportId}/blogger-matrix/stats`);
      const json = await res.json();
      if (!json?.success) {
        message.error(json?.error || '导出失败：统计数据获取异常');
        return;
      }
      const rows: LevelStats[] = json.data?.rows || [];
      const details: any[] = json.data?.details || [];

      // 汇总 sheet
      // 按页面“列表展示”的字段顺序导出
      const summaryHeader = [
        '层级名称',
        '粉丝区间',
        '达人数量',
        '达人占比%',
        '笔记数量',
        '笔记占比%',
        '平均粉丝数',
        '合作金额',
        '合作金额占比%',
        '笔记单价（元/笔记）',
        '总互动量',
        '总互动量占比%',
        '点赞',
        '点赞占比%',
        '收藏',
        '收藏占比%',
        '评论',
        '评论占比%',
        '分享',
        '分享占比%',
      ];
      const summaryData = rows.map((r) => ({
        层级名称: r.levelName,
        粉丝区间: formatFansRange(r.minFans, r.maxFans),
        达人数量: r.bloggerCount,
        '达人占比%': Number.isFinite(r.bloggerPercentage) ? Number(r.bloggerPercentage.toFixed(2)) + '%' : '0.00%',
        笔记数量: r.notesCount,
        '笔记占比%': Number.isFinite(r.notesPercentage) ? Number(r.notesPercentage.toFixed(2)) + '%' : '0.00%',
        平均粉丝数: r.avgFans,
        合作金额: r.totalAdPrice,
        '合作金额占比%': Number.isFinite(r.totalAdPricePercentage) ? Number(r.totalAdPricePercentage.toFixed(2)) + '%' : '0.00%',
        '笔记单价（元/笔记）': Number.isFinite(r.adPricePerNote) ? Number(r.adPricePerNote) : 0,
        总互动量: r.totalInteraction,
        '总互动量占比%': Number.isFinite(r.totalInteractionPercentage) ? Number(r.totalInteractionPercentage.toFixed(2)) + '%' : '0.00%',
        点赞: r.totalLiked,
        '点赞占比%': Number.isFinite(r.totalLikedPercentage) ? Number(r.totalLikedPercentage.toFixed(2)) + '%' : '0.00%',
        收藏: r.totalCollected,
        '收藏占比%': Number.isFinite(r.totalCollectedPercentage) ? Number(r.totalCollectedPercentage.toFixed(2)) + '%' : '0.00%',
        评论: r.totalComments,
        '评论占比%': Number.isFinite(r.totalCommentsPercentage) ? Number(r.totalCommentsPercentage.toFixed(2)) + '%' : '0.00%',
        分享: r.totalShares,
        '分享占比%': Number.isFinite(r.totalSharesPercentage) ? Number(r.totalSharesPercentage.toFixed(2)) + '%' : '0.00%',
      }));
      const wsSummary = XLSX.utils.json_to_sheet(summaryData, { header: summaryHeader });

      // 明细 sheet：首列层级名称，其余字段与笔记列表一致
      // 移除不需要导出的字段，并使用中文表头；publishTime 格式化为 YYYY-MM-DD HH:mm:ss（不做时区换算）
      const detailKeepOrder: Array<{ key: string; label: string; format?: (v: any) => any }> = [
        { key: 'noteId', label: '笔记ID' },
        { key: 'title', label: '标题' },
        { key: 'content', label: '文本内容' },
        { key: 'coverImage', label: '封面' },
        { key: 'noteType', label: '笔记类型' },
        {
          key: 'publishTime',
          label: '发布时间',
          format: (v: any) => {
            if (!v || typeof v !== 'string') return v ?? '';
            // 例：2025-10-30T08:13:42+00:00 -> 2025-10-30 08:13:42
            const match = v.match(/^(\d{4}-\d{2}-\d{2})[T ](\d{2}:\d{2}:\d{2})/);
            if (match) return `${match[1]} ${match[2]}`;
            // 尝试 Date 解析后按本地时间格式化
            try {
              const dt = new Date(v);
              const pad = (n: number) => (n < 10 ? `0${n}` : String(n));
              return `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())} ${pad(dt.getHours())}:${pad(dt.getMinutes())}:${pad(dt.getSeconds())}`;
            } catch {
              return v;
            }
          },
        },
        { key: 'likedCount', label: '点赞' },
        { key: 'collectedCount', label: '收藏' },
        { key: 'commentsCount', label: '评论' },
        { key: 'viewCount', label: '浏览' },
        { key: 'shareCount', label: '分享' },
        { key: 'fans', label: '粉丝数' },
        { key: 'adPrice', label: '合作金额' },
        { key: 'bloggerId', label: '达人ID' },
        { key: 'bloggerNickName', label: '达人昵称' },
        { key: 'bloggerSmallAvatar', label: '头像(小)' },
        { key: 'bloggerBigAvatar', label: '头像(大)' },
        { key: 'brandName', label: '品牌' },
        { key: 'videoDuration', label: '视频时长(秒)' },
      ];
      const detailHeader = ['层级名称', ...detailKeepOrder.map((i) => i.label)];
      const detailsData = details.map((d: any) => {
        const row: Record<string, any> = { 层级名称: d.levelName };
        for (const item of detailKeepOrder) {
          const raw = d[item.key];
          row[item.label] = item.format ? item.format(raw) : raw;
        }
        return row;
      });
      const wsDetails = XLSX.utils.json_to_sheet(detailsData, { header: detailHeader });

      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, wsSummary, '汇总');
      XLSX.utils.book_append_sheet(wb, wsDetails, '明细');

      // 文件名：报告名优先，否则使用 reportId；时间戳使用 Asia/Shanghai
      const name = (await getReportName()) || '';
      const slug = name ? slugify(name) : `report-${reportId}`;
      // 生成 Asia/Shanghai 时间戳
      const now = new Date();
      const utcMs = now.getTime() + now.getTimezoneOffset() * 60000;
      const shanghaiDate = new Date(utcMs + 8 * 60 * 60000);
      const pad = (n: number) => (n < 10 ? `0${n}` : String(n));
      const ts = `${shanghaiDate.getFullYear()}${pad(shanghaiDate.getMonth() + 1)}${pad(shanghaiDate.getDate())}-${pad(shanghaiDate.getHours())}${pad(shanghaiDate.getMinutes())}${pad(shanghaiDate.getSeconds())}`;
      const filename = `${slug}_达人矩阵_汇总明细_${ts}.xlsx`;

      XLSX.writeFile(wb, filename);
    } catch (e) {
      message.error('导出失败，请稍后重试');
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
      title: '合作金额',
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
        const amount = Number.isFinite(value) ? Math.round(value) : 0;
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
          <Space>
            <Button onClick={handleExport}>
              导出Excel
            </Button>
            <Button
              icon={<SettingOutlined />}
              onClick={() => setConfigModalVisible(true)}
            >
              配置
            </Button>
          </Space>
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

