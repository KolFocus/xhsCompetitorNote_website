import { NextRequest, NextResponse } from 'next/server';

// 媒体资源检测结果接口
interface MediaCheckResult {
  type: 'image' | 'video';
  url: string;
  status: 'success' | 'failed';
  size: number | null;
  sizeFormatted: string | null;
  contentType: string | null;
  error: string | null;
}

// 格式化字节大小
function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// 检测单个媒体资源
async function checkMediaUrl(url: string, type: 'image' | 'video'): Promise<MediaCheckResult> {
  try {
    // 创建 AbortController 用于超时控制
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000); // 10秒超时

    const response = await fetch(url, {
      method: 'HEAD',
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': type === 'image' ? 'image/*' : 'video/*',
      },
    });

    clearTimeout(timeout);

    // 检查响应状态
    if (!response.ok) {
      return {
        type,
        url,
        status: 'failed',
        size: null,
        sizeFormatted: null,
        contentType: null,
        error: `${response.status} ${response.statusText}`,
      };
    }

    // 获取资源信息
    const contentLength = response.headers.get('content-length');
    const contentType = response.headers.get('content-type');
    const size = contentLength ? parseInt(contentLength, 10) : null;

    return {
      type,
      url,
      status: 'success',
      size,
      sizeFormatted: size ? formatBytes(size) : null,
      contentType,
      error: null,
    };
  } catch (error: any) {
    // 处理各种错误
    let errorMessage = '请求失败';
    
    if (error.name === 'AbortError') {
      errorMessage = '请求超时';
    } else if (error.message) {
      errorMessage = error.message;
    }

    return {
      type,
      url,
      status: 'failed',
      size: null,
      sizeFormatted: null,
      contentType: null,
      error: errorMessage,
    };
  }
}

// 并发限制函数
async function checkMediaUrlsWithLimit(
  urls: string[],
  type: 'image' | 'video',
  concurrency: number = 5
): Promise<MediaCheckResult[]> {
  const results: MediaCheckResult[] = [];
  const executing: Promise<void>[] = [];

  for (const url of urls) {
    const promise = checkMediaUrl(url, type).then((result) => {
      results.push(result);
    });

    executing.push(promise);

    if (executing.length >= concurrency) {
      await Promise.race(executing);
      executing.splice(
        executing.findIndex((p) => p === promise),
        1
      );
    }
  }

  await Promise.all(executing);
  return results;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { noteId, noteTitle, images = [], videos = [] } = body;

    // 验证参数
    if (!noteId) {
      return NextResponse.json(
        { success: false, error: '缺少笔记ID' },
        { status: 400 }
      );
    }

    if (!Array.isArray(images) || !Array.isArray(videos)) {
      return NextResponse.json(
        { success: false, error: '参数格式错误' },
        { status: 400 }
      );
    }

    if (images.length === 0 && videos.length === 0) {
      return NextResponse.json(
        { success: false, error: '没有需要检测的媒体资源' },
        { status: 400 }
      );
    }

    // 并发检测所有资源
    const [imageResults, videoResults] = await Promise.all([
      images.length > 0 ? checkMediaUrlsWithLimit(images, 'image', 5) : Promise.resolve([]),
      videos.length > 0 ? checkMediaUrlsWithLimit(videos, 'video', 5) : Promise.resolve([]),
    ]);

    // 合并结果
    const allResults = [...imageResults, ...videoResults];

    // 计算统计信息
    const successCount = allResults.filter((r) => r.status === 'success').length;
    const failedCount = allResults.filter((r) => r.status === 'failed').length;
    const totalSize = allResults
      .filter((r) => r.size !== null)
      .reduce((sum, r) => sum + (r.size || 0), 0);

    const summary = {
      totalCount: allResults.length,
      successCount,
      failedCount,
      totalSize,
      totalSizeFormatted: totalSize > 0 ? formatBytes(totalSize) : null,
    };

    return NextResponse.json({
      success: true,
      data: {
        noteId,
        noteTitle: noteTitle || '未知笔记',
        results: allResults,
        summary,
      },
    });
  } catch (error) {
    console.error('检测媒体资源失败:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : '检测失败，请重试' 
      },
      { status: 500 }
    );
  }
}

