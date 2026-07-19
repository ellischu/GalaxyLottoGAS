# Galaxy Lotto Observer — AGENTS.md

## 專案概述

這是部署在 Google Apps Script (GAS) 上的樂透分析與預測系統，代號 "Galaxy Lotto Observer"。  
使用 jQuery + Bootstrap 前端，GAS V8 後端，以 clasp 部署。

## 技術棧

| 層級    | 技術                                                                               |
| ------- | ---------------------------------------------------------------------------------- |
| Runtime | Google Apps Script (V8), 6 分鐘執行限制                                            |
| 前端    | jQuery 3.7, Bootstrap 5.3, SweetAlert2 11, Chart.js                                |
| 後端    | GAS API: SpreadsheetApp, PropertiesService, CacheService, LockService, UrlFetchApp |
| 部署    | @google/clasp v3.3（配合 clasp-fix.js SSL 修補）                                   |
| Node    | axios, cheerio（爬蟲）、@types/google-apps-script（型別提示）                      |
| 語言    | JavaScript (ES6+)，繁體中文 UI/註解，英文識別字                                    |

## 檔案結構慣例

每頁遵循三檔模式：

```
PageName.html        — 頁面骨架 (HTML + 內聯 include)
PageName_Server.js   — 後端 GAS 函數
PageName_Style.html  — 頁面專用樣式
PageName_JS.html     — 前端 JavaScript (以 <script> 包裹, .html 副檔名是 GAS 限制)
```

### 頁面清單

| 頁面        | HTML               | Server                  | Style                    | Client JS             |
| ----------- | ------------------ | ----------------------- | ------------------------ | --------------------- |
| 儀表板      | `Index.html`       | `Index_Server.js`       | —                        | —                     |
| Galaxy 預測 | `Predict.html`     | `Predict_Server.js`     | `Predict_Style.html`     | `Predict_JS.html`     |
| V1 預測     | `Prediction1.html` | `Prediction1_Server.js` | `Prediction1_Style.html` | `Prediction1_JS.html` |
| 查詢        | `SearchS.html`     | `SearchS_Server.js`     | `SearchS_Style.html`     | `SearchS_JS.html`     |
| 活動        | `Activity.html`    | `Activity_Server.js`    | `Activity_Style.html`    | `Activity_JS.html`    |
| 遺漏表      | `MissData.html`    | `MissData_Server.js`    | `MissData_Style.html`    | `MissData_JS.html`    |
| 維護        | `UpdateAll.html`   | — (inline)              | —                        | —                     |

### SearchS 桌面版/手機版分離

`SearchS.html` 採用動態版型載入，根據裝置或使用者偏好切換：

- `SearchS_Desktop_Body.html` — 桌面版佈局（多欄卡片）
- `SearchS_Mobile_Body.html` — 手機版佈局（全寬垂直堆疊）
- 伺服器函數 `getSearchSTemplates()` 一次回傳兩種版型
- 用戶端以 Bootstrap `d-md-none` CSS 類別偵測裝置，支援 `localStorage` 記憶切換

### 共用元件

- `Styles.html` — 全域 CSS（球號、卡片、RWD、深色模式）
- `Scripts.html` — 共用 JS（頁面導航、主題切換、系統狀態、快取管理）
- `Nav.html` — 導覽列 + offcanvas 選單
- `Footer.html` — 頁尾（回饋連結）
- `Lib_jQuery.html` / `Lib_Bootstrap.html` / `Lib_Swal.html` — CDN 備援

## 核心架構

### 資料流程

```
台灣彩券 API → UrlFetchApp → 各彩種工作表 (原始開獎)
    ↓
combineData() → 合併 AllData 環境參數 → All 工作表
    ↓
genMissData() → 計算遺漏值 → Miss 工作表
    ↓
預測引擎 (Predict_Server / Prediction1_Server) → 前端顯示
```

### 彩種

- L539: 39 取 5，無特別號
- L649: 49 取 6，有特別號 S1
- L638: 38 取 6，有特別號 S1
- LSix: 今彩 6（高獎金）

### 模組層級

