const PROXY_BASE_URL = 'https://www.xhstool.cc/api/proxy';
const QIAN_GUA_NOTE_CDN_HOST = 'xsh-qn.qian-gua.com';
const THUMBNAIL_SUFFIX = '-180x240';
const DIMENSION_SUFFIX_RE = /-\d+x\d+$/;
/** 千瓜封面资源 ID 路径，如 /1040g2sg31abc */
const NOTE_ASSET_PATH_RE = /^\/1040g[a-z0-9]+$/i;

function ensureHttpsProtocol(url: string): string {
  const trimmed = url.trim();
  if (trimmed.startsWith('//')) return `https:${trimmed}`;
  if (trimmed.startsWith('/')) return `https:${trimmed}`;
  return trimmed;
}

function pathnameHasDimensionSuffix(pathname: string): boolean {
  return DIMENSION_SUFFIX_RE.test(pathname);
}

function appendThumbnailSuffix(pathname: string): string {
  if (pathnameHasDimensionSuffix(pathname)) return pathname;
  return `${pathname}${THUMBNAIL_SUFFIX}`;
}

/** 与千瓜 xsh-qn 一致的笔记封面路径（不含 webpic 带 ! 的变换 URL） */
function isQianGuaNoteCoverPath(pathname: string): boolean {
  return (
    pathname.includes('/notes_pre_post/') ||
    pathname.startsWith('/spectrum/') ||
    NOTE_ASSET_PATH_RE.test(pathname)
  );
}

function shouldMapToQianGuaNoteCdn(hostname: string, pathname: string): boolean {
  if (hostname.endsWith('rednotecdn.com')) return true;
  // 如 sns-na-i8.xhscdn.com/notes_pre_post/...（非 sns-webpic 等带 ! 参数的 URL）
  if (hostname.endsWith('xhscdn.com') && hostname.startsWith('sns-')) {
    return isQianGuaNoteCoverPath(pathname);
  }
  return false;
}

function mapToQianGuaNoteCdn(parsed: URL): string {
  parsed.protocol = 'https:';
  parsed.hostname = QIAN_GUA_NOTE_CDN_HOST;
  parsed.pathname = appendThumbnailSuffix(parsed.pathname);
  return parsed.toString();
}

/**
 * 规范化千瓜 / 小红书 CDN 图片地址（补协议、CDN 转 xsh-qn、缺省缩略图后缀等）
 */
export function normalizeImageUrl(raw: string): string {
  const withProtocol = ensureHttpsProtocol(raw);

  let parsed: URL;
  try {
    parsed = new URL(withProtocol);
  } catch {
    return withProtocol;
  }

  const { hostname, pathname } = parsed;

  if (shouldMapToQianGuaNoteCdn(hostname, pathname)) {
    return mapToQianGuaNoteCdn(parsed);
  }

  if (hostname.endsWith('qian-gua.com') && hostname !== 'api.qian-gua.com') {
    parsed.protocol = 'https:';
    parsed.pathname = appendThumbnailSuffix(parsed.pathname);
    return parsed.toString();
  }

  return parsed.toString();
}

/**
 * 获取经 xhstool 代理、且已规范化的图片 URL
 */
export function getProxiedImageUrl(
  url: string | null | undefined
): string | undefined {
  if (!url) return undefined;
  if (url.includes('xhstool.cc/api/proxy')) return url;

  const normalized = normalizeImageUrl(url);
  return `${PROXY_BASE_URL}?url=${encodeURIComponent(normalized)}`;
}
