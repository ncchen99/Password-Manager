import { ArrowPathIcon, XMarkIcon } from '@heroicons/react/24/outline';
import { useRegisterSW } from 'virtual:pwa-register/react';

/**
 * 更新提示（#11）。PWA 改為 registerType: 'prompt' 後，新版 Service Worker 不會
 * 自動接管；偵測到等待中的新版本時顯示此橫幅，由使用者明確按下才套用並重新載入。
 * 對密碼管理器而言，避免 hosting/CDN 遭入侵時惡意版本在背景靜默生效。
 */
export function UpdatePrompt() {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW();

  if (!needRefresh) return null;

  return (
    <div
      role="dialog"
      aria-label="有新版本可更新"
      className="fixed inset-x-0 bottom-0 z-50 mx-auto flex max-w-2xl items-center gap-3 border-t border-base-300 bg-base-100/95 px-4 py-2 backdrop-blur"
      style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 0.5rem)' }}
    >
      <ArrowPathIcon className="h-5 w-5 shrink-0 text-primary" />
      <p className="flex-1 text-sm">有新版本可用，更新後重新載入以套用。</p>
      <button
        className="btn btn-primary btn-sm touch-target"
        onClick={() => void updateServiceWorker(true)}
      >
        更新
      </button>
      <button
        className="btn btn-ghost btn-sm btn-circle touch-target"
        onClick={() => setNeedRefresh(false)}
        aria-label="稍後再更新"
      >
        <XMarkIcon className="h-5 w-5" />
      </button>
    </div>
  );
}
