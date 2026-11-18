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

| 欄位名稱       | 數值型態 | 預設值  | 顯示標題 | 說明         |
| :------------- | -------- | :------ | :------- | :----------- |
| lngDataN00KDSN | Bigint   | null    | N00KD    | 不可重覆     |
| lngDataN00SN   | Bigint   | null    | N00      | 可重覆       |
| intRSVn        | smallint | null    | RSVn     | RSV 回看期數 |
| sglRSVCo       | float    | 0.33333 | RSVc     | 係數 1/3     |
| strcheck       | string   | null    | FIT      | 檢查碼       |

備註:

- strcheck 格式 : "lngDataN00SN#intRSVn#sglRSVCo"（程式以快照 SN、RSVn、係數組成）
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

- Name : DataNNextKD01 工作表
- Describe : 提供第1柱各候選號的預測 KD/J 指標。
- 試算表 : L539_DataNext ,L649_DataNext ,L638_DataNext ,LSix_DataNext

| 欄位名稱       | 數值型態 | 預設值 | 顯示標題 | 說明                   |
| :------------- | -------- | :----- | :------- | :--------------------- |
| lngDataN00KDSN | Bigint   | null   | N00KD    | 對應 DataNKD00 的 KDSN |
| lngN1          | int      | 0      | N01      | 第1柱號碼              |
| sglAvg105RSV   | float    | 0      | RSV105   | 候選號預測 RSV         |
| sglAvg105K     | float    | 0      | RSVK     | 前5期K值               |
| sglAvg105D     | float    | 0      | RSVD     | 前5期D值               |
| sglAvg105J     | float    | 0      | RSVJ     | 前5期J值               |
| sglAvg110RSV   | float    | 0      | RSV110   | 前10期RSV              |
| sglAvg110K     | float    | 0      | RSVK     | 前10期K值              |
| sglAvg110D     | float    | 0      | RSVD     | 前10期D值              |
| sglAvg110J     | float    | 0      | RSVJ     | 前10期J值              |
| sglAvg125RSV   | float    | 0      | RSV125   | 前25期RSV              |
| sglAvg125K     | float    | 0      | RSVK     | 前25期K值              |
| sglAvg125D     | float    | 0      | RSVD     | 前25期D值              |
| sglAvg125J     | float    | 0      | RSVJ     | 前25期J值              |
| sglAvg150RSV   | float    | 0      | RSV150   | 前50期RSV              |
| sglAvg150K     | float    | 0      | RSVK     | 前50期K值              |
| sglAvg150D     | float    | 0      | RSVD     | 前50期D值              |
| sglAvg150J     | float    | 0      | RSVJ     | 前50期J值              |
| sglAvg1100RSV  | float    | 0      | RSV1100  | 前100期RSV             |
| sglAvg1100K    | float    | 0      | RSVK     | 前100期K值             |
| sglAvg1100D    | float    | 0      | RSVD     | 前100期D值             |
| sglAvg1100J    | float    | 0      | RSVJ     | 前100期J值             |

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

### DataNVAR02 ~ DataNVAR07 工作表

- 用 DataNVAR01 的方式建立 工作表。
- Describe : 提供第2 ~ 7 柱震盪 預測資料 的表格。
- 試算表 : L539_DataNext ,L649_DataNext ,L638_DataNext ,LSix_DataNext

### DataNNextKD01 工作表

- Name : DataNNextKD01 工作表
- Describe : 提供第1柱各候選號的預測 KD/J 指標。
- 試算表 : L539_DataNext ,L649_DataNext ,L638_DataNext ,LSix_DataNext

