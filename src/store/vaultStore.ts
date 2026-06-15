/**
 * 金庫 session 狀態（Zustand）。
 * VK 與解密後的條目只存在記憶體；閒置逾時自動上鎖並清除金鑰。
 */
import { create } from 'zustand';
import type { ServiceEntry } from '@/types/entry';
import {
  createVault,
  unlockWithMasterPassword,
  recoverWithCode,
  rekeyVault,
} from '@/crypto/vaultSetup';
import { decryptEntry, encryptEntry } from '@/crypto/vault';
import { deriveAliases } from '@/search/alias';
import {
  deleteEntry as dbDelete,
  getEncryptedEntry,
  getMeta,
  hasVault,
  listEncryptedEntries,
  putEncryptedEntry,
  replaceMeta,
  saveMeta,
} from '@/db/repo';
import type { SyncOutcome } from '@/sync/sync';

export type VaultStatus = 'loading' | 'no-vault' | 'locked' | 'unlocked';

const AUTO_LOCK_MS = 5 * 60 * 1000;

interface VaultState {
  status: VaultStatus;
  entries: ServiceEntry[];
  error: string | null;
  vk: CryptoKey | null;
  lastRecoveryCode: string | null; // 一次性顯示後即清除
  autoLockTimer: ReturnType<typeof setTimeout> | null;

  init: () => Promise<void>;
  create: (masterPassword: string) => Promise<void>;
  unlock: (masterPassword: string) => Promise<void>;
  lock: () => void;
  touch: () => void;
  saveEntry: (entry: ServiceEntry) => Promise<void>;
  saveMany: (entries: ServiceEntry[]) => Promise<void>;
  removeEntry: (id: string) => Promise<void>;
  resetMasterPassword: (
    recoveryCode: string,
    newPassword: string,
  ) => Promise<void>;
  syncWithRemote: (uid: string) => Promise<SyncOutcome>;
  clearRecoveryCode: () => void;
}

