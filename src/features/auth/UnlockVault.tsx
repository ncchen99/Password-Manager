import { useState } from 'react';
import { LockClosedIcon } from '@heroicons/react/24/solid';
import { useVaultStore } from '@/store/vaultStore';
import { ForgotPassword } from './ForgotPassword';

export function UnlockVault() {
  const unlock = useVaultStore((s) => s.unlock);
  const error = useVaultStore((s) => s.error);
  const [pw, setPw] = useState('');
  const [busy, setBusy] = useState(false);
  const [forgotOpen, setForgotOpen] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (busy || !pw) return;
    setBusy(true);
    try {
      await unlock(pw);
    } finally {
      setBusy(false);
      setPw('');
    }
  }

  return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-5 py-10">
      <div className="mb-6 text-center">
        <LockClosedIcon className="mx-auto mb-3 h-12 w-12 text-primary" />
        <h1 className="text-2xl font-bold">解鎖金庫</h1>
        <p className="mt-2 text-sm text-base-content/70">輸入主密碼以解密本機金庫</p>
      </div>

      <form onSubmit={onSubmit} className="space-y-4">
        <label className="form-control">
          <span className="label-text mb-1">主密碼</span>
          <input
            type="password"
            autoComplete="current-password"
            className="input input-bordered touch-target"
            value={pw}
            onChange={(e) => setPw(e.target.value)}
            autoFocus
            aria-invalid={!!error}
          />
        </label>

        {error && (
          <p className="text-sm text-error" role="alert">
            {error}
          </p>
        )}

        <button
          type="submit"
          className="btn btn-primary w-full touch-target"
          disabled={busy || !pw}
        >
          {busy ? <span className="loading loading-spinner" /> : '解鎖'}
        </button>

        <button
          type="button"
          className="btn btn-ghost btn-sm w-full"
          onClick={() => setForgotOpen(true)}
        >
          忘記主密碼？
        </button>
      </form>

      <ForgotPassword open={forgotOpen} onClose={() => setForgotOpen(false)} />
    </div>
  );
}
