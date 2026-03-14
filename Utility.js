const mainspreadsheet = SpreadsheetApp.getActiveSpreadsheet();

function getLastRecords() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheets = ["L539", "L649", "L638", "LSix"];
  var result = {};

  sheets.forEach(function (sheetName) {
    var sheet = ss.getSheetByName(sheetName);
    if (sheet && sheet.getLastRow() > 1) {
      var lastRow = sheet.getLastRow();
      var lastCol = sheet.getLastColumn();
      // Get headers (Row 1) and last data row
      var headers = sheet.getRange(1, 1, 1, lastCol).getDisplayValues()[0];
      var data = sheet.getRange(lastRow, 1, 1, lastCol).getDisplayValues()[0];

      var record = {};
      headers.forEach(function (header, index) {
        // Simple key cleanup if needed, or use header directly
        record[header] = data[index];
      });
      result[sheetName] = record;
    }
  });
  return result;
}

function getIdFromUrl(url) {
  var id = "";
  try {
    var match = url.match(/[-\w]{25,}/);
    if (match) {
      id = match[0];
    }
  } catch (e) {
    id = "";
  }
  return id;
}

function getTarget(sheetName, targetName) {
  var sheet = mainspreadsheet.getSheetByName(sheetName);
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

function getTargetsheet(sheetName, targetName) {
  var res = getTarget(sheetName, targetName);
  var fileId = getIdFromUrl(res);
  if (!fileId || typeof fileId !== "string") {
    throw new Error("無法從 URL 解析出有效的 ID: " + res);
  }
  var file = DriveApp.getFileById(fileId);
  var ssheet = SpreadsheetApp.open(file);
  return {
    url: res,
    id: fileId,
    spreadsheet: ssheet,
  };
}

function getAllData(date) {
  const srsheet2 = mainspreadsheet.getSheetByName("AllData");
  if (!srsheet2) return [];
  // 以 date find Date 欄位,並傳回 整列資料
  var data = srsheet2.getDataRange().getValues();
  var targetDate = new Date(date);
  targetDate.setHours(0, 0, 0, 0);

  for (var i = 1; i < data.length; i++) {
    var rowDate = data[i][0]; // Assuming Date is in column 1
    if (rowDate instanceof Date) {
      var d = new Date(rowDate);
      d.setHours(0, 0, 0, 0);
      if (d.getTime() === targetDate.getTime()) {
        return data[i];
      }
    }
  }
  return [];
}

/**
 * 取得當前 Web App 的 URL
 * 用於前端按鈕跳轉
 */
function getScriptUrl() {
  return ScriptApp.getService().getUrl();
}

/**
 * 提供給 HTML 範本呼叫，用來載入導航列組件
 */
function includeNav() {
  // 加入快取機制，避免每次都重新讀取檔案
  // var cache = CacheService.getScriptCache();
  // var cachedNav = cache.get("NavHTML");
  // if (cachedNav) return cachedNav;

  var template = HtmlService.createTemplateFromFile("Nav");
  var content = template.evaluate().getContent();
  // cache.put("NavHTML", content, 21600); // 快取 6 小時
  return content;
}

function combineData(sheetname) {
  const trObj = getTargetsheet("Sheets", sheetname);
  const trspreadsheet = trObj.spreadsheet;
  let trsheet = trspreadsheet.getSheetByName("All");

  if (!trsheet) {
    trsheet = trspreadsheet.insertSheet("All");
  }

  const srsheet1 = mainspreadsheet.getSheetByName(sheetname);

  // 檢查 trsheet 是否有資料，並取得最後一筆 Date 欄位資料
  // 如果沒有資料則 srsheet1 從第一筆資料開始結合
  let lastdate = null; //trsheet 的最後一筆 Date 欄位資料
  const lastRow = trsheet.getLastRow();
  if (lastRow > 1) {
    var val = trsheet.getRange(lastRow, 1).getValue();
    // 檢查回傳的值是否可以被轉換為有效的日期物件
    if (val && !isNaN(new Date(val).getTime())) {
      lastdate = new Date(val);
    }
  }

  const srData = srsheet1.getDataRange().getValues();
  const headers = srData[0];
  const lCols = headers
    .map((h, i) => ({ h, i }))
    .filter((o) => o.h.match(/^L\d+$/))
    .map((o) => o.i);
  const s1Col = headers.indexOf("S1");
  const sumCol = headers.indexOf("Sum");
  const dateCol = headers.indexOf("Date");

  // loop
  // 取得 srsheet1 的 L1,L2,L3,L4,L5 (L6: L649,L638,Lsix 要一起排序 )(S1:L649,L638,Lsix不排序) ,轉成 N1,N2,N3,N4,N5,N6,S1
  var rowsToAdd = [];

  for (var i = 1; i < srData.length; i++) {
    var row = srData[i];
    var d = row[dateCol];
    if (lastdate && d <= lastdate) continue;

    Logger.log("date: " + d);
    var nums = lCols.map((idx) => row[idx]).sort((a, b) => a - b); // N1...Nn
    var s1 = s1Col > -1 ? row[s1Col] : null;
    var sum = sumCol > -1 ? row[sumCol] : null;

    var datamap = getAllData(d);

    //結合 Date,N1,N2...Nn,S1,Sum 以及 datamap 的資料 ，寫入 trsheet
    var newRow = [d, ...nums];
    if (s1 !== null) newRow.push(s1);
    if (sum !== null) newRow.push(sum);

    if (datamap && datamap.length > 0) {
      newRow = newRow.concat(datamap.slice(1));
    }

    rowsToAdd.push(newRow);

    // 每50筆資料 update 一次
    if (rowsToAdd.length >= 10) {
      trsheet
        .getRange(
          trsheet.getLastRow() + 1,
          1,
          rowsToAdd.length,
          rowsToAdd[0].length,
        )
        .setValues(rowsToAdd);
      rowsToAdd = [];
      Logger.log("update trsheet");
    }
  }

  // 寫入剩餘的資料
  if (rowsToAdd.length > 0) {
    trsheet
      .getRange(
        trsheet.getLastRow() + 1,
        1,
        rowsToAdd.length,
        rowsToAdd[0].length,
      )
      .setValues(rowsToAdd);
  }
}

function test() {
  combineData("L539");
}
