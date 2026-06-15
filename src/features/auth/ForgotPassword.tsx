/**
 * 忘記主密碼：輸入復原碼 + 設定新主密碼 → 本機重設並解鎖。
 * 重設成功後會自動產生一組全新復原碼（透過 RecoveryKitModal 一次性顯示）。
 */
import { useState } from 'react';
import { KeyIcon, ExclamationTriangleIcon } from '@heroicons/react/24/outline';
import { ResponsiveSheet } from '@/components/ResponsiveSheet';
import { useVaultStore } from '@/store/vaultStore';

interface Props {
  open: boolean;
  onClose: () => void;
}

export function ForgotPassword({ open, onClose }: Props) {
  const resetMasterPassword = useVaultStore((s) => s.resetMasterPassword);
  const [code, setCode] = useState('');
  const [pw, setPw] = useState('');
  const [pw2, setPw2] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const mismatch = pw2.length > 0 && pw !== pw2;
  const canSubmit = code.trim() && pw.length >= 8 && pw === pw2 && !busy;

  function reset() {
    setCode('');
    setPw('');
    setPw2('');
    setErr(null);
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    setBusy(true);
    setErr(null);
    try {
      await resetMasterPassword(code.trim(), pw);
      reset();
      onClose(); // 成功後金庫解鎖；RecoveryKitModal 會顯示新復原碼
    } catch (e2) {
      setErr(e2 instanceof Error ? e2.message : '復原失敗');
    } finally {
      setBusy(false);
    }
  }

  return (
    <ResponsiveSheet
      open={open}
      title="忘記主密碼"
      onClose={() => {
        reset();
        onClose();
      }}
    >
      <form onSubmit={onSubmit} className="space-y-4">
        <div className="flex items-start gap-2 bg-warning/10 p-3 text-sm">
          <ExclamationTriangleIcon className="mt-0.5 h-5 w-5 shrink-0 text-warning" />
          <span>
            主密碼無法被找回。輸入你保存的<strong>復原碼</strong>
            即可在本機重設一組新主密碼。重設後會產生新的復原碼，舊的即失效。
          </span>
        </div>

        <label className="form-control">
          <span className="label-text mb-1">復原碼</span>
          <input
            type="text"
            inputMode="text"
            autoComplete="off"
            className="input input-bordered touch-target font-mono tracking-wider"
            placeholder="ABCD-EFGH-…"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            autoFocus
          />
        </label>

        <label className="form-control">
          <span className="label-text mb-1">新主密碼（至少 8 字）</span>
          <input
            type="password"
            autoComplete="new-password"
            className="input input-bordered touch-target"
            value={pw}
            onChange={(e) => setPw(e.target.value)}
          />
        </label>

        <label className="form-control">
          <span className="label-text mb-1">再次輸入新主密碼</span>
          <input
            type="password"
            autoComplete="new-password"
            className={`input input-bordered touch-target ${
              mismatch ? 'input-error' : ''
            }`}
            value={pw2}
            onChange={(e) => setPw2(e.target.value)}
          />
        </label>

        {mismatch && (
          <p className="text-sm text-error">兩次輸入的主密碼不一致</p>
        )}
        {err && (
          <p className="text-sm text-error" role="alert">
            {err}
          </p>
        )}

        <button
          type="submit"
          className="btn btn-primary w-full touch-target"
          disabled={!canSubmit}
        >
          {busy ? (
            <span className="loading loading-spinner" />
          ) : (
            <>
              <KeyIcon className="h-5 w-5" />
              以復原碼重設並解鎖
            </>
          )}
        </button>
      </form>
    </ResponsiveSheet>
  );
}
