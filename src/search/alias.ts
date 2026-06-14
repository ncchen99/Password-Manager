/**
 * 別名字典：常見服務的中英 / 縮寫對照，讓「臉書 / FB / Facebook」互通。
 * 可由 domain 自動推導，也可由使用者手動維護（存於 entry.aliases）。
 */
import { domainStem, normalize } from './normalize';

/** 內建常見服務別名（key 與 value 皆會被正規化比對） */
const BUILTIN_ALIASES: Record<string, string[]> = {
  facebook: ['fb', '臉書', '非死不可', 'meta'],
  instagram: ['ig', '限動'],
  google: ['谷歌', 'gmail', '咕狗'],
  youtube: ['yt', '油管'],
  twitter: ['x', '推特', '推'],
  line: ['賴'],
  github: ['gh'],
  microsoft: ['ms', '微軟', 'outlook', 'hotmail'],
  apple: ['icloud', '蘋果', 'appleid'],
  amazon: ['亞馬遜', 'aws'],
  netflix: ['網飛', 'nf'],
  discord: ['dc'],
  telegram: ['tg', '電報'],
  shopee: ['蝦皮'],
};

/** 為一筆服務自動推導別名集合（含內建字典 + domain stem） */
export function deriveAliases(service: string, url?: string): string[] {
  const out = new Set<string>();
  const key = normalize(service);
  for (const builtin of BUILTIN_ALIASES[key] ?? []) out.add(builtin);

  const stem = domainStem(url);
  if (stem) {
    out.add(stem);
    for (const builtin of BUILTIN_ALIASES[stem] ?? []) out.add(builtin);
  }
  return [...out];
}
