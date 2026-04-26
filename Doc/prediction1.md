# prediction1 開發概要

## 資料
- [Spreadsheet](Spreadsheet.md)
- 分析 L539.xlsx ,L649.xlsx , L638.xlsx , LSix.slsx 的欄位和值.
- Date 是日期
- N1~N5,N6是相關開出的數值,S1是特別號,Sum是數值總合。

## 相關工作表
- mainSpreadSheet 試算表 > AllData 工作表
- L539(L649,L638,LSix) 試算表 > All 工作表
- L539(L649,L638,LSix) 試算表 > Miss 工作表
- L539(L649,L638,LSix) 試算表 > prct1_Settings 工作表 
- L539(L649,L638,LSix) 試算表 > prct1_History 工作表
- L539(L649,L638,LSix) 試算表 > prct1_Property 工作表

## 檔案

| 檔名 | 說明 |
| :--- | :--- |
| Prediction1.html |  包含 日期選項 ,種類選項 ,推薦數量選項 ,使用遺漏數選項 ,推薦結果表格 ,歷史數據圖形 ,預測結果按鈕。| 
| Prediction1_JS.html | 前端程式碼 |
| Prediction1_Style.html | 頁面樣式 CSS |
| Prediction1_Server.js | 後端程式碼 |

## 設計概要
- 程式 : 重新寫新的預測程式getPrediction01(lotto, dateStr, useTrend, topNChoice)
  - lotto : 種類 ,
  - dateStr : 日期 ,
  - useTrend : 是否使用遺漏數 ,
  - topNChoice : 推薦數量。
    - 推薦數字有10 個 ,7個 及 依不同種類開出的實際數量.
- 可重複使用的 function 分開獨立成 functions 且要有除錯機制。
  1. 提取 mainSpreadSheet 試算表 > AllData 工作表 的 預測日期的資料。
  2. 提取 L539(L649,L638,LSix) 試算表 > All 工作表 的最近小於預測日期 60 期間內的的資料。檢測其相關性及特徵,權重,若不適當則自行調整測試期數,並把相關係數寫入 各別試算表>prct1_Settings 工作表中。
  3. 若有 勾選 使用遺漏數,則把遺漏數(提取 L539(L649,L638,LSix) 試算表 >
       Miss 工作表的最近小於預測日期 60 期間內的的資料,提取數量與上面第2項相同)納入計算。
  4. 預測結果與L539(L649,L638,LSix) 試算表 > All 工作表比對命中結果。
  5. 歷史數據圖形中 顯示自行推演 前10期 (由 L539(L649,L638,LSix) 試算表 >
       All 工作表 的最近小於預測日期 10 期提供日期)的命中結果.
  6. 注意 : 不要把答案納入計算。
  7. 在推薦數字球旁標示命中,過熱,過冷...等等字樣。
  8. 如果有答案 要標示命中個數 例如 L539 日期 , 命中 3/5 .
- 不要改寫任何現有的程式。
- 並在 index.html 增加一個新按鈕。
- 並在 Nav.html 增加一個連結。
- 以中文回答
- 回答完整程式碼以方便閱讀及尋找。
- 把建議事項存在頁尾。

## 已處理事項
- [已處理] 請為 Prediction1_JS.html 中的
  `renderResults`函數進行重構，將其拆分為多個子函數以提升可讀性。
- [已處理] 在 Prediction1_Server.js 中，針對
  `autoAdjustBaseWeights`增加一個根據命中率調整 `piResonance` 權重的機制。
- [已處理]
  優化 Prediction1_Style.html，讓命中球號在動畫結束後保持一個緩慢旋轉或呼吸的發光效果。
- [已處理]
  優化 Prediction1_Server.js，如果噴發星球 (eruptionBalls) 不足 3 顆，自動放寬分數門檻 (如從 0.6 降至 0.5) 以確保預警資訊的豐富度。
- [已處理]
  在 Prediction1_Server.js 中增加一個「自動清理」機制，當歷史資料超過 500 筆時，自動觸發舊版本清理。
- [已處理]
  請優化 analyzePiResonance，讓它能分析更長期的資料（例如 200 期）來提高 PI 共振得分的精準度。
- [已處理]
  在 Prediction1_JS.html 中，針對一鍵換組（exchangeNumber）功能增加一個「優先選擇冷門反彈球」的選項。
- [已處理] 請幫我檢查 Prediction1_Server.js 中的 `getRecentHistoryHits`
  函數，確保它在處理 L649 時能正確辨識特別號 S1。
