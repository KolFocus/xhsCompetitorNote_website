/**
 * 数据转换工具函数
 * 用于将 API 返回的数据转换为数据库格式
 */

/**
 * 将数字转换为字符串（处理 BIGINT、INTEGER 等）
 */
export function numberToString(value: number | null | undefined): string | null {
  if (value === null || value === undefined) return null;
  return String(value);
}

/**
 * 将 ISO 8601 格式字符串转换为 TIMESTAMPTZ
 * 如果已经是正确的格式，直接返回；否则进行转换
 */
export function isoToTimestamptz(value: string | null | undefined): string | null {
  if (!value) return null;
  // 如果已经是 ISO 8601 格式，直接返回
  if (value.includes('T') || value.includes('+') || value.includes('Z')) {
    return value;
  }
  return null;
}

/**
 * 将日期字符串转换为 DATE 格式（YYYY-MM-DD）
 */
export function stringToDate(value: string | null | undefined): string | null {
  if (!value) return null;
  // 如果已经是 YYYY-MM-DD 格式，直接返回
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return value;
  }
  return null;
}

/**
 * 修复图片 URL（添加 https: 前缀，如果以 // 开头）
 */
export function fixImageUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  if (url.startsWith('//')) {
    return `https:${url}`;
  }
  if (url.startsWith('http://') || url.startsWith('https://')) {
    return url;
  }
  return url;
}

/**
 * 提取品牌信息（从 CooperateBindList 的第一个元素）
 */
export function extractBrandInfo(cooperateBindList: any[] | null | undefined): {
  BrandId: string | null;
  BrandIdKey: string | null;
  BrandName: string | null;
  CooperateBindList: any[] | null;
} {
  if (!cooperateBindList || !Array.isArray(cooperateBindList) || cooperateBindList.length === 0) {
    return {
      BrandId: null,
      BrandIdKey: null,
      BrandName: null,
      CooperateBindList: null,
    };
  }

  const firstBrand = cooperateBindList[0];
  return {
    BrandId: numberToString(firstBrand?.BrandId),
    BrandIdKey: firstBrand?.BrandIdKey || null,
    BrandName: firstBrand?.BrandName || null,
    CooperateBindList: cooperateBindList,
  };
}

/**
 * 转换博主数据（从 getNoteList 的 ItemList 中提取）
 */
export function transformBloggerData(item: any): any {
  return {
    BloggerId: numberToString(item.BloggerId),
    BloggerIdKey: item.BloggerIdKey || null,
    BloggerNickName: item.BloggerNickName || null,
    BloggerProp: item.BloggerProp || null,
    BloggerTags: item.BloggerTags || null,
    BloggerTagName: item.BloggerTagName || null,
    Fans: item.Fans ?? 0,
    LevelNumber: item.LevelNumber ?? 0,
    LevelName: item.LevelName || null,
    Gender: item.Gender ?? 0,
    Location: item.Location || null,
    BigAvatar: fixImageUrl(item.BigAvatar),
    SmallAvatar: fixImageUrl(item.SmallAvatar),
    McnName: item.McnName || null,
    McnInfoId: numberToString(item.McnInfoId),
    IsBrandPartner: item.IsBrandPartner ?? false,
    OfficialVerified: item.OfficialVerified ?? false,
    GoodsCount: item.GoodsCount ?? 0,
    NoteActiveCount: item.NoteActiveCount ?? 0,
    AdPrice: item.AdPrice ?? null,
    AdPriceUpdateStatus: item.AdPriceUpdateStatus ?? 0,
    PriceType: item.PriceType || null,
    LinkInfo: item.LinkInfo || null,
  };
}

/**
 * 转换品牌数据（从 CooperateBindList 中提取）
 */
export function transformBrandData(brand: any): any {
  return {
    BrandId: numberToString(brand.BrandId),
    BrandIdKey: brand.BrandIdKey || null,
    BrandName: brand.BrandName || null,
    BrandDescription: brand.BrandDescription || null,
    BrandLogo: fixImageUrl(brand.BrandLogo),
  };
}

/**
 * 转换笔记数据（从 getNoteList 的 ItemList 中提取）
 */
