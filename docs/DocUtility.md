# 公用程式

## 系統環境

- [系統環境](DocGalaxy計劃文件.md#系統環境)
- [工作表資料](DocSpreadsheet.md)

## 常數 mainspreadsheet

```javascript
const mainspreadsheet = SpreadsheetApp.getActiveSpreadsheet(); //已建立
```

## 相關函式設計

- [combineData](DocUtility.md#函式-combinedata-設計概念)
- [getTarget](DocUtility.md#函式-gettarget-設計概念)
- [getTargetsheet](DocUtility.md#函式-gettargetsheet-設計概念)
- [getAllData](DocUtility.md#函式-getalldata-設計概念)
- [getMethodSN](DocUtility.md#函式-getmethodsn-設計概念)
- [getMethodObj](DocUtility.md#函式-getmethodobj-設計概念)
- [getNextNumDetail](DocUtility.md#輔助函式-getnextnumdetail-設計概念)
- [getFieldModeDetail](DocUtility.md#輔助函式-getfieldmodedetail-設計概念)
- [getDataBase](DocUtility.md#輔助函式-getdatabase-設計概念)
- [getMissDataTable](DocUtility.md#函式-getmissdatatable-設計概念)

[返回](#試算表及工作表資料)

### 函式 combineData 設計概念

- 建立Utility.js 中 combineData。

```javascript
function combineData(sheetname) {
    const trspreadsheet = getTargetsheet(“Sheets”, sheetname).spreadsheet;
    const trsheet = trspreadsheet.getSheetByName(“All”);
    const srsheet1 = mainspreadsheet.getSheetByName(sheetname);
    // 檢查 trsheet 是否有資料，並取得最後一筆 Date 欄位資料
    // 如果沒有資料則 srsheet1 從第一筆資料開始結合
    const lastdate =; //trsheet 的最後一筆 Date 欄位資料
    // loop
    // 取得 srsheet1 的 L1,L2,L3,L4,L5 (L6:L649,L638,Lsix 要一起排序 )(S1:L649,L638,Lsix不排序),轉成 N1,N2,N3,N4,N5,N6,S1
    var datamap = getAllData(date);
    //結合 Date,N1,N2,B3,N4,N5,N6,S1,Sum 以及 datamap 的資料 ，寫入 trsheet
}
```

- 先處理10筆資料用以驗證正確性。

[返回](#相關函式設計)

### 函式 getTarget 設計概念

- 建立Utility.js 中 getTarget。

```javascript
function getTarget(sheetName, targetName) {
  var sheet = MainSpreadsheet.getSheetByName(sheetName);
  if (!sheet) throw new Error("找不到 SYCompany 中的" + sheetName + "工作表");
  var data = sheet.getDataRange().getValues();
  var url = "";
  for (var i = 1; i < data.length; i++) {
    if (data[i][0] === targetName) {
      url = data[i][1];
      break;
    }
  }
  // console.log("取得試算表網址: " + url);
  return url;
}
```

[返回](#相關函式設計)

### 函式 getTargetsheet 設計概念

- 建立Utility.js 中 getTargetsheet。

```javascript
function getTargetsheet(sheetName, targetName) {
  var res = getTarget(sheetName, targetName);
  var fileId = getIdFromUrl(res);
  if (!fileId || typeof fileId !== "string") {
    throw new Error("無法從 URL 解析出有效的 ID: " + res);
  }
  var file = DriveApp.getFileById(fileId);
  var ssheet = SpreadsheetApp.open(file);
  return { url: res, id: fileId, spreadsheet: ssheet };
}
```

[返回](#相關函式設計)

### 函式 getAllData 設計概念

- 建立Utility.js 中 getAllData。

```javascript
function getAllData(date) {
  const srsheet2 = mainspreadsheet.getSheetByName("AllData");
  // 以 date find Date 欄位,並傳回 整列資料
}
```

[返回](#相關函式設計)

### 函式 getMethodSN 設計概念

- 在 Utility.js 中建立 function getMethodSN。
- 傳入 物件(objdct) 的值 參照 [methed工作表](Docspreadsheet.md#method-工作表)
  之欄位名稱(不含 lngMethodSN , strcheck) 。
- 欄位 strcheck 為檢查機制。
- 把物件轉成 strcheck ,再以 strcheck 查詢，如果查詢不到則新增。

[返回](#相關函式設計)

### 函數 getMethodObj 設計概念

- 在 Utility.js 中建立 function getMethodObj。
- 傳入 方法序號(lngMethodSN)傳回物件(objdct)的值參照[methed工作表](Docspreadsheet.md#method-工作表)
  之欄位名稱。

[返回](#相關函式設計)

### 輔助函式 getNextNumDetail 設計概念

- 建立Utility.js 中 getNextNumDetail。
- 傳入參數：lotto, date, intNextNums, intNextStep, conditions。
- 輸出 strNextNums , StrNextNumSpe 。

[返回](#相關函式設計)

### 輔助函式 getFieldModeDetail 設計概念

- 建立Utility.js 中 getFieldModeDetail。
- 傳入參數：date , conditions 。
- 輸出 strComparesDetail 。

[返回](#相關函式設計)

### 輔助函式 getDataBase() 設計概念

- 建立Utility.js 中 getDataBase
- 傳入參數 包括 彩種, 日期, 方法序號(或物件), date輸出順序, 回傳筆數。

```javascript
function getDataBase(lotto, date, methodRef, sort = "DESC", limit) {
  // 1. 解析 methodRef
  let methodObj = null;
  if (
    typeof methodRef === "number" ||
    (!isNaN(methodRef) && typeof methodRef !== "object")
  ) {
    methodObj = getMethodObj(methodRef);
  } else {
    methodObj = methodRef;
  }
  if (!methodObj) return [];

  // 1. 處理 FieldMode：從 lotto 試算表 > All 工作表中提取 < date 的資料，並依 date 的 ASC 排序。
  //    若 FieldMode 為 true，則過濾符合條件的資料。

  // 2. 處理 NextNumsMode：利用步驟 1 過濾後的結果進行逐筆檢查。
  //    由目前資料往前 intNextStep 筆，檢查該期號碼是否符合托牌組合。

  // 3. 處理 intDataLimit, intDataOffset (資料分頁限制)。

  // 4. 處理 intSearchLimit, intSearchOffset (搜尋範圍限制)。

  // 5. 執行最終排序 (sort: DESC/ASC)。

  // 6. 依據 limit 參數回傳指定筆數。
}
```

[返回](#相關函式設計)

### 函式 getMissDataTable 設計概念

- 建立Utility.js 中 getMissDataTable。
- 傳入參數 包括 彩種, 日期, 方法序號(或物件), date輸出順序, 回傳筆數。

```javascript
function getMissDataTable(lotto, date, methodRef, sort = "DESC", limit) {
  //  1. 根據參數 ,呼叫 getDataBase(),傳回全部資料 ,再擷取 Date,L1,L2,L3,L4,L5,L6,S1,Sum 部份 ,依Date的ASC輸出SourceTemp。
  const SourceTemp = getDataBase(lotto, date, methodRef, "ASC", -1);

  //  2. 依彩種 ,Date<預測日期 ,當lngMethodSN==方法序號 ,取得Miss工作表 ,依Date的ASC輸出所有資料MissTemp。
  const MissTemp = getMissTable(lotto, date, methodRef, "ASC", -1);

  //  3. If SourceTemp.length == MissTemp.length ,依Date的sort順序 ,然後再依筆數輸出

  // 4. If SourceTemp.length != MissTemp.length ,
}
```
