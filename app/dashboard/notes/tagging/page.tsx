'use client';

export const dynamic = 'force-dynamic';

import React, { useEffect, useMemo, useState, useRef, Suspense } from 'react';
import {
  Avatar,
  Button,
  Card,
  Col,
  Empty,
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
  ReloadOutlined,
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
    return url;
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
}

interface NotesResponse {
  success: boolean;
  data: {
    list: NoteRecord[];
    total: number;
    page: number;
    pageSize: number;
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
  const [selectedReportId, setSelectedReportId] = useState<string | undefined>();
  const [selectedBrand, setSelectedBrand] = useState<string | undefined>();
  const [selectedBlogger, setSelectedBlogger] = useState<string | undefined>();
  const [dateRange, setDateRange] = useState<[Dayjs | null, Dayjs | null] | null>(null);

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
        fetch('/api/brands'),
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
      if (selectedReportId) {
        params.set('reportId', selectedReportId);
      }
      if (selectedBrand) {
        params.set('brandId', selectedBrand);
      }
      if (selectedBlogger) {
        params.set('bloggerId', selectedBlogger);
      }
      if (dateRange && dateRange[0] && dateRange[1]) {
        params.set('startDate', dateRange[0].format('YYYY-MM-DD'));
        params.set('endDate', dateRange[1].format('YYYY-MM-DD'));
      }

      const response = await fetch(`/api/notes?${params.toString()}`);
      const result: NotesResponse = await response.json();

      if (!result.success) {
        message.error(result.error || '加载笔记失败');
        return;
      }

      setNoteList(result.data.list);
      setNoteTotal(result.data.total);
      setPage(result.data.page);
      setPageSize(result.data.pageSize);
      await loadNoteTags(result.data.list, selectedTagSetId);
    } catch (error) {
      console.error('Failed to load notes', error);
      message.error('加载笔记失败');
    } finally {
      setNotesLoading(false);
    }
  };

  const loadNoteTags = async (notes: NoteRecord[], tagSetId: string) => {
    if (notes.length === 0) {
      setNoteTags({});
      return;
    }

    const requests = notes.map((note) =>
      fetch(`/api/notes/${note.NoteId}/tags?tagSetId=${tagSetId}`)
        .then((resp) => resp.json())
        .then((payload) => {
          if (payload.success) {
            return { noteId: note.NoteId, tags: payload.data.tags as TagDTO[] };
          }
          throw new Error(payload.error || '加载标签失败');
        })
        .catch((error) => {
          console.error(`Failed to load tags for note ${note.NoteId}`, error);
          return { noteId: note.NoteId, tags: [] as TagDTO[] };
        }),
    );

    const results = await Promise.all(requests);
    const nextMap: NoteTagMap = {};
    for (const item of results) {
      nextMap[item.noteId] = item.tags;
    }
    setNoteTags(nextMap);
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
  }, [selectedReportId, selectedBrand, selectedBlogger, dateRange]);

  const handleTagChange = async (noteId: string, value: string[]) => {
    if (!selectedTagSetId) return;
    try {
      setSavingNoteId(noteId);
      const response = await fetch('/api/notes/tagging', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          noteId,
          tagSetId: selectedTagSetId,
          tagIds: value,
        }),
      });
      const result = await response.json();
      if (result.success) {
        setNoteTags((prev) => ({
          ...prev,
          [noteId]: result.data.tags,
        }));
        message.success('已保存');
      } else {
        message.error(result.error || '保存失败');
      }
    } catch (error) {
      console.error('Failed to save note tags', error);
      message.error('保存失败');
    } finally {
      setSavingNoteId(null);
    }
  };

  const filteredNotes = useMemo(() => {
    return noteList.filter((note) => {
      const assignedTags = noteTags[note.NoteId] || [];
      
      // 标签筛选逻辑
      if (filterTagId === '__untagged__') {
        // 仅显示未打标笔记
        if (assignedTags.length > 0) {
          return false;
        }
      } else if (filterTagId) {
        // 显示指定标签的笔记
        if (!assignedTags.some((tag) => tag.tagId === filterTagId)) {
          return false;
        }
      }
      // filterTagId 为 null 时显示所有笔记
      
      return true;
    });
  }, [noteList, noteTags, filterTagId]);

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

  const columns = [
    {
      title: '笔记',
      dataIndex: 'Title',
      key: 'title',
      render: (value: string, record: NoteRecord) => (
        <Space>
          <Avatar src={getProxiedImageUrl(record.CoverImage)} shape="square" size={48}>
            {value?.[0] || '图'}
          </Avatar>
          <div>
            <Title level={5} style={{ marginBottom: 4 }}>
              {value || '未命名笔记'}
            </Title>
            <Text type="secondary">
              {record.BloggerNickName || '未知博主'}
            </Text>
          </div>
        </Space>
      ),
    },
    {
      title: '发布时间',
      dataIndex: 'PublishTime',
      width: 160,
      render: (value: string) =>
        value ? dayjs(value).format('YYYY-MM-DD HH:mm') : '-',
    },
    {
      title: '已打标签',
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
        return (
          <Select
            style={{ width: '100%' }}
            mode="multiple"
            placeholder="选择标签"
            options={tagOptions}
            value={assigned.map((tag) => tag.tagId)}
            onChange={(value) => handleTagChange(record.NoteId, value)}
            loading={savingNoteId === record.NoteId}
            allowClear
          />
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
                {brands.map((brand) => (
                  <Option key={brand.BrandId} value={brand.BrandId} label={brand.BrandName}>
                    {brand.BrandName}
                  </Option>
                ))}
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
              <div style={{ marginBottom: 8 }}>&nbsp;</div>
              <Space>
                <Button icon={<ReloadOutlined />} onClick={() => loadNotes(page)}>
                  刷新
                </Button>
                <Button
                  onClick={() => {
                    setSelectedReportId(undefined);
                    setSelectedBrand(undefined);
                    setSelectedBlogger(undefined);
                    setDateRange(null);
                    setFilterTagId('__untagged__');
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

