import { useState } from 'react';
import { ShieldCheckIcon } from '@heroicons/react/24/solid';
import { useVaultStore } from '@/store/vaultStore';

export function CreateVault() {
  const create = useVaultStore((s) => s.create);
  const [pw, setPw] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  const tooShort = pw.length > 0 && pw.length < 8;
  const mismatch = confirm.length > 0 && pw !== confirm;
  const canSubmit = pw.length >= 8 && pw === confirm && !busy;

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    setBusy(true);
    setLocalError(null);
    try {
      await create(pw);
    } catch {
      setLocalError('建立金庫失敗，請再試一次');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-5 py-10">
      <div className="mb-6 text-center">
        <ShieldCheckIcon className="mx-auto mb-3 h-12 w-12 text-primary" />
        <h1 className="text-2xl font-bold">建立你的金庫</h1>
        <p className="mt-2 text-sm text-base-content/70">
          設定主密碼。它只存在你的腦中，永不上傳；忘記後只能用復原碼救回。
        </p>
      </div>

      <form onSubmit={onSubmit} className="space-y-4">
        <label className="form-control">
          <span className="label-text mb-1">主密碼</span>
          <input
            type="password"
            autoComplete="new-password"
            className="input input-bordered touch-target"
            value={pw}
            onChange={(e) => setPw(e.target.value)}
            aria-invalid={tooShort}
          />
          {tooShort && (
            <span className="mt-1 text-xs text-error">至少 8 個字元</span>
          )}
        </label>

        <label className="form-control">
          <span className="label-text mb-1">再次輸入主密碼</span>
          <input
            type="password"
            autoComplete="new-password"
            className="input input-bordered touch-target"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            aria-invalid={mismatch}
          />
          {mismatch && (
            <span className="mt-1 text-xs text-error">兩次輸入不一致</span>
          )}
        </label>

        {localError && (
          <p className="text-sm text-error" role="alert">
            {localError}
          </p>
        )}

        <button
          type="submit"
          className="btn btn-primary w-full touch-target"
          disabled={!canSubmit}
        >
          {busy ? <span className="loading loading-spinner" /> : '建立金庫'}
        </button>
      </form>
    </div>
  );
}
