/** 對解密後的條目做別名 + 模糊搜尋（純前端、即時） */
import type { ServiceEntry } from '@/types/entry';
import { matchScore } from './fuzzy';
import { normalize } from './normalize';
import { deriveAliases } from './alias';

const THRESHOLD = 0.45;

export interface SearchHit {
  entry: ServiceEntry;
  score: number;
}

/** 收集一筆條目所有可比對的字串（service / aliases / url / tags / username） */
function haystack(entry: ServiceEntry): string[] {
  const fields = [
    entry.service,
    entry.url ?? '',
    ...entry.aliases,
    ...deriveAliases(entry.service, entry.url),
    ...entry.tags,
    ...entry.credentials.map((c) => c.username ?? ''),
  ];
  return fields.filter(Boolean).map(normalize);
}

export function searchEntries(
  query: string,
  entries: ServiceEntry[],
): SearchHit[] {
  const q = normalize(query);
  if (!q) return entries.map((entry) => ({ entry, score: 1 }));

  const hits: SearchHit[] = [];
  for (const entry of entries) {
    let best = 0;
    for (const field of haystack(entry)) {
      const s = matchScore(q, field);
      if (s > best) best = s;
      if (best === 1) break;
    }
    if (best >= THRESHOLD) hits.push({ entry, score: best });
  }
  return hits.sort((a, b) => b.score - a.score);
}
