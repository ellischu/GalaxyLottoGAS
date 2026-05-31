# DocGalaxy 系統總綱與計劃文件

## 1. 系統環境與架構

- **運行系統**：Google Apps Script (GAS) 雲端架構。
- **核心限制**：GAS 單次執行 6 分鐘限制 (360 秒)，需強制採用**中斷續傳**與**批次 API 呼叫**設計。
- **前端界面**：jQuery + Bootstrap + Swal2 (SweetAlert2) 高感度回饋界面。
- **響應式適配**：
  - 手機端：1080 * 2340 縱向高解析度優化。
  - 平板端：1280 * 800 視差布局。
  - 桌面端：寬螢幕多模組並排顯示。
- **開發規範**：
  - 回答時需附帶**完整程式碼**，確保模組的連續性與可閱讀性。
  - 統一採用**繁體中文**進行系統交互、注釋與文檔撰寫。
  - 遵循 [CLAUDE.md](CLAUDE.md) 簡潔且不影響既有功能的 Surgical (外科手術式) 修改規範。

---

## 2. 試算表資料結構 (Spreadsheet)

詳細資料庫架構請參閱：[Spreadsheet 說明文件](DocSpreadsheet.md)。

### 核心資料源 (mainSpreadsheet)
- **AllData 工作表**：存放占星、干支、干支五行、紫微十二宮、二十八星宿等每日環境參數。
- **Method 工作表**：存放統計、過濾與占星方法配置。

### 彩種獨立試算表 (L539 / L649 / L638 / LSix)
- **原始開獎工作表**：包含 Date、N1~N5 (或 N6)、S1 (特別號)、Sum 等欄位。
- **All 工作表**：以 Date 欄位為鍵值，結合原始開獎數據與 `AllData` 環境參數。
- **Miss 工作表**：保存每日號碼的歷史遺漏期數（主號遺漏 M1~Mn，副區/特別號遺漏 MS1~MSm）。
- **prct1_Settings**：存放 AI 自動學習調整後的基礎權重與係數。
- **prct1_Property**：存放核心預測算法的版本化快取與進度。

---

## 3. 模組與程式建構

本系統由以下模組協同運行：
- **[Predict 預測主引擎](DocPredict.md)**：包含星系震盪儀表、AI 學習權重微調、近 30 期歷史輕量回測。
- **[Prediction1 新版預測 (V1)](Docprediction1.md)**：整合環境變動率分析、歲破偵測、紫微十二宮位共振、本命衰減共振、黃金分割引力過濾。
- **[Prediction2 行星預測 (V2)](DocPrediction2.md)**：二十八星宿、行星偏移與天文相位加權預測。
- **[AllFunction 函式索引](DocAllFunction.md)**：全系統後端 API 與調用鏈地圖。
- **[Activity 活性表單](DocActivity.md)**：活性數據表單收集與交互。
- **[Utility 公用工具](DocUtility.md)**：資料庫連接、Properties 緩存管理、全域鎖定（LockService）等支援。

---

## 4. 關鍵 Function 函式設計規範

為了保證 GAS 環境下的極致穩定與高能效，所有後端維護函式須嚴格遵守以下演算法設計規範。

### A. All 工作表同步設計 (`combineData`)

- **功能定義**：將原始開獎資料與 `AllData` 工作表之每日星系參數進行交叉對照合併，並寫入該彩種試算表的 `All` 工作表。
- **增量更新與斷點續傳 (Incremental & Resume Logic)**：
  1. 檢查 `All` 工作表：
     - 若無資料，初始化標頭（Date + N 欄位 + 特別號/Sum 欄位 + AllData 擴充欄位標頭）。
     - 若已有資料，讀取最後一行的 Date（設為 `lastdate`）。
  2. 若 `lastdate` 存在，僅從原始開獎工作表中篩選「日期 > lastdate」的增量資料進行合併。
  3. **自動修復 (Self-Repair)**：若最後一行的 Date 資料發生損壞，系統必須主動刪除損壞行，重置進度並遞迴重新執行，以保障資料一致性。
- **效能優化 (Performance Optimization)**：
  - **記憶體 Map 索引**：預先讀取 `AllData` 工作表並在記憶體中建立 Date-To-Row 的 Map 對照表。嚴禁在迴圈中重覆透過 `getSheetByName` 或 API 查詢單日資料。
  - **時效監控與中斷**：每次批次寫入（`BatchSize = 100`）時，監控執行時間。當單次執行接近超時（或超過 15 秒）時，保存當前 `currentIndex` 進度，主動中斷並回傳 `continue` 狀態至前端實施續傳。

### B. Miss 工作表遺漏值計算 (`genMissData`)

- **功能定義**：計算主號碼池及特別號碼池的歷史遺漏期數。開出則歸 0，未開出則累加 +1。
- **核心效能與多規格設計 (O(1) Efficiency & Configuration-Driven)**：
  1. **規格組態化**：
     - `L539`：號碼上限 39，不計算特別號。
     - `L649`/`LSix`：號碼上限 49，含特別號 S1。
     - `L638`：主區