- [已處理]
  在 Prediction1_JS.html 中為「噴發中」的標籤增加一個強烈的熔岩發光動畫，進一步強化視覺上的警示效果。
- [已處理] 在 Prediction1_Server.js 中，為 `corePredict`
  增加一個偵測「近期熱門尾數」並給予額外加權的邏輯。
- [已處理] 請幫我檢查 Prediction1_JS.html 的
  `renderPiChart`，確保在深色模式下圖表的格線與文字顏色能自動適配。
- [已處理]
  保持 prct1_History 的資料單一性，優化 getRecentHistoryHits 的批次合併去重邏輯。
- [已處理] 修正 Prediction1_JS.html 中的語法錯誤 (Unexpected token )。
- [已處理]
  檢查 Prediction1_Server.js 中的 calculateStats，確保在計算連莊率時有考慮到不同彩種的特別號 S1。
- [已處理]
  在 Prediction1.html 中新增一個「權重戰略面板」，讓使用者能直觀看到熱門尾數與五行加權的當前數值。
- [已處理] 請在 Prediction1_JS.html 的 `renderAISuggestion`
  函式中，加入填充「權重戰略面板」的代碼，顯示熱門尾數與權重。
- [已處理] 檢查 Prediction1_Server.js 的
  `applyConsecutiveInterceptor`，確保在阻斷連號時不會誤刪權重極高的關鍵星球。
- [已處理] 檢查 Prediction1_Server.js 中的
  `calculateStats`，確保在計算連莊率時，如果是 L638 彩種，除了 S1 外，是否有考慮到主區號碼與第二區號碼的跨區重複規律。

- [已處理] 為 Prediction1_JS.html 的 `renderPiChart`
  增加數據點擊事件，讓使用者點擊特定相位時能顯示該號碼的歷史共振日期。
- [已處理] 在 Prediction1_Server.js 中，針對 L638 的 `applyPositionLimiter`
  加入「第二區 S1 專屬限制器」，避免特別號偏移過大。
- [已處理]
  優化 Prediction1_JS.html 的 updateCacheInfo，讓它在切換彩種時能立即刷新，而不需要等待定時器。在 Prediction1_JS.html 中增加一個顯示「目前快取版本與儲存行數」的資訊區塊，方便追蹤清理邏輯是否正常執行。
- [已處理]
  檢查 Prediction1_Server.js 中的 setPropertySheetValue 函式，確保它在寫入 KV 資料時不會產生重複的 Key。
- [已處理]
  檢查 Prediction1_JS.html 確保 renderMainResultCard 不再引用 isResonance 變數。
- [已處理]
  在 Prediction1_Server.js 中搜尋並移除所有 analyzePiResonance 的函式定義，徹底清理代碼體積。
- [已處理]
  檢查 Prediction1_Server.js 確保 getLearnedBaseWeights 函式中已徹底移除 piResonance 預設權重。
- [已處理]
  為 Prediction1_Server.js 的 getPrediction01 增加執行時長監控，若超過 5 分鐘自動記錄日誌。
- (新思維) 在"本命"欄位,讀取預測日期當天的值,然後把 All工作表 > 本命欄位 相同的值,取最接近預測日期60期,進行 數字(N1~N5,N6,S1) 觀察其出現頻率 ,並了鮮其權重配置，嚐試提高命中率。
- [已處理]
  優化 Prediction1_Server.js 中的 corePredict，加入對「本命」欄位的頻率觀察邏輯以實驗性提升命中率。
- 檢查 Prediction1_Server.js，為「本命」頻率觀察邏輯增加時間權重衰減，讓越接近預測日期的匹配日具有更高影響力。
- [已處理]
  在 Prediction1_JS.html 的「權重戰略面板」中增加一個欄位，顯示當前「本命」值的匹配紀錄數量，方便使用者了解數據參考價值。
- [已處理]
  為 Prediction1_Server.js 實作本命共振的自動學習邏輯，根據歷史命中率動態調整metaBoostLifePalace。
- [已處理] 在戰略面板的本命共振欄位增加 Tooltip 提示，顯示當前匹配到的歷史期數。
- [已處理]
  檢查 Prediction1_Server.js，為「本命」頻率觀察邏輯增加時間權重衰減，讓越接近預測日期的匹配日具有更高影響力。
- [已處理]
  檢查 Prediction1_Server.js 中的 autoAdjustBaseWeights，確保在權重箝位邏輯中不會包含已被移除的 piResonance。
