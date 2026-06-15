// @vitest-environment node
import { describe, expect, it } from 'vitest';
import {
  createPasswordlessVault,
  createVault,
  recoverWithCode,
  rekeyVault,
  unlockWithMasterPassword,
} from './vaultSetup';
import { decryptEntry, encryptEntry } from './vault';
import type { ServiceEntry } from '@/types/entry';

function sampleEntry(): ServiceEntry {
  return {
    id: 'e1',
    service: 'Facebook',
    aliases: ['fb'],
    url: 'facebook.com',
    tags: ['社群'],
    credentials: [{ id: 'c1', username: 'me@example.com', password: 'S3cr3t!' }],
    createdAt: 1,
    updatedAt: 1,
  };
}

describe('金鑰階層與加解密', () => {
  it('建立金庫後可用主密碼解鎖並還原條目', async () => {
    const vault = await createVault('correct horse battery');
    const enc = await encryptEntry(sampleEntry(), vault.vk);

    // 密文不應含明文密碼
    expect(enc.ciphertext).not.toContain('S3cr3t');

    const vk = await unlockWithMasterPassword('correct horse battery', vault);
    const dec = await decryptEntry(enc, vk);
    expect(dec.credentials[0].password).toBe('S3cr3t!');
  });

  it('錯誤主密碼無法解鎖（AES-GCM 驗證失敗）', async () => {
    const vault = await createVault('right-password');
    await expect(
      unlockWithMasterPassword('wrong-password', vault),
    ).rejects.toBeTruthy();
  });

  it('復原碼可取回金庫', async () => {
    const vault = await createVault('master-1');
    const enc = await encryptEntry(sampleEntry(), vault.vk);

    const vk = await recoverWithCode(vault.recoveryCode, vault);
    const dec = await decryptEntry(enc, vk);
    expect(dec.service).toBe('Facebook');
  });

  it('免密碼金庫：無 MEK，僅能用復原碼取回', async () => {
    const vault = await createPasswordlessVault();
    expect(vault).not.toHaveProperty('wrappedVK_byMEK');

    const enc = await encryptEntry(sampleEntry(), vault.vk);
    const vk = await recoverWithCode(vault.recoveryCode, vault);
    const dec = await decryptEntry(enc, vk);
    expect(dec.credentials[0].password).toBe('S3cr3t!');

    // 沒有主密碼包裝 → 主密碼解鎖路徑直接拒絕
    await expect(
      unlockWithMasterPassword('anything', vault),
    ).rejects.toBeTruthy();
  });

  it('換主密碼後舊密文仍可解、且需新密碼；舊復原碼失效（#9）', async () => {
    const vault = await createVault('old-pass');
    const enc = await encryptEntry(sampleEntry(), vault.vk);

    const rekey = await rekeyVault(vault.vk, 'new-pass');
    const updated = {
      kdfParams: rekey.kdfParams,
      wrappedVK_byMEK: rekey.wrappedVK_byMEK,
      wrappedVK_byRK: rekey.wrappedVK_byRK,
    };

    const vk = await unlockWithMasterPassword('new-pass', updated);
    const dec = await decryptEntry(enc, vk);
    expect(dec.credentials[0].password).toBe('S3cr3t!');

    await expect(
      unlockWithMasterPassword('old-pass', updated),
    ).rejects.toBeTruthy();

    // rekey 會產生全新復原碼：舊復原碼必須失效，新復原碼可解。
    expect(rekey.recoveryCode).not.toBe(vault.recoveryCode);
    await expect(
      recoverWithCode(vault.recoveryCode, updated),
    ).rejects.toBeTruthy();
    const vk2 = await recoverWithCode(rekey.recoveryCode, updated);
    expect((await decryptEntry(enc, vk2)).service).toBe('Facebook');
  });

  it('日常解鎖的 VK 不可匯出，復原取回的 VK 可匯出（#1）', async () => {
    const vault = await createVault('correct horse battery');
    const unlocked = await unlockWithMasterPassword(
      'correct horse battery',
      vault,
    );
    expect(unlocked.extractable).toBe(false);
    const recovered = await recoverWithCode(vault.recoveryCode, vault);
    expect(recovered.extractable).toBe(true);
  });

  it('AAD 綁定 id：同一 VK 下，他筆 id 無法解開此筆密文（#4）', async () => {
    const vault = await createVault('master-aad');
    const enc = await encryptEntry(sampleEntry(), vault.vk); // id = 'e1'
    // 把密文搬到另一個 id 的記錄 → AAD 不符 → 解密失敗
    await expect(
      decryptEntry({ ...enc, id: 'other-id' }, vault.vk),
    ).rejects.toBeTruthy();
  });
});
