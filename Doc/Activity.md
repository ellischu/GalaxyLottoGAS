# 活性表單設計總覽

- [系統環境](#系統環境)
- [相關檔案](#相關檔案)
- [相關資料庫](#相關資料庫)
- [相關函式](#相關函式)
- [相關物件](#相關物件)
- [頁面設計](#頁面設計)

## 系統環境

- [系統環境](Galaxy計劃文件.md#系統環境)

[返回最上層](#活性表單設計總覽)

## 相關檔案

- [Utility.js](Utility.js) : 公用程式

[返回最上層](#活性表單設計總覽)

## 相關資料庫

- [GalaxyLotto 試算表](Spreadsheet.md#galaxylotto-試算表)
  - [AllData 工作表](Spreadsheet.md#alldata-工作表)
  - [Method 工作表](Spreadsheet.md#method-工作表)
- [L539,L649,L638,LSix 試算表](Spreadsheet.md#l539l649l638lsix-試算表)
  - [All 工作表](Spreadsheet.md#all-工作表)
  - [Miss 工作表](Spreadsheet.md#miss-工作表)
  - [FreqSec 工作表](Spreadsheet.md#freqsec-工作表)
  - [FreqSecHis 工作表](Spreadsheet.md#freqsechis-工作表)

[返回最上層](#活性表單設計總覽)

## 相關函式

- [getMethodSN](Utility.md#函式-getmethodsn-設計概念)
- [GetallData](Utility.md#函式-getalldata-設計概念)

[返回最上層](#活性表單設計總覽)

## 相關物件

[返回最上層](#活性表單設計總覽)

## 頁面設計

- [ActivityS.html](#activityshtml) : 參數設定頁面
- [Activity.html](#activityhtml) : ActivityS.html 的輸出頁面
  - [lblMethod](#lblmethod) : 方法序號詳細資料區 (Type : Label)
  - [AeraAll](#aeraall) : 當日結果及日期詳細資料區 (Type : Table)
  - [AreaTable](#aeratable) : 結果資料區 (Type : Table)
- [Activity_JS.html](Activity_JS.html) : 網頁jQuery 前端程式碼
- [Activity_Style.html](Activity_Style.html) : 網頁樣式
- [Activity_Server.js](Activity_Server.js) : 伺服端程式碼

[返回最上層](#活性表單設計總覽)

### ActivityS.html

參數設定頁面

| ID             | Type        | 名稱           | 說明           |
| :------------- | :---------- | :------------- | :------------- |
| AeraAllData    | Div         | 日期詳細資料區 | 日期詳細資料區 |
| INDate         | Date        | 日期           | 預測日期       |
| SecLotto       | select      | 彩種           | 彩種選擇       |
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
| InDataLimit    | input       | 資料數量       | 期數限制       |
| InDataOffset   | input       | 資料偏移量     | 期數偏量       |
| InSearchLimit  | input       | 搜尋數量       | 查詢限制       |
| InSearchOffset | input       | 搜尋偏移量     | 查詢偏量       |
| SecModules     | select      | 模組           | 模組選擇       |
| btnQuery       | button      | 查詢           | 查詢(另開新頁) |

[返回](#頁面設計)

### Activity.html

ActivityS.html 的輸出頁面

| ID                      | Type  | 名稱                     | 說明                                                 |
| :---------------------- | :---- | :----------------------- | :--------------------------------------------------- |
| [lblMethod](#lblmethod) | Label | 方法序號                 | 顯示方法序號相關係數                                 |
| [AeraAll](#aeraall)     | Div   | 當日結果及日期詳細資料區 | 結果及日期詳細資料區<br>預設為收合狀態，點擊後展開。 |
| [AreaTable](#aeratable) | Div   | 結果資料區               | 結果資料區                                           |

[返回](#頁面設計)

#### lblMethod

方法序號詳細資料區 (Type : Label)

```javascript
//判定是否為欄位模式
strField = methodSN.FieldMode ? "相同欄位 : ${methodSN.strCompares| " : "";

//判定是否為托牌模式
strNext = methodSN.NextNumsMode
  ? "托牌設定 : ${methodSN.intNextNums} 星，間隔 ${methodSN.intNextStep} 期托牌"
  : "";

//如果都 strField 和 strNext 都為 "" 時,設為 "一般" 。
lblMethod.text = strField + strNext || "一般";
```

[返回](#頁面設計)

#### AeraAll

當日結果及日期詳細資料區 (Type : Table)

| FieldName    | Type   | 名稱         | 顯示標題 | 說明                    |
| :----------- | :----- | :----------- | :------- | :---------------------- |
| Date         | Date   | 日期         | 日期     | 預測資料日期            |
| N1           | Int    | 號1          | 號1      | 號碼1 (如果沒有則為0)   |
| N2           | Int    | 號2          | 號2      | 號碼2 (如果沒有則為0)   |
| N3           | Int    | 號3          | 號3      | 號碼3 (如果沒有則為0)   |
| N4           | Int    | 號4          | 號4      | 號碼4 (如果沒有則為0)   |
| N5           | Int    | 號5          | 號5      | 號碼5 (如果沒有則為0)   |
| N6           | Int    | 號6          | 號6      | 號碼6 (如果沒有則為0)   |
| S1           | Int    | 特別號1      | 特別號1  | 特別號1 (如果沒有則為0) |
| Sum          | Int    | 總合         | 總合     | 總合                    |
| 年天干       | String | 年天干       | 年干     | 年天干                  |
| 年地支       | String | 年地支       | 年支     | 年地支                  |
| 月天干       | String | 月天干       | 月干     | 月天干                  |
| 月地支       | String | 月地支       | 月支     | 月地支                  |
| 日天干       | String | 日天干       | 日干     | 日天干                  |
| 日地支       | String | 日地支       | 日支     | 日地支                  |
| 時柱         | String | 時柱         | 時柱     | 時柱                    |
| 日五形       | String | 日五形       | 日形     | 日五形                  |
| 日十二建除   | String | 日十二建除   | 日執     | 日十二建除              |
| 日九星       | String | 日九星       | 日星     | 日九星                  |
| 日二十八星宿 | String | 日二十八星宿 | 日宿     | 日二十八星宿            |
| 時二十八星宿 | String | 時二十八星宿 | 時宿     | 時二十八星宿            |
| 日八掛       | String | 日八掛       | 日掛     | 日八掛                  |
| 本命         | String | 本命         | 本命     | 紫微本命宮              |
| 父母         | String | 父母         | 父母     | 紫微父母宮              |
| 福德         | String | 福德         | 福德     | 紫微福德宮              |
| 田宅         | String | 田宅         | 田宅     | 紫微田宅宮              |
| 官祿         | String | 官祿         | 官祿     | 紫微官祿宮              |
| 奴僕         | String | 奴僕         | 奴僕     | 紫微奴僕宮              |
| 遷移         | String | 遷移         | 遷移     | 紫微遷移宮              |
| 疾厄         | String | 疾厄         | 疾厄     | 紫微疾厄宮              |
| 財帛         | String | 財帛         | 財帛     | 紫微財帛宮              |
| 子女         | String | 子女         | 子女     | 紫微子女宮              |
| 夫妻         | String | 夫妻         | 夫妻     | 紫微夫妻宮              |
| 兄弟         | String | 兄弟         | 兄弟     | 紫微兄弟宮              |
| 命重         | String | 命重         | 命重     | 命重                    |

- N1~N6,S1 要隨著彩種而異。

[返回](#頁面設計)

#### AeraTable

結果資料區 (Type : Table)

| 欄位名稱   | 數值型態 | 預設值 | 顯示標題  | 說明            |
| :--------- | :------- | :----- | :-------- | :-------------- |
| IntN       | Int      | 0      | 號碼      | 星球代碼        |
| IntM       | Int      | 0      | 遺漏數    | 遺漏數值        |
| IntMinM    | Int      | 0      | 遺小      | 遺漏數最小值    |
| IntMaxM    | Int      | 0      | 遺大      | 遺漏數最大值    |
| IntAvgM    | Int      | 0      | 遺均      | 遺漏數平均值    |
| IntACM     | Double   | 0      | 遺標差    | 遺漏數標準差    |
| intFreq05  | Int      | 0      | 頻05      | 分區05出現次數  |
| intMin05   | Int      | 0      | 頻05小    | 分區05最小值    |
| intMax05   | Int      | 0      | 頻05大    | 分區05最大值    |
| intAvg05   | Int      | 0      | 頻05均    | 分區05平均值    |
| intAC05    | Double   | 0      | 頻05標差  | 分區05標準差    |
| intFreq10  | Int      | 0      | 頻10      | 分區10出現次數  |
| intMin10   | Int      | 0      | 頻10小    | 分區10最小值    |
| intMax10   | Int      | 0      | 頻10大    | 分區10最大值    |
| intAvg10   | Int      | 0      | 頻10均    | 分區10平均值    |
| intAC10    | Double   | 0      | 頻10標差  | 分區10標準差    |
| intFreq25  | Int      | 0      | 頻25      | 分區25出現次數  |
| intMin25   | Int      | 0      | 頻25小    | 分區25最小值    |
| intMax25   | Int      | 0      | 頻25大    | 分區25最大值    |
| intAvg25   | Int      | 0      | 頻25均    | 分區25平均值    |
| intAC25    | Double   | 0      | 頻25標差  | 分區25標準差    |
| intFreq50  | Int      | 0      | 頻50      | 分區50出現次數  |
| intMin50   | Int      | 0      | 頻50小    | 分區50最小值    |
| intMax50   | Int      | 0      | 頻50大    | 分區50最大值    |
| intAvg50   | Int      | 0      | 頻50均    | 分區50平均值    |
| intAC50    | Double   | 0      | 頻50標差  | 分區50標準差    |
| intFreq100 | Int      | 0      | 頻100     | 分區100出現次數 |
| intMin100  | Int      | 0      | 頻100小   | 分區100最小值   |
| intMax100  | Int      | 0      | 頻100大   | 分區100最大值   |
| intAvg100  | Int      | 0      | 頻100均   | 分區100平均值   |
| intAC100   | Double   | 0      | 頻100標差 | 分區100標準差   |

- Double 為 小數點 3 位 。

[返回](#頁面設計)
