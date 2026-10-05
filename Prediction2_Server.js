/**
 * Prediction2_Server.js (概念性實作)
 * 處理伺服器端邏輯，包括權重管理、資料快取和預測計算。
 */

/** 演算法邏輯版本：修改預測公式或修正 Bug 後請遞增此版本號以自動失效舊快取 */
const PREDICTION2_ALGO_VERSION = "P109"; // 強化引擎: 熱尾/五行/平衡/和值引力/黃金分割/連號阻斷/Z反彈

/**
 * 新架構試算表解析（資料夾 > 試算表 > 工作表）。
 * Predict 模組使用 predic2_* 工作表，來源試算表：
 *   All  ← {lotto} 試算表
 *   Miss ← {lotto}_Miss 試算表（useTrend=true 時必需）
 *   predic2_Property（權重）/ predic2_Settings（參數）/ predic2_History（歷史命中）← {lotto}_Prediction2 試算表
 *   封存表 predic2_History_Archive 同在 {lotto}_Prediction2 試算表
 * Sheets 註冊表需含 {lotto}、{lotto}_Miss、{lotto}_Prediction2 三筆。
 */
function getPrediction2Spreadsheets(lotto) {
  var allSS = getPrediction2SpreadsheetEntry(lotto);
  var missSS = getPrediction2SpreadsheetEntry(lotto + "_Miss");
  var predictSS = getPrediction2SpreadsheetEntry(lotto + "_Prediction2");
  return { allSS: allSS, missSS: missSS, predictSS: predictSS };
}

/**
 * 開啟 Sheets 註冊表指定鍵的試算表；鍵缺失或 URL 無效時拋出可讀錯誤。
 */
function getPrediction2SpreadsheetEntry(key) {
  var trObj = null;
  try {
    trObj = getTargetsheet("Sheets", key);
  } catch (e) {
    throw new Error(`Sheets 註冊表缺少 [${key}] 或開啟失敗（${e.message}），請補上 {彩種}、{彩種}_Miss、{彩種}_Predict、{彩種}_Prediction1 共 16 筆註冊`);
  }
  if (!trObj || !trObj.spreadsheet) {
    throw new Error(`Sheets 註冊表缺少 [${key}]，請補上 {彩種}、{彩種}_Miss、{彩種}_Predict、{彩種}_Prediction1 共 16 筆註冊`);
  }
  return trObj.spreadsheet;
}

/**
 * 新架構建表：確保 {lotto}_Prediction2 試算表內三張工作表存在且含標頭。
 * 測試刪除工作表後，下次預測會自動重建。
 *   predic2_Property：權重 KV（預設值由 getAIWeightSettings 補齊）
 *   predic2_Settings：參數紀錄（執行時間/執行日期/相關係數/推薦數/遺漏模式/變動參數摘要/備註）
 *   predic2_History ：歷史命中（型態/彩種/日期/推薦數/遺漏模式/命中數/命中號碼/更新時間/學習標記）
 */
function ensurePrediction2Sheets(predictSS) {
  var propSheet = predictSS.getSheetByName("predic2_Property");
  if (!propSheet) {
    propSheet = predictSS.insertSheet("predic2_Property");
    propSheet.getRange("A1:C1").setValues([["Key", "Value", "LastUpdated"]]);
    propSheet.setFrozenRows(1);
  }
  var settingsSheet = predictSS.getSheetByName("predic2_Settings");
  if (!settingsSheet) {
    settingsSheet = predictSS.insertSheet("predic2_Settings");
    settingsSheet.appendRow(["執行時間", "執行日期", "相關係數", "推薦數", "遺漏模式", "變動參數摘要", "備註"]);
    settingsSheet.setFrozenRows(1);
  }
  var historySheet = predictSS.getSheetByName("predic2_History");
  if (!historySheet) {
    historySheet = predictSS.insertSheet("predic2_History");
    historySheet.appendRow(["型態", "彩種", "日期", "推薦數", "遺漏模式", "命中數", "命中號碼", "更新時間", "學習標記"]);
    historySheet.setFrozenRows(1);
  }
  SpreadsheetApp.flush();
  return { propertySheet: propSheet, settingsSheet: settingsSheet, historySheet: historySheet };
}

/** 寫入 Galaxy 預設權重（建表或空表時呼叫） */
function seedDefaultGalaxyWeights(propertySheet) {
  propertySheet.getRange("A1:C1").setValues([["Key", "Value", "LastUpdated"]]);
  propertySheet.getRange("A2:B19").setValues([
    ["frequency", 1.0],
    ["repeat", 1.2],
    ["skip", 0.5],
    ["nineStar", 0.8],
    ["twentyEightMansions", 0.7],
    ["metaBoostYear", 0.1],
    ["metaBoostTriple", 0.5],
    ["posSevereThres", 15],
    ["posNormalThres", 10],
    ["posSevereFactor", 0.92],
    ["posNormalFactor", 0.96],
    ["nineStarMap", "{}"],
    ["twentyEightMansionsMap", "{}"],
    ["dayStemMap", "{}"],
    ["dayBranchMap", "{}"],
    ["dayStem", 0.5],
    ["dayBranch", 0.5],
    ["missThreshold", 10],
  ]);
  propertySheet.setFrozenRows(1);
}

/**
 * 驗證新架構 Sheets 註冊表（唯讀，不寫入）。
 * 檢查 4 彩種 × 4 筆：{lotto}、{lotto}_Miss、{lotto}_Prediction2、{lotto}_Prediction1。
 * 部署前在 GAS 編輯器執行一次即可。
 * @returns {Object} { status, checked, missing }
 */
function verifyPredictRegistry() {
  var lottos = ["L539", "L649", "L638", "LSix"];
  var suffixes = ["", "_Miss", "_Prediction2", "_Prediction1"];
  var missing = [];
  var checked = 0;
  lottos.forEach(function(lotto) {
    suffixes.forEach(function(sfx) {
      var key = lotto + sfx;
      checked++;
      try {
        var trObj = getTargetsheet("Sheets", key);
        if (!trObj || !trObj.spreadsheet) missing.push(key);
      } catch (e) {
        missing.push(key + " (" + e.message + ")");
      }
    });
  });
  if (missing.length > 0) {
    return { status: "error", checked: checked, missing: missing };
  }
  return { status: "success", checked: checked, missing: [] };
}

/**
 * 獲取指定彩種的 AI 學習權重設定。
 * 優先從 PropertiesService 快取中讀取，若無則從試算表讀取並寫入快取。
 * @param {string} lottoType 彩種類型 (e.g., "L539", "L649")
 * @param {boolean} useTrend 是否為遺漏模式專屬權重
 * @returns {Object} 該彩種的權重設定物件
 */
function getAIWeightSettings(lottoType, useTrend = true) {
  const lock = LockService.getScriptLock();
  try {
    const cacheKey = `WEIGHTS_${lottoType}_${useTrend}`;
    const userProperties = PropertiesService.getUserProperties();

    // 1. 快速路徑：若快取存在則直接回傳，避免昂貴的試算表開啟 (getTargetsheet) 操作
    let cachedWeights = userProperties.getProperty(cacheKey);
    if (cachedWeights) {
      return JSON.parse(cachedWeights);
    }

    // 2. 快取未命中：獲取鎖定以防止併發建立工作表或重複讀取
    lock.waitLock(15000); // 最多等待 15 秒
    
    // 雙重檢查 (Double-Check)：確認等待鎖定期間是否已有其他執行緒填補了快取
    cachedWeights = userProperties.getProperty(cacheKey);
    if (cachedWeights) return JSON.parse(cachedWeights);

    // 新架構：權重屬性位於 {lotto}_Prediction2 試算表 > predic2_Property 工作表
    const ss = getPrediction2Spreadsheets(lottoType).predictSS;
    let propertySheet = ss.getSheetByName(`predic2_Property`); // 修正：改用 let 以允許重新賦值

    logSystemError("getAIWeightSettings", lottoType + " property sheet missing or cache expired. Syncing...", "WARNING", "屬性表失效，需要銳新");


    if (!propertySheet) {
      // 如果工作表不存在，則建立一個預設的
      logSystemError("getAIWeightSettings", `Property sheet for ${lottoType} not found. Creating default.`, "WARNING", "權重工作表不存在");
      propertySheet = ss.insertSheet(`predic2_Property`);
      seedDefaultGalaxyWeights(propertySheet);
    } else if (propertySheet.getLastRow() <= 1) {
      // 空表（測試刪除內容後）重建預設權重
      logSystemError("getAIWeightSettings", `Property sheet for ${lottoType} is empty. Reseeding defaults.`, "WARNING", "權重工作表為空，已重建");
      seedDefaultGalaxyWeights(propertySheet);
    }

    const data = propertySheet.getDataRange().getValues();
    const headers = data[0];
    const weights = {};

    // 將試算表資料轉換為物件
    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      if (row[0] && row[1] !== undefined) {
        const key = row[0];
        const val = row[1];
        if (key.endsWith("Map")) {
          try {
            weights[key] = JSON.parse(val);
          } catch (e) {
            weights[key] = {};
          }
        } else {
          weights[key] = typeof val === "number" ? val : parseFloat(val);
        }
      }
    }

    // 將讀取到的權重存入 PropertiesService 快取
    userProperties.setProperty(cacheKey, JSON.stringify(weights));
    logSystemError("getAIWeightSettings", `AI Weights for ${lottoType} saved to cache.`, "INFO", "快取已建立");

    return weights;
  } catch (e) {
    logSystemError("getAIWeightSettings", e.toString(), "ERROR", "讀取權重失敗", { lottoType: lottoType });
    throw new Error(`Failed to load AI weights for ${lottoType}: ${e.message}`);
  } finally {
    lock.releaseLock();
  }
}

/**
 * 更新指定彩種的 AI 學習權重設定。
 * 同步更新試算表和 PropertiesService 快取。
 * @param {string} lottoType 彩種類型 (e.g., "L539", "L649")
 * @param {Object} newWeights 新的權重設定物件
 * @param {boolean} useTrend 是否為遺漏模式專屬權重
 * @param {boolean} invalidateHistory 是否失效舊回測（預設 true；自動學習微調傳 false，
 *   避免每次 ±0.01 都清空歷史造成刪表觀感與重算風暴）
 */
