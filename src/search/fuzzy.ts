/** 純前端模糊比對：trigram 相似度 + Levenshtein 距離 */

function trigrams(s: string): Set<string> {
  const padded = `  ${s} `;
  const grams = new Set<string>();
  for (let i = 0; i < padded.length - 2; i++) {
    grams.add(padded.slice(i, i + 3));
  }
  return grams;
}

/** Dice 係數（0~1），適合較長字串的相似度 */
export function trigramSimilarity(a: string, b: string): number {
  if (!a || !b) return 0;
  if (a === b) return 1;
  const ga = trigrams(a);
  const gb = trigrams(b);
  let overlap = 0;
  for (const g of ga) if (gb.has(g)) overlap++;
  return (2 * overlap) / (ga.size + gb.size);
}

/** Levenshtein 距離 */
export function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  let curr = new Array<number>(b.length + 1);
  for (let i = 1; i <= a.length; i++) {
    curr[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(curr[j - 1] + 1, prev[j] + 1, prev[j - 1] + cost);
    }
    [prev, curr] = [curr, prev];
  }
  return prev[b.length];
}

/** 綜合分數（0~1）：子字串命中加權 + trigram + 近似編輯距離 */
export function matchScore(query: string, target: string): number {
  if (!query || !target) return 0;
  if (target === query) return 1;
  if (target.includes(query)) {
    // 子字串命中，依長度比例給高分
    return 0.85 + 0.15 * (query.length / target.length);
  }
  const tri = trigramSimilarity(query, target);
  const dist = levenshtein(query, target);
  const maxLen = Math.max(query.length, target.length);
  const editSim = maxLen ? 1 - dist / maxLen : 0;
  return Math.max(tri, editSim * 0.8);
}
