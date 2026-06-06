# FreqSec 工作表

分區頻率序號提供工作表。

| :---------- | :------- | :----- | :----------- | :-------------- |
| :---------- | :------- | :----- | :----------- | :-------------- |
| lngMethodSN | Binint   | null   | 方法序號     | 方法序號        |
| Date        | Date     | null   | 日數         | 格式為YYYYmmdd  |
| IntMinM     | Int      | 0      | 最小值       | 遺漏數最小值    |
| IntMaxM     | Int      | 0      | 最大值       | 遺漏數最大值    |
| IntM        | Int      | 0      | 遺漏數       | 遺漏數值        |
| IntMinM     | Int      | 0      | 最小值       | 遺漏數最小值    |
| IntMaxM     | Int      | 0      | 最大值       | 遺漏數最大值    |
| IntAvgM     | Int      | 0      | 平均值       | 遺漏數平均值    |
| IntACM      | Double   | 0      | 標準差       | 遺漏數標準差    |
| intFreq05   | Int      | 0      | 頻率05       | 分區05出現次數  |
| intMin05    | Int      | 0      | 最小值05     | 分區05最小值    |
| intMax05    | Int      | 0      | 最大值05     | 分區05最大值    |
| intAvg05    | Int      | 0      | 平均值05     | 分區05平均值    |
| intAC05     | Double   | 0      | 標準差05     | 分區05標準差    |
| intFreq10   | Int      | 0      | 頻率10       | 分區10出現次數  |
| intMin10    | Int      | 0      | 最小值10     | 分區10最小值    |
| intMax10    | Int      | 0      | 最大值10     | 分區10最大值    |
| intAvg10    | Int      | 0      | 平均值10     | 分區10平均值    |
| intAC10     | Double   | 0      | 標準差10     | 分區10標準差    |
| intFreq25   | Int      | 0      | 頻率25       | 分區25出現次數  |
| intMin25    | Int      | 0      | 最小值25     | 分區25最小值    |
| intMax25    | Int      | 0      | 最大值25     | 分區25最大值    |
| intAvg25    | Int      | 0      | 平均值25     | 分區25平均值    |
| intAC25     | Double   | 0      | 標準差25     | 分區25標準差    |
| intFreq50   | Int      | 0      | 頻率50       | 分區50出現次數  |
| intMin50    | Int      | 0      | 最小值50     | 分區50最小值    |
| intMax50    | Int      | 0      | 最大值50     | 分區50最大值    |
| intAvg50    | Int      | 0      | 平均值50     | 分區50平均值    |
| intAC50     | Double   | 0      | 標準差50     | 分區50標準差    |
| intFreq100  | Int      | 0      | 頻率100      | 分區100出現次數 |
| intMin100   | Int      | 0      | 最小值100    | 分區100最小值   |
| intMax100   | Int      | 0      | 最大值100    | 分區100最大值   |
| intAvg100   | Int      | 0      | 平均值100    | 分區100平均值   |
| intAC100    | Double   | 0      | 標準差100    | 分區100標準差   |

## 備註

- lngFreqSN 格式為 strDate#lngMethodSN#IntN
- lngMethodSN由[Method 工作表](#method-工作表)提供。
- strDate 由
  - [L539 工作表](共同工作表_all工作表.md)提供，格式為 YYYYmmdd。
  - [L649 工作表](共同工作表_all工作表.md)提供，格式為 YYYYmmdd。
  - [L638 工作表](共同工作表_all工作表.md)提供，格式為 YYYYmmdd。
  - [LSix 工作表](共同工作表_all工作表.md)提供，格式為 YYYYmmdd。
- Double 為小數點 3 位。

[Back](L539L649L638LSix試算表.md)
