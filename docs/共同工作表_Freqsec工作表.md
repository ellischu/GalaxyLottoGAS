# FreqSec 工作表

分區頻率活性提供工作表。

| 欄位名稱    | 數值型態 | 預設值 | 顯示標題     | 說明            |
| :---------- | :------- | :----- | :----------- | :-------------- |
| lngMethodSN | Binint   | null   | 方法序號     | 方法序號        |
| Date        | Date     | null   | 日數         | 格式為YYYYmmdd  |
| intN        | Int      | 0      | 號碼         | 號碼            |
| intM        | Int      | 0      | 遺漏數       | 遺漏數值        |
| intMinM     | Int      | 0      | 最小值       | 遺漏數最小值    |
| intMaxM     | Int      | 0      | 最大值       | 遺漏數最大值    |
| sngAvgM     | Int      | 0      | 平均值       | 遺漏數平均值    |
| sngACM      | Double   | 0      | 標準差       | 遺漏數標準差    |
| intFreq05   | Int      | 0      | 頻率05       | 分區05出現次數  |
| intMin05    | Int      | 0      | 最小值05     | 分區05最小值    |
| intMax05    | Int      | 0      | 最大值05     | 分區05最大值    |
| sngAvg05    | Int      | 0      | 平均值05     | 分區05平均值    |
| sngAC05     | Double   | 0      | 標準差05     | 分區05標準差    |
| intFreq10   | Int      | 0      | 頻率10       | 分區10出現次數  |
| intMin10    | Int      | 0      | 最小值10     | 分區10最小值    |
| intMax10    | Int      | 0      | 最大值10     | 分區10最大值    |
| sngAvg10    | Int      | 0      | 平均值10     | 分區10平均值    |
| sngAC10     | Double   | 0      | 標準差10     | 分區10標準差    |
| intFreq25   | Int      | 0      | 頻率25       | 分區25出現次數  |
| intMin25    | Int      | 0      | 最小值25     | 分區25最小值    |
| intMax25    | Int      | 0      | 最大值25     | 分區25最大值    |
| sngAvg25    | Int      | 0      | 平均值25     | 分區25平均值    |
| sngAC25     | Double   | 0      | 標準差25     | 分區25標準差    |
| intFreq50   | Int      | 0      | 頻率50       | 分區50出現次數  |
| intMin50    | Int      | 0      | 最小值50     | 分區50最小值    |
| intMax50    | Int      | 0      | 最大值50     | 分區50最大值    |
| sngAvg50    | Int      | 0      | 平均值50     | 分區50平均值    |
| sngAC50     | Double   | 0      | 標準差50     | 分區50標準差    |
| intFreq100  | Int      | 0      | 頻率100      | 分區100出現次數 |
| intMin100   | Int      | 0      | 最小值100    | 分區100最小值   |
| intMax100   | Int      | 0      | 最大值100    | 分區100最大值   |
| sngAvg100   | Int      | 0      | 平均值100    | 分區100平均值   |
| sngAC100    | Double   | 0      | 標準差100    | 分區100標準差   |

## 備註

- lngFreqSN 格式為 strDate#lngMethodSN#IntN
- lngMethodSN由[Method 工作表](#method-工作表)提供。
- strDate 由
  - [L539 工作表](共同工作表_all工作表.md)提供，格式為 YYYYmmdd。
  - [L649 工作表](共同工作表_all工作表.md)提供，格式為 YYYYmmdd。
  - [L638 工作表](共同工作表_all工作表.md)提供，格式為 YYYYmmdd。
  - [LSix 工作表](共同工作表_all工作表.md)提供，格式為 YYYYmmdd。
- Double 為小數點 3 位。

## 獲取資料流程
- 由 SearchS.html 頁面的日期、彩種及各選項選擇，可以得到獲取資料的方法，例如：
  - [L539] 相同五形的資料的訊息。利用日期(2026/07/07)找到 GalaxyLotto > AllData工作表中的相同日期資料。找到欄位 日五形 是 '木'。
  - GalaxyLotto > AllData工作表，僅提供獲取資料的方法的條件，不提供整體資料。
  - 按下查詢後計算完畢把資料(Date ,彩種 ,方法序號)傳給 MissData.html.
- Activity.html 
  - 根據 Date ,彩種 ,方法序號(lngMethodSN)，對 彩種 > All 工作表進行 < Date 且 符合方法序號提供的方式篩選，並傳回結果稱為 BaseData。
  - 根據 Date ,彩種 ,方法序號(lngMethodSN)，對 彩種 > Miss 工作表進行 < Date 且 相同方法序號 進行篩選，並傳回結果稱為 TargetData。
  - 檢查 BaseData.length == TargetData.length，如果相等則將 TargetData 先以 DESC 排序並擷取指定數量回傳。
  - BaseData.length != TargetData.length，先 BaseData(ASC) 和 TargetData(ASC) 進行排序，如果 BaseData(ASC) > TargetData(ASC)，則 TargetData(ASC) 從最後一筆資料以增量的方式補齊，並把資料TargetData(ASC)更新到 彩種 > Miss 工作表中。最後將 TargetData 先以 DESC 排序並擷取指定數量回傳。
  - 全部以增量的方式操作。

[Back](L539L649L638LSix試算表.md)
