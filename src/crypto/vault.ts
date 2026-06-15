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

/**
 * AAD（Additional Authenticated Data）：把條目 id 綁進 AES-GCM 認證標籤。
 * 如此密文與其所屬條目綁定——攻擊者（或有 Firestore 寫入權限者）無法把條目 A 的
 * `{ciphertext, iv}` 搬到條目 B 的文件冒充（解密會驗證失敗），杜絕跨條目密文替換。
 *
 * 注意：因 AAD 綁 id，衝突合併產生的「副本」（換新 id）必須重新加密，
 * 不能沿用原密文——見 sync 流程的 reEncryptForNewId。
 */
function entryAad(id: string): ArrayBuffer {
  return toArrayBuffer(utf8ToBytes(id));
}

export async function encryptEntry(
  entry: ServiceEntry,
  vk: CryptoKey,
  rev = 1,
): Promise<EncryptedEntry> {
  const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH));
  const plaintext = utf8ToBytes(JSON.stringify(entry));
  const ct = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: toArrayBuffer(iv), additionalData: entryAad(entry.id) },
    vk,
    toArrayBuffer(plaintext),
  );
  return {
    id: entry.id,
    ciphertext: bytesToBase64(new Uint8Array(ct)),
    iv: bytesToBase64(iv),
    rev,
    updatedAt: entry.updatedAt,
  };
}

export async function decryptEntry(
  record: EncryptedEntry,
  vk: CryptoKey,
): Promise<ServiceEntry> {
  const iv = toArrayBuffer(base64ToBytes(record.iv));
  const ct = toArrayBuffer(base64ToBytes(record.ciphertext));
  let plaintext: ArrayBuffer;
  try {
    // 新格式：id 綁入 AAD
    plaintext = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv, additionalData: entryAad(record.id) },
      vk,
      ct,
    );
  } catch {
    // 向後相容：本次強化前的密文無 AAD，退回無 AAD 解密（會在下次儲存時自動升級）。
    plaintext = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, vk, ct);
  }
  return JSON.parse(bytesToUtf8(new Uint8Array(plaintext))) as ServiceEntry;
}

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  return bytes.buffer.slice(
    bytes.byteOffset,
    bytes.byteOffset + bytes.byteLength,
  ) as ArrayBuffer;
}