| 欄位名稱       | 數值型態 | 預設值 | 顯示標題 | 說明                   |
| :------------- | -------- | :----- | :------- | :--------------------- |
| lngDataN00KDSN | Bigint   | null   | N00KD    | 對應 DataNKD00 的 KDSN |
| lngN1          | int      | 0      | N01      | 第1柱號碼              |
| sglAvg105RSV   | float    | 0      | RSV105   | 候選號預測 RSV         |
| sglAvg105K     | float    | 0      | RSVK     | 前5期K值               |
| sglAvg105D     | float    | 0      | RSVD     | 前5期D值               |
| sglAvg105J     | float    | 0      | RSVJ     | 前5期J值               |
| sglAvg110RSV   | float    | 0      | RSV110   | 前10期RSV              |
| sglAvg110K     | float    | 0      | RSVK     | 前10期K值              |
| sglAvg110D     | float    | 0      | RSVD     | 前10期D值              |
| sglAvg110J     | float    | 0      | RSVJ     | 前10期J值              |
| sglAvg125RSV   | float    | 0      | RSV125   | 前25期RSV              |
| sglAvg125K     | float    | 0      | RSVK     | 前25期K值              |
| sglAvg125D     | float    | 0      | RSVD     | 前25期D值              |
| sglAvg125J     | float    | 0      | RSVJ     | 前25期J值              |
| sglAvg150RSV   | float    | 0      | RSV150   | 前50期RSV              |
| sglAvg150K     | float    | 0      | RSVK     | 前50期K值              |
| sglAvg150D     | float    | 0      | RSVD     | 前50期D值              |
| sglAvg150J     | float    | 0      | RSVJ     | 前50期J值              |
| sglAvg1100RSV  | float    | 0      | RSV1100  | 前100期RSV             |
| sglAvg1100K    | float    | 0      | RSVK     | 前100期K值             |
| sglAvg1100D    | float    | 0      | RSVD     | 前100期D值             |
| sglAvg1100J    | float    | 0      | RSVJ     | 前100期J值             |

### DataNNextKD02 ~ DataNNextKD07 工作表

- 用 DataNNextKD01 的方式建立 工作表。
- Describe : 提供第2 ~ 7 柱震盪 預測資料 的表格。
- 試算表 : L539_DataNext ,L649_DataNext ,L638_DataNext ,LSix_DataNext

### DataNKDVAR01 工作表

- Name : DataNKDVAR01 工作表
- Describe : 提供第1柱震盪 RSV/K/D/J 差異值的表格。
- 試算表 : L539_DataNext ,L649_DataNext ,L638_DataNext ,LSix_DataNext

