'use client';

// 标记为动态渲染
export const dynamic = 'force-dynamic';

/**
 * 全部笔记页面
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
  Checkbox,
  Typography,
  message,
  Input,
} from 'antd';
import {
  VideoCameraOutlined,
  PictureOutlined,
  LikeOutlined,
  EyeOutlined,
  CommentOutlined,
  ShareAltOutlined,
  FileTextOutlined,
  TagsOutlined,
  BarChartOutlined,
  UserOutlined,
  FileExclamationOutlined,
  RobotOutlined,
  LinkOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import type { Dayjs } from 'dayjs';
import type { ColumnsType, TableProps } from 'antd/es/table';
import 'dayjs/locale/zh-cn';

dayjs.locale('zh-cn');

const { RangePicker } = DatePicker;
const { Option } = Select;
const { Text } = Typography;

// 图片代理服务
const PROXY_BASE_URL = 'https://www.xhstool.cc/api/proxy';

/**
 * 获取代理后的图片 URL
 * @param url 原始图片 URL
 * @returns 代理后的 URL 或 undefined
 */
const getProxiedImageUrl = (url: string | null | undefined): string | undefined => {
  if (!url) return undefined;
  
  // 如果已经是代理 URL，直接返回
  if (url.includes('xhstool.cc/api/proxy')) {
    return url;
  }
  
  // 如果是相对路径，直接返回（不需要代理）
  if (url.startsWith('/')) {
    url = 'https:'+url
    return `${PROXY_BASE_URL}?url=${encodeURIComponent(url)}`;
  }
  
  // 外部 URL 通过代理访问
  return `${PROXY_BASE_URL}?url=${encodeURIComponent(url)}`;
};

interface Note {
  NoteId: string;
  Title: string;
  Content: string | null;
  XhsContent?: string | null;
  CoverImage: string | null;
  NoteType: string;
  IsBusiness: boolean;
  IsAdNote: boolean;
  PublishTime: string;
  PubDate: string;
  LikedCount: number;
  CollectedCount: number;
  CommentsCount: number;
  ViewCount: number;
  ShareCount: number;
  BloggerId: string;
  BloggerNickName: string;
  BloggerProp: string | null;
  BigAvatar: string | null;
  SmallAvatar: string | null;
  BrandId: string | null;
  BrandIdKey: string | null;
  BrandName: string | null;
  VideoDuration: string | null;
  CurrentUserIsFavorite: boolean;
  Fans?: number | null;
  AdPrice?: number | null; // 单位：分
  OfficialVerified?: boolean | null;
  XhsNoteLink: string | null;
  XhsUserId?: string | null;
  AiContentType: string | null;
  AiRelatedProducts: string | null;
  AiSummary: string | null;
}

interface Brand {
  BrandId: string;
  BrandName: string;
}

interface Blogger {
  BloggerId: string;
  BloggerNickName: string;
}

interface NotesResponse {
  success: boolean;
  data: {
    list: Note[];
    total: number;
    page: number;
    pageSize: number;
  };
  error?: string;
}

