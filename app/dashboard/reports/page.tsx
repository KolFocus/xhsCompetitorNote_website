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
  Checkbox,
  Typography,
  Input,
} from 'antd';
import {
  PlusOutlined,
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
  LinkOutlined,
  RobotOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import type { Dayjs } from 'dayjs';
import type { ColumnsType, TableProps } from 'antd/es/table';
import 'dayjs/locale/zh-cn';
import CreateReportModal from '@/components/reports/CreateReportModal';
import AddNotesModal from '@/components/reports/AddNotesModal';
import BloggerMatrixAnalysis from '@/components/reports/BloggerMatrixAnalysis';
import TagAnalysis from '@/components/reports/TagAnalysis';
import { useRouter } from 'next/navigation';

dayjs.locale('zh-cn');

const { RangePicker } = DatePicker;
const { Option } = Select;
const { Text } = Typography;

// 图片代理服务
const PROXY_BASE_URL = 'https://www.xhstool.cc/api/proxy';

const getProxiedImageUrl = (url: string | null | undefined): string | undefined => {
  console.log('song getProxiedImageUrl url', url);
  if (!url) return undefined;
  if (url.includes('xhstool.cc/api/proxy')) return url;
  if (url.startsWith('/')) {
    url = 'https:'+url
    return `${PROXY_BASE_URL}?url=${encodeURIComponent(url)}`;
  }
  else
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
  xhsContent: string | null;
  coverImage: string | null;
  xhsNoteLink: string | null;
  xhsNoteInvalid?: boolean | null;
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
  xhsUserId?: string | null;
  officialVerified?: boolean | null;
  brandId: string | null;
  brandIdKey: string | null;
  brandName: string | null;
  videoDuration: string | null;
  status: string;
  addedAt: string;
  aiContentType: string | null;
  aiRelatedProducts: string | null;
  aiSummary: string | null;
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
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [total, setTotal] = useState(0);
  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [addNotesModalVisible, setAddNotesModalVisible] = useState(false);
  // 从 localStorage 读取显示AI分析的状态，默认为 false
  const [showAiAnalysis, setShowAiAnalysis] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('showAiAnalysis');
      return saved === 'true';
    }
    return false;
  });
  // 达人矩阵分析刷新键，仅在有效集合变化时递增
  const [analysisRefreshKey, setAnalysisRefreshKey] = useState(0);

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
  const [keyword, setKeyword] = useState<string>(''); // 关键词搜索
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

  // 保存选中的报告 ID 到 localStorage
  useEffect(() => {
    if (reportId && typeof window !== 'undefined') {
      localStorage.setItem('lastViewedReportId', reportId);
    }
  }, [reportId]);

  // 保存显示AI分析的状态到 localStorage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('showAiAnalysis', String(showAiAnalysis));
    }
  }, [showAiAnalysis]);

  // 加载报告详情
  useEffect(() => {
    if (reportId) {
      loadReportDetail(reportId);
      setPage(1); // 重置到第一页
      loadNotes(1, pageSize);
    }
  }, [reportId, activeTab, sortField, sortOrder]);

  const loadReports = async () => {
    try {
      setReportsLoading(true);
      const response = await fetch('/api/reports');
      const data = await response.json();
      if (data.success) {
        setReports(data.data.list);
        // 默认选中逻辑
        if (data.data.list.length > 0 && !reportId) {
          // 尝试从 localStorage 读取上次查看的报告 ID
          const lastReportId = localStorage.getItem('lastViewedReportId');
          // 检查上次的 ID 是否在当前列表中
          const foundReport = lastReportId ? data.data.list.find((r: Report) => r.reportId === lastReportId) : null;
          
          if (foundReport) {
            setReportId(foundReport.reportId);
          } else {
            setReportId(data.data.list[0].reportId);
          }
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

  const loadNotes = async (pageValue = page, pageSizeValue = pageSize) => {
    if (!reportId) return;

    try {
      setNotesLoading(true);
      const params = new URLSearchParams({
        page: String(pageValue),
        pageSize: String(pageSizeValue),
        status: activeTab,
      });
      if (keyword && keyword.trim()) params.set('keyword', keyword.trim());
      if (brandId) params.set('brandKey', brandId);
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
        const notesList = data.data.list || [];
        const totalCount = data.data.total ?? notesList.length;
        setNotes(notesList);
        setTotal(totalCount);
        setPage(data.data.page ?? pageValue);
        setPageSize(data.data.pageSize ?? pageSizeValue);
        console.log('loadNotes result:', { 
          page: pageValue, 
          pageSize: pageSizeValue, 
          total: totalCount, 
          listLength: notesList.length 
        });
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
        content: `确定要删除选中的 ${idsToProcess.length} 条笔记吗？此操作会从当前报告中移除${idsToProcess.length === 1 ? '该笔记' : '这些笔记'}，但不会导致笔记从系统中删除。之后，可以通过追加笔记重新添加。`,
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
        content: `确定忽略${idsToProcess.length}条笔记？忽略的笔记出现在忽略列表中，可以重新恢复。被忽略的笔记，将不会参与该报告的分析统计。`,
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
    } else if (action === 'restore') {
      Modal.confirm({
        title: '确认恢复',
        content: `确定恢复${idsToProcess.length}条笔记？恢复的笔记将重新出现在有效笔记列表中，并参与该报告的分析统计。`,
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

  // 关键词高亮函数
  const highlightKeyword = (text: string | null | undefined, searchKeyword: string): React.ReactNode => {
    if (!text || !searchKeyword || !searchKeyword.trim()) {
      return text || '';
    }

    const searchTerm = searchKeyword.trim();
    const regex = new RegExp(`(${searchTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
    const parts = text.split(regex);

    return (
      <>
        {parts.map((part, index) => {
          if (regex.test(part)) {
            return (
              <span
                key={index}
                style={{
                  backgroundColor: '#fff566',
                  fontWeight: 'bold',
                  padding: '0 2px',
                }}
              >
                {part}
              </span>
            );
          }
          return <span key={index}>{part}</span>;
        })}
      </>
    );
  };

  // 截断文本辅助函数
  const truncateText = (text: string | null | undefined, maxLength: number): string => {
    if (!text) return '';
    if (text.length <= maxLength) return text;
    return text.slice(0, maxLength) + '...';
  };

  // 渲染AI分析Tooltip内容
  const renderAiAnalysisTooltip = (record: Note) => {
    const hasAiData = record.aiContentType || record.aiRelatedProducts || record.aiSummary;
    if (!hasAiData) return null;

    return (
      <div style={{ maxWidth: 500, maxHeight: 400, overflow: 'auto', color: '#fff' }}>
        <Space direction="vertical" size={12} style={{ width: '100%' }}>
          {record.aiContentType && (
            <div>
              <Text strong style={{ fontSize: 14, color: '#fff' }}>内容场景：</Text>
              <Text style={{ fontSize: 14, display: 'block', marginTop: 4, color: '#fff' }}>
                {record.aiContentType}
              </Text>
            </div>
          )}
          {record.aiRelatedProducts && (
            <div>
              <Text strong style={{ fontSize: 14, color: '#fff' }}>相关产品：</Text>
              <Text style={{ fontSize: 14, display: 'block', marginTop: 4, color: '#fff' }}>
                {record.aiRelatedProducts}
              </Text>
            </div>
          )}
          {record.aiSummary && (
            <div>
              <Text strong style={{ fontSize: 14, color: '#fff' }}>内容总结：</Text>
              <Text style={{ fontSize: 14, display: 'block', marginTop: 4, color: '#fff' }}>
                {record.aiSummary}
              </Text>
            </div>
          )}
        </Space>
      </div>
    );
  };

  const columns: ColumnsType<Note> = [
    ...(showAiAnalysis
      ? [
          // 显示AI分析时：封面和标题合并
          {
            title: '笔记',
            key: 'noteWithCover',
            width: 300,
            fixed: 'left' as const,
            render: (_: unknown, record: Note) => {
              const content = (record.xhsContent || record.content)?.trim() || '';
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
                <div style={{ width: 180 }}>
                  {/* 封面图片 */}
                  <div
                    style={{
                      width: 180,
                      height: 240,
                      marginBottom: 8,
                      overflow: 'hidden',
                      borderRadius: 4,
                      backgroundColor: '#f0f0f0',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      position: 'relative',
                    }}
                  >
                    {record.coverImage ? (
                      <Image
                        src={getProxiedImageUrl(record.coverImage)}
                        alt={record.title || ''}
                        width={180}
                        height={240}
                        style={{ objectFit: 'cover' }}
                        preview={true}
                      />
                    ) : (
                      <Text type="secondary">无封面</Text>
                    )}
                    {/* 笔记不可见蒙层 */}
                    {record.xhsNoteInvalid && (
                      <div
                        style={{
                          position: 'absolute',
                          top: 0,
                          left: 0,
                          right: 0,
                          bottom: 0,
                          background: 'rgba(0, 0, 0, 0.6)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          zIndex: 10,
                        }}
                      >
                        <span style={{ color: 'white', fontSize: 16, fontWeight: 500 }}>
                        笔记不可见
                        </span>
                      </div>
                    )}
                  </div>

                  {/* 标题和标签 */}
                  <Tooltip title={tooltipContent} styles={{ root: { maxWidth: 400, maxHeight: 300 } }}>
                    <div style={{ marginBottom: 8, fontWeight: 500 }}>
                      {highlightKeyword(record.title, keyword) || '无标题'}
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
                    {record.xhsNoteLink && (
                      <LinkOutlined
                        style={{ color: '#1890ff', cursor: 'pointer', fontSize: 16 }}
                        onClick={(e) => {
                          e.stopPropagation();
                          window.open(record.xhsNoteLink!, '_blank');
                        }}
                      />
                    )}
                  </Space>
                </div>
              );
            },
          },
        ]
      : [
          // 不显示AI分析时：封面和标题分开
          {
            title: '封面',
            dataIndex: 'coverImage',
            key: 'coverImage',
            width: 100,
            fixed: 'left' as const,
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
            fixed: 'left' as const,
            ellipsis: true,
            render: (text: string, record: Note) => {
              const content = (record.xhsContent || record.content)?.trim() || '';
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

              const hasAiData = record.aiContentType || record.aiRelatedProducts || record.aiSummary;
              const aiTooltipContent = renderAiAnalysisTooltip(record);

              return (
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                    {hasAiData ? (
                      <Tooltip
                        title={aiTooltipContent}
                        styles={{ 
                          root: { maxWidth: 520, maxHeight: 450, overflow: 'auto' }
                        }}
                      >
                        <RobotOutlined
                          style={{
                            color: '#1890ff',
                            fontSize: 16,
                            cursor: 'pointer',
                            flexShrink: 0,
                          }}
                        />
                      </Tooltip>
                    ) : (
                      <RobotOutlined
                        style={{
                          color: '#d9d9d9',
                          fontSize: 16,
                          flexShrink: 0,
                        }}
                      />
                    )}
                    <Tooltip title={tooltipContent} styles={{ root: { maxWidth: 400, maxHeight: 300 } }}>
                      <div style={{ fontWeight: 400, flex: 1 }}>
                        {highlightKeyword(text, keyword) || '无标题'}
                      </div>
                    </Tooltip>
                  </div>
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
                    {record.xhsNoteLink && (
                      <LinkOutlined
                        style={{ color: '#1890ff', cursor: 'pointer', fontSize: 16 }}
                        onClick={(e) => {
                          e.stopPropagation();
                          window.open(record.xhsNoteLink!, '_blank');
                        }}
                      />
                    )}
                  </Space>
                </div>
              );
            },
          },
        ]),
    ...(showAiAnalysis
      ? [
          {
            title: 'AI分析结果',
            key: 'aiAnalysis',
            width: 450,
            render: (_: unknown, record: Note) => {
              const hasAiData = record.aiContentType || record.aiRelatedProducts || record.aiSummary;

              if (!hasAiData) {
                return <Text type="secondary">暂无分析</Text>;
              }

              return (
                <div style={{ marginTop: '-8px', paddingTop: 0 }}>
                  <Space direction="vertical" size={12} style={{ width: '100%' }}>
                    {record.aiContentType && (
                      <div>
                        <Text strong style={{ fontSize: 16 }}>
                          内容场景：
                        </Text>
                        <Tooltip title={record.aiContentType}>
                          <Text style={{ fontSize: 16 }}>
                            {highlightKeyword(truncateText(record.aiContentType, 8), keyword)}
                          </Text>
                        </Tooltip>
                      </div>
                    )}
                    {record.aiRelatedProducts && (
                      <div>
                        <Text strong style={{ fontSize: 16 }}>
                          相关产品：
                        </Text>
                        <Text style={{ fontSize: 16 }}>
                          {highlightKeyword(record.aiRelatedProducts, keyword)}
                        </Text>
                      </div>
                    )}
                    {record.aiSummary && (
                      <div>
                        <Text strong style={{ fontSize: 16 }}>
                          内容总结：
                        </Text>
                        <Text style={{ fontSize: 16 }}>
                          {highlightKeyword(record.aiSummary, keyword)}
                        </Text>
                      </div>
                    )}
                  </Space>
                </div>
              );
            },
          },
        ]
      : []),
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
            {record.xhsUserId ? (
              <a
                href={`https://www.xiaohongshu.com/user/profile/${record.xhsUserId}`}
                target="_blank"
                rel="noopener noreferrer"
                style={{ fontSize: 12, color: '#1890ff', cursor: 'pointer' }}
                onClick={(e) => e.stopPropagation()}
              >
                {record.bloggerNickName || '未知博主'}
              </a>
            ) : (
              <span style={{ fontSize: 12 }}>
                {record.bloggerNickName || '未知博主'}
              </span>
            )}
          </Space>
        );
      },
    },
    {
      title: '品牌',
      dataIndex: 'brandName',
      key: 'brandName',
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
            <>
              <Button
                type="link"
                size="small"
                onClick={() => handleBatchAction('restore', [record.noteId])}
              >
                恢复
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
      <>
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

        {/* 创建报告 Modal */}
        <CreateReportModal
          open={createModalVisible}
          onCancel={() => setCreateModalVisible(false)}
          onSuccess={handleCreateReportSuccess}
        />
      </>
    );
  }

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

          {/* 基于内容标签的笔记分析区域 */}
          {reportId && (
            <div style={{ marginBottom: 24 }}>
              <TagAnalysis
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
                  {reportDetail.brands.map((brand) => {
                    const brandKey = `${brand.brandId}#KF#${brand.brandName}`;
                    return (
                      <Option key={brandKey} value={brandKey}>
                        {brand.brandName}
                      </Option>
                    );
                  })}
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
                <Input
                  placeholder="搜索标题、内容、AI分析结果等"
                  allowClear
                  value={keyword}
                  onChange={(e) => setKeyword(e.target.value)}
                  onPressEnter={() => {
                    setPage(1);
                    loadNotes(1, pageSize);
                  }}
                  style={{ width: 250 }}
                />
              </Col>
              <Col>
                <Button type="primary" onClick={() => {
                  setPage(1);
                  loadNotes(1, pageSize);
                }}>
                  搜索
                </Button>
              </Col>
              <Col>
                <Button
                  onClick={() => {
                    setKeyword('');
                    setBrandId(null);
                    setBloggerId(null);
                    setDateRange(null);
                    setPage(1);
                    loadNotes(1, pageSize);
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
                      <>
                        <Button
                          icon={<UndoOutlined />}
                          onClick={() => handleBatchAction('restore')}
                        >
                          恢复
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
                <Checkbox
                  checked={showAiAnalysis}
                  onChange={(e) => setShowAiAnalysis(e.target.checked)}
                >
                  显示AI分析
                </Checkbox>
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
            rowSelection={{
              selectedRowKeys: selectedNoteIds,
              onChange: (keys) => setSelectedNoteIds(keys as string[]),
            }}
            pagination={{
              current: page,
              total: total,
              pageSize: pageSize,
              showSizeChanger: true,
              showQuickJumper: true,
              showTotal: (total, range) => `第 ${range[0]}-${range[1]} 条，共 ${total} 条`,
              hideOnSinglePage: false,
              onChange: (newPage, newPageSize) => {
                if (newPageSize !== pageSize) {
                  setPageSize(newPageSize);
                  setPage(1);
                  loadNotes(1, newPageSize);
                } else {
                  setPage(newPage);
                  loadNotes(newPage, pageSize);
                }
              },
            }}
            scroll={{ x: 'max-content' }}
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
          defaultBrandIds={reportDetail.brands.map((b) => `${b.brandId}#KF#${b.brandName}`)}
          onCancel={() => setAddNotesModalVisible(false)}
          onSuccess={handleAddNotesSuccess}
        />
      )}
    </div>
  );
}
