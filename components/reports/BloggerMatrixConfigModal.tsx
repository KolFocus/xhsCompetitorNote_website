'use client';

import React, { useState, useEffect, useMemo } from 'react';
import {
  Card,
  Button,
  Modal,
  Form,
  Table,
  InputNumber,
  Input,
  Space,
  message,
  Spin,
  Typography,
} from 'antd';
import { PlusOutlined, DeleteOutlined, ExclamationCircleFilled } from '@ant-design/icons';
import { DEFAULT_BLOGGER_LEVELS } from '@/lib/constants/bloggerMatrix';

const { Title, Text } = Typography;

interface Level {
  levelId?: string;
  levelName: string;
  minFans: number;
  maxFans: number | null;
}

interface BloggerMatrixConfigModalProps {
  open: boolean;
  reportId: string;
  onCancel: () => void;
  onSuccess: () => void;
}

export default function BloggerMatrixConfigModal({ open, reportId, onCancel, onSuccess }: BloggerMatrixConfigModalProps) {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [initialLevels, setInitialLevels] = useState<Level[] | null>(null);

  useEffect(() => {
    if (open) {
      loadConfig();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, reportId]);

  const loadConfig = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/reports/${reportId}/blogger-matrix/config`);
      const data = await response.json();
      if (data.success) {
        const levels: Level[] = data?.data?.customLevels && data.data.customLevels.length > 0
          ? data.data.customLevels
          : DEFAULT_BLOGGER_LEVELS.map((lvl, idx) => ({ ...lvl, levelId: String(idx + 1) }));
        setInitialLevels(levels);
        form.setFieldsValue({ levels });
      } else {
        message.error(data.error || '加载配置失败');
      }
    } catch (e) {
      message.error('加载配置失败');
    } finally {
      setLoading(false);
    }
  };

  const isDirty = useMemo(() => {
    if (!open) return false;
    const touched = form.isFieldsTouched(true);
    return touched;
  }, [open, form]);

  const requestSave = async () => {
    try {
      const values = await form.validateFields();
      const levels: Level[] = values.levels || [];

      // Cross-field validation per locked rules
      const normalized = [...levels].map((l) => ({ ...l }));
      const errors = validateLevels(normalized);
      if (errors.length > 0) {
        message.error(errors[0]);
        return;
      }

      // Derive maxFans from thresholds for submission (top tier: null; others: previous minFans)
      const toSubmit = deriveMaxFans(normalized);

      Modal.confirm({
        title: '确认保存新的达人分层配置？',
        icon: <ExclamationCircleFilled />,
        okText: '保存',
        cancelText: '取消',
        onOk: async () => {
          setSaving(true);
          try {
            const response = await fetch(`/api/reports/${reportId}/blogger-matrix/config`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ customLevels: toSubmit }),
            });
            const data = await response.json();
            if (data.success) {
              message.success('保存成功');
              onSuccess();
              onCancel();
            } else {
              const backendMsg: string = data?.error || '';
              // 映射后端“区间重叠”相关错误为统一的友好提示
              const overlapHints = ['overlap', '重叠', '范围交叉', 'range conflict', 'conflict'];
              const isOverlap = overlapHints.some((hint) => backendMsg.toLowerCase?.().includes(hint) || backendMsg.includes(hint));
              message.error(isOverlap ? '粉丝数范围与其他层级重叠，请调整' : (backendMsg || '保存失败'));
            }
          } catch (e) {
            message.error('保存失败');
          } finally {
            setSaving(false);
          }
        },
      });
    } catch (error: any) {
      if (error?.errorFields) return; // field-level errors already shown
      message.error('保存失败');
    }
  };

  const handleCancel = () => {
    if (isDirty) {
      Modal.confirm({
        title: '确定要关闭吗？',
        icon: <ExclamationCircleFilled />,
        content: '有未保存的修改，关闭后将不会保存。',
        okText: '关闭',
        cancelText: '继续编辑',
        onOk: () => onCancel(),
      });
    } else {
      onCancel();
    }
  };

  const handleReset = () => {
    const levels = DEFAULT_BLOGGER_LEVELS.map((level, index) => ({ ...level, levelId: String(index + 1) }));
    form.setFieldsValue({ levels });
  };

  return (
    <Modal
      title="达人矩阵配置"
      open={open}
      onCancel={handleCancel}
      onOk={requestSave}
      confirmLoading={saving}
      width={600}
      okText="保存"
      cancelText="取消"
      destroyOnHidden
      maskClosable={false}
    >
      <Spin spinning={loading}>
        <Space direction="vertical" style={{ width: '100%' }} size={16}>
          <Form form={form} layout="vertical" preserve>
            <Form.List name="levels">
              {(fields, { add, remove }) => {
                const rawLevels: Level[] = form.getFieldValue('levels') || [];
                const derived = deriveRanges(rawLevels);

                const columns = [
                  {
                    title: '层级名称',
                    dataIndex: 'levelName',
                    key: 'levelName',
                    width: 150,
                    render: (_: any, row: any) => {
                      if (row._type === 'kol') {
                        return <Input value="知名KOL" disabled />;
                      }
                      return (
                        <Form.Item
                          name={[row.field.name, 'levelName']}
                          rules={[
                            { required: true, message: '请输入层级名称' },
                            { max: 20, message: '层级名称不能超过20个字符' },
                            {
                              validator: (_, value) => uniqueNameValidator(form, row.field.name as number, value),
                            },
                          ]}
                          style={{ margin: 0 }}
                          validateTrigger={['onBlur']}
                        >
                          <Input placeholder="例如：头部达人" allowClear />
                        </Form.Item>
                      );
                    },
                  },
                  {
                    title: '起始粉丝数',
                    dataIndex: 'minFans',
                    key: 'minFans',
                    width: 150,
                    render: (_: any, row: any) => {
                      if (row._type === 'kol') {
                        return <Input value="-" disabled />;
                      }
                      return (
                        <Form.Item
                          name={[row.field.name, 'minFans']}
                          rules={[
                            { required: true, message: '请输入起始粉丝数' },
                            { type: 'number', min: 0, message: '起始粉丝数必须大于等于0' },
                            ({ getFieldValue }) => ({
                              validator(_, value) {
                                if (value == null || value === '') return Promise.resolve();
                                if (typeof value !== 'number' || Number.isNaN(value)) {
                                  return Promise.reject(new Error('请输入数字'));
                                }
                                const levels: Level[] = getFieldValue('levels') || [];
                                const idx = row.field.name as number;
                                const prev = idx > 0 ? levels[idx - 1] : undefined;
                                const next = idx < levels.length - 1 ? levels[idx + 1] : undefined;
                                // 需要满足：prev.minFans > value > next.minFans（若相邻存在）
                                if (prev && typeof prev.minFans === 'number' && !(value < prev.minFans)) {
                                  return Promise.reject(new Error(`必须小于上一行的起始值（${formatNumberFriendly(prev.minFans)}）`));
                                }
                                if (next && typeof next.minFans === 'number' && !(value > next.minFans)) {
                                  return Promise.reject(new Error(`必须大于下一行的起始值（${formatNumberFriendly(next.minFans)}）`));
                                }
                                return Promise.resolve();
                              },
                            }),
                          ]}
                          validateTrigger={['onBlur']}
                          style={{ margin: 0 }}
                        >
                          <InputNumber
                            placeholder="例如：100000"
                            style={{ width: '100%' }}
                            min={0}
                            formatter={(v) => `${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                            parser={(v) => (v ? v.replace(/\$\s?|(,*)/g, '') : '') as any}
                            onBlur={() => refreshRanges(form)}
                          />
                        </Form.Item>
                      );
                    },
                  },
                  {
                    title: '粉丝数范围',
                    key: 'range',
                    render: (_: any, row: any) => {
                      if (row._type === 'kol') {
                        return <Text>加V达人</Text>;
                      }
                      const idx = row.field.name as number;
                      return <Text>{derived.textByIndex[idx] || '-'}</Text>;
                    },
                  },
                  {
                    title: '操作',
                    key: 'action',
                    width: 80,
                    align: 'right' as const,
                    render: (_: any, row: any) => {
                      if (row._type === 'kol') return null;
                      return fields.length > 1 ? (
                        <Button
                          type="text"
                          danger
                          aria-label="删除该层级"
                          icon={<DeleteOutlined />}
                          onClick={() => {
                            remove(row.field.name);
                            // 删除后统一重新计算范围
                            setTimeout(() => refreshRanges(form), 0);
                          }}
                        />
                      ) : null;
                    },
                  },
                ];

                const dataSource = [
                  { key: 'kol-row', _type: 'kol' },
                  ...fields.map((field) => ({
                    key: field.key,
                    _type: 'level',
                    field,
                  })),
                ];

                return (
                  <>
                    <Space align="center" style={{ justifyContent: 'space-between', width: '100%' }}>
                      <Title level={5} style={{ margin: 0 }}></Title>
                      <Space>
                        <Button type="dashed" onClick={() => addEmptyLevel(form)} icon={<PlusOutlined />}>添加层级</Button>
                        <Button onClick={handleReset}>重置</Button>
                      </Space>
                    </Space>
                    <Table
                      columns={columns as any}
                      dataSource={dataSource}
                      pagination={false}
                      size="small"
                      style={{ marginTop: 8 }}
                    />
                    <div style={{ marginTop: 8 }}>
                      <Text type="secondary">
                        仅需填写各层“起始粉丝数”，系统将按从高到低自动生成区间（(X, Y]，最高档显示为“≥X”），区间互不重叠。
                      </Text>
                    </div>
                  </>
                );
              }}
            </Form.List>
          </Form>
        </Space>
      </Spin>
    </Modal>
  );
}

