/** 解密後的資料模型（只在記憶體中存在，永不上傳明文） */

export interface Credential {
  id: string;
  username?: string;
  password?: string;
  otp?: string;
  note?: string;
}

export interface ServiceEntry {
  id: string;
  service: string;
  aliases: string[];
  url?: string;
  tags: string[];
  credentials: Credential[];
  createdAt: number;
  updatedAt: number;
}

/** IndexedDB / Firestore 中實際儲存的密文記錄（非敏感） */
export interface EncryptedEntry {
  id: string;
  ciphertext: string; // base64
  iv: string; // base64
  rev: number;
  updatedAt: number;
  conflictOf?: string;
}
