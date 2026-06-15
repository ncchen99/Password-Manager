/** 本地金庫存取層：meta 與密文條目的 CRUD（不涉及解密） */
import type { EncryptedEntry } from '@/types/entry';
import type { VaultKeyset } from '@/crypto/vaultSetup';
import { db, type VaultMeta } from './dexie';

export async function getMeta(): Promise<VaultMeta | undefined> {
  return db.meta.get('self');
}

export async function hasVault(): Promise<boolean> {
  return (await db.meta.count()) > 0;
}

export async function saveMeta(keyset: VaultKeyset): Promise<void> {
  const now = Date.now();
  const existing = await getMeta();
  await db.meta.put({
    id: 'self',
    ...keyset,
    vaultRev: existing ? existing.vaultRev : 0,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  });
}

/** 換主密碼後只更新 kdfParams / wrappedVK_byMEK */
export async function updateMekWrap(
  kdfParams: VaultKeyset['kdfParams'],
  wrappedVK_byMEK: VaultKeyset['wrappedVK_byMEK'],
): Promise<void> {
  await db.meta.update('self', {
    kdfParams,
    wrappedVK_byMEK,
    updatedAt: Date.now(),
  });
}

export async function listEncryptedEntries(): Promise<EncryptedEntry[]> {
  return db.entries.orderBy('updatedAt').reverse().toArray();
}

export async function getEncryptedEntry(
  id: string,
): Promise<EncryptedEntry | undefined> {
  return db.entries.get(id);
}

/** 取得某條目的下一個 rev（現有 rev + 1，新條目為 1） */
export async function nextRev(id: string): Promise<number> {
  const existing = await db.entries.get(id);
  return (existing?.rev ?? 0) + 1;
}

export async function putEncryptedEntry(record: EncryptedEntry): Promise<void> {
  await db.entries.put(record);
}

export async function bulkPutEncrypted(
  records: EncryptedEntry[],
): Promise<void> {
  await db.entries.bulkPut(records);
}

/** 覆寫本機 meta（換主密碼 / 復原 / 從遠端合併後使用） */
export async function replaceMeta(meta: VaultMeta): Promise<void> {
  await db.meta.put(meta);
}

/** 設定整體版本號 vaultRev（主密碼變更時遞增） */
export async function setVaultRev(vaultRev: number): Promise<void> {
  await db.meta.update('self', { vaultRev, updatedAt: Date.now() });
}

export async function deleteEntry(id: string): Promise<void> {
  await db.entries.delete(id);
}

export async function clearAll(): Promise<void> {
  await db.transaction('rw', db.meta, db.entries, async () => {
    await db.meta.clear();
    await db.entries.clear();
  });
}
