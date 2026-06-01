const PROXY_BASE_URL = 'https://www.xhstool.cc/api/proxy';
const THUMBNAIL_SUFFIX = '-180x240';
const DIMENSION_SUFFIX_RE = /-\d+x\d+$/;

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

/**
 * 规范化千瓜 / 小红书 CDN 图片地址（补协议、rednotecdn 转 xsh-qn、缺省缩略图后缀等）
 */
export function normalizeImageUrl(raw: string): string {
  const withProtocol = ensureHttpsProtocol(raw);

  let parsed: URL;
  try {
    parsed = new URL(withProtocol);
  } catch {
    return withProtocol;
  }

  const { hostname } = parsed;

  if (hostname.endsWith('rednotecdn.com')) {
    parsed.protocol = 'https:';
    parsed.hostname = 'xsh-qn.qian-gua.com';
    parsed.pathname = appendThumbnailSuffix(parsed.pathname);
    return parsed.toString();
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
