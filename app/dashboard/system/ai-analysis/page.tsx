'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  Card,
  Row,
  Col,
  Statistic,
  Button,
  Radio,
  Switch,
  Space,
  message,
  Modal,
  Spin,
  Typography,
  Divider,
  Dropdown,
  Table,
  Tag,
  Select,
  Popconfirm,
  Pagination,
  Input,
} from 'antd';
import type { MenuProps } from 'antd';
import {
  RobotOutlined,
  ReloadOutlined,
  ExclamationCircleOutlined,
  DownloadOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  MoreOutlined,
  RedoOutlined,
  EyeOutlined,
  LinkOutlined,
  SaveOutlined,
  FileImageOutlined,
  VideoCameraOutlined,
  WarningOutlined,
} from '@ant-design/icons';
import type { RadioChangeEvent } from 'antd';

const { Title, Text } = Typography;

interface AiStats {
  pending: number;
  processing: number;
  failed: number;
  noContent: number;
  noteInvalid: number;
  total: number;
}

interface SystemConfig {
  config_id: string;
  config_key: string;
  config_value: string;
  config_desc: string | null;
}

interface FailedNote {
  NoteId: string;
  XhsNoteId: string | null;
  Title: string;
  AiStatus: string;
  AiErr: string;
  AiErrType: string | null;
  PublishTime: string;
  BloggerNickName: string;
  BrandName: string | null;
  XhsNoteLink: string | null;
  XhsUserId: string | null;
  XhsImages: string | null;
  XhsVideo: string | null;
}