| 檔案                    | 行數  | 用途                                |
| ----------------------- | ----- | ----------------------------------- |
| `Utility.js`            | ~2328 | 路由、快取、DB 存取、日誌、進度管理 |
| `dailywork.js`          | ~746  | 每日更新協調器（三階段排程 + UI 相容）|
| `UpdateAllModule.js`    | ~572  | 新一代 combine/miss（含自我修復）   |
| `GalaxyAllModule.js`    | ~324  | 舊版 combine/miss                   |
| `main.js`               | ~98   | 舊版資料管理                        |
| `Predict_Server.js`     | ~1630 | Galaxy 預測引擎 (P109)              |
| `Prediction1_Server.js` | ~2777 | V1 預測引擎 (A147)                  |
| `MissData_Server.js`  | ~158  | 遺漏表資料查詢（含 AllData 環境參數）          |
| `SearchS_Server.js`   | ~330  | 查詢邏輯（含 getSearchSTemplates）             |
| `Activity_Server.js`  | ~75   | 活動報表資料                                    |
| `Index_Server.js`     | ~94   | 系統狀態                                        |
| `UpdateAll.html`      | ~703  | 資料庫維護 UI                                   |
| `Tests.js`            | ~96   | 單元測試                                        |
| `MissData_JS.html`    | ~345  | 遺漏表前端 JS（條件式渲染、ballToPos 配色）      |
| `MissData_Style.html` | ~65   | 遺漏表樣式（N1~N5 清淡底色、miss=0 圓形）       |
| `MissData.html`       | ~93   | 遺漏表頁面骨架（收合式查詢摘要）                 |
| `SearchS_Desktop_Body.html` | ~125 | 桌面版佈局模板                             |
| `SearchS_Mobile_Body.html` | ~150 | 手機版全寬卡片模板                           |

## 關鍵設計模式

### 1. 可續傳批次處理

所有長時間執行函數使用 `saveProgress()` / `getProgress()` / `clearProgress()` 來跨越 GAS 6 分鐘限制。

```js
// 典型模式
function longRunningTask() {
  var progress = getProgress("taskKey");
  for (/* 批次處理 */) {
    if (isNearTimeout()) {
      saveProgress("taskKey", currentState);
      return {status: "continue", message: "繼續中..."};
    }
  }
  clearProgress("taskKey");
  return {status: "complete"};
}
```

### 2. 多層快取

- `CacheService.getScriptCache()` — 快速、短暫（6h TTL, 100KB）
- `PropertiesService.getUserProperties()` — 持久權重儲存
- `PropertiesService.getScriptProperties()` — 任務進度、版本
- 透過 semver 遞增使快取失效 (`clearAllCache()`)

### 3. LockService 保護

用於競爭區段：

- 權重更新 (`getAIWeightSettings` / `setAIWeightSettings`)
- 錯誤日誌 (`logSystemError`)
- 版本遞增 (`clearAllCache`)
- 每日更新 phase function (`dailyupdate_phase1/2/3`) — 防止多支 trigger 重疊執行

### 4. 超時保護

`isNearTimeout()` 檢查距離 GAS 6 分鐘限制是否剩不到 290 秒，若是則提前儲存並返回。

## 試算表架構

### 主試算表

- `AllData` — 每日環境/天文參數（干支、五行、紫微、28 宿）
- `Method` — 統計與占星方法設定
- `FieldName` / `IDName` — 對照表
- `Sheets` / `Folders` — 子試算表 URL 註冊表
- `ErrorLog` — 集中式錯誤日誌

### 每彩種子試算表（L539/L649/L638/LSix）

- `All` — 開獎資料 + 環境參數合併
- `Miss` — 遺漏值
- `FreqSec` — 頻率區間
- `prct1_Settings` / `prct1_Property` / `prct1_History` — V1 設定/屬性/歷史
- `predic1_Settings` / `predic1_Property` / `predic1_Settings_Archive` — Galaxy 設定/屬性/封存

## 開發規範

### 編碼

- **縮排**: 2 空格
- **命名**: `camelCase` 函數、`UPPER_CASE` 常數
- **語言**: 程式碼註解與 UI 使用繁體中文；識別字使用英文
- **錯誤處理**: 所有 `try/catch` 使用 `logSystemError()` 統一記錄
- **回傳格式**: `{status: "complete"|"continue"|"error", message: "..."}`

