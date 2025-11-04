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
  Pagination,
  Input,
  Empty,
  Spin,
  Tag,
  Image,
  Avatar,
} from 'antd';
import {
  SearchOutlined,
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
import 'dayjs/locale/zh-cn';

dayjs.locale('zh-cn');

const { RangePicker } = DatePicker;
const { Option } = Select;

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
      {loading ? (
        <div style={{ textAlign: 'center', padding: '50px 0' }}>
          <Spin size="large" />
        </div>
      ) : notes.length === 0 ? (
        <Empty description="暂无笔记数据" />
      ) : (
        <>
          <Row gutter={[16, 16]}>
            {notes.map((note) => (
              <Col xs={24} sm={12} lg={8} xl={6} key={note.NoteId}>
                <Card
                  hoverable
                  cover={
                    note.CoverImage ? (
                      <div style={{ position: 'relative', paddingTop: '75%' }}>
                        <Image
                          src={note.CoverImage}
                          alt={note.Title || ''}
                          preview={false}
                          style={{
                            position: 'absolute',
                            top: 0,
                            left: 0,
                            width: '100%',
                            height: '100%',
                            objectFit: 'cover',
                          }}
                        />
                        <div
                          style={{
                            position: 'absolute',
                            top: 8,
                            right: 8,
                            zIndex: 1,
                          }}
                        >
                          {note.NoteType === 'video' ? (
                            <Tag color="blue" icon={<VideoCameraOutlined />}>
                              视频
                            </Tag>
                          ) : (
                            <Tag color="green" icon={<PictureOutlined />}>
                              图文
                            </Tag>
                          )}
                          {note.IsAdNote && <Tag color="red">广告</Tag>}
                          {note.IsBusiness && <Tag color="orange">商业</Tag>}
                        </div>
                      </div>
                    ) : (
                      <div
                        style={{
                          height: 200,
                          background: '#f0f0f0',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        无封面图
                      </div>
                    )
                  }
                  actions={[
                    <Space key="like" size="small">
                      <LikeOutlined />
                      {formatNumber(note.LikedCount)}
                    </Space>,
                    <Space key="view" size="small">
                      <EyeOutlined />
                      {formatNumber(note.ViewCount)}
                    </Space>,
                    <Space key="comment" size="small">
                      <CommentOutlined />
                      {formatNumber(note.CommentsCount)}
                    </Space>,
                    <Space key="share" size="small">
                      <ShareAltOutlined />
                      {formatNumber(note.ShareCount)}
                    </Space>,
                  ]}
                >
                  <Card.Meta
                    title={
                      <div
                        style={{
                          fontSize: 14,
                          fontWeight: 500,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          display: '-webkit-box',
                          WebkitLineClamp: 2,
                          WebkitBoxOrient: 'vertical',
                          marginBottom: 8,
                        }}
                      >
                        {note.Title || '无标题'}
                      </div>
                    }
                    description={
                      <div>
                        <div style={{ marginBottom: 8 }}>
                          <Space>
                            <Avatar
                              size="small"
                              src={note.SmallAvatar || note.BigAvatar}
                            >
                              {note.BloggerNickName?.[0]}
                            </Avatar>
                            <span style={{ fontSize: 12 }}>
                              {note.BloggerNickName || '未知博主'}
                            </span>
                            {note.BrandName && (
                              <Tag color="blue" style={{ fontSize: 11 }}>
                                {note.BrandName}
                              </Tag>
                            )}
                          </Space>
                        </div>
                        <div style={{ fontSize: 12, color: '#999' }}>
                          {dayjs(note.PublishTime).format('YYYY-MM-DD HH:mm')}
                        </div>
                      </div>
                    }
                  />
                </Card>
              </Col>
            ))}
          </Row>

          {/* 分页 */}
          <div style={{ marginTop: 24, textAlign: 'right' }}>
            <Pagination
              current={page}
              pageSize={pageSize}
              total={total}
              showSizeChanger
              showQuickJumper
              showTotal={(total, range) =>
                `第 ${range[0]}-${range[1]} 条，共 ${total} 条`
              }
              onChange={(newPage, newPageSize) => {
                if (newPageSize !== pageSize) {
                  setPageSize(newPageSize);
                  setPage(1);
                } else {
                  setPage(newPage);
                  loadNotes(newPage);
                }
              }}
              pageSizeOptions={['10', '20', '50', '100']}
            />
          </div>
        </>
      )}
    </div>
  );
}