export default function NotesPage() {
  const [notes, setNotes] = useState<Note[]>([]);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [bloggers, setBloggers] = useState<Blogger[]>([]);
  
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
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  // 从 localStorage 读取显示AI分析的状态，默认为 false
  const [showAiAnalysis, setShowAiAnalysis] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('showAiAnalysis');
      return saved === 'true';
    }
    return false;
  });

  // 过滤条件
  const [keyword, setKeyword] = useState<string>(''); // 关键词搜索
  const [selectedBrand, setSelectedBrand] = useState<string | undefined>();
  const [selectedBlogger, setSelectedBlogger] = useState<string | undefined>();
  const [dateRange, setDateRange] = useState<[Dayjs | null, Dayjs | null] | null>(null);

  // 排序状态（默认：PublishTime 降序）
  const [sortField, setSortField] = useState<string>('PublishTime');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  // 统计数据
  const [stats, setStats] = useState<{
    totalNotes: number;
    totalBrands: number;
    totalBloggers: number;
    missingContent: number;
  } | null>(null);

  // 加载品牌和博主列表
  useEffect(() => {
    const loadFilters = async () => {
      try {
        const [brandsRes, bloggersRes] = await Promise.all([
          fetch('/api/allBrands'),
          fetch('/api/bloggers'),
        ]);

        const brandsData = await brandsRes.json();
        const bloggersData = await bloggersRes.json();

        if (brandsData.success) {
          setBrands(brandsData.data);
        }
        if (bloggersData.success) {
          setBloggers(bloggersData.data);
        }
      } catch (error) {
        console.error('Failed to load filters:', error);
      }
    };

    loadFilters();
  }, []);

  // 加载统计数据
  const loadStats = async () => {
    try {
      const params = new URLSearchParams();

      if (selectedBrand) {
        params.append('brandId', selectedBrand);
      }
      if (selectedBlogger) {
        params.append('bloggerId', selectedBlogger);
      }
      if (dateRange && dateRange[0] && dateRange[1]) {
        params.append('startDate', dateRange[0].format('YYYY-MM-DD'));
        params.append('endDate', dateRange[1].format('YYYY-MM-DD'));
      }

      const response = await fetch(`/api/notes/stats?${params.toString()}`);
      const data = await response.json();

      if (data.success) {
        setStats(data.data);
      } else {
        console.error('Failed to load stats:', data.error);
      }
    } catch (error) {
      console.error('Error loading stats:', error);
    }
  };

  // 加载笔记列表
  const buildNotesQueryParams = (currentPage: number, currentPageSize: number) => {
    const params = new URLSearchParams({
      page: currentPage.toString(),
      pageSize: currentPageSize.toString(),
    });

    if (keyword && keyword.trim()) {
      params.append('keyword', keyword.trim());
    }
    if (selectedBrand) {
      params.append('brandKey', selectedBrand);
    }
    if (selectedBlogger) {
      params.append('bloggerId', selectedBlogger);
    }
    if (dateRange && dateRange[0] && dateRange[1]) {
      params.append('startDate', dateRange[0].format('YYYY-MM-DD'));
      params.append('endDate', dateRange[1].format('YYYY-MM-DD'));
    }

    if (sortField) {
      params.append('orderBy', sortField);
      params.append('order', sortOrder);
    }

    return params;
  };

  const loadNotes = async (currentPage: number = page) => {
    setLoading(true);
    try {
      const params = buildNotesQueryParams(currentPage, pageSize);
      const response = await fetch(`/api/notes/list?${params.toString()}`);
      const data: NotesResponse = await response.json();

      if (data.success) {
        setNotes(data.data.list);
        setTotal(data.data.total);
        setPage(data.data.page);
      } else {
        console.error('Failed to load notes:', data.error);
      }
    } catch (error) {
      console.error('Error loading notes:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchAllNotesForExport = async (): Promise<Note[]> => {
    const maxExportPageSize = 100;
    let currentPage = 1;
    let totalFetched = 0;
    let totalCount = 0;
    const allNotes: Note[] = [];

    while (true) {
      const params = buildNotesQueryParams(currentPage, maxExportPageSize);
      const response = await fetch(`/api/notes/list?${params.toString()}`);
      const data: NotesResponse = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Failed to fetch notes for export');
      }

      const list = data.data.list || [];
      allNotes.push(...list);
      totalFetched += list.length;
      totalCount = data.data.total || 0;

      if (totalFetched >= totalCount || list.length === 0) {
        break;
      }

      currentPage += 1;
    }

    return allNotes;
  };

  const handleExport = async () => {
    if (exporting) return;
    try {
      setExporting(true);
      const XLSX: any = await import('xlsx');
      const allNotes = await fetchAllNotesForExport();

      if (!allNotes.length) {
        message.warning('暂无数据可导出');
        return;
      }

      const filterParts: string[] = [];
      if (selectedBrand) {
        const brandName =
          brands.find((brand) => brand.BrandId === selectedBrand)?.BrandName || selectedBrand;
        filterParts.push(`品牌-${brandName}`);
      }
      if (selectedBlogger) {
        const bloggerName =
          bloggers.find((blogger) => blogger.BloggerId === selectedBlogger)?.BloggerNickName ||
          selectedBlogger;
        filterParts.push(`博主-${bloggerName}`);
      }
      if (dateRange && dateRange[0] && dateRange[1]) {
        filterParts.push(
          `日期-${dateRange[0].format('YYYYMMDD')}-${dateRange[1].format('YYYYMMDD')}`
        );
      }

      const sanitizeFileName = (name: string) => name.replace(/[\\/:*?"<>|]/g, '_');
      const baseName = filterParts.length > 0 ? `${filterParts.join('_')}_全部笔记` : '全部笔记';
      const safeBaseName = sanitizeFileName(baseName);

      const detailKeepOrder: Array<{
        key: keyof Note;
        label: string;
        format?: (value: any, record: Note) => any;
      }> = [
        { key: 'NoteId', label: '笔记ID' },
        { key: 'Title', label: '标题' },
        { key: 'Content', label: '文本内容' },
        { key: 'XhsContent', label: 'XHS内容' },
        { key: 'CoverImage', label: '封面' },
        { key: 'NoteType', label: '笔记类型' },
        {
          key: 'PublishTime',
          label: '发布时间',
          format: (value: string) => {
            if (!value) return '';
            const match = value.match(/^(\d{4}-\d{2}-\d{2})[T ](\d{2}:\d{2}:\d{2})/);
            if (match) return `${match[1]} ${match[2]}`;
            try {
              const dt = new Date(value);
              const pad = (n: number) => (n < 10 ? `0${n}` : `${n}`);
              return `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())} ${pad(dt.getHours())}:${pad(dt.getMinutes())}:${pad(dt.getSeconds())}`;
            } catch {
              return value;
            }
          },
        },
        { key: 'LikedCount', label: '点赞' },
        { key: 'CollectedCount', label: '收藏' },
        { key: 'CommentsCount', label: '评论' },
        { key: 'ViewCount', label: '浏览' },
        { key: 'ShareCount', label: '分享' },
        { key: 'Fans', label: '粉丝数' },
        { key: 'AdPrice', label: '合作金额' },
        { key: 'BloggerId', label: '达人ID' },
        { key: 'BloggerNickName', label: '达人昵称' },
        { key: 'SmallAvatar', label: '头像(小)' },
        { key: 'BigAvatar', label: '头像(大)' },
        { key: 'BrandName', label: '品牌' },
        { key: 'VideoDuration', label: '视频时长' },
        { key: 'XhsNoteLink', label: '链接' },
        { key: 'AiContentType', label: 'AI分析-内容场景' },
        { key: 'AiRelatedProducts', label: 'AI分析-相关产品' },
        { key: 'AiSummary', label: 'AI分析-内容总结' },
      ];

      const detailHeader = detailKeepOrder.map((item) => item.label);
      const detailData = allNotes.map((note) => {
        const row: Record<string, any> = {};
        detailKeepOrder.forEach((item) => {
          const raw = (note as any)[item.key];
          row[item.label] = item.format ? item.format(raw, note) : raw ?? '';
        });
        return row;
      });

      const worksheet = XLSX.utils.json_to_sheet(detailData, { header: detailHeader });
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, '笔记列表');

      const now = new Date();
      const utcMs = now.getTime() + now.getTimezoneOffset() * 60000;
      const shanghaiDate = new Date(utcMs + 8 * 60 * 60000);
      const pad = (n: number) => (n < 10 ? `0${n}` : `${n}`);
      const timestamp = `${shanghaiDate.getFullYear()}${pad(shanghaiDate.getMonth() + 1)}${pad(shanghaiDate.getDate())}-${pad(shanghaiDate.getHours())}${pad(shanghaiDate.getMinutes())}${pad(shanghaiDate.getSeconds())}`;
      const filename = `${safeBaseName}_${timestamp}.xlsx`;

      XLSX.writeFile(workbook, filename);
      message.success(`导出成功，共 ${allNotes.length} 条笔记`);
    } catch (error) {
      console.error('Export notes failed:', error);
      message.error('导出失败，请稍后重试');
    } finally {
      setExporting(false);
    }
  };

  // 初始加载
  useEffect(() => {
    // 当过滤条件变化时，先重置统计数据为 null
    setStats(null);
    loadNotes(1);
    loadStats();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedBrand, selectedBlogger, dateRange, pageSize, sortField, sortOrder]);

  // 保存显示AI分析的状态到 localStorage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('showAiAnalysis', String(showAiAnalysis));
    }
  }, [showAiAnalysis]);

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
    setPage(1); // 排序变化时重置到第一页
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

  // 重置过滤条件
  const handleReset = () => {
    setKeyword('');
    setSelectedBrand(undefined);
    setSelectedBlogger(undefined);
    setDateRange(null);
    setPage(1);
    // 注意：不清除排序状态
  };

  // 格式化数字
  const formatNumber = (num: number): string => {
    if (num >= 10000) {
      return (num / 10000).toFixed(1) + 'w';
    }
    return num.toString();
  };
  const formatPrice = (priceInCents: number | null | undefined): string => {
    if (priceInCents == null) return '-';
    const yuan = priceInCents;
    return '¥' + yuan.toLocaleString(undefined, { maximumFractionDigits: 0 });
  };

  // 截断文本辅助函数
  const truncateText = (text: string | null | undefined, maxLength: number): string => {
    if (!text) return '';
    if (text.length <= maxLength) return text;
    return text.slice(0, maxLength) + '...';
  };

  // 关键词高亮函数
  const highlightKeyword = (text: string | null | undefined, keyword: string): React.ReactNode => {
    if (!text || !keyword || !keyword.trim()) {
      return text || '';
    }

    const searchTerm = keyword.trim();
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

  // 渲染AI分析Tooltip内容
  const renderAiAnalysisTooltip = (record: Note) => {
    const hasAiData = record.AiContentType || record.AiRelatedProducts || record.AiSummary;
    if (!hasAiData) return null;

    return (
      <div style={{ maxWidth: 500, maxHeight: 400, overflow: 'auto', color: '#fff' }}>
        <Space direction="vertical" size={12} style={{ width: '100%' }}>
          {record.AiContentType && (
            <div>
              <Text strong style={{ fontSize: 14, color: '#fff' }}>内容场景：</Text>
              <Text style={{ fontSize: 14, display: 'block', marginTop: 4, color: '#fff' }}>
                {record.AiContentType}
              </Text>
            </div>
          )}
          {record.AiRelatedProducts && (
            <div>
              <Text strong style={{ fontSize: 14, color: '#fff' }}>相关产品：</Text>
              <Text style={{ fontSize: 14, display: 'block', marginTop: 4, color: '#fff' }}>
                {record.AiRelatedProducts}
              </Text>
            </div>
          )}
          {record.AiSummary && (
            <div>
              <Text strong style={{ fontSize: 14, color: '#fff' }}>内容总结：</Text>
              <Text style={{ fontSize: 14, display: 'block', marginTop: 4, color: '#fff' }}>
                {record.AiSummary}
              </Text>
            </div>
          )}
        </Space>
      </div>
    );
  };

  // 定义表格列
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
              const content = (record.XhsContent || record.Content)?.trim() || '';
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
                    }}
                  >
                    {record.CoverImage ? (
                      <Image
                        src={getProxiedImageUrl(record.CoverImage)}
                        alt={record.Title || ''}
                        width={180}
                        height={240}
                        style={{ objectFit: 'cover' }}
                        preview={true}
                      />
                    ) : (
                      <Text type="secondary">无封面</Text>
                    )}
                  </div>

                  {/* 标题和标签 */}
                  <Tooltip title={tooltipContent} overlayStyle={{ maxWidth: 400, maxHeight: 300 }}>
                    <div style={{ marginBottom: 8, fontWeight: 500 }}>
                      {highlightKeyword(record.Title, keyword) || '无标题'}
                    </div>
                  </Tooltip>
                  <Space size="small" wrap>
                    {record.NoteType === 'video' ? (
                      <Tag color="blue" icon={<VideoCameraOutlined />}>
                        {record.VideoDuration ? `${record.VideoDuration}` : '视频'}
                      </Tag>
                    ) : (
                      <Tag color="green" icon={<PictureOutlined />}>
                        图文
                      </Tag>
                    )}
                    {record.IsAdNote && <Tag color="red">广告</Tag>}
                    {record.IsBusiness && <Tag color="orange">商业</Tag>}
                    {record.XhsNoteLink && (
                      <LinkOutlined
                        style={{ color: '#1890ff', cursor: 'pointer', fontSize: 16 }}
                        onClick={(e) => {
                          e.stopPropagation();
                          window.open(record.XhsNoteLink!, '_blank');
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
            dataIndex: 'CoverImage',
            key: 'CoverImage',
            fixed: 'left' as const,
            width: 100,
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
                    alt={record.Title || ''}
                    preview={true}
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
            dataIndex: 'Title',
            key: 'Title',
            width: 300,
            fixed: 'left' as const,
            ellipsis: true,
            render: (text: string, record: Note) => {
              const content = (record.XhsContent || record.Content)?.trim() || '';
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

              const hasAiData = record.AiContentType || record.AiRelatedProducts || record.AiSummary;
              const aiTooltipContent = renderAiAnalysisTooltip(record);

              return (
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                    {hasAiData ? (
                      <Tooltip
                        title={aiTooltipContent}
                        overlayStyle={{ maxWidth: 520 }}
                        overlayInnerStyle={{ maxHeight: 450, overflow: 'auto' }}
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
                    <Tooltip title={tooltipContent} overlayStyle={{ maxWidth: 400, maxHeight: 300 }}>
                      <div style={{ fontWeight: 400, flex: 1 }}>
                        {highlightKeyword(text, keyword) || '无标题'}
                      </div>
                    </Tooltip>
                  </div>
                  <Space size="small" wrap>
                    {record.NoteType === 'video' ? (
                      <Tag color="blue" icon={<VideoCameraOutlined />}>
                        {record.VideoDuration ? `${record.VideoDuration}` : '视频'}
                      </Tag>
                    ) : (
                      <Tag color="green" icon={<PictureOutlined />}>
                        图文
                      </Tag>
                    )}
                    {record.IsAdNote && <Tag color="red">广告</Tag>}
                    {record.IsBusiness && <Tag color="orange">商业</Tag>}
                    {record.XhsNoteLink && (
                      <LinkOutlined
                        style={{ color: '#1890ff', cursor: 'pointer', fontSize: 16 }}
                        onClick={(e) => {
                          e.stopPropagation();
                          window.open(record.XhsNoteLink!, '_blank');
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
              const hasAiData = record.AiContentType || record.AiRelatedProducts || record.AiSummary;

              if (!hasAiData) {
                return <Text type="secondary">暂无分析</Text>;
              }

              return (
                <div style={{ marginTop: '-8px', paddingTop: 0 }}>
                  <Space direction="vertical" size={12} style={{ width: '100%' }}>
                    {record.AiContentType && (
                      <div>
                        <Text strong style={{ fontSize: 16 }}>
                          内容场景：
                        </Text>
                        <Tooltip title={record.AiContentType}>
                          <Text style={{ fontSize: 16 }}>
                            {highlightKeyword(truncateText(record.AiContentType, 8), keyword)}
                          </Text>
                        </Tooltip>
                      </div>
                    )}
                    {record.AiRelatedProducts && (
                      <div>
                        <Text strong style={{ fontSize: 16 }}>
                          相关产品：
                        </Text>
                        <Text style={{ fontSize: 16 }}>
                          {highlightKeyword(record.AiRelatedProducts, keyword)}
                        </Text>
                      </div>
                    )}
                    {record.AiSummary && (
                      <div>
                        <Text strong style={{ fontSize: 16 }}>
                          内容总结：
                        </Text>
                        <Text style={{ fontSize: 16 }}>
                          {highlightKeyword(record.AiSummary, keyword)}
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
      key: 'Blogger',
      width: 150,
      render: (_, record: Note) => {
        const verified = !!record.OfficialVerified;
        const initial = record.BloggerNickName?.[0];
        const avatarSrc = getProxiedImageUrl(record.SmallAvatar || record.BigAvatar);
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
            {record.XhsUserId ? (
              <a
                href={`https://www.xiaohongshu.com/user/profile/${record.XhsUserId}`}
                target="_blank"
                rel="noopener noreferrer"
                style={{ fontSize: 12, color: '#1890ff', cursor: 'pointer' }}
                onClick={(e) => e.stopPropagation()}
              >
                {record.BloggerNickName || '未知博主'}
              </a>
            ) : (
              <span style={{ fontSize: 12 }}>
                {record.BloggerNickName || '未知博主'}
              </span>
            )}
          </Space>
        );
      },
    },
    {
      title: '品牌',
      dataIndex: 'BrandName',
      key: 'BrandName',
      render: (brandName: string | null, record: Note) => {
        if (!brandName || !record.BrandId || !record.BrandIdKey) {
          return <span style={{ color: '#999' }}>-</span>;
        }
        const qianGuaUrl = `https://app.qian-gua.com/#/brand/detail/${record.BrandId}/${record.BrandIdKey}`;
        return (
          <Tag
            color="blue"
            style={{ cursor: 'pointer', whiteSpace: 'nowrap' }}
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
      dataIndex: 'Fans',
      key: 'Fans',
      width: 110,
      align: 'right',
      sorter: true,
      sortOrder: sortField === 'Fans' ? (sortOrder === 'asc' ? 'ascend' : 'descend') : null,
      onHeaderCell: () => ({
        onClick: (e: React.MouseEvent) => handleSortClick('Fans', e),
      }),
      render: (fans: number | null | undefined) => (fans != null ? fans.toLocaleString() : '-'),
    },
    {
      title: '合作报价',
      dataIndex: 'AdPrice',
      key: 'AdPrice',
      width: 130,
      align: 'right',
      sorter: true,
      sortOrder: sortField === 'AdPrice' ? (sortOrder === 'asc' ? 'ascend' : 'descend') : null,
      onHeaderCell: () => ({
        onClick: (e: React.MouseEvent) => handleSortClick('AdPrice', e),
      }),
      render: (price: number | null | undefined) => formatPrice(price),
    },
    {
      title: '互动',
      key: 'Interaction',
      width: 100,
      align: 'right',
      render: (_: any, record: Note) => {
        const total = record.LikedCount + record.CommentsCount + record.CollectedCount;
        return formatNumber(total);
      },
    },
    {
      title: '点赞',
      dataIndex: 'LikedCount',
      key: 'LikedCount',
      width: 80,
      align: 'right',
      sorter: true,
      sortOrder: sortField === 'LikedCount' ? (sortOrder === 'asc' ? 'ascend' : 'descend') : null,
      onHeaderCell: () => ({
        onClick: (e: React.MouseEvent) => handleSortClick('LikedCount', e),
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
      dataIndex: 'CollectedCount',
      key: 'CollectedCount',
      width: 80,
      align: 'right',
      sorter: true,
      sortOrder: sortField === 'CollectedCount' ? (sortOrder === 'asc' ? 'ascend' : 'descend') : null,
      onHeaderCell: () => ({
        onClick: (e: React.MouseEvent) => handleSortClick('CollectedCount', e),
      }),
      render: (count: number) => formatNumber(count),
    },
    {
      title: '评论',
      dataIndex: 'CommentsCount',
      key: 'CommentsCount',
      width: 80,
      align: 'right',
      sorter: true,
      sortOrder: sortField === 'CommentsCount' ? (sortOrder === 'asc' ? 'ascend' : 'descend') : null,
      onHeaderCell: () => ({
        onClick: (e: React.MouseEvent) => handleSortClick('CommentsCount', e),
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
      dataIndex: 'ShareCount',
      key: 'ShareCount',
      width: 80,
      align: 'right',
      sorter: true,
      sortOrder: sortField === 'ShareCount' ? (sortOrder === 'asc' ? 'ascend' : 'descend') : null,
      onHeaderCell: () => ({
        onClick: (e: React.MouseEvent) => handleSortClick('ShareCount', e),
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
      dataIndex: 'PublishTime',
      key: 'PublishTime',
      fixed: 'right' as const,
      width: 160,
      sorter: true,
      defaultSortOrder: 'descend',
      sortOrder: sortField === 'PublishTime' ? (sortOrder === 'asc' ? 'ascend' : 'descend') : null,
      onHeaderCell: () => ({
        onClick: (e: React.MouseEvent) => handleSortClick('PublishTime', e),
      }),
      render: (time: string) => dayjs(time).format('YYYY-MM-DD HH:mm'),
    },
  ];

  return (
    <div>
      <h1 style={{ fontSize: 24, marginBottom: 24 }}>全部笔记</h1>

      {/* 过滤器 */}
      <Card style={{ marginBottom: 24 }}>
        <Row gutter={[16, 16]}>
          <Col xs={24} sm={12} md={6}>
            <div style={{ marginBottom: 8 }}>
              <strong>品牌：</strong>
            </div>
            <Select
              style={{ width: '100%' }}
              placeholder="选择品牌"
              allowClear
              value={selectedBrand}
              onChange={setSelectedBrand}
              showSearch
              filterOption={(input, option) => {
                const label = typeof option?.label === 'string' ? option.label : String(option?.children || '');
                return label.toLowerCase().includes(input.toLowerCase());
              }}
            >
              {brands.map((brand) => {
                const brandKey = `${brand.BrandId}#KF#${brand.BrandName}`;
                return (
                  <Option key={brandKey} value={brandKey} label={brand.BrandName}>
                    {brand.BrandName}
                  </Option>
                );
              })}
            </Select>
          </Col>

          <Col xs={24} sm={12} md={6}>
            <div style={{ marginBottom: 8 }}>
              <strong>博主：</strong>
            </div>
            <Select
              style={{ width: '100%' }}
              placeholder="选择博主"
              allowClear
              value={selectedBlogger}
              onChange={setSelectedBlogger}
              showSearch
              filterOption={(input, option) => {
                const label = typeof option?.label === 'string' ? option.label : String(option?.children || '');
                return label.toLowerCase().includes(input.toLowerCase());
              }}
            >
              {bloggers.map((blogger) => (
                <Option key={blogger.BloggerId} value={blogger.BloggerId} label={blogger.BloggerNickName}>
                  {blogger.BloggerNickName}
                </Option>
              ))}
            </Select>
          </Col>

          <Col xs={24} sm={12} md={6}>
            <div style={{ marginBottom: 8 }}>
              <strong>发布日期：</strong>
            </div>
            <RangePicker
              style={{ width: '100%' }}
              value={dateRange}
              onChange={(dates) => setDateRange(dates)}
              format="YYYY-MM-DD"
            />
          </Col>

          <Col xs={24} sm={12} md={6}>
            <div style={{ marginBottom: 8 }}>
              <strong>关键词：</strong>
            </div>
            <Input
              placeholder="搜索标题、内容、AI分析结果等"
              allowClear
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              onPressEnter={() => {
                setPage(1);
                loadNotes(1);
              }}
            />
          </Col>

          <Col xs={24} style={{ display: 'flex', alignItems: 'flex-end', marginTop: 8 }}>
            <Space>
              <Button type="primary" onClick={() => {
                setPage(1);
                loadNotes(1);
              }}>
                搜索
              </Button>
              <Button onClick={handleReset}>重置</Button>
            </Space>
          </Col>
        </Row>
      </Card>

      {/* 关键数据统计 */}
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="笔记总数"
              value={stats?.totalNotes ?? '-'}
              prefix={<FileTextOutlined />}
              valueStyle={{ color: '#1890ff' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="品牌数量"
              value={stats?.totalBrands ?? '-'}
              prefix={<TagsOutlined />}
              valueStyle={{ color: '#52c41a' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="达人数量"
              value={stats?.totalBloggers ?? '-'}
              prefix={<UserOutlined />}
              valueStyle={{ color: '#faad14' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="笔记详情缺失"
              value={stats?.missingContent ?? '-'}
              prefix={<FileExclamationOutlined />}
              valueStyle={{ color: '#ff4d4f' }}
            />
          </Card>
        </Col>
      </Row>

      {/* 笔记列表 */}
      <Table
        columns={columns}
        dataSource={notes}
        rowKey="NoteId"
        loading={loading}
        onChange={handleTableChange}
        showSorterTooltip={false}
        scroll={{ x: 'max-content' }}
        title={() => (
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <Space size={16} align="center">
              <Button
                onClick={handleExport}
                loading={exporting}
                disabled={notes.length === 0}
              >
                导出Excel
              </Button>
              <Checkbox
                checked={showAiAnalysis}
                onChange={(e) => setShowAiAnalysis(e.target.checked)}
              >
                显示AI分析
              </Checkbox>
            </Space>
          </div>
        )}
        pagination={{
          current: page,
          pageSize: pageSize,
          total: total,
          showSizeChanger: true,
          showQuickJumper: true,
          showTotal: (total, range) =>
            `第 ${range[0]}-${range[1]} 条，共 ${total} 条`,
          pageSizeOptions: ['10', '20', '50', '100'],
          onChange: (newPage, newPageSize) => {
            if (newPageSize !== pageSize) {
              setPageSize(newPageSize);
              setPage(1);
            } else {
              setPage(newPage);
              loadNotes(newPage);
            }
          },
        }}
      />
    </div>
  );
}