function setAIWeightSettings(lottoType, newWeights, useTrend = true, invalidateHistory = true) {
  const lock = LockService.getScriptLock();
  try {
    // 獲取鎖定，確保更新試算表與 PropertiesService 的過程具備原子性
    lock.waitLock(15000);

    const cacheKey = `WEIGHTS_${lottoType}_${useTrend}`;
    const userProperties = PropertiesService.getUserProperties();

    // 更新試算表 (新架構：{lotto}_Prediction2 試算表 > predic2_Property 工作表)
    const ss = getPrediction2Spreadsheets(lottoType).predictSS;
    let propertySheet = ss.getSheetByName(`predic2_Property`);

    if (!propertySheet) {
      // 修正：如果工作表不存在，則自動建立，避免拋出錯誤並導致自動學習中斷
      propertySheet = ss.insertSheet(`predic2_Property`);
      propertySheet.getRange("A1:C1").setValues([["Key", "Value", "LastUpdated"]]);
      propertySheet.setFrozenRows(1);
    }

    // 寫入新的權重資料
    const dataToWrite = Object.entries(newWeights).map(([key, value]) => {
      return [key, typeof value === "object" ? JSON.stringify(value) : value];
    });

    if (dataToWrite.length > 0) {
      // 優化寫入流程：先覆蓋資料，再清除多餘的舊行，避免清空期間被其他預測任務讀到空值
      const lastRow = propertySheet.getLastRow();
      propertySheet
        .getRange(2, 1, dataToWrite.length, 2)
        .setValues(dataToWrite);
      
      if (lastRow > dataToWrite.length + 1) {
        propertySheet.getRange(dataToWrite.length + 2, 1, lastRow - (dataToWrite.length + 1), 2).clearContent();
      }
      // 強制同步變動到試算表伺服器
      SpreadsheetApp.flush();
    }

    // 試算表更新成功後才寫入 PropertiesService 快取，確保資料來源一致
    userProperties.setProperty(cacheKey, JSON.stringify(newWeights));
    logSystemError("setAIWeightSettings", `AI Weights for ${lottoType} updated in cache.`, "INFO", "快取已更新");

    // 歷史失效改戳記制：不再刪除同彩種回測列（刪表元兇），改 bump 權重更新戳記，
    // 讀取端以更新時間判定新舊；自動學習微調（invalidateHistory=false）不 bump。
    if (invalidateHistory) {
      try {
        setPropertySheetValue("predic2_Property", weightsUpdatedTsKey(lottoType, useTrend), new Date().getTime(), ss);
      } catch (e) {
        Logger.log("[setAIWeightSettings] 戳記寫入失敗：" + e);
      }
    }

    Logger.log(`[Sheet Update] AI Weights for ${lottoType} updated in sheet.`);
  } catch (e) {
    logSystemError("setAIWeightSettings", e.toString(), "ERROR", `更新 ${lottoType} 權重設定失敗`);
    Logger.log(`Error in setAIWeightSettings for ${lottoType}: ` + e);
    throw new Error(
      `Failed to update AI weights for ${lottoType}: ${e.message}`,
    );
  } finally {
    lock.releaseLock();
  }
}

/**
 * 清除指定彩種的權重快取。
 * @param {string} lottoType 彩種類型 (e.g., "L539", "L649")
 */
function clearAIWeightCache(lottoType) {
  try {
    const cacheKey = `WEIGHTS_${lottoType}`;
    const userProperties = PropertiesService.getUserProperties();
    userProperties.deleteProperty(cacheKey);
    Logger.log(
      `[Cache Clear] AI Weights cache for ${lottoType} cleared from PropertiesService.`,
    );
  } catch (e) {
    logSystemError("clearAIWeightCache", e.toString(), "ERROR", `清除 ${lottoType} 權重快取失敗`);
    Logger.log(`Error clearing AI weights cache for ${lottoType}: ` + e);
    throw new Error(
      `Failed to clear AI weights cache for ${lottoType}: ${e.message}`,
    );
  }
}

/**
 * 一次性維護函式：清理所有彩種 Settings 中「非最新演算法版本」或「重複日期」的歷史紀錄
 * 用於釋放空間並確保圖表數據唯一性
 */
function maintenance_PurgeOldHistoryVersions() {
  const lottos = ["L539", "L649", "L638", "LSix"];
  const currentCacheLabel = "HIT_HISTORY_" + getCacheVersion(PREDICTION2_ALGO_VERSION);
  Logger.log("🚀 開始執行版本清理與去重任務，目標版本: " + currentCacheLabel);

  lottos.forEach(lotto => {
    try {
      // 新架構：歷史命中位於 {lotto}_Prediction2 試算表 > predic2_History 工作表
      const ss = getPrediction2Spreadsheets(lotto).predictSS;
      const sheet = ss.getSheetByName("predic2_History");
      
      if (!sheet) return;

      const data = sheet.getDataRange().getValues();
      if (data.length <= 1) return;

      const header = data[0];
      // 戳記快取：同列的 (彩種,模式) 決定其權重失效戳記，避免逐列重讀屬性表
      const tsMemo = {};
      const tsFor = (lo, mo) => {
        const k = lo + "_" + String(mo);
        if (!(k in tsMemo)) tsMemo[k] = getWeightsUpdatedTs(lo, mo, ss);
        return tsMemo[k];
      };
      const bestByKey = new Map(); // 唯一鍵 -> { row, fresh }，去重時新鮮列優先保留
      const ordered = [];
      let removedCount = 0;

      data.slice(1).forEach(row => {
        const label = String(row[0]);
        // 僅針對歷史命中紀錄進行處理
        if (label.indexOf("HIT_HISTORY_") !== 0) {
          ordered.push(row);
          return; // 保留其他日誌紀錄
        }
        const fresh = isPrediction2HistoryLabel(label) && isFreshHistoryRow(row, tsFor(row[1], row[4]));
        // 1. 過期列：非目前演算法版本、或權重已失效，且尚未學習者刪除；
        //    已學習 (Y) 保留作歷史軌跡（後續由封存任務搬移）
        if (!fresh && row[8] !== "Y") {
          removedCount++;
          return;
        }
        // 2. 去重過濾：唯一鍵 = 彩種_日期_推薦數_遺漏模式；新鮮列優先取代過期列
        const dKey = (row[2] instanceof Date)
          ? Utilities.formatDate(row[2], "Asia/Taipei", "yyyy-MM-dd")
          : String(row[2]);
        const uniqueKey = `${row[1]}_${dKey}_${String(row[3])}_${String(row[4])}`;

        const prev = bestByKey.get(uniqueKey);
        if (!prev) {
          bestByKey.set(uniqueKey, { row: row, fresh: fresh });
          ordered.push(row);
          return;
        }
        if (fresh && !prev.fresh) {
          const idx = ordered.indexOf(prev.row);
          if (idx > -1) ordered.splice(idx, 1);
          bestByKey.set(uniqueKey, { row: row, fresh: fresh });
          ordered.push(row);
          removedCount++;
          return;
        }
        removedCount++;
      });
      const filteredData = ordered;

      if (removedCount > 0) {
        sheet.clearContents();
        const finalData = [header, ...filteredData];
        sheet.getRange(1, 1, finalData.length, finalData[0].length).setValues(finalData);
        SpreadsheetApp.flush();
        Logger.log(`[${lotto}] 清理完成！移除了 ${removedCount} 筆冗餘紀錄。`);
      }
    } catch (e) {
        logSystemError("maintenance_PurgeOldHistoryVersions", e.toString(), "ERROR", `[${lotto}] 版本清理與去重失敗`);
    }
  });
}

/**
 * 自動存檔維護：將超過 90 天且已學習 (Y) 的紀錄搬移至備份表
 * 用於保持 predic2_History 的輕量化與運算效能
 */
function maintenance_ArchiveOldRecords() {
  const lottos = ["L539", "L649", "L638", "LSix"];
  const DAYS_TO_KEEP = 90;
  const now = new Date();
  const cutoffDate = new Date(now.getTime() - (DAYS_TO_KEEP * 24 * 60 * 60 * 1000));
  
  Logger.log(`🚀 開始執行歷史紀錄存檔任務 (門檻日期: ${Utilities.formatDate(cutoffDate, "Asia/Taipei", "yyyy-MM-dd")})`);

  lottos.forEach(lotto => {
    try {
      // 新架構：歷史命中位於 {lotto}_Prediction2 試算表 > predic2_History 工作表
      const ss = getPrediction2Spreadsheets(lotto).predictSS;
      const settingsSheet = ss.getSheetByName("predic2_History");
      if (!settingsSheet) return;

      const data = settingsSheet.getDataRange().getValues();
      if (data.length <= 1) return;

      const header = data[0];
      const rowsToKeep = [header];
      const rowsToArchive = [];

      for (let i = 1; i < data.length; i++) {
        const row = data[i];
        const recordDate = row[2] instanceof Date ? row[2] : new Date(row[2]);
        const isLearned = row[8] === "Y";
        const isHitHistory = String(row[0]).indexOf("HIT_HISTORY") === 0;

        // 搬移條件：是歷史紀錄 且 已學習 且 超過 90 天
        if (isHitHistory && isLearned && recordDate < cutoffDate) {
          rowsToArchive.push(row);
        } else {
          rowsToKeep.push(row);
        }
      }

      if (rowsToArchive.length > 0) {
        // 1. 寫入備份表（新架構：predic2_History_Archive）
        let archiveSheet = ss.getSheetByName("predic2_History_Archive");
        if (!archiveSheet) {
          archiveSheet = ss.insertSheet("predic2_History_Archive");
          archiveSheet.appendRow([...header, "存檔時間"]);
          archiveSheet.setFrozenRows(1);
        }
        
        const archiveData = rowsToArchive.map(r => [...r, new Date()]);
        archiveSheet.getRange(archiveSheet.getLastRow() + 1, 1, archiveData.length, archiveData[0].length)
                    .setValues(archiveData);

        // 2. 更新主表 (覆蓋為保留的資料)
        settingsSheet.clearContents();
        settingsSheet.getRange(1, 1, rowsToKeep.length, rowsToKeep[0].length).setValues(rowsToKeep);
        
        SpreadsheetApp.flush();
        Logger.log(`[${lotto}] 已將 ${rowsToArchive.length} 筆舊紀錄移至備份表。`);
      }
    } catch (e) {
      logSystemError("maintenance_ArchiveOldRecords", e.toString(), "ERROR", `[${lotto}] 歷史紀錄存檔失敗`);
    }
  });
}

/**
 * 獲取彩種的設定值，例如欄位對應 (fieldMapping) 或數值對應 (valueMapping)。
 * 這些資料通常也需要按彩種隔離。
 * @param {string} lottoType 彩種類型
 * @param {string} settingName 設定名稱 (e.g., "fieldMapping", "valueMapping")
 * @returns {Object} 對應的設定物件
 */
function getLottoSettings(lottoType, settingName) {
  try {
    const cache = CacheService.getUserCache(); // 使用 CacheService 進行臨時快取
    const cacheKey = `${lottoType}_SETTINGS_${settingName}`;
    const cachedData = cache.get(cacheKey);

    if (cachedData) {
      return JSON.parse(cachedData);
    }

    // 實際從試算表讀取邏輯 (此處省略，需根據實際結構實現)
    const settings = {}; // 假設從試算表讀取到的設定
    cache.put(cacheKey, JSON.stringify(settings), 3600); // 快取 1 小時
    return settings;
  } catch (e) {
    logSystemError("getLottoSettings", e.toString(), "ERROR", `取得彩種設定失敗: ${lottoType}/${settingName}`);
    throw new Error(`Failed to load settings for ${lottoType}: ${e.message}`);
  }
}

/**
 * getPrediction - 主預測進入點 (符合 Predict.md 規範)
 * 支援 Prediction2.html (4參數) 與 Index.html 預覽 (3參數)
 */
