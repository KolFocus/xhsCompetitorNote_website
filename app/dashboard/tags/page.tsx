'use client';

export const dynamic = 'force-dynamic';

import React, { useEffect, useMemo, useState } from 'react';
import {
  Button,
  Card,
  Empty,
  Form,
  Input,
  Modal,
  Space,
  Table,
  Tabs,
  Tag as AntTag,
  message,
  Typography,
  Spin,
} from 'antd';
import {
  DeleteOutlined,
  EditOutlined,
  PlusOutlined,
  ReloadOutlined,
} from '@ant-design/icons';

import {
  TAG_NAME_MAX_LENGTH,
  TAG_NAME_MIN_LENGTH,
  TAG_SET_NAME_MAX_LENGTH,
  TAG_SET_NAME_MIN_LENGTH,
} from '@/lib/constants/tagging';
import type { TagDTO, TagSetDTO } from '@/lib/types';

type EditableTag = {
  tagId?: string;
  tagName: string;
};

type TagSetModalProps = {
  mode: 'create' | 'edit';
  open: boolean;
  loading: boolean;
  tagSet?: TagSetDTO | null;
  onClose: () => void;
  onSubmit: (payload: {
    tagSetName: string;
    description: string;
    tags: EditableTag[];
  }) => Promise<void>;
};

const normalizeName = (value: string) => value.trim();

const buildInitialTags = (tags?: TagDTO[]): EditableTag[] =>
  (tags || []).map((tag) => ({
    tagId: tag.tagId,
    tagName: tag.tagName,
  }));

const TagSetModal: React.FC<TagSetModalProps> = ({
  mode,
  open,
  loading,
  tagSet,
  onClose,
  onSubmit,
}) => {
  const [form] = Form.useForm<{
    tagSetName: string;
    description: string;
    tags: EditableTag[];
  }>();

  useEffect(() => {
    if (!open) {
      form.resetFields();
      return;
    }

    if (mode === 'edit' && tagSet) {
      form.setFieldsValue({
        tagSetName: tagSet.tagSetName,
        description: tagSet.description || '',
        tags: buildInitialTags(tagSet.tags),
      });
    } else {
      form.setFieldsValue({
        tagSetName: '',
        description: '',
        tags: [],
      });
    }
  }, [form, mode, open, tagSet]);

  const handleOk = async () => {
    try {
      const values = await form.validateFields();
      await onSubmit({
        ...values,
        tagSetName: normalizeName(values.tagSetName),
        description: values.description?.trim() || '',
        tags: (values.tags || []).map((tag) => ({
          tagId: tag.tagId,
          tagName: normalizeName(tag.tagName),
        })),
      });
    } catch (err) {
      // validation errors handled by form
    }
  };

  const modalTitle = mode === 'create' ? '新建标签系列' : '编辑标签系列';

  return (
    <Modal
      open={open}
      title={modalTitle}
      width={720}
      okText={mode === 'create' ? '创建' : '保存'}
      confirmLoading={loading}
      onCancel={onClose}
      onOk={handleOk}
        destroyOnHidden
    >
      <Form
        form={form}
        layout="vertical"
        initialValues={{
          tagSetName: '',
          description: '',
          tags: [],
        }}
      >
        <Form.Item
          label="标签系列名称"
          name="tagSetName"
          rules={[
            { required: true, message: '请输入标签系列名称' },
            {
              min: TAG_SET_NAME_MIN_LENGTH,
              max: TAG_SET_NAME_MAX_LENGTH,
              message: `长度需在 ${TAG_SET_NAME_MIN_LENGTH}-${TAG_SET_NAME_MAX_LENGTH} 个字符`,
            },
          ]}
        >
          <Input placeholder="请输入 4~20 个字符的标签系列名称" maxLength={TAG_SET_NAME_MAX_LENGTH} />
        </Form.Item>

        <Form.Item label="描述（可选）" name="description">
          <Input.TextArea
            placeholder="为标签系列添加描述信息"
            maxLength={120}
            autoSize={{ minRows: 2, maxRows: 4 }}
          />
        </Form.Item>

        <Form.List name="tags">
          {(fields, { add, remove }) => (
            <Card
              size="small"
              title="标签列表"
              extra={
                <Button
                  type="link"
                  onClick={() => add({ tagName: '' })}
                  icon={<PlusOutlined />}
                >
                  添加标签
                </Button>
              }
            >
              {fields.length === 0 && (
                <Empty
                  description="暂无标签，点击右上角按钮添加"
                  image={Empty.PRESENTED_IMAGE_SIMPLE}
                />
              )}
              {fields.map((field) => (
                <Space
                  key={field.key}
                  style={{ display: 'flex', marginBottom: 8 }}
                  align="baseline"
                >
                  <Form.Item
                    {...field}
                    label={null}
                    name={[field.name, 'tagName']}
                    rules={[
                      { required: true, message: '请输入标签名称' },
                      {
                        min: TAG_NAME_MIN_LENGTH,
                        max: TAG_NAME_MAX_LENGTH,
                        message: `长度需在 ${TAG_NAME_MIN_LENGTH}-${TAG_NAME_MAX_LENGTH} 个字符`,
                      },
                    ]}
                  >
                    <Input
                      placeholder="请输入标签名称"
                      maxLength={TAG_NAME_MAX_LENGTH}
                    />
                  </Form.Item>
                  <Button danger type="link" onClick={() => remove(field.name)}>
                    删除
                  </Button>
                </Space>
              ))}
            </Card>
          )}
        </Form.List>
      </Form>
    </Modal>
  );
};

