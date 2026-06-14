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

/** 用包裝金鑰解出 VK */
export async function unwrapVaultKey(
  wrapped: WrappedKey,
  wrappingKey: CryptoKey,
): Promise<CryptoKey> {
  return crypto.subtle.unwrapKey(
    'raw',
    toArrayBuffer(base64ToBytes(wrapped.ct)),
    wrappingKey,
    { name: 'AES-GCM', iv: toArrayBuffer(base64ToBytes(wrapped.iv)) },
    { name: 'AES-GCM', length: 256 },
    true,
    ['encrypt', 'decrypt'],
  );
}

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  return bytes.buffer.slice(
    bytes.byteOffset,
    bytes.byteOffset + bytes.byteLength,
  ) as ArrayBuffer;
}
