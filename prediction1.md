- 系統 : GAS 系統(6分鐘執行限制) , jQuery , BootStrap ,swal2 界面
- 界面 : 手機 1080 *2340,平板 1280*800 ,桌面
- 資料 : 分析 L539.xlsx ,L649.xlsx , L638.xlsx , LSix.slsx 的欄位和值.
  - Date 是日期
  - N1~N5,N6是相關開出的數值,S1是特別號,Sum是數值總合。
- 程式 : 重新寫新的預測程式getPrediction01(lotto, dateStr, useTrend, topNChoice)
  - lotto : 種類 ,dateStr : 日期 ,useTrend : 是否使用 遺漏數 ,topNChoice : 推薦數量。
  - 推薦數字有10 個 ,7個 及 依不同種類開出的實際數量.
  - 可重複使用的 function 分開獨立成 functions 且要有除錯機制。
    1. 提取 mainSpreadSheet 試算表 > AllData 工作表 的 預測日期的資料。
    2. 提取 L539(L649,L638,LSix) 試算表 > All 工作表 的最近小於預測日期 60 期間內的的資料。檢測其相關性及特徵,權重,若不適當則自行調整測試期數,並把相關係數寫入各別試算表>prct1_Settings 工作表中。
    3. 若有 勾選 使用遺漏數,則把遺漏數(提取 L539(L649,L638,LSix) 試算表 > Miss 工作表的最近小於預測日期 60 期間內的的資料,提取數量與上面第2項相同)納入計算。
    4. 預測結果與L539(L649,L638,LSix) 試算表 > All 工作表比對命中結果。
    5. 歷史數據圖形中 顯示自行推演 前10期 (由 L539(L649,L638,LSix) 試算表 > All 工作表 的最近小於預測日期 10 期提供日期)的命中結果.
    6. 注意 : 不要把答案納入計算。
    7. 在推薦數字球旁標示命中,過熱,過冷...等等字樣。
    8. 如果有答案 要標示命中個數 例如 L539 日期 , 命中 3/5 .
  - 不要改寫任何現有的程式。
- 新的html 檔案 : Prediction1.html
  - 包含 日期選項 ,種類選項 ,推薦數量選項 ,使用遺漏數選項 ,推薦結果表格 ,歷史數據圖形 ,預測結果按鈕。
- 新的JS 檔案 : Prediction1_JS.html。
- 新的Style 檔案 : Prediction1_Style.html。
- 新的伺服端程式 : Prediction1_Server.js。
- 並在 index.html 增加一個新按鈕。
- 並在 Nav.html 增加一個連結。
- 以中文回答
