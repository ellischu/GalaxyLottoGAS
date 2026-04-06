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

  // 優化日期比對：確保輸入與歷史數據皆以相同的時區格式進行字串比對
  var normalizeDateStr = function (v) {
    if (!v) return "";
    // 處理 Date 物件或包含 T 的日期字串
    const d = v instanceof Date ? v : new Date(String(v).replace(/-/g, "/"));
    return Utilities.formatDate(d, "Asia/Taipei", "yyyy-MM-dd");
  };
  var targetTimeStr = normalizeDateStr(date);

  for (var i = 1; i < data.length; i++) {
    var rowTimeStr = normalizeDateStr(data[i][0]);
    if (rowTimeStr === targetTimeStr) {
      return data[i];
    }
  }
  return [];
}

/**
 * 根據 ID 取得對應的欄位名稱 (FieldName)
 * @param {string|number} id 欄位 ID (對應 strLabelID)
 * @returns {string} 欄位名稱 (對應 strLabelName)，若找不到則回傳原始 ID
 */
function getFieldName(id) {
  if (id === null || id === undefined) return "";
  const mapping = getFieldMapping();
  const targetId = String(id).trim();
  return mapping[targetId] || String(id);
}

/**
 * 取得完整的欄位對照表 (FieldName)
 * @returns {Object} 包含 ID 與名稱的對照物件
 */
function getFieldMapping() {
  const cache = CacheService.getScriptCache();
  const cacheKey = getCacheVersion() + "_MAP_FIELDNAME";
  let mapping = JSON.parse(cache.get(cacheKey) || "null");

  if (!mapping) {
    mapping = {};
    const sheet = mainspreadsheet.getSheetByName("FieldName");
    if (sheet) {
      const data = sheet.getDataRange().getValues();
      const headers = data[0].map((h) => String(h || "").trim());
      const idIdx = headers.indexOf("strLabelID");
      const nameIdx = headers.indexOf("strLabelName");

      if (idIdx !== -1 && nameIdx !== -1) {
        for (let i = 1; i < data.length; i++) {
          const key = String(
            data[i][idIdx] === undefined ? "" : data[i][idIdx],
          ).trim();
          const val = String(data[i][nameIdx] || "").trim();
          if (key) {
            if (mapping[key]) {
              Logger.log(
                `[FieldName 衝突預警] 偵測到重複的 ID: "${key}"。原名稱 "${mapping[key]}" 將被取代為 "${val}"。`,
              );
            }
            mapping[key] = val;
          }
        }
      }
    }
    const ttl = 21600; // 6 小時
    cache.put(cacheKey, JSON.stringify(mapping), ttl);
    cache.put(cacheKey + "_TS", Date.now().toString(), ttl); // 記錄快取時間戳
  }
  return mapping;
}

/**
 * 根據 ID 取得對應的名稱 (IDName)
 * @param {string|number} id 項目 ID (對應 ID)
 * @returns {string} 項目名稱 (對應 IDName)，若找不到則回傳原始 ID
 */
function getIDName(id) {
  if (id === null || id === undefined) return "";
  const mapping = getIDMapping();
  const targetId = String(id).trim();
  return mapping[targetId] || String(id);
}

/**
 * 取得完整的項目對照表 (IDName)
 * @returns {Object} 包含 ID 與名稱的對照物件
 */
function getIDMapping() {
  const cache = CacheService.getScriptCache();
  const cacheKey = getCacheVersion() + "_MAP_IDNAME";
  let mapping = JSON.parse(cache.get(cacheKey) || "null");

  if (!mapping) {
    mapping = {};
    const sheet = mainspreadsheet.getSheetByName("IDName");
    if (sheet) {
      const data = sheet.getDataRange().getValues();
      const headers = data[0].map((h) => String(h || "").trim());
      const idIdx = headers.indexOf("ID");
      const nameIdx = headers.indexOf("IDName");

      if (idIdx !== -1 && nameIdx !== -1) {
        for (let i = 1; i < data.length; i++) {
          const key = String(
            data[i][idIdx] === 0 ? "0" : data[i][idIdx] || "",
          ).trim();
          const val = String(data[i][nameIdx] || "").trim();
          if (key !== "") mapping[key] = val;
        }
      }
    }
    const ttl = 21600; // 6 小時
    cache.put(cacheKey, JSON.stringify(mapping), ttl);
    cache.put(cacheKey + "_TS", Date.now().toString(), ttl); // 記錄快取時間戳
  }
  return mapping;
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

  var content = "";
  // 對於程式庫 (Lib_ 打頭) 或 樣式表，直接讀取內容不進行 template 評估，避免內容過大或包含衝突字元導致 SyntaxError
  if (filename.indexOf("Lib_") === 0 || filename === "Styles") {
    content = HtmlService.createHtmlOutputFromFile(filename).getContent();
  } else {
    content = HtmlService.createTemplateFromFile(filename)
      .evaluate()
      .getContent();
  }

  // 快取 6 小時 (21600 秒)，注意 CacheService 有 100KB 限制，過大的檔案不存入快取以免報錯
  if (content.length < 100000) {
    cache.put(cacheKey, content, 21600);
  }
  return content;
}