type TagSetTableRecord = TagSetDTO & {
  tagsCount: number;
};

const mapToTableRecord = (tagSet: TagSetDTO): TagSetTableRecord => ({
  ...tagSet,
  tagsCount: tagSet.tags?.length ?? 0,
});

const { Title, Text } = Typography;

const TagManagementPage: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [modalLoading, setModalLoading] = useState(false);
  const [tagSets, setTagSets] = useState<TagSetDTO[]>([]);
  const [activeTab, setActiveTab] = useState<'system' | 'custom'>('system');
  const [modalMode, setModalMode] = useState<'create' | 'edit'>('create');
  const [currentTagSet, setCurrentTagSet] = useState<TagSetDTO | null>(null);
  const [modalOpen, setModalOpen] = useState(false);

  const fetchTagSets = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/tag-sets?withTags=true');
      const result = await response.json();
      if (result.success) {
        setTagSets(result.data.items || []);
      } else {
        message.error(result.error || '获取标签系列失败');
      }
    } catch (error) {
      console.error('Failed to fetch tag sets', error);
      message.error('加载标签系列失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTagSets();
  }, []);

  const systemTagSets = useMemo(
    () => tagSets.filter((tagSet) => tagSet.type === 'system'),
    [tagSets],
  );
  const customTagSets = useMemo(
    () => tagSets.filter((tagSet) => tagSet.type === 'custom'),
    [tagSets],
  );

  const handleOpenCreate = () => {
    setModalMode('create');
    setCurrentTagSet(null);
    setModalOpen(true);
  };

  const handleOpenEdit = (tagSet: TagSetDTO) => {
    setModalMode('edit');
    setCurrentTagSet(tagSet);
    setModalOpen(true);
  };

  const handleDelete = (tagSet: TagSetDTO) => {
    Modal.confirm({
      title: `确认删除「${tagSet.tagSetName}」?`,
      content: '删除后，该标签系列及其标签、已打的标签关系都将被清除。',
      okText: '确认删除',
      okButtonProps: { danger: true },
      cancelText: '取消',
      onOk: async () => {
        try {
          setLoading(true);
          const response = await fetch(`/api/tag-sets/${tagSet.tagSetId}`, {
            method: 'DELETE',
          });
          const result = await response.json();
          if (result.success) {
            message.success('删除成功');
            fetchTagSets();
          } else {
            message.error(result.error || '删除失败');
          }
        } catch (error) {
          console.error('Delete tag set failed', error);
          message.error('删除标签系列失败');
        } finally {
          setLoading(false);
        }
      },
    });
  };

  const handleModalSubmit: TagSetModalProps['onSubmit'] = async ({
    tagSetName,
    description,
    tags,
  }) => {
    try {
      setModalLoading(true);
      if (modalMode === 'create') {
        const response = await fetch('/api/tag-sets', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            tagSetName,
            description,
            tags: tags.map((tag) => tag.tagName),
          }),
        });
        const result = await response.json();
        if (!result.success) {
          message.error(result.error || '创建标签系列失败');
          return;
        }
        message.success('创建成功');
      } else if (modalMode === 'edit' && currentTagSet) {
        const requests: Promise<any>[] = [];

        if (
          tagSetName !== currentTagSet.tagSetName ||
          description !== (currentTagSet.description || '')
        ) {
          requests.push(
            fetch(`/api/tag-sets/${currentTagSet.tagSetId}`, {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                tagSetName,
                description,
              }),
            }).then(async (response) => {
              if (!response.ok) {
                const payload = await response.json();
                throw new Error(payload.error || '更新标签系列失败');
              }
            }),
          );
        }

        const existingTagsMap = new Map(
          (currentTagSet.tags || []).map((tag) => [tag.tagId, tag]),
        );
        const incomingTagsMap = new Map(
          tags.filter((tag) => tag.tagId).map((tag) => [tag.tagId!, tag]),
        );

        // 删除标签
        for (const originalTag of currentTagSet.tags || []) {
          if (!incomingTagsMap.has(originalTag.tagId)) {
            requests.push(
              fetch(`/api/tags/${originalTag.tagId}`, {
                method: 'DELETE',
              }).then(async (response) => {
                if (!response.ok) {
                  const payload = await response.json();
                  throw new Error(payload.error || '删除标签失败');
                }
              }),
            );
          }
        }

        // 更新标签与新增标签
        for (const tag of tags) {
          if (tag.tagId) {
            const original = existingTagsMap.get(tag.tagId);
            if (original && original.tagName !== tag.tagName) {
              requests.push(
                fetch(`/api/tags/${tag.tagId}`, {
                  method: 'PATCH',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ tagName: tag.tagName }),
                }).then(async (response) => {
                  if (!response.ok) {
                    const payload = await response.json();
                    throw new Error(payload.error || '更新标签失败');
                  }
                }),
              );
            }
          } else if (tag.tagName) {
            requests.push(
              fetch('/api/tags', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  tagSetId: currentTagSet.tagSetId,
                  tagName: tag.tagName,
                }),
              }).then(async (response) => {
                if (!response.ok) {
                  const payload = await response.json();
                  throw new Error(payload.error || '新增标签失败');
                }
              }),
            );
          }
        }

        await Promise.all(requests);
        message.success('保存成功');
      }

      setModalOpen(false);
      setCurrentTagSet(null);
      fetchTagSets();
    } catch (error: any) {
      console.error('Submit tag set modal failed', error);
      message.error(error?.message || '保存失败，请稍后重试');
    } finally {
      setModalLoading(false);
    }
  };

  const renderTagSetCard = (tagSet: TagSetDTO) => (
    <Card
      key={tagSet.tagSetId}
      title={
        <Space direction="vertical" size={0}>
          <Title level={5} style={{ marginBottom: 0 }}>
            {tagSet.tagSetName}
          </Title>
          {tagSet.description && (
            <Text type="secondary" style={{ fontSize: 12 }}>
              {tagSet.description}
            </Text>
          )}
        </Space>
      }
      extra={
        tagSet.type === 'custom' ? (
          <Space>
            <Button
              type="link"
              icon={<EditOutlined />}
              onClick={() => handleOpenEdit(tagSet)}
            >
              编辑
            </Button>
            <Button
              type="link"
              danger
              icon={<DeleteOutlined />}
              onClick={() => handleDelete(tagSet)}
            >
              删除
            </Button>
          </Space>
        ) : (
          <Text type="secondary">系统预设</Text>
        )
      }
      style={{ marginBottom: 16 }}
    >
      <Space wrap>
        {(tagSet.tags || []).map((tag) => (
          <AntTag key={tag.tagId}>{tag.tagName}</AntTag>
        ))}
        {(tagSet.tags || []).length === 0 && (
          <Text type="secondary">暂无标签</Text>
        )}
      </Space>
    </Card>
  );

  const tableColumns = [
    {
      title: '标签系列名称',
      dataIndex: 'tagSetName',
      key: 'name',
      render: (value: string, record: TagSetTableRecord) => (
        <Space direction="vertical" size={0}>
          <Text strong>{value}</Text>
          {record.description && (
            <Text type="secondary" style={{ fontSize: 12 }}>
              {record.description}
            </Text>
          )}
        </Space>
      ),
    },
    {
      title: '标签数',
      dataIndex: 'tagsCount',
      width: 120,
    },
    {
      title: '标签列表',
      dataIndex: 'tags',
      render: (tags: TagDTO[] = []) => (
        <Space wrap>
          {tags.length === 0 && <Text type="secondary">-</Text>}
          {tags.map((tag) => (
            <AntTag key={tag.tagId}>{tag.tagName}</AntTag>
          ))}
        </Space>
      ),
    },
    {
      title: '操作',
      key: 'actions',
      width: 200,
      render: (_: unknown, record: TagSetTableRecord) =>
        record.type === 'custom' ? (
          <Space>
            <Button type="link" onClick={() => handleOpenEdit(record)}>
              编辑
            </Button>
            <Button type="link" danger onClick={() => handleDelete(record)}>
              删除
            </Button>
          </Space>
        ) : (
          <Text type="secondary">系统预设</Text>
        ),
    },
  ];

  return (
    <div style={{ padding: 24 }}>
      <Card
        title="标签系列管理"
        extra={
          <Space>
            <Button icon={<ReloadOutlined />} onClick={fetchTagSets}>
              刷新
            </Button>
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={handleOpenCreate}
            >
              新建标签系列
            </Button>
          </Space>
        }
      >
        <Tabs
          activeKey={activeTab}
          onChange={(key) => setActiveTab(key as 'system' | 'custom')}
          items={[
            {
              key: 'system',
              label: `系统标签系列 (${systemTagSets.length})`,
              children:
                loading ? (
                  <div style={{ textAlign: 'center', padding: '48px 0' }}>
                    <Spin />
                  </div>
                ) : systemTagSets.length === 0 ? (
                  <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} />
                ) : (
                  systemTagSets.map(renderTagSetCard)
                ),
            },
            {
              key: 'custom',
              label: `自定义标签系列 (${customTagSets.length})`,
              children:
                customTagSets.length === 0 ? (
                  <Empty
                    description="暂无自定义标签系列，点击右上角按钮创建"
                    image={Empty.PRESENTED_IMAGE_SIMPLE}
                  />
                ) : (
                  <Table
                    dataSource={customTagSets.map(mapToTableRecord)}
                    columns={tableColumns}
                    rowKey="tagSetId"
                    loading={loading}
                    pagination={false}
                  />
                ),
            },
          ]}
        />
      </Card>

      <TagSetModal
        mode={modalMode}
        open={modalOpen}
        loading={modalLoading}
        tagSet={currentTagSet}
        onClose={() => {
          if (!modalLoading) {
            setModalOpen(false);
            setCurrentTagSet(null);
          }
        }}
        onSubmit={handleModalSubmit}
      />
    </div>
  );
};

export default TagManagementPage;

