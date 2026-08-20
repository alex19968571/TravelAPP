# CLAUDE.md

本檔案提供 Claude Code 在此專案（TravelApp）進行提問、編輯、設計時所需的架構與慣例說明。
**每次針對本專案進行任何操作前，請先讀取本檔案。**
**與使用者的所有對話回覆，一律使用「繁體中文」。**

功能面的完整說明（各頁面功能、路徑）請參考 [README.md](README.md)；本檔案聚焦在架構慣例與開發時要注意的地雷。

## 專案概述

TravelApp 是一款以「行程規劃」為核心的旅行工具 App，整合景點地圖排程、購物清單、記帳分帳、多幣別換算、行程成員邀請、機票自動盯價、行程提醒通知等功能，支援繁中／簡中／日文／英文四種語系與深色模式。

## 技術棧

| 項目 | 說明 |
|---|---|
| 前端框架 | Angular 21+（`standalone: true` Component + Signal，**非** NgModule 架構） |
| 語言 | TypeScript |
| 後端 / 資料庫 | Supabase（PostgreSQL + Auth + Storage + Edge Functions） |
| 本機快取 / 離線同步 | Dexie（IndexedDB）+ 自訂 `SyncEngineService` 佇列（離線優先架構） |
| 多語系 | `@jsverse/transloco`，語系檔位於 `public/assets/i18n/` |
| 地圖服務 | Google Maps JavaScript API |
| 匯率 | 第三方匯率 API（`ExchangeRateService`） |
| 信件通知 | Resend（Edge Function 寄送，例如行程提醒通知） |
| 樣式 | 純 CSS 變數設計系統（`src/styles.scss`），**無** UI 元件庫依賴 |
| 部署 | GitHub Pages（`.github/workflows/deploy.yml`），base-href 為 `/TravelAPP/` |

## 目錄結構重點

```
src/app/
├─ core/
│  ├─ db/local.db.ts          # Dexie 本地資料庫定義（version 遞增升版）
│  ├─ models/index.ts         # 所有資料模型 interface
│  ├─ services/
│  │  ├─ sync-engine.service.ts  # 離線同步引擎（syncDown / syncUp / enqueue）
│  │  ├─ supabase.service.ts     # Supabase client 單例
│  │  └─ *.service.ts            # 各功能的 CRUD service
│  └─ guards/authGuard         # 未登入導回 /login
├─ features/                   # 各功能頁面（standalone component，路由於 app.routes.ts 動態載入）
└─ shared/components/          # 共用元件（dropdown-select 等）

supabase/
├─ 00X_xxx.sql                 # 資料庫 Migration，依編號依序在 Dashboard SQL Editor 手動執行
├─ config.toml                 # Edge Function 設定（verify_jwt 等）
└─ functions/<name>/index.ts   # Edge Functions（Deno）
```

## 離線優先同步架構（新增可同步資料表時務必照此順序）

本專案「所有寫入」都先落地本機 Dexie，再由 `SyncEngineService` 背景同步到 Supabase，**不會**在元件內直接呼叫 `supabase.from(...).insert(...)`。新增一個需要同步的資料表時，要依序修改：

1. `core/models/index.ts` — 新增 interface
2. `core/db/local.db.ts` — 新增 `Table<T, string>` 屬性，並用 `this.version(N+1).stores({...})` 升版（**不可**直接改舊版本的 stores，否則既有使用者的本機 IndexedDB 會噴 SchemaError）
3. `core/services/sync-engine.service.ts` — `TableName` 型別聯集加入表名；`syncDown()` 內比照 `flight_watches` 的寫法加上下載 + `pruneStale` 清理 + `bulkPut`
4. 新增 `core/services/xxx.service.ts` — CRUD 一律走 `db.xxx.add/update/delete` + `this.sync.enqueue(...)`，不要直接呼叫 supabase
5. 新增 `supabase/00X_xxx.sql` migration — 建表 + `ENABLE ROW LEVEL SECURITY` + 對應 policy（可重用 003 migration 建立的 `has_trip_read_access()` / `has_trip_edit_access()` helper function）

