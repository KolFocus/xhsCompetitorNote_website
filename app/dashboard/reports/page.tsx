'use client';

// 标记为动态渲染
export const dynamic = 'force-dynamic';

/**
 * 报告详情页面
 */
import React, { useState, useEffect } from 'react';
import {
  Card,
  Row,
  Col,
  Select,
  DatePicker,
  Button,
  Space,
  Table,
  Tag,
  Image,
  Avatar,
  Tooltip,
  Statistic,
  Tabs,
  message,
  Empty,
  Modal,
  Spin,
} from 'antd';
import {
  PlusOutlined,
  ReloadOutlined,
  VideoCameraOutlined,
  PictureOutlined,
  LikeOutlined,
  EyeOutlined,
  CommentOutlined,
  ShareAltOutlined,
  FileTextOutlined,
  DeleteOutlined,
  EyeInvisibleOutlined,
  UndoOutlined,
  QuestionCircleOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import type { Dayjs } from 'dayjs';
import type { ColumnsType, TableProps } from 'antd/es/table';
import 'dayjs/locale/zh-cn';
import CreateReportModal from '@/components/reports/CreateReportModal';
import AddNotesModal from '@/components/reports/AddNotesModal';
import BloggerMatrixAnalysis from '@/components/reports/BloggerMatrixAnalysis';
import { useRouter } from 'next/navigation';

dayjs.locale('zh-cn');

const { RangePicker } = DatePicker;
const { Option } = Select;

// 图片代理服务
const PROXY_BASE_URL = 'https://www.xhstool.cc/api/proxy';

const getProxiedImageUrl = (url: string | null | undefined): string | undefined => {
  if (!url) return undefined;
  if (url.includes('xhstool.cc/api/proxy')) return url;
  if (url.startsWith('/')) return url;
  return `${PROXY_BASE_URL}?url=${encodeURIComponent(url)}`;
};

interface Report {
  reportId: string;
  reportName: string;
  createdAt: string;
  updatedAt: string;
  activeNotesCount: number;
  ignoredNotesCount: number;
}

interface ReportDetail extends Report {
  earliestNoteTime: string | null;
  latestNoteTime: string | null;
  brands: Array<{ brandId: string; brandName: string }>;
}

interface Note {
  noteId: string;
  title: string;
  content: string | null;
  coverImage: string | null;
  noteType: string;
  isBusiness: boolean;
  isAdNote: boolean;
  publishTime: string;
  likedCount: number;
  collectedCount: number;
  commentsCount: number;
  viewCount: number;
  shareCount: number;
  fans?: number | null;
  adPrice?: number | null; // 分
  bloggerId: string;
  bloggerNickName: string;
  bloggerSmallAvatar: string | null;
  bloggerBigAvatar: string | null;
  officialVerified?: boolean | null;
  brandId: string | null;
  brandIdKey: string | null;
  brandName: string | null;
  videoDuration: string | null;
  status: string;
  addedAt: string;
}

export default function ReportsPage() {
  const router = useRouter();
  const [reports, setReports] = useState<Report[]>([]);
  const [reportId, setReportId] = useState<string | null>(null);
  const [reportDetail, setReportDetail] = useState<ReportDetail | null>(null);
  const [notes, setNotes] = useState<Note[]>([]);
  const [reportsLoading, setReportsLoading] = useState(true); // 报告列表加载状态
  const [loading, setLoading] = useState(false); // 报告详情加载状态
  const [notesLoading, setNotesLoading] = useState(false); // 笔记列表加载状态
  const [activeTab, setActiveTab] = useState<'active' | 'ignored'>('active');
  const [selectedNoteIds, setSelectedNoteIds] = useState<string[]>([]);
  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [addNotesModalVisible, setAddNotesModalVisible] = useState(false);
  // 达人矩阵分析刷新键，仅在有效集合变化时递增
  const [analysisRefreshKey, setAnalysisRefreshKey] = useState(0);

  // 自定义滚动条样式
  React.useEffect(() => {
    const style = document.createElement('style');
    style.textContent = `
      .tooltip-scrollable::-webkit-scrollbar {
        width: 6px;
      }
      .tooltip-scrollable::-webkit-scrollbar-track {
        background: rgba(255, 255, 255, 0.1);
        border-radius: 3px;
      }
      .tooltip-scrollable::-webkit-scrollbar-thumb {
        background: rgba(255, 255, 255, 0.3);
        border-radius: 3px;
      }
      .tooltip-scrollable::-webkit-scrollbar-thumb:hover {
        background: rgba(255, 255, 255, 0.5);
      }
    `;
    document.head.appendChild(style);
    return () => {
      document.head.removeChild(style);
    };
  }, []);

  // 筛选条件
  const [brandId, setBrandId] = useState<string | null>(null);
  const [bloggerId, setBloggerId] = useState<string | null>(null);
  const [dateRange, setDateRange] = useState<[Dayjs, Dayjs] | null>(null);

  // 排序状态（默认：publishTime 降序）
  const [sortField, setSortField] = useState<string>('publishTime');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  // 加载报告列表
  useEffect(() => {
    loadReports();
  }, []);

  // 加载报告详情
  useEffect(() => {
    if (reportId) {
      loadReportDetail(reportId);
      loadNotes();
    }
  }, [reportId, activeTab, brandId, bloggerId, dateRange, sortField, sortOrder]);

  const loadReports = async () => {
    try {
      setReportsLoading(true);
      const response = await fetch('/api/reports');
      const data = await response.json();
      if (data.success) {
        setReports(data.data.list);
        // 默认选中最新创建的报告
        if (data.data.list.length > 0 && !reportId) {
          setReportId(data.data.list[0].reportId);
        }
      }
    } catch (error) {
      message.error('加载报告列表失败');
    } finally {
      setReportsLoading(false);
    }
  };

  const loadReportDetail = async (id: string) => {
    try {
      setLoading(true);
      const response = await fetch(`/api/reports/${id}`);
      const data = await response.json();
      if (data.success) {
        setReportDetail(data.data);
      }
    } catch (error) {
      message.error('加载报告详情失败');
    } finally {
      setLoading(false);
    }
  };

  const loadNotes = async () => {
    if (!reportId) return;
    
    try {
      setNotesLoading(true);
      const params = new URLSearchParams({
        page: '1',
        pageSize: '20',
        status: activeTab,
      });
      if (brandId) params.set('brandId', brandId);
      if (bloggerId) params.set('bloggerId', bloggerId);
      if (dateRange) {
        params.set('startDate', dateRange[0].format('YYYY-MM-DD'));
        params.set('endDate', dateRange[1].format('YYYY-MM-DD'));
      }
      if (sortField) {
        params.set('orderBy', sortField);
        params.set('order', sortOrder);
      }

      const response = await fetch(`/api/reports/${reportId}/notes?${params}`);
      const data = await response.json();
      if (data.success) {
        setNotes(data.data.list);
      }
    } catch (error) {
      message.error('加载笔记列表失败');
    } finally {
      setNotesLoading(false);
    }
  };

  const handleBatchAction = async (action: 'ignore' | 'delete' | 'restore', noteIds?: string[]) => {
    const idsToProcess = noteIds || selectedNoteIds;
    if (!reportId || idsToProcess.length === 0) return;

    if (action === 'delete') {
      Modal.confirm({
        title: '确认删除',
        content: `确定要删除选中的 ${idsToProcess.length} 条笔记吗？此操作会从当前报告中移除${idsToProcess.length === 1 ? '该笔记' : '这些笔记'}，但不会导致笔记从系统中删除。`,
        onOk: async () => {
          try {
            const response = await fetch(`/api/reports/${reportId}/notes/batch-action`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ action, noteIds: idsToProcess }),
            });
            const data = await response.json();
            if (data.success) {
              message.success('操作成功');
              setSelectedNoteIds([]);
              loadNotes();
              loadReportDetail(reportId);
              // 有效集合发生变化，触发达人矩阵重新分析
              setAnalysisRefreshKey((k) => k + 1);
            } else {
              message.error(data.error || '操作失败');
            }
          } catch (error) {
            message.error('操作失败');
          }
        },
      });
    } else if (action === 'ignore') {
      Modal.confirm({
        title: '确认忽略',
        content: `确定忽略${idsToProcess.length}条笔记？忽略的笔记出现在忽略列表中，可以重新恢复。`,
        onOk: async () => {
          try {
            const response = await fetch(`/api/reports/${reportId}/notes/batch-action`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ action, noteIds: idsToProcess }),
            });
            const data = await response.json();
            if (data.success) {
              message.success('操作成功');
              setSelectedNoteIds([]);
              loadNotes();
              loadReportDetail(reportId);
              // 有效集合发生变化，触发达人矩阵重新分析
              setAnalysisRefreshKey((k) => k + 1);
            } else {
              message.error(data.error || '操作失败');
            }
          } catch (error) {
            message.error('操作失败');
          }
        },
      });
    } else {
      try {
        const response = await fetch(`/api/reports/${reportId}/notes/batch-action`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action, noteIds: idsToProcess }),
        });
        const data = await response.json();
        if (data.success) {
          message.success('操作成功');
          setSelectedNoteIds([]);
          loadNotes();
          loadReportDetail(reportId);
          // 有效集合发生变化，触发达人矩阵重新分析
          setAnalysisRefreshKey((k) => k + 1);
        } else {
          message.error(data.error || '操作失败');
        }
      } catch (error) {
        message.error('操作失败');
      }
    }
  };

  // 处理列头点击排序
  const handleSortClick = (field: string, e?: React.MouseEvent) => {
    // 阻止默认行为和事件冒泡，避免触发 Ant Design 的默认排序处理
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    
    if (sortField === field) {
      // 如果点击的是当前排序字段，切换排序方向
      setSortOrder(sortOrder === 'desc' ? 'asc' : 'desc');
    } else {
      // 如果切换到其他字段，从升序开始
      setSortField(field);
      setSortOrder('asc');
    }
  };

  // 处理表格排序变化（保留用于兼容性）
  const handleTableChange: TableProps<Note>['onChange'] = (
    pagination,
    filters,
    sorter,
    extra
  ) => {
    if (extra.action === 'sort' && sorter) {
      const order = Array.isArray(sorter) ? sorter[0] : sorter;
      if (order.field) {
        const field = order.field as string;
        handleSortClick(field);
      }
    }
  };

  const formatNumber = (num: number): string => {
    if (num >= 10000) {
      return `${(num / 10000).toFixed(1)}w`;
    }
    return num.toString();
  };
  const formatPrice = (priceInCents: number | null | undefined): string => {
    if (priceInCents == null) return '-';
    const yuan = priceInCents;
    return '¥' + yuan.toLocaleString(undefined, { maximumFractionDigits: 0 });
  };

  const columns: ColumnsType<Note> = [
    {
      title: '封面',
      dataIndex: 'coverImage',
      key: 'coverImage',
      width: 100,
      fixed: 'left',
      render: (image: string | null, record: Note) => (
        <div style={{ 
          width: 60,
          height: 80,
          position: 'relative',
          overflow: 'hidden',
          borderRadius: 4,
        }}>
          {image ? (
        <Image
              src={getProxiedImageUrl(image)}
              alt={record.title || ''}
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'cover',
                display: 'block',
              }}
            />
          ) : (
            <div
              style={{
                width: '100%',
                height: '100%',
                background: '#f0f0f0',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 12,
                color: '#999',
              }}
            >
              无图
            </div>
          )}
        </div>
      ),
    },
    {
      title: '标题',
      dataIndex: 'title',
      key: 'title',
      width: 300,
      fixed: 'left',
      ellipsis: true,
      render: (text: string, record: Note) => {
        const content = record.content?.trim() || '';
        const tooltipContent = content ? (
          <div 
            className="tooltip-scrollable"
            style={{ 
              maxWidth: 400, 
              maxHeight: 300, 
              overflow: 'auto',
              whiteSpace: 'pre-wrap', 
              wordBreak: 'break-word' 
            }}
          >
            {content}
          </div>
        ) : (
          '未采集'
        );

        return (
        <div>
            <Tooltip title={tooltipContent} overlayStyle={{ maxWidth: 400, maxHeight: 300 }}>
              <div style={{ marginBottom: 8, fontWeight: 500 }}>
                {text || '无标题'}
              </div>
          </Tooltip>
            <Space size="small" wrap>
              {record.noteType === 'video' ? (
              <Tag color="blue" icon={<VideoCameraOutlined />}>
                  {record.videoDuration ? `${record.videoDuration}` : '视频'}
                </Tag>
              ) : (
                <Tag color="green" icon={<PictureOutlined />}>
                  图文
              </Tag>
            )}
            {record.isAdNote && <Tag color="red">广告</Tag>}
            {record.isBusiness && <Tag color="orange">商业</Tag>}
          </Space>
        </div>
        );
      },
    },
    {
      title: '博主',
      key: 'blogger',
      width: 150,
      render: (_: any, record: Note) => {
        const verified = !!record.officialVerified;
        const initial = record.bloggerNickName?.[0];
        const avatarSrc = getProxiedImageUrl(record.bloggerSmallAvatar || record.bloggerBigAvatar);
        return (
          <Space>
            <div style={{ position: 'relative', width: 24, height: 24 }}>
              <Avatar
                size="small"
                src={avatarSrc}
                style={{ width: 24, height: 24 }}
              >
                {initial}
              </Avatar>
              {verified && (
                <Tooltip title="加V达人">
                  <div
                    style={{
                      position: 'absolute',
                      right: -2,
                      bottom: -2,
                      width: 14,
                      height: 14,
                      borderRadius: '50%',
                      background: '#FFD700',
                      color: '#fff',
                      fontSize: 10,
                      lineHeight: '14px',
                      textAlign: 'center',
                      fontWeight: 600,
                      boxShadow: '0 0 0 1px #fff',
                    }}
                  >
                    K
                  </div>
                </Tooltip>
              )}
            </div>
            <span style={{ fontSize: 12 }}>
              {record.bloggerNickName || '未知博主'}
            </span>
          </Space>
        );
      },
    },
    {
      title: '品牌',
      dataIndex: 'brandName',
      key: 'brandName',
      width: 120,
      render: (brandName: string | null, record: Note) => {
        if (!brandName || !record.brandId || !record.brandIdKey) {
          return <span style={{ color: '#999' }}>-</span>;
        }
        const qianGuaUrl = `https://app.qian-gua.com/#/brand/detail/${record.brandId}/${record.brandIdKey}`;
        return (
          <Tag
            color="blue"
            style={{ cursor: 'pointer' }}
            onClick={(e) => {
              e.stopPropagation();
              window.open(qianGuaUrl, '_blank');
            }}
          >
            {brandName}
          </Tag>
        );
      },
    },
    {
      title: '粉丝数',
      dataIndex: 'fans',
      key: 'fans',
      width: 110,
      align: 'right',
      sorter: true,
      sortOrder: sortField === 'fans' ? (sortOrder === 'asc' ? 'ascend' : 'descend') : null,
      onHeaderCell: () => ({
        onClick: (e: React.MouseEvent) => handleSortClick('fans', e),
      }),
      render: (fans: number | null | undefined) => (fans != null ? fans.toLocaleString() : '-'),
    },
    {
      title: '合作报价',
      dataIndex: 'adPrice',
      key: 'adPrice',
      width: 130,
      align: 'right',
      sorter: true,
      sortOrder: sortField === 'adPrice' ? (sortOrder === 'asc' ? 'ascend' : 'descend') : null,
      onHeaderCell: () => ({
        onClick: (e: React.MouseEvent) => handleSortClick('adPrice', e),
      }),
      render: (price: number | null | undefined) => formatPrice(price),
    },
    {
      title: '互动',
      key: 'interaction',
      width: 100,
      align: 'right',
      render: (_: any, record: Note) =>
        formatNumber(
          record.likedCount +
            record.commentsCount +
            (record as any).collectedCount
        ),
    },
    {
      title: '点赞',
      dataIndex: 'likedCount',
      key: 'likedCount',
      width: 80,
      align: 'right',
      sorter: true,
      sortOrder: sortField === 'likedCount' ? (sortOrder === 'asc' ? 'ascend' : 'descend') : null,
      onHeaderCell: () => ({
        onClick: (e: React.MouseEvent) => handleSortClick('likedCount', e),
      }),
      render: (count: number) => (
        <Space size="small">
          <LikeOutlined />
          {formatNumber(count)}
        </Space>
      ),
    },
    {
      title: '收藏',
      dataIndex: 'collectedCount',
      key: 'collectedCount',
      width: 80,
      align: 'right',
      sorter: true,
      sortOrder: sortField === 'collectedCount' ? (sortOrder === 'asc' ? 'ascend' : 'descend') : null,
      onHeaderCell: () => ({
        onClick: (e: React.MouseEvent) => handleSortClick('collectedCount', e),
      }),
      render: (count: number) => formatNumber(count),
    },
    {
      title: '评论',
      dataIndex: 'commentsCount',
      key: 'commentsCount',
      width: 80,
      align: 'right',
      sorter: true,
      sortOrder: sortField === 'commentsCount' ? (sortOrder === 'asc' ? 'ascend' : 'descend') : null,
      onHeaderCell: () => ({
        onClick: (e: React.MouseEvent) => handleSortClick('commentsCount', e),
      }),
      render: (count: number) => (
        <Space size="small">
          <CommentOutlined />
          {formatNumber(count)}
        </Space>
      ),
    },
    {
      title: '分享',
      dataIndex: 'shareCount',
      key: 'shareCount',
      width: 80,
      align: 'right',
      sorter: true,
      sortOrder: sortField === 'shareCount' ? (sortOrder === 'asc' ? 'ascend' : 'descend') : null,
      onHeaderCell: () => ({
        onClick: (e: React.MouseEvent) => handleSortClick('shareCount', e),
      }),
      render: (count: number) => (
        <Space size="small">
          <ShareAltOutlined />
          {formatNumber(count)}
        </Space>
      ),
    },
    {
      title: '发布时间',
      dataIndex: 'publishTime',
      key: 'publishTime',
      width: 160,
      sorter: true,
      defaultSortOrder: 'descend',
      sortOrder: sortField === 'publishTime' ? (sortOrder === 'asc' ? 'ascend' : 'descend') : null,
      onHeaderCell: () => ({
        onClick: (e: React.MouseEvent) => handleSortClick('publishTime', e),
      }),
      render: (time: string) => dayjs(time).format('YYYY-MM-DD HH:mm'),
    },
    {
      title: '操作',
      key: 'action',
      width: 150,
      fixed: 'right',
      render: (_: any, record: Note) => (
        <Space>
          {activeTab === 'active' && (
            <>
              <Button
                type="link"
                size="small"
                onClick={() => handleBatchAction('ignore', [record.noteId])}
              >
                忽略
              </Button>
              <Button
                type="link"
                size="small"
                danger
                onClick={() => handleBatchAction('delete', [record.noteId])}
              >
                删除
              </Button>
            </>
          )}
          {activeTab === 'ignored' && (
            <Button
              type="link"
              size="small"
              onClick={() => handleBatchAction('restore', [record.noteId])}
            >
              恢复
            </Button>
          )}
        </Space>
      ),
    },
  ];

  // 加载报告列表时显示整体loading
  if (reportsLoading) {
    return (
      <div style={{ textAlign: 'center', padding: '200px 0' }}>
        <Spin size="large" tip="加载中..." />
      </div>
    );
  }

  // 报告列表为空时显示空状态
  if (reports.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: '100px 0' }}>
        <Empty
          image={<FileTextOutlined style={{ fontSize: 64, color: '#d9d9d9' }} />}
          description="暂无报告"
        >
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setCreateModalVisible(true)}>
            创建报告
          </Button>
        </Empty>
      </div>
    );
  }

  // 处理创建报告成功
  const handleCreateReportSuccess = (newReportId: string) => {
    loadReports(); // 重新加载报告列表
    setReportId(newReportId); // 选中新创建的报告
  };

  // 处理追加笔记成功
  const handleAddNotesSuccess = () => {
    if (reportId) {
      loadReportDetail(reportId); // 重新加载报告详情
      loadNotes(); // 重新加载笔记列表
      // 追加笔记改变有效集合，触发达人矩阵重新分析
      setAnalysisRefreshKey((k) => k + 1);
    }
  };

  return (
    <div style={{ padding: 24 }}>
      {/* 报告选择区域 */}
      <Card style={{ marginBottom: 24 }}>
        <Row gutter={16} align="middle">
          <Col>
            <Select
              value={reportId}
              onChange={setReportId}
              style={{ width: 300 }}
              placeholder="请选择报告"
            >
              {reports.map((report) => (
                <Option key={report.reportId} value={report.reportId}>
                  {report.reportName}
                </Option>
              ))}
            </Select>
          </Col>
          {reportDetail && (
            <Col>
              <span style={{ color: '#999' }}>
              创建时间: {dayjs(reportDetail.createdAt).format('YYYY-MM-DD')}
            </span>
            </Col>
          )}
          <Col flex="auto" />
          <Col>
            <Button type="primary" icon={<PlusOutlined />} onClick={() => setCreateModalVisible(true)}>
              创建新报告
            </Button>
          </Col>
        </Row>
      </Card>

      {reportDetail && (
        <>
          {/* 报告信息卡片 */}
          <Row gutter={16} style={{ marginBottom: 24 }}>
          <Col span={8}>
              <Card>
                <Statistic
                  title={
                    <Space size={4}>
                      <span>有效笔记</span>
                      <Tooltip title="参与统计和分析的笔记列表">
                        <QuestionCircleOutlined style={{ color: '#999', cursor: 'help' }} />
                      </Tooltip>
                    </Space>
                  }
                  value={reportDetail.activeNotesCount}
                  valueStyle={{ color: '#1890ff' }}
                />
              </Card>
            </Col>
            <Col span={8}>
              <Card>
                <Statistic
                  title={
                    <Space size={4}>
                      <span>已忽略</span>
                      <Tooltip title="在按品牌导入的笔记中，定向剔除无需参与统计的笔记">
                        <QuestionCircleOutlined style={{ color: '#999', cursor: 'help' }} />
                      </Tooltip>
                    </Space>
                  }
                  value={reportDetail.ignoredNotesCount}
                  valueStyle={{ color: '#999' }}
                />
              </Card>
            </Col>
            <Col span={8}>
              <Card>
                <Statistic
                    title={
                      <Space size={4}>
                        <span>时间范围</span>
                        <Tooltip title="当前笔记列表中，笔记发布的最早时间和最晚时间">
                          <QuestionCircleOutlined style={{ color: '#999', cursor: 'help' }} />
                        </Tooltip>
                      </Space>
                    }
                    value={0}
                    formatter={() => 
                      reportDetail.earliestNoteTime && reportDetail.latestNoteTime
                        ? `${dayjs(reportDetail.earliestNoteTime).format('YYYY-MM-DD')} 至 ${dayjs(reportDetail.latestNoteTime).format('YYYY-MM-DD')}`
                        : '-'
                    }
                    valueStyle={{ color: '#999' }}
                  />
              </Card>
            </Col>
          </Row>

          {/* 达人矩阵属性分析区域 */}
          {reportId && (
            <div style={{ marginBottom: 24 }}>
              <BloggerMatrixAnalysis
                reportId={reportId}
                refreshKey={analysisRefreshKey}
              />
            </div>
          )}

          {/* 筛选器区域 */}
          <Card style={{ marginBottom: 24 }}>
            <Row gutter={16}>
              <Col>
                <Select
                  value={brandId}
                  onChange={setBrandId}
                  placeholder="选择品牌"
                  style={{ width: 150 }}
                  allowClear
                >
                  {reportDetail.brands.map((brand) => (
                    <Option key={brand.brandId} value={brand.brandId}>
                      {brand.brandName}
                    </Option>
                  ))}
                </Select>
              </Col>
              <Col>
                <Select
                  value={bloggerId}
                  onChange={setBloggerId}
                  placeholder="选择博主"
                  style={{ width: 150 }}
                  allowClear
                />
              </Col>
              <Col>
                <RangePicker
                  value={dateRange}
                  onChange={(dates) => {
                    if (dates && dates[0] && dates[1]) {
                      setDateRange([dates[0], dates[1]]);
                    } else {
                      setDateRange(null);
                    }
                  }}
                  format="YYYY-MM-DD"
                />
              </Col>
              <Col>
                <Button icon={<ReloadOutlined />} onClick={loadNotes}>
                  刷新
                </Button>
              </Col>
              <Col>
                <Button
                  onClick={() => {
                    setBrandId(null);
                    setBloggerId(null);
                    setDateRange(null);
                  }}
                >
                  重置
                </Button>
              </Col>
            </Row>
          </Card>

          {/* 操作栏 */}
          {/* Tab切换 */}
          <Tabs
            activeKey={activeTab}
            onChange={(key) => {
              setActiveTab(key as 'active' | 'ignored');
              setSelectedNoteIds([]);
            }}
            items={[
              { key: 'active', label: '有效笔记' },
              { key: 'ignored', label: '已忽略' },
            ]}
            tabBarExtraContent={
              <Space>
                {/* 批量操作按钮 - 仅在选中时显示 */}
                {selectedNoteIds.length > 0 && (
                  <>
                    {activeTab === 'active' && (
                      <>
                        <Button
                          icon={<EyeInvisibleOutlined />}
                          onClick={() => handleBatchAction('ignore')}
                        >
                          忽略
                        </Button>
                        <Button
                          danger
                          icon={<DeleteOutlined />}
                          onClick={() => handleBatchAction('delete')}
                        >
                          删除
                        </Button>
                      </>
                    )}
                    {activeTab === 'ignored' && (
                      <Button
                        icon={<UndoOutlined />}
                        onClick={() => handleBatchAction('restore')}
                      >
                        恢复
                      </Button>
                    )}
                  </>
                )}
                {/* 追加笔记按钮 - 始终显示 */}
                <Button
                  type="primary"
                  icon={<PlusOutlined />}
                  onClick={() => setAddNotesModalVisible(true)}
                >
                  追加笔记
                </Button>
              </Space>
            }
          />

          {/* 笔记列表表格 */}
          <Table
            columns={columns}
            dataSource={notes}
            rowKey="noteId"
            loading={notesLoading}
            onChange={handleTableChange}
            showSorterTooltip={false}
            summary={(pageData) => {
              // 计算总计
              const totalLiked = pageData.reduce((sum, n) => sum + (n.likedCount || 0), 0);
              const totalComments = pageData.reduce((sum, n) => sum + (n.commentsCount || 0), 0);
              const totalCollected = pageData.reduce((sum, n) => sum + ((n as any).collectedCount || 0), 0);
              const totalShares = pageData.reduce((sum, n) => sum + (n.shareCount || 0), 0);
              const totalInteraction = totalLiked + totalComments + totalCollected;
              return (
                <Table.Summary fixed>
                  <Table.Summary.Row>
                    <Table.Summary.Cell index={0} colSpan={4}>
                      <span style={{ fontWeight: 600 }}>总计</span>
                    </Table.Summary.Cell>
                    <Table.Summary.Cell index={4} />
                    <Table.Summary.Cell index={5} />
                    <Table.Summary.Cell index={6} align="right">
                      {formatNumber(totalInteraction)}
                    </Table.Summary.Cell>
                    <Table.Summary.Cell index={7} align="right">
                      {formatNumber(totalLiked)}
                    </Table.Summary.Cell>
                    <Table.Summary.Cell index={8} align="right">
                      {formatNumber(totalCollected)}
                    </Table.Summary.Cell>
                    <Table.Summary.Cell index={9} align="right">
                      {formatNumber(totalComments)}
                    </Table.Summary.Cell>
                    <Table.Summary.Cell index={10} align="right">
                      {formatNumber(totalShares)}
                    </Table.Summary.Cell>
                    <Table.Summary.Cell index={11} />
                    <Table.Summary.Cell index={12} />
                  </Table.Summary.Row>
                </Table.Summary>
              );
            }}
            rowSelection={{
              selectedRowKeys: selectedNoteIds,
              onChange: (keys) => setSelectedNoteIds(keys as string[]),
            }}
            pagination={{
              total: notes.length,
              pageSize: 20,
              showSizeChanger: true,
              showTotal: (total) => `共 ${total} 条`,
            }}
            scroll={{ x: 1400 }}
          />
        </>
      )}

      {/* 创建报告 Modal */}
      <CreateReportModal
        open={createModalVisible}
        onCancel={() => setCreateModalVisible(false)}
        onSuccess={handleCreateReportSuccess}
      />

      {/* 追加笔记 Modal */}
      {reportDetail && (
        <AddNotesModal
          open={addNotesModalVisible}
          reportId={reportId!}
          reportName={reportDetail.reportName}
          defaultBrandIds={reportDetail.brands.map((b) => b.brandId)}
          onCancel={() => setAddNotesModalVisible(false)}
          onSuccess={handleAddNotesSuccess}
        />
      )}
    </div>
  );
}