/**
 * 手動刷新對照表快取 (FieldName & IDName)
 * 讓使用者在更改試算表設定後能立即生效
 */
function refreshMappingCache() {
  try {
    const cache = CacheService.getScriptCache();
    const version = getCacheVersion();

    // 移除特定的 Mapping 快取鍵
    cache.remove(version + "_MAP_FIELDNAME");
    cache.remove(version + "_MAP_FIELDNAME_TS");
    cache.remove(version + "_MAP_IDNAME");
    cache.remove(version + "_MAP_IDNAME_TS");

    // 呼叫版本更新來確保全局快取同步失效 (Bust Cache)
    const result = clearAllCache(false);

    return {
      status: "success",
      message: "對照表快取已刷新，新版本號：" + result.newVersion,
    };
  } catch (e) {
    return { status: "error", message: "刷新快取失敗：" + e.toString() };
  }
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
    const version = getCacheVersion();

    // 取得時間戳計算剩餘效期 (以 FieldName 為主準則)
    const ts = cache.get(version + "_MAP_FIELDNAME_TS");
    let remaining = null;
    if (ts) {
      const elapsed = Math.floor((Date.now() - Number(ts)) / 1000);
      remaining = Math.max(0, 21600 - elapsed);
    }

    // 進行簡單的讀寫測試
    const testKey = "STATUS_CHECK_" + new Date().getTime();
    cache.put(testKey, "OK", 60);
    const val = cache.get(testKey);

    return { ok: val === "OK", version: version, remaining: remaining };
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
  return new Date().getTime() - startTime > 20 * 1000;
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

/**
 * 初始化或補完 Settings 工作表
 * 建議在首次執行或需要重設參數時手動執行此函式
 */
function initSettingsSheet() {
  let sheet = mainspreadsheet.getSheetByName("Settings");
  if (!sheet) {
    sheet = mainspreadsheet.insertSheet("Settings");
  }

  const defaultSettings = [
    ["參數名稱", "設定值", "說明"],
    ["SigThreshold", 1.8, "信心判定門檻 (越低越嚴格)"],
    ["AnomalyThreshold", 2.5, "一般異常觸發倍率"],
    ["SevereThreshold", 4.5, "嚴重異常觸發倍率"],
    ["BypassCache", false, "是否強制重新計算 AI 模型 (True/False)"],
    ["Weight_波動", 2.5, "係數權重：波動性相關"],
    ["Weight_成交", 1.8, "係數權重：成交量相關"],
    ["Weight_趨勢", 1.5, "係數權重：趨勢動能相關"],
    ["Weight_隨機", 0.8, "係數權重：隨機雜訊"],
    ["Weight_星宿", 2.2, "係數權重：二十八星宿週期"],
    ["Weight_九星", 2.0, "係數權重：日九星偏移"],
    ["L539_SigThreshold", 1.8, "特定彩種 (539) 的自訂門檻"],
  ];

  const existingData = sheet.getDataRange().getValues();
  if (existingData.length <= 1) {
    sheet.getRange(1, 1, defaultSettings.length, 3).setValues(defaultSettings);
    sheet.setFrozenRows(1);
    sheet.getRange("A1:C1").setBackground("#f3f3f3").setFontWeight("bold");
    return "Settings 工作表初始化完成。";
  }
  return "Settings 工作表已存在，未進行修改。";
}

/**
 * 取得 PropertiesService 中的錯誤日誌與統計資訊
 * 用於前端顯示系統異常狀況
 * @returns {Object} 包含錯誤累計次數與最後一次錯誤詳情
 */
function getErrorLogs() {
  const props = PropertiesService.getScriptProperties();
  const count = props.getProperty("ERR_PREDICT_COUNT") || "0";
  const lastErrRaw = props.getProperty("ERR_PREDICT_LAST");

  let lastError = null;
  if (lastErrRaw) {
    try {
      lastError = JSON.parse(lastErrRaw);
    } catch (e) {
      lastError = { message: "解析日誌失敗", raw: lastErrRaw };
    }
  }

  return {
    errorCount: parseInt(count),
    lastError: lastError,
  };
}

/**
 * 轉換 AllData 工作表並輸出至 AllDataC
 * 1. 利用 getFieldName(id) 轉換標題
 * 2. 利用 getIDName(id) 轉換值，但 Date 及 strp13(命重) 的值不轉換
 */
function transformAllDataToC() {
  const srcSheet = mainspreadsheet.getSheetByName("AllData");
  if (!srcSheet) {
    throw new Error("找不到來源工作表：AllData");
  }

  let targetSheet = mainspreadsheet.getSheetByName("AllDataC");
  if (!targetSheet) {
    targetSheet = mainspreadsheet.insertSheet("AllDataC");
  }

  const data = srcSheet.getDataRange().getValues();
  if (data.length === 0) return "來源工作表無資料";

  const rawHeaders = data[0];
  const dateIdx = rawHeaders.indexOf("Date");
  const strp13Idx = rawHeaders.indexOf("strp13");

  const fieldMapping = getFieldMapping();
  const idMapping = getIDMapping();

  // 批次處理與續傳邏輯
  const progress = getProgress("TransformAllData_JOB");
  let currentIndex = 0;
  if (progress) {
    currentIndex = progress.currentIndex || 0;
  } else {
    targetSheet.clear();
  }

  let rowsToAdd = [];
  const batchSize = 500; // 每 500 筆寫入一次

  let i = currentIndex;
  try {
    for (; i < data.length; i++) {
      const row = data[i];
      const transformedRow = row.map((cell, cIdx) => {
        if (cell === null || cell === undefined) return "";

        if (i === 0) {
          // 轉換標題行
          const tid = String(cell).trim();
          return fieldMapping[tid] || String(cell);
        }

        if (cIdx === dateIdx || cIdx === strp13Idx) {
          return cell;
        }

        const tval = String(cell).trim();
        return idMapping[tval] || String(cell);
      });

      rowsToAdd.push(transformedRow);

      // 檢查寫入時機：達到批次量或執行時間快要超時
      if (rowsToAdd.length >= batchSize || isNearTimeout()) {
        const lastRow = targetSheet.getLastRow();
        targetSheet
          .getRange(lastRow + 1, 1, rowsToAdd.length, rowsToAdd[0].length)
          .setValues(rowsToAdd);
        rowsToAdd = [];

        if (isNearTimeout()) {
          saveProgress("TransformAllData_JOB", { currentIndex: i + 1 });
          return {
            status: "continue",
            message: "轉換處理中：" + (i + 1) + " / " + data.length,
            currentIndex: i + 1,
            total: data.length,
          };
        }
      }
    }

    // 寫入最後剩餘的資料
    if (rowsToAdd.length > 0) {
      const lastRow = targetSheet.getLastRow();
      targetSheet
        .getRange(lastRow + 1, 1, rowsToAdd.length, rowsToAdd[0].length)
        .setValues(rowsToAdd);
    }
  } catch (err) {
    // 發生例外時，嘗試將目前已處理的批次緊急寫入
    if (rowsToAdd.length > 0) {
      try {
        const lastRow = targetSheet.getLastRow();
        targetSheet
          .getRange(lastRow + 1, 1, rowsToAdd.length, rowsToAdd[0].length)
          .setValues(rowsToAdd);
      } catch (saveErr) {
        Logger.log("緊急存檔失敗: " + saveErr.toString());
      }
    }
    // 儲存當前索引以供續傳
    saveProgress("TransformAllData_JOB", { currentIndex: i });

    // 紀錄詳細錯誤到 ErrorLog 工作表
    try {
      let logSheet = mainspreadsheet.getSheetByName("ErrorLog");
      if (!logSheet) {
        logSheet = mainspreadsheet.insertSheet("ErrorLog");
        logSheet.appendRow(["時間", "函式", "錯誤訊息", "處理列索引", "備註"]);
      }
      logSheet.appendRow([
        new Date(),
        "transformAllDataToC",
        err.toString(),
        i,
        "轉換過程中發生異常，已儲存進度點",
      ]);
    } catch (logErr) {
      Logger.log("寫入 ErrorLog 工作表失敗: " + logErr.toString());
    }

    return {
      status: "error",
      message:
        "轉換時發生錯誤：" +
        err.toString() +
        "。目前進度已存檔，您可以重新執行以進行續傳。",
      currentIndex: i,
    };
  }

  clearProgress("TransformAllData_JOB");
  return {
    status: "complete",
    message: "轉換完成，共處理 " + (data.length - 1) + " 筆資料。",
    btntext: "確定",
  };
}
