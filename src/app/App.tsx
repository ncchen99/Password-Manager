import { useEffect } from 'react';
import { useVaultStore } from '@/store/vaultStore';
import { useTheme } from './useTheme';
import { CreateVault } from '@/features/auth/CreateVault';
import { UnlockVault } from '@/features/auth/UnlockVault';
import { RecoveryKitModal } from '@/features/auth/RecoveryKitModal';
import { VaultPage } from '@/features/vault/VaultPage';

export function App() {
  const status = useVaultStore((s) => s.status);
  const init = useVaultStore((s) => s.init);
  useTheme(); // 套用主題

  useEffect(() => {
    void init();
  }, [init]);

  return (
    <>
      {status === 'loading' && (
        <div className="flex min-h-dvh items-center justify-center">
          <span className="loading loading-spinner loading-lg text-primary" />
        </div>
      )}
      {status === 'no-vault' && <CreateVault />}
      {status === 'locked' && <UnlockVault />}
      {status === 'unlocked' && <VaultPage />}

      {/* 建立金庫後一次性顯示復原碼 */}
      <RecoveryKitModal />
    </>
  );
}
