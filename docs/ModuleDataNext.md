# 震盪表模組

## 相關試算表 (震盪表資料庫)

- L539_DataNext ,L649_DataNext ,L638_DataNext ,LSix_DataNext

## 相關工作表

### DataN00 工作表

- Name : DataN00 工作表
- Describe : 提供震盪表係數的表格。
- 試算表 : L539_DataNext ,L649_DataNext ,L638_DataNext ,LSix_DataNext

| 欄位名稱     | 數值型態 | 預設值 | 顯示標題 | 說明             |
| :----------- | -------- | :----- | :------- | :--------------- |
| lngDataN00SN | Bigint   | null   | N00      | 唯一不可重覆     |
| lngMethodSN  | Bigint   | null   | MSN      | 方法序號         |
| Date         | Date     | null   | DATE     | 格式為(YYYYmmdd) |
| intBaseRange | Smallint | 200    | BASE     | 資料提供期數     |
| strcheck     | string   | null   | FIT      | 檢查碼           |

備註:

- strcheck 格式 : "lngMethodSN#Date#intBaseRange"
- strcheck 例子 : "1#20261003#200"

### DataN01 工作表

- Name : DataN01 工作表
- Describe : 提供第1柱震盪資料的表格。
- 試算表 : L539_DataNext ,L649_DataNext ,L638_DataNext ,LSix_DataNext

| 欄位名稱     | 數值型態 | 預設值 | 顯示標題 | 說明                 |
| :----------- | -------- | :----- | :------- | :------------------- |
| lngDataN00SN | Bigint   | null   | N00      | 可重覆               |
| lngN1        | int      | 0      | N01      | 第1柱號碼            |
| sglAvg105    | float    | 0      | AVG105   | 前5期平均值          |
| sglStd105    | float    | 0      | STD105   | 前5期標準差          |
| intMin105    | smallint | 0      | MIN105   | 最近5期lngN1最小值   |
| intMax105    | smallint | 0      | MAX105   | 最近5期lngN1最大值   |
| sglAvg110    | float    | 0      | AVG110   | 前10期平均值         |
| sglStd110    | float    | 0      | STD110   | 前10期標準差         |
| intMin110    | smallint | 0      | MIN110   | 最近10期lngN1最小值  |
| intMax110    | smallint | 0      | MAX110   | 最近10期lngN1最大值  |
| sglAvg125    | float    | 0      | AVG125   | 前25期平均值         |
| sglStd125    | float    | 0      | STD125   | 前25期標準差         |
| intMin125    | smallint | 0      | MIN125   | 最近25期lngN1最小值  |
| intMax125    | smallint | 0      | MAX125   | 最近25期lngN1最大值  |
| sglAvg150    | float    | 0      | AVG150   | 前50期平均值         |
| sglStd150    | float    | 0      | STD150   | 前50期標準差         |
| intMin150    | smallint | 0      | MIN150   | 最近50期lngN1最小值  |
| intMax150    | smallint | 0      | MAX150   | 最近50期lngN1最大值  |
| sglAvg1100   | float    | 0      | AVG1100  | 前100期平均值        |
| sglStd1100   | float    | 0      | STD1100  | 前100期標準差        |
| intMin1100   | smallint | 0      | MIN1100  | 最近100期lngN1最小值 |
| intMax1100   | smallint | 0      | MAX1100  | 最近100期lngN1最大值 |
| strcheck     | string   | null   | FIT      | 檢查碼(唯一)         |

- strcheck 格式 : lngDataN00SN#lngN1

### DataN02 ~ DataN06 工作表

- 用 DataN01 的方式建立 工作表。
- Describe : 提供第2 ~ 6 柱震盪 預測資料 的表格。
- 試算表 : L539_DataNext ,L649_DataNext ,L638_DataNext ,LSix_DataNext

### DataN07 工作表

- Name : DataN07 工作表
- Describe : 提供 特別號 震盪資料的表格。
- 試算表 : L649_DataNext ,LSix_DataNext

