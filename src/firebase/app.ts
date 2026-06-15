/**
 * Firebase 初始化（lazy、單例）。
 * 只有在已設定 projectId 時才會建立實例；Auth 僅用於「定位使用者的密文」，
 * 與加解密金鑰完全分離（伺服器永遠拿不到 VK 或主密碼）。
 */
import { initializeApp, type FirebaseApp } from 'firebase/app';
import { getAuth, connectAuthEmulator, type Auth } from 'firebase/auth';
import {
  getFirestore,
  connectFirestoreEmulator,
  type Firestore,
} from 'firebase/firestore';
import { firebaseConfig, isFirebaseConfigured, useEmulators } from './config';

let app: FirebaseApp | null = null;
let authInstance: Auth | null = null;
let dbInstance: Firestore | null = null;
let emulatorsConnected = false;

function ensureApp(): FirebaseApp {
  if (!isFirebaseConfigured) {
    throw new Error('Firebase 尚未設定（缺少 VITE_FB_PROJECT_ID）');
  }
  if (!app) app = initializeApp(firebaseConfig);
  return app;
}

export function getAuthInstance(): Auth {
  if (!authInstance) {
    authInstance = getAuth(ensureApp());
    if (useEmulators && !emulatorsConnected) connectEmulators();
  }
  return authInstance;
}

export function getDb(): Firestore {
  if (!dbInstance) {
    dbInstance = getFirestore(ensureApp());
    if (useEmulators && !emulatorsConnected) connectEmulators();
  }
  return dbInstance;
}

function connectEmulators(): void {
  if (emulatorsConnected) return;
  emulatorsConnected = true;
  if (authInstance) {
    connectAuthEmulator(authInstance, 'http://localhost:9099', {
      disableWarnings: true,
    });
  }
  if (dbInstance) {
    connectFirestoreEmulator(dbInstance, 'localhost', 8080);
  }
}
