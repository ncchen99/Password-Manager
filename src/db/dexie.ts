/**
 * 本地加密金庫儲存（IndexedDB via Dexie）。
 * 只存密文與金鑰包裝結果；解密只在記憶體進行。
 */
import Dexie, { type EntityTable } from 'dexie';
import type { EncryptedEntry } from '@/types/entry';
import type { VaultKeyset } from '@/crypto/vaultSetup';

/** 金庫中繼資料（單列，id 固定為 'self'） */
export interface VaultMeta extends VaultKeyset {
  id: 'self';
  vaultRev: number;
  createdAt: number;
  updatedAt: number;
}

const db = new Dexie('safevault') as Dexie & {
  meta: EntityTable<VaultMeta, 'id'>;
  entries: EntityTable<EncryptedEntry, 'id'>;
};

db.version(1).stores({
  meta: 'id',
  entries: 'id, updatedAt',
});

export { db };
