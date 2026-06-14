/**
 * 金鑰派生（KDF）：主密碼 / 復原碼 → 32-byte 對稱金鑰原料。
 * 主選 Argon2id（hash-wasm，純前端 WASM）；WASM 不可用時降級 PBKDF2。
 * 派生出的位元組永不離開裝置、永不寫入持久層。
 */
import { argon2id } from 'hash-wasm';
import { base64ToBytes, bytesToBase64, utf8ToBytes } from './encoding';

export type KdfAlgo = 'argon2id' | 'pbkdf2';

export interface KdfParams {
  algo: KdfAlgo;
  salt: string; // base64
  // argon2id
  memorySizeKiB?: number;
  iterations?: number;
  parallelism?: number;
  // pbkdf2
  pbkdf2Iterations?: number;
}

const ARGON2_DEFAULTS = {
  memorySizeKiB: 65536, // 64 MiB
  iterations: 3,
  parallelism: 1,
};

const PBKDF2_ITERATIONS = 600_000;

export function generateSalt(length = 16): Uint8Array {
  return crypto.getRandomValues(new Uint8Array(length));
}

export function defaultKdfParams(): KdfParams {
  // 偵測 WASM 可用性，決定預設演算法
  const wasmOk = typeof WebAssembly === 'object';
  const salt = bytesToBase64(generateSalt());
  return wasmOk
    ? { algo: 'argon2id', salt, ...ARGON2_DEFAULTS }
    : { algo: 'pbkdf2', salt, pbkdf2Iterations: PBKDF2_ITERATIONS };
}

/** 派生 32-byte 原始金鑰原料 */
export async function deriveKeyMaterial(
  secret: string,
  params: KdfParams,
): Promise<Uint8Array> {
  const salt = base64ToBytes(params.salt);

  if (params.algo === 'argon2id') {
    const hash = await argon2id({
      password: secret,
      salt,
      parallelism: params.parallelism ?? ARGON2_DEFAULTS.parallelism,
      iterations: params.iterations ?? ARGON2_DEFAULTS.iterations,
      memorySize: params.memorySizeKiB ?? ARGON2_DEFAULTS.memorySizeKiB,
      hashLength: 32,
      outputType: 'binary',
    });
    return hash;
  }

  // PBKDF2 fallback（WebCrypto）
  const baseKey = await crypto.subtle.importKey(
    'raw',
    toArrayBuffer(utf8ToBytes(secret)),
    'PBKDF2',
    false,
    ['deriveBits'],
  );
  const bits = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt: toArrayBuffer(salt),
      iterations: params.pbkdf2Iterations ?? PBKDF2_ITERATIONS,
      hash: 'SHA-256',
    },
    baseKey,
    256,
  );
  return new Uint8Array(bits);
}

/** 把派生原料匯入成可用於 wrap/unwrap 的 AES-GCM 金鑰（不可匯出） */
export async function importWrappingKey(
  keyMaterial: Uint8Array,
): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    'raw',
    toArrayBuffer(keyMaterial),
    { name: 'AES-GCM', length: 256 },
    false,
    ['wrapKey', 'unwrapKey', 'encrypt', 'decrypt'],
  );
}

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  return bytes.buffer.slice(
    bytes.byteOffset,
    bytes.byteOffset + bytes.byteLength,
  ) as ArrayBuffer;
}
