# 試算表及工作表資料

- [GalaxyLotto 試算表](#galaxylotto-試算表)
- [L539,L649,L638,LSix 試算表](#l539l649l638lsix-試算表)

# GalaxyLotto 試算表：

- [L539 工作表](#l539-工作表) ： L539象限的39顆星球出現的結果。
- [L649 工作表](#l649-工作表) ： L649象限的49顆星球出現的結果。
- [L638 工作表](#l638-工作表) ： L638象限的38顆星球出現的結果。
- [LSix 工作表](#lsix-工作表) ： LSix象限的49顆星球出現的結果。
- [AllData 工作表](#alldata-工作表) ： 日期相關係數。
- [Method 工作表](#method-工作表) ： 搜尋條件相關序號。
- [Sheets 工作表](#sheets-工作表) ： 相關試算表及網址。
- [Folders 工作表](#folders-工作表) : 相關資料夾及網址。
- [IDName 工作表](#idname-工作表) ： ID與ID名稱對照表。
- [FieldName 工作表](#fieldname-工作表) ： 欄位名稱對照表。
- [ErrorLog 工作表](#errorlog-工作表): 系統錯誤記錄表。

[回首頁](#試算表及工作表資料)

## L539 工作表

記錄由地球在特定日期，固定時間，觀察L539象限的39顆星球出現的結果。

| 欄位名稱 | 數值型態 | 預設值 | 標題 | 說明      |
| :------- | :------- | :----- | :--- | :-------- |
| period   | String   | null   | 期數 | 官方期數  |
| Date     | Date     | null   | 日期 | 日期      |
| L1       | Int      | null   | 落1  | 落球號碼1 |
| L2       | Int      | null   | 落2  | 落球號碼2 |
| L3       | Int      | null   | 落3  | 落球號碼3 |
| L4       | Int      | null   | 落4  | 落球號碼4 |
| L5       | Int      | null   | 落5  | 落球號碼5 |
| Sum      | Int      | 0      | 總合 | 號數總合  |
| series   | Int      | null   | 序號 | 各年序號  |

[Back](#galaxylotto-試算表)

## L649 工作表

記錄由地球在特定日期，固定時間，觀察L649象限的49顆星球出現的結果。

| 欄位名稱 | 數值型態 | 預設值 | 標題 | 說明      |
| :------- | :------- | :----- | :--- | :-------- |
| period   | String   | null   | 期數 | 官方期數  |
| Date     | Date     | null   | 日期 | 日期      |
| L1       | Int      | null   | 落1  | 落球號碼1 |
| L2       | Int      | null   | 落2  | 落球號碼2 |
| L3       | Int      | null   | 落3  | 落球號碼3 |
| L4       | Int      | null   | 落4  | 落球號碼4 |
| L5       | Int      | null   | 落5  | 落球號碼5 |
| L6       | Int      | null   | 落6  | 落球號碼6 |
| S1       | Int      | null   | 特1  | 特別號1   |
| Sum      | Int      | 0      | 總合 | 號數總合  |
| series   | Int      | null   | 序號 | 各年序號  |

[Back](#galaxylotto-試算表)

## L638 工作表

記錄由地球在特定日期，固定時間，觀察L638象限的38顆星球出現的結果。

| 欄位名稱 | 數值型態 | 預設值 | 標題 | 說明            |
| :------- | :------- | :----- | :--- | :-------------- |
| period   | String   | null   | 期數 | 官方期數        |
| Date     | Date     | null   | 日期 | 日期            |
| L1       | Int      | null   | 落1  | 落球號碼1       |
| L2       | Int      | null   | 落2  | 落球號碼2       |
| L3       | Int      | null   | 落3  | 落球號碼3       |
| L4       | Int      | null   | 落4  | 落球號碼4       |
| L5       | Int      | null   | 落5  | 落球號碼5       |
| L6       | Int      | null   | 落6  | 落球號碼6       |
| S1       | Int      | null   | 特1  | 特別號1 (1~8)   |
| Sum      | Int      | 0      | 總合 | 號數總合(L1~L6) |
| series   | Int      | null   | 序號 | 各年序號        |

[Back](#galaxylotto-試算表)

## LSix 工作表

記錄由地球在特定日期，固定時間，觀察LSix象限的49顆星球出現的結果。

| 欄位名稱 | 數值型態 | 預設值 | 標題 | 說明      |
| :------- | :------- | :----- | :--- | :-------- |
| period   | String   | null   | 期數 | 官方期數  |
| Date     | Date     | null   | 日期 | 日期      |
| L1       | Int      | null   | 落1  | 落球號碼1 |
| L2       | Int      | null   | 落2  | 落球號碼2 |
| L3       | Int      | null   | 落3  | 落球號碼3 |
| L4       | Int      | null   | 落4  | 落球號碼4 |
| L5       | Int      | null   | 落5  | 落球號碼5 |
| L6       | Int      | null   | 落6  | 落球號碼6 |
| S1       | Int      | null   | 特1  | 特別號1   |
| Sum      | Int      | 0      | 總合 | 號數總合  |
| series   | Int      | null   | 序號 | 各年序號  |

[Back](#galaxylotto-試算表)

## AllData 工作表

日期相關係數。

| 欄位名稱     | 數值型態 | 預設值 | 標題         | 說明           |
| :----------- | :------- | :----- | :----------- | :------------- |
| Date         | Date     | null   | 日期         | 日期(不可重複) |
| 年天干       | String   | null   | 年天干       | 年天干         |
| 年地支       | String   | null   | 年地支       | 年地支         |
| 月天干       | String   | null   | 月天干       | 月天干         |
| 月地支       | String   | null   | 月地支       | 月地支         |
| 日天干       | String   | null   | 日天干       | 日天干         |
| 日地支       | String   | null   | 日地支       | 日地支         |
| 時柱         | String   | null   | 時柱         | 時柱           |
| 日五形       | String   | null   | 日五形       | 日五形         |
| 日十二建除   | String   | null   | 日十二建除   | 日十二建除     |
| 日九星       | String   | null   | 日九星       | 日九星         |
| 日二十八星宿 | String   | null   | 日二十八星宿 | 日二十八星宿   |
| 時二十八星宿 | String   | null   | 時二十八星宿 | 時二十八星宿   |
| 日八掛       | String   | null   | 日八掛       | 日八掛         |
| 本命         | String   | null   | 本命         | 本命           |
| 父母         | String   | null   | 父母         | 父母           |
| 福德         | String   | null   | 福德         | 福德           |
| 田宅         | String   | null   | 田宅         | 田宅           |
| 官祿         | String   | null   | 官祿         | 官祿           |
| 奴僕         | String   | null   | 奴僕         | 奴僕           |
| 遷移         | String   | null   | 遷移         | 遷移           |
| 疾厄         | String   | null   | 疾厄         | 疾厄           |
| 財帛         | String   | null   | 財帛         | 財帛           |
| 子女         | String   | null   | 子女         | 子女           |
| 夫妻         | String   | null   | 夫妻         | 夫妻           |
| 兄弟         | String   | null   | 兄弟         | 兄弟           |
| 命重         | String   | null   | 命重         | 命重           |

[Back](#galaxylotto-試算表)

## Method 工作表

提供搜尋條件的序號。

| 欄位名稱          | 數值型態 | 預設值         | 標題       | 說明                                                                                     |
| :---------------- | :------- | :------------- | :--------- | :--------------------------------------------------------------------------------------- |
| lngMethodSN       | Bigint   | auto Increment | 方法序號   | 方法序號(自動遞增)                                                                       |
| strCompareType    | String   | AND            | 比對方式   | 比對方式<br>(AND/OR)                                                                     |
| FieldMode         | Boolean  | false          | 欄位模式   | 欄位模式(true/false)<br>當 strCompares 有值時為 true                                     |
| strCompares       | String   | null           | 欄位名稱值 | 欄位名稱<br>(以 # 分隔)                                                                  |
| strComparesDetail | String   | null           | 欄位詳細   | 欄位值<br>(以 # 分隔)                                                                    |
| NextNumsMode      | Boolean  | false          | 托牌模式   | 托牌模式<br>當 intNextNums > 0 時為 true                                                 |
| intNextNums       | Int      | 0              | 托牌數     | 托牌號碼數量                                                                             |
| intNextStep       | Int      | 0              | 托牌間期   | 托牌間隔期數                                                                             |
| strNextNums       | String   | null           | 托牌號     | 托牌號碼<br>(以 # 分隔)                                                                  |
| StrNextNumSpe     | String   | null           | 托牌號特   | 托牌號碼特別號                                                                           |
| intDataLimit      | Int      | 0              | 資料數量   | 資料數量限制                                                                             |
| intDataOffset     | Int      | 0              | 資料偏量   | 資料偏移量                                                                               |
| intSearchLimit    | Int      | 0              | 搜尋數量   | 搜尋數量限制                                                                             |
| intSearchOffset   | Int      | 0              | 搜尋偏量   | 搜尋偏移量                                                                               |
| strcheck          | String   | null           | 檢查值     | 以上欄位值,<br>除了 lngMethodSN。 <br>(以 , 分隔) <br> 防止相同的係數有不同lngMethodSN。 |

[Back](#galaxylotto-試算表)

## Sheets 工作表

試算表相關網址。

| 欄位名稱 | 數值型態 | 預設值 | 標題       | 說明                 |
| :------- | :------- | :----- | :--------- | :------------------- |
| SheetN   | String   | null   | 工作表名稱 | 工作表名稱(不可重複) |
| Url      | String   | null   | 網址       | 網址                 |

[Back](#galaxylotto-試算表)

## Folders 工作表

資料夾相關網址。

| 欄位名稱 | 數值型態 | 預設值 | 標題       | 說明                 |
| :------- | :------- | :----- | :--------- | :------------------- |
| FolderN  | String   | null   | 資料夾名稱 | 資料夾名稱(不可重複) |
| Url      | String   | null   | 網址       | 網址                 |

[Back](#galaxylotto-試算表)

## IDName 工作表

ID與ID名稱對照表。

| 欄位名稱 | 數值型態 | 預設值 | 標題   | 說明             |
| :------- | :------- | :----- | :----- | :--------------- |
| ID       | String   | null   | ID代號 | ID代號(不可重複) |
| IDName   | String   | null   | ID名稱 | ID名稱           |

[Back](#galaxylotto-試算表)

## FieldName 工作表

欄位名稱對照表。

| 欄位名稱     | 數值型態 | 預設值 | 標題     | 說明               |
| :----------- | :------- | :----- | :------- | :----------------- |
| strLabelID   | String   | null   | 欄位名稱 |
| strLabelName | String   | null   | 欄位標題 | 欄位標題(不可重複) |

[Back](#galaxylotto-試算表)

## ErrorLog 工作表

系統錯誤記錄表。

| 欄位名稱   | 數值型態 | 預設值 | 標題       | 說明       |
| :--------- | :------- | :----- | :--------- | :--------- |
| 時間       | Date     | null   | 時間       | 時間       |
| 模組       | String   | null   | 模組       | 模組名稱   |
| 錯誤訊息   | String   | null   | 錯誤訊息   | 錯誤訊息   |
| 堆疊軌跡   | String   | null   | 堆疊軌跡   | 堆疊軌跡   |
| 上下文數據 | String   | null   | 上下文數據 | 上下文數據 |

[Back](#galaxylotto-試算表)

# L539,L649,L638,LSix 試算表

- 共用工作表
  - [All 工作表](#all-工作表) : 日期相關係數。
  - [Miss 工作表](#miss-工作表) : 遺漏數表格工作表。
  - [FreqSec 工作表](#freqsec-工作表) : 分區頻率序號提供工作表。
    - [FreqSecM 工作表](#freqsecM-工作表) : 分區遺漏數工作表。
    - [FreqSec05 工作表](#freqsec05-工作表) : 分區05頻率工作表。
    - [FreqSec10 工作表](#freqsec10-工作表) : 分區10頻率工作表。
    - [FreqSec25 工作表](#freqsec25-工作表) : 分區25頻率工作表。
    - [FreqSec50 工作表](#freqsec50-工作表) : 分區50頻率工作表。
    - [FreqSec100 工作表](#freqsec100-工作表) : 分區100頻率工作表。
    - [FreqSecMHis 工作表](#freqsecMHis-工作表) : 分區歷史遺漏數工作表。
    - [FreqSec05His 工作表](#freqsec05His-工作表) : 分區歷史05頻率工作表。
    - [FreqSec10His 工作表](#freqsec10His-工作表) : 分區歷史10頻率工作表。
    - [FreqSec25His 工作表](#freqsec25His-工作表) : 分區歷史25頻率工作表。
    - [FreqSec50His 工作表](#freqsec50His-工作表) : 分區歷史50頻率工作表。
    - [FreqSec100His 工作表](#freqsec100His-工作表) : 分區歷史100頻率工作表。

- Predict 模組
  - [Predict 模組](Predict.md)
  - [prct1_Settings 工作表](#prct1_settings-工作表) : Predict 模組專用設定表。
  - [prct1_Property 工作表](#prct1_property-工作表) : Predict 模組專用屬性表。
  - [prct1_History 工作表](#prct1_history-工作表) : Predict 模組歷史表。
- Prediction1 模組
  - [Prediction1 模組](Prediction1.md)
  - [predic1_Settings 工作表](#predic1_settings-工作表) :
    Prediction1 模組專用設定表。
  - [predic1_Property 工作表](#predic1_property-工作表) :
    Prediction1 模組專用屬性表。

[回首頁](#試算表及工作表資料)

## All 工作表

記錄由地球在特定日期，固定時間，觀察L539,L649,L638,LSix象限的39,49,38,49顆星球出現的結果。包合所有日期係數。

| 欄位名稱     | 數值型態 | 預設值 | 標題         | 說明                       | 試算表              |
| :----------- | :------- | :----- | :----------- | :------------------------- | :------------------ |
| Date         | Date     | null   | 日期         | 日期(不可重複)             | L539,L649,L638,LSix |
| N1           | Int      | 0      | 號1          | 排序後號碼1                | L539,L649,L638,LSix |
| N2           | Int      | 0      | 號2          | 排序後號碼2                | L539,L649,L638,LSix |
| N3           | Int      | 0      | 號3          | 排序後號碼3                | L539,L649,L638,LSix |
| N4           | Int      | 0      | 號4          | 排序後號碼4                | L539,L649,L638,LSix |
| N5           | Int      | 0      | 號5          | 排序後號碼5                | L539,L649,L638,LSix |
| N6           | Int      | 0      | 號6          | 排序後號碼6                | L649,L638,LSix      |
| S1           | Int      | 0      | 特別號1      | 特別號1                    | L649,L638,LSix      |
| Sum          | Int      | 0      | 總合         | 號數總合<br> L638為(N1~N6) | L539,L638,L649,LSix |
| 年天干       | String   | null   | 年天干       | 年天干                     | L539,L638,L649,LSix |
| 年地支       | String   | null   | 年地支       | 年地支                     | L539,L638,L649,LSix |
| 月天干       | String   | null   | 月天干       | 月天干                     | L539,L638,L649,LSix |
| 月地支       | String   | null   | 月地支       | 月地支                     | L539,L638,L649,LSix |
| 日天干       | String   | null   | 日天干       | 日天干                     | L539,L638,L649,LSix |
| 日地支       | String   | null   | 日地支       | 日地支                     | L539,L638,L649,LSix |
| 時柱         | String   | null   | 時柱         | 時柱                       | L539,L638,L649,LSix |
| 日五形       | String   | null   | 日五形       | 日五形                     | L539,L638,L649,LSix |
| 日十二建除   | String   | null   | 日十二建除   | 日十二建除                 | L539,L638,L649,LSix |
| 日九星       | String   | null   | 日九星       | 日九星                     | L539,L638,L649,LSix |
| 日二十八星宿 | String   | null   | 日二十八星宿 | 日二十八星宿               | L539,L638,L649,LSix |
| 時二十八星宿 | String   | null   | 時二十八星宿 | 時二十八星宿               | L539,L638,L649,LSix |
| 日八掛       | String   | null   | 日八掛       | 日八掛                     | L539,L638,L649,LSix |
| 本命         | String   | null   | 本命         | 本命                       | L539,L638,L649,LSix |
| 父母         | String   | null   | 父母         | 父母                       | L539,L638,L649,LSix |
| 福德         | String   | null   | 福德         | 福德                       | L539,L638,L649,LSix |
| 田宅         | String   | null   | 田宅         | 田宅                       | L539,L638,L649,LSix |
| 官祿         | String   | null   | 官祿         | 官祿                       | L539,L638,L649,LSix |
| 奴僕         | String   | null   | 奴僕         | 奴僕                       | L539,L638,L649,LSix |
| 遷移         | String   | null   | 遷移         | 遷移                       | L539,L638,L649,LSix |
| 疾厄         | String   | null   | 疾厄         | 疾厄                       | L539,L638,L649,LSix |
| 財帛         | String   | null   | 財帛         | 財帛                       | L539,L638,L649,LSix |
| 子女         | String   | null   | 子女         | 子女                       | L539,L638,L649,LSix |
| 夫妻         | String   | null   | 夫妻         | 夫妻                       | L539,L638,L649,LSix |
| 兄弟         | String   | null   | 兄弟         | 兄弟                       | L539,L638,L649,LSix |
| 命重         | String   | null   | 命重         | 命重                       | L539,L638,L649,LSix |

### 備註

- N1~N6,S1,Sum 由
  - [L539 工作表](#l539-工作表)提供。
  - [L649 工作表](#l649-工作表)提供。
  - [L638 工作表](#l638-工作表)提供。
  - [LSix 工作表](#lsix-工作表)提供。

- 其他係數 由 [AllData 工作表](#alldata-工作表)提供。

| 象限種類           | L539 | L649 | L638 | LSix |
| :----------------- | :--- | :--- | :--- | :--- |
| 觀察星球總數       | 39   | 49   | 38   | 49   |
| 出現星球數         | 5    | 6    | 6    | 6    |
| 特別觀察數(特別號) | 0    | 1    | 0    | 1    |
| 第二區             | 0    | 0    | 1    | 0    |

[Back](#l539l649l638lsix-試算表)

## Miss 工作表

遺漏數表格工作表。

| 欄位名稱 | 數值型態 | 預設值 | 標題    | 說明                       | 試算表              |
| :------- | :------- | :----- | :------ | :------------------------- | :------------------ |
| Date     | Date     | null   | 日期    | 日期(不可重複)             | L539,L638,L649,LSix |
| N1       | Int      | 0      | 號1     | 排序後號碼1                | L539,L638,L649,LSix |
| N2       | Int      | 0      | 號2     | 排序後號碼2                | L539,L638,L649,LSix |
| N3       | Int      | 0      | 號3     | 排序後號碼3                | L539,L638,L649,LSix |
| N4       | Int      | 0      | 號4     | 排序後號碼4                | L539,L638,L649,LSix |
| N5       | Int      | 0      | 號5     | 排序後號碼5                | L539,L638,L649,LSix |
| N6       | Int      | 0      | 號6     | 排序後號碼6                | L649,L638,LSix      |
| S1       | Int      | 0      | 特別號1 | 特別號1                    | L649,L638,LSix      |
| Sum      | Int      | 0      | 總合    | 號數總合<br> L638為(N1~N6) | L539,L638,L649,LSix |
| M1       | Int      | 0      | 遺漏1   | 遺漏號碼1                  | L539,L638,L649,LSix |
| M2       | Int      | 0      | 遺漏2   | 遺漏號碼2                  | L539,L638,L649,LSix |
| M3       | Int      | 0      | 遺漏3   | 遺漏號碼3                  | L539,L638,L649,LSix |
| M4       | Int      | 0      | 遺漏4   | 遺漏號碼4                  | L539,L638,L649,LSix |
| M5       | Int      | 0      | 遺漏5   | 遺漏號碼5                  | L539,L638,L649,LSix |
| M6       | Int      | 0      | 遺漏6   | 遺漏號碼6                  | L539,L638,L649,LSix |
| M7       | Int      | 0      | 遺漏7   | 遺漏號碼7                  | L539,L638,L649,LSix |
| M8       | Int      | 0      | 遺漏8   | 遺漏號碼8                  | L539,L638,L649,LSix |
| M9       | Int      | 0      | 遺漏9   | 遺漏號碼9                  | L539,L638,L649,LSix |
| M10      | Int      | 0      | 遺漏10  | 遺漏號碼10                 | L539,L638,L649,LSix |
| M11      | Int      | 0      | 遺漏11  | 遺漏號碼11                 | L539,L638,L649,LSix |
| M12      | Int      | 0      | 遺漏12  | 遺漏號碼12                 | L539,L638,L649,LSix |
| M13      | Int      | 0      | 遺漏13  | 遺漏號碼13                 | L539,L638,L649,LSix |
| M14      | Int      | 0      | 遺漏14  | 遺漏號碼14                 | L539,L638,L649,LSix |
| M15      | Int      | 0      | 遺漏15  | 遺漏號碼15                 | L539,L638,L649,LSix |
| M16      | Int      | 0      | 遺漏16  | 遺漏號碼16                 | L539,L638,L649,LSix |
| M17      | Int      | 0      | 遺漏17  | 遺漏號碼17                 | L539,L638,L649,LSix |
| M18      | Int      | 0      | 遺漏18  | 遺漏號碼18                 | L539,L638,L649,LSix |
| M19      | Int      | 0      | 遺漏19  | 遺漏號碼19                 | L539,L638,L649,LSix |
| M20      | Int      | 0      | 遺漏20  | 遺漏號碼20                 | L539,L638,L649,LSix |
| M21      | Int      | 0      | 遺漏21  | 遺漏號碼21                 | L539,L638,L649,LSix |
| M22      | Int      | 0      | 遺漏22  | 遺漏號碼22                 | L539,L638,L649,LSix |
| M23      | Int      | 0      | 遺漏23  | 遺漏號碼23                 | L539,L638,L649,LSix |
| M24      | Int      | 0      | 遺漏24  | 遺漏號碼24                 | L539,L638,L649,LSix |
| M25      | Int      | 0      | 遺漏25  | 遺漏號碼25                 | L539,L638,L649,LSix |
| M26      | Int      | 0      | 遺漏26  | 遺漏號碼26                 | L539,L638,L649,LSix |
| M27      | Int      | 0      | 遺漏27  | 遺漏號碼27                 | L539,L638,L649,LSix |
| M28      | Int      | 0      | 遺漏28  | 遺漏號碼28                 | L539,L638,L649,LSix |
| M29      | Int      | 0      | 遺漏29  | 遺漏號碼29                 | L539,L638,L649,LSix |
| M30      | Int      | 0      | 遺漏30  | 遺漏號碼30                 | L539,L638,L649,LSix |
| M31      | Int      | 0      | 遺漏31  | 遺漏號碼31                 | L539,L638,L649,LSix |
| M32      | Int      | 0      | 遺漏32  | 遺漏號碼32                 | L539,L638,L649,LSix |
| M33      | Int      | 0      | 遺漏33  | 遺漏號碼33                 | L539,L638,L649,LSix |
| M34      | Int      | 0      | 遺漏34  | 遺漏號碼34                 | L539,L638,L649,LSix |
| M35      | Int      | 0      | 遺漏35  | 遺漏號碼35                 | L539,L638,L649,LSix |
| M36      | Int      | 0      | 遺漏36  | 遺漏號碼36                 | L539,L638,L649,LSix |
| M37      | Int      | 0      | 遺漏37  | 遺漏號碼37                 | L539,L638,L649,LSix |
| M38      | Int      | 0      | 遺漏38  | 遺漏號碼38                 | L539,L638,L649,LSix |
| M39      | Int      | 0      | 遺漏39  | 遺漏號碼39                 | L539,L649,LSix      |
| M40      | Int      | 0      | 遺漏40  | 遺漏號碼40                 | L649,LSix           |
| M41      | Int      | 0      | 遺漏41  | 遺漏號碼41                 | L649,LSix           |
| M42      | Int      | 0      | 遺漏42  | 遺漏號碼42                 | L649,LSix           |
| M43      | Int      | 0      | 遺漏43  | 遺漏號碼43                 | L649,LSix           |
| M44      | Int      | 0      | 遺漏44  | 遺漏號碼44                 | L649,LSix           |
| M45      | Int      | 0      | 遺漏45  | 遺漏號碼45                 | L649,LSix           |
| M46      | Int      | 0      | 遺漏46  | 遺漏號碼46                 | L649,LSix           |
| M47      | Int      | 0      | 遺漏47  | 遺漏號碼47                 | L649,LSix           |
| M48      | Int      | 0      | 遺漏48  | 遺漏號碼48                 | L649,LSix           |
| M49      | Int      | 0      | 遺漏49  | 遺漏號碼49                 | L649,LSix           |
| SM1      | Int      | 0      | 遺漏特1 | 遺漏特號1                  | L638                |
| SM2      | Int      | 0      | 遺漏特2 | 遺漏特號2                  | L638                |
| SM3      | Int      | 0      | 遺漏特3 | 遺漏特號3                  | L638                |
| SM4      | Int      | 0      | 遺漏特4 | 遺漏特號4                  | L638                |
| SM5      | Int      | 0      | 遺漏特5 | 遺漏特號5                  | L638                |
| SM6      | Int      | 0      | 遺漏特6 | 遺漏特號6                  | L638                |
| SM7      | Int      | 0      | 遺漏特7 | 遺漏特號7                  | L638                |
| SM8      | Int      | 0      | 遺漏特8 | 遺漏特號8                  | L638                |

### 備註

- N1~N6,S1,Sum 由
  - [L539 工作表](#l539-工作表)提供。
  - [L649 工作表](#l649-工作表)提供。
  - [L638 工作表](#l638-工作表)提供。
  - [LSix 工作表](#lsix-工作表)提供。

[Back](#l539l649l638lsix-試算表)

## FreqSec 工作表

分區頻率序號提供工作表。

| 欄位名稱    | 數值型態 | 預設值         | 標題         | 說明                   |
| :---------- | :------- | :------------- | :----------- | :--------------------- |
| lngFreqSN   | Bigint   | auto Increment | 分區頻率序號 | 分區頻率序號(自動遞增) |
| period      | String   | null           | 期數         | 官方期數               |
| lngMethodSN | Binint   | null           | 方法序號     | 方法序號               |
| IntN        | Int      | 0              | 號碼         | 星球代碼               |

### 備註

- period由
  - [L539 工作表](#l539-工作表)提供。
  - [L649 工作表](#l649-工作表)提供。
  - [L638 工作表](#l638-工作表)提供。
  - [LSix 工作表](#lsix-工作表)提供。

- lngMethodSN由[Method 工作表](#method-工作表)提供。

[Back](#l539l649l638lsix-試算表)

## FreqSecM 工作表

分區遺漏數工作表。

| 欄位名稱  | 數值型態 | 預設值         | 標題         | 說明         |
| :-------- | :------- | :------------- | :----------- | :----------- |
| lngFreqSN | Bigint   | auto Increment | 分區頻率序號 | 分區頻率序號 |
| IntM      | Int      | 0              | 遺漏數       | 遺漏數值     |
| IntMinM   | Int      | 0              | 最小值       | 遺漏數最小值 |
| IntMaxM   | Int      | 0              | 最大值       | 遺漏數最大值 |
| IntAvgM   | Int      | 0              | 平均值       | 遺漏數平均值 |
| IntACM    | Double   | 0              | 標準差       | 遺漏數標準差 |

### 備註

- lngFreqSN由[FreqSec 工作表](#freqsec-工作表)提供。

[Back](#l539l649l638lsix-試算表)

## FreqSec05 工作表

分區05頻率工作表。

| 欄位名稱  | 數值型態 | 預設值         | 標題         | 說明           |
| :-------- | :------- | :------------- | :----------- | :------------- |
| lngFreqSN | Bigint   | auto Increment | 分區頻率序號 | 分區頻率序號   |
| intFreq05 | Int      | 0              | 頻率05       | 分區05出現次數 |
| intMin05  | Int      | 0              | 最小值05     | 分區05最小值   |
| intMax05  | Int      | 0              | 最大值05     | 分區05最大值   |
| intAvg05  | Int      | 0              | 平均值05     | 分區05平均值   |
| intAC05   | Double   | 0              | 標準差05     | 分區05標準差   |

### 備註

- lngFreqSN 由[FreqSec 工作表](#freqsec-工作表)提供。

[Back](#l539l649l638lsix-試算表)

## FreqSec10 工作表

分區10頻率工作表。

| 欄位名稱  | 數值型態 | 預設值         | 標題         | 說明           |
| :-------- | :------- | :------------- | :----------- | :------------- |
| lngFreqSN | Bigint   | auto Increment | 分區頻率序號 | 分區頻率序號   |
| intFreq10 | Int      | 0              | 頻率10       | 分區10出現次數 |
| intMin10  | Int      | 0              | 最小值10     | 分區10最小值   |
| intMax10  | Int      | 0              | 最大值10     | 分區10最大值   |
| intAvg10  | Int      | 0              | 平均值10     | 分區10平均值   |
| intAC10   | Double   | 0              | 標準差10     | 分區10標準差   |

### 備註

- lngFreqSN 由[FreqSec 工作表](#freqsec-工作表)提供。

[Back](#l539l649l638lsix-試算表)

## FreqSec25 工作表

分區25頻率工作表。

| 欄位名稱  | 數值型態 | 預設值         | 標題         | 說明           |
| :-------- | :------- | :------------- | :----------- | :------------- |
| lngFreqSN | Bigint   | auto Increment | 分區頻率序號 | 分區頻率序號   |
| intFreq25 | Int      | 0              | 頻率25       | 分區25出現次數 |
| intMin25  | Int      | 0              | 最小值25     | 分區25最小值   |
| intMax25  | Int      | 0              | 最大值25     | 分區25最大值   |
| intAvg25  | Int      | 0              | 平均值25     | 分區25平均值   |
| intAC25   | Double   | 0              | 標準差25     | 分區25標準差   |

### 備註

- lngFreqSN 由[FreqSec 工作表](#freqsec-工作表)提供。

[Back](#l539l649l638lsix-試算表)

## FreqSec50 工作表

分區50頻率工作表。

| 欄位名稱  | 數值型態 | 預設值         | 標題         | 說明           |
| :-------- | :------- | :------------- | :----------- | :------------- |
| lngFreqSN | Bigint   | auto Increment | 分區頻率序號 | 分區頻率序號   |
| intFreq50 | Int      | 0              | 頻率50       | 分區50出現次數 |
| intMin50  | Int      | 0              | 最小值50     | 分區50最小值   |
| intMax50  | Int      | 0              | 最大值50     | 分區50最大值   |
| intAvg50  | Int      | 0              | 平均值50     | 分區50平均值   |
| intAC50   | Double   | 0              | 標準差50     | 分區50標準差   |

### 備註

- lngFreqSN 由[FreqSec 工作表](#freqsec-工作表)提供。

[Back](#l539l649l638lsix-試算表)

## FreqSec100 工作表

分區100頻率工作表。

| 欄位名稱   | 數值型態 | 預設值         | 標題         | 說明            |
| :--------- | :------- | :------------- | :----------- | :-------------- |
| lngFreqSN  | Bigint   | auto Increment | 分區頻率序號 | 分區頻率序號    |
| intFreq100 | Int      | 0              | 頻率100      | 分區100出現次數 |
| intMin100  | Int      | 0              | 最小值100    | 分區100最小值   |
| intMax100  | Int      | 0              | 最大值100    | 分區100最大值   |
| intAvg100  | Int      | 0              | 平均值100    | 分區100平均值   |
| intAC100   | Double   | 0              | 標準差100    | 分區100標準差   |

### 備註

- lngFreqSN 由[FreqSec 工作表](#freqsec-工作表)提供。

[Back](#l539l649l638lsix-試算表)

## FreqSecMHis 工作表

分區歷史遺漏數工作表。

| 欄位名稱     | 數值型態 | 預設值         | 標題         | 說明         |
| :----------- | -------- | :------------- | :----------- | :----------- |
| lngFreqHisSN | Bigint   | auto Increment | 分區頻率序號 | 分區頻率序號 |
| IntM         | Int      | 0              | 遺漏數       | 遺漏數值     |
| IntMinM      | Int      | 0              | 最小值       | 遺漏數最小值 |
| IntMaxM      | Int      | 0              | 最大值       | 遺漏數最大值 |
| IntAvgM      | Int      | 0              | 平均值       | 遺漏數平均值 |
| IntACM       | Double   | 0              | 標準差       | 遺漏數標準差 |

### 備註

- lngFreqHisSN 由[FreqSecHis 工作表](#freqsechis-工作表)提供。

[Back](#l539l649l638lsix-試算表)

## FreqSec05His 工作表

分區歷史05頻率工作表。

| 欄位名稱  | 數值型態 | 預設值         | 標題         | 說明           |
| :-------- | -------- | :------------- | :----------- | :------------- |
| lngFreqSN | Bigint   | auto Increment | 分區頻率序號 | 分區頻率序號   |
| intFreq05 | Int      | 0              | 頻率05       | 分區05出現次數 |
| intMin05  | Int      | 0              | 最小值05     | 分區05最小值   |
| intMax05  | Int      | 0              | 最大值05     | 分區05最大值   |
| intAvg05  | Int      | 0              | 平均值05     | 分區05平均值   |
| intAC05   | Double   | 0              | 標準差05     | 分區05標準差   |

### 備註

- lngFreqSN 由[FreqSec 工作表](#freqsec-工作表)提供。

[Back](#l539l649l638lsix-試算表)

## FreqSec10His 工作表

分區歷史10頻率工作表。

| 欄位名稱  | 數值型態 | 預設值         | 標題         | 說明           |
| :-------- | :------- | :------------- | :----------- | :------------- |
| lngFreqSN | Bigint   | auto Increment | 分區頻率序號 | 分區頻率序號   |
| intFreq10 | Int      | 0              | 頻率10       | 分區10出現次數 |
| intMin10  | Int      | 0              | 最小值10     | 分區10最小值   |
| intMax10  | Int      | 0              | 最大值10     | 分區10最大值   |
| intAvg10  | Int      | 0              | 平均值10     | 分區10平均值   |
| intAC10   | Double   | 0              | 標準差10     | 分區10標準差   |

### 備註

- lngFreqSN 由[FreqSec 工作表](#freqsec-工作表)提供。

[Back](#l539l649l638lsix-試算表)

## FreqSec25His 工作表

分區歷史25頻率工作表。

| 欄位名稱  | 數值型態 | 預設值         | 標題         | 說明           |
| :-------- | :------- | :------------- | :----------- | :------------- |
| lngFreqSN | Bigint   | auto Increment | 分區頻率序號 | 分區頻率序號   |
| intFreq25 | Int      | 0              | 頻率25       | 分區25出現次數 |
| intMin25  | Int      | 0              | 最小值25     | 分區25最小值   |
| intMax25  | Int      | 0              | 最大值25     | 分區25最大值   |
| intAvg25  | Int      | 0              | 平均值25     | 分區25平均值   |
| intAC25   | Double   | 0              | 標準差25     | 分區25標準差   |

### 備註

- lngFreqSN 由[FreqSec 工作表](#freqsec-工作表)提供。

[Back](#l539l649l638lsix-試算表)

## FreqSec50His 工作表

分區歷史50頻率工作表。

| 欄位名稱  | 數值型態 | 預設值         | 標題         | 說明           |
| :-------- | :------- | :------------- | :----------- | :------------- |
| lngFreqSN | Bigint   | auto Increment | 分區頻率序號 | 分區頻率序號   |
| intFreq50 | Int      | 0              | 頻率50       | 分區50出現次數 |
| intMin50  | Int      | 0              | 最小值50     | 分區50最小值   |
| intMax50  | Int      | 0              | 最大值50     | 分區50最大值   |
| intAvg50  | Int      | 0              | 平均值50     | 分區50平均值   |
| intAC50   | Double   | 0              | 標準差50     | 分區50標準差   |

### 備註

- lngFreqSN 由[FreqSec 工作表](#freqsec-工作表)提供。

[Back](#l539l649l638lsix-試算表)

## FreqSec100His 工作表

分區歷史100頻率工作表。

| 欄位名稱   | 數值型態 | 預設值         | 標題         | 說明            |
| :--------- | :------- | :------------- | :----------- | :-------------- |
| lngFreqSN  | Bigint   | auto Increment | 分區頻率序號 | 分區頻率序號    |
| intFreq100 | Int      | 0              | 頻率100      | 分區100出現次數 |
| intMin100  | Int      | 0              | 最小值100    | 分區100最小值   |
| intMax100  | Int      | 0              | 最大值100    | 分區100最大值   |
| intAvg100  | Int      | 0              | 平均值100    | 分區100平均值   |
| intAC100   | Double   | 0              | 標準差100    | 分區100標準差   |

### 備註

- lngFreqSN 由[FreqSecHis 工作表](#freqsechis-工作表)提供。

[Back](#l539l649l638lsix-試算表)

## prct1_Settings 工作表

Predict 模組專用設定表。

| 欄位名稱     | 數值型態 | 預設值 | 標題         | 說明                 |
| :----------- | :------- | :----- | :----------- | :------------------- |
| 執行時間     | DateTime | null   | 執行時間     | 執行時間             |
| 執行日期     | Date     | null   | 執行日期     | 預測日期             |
| 相關係數     | Double   | 0      | 相關係數     | 相關係數             |
| 推薦數       | Int      | 0      | 推薦數       | 推薦數               |
| 遺漏模式     | Boolean  | false  | 遺漏模式     | 遺漏模式(true/false) |
| 變動參數摘要 | String   | null   | 變動參數摘要 | 變動參數摘要         |
| 備註         | String   | null   | 備註         | 備註                 |

[Back](#l539l649l638lsix-試算表)

## prct1_Property 工作表

Predict 模組專用屬性表。

| 欄位名稱    | 數值型態 | 預設值 | 標題        | 說明        |
| :---------- | :------- | :----- | :---------- | :---------- |
| Key         | String   | null   | Key         | Key         |
| Value       | String   | null   | Value       | Value       |
| LastUpdated | DateTime | null   | LastUpdated | LastUpdated |

[Back](#l539l649l638lsix-試算表)

## prct1_History

Predict 模組專用歷史表。

| 欄位名稱 | 數值型態 | 預設值 | 標題     | 說明                 |
| :------- | :------- | :----- | :------- | :------------------- |
| 型態     | String   | null   | 型態     | 型態                 |
| 彩種     | String   | null   | 彩種     | 彩種                 |
| 日期     | Date     | null   | 日期     | 日期                 |
| 推薦數   | Int      | null   | 推薦數   | 推薦數               |
| 遺漏模式 | Boolean  | false  | 遺漏模式 | 遺漏模式(true/false) |
| 命中數   | Int      | null   | 命中數   | 命中數               |
| 命中號碼 | String   | null   | 命中號碼 | 命中號碼             |
| 更新時間 | Date     | null   | 更新時間 | 更新時間             |

[Back](#l539l649l638lsix-試算表)

## predic1_Settings 工作表

Prediction1 模組專用設定表。

| 欄位名稱 | 數值型態 | 預設值 | 標題     | 說明                 |
| :------- | :------- | :----- | :------- | :------------------- |
| 型態     | String   | null   | 型態     | 型態                 |
| 彩種     | String   | null   | 彩種     |
| 日期     | Date     | null   | 日期     | 日期                 |
| 推薦數   | Int      | null   | 推薦數   | 推薦數               |
| 遺漏模式 | Boolean  | false  | 遺漏模式 | 遺漏模式(true/false) |
| 命中數   | Int      | null   | 命中數   | 命中數               |
| 命中號碼 | String   | null   | 命中號碼 |
| 更新時間 | Date     | null   | 更新時間 | 更新時間             |
| 學習標記 | String   | null   | 學習標記 | 學習標記             |

[Back](#l539l649l638lsix-試算表)

## predic1_Property 工作表

Prediction1 模組專用屬性表。

| 欄位名稱    | 數值型態 | 預設值 | 標題        | 說明        |
| :---------- | :------- | :----- | :---------- | :---------- |
| Parameter   | String   | null   | Parameter   | Parameter   |
| Value       | String   | null   | Value       | Value       |
| LastUpdated | DateTime | null   | LastUpdated | LastUpdated |

[Back](#l539l649l638lsix-試算表)