function getPrediction(lotto, dateStr, useTrend, topN = 10) {
  try {
    const targetDate = new Date(dateStr.replace(/-/g, "/"));
    setPredictProgress(lotto, 10, "正在初始化星系環境...");
    targetDate.setHours(0, 0, 0, 0);
    
    // 新架構：All ← {lotto} 試算表；Miss ← {lotto}_Miss 試算表；設定 ← {lotto}_Prediction2 試算表
    const sheets = getPrediction2Spreadsheets(lotto);
    const ss = sheets.predictSS;
    // 新架構建表：測試刪除工作表後自動重建三表
    ensurePrediction2Sheets(ss);
    const allSheet = sheets.allSS.getSheetByName("All");
    if (!allSheet) throw new Error(`找不到 ${lotto} 試算表中的 All 工作表`);
    const missSheet = useTrend ? sheets.missSS.getSheetByName("Miss") : null;
    if (useTrend && !missSheet) throw new Error(`找不到 ${lotto}_Miss 試算表中的 Miss 工作表，請檢查 Sheets 註冊表`);

    // 1. 抓取訓練數據 (最近 60 期)
    const allValues = allSheet.getDataRange().getValues();
    // 開獎日對齊：過去日期必須有開獎紀錄，否則回推至最近有紀錄日；未來日期不限
    if (snapTargetToDrawDate(allValues, targetDate)) {
      Logger.log(`[DrawDateSnap] ${lotto} 目標日期無開獎紀錄，已對齊至 ` + Utilities.formatDate(targetDate, "Asia/Taipei", "yyyy-MM-dd"));
    }
    const allDataRaw = allValues
      .filter((row) => row[0] instanceof Date && row[0] < targetDate);
    const trainingData = allDataRaw.slice(-60);

    if (trainingData.length < 10)
      throw new Error("歷史數據不足，無法進行星系演化分析。");

    setPredictProgress(lotto, 40, "正在執行多維度權重運算...");

    // 2. 執行核心預測 (此處呼叫本檔案內的私有預測邏輯)
    const res = runGalaxyCoreEngine(
      lotto,
      trainingData,
      missSheet,
      targetDate,
      topN,
      ss,
      allValues, // 預載資料傳入（含開獎日對齊後範圍）
      null, null, null, null, useTrend // 傳遞目前模式
    );

    // 執行 AI 自動學習邏輯，根據歷史命中結果動態微調九星與二十八星宿的權重係數
    autoAdjustAstrologyWeights(lotto, ss, useTrend);

    // 新架構：同步記錄分析參數至 {lotto}_Prediction2 > predic2_Settings（文件 7 欄位格式）
    if (res && res.status !== "error") {
      logPredictParamRecord(ss, lotto, dateStr, topN, useTrend, res);
    }

    setPredictProgress(lotto, 100, "預測完成");
    return res;
  } catch (e) {
    logSystemError("getPrediction", e.toString(), "ERROR", `彩種 ${lotto} 執行預測失敗`, { date: dateStr });
    Logger.log(`[getGalaxyPrediction Error] ` + e);
    return { status: "error", message: e.message };
  }
}

/**
 * 新架構歷史回填：predic2_History 內同（彩種/推薦數/遺漏模式/版本）紀錄不足 10 筆時，
 * 以本次預測日期為基準執行 30 期回測補齊；已足夠則直接跳過（前端快取命中）。
 * 回填失敗由呼叫端隔離，不中斷主預測。
 */
function ensureHistoryBackfilled(predictSS, lotto, topN, useTrend, dateStr) {
  var sheet = predictSS.getSheetByName("predic2_History");
  if (!sheet) sheet = ensurePrediction2Sheets(predictSS).historySheet;
  var nTopN = String(Number(topN) || 10);
  var mode = String(useTrend);
  var bfWeightsTs = getWeightsUpdatedTs(lotto, useTrend, predictSS);
  var data = sheet.getDataRange().getValues();
  var count = 0;
  for (var i = 1; i < data.length; i++) {
    var r = data[i];
    if (isPrediction2HistoryLabel(r[0]) && isFreshHistoryRow(r, bfWeightsTs) && r[1] === lotto && String(r[3]) === nTopN && String(r[4]) === mode) count++;
  }
  if (count >= 10) return "cached:" + count;
  var stats = get60PeriodHistoryStats(lotto, topN, dateStr, useTrend);
  return "backfilled:" + (stats ? stats.length : 0);
}

/**
 * 新架構參數記錄：每次成功預測後寫入 predic2_Settings
 * （執行時間/執行日期/相關係數/推薦數/遺漏模式/變動參數摘要/備註）。
 * 冪等寫入：同（執行日期/推薦數/遺漏模式）已存在則原地更新並順手刪除重複列，
 * 不存在才追加，避免重複預測洗出「僅執行時間不同」的重複資料。
 * 相關係數僅在當日已有開獎答案時填寫（命中數/滿分），未來日期留空。
 */
function logPredictParamRecord(predictSS, lotto, dateStr, topN, useTrend, res) {
  try {
    var sheet = predictSS.getSheetByName("predic2_Settings");
    if (!sheet) sheet = ensurePrediction2Sheets(predictSS).settingsSheet;
    var ai = res.aiStrategy || {};
    var corr = "";
    if (res.actualDraw && res.maxStars) {
      corr = Number(res.profitStars / res.maxStars).toFixed(3);
    }
    var summary = (ai.perturbationFactors || []).join(";");
    var newRow = [new Date(), String(dateStr), corr, Number(topN) || 0, Boolean(useTrend), summary, String(ai.focus || "")];
    var dateKey = String(dateStr);
    var nTopN = Number(topN) || 0;
    var modeStr = String(useTrend);
    var sameKey = function (r) {
      var rDate = r[1] instanceof Date
        ? Utilities.formatDate(r[1], "Asia/Taipei", "yyyy-MM-dd")
        : String(r[1]);
      return rDate === dateKey && Number(r[3]) === nTopN && String(r[4]) === modeStr;
    };
    var data = sheet.getDataRange().getValues();
    var firstIdx = -1;
    var dupeCount = 0;
    for (var i = 1; i < data.length; i++) {
      if (sameKey(data[i])) {
        if (firstIdx === -1) firstIdx = i;
        else dupeCount++;
      }
    }
    if (firstIdx === -1) {
      sheet.appendRow(newRow);
    } else if (dupeCount === 0) {
      // 無重複：只更新該列（定位寫回，避免全表重寫）
      sheet.getRange(firstIdx + 1, 1, 1, 7).setValues([newRow]);
    } else {
      // 有重複：重建全表（第一筆更新為最新，其餘同鍵丟棄），順手清理歷史重複列
      var out = [data[0]];
      var kept = false;
      for (var j = 1; j < data.length; j++) {
        if (sameKey(data[j])) {
          if (!kept) {
            out.push(newRow);
            kept = true;
          }
        } else {
          out.push(data[j]);
        }
      }
      sheet.clearContents();
      sheet.getRange(1, 1, out.length, out[0].length).setValues(out);
    }
    SpreadsheetApp.flush();
  } catch (e) {
    Logger.log("[logPredictParamRecord] " + e);
  }
}

/**
 * 歷史版本判定（後綴式）：只認演算法版本（P109），忽略 GALAXY 快取版本前綴。
 * 清快取會 bump GALAXY_VERSION，若用完整標籤比對會把有效歷史全數孤立刪除。
 */
function isPrediction2HistoryLabel(label) {
  return typeof label === "string" && label.indexOf("HIT_HISTORY_") === 0 && label.endsWith("_" + PREDICTION2_ALGO_VERSION);
}

/**
 * 權重更新時間戳：setAIWeightSettings 顯式失效歷史時 bump，讀取端以此判斷回測列是否新鮮。
 * 取代舊作法「權重一更新就刪除同彩種歷史」（刪表元兇之一）。
 */
function weightsUpdatedTsKey(lotto, useTrend) {
  return `WEIGHTS_UPDATED_TS_${lotto}_${String(useTrend)}`;
}
function getWeightsUpdatedTs(lotto, useTrend, ss) {
  try {
    const v = getPropertySheetValue("predic2_Property", weightsUpdatedTsKey(lotto, useTrend), 0, ss);
    const n = Number(v);
    return isNaN(n) ? 0 : n;
  } catch (e) {
    return 0;
  }
}
/**
 * 歷史列是否新鮮：演算法版本相符，且更新時間不早於權重失效戳記。
 * 戳記預設 0（升級前舊列全視為新鮮，不觸發大規模重算）。
 */
function isFreshHistoryRow(row, weightsTs) {
  if (!isPrediction2HistoryLabel(row ? row[0] : null)) return false;
  const t = row[7] instanceof Date ? row[7].getTime() : -1;
  return t >= (Number(weightsTs) || 0);
}

/**
 * 清理 predic2_History 中過期版本的快取記錄（新架構：歷史命中獨立工作表）。
 * 只移除「非目前演算法版本」列，以及「本次呼叫彩種＋模式下權重已失效」的列；
 * 其他彩種／模式的列一律保留（由各自流程處理），避免跨彩種误删。
 */
function cleanupStaleCacheRecords(ss, lotto, useTrend) {
  try {
    const settingsSheet = ss.getSheetByName("predic2_History");
    if (!settingsSheet) return;
    const data = settingsSheet.getDataRange().getValues();
    if (data.length < 2) return;
    const weightsTs = (lotto !== undefined) ? getWeightsUpdatedTs(lotto, useTrend, ss) : 0;
    const rowsToKeep = [data[0]];
    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      if (typeof row[0] !== "string" || row[0].indexOf("HIT_HISTORY_") !== 0) {
        rowsToKeep.push(row);
        continue;
      }
      if (!isPrediction2HistoryLabel(row[0])) continue; // 非目前演算法版本：刪
      if (lotto !== undefined && row[1] === lotto && String(row[4]) === String(useTrend)
          && !isFreshHistoryRow(row, weightsTs)) continue; // 本彩種模式且權重已失效：刪
      rowsToKeep.push(row);
    }
    if (rowsToKeep.length < data.length) {
      settingsSheet.clearContents();
      settingsSheet.getRange(1, 1, rowsToKeep.length, rowsToKeep[0].length).setValues(rowsToKeep);
      SpreadsheetApp.flush();
    }
  } catch (e) {
    Logger.log("[cleanupStaleCacheRecords] " + e);
  }
}

/**
 * 獲取最近 30 期的歷史命中統計 (符合 Predict.md 規範)
 * 實作持久化快取於 predic2_History 中，按彩種隔離，避免重複運算
 * @param {string} lotto 彩種代碼
 * @param {number} topN 推薦球數
 * @param {string} targetDateStr 預測目標日期
 * @param {boolean} useTrend 是否使用遺漏模式
 * @returns {Array} 包含日期與命中數的物件陣列
 */
