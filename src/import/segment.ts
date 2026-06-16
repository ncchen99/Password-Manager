/**
 * 區塊切分：把整段正規化文字切成「每筆一個區塊」。
 * 啟發式：明確分隔線、空行；若整段無分隔且偵測到重複 schema，則依重複的
 * 起始標籤切分（例如每筆都以「服務:」或網域開頭）。
 */
import { toLines } from './canonicalize';
import { splitLabeled } from './canonicalize';
import { labelToField } from './labels';
import { isUrl } from './tokens';

const HARD_DIVIDER = /^\s*(-{3,}|={3,}|\*{3,}|—{2,}|_{3,}|#{2,})\s*$/;

/** 回傳區塊字串陣列（每個區塊內仍是多行文字）。 */
export function segment(text: string): string[] {
  if (!text.trim()) return [];

  // 1) 明確分隔線優先
  const byDivider = splitByDivider(text);
  if (byDivider.length > 1) return byDivider.filter((b) => b.trim());

  // 2) 空行分隔
  const byBlank = text
    .split(/\n\s*\n/)
    .map((b) => b.trim())
    .filter(Boolean);
  if (byBlank.length > 1) return byBlank;

  // 3) 單一大區塊：嘗試以重複 schema 切分
  const single = byBlank[0] ?? text.trim();
  const bySchema = splitByRepeatedSchema(single);
  return bySchema.length > 1 ? bySchema : [single];
}

function splitByDivider(text: string): string[] {
  const blocks: string[] = [];
  let cur: string[] = [];
  for (const line of text.split('\n')) {
    if (HARD_DIVIDER.test(line)) {
      blocks.push(cur.join('\n'));
      cur = [];
    } else {
      cur.push(line);
    }
  }
  blocks.push(cur.join('\n'));
  return blocks;
}

/**
 * 無空行的連續清單：若偵測到「起始欄位」週期性重複（例如每筆都從 service 或
 * url 開頭），就在每個起始點切一刀。
 */
function splitByRepeatedSchema(block: string): string[] {
  const lines = toLines(block);
  if (lines.length < 4) return [block];

  const starterIdx: number[] = [];
  lines.forEach((line, i) => {
    if (isBlockStarter(line)) starterIdx.push(i);
  });

  // 需要至少兩個起始點、且非每行都是起始點
  if (starterIdx.length < 2 || starterIdx.length === lines.length) {
    return [block];
  }

  const out: string[] = [];
  for (let s = 0; s < starterIdx.length; s++) {
    const from = starterIdx[s];
    const to = s + 1 < starterIdx.length ? starterIdx[s + 1] : lines.length;
    out.push(lines.slice(from, to).join('\n'));
  }
  // 第一個起始點之前的孤兒行併入第一筆
  if (starterIdx[0] > 0) {
    out[0] = lines.slice(0, starterIdx[1] ?? lines.length).join('\n');
  }
  return out.filter((b) => b.trim());
}

/** 一行是否「像一筆的開頭」：service 標籤、或裸網址/網域。 */
function isBlockStarter(line: string): boolean {
  const { label, value } = splitLabeled(line);
  if (label && labelToField(label) === 'service') return true;
  if (!label && isUrl(value)) return true;
  return false;
}

/** 一行若是明確標籤的 username/password，回傳其欄位鍵；否則 undefined。 */
function credLabelKey(line: string): 'username' | 'password' | undefined {
  const { label } = splitLabeled(line);
  if (!label) return undefined;
  const f = labelToField(label);
  return f === 'username' || f === 'password' ? f : undefined;
}

/**
 * 同一服務多組帳密的拆分：一個區塊內若出現重複的 acc/pwd 配對
 * （如 protonVPn 兩組、windscribe 三組），拆成多個子區塊——每組各自成一筆，
 * 並把共用的標頭行（服務名、網址等）複製到每一筆前面。
 *
 * 只在偵測到「明確標籤」的 username/password 重複時才拆；無標籤的裸值區塊
 * （email↵密碼）不拆，避免誤判。未偵測到多組時原樣回傳單一區塊。
 */
export function splitCredentials(block: string): string[] {
  const lines = toLines(block);
  const header: string[] = [];
  const groups: string[][] = [];
  let current: string[] | null = null;
  let seen = new Set<'username' | 'password'>();

  for (const line of lines) {
    const key = credLabelKey(line);
    if (key) {
      if (current === null) {
        current = [];
      } else if (seen.has(key)) {
        // 同一欄位鍵重複出現 → 視為新一組的開始
        groups.push(current);
        current = [];
        seen = new Set();
      }
      current.push(line);
      seen.add(key);
    } else if (current === null) {
      header.push(line); // 第一組帳密之前的行 → 共用標頭
    } else {
      current.push(line); // 帳密之後的附屬行（otp/note 等）歸入當前組
    }
  }
  if (current) groups.push(current);

  if (groups.length <= 1) return [block];
  return groups.map((g) => [...header, ...g].join('\n'));
}
