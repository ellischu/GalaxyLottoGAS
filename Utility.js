const mainspreadsheet = SpreadsheetApp.getActiveSpreadsheet();

function doGet(e) {
  var page = e.parameter.page || "Index";
  return HtmlService.createTemplateFromFile(page)
    .evaluate()
    .setTitle("Galaxy Lotto Observer")
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

// 從屬性服務取得版本號，若無則預設為 v1.0
/**
 * 動態取得當前快取版本號，確保清理快取後能立即 bust cache
 */
function getCacheVersion() {
  return (
    PropertiesService.getScriptProperties().getProperty("APP_VERSION") || "v1.3"
  );
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
  if (!sheet) throw new Error("找不到主試算表中的 " + sheetName + " 工作表");

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
  // 統一轉換為時間戳記進行比較，避免 Date 物件與字串混合的問題
  var parseTime = function (v) {
    if (!v) return 0;
    var d =
      v instanceof Date
        ? new Date(v)
        : new Date(v.toString().replace(/-/g, "/"));
    return isNaN(d.getTime()) ? 0 : d.setHours(0, 0, 0, 0);
  };

  var targetTime = parseTime(date);

  for (var i = 1; i < data.length; i++) {
    var rowTime = parseTime(data[i][0]);
    if (rowTime > 0 && rowTime === targetTime) {
      return data[i];
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
 * 取得應用程式全域組態 (優先從 PropertiesService 取得)
 * @param {string} key 設定名稱
 * @param {any} defaultValue 預設值
 */
function getAppSetting(key, defaultValue = null) {
  const cache = CacheService.getScriptCache();
  const cacheKey = getCacheVersion() + "_prop_" + key;

  // 1. 嘗試從快取讀取
  const cachedVal = cache.get(cacheKey);
  if (cachedVal !== null) return cachedVal;

  // 2. 快取失效，從 PropertiesService 讀取
  const propVal = PropertiesService.getScriptProperties().getProperty(key);
  if (propVal !== null) {
    // 3. 同步回快取，以便下次快速讀取 (快取 6 小時)
    cache.put(cacheKey, propVal, 21600);
    return propVal;
  }

  // 如果屬性中找不到，可以擴充為去 "Settings" 工作表查找
  return defaultValue;
}

/**
 * 更新應用程式全域組態
 */
function setAppSetting(key, value) {
  const stringValue =
    typeof value === "object" ? JSON.stringify(value) : value.toString();

  // 1. 寫入持久化儲存 (PropertiesService)
  PropertiesService.getScriptProperties().setProperty(key, stringValue);

  // 2. 同步更新快取 (CacheService)
  const cache = CacheService.getScriptCache();
  const cacheKey = getCacheVersion() + "_prop_" + key;
  cache.put(cacheKey, stringValue, 21600);
}

/**
 * 載入共用 CSS 樣式
 */
function includeStyles() {
  return HtmlService.createHtmlOutputFromFile("Styles").getContent();
}

/**
 * 通用載入函式，支援解析 HTML 內的 scriptlets (如 <?!= ... ?>)
 * 用於載入 Scripts.html 等含有動態變數的檔案
 */
function include(filename) {
  const cache = CacheService.getScriptCache();
  const cacheKey = getCacheVersion() + "_html_" + filename; // 使用版本號作為前綴
  const cached = cache.get(cacheKey);

  if (cached) return cached;

  const content = HtmlService.createTemplateFromFile(filename)
    .evaluate()
    .getContent();

  // 快取 6 小時 (21600 秒)
  cache.put(cacheKey, content, 21600);
  return content;
}

/**
 * 手動清理快取的工具函式
 * @param {boolean} isMajor 是否為大版本更新 (預設 false)
 */
function clearAllCache(isMajor = false) {
  const props = PropertiesService.getScriptProperties();
  const currentVersion = props.getProperty("APP_VERSION") || "v1.3";
  const versionMatch = currentVersion.match(/(\d+)\.(\d+)/);
  let newVersion = "v1.4";

  if (versionMatch) {
    let major = parseInt(versionMatch[1]);
    let minor = parseInt(versionMatch[2]);
    if (isMajor) {
      major++;
      minor = 0;
    } else {
      minor++;
    }
    newVersion = `v${major}.${minor}`;
  }

  props.setProperty("APP_VERSION", newVersion);
  return {
    status: "success",
    newVersion: newVersion,
    systemProps: props.getProperties(), // 回傳所有系統變數清單
  };
}

/**
 * 檢查快取服務狀態
 * @returns {Object} 狀態物件
 */
function getCacheStatus() {
  try {
    const cache = CacheService.getScriptCache();
    if (!cache) return { ok: false, message: "無法取得快取服務" };

    // 進行簡單的讀寫測試
    const testKey = "STATUS_CHECK_" + new Date().getTime();
    cache.put(testKey, "OK", 60);
    const val = cache.get(testKey);

    return { ok: val === "OK", version: getCacheVersion() };
  } catch (e) {
    return { ok: false, message: e.toString() };
  }
}

/**
 *
 * @returns
 */
function includeFooter() {
  return include("Footer");
}

/**
 * 提供給 HTML 範本呼叫，用來載入導航列組件
 * @returns
 */
function includeNav() {
  return include("Nav");
}

/** @type {number} */
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
