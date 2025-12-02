'use client';

import React from 'react';
import {
  Modal,
  Table,
  Tag,
  Select,
  Popconfirm,
  Pagination,
  Button,
  Space,
  Typography,
} from 'antd';
import {
  ReloadOutlined,
  LinkOutlined,
  RedoOutlined,
} from '@ant-design/icons';
import type { FailedNote } from '../types';
import { useMediaCheck } from '../hooks/useMediaCheck';
import { MediaCheckModal } from './MediaCheckModal';

const { Text } = Typography;

interface StatusListModalProps {
  statusList: {
    statusModalVisible: boolean;
    statusModalStatus: '分析失败' | '待分析';
    statusNotes: FailedNote[];
    loadingStatusNotes: boolean;
    statusNotesPage: number;
    statusNotesTotal: number;
    statusFilterBrand: string;
    statusFilterErrType: string;
    brandList: Array<{ BrandId: string; BrandName: string }>;
    setStatusModalVisible: (visible: boolean) => void;
    setStatusFilterBrand: (value: string) => void;
    setStatusFilterErrType: (value: string) => void;
    loadStatusNotes: (page: number, brandFilter?: string, errTypeFilter?: string, statusOverride?: '分析失败' | '待分析') => Promise<void>;
    handleResetSingleNote: (noteId: string) => Promise<void>;
  };
}