| 欄位名稱         | 數值型態 | 預設值 | 顯示標題   | 說明                            |
| :--------------- | -------- | :----- | :--------- | :------------------------------ |
| lngDataN00KDSN   | Bigint   | null   | N00KD      | 不可重覆                        |
| sglRSV105Var     | float    | 0      | RSV105Var  | 與上一期 sglAvg105RSV 的差異量  |
| intMinRSV105Var  | float    | 0      | MinRSV105  | 最近5期 RSV105Var 最小值        |
| intMaxRSV105Var  | float    | 0      | MaxRSV105  | 最近5期 RSV105Var 最大值        |
| sglK105Var       | float    | 0      | K105Var    | 與上一期 sglAvg105K 的差異量    |
| intMinK105Var    | float    | 0      | MinK105    | 最近5期 K105Var 最小值          |
| intMaxK105Var    | float    | 0      | MaxK105    | 最近5期 K105Var 最大值          |
| sglD105Var       | float    | 0      | D105Var    | 與上一期 sglAvg105D 的差異量    |
| intMinD105Var    | float    | 0      | MinD105    | 最近5期 D105Var 最小值          |
| intMaxD105Var    | float    | 0      | MaxD105    | 最近5期 D105Var 最大值          |
| sglJ105Var       | float    | 0      | J105Var    | 與上一期 sglAvg105J 的差異量    |
| intMinJ105Var    | float    | 0      | MinJ105    | 最近5期 J105Var 最小值          |
| intMaxJ105Var    | float    | 0      | MaxJ105    | 最近5期 J105Var 最大值          |
| sglRSV110Var     | float    | 0      | RSV110Var  | 與上一期 sglAvg110RSV 的差異量  |
| intMinRSV110Var  | float    | 0      | MinRSV110  | 最近10期 RSV110Var 最小值       |
| intMaxRSV110Var  | float    | 0      | MaxRSV110  | 最近10期 RSV110Var 最大值       |
| sglK110Var       | float    | 0      | K110Var    | 與上一期 sglAvg110K 的差異量    |
| intMinK110Var    | float    | 0      | MinK110    | 最近10期 K110Var 最小值         |
| intMaxK110Var    | float    | 0      | MaxK110    | 最近10期 K110Var 最大值         |
| sglD110Var       | float    | 0      | D110Var    | 與上一期 sglAvg110D 的差異量    |
| intMinD110Var    | float    | 0      | MinD110    | 最近10期 D110Var 最小值         |
| intMaxD110Var    | float    | 0      | MaxD110    | 最近10期 D110Var 最大值         |
| sglJ110Var       | float    | 0      | J110Var    | 與上一期 sglAvg110J 的差異量    |
| intMinJ110Var    | float    | 0      | MinJ110    | 最近10期 J110Var 最小值         |
| intMaxJ110Var    | float    | 0      | MaxJ110    | 最近10期 J110Var 最大值         |
| sglRSV125Var     | float    | 0      | RSV125Var  | 與上一期 sglAvg125RSV 的差異量  |
| intMinRSV125Var  | float    | 0      | MinRSV125  | 最近25期 RSV125Var 最小值       |
| intMaxRSV125Var  | float    | 0      | MaxRSV125  | 最近25期 RSV125Var 最大值       |
| sglK125Var       | float    | 0      | K125Var    | 與上一期 sglAvg125K 的差異量    |
| intMinK125Var    | float    | 0      | MinK125    | 最近25期 K125Var 最小值         |
| intMaxK125Var    | float    | 0      | MaxK125    | 最近25期 K125Var 最大值         |
| sglD125Var       | float    | 0      | D125Var    | 與上一期 sglAvg125D 的差異量    |
| intMinD125Var    | float    | 0      | MinD125    | 最近25期 D125Var 最小值         |
| intMaxD125Var    | float    | 0      | MaxD125    | 最近25期 D125Var 最大值         |
| sglJ125Var       | float    | 0      | J125Var    | 與上一期 sglAvg125J 的差異量    |
| intMinJ125Var    | float    | 0      | MinJ125    | 最近25期 J125Var 最小值         |
| intMaxJ125Var    | float    | 0      | MaxJ125    | 最近25期 J125Var 最大值         |
| sglRSV150Var     | float    | 0      | RSV150Var  | 與上一期 sglAvg150RSV 的差異量  |
| intMinRSV150Var  | float    | 0      | MinRSV150  | 最近50期 RSV150Var 最小值       |
| intMaxRSV150Var  | float    | 0      | MaxRSV150  | 最近50期 RSV150Var 最大值       |
| sglK150Var       | float    | 0      | K150Var    | 與上一期 sglAvg150K 的差異量    |
| intMinK150Var    | float    | 0      | MinK150    | 最近50期 K150Var 最小值         |
| intMaxK150Var    | float    | 0      | MaxK150    | 最近50期 K150Var 最大值         |
| sglD150Var       | float    | 0      | D150Var    | 與上一期 sglAvg150D 的差異量    |
| intMinD150Var    | float    | 0      | MinD150    | 最近50期 D150Var 最小值         |
| intMaxD150Var    | float    | 0      | MaxD150    | 最近50期 D150Var 最大值         |
| sglJ150Var       | float    | 0      | J150Var    | 與上一期 sglAvg150J 的差異量    |
| intMinJ150Var    | float    | 0      | MinJ150    | 最近50期 J150Var 最小值         |
| intMaxJ150Var    | float    | 0      | MaxJ150    | 最近50期 J150Var 最大值         |
| sglRSV1100Var    | float    | 0      | RSV1100Var | 與上一期 sglAvg1100RSV 的差異量 |
| intMinRSV1100Var | float    | 0      | MinRSV1100 | 最近100期 RSV1100Var 最小值     |
| intMaxRSV1100Var | float    | 0      | MaxRSV1100 | 最近100期 RSV1100Var 最大值     |
| sglK1100Var      | float    | 0      | K1100Var   | 與上一期 sglAvg1100K 的差異量   |
| intMinK1100Var   | float    | 0      | MinK1100   | 最近100期 K1100Var 最小值       |
| intMaxK1100Var   | float    | 0      | MaxK1100   | 最近100期 K1100Var 最大值       |
| sglD1100Var      | float    | 0      | D1100Var   | 與上一期 sglAvg1100D 的差異量   |
| intMinD1100Var   | float    | 0      | MinD1100   | 最近100期 D1100Var 最小值       |
| intMaxD1100Var   | float    | 0      | MaxD1100   | 最近100期 D1100Var 最大值       |
| sglJ1100Var      | float    | 0      | J1100Var   | 與上一期 sglAvg1100J 的差異量   |
| intMinJ1100Var   | float    | 0      | MinJ1100   | 最近100期 J1100Var 最小值       |
| intMaxJ1100Var   | float    | 0      | MaxJ1100   | 最近100期 J1100Var 最大值       |

### DataNKDVAR02 ~ DataNKDVAR07 工作表

