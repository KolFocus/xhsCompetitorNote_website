'use client';

export const dynamic = 'force-dynamic';

import React, { useEffect, useMemo, useState } from 'react';
import {
  Avatar,
  Button,
  Card,
  Checkbox,
  Col,
  Empty,
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
} from 'antd';
import {
  ClearOutlined,
  DeleteOutlined,
  ReloadOutlined,
  TagsOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';

import type { BulkTaggingResult, TagDTO, TagSetDTO } from '@/lib/types';

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
  const [filterUnTagged, setFilterUnTagged] = useState(true);
  const [filterTagId, setFilterTagId] = useState<string | null>(null);
  const [searchKeyword, setSearchKeyword] = useState('');
  const [savingNoteId, setSavingNoteId] = useState<string | null>(null);
  const [selectedNoteIds, setSelectedNoteIds] = useState<string[]>([]);
  const [bulkModalOpen, setBulkModalOpen] = useState(false);
  const [bulkModalLoading, setBulkModalLoading] = useState(false);
  const [bulkSelectedTagIds, setBulkSelectedTagIds] = useState<string[]>([]);

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
  }, []);

  const currentTagSet = useMemo(
    () => tagSets.find((tagSet) => tagSet.tagSetId === selectedTagSetId) || null,
    [selectedTagSetId, tagSets],
  );

  const tagOptions = useMemo(
    () =>
      (currentTagSet?.tags || []).map((tag) => ({
        label: tag.tagName,
        value: tag.tagId,
      })),
    [currentTagSet],
  );

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

      if (searchKeyword) {
        params.set('keyword', searchKeyword.trim());
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
      loadNotes(1, pageSize);
      setSelectedNoteIds([]);
    }
  }, [selectedTagSetId]);

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
    const keyword = searchKeyword.trim().toLowerCase();
    return noteList.filter((note) => {
      const assignedTags = noteTags[note.NoteId] || [];
      if (filterUnTagged && assignedTags.length > 0) {
        return false;
      }
      if (filterTagId && !assignedTags.some((tag) => tag.tagId === filterTagId)) {
        return false;
      }
      if (!keyword) {
        return true;
      }
      return (
        note.Title?.toLowerCase().includes(keyword) ||
        note.BloggerNickName?.toLowerCase().includes(keyword)
      );
    });
  }, [noteList, noteTags, filterUnTagged, filterTagId, searchKeyword]);

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
          <Avatar src={record.CoverImage || undefined} shape="square" size={48}>
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
          <Row gutter={[16, 16]} align="middle">
            <Col xs={24} md={8}>
              <Space direction="vertical" size={4} style={{ width: '100%' }}>
                <Text type="secondary">标签系列</Text>
                <Select
                  showSearch
                  style={{ width: '100%' }}
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
            </Col>
            <Col xs={24} md={6}>
              <Space direction="vertical" size={4} style={{ width: '100%' }}>
                <Text type="secondary">标签筛选</Text>
                <Select
                  allowClear
                  placeholder="选择标签"
                  options={tagOptions}
                  value={filterTagId || undefined}
                  onChange={(value) => setFilterTagId(value || null)}
                  disabled={!currentTagSet}
                />
              </Space>
            </Col>
            <Col xs={24} md={6}>
              <Space direction="vertical" size={4} style={{ width: '100%' }}>
                <Text type="secondary">关键字搜索</Text>
                <Input
                  placeholder="按标题或博主搜索"
                  value={searchKeyword}
                  onChange={(event) => setSearchKeyword(event.target.value)}
                  allowClear
                  prefix={<TagsOutlined />}
                />
              </Space>
            </Col>
            <Col xs={24} md={4}>
              <Space direction="vertical" size={4} style={{ width: '100%' }}>
                <Text type="secondary">操作</Text>
                <Space>
                  <Tooltip title="刷新笔记列表">
                    <Button icon={<ReloadOutlined />} onClick={() => loadNotes()}>
                      刷新
                    </Button>
                  </Tooltip>
                  <Tooltip title="重置筛选条件">
                    <Button
                      icon={<ClearOutlined />}
                      onClick={() => {
                        setFilterTagId(null);
                        setFilterUnTagged(true);
                        setSearchKeyword('');
                        loadNotes(1, pageSize);
                      }}
                    >
                      重置
                    </Button>
                  </Tooltip>
                </Space>
              </Space>
            </Col>
          </Row>
          <Row style={{ marginTop: 16 }}>
            <Checkbox
              checked={filterUnTagged}
              onChange={(event) => setFilterUnTagged(event.target.checked)}
            >
              仅显示未打标笔记
            </Checkbox>
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

export default NoteTaggingPage;

