# FreqSec 工作表

分區頻率活性提供工作表。

| 欄位名稱    | 數值型態 | 預設值 | 顯示標題  | 說明            |
| :---------- | :------- | :----- | :-------- | :-------------- |
| lngMethodSN | Binint   | null   | 方法序號  | 方法序號        |
| Date        | Date     | null   | 日數      | 格式為YYYYmmdd  |
| intN        | Int      | 0      | 號碼      | 號碼            |
| intM        | Int      | 0      | 遺漏數    | 遺漏數值        |
| intMinM     | Int      | 0      | 最小值    | 遺漏數最小值    |
| intMaxM     | Int      | 0      | 最大值    | 遺漏數最大值    |
| sngAvgM     | Int      | 0      | 平均值    | 遺漏數平均值    |
| sngACM      | Double   | 0      | 標準差    | 遺漏數標準差    |
| intFreq05   | Int      | 0      | 頻率05    | 分區05出現次數  |
| intMin05    | Int      | 0      | 最小值05  | 分區05最小值    |
| intMax05    | Int      | 0      | 最大值05  | 分區05最大值    |
| sngAvg05    | Int      | 0      | 平均值05  | 分區05平均值    |
| sngAC05     | Double   | 0      | 標準差05  | 分區05標準差    |
| intFreq10   | Int      | 0      | 頻率10    | 分區10出現次數  |
| intMin10    | Int      | 0      | 最小值10  | 分區10最小值    |
| intMax10    | Int      | 0      | 最大值10  | 分區10最大值    |
| sngAvg10    | Int      | 0      | 平均值10  | 分區10平均值    |
| sngAC10     | Double   | 0      | 標準差10  | 分區10標準差    |
| intFreq25   | Int      | 0      | 頻率25    | 分區25出現次數  |
| intMin25    | Int      | 0      | 最小值25  | 分區25最小值    |
| intMax25    | Int      | 0      | 最大值25  | 分區25最大值    |
| sngAvg25    | Int      | 0      | 平均值25  | 分區25平均值    |
| sngAC25     | Double   | 0      | 標準差25  | 分區25標準差    |
| intFreq50   | Int      | 0      | 頻率50    | 分區50出現次數  |
| intMin50    | Int      | 0      | 最小值50  | 分區50最小值    |
| intMax50    | Int      | 0      | 最大值50  | 分區50最大值    |
| sngAvg50    | Int      | 0      | 平均值50  | 分區50平均值    |
| sngAC50     | Double   | 0      | 標準差50  | 分區50標準差    |
| intFreq100  | Int      | 0      | 頻率100   | 分區100出現次數 |
| intMin100   | Int      | 0      | 最小值100 | 分區100最小值   |
| intMax100   | Int      | 0      | 最大值100 | 分區100最大值   |
| sngAvg100   | Int      | 0      | 平均值100 | 分區100平均值   |
| sngAC100    | Double   | 0      | 標準差100 | 分區100標準差   |

## 備註

- lngMethodSN 由 [Method 工作表](共同工作表_Method工作表.md) 提供。
- Date 由子試算表的 All 工作表提供，格式為 yyyy-MM-dd（儲存時正規化）。
- Double 為小數點 3 位。

## 獲取資料流程

### 檔案歸屬

所有 FreqSec 相關邏輯集中在 `Utility_FreqSec.js`：

| 函數 | 說明 |
|---|---|
| `getFreqSecTable(lotto, dateStr, methodSN)` | 讀取子試算表 FreqSec 工作表，依 (methodSN, date) 篩選回傳 |
| `writeFreqSecBatch(ss, lotto, methodSN, dateStr, headers, rows)` | 寫入 FreqSec 工作表（寫入前清除同鍵舊資料） |
| `clearFreqSecData(ss, lotto, methodSN, dateStr)` | 清除 FreqSec 中指定 (methodSN, date) 的所有列 |
| `computeFreqSecData(lotto, dateStr, methodSN)` | 從 Miss 表即時計算頻率活性統計（原在 Activity_Server.js，後搬移至此） |
| `getFreqSecData(lotto, dateStr, methodSN)` | 主協調流程，被 `getActivityReport()` 呼叫 |

`getFreqSecData` 會經 `Activity_Server.js` → `getActivityReport()` 被 Activity 頁面呼叫。Activity 頁面透過 `google.script.run.getActivityReport(lotto, date, methodSN)` 取得完整報告（含環境參數 + FreqSec 統計）。

