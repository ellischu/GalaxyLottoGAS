# GalaxyLotto 試算表

## 工作表

- [L539工作表](GalaxyLotto_L539工作表.md) ： L539象限的39顆星球出現的結果。
- [L649工作表](GalaxyLotto_L649工作表.md) ： L649象限的49顆星球出現的結果。
- [L638工作表](GalaxyLotto_L638工作表.md) ： L638象限的38顆星球出現的結果。
- [LSix工作表](GalaxyLotto_LSix工作表.md) ： LSix象限的49顆星球出現的結果。
- [AllData工作表](#alldata-工作表) ： 日期相關係數。
- [Method工作表](#method-工作表) ： 搜尋條件相關序號。
- [Sheets工作表](#sheets-工作表) ： 相關試算表及網址。
- [Folders工作表](#folders-工作表) : 相關資料夾及網址。
- [IDName工作表](#idname-工作表) ： ID與ID名稱對照表。
- [FieldName工作表](#fieldname-工作表) ： 欄位名稱對照表。
- [ErrorLog工作表](#errorlog-工作表): 系統錯誤記錄表。

[Back](DocSpreadsheet.md)


## AllData 工作表

日期相關係數。

| 欄位名稱     | 數值型態 | 預設值 | 顯示標題 | 說明           |
| :----------- | :------- | :----- | :------- | :------------- |
| Date         | Date     | null   | 日期     | 日期(不可重複) |
| 年天干       | String   | null   | 年干     | 年天干         |
| 年地支       | String   | null   | 年支     | 年地支         |
| 月天干       | String   | null   | 月干     | 月天干         |
| 月地支       | String   | null   | 月支     | 月地支         |
| 日天干       | String   | null   | 日干     | 日天干         |
| 日地支       | String   | null   | 日支     | 日地支         |
| 時柱         | String   | null   | 時柱     | 時柱           |
| 日五形       | String   | null   | 日形     | 日五形         |
| 日十二建除   | String   | null   | 日執     | 日十二建除     |
| 日九星       | String   | null   | 日星     | 日九星         |
| 日二十八星宿 | String   | null   | 日宿     | 日二十八星宿   |
| 時二十八星宿 | String   | null   | 時宿     | 時二十八星宿   |
| 日八掛       | String   | null   | 日掛     | 日八掛         |
| 本命         | String   | null   | 本命     | 本命           |
| 父母         | String   | null   | 父母     | 父母           |
| 福德         | String   | null   | 福德     | 福德           |
| 田宅         | String   | null   | 田宅     | 田宅           |
| 官祿         | String   | null   | 官祿     | 官祿           |
| 奴僕         | String   | null   | 奴僕     | 奴僕           |
| 遷移         | String   | null   | 遷移     | 遷移           |
| 疾厄         | String   | null   | 疾厄     | 疾厄           |
| 財帛         | String   | null   | 財帛     | 財帛           |
| 子女         | String   | null   | 子女     | 子女           |
| 夫妻         | String   | null   | 夫妻     | 夫妻           |
| 兄弟         | String   | null   | 兄弟     | 兄弟           |
| 命重         | String   | null   | 命重     | 命重           |

[Back](#galaxylotto-試算表)

## Method 工作表

提供搜尋條件的序號。

| 欄位名稱 | 數值型態 | 預設值 | 顯示標題 | 說明 |
| 欄位名稱          | 數值型態 | 預設值         | 顯示標題   | 說明                                                                                     |
| :---------------- | :------- | :------------- | :--------- | :--------------------------------------------------------------------------------------- |
| :-- | :-- | :-- | :-- | :-- |
| lngMethodSN | Bigint | auto Increment | 方法序號 | 方法序號(自動遞增) |
| strCompareType | String | AND | 比對方式 | 比對方式<br>(AND/OR) |
| FieldMode | Boolean | false | 欄位模式 | 欄位模式(true/false)<br>當 strCompares 有值時為 true |
| strCompares | String | null | 欄位名稱值 | 欄位名稱<br>(以 # 分隔) |
| strComparesDetail | String | null | 欄位詳細 | 欄位值<br>(以 # 分隔) |
| NextNumsMode | Boolean | false | 托牌模式 | 托牌模式<br>當 intNextNums > 0 時為 true |
| intNextNums | Int | 0 | 托牌數 | 托牌號碼數量 |
| intNextStep | Int | 0 | 托牌間期 | 托牌間隔期數 |
| strNextNums | String | null | 托牌號 | 托牌號碼<br>(以 # 分隔) |
| StrNextNumSpe | String | null | 托牌號特 | 托牌號碼特別號 |
| intDataLimit | Int | 0 | 資料數量 | 資料數量限制 |
| intDataOffset | Int | 0 | 資料偏量 | 資料偏移量 |
| intSearchLimit | Int | 0 | 搜尋數量 | 搜尋數量限制 |
| intSearchOffset | Int | 0 | 搜尋偏量 | 搜尋偏移量 |
| strcheck | String | null | 檢查值 | 以上欄位值,<br>除了 lngMethodSN。 <br>(以 , 分隔) <br> 防止相同的係數有不同lngMethodSN。 |

[Back](#galaxylotto-試算表)

## Sheets 工作表

試算表相關網址。

| 欄位名稱 | 數值型態 | 預設值 | 顯示標題   | 說明                 |
| :------- | :------- | :----- | :--------- | :------------------- |
| SheetN   | String   | null   | 工作表名稱 | 工作表名稱(不可重複) |
| Url      | String   | null   | 網址       | 網址                 |

[Back](#galaxylotto-試算表)

## Folders 工作表

資料夾相關網址。

| 欄位名稱 | 數值型態 | 預設值 | 顯示標題   | 說明                 |
| :------- | :------- | :----- | :--------- | :------------------- |
| FolderN  | String   | null   | 資料夾名稱 | 資料夾名稱(不可重複) |
| Url      | String   | null   | 網址       | 網址                 |

[Back](#galaxylotto-試算表)

## IDName 工作表

ID與ID名稱對照表。

| 欄位名稱 | 數值型態 | 預設值 | 顯示標題 | 說明             |
| :------- | :------- | :----- | :------- | :--------------- |
| ID       | String   | null   | ID代號   | ID代號(不可重複) |
| IDName   | String   | null   | ID名稱   | ID名稱           |

[Back](#galaxylotto-試算表)

## FieldName 工作表

欄位名稱對照表。

| 欄位名稱     | 數值型態 | 預設值 | 顯示標題 | 說明               |
| :----------- | :------- | :----- | :------- | :----------------- |
| strLabelID   | String   | null   | 欄位名稱 |
| strLabelName | String   | null   | 欄位標題 | 欄位標題(不可重複) |

[Back](#galaxylotto-試算表)

## ErrorLog 工作表

系統錯誤記錄表。

| 欄位名稱   | 數值型態 | 預設值 | 顯示標題   | 說明       |
| :--------- | :------- | :----- | :--------- | :--------- |
| 時間       | Date     | null   | 時間       | 時間       |
| 模組       | String   | null   | 模組       | 模組名稱   |
| 錯誤訊息   | String   | null   | 錯誤訊息   | 錯誤訊息   |
| 堆疊軌跡   | String   | null   | 堆疊軌跡   | 堆疊軌跡   |
| 上下文數據 | String   | null   | 上下文數據 | 上下文數據 |

[Back](#galaxylotto-試算表)