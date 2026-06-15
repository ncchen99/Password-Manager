/**
 * 同步控制：Google 登入 / 登出、手動同步、狀態顯示。
 * 僅在已設定 Firebase 時顯示（authStore.enabled）。雲端只持有密文（零知識）。
 */
import {
  ArrowPathIcon,
  CloudIcon,
  ArrowRightOnRectangleIcon,
} from '@heroicons/react/24/outline';
import { useAuthStore } from '@/store/authStore';

export function SyncControls() {
  const enabled = useAuthStore((s) => s.enabled);
  const user = useAuthStore((s) => s.user);
  const syncState = useAuthStore((s) => s.syncState);
  const lastSummary = useAuthStore((s) => s.lastSummary);
  const error = useAuthStore((s) => s.error);
  const signIn = useAuthStore((s) => s.signIn);
  const signOut = useAuthStore((s) => s.signOut);
  const sync = useAuthStore((s) => s.sync);

  if (!enabled) return null;

  if (!user) {
    return (
      <button
        className="btn btn-ghost btn-sm touch-target gap-1"
        onClick={() => void signIn()}
        disabled={syncState === 'signing-in'}
        title="登入以啟用端對端加密同步"
      >
        {syncState === 'signing-in' ? (
          <span className="loading loading-spinner loading-xs" />
        ) : (
          <CloudIcon className="h-5 w-5" />
        )}
        <span className="hidden sm:inline">同步</span>
      </button>
    );
  }

  const syncing = syncState === 'syncing';
  return (
    <div className="dropdown dropdown-end">
      <button
        tabIndex={0}
        className="btn btn-ghost btn-sm btn-circle touch-target"
        aria-label="同步選單"
        title={
          error
            ? `同步錯誤：${error}`
            : lastSummary
              ? `上次同步：${lastSummary}`
              : '已登入'
        }
      >
        <CloudIcon
          className={`h-5 w-5 ${error ? 'text-error' : 'text-success'}`}
        />
      </button>
      <ul
        tabIndex={0}
        className="dropdown-content menu z-30 mt-2 w-60 rounded-box border border-base-300 bg-base-100 p-2 shadow-lg"
      >
        <li className="menu-title truncate text-xs">
          {user.email ?? user.displayName ?? '已登入'}
        </li>
        {(lastSummary || error) && (
          <li className="px-2 py-1 text-xs text-base-content/60">
            {error ? `⚠︎ ${error}` : `上次同步 ${lastSummary}`}
          </li>
        )}
        <li>
          <button onClick={() => void sync()} disabled={syncing}>
            <ArrowPathIcon
              className={`h-5 w-5 ${syncing ? 'animate-spin' : ''}`}
            />
            {syncing ? '同步中…' : '立即同步'}
          </button>
        </li>
        <li>
          <button onClick={() => void signOut()}>
            <ArrowRightOnRectangleIcon className="h-5 w-5" />
            登出
          </button>
        </li>
        <li className="px-2 pt-1 text-[11px] leading-snug text-base-content/50">
          雲端只存密文，無法解讀你的密碼（零知識）。
        </li>
      </ul>
    </div>
  );
}
