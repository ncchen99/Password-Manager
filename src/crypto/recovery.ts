/**
 * 復原碼：建立帳號時產生 128-bit 高強度隨機碼，以易抄寫的分組格式顯示。
 * 由復原碼派生 RK 包裝 VK。主密碼與復原碼同時遺失即無法復原（無後門）。
 */
import { bytesToBase32 } from './encoding';

/** 產生 128-bit 復原碼，格式如 ABCD-EFGH-JKMN-PQRS-TVWX-YZ23 */
export function generateRecoveryCode(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16)); // 128-bit
  const raw = bytesToBase32(bytes); // ~26 字元
  return raw.match(/.{1,4}/g)!.join('-');
}

/** 正規化使用者輸入的復原碼（去分隔、轉大寫），供派生比對 */
export function normalizeRecoveryCode(input: string): string {
  return input.replace(/[\s-]/g, '').toUpperCase();
}
