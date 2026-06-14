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

export async function putEncryptedEntry(record: EncryptedEntry): Promise<void> {
  await db.entries.put(record);
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