function addEmptyLevel(form: any) {
  const levels: Level[] = form.getFieldValue('levels') || [];
  const next: Level = { levelName: '', minFans: 0, maxFans: null };
  form.setFieldsValue({ levels: [...levels, next] });
}

function uniqueNameValidator(form: any, currentIndex: number, value: string) {
  const levels: Level[] = form.getFieldValue('levels') || [];
  if (!value) return Promise.resolve();
  const duplicated = levels.some((l, idx) => idx !== currentIndex && l?.levelName?.trim() === String(value).trim());
  if (duplicated) return Promise.reject(new Error('层级名称已存在，请使用其他名称'));
  return Promise.resolve();
}

function validateLevels(levels: Level[]): string[] {
  const errors: string[] = [];

  if (!levels || levels.length === 0) {
    errors.push('请至少保留一个自定义层级');
    return errors;
  }

  // name uniqueness & min >= 0
  const nameSet = new Set<string>();
  for (let i = 0; i < levels.length; i += 1) {
    const lv = levels[i];
    const name = (lv.levelName || '').trim();
    if (!name) {
      errors.push(`第 ${i + 1} 行：层级名称不能为空`);
      return errors;
    }
    if (nameSet.has(name)) {
      errors.push(`第 ${i + 1} 行：层级名称重复`);
      return errors;
    }
    nameSet.add(name);

    if (lv.minFans == null || lv.minFans < 0) {
      errors.push(`第 ${i + 1} 行：起始粉丝数必须大于等于0`);
      return errors;
    }
  }

  // enforce visual order strictly descending (from top to bottom, excluding KOL)
  for (let i = 1; i < levels.length; i += 1) {
    const prev = levels[i - 1];
    const curr = levels[i];
    if (!(prev.minFans > curr.minFans)) {
      errors.push('粉丝数范围与其他层级重叠，请调整');
      return errors;
    }
  }

  // sort descending by minFans for validation only (do not mutate UI)
  const sorted = [...levels].sort((a, b) => b.minFans - a.minFans);

  // strictly descending thresholds to avoid overlap after deriving (X, Y]
  for (let i = 1; i < sorted.length; i += 1) {
    const prev = sorted[i - 1];
    const curr = sorted[i];

    if (!(curr.minFans < prev.minFans)) {
      errors.push('粉丝数范围与其他层级重叠，请调整');
      return errors;
    }
  }

  return errors;
}

