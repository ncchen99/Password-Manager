/**
 * 帳號 / 同步狀態（Zustand）。與金庫解鎖分離：
 * 登入只用來定位雲端密文；解密金鑰（VK）永遠只在 vaultStore 的記憶體中。
 * 未設定 Firebase 時 enabled=false，UI 不顯示同步功能（純本地模式）。
 */
import { create } from 'zustand';
import { isFirebaseConfigured } from '@/firebase/config';
import type { AuthUser } from '@/firebase/auth';
import { useVaultStore } from './vaultStore';

export type SyncState = 'idle' | 'signing-in' | 'syncing' | 'ok' | 'error';

interface AuthState {
  enabled: boolean;
  user: AuthUser | null;
  syncState: SyncState;
  lastSyncAt: number | null;
  lastSummary: string | null;
  error: string | null;

  init: () => void;
  signIn: () => Promise<void>;
  signOut: () => Promise<void>;
  sync: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  enabled: isFirebaseConfigured,
  user: null,
  syncState: 'idle',
  lastSyncAt: null,
  lastSummary: null,
  error: null,

  init: () => {
    if (!isFirebaseConfigured) return;
    // 動態載入，避免未設定 Firebase 時把 SDK 拉進關鍵路徑
    void import('@/firebase/auth').then(({ subscribeAuth }) => {
      subscribeAuth((user) => {
        set({ user });
        // 登入且金庫已解鎖時自動同步一次
        if (user && useVaultStore.getState().status === 'unlocked') {
          void get().sync();
        }
      });
    });
  },

  signIn: async () => {
    set({ syncState: 'signing-in', error: null });
    try {
      const { signInWithGoogle } = await import('@/firebase/auth');
      const user = await signInWithGoogle();
      set({ user, syncState: 'idle' });
      if (useVaultStore.getState().status === 'unlocked') await get().sync();
    } catch (e) {
      set({ syncState: 'error', error: errMsg(e) });
    }
  },

  signOut: async () => {
    const { signOutUser } = await import('@/firebase/auth');
    await signOutUser();
    set({ user: null, syncState: 'idle', lastSummary: null });
  },

  sync: async () => {
    const { user } = get();
    if (!user) return;
    if (useVaultStore.getState().status !== 'unlocked') return;
    set({ syncState: 'syncing', error: null });
    try {
      const o = await useVaultStore.getState().syncWithRemote(user.uid);
      set({
        syncState: 'ok',
        lastSyncAt: Date.now(),
        lastSummary: `↑${o.pushed} ↓${o.pulled}${
          o.conflicts ? ` ⚠︎${o.conflicts} 衝突` : ''
        }`,
      });
    } catch (e) {
      set({ syncState: 'error', error: errMsg(e) });
    }
  },
}));

function errMsg(e: unknown): string {
  return e instanceof Error ? e.message : '同步失敗';
}
