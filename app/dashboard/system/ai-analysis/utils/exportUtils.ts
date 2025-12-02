import type { FailedNote } from '../types';

/**
 * 生成时间戳字符串
 */
export function generateTimestamp(): string {
  const now = new Date();
  const pad = (n: number) => (n < 10 ? `0${n}` : `${n}`);
  return `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
}

/**
 * 分页获取所有数据
 */
export async function fetchAllPages<T>(
  fetchFn: (page: number, pageSize: number) => Promise<{ list: T[]; total: number }>,
  pageSize: number = 100,
): Promise<T[]> {
  const allItems: T[] = [];
  let page = 1;
  let hasMore = true;

  while (hasMore) {
    const result = await fetchFn(page, pageSize);
    const { list, total } = result;

    allItems.push(...list);

    // 判断是否还有更多数据
    if (allItems.length >= total || list.length < pageSize) {
      hasMore = false;
    } else {
      page++;
    }
  }

  return allItems;
}

/**
 * 导出数据到 Excel
 */
export async function exportToExcel(
  data: any[],
  sheetName: string,
  filename: string,
): Promise<void> {
  if (data.length === 0) {
    throw new Error('没有数据可导出');
  }

  // 动态导入 xlsx
  const XLSX = await import('xlsx');

  // 创建工作表
  const worksheet = XLSX.utils.json_to_sheet(data);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);

  // 下载文件
  XLSX.writeFile(workbook, filename);
}

/**
 * 格式化失败列表导出数据
 */
export function formatFailedNotesExportData(notes: FailedNote[]) {
  return notes.map((note) => ({
    笔记ID: note.NoteId,
    标题: note.Title || '',
    博主: note.BloggerNickName || '',
    品牌: note.BrandName || '',
    发布时间: note.PublishTime || '',
    错误类型: note.AiErrType || '',
    错误原因: note.AiErr || '',
  }));
}

/**
 * 格式化笔记详情缺失列表导出数据
 */
export function formatNoContentNotesExportData(notes: FailedNote[]) {
  return notes.map((note) => ({
    笔记ID: note.XhsNoteId || note.NoteId || '',
    标题: note.Title || '',
    博主: note.BloggerNickName || '',
    品牌: note.BrandName || '',
    发布时间: note.PublishTime || '',
  }));
}