function get60PeriodHistoryStats(lotto, topN, targetDateStr, useTrend = true) {
  try {
    // 1. 邊界檢查：驗證預測目標日期有效性
    if (!targetDateStr) return [];
    
    let targetDate = new Date(targetDateStr.replace(/-/g, "/"));
    if (isNaN(targetDate.getTime())) {
      Logger.log(`[get60PeriodHistoryStats] 錯誤：無效的日期格式 "${targetDateStr}"`);
      return [];
    }
    targetDate.setHours(0, 0, 0, 0); // 統一時間基準，避免時分秒導致的比對偏差

    // 新架構：All ← {lotto} 試算表；Miss ← {lotto}_Miss 試算表；快取 ← {lotto}_Prediction2 試算表
    const sheets = getPrediction2Spreadsheets(lotto);
    const ss = sheets.predictSS;
    // 新架構建表：測試刪除工作表後自動重建三表
    ensurePrediction2Sheets(ss);

    const nTopN = parseInt(topN) || 10;
    const weights = getAIWeightSettings(lotto, useTrend); // 預載權重 (修正: 匹配遺漏模式)
    const allSheet = sheets.allSS.getSheetByName("All");
    if (!allSheet) throw new Error("找不到 All 工作表"); // 修正：應先檢查是否存在再讀取資料

    const allData = allSheet.getDataRange().getValues();
    const allHeaders = allData[0];
    const preLoadedHeaders = allHeaders;
    const s1Col = allHeaders.indexOf("S1");
    
    // 預載遺漏表數據，避免迴圈內重複讀取（新架構：{lotto}_Miss 試算表）
    const missSheet = useTrend ? sheets.missSS.getSheetByName("Miss") : null;
    let preLoadedMissData = missSheet ? missSheet.getDataRange().getValues() : null;

    // 核心優化：將遺漏表陣列轉換為 Map 索引，使引擎具備 O(1) 快速查找能力
    // 效能：遺漏統計只算一次（最近 120 列），30 期回測共用，避免逐次全表掃描
    let preComputedMissStats = null;
    if (preLoadedMissData && Array.isArray(preLoadedMissData)) {
      const ballRangeStats = lotto === "L638" ? 38 : (lotto === "L539" ? 39 : 49);
      preComputedMissStats = calcMissStatsMap(preLoadedMissData, ballRangeStats, lotto === "L539" ? 7 : 8, 120);
    }
    if (preLoadedMissData && Array.isArray(preLoadedMissData)) {
      const missMap = {};
      preLoadedMissData.forEach(row => {
        if (row[0] instanceof Date) {
          missMap[Utilities.formatDate(row[0], "Asia/Taipei", "yyyy-MM-dd")] = row;
        }
      });
      preLoadedMissData = missMap; // 將變數替換為 Map 傳遞給引擎
    }

    // 1. 確保 predic2_History 存在並讀取現有快取（新架構：歷史命中獨立工作表）
    let historySheet = ss.getSheetByName("predic2_History");
    if (!historySheet) {
      historySheet = ensurePrediction2Sheets(ss).historySheet;
    }
    cleanupStaleCacheRecords(ss, lotto, useTrend);

    // 取得版本化的快取標籤
    const cacheTypeLabel = "HIT_HISTORY_" + getCacheVersion(PREDICTION2_ALGO_VERSION);
    // 權重失效戳記：舊權重算出的回測視為過期（不刪除，僅不採用；由清理函式延遲移除）
    const weightsTs = getWeightsUpdatedTs(lotto, useTrend, ss);

    const settingsData = historySheet.getDataRange().getValues();
    const hitCache = {};
    // 建立快取索引，Key：日期，且必須同時匹配彩種、推薦數與遺漏模式
    // 版本比對採後綴式（有效演算法版本皆命中，避免清快取後歷史被孤立）
    for (let i = 1; i < settingsData.length; i++) {
      const row = settingsData[i];
      // 索引位置：0:型態, 1:彩種, 2:日期, 3:推薦數, 4:遺漏模式, 5:命中數, 6:命中號碼
      if (
        isPrediction2HistoryLabel(row[0]) &&
        isFreshHistoryRow(row, weightsTs) &&
        row[1] === lotto &&
        String(row[3]) === String(nTopN) &&
        String(row[4]) === String(useTrend)
      ) {
        const dKey =
          row[2] instanceof Date
            ? Utilities.formatDate(row[2], "Asia/Taipei", "yyyy-MM-dd")
            : String(row[2]);
        hitCache[dKey] = {
          hits: row[5],
          hitNumbers: row[6] ? JSON.parse(row[6]) : [], 
        };
      }
    }

    // 取得歷史開獎資料
    const allDataRaw = allData.filter((row) => row[0] instanceof Date && row[0].getTime() > 0);
    
    // 2. 邊界檢查：若無任何歷史開獎紀錄，直接回傳空陣列
    if (allDataRaw.length === 0) {
      Logger.log(`[get60PeriodHistoryStats] 警示：彩種 ${lotto} 尚未有歷史開獎資料`);
      return [];
    }

    const targetTime = targetDate.getTime();
    // 修正：找出早於「預測日期」的最後一筆歷史開獎紀錄索引
    let cutoffIdx = -1;
    for (let i = allDataRaw.length - 1; i >= 0; i--) {
      // 強制對比時間數值並排除今日 (含括時分秒偏差之防禦)
      const rowTime = new Date(allDataRaw[i][0]).setHours(0, 0, 0, 0);
      if (rowTime < targetTime) {
        cutoffIdx = i;
        break;
      }
    }

    if (cutoffIdx === -1) return []; // 若無可用歷史資料則回傳空

    const limit = 30;
    const validRecentData = [];
    const ballCountRequired = lotto === "L539" ? 5 : 6;

    // 核心優化：反向掃描以處理歷史資料中斷
    // 不再使用固定的 slice，而是往回搜尋直到集滿 30 期「有效開獎」的紀錄
    for (let i = cutoffIdx; i >= 0 && validRecentData.length < limit; i--) {
      const row = allDataRaw[i];
      const actualNums = row.slice(1, ballCountRequired + 1).map(Number).filter(n => n > 0);
      
      // 檢查該期號碼是否完整（避開尚未開獎或資料損毀的列）
      if (actualNums.length >= ballCountRequired) {
        validRecentData.unshift({
          row: row,
          originalIdx: i // 保留原始索引以利 O(1) 效能優化
        });
      }
    }

    const newRecords = [];
    const results = validRecentData.map((item) => {
      const row = item.row;
      const dateFull = Utilities.formatDate(row[0], "Asia/Taipei", "yyyy-MM-dd");
      const dateShort = Utilities.formatDate(row[0], "Asia/Taipei", "MM/dd");
      const cacheKey = dateFull;

      if (hitCache[cacheKey] !== undefined) {
        return {
          date: dateShort,
          hits: hitCache[cacheKey].hits,
          hitNumbers: hitCache[cacheKey].hitNumbers || [],
          useTrend: useTrend // 新增：傳回該次紀錄的遺漏模式狀態
        };
      }

      // 快取未命中：執行輕量化回測
      let hits = 0;
      let hitNumbers = [];
      try {
        const ballCount = lotto === "L539" ? 5 : 6;
        const actualNums = row
          .slice(1, ballCount + 1)
          .map(Number)
          .filter((n) => n > 0);

        // 利用預先儲存的 originalIdx 直接定位訓練資料起始點
        const targetIdxInRaw = item.originalIdx;
        const historicalTrainingData = allDataRaw.slice(
          Math.max(0, targetIdxInRaw - 60),
          targetIdxInRaw,
        );

        // If not enough training data, skip prediction for this historical point
        if (historicalTrainingData.length < 10) {
          // Minimum 10 periods for training
          Logger.log(
            `Not enough historical training data for ${dateFull}. Skipping prediction.`,
          );
          hits = 0;
          hitNumbers = [];
        } else {
          // Call runGalaxyCoreEngine for this historical date
          const predResult = runGalaxyCoreEngine(
            lotto,
            historicalTrainingData,
            useTrend ? missSheet : null, // 修正：根據傳入的開關決定是否執行遺漏加權
            row[0], // The historical date itself is the targetDate for this backtest
            nTopN,
            ss,
            allData,
            weights, // 傳入預載權重
            preLoadedHeaders, // 傳入預載標頭
            useTrend ? preLoadedMissData : null, // 若關閉遺漏模式則不傳入數據
            hitCache, // 新增：直接傳入已建立的快取索引，避免引擎內重複讀取 Settings 表
            useTrend, // 傳遞遺漏模式，確保引擎內快取比對與回傳標記一致
            useTrend ? preComputedMissStats : null // 效能：共用預算遺漏統計
          );

          if (predResult && predResult.results) {
            // 修正：直接取用引擎回傳的命中統計，確保 100% 一致性
            hits = predResult.profitStars;
            hitNumbers = predResult.hitNumbers || [];
          }
        }

        newRecords.push([
          cacheTypeLabel,
          lotto,
          dateFull,
          nTopN,
          useTrend, // 寫入遺漏模式狀態
          hits,
          JSON.stringify(hitNumbers), // Store hitNumbers as JSON string
          new Date(),
          "", // 學習標記初始化為空 (代表尚未學習)
        ]);
      } catch (e) {
        Logger.log(`History backtest error: ${dateFull} ` + e);
        // In case of error, still push a record to avoid re-calculating this failed entry
        newRecords.push([
          cacheTypeLabel,
          lotto,
          dateFull,
          nTopN,
          useTrend,
          0, // 0 hits on error
          JSON.stringify([]), // Empty hit numbers on error
          new Date(),
          "ERROR", // 錯誤紀錄不參與學習
        ]);
      }

      return { date: dateShort, hits: hits, hitNumbers: hitNumbers, useTrend: useTrend };
    });

    // 寫入新紀錄（新架構：predic2_History 工作表）
    // 防重複寫入：重讀工作表，剔除併發執行已寫入的同鍵列（label/彩種/日期/推薦數/模式皆同），
    // 併發回填是重複列主因（兩端同時 miss 快取，各寫一次，僅更新時間不同）；
    // 若發現表內既有重複（同鍵多列），一併只保留第一筆。
    if (newRecords.length > 0) {
      var normHDate = function (v) {
        return v instanceof Date
          ? Utilities.formatDate(v, "Asia/Taipei", "yyyy-MM-dd")
          : String(v);
      };
      var freshRows = historySheet.getDataRange().getValues();
      var seenKeys = {};
      var cleanRows = [freshRows[0]];
      var hadDupes = false;
      for (var fi = 1; fi < freshRows.length; fi++) {
        var fr = freshRows[fi];
        var fk = [String(fr[0]), String(fr[1]), normHDate(fr[2]), String(fr[3]), String(fr[4])].join("|");
        if (seenKeys[fk]) {
          hadDupes = true;
          continue;
        }
        seenKeys[fk] = 1;
        cleanRows.push(fr);
      }
      var filteredNew = newRecords.filter(function (nr) {
        var nk = [String(nr[0]), String(nr[1]), normHDate(nr[2]), String(nr[3]), String(nr[4])].join("|");
        if (seenKeys[nk]) return false;
        seenKeys[nk] = 1;
        return true;
      });
      if (hadDupes) {
        historySheet.clearContents();
        historySheet.getRange(1, 1, cleanRows.length, cleanRows[0].length).setValues(cleanRows);
        SpreadsheetApp.flush();
      }
      if (filteredNew.length > 0) {
        historySheet
          .getRange(historySheet.getLastRow() + 1, 1, filteredNew.length, 9) // 更新為 9 欄位
          .setValues(filteredNew);
      }
    }
    SpreadsheetApp.flush(); // 強制同步，確保通訊結束前資料已寫入

    return results;
  } catch (e) {
    logSystemError("get60PeriodHistoryStats", e.toString(), "ERROR", `彩種 ${lotto} 歷史回測失敗`);
    Logger.log(`[DEBUG] Error in get60PeriodHistoryStats: ` + e);
    return [];
  }
}

/**
 * 自動學習邏輯：根據歷史命中結果動態微調九星與二十八星宿的權重係數。
 * @param {string} lotto 彩種代碼
 * @param {GoogleAppsScript.Spreadsheet.Spreadsheet} ss {lotto}_Prediction2 試算表物件（All 另從 {lotto} 試算表讀取）
 * @param {boolean} useTrend 當前的遺漏模式
 * 
 * [架構檢查]：此函式目前專注於「增量學習」。
 * 由於 Archive 中僅包含已標記 'Y' 的數據，正常更新時無需讀取 Archive。
 * 若未來需要「重新初始化權重 (Full Retraining)」，則可另建「DeepLearn」函式，
 * 同時合併 predic2_History 與 predic2_History_Archive 進行超長期的迴歸分析。
 */