- 用 DataNKDVAR01 的方式建立 工作表。
- Describe : 提供第2 ~ 7 柱震盪 預測資料 的表格。
- 試算表 : L539_DataNext ,L649_DataNext ,L638_DataNext ,LSix_DataNext

## 工作流程

### 1. 取得基底資料 :
 由 NextData.html / URL 參數傳入的 日期(Date) 及 方法值(lngMethodSN) ,由 getNextData (NextData_Server.js) 直接向 {彩種} 試算表的 All 工作表提取基本資料(BaseData) 。先 ASC 排序，再轉 DESC 取指定頁面數量（limit）。
### 2. 
跟據 id:limitInput(NextData.html) 的數值 ,由 getNextData (NextData_Server.js) 向 {彩種} 試算表的 All 工作表提取日期 < 基準日的開獎期資料，先 ASC 排序，再轉 DESC 取 limitInput 的頁面數量。
### 3. 避免重複計算與序號重複的機制:

#### 3.1 避免重複計算

1. **LockService 防止並發執行** (第 753 行): 使用 `LockService.getScriptLock().tryLock(1000)` 確保同一時間只有一個 getNextData 請求執行，避免並發寫入。
2. **可續傳批次處理** (第 752 行): `startTime = new Date().getTime()` 配合 `isNearTimeout()` 檢查，若接近 6 分鐘限制則 `saveProgress()` 儲存進度並返回 `continue` 狀態，下次觸發續傳。
3. **完整性檢查短路** (第 1023 行): `if (histComplete && nextComplete && kdComplete && nextKdComplete && varComplete && nkdVarComplete) return;` — 若所有子表都完整，直接跳過，不重新計算。
4. **重建標記** (第 900-944 行): `histRebuild`, `varRebuild`, `kdRebuild`, `nkdVarRebuild` 只標記不完整的鍵，只重建缺列的鍵，不影響已完整的鍵。
5. **clearGroupedKey 清理** (第 850-867 行): 只清除不完整鍵的舊資料，保留其他鍵的數據，避免全表重建。
6. **_appendNextRows 去重** (第 429-452 行): 寫入前根據 dedupCol 欄位檢查是否已存在，跳過重複的鍵，避免重複寫入。
7. **記憶體快取合併** (第 1325-1380 行): 寫入成功後通過 `_mergeNextCacheRows` 合併回記憶體快取，供後續讀取使用，避免重讀工作表。

#### 3.2 避免序號重複

1. **maxSN / maxKDSN 追蹤** (第 770, 777 行): 追蹤目前最大的序號，新序號為 `maxSN + 1` 或 `maxKDSN + 1`（第 875-876, 1099-1100 行），確保序號遞增不重複。
2. **strcheck 檢查碼** (第 1014, 1024, 1034 行): 以 `lngMethodSN#Date#intBaseRange` 組成唯一鍵，作為 `checkToSN` 字典的鍵，防止重複 SN 分配。
3. **checkToSN / checkToKDSN 字典** (第 771, 787 行): 以 strcheck 為鍵映射 SN/KDSN，若同一 strcheck 已存在則沿用原號，不重新分配。
4. **KDSN 配號** (第 1025-1031, 1098-1103 行): 只在 `kdComplete` 為 false 且 `kdsn === 0` 時才分配新 KDSN，避免重複配號。
5. **clearGroupedKey 保護** (第 850-867 行): 刪除舊資料時只刪除指定鍵的行，不影響其他鍵。

#### 3.3 已知問題與建議

1. **KDSN = 0 無效資料** (已修復 @904): 當 `kdsn === 0`（找不到對應的 KDSN）時，仍會寫入 DataNKDVAR0x 表，產生無效的 KDSN=0 記錄。已修復為 `if (!nkdVarComplete && kdsn > 0)`，跳過未配號的記錄。
2. **DataNKDVAR 去重** (已修復 @903): 原本使用 `skipDedup=true` 導致重複寫入，已改為 `dedupCol="lngDataN00KDSN", skipDedup=false`。
3. **建議：增加 KDSN 唯一性約束**: 在 `_appendNextRows` 寫入前先檢查 `lngDataN00KDSN` 是否已存在於表格中，避免重複。
4. **建議：增加 LockService 保護序號分配**: 目前 `maxSN` 和 `maxKDSN` 的分配在 LockService 保護下執行（第 753 行），但獨立函數（如 RSV 預測）未加鎖，建議也加入 LockService 保護。
5. **建議：增加資料驗證**: 在寫入前驗證 `kdsn > 0` 和 `sn > 0`，避免寫入無效的序號。


