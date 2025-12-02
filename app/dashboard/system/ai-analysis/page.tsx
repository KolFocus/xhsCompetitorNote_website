'use client';

import React from 'react';
import { Spin, Typography } from 'antd';
import { RobotOutlined } from '@ant-design/icons';
import { StatsCards } from './components/StatsCards';
import { ConfigCards } from './components/ConfigCards';
import { StatusListModal } from './components/StatusListModal';
import { useAiConfig } from './hooks/useAiConfig';
import { useStatusList } from './hooks/useStatusList';
import { useExport } from './hooks/useExport';

const { Title } = Typography;

export default function AiAnalysisPage() {
  // 配置管理
  const config = useAiConfig();

  // 状态列表管理
  const statusList = useStatusList(config.loadStats);
  
  // 导出功能
  const exportFunc = useExport();

  return (
    <div style={{ padding: 24 }}>
      <Title level={2}>
        <RobotOutlined /> AI 分析管理
      </Title>

      <Spin spinning={config.loading}>
        <StatsCards
          stats={config.stats}
          loading={config.loading}
          countdown={config.countdown}
          exporting={exportFunc.exporting}
          exportingNoContent={exportFunc.exportingNoContent}
          exportingNoteInvalid={exportFunc.exportingNoteInvalid}
          onRefresh={config.handleRefresh}
          onViewPendingList={() => statusList.handleViewStatusList('待分析')}
          onResetProcessing={() => config.handleReset('分析中', '分析中')}
          onViewFailedList={() => statusList.handleViewStatusList('分析失败')}
          onResetFailed={() => config.handleReset('分析失败', '分析失败')}
          onExportFailed={exportFunc.handleExport}
          onExportNoContent={exportFunc.handleExportNoContent}
          onExportNoteInvalid={exportFunc.handleExportNoteInvalid}
        />

        <ConfigCards
          aiProvider={config.aiProvider}
          aiModel={config.aiModel}
          aiEnabled={config.aiEnabled}
          openrouterApiKey={config.openrouterApiKey}
          onProviderChange={config.handleProviderChange}
          onModelChange={config.handleModelChange}
          onToggle={config.handleToggle}
          onApiKeyChange={config.setOpenrouterApiKey}
          onApiKeySave={config.handleApiKeySave}
        />
      </Spin>

      <StatusListModal statusList={statusList} />
    </div>
  );
}

