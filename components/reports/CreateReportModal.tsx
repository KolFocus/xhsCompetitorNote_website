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

interface CreateReportModalProps {
  open: boolean;
  onCancel: () => void;
  onSuccess: (reportId: string) => void;
}

export default function CreateReportModal({
  open,
  onCancel,
  onSuccess,
}: CreateReportModalProps) {
  const [form] = Form.useForm();
  const reportName = Form.useWatch('reportName', form);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [brandId, setBrandId] = useState<string | undefined>(undefined);
  const [products, setProducts] = useState<{ ProductId: string; ProductName: string }[]>([]);
  const [productIds, setProductIds] = useState<string[]>([]);
  const [dateRange, setDateRange] = useState<[Dayjs, Dayjs] | null>(null);
  const [notesCount, setNotesCount] = useState<number | null>(null);
  const [calculating, setCalculating] = useState(false);
  const [loading, setLoading] = useState(false);
  const [brandsLoading, setBrandsLoading] = useState(false);
  const [productsLoading, setProductsLoading] = useState(false);

  // 加载品牌列表
  useEffect(() => {
    if (open) {
      loadBrands();
    }
  }, [open]);

  const loadBrands = async () => {
    try {
      setBrandsLoading(true);
      const response = await fetch('/api/allBrands');
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

  // 计算笔记数量
  const handleCalculateNotes = useCallback(async () => {
    if (!brandId) {
      setNotesCount(null);
      return;
    }

    setCalculating(true);
    try {
      const response = await fetch('/api/reports/calculate-notes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          brandKeys: [brandId],
          startDate: dateRange?.[0]?.format('YYYY-MM-DD'),
          endDate: dateRange?.[1]?.format('YYYY-MM-DD'),
          productIds: productIds.length ? productIds : undefined,
        }),
      });
      const data = await response.json();
      if (data.success) {
        setNotesCount(data.data.totalCount);
      } else {
        message.error(data.error || '计算笔记数量失败');
        setNotesCount(null);
      }
    } catch (error) {
      message.error('计算笔记数量失败');
      setNotesCount(null);
    } finally {
      setCalculating(false);
    }
  }, [brandId, dateRange, productIds]);

  // 监听品牌/商品/时间范围变化
  useEffect(() => {
    if (open) {
      handleCalculateNotes();
    }
  }, [handleCalculateNotes, open]);

  // 加载商品列表（基于品牌）
  const loadProducts = async (brandKey: string) => {
    const [bId, bName] = brandKey.split('#KF#');
    if (!bId || !bName) return;
    setProductsLoading(true);
    try {
      const res = await fetch(
        `/api/products?brandId=${encodeURIComponent(bId)}&brandName=${encodeURIComponent(bName)}&pageSize=500`,
      );
      const data = await res.json();
      if (!data.success) {
        throw new Error(data.error || '加载商品失败');
      }
      setProducts(data.data || []);
    } catch (err: any) {
      message.error(err?.message || '加载商品失败');
      setProducts([]);
    } finally {
      setProductsLoading(false);
    }
  };

  // 重置表单
  const handleCancel = () => {
    form.resetFields();
    setBrandId(undefined);
    setProducts([]);
    setProductIds([]);
    setDateRange(null);
    setNotesCount(null);
    setCalculating(false);
    onCancel();
  };

  // 提交创建
  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      
      if (!brandId) {
        message.error('至少需要选择1个品牌');
        return;
      }

      if (calculating) {
        message.warning('正在计算笔记数量，请稍候...');
        return;
      }

      if (notesCount === null || notesCount === 0) {
        message.error('没有符合条件的笔记，无法创建报告');
        return;
      }

      setLoading(true);
      const response = await fetch('/api/reports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reportName: values.reportName,
          brandKeys: [brandId],
          productIds: productIds.length ? productIds : undefined,
          startDate: dateRange?.[0]?.format('YYYY-MM-DD'),
          endDate: dateRange?.[1]?.format('YYYY-MM-DD'),
        }),
      });

      const data = await response.json();
      if (data.success) {
        message.success('创建报告成功');
        handleCancel();
        onSuccess(data.data.reportId);
      } else {
        message.error(data.error || '创建报告失败');
      }
    } catch (error: any) {
      if (error.errorFields) {
        // 表单验证错误
        return;
      }
      message.error('创建报告失败');
    } finally {
      setLoading(false);
    }
  };

  // 按钮可用条件：报告名称已填写（8-20字）且至少选择1个品牌，且计算完成，且至少有一条有效笔记
  const isButtonDisabled =
    !reportName ||
    !brandId ||
    calculating ||
    notesCount === null ||
    notesCount === 0;

  return (
    <Modal
      title="创建报告"
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
          创建报告
        </Button>,
      ]}
    >
      <Form
        form={form}
        layout="horizontal"
        labelCol={{ span: 6 }}
        wrapperCol={{ span: 18 }}
        style={{ marginTop: 24 }}
      >
        <Form.Item
          label="报告名称"
          name="reportName"
          required
          rules={[
            { required: true, message: '请输入报告名称' },
            { min: 8, message: '报告名称至少8个字符' },
            { max: 20, message: '报告名称最多20个字符' },
          ]}
        >
          <Input placeholder="请输入报告名称（8-20字）" />
        </Form.Item>

        <Form.Item label="品牌选择" required>
          <Select
            placeholder="请选择品牌"
            value={brandId}
            onChange={(value) => {
              setBrandId(value);
              setProductIds([]);
              setProducts([]);
              if (value) {
                loadProducts(value);
              }
            }}
            loading={brandsLoading}
            showSearch
            filterOption={(input, option) =>
              (option?.label ?? '').toLowerCase().includes(input.toLowerCase())
            }
            options={brands.map((brand) => ({
              value: `${brand.BrandId}#KF#${brand.BrandName}`,
              label: brand.BrandName,
            }))}
          />
        </Form.Item>

        <Form.Item label="商品选择">
          <Select
            mode="multiple"
            placeholder={brandId ? '可多选，可不选' : '请先选择品牌'}
            value={productIds}
            onChange={setProductIds}
            loading={productsLoading}
            disabled={!brandId}
            showSearch
            filterOption={(input, option) =>
              (option?.label ?? '').toLowerCase().includes(input.toLowerCase())
            }
            options={products.map((p) => ({
              value: p.ProductId,
              label: p.ProductName,
            }))}
            allowClear
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
          ) : notesCount !== null ? (
            <div style={{ color: '#666', fontSize: 14 }}>
              共找到 {notesCount} 条笔记
            </div>
          ) : !brandId ? (
            <div style={{ color: '#999', fontSize: 14 }}>
              请选择品牌以计算笔记数量
            </div>
          ) : null}
        </div>
      </Form>
    </Modal>
  );
}

