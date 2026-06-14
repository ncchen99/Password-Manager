/**
 * 用 VK 對單筆 ServiceEntry 做 AES-256-GCM 加解密。
 * 每筆使用獨立隨機 IV。
 */
import type { EncryptedEntry, ServiceEntry } from '@/types/entry';
import {
  base64ToBytes,
  bytesToBase64,
  bytesToUtf8,
  utf8ToBytes,
} from './encoding';

const IV_LENGTH = 12;

export async function encryptEntry(
  entry: ServiceEntry,
  vk: CryptoKey,
): Promise<EncryptedEntry> {
  const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH));
  const plaintext = utf8ToBytes(JSON.stringify(entry));
  const ct = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: toArrayBuffer(iv) },
    vk,
    toArrayBuffer(plaintext),
  );
  return {
    id: entry.id,
    ciphertext: bytesToBase64(new Uint8Array(ct)),
    iv: bytesToBase64(iv),
    rev: 1,
    updatedAt: entry.updatedAt,
  };
}

export async function decryptEntry(
  record: EncryptedEntry,
  vk: CryptoKey,
): Promise<ServiceEntry> {
  const plaintext = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: toArrayBuffer(base64ToBytes(record.iv)) },
    vk,
    toArrayBuffer(base64ToBytes(record.ciphertext)),
  );
  return JSON.parse(bytesToUtf8(new Uint8Array(plaintext))) as ServiceEntry;
}

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  return bytes.buffer.slice(
    bytes.byteOffset,
    bytes.byteOffset + bytes.byteLength,
  ) as ArrayBuffer;
}
