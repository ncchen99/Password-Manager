# SafeVault — 零知識智慧密碼管理器 (PWA)

端對端加密、可離線、可安裝的密碼管理器。**密碼明文與金鑰永不離開裝置**。

## 技術堆疊

- **前端**：React 18 + TypeScript (strict) + Vite 6
- **PWA**：vite-plugin-pwa (Workbox) — service worker / manifest / 可安裝 / 離線
- **樣式**：Tailwind CSS + DaisyUI（自訂淺/深色 theme，WCAG AA）+ Heroicons
- **本地儲存**：IndexedDB via Dexie（只存密文）
- **加密**：WebCrypto AES-256-GCM + Argon2id（hash-wasm，PBKDF2 fallback）
- **狀態**：Zustand（VK 與解密資料僅存記憶體，閒置 5 分鐘自動上鎖）
- **後端**（M3+）：Firebase Auth(Google) / Firestore / Functions / Hosting / Emulators

## 安全架構（金鑰包裝）

```
主密碼 ─Argon2id→ MEK ─wrap→ VK ─AES-GCM→ 金庫密文
復原碼 ─Argon2id→ RK  ─wrap→ VK（另一份，供復原）
```

- Firestore 只存 `kdfParams`、`wrappedVK_byMEK`、`wrappedVK_byRK`、條目密文。
- 換主密碼只重包裝 VK，金庫密文不必重算。
- 無後門：主密碼與復原碼同時遺失即無法復原。

## 開發

```bash
npm install
npm run dev        # http://localhost:5173
npm test           # 加解密 / 搜尋單元測試
npm run build      # 產出 dist/（含 PWA SW）
npm run emulators  # Firebase Emulator Suite（M3）
```

## 里程碑

- [x] **M1** 專案骨架 + 本地 MVP：加密儲存、手動條目、別名+模糊搜尋、分割線清單 UI、深淺色、復原碼
- [x] **M2** 智慧匯入解析管線（normalization → segment → FSM → 評分 → 逐張確認卡片，全程本機）
- [x] **M3** E2EE Firestore 同步（rev/baseRev 三方合併 + conflictOf 衝突副本）+ Security Rules + 忘記主密碼流程（復原碼重設、舊碼失效）
- [x] **M4** 語意搜尋：多語概念字典（網銀 ≈ online banking）融合 lexical，零網路、可離線
- [x] **M5** a11y / 離線 / 安裝打磨：PWA 圖示、InstallPrompt、reduced-motion、focus ring、theme-color 一致

## 待補

- CI（lint + test + build）— 可選
- Firestore Rules 測試 / Emulator 端對端：需 Java 執行環境啟動 Firestore Emulator
  （`npm i -D @firebase/rules-unit-testing` 後 `firebase emulators:exec --only firestore "RUN_RULES_TESTS=true npx vitest run src/sync/rules.test.ts"`）
- 正式雲端同步：將 `.env` 的 `VITE_USE_EMULATORS` 改為 `false`
