/**
 * 日期覆盖时间段处理工具函数
 */

export interface DateRange {
  startDate: string; // YYYY-MM-DD
  endDate: string;   // YYYY-MM-DD
}

/**
 * 验证日期格式是否为 YYYY-MM-DD
 */
export function isValidDateFormat(date: string): boolean {
  const regex = /^\d{4}-\d{2}-\d{2}$/;
  if (!regex.test(date)) return false;
  
  const d = new Date(date);
  return d instanceof Date && !isNaN(d.getTime()) && date === d.toISOString().split('T')[0];
}

/**
 * 验证日期段
 */
export function validateDateRange(range: any): range is DateRange {
  if (!range || typeof range !== 'object') return false;
  if (!range.startDate || !range.endDate) return false;
  if (typeof range.startDate !== 'string' || typeof range.endDate !== 'string') return false;
  if (!isValidDateFormat(range.startDate) || !isValidDateFormat(range.endDate)) return false;
  return true;
}

/**
 * 合并重合的日期段
 */
export function mergeDateRanges(ranges: DateRange[]): DateRange[] {
  if (!ranges || ranges.length === 0) return [];
  
  // 1. 过滤无效日期段（startDate > endDate 或格式错误）
  const validRanges = ranges.filter(range => {
    if (!validateDateRange(range)) return false;
    return range.startDate <= range.endDate;
  });
  
  if (validRanges.length === 0) return [];
  
  // 2. 按 startDate 排序
  const sorted = [...validRanges].sort((a, b) => 
    a.startDate.localeCompare(b.startDate)
  );
  
  // 3. 合并重合的区间
  const merged: DateRange[] = [];
  let current = sorted[0];
  
  for (let i = 1; i < sorted.length; i++) {
    const next = sorted[i];
    
    // 判断是否重合：current.endDate >= next.startDate
    if (current.endDate >= next.startDate) {
      // 合并：取更大的 endDate
      current = {
        startDate: current.startDate,
        endDate: current.endDate > next.endDate ? current.endDate : next.endDate
      };
    } else {
      // 不重合，保存当前区间，开始新的区间
      merged.push(current);
      current = next;
    }
  }
  
  // 添加最后一个区间
  merged.push(current);
  
  return merged;
}

/**
 * 解析 DateCoverage
 * 返回 { coverage: DateRange[] | null, hasError: boolean }
 */
export function parseDateCoverage(coverage: any): { coverage: DateRange[] | null; hasError: boolean } {
  if (coverage === null || coverage === undefined) {
    return { coverage: null, hasError: false };
  }
  
  // 如果是字符串，尝试解析 JSON
  let parsed: any;
  if (typeof coverage === 'string') {
    try {
      parsed = JSON.parse(coverage);
    } catch (e) {
      console.error('Failed to parse DateCoverage JSON:', e);
      return { coverage: null, hasError: true }; // 解析失败
    }
  } else {
    parsed = coverage;
  }
  
  // 如果不是数组，返回错误
  if (!Array.isArray(parsed)) {
    return { coverage: null, hasError: true };
  }
  
  // 验证并过滤有效的日期段
  const validRanges = parsed.filter(validateDateRange);
  
  if (validRanges.length === 0) {
    // 如果原始数据是数组但没有任何有效日期段，也算错误
    return { coverage: null, hasError: parsed.length > 0 };
  }
  
  // 合并重合的区间
  return { coverage: mergeDateRanges(validRanges), hasError: false };
}

/**
 * 格式化单个日期段
 */
export function formatDateRange(range: DateRange): string {
  return `${range.startDate} ~ ${range.endDate}`;
}

