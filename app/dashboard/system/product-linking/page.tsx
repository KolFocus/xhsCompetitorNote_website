'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Button,
  Card,
  Form,
  Image,
  Input,
  Modal,
  Select,
  Space,
  Table,
  Tag,
  Tooltip,
  Tabs,
  message,
  Typography,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import {
  QuestionCircleOutlined,
  LinkOutlined,
  StopOutlined,
  ReloadOutlined,
  VideoCameraOutlined,
  PictureOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { parseKeywordExpression } from '@/lib/utils/keywordSearch';
import { PRODUCT_LINKING_IGNORE_UUID, PRODUCT_LINKING_DEFAULT_PAGE_SIZE } from '@/lib/constants/productLinking';

const { Text } = Typography;

// 图片代理服务（与笔记列表/标签页保持一致）
const PROXY_BASE_URL = 'https://www.xhstool.cc/api/proxy';
const getProxiedImageUrl = (url: string | null | undefined): string | undefined => {
  if (!url) return undefined;
  if (url.includes('xhstool.cc/api/proxy')) return url;
  if (url.startsWith('/')) {
    const normalized = `https:${url}`;
    return `${PROXY_BASE_URL}?url=${encodeURIComponent(normalized)}`;
  }
  return `${PROXY_BASE_URL}?url=${encodeURIComponent(url)}`;
};

type StatusType = 'pending' | 'linked' | 'ignored';

interface Product {
  productId: string;
  productName: string;
  brandId: string;
  brandName: string;
  productLink?: string | null;
  productImage?: string | null;
  productDesc?: string | null;
  createdAt: string;
}

interface CandidateRecord {
  id: string;
  noteId: string;
  xhsNoteId?: string;
  noteTitle: string;
  coverImage?: string | null;
  xhsNoteLink?: string | null;
  noteType?: string | null;
  videoDuration?: string | null;
  bloggerNickName?: string | null;
  xhsUserId?: string | null;
  publishTime: string;
  productAliasName: string;
  brandId: string;
  brandName: string;
  linkedProductId?: string | null;
}

const statusTag = (status: StatusType) => {
  if (status === 'pending') return <Tag color="default">待处理</Tag>;
  if (status === 'ignored') return <Tag color="orange">已忽略</Tag>;
  return <Tag color="green">已关联</Tag>;
};

const deriveStatus = (linkedProductId?: string | null): StatusType => {
  if (!linkedProductId) return 'pending';
  if (linkedProductId === PRODUCT_LINKING_IGNORE_UUID) return 'ignored';
  return 'linked';
};

const formatTime = (t: string) => dayjs(t).format('YYYY-MM-DD HH:mm');

const mapCandidate = (row: any): CandidateRecord => ({
  id: row.Id || row.id,
  noteId: row.NoteId || row.noteId,
  xhsNoteId: row.XhsNoteId || row.xhsNoteId,
  noteTitle: row.NoteTitle || row.noteTitle || '',
  coverImage: row.CoverImage ?? row.coverImage ?? null,
  xhsNoteLink: row.XhsNoteLink ?? row.xhsNoteLink ?? null,
  noteType: row.NoteType ?? row.noteType ?? null,
  videoDuration: row.VideoDuration ?? row.videoDuration ?? null,
  bloggerNickName: row.BloggerNickName ?? row.bloggerNickName ?? null,
  xhsUserId: row.XhsUserId ?? row.xhsUserId ?? null,
  publishTime: row.PublishTime || row.publishTime || row.CreatedAt || row.createdAt,
  productAliasName: row.ProductAliasName || row.productAliasName,
  brandId: row.BrandId || row.brandId,
  brandName: row.BrandName || row.brandName,
  linkedProductId: row.LinkedProductId ?? row.linkedProductId ?? null,
});

const mapProduct = (row: any): Product => ({
  productId: row.ProductId || row.productId,
  productName: row.ProductName || row.productName,
  brandId: row.BrandId || row.brandId,
  brandName: row.BrandName || row.brandName,
  productLink: row.ProductLink ?? row.productLink ?? null,
  productImage: row.ProductImage ?? row.productImage ?? null,
  productDesc: row.ProductDesc ?? row.productDesc ?? null,
  createdAt: row.CreatedAt || row.createdAt || new Date().toISOString(),
});

const fetchJson = async (url: string, options?: RequestInit) => {
  const res = await fetch(url, options);
  const json = await res.json();
  if (!res.ok || !json.success) {
    throw new Error(json.error || res.statusText);
  }
  return json.data;
};

export default function ProductLinkingPage() {
  const [data, setData] = useState<CandidateRecord[]>([]);
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  const [loading, setLoading] = useState(false);
  const [products, setProducts] = useState<Product[]>([]);

  const [brandFilter, setBrandFilter] = useState<string>();
  const [noteIdFilter, setNoteIdFilter] = useState<string>();
  const [statusFilter, setStatusFilter] = useState<StatusType | 'all'>('pending');
  const [keyword, setKeyword] = useState<string>('');

  const [linkModalOpen, setLinkModalOpen] = useState(false);
  const [unlinkModalOpen, setUnlinkModalOpen] = useState(false);
  const [ignoreModalOpen, setIgnoreModalOpen] = useState(false);

  const [linkTargetProductId, setLinkTargetProductId] = useState<string>();
  const [newProductName, setNewProductName] = useState<string>('');
  const [creatingProduct, setCreatingProduct] = useState(false);
  const [linkScope, setLinkScope] = useState<'single' | 'batch'>('single');
  const [linkTab, setLinkTab] = useState<'existing' | 'create'>('existing');
  const [actingIds, setActingIds] = useState<string[]>([]);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(PRODUCT_LINKING_DEFAULT_PAGE_SIZE);
  const [total, setTotal] = useState(0);
  const loadedBrandKeysRef = useRef<Set<string>>(new Set());

  const allBrands = useMemo(() => {
    const map = new Map<string, string>();
    data.forEach((d) => {
      map.set(`${d.brandId}#${d.brandName}`, d.brandName);
    });
    return Array.from(map.keys()).map((key) => {
      const [id, name] = key.split('#');
      return { id, name, key };
    });
  }, [data]);

  const parsedKeyword = useMemo(() => parseKeywordExpression(keyword), [keyword]);

  const brandOptions = allBrands.map((b) => ({ label: `${b.name} (${b.id})`, value: `${b.id}#${b.name}` }));
  const statusOptions = [
    { label: '待处理', value: 'pending' },
    { label: '已关联', value: 'linked' },
    { label: '已忽略', value: 'ignored' },
    { label: '全部', value: 'all' },
  ];

  const handleOpenLinkModal = (scope: 'single' | 'batch', ids: string[]) => {
    setLinkScope(scope);
    setActingIds(ids);
    setLinkTargetProductId(undefined);
    setNewProductName('');
    setCreatingProduct(false);
    setLinkTab('existing');
    setLinkModalOpen(true);
  };

  const handleOpenUnlinkModal = (ids: string[]) => {
    setActingIds(ids);
    setUnlinkModalOpen(true);
  };

  const handleOpenIgnoreModal = (ids: string[]) => {
    setActingIds(ids);
    setIgnoreModalOpen(true);
  };

  const doLink = () => {
    if (!linkTargetProductId) {
      message.warning('请选择商品');
      return;
    }
    const brandKey = actingIds.length > 0 ? prevBrandKey(actingIds[0]) : undefined;
    const run = async () => {
      try {
        setLoading(true);
        const targetProductId = linkTargetProductId;

        if (linkScope === 'single') {
          await fetchJson(`/api/note-products/${actingIds[0]}/link`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ productId: targetProductId }),
          });
        } else {
          await fetchJson(`/api/note-products/batch/link`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ids: actingIds, productId: targetProductId }),
          });
        }
        message.success('关联成功（覆盖原绑定）');
        setLinkModalOpen(false);
        loadCandidates(page);
      } catch (err: any) {
        message.error(err.message || '关联失败');
      } finally {
        setLoading(false);
      }
    };
    Modal.confirm({
      title: '确认关联并覆盖？',
      onOk: run,
    });
  };

  const prevBrandKey = (id: string) => {
    const target = data.find((d) => d.id === id);
    return target ? `${target.brandId}#${target.brandName}` : '';
  };

  const handleCreateProduct = async () => {
    if (linkScope !== 'batch') {
      message.warning('新建商品仅支持批量关联时使用');
      return;
    }
    const name = newProductName.trim();
    if (!name) {
      message.warning('请输入商品名称');
      return;
    }
    const brandKey = actingIds.length > 0 ? prevBrandKey(actingIds[0]) : '';
    if (!brandKey) {
      message.error('品牌信息缺失');
      return;
    }
    const [brandId, brandName] = brandKey.split('#');
    try {
      setCreatingProduct(true);
      const res = await fetchJson('/api/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productName: name,
          brandId,
          brandName,
        }),
      });
      const newId = res.ProductId || res.productId;
      message.success('新建商品成功');
      setLinkTargetProductId(newId);
      await loadProducts(brandKey);
    } catch (err: any) {
      message.error(err.message || '新建商品失败');
    } finally {
      setCreatingProduct(false);
    }
  };

  const doUnlink = () => {
    const run = async () => {
      try {
        setLoading(true);
        if (actingIds.length === 1) {
          await fetchJson(`/api/note-products/${actingIds[0]}/unlink`, { method: 'PUT' });
        } else {
          await fetchJson(`/api/note-products/batch/unlink`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ids: actingIds }),
          });
        }
        message.success('已取消关联');
        setUnlinkModalOpen(false);
        loadCandidates(page);
      } catch (err: any) {
        message.error(err.message || '取消关联失败');
      } finally {
        setLoading(false);
      }
    };
    run();
  };

  const doIgnore = () => {
    const run = async () => {
      try {
        setLoading(true);
        if (actingIds.length === 1) {
          await fetchJson(`/api/note-products/${actingIds[0]}/ignore`, { method: 'PUT' });
        } else {
          await fetchJson(`/api/note-products/batch/ignore`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ids: actingIds }),
          });
        }
        message.success('已设为忽略');
        setIgnoreModalOpen(false);
        loadCandidates(page);
      } catch (err: any) {
        message.error(err.message || '忽略失败');
      } finally {
        setLoading(false);
      }
    };
    run();
  };

  const highlightText = (text: string) => {
    if (!keyword.trim()) return text;
    const terms = [...(parsedKeyword.mustInclude || []), ...(parsedKeyword.optional || [])].filter(Boolean);
    if (!terms.length) return text;
    let result: React.ReactNode = text;
    terms.forEach((term) => {
      const re = new RegExp(`(${term})`, 'ig');
      result = (
        <>
          {String(result)
            .split(re)
            .map((part, idx) =>
              part.toLowerCase() === term.toLowerCase() ? (
                <Text mark key={idx}>
                  {part}
                </Text>
              ) : (
                <React.Fragment key={idx}>{part}</React.Fragment>
              ),
            )}
        </>
      );
    });
    return result;
  };

  const columns: ColumnsType<CandidateRecord> = [
    {
      title: '笔记',
      dataIndex: 'noteTitle',
      key: 'note',
      width: 200,
      render: (_text, record) => {
        const xhsLink = record.xhsNoteLink
          ? record.xhsNoteLink
          : record.xhsNoteId
          ? `https://www.xiaohongshu.com/explore/${record.xhsNoteId}`
          : undefined;
        const cover = getProxiedImageUrl(record.coverImage);
        return (
          <div style={{ width: 180 }}>
            <div
              style={{
                width: 180,
                height: 240,
                cursor: cover ? 'pointer' : 'default',
                marginBottom: 8,
                overflow: 'hidden',
                borderRadius: 4,
                backgroundColor: '#f0f0f0',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
              onClick={() => {
                if (cover) {
                  window.open(cover, '_blank');
                }
              }}
            >
              {cover ? (
                <Image
                  src={cover}
                  alt={record.noteTitle || '笔记封面'}
                  width={180}
                  height={240}
                  style={{ objectFit: 'cover' }}
                  preview={false}
                  fallback=""
                />
              ) : (
                <Text type="secondary">无封面</Text>
              )}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <Tooltip title={record.noteTitle || '未命名笔记'}>
                <Text strong ellipsis style={{ maxWidth: 150 }}>
                  {record.noteTitle || '未命名笔记'}
                </Text>
              </Tooltip>
              {xhsLink && (
                <LinkOutlined
                  style={{ color: '#1890ff', cursor: 'pointer', flexShrink: 0 }}
                  onClick={(e) => {
                    e.stopPropagation();
                    window.open(xhsLink, '_blank');
                  }}
                />
              )}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8 }}>
              {record.noteType ? (
                <Tag color={record.noteType === 'video' ? 'blue' : 'green'} icon={record.noteType === 'video' ? <VideoCameraOutlined /> : <PictureOutlined />}>
                  {record.noteType === 'video'
                    ? record.videoDuration
                      ? `${record.videoDuration}`
                      : '视频'
                    : '图文'}
                </Tag>
              ) : (
                <Tag color="default">未知类型</Tag>
              )}
              {record.xhsUserId ? (
                <a
                  href={`https://www.xiaohongshu.com/user/profile/${record.xhsUserId}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ fontSize: 12, color: '#1890ff', cursor: 'pointer' }}
                  onClick={(e) => e.stopPropagation()}
                >
                  {record.bloggerNickName || '未知博主'}
                </a>
              ) : (
                <Text type="secondary" style={{ fontSize: 12 }}>
                  {record.bloggerNickName || '未知博主'}
                </Text>
              )}
            </div>
          </div>
        );
      },
    },
    // 笔记ID/标题在“笔记”列展示，这里去掉单独列
    {
      title: '品牌',
      dataIndex: 'brandName',
      key: 'brand',
      width: 140,
      render: (_, record) => (
        <div>
          <div>{record.brandName}</div>
        </div>
      ),
    },
    {
      title: '候选商品名',
      dataIndex: 'productAliasName',
      key: 'productAliasName',
      render: (text) => <div>{highlightText(text)}</div>,
    },
    {
      title: '当前关联商品',
      dataIndex: 'linkedProductId',
      key: 'linked',
      width: 200,
      render: (id) => {
        if (!id) return <Text type="secondary">未关联</Text>;
        if (id === PRODUCT_LINKING_IGNORE_UUID) return <Tag color="orange">已忽略</Tag>;
        const product = products.find((p) => p.productId === id);
        return product ? (
          <div>
            <div>{product.productName}</div>
            <Text type="secondary" style={{ fontSize: 12 }}>{product.productId}</Text>
          </div>
        ) : (
          <Text type="warning">未找到商品</Text>
        );
      },
    },
    {
      title: '状态',
      key: 'status',
      width: 110,
      render: (_, record) => statusTag(deriveStatus(record.linkedProductId)),
    },
    {
      title: '操作',
      key: 'actions',
      width: 220,
      render: (_, record) => {
        const brandKey = `${record.brandId}#${record.brandName}`;
        return (
          <Space>
            <Button
              size="small"
              type="link"
              onClick={() => {
                loadProducts(brandKey).catch(() => undefined);
                handleOpenLinkModal('single', [record.id]);
              }}
            >
              关联/覆盖
            </Button>
            <Button size="small" type="link" onClick={() => handleOpenUnlinkModal([record.id])}>
              取消关联
            </Button>
            <Button size="small" type="link" danger onClick={() => handleOpenIgnoreModal([record.id])}>
              忽略
            </Button>
          </Space>
        );
      },
    },
  ];

  const rowSelection = {
    selectedRowKeys,
    onChange: (keys: React.Key[]) => setSelectedRowKeys(keys),
  };

  const canBatchLink = useMemo(() => {
    if (selectedRowKeys.length === 0) return false;
    const selected = data.filter((d) => selectedRowKeys.includes(d.id));
    const brands = new Set(selected.map((d) => `${d.brandId}#${d.brandName}`));
    return brands.size === 1;
  }, [selectedRowKeys, data]);

  const canBatchUnlink = selectedRowKeys.length > 0;
  const canBatchIgnore = selectedRowKeys.length > 0;

  const currentBrandKeyForBatch = useMemo(() => {
    if (!canBatchLink) return '';
    const selected = data.find((d) => d.id === selectedRowKeys[0]);
    return selected ? `${selected.brandId}#${selected.brandName}` : '';
  }, [canBatchLink, data, selectedRowKeys]);

  const linkBrandKey = useMemo(() => {
    if (!actingIds.length) return '';
    const target = data.find((d) => d.id === actingIds[0]);
    return target ? `${target.brandId}#${target.brandName}` : '';
  }, [actingIds, data]);

  const productsForBrand = useMemo(() => {
    if (!linkBrandKey) return [];
    return products
      .filter((p) => `${p.brandId}#${p.brandName}` === linkBrandKey)
      .sort((a, b) => dayjs(b.createdAt).valueOf() - dayjs(a.createdAt).valueOf());
  }, [linkBrandKey, products]);

  const resetSelection = () => setSelectedRowKeys([]);

  const loadCandidates = async (pageValue = page, pageSizeValue = pageSize) => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      params.set('page', String(pageValue));
      params.set('pageSize', String(pageSizeValue));
      if (brandFilter) {
        const [bid, bname] = brandFilter.split('#');
        params.set('brandId', bid);
        params.set('brandName', bname);
      }
      if (noteIdFilter) params.set('noteId', noteIdFilter.trim());
      if (statusFilter && statusFilter !== 'all') params.set('status', statusFilter);
      if (keyword.trim()) params.set('keyword', keyword.trim());

      const res = await fetchJson(`/api/note-products?${params.toString()}`);
      const listRaw = Array.isArray(res?.list) ? res.list : res || [];
      const list: CandidateRecord[] = (listRaw || []).map(mapCandidate);
      const totalRaw = typeof res?.total === 'number' ? res.total : list.length;
      setData(list);
      setTotal(totalRaw);
      setPage(pageValue);
      setPageSize(pageSizeValue);
      resetSelection();
    } catch (err: any) {
      console.error('loadCandidates error', err);
      message.error(err.message || '加载失败');
    } finally {
      setLoading(false);
    }
  };

  const loadProducts = async (brandKey: string) => {
    const [bid, bname] = brandKey.split('#');
    const params = new URLSearchParams({ brandId: bid, brandName: bname, pageSize: '200' });
    const res = await fetchJson(`/api/products?${params.toString()}`);
    setProducts((prev) => {
      // merge by id
      const map = new Map<string, Product>();
      prev.forEach((p) => map.set(p.productId, p));
      (res || []).forEach((p: any) => {
        const mp = mapProduct(p);
        map.set(mp.productId, mp);
      });
      return Array.from(map.values()).sort((a, b) => dayjs(b.createdAt).valueOf() - dayjs(a.createdAt).valueOf());
    });
  };

  useEffect(() => {
    loadCandidates(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    // 自动为当前页已关联商品的品牌预加载商品列表，避免“未找到商品”显示
    const brandKeys = Array.from(
      new Set(
        data
          .filter((d) => d.linkedProductId && d.linkedProductId !== PRODUCT_LINKING_IGNORE_UUID)
          .map((d) => `${d.brandId}#${d.brandName}`),
      ),
    );
    brandKeys.forEach((key) => {
      if (!loadedBrandKeysRef.current.has(key)) {
        loadedBrandKeysRef.current.add(key);
        loadProducts(key).catch(() => undefined);
      }
    });
  }, [data]);

  return (
    <div style={{ padding: 24 }}>
      <Card style={{ marginBottom: 16 }}>
        <Space wrap size="large" align="end">
          <div>
            <div style={{ marginBottom: 6 }}>品牌</div>
            <Select
              allowClear
              style={{ width: 220 }}
              placeholder="选择品牌"
              options={brandOptions}
              value={brandFilter}
              onChange={(v) => setBrandFilter(v)}
            />
          </div>
          <div>
            <div style={{ marginBottom: 6 }}>笔记ID</div>
            <Input
              placeholder="输入笔记ID"
              style={{ width: 220 }}
              value={noteIdFilter}
              allowClear
              onChange={(e) => setNoteIdFilter(e.target.value)}
            />
          </div>
          <div>
            <div style={{ marginBottom: 6 }}>状态</div>
            <Select
              style={{ width: 180 }}
              options={statusOptions}
              value={statusFilter}
              onChange={(v) => setStatusFilter(v as StatusType | 'all')}
            />
          </div>
          <div>
            <div style={{ marginBottom: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
              <span>关键词（商品名）</span>
              <Tooltip
                title={
                  <div>
                    <div>搜索语法：</div>
                    <div>+词：必须包含</div>
                    <div>-词：不得包含</div>
                    <div>A|B|C：任意包含其一</div>
                  </div>
                }
              >
                <QuestionCircleOutlined style={{ color: '#999' }} />
              </Tooltip>
            </div>
            <Input
              placeholder="支持 +词/-词/OR"
              style={{ width: 280 }}
              value={keyword}
              allowClear
              onChange={(e) => setKeyword(e.target.value)}
            />
          </div>
          <div style={{ display: 'flex', alignItems: 'center' }}>
            <Button type="primary" onClick={() => loadCandidates(1, pageSize)} style={{ marginBottom: 6 }}>
              搜索
            </Button>
          </div>
        </Space>
      </Card>

      <Card
        title="笔记商品列表"
        extra={
          <Space>
            <Button
              type="primary"
              icon={<LinkOutlined />}
              disabled={!canBatchLink}
              onClick={() => {
                if (currentBrandKeyForBatch) {
                  loadProducts(currentBrandKeyForBatch).catch(() => undefined);
                }
                handleOpenLinkModal('batch', selectedRowKeys as string[]);
              }}
            >
              批量关联
            </Button>
            <Button
              icon={<StopOutlined />}
              disabled={!canBatchUnlink}
              onClick={() => handleOpenUnlinkModal(selectedRowKeys as string[])}
            >
              批量取消关联
            </Button>
            <Button
              danger
              disabled={!canBatchIgnore}
              onClick={() => handleOpenIgnoreModal(selectedRowKeys as string[])}
            >
              批量忽略
            </Button>
          </Space>
        }
      >
        <Table
          rowKey="id"
          loading={loading}
          rowSelection={rowSelection}
          columns={columns}
          dataSource={data}
          pagination={{
            pageSize,
            current: page,
            total,
            showSizeChanger: true,
            pageSizeOptions: [20, 50, 100].map(String),
            onChange: (p, ps) => loadCandidates(p, ps),
            onShowSizeChange: (p, ps) => loadCandidates(p, ps),
            showTotal: (tot, range) => `第 ${range[0]}-${range[1]} 条，共 ${tot} 条`,
          }}
          scroll={{ x: 1000 }}
        />
      </Card>

      {/* 关联/新建弹窗 */}
      <Modal
        open={linkModalOpen}
        title={linkScope === 'single' ? '关联商品' : '批量关联商品'}
        onCancel={() => setLinkModalOpen(false)}
        onOk={doLink}
        okText="确认关联并覆盖"
      >
        <Tabs
          activeKey={linkTab}
          onChange={(key) => setLinkTab(key as 'existing' | 'create')}
          items={[
            {
              key: 'existing',
              label: '选择已有商品',
              children: (
                <Space direction="vertical" style={{ width: '100%' }} size="middle">
                  <Select
                    allowClear
                    placeholder="选择商品"
                    style={{ width: '100%' }}
                    value={linkTargetProductId}
                    onChange={(v) => setLinkTargetProductId(v)}
                    options={productsForBrand.map((p) => ({
                      label: `${p.productName}`,
                      value: p.productId,
                    }))}
                  />
                </Space>
              ),
            },
            ...(linkScope === 'batch'
              ? [
                  {
                    key: 'create',
                    label: '新建商品',
                    children: (
                      <Space direction="vertical" style={{ width: '100%' }} size="middle">
                        <Space align="start">
                          <Input
                            placeholder="输入商品标准名称"
                            value={newProductName}
                            style={{ width: 260 }}
                            onChange={(e) => setNewProductName(e.target.value)}
                          />
                          <Button type="default" loading={creatingProduct} onClick={handleCreateProduct}>
                            创建并加入列表
                          </Button>
                        </Space>
                        <Text type="secondary">创建成功后，会加入下拉列表，请切回上方“选择已有商品”选择后再关联。</Text>
                      </Space>
                    ),
                  },
                ]
              : []),
          ]}
        />
      </Modal>

      {/* 取消关联弹窗 */}
      <Modal
        open={unlinkModalOpen}
        title={actingIds.length > 1 ? '批量取消关联' : '取消关联'}
        okText={actingIds.length > 1 ? '批量取消关联' : '取消关联'}
        onCancel={() => setUnlinkModalOpen(false)}
        onOk={doUnlink}
      >
        确认将选中的记录取消关联并恢复为待处理？
      </Modal>

      {/* 忽略弹窗 */}
      <Modal
        open={ignoreModalOpen}
        title={actingIds.length > 1 ? '批量忽略' : '忽略'}
        okText={actingIds.length > 1 ? '批量忽略' : '忽略'}
        onCancel={() => setIgnoreModalOpen(false)}
        onOk={doIgnore}
      >
        确认将选中的记录标记为已忽略吗？
      </Modal>
    </div>
  );
}

