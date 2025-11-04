/**
 * 首页/仪表盘
 */
// 标记为动态渲染
export const dynamic = 'force-dynamic';

import React from 'react';
import { Card, Row, Col, Statistic } from 'antd';
import {
  FileTextOutlined,
  TagsOutlined,
  BarChartOutlined,
  UserOutlined,
} from '@ant-design/icons';

export default function DashboardPage() {
  return (
    <div>
      <h1 style={{ fontSize: 24, marginBottom: 24 }}>首页</h1>
      
      <Row gutter={[16, 16]}>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="笔记总数"
              value={1128}
              prefix={<FileTextOutlined />}
              valueStyle={{ color: '#1890ff' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="品牌数量"
              value={45}
              prefix={<TagsOutlined />}
              valueStyle={{ color: '#52c41a' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="分析报告"
              value={23}
              prefix={<BarChartOutlined />}
              valueStyle={{ color: '#faad14' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="活跃用户"
              value={156}
              prefix={<UserOutlined />}
              valueStyle={{ color: '#ff4d4f' }}
            />
          </Card>
        </Col>
      </Row>
    </div>
  );
}

