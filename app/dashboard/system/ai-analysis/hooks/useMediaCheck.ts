import { useState } from 'react';
import { message, Modal } from 'antd';
import type { FailedNote } from '../types';

interface SensitiveCheckItem {
  imageUrl: string;
  imageId: string;
  status: 'checking' | 'success' | 'sensitive' | 'failed';
  description?: string;
  error?: string;
  isHistorical?: boolean;
}

interface SensitiveCheckResult {
  items: SensitiveCheckItem[];
  summary: {
    total: number;
    checking: number;
    success: number;
    sensitive: number;
    failed: number;
    historical: number;
  };
}

export function useMediaCheck() {
  const [checkingNoteId, setCheckingNoteId] = useState<string | null>(null);
  const [mediaCheckResult, setMediaCheckResult] = useState<any>(null);
  const [mediaCheckModalVisible, setMediaCheckModalVisible] = useState(false);
  const [downloadingMedia, setDownloadingMedia] = useState(false);
  
  // 敏感检测相关状态
  const [checkingSensitive, setCheckingSensitive] = useState(false);
  const [sensitiveCheckResult, setSensitiveCheckResult] = useState<SensitiveCheckResult | null>(null);
  const [currentNoteId, setCurrentNoteId] = useState<string | null>(null);
  const [historicalFilteredIds, setHistoricalFilteredIds] = useState<string[]>([]);

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
      setCurrentNoteId(record.NoteId);
      
      // 解析历史敏感列表
      const historicalIds = record.AiFilterMediaId 
        ? record.AiFilterMediaId.split(',').map(id => id.trim()).filter(Boolean)
        : [];
      setHistoricalFilteredIds(historicalIds);
      
      message.loading({ 
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

  const handleDownloadMedia = () => {
    if (!mediaCheckResult?.results || mediaCheckResult.results.length === 0) {
      message.warning('暂无可下载的媒体资源');
      return;
    }

    const downloadable = mediaCheckResult.results.filter(
      (item: any) => item.status === 'success' && item.url,
    );

    if (downloadable.length === 0) {
      message.warning('没有可下载的有效资源');
      return;
    }

    if (downloadingMedia) {
      message.info('下载任务处理中，请稍候...');
      return;
    }

    setDownloadingMedia(true);

    const getExtensionFromUrl = (url: string) => {
      try {
        const pathname = new URL(url).pathname;
        const match = pathname.match(/\.([a-zA-Z0-9]+)(?:$|[?#])/);
        return match ? `.${match[1]}` : '';
      } catch {
        return '';
      }
    };

    const getExtensionFromContentType = (type?: string) => {
      if (!type) return '';
      const parts = type.split('/');
      if (parts.length === 2) {
        const suffix = parts[1].split('+')[0];
        return `.${suffix}`;
      }
      return '';
    };

    const normalizedTitle =
      mediaCheckResult.noteTitle?.replace(/[\\/:*?"<>|]/g, '_') || 'media';

    (async () => {
      for (let i = 0; i < downloadable.length; i += 1) {
        const item = downloadable[i];
        const extFromUrl = getExtensionFromUrl(item.url);
        const extFromType = getExtensionFromContentType(item.contentType);
        const fallbackExt = item.type === 'image' ? '.jpg' : '.mp4';
        const extension = extFromUrl || extFromType || fallbackExt;
        const fileName = `${normalizedTitle}_${item.type}_${i + 1}${extension}`;

        try {
          const response = await fetch(item.url, { mode: 'cors' });
          if (!response.ok) {
            throw new Error(`下载失败: ${response.status}`);
          }
          const blob = await response.blob();
          const objectUrl = URL.createObjectURL(blob);

          const link = document.createElement('a');
          link.href = objectUrl;
          link.download = fileName;
          link.style.display = 'none';
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);

          URL.revokeObjectURL(objectUrl);

          // 避免浏览器同一时间触发多个保存提示
          await new Promise((resolve) => setTimeout(resolve, 300));
        } catch (error) {
          console.error('下载媒体资源失败:', error);
          message.error(`资源下载失败：${fileName}`);
        }
      }

      message.success('下载完成（如果浏览器提示，请选择允许多文件下载）');
      setDownloadingMedia(false);
    })();
  };

  // 提取图片 ID
  const extractImageId = (imageUrl: string): string | null => {
    try {
      const url = new URL(imageUrl);
      const segments = url.pathname.split('/').filter(Boolean);
      
      if (segments.length >= 2) {
        const last = segments[segments.length - 1];
        const bangIndex = last.indexOf('!');
        const imageId = bangIndex >= 0 ? last.slice(0, bangIndex) : last;
        return imageId;
      }
      
      const match = url.pathname.match(/\/([^\/]+?)(?:!|$)/);
      return match ? match[1] : null;
    } catch {
      return null;
    }
  };

  // 检测敏感内容
  const handleCheckSensitive = async () => {
    if (!mediaCheckResult || !currentNoteId) {
      message.warning('请先检测媒体资源');
      return;
    }

    // 获取有效的图片（success 状态）
    const validImages = mediaCheckResult.results.filter(
      (item: any) => item.type === 'image' && item.status === 'success'
    );

    if (validImages.length === 0) {
      message.warning('没有可检测的有效图片');
      return;
    }

    console.log('song 01', JSON.stringify(historicalFilteredIds));

    // 过滤掉历史已标记的图片
    const imagesToCheck = validImages.filter((item: any) => {
      const imageId = extractImageId(item.url);
      console.log('imageId ', imageId);
      return imageId && !historicalFilteredIds.includes(imageId);
    });

    if (imagesToCheck.length === 0) {
      message.info('所有图片已检测过或已标记为敏感');
      return;
    }

    setCheckingSensitive(true);

    // 初始化检测结果
    const initialItems: SensitiveCheckItem[] = [
      // 历史已标记的图片
      ...validImages
        .filter((item: any) => {
          const imageId = extractImageId(item.url);
          return imageId && historicalFilteredIds.includes(imageId);
        })
        .map((item: any) => ({
          imageUrl: item.url,
          imageId: extractImageId(item.url) || '',
          status: 'success' as const,
          isHistorical: true,
        })),
      // 待检测的图片
      ...imagesToCheck.map((item: any) => ({
        imageUrl: item.url,
        imageId: extractImageId(item.url) || '',
        status: 'checking' as const,
      })),
    ];

    setSensitiveCheckResult({
      items: initialItems,
      summary: {
        total: initialItems.length,
        checking: imagesToCheck.length,
        success: 0,
        sensitive: historicalFilteredIds.length,
        failed: 0,
        historical: historicalFilteredIds.length,
      },
    });

    // 串行检测每个图片
    const newItems = [...initialItems];
    let successCount = 0;
    let sensitiveCount = historicalFilteredIds.length;
    let failedCount = 0;

    for (let i = 0; i < imagesToCheck.length; i += 1) {
      const item = imagesToCheck[i];
      const itemIndex = newItems.findIndex((ni) => ni.imageUrl === item.url);

      try {
        const response = await fetch('/api/system/check-image-sensitive', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            imageUrl: item.url,
            noteId: currentNoteId,
          }),
        });

        const result = await response.json();

        if (result.success && result.data) {
          const { description, isSensitive } = result.data;
          
          if (itemIndex >= 0) {
            newItems[itemIndex] = {
              ...newItems[itemIndex],
              status: isSensitive ? 'sensitive' : 'success',
              description,
            };
          }

          if (isSensitive) {
            sensitiveCount += 1;
          } else {
            successCount += 1;
          }
        } else {
          // 检测失败
          if (itemIndex >= 0) {
            newItems[itemIndex] = {
              ...newItems[itemIndex],
              status: 'failed',
              error: result.error || '检测失败',
            };
          }
          failedCount += 1;
        }
      } catch (error: any) {
        // 网络错误等
        if (itemIndex >= 0) {
          newItems[itemIndex] = {
            ...newItems[itemIndex],
            status: 'failed',
            error: error.message || '检测失败',
          };
        }
        failedCount += 1;
      }

      // 更新进度
      setSensitiveCheckResult({
        items: [...newItems],
        summary: {
          total: newItems.length,
          checking: imagesToCheck.length - i - 1,
          success: successCount,
          sensitive: sensitiveCount,
          failed: failedCount,
          historical: historicalFilteredIds.length,
        },
      });
    }

    // 检测完成
    setSensitiveCheckResult({
      items: newItems,
      summary: {
        total: newItems.length,
        checking: 0,
        success: successCount,
        sensitive: sensitiveCount,
        failed: failedCount,
        historical: historicalFilteredIds.length,
      },
    });

    message.success({
      content: `检测完成：${successCount}个正常，${sensitiveCount}个敏感，${failedCount}个失败`,
      duration: 3,
    });

    setCheckingSensitive(false);
  };

  // 保存敏感标记
  const handleSaveFilteredMedia = async () => {
    if (!sensitiveCheckResult || !currentNoteId) {
      message.warning('没有可保存的结果');
      return;
    }

    // 收集所有敏感图片的 ID
    const sensitiveIds = sensitiveCheckResult.items
      .filter((item) => item.status === 'sensitive' && item.imageId)
      .map((item) => item.imageId);

    if (sensitiveIds.length === 0) {
      message.info('没有敏感图片需要保存');
      return;
    }

    // 合并历史 + 新增，去重
    const allFilteredIds = Array.from(new Set([...historicalFilteredIds, ...sensitiveIds]));

    Modal.confirm({
      title: '确认保存敏感图片标记？',
      content: `新增敏感图片：${sensitiveIds.length} 个\n历史已标记：${historicalFilteredIds.length} 个\n总计：${allFilteredIds.length} 个`,
      okText: '确认保存',
      cancelText: '取消',
      onOk: async () => {
        try {
          const response = await fetch('/api/notes/update-filtered-media', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              noteId: currentNoteId,
              filteredMediaIds: allFilteredIds,
            }),
          });

          const result = await response.json();

          if (result.success) {
            message.success('保存成功');
            // 更新历史列表
            setHistoricalFilteredIds(allFilteredIds);
            // 更新检测结果中的历史标记
            const updatedItems = sensitiveCheckResult.items.map((item) => ({
              ...item,
              isHistorical: item.status === 'sensitive' || item.isHistorical,
            }));
            setSensitiveCheckResult({
              ...sensitiveCheckResult,
              items: updatedItems,
            });
          } else {
            message.error(result.error || '保存失败');
          }
        } catch (error: any) {
          message.error('保存失败，请重试');
          console.error('保存敏感图片标记失败:', error);
        }
      },
    });
  };

  // 重试失败项
  const handleRetryFailed = async () => {
    if (!sensitiveCheckResult || !currentNoteId) {
      return;
    }

    const failedItems = sensitiveCheckResult.items.filter((item) => item.status === 'failed');
    if (failedItems.length === 0) {
      message.info('没有失败项需要重试');
      return;
    }

    setCheckingSensitive(true);

    const newItems = [...sensitiveCheckResult.items];
    let successCount = sensitiveCheckResult.summary.success;
    let sensitiveCount = sensitiveCheckResult.summary.sensitive;
    let failedCount = 0;

    for (const item of failedItems) {
      const itemIndex = newItems.findIndex((ni) => ni.imageUrl === item.imageUrl);

      try {
        const response = await fetch('/api/system/check-image-sensitive', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            imageUrl: item.imageUrl,
            noteId: currentNoteId,
          }),
        });

        const result = await response.json();

        if (result.success && result.data) {
          const { description, isSensitive } = result.data;
          
          if (itemIndex >= 0) {
            newItems[itemIndex] = {
              ...newItems[itemIndex],
              status: isSensitive ? 'sensitive' : 'success',
              description,
              error: undefined,
            };
          }

          if (isSensitive) {
            sensitiveCount += 1;
          } else {
            successCount += 1;
          }
        } else {
          failedCount += 1;
        }
      } catch (error: any) {
        failedCount += 1;
        if (itemIndex >= 0) {
          newItems[itemIndex] = {
            ...newItems[itemIndex],
            error: error.message || '检测失败',
          };
        }
      }
    }

    setSensitiveCheckResult({
      items: newItems,
      summary: {
        ...sensitiveCheckResult.summary,
        checking: 0,
        success: successCount,
        sensitive: sensitiveCount,
        failed: failedCount,
      },
    });

    message.success({
      content: `重试完成：${successCount}个正常，${sensitiveCount}个敏感，${failedCount}个失败`,
      duration: 3,
    });

    setCheckingSensitive(false);
  };

  return {
    checkingNoteId,
    mediaCheckResult,
    mediaCheckModalVisible,
    downloadingMedia,
    checkingSensitive,
    sensitiveCheckResult,
    setMediaCheckModalVisible,
    handleCheckMedia,
    handleDownloadMedia,
    handleCheckSensitive,
    handleSaveFilteredMedia,
    handleRetryFailed,
  };
}