### 修改規則

1. 先閱讀再修改 — 務必先讀懂現有檔案再改
2. 最小變更 — 只動必要部分
3. 吻合風格 — 遵循專案既有慣例（縮排、命名、模式）
4. 每次顯著修改後請檢查 `git diff`
5. 修改後若相關測試存在應保證通過

### 測試

```bash
# 執行測試（部署後在 GAS 環境執行）
runPredictUnitTests()
```

測試檔案: `Tests.js` — 目前僅 Predic 模組測試。

## 部署

- **正式版** (production): `https://script.google.com/macros/s/AKfycby-jI3_kEJFTmdNLsk_IQPQg3Y2V7DqbjC12PRjE7Atc8jiYU7fUhas7pDXOo7srh8W/exec`
- **測試版** (staging): `https://script.google.com/macros/s/AKfycbzKNPXpAYKMnH07pkeqb5-scpTEcYWn-c-XLwoY-trUUBCjFtjy1yKvPEwMUDFvHUXG/exec`

**部署規則**：`npm run deploy:ver -- -d "測試版"` 部署到測試版，部署說明一律設為 `'測試版'`。若需部署到正式版，必須先向使用者確認。

## 有用的參考

- **路由入口**: `Utility.js` → `doGet(e)` — 根據 `?page=` 參數分流
- **快取清除**: 呼叫前端 `clearAllSystems()`，或手動遞增任何版本號
- **每日更新 (三階段排程)**: `dailywork.js` → 每 phase 有多支重複觸發（每 5 分鐘一支），配合 LockService 防止重疊：
  - `dailyupdate_phase1()` (00:00~00:25, 共 6 支) — 擷取號碼 + 合併 All (Update_* + Combine_*)
  - `dailyupdate_phase2()` (00:30~00:55, 共 6 支) — 更新 MissData（僅 methodSN=1）
  - `dailyupdate_phase3()` (01:00, 1 支) — 快取預載、封存、清理 (PreloadCache + Archive + Cleanup)
  - 每支 phase function 進入時以 LockService 防止重疊，並檢查 `PHASE{N}_COMPLETED_DATE` 標記；若當天已完成則直接跳過
  - 完成後寫入 `PHASE{N}_COMPLETED_DATE`，後續 trigger 看到同日期標記即跳過不重複執行
- **genMissData 增量模式**: 全新執行（無續傳進度）時讀取 Miss 工作表該 methodSN 最後日期，只處理 All 中該日期之後的新資料（不刪除重填）；續傳中時跳過增量過濾直接以 startIndex 續跑
- **writeMissBatchDirect**: `isFirstBatch=true` 時只移除該 methodSN 的舊資料再附加新資料，保留其他 methodSN；`isFirstBatch=false` 時直接附加不刪除
- **fetchMonthlyBatch 修復**: 原 month 從期號解析（`115000168 % 1000000 / 10000` 恆為 0），改以 `today - 2 months` 計算起始月，確保跨月開獎資料正常抓取
- **_runTaskSequence**: 單一 task 失敗以 try-catch 跳過，不阻斷整個序列
- **combineData**: 加入 try-catch 與 null source sheet 保護
- **設定觸發**: 部署後在 GAS 編輯器執行 `setDailyTriggers()` 一次性建立三支定時觸發；`removeDailyTriggers()` 可移除
- **舊版相容**: `dailyupdate(isUI)` 保留供 UI 手動呼叫，行為與三階段一致
- **註冊試算表**: 在 `Sheets` 工作表設定 `{name, url, recent}`

## 文件

完整文件在 `docs/` 目錄：

- `CLAUDE.md` — LLM 行為指南
- `DocGalaxy計劃文件.md` — 系統總覽與計畫
- `DocGalaxy系統環境與架構.md` — 環境與架構
- `DocSpreadsheet.md` — 試算表結構
- `DocAllFunction.md` — 函數索引與呼叫鏈
- `DocUtility.md` — 工具函數設計
- `Module*.md` — 各模組文件
- `GalaxyLotto_*.md` / `共同工作表_*.md` — 各工作表文件
