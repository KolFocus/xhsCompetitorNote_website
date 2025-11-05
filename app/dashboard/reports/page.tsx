'use client';

// 标记为动态渲染
export const dynamic = 'force-dynamic';

/**
 * 报告详情页面
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
  Tooltip,
  Statistic,
  Tabs,
  Input,
  Checkbox,
  message,
  Empty,
  Modal,
} from 'antd';
import {
  PlusOutlined,
  ReloadOutlined,
  SearchOutlined,
  VideoCameraOutlined,
  PictureOutlined,
  LikeOutlined,
  EyeOutlined,
  CommentOutlined,
  ShareAltOutlined,
  FileTextOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import type { Dayjs } from 'dayjs';
import type { ColumnsType } from 'antd/es/table';
import 'dayjs/locale/zh-cn';

dayjs.locale('zh-cn');

const { RangePicker } = DatePicker;
const { Option } = Select;
const { Search } = Input;

// 图片代理服务
const PROXY_BASE_URL = 'https://www.xhstool.cc/api/proxy';

const getProxiedImageUrl = (url: string | null | undefined): string | undefined => {
  if (!url) return undefined;
  if (url.includes('xhstool.cc/api/proxy')) return url;
  if (url.startsWith('/')) return url;
  return `${PROXY_BASE_URL}?url=${encodeURIComponent(url)}`;
};

interface Report {
  reportId: string;
  reportName: string;
  createdAt: string;
  updatedAt: string;
  activeNotesCount: number;
  ignoredNotesCount: number;
}

interface ReportDetail extends Report {
  earliestNoteTime: string | null;
  latestNoteTime: string | null;
  brands: Array<{ brandId: string; brandName: string }>;
}

interface Note {
  noteId: string;
  title: string;
  coverImage: string | null;
  noteType: string;
  isBusiness: boolean;
  isAdNote: boolean;
  publishTime: string;
  likedCount: number;
  collectedCount: number;
  commentsCount: number;
  viewCount: number;
  shareCount: number;
  bloggerId: string;
  bloggerNickName: string;
  bloggerSmallAvatar: string | null;
  brandId: string | null;
  brandName: string | null;
  videoDuration: string | null;
  status: string;
  addedAt: string;
}

export default function ReportsPage() {
  const [reports, setReports] = useState<Report[]>([]);
  const [reportId, setReportId] = useState<string | null>(null);
  const [reportDetail, setReportDetail] = useState<ReportDetail | null>(null);
  const [notes, setNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(false);
  const [notesLoading, setNotesLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'active' | 'ignored'>('active');
  const [selectedNoteIds, setSelectedNoteIds] = useState<string[]>([]);
  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [addNotesModalVisible, setAddNotesModalVisible] = useState(false);

  // 筛选条件
  const [brandId, setBrandId] = useState<string | null>(null);
  const [bloggerId, setBloggerId] = useState<string | null>(null);
  const [dateRange, setDateRange] = useState<[Dayjs, Dayjs] | null>(null);
  const [searchKeyword, setSearchKeyword] = useState('');

  // 加载报告列表
  useEffect(() => {
    loadReports();
  }, []);

  // 加载报告详情
  useEffect(() => {
    if (reportId) {
      loadReportDetail(reportId);
      loadNotes();
    }
  }, [reportId, activeTab, brandId, bloggerId, dateRange, searchKeyword]);

  const loadReports = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/reports');
      const data = await response.json();
      if (data.success) {
        setReports(data.data.list);
        // 默认选中最新创建的报告
        if (data.data.list.length > 0 && !reportId) {
          setReportId(data.data.list[0].reportId);
        }
      }
    } catch (error) {
      message.error('加载报告列表失败');
    } finally {
      setLoading(false);
    }
  };

  const loadReportDetail = async (id: string) => {
    try {
      setLoading(true);
      const response = await fetch(`/api/reports/${id}`);
      const data = await response.json();
      if (data.success) {
        setReportDetail(data.data);
      }
    } catch (error) {
      message.error('加载报告详情失败');
    } finally {
      setLoading(false);
    }
  };

  const loadNotes = async () => {
    if (!reportId) return;
    
    try {
      setNotesLoading(true);
      const params = new URLSearchParams({
        page: '1',
        pageSize: '20',
        status: activeTab,
      });
      if (brandId) params.set('brandId', brandId);
      if (bloggerId) params.set('bloggerId', bloggerId);
      if (dateRange) {
        params.set('startDate', dateRange[0].format('YYYY-MM-DD'));
        params.set('endDate', dateRange[1].format('YYYY-MM-DD'));
      }
      if (searchKeyword) params.set('search', searchKeyword);

      const response = await fetch(`/api/reports/${reportId}/notes?${params}`);
      const data = await response.json();
      if (data.success) {
        setNotes(data.data.list);
      }
    } catch (error) {
      message.error('加载笔记列表失败');
    } finally {
      setNotesLoading(false);
    }
  };

  const handleBatchAction = async (action: 'ignore' | 'delete' | 'restore') => {
    if (!reportId || selectedNoteIds.length === 0) return;

    if (action === 'delete') {
      Modal.confirm({
        title: '确认删除',
        content: `确定要删除选中的 ${selectedNoteIds.length} 条笔记吗？此操作不可恢复。`,
        onOk: async () => {
          try {
            const response = await fetch(`/api/reports/${reportId}/notes/batch-action`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ action, noteIds: selectedNoteIds }),
            });
            const data = await response.json();
            if (data.success) {
              message.success('操作成功');
              setSelectedNoteIds([]);
              loadNotes();
              loadReportDetail(reportId);
            } else {
              message.error(data.error || '操作失败');
            }
          } catch (error) {
            message.error('操作失败');
          }
        },
      });
    } else {
      try {
        const response = await fetch(`/api/reports/${reportId}/notes/batch-action`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action, noteIds: selectedNoteIds }),
        });
        const data = await response.json();
        if (data.success) {
          message.success('操作成功');
          setSelectedNoteIds([]);
          loadNotes();
          loadReportDetail(reportId);
        } else {
          message.error(data.error || '操作失败');
        }
      } catch (error) {
        message.error('操作失败');
      }
    }
  };

  const formatNumber = (num: number): string => {
    if (num >= 10000) {
      return `${(num / 10000).toFixed(1)}w`;
    }
    return num.toString();
  };

  const columns: ColumnsType<Note> = [
    {
      title: '封面',
      dataIndex: 'coverImage',
      key: 'coverImage',
      width: 100,
      render: (url: string | null) => (
        <Image
          width={60}
          height={80}
          src={getProxiedImageUrl(url)}
          alt="封面"
          fallback="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='60' height='80'%3E%3Crect width='60' height='80' fill='%23f0f0f0'/%3E%3Ctext x='50%25' y='50%25' text-anchor='middle' dy='.3em' fill='%23999'%3E无图%3C/text%3E%3C/svg%3E"
          style={{ objectFit: 'cover', borderRadius: 4 }}
        />
      ),
    },
    {
      title: '标题',
      dataIndex: 'title',
      key: 'title',
      width: 300,
      render: (title: string, record: Note) => (
        <div>
          <Tooltip title={title}>
            <div style={{ marginBottom: 4 }}>{title}</div>
          </Tooltip>
          <Space size={4}>
            {record.noteType === 'video' && (
              <Tag color="blue" icon={<VideoCameraOutlined />}>
                {record.videoDuration || '视频'}
              </Tag>
            )}
            {record.noteType === 'image' && (
              <Tag color="green" icon={<PictureOutlined />}>图文</Tag>
            )}
            {record.isAdNote && <Tag color="red">广告</Tag>}
            {record.isBusiness && <Tag color="orange">商业</Tag>}
          </Space>
        </div>
      ),
    },
    {
      title: '博主',
      dataIndex: 'bloggerNickName',
      key: 'bloggerNickName',
      width: 150,
      render: (name: string, record: Note) => (
        <Space>
          <Avatar size="small" src={getProxiedImageUrl(record.bloggerSmallAvatar)}>
            {name?.[0]}
          </Avatar>
          <span style={{ fontSize: 12 }}>{name}</span>
        </Space>
      ),
    },
    {
      title: '品牌',
      dataIndex: 'brandName',
      key: 'brandName',
      width: 120,
      render: (name: string | null) =>
        name ? <Tag color="blue">{name}</Tag> : <span style={{ color: '#999' }}>-</span>,
    },
    {
      title: '互动',
      key: 'interaction',
      width: 100,
      align: 'right',
      render: (_: any, record: Note) =>
        formatNumber(
          record.likedCount +
            record.viewCount +
            record.commentsCount +
            record.shareCount
        ),
    },
    {
      title: '点赞',
      dataIndex: 'likedCount',
      key: 'likedCount',
      width: 80,
      align: 'right',
      render: (count: number) => (
        <Space>
          <LikeOutlined />
          {formatNumber(count)}
        </Space>
      ),
    },
    {
      title: '浏览',
      dataIndex: 'viewCount',
      key: 'viewCount',
      width: 80,
      align: 'right',
      render: (count: number) => (
        <Space>
          <EyeOutlined />
          {formatNumber(count)}
        </Space>
      ),
    },
    {
      title: '评论',
      dataIndex: 'commentsCount',
      key: 'commentsCount',
      width: 80,
      align: 'right',
      render: (count: number) => (
        <Space>
          <CommentOutlined />
          {formatNumber(count)}
        </Space>
      ),
    },
    {
      title: '分享',
      dataIndex: 'shareCount',
      key: 'shareCount',
      width: 80,
      align: 'right',
      render: (count: number) => (
        <Space>
          <ShareAltOutlined />
          {formatNumber(count)}
        </Space>
      ),
    },
    {
      title: '发布时间',
      dataIndex: 'publishTime',
      key: 'publishTime',
      width: 160,
      render: (time: string) => dayjs(time).format('YYYY-MM-DD HH:mm'),
    },
    {
      title: '操作',
      key: 'action',
      width: 150,
      render: (_: any, record: Note) => (
        <Space>
          {activeTab === 'active' && (
            <>
              <Button
                type="link"
                size="small"
                onClick={() => handleBatchAction('ignore')}
              >
                忽略
              </Button>
              <Button
                type="link"
                size="small"
                danger
                onClick={() => {
                  setSelectedNoteIds([record.noteId]);
                  handleBatchAction('delete');
                }}
              >
                删除
              </Button>
            </>
          )}
          {activeTab === 'ignored' && (
            <Button
              type="link"
              size="small"
              onClick={() => {
                setSelectedNoteIds([record.noteId]);
                handleBatchAction('restore');
              }}
            >
              恢复
            </Button>
          )}
        </Space>
      ),
    },
  ];

  // 空状态
  if (reports.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: '100px 0' }}>
        <Empty
          image={<FileTextOutlined style={{ fontSize: 64, color: '#d9d9d9' }} />}
          description="暂无报告"
        >
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setCreateModalVisible(true)}>
            创建报告
          </Button>
        </Empty>
      </div>
    );
  }

  return (
    <div style={{ padding: 24 }}>
      {/* 报告选择区域 */}
      <Card style={{ marginBottom: 24 }}>
        <Row gutter={16} align="middle">
          <Col>
            <Select
              value={reportId}
              onChange={setReportId}
              style={{ width: 300 }}
              placeholder="请选择报告"
            >
              {reports.map((report) => (
                <Option key={report.reportId} value={report.reportId}>
                  {report.reportName}
                </Option>
              ))}
            </Select>
          </Col>
          {reportDetail && (
            <Col>
              <span style={{ color: '#999' }}>
              创建时间: {dayjs(reportDetail.createdAt).format('YYYY-MM-DD')}
            </span>
            </Col>
          )}
          <Col flex="auto" />
          <Col>
            <Button type="primary" icon={<PlusOutlined />} onClick={() => setCreateModalVisible(true)}>
              创建新报告
            </Button>
          </Col>
        </Row>
      </Card>

      {reportDetail && (
        <>
          {/* 报告信息卡片 */}
          <Row gutter={16} style={{ marginBottom: 24 }}>
            <Col span={8}>
              <Card>
                <Statistic
                  title="报告名称"
                  value={reportDetail.reportName}
                  valueStyle={{ fontSize: 20 }}
                />
              </Card>
            </Col>
            <Col span={8}>
              <Card>
                <Statistic
                  title="创建时间"
                  value={dayjs(reportDetail.createdAt).format('YYYY-MM-DD HH:mm')}
                  valueStyle={{ fontSize: 20 }}
                />
              </Card>
            </Col>
            <Col span={8}>
              <Card>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ color: '#999', marginBottom: 8 }}>统计范围</div>
                  <div style={{ fontSize: 20 }}>
                    {reportDetail.earliestNoteTime
                      ? dayjs(reportDetail.earliestNoteTime).format('YYYY-MM-DD')
                      : '-'}{' '}
                    至{' '}
                    {reportDetail.latestNoteTime
                      ? dayjs(reportDetail.latestNoteTime).format('YYYY-MM-DD')
                      : '-'}
                  </div>
                </div>
              </Card>
            </Col>
          </Row>

          {/* 统计信息卡片 */}
          <Row gutter={16} style={{ marginBottom: 24 }}>
            <Col span={12}>
              <Card>
                <Statistic
                  title="有效笔记"
                  value={reportDetail.activeNotesCount}
                  valueStyle={{ color: '#1890ff' }}
                />
              </Card>
            </Col>
            <Col span={12}>
              <Card>
                <Statistic
                  title="已忽略"
                  value={reportDetail.ignoredNotesCount}
                  valueStyle={{ color: '#999' }}
                />
              </Card>
            </Col>
          </Row>

          {/* 筛选器区域 */}
          <Card style={{ marginBottom: 24 }}>
            <Row gutter={16}>
              <Col>
                <Select
                  value={brandId}
                  onChange={setBrandId}
                  placeholder="选择品牌"
                  style={{ width: 150 }}
                  allowClear
                >
                  {reportDetail.brands.map((brand) => (
                    <Option key={brand.brandId} value={brand.brandId}>
                      {brand.brandName}
                    </Option>
                  ))}
                </Select>
              </Col>
              <Col>
                <Select
                  value={bloggerId}
                  onChange={setBloggerId}
                  placeholder="选择博主"
                  style={{ width: 150 }}
                  allowClear
                />
              </Col>
              <Col>
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
                />
              </Col>
              <Col>
                <Button icon={<ReloadOutlined />} onClick={loadNotes}>
                  刷新
                </Button>
              </Col>
              <Col>
                <Button
                  onClick={() => {
                    setBrandId(null);
                    setBloggerId(null);
                    setDateRange(null);
                    setSearchKeyword('');
                  }}
                >
                  重置
                </Button>
              </Col>
            </Row>
          </Card>

          {/* 操作栏 */}
          <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between' }}>
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => setAddNotesModalVisible(true)}
            >
              追加笔记
            </Button>
            <Search
              placeholder="搜索笔记标题、品牌..."
              style={{ width: 300 }}
              value={searchKeyword}
              onChange={(e) => setSearchKeyword(e.target.value)}
              onSearch={loadNotes}
              allowClear
            />
          </div>

          {/* Tab切换 */}
          <Tabs
            activeKey={activeTab}
            onChange={(key) => {
              setActiveTab(key as 'active' | 'ignored');
              setSelectedNoteIds([]);
            }}
            items={[
              { key: 'active', label: '有效笔记' },
              { key: 'ignored', label: '已忽略' },
            ]}
          />

          {/* 批量操作栏 */}
          {selectedNoteIds.length > 0 && (
            <div
              style={{
                padding: '12px 16px',
                background: '#f5f5f5',
                marginBottom: 16,
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <Space>
                <Checkbox
                  checked={selectedNoteIds.length === notes.length}
                  onChange={(e) => {
                    if (e.target.checked) {
                      setSelectedNoteIds(notes.map((n) => n.noteId));
                    } else {
                      setSelectedNoteIds([]);
                    }
                  }}
                >
                  全选
                </Checkbox>
                <span style={{ color: '#999' }}>已选择 {selectedNoteIds.length} 项</span>
              </Space>
              <Space>
                {activeTab === 'active' && (
                  <>
                    <Button onClick={() => handleBatchAction('ignore')}>忽略</Button>
                    <Button danger onClick={() => handleBatchAction('delete')}>
                      删除
                    </Button>
                  </>
                )}
                {activeTab === 'ignored' && (
                  <Button onClick={() => handleBatchAction('restore')}>恢复</Button>
                )}
              </Space>
            </div>
          )}

          {/* 笔记列表表格 */}
          <Table
            columns={columns}
            dataSource={notes}
            rowKey="noteId"
            loading={notesLoading}
            rowSelection={{
              selectedRowKeys: selectedNoteIds,
              onChange: (keys) => setSelectedNoteIds(keys as string[]),
            }}
            pagination={{
              total: notes.length,
              pageSize: 20,
              showSizeChanger: true,
              showTotal: (total) => `共 ${total} 条`,
            }}
            scroll={{ x: 1200 }}
          />
        </>
      )}
    </div>
  );
}
