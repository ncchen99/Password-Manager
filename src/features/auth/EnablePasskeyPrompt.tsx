/**
 * 解鎖後的一次性建議：在這台裝置啟用指紋解鎖。
 * 觸發時機：用復原碼還原、或以主密碼建立/解鎖且此裝置支援指紋卻尚未啟用。
 * 純本機操作（PRF 包裝 VK），秘密不離開裝置。
 */
import { useState } from 'react';
import { FingerPrintIcon } from '@heroicons/react/24/outline';
import { ResponsiveSheet } from '@/components/ResponsiveSheet';
import { useVaultStore } from '@/store/vaultStore';

export function EnablePasskeyPrompt() {
  const suggest = useVaultStore((s) => s.suggestPasskey);
  const status = useVaultStore((s) => s.status);
  const passkeySupported = useVaultStore((s) => s.passkeySupported);
  const hasPasskey = useVaultStore((s) => s.hasPasskey);
  const enablePasskey = useVaultStore((s) => s.enablePasskey);
  const dismiss = useVaultStore((s) => s.dismissPasskeySuggestion);

  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const show =
    suggest && status === 'unlocked' && passkeySupported && !hasPasskey;
  if (!show) return null;

  async function onEnable() {
    setBusy(true);
    setErr(null);
    try {
      await enablePasskey(); // 觸發系統指紋註冊
    } catch (e) {
      setErr(e instanceof Error ? e.message : '指紋啟用失敗');
    } finally {
      setBusy(false);
    }
  }

  return (
    <ResponsiveSheet open title="" onClose={dismiss}>
      <div className="text-center">
        <FingerPrintIcon className="mx-auto mb-2 h-10 w-10 text-primary" />
        <h2 className="text-xl font-bold">在這台裝置啟用指紋解鎖？</h2>
        <p className="mt-2 text-sm text-base-content/70">
          啟用後，下次開啟用指紋即可解鎖，免再輸入復原碼或主密碼。
          指紋秘密只留在本機、永不上傳。
        </p>
      </div>

      {err && (
        <p className="mt-4 text-center text-sm text-error" role="alert">
          {err}
        </p>
      )}

      <div className="mt-5 space-y-2">
        <button
          className="btn btn-primary w-full touch-target"
          onClick={() => void onEnable()}
          disabled={busy}
        >
          {busy ? (
            <span className="loading loading-spinner" />
          ) : (
            <>
              <FingerPrintIcon className="h-5 w-5" />
              啟用指紋解鎖
            </>
          )}
        </button>
        <button
          className="btn btn-ghost w-full text-base-content/60 touch-target"
          onClick={dismiss}
          disabled={busy}
        >
          稍後再說
        </button>
      </div>
    </ResponsiveSheet>
  );
}
