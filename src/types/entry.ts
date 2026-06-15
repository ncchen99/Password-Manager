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
  /**
   * 本機專用：上次成功與遠端同步時的 rev。用於三方合併偵測「雙方併發修改」。
   * 絕不上傳（remote 序列化時會剝除，且不在 Firestore 欄位白名單內）。
   */
  baseRev?: number;
}