export default function AiAnalysisPage() {
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState<AiStats | null>(null);
  const [aiModel, setAiModel] = useState<string>('gemini-2.5-flash');
  const [aiProvider, setAiProvider] = useState<string>('chatai'); // AI提供商
  const [openrouterApiKey, setOpenrouterApiKey] = useState<string>(''); // OpenRouter API Key
  const [aiEnabled, setAiEnabled] = useState<boolean>(true);
  const [exporting, setExporting] = useState(false);
  const [exportingNoContent, setExportingNoContent] = useState(false);
  const [exportingNoteInvalid, setExportingNoteInvalid] = useState(false);
  const [countdown, setCountdown] = useState(60);
  
  // 失败列表弹窗相关状态
  const [failedModalVisible, setFailedModalVisible] = useState(false);
  const [failedNotes, setFailedNotes] = useState<FailedNote[]>([]);
  const [loadingFailedNotes, setLoadingFailedNotes] = useState(false);
  const [failedNotesPage, setFailedNotesPage] = useState(1);
  const [failedNotesTotal, setFailedNotesTotal] = useState(0);
  const [failedFilterBrand, setFailedFilterBrand] = useState<string>('');
  const [failedFilterErrType, setFailedFilterErrType] = useState<string>('');
  const [brandList, setBrandList] = useState<Array<{ BrandId: string; BrandName: string }>>([]);

  // 媒体检测相关状态
  const [checkingNoteId, setCheckingNoteId] = useState<string | null>(null);
  const [mediaCheckResult, setMediaCheckResult] = useState<any>(null);
  const [mediaCheckModalVisible, setMediaCheckModalVisible] = useState(false);

  // 加载统计数据
  const loadStats = useCallback(async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/system/ai-stats');
      const data = await response.json();

      if (data.success) {
        setStats(data.data);
      } else {
        message.error(data.error || '加载统计数据失败');
      }
    } catch (error) {
      console.error('加载统计数据失败:', error);
      message.error('加载统计数据失败');
    } finally {
      setLoading(false);
    }
  }, []);

  // 加载配置
  const loadConfig = async () => {
    try {
      const response = await fetch('/api/system/ai-config');
      const data = await response.json();

      if (data.success) {
        const configs: SystemConfig[] = data.data;
        
        const modelConfig = configs.find((c) => c.config_key === 'ai_model');
        if (modelConfig) {
          setAiModel(modelConfig.config_value);
        }

        const providerConfig = configs.find((c) => c.config_key === 'ai_provider');
        if (providerConfig) {
          setAiProvider(providerConfig.config_value || 'chatai');
        }

        const apiKeyConfig = configs.find((c) => c.config_key === 'openrouter_api_key');
        if (apiKeyConfig) {
          setOpenrouterApiKey(apiKeyConfig.config_value || '');
        }

        const enabledConfig = configs.find((c) => c.config_key === 'ai_analysis_enabled');
        if (enabledConfig) {
          setAiEnabled(enabledConfig.config_value === 'true');
        }
      } else {
        message.error(data.error || '加载配置失败');
      }
    } catch (error) {
      console.error('加载配置失败:', error);
      message.error('加载配置失败');
    }
  };

  useEffect(() => {
    loadStats();
    loadConfig();
  }, []);

  // 自动刷新和倒计时
  useEffect(() => {
    // 倒计时定时器
    const countdownTimer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          // 倒计时到0时，刷新数据并重置倒计时
          loadStats();
          return 60;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      clearInterval(countdownTimer);
    };
  }, [loadStats]);

  // 手动刷新
  const handleRefresh = () => {
    loadStats();
    setCountdown(60); // 重置倒计时
  };

  // 重置状态
  const handleReset = (status: string, statusLabel: string) => {
    Modal.confirm({
      title: `确认重置"${statusLabel}"状态？`,
      icon: <ExclamationCircleOutlined />,
      content: `此操作将把所有"${statusLabel}"的笔记重置为"待分析"状态，下次调度时会重新分析。`,
      okText: '确认重置',
      okType: 'danger',
      cancelText: '取消',
      onOk: async () => {
        try {
          const response = await fetch('/api/system/ai-reset', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status }),
          });

          const data = await response.json();

          if (data.success) {
            message.success(data.data.message);
            loadStats(); // 重新加载统计
          } else {
            message.error(data.error || '重置失败');
          }
        } catch (error) {
          console.error('重置失败:', error);
          message.error('重置失败');
        }
      },
    });
  };

  // 导出失败列表
  const handleExport = async () => {
    if (exporting) {
      console.log('正在导出中，请稍候...');
      return;
    }
    
    try {
      setExporting(true);
      console.log('开始导出失败列表...');

      // 分页获取所有失败记录
      const allNotes: FailedNote[] = [];
      let page = 1;
      const pageSize = 100; // API 限制最大 100
      let hasMore = true;

      while (hasMore) {
        const params = new URLSearchParams({
          aiStatus: '分析失败',
          page: String(page),
          pageSize: String(pageSize),
        });

        console.log(`请求第 ${page} 页数据:`, `/api/system/ai-analysis?${params.toString()}`);
        const response = await fetch(`/api/system/ai-analysis?${params.toString()}`);
        
        if (!response.ok) {
          throw new Error(`API请求失败: ${response.status} ${response.statusText}`);
        }
        
        const result = await response.json();

        if (!result.success) {
          throw new Error(result.error || '获取数据失败');
        }

        const notes: FailedNote[] = result.data.list || [];
        const total = result.data.total || 0;
        
        console.log(`第 ${page} 页获取到 ${notes.length} 条记录，总共 ${total} 条`);
        
        allNotes.push(...notes);
        
        // 判断是否还有更多数据
        if (allNotes.length >= total || notes.length < pageSize) {
          hasMore = false;
        } else {
          page++;
        }
      }

      console.log(`总共获取到 ${allNotes.length} 条失败记录`);

      if (allNotes.length === 0) {
        message.warning('暂无失败记录可导出');
        return;
      }

      // 动态导入 xlsx
      console.log('开始导入 xlsx 库...');
      const XLSX = await import('xlsx');
      console.log('xlsx 库导入成功');

      // 准备导出数据
      const exportData = allNotes.map((note) => ({
        笔记ID: note.NoteId,
        标题: note.Title || '',
        博主: note.BloggerNickName || '',
        品牌: note.BrandName || '',
        发布时间: note.PublishTime || '',
        错误类型: note.AiErrType || '',
        错误原因: note.AiErr || '',
      }));

      console.log('准备创建工作表...');
      // 创建工作表
      const worksheet = XLSX.utils.json_to_sheet(exportData);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'AI分析失败列表');

      // 生成文件名
      const now = new Date();
      const pad = (n: number) => (n < 10 ? `0${n}` : `${n}`);
      const timestamp = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
      const filename = `AI分析失败列表_${timestamp}.xlsx`;

      console.log('开始下载文件:', filename);
      // 下载文件
      XLSX.writeFile(workbook, filename);
      console.log('文件下载完成');
      
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

  // 加载失败列表
  const loadFailedNotes = async (page: number = 1, brandFilter?: string, errTypeFilter?: string) => {
    try {
      setLoadingFailedNotes(true);
      const params = new URLSearchParams({
        aiStatus: '分析失败',
        page: String(page),
        pageSize: '20',
      });

      // 添加筛选条件
      const brand = brandFilter !== undefined ? brandFilter : failedFilterBrand;
      const errType = errTypeFilter !== undefined ? errTypeFilter : failedFilterErrType;
      
      if (brand && brand.includes('#KF#')) {
        // 分割 BrandId#KF#BrandName
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

      setFailedNotes(result.data.list || []);
      setFailedNotesTotal(result.data.total || 0);
      setFailedNotesPage(page);
    } catch (error) {
      console.error('加载失败列表失败:', error);
      const errorMsg = error instanceof Error ? error.message : '未知错误';
      message.error(`加载失败: ${errorMsg}`);
    } finally {
      setLoadingFailedNotes(false);
    }
  };

  // 打开失败列表弹窗
  const handleViewFailedList = () => {
    setFailedModalVisible(true);
    setFailedFilterBrand('');
    setFailedFilterErrType('');
    loadBrandList();
    loadFailedNotes(1, '', '');
  };

  // 筛选条件变化
  const handleFilterChange = () => {
    loadFailedNotes(1);
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
        loadFailedNotes(failedNotesPage); // 重新加载当前页
        loadStats(); // 更新统计数据
      } else {
        message.error(data.error || '重置失败');
      }
    } catch (error) {
      console.error('重置失败:', error);
      message.error('重置失败');
    }
  };

  // 检测媒体资源
  const handleCheckMedia = async (record: FailedNote) => {
    // 解析媒体资源
    const images = record.XhsImages 
      ? record.XhsImages.split(',').map(url => url.trim()).filter(Boolean)
      : [];
    const videos = record.XhsVideo 
      ? [record.XhsVideo.trim()]
      : [];

    // 检查是否有媒体资源
    if (images.length === 0 && videos.length === 0) {
      message.warning('该笔记没有媒体资源');
      return;
    }

    try {
      setCheckingNoteId(record.NoteId);
      const loadingMsg = message.loading({ 
        content: '正在检测媒体资源...', 
        key: 'checking',
        duration: 0
      });

      const response = await fetch('/api/notes/check-media', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          noteId: record.NoteId,
          noteTitle: record.Title,
          images,
          videos
        })
      });

      const result = await response.json();

      if (result.success) {
        const { summary } = result.data;
        message.success({ 
          content: `检测完成：${summary.successCount}个正常，${summary.failedCount}个失效`, 
          key: 'checking',
          duration: 3
        });
        setMediaCheckResult(result.data);
        setMediaCheckModalVisible(true);
      } else {
        message.error({ 
          content: result.error || '检测失败', 
          key: 'checking' 
        });
      }

    } catch (error) {
      message.error({ 
        content: '检测失败，请重试', 
        key: 'checking' 
      });
      console.error('检测媒体资源失败:', error);
    } finally {
      setCheckingNoteId(null);
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

      // 分页获取所有无内容记录
      const allNotes: FailedNote[] = [];
      let page = 1;
      const pageSize = 100; // API 限制最大 100
      let hasMore = true;

      while (hasMore) {
        // 使用 /api/notes 接口，通过 showMissingContent 参数查询 XhsNoteLink 为空的记录
        // 这与统计条件一致：统计使用的是 XhsNoteLink 为空，而不是 AiStatus = '无内容'
        const params = new URLSearchParams({
          showMissingContent: 'true',
          page: String(page),
          pageSize: String(pageSize),
        });

        console.log(`请求第 ${page} 页数据:`, `/api/notes?${params.toString()}`);
        const response = await fetch(`/api/notes?${params.toString()}`);
        
        if (!response.ok) {
          throw new Error(`API请求失败: ${response.status} ${response.statusText}`);
        }
        
        const result = await response.json();

        if (!result.success) {
          throw new Error(result.error || '获取数据失败');
        }

        const notes: FailedNote[] = result.data.list || [];
        const total = result.data.total || 0;
        
        console.log(`第 ${page} 页获取到 ${notes.length} 条记录，总共 ${total} 条`);
        
        allNotes.push(...notes);
        
        // 判断是否还有更多数据
        if (allNotes.length >= total || notes.length < pageSize) {
          hasMore = false;
        } else {
          page++;
        }
      }

      console.log(`总共获取到 ${allNotes.length} 条笔记详情缺失记录`);

      if (allNotes.length === 0) {
        message.warning('暂无笔记详情缺失记录可导出');
        return;
      }

      // 动态导入 xlsx
      console.log('开始导入 xlsx 库...');
      const XLSX = await import('xlsx');
      console.log('xlsx 库导入成功');

      // 准备导出数据
      const exportData = allNotes.map((note) => ({
        笔记ID: note.XhsNoteId || note.NoteId || '', // 优先使用 XhsNoteId，如果没有则使用 NoteId
        标题: note.Title || '',
        博主: note.BloggerNickName || '',
        品牌: note.BrandName || '',
        发布时间: note.PublishTime || '',
      }));

      console.log('准备创建工作表...');
      // 创建工作表
      const worksheet = XLSX.utils.json_to_sheet(exportData);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, '笔记详情缺失列表');

      // 生成文件名
      const now = new Date();
      const pad = (n: number) => (n < 10 ? `0${n}` : `${n}`);
      const timestamp = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
      const filename = `笔记详情缺失列表_${timestamp}.xlsx`;

      console.log('开始下载文件:', filename);
      // 下载文件
      XLSX.writeFile(workbook, filename);
      console.log('文件下载完成');
      
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

      // 分页获取所有不可见记录
      const allNotes: FailedNote[] = [];
      let page = 1;
      const pageSize = 100; // API 限制最大 100
      let hasMore = true;

      while (hasMore) {
        // 使用 /api/notes 接口，通过 showNoteInvalid 参数查询 XhsNoteInvalid = true 的记录
        const params = new URLSearchParams({
          showNoteInvalid: 'true',
          page: String(page),
          pageSize: String(pageSize),
        });

        console.log(`请求第 ${page} 页数据:`, `/api/notes?${params.toString()}`);
        const response = await fetch(`/api/notes?${params.toString()}`);
        
        if (!response.ok) {
          throw new Error(`API请求失败: ${response.status} ${response.statusText}`);
        }
        
        const result = await response.json();

        if (!result.success) {
          throw new Error(result.error || '获取数据失败');
        }

        const notes: FailedNote[] = result.data.list || [];
        const total = result.data.total || 0;
        
        console.log(`第 ${page} 页获取到 ${notes.length} 条记录，总共 ${total} 条`);
        
        allNotes.push(...notes);
        
        // 判断是否还有更多数据
        if (allNotes.length >= total || notes.length < pageSize) {
          hasMore = false;
        } else {
          page++;
        }
      }

      console.log(`总共获取到 ${allNotes.length} 条笔记不可见记录`);

      if (allNotes.length === 0) {
        message.warning('暂无笔记不可见记录可导出');
        return;
      }

      // 动态导入 xlsx
      console.log('开始导入 xlsx 库...');
      const XLSX = await import('xlsx');
      console.log('xlsx 库导入成功');

      // 准备导出数据
      const exportData = allNotes.map((note) => ({
        笔记ID: note.XhsNoteId || note.NoteId || '', // 优先使用 XhsNoteId，如果没有则使用 NoteId
        标题: note.Title || '',
        博主: note.BloggerNickName || '',
        品牌: note.BrandName || '',
        发布时间: note.PublishTime || '',
      }));

      console.log('准备创建工作表...');
      // 创建工作表
      const worksheet = XLSX.utils.json_to_sheet(exportData);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, '笔记不可见列表');

      // 生成文件名
      const now = new Date();
      const pad = (n: number) => (n < 10 ? `0${n}` : `${n}`);
      const timestamp = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
      const filename = `笔记不可见列表_${timestamp}.xlsx`;

      console.log('开始下载文件:', filename);
      // 下载文件
      XLSX.writeFile(workbook, filename);
      console.log('文件下载完成');
      
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

  // 更新模型配置
  const handleModelChange = (e: RadioChangeEvent) => {
    const newModel = e.target.value;

    Modal.confirm({
      title: '确认切换AI模型？',
      icon: <ExclamationCircleOutlined />,
      content: `即将切换到 ${newModel}，新的分析任务将使用此模型。`,
      okText: '确认切换',
      cancelText: '取消',
      onOk: async () => {
        try {
          const response = await fetch('/api/system/ai-config', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              config_key: 'ai_model',
              config_value: newModel,
            }),
          });

          const data = await response.json();

          if (data.success) {
            setAiModel(newModel);
            message.success('模型切换成功');
          } else {
            message.error(data.error || '切换失败');
          }
        } catch (error) {
          console.error('切换模型失败:', error);
          message.error('切换模型失败');
        }
      },
      onCancel: () => {
        // 取消时恢复原值
        setAiModel(aiModel);
      },
    });
  };

  // 更新提供商配置
  const handleProviderChange = (e: RadioChangeEvent) => {
    const newProvider = e.target.value;

    // 如果切换到 OpenRouter 但未配置 API Key，先切换显示配置区域，然后提示
    if (newProvider === 'openrouter' && !openrouterApiKey) {
      setAiProvider(newProvider); // 先切换，让配置区域显示
      message.warning({
        content: '请先在下方配置 OpenRouter API Key，保存后才能使用',
        duration: 5,
      });
      return;
    }

    Modal.confirm({
      title: '确认切换AI提供商？',
      icon: <ExclamationCircleOutlined />,
      content: `即将切换到 ${newProvider === 'chatai' ? 'ChatAI (淘宝商家)' : 'OpenRouter (多渠道)'}，新的分析任务将使用此提供商。`,
      okText: '确认切换',
      cancelText: '取消',
      onOk: async () => {
        try {
          const response = await fetch('/api/system/ai-config', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              config_key: 'ai_provider',
              config_value: newProvider,
            }),
          });

          const data = await response.json();

          if (data.success) {
            setAiProvider(newProvider);
            message.success('提供商切换成功');
          } else {
            message.error(data.error || '切换失败');
          }
        } catch (error) {
          console.error('切换提供商失败:', error);
          message.error('切换提供商失败');
        }
      },
      onCancel: () => {
        // 取消时恢复原值
        setAiProvider(aiProvider);
      },
    });
  };

  // 更新 OpenRouter API Key
  const handleApiKeySave = async () => {
    if (!openrouterApiKey.trim()) {
      message.warning('请输入 OpenRouter API Key');
      return;
    }

    // 验证 API Key 格式
    if (!openrouterApiKey.trim().startsWith('sk-or-v1-')) {
      message.warning('API Key 格式不正确，应以 sk-or-v1- 开头');
      return;
    }

    try {
      const response = await fetch('/api/system/ai-config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          config_key: 'openrouter_api_key',
          config_value: openrouterApiKey.trim(),
        }),
      });

      const data = await response.json();

      if (data.success) {
        message.success('OpenRouter API Key 保存成功');
        
        // 如果当前选择的是 OpenRouter，询问是否正式切换
        if (aiProvider === 'openrouter') {
          Modal.confirm({
            title: '确认切换到 OpenRouter？',
            icon: <ExclamationCircleOutlined />,
            content: 'API Key 已保存，是否现在正式切换到 OpenRouter 提供商？',
            okText: '确认切换',
            cancelText: '暂不切换',
            onOk: async () => {
              try {
                const switchResponse = await fetch('/api/system/ai-config', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    config_key: 'ai_provider',
                    config_value: 'openrouter',
                  }),
                });

                const switchData = await switchResponse.json();

                if (switchData.success) {
                  message.success('已切换到 OpenRouter 提供商');
                } else {
                  message.error(switchData.error || '切换失败');
                }
              } catch (error) {
                console.error('切换提供商失败:', error);
                message.error('切换提供商失败');
              }
            },
          });
        }
      } else {
        message.error(data.error || '保存失败');
      }
    } catch (error) {
      console.error('保存 API Key 失败:', error);
      message.error('保存失败');
    }
  };

  // 切换总开关
  const handleToggle = (checked: boolean) => {
    Modal.confirm({
      title: checked ? '确认启动AI分析？' : '确认停止AI分析？',
      icon: <ExclamationCircleOutlined />,
      content: checked
        ? '启动后，调度器将继续处理待分析的笔记。'
        : '停止后，调度器将不再启动新的分析任务（正在运行的任务不受影响）。',
      okText: '确认',
      cancelText: '取消',
      onOk: async () => {
        try {
          const response = await fetch('/api/system/ai-config', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              config_key: 'ai_analysis_enabled',
              config_value: String(checked),
            }),
          });

          const data = await response.json();

          if (data.success) {
            setAiEnabled(checked);
            message.success(checked ? 'AI分析已启动' : 'AI分析已停止');
          } else {
            message.error(data.error || '操作失败');
          }
        } catch (error) {
          console.error('切换开关失败:', error);
          message.error('操作失败');
        }
      },
      onCancel: () => {
        // 取消时恢复原值
        setAiEnabled(aiEnabled);
      },
    });
  };

  return (
    <div style={{ padding: 24 }}>
      <Title level={2}>
        <RobotOutlined /> AI 分析管理
      </Title>

      <Spin spinning={loading}>
        {/* 统计数据 */}
        <Card
          title="当前分析情况"
          extra={
            <Button icon={<ReloadOutlined />} onClick={handleRefresh} loading={loading}>
              刷新 ({countdown}s)
            </Button>
          }
          style={{ marginBottom: 24 }}
        >
          <Row gutter={[16, 16]}>
            <Col xs={24} sm={12} md={6}>
              <Card>
                <Statistic
                  title="待分析"
                  value={stats?.pending || 0}
                  valueStyle={{ color: '#1890ff' }}
                />
              </Card>
            </Col>

            <Col xs={24} sm={12} md={6}>
              <Card>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <Statistic
                    title="分析中"
                    value={stats?.processing || 0}
                    valueStyle={{ color: '#faad14' }}
                  />
                  <Dropdown
                    menu={{
                      items: [
                        {
                          key: 'reset',
                          label: '重置状态',
                          icon: <RedoOutlined />,
                        },
                      ],
                      onClick: () => handleReset('分析中', '分析中'),
                    }}
                    placement="bottomRight"
                  >
                    <Button
                      type="default"
                      size="small"
                      icon={<MoreOutlined />}
                    />
                  </Dropdown>
                </div>
              </Card>
            </Col>

            <Col xs={24} sm={12} md={6}>
              <Card>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <Statistic
                    title="分析失败"
                    value={stats?.failed || 0}
                    valueStyle={{ color: '#ff4d4f' }}
                  />
                  <Dropdown
                    menu={{
                      items: [
                        {
                          key: 'view',
                          label: '查看列表',
                          icon: <EyeOutlined />,
                        },
                        {
                          key: 'reset',
                          label: '重置状态',
                          icon: <RedoOutlined />,
                        },
                        {
                          key: 'export',
                          label: '导出列表',
                          icon: <DownloadOutlined />,
                          disabled: exporting,
                        },
                      ],
                      onClick: ({ key }) => {
                        if (key === 'view') {
                          handleViewFailedList();
                        } else if (key === 'reset') {
                          handleReset('分析失败', '分析失败');
                        } else if (key === 'export') {
                          handleExport();
                        }
                      },
                    }}
                    placement="bottomRight"
                  >
                    <Button
                      type="default"
                      size="small"
                      icon={<MoreOutlined />}
                      loading={exporting}
                    />
                  </Dropdown>
                </div>
              </Card>
            </Col>

            <Col xs={24} sm={12} md={6}>
              <Card>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <Statistic
                    title="笔记详情缺失"
                    value={stats?.noContent || 0}
                    valueStyle={{ color: '#8c8c8c' }}
                  />
                  <Dropdown
                    menu={{
                      items: [
                        {
                          key: 'export',
                          label: '导出列表',
                          icon: <DownloadOutlined />,
                          disabled: exportingNoContent,
                        },
                      ],
                      onClick: ({ key }) => {
                        if (key === 'export') {
                          handleExportNoContent();
                        }
                      },
                    }}
                    placement="bottomRight"
                  >
                    <Button
                      type="default"
                      size="small"
                      icon={<MoreOutlined />}
                      loading={exportingNoContent}
                    />
                  </Dropdown>
                </div>
              </Card>
            </Col>

            <Col xs={24} sm={12} md={6}>
              <Card>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <Statistic
                    title="笔记不可见"
                    value={stats?.noteInvalid || 0}
                    valueStyle={{ color: '#d4380d' }}
                    suffix={
                      <Text type="secondary" style={{ fontSize: 12 }}>
                        (已删除/下架)
                      </Text>
                    }
                  />
                  <Dropdown
                    menu={{
                      items: [
                        {
                          key: 'export',
                          label: '导出列表',
                          icon: <DownloadOutlined />,
                          disabled: exportingNoteInvalid,
                        },
                      ],
                      onClick: ({ key }) => {
                        if (key === 'export') {
                          handleExportNoteInvalid();
                        }
                      },
                    }}
                    placement="bottomRight"
                  >
                    <Button
                      type="default"
                      size="small"
                      icon={<MoreOutlined />}
                      loading={exportingNoteInvalid}
                    />
                  </Dropdown>
                </div>
              </Card>
            </Col>
          </Row>
        </Card>

        {/* AI提供商配置 */}
        <Card title="AI提供商配置" style={{ marginBottom: 24 }}>
          <Space direction="vertical" size="large" style={{ width: '100%' }}>
            <div>
              <Text strong style={{ marginRight: 16 }}>
                当前使用提供商：
              </Text>
              <Radio.Group value={aiProvider} onChange={handleProviderChange}>
                <Space direction="vertical">
                  <Radio value="chatai">ChatAI (淘宝商家)</Radio>
                  <Radio value="openrouter">OpenRouter (多渠道)</Radio>
                </Space>
              </Radio.Group>
            </div>

            {/* 当选择 OpenRouter 时显示 API Key 配置 */}
            {aiProvider === 'openrouter' && (
              <div style={{ 
                paddingLeft: 24, 
                borderLeft: '3px solid #1890ff',
                backgroundColor: '#f0f5ff',
                padding: 16,
                borderRadius: 4,
              }}>
                <Space direction="vertical" style={{ width: '100%' }}>
                  <div>
                    <Text strong>OpenRouter API Key 配置：</Text>
                    {!openrouterApiKey && (
                      <Tag color="warning" style={{ marginLeft: 8 }}>需要配置</Tag>
                    )}
                    {openrouterApiKey && (
                      <Tag color="success" style={{ marginLeft: 8 }}>已配置</Tag>
                    )}
                  </div>
                  <Space.Compact style={{ width: '100%', maxWidth: 600 }}>
                    <Input.Password
                      placeholder="sk-or-v1-xxx"
                      value={openrouterApiKey}
                      onChange={(e) => setOpenrouterApiKey(e.target.value)}
                      autoComplete="off"
                    />
                    <Button
                      type="primary"
                      icon={<SaveOutlined />}
                      onClick={handleApiKeySave}
                    >
                      保存并启用
                    </Button>
                  </Space.Compact>
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    • API Key 格式：sk-or-v1-xxx
                    <br />
                    • 保存后将自动切换到 OpenRouter 提供商
                    <br />
                    • 获取 API Key：<a href="https://openrouter.ai/keys" target="_blank" rel="noopener noreferrer">https://openrouter.ai/keys</a>
                  </Text>
                </Space>
              </div>
            )}
          </Space>
        </Card>

        {/* AI模型配置 */}
        <Card title="AI模型配置" style={{ marginBottom: 24 }}>
          <Text strong style={{ marginRight: 16 }}>
            当前使用模型：
          </Text>
          <Radio.Group value={aiModel} onChange={handleModelChange}>
            <Space direction="vertical">
              <Radio value="gemini-2.0-flash">gemini-2.0-flash</Radio>
              <Radio value="gemini-2.5-flash">gemini-2.5-flash (推荐)</Radio>
              <Radio value="gemini-2.5-pro">gemini-2.5-pro</Radio>
            </Space>
          </Radio.Group>
        </Card>

        {/* AI分析控制 */}
        <Card title="AI分析控制">
          <Space direction="vertical" size="large" style={{ width: '100%' }}>
            <div>
              <Space align="center">
                <Text strong>分析状态：</Text>
                <Switch
                  checked={aiEnabled}
                  onChange={handleToggle}
                  checkedChildren={<CheckCircleOutlined />}
                  unCheckedChildren={<CloseCircleOutlined />}
                />
                <Text type={aiEnabled ? 'success' : 'danger'}>
                  {aiEnabled ? '运行中' : '已停止'}
                </Text>
              </Space>
            </div>

            <Divider style={{ margin: '12px 0' }} />

            <Text type="secondary">
              {aiEnabled
                ? '• 调度器正在运行，会自动处理待分析的笔记'
                : '• 调度器已停止，不会启动新的分析任务（正在运行的任务不受影响）'}
            </Text>
          </Space>
        </Card>
      </Spin>

      {/* 失败列表弹窗 */}
      <Modal
        title="AI分析失败列表"
        open={failedModalVisible}
        onCancel={() => setFailedModalVisible(false)}
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
            value={failedFilterBrand || undefined}
            onChange={(value) => {
              setFailedFilterBrand(value || '');
              loadFailedNotes(1, value || '', undefined);
            }}
            options={[
              ...brandList.map((brand) => ({
                label: brand.BrandName,
                value: `${brand.BrandId}#KF#${brand.BrandName}`,
              })),
            ]}
          />
            <Text>错误类型：</Text>
            <Select
              style={{ width: 150 }}
              placeholder="请选择错误类型"
              allowClear
              value={failedFilterErrType || undefined}
              onChange={(value) => {
                setFailedFilterErrType(value || '');
                loadFailedNotes(1, undefined, value || '');
              }}
              options={[
                { label: '媒体过期', value: 'MediaExpired' },
                { label: '渠道封禁', value: 'ChannelBlocked' },
                { label: '无可用渠道', value: 'NoChannel' },
                { label: '敏感内容', value: 'SensitiveContent' },
                { label: '解析错误', value: 'ParseError' },
                { label: '网络错误', value: 'NetworkError' },
                { label: '内容为空', value: 'ContentEmpty' },
                { label: '未知错误', value: 'Unknown' },
              ]}
            />
          </Space>
          <Button
            icon={<ReloadOutlined />}
            onClick={() => loadFailedNotes(failedNotesPage)}
            loading={loadingFailedNotes}
          >
            刷新列表
          </Button>
        </div>

        {/* 表格内容区域 */}
        <div style={{ flex: 1, overflow: 'auto', padding: '0 24px', minHeight: 0 }}>
          <Table
            dataSource={failedNotes}
            loading={loadingFailedNotes}
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
                // 如果有笔记链接，显示为链接
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
                // 没有链接时，显示标题或 '-'
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
                // 如果有用户ID，显示为链接
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
                // 没有用户ID时，显示昵称或 '-'
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
            <Table.Column
              title="错误类型"
              dataIndex="AiErrType"
              key="AiErrType"
              width={120}
              render={(errType) => {
                if (!errType) return '-';
                
                // 根据错误类型显示不同颜色的标签
                const colorMap: Record<string, string> = {
                  MediaExpired: 'orange',
                  ChannelBlocked: 'red',
                  NoChannel: 'volcano',
                  SensitiveContent: 'purple',
                  ParseError: 'magenta',
                  NetworkError: 'blue',
                  ContentEmpty: 'default',
                  Unknown: 'default',
                };
                
                const labelMap: Record<string, string> = {
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
                  <Tag color={colorMap[errType] || 'default'}>
                    {labelMap[errType] || errType}
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
                    loading={checkingNoteId === record.NoteId}
                    onClick={() => handleCheckMedia(record)}
                  >
                    检测资源
                  </Button>
                  <Popconfirm
                    title="确认重置状态？"
                    description='将此笔记重置为"待分析"状态'
                    onConfirm={() => handleResetSingleNote(record.NoteId)}
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
            current={failedNotesPage}
            pageSize={20}
            total={failedNotesTotal}
            showSizeChanger={false}
            showTotal={(total) => `共 ${total} 条记录`}
            onChange={(page) => loadFailedNotes(page)}
          />
        </div>
      </Modal>

      {/* 媒体检测结果弹窗 */}
      <Modal
        title={
          <Space>
            <LinkOutlined style={{ color: '#1890ff' }} />
            <span>媒体资源检测报告</span>
          </Space>
        }
        open={mediaCheckModalVisible}
        onCancel={() => setMediaCheckModalVisible(false)}
        footer={
          <Button type="primary" onClick={() => setMediaCheckModalVisible(false)}>
            关闭
          </Button>
        }
        width={800}
      >
        {mediaCheckResult && (
          <div>
            {/* 笔记信息 */}
            <Card size="small" style={{ marginBottom: 16, background: '#fafafa' }}>
              <Text strong style={{ fontSize: 14 }}>
                {mediaCheckResult.noteTitle}
              </Text>
            </Card>

            {/* 统计卡片 */}
            <Row gutter={16} style={{ marginBottom: 20 }}>
              <Col span={8}>
                <Card size="small" style={{ textAlign: 'center', background: '#e6f7ff', borderColor: '#1890ff' }}>
                  <Statistic
                    title="总资源数"
                    value={mediaCheckResult.summary.totalCount}
                    prefix={<FileImageOutlined style={{ color: '#1890ff' }} />}
                    valueStyle={{ color: '#1890ff', fontSize: 24 }}
                  />
                </Card>
              </Col>
              <Col span={8}>
                <Card size="small" style={{ textAlign: 'center', background: '#f6ffed', borderColor: '#52c41a' }}>
                  <Statistic
                    title="可用资源"
                    value={mediaCheckResult.summary.successCount}
                    prefix={<CheckCircleOutlined style={{ color: '#52c41a' }} />}
                    valueStyle={{ color: '#52c41a', fontSize: 24 }}
                  />
                </Card>
              </Col>
              <Col span={8}>
                <Card size="small" style={{ textAlign: 'center', background: '#fff1f0', borderColor: '#ff4d4f' }}>
                  <Statistic
                    title="失效资源"
                    value={mediaCheckResult.summary.failedCount}
                    prefix={<CloseCircleOutlined style={{ color: '#ff4d4f' }} />}
                    valueStyle={{ color: '#ff4d4f', fontSize: 24 }}
                  />
                </Card>
              </Col>
            </Row>

            {/* 总大小显示 */}
            {mediaCheckResult.summary.totalSizeFormatted && (
              <Card size="small" style={{ marginBottom: 16, background: '#f0f5ff', borderColor: '#adc6ff' }}>
                <Text>
                  <strong>资源总大小：</strong>
                  <Text style={{ fontSize: 16, color: '#1890ff', marginLeft: 8 }}>
                    {mediaCheckResult.summary.totalSizeFormatted}
                  </Text>
                </Text>
              </Card>
            )}

            <Divider orientation="left" style={{ marginTop: 24, marginBottom: 16 }}>资源详情</Divider>

            {/* 详细列表 */}
            <Space direction="vertical" style={{ width: '100%' }} size="middle">
              {/* 正常资源 */}
              {mediaCheckResult.results.filter((r: any) => r.status === 'success').length > 0 && (
                <div>
                  <div style={{ marginBottom: 8 }}>
                    <Tag color="success" icon={<CheckCircleOutlined />}>
                      正常资源 ({mediaCheckResult.results.filter((r: any) => r.status === 'success').length})
                    </Tag>
                  </div>
                  <Space direction="vertical" style={{ width: '100%' }}>
                    {mediaCheckResult.results
                      .filter((r: any) => r.status === 'success')
                      .map((item: any, index: number) => (
                        <Card 
                          key={index}
                          size="small"
                          style={{ 
                            borderLeft: '3px solid #52c41a',
                            background: '#f6ffed'
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

              {/* 失效资源 */}
              {mediaCheckResult.results.filter((r: any) => r.status === 'failed').length > 0 && (
                <div>
                  <div style={{ marginBottom: 8 }}>
                    <Tag color="error" icon={<CloseCircleOutlined />}>
                      失效资源 ({mediaCheckResult.results.filter((r: any) => r.status === 'failed').length})
                    </Tag>
                  </div>
                  <Space direction="vertical" style={{ width: '100%' }}>
                    {mediaCheckResult.results
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
    </div>
  );
}