export function StatusListModal({
  statusList,
}: StatusListModalProps) {
  // 媒体检测功能
  const mediaCheck = useMediaCheck();

  // 从 statusList 解构常用属性
  const {
    statusModalVisible: visible,
    statusModalStatus: status,
    statusNotes: notes,
    loadingStatusNotes: loading,
    statusNotesPage: page,
    statusNotesTotal: total,
    statusFilterBrand: filterBrand,
    statusFilterErrType: filterErrType,
    brandList,
  } = statusList;
  // 错误类型配置
  const errorTypeOptions = [
    { label: '媒体过期', value: 'MediaExpired' },
    { label: '渠道封禁', value: 'ChannelBlocked' },
    { label: '无可用渠道', value: 'NoChannel' },
    { label: '敏感内容', value: 'SensitiveContent' },
    { label: '解析错误', value: 'ParseError' },
    { label: '网络错误', value: 'NetworkError' },
    { label: '内容为空', value: 'ContentEmpty' },
    { label: '未知错误', value: 'Unknown' },
  ];

  const errorTypeColorMap: Record<string, string> = {
    MediaExpired: 'orange',
    ChannelBlocked: 'red',
    NoChannel: 'volcano',
    SensitiveContent: 'purple',
    ParseError: 'magenta',
    NetworkError: 'blue',
    ContentEmpty: 'default',
    Unknown: 'default',
  };

  const errorTypeLabelMap: Record<string, string> = {
    MediaExpired: '媒体过期',
    ChannelBlocked: '渠道封禁',
    NoChannel: '无可用渠道',
    SensitiveContent: '敏感内容',
    ParseError: '解析错误',
    NetworkError: '网络错误',
    ContentEmpty: '内容为空',
    Unknown: '未知错误',
  };

  return (
    <>
      <Modal
      title={status === '分析失败' ? 'AI分析失败列表' : '待分析列表'}
      open={visible}
      onCancel={() => statusList.setStatusModalVisible(false)}
      footer={null}
      width={1400}
      destroyOnClose
      styles={{
        body: {
          height: '600px',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          padding: 0,
        },
      }}
    >
      {/* 筛选器 */}
      <div style={{ padding: '16px 24px', borderBottom: '1px solid #f0f0f0', flexShrink: 0, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Space>
          <Text>品牌：</Text>
          <Select
            style={{ width: 200 }}
            placeholder="请选择品牌"
            allowClear
            showSearch
            filterOption={(input, option) => {
              const label = option?.label as string;
              return label.toLowerCase().includes(input.toLowerCase());
            }}
            value={filterBrand || undefined}
            onChange={(value) => {
              statusList.setStatusFilterBrand(value || '');
              statusList.loadStatusNotes(1, value || '', undefined);
            }}
            options={[
              ...brandList.map((brand) => ({
                label: brand.BrandName,
                value: `${brand.BrandId}#KF#${brand.BrandName}`,
              })),
            ]}
          />
          {status === '分析失败' && (
            <>
              <Text>错误类型：</Text>
              <Select
                style={{ width: 150 }}
                placeholder="请选择错误类型"
                allowClear
                value={filterErrType || undefined}
                onChange={(value) => {
                  statusList.setStatusFilterErrType(value || '');
                  statusList.loadStatusNotes(1, undefined, value || '');
                }}
                options={errorTypeOptions}
              />
            </>
          )}
        </Space>
        <Button
          icon={<ReloadOutlined />}
          onClick={() => statusList.loadStatusNotes(page)}
          loading={loading}
        >
          刷新列表
        </Button>
      </div>

      {/* 表格内容区域 */}
      <div style={{ flex: 1, overflow: 'auto', padding: '0 24px', minHeight: 0 }}>
        <Table
          dataSource={notes}
          loading={loading}
          rowKey="NoteId"
          pagination={false}
          scroll={{ x: 1200 }}
          size="small"
          sticky={{ offsetHeader: 0 }}
        >
          <Table.Column
            title="笔记标题"
            dataIndex="Title"
            key="Title"
            width={200}
            ellipsis={{ showTitle: true }}
            render={(text, record: FailedNote) => {
              if (record.XhsNoteLink) {
                return (
                  <a
                    href={record.XhsNoteLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ display: 'flex', alignItems: 'center', gap: 4 }}
                  >
                    <LinkOutlined />
                    <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {text || '查看笔记'}
                    </span>
                  </a>
                );
              }
              return text || '-';
            }}
          />
          <Table.Column
            title="博主"
            dataIndex="BloggerNickName"
            key="BloggerNickName"
            width={120}
            ellipsis={{ showTitle: true }}
            render={(text, record: FailedNote) => {
              if (record.XhsUserId) {
                return (
                  <a
                    href={`https://www.xiaohongshu.com/user/profile/${record.XhsUserId}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}
                  >
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {text || '查看主页'}
                    </span>
                  </a>
                );
              }
              return text || '-';
            }}
          />
          <Table.Column
            title="品牌"
            dataIndex="BrandName"
            key="BrandName"
            width={120}
            ellipsis={{ showTitle: true }}
            render={(text) => text || '-'}
          />
          <Table.Column
            title="发布时间"
            dataIndex="PublishTime"
            key="PublishTime"
            width={150}
            render={(text) => {
              if (!text) return '-';
              return new Date(text).toLocaleString('zh-CN', {
                year: 'numeric',
                month: '2-digit',
                day: '2-digit',
                hour: '2-digit',
                minute: '2-digit',
              });
            }}
          />
          {status === '分析失败' && (
            <>
              <Table.Column
                title="错误类型"
                dataIndex="AiErrType"
                key="AiErrType"
                width={120}
                render={(errType) => {
                  if (!errType) return '-';
                  return (
                    <Tag color={errorTypeColorMap[errType] || 'default'}>
                      {errorTypeLabelMap[errType] || errType}
                    </Tag>
                  );
                }}
              />
              <Table.Column
                title="错误信息"
                dataIndex="AiErr"
                key="AiErr"
                width={250}
                ellipsis={{ showTitle: true }}
                render={(text) => (
                  <Text type="danger" ellipsis={{ tooltip: text }}>
                    {text || '-'}
                  </Text>
                )}
              />
            </>
          )}
          <Table.Column
            title="操作"
            key="action"
            width={180}
            fixed="right"
            render={(_, record: FailedNote) => (
              <Space size="small">
                <Button 
                  type="link" 
                  size="small" 
                  icon={<LinkOutlined />}
                  loading={mediaCheck.checkingNoteId === record.NoteId}
                  onClick={() => mediaCheck.handleCheckMedia(record)}
                >
                  检测资源
                </Button>
                <Popconfirm
                  title="确认重置状态？"
                  description='将此笔记重置为"待分析"状态'
                  onConfirm={() => statusList.handleResetSingleNote(record.NoteId)}
                  okText="确认"
                  cancelText="取消"
                >
                  <Button type="link" size="small" icon={<RedoOutlined />}>
                    重置
                  </Button>
                </Popconfirm>
              </Space>
            )}
          />
        </Table>
      </div>

      {/* 固定在底部的分页 */}
      <div
        style={{
          padding: '12px 24px',
          borderTop: '1px solid #f0f0f0',
          background: '#fff',
          display: 'flex',
          justifyContent: 'flex-end',
          flexShrink: 0,
        }}
      >
        <Pagination
          current={page}
          pageSize={20}
          total={total}
          showSizeChanger={false}
          showTotal={(total) => `共 ${total} 条记录`}
          onChange={(page) => statusList.loadStatusNotes(page)}
        />
        </div>
      </Modal>

      <MediaCheckModal
        visible={mediaCheck.mediaCheckModalVisible}
        result={mediaCheck.mediaCheckResult}
        downloading={mediaCheck.downloadingMedia}
        checkingSensitive={mediaCheck.checkingSensitive}
        sensitiveCheckResult={mediaCheck.sensitiveCheckResult}
        onClose={() => mediaCheck.setMediaCheckModalVisible(false)}
        onDownload={mediaCheck.handleDownloadMedia}
        onCheckSensitive={mediaCheck.handleCheckSensitive}
        onSaveFilteredMedia={mediaCheck.handleSaveFilteredMedia}
        onRetryFailed={mediaCheck.handleRetryFailed}
      />
    </>
  );
}