- [已處理]
  檢查 Prediction1_Server.js，為本命頻率增益加入「時間衰減」，讓越近期的匹配日對權重影響更大。
- (新思維) 在"父母"欄位及其他紫微欄位,讀取預測日期當天的值,然後把 All工作表 > 相對欄位 相同的值,取最接近預測日期60期,進行 數字(N1~N5,N6,S1) 觀察其出現頻率 ,並了鮮其權重配置，嚐試提高命中率。
- [已處理]
  優化 getPrct1LottoConfig，加入不同彩種的「理論和值期望值」與「標準偏差範圍」，供數據分析師過濾器使用。
- [已處理]
  檢查 Prediction1_Server.js 中的 ziWeiFreq 計算，確保當多個宮位出現同一個號碼時，頻率累加邏輯不會導致特定號碼權重過高。
- [已處理]
  在 Prediction1.html 中增加一個「宮位分析明細」視窗，讓使用者能點擊查看哪些宮位對當前預測提供了最高的共振貢獻。
- [已處理]
  在「宮位分析明細」視窗中，為每個宮位增加一個「查看歷史球號」按鈕，讓使用者能直接看到該宮位參數在歷史上最常開出的前 3 顆星球。
- [已處理]
  在「宮位分析明細」視窗中，為這些「歷史星球」增加點擊功能，點擊後能自動將該球號加入到當前的預測組合中。
- [已處理]
  優化 Prediction1_Style.html，為 table-success-subtle 增加一個微弱的青色外發光效果，提升明細視窗的科技感。
- [已處理]
  優化 Prediction1_Server.js，將 ziWeiHouseDetails 的計算結果存入快取，避免每次點擊分析視窗都要重新計算。
- [已處理]
  在 Prediction1_Server.js 中增加一個「資料完整性檢查」函式，在執行 corePredict 前先驗證 trainingData 是否有遺漏的球號或錯誤格式。
- [已處理]
  檢查 Prediction1_Server.js 中是否還有其他地方遺留了未定義的 maxNum 或 ballCount 變數。
- [已處理]
  在 Prediction1_Server.js 中實作資料完整性檢查函式，在預測前自動過濾掉 trainingData 中非數值或超出 config.maxNum 範圍的異常資料。
- [已處理]
  檢查 Prediction1_Server.js 中是否還有其他函式（如 corePredict）存在重複宣告變數的情況。
- [已處理]
  優化 applyAnalystFilters 的邏輯，將 theoryMeanSum 與 stdDev 的賦值移至函式頂端，與 config 一起初始化，提高代碼整潔度。
- [已處理]
  優化 Prediction1_Server.js 中的 ziWeiFreq 計算，加入「宮位重要性權重」，例如本命宮的頻率貢獻應高於兄弟宮。
- [已處理]
  在 Prediction1_JS.html 中增加一個「共振雷達圖」按鈕，將十二宮位的得分轉換為圓形雷達圖顯示，更直觀地呈現能量分佈。
- [已處理]
  優化 Prediction1_JS.html 的「權重戰略面板」，為「紫微共振」增加一個小動畫，顯示當前匹配到的歷史期數佔總期數的百分比。
- [已處理]
  在 Prediction1_Server.js 中增加一個「黃金分割過濾器」，根據理論期望值計算 0.618 與 0.382 的黃金分割點，對處於這些關鍵點位附近的號碼給予額外加權。
- [已處理]
  在 validatePrct1TrainingData 中增加一個邏輯，如果被過濾掉的異常資料超過 20%，則在 finalResult 增加一個資料品質警告標籤。
- [已處理]
  優化 checkHits，使其能同時回傳「連莊球數」與「隔期球數」的命中統計，並顯示在預測結果卡片上。
- [已處理]
  在 Prediction1_Server.js 中實作「黃金分割過濾器」，根據彩種的理論期望值（theorySum）計算關鍵點位並加權。

## 建議事項

- 優化 Prediction1_JS.html 的戰略對比視窗，增加一個和值分佈的微型長條圖，顯示當前預測總和在標準差區間內的相對位置。
- 優化 Prediction1_JS.html，實作「共振雷達圖」視窗，視覺化呈現十二宮位的能量分佈。
- 優化 Prediction1_JS.html，在預測結果卡片上方增加一個「環境能量強度」指示條，根據 changeRatio 視覺化呈現當前日期的參數變動劇烈程度。
- 在 Prediction1_Server.js 中實作「和值引力熱力圖」數據回傳，供前端繪製和值在標準差區間內的位移趨勢。