function deriveMaxFans(levels: Level[]): Level[] {
  const withIndex = levels.map((l, idx) => ({ idx, minFans: l.minFans }));
  const sorted = [...withIndex].sort((a, b) => b.minFans - a.minFans);
  const maxByIdx: Record<number, number | null> = {};
  for (let i = 0; i < sorted.length; i += 1) {
    const curr = sorted[i];
    const prev = sorted[i - 1];
    // Top tier has null; others' max equals previous tier's min
    maxByIdx[curr.idx] = i === 0 ? null : prev.minFans;
  }
  return levels.map((l, idx) => ({
    ...l,
    maxFans: maxByIdx[idx] ?? null,
  }));
}

function deriveRanges(levels: Level[]) {
  const valid = (levels || []).map((l, index) => ({
    index,
    levelName: l.levelName,
    minFans: typeof l.minFans === 'number' ? l.minFans : NaN,
  })).filter((x) => !Number.isNaN(x.minFans));

  const sorted = [...valid].sort((a, b) => b.minFans - a.minFans);

  const textByIndex: Record<number, string> = {};
  for (let i = 0; i < sorted.length; i += 1) {
    const curr = sorted[i];
    const prev = sorted[i - 1];
    if (i === 0) {
      textByIndex[curr.index] = `≥${formatNumberFriendly(curr.minFans)}`;
    } else {
      textByIndex[curr.index] = `${formatNumberFriendly(curr.minFans)} - ${formatNumberFriendly(prev.minFans)}`;
    }
  }
  return { textByIndex };
}

function formatNumberFriendly(num: number): string {
  if (num >= 100000000) return `${(num / 100000000).toFixed(1)}亿`;
  if (num >= 10000) return `${(num / 10000).toFixed(1)}万`;
  return `${num}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

function refreshRanges(form: any) {
  const levels: Level[] = form.getFieldValue('levels') || [];
  // 通过设置同值触发一次渲染，从而让派生范围文本刷新
  form.setFieldsValue({ levels: [...levels] });
}

