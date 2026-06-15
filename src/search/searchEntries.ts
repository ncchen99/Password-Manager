/** 對解密後的條目做別名 + 模糊搜尋（純前端、即時） */
import type { ServiceEntry } from '@/types/entry';
import { matchScore } from './fuzzy';
import { normalize } from './normalize';
import { deriveAliases } from './alias';
import { conceptsOf, conceptsOfAll, semanticScore } from './semantic';

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

  // 語意層：查詢對應的概念（全程本機、零網路）
  const queryConcepts = conceptsOf(query);

  const hits: SearchHit[] = [];
  for (const entry of entries) {
    const fields = haystack(entry);
    let best = 0;
    for (const field of fields) {
      const s = matchScore(q, field);
      if (s > best) best = s;
      if (best === 1) break;
    }
    // lexical 未達門檻時，嘗試以概念近義補救（如「網銀」≈ Online Banking）
    if (best < 1 && queryConcepts.size > 0) {
      const sem = semanticScore(queryConcepts, conceptsOfAll(fields));
      if (sem > best) best = sem;
    }
    if (best >= THRESHOLD) hits.push({ entry, score: best });
  }
  return hits.sort((a, b) => b.score - a.score);
}
