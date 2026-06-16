import { useEffect, useState } from 'react';
import { ArrowDownTrayIcon, XMarkIcon } from '@heroicons/react/24/outline';

/** Chrome / Edge 的 beforeinstallprompt 事件型別（非標準，TS lib 未內建） */
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

const DISMISS_KEY = 'safevault.installDismissed';

function isStandalone(): boolean {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    // iOS Safari
    (window.navigator as unknown as { standalone?: boolean }).standalone === true
  );
}

/**
 * 安裝橫幅（A2HS）。只在瀏覽器釋出 beforeinstallprompt、且使用者尚未安裝/
 * 未曾關閉時顯示。純前端、無網路。
 */
export function InstallPrompt() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  // 延後出現：進站不馬上跳，等使用者實際用一陣子才提示，降低干擾。
  const [ready, setReady] = useState(false);
  const [hidden, setHidden] = useState(
    () => isStandalone() || localStorage.getItem(DISMISS_KEY) === '1',
  );

  useEffect(() => {
    if (hidden) return;
    const timer = window.setTimeout(() => setReady(true), 20_000);
    return () => window.clearTimeout(timer);
  }, [hidden]);

  useEffect(() => {
    if (hidden) return;
    function onPrompt(e: Event) {
      e.preventDefault(); // 攔截瀏覽器預設小橫幅，改由我們控制時機
      setDeferred(e as BeforeInstallPromptEvent);
    }
    function onInstalled() {
      setHidden(true);
      setDeferred(null);
    }
    window.addEventListener('beforeinstallprompt', onPrompt);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, [hidden]);

  if (hidden || !ready || !deferred) return null;

  async function install() {
    if (!deferred) return;
    await deferred.prompt();
    await deferred.userChoice;
    setDeferred(null);
  }

  function dismiss() {
    localStorage.setItem(DISMISS_KEY, '1');
    setHidden(true);
  }

  return (
    // 外層滿版：背景與邊框延伸到整個畫面寬；內容置中於 max-w-2xl 容器內。
    <div
      role="dialog"
      aria-label="安裝 SafeVault"
      className="fixed inset-x-0 top-0 z-50 border-b border-base-300 bg-base-100/95 backdrop-blur"
    >
      <div
        className="mx-auto flex max-w-2xl items-center gap-3 px-4 py-2"
        style={{ paddingTop: 'calc(env(safe-area-inset-top) + 0.5rem)' }}
      >
        <ArrowDownTrayIcon className="h-5 w-5 shrink-0 text-primary" />
        <p className="flex-1 text-sm">
          安裝 SafeVault 到主畫面，離線也能開啟。
        </p>
        <button className="btn btn-primary btn-sm touch-target" onClick={install}>
          安裝
        </button>
        <button
          className="btn btn-ghost btn-sm btn-circle touch-target"
          onClick={dismiss}
          aria-label="關閉安裝提示"
        >
          <XMarkIcon className="h-5 w-5" />
        </button>
      </div>
    </div>
  );
}