export function transformNoteData(item: any): any {
  const brandInfo = extractBrandInfo(item.CooperateBindList);
  const bloggerData = transformBloggerData(item);

  return {
    NoteId: numberToString(item.NoteId),
    DateCode: numberToString(item.DateCode),
    NoteIdKey: item.NoteIdKey || null,
    Title: item.Title || null,
    Content: null, // getNoteList 不包含 Content，由 getSimpleNote 提供
    CoverImage: fixImageUrl(item.CoverImage),
    XhsNoteUrl: null, // getNoteList 不包含 XhsNoteUrl，由 getSimpleNote 提供
    NoteType: item.NoteType || null,
    IsBusiness: item.IsBusiness ?? false,
    IsAdNote: item.IsAdNote ?? false,
    PublishTime: isoToTimestamptz(item.PublishTime),
    PubDate: stringToDate(item.PubDate),
    UpdateTime: isoToTimestamptz(item.UpdateTime),
    LikedCount: item.LikedCount ?? 0,
    CollectedCount: item.CollectedCount ?? 0,
    CommentsCount: item.CommentsCount ?? 0,
    ViewCount: item.ViewCount ?? 0,
    ShareCount: item.ShareCount ?? 0,
    LikeCollect: item.LikeCollect ?? 0,
    SpreadScore: item.SpreadScore ?? null,
    Index: item.Index ?? null,
    Lcc: item.Lcc ?? null,
    VideoDuration: item.VideoDuration || null,
    Props: item.Props ?? 0,
    // 博主外键
    BloggerId: bloggerData.BloggerId,
    // 博主冗余字段
    BloggerNickName: bloggerData.BloggerNickName,
    BloggerProp: bloggerData.BloggerProp,
    BloggerTags: bloggerData.BloggerTags,
    BloggerTagName: bloggerData.BloggerTagName,
    Fans: bloggerData.Fans,
    LevelNumber: bloggerData.LevelNumber,
    LevelName: bloggerData.LevelName,
    Gender: bloggerData.Gender,
    Location: bloggerData.Location,
    BigAvatar: bloggerData.BigAvatar,
    SmallAvatar: bloggerData.SmallAvatar,
    McnName: bloggerData.McnName,
    McnInfoId: bloggerData.McnInfoId,
    IsBrandPartner: bloggerData.IsBrandPartner,
    OfficialVerified: bloggerData.OfficialVerified,
    GoodsCount: bloggerData.GoodsCount,
    NoteActiveCount: bloggerData.NoteActiveCount,
    AdPrice: bloggerData.AdPrice,
    AdPriceUpdateStatus: bloggerData.AdPriceUpdateStatus,
    PriceType: bloggerData.PriceType,
    LinkInfo: bloggerData.LinkInfo,
    // 品牌信息
    CooperateBindsName: item.CooperateBindsName || null,
    CooperateBindList: brandInfo.CooperateBindList,
    BrandId: brandInfo.BrandId,
    BrandIdKey: brandInfo.BrandIdKey,
    BrandName: brandInfo.BrandName,
    CurrentUserIsFavorite: item.CurrentUserIsFavorite ?? false,
  };
}

/**
 * 转换笔记详情数据（从 getSimpleNote 的 Data 中提取）
 */
export function transformNoteDetailData(data: any): {
  NoteId: string;
  Content: string | null;
  XhsNoteUrl: string | null;
  BloggerNickName?: string | null;
  SmallAvatar?: string | null;
} {
  return {
    NoteId: numberToString(data.NoteId) || '',
    Content: data.Content || null,
    XhsNoteUrl: data.XhsNoteUrl || null,
    BloggerNickName: data.BloggerNickName || null,
    SmallAvatar: fixImageUrl(data.BloggerSmallAvatar || data.SmallAvatar),
  };
}

/**
 * 从笔记详情数据中提取博主信息（用于更新博主表）
 */
export function extractBloggerFromNoteDetail(data: any): any | null {
  if (!data.BloggerId) return null;

  return {
    BloggerId: numberToString(data.BloggerId),
    BloggerIdKey: data.BloggerIdKey || null,
    BloggerNickName: data.BloggerNickName || null,
    SmallAvatar: fixImageUrl(data.BloggerSmallAvatar || data.SmallAvatar),
  };
}