| 欄位名稱     | 數值型態 | 預設值 | 顯示標題 | 說明                  |
| :----------- | -------- | :----- | :------- | :-------------------- |
| lngDataN00SN | Bigint   | null   |          | 可重覆                |
| lngS1        | int      | 0      | S01      | 特別號號碼            |
| sglAvg705    | float    | 0      | AVG705   | 前5期平均值           |
| sglStd705    | float    | 0      | STD705   | 前5期標準差           |
| intMin705    | smallint | 0      | MIN705   | 最近5期lngS1最小值    |
| intMax705    | smallint | 0      | MAX705   | 最近5期lngS1最大值    |
| sglAvg710    | float    | 0      | AVG710   | 前10期平均值          |
| sglStd710    | float    | 0      | STD710   | 前10期標準差          |
| intMin710    | smallint | 0      | MIN710   | 最近10期lngS1最小值   |
| intMax710    | smallint | 0      | MAX710   | 最近10期lngS1最大值   |
| sglAvg725    | float    | 0      | AVG725   | 前25期平均值          |
| sglStd725    | float    | 0      | STD725   | 前25期標準差          |
| intMin725    | smallint | 0      | MIN725   | 最近25期lngS1最小值   |
| intMax725    | smallint | 0      | MAX725   | 最近25期lngS1最大值   |
| sglAvg750    | float    | 0      | AVG750   | 前50期平均值          |
| sglStd750    | float    | 0      | STD750   | 前50期標準差          |
| intMin750    | smallint | 0      | MIN750   | 最近50期lngS1最小值   |
| intMax750    | smallint | 0      | MAX750   | 最近50期lngS1最大值   |
| sglAvg7100   | float    | 0      | AVG7100  | 前100期平均值         |
| sglStd7100   | float    | 0      | STD7100  | 前100期標準差         |
| intMin7100   | smallint | 0      | MIN7100  | 最近100期lngS1最小值  |
| intMax7100   | smallint | 0      | MAX7100  | 最近100期lngNS1最大值 |
| strcheck     | string   | null   | FIT      | 檢查碼(唯一)          |

- strcheck 格式 : lngDataN00SN#lngS1

### DataNNext01 工作表

- Name : DataNNext01 工作表
- Describe : 提供第1柱震盪 預測資料 的表格。
- 試算表 : L539_DataNext ,L649_DataNext ,L638_DataNext ,LSix_DataNext

| 欄位名稱     | 數值型態 | 預設值 | 顯示標題 | 說明                 |
| :----------- | -------- | :----- | :------- | :------------------- |
| lngDataN00SN | Bigint   | null   | N00      | 可重覆               |
| lngN1        | int      | 0      | N01      | 第1柱號碼            |
| sglAvg105    | float    | 0      | AVG105   | 前5期平均值          |
| sglStd105    | float    | 0      | STD105   | 前5期標準差          |
| intMin105    | smallint | 0      | MIN105   | 最近5期lngN1最小值   |
| intMax105    | smallint | 0      | MAX105   | 最近5期lngN1最大值   |
| sglAvg110    | float    | 0      | AVG110   | 前10期平均值         |
| sglStd110    | float    | 0      | STD110   | 前10期標準差         |
| intMin110    | smallint | 0      | MIN110   | 最近10期lngN1最小值  |
| intMax110    | smallint | 0      | MAX110   | 最近10期lngN1最大值  |
| sglAvg125    | float    | 0      | AVG125   | 前25期平均值         |
| sglStd125    | float    | 0      | STD125   | 前25期標準差         |
| intMin125    | smallint | 0      | MIN125   | 最近25期lngN1最小值  |
| intMax125    | smallint | 0      | MAX125   | 最近25期lngN1最大值  |
| sglAvg150    | float    | 0      | AVG150   | 前50期平均值         |
| sglStd150    | float    | 0      | STD150   | 前50期標準差         |
| intMin150    | smallint | 0      | MIN150   | 最近50期lngN1最小值  |
| intMax150    | smallint | 0      | MAX150   | 最近50期lngN1最大值  |
| sglAvg1100   | float    | 0      | AVG1100  | 前100期平均值        |
| sglStd1100   | float    | 0      | STD1100  | 前100期標準差        |
| intMin1100   | smallint | 0      | MIN1100  | 最近100期lngN1最小值 |
| intMax1100   | smallint | 0      | MAX1100  | 最近100期lngN1最大值 |
| strcheck     | string   | null   | FIT      | 檢查碼(唯一)         |

- strcheck 格式 : lngDataN00SN#lngN1
- lngN1 : 為預測號碼 (L539 : 1~39 )
- sglAvg105 : 為 lngN1 + 前4期的平均值。
- sglStd105 : 為 lngN1 + 前4期的標準差。
- 10,25,50,100 期用以上方式類推。

### DataNNext02 ~ DataNNext07 工作表

- 用 DataNNext01 的方式建立 工作表。
- Describe : 提供第2 ~ 7 柱震盪 預測資料 的表格。
- 試算表 : L539_DataNext ,L649_DataNext ,L638_DataNext ,LSix_DataNext

