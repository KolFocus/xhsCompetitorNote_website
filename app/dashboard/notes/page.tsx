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
} from 'antd';
import {
  ReloadOutlined,
  VideoCameraOutlined,
  PictureOutlined,
  LikeOutlined,
  EyeOutlined,
  CommentOutlined,
  ShareAltOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import type { Dayjs } from 'dayjs';
import type { ColumnsType } from 'antd/es/table';
import 'dayjs/locale/zh-cn';

dayjs.locale('zh-cn');

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

interface Note {
  NoteId: string;
  Title: string;
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
  BrandName: string | null;
  CurrentUserIsFavorite: boolean;
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
  const [loading, setLoading] = useState(false);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  // 过滤条件
  const [selectedBrand, setSelectedBrand] = useState<string | undefined>();
  const [selectedBlogger, setSelectedBlogger] = useState<string | undefined>();
  const [dateRange, setDateRange] = useState<[Dayjs | null, Dayjs | null] | null>(null);

  // 加载品牌和博主列表
  useEffect(() => {
    const loadFilters = async () => {
      try {
        const [brandsRes, bloggersRes] = await Promise.all([
          fetch('/api/brands'),
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

  // 加载笔记列表
  const loadNotes = async (currentPage: number = page) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: currentPage.toString(),
        pageSize: pageSize.toString(),
      });

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

      const response = await fetch(`/api/notes?${params.toString()}`);
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

  // 初始加载
  useEffect(() => {
    loadNotes(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedBrand, selectedBlogger, dateRange, pageSize]);

  // 重置过滤条件
  const handleReset = () => {
    setSelectedBrand(undefined);
    setSelectedBlogger(undefined);
    setDateRange(null);
    setPage(1);
  };

  // 格式化数字
  const formatNumber = (num: number): string => {
    if (num >= 10000) {
      return (num / 10000).toFixed(1) + 'w';
    }
    return num.toString();
  };

  // 定义表格列
  const columns: ColumnsType<Note> = [
    {
      title: '封面',
      dataIndex: 'CoverImage',
      key: 'CoverImage',
      width: 100,
      render: (image: string | null, record: Note) => (
        <div style={{ 
          width: 80, 
          height: 60, 
          position: 'relative',
          overflow: 'hidden',
          borderRadius: 4,
        }}>
          {image ? (
            <Image
              src={getProxiedImageUrl(image)}
              alt={record.Title || ''}
              preview={false}
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
      ellipsis: true,
      render: (text: string, record: Note) => (
        <div>
          <div style={{ marginBottom: 8, fontWeight: 500 }}>
            {text || '无标题'}
          </div>
          <Space size="small" wrap>
            {record.NoteType === 'video' ? (
              <Tag color="blue" icon={<VideoCameraOutlined />}>
                视频
              </Tag>
            ) : (
              <Tag color="green" icon={<PictureOutlined />}>
                图文
              </Tag>
            )}
            {record.IsAdNote && <Tag color="red">广告</Tag>}
            {record.IsBusiness && <Tag color="orange">商业</Tag>}
          </Space>
        </div>
      ),
    },
    {
      title: '博主',
      key: 'Blogger',
      width: 150,
      render: (_, record: Note) => (
        <Space>
          <Avatar
            size="small"
            src={getProxiedImageUrl(record.SmallAvatar || record.BigAvatar)}
          >
            {record.BloggerNickName?.[0]}
          </Avatar>
          <span style={{ fontSize: 12 }}>
            {record.BloggerNickName || '未知博主'}
          </span>
        </Space>
      ),
    },
    {
      title: '品牌',
      dataIndex: 'BrandName',
      key: 'BrandName',
      width: 120,
      render: (brandName: string | null) =>
        brandName ? (
          <Tag color="blue">{brandName}</Tag>
        ) : (
          <span style={{ color: '#999' }}>-</span>
        ),
    },
    {
      title: '发布时间',
      dataIndex: 'PublishTime',
      key: 'PublishTime',
      width: 160,
      render: (time: string) => dayjs(time).format('YYYY-MM-DD HH:mm'),
    },
    {
      title: '点赞',
      dataIndex: 'LikedCount',
      key: 'LikedCount',
      width: 80,
      align: 'right',
      render: (count: number) => (
        <Space size="small">
          <LikeOutlined />
          {formatNumber(count)}
        </Space>
      ),
    },
    {
      title: '浏览',
      dataIndex: 'ViewCount',
      key: 'ViewCount',
      width: 80,
      align: 'right',
      render: (count: number) => (
        <Space size="small">
          <EyeOutlined />
          {formatNumber(count)}
        </Space>
      ),
    },
    {
      title: '评论',
      dataIndex: 'CommentsCount',
      key: 'CommentsCount',
      width: 80,
      align: 'right',
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
      render: (count: number) => (
        <Space size="small">
          <ShareAltOutlined />
          {formatNumber(count)}
        </Space>
      ),
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

          <Col xs={24} sm={12} md={8}>
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

          <Col xs={24} sm={12} md={4}>
            <div style={{ marginBottom: 8 }}>&nbsp;</div>
            <Space>
              <Button icon={<ReloadOutlined />} onClick={() => loadNotes(page)}>
                刷新
              </Button>
              <Button onClick={handleReset}>重置</Button>
            </Space>
          </Col>
        </Row>
      </Card>

      {/* 笔记列表 */}
      <Table
        columns={columns}
        dataSource={notes}
        rowKey="NoteId"
        loading={loading}
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
        scroll={{ x: 1200 }}
      />
    </div>
  );
}
