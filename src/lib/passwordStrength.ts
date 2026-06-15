/**
 * 主密碼強度估算（#12）。輕量、純前端、無相依：以長度與字元類別綜合評分。
 * 不取代 zxcvbn 等字典分析，但比「僅長度 ≥ 8」明顯更嚴格，能擋掉
 * 12345678 之類的弱密碼，並給使用者即時回饋。
 */

/** 主密碼最低長度（密碼管理器的主密碼為單點防護，門檻提高）。 */
export const MIN_MASTER_PASSWORD_LENGTH = 12;

export type StrengthLevel = 'weak' | 'fair' | 'good' | 'strong';

export interface PasswordStrength {
  /** 0–4 概略分數。 */
  score: number;
  level: StrengthLevel;
  /** 是否達到可接受門檻（長度足夠且非單一字元類別）。 */
  acceptable: boolean;
  /** 給使用者的一句提示（未達標時說明原因）。 */
  hint: string;
}

function classCount(pw: string): number {
  let n = 0;
  if (/[a-z]/.test(pw)) n++;
  if (/[A-Z]/.test(pw)) n++;
  if (/[0-9]/.test(pw)) n++;
  if (/[^a-zA-Z0-9]/.test(pw)) n++;
  return n;
}

export function estimatePasswordStrength(pw: string): PasswordStrength {
  const len = pw.length;
  const classes = classCount(pw);
  // 明顯重複/序列（如 11111111、abcabcabc）視為弱。
  const lowVariety = /^(.)\1+$/.test(pw) || new Set(pw).size <= 3;

  let score = 0;
  if (len >= 8) score++;
  if (len >= 12) score++;
  if (len >= 16) score++;
  if (classes >= 2) score++;
  if (classes >= 3) score++;
  if (lowVariety) score = Math.min(score, 1);
  score = Math.min(score, 4);

  const acceptable = len >= MIN_MASTER_PASSWORD_LENGTH && classes >= 2 && !lowVariety;

  const level: StrengthLevel =
    score <= 1 ? 'weak' : score === 2 ? 'fair' : score === 3 ? 'good' : 'strong';

  let hint = '';
  if (len < MIN_MASTER_PASSWORD_LENGTH) {
    hint = `至少 ${MIN_MASTER_PASSWORD_LENGTH} 個字元`;
  } else if (lowVariety) {
    hint = '避免重複或過於單調的字元';
  } else if (classes < 2) {
    hint = '混用大小寫、數字或符號更安全';
  }

  return { score, level, acceptable, hint };
}
