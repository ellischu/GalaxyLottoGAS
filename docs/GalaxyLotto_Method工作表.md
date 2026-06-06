# Method 工作表

提供搜尋條件的序號。

| 欄位名稱 | 數值型態 | 預設值 | 顯示標題 | 說明 |
| :-- | :-- | :-- | :-- | :-- |
| **lngMethodSN** | Bigint | auto Increment | 方法序號 | 方法序號 (自動遞增) |
| **strCompareType** | String | AND | 比對方式 | 比對方式 (AND/OR) |
| **FieldMode** | Boolean | false | 欄位模式 | 欄位模式 (true/false)，當 `strCompares` 有值時為 true |
| **strCompares** | String | null | 欄位名稱值 | 欄位名稱 (以 `#` 分隔) |
| **strComparesDetail** | String | null | 欄位詳細 | 欄位值 (以 `#` 分隔) |
| **NextNumsMode** | Boolean | false | 托牌模式 | 托牌模式，當 `intNextNums > 0` 時為 true |
| **intNextNums** | Int | 0 | 托牌數 | 托牌號碼數量 |
| **intNextStep** | Int | 0 | 托牌間期 | 托牌間隔期數 |
| **strNextNums** | String | null | 托牌號 | 托牌號碼 (以 `#` 分隔) |
| **StrNextNumSpe** | String | null | 托牌號特 | 托牌號碼特別號 |
| **intDataLimit** | Int | 0 | 資料數量 | 資料數量限制 |
| **intDataOffset** | Int | 0 | 資料偏量 | 資料偏移量 |
| **intSearchLimit** | Int | 0 | 搜尋數量 | 搜尋數量限制 |
| **intSearchOffset** | Int | 0 | 搜尋偏量 | 搜尋偏移量 |
| **strcheck** | String | null | 檢查值 | 以上欄位值，除了 `lngMethodSN`。(以 `,` 分隔)<br>防止相同的係數有不同 `lngMethodSN`。 |

[Back](GalaxyLotto試算表.md)
