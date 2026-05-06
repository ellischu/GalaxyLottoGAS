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
 * @param {string} salt 額外的版本鹽值 (A 開頭為 V1, P 開頭為星系, MAP 為對照表)
 */
function getCacheVersion(salt = "") {
  const props = PropertiesService.getScriptProperties();
  let verKey = "APP_VERSION";
  
  if (salt.startsWith("A")) verKey = "V1_VERSION";
  else if (salt.startsWith("P")) verKey = "GALAXY_VERSION";
  else if (salt.includes("MAP")) verKey = "MAP_VERSION";

  let baseVersion = props.getProperty(verKey);
  if (!baseVersion) {
    baseVersion = (verKey === "APP_VERSION") ? "v1.3.0" : "1.0.0";
    props.setProperty(verKey, baseVersion);
  }
  return salt ? baseVersion + "_" + salt : baseVersion;
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
 * @param {Date|string} date type Date 或日期字串
 * @param {boolean} withHeaders 是否同時輸出欄位名稱與值 (預設為 false)
 * @returns {Array|Object} 預設傳回整列資料陣列；若 withHeaders 為 true 則傳回鍵值對物件
 */
function getAllData(date, withHeaders = false) {
  const srsheet2 = mainspreadsheet.getSheetByName("AllData");
  if (!srsheet2) return withHeaders ? null : [];
  // 以 date find Date 欄位,並傳回 整列資料
  var data = srsheet2.getDataRange().getValues();
  if (data.length === 0) return withHeaders ? null : [];
  var headers = data[0];

  // 優化日期比對：確保輸入與歷史數據皆以相同的時區格式進行字串比對
  var normalizeDateStr = function (v) {
    if (!v) return "";
    // 修正：增加對無效日期物件的檢查
    const d = v instanceof Date ? v : new Date(String(v).replace(/-/g, "/"));
    if (isNaN(d.getTime())) return "";
    return Utilities.formatDate(d, "Asia/Taipei", "yyyy-MM-dd");
  };
  var targetTimeStr = normalizeDateStr(date);
  if (!targetTimeStr) return withHeaders ? null : [];

  for (var i = 1; i < data.length; i++) {
    var rowTimeStr = normalizeDateStr(data[i][0]);
    if (rowTimeStr === targetTimeStr) {
      if (withHeaders) {
        var resultObj = {};
        headers.forEach(function(header, index) {
          resultObj[header] = data[i][index];
        });
        return resultObj;
      }
      return data[i];
    }
  }
  return withHeaders ? null : [];
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
 * 提示：前端跳轉請務必使用 <a target="_top"> 或 window.open(url, '_top')
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
 * 全域快取清理：遞增 APP_VERSION 以失效所有未加鹽(Unsalted)的快取
 * @param {boolean} isMajor 是否為大版本更新 (預設 false)
 */
function clearAllCache(isMajor = false) {
  const lock = LockService.getScriptLock();
  const props = PropertiesService.getScriptProperties();
  const currentVersion = props.getProperty("APP_VERSION") || "v1.3.0";
  
  // 使用更強健的語義化版本遞增邏輯
  const newVersion = incrementSemVer(currentVersion, isMajor ? 'major' : 'minor');

  try {
    lock.waitLock(5000);
    props.setProperty("APP_VERSION", newVersion);
    
    // 清理 CacheService 中的所有舊快取 (強制 Bust Cache)
    const cache = CacheService.getScriptCache();
    cache.remove("APP_VERSION"); // 移除版本號快取，強制下次重新從屬性讀取
    
    return {
      status: "success",
      newVersion: newVersion,
      message: "全域版本已更新，所有通用快取已失效。"
    };
  } catch (e) {
    return { status: "error", message: "版本更新失敗: " + e.toString() };
  } finally {
    lock.releaseLock();
  }
}

/**
 * 手動強制設定全域 APP_VERSION
 * @param {string} versionStr 版本字串，如 "v2.0"
 */
function forceSetGlobalVersion(versionStr) {
  if (!versionStr.startsWith("v")) versionStr = "v" + versionStr;
  PropertiesService.getScriptProperties().setProperty("APP_VERSION", versionStr);
  return "全域版本已強制設定為: " + versionStr;
}

/**
 * 檢查各系統快取服務狀態 (V1, Galaxy, Mapping)
 */
function getCacheStatus() {
  try {
    const cache = CacheService.getScriptCache();
    const props = PropertiesService.getScriptProperties();
    
    const checkSystem = (prefix, salt) => {
      const ver = getCacheVersion(salt);
      const ts = cache.get(ver + "_TS");
      let remaining = null;
      if (ts) {
        const elapsed = Math.floor((Date.now() - Number(ts)) / 1000);
        remaining = Math.max(0, 21600 - elapsed);
      }
      return { version: ver.split('_')[0], ok: true, remaining: remaining };
    };

    return {
      v1: checkSystem("V1", "A"),
      galaxy: checkSystem("GALAXY", "P"),
      map: checkSystem("MAP", "MAP"),
      global: props.getProperty("APP_VERSION") || "v1.3"
    };
  } catch (e) {
    return { ok: false, message: e.toString() };
  }
}

/**
 * 系統獨立版本遞增
 */
function incrementSystemVersion(system) {
  const props = PropertiesService.getScriptProperties();
  const verKey = system + "_VERSION";
  let ver = props.getProperty(verKey) || "1.0.0";
  const newVer = incrementSemVer(ver, 'patch');
  props.setProperty(verKey, newVer);
  return newVer;
}

/**
 * 全部重置：清理所有系統快取並重置版本與瀏覽器資料
 */
function resetAllSystems() {
  try {
    const scriptProps = PropertiesService.getScriptProperties();
    const userProps = PropertiesService.getUserProperties();
    
    // 1. 呼叫全域快取清理 (遞增 APP_VERSION 以 Bust 靜態模板快取)
    clearAllCache(false);

    // 2. 清理系統級雜訊屬性 (排除 V1, Galaxy, Map 相關)
    const sKeys = scriptProps.getKeys();
    sKeys.forEach(k => {
      const isGeneric = !k.includes("V1_") && !k.includes("GALAXY_") && !k.includes("MAP_");
      // 清理任務進度與錯誤計數
      if (isGeneric && (k.includes("_JOB") || k.includes("ERR_") || k.includes("PROG_"))) {
        scriptProps.deleteProperty(k);
      }
    });

    // 3. 清理 UserProperties 中的通用快取 (排除權重 WEIGHTS_)
    const uKeys = userProps.getKeys();
    uKeys.forEach(k => {
      const isSystemLogic = k.startsWith("WEIGHTS_") || k.startsWith("A1") || k.startsWith("P1");
      if (!isSystemLogic) {
        userProps.deleteProperty(k);
      }
    });
    
    // 4. 清理 CacheService (全數失效，因為 APP_VERSION 已變)
    CacheService.getScriptCache().removeAll(["APP_VERSION"]);

    // 5. 自動執行系統冗餘屬性清理 (定義於 Index_Server.js)
    if (typeof maintenance_PruneSystemProperties === "function") {
      maintenance_PruneSystemProperties();
    }
    
    return { status: "success", message: "系統核心快取已重置，並完成冗餘屬性清理，已保留預測權重與對照表設定。" };
  } catch (e) {
    return { status: "error", message: e.message };
  }
}

/**
 * 取得系統重置前的版本變更預覽
 * @returns {Object} 包含 current 與 next 版本號
 */
function getResetPreview() {
  const props = PropertiesService.getScriptProperties();
  const current = props.getProperty("APP_VERSION") || "v1.0.0";
  // 配合 resetAllSystems 呼叫 clearAllCache(false) 的邏輯，改為預覽 Minor 遞增
  const next = incrementSemVer(current, 'minor');
  return { current: current, next: next };
}

/**
 * 語義化版本 (SemVer) 遞增工具
 * @param {string} version 當前版本 (例如 "v1.2.3" 或 "1.2")
 * @param {string} type 遞增類型: 'major', 'minor', 'patch'
 * @returns {string} 遞增後的新版本
 */
function incrementSemVer(version, type = 'patch') {
  const isVPrefixed = /^v/i.test(version);
  let cleanVer = version.replace(/^v/i, '');
  let parts = cleanVer.split('.').map(n => parseInt(n, 10) || 0);
  
  // 確保符合 Major.Minor.Patch 結構，若不足則補 0
  while (parts.length < 3) parts.push(0);
  
  let [major, minor, patch] = parts;
  
  if (type === 'major') {
    major++; minor = 0; patch = 0;
  } else if (type === 'minor') {
    minor++; patch = 0;
  } else {
    patch++;
  }
  
  const newVer = `${major}.${minor}.${patch}`;
  return isVPrefixed ? 'v' + newVer : newVer;
}

/**
 *
 * @returns
 */
function includeFooter() {
  return include("Footer");
}

/**
 * 根據傳入的條件物件，取得對應的方法序號 (lngMethodSN)。
 * 若條件組合已存在，則回傳其序號；若不存在，則新增一筆並回傳新序號。
 *
 * @param {object} methodObj 包含搜尋條件的物件，例如：
 *   {
 *     strCompareType: "AND",
 *     FieldMode: false,
 *     strCompares: "", // 可以是字串或字串陣列，例如 "Field1#Field2"
 *     strComparesDetail: "", // 可以是字串或字串陣列，例如 "Value1#Value2"
 *     NextNumsMode: false,
 *     intNextNums: 0,
 *     intNextStep: 0,
     strNextNums: "", // 可以是字串或字串陣列，例如 "1#2#3"
 *     StrNextNumSpe: "", // 可以是字串或字串陣列，例如 "S1#S2"
 *     intDataLimit: 0,
 *     intDataOffset: 0,
 *     intSearchLimit: 0,
 *     intSearchOffset: 0
 *   }
 * @returns {number} 對應的方法序號 lngMethodSN
 */
function getMethodSN(methodObj) {
  const sheetName = "Method";
  const cache = CacheService.getScriptCache();
  const appVersion = getCacheVersion(); // 取得當前應用程式版本號
  const cacheKeyPrefix = appVersion + "_METHOD_SN_";

  let sheet = mainspreadsheet.getSheetByName(sheetName);
  if (!sheet) {
    sheet = mainspreadsheet.insertSheet(sheetName);
    sheet.appendRow([
      "lngMethodSN",
      "strCompareType",
      "FieldMode",
      "strCompares",
      "strComparesDetail",
      "NextNumsMode",
      "intNextNums",
      "intNextStep",
      "strNextNums",
      "StrNextNumSpe",
      "intDataLimit",
      "intDataOffset",
      "intSearchLimit",
      "intSearchOffset",
      "strcheck",
    ]);
    sheet.setFrozenRows(1);
    Logger.log(`[getMethodSN] Created new sheet: ${sheetName}`);
  }

  // 定義用於生成 strcheck 和新行數據的屬性順序
  const orderedPropsForMethod = [
    "strCompareType",
    "FieldMode",
    "strCompares",
    "strComparesDetail",
    "NextNumsMode",
    "intNextNums",
    "intNextStep",
    "strNextNums",
    "StrNextNumSpe",
    "intDataLimit",
    "intDataOffset",
    "intSearchLimit",
    "intSearchOffset",
  ];

  // 輔助函式：將值標準化為字串，用於 strcheck
  const normalizeForStrcheck = (value) => {
    if (typeof value === "boolean") return value ? "true" : "false";
    if (value === null || value === undefined) return "";
    if (Array.isArray(value)) return value.join("#");
    return String(value);
  };

  // 輔助函式：將值標準化為適合試算表儲存的格式
  const normalizeForSheet = (value) => {
    if (Array.isArray(value)) return value.join("#");
    if (value === null || value === undefined) return "";
    return value;
  };

  // 生成 strcheck 字串
  const strcheck = orderedPropsForMethod
    .map((prop) => normalizeForStrcheck(methodObj[prop]))
    .join(",");

  const specificCacheKey = cacheKeyPrefix + strcheck;
  let cachedSN = cache.get(specificCacheKey);
  if (cachedSN) {
    return parseInt(cachedSN, 10);
  }

  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  const strcheckColIdx = headers.indexOf("strcheck");
  const lngMethodSNColIdx = headers.indexOf("lngMethodSN");

  if (strcheckColIdx === -1 || lngMethodSNColIdx === -1) {
    throw new Error(
      `[getMethodSN] Missing required columns in ${sheetName} sheet: 'strcheck' or 'lngMethodSN'.`,
    );
  }

  // 搜尋現有的 strcheck
  for (let i = 1; i < data.length; i++) {
    if (data[i][strcheckColIdx] === strcheck) {
      const existingSN = parseInt(data[i][lngMethodSNColIdx], 10);
      cache.put(specificCacheKey, String(existingSN), 21600); // 快取 6 小時
      return existingSN;
    }
  }

  // 如果找不到，則新增一筆
  let nextLngMethodSN = 1;
  if (data.length > 1) {
    // 從現有數據中找到最大的 lngMethodSN
    const existingSNs = data
      .slice(1)
      .map((row) => parseInt(row[lngMethodSNColIdx], 10))
      .filter((sn) => !isNaN(sn));
    if (existingSNs.length > 0) {
      nextLngMethodSN = Math.max(...existingSNs) + 1;
    }
  }

  const newRow = [nextLngMethodSN];
  orderedPropsForMethod.forEach((prop) => {
    newRow.push(normalizeForSheet(methodObj[prop]));
  });
  newRow.push(strcheck); // 加入生成的 strcheck

  sheet.appendRow(newRow);
  cache.put(specificCacheKey, String(nextLngMethodSN), 21600); // 快取 6 小時
  Logger.log(
    `[getMethodSN] Added new method SN: ${nextLngMethodSN} for strcheck: ${strcheck}`,
  );
  return nextLngMethodSN;
}

/**
 * 輔助函式：產生陣列的所有組合 (C(n, k))
 * @param {Array<any>} arr 原始陣列
 * @param {number} k 組合長度
 * @returns {Array<Array<any>>} 所有組合的陣列
 */
function combinations(arr, k) {
  const result = [];
  if (k < 0 || k > arr.length) {
    return result;
  }
  function backtrack(start, currentCombination) {
    if (currentCombination.length === k) {
      result.push([...currentCombination]);
      return;
    }
    for (let i = start; i < arr.length; i++) {
      currentCombination.push(arr[i]);
      backtrack(i + 1, currentCombination);
      currentCombination.pop();
    }
  }
  backtrack(0, []);
  return result;
}

/**
 * 根據彩種、日期、托牌星數和間隔期數，計算托牌號碼組合。
 * @param {string} lotto 彩種 (e.g., "L539", "L649", "L638", "LSix")
 * @param {Date} date 預測日期
 * @param {number} intNextNums 托牌星數 (k)
 * @param {number} intNextStep 間隔期數
 * @param {object} conditions 比對條件 (Step 1 產生的環境參數)
 * @returns {{strNextNums: string, StrNextNumSpe: string}} 托牌號碼字串和特別號字串
 */
function getNextNum(lotto, date, intNextNums, intNextStep, conditions = {}) {
  let strNextNums = "";
  let StrNextNumSpe = "";

  if (!lotto || !date || intNextNums <= 0 || intNextStep <= 0) {
    return { strNextNums, StrNextNumSpe };
  }

  try {
    const trObj = getTargetsheet("Sheets", lotto);
    const sheet = trObj.spreadsheet.getSheetByName("All");
    if (!sheet) {
      throw new Error(`找不到 ${lotto} 試算表中的 All 工作表`);
    }

    const data = sheet.getDataRange().getValues();
    if (data.length <= 1) {
      return { strNextNums, StrNextNumSpe };
    }

    const headers = data[0];
    const dateColIdx = headers.indexOf("Date");

    // 過濾出早於預測日期且符合條件的資料 (Step 2 邏輯)
    const historicalData = data.slice(1).filter((row) => {
      const rowDate = new Date(row[dateColIdx]);
      if (rowDate.getTime() >= date.getTime()) return false;

      // 檢查欄位比對條件
      for (let field in conditions) {
        const colIdx = headers.indexOf(field);
        if (colIdx === -1) continue;
        // 轉字串比對
        if (String(row[colIdx]) !== String(conditions[field])) return false;
      }
      return true;
    });

    // 取得特定的第 intNextStep 期的資料 (1 代表最近一期，2 代表前二期...)
    const targetIdx = historicalData.length - intNextStep;
    if (targetIdx < 0) {
      return { strNextNums, StrNextNumSpe };
    }
    const row = historicalData[targetIdx];

    const s1ColIdx = headers.indexOf("S1");
    const numbers = [];

    if (lotto === "L638") {
      // Lotto == L638: 所得 N1~N6 的資料，排列組合 C(6, intNextNums)，StrNextNumSpe == S1
      for (let i = 1; i <= 6; i++) {
        const nIdx = headers.indexOf(`N${i}`);
        const num = nIdx !== -1 ? Number(row[nIdx]) : 0;
        if (!isNaN(num) && num > 0) numbers.push(num);
      }
      if (s1ColIdx !== -1) {
        StrNextNumSpe = String(row[s1ColIdx] || "");
      }
    } else {
      // Lotto != L638: 所得 N1~N5, S1 的資料 (以L539為例)，排列組合 C(5, intNextNums)，StrNextNumSpe == ""
      // L539 只會抓到 N1~N5；L649/LSix 會抓到 N1~N5 和 S1
      for (let i = 1; i <= 5; i++) {
        const nIdx = headers.indexOf(`N${i}`);
        const num = nIdx !== -1 ? Number(row[nIdx]) : 0;
        if (!isNaN(num) && num > 0) numbers.push(num);
      }
      if (lotto !== "L539" && s1ColIdx !== -1) {
        const s1Num = Number(row[s1ColIdx]);
        if (!isNaN(s1Num) && s1Num > 0) numbers.push(s1Num);
      }
    }

    if (numbers.length > 0) {
      const allCombinations = combinations(numbers, intNextNums).map((combo) => {
        return combo.sort((a, b) => a - b).join(";");
      });
      strNextNums = allCombinations.join("#");
    }

    return { strNextNums, StrNextNumSpe };
  } catch (e) {
    Logger.log(`[getNextNum Error] ${e.message}`);
    return { strNextNums: "", StrNextNumSpe: "" };
  }
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

/** 檢查是否快要超時 (設定為 290 秒，即接近 5 分鐘，以確保安全) */
function isNearTimeout() {
  return new Date().getTime() - startTime > 290 * 1000;
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
 * 從指定工作表讀取屬性 (鍵值對)
 * @param {string} sheetName 要讀取的工作表名稱 (e.g., "Property", "prct1_Settings")
 * @param {string} key 屬性名稱 (Key)
 * @param {any} defaultValue 預設值 (若找不到或解析失敗則回傳此值)
 * @param {GoogleAppsScript.Spreadsheet.Spreadsheet} targetSs 目標試算表 (若無則使用主表)
 * @returns {any} 屬性值
 */
function getPropertySheetValue(
  sheetName,
  key,
  defaultValue = null,
  targetSs = null,
) {
  const ss = targetSs || mainspreadsheet;
  // 若有指定目標試算表，預設工作表名稱改為 prct1_Property
  const sName = sheetName || (targetSs ? "prct1_Property" : "Property");
  const cache = CacheService.getScriptCache();

  // 1. 優先嘗試讀取特定 Key 的快取 (支援單一物件最高 100KB)
  // 核心修正：如果 sheetName 是 prct1_Property，必須強制指定 targetSs
  if (sheetName === "prct1_Property" && !targetSs) {
    throw new Error(`'prct1_Property' must be accessed with a specific target spreadsheet (targetSs argument is required).`);
  }

  const specificCacheKey = `SHEET_PROP_${ss.getId()}_${sName}_${key}`;
  const cachedVal = cache.get(specificCacheKey);
  if (cachedVal !== null) {
    try {
      return JSON.parse(cachedVal);
    } catch (e) {
      return cachedVal;
    }
  }

  const sheet = ss.getSheetByName(sName);
  if (!sheet) {
    return defaultValue;
  }

  // 2. 嘗試從整張表的快取搜尋 (用於減少試算表 IO)
  const sheetCacheKey = `SHEET_PROP_${ss.getId()}_${sName}`;
  let sheetData = null;
  const cachedSheet = cache.get(sheetCacheKey);
  if (cachedSheet) {
    try {
      sheetData = JSON.parse(cachedSheet);
    } catch (e) {
      sheetData = null;
    }
  }

  if (!sheetData) {
    sheetData = sheet.getDataRange().getValues();
    // 只有在小於 90KB 時才存入整張表快取，避免 CacheService 溢位
    const sheetDataStr = JSON.stringify(sheetData);
    if (sheetDataStr.length < 90000) {
      cache.put(sheetCacheKey, sheetDataStr, 300);
    }
  }

  if (!sheetData || sheetData.length === 0) return defaultValue;

  for (let i = 0; i < sheetData.length; i++) {
    if (String(sheetData[i][0]).trim() === key) {
      const rawValue = sheetData[i][1];

      // 3. 找到資料後，同步回寫特定 Key 快取，方便下次快速讀取
      const stringified =
        typeof rawValue === "object"
          ? JSON.stringify(rawValue)
          : String(rawValue);
      if (stringified.length < 100000) {
        cache.put(specificCacheKey, stringified, 600);
      }

      try {
        return typeof rawValue === "string" ? JSON.parse(rawValue) : rawValue;
      } catch (e) {
        return rawValue;
      }
    }
  }
  return defaultValue;
}

/**
 * 將屬性寫入指定工作表 (鍵值對)
 * @param {string} sheetName 要寫入的工作表名稱 (e.g., "Property", "prct1_Settings")
 * @param {string} key 屬性名稱 (Key)
 * @param {any} value 屬性值 (會自動轉為 JSON 字串)
 * @param {GoogleAppsScript.Spreadsheet.Spreadsheet} targetSs 目標試算表 (若無則使用主表)
 */
function setPropertySheetValue(sheetName, key, value, targetSs = null) {
  const ss = targetSs || mainspreadsheet;
  const sName = sheetName || (targetSs ? "prct1_Property" : "Property");
  let sheet = ss.getSheetByName(sName);
  if (!sheet) {
    // 核心修正：如果 sheetName 是 prct1_Property，必須強制指定 targetSs
    if (sName === "prct1_Property" && !targetSs) {
      throw new Error(`'prct1_Property' must be written to a specific target spreadsheet (targetSs argument is required).`);
    }

    sheet = ss.insertSheet(sName);
    sheet.appendRow(["Key", "Value", "LastUpdated"]); // 初始化標題行
    sheet.setFrozenRows(1);
  }

  const stringValue =
    typeof value === "object" ? JSON.stringify(value) : String(value);

  // 檢查試算表儲存格限制 (50,000 字元)
  if (stringValue.length > 50000) {
    throw new Error(
      `Data too large for Sheet cell: ${stringValue.length} characters.`,
    );
  }

  const data = sheet.getDataRange().getValues();
  const now = new Date();

  for (let i = 0; i < data.length; i++) {
    if (String(data[i][0]).trim() === key) {
      sheet.getRange(i + 1, 2, 1, 2).setValues([[stringValue, now]]);
      // 清除快取，確保下次讀取的是最新值
      CacheService.getScriptCache().remove(
        `SHEET_PROP_${ss.getId()}_${sName}_${key}`,
      );
      CacheService.getScriptCache().remove(`SHEET_PROP_${ss.getId()}_${sName}`);
      return;
    }
  }
  // 如果找不到 key，則新增一行
  sheet.appendRow([key, stringValue, now]);
  CacheService.getScriptCache().remove(
    `SHEET_PROP_${ss.getId()}_${sName}_${key}`,
  );
  CacheService.getScriptCache().remove(`SHEET_PROP_${ss.getId()}_${sName}`);
}

/**
 * 移除指定工作表中的屬性
 * @param {string} sheetName 工作表名稱
 * @param {string} key 屬性名稱
 * @param {GoogleAppsScript.Spreadsheet.Spreadsheet} targetSs 目標試算表
 */
function deletePropertySheetValue(sheetName, key, targetSs = null) {
  const ss = targetSs || mainspreadsheet;
  const sName = sheetName || (targetSs ? "prct1_Property" : "Property");
  const sheet = ss.getSheetByName(sName);
  if (!sheet) return;

  const data = sheet.getDataRange().getValues();
  for (let i = 0; i < data.length; i++) {
    if (data[i][0] === key) {
      sheet.deleteRow(i + 1); // 刪除該行
      CacheService.getScriptCache().remove(`SHEET_PROP_${ss.getId()}_${sName}`);
      CacheService.getScriptCache().remove(
        `SHEET_PROP_${ss.getId()}_${sName}_${key}`,
      );
      return;
    }
  }
}

/**
 * 設定預測進度快取
 * @param {string} lotto 彩種代碼
 * @param {number} percent 百分比 (0-100)
 * @param {string} message 進度描述
 */
function setPredictProgress(lotto, percent, message) {
  const cache = CacheService.getScriptCache();
  const data = JSON.stringify({ percent, message, ts: Date.now() });
  // 快取有效期設定為 2 分鐘，足以支撐單次運算
  cache.put("PROG_" + lotto, data, 120);
}

/**
 * 取得預測進度快取 (供前端輪詢)
 * @param {string} lotto 彩種代碼
 */
function getPredictProgress(lotto) {
  return CacheService.getScriptCache().get("PROG_" + lotto);
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

/**
 * 手動清除伺服器屬性，只保留指定的關鍵屬性。
 * 這有助於清理不再使用的舊屬性，保持 PropertiesService 的整潔。
 */
function clearServerPropertiesManually() {
  const scriptProperties = PropertiesService.getScriptProperties();
  const allProperties = scriptProperties.getProperties();

  const propertiesToKeep = [
    "APP_VERSION",
    "ERR_PREDICT_COUNT",
    "ERR_PREDICT_LAST",
  ];

  for (const key in allProperties) {
    if (allProperties.hasOwnProperty(key) && !propertiesToKeep.includes(key)) {
      scriptProperties.deleteProperty(key);
      Logger.log(`已刪除屬性: ${key}`);
    }
  }
  Logger.log(
    "伺服器屬性清理完成。只保留了 APP_VERSION, ERR_PREDICT_COUNT, ERR_PREDICT_LAST。",
  );
}

/**
 * 全域錯誤追蹤系統
 * @param {string} module 模組名稱
 * @param {Error} error 錯誤物件
 * @param {Object} context 執行上下文 (可選)
 */
function logSystemError(module, error, context = {}) {
  const lock = LockService.getScriptLock();
  try {
    // 獲取鎖定，最多等待 10 秒，避免併發建立工作表或寫入衝突
    lock.waitLock(10000);

    let sheet = mainspreadsheet.getSheetByName("ErrorLog");
    const appVer = getCacheVersion() || "N/A";

    if (!sheet) {
      sheet = mainspreadsheet.insertSheet("ErrorLog");
      sheet.appendRow(["時間", "版本", "模組", "錯誤訊息", "堆疊軌跡", "上下文數據"]);
      sheet.setFrozenRows(1);
    }

    const errMsg = error && error.message ? error.message : String(error);
    const errStack = error && error.stack ? error.stack : "N/A";
    // 確保 Context 包含版本資訊
    const fullContext = Object.assign({ appVersion: appVer }, context);

    sheet.appendRow([
      new Date(),
      appVer,
      module,
      errMsg,
      errStack,
      JSON.stringify(fullContext),
    ]);

    // 強制執行寫入，確保日誌確實存檔
    SpreadsheetApp.flush();
  } catch (e) {
    Logger.log("日誌系統寫入失敗: " + e.toString());
  } finally {
    // 無論成功或失敗都釋放鎖定
    lock.releaseLock();
  }
}

/**
 * 自動清理 ErrorLog 舊數據 (預設保留 30 天)
 * @param {number} daysToKeep 保留天數
 */
function autoCleanupErrorLog(daysToKeep = 30) {
  const sheet = mainspreadsheet.getSheetByName("ErrorLog");
  if (!sheet) return;
  
  const rows = sheet.getLastRow();
  if (rows <= 1) return;
  
  const data = sheet.getRange(2, 1, rows - 1, 1).getValues();
  const now = new Date().getTime();
  const maxAge = daysToKeep * 24 * 60 * 60 * 1000;
  
  let deleteCount = 0;
  // 從後往前刪除，避免索引偏移
  for (let i = data.length - 1; i >= 0; i--) {
    const logDate = new Date(data[i][0]).getTime();
    if (now - logDate > maxAge) {
      sheet.deleteRow(i + 2);
      deleteCount++;
    }
  }
  
  if (deleteCount > 0) {
    Logger.log(`[Cleanup] 已清理 ${deleteCount} 筆過期日誌。`);
  }
}
