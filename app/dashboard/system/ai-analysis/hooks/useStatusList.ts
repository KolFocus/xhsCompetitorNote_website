import { useState } from 'react';
import { message } from 'antd';
import type { FailedNote } from '../types';

export function useStatusList(onStatsRefresh?: () => void) {
  const [statusModalVisible, setStatusModalVisible] = useState(false);
  const [statusModalStatus, setStatusModalStatus] = useState<'分析失败' | '待分析'>('分析失败');
  const [statusNotes, setStatusNotes] = useState<FailedNote[]>([]);
  const [loadingStatusNotes, setLoadingStatusNotes] = useState(false);
  const [statusNotesPage, setStatusNotesPage] = useState(1);
  const [statusNotesTotal, setStatusNotesTotal] = useState(0);
  const [statusFilterBrand, setStatusFilterBrand] = useState<string>('');
  const [statusFilterErrType, setStatusFilterErrType] = useState<string>('');
  const [brandList, setBrandList] = useState<Array<{ BrandId: string; BrandName: string }>>([]);

  // 加载品牌列表
  const loadBrandList = async () => {
    try {
      const response = await fetch('/api/allBrands');
      const result = await response.json();
      if (result.success) {
        setBrandList(result.data || []);
      }
    } catch (error) {
      console.error('加载品牌列表失败:', error);
    }
  };

  // 加载状态列表
  const loadStatusNotes = async (
    page: number = 1,
    brandFilter?: string,
    errTypeFilter?: string,
    statusOverride?: '分析失败' | '待分析',
  ) => {
    try {
      setLoadingStatusNotes(true);
      const params = new URLSearchParams({
        aiStatus: statusOverride || statusModalStatus,
        page: String(page),
        pageSize: '20',
      });

      const currentStatus = statusOverride || statusModalStatus;
      if (currentStatus === '待分析') {
        params.append('excludeNoteInvalid', 'true');
      }

      // 添加筛选条件
      const brand = brandFilter !== undefined ? brandFilter : statusFilterBrand;
      const errType = errTypeFilter !== undefined ? errTypeFilter : statusFilterErrType;
      
      if (brand && brand.includes('#KF#')) {
        const [brandId, brandName] = brand.split('#KF#');
        params.append('brandId', brandId);
        params.append('brandName', brandName);
      }
      if (errType) {
        params.append('errType', errType);
      }

      const response = await fetch(`/api/system/ai-analysis?${params.toString()}`);
      
      if (!response.ok) {
        throw new Error(`API请求失败: ${response.status} ${response.statusText}`);
      }
      
      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error || '获取数据失败');
      }

      setStatusNotes(result.data.list || []);
      setStatusNotesTotal(result.data.total || 0);
      setStatusNotesPage(page);
    } catch (error) {
      console.error('加载状态列表失败:', error);
      const errorMsg = error instanceof Error ? error.message : '未知错误';
      message.error(`加载失败: ${errorMsg}`);
    } finally {
      setLoadingStatusNotes(false);
    }
  };

  // 打开指定状态列表弹窗
  const handleViewStatusList = (status: '分析失败' | '待分析') => {
    setStatusModalStatus(status);
    setStatusModalVisible(true);
    setStatusFilterBrand('');
    setStatusFilterErrType('');
    loadBrandList();
    loadStatusNotes(1, '', '', status);
  };

  // 重置单条笔记状态
  const handleResetSingleNote = async (noteId: string) => {
    try {
      const response = await fetch('/api/system/ai-reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ noteId }),
      });

      const data = await response.json();

      if (data.success) {
        message.success('重置成功');
        loadStatusNotes(statusNotesPage);
        if (onStatsRefresh) {
          onStatsRefresh();
        }
      } else {
        message.error(data.error || '重置失败');
      }
    } catch (error) {
      console.error('重置失败:', error);
      message.error('重置失败');
    }
  };

  return {
    statusModalVisible,
    statusModalStatus,
    statusNotes,
    loadingStatusNotes,
    statusNotesPage,
    statusNotesTotal,
    statusFilterBrand,
    statusFilterErrType,
    brandList,
    setStatusModalVisible,
    setStatusFilterBrand,
    setStatusFilterErrType,
    loadStatusNotes,
    handleViewStatusList,
    handleResetSingleNote,
  };
}