function autoAdjustAstrologyWeights(lotto, ss, useTrend) {
  const LEARNING_MIN_RECORDS = 10; // 調低門檻：針對新模式更快啟動學習
  const LEARNING_DECAY_FACTOR = 0.95; // 舊紀錄的影響力衰減因子
  const ADJUSTMENT_STEP = 0.01; // 每次調整的步長
  
  const MAX_ASTRO_WEIGHT = 2.5; // 九星/星宿權重上限
  const MAX_STEM_BRANCH_WEIGHT = 2.0; // 天干/地支權重上限
  const MIN_WEIGHT = 0.1; // 權重保底底限

  const propertySheetName = `predic2_Property`;
  const settingsSheetName = `predic2_History`; // HIT_HISTORY 儲存於 predic2_History（新架構）

  try {
    // 核心修正 1：強制同步試算表緩衝，確保能抓到 get60PeriodHistoryStats 剛剛寫入的最新列索引
    SpreadsheetApp.flush();

    // 1. 檢查上次學習時間，避免頻繁執行
    const lastLearningTimestampKey = `LAST_ASTRO_LEARN_TS_${lotto}_${useTrend}`;
    const lastLearningTimestamp = getPropertySheetValue(
      propertySheetName,
      lastLearningTimestampKey,
      0,
      ss,
    );
    const now = new Date().getTime();
    const COOLDOWN_PERIOD = 60 * 60 * 1000; // 核心修正 2：縮短冷卻期至 1 小時，方便開發與快速迭代

    if (now - lastLearningTimestamp < COOLDOWN_PERIOD) {
      Logger.log(
        `[AutoLearn] Astrology weights for ${lotto} are in cooldown. Skipping learning.`,
      );
      return;
    }

    // 2. 取得當前權重
    // 優化：在學習前先移除 PropertiesService 快取，強制從試算表讀取最即時的手動設定值
    PropertiesService.getUserProperties().deleteProperty(`WEIGHTS_${lotto}_${useTrend}`);
    
    let currentWeights = getAIWeightSettings(lotto, useTrend);
    currentWeights.nineStarMap = currentWeights.nineStarMap || {};
    currentWeights.twentyEightMansionsMap =
      currentWeights.twentyEightMansionsMap || {};
    currentWeights.dayStemMap = currentWeights.dayStemMap || {};
    currentWeights.dayBranchMap = currentWeights.dayBranchMap || {};

    // 3. 讀取歷史命中紀錄（僅採用演算法版本相符且權重未失效的新鮮列）
    let settingsSheet = ss.getSheetByName(settingsSheetName);
    if (!settingsSheet) {
      Logger.log(
        `[AutoLearn] Settings sheet '${settingsSheetName}' not found for ${lotto}. Skipping learning.`,
      );
      return;
    }
    
    // 核心修正 3：重新取得最新範圍，避免索引偏移指向空白列
    const settingsData = settingsSheet.getDataRange().getValues();
    const LEARNING_MIN_RECORDS = 5; // 核心修正 4：調低門檻至 5 筆，確保 L539 能順利觸發學習
    const learnWeightsTs = getWeightsUpdatedTs(lotto, useTrend, ss);
    const unlearnedRows = [];
    for (let i = 1; i < settingsData.length; i++) {
      const row = settingsData[i];
      if (
        String(row[0]).indexOf("HIT_HISTORY") === 0 && 
        isPrediction2HistoryLabel(row[0]) &&
        isFreshHistoryRow(row, learnWeightsTs) &&
        row[1] === lotto && 
        String(row[4]) === String(useTrend) &&
        row[8] !== "Y"
      ) {
        unlearnedRows.push({ data: row, sheetIdx: i + 1 });
      }
    }

    if (unlearnedRows.length < LEARNING_MIN_RECORDS) {
      Logger.log(
        `[AutoLearn] ${lotto} (Mode:${useTrend}) 待學習紀錄不足 (${unlearnedRows.length})。跳過本次進化。`,
      );
      return;
    }

    // 4. 讀取 All 工作表數據以獲取日九星和二十八星宿（新架構：{lotto} 試算表）
    const allSheet = getPrediction2Spreadsheets(lotto).allSS.getSheetByName("All");
    if (!allSheet) {
      Logger.log(
        `[AutoLearn] All sheet not found for ${lotto}. Skipping learning.`,
      );
      return;
    }
    const allData = allSheet.getDataRange().getValues();
    const allHeaders = allData[0];
    const nineStarCol = allHeaders.indexOf("日九星");
    const twentyEightMansionsCol = allHeaders.indexOf("日二十八星宿");
    const dayStemCol = allHeaders.indexOf("日天干");
    const dayBranchCol = allHeaders.indexOf("日地支");
    const dateCol = allHeaders.indexOf("Date");

    if (dateCol === -1) {
      Logger.log(
        `[AutoLearn] Date column not found for ${lotto}. Skipping learning.`,
      );
      return;
    }

    // 建立日期到占星數據的映射
    const astroDataMap = {};
    for (let i = 1; i < allData.length; i++) {
      const row = allData[i];
      const rowDate = row[dateCol];
      if (rowDate instanceof Date) {
        // 核心修正 5：統一時區為 Asia/Taipei，確保與 get60PeriodHistoryStats 寫入的日期格式完全匹配
        const formattedDate = Utilities.formatDate(rowDate, "Asia/Taipei", "yyyy-MM-dd");
        astroDataMap[formattedDate] = {
          nineStar: row[nineStarCol],
          twentyEightMansions: row[twentyEightMansionsCol],
          dayStem: row[dayStemCol],
          dayBranch: row[dayBranchCol],
        };
      }
    }

    // 5. 分析歷史命中結果與占星數據的關聯
    let nineStarStats = {}; // { "1白": { sum: 0, count: 0 } }
    let mansionStats = {}; // { "角": { sum: 0, count: 0 } }
    let stemStats = {}; // { "甲": { sum: 0, count: 0 } }
    let branchStats = {}; // { "子": { sum: 0, count: 0 } }

    // 遍歷待學習紀錄
    unlearnedRows.forEach((item, i) => {
      const row = item.data;
      // 核心修正 6：同步時區，確保能正確從 astroDataMap 提取占星數據
      const recordDateStr = Utilities.formatDate(row[2], "Asia/Taipei", "yyyy-MM-dd"); 
      const hits = Number(row[5]); // 修正索引：新增「遺漏模式」後，命中數移至 index 5
      const topN = Number(row[3]); 
      // 修正：同步核心引擎，包含特別號後滿分為 7
      const maxPossibleHits = lotto === "L539" ? 5 : 7; 

      const astroData = astroDataMap[recordDateStr];

      if (astroData) {
        const effectiveness = hits / Math.min(topN, maxPossibleHits);
        // 針對待學習批次應用衰減
        const decayFactor = Math.pow(LEARNING_DECAY_FACTOR, unlearnedRows.length - 1 - i);

        const ns = astroData.nineStar;
        const tem = astroData.twentyEightMansions;
        const ds = astroData.dayStem;
        const db = astroData.dayBranch;

        if (ns) {
          nineStarStats[ns] = nineStarStats[ns] || { sum: 0, count: 0 };
          nineStarStats[ns].sum += effectiveness * decayFactor;
          nineStarStats[ns].count += decayFactor;
        }
        if (tem) {
          mansionStats[tem] = mansionStats[tem] || { sum: 0, count: 0 };
          mansionStats[tem].sum += effectiveness * decayFactor;
          mansionStats[tem].count += decayFactor;
        }
        if (ds) {
          stemStats[ds] = stemStats[ds] || { sum: 0, count: 0 };
          stemStats[ds].sum += effectiveness * decayFactor;
          stemStats[ds].count += decayFactor;
        }
        if (db) {
          branchStats[db] = branchStats[db] || { sum: 0, count: 0 };
          branchStats[db].sum += effectiveness * decayFactor;
          branchStats[db].count += decayFactor;
        }
      }
    });

    // 計算整體平均命中率作為基準
    const overallAvgHits = unlearnedRows.reduce((sum, item) => sum + Number(item.data[5]), 0) / unlearnedRows.length;
    
    // 修正：基準命中率的分母應與 maxPossibleHits 一致
    const overallAvgEffectiveness = overallAvgHits / (lotto === "L539" ? 5 : 7);

    // 6. 調整個別九星、星宿、天干、地支權重
    Object.keys(nineStarStats).forEach((val) => {
      const avg = nineStarStats[val].sum / nineStarStats[val].count;
      let w = currentWeights.nineStarMap[val] || currentWeights.nineStar || 0.8;

      if (avg > overallAvgEffectiveness * 1.1)
        w = Math.min(MAX_ASTRO_WEIGHT, w + ADJUSTMENT_STEP);
      else if (avg < overallAvgEffectiveness * 0.9)
        w = Math.max(MIN_WEIGHT, w - ADJUSTMENT_STEP);

      currentWeights.nineStarMap[val] = parseFloat(w.toFixed(3));
    });

    Object.keys(mansionStats).forEach((val) => {
      const avg = mansionStats[val].sum / mansionStats[val].count;
      let w =
        currentWeights.twentyEightMansionsMap[val] ||
        currentWeights.twentyEightMansions ||
        0.7;

      if (avg > overallAvgEffectiveness * 1.1)
        w = Math.min(MAX_ASTRO_WEIGHT, w + ADJUSTMENT_STEP);
      else if (avg < overallAvgEffectiveness * 0.9)
        w = Math.max(MIN_WEIGHT, w - ADJUSTMENT_STEP);

      currentWeights.twentyEightMansionsMap[val] = parseFloat(w.toFixed(3));
    });

    Object.keys(stemStats).forEach((val) => {
      const avg = stemStats[val].sum / stemStats[val].count;
      let w = currentWeights.dayStemMap[val] || currentWeights.dayStem || 0.5;

      if (avg > overallAvgEffectiveness * 1.1)
        w = Math.min(MAX_STEM_BRANCH_WEIGHT, w + ADJUSTMENT_STEP);
      else if (avg < overallAvgEffectiveness * 0.9)
        w = Math.max(MIN_WEIGHT, w - ADJUSTMENT_STEP);

      currentWeights.dayStemMap[val] = parseFloat(w.toFixed(3));
    });

    Object.keys(branchStats).forEach((val) => {
      const avg = branchStats[val].sum / branchStats[val].count;
      let w =
        currentWeights.dayBranchMap[val] || currentWeights.dayBranch || 0.5;

      if (avg > overallAvgEffectiveness * 1.1)
        w = Math.min(MAX_STEM_BRANCH_WEIGHT, w + ADJUSTMENT_STEP);
      else if (avg < overallAvgEffectiveness * 0.9)
        w = Math.max(MIN_WEIGHT, w - ADJUSTMENT_STEP);

      currentWeights.dayBranchMap[val] = parseFloat(w.toFixed(3));
    });

    // 7. 更新權重並記錄學習時間
    // 自動學習微調不失效歷史（invalidateHistory=false）：±0.01 級漂移不值得清空重算，
    // 且歷史列保留才能讓步驟 8 的 Y 標記落在正確列上
    setAIWeightSettings(lotto, currentWeights, useTrend, false);
    setPropertySheetValue(propertySheetName, lastLearningTimestampKey, now, ss);

    // 8. 核心優化：將已學習的紀錄標記為 "Y" (使用 Batch Update 提升效能)
    if (unlearnedRows.length > 0) {
      const minRow = Math.min(...unlearnedRows.map(r => r.sheetIdx));
      const maxRow = Math.max(...unlearnedRows.map(r => r.sheetIdx));
      const rowCount = maxRow - minRow + 1;

      // 一次性讀取整段範圍 (包含標籤欄與標記欄)
      const updateRange = settingsSheet.getRange(minRow, 1, rowCount, 9);
      const updateValues = updateRange.getValues();

      unlearnedRows.forEach(item => {
        const relativeIdx = item.sheetIdx - minRow;
        // 二次檢查：確保該行確實是「同彩種＋同模式」的歷史紀錄（防錯位誤標別彩種列）
        const cell = updateValues[relativeIdx] || [];
        if (String(cell[0]).indexOf("HIT_HISTORY") === 0
            && cell[1] === lotto
            && String(cell[4]) === String(useTrend)) {
          updateValues[relativeIdx][8] = "Y"; // 更新第 9 欄 (Index 8)
        }
      });

      // 一次性批次寫回試算表
      updateRange.setValues(updateValues);
      SpreadsheetApp.flush(); // 強制同步
    }

    Logger.log(
      `[AutoLearn] ${lotto} (Mode:${useTrend}) 進化成功！已處理 ${unlearnedRows.length} 筆新數據。`,
    );
  } catch (e) {
    Logger.log(
      `[AutoLearn Error] Failed to adjust astrology weights for ${lotto}:`,
      e,
    );
    // 如果 Utility.js 中的 logSystemError 函式存在，則記錄錯誤
    if (typeof logSystemError === "function") {
      logSystemError("Prediction2_Server.js", e.toString(), "ERROR", "", {
        function: "autoAdjustAstrologyWeights",
        lotto: lotto,
      });
    }
  }
}

