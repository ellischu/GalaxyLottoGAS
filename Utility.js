const mainspreadsheet = SpreadsheetApp.getActiveSpreadsheet();

function doGet(e) {
  var page = e.parameter.page || "Index";
  return HtmlService.createTemplateFromFile(page)
    .evaluate()
    .setTitle("Galaxy Lotto Observer")
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

/**
 * 取得最後一期號碼
 * @returns 
 */
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

/**
 * 從網址取得 ID
 * @param {*} url 網址
 * @returns id
 */
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

/**
 * 取得工作表網址
 * @param {*} sheetName 工作表名稱
 * @param {*} targetName 目標名稱
 * @returns url
 */
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

/**
 * 取得工作表相關資訊
 * @param {*} sheetName 工作表名稱
 * @param {*} targetName 目標名稱
 * @returns 結構 url,id,spreadsheet 
 */
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

/**
 * 
 * @param {*} date type Date
 * @returns 
 */
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
 * 
 * @returns 
 */
function includeFooter() {
  let suggestUrl = "";
  // const cache = CacheService.getScriptCache();
  // const cacheKey = "SYSuggestUrl";

  // 1. 嘗試從快取讀取，如果有就直接使用
  // suggestUrl = cache.get(cacheKey);
  const template = HtmlService.createTemplateFromFile("Footer");
  // template.suggestUrl = suggestUrl;
  return template.evaluate().getContent();
}

/**
 * 提供給 HTML 範本呼叫，用來載入導航列組件
 * @returns 
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

var startTime = new Date().getTime();

/** 檢查是否快要超時 (設定為 20 秒以確保安全) */
function isNearTimeout() {
  return new Date().getTime() - startTime > 2 * 60 * 1000;
}

/**
 * 儲存/讀取進度 (PropertiesService 會存在雲端專案屬性中)
 * @param {*} propname 屬性名稱
 * @param {*} data 進度物件，會被序列化成 JSON 字串存儲
 */
function saveProgress(propname, data) {
  PropertiesService.getScriptProperties().setProperty(
    propname,
    JSON.stringify(data),
  );
}

/**
 * 讀取進度
 * @param {*} propname 屬性名稱
 * @returns {Object|null} 進度物件，如果沒有則回傳 null
 */
function getProgress(propname) {
  var p = PropertiesService.getScriptProperties().getProperty(propname);
  return p ? JSON.parse(p) : null;
}

/** 移除進度 */
function clearProgress(propname) {
  PropertiesService.getScriptProperties().deleteProperty(propname);
}
