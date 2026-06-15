/**
 * Firestore 讀寫層。只送 / 收密文與非敏感欄位（嚴格對齊 firestore.rules 白名單）。
 * 路徑：users/{uid}（meta）、users/{uid}/entries/{id}（密文條目）。
 */
import {
  doc,
  getDoc,
  setDoc,
  deleteDoc,
  collection,
  getDocs,
  writeBatch,
} from 'firebase/firestore';
import { getDb } from '@/firebase/app';
import type { EncryptedEntry } from '@/types/entry';
import type { KdfParams } from '@/crypto/kdf';
import type { WrappedKey } from '@/crypto/keyWrap';

export interface RemoteMetaDoc {
  kdfParams: KdfParams;
  wrappedVK_byMEK: WrappedKey;
  wrappedVK_byRK: WrappedKey;
  vaultRev: number;
  updatedAt: number;
}

/** 剝除 baseRev 等本機專用欄位，只保留 Firestore 白名單允許的欄位 */
function toRemoteEntry(e: EncryptedEntry): Record<string, unknown> {
  const out: Record<string, unknown> = {
    ciphertext: e.ciphertext,
    iv: e.iv,
    rev: e.rev,
    updatedAt: e.updatedAt,
  };
  if (e.conflictOf) out.conflictOf = e.conflictOf;
  return out;
}

export async function fetchRemoteMeta(
  uid: string,
): Promise<RemoteMetaDoc | null> {
  const snap = await getDoc(doc(getDb(), 'users', uid));
  return snap.exists() ? (snap.data() as RemoteMetaDoc) : null;
}

export async function pushRemoteMeta(
  uid: string,
  meta: RemoteMetaDoc,
): Promise<void> {
  await setDoc(doc(getDb(), 'users', uid), {
    kdfParams: meta.kdfParams,
    wrappedVK_byMEK: meta.wrappedVK_byMEK,
    wrappedVK_byRK: meta.wrappedVK_byRK,
    vaultRev: meta.vaultRev,
    updatedAt: meta.updatedAt,
  });
}

export async function fetchRemoteEntries(
  uid: string,
): Promise<EncryptedEntry[]> {
  const snap = await getDocs(collection(getDb(), 'users', uid, 'entries'));
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as object) }) as EncryptedEntry);
}

export async function pushRemoteEntries(
  uid: string,
  entries: EncryptedEntry[],
): Promise<void> {
  if (entries.length === 0) return;
  const db = getDb();
  // Firestore 批次上限 500，分批寫入
  for (let i = 0; i < entries.length; i += 450) {
    const batch = writeBatch(db);
    for (const e of entries.slice(i, i + 450)) {
      batch.set(doc(db, 'users', uid, 'entries', e.id), toRemoteEntry(e));
    }
    await batch.commit();
  }
}

export async function deleteRemoteEntry(
  uid: string,
  id: string,
): Promise<void> {
  await deleteDoc(doc(getDb(), 'users', uid, 'entries', id));
}

export { toRemoteEntry };
