/**
 * Firestore Security Rules 測試（零知識邊界驗證）。
 *
 * 預設跳過：需要 `@firebase/rules-unit-testing` 與 Firestore Emulator。
 * 執行方式：
 *   npm i -D @firebase/rules-unit-testing
 *   firebase emulators:exec --config firebase/firebase.json --only firestore \
 *     "RUN_RULES_TESTS=true npx vitest run src/sync/rules.test.ts"
 *
 * 驗證重點：
 *  - 只能讀寫自己 uid 底下的資料（跨 uid 一律拒絕）
 *  - meta 與 entries 僅允許白名單欄位（防止意外寫入明文）
 */
import { describe, it, beforeAll, afterAll } from 'vitest';
import { readFileSync } from 'node:fs';

const RUN = process.env.RUN_RULES_TESTS === 'true';

/* eslint-disable @typescript-eslint/no-explicit-any */
describe.skipIf(!RUN)('firestore.rules — 零知識存取邊界', () => {
  let testEnv: any;
  let assertFails: (p: Promise<unknown>) => Promise<unknown>;
  let assertSucceeds: (p: Promise<unknown>) => Promise<unknown>;

  beforeAll(async () => {
    // 以變數間接 import，避免未安裝相依時 tsc 解析失敗
    const moduleName = '@firebase/rules-unit-testing';
    const rut: any = await import(/* @vite-ignore */ moduleName);
    assertFails = rut.assertFails;
    assertSucceeds = rut.assertSucceeds;
    testEnv = await rut.initializeTestEnvironment({
      projectId: 'safevault-rules-test',
      firestore: { rules: readFileSync('firebase/firestore.rules', 'utf8') },
    });
  });

  afterAll(async () => {
    await testEnv?.cleanup();
  });

  it('允許讀寫自己的 meta（白名單欄位）', async () => {
    const db = testEnv.authenticatedContext('alice').firestore();
    await assertSucceeds(
      db.doc('users/alice').set({
        kdfParams: { algo: 'argon2id', salt: 'x' },
        wrappedVK_byMEK: { ct: 'a', iv: 'b' },
        wrappedVK_byRK: { ct: 'a', iv: 'b' },
        vaultRev: 1,
        updatedAt: 1,
      }),
    );
  });

  it('拒絕讀取他人 uid 的資料', async () => {
    const db = testEnv.authenticatedContext('alice').firestore();
    await assertFails(db.doc('users/bob').get());
  });

  it('拒絕未授權欄位（防止明文外洩）', async () => {
    const db = testEnv.authenticatedContext('alice').firestore();
    await assertFails(
      db.doc('users/alice/entries/e1').set({
        ciphertext: 'c',
        iv: 'i',
        rev: 1,
        updatedAt: 1,
        plaintextPassword: 'oops', // 不在白名單 → 應被拒
      }),
    );
  });

  it('允許寫入白名單內的密文條目', async () => {
    const db = testEnv.authenticatedContext('alice').firestore();
    await assertSucceeds(
      db.doc('users/alice/entries/e2').set({
        ciphertext: 'c',
        iv: 'i',
        rev: 1,
        updatedAt: 1,
        conflictOf: 'e1',
      }),
    );
  });

  it('未登入一律拒絕', async () => {
    const db = testEnv.unauthenticatedContext().firestore();
    await assertFails(db.doc('users/alice').get());
  });
});
