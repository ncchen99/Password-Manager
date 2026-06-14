/** 搜尋用字串正規化：小寫、去空白、全形轉半形 */
export function normalize(s: string): string {
  return s
    .normalize('NFKC')
    .toLowerCase()
    .replace(/\s+/g, '')
    .trim();
}

/** 從 url / service 推導 domain 主體（facebook.com → facebook） */
export function domainStem(url?: string): string | undefined {
  if (!url) return undefined;
  const m = url
    .replace(/^https?:\/\//, '')
    .replace(/^www\./, '')
    .match(/^([^./]+)/);
  return m ? m[1].toLowerCase() : undefined;
}
