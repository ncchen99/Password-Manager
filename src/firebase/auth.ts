/**
 * Google 登入封裝。Auth 只用來識別「這是誰的密文」，
 * 與金庫解鎖（主密碼 → VK）完全分離：登入 ≠ 解鎖。
 */
import {
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  onAuthStateChanged,
  type User,
} from 'firebase/auth';
import { getAuthInstance } from './app';

export interface AuthUser {
  uid: string;
  displayName: string | null;
  email: string | null;
}

function toAuthUser(u: User): AuthUser {
  return { uid: u.uid, displayName: u.displayName, email: u.email };
}

export async function signInWithGoogle(): Promise<AuthUser> {
  const provider = new GoogleAuthProvider();
  const cred = await signInWithPopup(getAuthInstance(), provider);
  return toAuthUser(cred.user);
}

export async function signOutUser(): Promise<void> {
  await signOut(getAuthInstance());
}

/** 訂閱登入狀態變化；回傳取消訂閱函式 */
export function subscribeAuth(cb: (user: AuthUser | null) => void): () => void {
  return onAuthStateChanged(getAuthInstance(), (u) =>
    cb(u ? toAuthUser(u) : null),
  );
}
