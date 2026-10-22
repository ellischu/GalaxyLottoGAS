# GalaxyLotto 系統總綱與計劃文件

## 1. 系統環境與架構

## 詳細架構請參閱： [系統環境與架構](DocGalaxy系統環境與架構.md)。

## 2. 試算表及資料夾結構

詳細資料庫架構請參閱：[試算表及資料夾架構說明文件](DocGalaxy試算表及資料夾架構.md)。

---

## 3. 模組與程式建構

本系統由以下模組協同運行：

- **[Predict 預測主引擎](ModulePredict.md)**：包含星系震盪儀表、AI 學習權重微調、近 30 期歷史輕量回測。
- **[Prediction1 新版預測 (V1)](ModulePrediction1.md)**：整合環境變動率分析、歲破偵測、紫微十二宮位共振、本命衰減共振、黃金分割引力過濾。
- **[Prediction2 行星預測 (V2)](ModulePrediction2.md)**：二十八星宿、行星偏移與天文相位加權預測。
- **[AllFunction 函式索引](DocAllFunction.md)**：全系統後端 API 與調用鏈地圖。
- **[Activity 活性表單](ModuleActivity.md)**：活性數據表單收集與交互。
- **[Utility 公用工具](DocUtility.md)**：資料庫連接、Properties 緩存管理、全域鎖定（LockService）等支援。
- [震盪表模組](ModuleDataNext.md)

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

### C. 震盪表 KD 指標工作表 (DataNKD)

KD/J 指標為震盪表之延伸，用於判斷買賣超或動能轉折。完整欄位規格請參閱 [震盪表模組](ModuleDataNext.md)。

#### DataNKD00 工作表

- Name : DataNKD00 工作表
- Describe : 提供震盪表 KD 係數的表格。
- 試算表 : L539_DataNext ,L649_DataNext ,L638_DataNext ,LSix_DataNext

| 欄位名稱       | 數值型態 | 預設值  | 顯示標題 | 說明     |
| :------------- | -------- | :------ | :------- | :------- |
| lngDataN00KDSN | Bigint   | null    | N00KD    | 不可重覆 |
| lngDataN00SN   | Bigint   | null    | N00      | 可重覆   |
| intRSVn        | Smallint | null    | RSVn     | 計算天數 |
| sglRSVCo       | float    | 0.33333 | RSVc     | 係數 1/3 |
| strcheck       | string   | null    | FIT      | 檢查碼   |

備註:
- strcheck 格式 : `lngMethodSN#intRSVn#sglRSVCo`
- strcheck 例子 : `1#5#0.33333`
- intRSVn 依彩種設定：L539=5，L649/L638/LSix=9

#### DataNKD01 工作表

- Name : DataNKD01 工作表
- Describe : 提供第1柱震盪 KD 資料的表格。
- 試算表 : L539_DataNext ,L649_DataNext ,L638_DataNext ,LSix_DataNext

| 欄位名稱       | 數值型態 | 預設值 | 顯示標題 | 說明       |
| :------------- | -------- | :----- | :------- | :--------- |
| lngDataN00KDSN | Bigint   | null   | N00KD    | 不可重覆   |
| sglAvg105RSV   | float    | 0      | RSV105   | 前5期RSV   |
| sglAvg105K     | float    | 0      | RSVK     | 前5期K值   |
| sglAvg105D     | float    | 0      | RSVD     | 前5期D值   |
| sglAvg105J     | float    | 0      | RSVJ     | 前5期J值   |
| sglAvg110RSV   | float    | 0      | RSV110   | 前10期RSV  |
| sglAvg110K     | float    | 0      | RSVK     | 前10期K值  |
| sglAvg110D     | float    | 0      | RSVD     | 前10期D值  |
| sglAvg110J     | float    | 0      | RSVJ     | 前10期J值  |
| sglAvg125RSV   | float    | 0      | RSV125   | 前25期RSV  |
| sglAvg125K     | float    | 0      | RSVK     | 前25期K值  |
| sglAvg125D     | float    | 0      | RSVD     | 前25期D值  |
| sglAvg125J     | float    | 0      | RSVJ     | 前25期J值  |
| sglAvg150RSV   | float    | 0      | RSV150   | 前50期RSV  |
| sglAvg150K     | float    | 0      | RSVK     | 前50期K值  |
| sglAvg150D     | float    | 0      | RSVD     | 前50期D值  |
| sglAvg150J     | float    | 0      | RSVJ     | 前50期J值  |
| sglAvg1100RSV  | float    | 0      | RSV1100  | 前100期RSV |
| sglAvg1100K    | float    | 0      | RSVK     | 前100期K值 |
| sglAvg1100D    | float    | 0      | RSVD     | 前100期D值 |
| sglAvg1100J    | float    | 0      | RSVJ     | 前100期J值 |

#### DataNNextKD02 ~ DataNNextKD07 工作表

- 用 DataNKD01 的方式建立 工作表。
- Describe : 提供第2 ~ 7 柱震盪 KD 預測資料 的表格。
- 試算表 : L539_DataNext ,L649_DataNext ,L638_DataNext ,LSix_DataNext