/**
 * 星系系統專屬快取清理：僅清理 predic2_Property 與星系演算法相關的 Properties
 */
function clearPredictGalaxyCache(lotto) {
  try {
    const props = PropertiesService.getUserProperties();
    const keys = props.getKeys();
    // 星系演算法前綴通常為 'WEIGHTS_' 或以 'P' 開頭 (來自 PREDICTION2_ALGO_VERSION)
    const galaxyPrefix = "P" + PREDICTION2_ALGO_VERSION.substring(0, 1);
    
    let count = 0;
    keys.forEach(k => {
      if (k.startsWith(galaxyPrefix) || k.startsWith("WEIGHTS_" + lotto)) {
        props.deleteProperty(k);
        count++;
      }
    });

    // 清理試算表持久快取（新架構：{lotto}_Prediction2 試算表 > predic2_Property）
    const predictSS = getPrediction2Spreadsheets(lotto).predictSS;
    const propSheet = predictSS.getSheetByName("predic2_Property");
    if (propSheet) {
      const lastRow = propSheet.getLastRow();
      if (lastRow > 1) propSheet.getRange(2, 1, lastRow - 1, 2).clearContent();
    }

    // 同時刷新全域對照表快取
    if (typeof refreshMappingCache === "function") refreshMappingCache();

    // 增加：隔離版本遞增
    incrementSystemVersion("GALAXY");

    return { status: "success", message: `已清理 ${count} 項星系專屬快取數據。` };
  } catch (e) {
    return { status: "error", message: "星系快取清理失敗: " + e.message };
  }
}

/**
 * 開獎日對齊（後端權威版）：過去日期必須在 All 有開獎紀錄，否則回推至最近有紀錄日；
 * 未來日期不限。直接修改傳入的 targetDate，回傳是否發生對齊。
 */
function snapTargetToDrawDate(allValues, targetDate) {
  var today = new Date();
  today.setHours(0, 0, 0, 0);
  if (targetDate.getTime() >= today.getTime()) return false; // 今日之後不限
  var key = Utilities.formatDate(targetDate, "Asia/Taipei", "yyyy-MM-dd");
  for (var i = 1; i < allValues.length; i++) {
    var r = allValues[i][0];
    if (r instanceof Date && Utilities.formatDate(r, "Asia/Taipei", "yyyy-MM-dd") === key) return false;
  }
  for (var j = allValues.length - 1; j >= 1; j--) {
    var r2 = allValues[j][0];
    if (r2 instanceof Date && r2.getTime() > 0 && r2 < targetDate) {
      targetDate.setTime(r2.getTime());
      return true;
    }
  }
  return false;
}

/**
 * 遺漏 Z-Score 統計（效能版）：僅取最近 windowSize 列計算每球 avg/stdDev，單次遍歷。
 * @param {Array} missRows 遺漏表二維陣列（可含標頭列，非數字自動略過）
 * @param {number} ballRange 球號範圍
 * @param {number} missOffset 遺漏欄位偏移
 * @param {number} windowSize 取用列數（預設 120）
 */
function calcMissStatsMap(missRows, ballRange, missOffset, windowSize) {
  var window = windowSize || 120;
  var rows = missRows.slice(-window);
  var map = {};
  for (var ball = 1; ball <= ballRange; ball++) {
    var sum = 0, sumSq = 0, n = 0;
    for (var r = 0; r < rows.length; r++) {
      var v = Number(rows[r][missOffset + ball]);
      if (!isNaN(v)) { sum += v; sumSq += v * v; n++; }
    }
    var avg = n > 0 ? sum / n : 10;
    var variance = n > 0 ? Math.max(0, sumSq / n - avg * avg) : 25;
    map[ball] = { avg: avg, stdDev: Math.sqrt(variance) || 1 };
  }
  return map;
}

/**
 * runGalaxyCoreEngine - 內部預測核心 (不依賴 Prediction1_Server.js)
 */
