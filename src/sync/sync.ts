/**
 * 同步協調器：把 remote（Firestore）與 merge（純合併）接起來，
 * 並把合併結果寫回本機 Dexie。全程只搬移密文。
 */
import { newId } from '@/lib/id';
import {
  listEncryptedEntries,
  getMeta,
  bulkPutEncrypted,
  replaceMeta,
} from '@/db/repo';
import { mergeEntries, mergeMeta } from './merge';
import {
  fetchRemoteEntries,
  fetchRemoteMeta,
  pushRemoteEntries,
  pushRemoteMeta,
  type RemoteMetaDoc,
} from './remote';
import type { VaultMeta } from '@/db/dexie';
import type { EncryptedEntry } from '@/types/entry';

export interface SyncOutcome {
  pushed: number;
  pulled: number;
  conflicts: number;
}

/**
 * 雙向同步一次。前提：本機已有 meta（已建庫）。
 * 不需要 VK——同步只搬密文；解密在他處進行。
 */
export async function syncNow(uid: string): Promise<SyncOutcome> {
  const localMeta = await getMeta();
  if (!localMeta) throw new Error('本機尚無金庫，無法同步');

  // 1) meta 合併
  const remoteMeta = await fetchRemoteMeta(uid);
  const metaMerge = mergeMeta<RemoteMetaDoc>(toRemoteMeta(localMeta), remoteMeta);
  if (metaMerge.pushLocal) {
    await pushRemoteMeta(uid, metaMerge.meta);
  } else {
    // 採用遠端 meta（例如他裝置換過主密碼）
    await replaceMeta(applyRemoteMeta(localMeta, metaMerge.meta));
  }

  // 2) 條目合併
  const [local, remote] = await Promise.all([
    listEncryptedEntries(),
    fetchRemoteEntries(uid),
  ]);
  const { resolved, toPush, conflicts } = mergeEntries(local, remote, newId);

  // 先寫回本機（含下載與衝突副本），再推送遠端
  await bulkPutEncrypted(resolved);
  await pushRemoteEntries(uid, toPush);

  const pulled = countPulled(local, resolved);
  return { pushed: toPush.length, pulled, conflicts: conflicts.length };
}

function toRemoteMeta(m: VaultMeta): RemoteMetaDoc {
  return {
    kdfParams: m.kdfParams,
    wrappedVK_byMEK: m.wrappedVK_byMEK,
    wrappedVK_byRK: m.wrappedVK_byRK,
    vaultRev: m.vaultRev,
    updatedAt: m.updatedAt,
  };
}

function applyRemoteMeta(local: VaultMeta, remote: RemoteMetaDoc): VaultMeta {
  return {
    ...local,
    kdfParams: remote.kdfParams,
    wrappedVK_byMEK: remote.wrappedVK_byMEK,
    wrappedVK_byRK: remote.wrappedVK_byRK,
    vaultRev: remote.vaultRev,
    updatedAt: remote.updatedAt,
  };
}

/** 計算本次實際從遠端新增/更新的條目數（resolved 中 ciphertext 與原本機不同者） */
function countPulled(
  before: EncryptedEntry[],
  after: EncryptedEntry[],
): number {
  const beforeById = new Map(before.map((e) => [e.id, e]));
  let n = 0;
  for (const e of after) {
    const prev = beforeById.get(e.id);
    if (!prev || prev.ciphertext !== e.ciphertext || prev.rev !== e.rev) n++;
  }
  return n;
}
