'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { Card, Table, Button, Space, Typography, message, Input } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { useRouter } from 'next/navigation';

const { Title, Text } = Typography;
const { Search } = Input;

interface BrandRecord {
  BrandId: string;
  BrandIdKey?: string | null;
  BrandName: string;
  NoteCount: number;
}

interface BrandSummary {
  BrandId: string;
  BrandName: string;
  NoteCount: number;
}

interface BrandResponseItem {
  BrandId: string;
  BrandIdKey: string | null;
  BrandName: string;
}

export default function BrandListPage() {
  const router = useRouter();
  const [brands, setBrands] = useState<BrandRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchValue, setSearchValue] = useState('');

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      try {
        const [brandsRes, summaryRes] = await Promise.all([
          fetch('/api/allBrands'),
          fetch('/api/notes/brand-summary'),
        ]);

        const brandsData = await brandsRes.json();
        const summaryData = await summaryRes.json();

        if (!brandsData.success) {
          throw new Error(brandsData.error || '加载品牌列表失败');
        }
        if (!summaryData.success) {
          throw new Error(summaryData.error || '加载品牌统计失败');
        }

        const countsMap = new Map<string, number>();
        (summaryData.data as BrandSummary[]).forEach((item) => {
          countsMap.set(item.BrandId, item.NoteCount);
        });

        const brandMap = new Map<string, BrandResponseItem>();
        (brandsData.data as BrandResponseItem[]).forEach((brand) => {
          if (!brand.BrandId || !brand.BrandName) return;
          const key = `${brand.BrandId}__${brand.BrandName}`;
          const existing = brandMap.get(key);
          if (!existing || (!existing.BrandIdKey && brand.BrandIdKey)) {
            brandMap.set(key, brand);
          }
        });

        const merged: BrandRecord[] = Array.from(brandMap.values())
          .map((brand) => ({
            BrandId: brand.BrandId,
            BrandIdKey: brand.BrandIdKey,
            BrandName: brand.BrandName,
            NoteCount: countsMap.get(brand.BrandId) || 0,
          }))
          .sort((a, b) => {
            if (a.BrandId === b.BrandId) {
              return a.BrandName.localeCompare(b.BrandName);
            }
            return a.BrandId.localeCompare(b.BrandId);
          });

        setBrands(merged);
      } catch (error: any) {
        console.error('Load brand list failed:', error);
        message.error(error?.message || '加载品牌列表失败');
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, []);

  const filteredBrands = useMemo(() => {
    if (!searchValue.trim()) {
      return brands;
    }
    const keyword = searchValue.trim().toLowerCase();
    const result = brands.filter(
      (brand) =>
        brand.BrandName.toLowerCase().includes(keyword) ||
        brand.BrandId.toLowerCase().includes(keyword),
    );
    console.log('过滤后的品牌列表:', result);
    return result;
  }, [brands, searchValue]);

  const handleOpenQianGua = (brand: BrandRecord) => {
    if (brand.BrandId && brand.BrandIdKey) {
      const url = `https://app.qian-gua.com/#/brand/detail/${brand.BrandId}/${brand.BrandIdKey}`;
      window.open(url, '_blank');
      return;
    }
    const fallback = `https://www.qian-gua.com/search?keyword=${encodeURIComponent(brand.BrandName)}`;
    window.open(fallback, '_blank');
  };

  const handleViewNotes = (brand: BrandRecord) => {
    const query = new URLSearchParams({
      brandId: brand.BrandId,
      brandName: brand.BrandName,
    }).toString();
    router.push(`/dashboard/notes?${query}`);
  };

  const columns: ColumnsType<BrandRecord> = [
    {
      title: '序号',
      dataIndex: 'index',
      key: 'index',
      width: 80,
      render: (_text, _record, index) => <Text>{index + 1}</Text>,
    },
    {
      title: '品牌名称',
      dataIndex: 'BrandName',
      key: 'brandName',
      render: (text) => <Text strong>{text}</Text>,
    },
    {
      title: '品牌ID',
      dataIndex: 'BrandId',
      key: 'brandId',
      render: (text) => <Text copyable>{text}</Text>,
    },
    {
      title: '笔记总数',
      dataIndex: 'NoteCount',
      key: 'noteCount',
    },
    {
      title: '操作',
      key: 'action',
      render: (_, record) => (
        <Space size="small">
          <Button type="link" onClick={() => handleOpenQianGua(record)}>
            千瓜页面
          </Button>
          <Button type="link" onClick={() => handleViewNotes(record)}>
            所有笔记
          </Button>
        </Space>
      ),
    },
  ];

  return (
    <div>
      <Title level={3} style={{ marginBottom: 24 }}>
        品牌列表
      </Title>

      <Card style={{ marginBottom: 16 }}>
        <Search
          placeholder="搜索品牌名称或ID"
          allowClear
          value={searchValue}
          onChange={(e) => setSearchValue(e.target.value)}
          onSearch={(value) => setSearchValue(value)}
          style={{ maxWidth: 360 }}
        />
      </Card>

      <Card>
        <Table
          rowKey={(record) => `${record.BrandId}#KF#${record.BrandName}`}
          loading={loading}
          columns={columns}
          dataSource={filteredBrands}
          pagination={{ pageSize: 20 }}
        />
      </Card>
    </div>
  );
}