### 4. 預測表視覺標示

#### 4.1 外框顏色對應表

| 指標 | MIN 側（低於最新實際值） | MAX 側（達到或高於最新實際值） |
| :--- | :--- | :--- |
| AVG | 藍框 `next-band-low` | 紅框 `next-band-high` |
| STD | 紫框 `next-band-low-std` | 橘框 `next-band-high-std` |
| RSV | 藍框 `next-band-low` | 紅框 `next-band-high` |
| K | 紫框 `next-band-low-std` | 橘框 `next-band-high-std` |
| D | 紫框 `next-band-low-std` | 橘框 `next-band-high-std` |
| J | 紫框 `next-band-low-std` | 橘框 `next-band-high-std` |

- AVG、STD、RSV 各窗口分別取目標日前（排除目標日）最近最多 100 期、同柱同窗口資料，計算歷史 MIN/MAX，並以最新實際值作上下側分界。
- K/D/J 已新增外框比對邏輯（使用 range.k/d/j 的 MIN/MAX/latest）。

#### 4.2 VAR 文字標示規則

| 欄位 | 下界計算 | 上界計算 | 標示 |
| :--- | :--- | :--- | :--- |
| AVG VAR | MINVAR < 0 → latest + MINVAR；MINVAR >= 0 → latest - MINVAR | latest + MAXVAR | 藍字 `next-var-low` / 紅字 `next-var-high` |
| STD VAR | 同上（使用 STD 的 MINVAR/MAXVAR） | latest + MAXVAR | 藍字 `next-var-low` / 紅字 `next-var-high` |
| RSV VAR | 同上（使用 RSV 的 MINVAR/MAXVAR） | latest + MAXVAR | 藍字 `next-var-low` / 紅字 `next-var-high` |
| K/D/J VAR | 同上 | latest + MAXVAR | 藍字 `next-var-low` / 紅字 `next-var-high` |

- VAR 文字顏色與外框顏色分開處理，避免混淆。
- STD VAR 文字標示區間依最新實際值和相應 VAR 歷史極值判定。

#### 4.3 歷史平均值標示（x̄）

在預測表的每個欄位中，找出候選號碼的值最接近歷史平均值（前 100 期）的那個號碼，並在該值旁標示 `○`：

| 欄位 | 平均值計算 | Fallback（數據不足時） |
| :--- | :--- | :--- |
| AVG Mean | 近 100 期 AVG 的平均值 | (MIN + MAX) / 2 |
| STD Mean | 近 100 期 STD 的平均值 | (MIN + MAX) / 2 |
| RSV Mean | 近 100 期 RSV 的平均值 | (MIN + MAX) / 2 |
| K Mean | 近 100 期 K 的平均值 | (MIN + MAX) / 2 |
| D Mean | 近 100 期 D 的平均值 | (MIN + MAX) / 2 |
| J Mean | 近 100 期 J 的平均值 | (MIN + MAX) / 2 |

- 不再使用獨立的 x̄ 行，改為在每個欄位中標示最接近平均值的候選號碼（加 `x̄` 後綴）。
- Fallback 值表示數據不足時的估算值（MIN 與 MAX 的中間值）。

#### 4.4 其他功能

| 功能 | 說明 |
| :--- | :--- |
| RSV 範圍來源 | 同柱 DataNKD0x。以 DataNKD00 將 KDSN 對回 DataN00 SN/日期，並依 RSVn 與 RSVCo 篩選後取最近 100 期；KDSN 不能直接當 DataN00 SN 使用。 |
| STD ※標示 | 預測 STD 欄中，等於同窗口全候選最小 STD 的值加 ※；並列最低者皆標示。 |
| 顯示答案比對 | 第 p 柱只對照開獎主號第 p 個號碼；S1 柱只對照特別號。答案載入成功才啟用按鈕；預測視圖以答案號碼列外框標示。 |
| Tooltip | 格式為「號碼值，欄位名稱」（例如 1，AVG100）；號碼第一欄不顯示 tooltip。 |
| Hover 高亮 | 預測表資料列 hover（包含第一筆資料列）時暫時高亮整列，移出即還原。 |
| 顯示答案啟用 | 只在預測檢視啟用；切至震盪檢視時停用。 |

### 5. 圖表功能

