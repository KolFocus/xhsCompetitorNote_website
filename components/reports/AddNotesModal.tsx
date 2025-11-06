'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Modal, Form, Input, Select, DatePicker, message, Spin, Button } from 'antd';
import type { Dayjs } from 'dayjs';
import dayjs from 'dayjs';

const { RangePicker } = DatePicker;

interface Brand {
  BrandId: string;
  BrandName: string;
}

interface AddNotesModalProps {
  open: boolean;
  reportId: string;
  reportName: string;
  defaultBrandIds?: string[];
  onCancel: () => void;
  onSuccess: () => void;
}

export default function AddNotesModal({
  open,
  reportId,
  reportName,
  defaultBrandIds = [],
  onCancel,
  onSuccess,
}: AddNotesModalProps) {
  const [brands, setBrands] = useState<Brand[]>([]);
  const [brandIds, setBrandIds] = useState<string[]>(defaultBrandIds);
  const [dateRange, setDateRange] = useState<[Dayjs, Dayjs] | null>(null);
  const [newNotesCount, setNewNotesCount] = useState<number | null>(null);
  const [calculating, setCalculating] = useState(false);
  const [loading, setLoading] = useState(false);
  const [brandsLoading, setBrandsLoading] = useState(false);

  // 加载品牌列表
  useEffect(() => {
    if (open) {
      loadBrands();
    }
  }, [open]);

  // 初始化默认值
  useEffect(() => {
    if (open && defaultBrandIds.length > 0) {
      setBrandIds(defaultBrandIds);
    }
  }, [open, defaultBrandIds]);

  const loadBrands = async () => {
    try {
      setBrandsLoading(true);
      const response = await fetch('/api/brands');
      const data = await response.json();
      if (data.success) {
        setBrands(data.data || []);
      } else {
        message.error('加载品牌列表失败');
      }
    } catch (error) {
      message.error('加载品牌列表失败');
    } finally {
      setBrandsLoading(false);
    }
  };

  // 计算增量笔记数量
  const handleCalculateNewNotes = useCallback(async () => {
    if (brandIds.length === 0) {
      setNewNotesCount(null);
      return;
    }

    setCalculating(true);
    try {
      const response = await fetch(`/api/reports/${reportId}/calculate-new-notes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          brandIds,
          startDate: dateRange?.[0]?.format('YYYY-MM-DD'),
          endDate: dateRange?.[1]?.format('YYYY-MM-DD'),
        }),
      });
      const data = await response.json();
      if (data.success) {
        setNewNotesCount(data.data.newCount);
      } else {
        message.error(data.error || '计算笔记数量失败');
        setNewNotesCount(null);
      }
    } catch (error) {
      message.error('计算笔记数量失败');
      setNewNotesCount(null);
    } finally {
      setCalculating(false);
    }
  }, [reportId, brandIds, dateRange]);

  // 监听品牌和时间范围变化
  useEffect(() => {
    if (open) {
      handleCalculateNewNotes();
    }
  }, [handleCalculateNewNotes, open]);

  // 重置表单
  const handleCancel = () => {
    setBrandIds(defaultBrandIds);
    setDateRange(null);
    setNewNotesCount(null);
    setCalculating(false);
    onCancel();
  };

  // 提交追加
  const handleSubmit = async () => {
    try {
      if (brandIds.length === 0) {
        message.error('至少需要选择1个品牌');
        return;
      }

      if (calculating) {
        message.warning('正在计算笔记数量，请稍候...');
        return;
      }

      if (newNotesCount === null || newNotesCount === 0) {
        message.error('没有新增笔记，无法追加');
        return;
      }

      setLoading(true);
      const response = await fetch(`/api/reports/${reportId}/add-notes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          brandIds,
          startDate: dateRange?.[0]?.format('YYYY-MM-DD'),
          endDate: dateRange?.[1]?.format('YYYY-MM-DD'),
        }),
      });

      const data = await response.json();
      if (data.success) {
        message.success(`追加笔记成功：新增 ${data.data.addedCount} 条，跳过 ${data.data.skippedCount} 条`);
        handleCancel();
        onSuccess();
      } else {
        message.error(data.error || '追加笔记失败');
      }
    } catch (error) {
      message.error('追加笔记失败');
    } finally {
      setLoading(false);
    }
  };

  // 按钮可用条件：至少选择1个品牌，且计算完成，且将新增至少1条笔记
  const isButtonDisabled =
    brandIds.length === 0 ||
    calculating ||
    newNotesCount === null ||
    newNotesCount === 0;

  return (
    <Modal
      title="追加笔记"
      open={open}
      onCancel={handleCancel}
      width={600}
      footer={[
        <Button key="cancel" onClick={handleCancel}>
          取消
        </Button>,
        <Button
          key="submit"
          type="primary"
          onClick={handleSubmit}
          disabled={isButtonDisabled}
          loading={loading}
        >
          确认追加
        </Button>,
      ]}
    >
      <Form 
        layout="horizontal"
        labelCol={{ span: 6 }}
        wrapperCol={{ span: 18 }}
        style={{ marginTop: 24 }}
      >
        <Form.Item label="报告名称">
          <Input value={reportName} disabled />
        </Form.Item>

        <Form.Item
          label="品牌选择"
          required
        >
          <Select
            mode="multiple"
            placeholder="请选择品牌（至少选择1个）"
            value={brandIds}
            onChange={setBrandIds}
            loading={brandsLoading}
            showSearch
            filterOption={(input, option) =>
              (option?.label ?? '').toLowerCase().includes(input.toLowerCase())
            }
            options={brands.map((brand) => ({
              value: brand.BrandId,
              label: brand.BrandName,
            }))}
          />
        </Form.Item>

        <Form.Item
          label="时间范围"
        >
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
            style={{ width: '100%' }}
          />
        </Form.Item>

        {/* 笔记数量显示 */}
        <div style={{ marginTop: 24, marginBottom: 0 }}>
          {calculating ? (
            <div style={{ color: '#999', fontSize: 14 }}>
              <Spin size="small" style={{ marginRight: 8 }} />
              正在计算笔记数量...
            </div>
          ) : newNotesCount !== null ? (
            <div style={{ color: '#666', fontSize: 14 }}>
              将新增 {newNotesCount} 条笔记
            </div>
          ) : brandIds.length === 0 ? (
            <div style={{ color: '#999', fontSize: 14 }}>
              请选择品牌以计算笔记数量
            </div>
          ) : null}
        </div>
      </Form>
    </Modal>
  );
}