export const useVaultStore = create<VaultState>((set, get) => ({
  status: 'loading',
  entries: [],
  error: null,
  vk: null,
  lastRecoveryCode: null,
  autoLockTimer: null,

  init: async () => {
    set({ status: (await hasVault()) ? 'locked' : 'no-vault' });
  },

  create: async (masterPassword) => {
    set({ error: null });
    try {
      const { recoveryCode, vk, ...keyset } = await createVault(masterPassword);
      await saveMeta(keyset);
      get().touch();
      set({
        vk,
        status: 'unlocked',
        entries: [],
        lastRecoveryCode: recoveryCode,
      });
    } catch (e) {
      set({ error: errMsg(e) });
      throw e;
    }
  },

  unlock: async (masterPassword) => {
    set({ error: null });
    const meta = await getMeta();
    if (!meta) {
      set({ error: '找不到本機金庫', status: 'no-vault' });
      return;
    }
    try {
      const vk = await unlockWithMasterPassword(masterPassword, meta);
      const encrypted = await listEncryptedEntries();
      const entries = await Promise.all(
        encrypted.map((rec) => decryptEntry(rec, vk)),
      );
      get().touch();
      set({ vk, entries, status: 'unlocked' });
    } catch {
      // AES-GCM 驗證失敗 → 主密碼錯誤
      set({ error: '主密碼錯誤，請再試一次' });
    }
  },

  lock: () => {
    const { autoLockTimer } = get();
    if (autoLockTimer) clearTimeout(autoLockTimer);
    set({
      vk: null,
      entries: [],
      status: 'locked',
      error: null,
      autoLockTimer: null,
    });
  },

  touch: () => {
    const { autoLockTimer } = get();
    if (autoLockTimer) clearTimeout(autoLockTimer);
    const timer = setTimeout(() => get().lock(), AUTO_LOCK_MS);
    set({ autoLockTimer: timer });
  },

  saveEntry: async (entry) => {
    const { vk, entries } = get();
    if (!vk) throw new Error('金庫未解鎖');
    const enriched: ServiceEntry = {
      ...entry,
      aliases: dedupe([
        ...entry.aliases,
        ...deriveAliases(entry.service, entry.url),
      ]),
      updatedAt: Date.now(),
    };
    // 遞增 rev 但保留 baseRev（上次同步基準），讓同步能偵測到本機變更
    const prev = await getEncryptedEntry(enriched.id);
    const record = await encryptEntry(enriched, vk, (prev?.rev ?? 0) + 1);
    record.baseRev = prev?.baseRev;
    await putEncryptedEntry(record);
    const next = entries.filter((e) => e.id !== enriched.id);
    next.unshift(enriched);
    get().touch();
    set({ entries: next });
  },

  saveMany: async (incoming) => {
    const { vk, entries } = get();
    if (!vk) throw new Error('金庫未解鎖');
    const enriched = incoming.map((entry) => ({
      ...entry,
      aliases: dedupe([
        ...entry.aliases,
        ...deriveAliases(entry.service, entry.url),
      ]),
      updatedAt: Date.now(),
    }));
    for (const e of enriched) {
      const prev = await getEncryptedEntry(e.id);
      const record = await encryptEntry(e, vk, (prev?.rev ?? 0) + 1);
      record.baseRev = prev?.baseRev;
      await putEncryptedEntry(record);
    }
    const ids = new Set(enriched.map((e) => e.id));
    const next = [...enriched, ...entries.filter((e) => !ids.has(e.id))];
    get().touch();
    set({ entries: next });
  },

  removeEntry: async (id) => {
    await dbDelete(id);
    set({ entries: get().entries.filter((e) => e.id !== id) });
  },

  /**
   * 忘記主密碼：以復原碼解回 VK → 用新主密碼重新包裝（並產生全新復原碼，
   * 使舊復原碼失效）→ 解鎖。整個過程在本機完成。
   */
  resetMasterPassword: async (recoveryCode, newPassword) => {
    set({ error: null });
    const meta = await getMeta();
    if (!meta) {
      set({ error: '找不到本機金庫', status: 'no-vault' });
      return;
    }
    let vk: CryptoKey;
    try {
      vk = await recoverWithCode(recoveryCode, meta);
    } catch {
      // AES-GCM 驗證失敗 → 復原碼錯誤
      set({ error: '復原碼錯誤，請確認後再試' });
      throw new Error('復原碼錯誤');
    }
    const keyset = await rekeyVault(vk, newPassword);
    await replaceMeta({
      ...meta,
      kdfParams: keyset.kdfParams,
      wrappedVK_byMEK: keyset.wrappedVK_byMEK,
      wrappedVK_byRK: keyset.wrappedVK_byRK,
      vaultRev: meta.vaultRev + 1, // 主密碼變更 → 遞增整體版本
      updatedAt: Date.now(),
    });
    const encrypted = await listEncryptedEntries();
    const entries = await Promise.all(
      encrypted.map((rec) => decryptEntry(rec, vk)),
    );
    get().touch();
    set({
      vk,
      entries,
      status: 'unlocked',
      lastRecoveryCode: keyset.recoveryCode,
    });
  },

  /** 與遠端雙向同步，完成後以記憶體中的 VK 重新解密本機條目 */
  syncWithRemote: async (uid) => {
    const { vk } = get();
    if (!vk) throw new Error('金庫未解鎖');
    // 動態載入同步鏈（含 Firebase SDK），純本地使用時不進入關鍵路徑
    const { syncNow } = await import('@/sync/sync');
    const outcome = await syncNow(uid);
    // 同步可能下載/新增了條目或衝突副本 → 重新解密整份
    const encrypted = await listEncryptedEntries();
    const entries = await Promise.all(
      encrypted.map((rec) => decryptEntry(rec, vk)),
    );
    get().touch();
    set({ entries });
    return outcome;
  },

  clearRecoveryCode: () => set({ lastRecoveryCode: null }),
}));

function dedupe(arr: string[]): string[] {
  return [...new Set(arr.filter(Boolean))];
}

function errMsg(e: unknown): string {
  return e instanceof Error ? e.message : '發生未知錯誤';
}
