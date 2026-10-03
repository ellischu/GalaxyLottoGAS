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

### 回溯測試與評分

在活性分析基礎上，新增兩層運算：

| 函數 | 說明 |
|---|---|
| `backtestFreqSec(lotto, methodSN)` | 全歷史回溯：遍歷每期每號碼，當條件觸發時記錄下一期是否出現，計算條件真實出現率與基底率的差異 |
| `scoreWithDiffs(lotto, dateStr, methodSN)` | 套用回溯差異值至當期，對所有號碼評分排名 |
| `getBacktestAndScore(lotto, dateStr, methodSN)` | 協調函數：先檢查快取 → 無快取則跑回溯 → 再評分 |

#### 回溯條件

`backtestFreqSec` 追蹤以下條件：

| 條件 | 觸發時機 | 調整方向 |
|---|---|---|
| `Freq{z}_max` | 滾動頻率達到歷史最高 | 負（頻率過高→機率↓） |
| `Freq{z}_min` | 滾動頻率達到歷史最低 | 依實際回測 |
| `M_max` | 目前遺漏 ≥ 歷史最高遺漏 | 正（遺漏大→機率↑） |
| `M_avg` | 目前遺漏 ≥ 歷史平均遺漏 | 正（遺漏大→機率↑） |
| `Centroid_B1~B5` | 頻率分布重心落入該動態分桶 | 依桶而定（重心偏右→正加分） |
| `Centroid_Zero` | 近 100 期從未出現 | 依實際回測 |

{z} 為 5/10/25/50/100 五個窗口。

#### 重心 (Centroid) 演算法

```
c05  = 頻05 (近 5 期出現次數)
c10  = 頻10 - 頻05 (第 6-10 期)
c25  = 頻25 - 頻10 (第 11-25 期)
c50  = 頻50 - 頻25 (第 26-50 期)
c100 = 頻100 - 頻50 (第 51-100 期)

總次數 = c05 + c10 + c25 + c50 + c100

若總次數 = 0 → 歸類 Centroid_Zero
否則:
  重心 = (c05×3 + c10×8 + c25×18 + c50×38 + c100×75) / 總次數 / 100
  (範圍 0~1，越接近 0 表示近期越活躍)
```

動態分桶：非零次樣本按重心排序後均分 5 桶（`Centroid_B1`~`Centroid_B5`），每桶樣本數盡量相等。桶範圍隨數據自動調整，每次回溯重新計算。

#### 快取機制

```
ScriptProperties key: BACKTEST_{lotto}_{methodSN}
```

| 欄位 | 說明 |
|---|---|
| `btVersion` | 版本號（目前 4），演算法變更時遞增使舊快取失效 |
| `version` | appVersion（semver），版本遞增時失效 |
| `diffs` | 各條件差異值 `{Freq5_max: 0.01234, ...}` |
| `rows` | 差異表列（含 key/total/hit/actualRate/baseRate/diff） |
| `baseRate` | 基底率（`nCount / maxNum`） |
| `centRanges` | 重心分桶範圍 `{Centroid_B1: {min, max}, ...}` |
| `timestamp` | 快取建立時間 |

#### 評分公式

```
對每個號碼:
  adj = 0
  
  頻max調整: 若 freq{z} == 歷史最大 → adj -= |diffs["Freq{z}_max"]|
  例外: freq=max 且號碼不在歷史號碼中 → nearZero=true → 分數極低
  
  Miss比調整: 若 M ≥ 平均遺漏 →
    ratio = (M - 平均) / (最大 - 平均)
    adj += |diffs.M_max| × ratio
  
  重心調整: 
    計算重心 → 找出所屬桶 → adj += diffs["Centroid_{桶}"]
  
  finalScore = nearZero ? baseRate × 0.01 : baseRate + adj
```

#### 前端排名表 (Active.html)

- **因子切換按鈕列**：Miss、重心、頻max 可多重選擇，選中的因子調整值加總後重新排名
- **號碼著色**：按當期開獎位置以 `num-n1`~`num-n5` 樣式標示，可透過 `#toggleBallColor` 開關
- **歷史期數號碼**：顯示 5/10/25/50/100 期前的開獎號碼與日期
- **可排序表格**：點擊活性統計表標題可排序（▲/↓）

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