## Supabase 後端慣例

- Migration 檔案命名：`supabase/00X_描述.sql`，編號遞增，**不會**自動執行，需使用者手動在 Supabase Dashboard 的 SQL Editor 執行（或 `supabase db push`）
- 新增 Edge Function 後，若該函式會被「前端使用者」呼叫（例如 `flight-price`），保持平台預設的 JWT 驗證；若是被 **pg_cron / pg_net 排程呼叫**（例如 `send-trip-reminders`），需在 `supabase/config.toml` 加上 `verify_jwt = false`，並在函式內自行以自訂的 secret header（例如 `CRON_SECRET`）驗證呼叫來源，避免端點被任意呼叫濫用金鑰額度
- 涉及金鑰的服務（Resend、RapidAPI、Tequila 等）一律透過 `supabase secrets set` 設定，**不可**寫死在程式碼或 migration 檔內

## 多語系規範

- 四語系檔案：`public/assets/i18n/{zh-TW,zh-CN,ja-JP,en-US}.json`
- **新增任何使用者可見文字，四個語系檔都要同步新增對應 key**，不可只改 zh-TW
- 預設語言為 `zh-TW`（見 `app.config.ts` 的 `provideTransloco`）

## UI／樣式慣例

- 無 Angular Material / Bootstrap 等元件庫，一律用 `src/styles.scss` 的 CSS 變數（`--bg`、`--surface`、`--accent`、`--text-primary` 等）手刻樣式，深色模式靠 `[data-theme='dark']` 覆蓋
- 彈出視窗共用兩種模式（見 `styles.scss` 第 130 行附近）：
  - 一般 `.modal-card`：手機版會自動變成全螢幕（`@media (max-width: 640px)`）
  - 加上 `.modal-card-compact`：手機版維持置中小卡片，**不會**自動全螢幕
- 內容量不固定、要求「等比縮放塞滿容器、不出現捲軸」的畫面（換匯頁、自動盯價彈窗等），採用 `scale-wrap` + `ViewChild` + `HostListener('window:resize')` 動態計算 `transform: scale()` 的技巧，不要用 `overflow: auto` 加捲軸解決

## 建置注意事項

- `angular.json` 的 `anyComponentStyle` budget 目前設定 **warning 8kB / error 14kB**：單一 component 內 `styles: [...]` 的樣式總量超過 14kB 會導致 **`ng build` 直接失敗**。新增大量樣式（例如新彈窗）前，若該元件已經很肥大（`trips-list.component.ts`、`trip-detail.component.ts`、`expenses.component.ts` 目前都偏大），要留意這個上限
- 執行 `ng build` 前不需要額外參數即為 production 設定；GitHub Pages 部署走 `.github/workflows/deploy.yml`，會加上 `--base-href /TravelAPP/`

## 常用指令

```bash
npm install          # 安裝套件
ng serve              # 本機開發伺服器（http://localhost:4200/）
ng build               # 正式建置（輸出至 dist/travel-app）
ng test                 # 執行 Vitest 單元測試
```

## 重要提醒

1. **回覆一律使用繁體中文**
2. **不直接呼叫 Supabase CRUD** — 一律經由 Dexie + `SyncEngineService`（唯讀查詢、RPC 呼叫、Storage 上傳等非同步表資料可例外，比照 `trip.service.ts` 的 `joinByInviteCode` / `uploadItineraryPhoto`）
3. **新增文字務必四語系同步**（zh-TW / zh-CN / ja-JP / en-US）
4. **新增/修改資料表務必寫 RLS policy**，並在需要時重用 `has_trip_read_access` / `has_trip_edit_access`
5. **涉及金鑰、Email 服務、排程等外部依賴的功能**，實作前應先與使用者確認要用哪個服務、金鑰從哪裡取得，不擅自假設或寫死
6. **改動元件樣式前留意 `anyComponentStyle` 上限**，避免 build 失敗
