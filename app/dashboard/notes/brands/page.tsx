'use client';

import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { Card, Table, Button, Space, Typography, message, Input, Tooltip } from 'antd';
import { ReloadOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import { useRouter } from 'next/navigation';
import { 
  type DateRange, 
  parseDateCoverage, 
  formatDateRange 
} from '@/lib/utils/dateCoverage';

const { Title, Text } = Typography;
const { Search } = Input;

interface BrandRecord {
  BrandId: string;
  BrandIdKey?: string | null;
  BrandName: string;
  NoteCount: number;
  DateCoverage?: DateRange[] | null;
  _hasDateCoverageError?: boolean; // 标记 DateCoverage 是否存在但解析失败
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
  DateCoverage?: any; // 可能是 JSON 字符串、数组或 null
}

export default function BrandListPage() {
  const router = useRouter();
  const [brands, setBrands] = useState<BrandRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchValue, setSearchValue] = useState('');

  const loadData = useCallback(async () => {
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
        // 使用 BrandId__BrandName 作为 key，确保每个品牌（BrandId + BrandName 组合）都能正确获取到对应的 NoteCount
        const key = `${item.BrandId}__${item.BrandName}`;
        countsMap.set(key, item.NoteCount);
      });

      // 解析和处理 DateCoverage
      const processedBrands = (brandsData.data as BrandResponseItem[]).map((brand) => {
        const parsed = parseDateCoverage(brand.DateCoverage);
        return {
          ...brand,
          DateCoverage: parsed.coverage,
          _hasDateCoverageError: parsed.hasError,
        };
      });

      const brandMap = new Map<string, BrandResponseItem & { DateCoverage: DateRange[] | null; _hasDateCoverageError?: boolean }>();
      processedBrands.forEach((brand) => {
        if (!brand.BrandId || !brand.BrandName) return;
        const key = `${brand.BrandId}__${brand.BrandName}`;
        const existing = brandMap.get(key);
        if (!existing || (!existing.BrandIdKey && brand.BrandIdKey)) {
          brandMap.set(key, brand as BrandResponseItem & { DateCoverage: DateRange[] | null; _hasDateCoverageError?: boolean });
        }
      });

      const merged: BrandRecord[] = Array.from(brandMap.values())
        .map((brand) => {
          // 使用 BrandId__BrandName 作为 key 来获取对应的 NoteCount
          const countKey = `${brand.BrandId}__${brand.BrandName}`;
          return {
            BrandId: brand.BrandId,
            BrandIdKey: brand.BrandIdKey,
            BrandName: brand.BrandName,
            NoteCount: countsMap.get(countKey) || 0,
            DateCoverage: brand.DateCoverage,
            _hasDateCoverageError: brand._hasDateCoverageError,
          };
        })
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
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

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

  /**
   * 渲染日期覆盖时间段
   */
  const renderDateCoverage = (coverage: DateRange[] | null | undefined) => {
    // 空数据处理
    if (!coverage || coverage.length === 0) {
      return <Text type="secondary">-</Text>;
    }
    
    // 格式化所有时间段
    const formattedRanges = coverage.map(formatDateRange);
    
    // 多行显示
    const content = (
      <div>
        {coverage.map((range, index) => (
          <div key={index} style={{ marginBottom: index < coverage.length - 1 ? 4 : 0 }}>
            <Text>{formatDateRange(range)}</Text>
          </div>
        ))}
      </div>
    );
    
    // Tooltip 显示完整信息
    const tooltipContent = (
      <div>
        {formattedRanges.map((range, index) => (
          <div key={index} style={{ marginBottom: index < formattedRanges.length - 1 ? 4 : 0 }}>
            {range}
          </div>
        ))}
      </div>
    );
    
    return (
      <Tooltip title={tooltipContent}>
        {content}
      </Tooltip>
    );
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
      render: (text) => <Text>{text}</Text>,
    },
    {
      title: '笔记总数',
      dataIndex: 'NoteCount',
      key: 'noteCount',
    },
    {
      title: '数据覆盖时间段',
      dataIndex: 'DateCoverage',
      key: 'dateCoverage',
      width: 250,
      render: (coverage: DateRange[] | null | undefined, record: BrandRecord) => {
        // 如果 DateCoverage 存在但解析失败，显示错误提示
        if (record._hasDateCoverageError) {
          return (
            <Tooltip title="DateCoverage 数据格式错误（非数组、JSON 解析失败或日期格式无效）">
              <Text type="danger">数据格式错误</Text>
            </Tooltip>
          );
        }
        return renderDateCoverage(coverage);
      },
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
        <Space>
          <Search
            placeholder="搜索品牌名称或ID"
            allowClear
            value={searchValue}
            onChange={(e) => setSearchValue(e.target.value)}
            onSearch={(value) => setSearchValue(value)}
            style={{ maxWidth: 360 }}
          />
          <Button
            icon={<ReloadOutlined />}
            onClick={loadData}
            loading={loading}
          >
            刷新
          </Button>
        </Space>
      </Card>

      <Card>
        <Table
          rowKey={(record) => `${record.BrandId}#KF#${record.BrandName}`}
          loading={loading}
          columns={columns}
          dataSource={filteredBrands}
          pagination={{ pageSize: 10 }}
        />
      </Card>
    </div>
  );
}

