# 重新設計預測程式(Predict.html)

## 系統環境

- [系統環境](DocGalaxy計劃文件.md#1-系統環境與架構)

## 相關資料庫

- [GalaxyLotto 試算表](GalaxyLotto試算表.md)  
  - [AllData 工作表](GalaxyLotto_AllData工作表.md)
- [L539L649L638LSix 試算表](L539L649L638LSix試算表.md)
  - [All 工作表](共同工作表_all工作表.md)
  - [Miss 工作表](共同工作表_miss工作表.md)  
  - [predic1_Settings 工作表](DocSpreadsheet.md#predic1_settings-工作表)
    : 存放設定值(如果不存在工作表需建立)
  - [predic1_Property 工作表](DocSpreadsheet.md#predic1_property-工作表)
    : 存放權重(如果不存在工作表需建立)

## 網頁及程式碼

- [Predict.html](Predict.html) : 網頁進入點

| ID                   | 標題                               | Type       | Tip                        | 預設值   | 說明                              |
| :------------------- | :--------------------------------- | :--------- | :------------------------- | :------- | :-------------------------------- |
| predictDate          | 日期                               | Input/Date | 請輸入預測日期             | Today    |                                   |
| lottoSelect          | 選擇彩種                           | select     | 請選擇彩種                 | 今彩 539 |                                   |
| topNSelect           | 推薦數量                           | select     | 請選擇推薦數量             | 10       | 有10，7，依不同彩別設定最低數量。 |
| useTrend             | 考慮冷熱號權重趨勢(基於遺漏表分析) | checkbox   |                            | checked  |                                   |
| historyStatsToggle   | 顯示歷史準確度(近30期)             | checkbox   |                            |          |                                   |
| gaugeDisplayToggle   | 顯示星系震盪儀表                   | checkbox   |                            |          |                                   |
| displayModeToggle    | 詳細分析模式                       | checkbox   | 顯示詳細資料               |          |                                   |
| predictButton        | 開始星系預測                       | button     | 開始星系預測               |          |                                   |
| clearWeightsCacheBtn | 刷新AI權重快取                     | button     |                            |          |                                   |
| clearGalaxyCacheBtn  | 清除星系規律預測快取               | button     | 刷新星系快取               |          |                                   |
| aiSuggestionArea     |                                    | div        | AI智能建議區               |          |                                   |
| gaugeArea            |                                    | div        | 星系震盪儀表(詳細模式使用) |          |                                   |
| historyStatsArea     |                                    | div        | 歷史數據圖形顯示區         |          |                                   |
| predictResultArea    |                                    | div        | 預測結果顯示區             |          |                                   |

- [Predict_Style.html](Predict_Style.html) : 網頁樣式
- [Predict_JS.html](Predict_JS.html) : 網頁jQuery 前端程式碼
- [Predict_Server.js](Predict_Server.js) :　伺服端程式碼
- [Utility.js](Utility.js) : 公用程式

## 注意事項

- 除了以上檔案,請勿更動其他程式碼檔案
- 每個function 需建立除錯機制
- GAS 有執行 6分鐘 限制,儘量不要使用伺服器屬性,各彩別的權重及資料及快取須分開儲存在試算表中。
- 要注意不要把答案帶入計算。