### DataNKD00 工作表

- Name : DataNKD00 工作表
- Describe : 提供震盪表係數的表格。
- 試算表 : L539_DataNext ,L649_DataNext ,L638_DataNext ,LSix_DataNext

| 欄位名稱       | 數值型態    | 預設值  | 顯示標題 | 說明     |
| :------------- | ----------- | :------ | :------- | :------- |
| lngDataN00KDSN | Bigint      | null    | N00KD    | 不可重覆 |
| lngDataN00SN   | Bigint      | null    | N00      | 可重覆   |
| intRSVn        | smallintint | null    | RSVn     | 計算天數 |
| sglRSVCo       | float       | 0.33333 | RSVc     | 係數 1/3 |
| strcheck       | string      | null    | FIT      | 檢查碼   |

備註:

- strcheck 格式 : "lngDataN00SN#intRSVn#sglRSVCo"
- strcheck 例子 : "1#5#0.33333"

### DataNKD01 工作表

- Name : DataNKD01 工作表
- Describe : 提供第1柱震盪 KD資料 的表格。
- 試算表 : L539_DataNext ,L649_DataNext ,L638_DataNext ,LSix_DataNext

| 欄位名稱       | 數值型態 | 預設值 | 顯示標題 | 說明       |
| :------------- | -------- | :----- | :------- | :--------- |
| lngDataN00KDSN | Bigint   | null   | N00KD    | 不可重覆   |
| sglAvg105RSV   | float    | 0      | RSV105   | 前5期RSV   |
| sglAvg105K     | float    | 0      | RSVK     | 前5期K值   |
| sglAvg105D     | float    | 0      | RSVD     | 前5期D值   |
| sglAvg105J     | float    | 0      | RSVJ     | 前5期J值   |
| sglAvg110RSV   | float    | 0      | RSV110   | 前10期RSV  |
| sglAvg110K     | float    | 0      | RSVK     | 前10期K值  |
| sglAvg110D     | float    | 0      | RSVD     | 前10期D值  |
| sglAvg110J     | float    | 0      | RSVJ     | 前10期J值  |
| sglAvg125RSV   | float    | 0      | RSV125   | 前25期RSV  |
| sglAvg125K     | float    | 0      | RSVK     | 前25期K值  |
| sglAvg125D     | float    | 0      | RSVD     | 前25期D值  |
| sglAvg125J     | float    | 0      | RSVJ     | 前25期J值  |
| sglAvg150RSV   | float    | 0      | RSV150   | 前50期RSV  |
| sglAvg150K     | float    | 0      | RSVK     | 前50期K值  |
| sglAvg150D     | float    | 0      | RSVD     | 前50期D值  |
| sglAvg150J     | float    | 0      | RSVJ     | 前50期J值  |
| sglAvg1100RSV  | float    | 0      | RSV1100  | 前100期RSV |
| sglAvg1100K    | float    | 0      | RSVK     | 前100期K值 |
| sglAvg1100D    | float    | 0      | RSVD     | 前100期D值 |
| sglAvg1100J    | float    | 0      | RSVJ     | 前100期J值 |

### DataNKD02 ~ DataNKD07 工作表

- 用 DataNKD01 的方式建立 工作表。
- Describe : 提供第2 ~ 7 柱震盪 預測資料 的表格。
- 試算表 : L539_DataNext ,L649_DataNext ,L638_DataNext ,LSix_DataNext

### DataNNextKD01 工作表

- Name : DataNKD01 工作表
- Describe : 提供第1柱震盪 KD資料 的表格。
- 試算表 : L539_DataNext ,L649_DataNext ,L638_DataNext ,LSix_DataNext

