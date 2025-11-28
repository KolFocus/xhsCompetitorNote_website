'use client';

export const dynamic = 'force-dynamic';

import React, { useEffect, useMemo, useState, useRef, Suspense } from 'react';
import {
  Avatar,
  Button,
  Card,
  Checkbox,
  Col,
  Empty,
  Image,
  Input,
  message,
  Modal,
  Row,
  Select,
  Space,
  Spin,
  Table,
  Tag,
  Tooltip,
  Typography,
  DatePicker,
} from 'antd';
import {
  ClearOutlined,
  DeleteOutlined,
  ExclamationCircleOutlined,
  LinkOutlined,
  PictureOutlined,
  VideoCameraOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import type { Dayjs } from 'dayjs';
import { useSearchParams } from 'next/navigation';

import type { BulkTaggingResult, TagDTO, TagSetDTO } from '@/lib/types';

const { RangePicker } = DatePicker;
const { Option } = Select;

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

interface NoteRecord {
  NoteId: string;
  Title: string;
  Content: string | null;
  CoverImage: string | null;
  PublishTime: string;
  BloggerNickName: string;
  BloggerSmallAvatar: string | null;
  BloggerId: string;
  XhsUserId?: string | null;
  XhsContent: string | null;
  XhsNoteLink: string | null;
  AiContentType: string | null;
  AiRelatedProducts: string | null;
  AiSummary: string | null;
  AiStatus?: string | null;
  AiErr?: string | null;
  NoteType: string;
  VideoDuration: string | null;
}

interface NotesResponse {
  success: boolean;
  data: {
    list: NoteRecord[];
    total: number;
    page: number;
    pageSize: number;
    noteTags?: Record<string, TagDTO[]>;
  };
  error?: string;
}

type NoteTagMap = Record<string, TagDTO[]>;

interface Report {
  reportId: string;
  reportName: string;
  createdAt: string;
  updatedAt: string;
  activeNotesCount: number;
  ignoredNotesCount: number;
}

interface Brand {
  BrandId: string;
  BrandName: string;
}

interface Blogger {
  BloggerId: string;
  BloggerNickName: string;
}

const { Title, Text } = Typography;

const NoteTaggingPage: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [notesLoading, setNotesLoading] = useState(false);
  const [tagSets, setTagSets] = useState<TagSetDTO[]>([]);
  const [selectedTagSetId, setSelectedTagSetId] = useState<string | null>(null);
  const [noteList, setNoteList] = useState<NoteRecord[]>([]);
  const [noteTotal, setNoteTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [noteTags, setNoteTags] = useState<NoteTagMap>({});
  const [filterTagId, setFilterTagId] = useState<string | null>('__untagged__');
  const [savingNoteId, setSavingNoteId] = useState<string | null>(null);
  const [selectedNoteIds, setSelectedNoteIds] = useState<string[]>([]);
  const [pendingTagChanges, setPendingTagChanges] = useState<Record<string, string[]>>({});
  const [submittingNoteId, setSubmittingNoteId] = useState<string | null>(null);
  const [submittedNoteIds, setSubmittedNoteIds] = useState<Set<string>>(new Set());
  const [analyzingNoteIds, setAnalyzingNoteIds] = useState<Set<string>>(new Set());
  const [bulkModalOpen, setBulkModalOpen] = useState(false);
  const [bulkModalLoading, setBulkModalLoading] = useState(false);
  const [bulkSelectedTagIds, setBulkSelectedTagIds] = useState<string[]>([]);
  const searchParams = useSearchParams();
  const lastAppliedQuery = useRef<{ tagSetId?: string | null; reportId?: string | null }>({
    tagSetId: undefined,
    reportId: undefined,
  });

  // 新增筛选条件
  const [reports, setReports] = useState<Report[]>([]);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [bloggers, setBloggers] = useState<Blogger[]>([]);
  const [keyword, setKeyword] = useState<string>(''); // 关键词搜索
  const [selectedReportId, setSelectedReportId] = useState<string | undefined>();
  const [selectedBrand, setSelectedBrand] = useState<string | undefined>();
  const [selectedBlogger, setSelectedBlogger] = useState<string | undefined>();
  const [dateRange, setDateRange] = useState<[Dayjs | null, Dayjs | null] | null>(null);
  const [previewImage, setPreviewImage] = useState<string | undefined>(undefined);
  const [showUnanalyzed, setShowUnanalyzed] = useState(false);
  const [showMissingContent, setShowMissingContent] = useState(false);

  const fetchTagSets = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/tag-sets?withTags=true');
      const result = await response.json();
      if (result.success) {
        setTagSets(result.data.items || []);
        if (!selectedTagSetId && result.data.items?.length > 0) {
          setSelectedTagSetId(result.data.items[0].tagSetId);
        }
      } else {
        message.error(result.error || '加载标签系列失败');
      }
    } catch (error) {
      console.error('Failed to load tag sets', error);
      message.error('加载标签系列失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTagSets();
    loadFilters();
  }, []);

  const tagSetIdFromQuery = searchParams.get('tagSetId');
  const reportIdFromQuery = searchParams.get('reportId');

  useEffect(() => {
    const { tagSetId, reportId } = lastAppliedQuery.current;
    if (tagSetIdFromQuery && tagSetIdFromQuery !== tagSetId) {
      setSelectedTagSetId(tagSetIdFromQuery);
    }
    if (reportIdFromQuery && reportIdFromQuery !== reportId) {
      setSelectedReportId(reportIdFromQuery);
    }
    lastAppliedQuery.current = {
      tagSetId: tagSetIdFromQuery,
      reportId: reportIdFromQuery,
    };
  }, [tagSetIdFromQuery, reportIdFromQuery]);

  // 加载筛选条件数据（报告、品牌、博主）
  const loadFilters = async () => {
    try {
      const [reportsRes, brandsRes, bloggersRes] = await Promise.all([
        fetch('/api/reports'),
        fetch('/api/allBrands'),
        fetch('/api/bloggers'),
      ]);

      const reportsData = await reportsRes.json();
      const brandsData = await brandsRes.json();
      const bloggersData = await bloggersRes.json();

      if (reportsData.success) {
        setReports(reportsData.data.list || []);
      }
      if (brandsData.success) {
        setBrands(brandsData.data || []);
      }
      if (bloggersData.success) {
        setBloggers(bloggersData.data || []);
      }
    } catch (error) {
      console.error('Failed to load filters:', error);
    }
  };

  const currentTagSet = useMemo(
    () => tagSets.find((tagSet) => tagSet.tagSetId === selectedTagSetId) || null,
    [selectedTagSetId, tagSets],
  );

  const tagOptions = useMemo(() => {
    const options = [
      {
        label: '仅显示未打标笔记',
        value: '__untagged__',
      },
      ...(currentTagSet?.tags || []).map((tag) => ({
        label: tag.tagName,
        value: tag.tagId,
      })),
    ];
    return options;
  }, [currentTagSet]);

  const loadNotes = async (pageValue = page, pageSizeValue = pageSize) => {
    if (!selectedTagSetId) {
      return;
    }

    try {
      setNotesLoading(true);
      const params = new URLSearchParams({
        page: String(pageValue),
        pageSize: String(pageSizeValue),
      });

      // 添加筛选参数
      if (keyword && keyword.trim()) {
        params.set('keyword', keyword.trim());
      }
      if (selectedReportId) {
        params.set('reportId', selectedReportId);
      }
      if (selectedBrand) {
        params.set('brandKey', selectedBrand);
      }
      if (selectedBlogger) {
        params.set('bloggerId', selectedBlogger);
      }
      if (dateRange && dateRange[0] && dateRange[1]) {
        params.set('startDate', dateRange[0].format('YYYY-MM-DD'));
        params.set('endDate', dateRange[1].format('YYYY-MM-DD'));
      }

      // 添加标签筛选参数
      if (selectedTagSetId) {
        params.set('tagSetId', selectedTagSetId);
      }
      if (filterTagId) {
        params.set('tagFilter', filterTagId);
      }
      
      // 添加数据状态筛选参数
      if (showUnanalyzed) {
        params.set('showUnanalyzed', 'true');
      }
      if (showMissingContent) {
        params.set('showMissingContent', 'true');
      }

      const response = await fetch(`/api/notes?${params.toString()}`);
      const result: NotesResponse = await response.json();

      if (!result.success) {
        message.error(result.error || '加载笔记失败');
        return;
      }

      console.log('[Frontend] Received data:', {
        listCount: result.data.list.length,
        total: result.data.total,
        noteTagsCount: result.data.noteTags ? Object.keys(result.data.noteTags).length : 0,
        noteTags: result.data.noteTags,
      });
      
      // 检查是否有提示消息
      if ((result.data as any).message) {
        message.warning((result.data as any).message);
      }
      
      setNoteList(result.data.list);
      setNoteTotal(result.data.total);
      setPage(result.data.page);
      setPageSize(result.data.pageSize);
      
      // 使用后端返回的标签数据
      if (result.data.noteTags) {
        console.log('[Frontend] Setting noteTags:', result.data.noteTags);
        setNoteTags(result.data.noteTags);
      } else {
        console.log('[Frontend] No noteTags in response, setting empty');
        setNoteTags({});
      }
    } catch (error) {
      console.error('Failed to load notes', error);
      message.error('加载笔记失败');
    } finally {
      setNotesLoading(false);
    }
  };

  useEffect(() => {
    if (selectedTagSetId) {
      setFilterTagId('__untagged__');
      loadNotes(1, pageSize);
      setSelectedNoteIds([]);
    }
  }, [selectedTagSetId]);

  // 当筛选条件变化时重新加载笔记
  useEffect(() => {
    if (selectedTagSetId) {
      loadNotes(1, pageSize);
    }
  }, [selectedReportId, selectedBrand, selectedBlogger, dateRange, filterTagId, showUnanalyzed, showMissingContent]);

  const handleTagChange = (noteId: string, value: string[]) => {
    if (!selectedTagSetId) return;
    // 更新待提交的标签变化
    setPendingTagChanges((prev) => ({
      ...prev,
      [noteId]: value,
    }));
    // 从已提交集合中移除（因为有新的更改）
    setSubmittedNoteIds((prev) => {
      const next = new Set(prev);
      next.delete(noteId);
      return next;
    });
  };

  const handleSubmit = async (noteId: string) => {
    if (!selectedTagSetId) return;
    const tagIds = pendingTagChanges[noteId];
    if (!tagIds) return;

    try {
      setSubmittingNoteId(noteId);
      const response = await fetch('/api/notes/tagging', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          noteId,
          tagSetId: selectedTagSetId,
          tagIds,
        }),
      });
      const result = await response.json();
      if (result.success) {
        setNoteTags((prev) => ({
          ...prev,
          [noteId]: result.data.tags,
        }));
        // 清除待提交的更改
        setPendingTagChanges((prev) => {
          const next = { ...prev };
          delete next[noteId];
          return next;
        });
        // 添加到已提交集合
        setSubmittedNoteIds((prev) => new Set(prev).add(noteId));
        message.success('已保存');
      } else {
        message.error(result.error || '保存失败');
      }
    } catch (error) {
      console.error('Failed to save note tags', error);
      message.error('保存失败');
    } finally {
      setSubmittingNoteId(null);
    }
  };

  const handleAnalyzeNote = async (noteId: string) => {
    try {
      setAnalyzingNoteIds(prev => new Set(prev).add(noteId));
      
      const response = await fetch(`/api/notes/${noteId}/ai-analysis`, {
        method: 'POST',
      });
      const result = await response.json();
      
      if (result.success) {
        // 更新本地笔记数据
        setNoteList(prev => prev.map(note => 
          note.NoteId === noteId 
            ? { 
                ...note, 
                AiContentType: result.data.aiContentType,
                AiRelatedProducts: result.data.aiRelatedProducts,
                AiSummary: result.data.aiSummary,
                AiStatus: result.data.aiStatus,
                AiErr: result.data.aiErr || null,
              } 
            : note
        ));
        
        if (result.data.aiStatus === '分析成功') {
          message.success('分析完成');
        } else {
          message.error(`分析失败: ${result.data.aiErr || '未知错误'}`);
        }
      } else {
        message.error(result.error || '分析失败');
      }
    } catch (error) {
      console.error('AI分析请求失败:', error);
      message.error('分析请求失败');
    } finally {
      setAnalyzingNoteIds(prev => {
        const next = new Set(prev);
        next.delete(noteId);
        return next;
      });
    }
  };

  // 前端只需要过滤掉正在分析中的笔记（如果开启了showUnanalyzed筛选）
  const filteredNotes = useMemo(() => {
    if (!showUnanalyzed) {
      return noteList;
    }
    
    return noteList.filter((note) => {
      // 如果开启了"仅显示未分析"筛选，需要排除正在分析中的笔记
      const isAnalyzing = analyzingNoteIds.has(note.NoteId);
      return !isAnalyzing;
    });
  }, [noteList, showUnanalyzed, analyzingNoteIds]);

  const handleBulkTagging = async () => {
    if (!selectedTagSetId || bulkSelectedTagIds.length === 0) {
      message.warning('请选择要追加的标签');
      return;
    }
    try {
      setBulkModalLoading(true);
      const response = await fetch('/api/notes/tagging/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          noteIds: selectedNoteIds,
          tagSetId: selectedTagSetId,
          tagIds: bulkSelectedTagIds,
        }),
      });
      const result = await response.json();
      if (result.success) {
        const data: BulkTaggingResult = result.data;
        if (data.failed.length > 0) {
          message.warning(
            `部分成功：成功 ${data.succeedCount} 条，失败 ${data.failed.length} 条`,
          );
        } else {
          message.success(`成功为 ${data.succeedCount} 条笔记追加标签`);
        }
        setBulkModalOpen(false);
        setBulkSelectedTagIds([]);
        await loadNotes(page, pageSize);
      } else {
        message.error(result.error || '批量打标失败');
      }
    } catch (error) {
      console.error('Bulk tagging failed', error);
      message.error('批量打标失败');
    } finally {
      setBulkModalLoading(false);
    }
  };

  const handleBulkClear = async () => {
    if (!selectedTagSetId || selectedNoteIds.length === 0) {
      return;
    }
    Modal.confirm({
      title: '确认清除所选笔记的标签？',
      content: '该操作会删除所选笔记在当前标签系列下的全部标签，且不可恢复。',
      okText: '清除',
      okButtonProps: { danger: true },
      cancelText: '取消',
      onOk: async () => {
        try {
          const response = await fetch('/api/notes/tagging/bulk', {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              noteIds: selectedNoteIds,
              tagSetId: selectedTagSetId,
            }),
          });
          const result = await response.json();
          if (result.success) {
            message.success(`已清除 ${result.data.succeedCount} 条笔记的标签`);
            setSelectedNoteIds([]);
            await loadNotes(page, pageSize);
          } else {
            message.error(result.error || '批量清除失败');
          }
        } catch (error) {
          console.error('Bulk clear failed', error);
          message.error('批量清除失败');
        }
      },
    });
  };

  // 截断文本辅助函数
  const truncateText = (text: string | null | undefined, maxLength: number): string => {
    if (!text) return '';
    if (text.length <= maxLength) return text;
    return text.slice(0, maxLength) + '...';
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

  const columns = [
    {
      title: '笔记',
      dataIndex: 'Title',
      key: 'title',
      render: (value: string, record: NoteRecord) => {
        const coverImageUrl = getProxiedImageUrl(record.CoverImage);
        const noteContent = record.XhsContent || record.Content || '';

        return (
          <div style={{ width: 180 }}>
            {/* 图片 */}
            <div
              style={{
                width: 180,
                height: 240,
                cursor: coverImageUrl ? 'pointer' : 'default',
                marginBottom: 8,
                overflow: 'hidden',
                borderRadius: 4,
                backgroundColor: '#f0f0f0',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
              onClick={() => {
                if (coverImageUrl) {
                  setPreviewImage(coverImageUrl);
                }
              }}
            >
              {coverImageUrl ? (
                <Image
                  src={coverImageUrl}
                  alt={value || '笔记封面'}
                  width={180}
                  height={240}
                  style={{ objectFit: 'cover' }}
                  preview={false}
                />
              ) : (
                <Text type="secondary">无封面</Text>
              )}
            </div>

            {/* 标题+笔记链接 */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <Tooltip
                title={noteContent ? <div style={{ maxWidth: 400, whiteSpace: 'pre-wrap' }}>{noteContent}</div> : null}
                placement="topLeft"
              >
                <Title level={5} style={{ margin: 0, flex: 1, fontSize: 14 }}>
                  {highlightKeyword(value, keyword) || '未命名笔记'}
                </Title>
              </Tooltip>
              {record.XhsNoteLink && (
                <LinkOutlined
                  style={{ color: '#1890ff', cursor: 'pointer', flexShrink: 0 }}
                  onClick={(e) => {
                    e.stopPropagation();
                    window.open(record.XhsNoteLink!, '_blank');
                  }}
                />
              )}
            </div>

            {/* 笔记类型和达人名称 */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
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
              </Space>
              {record.XhsUserId ? (
                <a
                  href={`https://www.xiaohongshu.com/user/profile/${record.XhsUserId}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ fontSize: 14, color: '#1890ff', cursor: 'pointer' }}
                  onClick={(e) => e.stopPropagation()}
                >
                  {record.BloggerNickName || '未知博主'}
                </a>
              ) : (
                <Text type="secondary" style={{ fontSize: 14 }}>
                  {record.BloggerNickName || '未知博主'}
                </Text>
              )}
            </div>
          </div>
        );
      },
    },
    {
      title: 'AI分析结果',
      key: 'aiAnalysis',
      width: 450,
      render: (_: unknown, record: NoteRecord) => {
        const hasAiData = record.AiContentType || record.AiRelatedProducts || record.AiSummary;
        const isAnalyzing = analyzingNoteIds.has(record.NoteId);
        const isFailed = record.AiStatus === '分析失败';
        const needsAnalysis = !hasAiData;
        
        // 检查是否有内容可供分析
        const noteContent = record.XhsContent || record.Content;
        const hasContent = noteContent && noteContent.trim().length > 0;

        // 分析失败 - 显示失败信息和重新分析按钮（仅当有内容时）
        if (isFailed && !isAnalyzing) {
          return (
            <Space direction="vertical" align="start" size="small">
              <Space align="center">
                <Text type="danger">分析失败</Text>
                <Tooltip title={record.AiErr || '未知错误'}>
                  <ExclamationCircleOutlined style={{ color: '#ff4d4f' }} />
                </Tooltip>
              </Space>
              {hasContent && (
                <Button
                  type="link"
                  size="small"
                  onClick={() => handleAnalyzeNote(record.NoteId)}
                  style={{ padding: 0, height: 'auto' }}
                >
                  重新分析
                </Button>
              )}
            </Space>
          );
        }

        // 待分析 - 仅当有内容时显示开始分析按钮
        if (needsAnalysis && !isAnalyzing && !isFailed) {
          if (!hasContent) {
            // 没有内容，不显示分析按钮
            return <Text type="secondary">暂无分析</Text>;
          }
          
          return (
            <Space direction="vertical" align="start" size="small">
              <Text type="secondary">暂无分析</Text>
              <Button
                type="link"
                size="small"
                onClick={() => handleAnalyzeNote(record.NoteId)}
                style={{ padding: 0, height: 'auto' }}
              >
                开始分析
              </Button>
            </Space>
          );
        }

        // 分析中
        if (isAnalyzing) {
          return (
            <Space>
              <Text type="secondary">分析中...</Text>
            </Space>
          );
        }

        // 已有分析结果
        return (
          <div style={{ marginTop: '-8px', paddingTop: 0 }}>
            <Space direction="vertical" size={12} style={{ width: '100%' }}>
              {record.AiContentType && (
                <div>
                  <Text strong style={{ fontSize: 16 }}>内容场景：</Text>
                  <Tooltip title={record.AiContentType}>
                    <Text style={{ fontSize: 16 }}>{highlightKeyword(truncateText(record.AiContentType, 8), keyword)}</Text>
                  </Tooltip>
                </div>
              )}
              {record.AiRelatedProducts && (
                <div>
                  <Text strong style={{ fontSize: 16 }}>相关产品：</Text>
                  <Text style={{ fontSize: 16 }}>{highlightKeyword(record.AiRelatedProducts, keyword)}</Text>
                </div>
              )}
              {record.AiSummary && (
                <div>
                  <Text strong style={{ fontSize: 16 }}>内容总结：</Text>
                  <Text style={{ fontSize: 16 }}>{highlightKeyword(record.AiSummary, keyword)}</Text>
                </div>
              )}
            </Space>
          </div>
        );
      },
    },
    {
      title: '当前标签',
      dataIndex: 'noteId',
      render: (_: unknown, record: NoteRecord) => {
        const assigned = noteTags[record.NoteId] || [];
        if (assigned.length === 0) {
          return <Text type="secondary">未打标</Text>;
        }
        return (
          <Space wrap>
            {assigned.map((tag) => (
              <Tag key={tag.tagId}>{tag.tagName}</Tag>
            ))}
          </Space>
        );
      },
    },
    {
      title: '编辑',
      key: 'editor',
      width: 260,
      render: (_: unknown, record: NoteRecord) => {
        const assigned = noteTags[record.NoteId] || [];
        const pending = pendingTagChanges[record.NoteId];
        const hasPendingChanges = pending !== undefined;
        const isSubmitting = submittingNoteId === record.NoteId;
        const isSubmitted = submittedNoteIds.has(record.NoteId);
        
        return (
          <Space direction="vertical" style={{ width: '100%' }} size="small">
            <Select
              style={{ width: '100%' }}
              mode="multiple"
              placeholder="选择标签"
              options={tagOptions}
              value={hasPendingChanges ? pending : assigned.map((tag) => tag.tagId)}
              onChange={(value) => handleTagChange(record.NoteId, value)}
              loading={savingNoteId === record.NoteId}
              allowClear
            />
            {hasPendingChanges && (
              <Button
                type="primary"
                size="small"
                onClick={() => handleSubmit(record.NoteId)}
                loading={isSubmitting}
                disabled={isSubmitted}
                style={{ width: '100%' }}
              >
                {isSubmitted ? '已提交' : '提交'}
              </Button>
            )}
          </Space>
        );
      },
    },
  ];

  return (
    <div style={{ padding: 24 }}>
      <Space direction="vertical" style={{ width: '100%' }} size="large">
        <Card>
              <Space direction="vertical" size={4} style={{ width: '100%' }}>
                <Text type="secondary">标签系列</Text>
                <Select
                  showSearch
              style={{ width: '100%', maxWidth: 400 }}
                  placeholder="请选择标签系列"
                  value={selectedTagSetId || undefined}
                  onChange={(value) => setSelectedTagSetId(value)}
                  options={tagSets.map((tagSet) => ({
                    label: `${tagSet.tagSetName} ${
                      tagSet.type === 'system' ? '(系统)' : ''
                    }`,
                    value: tagSet.tagSetId,
                  }))}
                  loading={loading}
                />
              </Space>
        </Card>

        <Card>
          <Row gutter={[16, 16]}>
            <Col xs={24} sm={12} md={6}>
              <div style={{ marginBottom: 8 }}>
                <strong>分析报告：</strong>
              </div>
              <Select
                style={{ width: '100%' }}
                placeholder="选择分析报告"
                allowClear
                value={selectedReportId}
                onChange={setSelectedReportId}
                showSearch
                filterOption={(input, option) => {
                  const label = typeof option?.label === 'string' ? option.label : String(option?.children || '');
                  return label.toLowerCase().includes(input.toLowerCase());
                }}
              >
                {reports.map((report) => (
                  <Option key={report.reportId} value={report.reportId} label={report.reportName}>
                    {report.reportName}
                  </Option>
                ))}
              </Select>
            </Col>

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
                  loadNotes(1, pageSize);
                }}
              />
            </Col>

            <Col xs={24} sm={12} md={6}>
              <div style={{ marginBottom: 8 }}>
                <strong>标签筛选：</strong>
              </div>
                <Select
                style={{ width: '100%' }}
                  allowClear
                  placeholder="选择标签"
                  options={tagOptions}
                  value={filterTagId || undefined}
                  onChange={(value) => setFilterTagId(value || null)}
                  disabled={!currentTagSet}
                />
            </Col>

            <Col xs={24} sm={12} md={6}>
              <div style={{ marginBottom: 8 }}>
                <strong>数据状态：</strong>
              </div>
              <Space>
                <Tooltip title="筛选未进行AI内容分析的笔记">
                  <Checkbox 
                    checked={showUnanalyzed}
                    onChange={(e) => setShowUnanalyzed(e.target.checked)}
                  >
                    仅显示未AI分析
                  </Checkbox>
                </Tooltip>
                <Tooltip title="筛选笔记内容缺失的笔记（无法进行AI分析）">
                  <Checkbox 
                    checked={showMissingContent}
                    onChange={(e) => setShowMissingContent(e.target.checked)}
                  >
                    仅显示缺失内容
                  </Checkbox>
                </Tooltip>
              </Space>
            </Col>

            <Col xs={24} style={{ marginTop: 8 }}>
                <Space>
                <Button type="primary" onClick={() => {
                  setPage(1);
                  loadNotes(1, pageSize);
                }}>
                      搜索
                    </Button>
                    <Button
                      onClick={() => {
                    setKeyword('');
                    setSelectedReportId(undefined);
                    setSelectedBrand(undefined);
                    setSelectedBlogger(undefined);
                    setDateRange(null);
                    setFilterTagId('__untagged__');
                    setShowUnanalyzed(false);
                    setShowMissingContent(false);
                    setPage(1);
                    // 重置后重新加载笔记
                    setTimeout(() => {
                        loadNotes(1, pageSize);
                    }, 0);
                      }}
                    >
                      重置
                    </Button>
              </Space>
            </Col>
          </Row>
        </Card>

        <Card
          title="笔记列表"
          extra={
            <Space>
              <Button
                type="primary"
                disabled={selectedNoteIds.length === 0}
                onClick={() => setBulkModalOpen(true)}
              >
                批量打标
              </Button>
              <Button
                danger
                disabled={selectedNoteIds.length === 0}
                onClick={handleBulkClear}
                icon={<DeleteOutlined />}
              >
                批量清除
              </Button>
            </Space>
          }
        >
          {selectedTagSetId ? (
            <Table
              rowKey="NoteId"
              loading={notesLoading}
              dataSource={filteredNotes}
              columns={columns}
              pagination={{
                total: noteTotal,
                current: page,
                pageSize,
                showSizeChanger: true,
                showTotal: (total, range) => `第 ${range[0]}-${range[1]} 条，共 ${total} 条`,
                onChange: (nextPage, nextSize) => {
                  setPage(nextPage);
                  setPageSize(nextSize);
                  loadNotes(nextPage, nextSize);
                },
              }}
              rowSelection={{
                selectedRowKeys: selectedNoteIds,
                onChange: (keys) => setSelectedNoteIds(keys as string[]),
              }}
              locale={{
                emptyText: notesLoading ? (
                  <Spin />
                ) : (
                  <Empty description="暂无符合条件的笔记" />
                ),
              }}
            />
          ) : (
            <Empty
              description="请先选择标签系列"
              image={Empty.PRESENTED_IMAGE_SIMPLE}
            />
          )}
        </Card>
      </Space>

      <Modal
        title="批量打标"
        open={bulkModalOpen}
        onCancel={() => {
          if (!bulkModalLoading) {
            setBulkModalOpen(false);
            setBulkSelectedTagIds([]);
          }
        }}
        onOk={handleBulkTagging}
        okButtonProps={{ loading: bulkModalLoading }}
        destroyOnClose
      >
        <Space direction="vertical" size={16} style={{ width: '100%' }}>
          <Text type="secondary">
            已选择 {selectedNoteIds.length} 条笔记，将为这些笔记追加以下标签：
          </Text>
          <Select
            mode="multiple"
            style={{ width: '100%' }}
            placeholder="选择要追加的标签"
            options={tagOptions}
            value={bulkSelectedTagIds}
            onChange={setBulkSelectedTagIds}
          />
          <Text type="secondary" style={{ fontSize: 12 }}>
            提示：批量打标为追加操作，不会移除已存在的标签。
          </Text>
        </Space>
      </Modal>

      <Image
        width={0}
        height={0}
        style={{ display: 'none' }}
        src={previewImage}
        preview={{
          visible: !!previewImage,
          src: previewImage,
          onVisibleChange: (visible) => {
            if (!visible) {
              setPreviewImage(undefined);
            }
          },
        }}
      />
    </div>
  );
};

const NoteTaggingPageWithSuspense = () => {
  return (
    <Suspense fallback={<div style={{ padding: 24 }}>加载中...</div>}>
      <NoteTaggingPage />
    </Suspense>
  );
};

export default NoteTaggingPageWithSuspense;

