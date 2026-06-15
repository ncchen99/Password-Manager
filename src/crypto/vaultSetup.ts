/**
 * 高階金鑰流程編排：建立金庫、解鎖、換主密碼、復原。
 * 回傳的 VK CryptoKey 僅供記憶體使用；wrapped 結果可安全存 IndexedDB / Firestore。
 */
import {
  deriveKeyMaterial,
  defaultKdfParams,
  importWrappingKey,
  type KdfParams,
} from './kdf';
import {
  generateVaultKey,
  unwrapVaultKey,
  wrapVaultKey,
  type WrappedKey,
} from './keyWrap';
import { generateRecoveryCode, normalizeRecoveryCode } from './recovery';

export interface VaultKeyset {
  kdfParams: KdfParams;
  wrappedVK_byMEK: WrappedKey;
  wrappedVK_byRK: WrappedKey;
}

export interface NewVault extends VaultKeyset {
  recoveryCode: string;
  vk: CryptoKey;
}

/** 建立新金庫：產生 VK + 復原碼，並用 MEK / RK 各包裝一份 */
export async function createVault(masterPassword: string): Promise<NewVault> {
  const kdfParams = defaultKdfParams();
  const recoveryCode = generateRecoveryCode();

  const mek = await importWrappingKey(
    await deriveKeyMaterial(masterPassword, kdfParams),
  );
  const rk = await importWrappingKey(
    await deriveKeyMaterial(normalizeRecoveryCode(recoveryCode), kdfParams),
  );

  const vk = await generateVaultKey();
  const wrappedVK_byMEK = await wrapVaultKey(vk, mek);
  const wrappedVK_byRK = await wrapVaultKey(vk, rk);

  return { kdfParams, wrappedVK_byMEK, wrappedVK_byRK, recoveryCode, vk };
}

/**
 * 以既有 VK 重新建立整組金鑰包裝：產生新的 kdfParams、新主密碼的 MEK、
 * 以及**全新的復原碼**（使舊復原碼失效，符合規格 §10.2）。
 * 用於「忘記主密碼」復原後重設，或已解鎖狀態下重新產生 Emergency Kit。
 * MEK 與 RK 共用同一份 kdfParams，確保兩份 wrap 永遠可被對應金鑰解開。
 */
export async function rekeyVault(
  vk: CryptoKey,
  newMasterPassword: string,
): Promise<Omit<NewVault, 'vk'>> {
  const kdfParams = defaultKdfParams();
  const recoveryCode = generateRecoveryCode();

  const mek = await importWrappingKey(
    await deriveKeyMaterial(newMasterPassword, kdfParams),
  );
  const rk = await importWrappingKey(
    await deriveKeyMaterial(normalizeRecoveryCode(recoveryCode), kdfParams),
  );

  const wrappedVK_byMEK = await wrapVaultKey(vk, mek);
  const wrappedVK_byRK = await wrapVaultKey(vk, rk);

  return { kdfParams, wrappedVK_byMEK, wrappedVK_byRK, recoveryCode };
}

/** 用主密碼解鎖：派生 MEK → unwrap VK */
export async function unlockWithMasterPassword(
  masterPassword: string,
  keyset: Pick<VaultKeyset, 'kdfParams' | 'wrappedVK_byMEK'>,
): Promise<CryptoKey> {
  const mek = await importWrappingKey(
    await deriveKeyMaterial(masterPassword, keyset.kdfParams),
  );
  return unwrapVaultKey(keyset.wrappedVK_byMEK, mek);
}

/** 用復原碼取回 VK */
export async function recoverWithCode(
  recoveryCode: string,
  keyset: Pick<VaultKeyset, 'kdfParams' | 'wrappedVK_byRK'>,
): Promise<CryptoKey> {
  const rk = await importWrappingKey(
    await deriveKeyMaterial(
      normalizeRecoveryCode(recoveryCode),
      keyset.kdfParams,
    ),
  );
  return unwrapVaultKey(keyset.wrappedVK_byRK, rk);
}

/**
 * 換主密碼：用既有 VK 以新主密碼重新包裝；金庫密文不必重算。
 * 回傳新的 kdfParams 與 wrappedVK_byMEK（wrappedVK_byRK 不變）。
 */
export async function rewrapForNewMasterPassword(
  vk: CryptoKey,
  newMasterPassword: string,
): Promise<{ kdfParams: KdfParams; wrappedVK_byMEK: WrappedKey }> {
  const kdfParams = defaultKdfParams();
  const mek = await importWrappingKey(
    await deriveKeyMaterial(newMasterPassword, kdfParams),
  );
  const wrappedVK_byMEK = await wrapVaultKey(vk, mek);
  return { kdfParams, wrappedVK_byMEK };
}
