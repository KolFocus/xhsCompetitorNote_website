'use client';

import React from 'react';
import {
  Modal,
  Card,
  Row,
  Col,
  Statistic,
  Button,
  Space,
  Tag,
  Typography,
  Divider,
} from 'antd';
import {
  LinkOutlined,
  DownloadOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  FileImageOutlined,
  VideoCameraOutlined,
  WarningOutlined,
  SecurityScanOutlined,
  SaveOutlined,
  ReloadOutlined,
  LoadingOutlined,
} from '@ant-design/icons';
import { Tooltip, Alert } from 'antd';

const { Text } = Typography;

interface MediaCheckModalProps {
  visible: boolean;
  result: any;
  downloading: boolean;
  checkingSensitive: boolean;
  sensitiveCheckResult: any;
  onClose: () => void;
  onDownload: () => void;
  onCheckSensitive: () => void;
  onSaveFilteredMedia: () => void;
  onRetryFailed: () => void;
}

export function MediaCheckModal({
  visible,
  result,
  downloading,
  checkingSensitive,
  sensitiveCheckResult,
  onClose,
  onDownload,
  onCheckSensitive,
  onSaveFilteredMedia,
  onRetryFailed,
}: MediaCheckModalProps) {
  // 获取图片的敏感检测状态
  const getSensitiveStatus = (imageUrl: string) => {
    if (!sensitiveCheckResult) return null;
    return sensitiveCheckResult.items.find((item: any) => item.imageUrl === imageUrl);
  };

  // 检查是否有有效的图片可以检测
  const hasValidImages = result?.results?.some(
    (r: any) => r.type === 'image' && r.status === 'success'
  );

  // 检查是否有敏感检测结果
  const hasSensitiveResults = sensitiveCheckResult && sensitiveCheckResult.summary.total > 0;

  // 检查是否有失败项
  const hasFailedItems = sensitiveCheckResult?.summary?.failed > 0;
  return (
    <Modal
      title={
        <Space>
          <LinkOutlined style={{ color: '#1890ff' }} />
          <span>媒体资源检测报告</span>
        </Space>
      }
      open={visible}
      onCancel={onClose}
      footer={
        <Button type="primary" onClick={onClose}>
          关闭
        </Button>
      }
      width={800}
    >
      {result && (
        <div>
          {/* 笔记信息 */}
          <Card size="small" style={{ marginBottom: 16, background: '#fafafa' }}>
            <Text strong style={{ fontSize: 14 }}>
              {result.noteTitle}
            </Text>
          </Card>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginBottom: 16 }}>
            <Button
              type="primary"
              icon={<DownloadOutlined />}
              onClick={onDownload}
              loading={downloading}
            >
              一键下载资源
            </Button>
            <Button
              icon={<SecurityScanOutlined />}
              onClick={onCheckSensitive}
              loading={checkingSensitive}
              disabled={!hasValidImages}
            >
              检测敏感内容
            </Button>
            {hasSensitiveResults && (
              <Button
                type="primary"
                icon={<SaveOutlined />}
                onClick={onSaveFilteredMedia}
              >
                保存结果
              </Button>
            )}
            {hasFailedItems && (
              <Button
                icon={<ReloadOutlined />}
                onClick={onRetryFailed}
                loading={checkingSensitive}
              >
                重试失败项
              </Button>
            )}
          </div>

          {/* 敏感检测进度 */}
          {checkingSensitive && sensitiveCheckResult && (
            <Alert
              message={`检测进度：${sensitiveCheckResult.summary.checking}/${sensitiveCheckResult.summary.total}`}
              type="info"
              showIcon
              style={{ marginBottom: 16 }}
            />
          )}

          {/* 敏感检测统计 */}
          {!checkingSensitive && sensitiveCheckResult && (
            <Alert
              message={`检测完成：${sensitiveCheckResult.summary.success}个正常，${sensitiveCheckResult.summary.sensitive}个敏感，${sensitiveCheckResult.summary.failed}个失败`}
              type="success"
              showIcon
              style={{ marginBottom: 16 }}
            />
          )}

          {/* 统计卡片 */}
          <Row gutter={16} style={{ marginBottom: 20 }}>
            <Col span={8}>
              <Card size="small" style={{ textAlign: 'center', background: '#e6f7ff', borderColor: '#1890ff' }}>
                <Statistic
                  title="总资源数"
                  value={result.summary.totalCount}
                  prefix={<FileImageOutlined style={{ color: '#1890ff' }} />}
                  valueStyle={{ color: '#1890ff', fontSize: 24 }}
                />
              </Card>
            </Col>
            <Col span={8}>
              <Card size="small" style={{ textAlign: 'center', background: '#f6ffed', borderColor: '#52c41a' }}>
                <Statistic
                  title="可用资源"
                  value={result.summary.successCount}
                  prefix={<CheckCircleOutlined style={{ color: '#52c41a' }} />}
                  valueStyle={{ color: '#52c41a', fontSize: 24 }}
                />
              </Card>
            </Col>
            <Col span={8}>
              <Card size="small" style={{ textAlign: 'center', background: '#fff1f0', borderColor: '#ff4d4f' }}>
                <Statistic
                  title="失效资源"
                  value={result.summary.failedCount}
                  prefix={<CloseCircleOutlined style={{ color: '#ff4d4f' }} />}
                  valueStyle={{ color: '#ff4d4f', fontSize: 24 }}
                />
              </Card>
            </Col>
          </Row>

          {/* 总大小显示 */}
          {result.summary.totalSizeFormatted && (
            <Card size="small" style={{ marginBottom: 16, background: '#f0f5ff', borderColor: '#adc6ff' }}>
              <Text>
                <strong>资源总大小：</strong>
                <Text style={{ fontSize: 16, color: '#1890ff', marginLeft: 8 }}>
                  {result.summary.totalSizeFormatted}
                </Text>
              </Text>
            </Card>
          )}

          <Divider orientation="left" style={{ marginTop: 24, marginBottom: 16 }}>资源详情</Divider>

          {/* 详细列表 */}
          <Space direction="vertical" style={{ width: '100%' }} size="middle">
            {/* 正常资源 */}
            {result.results.filter((r: any) => r.status === 'success').length > 0 && (
              <div>
                <div style={{ marginBottom: 8 }}>
                  <Tag color="success" icon={<CheckCircleOutlined />}>
                    正常资源 ({result.results.filter((r: any) => r.status === 'success').length})
                  </Tag>
                </div>
                <Space direction="vertical" style={{ width: '100%' }}>
                  {result.results
                    .filter((r: any) => r.status === 'success')
                    .map((item: any, index: number) => {
                      const sensitiveStatus = item.type === 'image' ? getSensitiveStatus(item.url) : null;
                      const isSensitive = sensitiveStatus?.status === 'sensitive';
                      const isChecking = sensitiveStatus?.status === 'checking';
                      const isFailed = sensitiveStatus?.status === 'failed';
                      const isHistorical = sensitiveStatus?.isHistorical;
                      const description = sensitiveStatus?.description;

                      return (
                        <Tooltip
                          key={index}
                          title={description ? `AI 描述：${description}` : undefined}
                          placement="top"
                        >
                          <Card 
                            size="small"
                            style={{ 
                              borderLeft: isSensitive ? '3px solid #ff4d4f' : '3px solid #52c41a',
                              background: isSensitive ? '#fff1f0' : '#f6ffed'
                            }}
                          >
                            <Space direction="vertical" style={{ width: '100%' }} size="small">
                              <div>
                                <Tag color={item.type === 'image' ? 'blue' : 'purple'}>
                                  {item.type === 'image' ? <FileImageOutlined /> : <VideoCameraOutlined />}
                                  {' '}
                                  {item.type === 'image' ? '图片' : '视频'}
                                </Tag>
                                <Tag color="green">{item.sizeFormatted || '未知大小'}</Tag>
                                {item.contentType && (
                                  <Tag>{item.contentType}</Tag>
                                )}
                                {/* 敏感检测状态标签 */}
                                {isHistorical && (
                                  <Tag color="orange" icon={<CheckCircleOutlined />}>
                                    已标记敏感
                                  </Tag>
                                )}
                                {isSensitive && !isHistorical && (
                                  <Tag color="red" icon={<WarningOutlined />}>
                                    敏感内容
                                  </Tag>
                                )}
                                {isChecking && (
                                  <Tag color="processing" icon={<LoadingOutlined />}>
                                    检测中...
                                  </Tag>
                                )}
                                {isFailed && (
                                  <Tag color="default" icon={<CloseCircleOutlined />}>
                                    检测失败
                                  </Tag>
                                )}
                              </div>
                              <Text 
                                ellipsis={{ tooltip: item.url }} 
                                copyable={{ text: item.url }}
                                style={{ fontSize: 12, color: '#666' }}
                              >
                                {item.url}
                              </Text>
                            </Space>
                          </Card>
                        </Tooltip>
                      );
                    })}
                </Space>
              </div>
            )}

            {/* 失效资源 */}
            {result.results.filter((r: any) => r.status === 'failed').length > 0 && (
              <div>
                <div style={{ marginBottom: 8 }}>
                  <Tag color="error" icon={<CloseCircleOutlined />}>
                    失效资源 ({result.results.filter((r: any) => r.status === 'failed').length})
                  </Tag>
                </div>
                <Space direction="vertical" style={{ width: '100%' }}>
                  {result.results
                    .filter((r: any) => r.status === 'failed')
                    .map((item: any, index: number) => (
                      <Card 
                        key={index}
                        size="small"
                        style={{ 
                          borderLeft: '3px solid #ff4d4f',
                          background: '#fff1f0'
                        }}
                      >
                        <Space direction="vertical" style={{ width: '100%' }} size="small">
                          <div>
                            <Tag color={item.type === 'image' ? 'blue' : 'purple'}>
                              {item.type === 'image' ? <FileImageOutlined /> : <VideoCameraOutlined />}
                              {' '}
                              {item.type === 'image' ? '图片' : '视频'}
                            </Tag>
                            <Tag color="red" icon={<WarningOutlined />}>
                              {item.error || '无法访问'}
                            </Tag>
                          </div>
                          <Text 
                            ellipsis={{ tooltip: item.url }} 
                            copyable={{ text: item.url }}
                            style={{ fontSize: 12, color: '#666' }}
                          >
                            {item.url}
                          </Text>
                        </Space>
                      </Card>
                    ))}
                </Space>
              </div>
            )}
          </Space>
        </div>
      )}
    </Modal>
  );
}

