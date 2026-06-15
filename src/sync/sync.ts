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
  gcTombstones,
} from '@/db/repo';
import { mergeEntries, mergeMeta } from './merge';
import {
  deleteRemoteEntry,
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
 * 把一筆密文記錄在「新 id」下重新加密（解開舊 AAD、以新 id 為 AAD 重新封裝）。
 * 衝突合併會給落敗版本指派新 id；因密文以條目 id 綁定 AAD（見 crypto/vault），
 * 副本必須重新加密才能被正確解密。此函式由握有 VK 的呼叫端提供（同步層本身不持有 VK）。
 *
 * @param record  欲重封裝的記錄（其 `id` 為新 id；`conflictOf` 指向原 id = 舊 AAD）
 */
export type ReEncryptForNewId = (
  record: EncryptedEntry,
) => Promise<EncryptedEntry>;

/**
 * 雙向同步一次。前提：本機已有 meta（已建庫）。
 * 同步本身只搬密文；但 AAD 綁定 id 後，衝突副本需以新 id 重新加密，
 * 故由呼叫端（vaultStore，持有 VK）傳入 `reEncrypt`。省略時退回沿用原密文（測試用）。
 */
export async function syncNow(
  uid: string,
  reEncrypt?: ReEncryptForNewId,
): Promise<SyncOutcome> {
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
  const merged = mergeEntries(local, remote, newId);
  let { resolved, toPush } = merged;
  const { conflicts } = merged;

  // 衝突副本換了新 id → 以新 id 重新加密（AAD 綁定 id），否則之後無法解密。
  if (reEncrypt && conflicts.length > 0) {
    const replacement = new Map<EncryptedEntry, EncryptedEntry>();
    for (const copy of conflicts) {
      replacement.set(copy, await reEncrypt(copy));
    }
    const apply = (arr: EncryptedEntry[]) =>
      arr.map((e) => replacement.get(e) ?? e);
    resolved = apply(resolved);
    toPush = apply(toPush);
  }

  // 先寫回本機（含下載與衝突副本），再推送遠端
  await bulkPutEncrypted(resolved);
  await pushRemoteEntries(uid, toPush);

  // 墓碑 GC：清除已傳播 30 天以上的刪除標記（本機 + 遠端），避免無限增長。
  const collected = await gcTombstones();
  for (const id of collected) await deleteRemoteEntry(uid, id);

  const pulled = countPulled(local, resolved);
  return { pushed: toPush.length, pulled, conflicts: conflicts.length };
}

function toRemoteMeta(m: VaultMeta): RemoteMetaDoc {
  return {
    kdfParams: m.kdfParams,
    ...(m.wrappedVK_byMEK ? { wrappedVK_byMEK: m.wrappedVK_byMEK } : {}),
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
