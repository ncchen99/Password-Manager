/**
 * Emergency Kit：一次性顯示復原碼，可下載。關閉後即從記憶體清除。
 * 提醒使用者離線保管；主密碼與復原碼同時遺失即無法復原（無後門）。
 */
import { useState } from 'react';
import {
  ClipboardDocumentIcon,
  ArrowDownTrayIcon,
  KeyIcon,
} from '@heroicons/react/24/outline';
import { ResponsiveSheet } from '@/components/ResponsiveSheet';
import { useVaultStore } from '@/store/vaultStore';

export function RecoveryKitModal() {
  const code = useVaultStore((s) => s.lastRecoveryCode);
  const clear = useVaultStore((s) => s.clearRecoveryCode);
  const [confirmed, setConfirmed] = useState(false);
  const [copied, setCopied] = useState(false);

  if (!code) return null;

  function download() {
    const content = [
      'SafeVault 緊急復原套件 (Emergency Kit)',
      '====================================',
      '',
      '復原碼（請離線妥善保管，切勿截圖上傳）：',
      code!,
      '',
      `產生時間：${new Date().toLocaleString()}`,
      '',
      '說明：忘記主密碼時，輸入此復原碼即可重設。',
      '主密碼與復原碼同時遺失將無法復原資料（無後門）。',
    ].join('\n');
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'SafeVault-Emergency-Kit.txt';
    a.click();
    URL.revokeObjectURL(url);
  }

  async function copy() {
    await navigator.clipboard.writeText(code!);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <ResponsiveSheet open title="" onClose={() => confirmed && clear()}>
      <div className="text-center">
        <KeyIcon className="mx-auto mb-2 h-10 w-10 text-warning" />
        <h2 className="text-xl font-bold">保存你的復原碼</h2>
        <p className="mt-2 text-sm text-base-content/70">
          這是唯一一次顯示。忘記主密碼時，只能靠它救回金庫。
        </p>
      </div>

      <div className="my-5 select-all rounded-xl border border-base-300 bg-base-200 p-4 text-center font-mono text-base tracking-widest">
        {code}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <button className="btn btn-outline touch-target" onClick={copy}>
          <ClipboardDocumentIcon className="h-5 w-5" />
          {copied ? '已複製' : '複製'}
        </button>
        <button className="btn btn-outline touch-target" onClick={download}>
          <ArrowDownTrayIcon className="h-5 w-5" />
          下載
        </button>
      </div>

      <label className="mt-5 flex cursor-pointer items-start gap-3">
        <input
          type="checkbox"
          className="checkbox checkbox-primary mt-0.5"
          checked={confirmed}
          onChange={(e) => setConfirmed(e.target.checked)}
        />
        <span className="text-sm">
          我已離線安全保存復原碼，了解遺失後無法由客服代為復原。
        </span>
      </label>

      <button
        className="btn btn-primary mt-4 w-full touch-target"
        disabled={!confirmed}
        onClick={() => clear()}
      >
        完成
      </button>
    </ResponsiveSheet>
  );
}