- 圖表與表格在同一預測頁切換；一次只顯示一種子視圖。
- 指標選單：AVG、STD、RSV（已移除 K/D/J）。窗口選單維持 5/10/25/50/100。
- 圖表顯示期數選單：25/50/100；僅控制圖表顯示多少已載入快照，不改變指標窗口計算。
- 預測資料預載入預設 100 期，圖表預顯示 25 期。使用者曾手動設定或 URL 指定的資料筆數會保留；舊快取的預設 25 期升級為 100。
- 圖表使用目前已載入的快照與候選預測資料，不另開頁、不重新計算。所選顯示期數超過已載入快照時，頁面提示實際可用期數。
- AVG/STD 圖表顯示所選指標的歷史實際線與候選預測線。RSV 圖表同時顯示 RSV/K/D/J，各指標不同顏色；歷史線為實線、預測線為虛線。
- 圖表新增滑鼠十字線（灰色虛線），隨滑鼠移動顯示 X/Y 軸參考線。
- 圖表按「顯示答案」時，以紅色星形（★）標示答案候選點。
- 圖表新增各指標的歷史平均值橫線（彩色虛線），線右端顯示 `x̄指標名=值`。平均線限制在繪圖區域內。標籤垂直偏移避免重疊：每條線標籤上下交錯（14px 間距），超出圖表頂部時改為下方顯示。

### 6. 快取完整性與讀取優化

- DataN0x、DataNVAR0x、DataNKD0x：每個 SN/KDSN 每位置恰一列；必要欄位須存在，數值欄須為有限數值。重複鍵或無效值視為不完整並重建該鍵。
- DataNNext0x、DataNNextKD0x：按彩種號碼池檢查候選號完整、合法且不重複：L539=39、L649/LSix=49、L638=38。
- DataNNext0x 若候選有重複/非法號碼，重建該預測鍵；只有缺號或單候選值無效時，只修該候選。
- DataNNextKD0x 只刪除重複或無效候選，保留有效候選並補缺號。
- 每次 getNextData() 對各 NextData 快取表建立必要欄位的記憶體快取，供完整性檢查、畫面回讀、歷史範圍與 RSV 門檻共用；寫入成功的資料也合併回記憶體快取。
- 快取表標頭/欄序與程式預期 schema 不符時停止寫入並回報，避免把資料附加到錯欄。
- 快照窗口取資料時使用日期索引，避免每個日期重複掃描 All 歷史清單；All 仍需提供計算序列。

### 7. 已修復的 Bug

- **KDSN=0 無效資料** (@904)：當 kdsn === 0（找不到對應的 KDSN）時，仍會寫入 DataNKDVAR0x 表，產生無效的 KDSN=0 記錄。已修復為 `if (!nkdVarComplete && kdsn > 0)`。
- **DataNKDVAR 去重** (@903)：原本使用 `skipDedup=true` 導致重複寫入，已改為 `dedupCol="lngDataN00KDSN", skipDedup=false`。
- **STD/K/D/J 外框顏色** (@897)：STD 改用紫框/橘框，K/D/J 新增外框比對。
- **圖表指標選項** (@905)：移除 K/D/J，只保留 AVG/STD/RSV。
- **mainspreadsheet 延遲初始化** (@894)：解決頁面載入時的授權問題。
- **badSchemas 自動刪除** (@895)：標頭不符的舊表自動刪除重建。
- **DataNVAR stdVar 缺失** (@896)：varRow.push 缺少 rstdVar，導致欄位錯位。
- **nkdsheet/varsheet 屬性補齊** (@896)：_nextPositions 中 pos 1-6 的 nkdsheet 和 varsheet 屬性。
- **clearNextDataTables** (@899)：快速刪除所有工作表的函數，避免 clearNextSnapshots 逾時。
- **整列亮顯 CSS** (@909)：補上 next-row-hover 和 :hover 的 CSS 規則。

### 8. 部署記錄

- 最近核實版本：@911
- 測試版 Deployment ID：AKfycbz1aHM-e-Gm3ZJzxaPQCJBSW44ix8yrowMyC292BbrF3Oo6g_267yzPu_-IdnjG00Tf
- Web App 存取值：ANYONE_ANONYMOUS
- 正式版未更新（需使用者確認）

### 9. 匯入的參考檔

- .opencode/imported-opencode-diff.txt 是 NextData_Server.js 的 unified diff，不是對話逐字稿；僅供參考，未自動套用。內容部分文字疑似編碼錯誤，採用前須人工核對。
