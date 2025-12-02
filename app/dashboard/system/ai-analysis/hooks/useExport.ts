import { useState } from 'react';
import { message } from 'antd';
import type { FailedNote } from '../types';
import {
  fetchAllPages,
  exportToExcel,
  generateTimestamp,
  formatFailedNotesExportData,
  formatNoContentNotesExportData,
} from '../utils/exportUtils';

export function useExport() {
  const [exporting, setExporting] = useState(false);
  const [exportingNoContent, setExportingNoContent] = useState(false);
  const [exportingNoteInvalid, setExportingNoteInvalid] = useState(false);

  // 导出失败列表
  const handleExport = async () => {
    if (exporting) {
      console.log('正在导出中，请稍候...');
      return;
    }
    
    try {
      setExporting(true);
      console.log('开始导出失败列表...');

      const allNotes = await fetchAllPages<FailedNote>(async (page, pageSize) => {
        const params = new URLSearchParams({
          aiStatus: '分析失败',
          page: String(page),
          pageSize: String(pageSize),
        });

        const response = await fetch(`/api/system/ai-analysis?${params.toString()}`);
        
        if (!response.ok) {
          throw new Error(`API请求失败: ${response.status} ${response.statusText}`);
        }
        
        const result = await response.json();

        if (!result.success) {
          throw new Error(result.error || '获取数据失败');
        }

        return {
          list: result.data.list || [],
          total: result.data.total || 0,
        };
      });

      console.log(`总共获取到 ${allNotes.length} 条失败记录`);

      if (allNotes.length === 0) {
        message.warning('暂无失败记录可导出');
        return;
      }

      const exportData = formatFailedNotesExportData(allNotes);
      const timestamp = generateTimestamp();
      const filename = `AI分析失败列表_${timestamp}.xlsx`;

      await exportToExcel(exportData, 'AI分析失败列表', filename);
      
      message.success(`导出成功，共 ${allNotes.length} 条记录`);
    } catch (error) {
      console.error('导出失败 - 详细错误:', error);
      const errorMsg = error instanceof Error ? error.message : '未知错误';
      message.error(`导出失败: ${errorMsg}`);
    } finally {
      setExporting(false);
      console.log('导出流程结束');
    }
  };

  // 导出笔记详情缺失列表
  const handleExportNoContent = async () => {
    if (exportingNoContent) {
      console.log('正在导出中，请稍候...');
      return;
    }
    
    try {
      setExportingNoContent(true);
      console.log('开始导出笔记详情缺失列表...');

      const allNotes = await fetchAllPages<FailedNote>(async (page, pageSize) => {
        const params = new URLSearchParams({
          showMissingContent: 'true',
          page: String(page),
          pageSize: String(pageSize),
        });

        const response = await fetch(`/api/notes?${params.toString()}`);
        
        if (!response.ok) {
          throw new Error(`API请求失败: ${response.status} ${response.statusText}`);
        }
        
        const result = await response.json();

        if (!result.success) {
          throw new Error(result.error || '获取数据失败');
        }

        return {
          list: result.data.list || [],
          total: result.data.total || 0,
        };
      });

      console.log(`总共获取到 ${allNotes.length} 条笔记详情缺失记录`);

      if (allNotes.length === 0) {
        message.warning('暂无笔记详情缺失记录可导出');
        return;
      }

      const exportData = formatNoContentNotesExportData(allNotes);
      const timestamp = generateTimestamp();
      const filename = `笔记详情缺失列表_${timestamp}.xlsx`;

      await exportToExcel(exportData, '笔记详情缺失列表', filename);
      
      message.success(`导出成功，共 ${allNotes.length} 条记录`);
    } catch (error) {
      console.error('导出失败 - 详细错误:', error);
      const errorMsg = error instanceof Error ? error.message : '未知错误';
      message.error(`导出失败: ${errorMsg}`);
    } finally {
      setExportingNoContent(false);
      console.log('导出流程结束');
    }
  };

  // 导出笔记不可见列表
  const handleExportNoteInvalid = async () => {
    if (exportingNoteInvalid) {
      console.log('正在导出中，请稍候...');
      return;
    }
    
    try {
      setExportingNoteInvalid(true);
      console.log('开始导出笔记不可见列表...');

      const allNotes = await fetchAllPages<FailedNote>(async (page, pageSize) => {
        const params = new URLSearchParams({
          showNoteInvalid: 'true',
          page: String(page),
          pageSize: String(pageSize),
        });

        const response = await fetch(`/api/notes?${params.toString()}`);
        
        if (!response.ok) {
          throw new Error(`API请求失败: ${response.status} ${response.statusText}`);
        }
        
        const result = await response.json();

        if (!result.success) {
          throw new Error(result.error || '获取数据失败');
        }

        return {
          list: result.data.list || [],
          total: result.data.total || 0,
        };
      });

      console.log(`总共获取到 ${allNotes.length} 条笔记不可见记录`);

      if (allNotes.length === 0) {
        message.warning('暂无笔记不可见记录可导出');
        return;
      }

      const exportData = formatNoContentNotesExportData(allNotes);
      const timestamp = generateTimestamp();
      const filename = `笔记不可见列表_${timestamp}.xlsx`;

      await exportToExcel(exportData, '笔记不可见列表', filename);
      
      message.success(`导出成功，共 ${allNotes.length} 条记录`);
    } catch (error) {
      console.error('导出失败 - 详细错误:', error);
      const errorMsg = error instanceof Error ? error.message : '未知错误';
      message.error(`导出失败: ${errorMsg}`);
    } finally {
      setExportingNoteInvalid(false);
      console.log('导出流程结束');
    }
  };

  return {
    exporting,
    exportingNoContent,
    exportingNoteInvalid,
    handleExport,
    handleExportNoContent,
    handleExportNoteInvalid,
  };
}

