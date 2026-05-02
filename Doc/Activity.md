# 活性表單設計總覽

系統環境

- [系統環境](Galaxy計劃文件.md#系統環境)

## 相關檔案

- [Activity.html](Activity.html) : 網頁進入點
- [ActivityR.html](ActivityR.html) : Activity.html 的輸出頁面
- [Activity_JS.html](Activity_JS.html) : 網頁jQuery 前端程式碼
- [Activity_Style.html](Activity_Style.html) : 網頁樣式
- [Activity_Server.js](Activity_Server.js) : 伺服端程式碼
- [Utility.js](Utility.js) : 公用程式

## 相關資料庫

- [GalaxyLotto 試算表](Spreadsheet.md#galaxylotto-試算表)
  - [AllData 工作表](Spreadsheet.md#alldata-工作表)
  - [Method 工作表](Spreadsheet.md#method-工作表)
- [L539,L649,L638,LSix 試算表](Spreadsheet.md#l539l649l638lsix-試算表)
  - [All 工作表](Spreadsheet.md#all-工作表)
  - [Miss 工作表](Spreadsheet.md#miss-工作表)
  - [FreqSec 工作表](Spreadsheet.md#freqsec-工作表)
  - [FreqSecM 工作表](Spreadsheet.md#freqsecm-工作表)
  - [FreqSec05 工作表](Spreadsheet.md#freqsec05-工作表)
  - [FreqSec10 工作表](Spreadsheet.md#freqsec10-工作表)
  - [FreqSec25 工作表](Spreadsheet.md#freqsec25-工作表)
  - [FreqSec50 工作表](Spreadsheet.md#freqsec50-工作表)
  - [FreqSec100 工作表](Spreadsheet.md#freqsec100-工作表)
  - [FreqSecMHis 工作表](Spreadsheet.md#freqsecMHis-工作表)
  - [FreqSec05His 工作表](Spreadsheet.md#freqsec05His-工作表)
  - [FreqSec10His 工作表](Spreadsheet.md#freqsec10His-工作表)
  - [FreqSec25His 工作表](Spreadsheet.md#freqsec25His-工作表)
  - [FreqSec50His 工作表](Spreadsheet.md#freqsec50His-工作表)
  - [FreqSec100His 工作表](Spreadsheet.md#freqsec100His-工作表)

## 相關函式

- [getMethodSN](Utility.md#函式-getmethodsn-設計概念)
- [GetallData](Utility.md#函式-getalldata-設計概念)

## 相關物件

## 頁面設計

| ID             | Type        | 名稱           | 說明           |
| :------------- | :---------- | :------------- | :------------- |
| AeraAllData    | Div         | 日期詳細資料區 | 日期詳細資料區 |
| INDate         | Date        | 日期           | 預測日期       |
| chkField       | form-switch | 欄位           | 欄位選擇開關   |
| AreaField      | Div         | 欄位選擇區     | 欄位選擇區     |
| SecField1      | select      | 欄位1          | 預測欄位1      |
| SecField2      | select      | 欄位2          | 預測欄位2      |
| SecField3      | select      | 欄位3          | 預測欄位3      |
| SecField4      | select      | 欄位4          | 預測欄位4      |
| chkNext        | form-switch | 托牌           | 托牌選擇開關   |
| AreaNext       | Div         | 托牌選擇區     | 托牌選擇區     |
| SecNextNums    | select      | 星數           | 托牌星數 1~4   |
| SecNextStep    | select      | 間隔期數       | 托牌間隔 1~5   |
| chkRange       | form-switch | 資料設定       | 資料選擇開關   |
| AreaRange      | Div         | 資料設定區     | 資料設定區     |
| InDataLimit    | input       | 資料數量       | 資料數量       |
| InDataOffset   | input       | 資料偏移量     | 資料偏量       |
| InSearchLimit  | input       | 搜尋數量       | 搜尋數量       |
| InSearchOffset | input       | 搜尋偏移量     | 搜尋偏移量     |
| SecModules     | select      | 模組           | 模組選擇       |
| btnQuery       | button      | 查詢           | 查詢(另開新頁) |