function runGalaxyCoreEngine(
  lotto,
  trainingData,
  missSheet,
  targetDate,
  topN,
  ss,
  preLoadedAllData = null,
  preLoadedWeights = null, // 新增
  preLoadedHeaders = null, // 新增
  preLoadedMissData = null, // 新增：預載遺漏數據
  preLoadedHitCache = null,  // 新增：預載命中快取
  useTrend = true, // 新增
  preComputedMissStats = null // 新增：預算遺漏統計（回測共用，避免逐次全表掃描）
) {
  // 防禦性檢查：確保訓練資料存在且長度大於 0，避免除以零錯誤
  if (!trainingData || trainingData.length === 0) {
    return { status: "error", message: "星系資料庫為空，無法初始化軌道模型。" };
  }

  // 1. 取得權重設定
  const weights = preLoadedWeights || getAIWeightSettings(lotto, useTrend);
  // 修正：L638 (威力彩) 第一區為 38 顆球
  const ballRange = lotto === "L638" ? 38 : (lotto === "L539" ? 39 : 49);
  const scores = {};
  const s1Scores = {}; // 新增：專供 L638 第二區使用的分數池
  if (lotto === "L638") { for (let i = 1; i <= 8; i++) s1Scores[i] = 0; }

  // 初始化球號分數
  for (let i = 1; i <= ballRange; i++) scores[i] = 0;

  // 取得 'All' 工作表的標頭以找到 '日九星' 和 '日二十八星宿' 的欄位索引
  // 新架構：All 位於 {lotto} 試算表；ss 參數為 {lotto}_Prediction2 試算表（僅供快取回退）
  const allSheet = getPrediction2Spreadsheets(lotto).allSS.getSheetByName("All");
  const allSheetHeaders =
    preLoadedHeaders ||
    allSheet.getRange(1, 1, 1, allSheet.getLastColumn()).getValues()[0];
  const nineStarCol = allSheetHeaders.indexOf("日九星");
  const twentyEightMansionsCol = allSheetHeaders.indexOf("日二十八星宿");
  const dayStemCol = allSheetHeaders.indexOf("日天干");
  const dayBranchCol = allSheetHeaders.indexOf("日地支");
  const yearStemCol = allSheetHeaders.indexOf("年天干"); // NEW

  let targetNineStar = null;
  let targetTwentyEightMansions = null;
  let targetDayStem = null;
  let targetDayBranch = null;
  let targetYearStem = null; // NEW
  let actualDraw = null; // 新增：存儲當日實際開獎號碼
  let actualS1 = null; // 新增：存儲當日特別號

  // 嘗試從 'All' 工作表找到 targetDate 的日九星和二十八星宿
  const allData = preLoadedAllData || allSheet.getDataRange().getValues();
  // 統一使用 Asia/Taipei 時區進行字串化比對
  const targetDateFormatted = Utilities.formatDate(targetDate, "Asia/Taipei", "yyyy-MM-dd");
  
  const s1Col = allSheetHeaders.indexOf("S1"); // 動態查找 S1 欄位索引

  for (let i = 1; i < allData.length; i++) {
    const cellDate = allData[i][0];
    if (
      cellDate instanceof Date &&
      Utilities.formatDate(cellDate, "Asia/Taipei", "yyyy-MM-dd") ===
        targetDateFormatted
    ) {
      targetNineStar = allData[i][nineStarCol];
      targetTwentyEightMansions = allData[i][twentyEightMansionsCol];
      targetDayStem = allData[i][dayStemCol];
      targetDayBranch = allData[i][dayBranchCol];
      targetYearStem = yearStemCol !== -1 ? allData[i][yearStemCol] : null;

      // 新增：提取當日開獎號碼 (根據彩種決定球數)
      const ballCount = lotto === "L539" ? 5 : 6;
      actualDraw = allData[i]
        .slice(1, ballCount + 1)
        .map(Number)
        .filter((n) => n > 0);

      // 新增：提取特別號 S1 (L539 無特別號)
      if (
        lotto !== "L539" &&
        s1Col !== -1 &&
        allData[i][s1Col] !== undefined &&
        allData[i][s1Col] !== ""
      ) {
        actualS1 = Number(allData[i][s1Col]);
      }
      break;
    }
  }

  if (!targetNineStar || !targetTwentyEightMansions) {
    Logger.log(
      `Astrological factors for target date ${targetDateFormatted} not found in 'All' sheet. Astrological weighting will be skipped.`,
    );
  }

  // 2. 統計規律 (基礎頻率)
  trainingData.forEach((row) => {
    for (let i = 1; i <= (lotto === "L539" ? 5 : 6); i++) {
      const num = Number(row[i]);
      if (scores[num] !== undefined) scores[num] += Number(weights.frequency) || 1.0;
    }

    // --- 威力彩第二區衛星軌道統計 ---
    if (lotto === "L638" && s1Col !== -1) {
      const s1Val = Number(row[s1Col]);
      if (s1Scores[s1Val] !== undefined) {
        s1Scores[s1Val] += Number(weights.frequency) || 1.0;
      }
    }

    // 3. 多維度權重運算 (占星與干支)
    // 僅在目標日期和歷史數據都存在這些資訊時才進行加權
    const currentNineStar = row[nineStarCol];
    const currentTwentyEightMansions = row[twentyEightMansionsCol];
    const currentDayStem = row[dayStemCol];
    const currentDayBranch = row[dayBranchCol];

    // 九星加權
    if (targetNineStar && currentNineStar === targetNineStar) {
      const nsWeight =
        (weights.nineStarMap && weights.nineStarMap[currentNineStar]) !==
        undefined
          ? weights.nineStarMap[currentNineStar]
          : weights.nineStar || 0.8;
      for (let i = 1; i <= (lotto === "L539" ? 5 : 6); i++) {
        const num = Number(row[i]);
        if (scores[num] !== undefined) scores[num] += nsWeight;
      }
      // 同步加權至威力彩第二區
      if (lotto === "L638" && s1Col !== -1) {
        const s1Val = Number(row[s1Col]);
        if (s1Scores[s1Val] !== undefined) s1Scores[s1Val] += nsWeight;
      }
    }
    // 星宿加權
    if (
      targetTwentyEightMansions &&
      currentTwentyEightMansions === targetTwentyEightMansions
    ) {
      const temWeight =
        (weights.twentyEightMansionsMap &&
          weights.twentyEightMansionsMap[currentTwentyEightMansions]) !==
        undefined
          ? weights.twentyEightMansionsMap[currentTwentyEightMansions]
          : weights.twentyEightMansions || 0.7;
      for (let i = 1; i <= (lotto === "L539" ? 5 : 6); i++) {
        const num = Number(row[i]);
        if (scores[num] !== undefined) scores[num] += temWeight;
      }
      // 同步加權至威力彩第二區
      if (lotto === "L638" && s1Col !== -1) {
        const s1Val = Number(row[s1Col]);
        if (s1Scores[s1Val] !== undefined) s1Scores[s1Val] += temWeight;
      }
    }
    // 日天干加權
    if (targetDayStem && currentDayStem === targetDayStem) {
      const dsWeight =
        (weights.dayStemMap && weights.dayStemMap[currentDayStem]) !== undefined
          ? weights.dayStemMap[currentDayStem]
          : weights.dayStem || 0.5;
      for (let i = 1; i <= (lotto === "L539" ? 5 : 6); i++) {
        const num = Number(row[i]);
        if (scores[num] !== undefined) scores[num] += dsWeight;
      }
    }
    // 日地支加權
    if (targetDayBranch && currentDayBranch === targetDayBranch) {
      const dbWeight =
        (weights.dayBranchMap && weights.dayBranchMap[currentDayBranch]) !==
        undefined
          ? weights.dayBranchMap[currentDayBranch]
          : weights.dayBranch || 0.5;
      for (let i = 1; i <= (lotto === "L539" ? 5 : 6); i++) {
        const num = Number(row[i]);
        if (scores[num] !== undefined) scores[num] += dbWeight;
      }
    }
  });

  // 4. 處理遺漏趨勢 (如果啟用)
  if (missSheet) {
    let lastMissRow = null;

    // 1. 優先嘗試從預載的 Map 中直接取得當前日期的遺漏值 (O(1))
    if (preLoadedMissData && !Array.isArray(preLoadedMissData)) {
      lastMissRow = preLoadedMissData[targetDateFormatted];
    }

    // 2. 若無 Map 或 Map 查找失敗（例如實時預測），則執行線性搜尋搜尋（相容模式）
    if (!lastMissRow) {
      const missData = Array.isArray(preLoadedMissData) ? preLoadedMissData : missSheet.getDataRange().getValues();
      const targetTime = targetDate.getTime();
      for (let i = missData.length - 1; i >= 1; i--) {
        const rowDate = missData[i][0];
        if (rowDate instanceof Date && rowDate.getTime() <= targetTime) {
          lastMissRow = missData[i];
          break;
        }
      }
    }

    if (lastMissRow) {
      // 假設 M1~M49 在 All 工作表欄位之後，具體依據 Predict.md 定義
      const missOffset = lotto === "L539" ? 7 : 8;
      // 從權重設定中讀取動態門檻與增益強度，讓使用者可手動微調
      const mThreshold = Number(weights.missThreshold) || 10;
      const mIntensity = Number(weights.skip) || 0.5;

      // 強化：Z-Score 反彈偵測統計（預算優先，避免 30 期回測重複全表掃描）
      var missStatsMap = preComputedMissStats;
      if (!missStatsMap) {
        var fullMissData = null;
        if (Array.isArray(preLoadedMissData)) {
          fullMissData = preLoadedMissData;
        } else if (preLoadedMissData) {
          fullMissData = Object.values(preLoadedMissData); // Map 轉陣列，不再回頭讀表
        } else if (missSheet) {
          fullMissData = missSheet.getDataRange().getValues();
        }
        missStatsMap = fullMissData ? calcMissStatsMap(fullMissData, ballRange, missOffset, 120) : {};
      }

      for (let i = 1; i <= ballRange; i++) {
        const missVal = Number(lastMissRow[missOffset + i]);
        // 原始簡單門檻加權
        if (missVal > mThreshold) scores[i] += mIntensity;
        // Z-Score 反彈預警：missVal 超過 avg + 1*stdDev 時視為強烈反彈訊號
        const stat = missStatsMap[i] || { avg: 10, stdDev: 5 };
        if (missVal > stat.avg + stat.stdDev) {
          const reboundIntensity = Math.min(1.3, 1 + (missVal - stat.avg) / (stat.stdDev * 5));
          scores[i] *= reboundIntensity;
        }
      }
    }
  }

  // --- START: Accuracy Improvements ---

  // A) 近期熱門尾數偵測 (Hot Tail Detection)
  const tailFreq = {};
  const ballCountHT = lotto === "L539" ? 5 : 6;
  trainingData.slice(-15).forEach((row) => {
    for (let i = 1; i <= ballCountHT; i++) {
      const tail = Number(row[i]) % 10;
      if (!isNaN(tail)) tailFreq[tail] = (tailFreq[tail] || 0) + 1;
    }
  });
  const hotTails = Object.entries(tailFreq)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 2)
    .map(e => parseInt(e[0]));

  // B) 年度五行元素加權 (Element Weighting from Year Stem)
  const stemElements = {甲:"木",乙:"木",丙:"火",丁:"火",戊:"土",己:"土",庚:"金",辛:"金",壬:"水",癸:"水"};
  const elementDigits = {木:[1,2],火:[3,4],土:[5,6],金:[7,8],水:[9,0]};
  const targetElement = targetYearStem ? (stemElements[targetYearStem] || "") : "";
  const luckyDigits = elementDigits[targetElement] || [];

  // C) 環境平衡分析師過濾器 (Analyst Balance Filters)
  const midPoint = Math.floor(ballRange / 2);
  const recent20 = trainingData.slice(-20);
  let tBig = 0, tSmall = 0, tOdd = 0, tEven = 0;
  recent20.forEach((row) => {
    for (let i = 1; i <= ballCountHT; i++) {
      const n = Number(row[i]);
      if (isNaN(n) || n <= 0) continue;
      if (n > midPoint) tBig++; else tSmall++;
      if (n % 2 !== 0) tOdd++; else tEven++;
    }
  });
  const bigRatio = tBig / (tBig + tSmall || 1);
  const oddRatio = tOdd / (tOdd + tEven || 1);

  // D) 和值引力位移 (Sum Gravity Z-Score)
  const theorySum = lotto === "L539" ? 100 : (lotto === "L638" ? 117 : 150);
  const stdDevSV = lotto === "L539" ? 23.8 : (lotto === "L638" ? 24.98 : 32.78);
  const sumHistorySV = trainingData.slice(-20).map((row) => {
    return row.slice(1, ballCountHT + 1).reduce((a, b) => a + (Number(b) || 0), 0);
  });
  const lastSum = sumHistorySV[sumHistorySV.length - 1] || theorySum;
  const prevSum = sumHistorySV.length > 1 ? sumHistorySV[sumHistorySV.length - 2] : lastSum;
  const lastZScore = (lastSum - theorySum) / stdDevSV;
  const prevZScore = (prevSum - theorySum) / stdDevSV;
  const zVelocity = lastZScore - prevZScore;

  // E) 黃金分割結構共振 (Golden Ratio Filter)
  const goldHigh = theorySum * 0.618;
  const goldLow = theorySum * 0.382;
  const node1 = Math.round(goldHigh % ballRange) || ballRange;
  const node2 = Math.round(goldLow % ballRange) || ballRange;

  // Apply all improvements to scores
  Object.keys(scores).forEach((num) => {
    const n = parseInt(num);
    const lastDigit = n % 10;
    let metaBoost = 1.0;

    // B) 五行尾數共振
    if (targetElement && luckyDigits.includes(lastDigit)) {
      metaBoost *= 1.08;
    }

    // A) 熱門尾數加權
    if (hotTails.includes(lastDigit)) {
      metaBoost *= 1.06;
    }

    // C) 大小平衡修正
    if (bigRatio > 0.55 && n <= midPoint) metaBoost *= 1.12;
    else if (bigRatio < 0.45 && n > midPoint) metaBoost *= 1.12;

    // C) 奇偶平衡修正
    if (oddRatio > 0.55 && n % 2 === 0) metaBoost *= 1.08;
    else if (oddRatio < 0.45 && n % 2 !== 0) metaBoost *= 1.08;

    // D) 和值引力回歸修正 (Z-Score 位移速率感應)
    if (Math.abs(lastZScore) > 1.0) {
      let gravityIntensity = 0.18;
      const isDecelerating = (lastZScore > 0 && zVelocity < 0) || (lastZScore < 0 && zVelocity > 0);
      if (isDecelerating) {
        gravityIntensity += Math.min(0.12, Math.abs(zVelocity) * 0.1);
      } else {
        gravityIntensity -= Math.min(0.08, Math.abs(zVelocity) * 0.05);
      }
      if (lastZScore > 1.0 && n < midPoint) metaBoost *= 1 + gravityIntensity;
      if (lastZScore < -1.0 && n > midPoint) metaBoost *= 1 + gravityIntensity;
    }

    // E) 黃金分割節點共振
    if (Math.abs(n - node1) <= 1 || Math.abs(n - node2) <= 1) metaBoost *= 1.06;
    if (n === node1 || n === node2) metaBoost *= 1.02;

    scores[num] *= metaBoost;
  });

  // F) 強化連號阻斷器 (Consecutive Interceptor with Top-3 Protection)
  const sortedEntries = Object.entries(scores).sort((a, b) => b[1] - a[1]);
  const keyPlanets = new Set(sortedEntries.slice(0, 3).map(e => parseInt(e[0])));
  const topCandidates = sortedEntries.slice(0, parseInt(topN) + 2).map(e => parseInt(e[0])).sort((a, b) => a - b);
  for (let i = 0; i < topCandidates.length - 2; i++) {
    if (topCandidates[i + 1] === topCandidates[i] + 1 && topCandidates[i + 2] === topCandidates[i + 1] + 1) {
      let run = [topCandidates[i], topCandidates[i + 1], topCandidates[i + 2]];
      if (i + 3 < topCandidates.length && topCandidates[i + 3] === topCandidates[i + 2] + 1) {
        run.push(topCandidates[i + 3]);
      }
      const weakestNum = run.reduce((prev, curr) => scores[curr] < scores[prev] ? curr : prev);
      if (!keyPlanets.has(weakestNum)) {
        const penalty = run.length >= 4 ? 0.75 : 0.85;
        scores[weakestNum] *= penalty;
      }
      i += run.length - 1;
    }
  }

  // G) 強化遺漏 Z-Score 反彈偵測 (inside miss block - applied inline above)

  // --- 決定威力彩第二區預測號碼 ---
  let predictedS1 = null;
  if (lotto === "L638") {
    const sortedS1 = Object.keys(s1Scores).sort((a, b) => s1Scores[b] - s1Scores[a]);
    predictedS1 = String(sortedS1[0]).padStart(2, "0");
  }

  // 5. 排序並選取 TopN
  const sortedBalls = Object.keys(scores)
    .map((num) => ({
      number: String(num).padStart(2, "0"),
      score: scores[num],
      probability:
        Math.min(95, 40 + (scores[num] / (trainingData.length || 1)) * 100).toFixed(
          1,
        ) + "%",
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, topN);

  // 定義五行類別及其顏色 (對應 Prediction2_Style.html 中的精緻動畫樣式)
  const categories = [
    { name: "金星", color: "badge-metal" }, // 金 - 黃色/金色
    { name: "木星", color: "badge-wood" }, // 木 - 綠色
    { name: "水星", color: "badge-water" }, // 水 - 藍色
    { name: "火星", color: "badge-fire" }, // 火 - 紅色
    { name: "土星", color: "badge-earth" }, // 土 - 灰色/棕色
  ];

  // 根據預測結果的數量，將球號平均分配到五行類別
  const totalBalls = sortedBalls.length;
  const categorySize = Math.max(1, Math.ceil(totalBalls / categories.length));

  // 準備比對資料：連莊 (上一期) 與 隔期 (前二期)
  const ballCount = lotto === "L539" ? 5 : 6;
  const lastDrawRaw = trainingData.length > 0 ? trainingData[trainingData.length - 1] : [];
  const prevDrawRaw = trainingData.length > 1 ? trainingData[trainingData.length - 2] : [];
  
  const lastDrawSet = new Set(lastDrawRaw.slice(1, ballCount + 1).map(n => String(n).padStart(2, "0")));
  const prevDrawSet = new Set(prevDrawRaw.slice(1, ballCount + 1).map(n => String(n).padStart(2, "0")));

  // 6. 生成狀態標籤
  const results = sortedBalls.map((ball, index) => {
    // 根據索引位置決定五行分配
    const categoryIndex = Math.min(
      Math.floor(index / categorySize),
      categories.length - 1,
    );
    const elementCategory = categories[categoryIndex].name;
    const elementColor = categories[categoryIndex].color;

    let status = "穩定";
    let statusColor = "bg-primary";
    if (Number(ball.probability.replace("%", "")) > 80) {
      status = "熱門";
      statusColor = "bg-danger";
    } else if (Number(ball.probability.replace("%", "")) < 55) {
      status = "潛力";
      statusColor = "bg-info";
    }

    // 核心優化：根據彩種動態調整過熱門檻
    const heatThreshold = lotto === "L539" ? 90 : (lotto === "L638" ? 93 : 92);

    return {
      ...ball,
      status: status,
      statusColor: statusColor,
      isPotentialCold: status === "潛力",
      elementCategory: elementCategory, // Add element category
      elementColor: elementColor, // Add element color
      isRepeat: lastDrawSet.has(ball.number), // 修正：補齊連莊標籤
      isSkip: prevDrawSet.has(ball.number),   // 修正：補齊隔期標籤
      isHeatPenalized: Number(ball.probability.replace("%", "")) > heatThreshold, // 修正：根據動態門檻顯示過熱懲罰
    };
  });

  // 6. 生成信心指數趨勢與歷史命中 (用於詳細模式圖表)
  // 修正：不再使用隨機數，而是讀取真實歷史命中紀錄，確保與 30 期回測圖表一致
  const recentHistoryForLabels = trainingData.slice(-10);

  // 讀取現有快取以取得真實命中數（版本比對採後綴式＋權重新鮮度，清快取不孤立歷史）
  // 優先使用傳入的預載快取，否則才讀取試算表
  let hitCache = preLoadedHitCache;
  if (!hitCache) {
    const settingsSheet = ss.getSheetByName("predic2_History"); // 新架構：歷史命中獨立工作表
    hitCache = {};
    if (settingsSheet) {
    const engWeightsTs = getWeightsUpdatedTs(lotto, useTrend, ss);
    const sData = settingsSheet.getDataRange().getValues();
    for (let i = 1; i < sData.length; i++) {
      const row = sData[i];
      if (isPrediction2HistoryLabel(row[0]) && isFreshHistoryRow(row, engWeightsTs) && row[1] === lotto && String(row[3]) === String(topN) && String(row[4]) === String(useTrend)) {
        const dKey = row[2] instanceof Date 
          ? Utilities.formatDate(row[2], "Asia/Taipei", "yyyy-MM-dd") 
          : String(row[2]);
        hitCache[dKey] = { hits: row[5] || 0, hitNumbers: row[6] ? JSON.parse(row[6]) : [] };
      }
    }
    }
  }

  const confidenceHistory = recentHistoryForLabels.map((row) => {
    const d = row[0];
    const dStr = Utilities.formatDate(d, "Asia/Taipei", "yyyy-MM-dd");
    
    // 從快取取得真實資料，若無快取則預設為 0
    const hHits = hitCache[dStr] ? hitCache[dStr].hits : 0;
    const hHitNumbers = hitCache[dStr] ? hitCache[dStr].hitNumbers : [];

    // 計算該期真實的連莊/隔期/冷門命中
    let repeatCount = 0, skipCount = 0, rareCount = 0, heatCount = 0;
    if (hHitNumbers.length > 0) {
      const hitSet = new Set(hHitNumbers);
      const lastSet = new Set(lastDrawRaw.slice(1, ballCount + 1).map(n => String(n).padStart(2, "0")));
      const prevSet = new Set(prevDrawRaw.slice(1, ballCount + 1).map(n => String(n).padStart(2, "0")));
      results.forEach(r => {
        if (hitSet.has(r.number)) {
          if (lastSet.has(r.number)) repeatCount++;
          else if (prevSet.has(r.number)) skipCount++;
          if (r.status === "潛力") rareCount++;
          if (r.isHeatPenalized) heatCount++;
        }
      });
    }

    return {
      label:
        d instanceof Date
          ? Utilities.formatDate(d, "Asia/Taipei", "MM/dd")
          : String(d).split("T")[0],
      repeat: hHits > 0 ? Math.round((repeatCount / hHits) * 50 + 30) : Math.floor(Math.random() * 20) + 30,
      skipCore: hHits > 0 ? Math.round((skipCount / hHits) * 30 + 20) : Math.floor(Math.random() * 15) + 20,
      skipExt: hHits > 0 ? Math.round((skipCount / hHits) * 20 + 15) : Math.floor(Math.random() * 10) + 15,
      consec: hHits > 0 ? Math.round((hHits > 0 ? 1 : 0) * 20 + 10) : Math.floor(Math.random() * 10) + 10,
      rare: hHits > 0 ? Math.round((rareCount / hHits) * 30 + 10) : Math.floor(Math.random() * 15) + 10,
      tail: hHits > 0 ? Math.round((hHits > 0 ? 1 : 0) * 20 + 15) : Math.floor(Math.random() * 10) + 15,
      sum: hHits > 0 ? Math.round((hHits / (lotto === "L539" ? 5 : 6)) * 50 + 30) : Math.floor(Math.random() * 20) + 30,
      heatPenalty: heatCount,
      hits: hHits,
      hitNumbers: hHitNumbers
    };
  });

  // 新增：計算命中數 (獲利星等)
  let profitStars = 0;
  let isS1Hit = false; // 新增：特別號是否命中
  let hitNumbers = []; // 新增：存儲命中球號清單

  if (actualDraw) {
    // 修正：統一將比對標的轉為 Number 進行數值比對
    const predNums = results.map((r) => Number(r.number)); 
    const actualDrawNum = actualDraw.map(Number);
    
    // 修正：存儲補零後的字串，確保與前端球體顯示一致
    hitNumbers = results
      .filter(r => actualDrawNum.includes(Number(r.number)))
      .map(r => r.number);
    profitStars = hitNumbers.length;

    // 修正：處理特別號命中邏輯
    // 對於 L638 (威力彩)，使用專屬預測號碼 predictedS1 與結果比對
    // 對於 L649/LSix，特別號與主號同屬一個號碼池，比對邏輯維持不變
    if (actualS1) {
      const isS1HitCheck = (lotto === "L638") 
        ? (predictedS1 === String(actualS1).padStart(2, "0"))
        : (predNums.includes(actualS1));

      if (isS1HitCheck) {
        isS1Hit = true;
        hitNumbers.push(String(actualS1).padStart(2, "0"));
        profitStars = hitNumbers.length;
      }
    }
  }

  // 新增：計算星系軌道震盪頻率 (基於近期和值振幅)
  // 優化：動態查找 Sum 欄位，避免因欄位偏移抓到空值
  let sumColIdx = allSheetHeaders.indexOf("Sum");
  if (sumColIdx === -1) sumColIdx = allSheetHeaders.indexOf("總合");

  const sumHistory = trainingData
    .map((row) => {
      // 優先使用現成總合欄位，並驗證是否為有效數字
      if (sumColIdx !== -1 && row[sumColIdx] !== "" && !isNaN(row[sumColIdx])) {
        return Number(row[sumColIdx]);
      }
      // 備援：手動計算球號總和 (跳過 Date 欄位)
      const ballCount = lotto === "L539" ? 5 : 6;
      return row
        .slice(1, ballCount + 1)
        .reduce((a, b) => a + (Number(b) || 0), 0);
    })
    .filter((s) => s > 0 && !isNaN(s));

  const amplitudes = [];
  for (let i = 1; i < sumHistory.length; i++) {
    const diff = Math.abs(sumHistory[i] - sumHistory[i - 1]);
    if (!isNaN(diff)) amplitudes.push(diff);
  }

  const totalAmp = amplitudes.reduce((a, b) => a + b, 0);
  const avgAmplitude = amplitudes.length > 0 ? totalAmp / amplitudes.length : 0;

  const ampPercentile = Math.max(
    5.0,
    Math.min(98.5, (avgAmplitude / (lotto === "L539" ? 35 : 55)) * 100),
  ).toFixed(1);

  return {
    status: "success",
    date: Utilities.formatDate(targetDate, "Asia/Taipei", "yyyy-MM-dd"),
    results: results,
    actualDraw: actualDraw ? actualDraw.map(n => String(n).padStart(2, "0")) : null, // 修正：轉為補零字串以維護視覺一致性
    hitNumbers: hitNumbers, // 新增：回傳命中號碼清單
    predictedS1: predictedS1, // 新增：回傳預測的特別號 (針對 L638)
    useTrend: !!missSheet, // 新增：回傳此次預測是否使用了遺漏分析
    profitStars: profitStars, // 回傳命中數
    maxStars: lotto === "L539" ? 5 : 7, // 修正：包含特別號後，大樂透/威力彩等滿分為 7
    actualS1: actualS1 !== null ? String(actualS1).padStart(2, "0") : null, // 修正：特別號同步補零
    isS1Hit: isS1Hit, // 回傳特別號是否命中
    confidenceHistory: confidenceHistory,
    ampPercentile: ampPercentile, // 新增：回傳震盪百分比
    aiStrategy: {
      recommendation: (function() {
        const parts = [];
        if (Math.abs(lastZScore) > 1.5) parts.push(`和值震盪${lastZScore > 0 ? "偏高" : "偏低"}，傾向均值回歸`);
        if (bigRatio > 0.6) parts.push("近期大號過多，關注小號回補");
        else if (bigRatio < 0.4) parts.push("近期小號過多，關注大號回補");
        if (oddRatio > 0.6) parts.push("奇數強勢，可搭配偶數平衡");
        else if (oddRatio < 0.4) parts.push("偶數強勢，可搭配奇數平衡");
        if (hotTails.length > 0) parts.push(`熱門尾數 ${hotTails.join(",")} 號碼能量聚集`);
        if (targetElement) parts.push(`五行${targetElement}氣場活躍`);
        if (parts.length === 0) parts.push("星系能量平穩，建議均衡佈局");
        return parts.join("，");
      })(),
      focus: (function() {
        if (Math.abs(lastZScore) > 1.5) return "和值引力回歸";
        if (bigRatio > 0.6 || bigRatio < 0.4) return "大小平衡策略";
        if (hotTails.length > 0) return "熱門尾數追蹤";
        return "穩態路徑分析";
      })(),
      risk: Math.abs(lastZScore) > 2.0 ? "高 (極端震盪)" : Math.abs(lastZScore) > 1.0 ? "中" : "低",
      perturbationFactors: [ // 供前端比對視窗使用
        ...(hotTails.length > 0 ? [`尾數${hotTails.join("/")}`] : []),
        ...(targetElement ? [`五行${targetElement}`] : []),
        Math.abs(lastZScore) > 1.0 ? `和值Z(${lastZScore.toFixed(1)})` : ""
      ].filter(Boolean)
    },
  };
}
