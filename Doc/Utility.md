# 公用程式

## 系統環境

- [系統環境](Galaxy計劃文件.md#系統環境)

## 常數 mainspreadsheet

```javascript
const mainspreadsheet = SpreadsheetApp.getActiveSpreadsheet(); //已建立
```

## 相關函式設計

### 函式 combineData 設計概念

- 建立Utility.js 中 combineData。

```javascript
function combineData(sheetname) {
    const trspreadsheet = getTargetsheet(“Sheets”,sheetname).spreadsheet;
    const trsheet = trspreadsheet.getSheetByName(“All”);
    const srsheet1 = mainspreadsheet.getSheetByName(sheetname);
    // 檢查 trsheet 是否有資料，並取得最後一筆 Date 欄位資料
    // 如果沒有資料則 srsheet1 從第一筆資料開始結合
    const lastdate = ; //trsheet 的最後一筆 Date 欄位資料
    // loop
    // 取得 srsheet1 的 L1,L2,L3,L4,L5 (L6:L649,L638,Lsix 要一起排序 )(S1:L649,L638,Lsix不排序),轉成 N1,N2,N3,N4,N5,N6,S1
    var datamap = getAllData(date);
    //結合 Date,N1,N2,B3,N4,N5,N6,S1,Sum 以及 datamap 的資料 ，寫入 trsheet
   }
```

- 先處理10筆資料用以驗證正確性。

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

### 函式 getAllData 設計概念

- 建立Utility.js 中 getAllData。

```javascript
function getAllData(date){
   const srsheet2 = mainspreadsheet.getSheetByName(“AllData”);
   // 以 date find Date 欄位,並傳回 整列資料
   }
```
