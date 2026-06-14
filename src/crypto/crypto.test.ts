// @vitest-environment node
import { describe, expect, it } from 'vitest';
import {
  createVault,
  recoverWithCode,
  rewrapForNewMasterPassword,
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

  it('換主密碼後舊密文仍可解、且需新密碼', async () => {
    const vault = await createVault('old-pass');
    const enc = await encryptEntry(sampleEntry(), vault.vk);

    const rewrap = await rewrapForNewMasterPassword(vault.vk, 'new-pass');
    const updated = {
      kdfParams: rewrap.kdfParams,
      wrappedVK_byMEK: rewrap.wrappedVK_byMEK,
    };

    const vk = await unlockWithMasterPassword('new-pass', updated);
    const dec = await decryptEntry(enc, vk);
    expect(dec.credentials[0].password).toBe('S3cr3t!');

    await expect(
      unlockWithMasterPassword('old-pass', updated),
    ).rejects.toBeTruthy();
  });
});
