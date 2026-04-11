# GalaxyLotto 函式索引表

為了提升系統的開發效率與維護性，下表整理了專案中主要的後端函式、其功能描述以及相互調用的關係。

## 1. 預測主引擎 (Predict_Server.js)

| 函式名稱                     | 功能描述                                                     | 調用者 / 關聯介面                                   | 調用的函式                                                            |
| :--------------------------- | :----------------------------------------------------------- | :-------------------------------------------------- | :-------------------------------------------------------------------- |
| `getGalaxyPrediction`        | 預測主進入點，負責初始化環境並觸發核心引擎與 AI 學習。       | `Predict.html`                                      | `getTargetsheet`, `runGalaxyCoreEngine`, `autoAdjustAstrologyWeights` |
| `runGalaxyCoreEngine`        | 核心計算引擎，執行規律統計、多維度占星權重運算及遺漏值加權。 | `getGalaxyPrediction`, `get60PeriodHistoryStats`    | `getAIWeightSettings`                                                 |
| `get60PeriodHistoryStats`    | 獲取最近 30 期的歷史命中統計，包含輕量化回測機制。           | `Predict.html` (圖表渲染)                           | `getTargetsheet`, `runGalaxyCoreEngine`                               |
| `autoAdjustAstrologyWeights` | AI 自動學習邏輯，根據歷史命中結果動態微調占星權重。          | `getGalaxyPrediction`                               | `getAIWeightSettings`, `setAIWeightSettings`, `getPropertySheetValue` |
| `getAIWeightSettings`        | 獲取指定彩種的 AI 學習權重，支援 PropertiesService 快取。    | `runGalaxyCoreEngine`, `autoAdjustAstrologyWeights` | `getTargetsheet`                                                      |
| `setAIWeightSettings`        | 同步更新 PropertiesService 快取與試算表中的權重設定。        | `autoAdjustAstrologyWeights`                        | `getTargetsheet`                                                      |
| `clearAIWeightCache`         | 手動清除指定彩種的權重快取資料。                             | 管理介面 / 除錯需求                                 | `PropertiesService`                                                   |
| `getLottoSettings`           | 獲取彩種的特定設定（如欄位對應或數值對應）。                 | 預測邏輯內部                                        | `CacheService`                                                        |

## 2. 新版預測引擎 V1 (Prediction1_Server.js)

| 函式名稱                       | 功能描述                                                     | 調用者 / 關聯介面                             | 調用的函式                                          |
| :----------------------------- | :----------------------------------------------------------- | :-------------------------------------------- | :-------------------------------------------------- |
| `getPrediction01`              | 新版預測進入點，整合環境變動率分析、歲破偵測與平衡偏移警告。 | `Prediction1.html`                            | `getAllData`, `corePredict`, `getRecentHistoryHits` |
| `corePredict`                  | V1 核心演算法，包含五行加權、位置回歸限制與連號阻斷器。      | `getPrediction01`                             | `calculateStats`, `getLearnedBaseWeights`           |
| `preloadPrediction1Cache`      | 預載各彩種的統計與遺漏數據快取，最佳化前端回應速度。         | `manuallyCacheStats`, 觸發器                  | `calculateStats`, `calculateMissWeights`            |
| `autoAdjustBaseWeights`        | 根據 `prct1_Settings` 的歷史命中表現，自動微調基礎權重參數。 | `getPrediction01`                             | `getLearnedBaseWeights`, `setPropertySheetValue`    |
| `getPrediction1WeightSettings` | 獲取目前的 AI 學習權重參數 (供前端顯示)。                    | `Prediction1.html`                            | `getLearnedBaseWeights`                             |
| `getLearnedBaseWeights`        | 獲取經 AI 學習修正後的基礎權重（如連莊、跳值、五行等）。     | `corePredict`, `getPrediction1WeightSettings` | `getPropertySheetValue`                             |

## 3. 工具與資料處理 (Utility.js)

| 函式名稱             | 功能描述                                                | 調用者                           | 調用的函式                     |
| :------------------- | :------------------------------------------------------ | :------------------------------- | :----------------------------- |
| `getTargetsheet`     | 根據工作表名稱與目標名稱取得試算表物件、ID 及 URL。     | 預測伺服器端所有函式             | `getTarget`, `getIdFromUrl`    |
| `getTarget`          | 從 `Sheets` 或 `Folders` 工作表中檢索目標的網址。       | `getTargetsheet`                 | 無                             |
| `combineData`        | 結合彩種資料（如 L539）與環境參數資料（AllData）。      | 資料同步作業                     | `getTargetsheet`, `getAllData` |
| `getAllData`         | 根據日期從 `AllData` 工作表中檢索完整的占星與干支參數。 | `combineData`, `getPrediction01` | 無                             |
| `setPredictProgress` | 更新前端進度條狀態（GAS 模擬實作）。                    | `getGalaxyPrediction`            | 無                             |
| `logSystemError`     | 系統層級的錯誤記錄函式。                                | 所有 Try-Catch 區塊              | 無                             |
