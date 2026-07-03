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
| 維護        | `UpdateAll.html`   | — (inline)              | —                        | —                     |

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
| `Utility.js`            | ~1658 | 路由、快取、DB 存取、日誌、進度管理 |
| `dailywork.js`          | ~531  | 每日更新協調器（12 步驟）           |
| `UpdateAllModule.js`    | ~572  | 新一代 combine/miss（含自我修復）   |
| `GalaxyAllModule.js`    | ~324  | 舊版 combine/miss                   |
| `main.js`               | ~98   | 舊版資料管理                        |
| `Predict_Server.js`     | ~1630 | Galaxy 預測引擎 (P109)              |
| `Prediction1_Server.js` | ~2777 | V1 預測引擎 (A147)                  |
| `SearchS_Server.js`     | ~320  | 查詢邏輯                            |
| `Activity_Server.js`    | ~75   | 活動報表資料                        |
| `Index_Server.js`       | ~94   | 系統狀態                            |
| `UpdateAll.html`        | ~703  | 資料庫維護 UI                       |
| `Tests.js`              | ~96   | 單元測試                            |

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

**部署規則**：`npm run deploy:gas` 預設部署到測試版。若需部署到正式版，必須先向使用者確認。

## 有用的參考

- **路由入口**: `Utility.js` → `doGet(e)` — 根據 `?page=` 參數分流
- **快取清除**: 呼叫前端 `clearAllSystems()`，或手動遞增任何版本號
- **每日更新**: `dailywork.js` → `dailyupdate(isUI)` — 依序執行 12 步驟
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