### 工作表實際儲存格式

儲存時前綴 `lngMethodSN` 與 `Date`，後接 26 個統計欄位（與文件表格順序一致）：

```
[lngMethodSN, Date, intN, intM, intMinM, intMaxM, sngAvgM, sngACM,
 intFreq05, intMin05, intMax05, sngAvg05, sngAC05,
 intFreq10, intMin10, intMax10, sngAvg10, sngAC10,
 intFreq25, intMin25, intMax25, sngAvg25, sngAC25,
 intFreq50, intMin50, intMax50, sngAvg50, sngAC50,
 intFreq100, intMin100, intMax100, sngAvg100, sngAC100]
```

共 28 欄。同一 (methodSN, date) 對應 `GAME_CONFIG[lotto].maxNum` 列（L539 = 39 列，每號碼一列）。查詢回傳前端時會去除 `lngMethodSN` 與 `Date` 前兩欄。

### 查詢三步驟

`getFreqSecData()` 執行以下三步驟：

**Step 1 — combineData 同步檢查**
- 讀取主試算表 (SpreadsheetApp.getActiveSpreadsheet()) 中名為 lotto 的原始資料工作表（如 L539）的最後一筆日期
- 讀取該彩種子試算表 All 工作表的最後一筆日期
- 若兩者不同，呼叫 `combineData(lotto)` 同步
- 若 `combineData` 回傳 `continue`（續傳中），則回傳 error 請使用者稍後再試

**Step 2 — FreqSec 快取查詢**
- 呼叫 `getFreqSecTable(lotto, dateStr, methodSN)` 搜尋 FreqSec 工作表
- 若回傳列數為 0：無快取 → 呼叫 `computeFreqSecData()` 從 Miss 表計算，再呼叫 `writeFreqSecBatch()` 寫入，最後回傳計算結果

**Step 3 — 列數完整性檢查**
- 若回傳列數等於 `maxNum`：快取有效 → 直接回傳（去除前兩欄，輕量查詢 Miss 表取得 `totalPeriods` 供前端顯示）
- 若回傳列數不等於 `maxNum`：快取不完整 → 呼叫 `clearFreqSecData()` 清除 → 重新計算 → 寫入 → 回傳

### 計算演算法 (`computeFreqSecData`)

1. **資料來源**：透過 `getMissDataTable(lotto, date, methodSN, "DESC", 300)` 取得最多 300 期 Miss 資料
2. **出現矩陣**：建立 `[maxNum][totalPeriods]` 的 boolean `appearAll` 矩陣，標記每個號碼在每期是否出現。檢查 N1~N5（或 N1~N6）及 S1（L638 除外）
3. **遺漏統計**：對每個號碼取 `windowSize = min(totalPeriods, 200)` 期的 M 值，計算：
   - 目前值 (`intM`)、最小值 (`intMinM`)、最大值 (`intMaxM`)
   - 平均值 (`sngAvgM`)、標準差 (`sngACM`)
4. **頻率統計**：對 5/10/25/50/100 五個分區，對每個窗口位置 q 往前看 zoneSize 期，計算出現次數。統計各分區的：目前值、最小、最大、平均、標準差
5. **標準差公式**：母體標準差 `sqrt(sum((x-mean)^2) / n)`，四捨五入至小數點 3 位
6. **回傳格式**：`{status, statsHeaders, statsRows, totalPeriods, windowSize}`

### 日期正規化

FreqSec 使用輔助函數 `_normDate(v)` 統一處理日期格式，避免因 Google Sheets 自動轉換 Date 物件導致比對失敗。`_normDate` 接受 Date 物件或字串，輸出 `yyyy-MM-dd` 格式字串。此函數在 `getFreqSecTable`、`writeFreqSecBatch`、`clearFreqSecData` 中一致使用。

### 相關頁面

- **Activity.html** — 透過 `getActivityReport()` 取得 FreqSec 資料，以表格呈現頻率活性分析，支援點擊標題排序（▲/▼）
- **MissData.html** — 不直接使用 FreqSec 工作表，僅顯示遺漏數表
- **SearchS.html** — 設定查詢參數後跳轉至 Activity 或 MissData 頁面

[Back](L539L649L638LSix試算表.md)
