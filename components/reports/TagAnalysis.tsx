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
  Select,
} from 'antd';
import { useRouter } from 'next/navigation';
import type { ColumnsType } from 'antd/es/table';
import { SettingOutlined } from '@ant-design/icons';
// XLSX 将在导出时动态导入，避免类型依赖问题

const { Title } = Typography;
const { Option } = Select;

interface TagStats {
  tagId: string | null;
  tagName: string;
  notesCount: number;
  notesPercentage: number;
  bloggerCount: number;
  bloggerPercentage: number;
  avgFans: number;
  totalInteraction: number;
  totalInteractionPercentage: number;
  totalLiked: number;
  totalLikedPercentage: number;
  totalCollected: number;
  totalCollectedPercentage: number;
  totalComments: number;
  totalCommentsPercentage: number;
  totalShares: number;
  totalSharesPercentage: number;
  totalAdPrice: number;
  totalAdPricePercentage: number;
  adPricePerNote: number;
}

interface TagSetDTO {
  tagSetId: string;
  tagSetName: string;
  description: string | null;
  type: 'system' | 'custom';
  userId: string | null;
  createdAt: string;
  updatedAt: string;
  tags?: Array<{
    tagId: string;
    tagSetId: string;
    tagName: string;
    userId: string | null;
    createdAt: string;
    updatedAt: string;
  }>;
}

