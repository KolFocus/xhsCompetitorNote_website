'use client';

import React, { useEffect, useMemo, useState } from 'react';
import {
  Button,
  Card,
  Form,
  Input,
  Modal,
  Select,
  Space,
  Table,
  Tag,
  Tooltip,
  message,
  Typography,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { QuestionCircleOutlined, LinkOutlined, StopOutlined, ReloadOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { parseKeywordExpression } from '@/lib/utils/keywordSearch';
import { PRODUCT_LINKING_IGNORE_UUID, PRODUCT_LINKING_DEFAULT_PAGE_SIZE } from '@/lib/constants/productLinking';

const { Text } = Typography;

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
  noteTitle: string;
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
  noteTitle: row.NoteTitle || row.noteTitle || '',
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
  const [statusFilter, setStatusFilter] = useState<StatusType | 'all'>('all');
  const [keyword, setKeyword] = useState<string>('');

  const [linkModalOpen, setLinkModalOpen] = useState(false);
  const [unlinkModalOpen, setUnlinkModalOpen] = useState(false);
  const [ignoreModalOpen, setIgnoreModalOpen] = useState(false);

  const [linkTargetProductId, setLinkTargetProductId] = useState<string>();
  const [newProductName, setNewProductName] = useState<string>('');
  const [linkScope, setLinkScope] = useState<'single' | 'batch'>('single');
  const [actingIds, setActingIds] = useState<string[]>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);

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

  const filteredData = useMemo(() => {
    return data;
  }, [data]);

  const brandOptions = allBrands.map((b) => ({ label: `${b.name} (${b.id})`, value: `${b.id}#${b.name}` }));
  const statusOptions = [
    { label: '全部', value: 'all' },
    { label: '待处理', value: 'pending' },
    { label: '已关联', value: 'linked' },
    { label: '已忽略', value: 'ignored' },
  ];

  const handleOpenLinkModal = (scope: 'single' | 'batch', ids: string[]) => {
    setLinkScope(scope);
    setActingIds(ids);
    setLinkTargetProductId(undefined);
    setNewProductName('');
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
    if (!linkTargetProductId && !newProductName.trim()) {
      message.warning('请选择商品或输入新商品名称');
      return;
    }
    const brandKey = actingIds.length > 0 ? prevBrandKey(actingIds[0]) : undefined;
    const run = async () => {
      try {
        setLoading(true);
        let targetProductId = linkTargetProductId;
        if (!targetProductId && newProductName.trim()) {
          if (linkScope !== 'batch') {
            message.warning('单条不支持新建商品');
            return;
          }
          if (!brandKey) throw new Error('品牌信息缺失');
          const [brandId, brandName] = brandKey.split('#');
          const res = await fetchJson('/api/products', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              productName: newProductName.trim(),
              brandId,
              brandName,
            }),
          });
          targetProductId = res.ProductId || res.productId;
          await loadProducts(brandKey);
        }

        if (!targetProductId) throw new Error('未获取商品ID');

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
      title: '笔记ID',
      dataIndex: 'noteId',
      key: 'noteId',
      width: 140,
    },
    {
      title: '笔记标题',
      dataIndex: 'noteTitle',
      key: 'noteTitle',
      render: (text) => <Text ellipsis style={{ maxWidth: 240 }} title={text}>{text}</Text>,
    },
    {
      title: '发布时间',
      dataIndex: 'publishTime',
      key: 'publishTime',
      width: 160,
      render: (t) => formatTime(t),
      sorter: (a, b) => dayjs(a.publishTime).valueOf() - dayjs(b.publishTime).valueOf(),
      defaultSortOrder: 'descend',
    },
    {
      title: '候选商品名',
      dataIndex: 'productAliasName',
      key: 'productAliasName',
      render: (text) => <div>{highlightText(text)}</div>,
    },
    {
      title: '品牌',
      dataIndex: 'brandName',
      key: 'brand',
      width: 140,
      render: (_, record) => (
        <div>
          <div>{record.brandName}</div>
          <Text type="secondary" style={{ fontSize: 12 }}>{record.brandId}</Text>
        </div>
      ),
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

  const loadCandidates = async (pageValue = page) => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      params.set('page', String(pageValue));
      params.set('pageSize', String(PRODUCT_LINKING_DEFAULT_PAGE_SIZE));
      if (brandFilter) {
        const [bid, bname] = brandFilter.split('#');
        params.set('brandId', bid);
        params.set('brandName', bname);
      }
      if (noteIdFilter) params.set('noteId', noteIdFilter.trim());
      if (statusFilter && statusFilter !== 'all') params.set('status', statusFilter);
      if (keyword.trim()) params.set('keyword', keyword.trim());

      const res = await fetchJson(`/api/note-products?${params.toString()}`);
      const list: CandidateRecord[] = (res || []).map(mapCandidate);
      setData(list);
      setTotal(res?.length || list.length || 0);
      setPage(pageValue);
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
  }, [brandFilter, noteIdFilter, statusFilter, keyword]);

  return (
    <div style={{ padding: 24 }}>
      <Space style={{ marginBottom: 16 }}>
        <Button icon={<ReloadOutlined />} onClick={() => loadCandidates()}>
          刷新
        </Button>
      </Space>

      <Card style={{ marginBottom: 16 }}>
        <Space wrap size="large">
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
          dataSource={filteredData}
          pagination={{
            pageSize: PRODUCT_LINKING_DEFAULT_PAGE_SIZE,
            current: page,
            total,
            onChange: (p) => loadCandidates(p),
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
        <Space direction="vertical" style={{ width: '100%' }} size="middle">
          <div>
            <div style={{ marginBottom: 6 }}>选择已有商品</div>
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
          </div>
          {linkScope === 'batch' && (
            <>
              <div>
                <div style={{ marginBottom: 6 }}>
                  新建商品（仅商品名必填，自动带品牌；重复校验）
                </div>
                <Form layout="vertical">
                  <Form.Item label="商品名称" required>
                    <Input
                      placeholder="输入商品标准名称"
                      value={newProductName}
                      onChange={(e) => {
                        setNewProductName(e.target.value);
                        if (e.target.value) {
                          setLinkTargetProductId(undefined);
                        }
                      }}
                    />
                  </Form.Item>
                </Form>
              </div>
              <Text type="secondary">若同时选择商品与填写新名称，以新建为准。</Text>
            </>
          )}
        </Space>
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

