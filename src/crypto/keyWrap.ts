/**
 * 金鑰包裝（key wrapping）。
 * VK（Vault Key）為真正加解密金庫的隨機對稱金鑰；
 * 以 MEK（主密碼派生）與 RK（復原碼派生）各包裝一份。
 */
import { base64ToBytes, bytesToBase64 } from './encoding';

export interface WrappedKey {
  ct: string; // base64 wrapped key
  iv: string; // base64 12-byte IV
}

const IV_LENGTH = 12;

function randomIv(): Uint8Array {
  return crypto.getRandomValues(new Uint8Array(IV_LENGTH));
}

/** 產生隨機 Vault Key（可匯出，僅為了被 wrap；解鎖後僅存記憶體） */
export async function generateVaultKey(): Promise<CryptoKey> {
  return crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, true, [
    'encrypt',
    'decrypt',
  ]);
}

/** 用包裝金鑰（MEK 或 RK）把 VK 包成密文 */
export async function wrapVaultKey(
  vk: CryptoKey,
  wrappingKey: CryptoKey,
): Promise<WrappedKey> {
  const iv = randomIv();
  const wrapped = await crypto.subtle.wrapKey('raw', vk, wrappingKey, {
    name: 'AES-GCM',
    iv: toArrayBuffer(iv),
  });
  return { ct: bytesToBase64(new Uint8Array(wrapped)), iv: bytesToBase64(iv) };
}

/**
 * 用包裝金鑰解出 VK。
 *
 * `extractable` 預設為 **false**：日常解鎖（主密碼 / 指紋）取得的 VK 僅供記憶體中
 * encrypt/decrypt 使用，無法被 `exportKey` 匯出 → 即使遭遇 XSS / 惡意擴充，攻擊者也
 * 無法竊取 32-byte 原始金鑰離線解密或植入後門（只能在當前頁面逐筆解密，門檻顯著提高）。
 *
 * 僅在需要「重新包裝 VK」的特權流程（建立金庫、復原、換主密碼、啟用指紋）才需
 * `extractable: true`——因為 `wrapKey` 只能包裝可匯出的金鑰。這些流程都伴隨重新驗證。
 */
export async function unwrapVaultKey(
  wrapped: WrappedKey,
  wrappingKey: CryptoKey,
  extractable = false,
): Promise<CryptoKey> {
  return crypto.subtle.unwrapKey(
    'raw',
    toArrayBuffer(base64ToBytes(wrapped.ct)),
    wrappingKey,
    { name: 'AES-GCM', iv: toArrayBuffer(base64ToBytes(wrapped.iv)) },
    { name: 'AES-GCM', length: 256 },
    extractable,
    ['encrypt', 'decrypt'],
  );
}

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  return bytes.buffer.slice(
    bytes.byteOffset,
    bytes.byteOffset + bytes.byteLength,
  ) as ArrayBuffer;
}