interface TagAnalysisProps {
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

export default function TagAnalysis({
  reportId,
  refreshKey,
}: TagAnalysisProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState<TagStats[]>([]);
  const [tagSets, setTagSets] = useState<TagSetDTO[]>([]);
  const [selectedTagSetId, setSelectedTagSetId] = useState<string | null>(null);

  // 加载标签系列列表
  useEffect(() => {
    loadTagSets();
  }, []);

  // 当标签系列或refreshKey变化时，重新加载统计数据
  useEffect(() => {
    if (reportId && selectedTagSetId) {
      loadStats();
    } else {
      setStats([]);
    }
  }, [reportId, selectedTagSetId, refreshKey]);

  const loadTagSets = async () => {
    try {
      const response = await fetch('/api/tag-sets?withTags=true&includeSystem=true');
      const data = await response.json();
      if (data.success) {
        const items: TagSetDTO[] = data.data.items || [];
        setTagSets(items);
        // 默认选择第一个标签系列
        if (items.length > 0 && !selectedTagSetId) {
          setSelectedTagSetId(items[0].tagSetId);
        }
      } else {
        message.error(data.error || '加载标签系列失败');
      }
    } catch (error) {
      console.error('Failed to fetch tag sets', error);
      message.error('加载标签系列失败');
    }
  };

  const loadStats = async () => {
    if (!selectedTagSetId) {
      setStats([]);
      return;
    }

    try {
      setLoading(true);
      const response = await fetch(
        `/api/reports/${reportId}/tag-analysis/stats?tagSetId=${selectedTagSetId}`
      );
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

  const getTagSetName = (): string => {
    const tagSet = tagSets.find((ts) => ts.tagSetId === selectedTagSetId);
    return tagSet?.tagSetName || '未知标签系列';
  };

  const handleExport = async () => {
    if (!selectedTagSetId) {
      message.warning('请先选择标签系列');
      return;
    }

    try {
      setLoading(true);
      // @ts-ignore 动态引入，无类型声明也可运行
      const XLSX: any = await import('xlsx');
      // 重新获取，包含 details
      const res = await fetch(
        `/api/reports/${reportId}/tag-analysis/stats?tagSetId=${selectedTagSetId}`
      );
      const json = await res.json();
      if (!json?.success) {
        message.error(json?.error || '导出失败：统计数据获取异常');
        return;
      }
      const rows: TagStats[] = json.data?.rows || [];
      const details: any[] = json.data?.details || [];

      // 汇总 sheet
      const summaryHeader = [
        '标签名称',
        '笔记数量',
        '笔记占比%',
        '达人数量',
        '达人占比%',
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
        标签名称: r.tagName,
        笔记数量: r.notesCount,
        '笔记占比%': Number.isFinite(r.notesPercentage) ? Number(r.notesPercentage.toFixed(2)) + '%' : '0.00%',
        达人数量: r.bloggerCount,
        '达人占比%': Number.isFinite(r.bloggerPercentage) ? Number(r.bloggerPercentage.toFixed(2)) + '%' : '0.00%',
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

      // 明细 sheet：首列标签名称，其余字段与笔记列表一致
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
            const match = v.match(/^(\d{4}-\d{2}-\d{2})[T ](\d{2}:\d{2}:\d{2})/);
            if (match) return `${match[1]} ${match[2]}`;
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
      const detailHeader = ['标签名称', ...detailKeepOrder.map((i) => i.label)];
      const detailsData = details.map((d: any) => {
        const row: Record<string, any> = { 标签名称: d.tagName };
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
      const tagSetName = slugify(getTagSetName());
      const now = new Date();
      const utcMs = now.getTime() + now.getTimezoneOffset() * 60000;
      const shanghaiDate = new Date(utcMs + 8 * 60 * 60000);
      const pad = (n: number) => (n < 10 ? `0${n}` : String(n));
      const ts = `${shanghaiDate.getFullYear()}${pad(shanghaiDate.getMonth() + 1)}${pad(shanghaiDate.getDate())}-${pad(shanghaiDate.getHours())}${pad(shanghaiDate.getMinutes())}${pad(shanghaiDate.getSeconds())}`;
      const filename = `${slug}_${tagSetName}_标签分析_汇总明细_${ts}.xlsx`;

      XLSX.writeFile(wb, filename);
    } catch (e) {
      message.error('导出失败，请稍后重试');
    } finally {
      setLoading(false);
    }
  };

  const handleConfigure = () => {
    if (!selectedTagSetId) {
      message.warning('请先选择标签系列');
      return;
    }

    const params = new URLSearchParams({
      tagSetId: selectedTagSetId,
      reportId,
    });

    if (reportId) {
      params.set('reportId', reportId);
    }

    router.push(`/dashboard/notes/tagging?${params.toString()}`);
  };

  const columns: ColumnsType<TagStats> = [
    {
      title: '标签名称',
      dataIndex: 'tagName',
      key: 'tagName',
      width: 150,
      fixed: 'left',
      render: (text: string, record: TagStats) => {
        const isTotal = record.tagName === '总计';
        const isUntagged = record.tagName === '未打标';
        return (
          <div>
            <div style={{ fontWeight: isTotal ? 600 : isUntagged ? 500 : 400 }}>
              {text}
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
      render: (count: number, record: TagStats) => {
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
      title: '达人数量',
      dataIndex: 'bloggerCount',
      key: 'bloggerCount',
      width: 100,
      align: 'right',
      render: (count: number, record: TagStats) => {
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
      render: (amount: number, record: TagStats) => {
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
      render: (interaction: number, record: TagStats) => {
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
      render: (count: number, record: TagStats) => {
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
      render: (count: number, record: TagStats) => {
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
      render: (count: number, record: TagStats) => {
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
      render: (count: number, record: TagStats) => {
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
    <Card
      title={
        <Space>
          <Title level={5} style={{ margin: 0 }}>
            内容矩阵属性分析
          </Title>
        </Space>
      }
      extra={
        <Space>
          <Select
            value={selectedTagSetId || undefined}
            onChange={(value) => setSelectedTagSetId(value)}
            placeholder="选择标签系列"
            style={{ width: 200 }}
            allowClear={false}
          >
            {tagSets.map((tagSet) => (
              <Option key={tagSet.tagSetId} value={tagSet.tagSetId}>
                {tagSet.tagSetName} {tagSet.type === 'system' ? '(系统)' : ''}
              </Option>
            ))}
          </Select>
          <Button onClick={handleExport} disabled={!selectedTagSetId || stats.length === 0}>
            导出Excel
          </Button>
          <Button
            icon={<SettingOutlined />}
            onClick={handleConfigure}
            disabled={!selectedTagSetId}
          >
            配置
          </Button>
        </Space>
      }
    >
      <Spin spinning={loading}>
        {!selectedTagSetId ? (
          <div style={{ textAlign: 'center', padding: 40, color: '#999' }}>
            请选择标签系列
          </div>
        ) : stats.length > 0 ? (
          <Table
            columns={columns}
            dataSource={stats}
            rowKey={(record) => record.tagId || record.tagName}
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
  );
}