| 欄位名稱       | 數值型態 | 預設值 | 顯示標題 | 說明       |
| :------------- | -------- | :----- | :------- | :--------- |
| lngDataN00KDSN | Bigint   | null   | N00KD    | 可重覆     |
| lngN1          | int      | 0      | N01      | 第1柱號碼  |
| sglAvg105RSV   | float    | 0      | RSV105   | 前5期RSV   |
| sglAvg105K     | float    | 0      | RSVK     | 前5期K值   |
| sglAvg105D     | float    | 0      | RSVD     | 前5期D值   |
| sglAvg105J     | float    | 0      | RSVJ     | 前5期J值   |
| sglAvg110RSV   | float    | 0      | RSV110   | 前10期RSV  |
| sglAvg110K     | float    | 0      | RSVK     | 前10期K值  |
| sglAvg110D     | float    | 0      | RSVD     | 前10期D值  |
| sglAvg110J     | float    | 0      | RSVJ     | 前10期J值  |
| sglAvg125RSV   | float    | 0      | RSV125   | 前25期RSV  |
| sglAvg125K     | float    | 0      | RSVK     | 前25期K值  |
| sglAvg125D     | float    | 0      | RSVD     | 前25期D值  |
| sglAvg125J     | float    | 0      | RSVJ     | 前25期J值  |
| sglAvg150RSV   | float    | 0      | RSV150   | 前50期RSV  |
| sglAvg150K     | float    | 0      | RSVK     | 前50期K值  |
| sglAvg150D     | float    | 0      | RSVD     | 前50期D值  |
| sglAvg150J     | float    | 0      | RSVJ     | 前50期J值  |
| sglAvg1100RSV  | float    | 0      | RSV1100  | 前100期RSV |
| sglAvg1100K    | float    | 0      | RSVK     | 前100期K值 |
| sglAvg1100D    | float    | 0      | RSVD     | 前100期D值 |
| sglAvg1100J    | float    | 0      | RSVJ     | 前100期J值 |

### DataNNextKD02 ~ DataNNextKD07 工作表

- 用 DataNNextKD01 的方式建立 工作表。
- Describe : 提供第2 ~ 7 柱震盪 預測資料 的表格。
- 試算表 : L539_DataNext ,L649_DataNext ,L638_DataNext ,LSix_DataNext

### DataNVAR01 工作表

- Name : DataNVAR01 工作表
- Describe : 提供第1柱震盪資料的表格。
- 試算表 : L539_DataNext ,L649_DataNext ,L638_DataNext ,LSix_DataNext

| 欄位名稱      | 數值型態 | 預設值 | 顯示標題   | 說明                           |
| :------------ | -------- | :----- | :--------- | :----------------------------- |
| lngDataN00SN  | Bigint   | null   | N00        | 不可重覆                       |
| sglAvg105Var  | float    | 0      | AVG105Var  | 與上一期 sglAvg105 的差異量    |
| sglStd105Var  | float    | 0      | STD105Var  | 與上一期 sglStd105 的差異量    |
| intMin105Var  | smallint | 0      | MIN105Var  | 最近5期 sglAvg105Var 最小值    |
| intMax105Var  | smallint | 0      | MAX105Var  | 最近5期 sglAvg105Var 最大值    |
| sglAvg110Var  | float    | 0      | AVG110Var  | 與上一期 sglAvg110 的差異量    |
| sglStd110Var  | float    | 0      | STD110Var  | 與上一期 sglStd110 的差異量    |
| intMin110Var  | smallint | 0      | MIN110Var  | 最近10期 sglAvg110Var 最小值   |
| intMax110Var  | smallint | 0      | MAX110Var  | 最近10期 sglAvg110Var 最大值   |
| sglAvg125Var  | float    | 0      | AVG125Var  | 與上一期 sglAvg125 的差異量    |
| sglStd125Var  | float    | 0      | STD125Var  | 與上一期 sglStd125 的差異量    |
| intMin125Var  | smallint | 0      | MIN125Var  | 最近25期 sglAvg125Var 最小值   |
| intMax125Var  | smallint | 0      | MAX125Var  | 最近25期 sglAvg125Var 最大值   |
| sglAvg150Var  | float    | 0      | AVG150Var  | 與上一期 sglAvg150 的差異量    |
| sglStd150Var  | float    | 0      | STD150Var  | 與上一期 sglStd150 的差異量    |
| intMin150Var  | smallint | 0      | MIN150Var  | 最近50期 sglAvg150Var 最小值   |
| intMax150Var  | smallint | 0      | MAX150Var  | 最近50期 sglAvg150Var 最大值   |
| sglAvg1100Var | float    | 0      | AVG1100Var | 與上一期 sglAvg1100 的差異量   |
| sglStd1100Var | float    | 0      | STD1100Var | 與上一期 sglStd1100 的差異量   |
| intMin1100Var | smallint | 0      | MIN1100Var | 最近100期 sglAvg1100Var 最小值 |
| intMax1100Var | smallint | 0      | MAX1100Var | 最近100期 sglAvg1100Var 最大值 |

### DataNVAR02 ~ DataNVR07 工作表

- 用 DataNVAR01 的方式建立 工作表。
- Describe : 提供第2 ~ 7 柱震盪 預測資料 的表格。
- 試算表 : L539_DataNext ,L649_DataNext ,L638_DataNext ,LSix_DataNext
