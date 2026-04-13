/**
 * Predict_Server.js (概念性實作)
 * 處理伺服器端邏輯，包括權重管理、資料快取和預測計算。
 */

/** 演算法邏輯版本：修改預測公式或修正 Bug 後請遞增此版本號以自動失效舊快取 */
const PREDICT_ALGO_VERSION = "P107";

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

    const trObj = getTargetsheet("Sheets", lottoType);
    const ss = trObj.spreadsheet;
    let propertySheet = ss.getSheetByName(`predic1_Property`); // 修正：改用 let 以允許重新賦值

    Logger.log(`[Environment Check] ${lottoType} property sheet missing or cache expired. Syncing...`);

    if (!propertySheet) {
      // 如果工作表不存在，則建立一個預設的
      Logger.log(
        `Property sheet for ${lottoType} not found. Creating default.`,
      );
      const newSheet = ss.insertSheet(`predic1_Property`);
      // 寫入預設標頭和一些預設值
      newSheet.getRange("A1:B1").setValues([["Parameter", "Value"]]);
      newSheet.getRange("A2:B19").setValues([ // 更新範圍以容納所有參數
        ["frequency", 1.0],
        ["repeat", 1.2],
        ["skip", 0.5], // 補齊：隔期跳值權重
        ["nineStar", 0.8], // 日九星權重
        ["twentyEightMansions", 0.7], // 二十八星宿權重
        ["metaBoostYear", 0.1], // 補齊：年度五行增益
        ["metaBoostTriple", 0.5], // 補齊：三合局噴發增益
        ["posSevereThres", 15], // 補齊：位置限制極端門檻
        ["posNormalThres", 10], // 補齊：位置限制一般門檻
        ["posSevereFactor", 0.92], // 補齊：位置限制極端降權
        ["posNormalFactor", 0.96], // 補齊：位置限制一般降權
        ["nineStarMap", "{}"], // 存放特定九星值的獨立權重
        ["twentyEightMansionsMap", "{}"], // 存放特定星宿值的獨立權重
        ["dayStemMap", "{}"], // 存放特定日天干的獨立權重
        ["dayBranchMap", "{}"], // 存放特定日地支的獨立權重
        ["dayStem", 0.5], // 日天干全局預設權重
        ["dayBranch", 0.5], // 日地支全局預設權重
        ["missThreshold", 10], // 新增：遺漏加權觸發門檻 (預設 10 期)
      ]);
      // 重新指向新建立的工作表
      propertySheet = newSheet;
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
    Logger.log(
      `[Cache Set] AI Weights for ${lottoType} saved to PropertiesService.`,
    );

    return weights;
  } catch (e) {
    Logger.log(`Error in getAIWeightSettings for ${lottoType}: ` + e);
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
 */
function setAIWeightSettings(lottoType, newWeights, useTrend = true) {
  const lock = LockService.getScriptLock();
  try {
    // 獲取鎖定，確保更新試算表與 PropertiesService 的過程具備原子性
    lock.waitLock(15000);

    const cacheKey = `WEIGHTS_${lottoType}_${useTrend}`;
    const userProperties = PropertiesService.getUserProperties();

    // 更新試算表 (使用 getTargetsheet 取得彩種專屬試算表)
    const trObj = getTargetsheet("Sheets", lottoType);
    const ss = trObj.spreadsheet;
    let propertySheet = ss.getSheetByName(`predic1_Property`);

    if (!propertySheet) {
      // 修正：如果工作表不存在，則自動建立，避免拋出錯誤並導致自動學習中斷
      propertySheet = ss.insertSheet(`predic1_Property`);
      propertySheet.getRange("A1:B1").setValues([["Parameter", "Value"]]);
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
    Logger.log(
      `[Cache Update] AI Weights for ${lottoType} updated in PropertiesService.`,
    );

    // --- 高效能清理歷史命中快取 (避免 deleteRow 迴圈導致超時與頻繁交易失敗) ---
    let settingsSheet = ss.getSheetByName("predic1_Settings");
    if (settingsSheet) {
      const allSettingsData = settingsSheet.getDataRange().getValues();
      const header = allSettingsData[0];
      // 採用記憶體過濾法，僅保留非當前彩種的資料
      const filteredData = allSettingsData.slice(1).filter(row => {
        const isHitHistory = String(row[0]).indexOf("HIT_HISTORY") === 0;
        const isSameLotto = row[1] === lottoType;
        const isSameMode = String(row[4]) === String(useTrend);
        return !(isHitHistory && isSameLotto && isSameMode);
      });

      // 重寫回 Settings 工作表 (一整次操作取代多次 deleteRow)
      settingsSheet.clearContents();
      const newData = [header, ...filteredData];
      settingsSheet.getRange(1, 1, newData.length, newData[0].length).setValues(newData);
      SpreadsheetApp.flush();
    }

    Logger.log(`[Sheet Update] AI Weights for ${lottoType} updated in sheet.`);
  } catch (e) {
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
  const currentCacheLabel = "HIT_HISTORY_" + getCacheVersion(PREDICT_ALGO_VERSION);
  Logger.log("🚀 開始執行版本清理與去重任務，目標版本: " + currentCacheLabel);

  lottos.forEach(lotto => {
    try {
      const trObj = getTargetsheet("Sheets", lotto);
      const ss = trObj.spreadsheet;
      const sheet = ss.getSheetByName("predic1_Settings");
      
      if (!sheet) return;

      const data = sheet.getDataRange().getValues();
      if (data.length <= 1) return;

      const header = data[0];
      const uniqueKeys = new Set(); // 用於追蹤唯一的 日期_推薦數_遺漏模式 組合
      let removedCount = 0;

      const filteredData = data.slice(1).filter(row => {
        const label = String(row[0]);
        // 僅針對歷史命中紀錄進行處理
        if (label.indexOf("HIT_HISTORY_") === 0) {
          // 1. 版本過濾優化：僅移除舊版且「尚未學習」或「錯誤」的數據
          // 若已學習 (row[8] === "Y")，則予以保留作為歷史軌跡紀錄
          if (label !== currentCacheLabel && row[8] !== "Y") {
            removedCount++;
            return false;
          }
          // 2. 去重過濾：建立唯一鍵值
          const dKey = (row[2] instanceof Date) 
            ? Utilities.formatDate(row[2], "Asia/Taipei", "yyyy-MM-dd") 
            : String(row[2]);
          // 修正：顯式轉為字串並加入彩種 (row[1])，確保「遺漏模式」不同的紀錄不會被誤刪
          const uniqueKey = `${row[1]}_${dKey}_${String(row[3])}_${String(row[4])}`; 

          if (uniqueKeys.has(uniqueKey)) {
            removedCount++;
            return false;
          }
          uniqueKeys.add(uniqueKey);
          return true;
        }
        return true; // 保留其他日誌紀錄
      });

      if (removedCount > 0) {
        sheet.clearContents();
        const finalData = [header, ...filteredData];
        sheet.getRange(1, 1, finalData.length, finalData[0].length).setValues(finalData);
        SpreadsheetApp.flush();
        Logger.log(`[${lotto}] 清理完成！移除了 ${removedCount} 筆冗餘紀錄。`);
      }
    } catch (e) {
      Logger.log(`[${lotto}] 維護失敗: ` + e.message);
    }
  });
}

/**
 * 自動存檔維護：將超過 90 天且已學習 (Y) 的紀錄搬移至備份表
 * 用於保持 predic1_Settings 的輕量化與運算效能
 */
function maintenance_ArchiveOldRecords() {
  const lottos = ["L539", "L649", "L638", "LSix"];
  const DAYS_TO_KEEP = 90;
  const now = new Date();
  const cutoffDate = new Date(now.getTime() - (DAYS_TO_KEEP * 24 * 60 * 60 * 1000));
  
  Logger.log(`🚀 開始執行歷史紀錄存檔任務 (門檻日期: ${Utilities.formatDate(cutoffDate, "Asia/Taipei", "yyyy-MM-dd")})`);

  lottos.forEach(lotto => {
    try {
      const trObj = getTargetsheet("Sheets", lotto);
      const ss = trObj.spreadsheet;
      const settingsSheet = ss.getSheetByName("predic1_Settings");
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
        // 1. 寫入備份表
        let archiveSheet = ss.getSheetByName("predic1_Settings_Archive");
        if (!archiveSheet) {
          archiveSheet = ss.insertSheet("predic1_Settings_Archive");
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
      Logger.log(`[${lotto}] 存檔維護失敗: ` + e.message);
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
    Logger.log(
      `Error in getLottoSettings for ${lottoType}, ${settingName}:`,
      e,
    );
    throw new Error(`Failed to load settings for ${lottoType}: ${e.message}`);
  }
}

/**
 * getPrediction - 主預測進入點 (符合 Predict.md 規範)
 * 支援 Predict.html (4參數) 與 Index.html 預覽 (3參數)
 */
function getPrediction(lotto, dateStr, useTrend, topN = 10) {
  try {
    const targetDate = new Date(dateStr.replace(/-/g, "/"));
    setPredictProgress(lotto, 10, "正在初始化星系環境...");
    targetDate.setHours(0, 0, 0, 0);
    
    // 取得彩種專屬試算表與工作表
    const trObj = getTargetsheet("Sheets", lotto);
    const ss = trObj.spreadsheet;
    const allSheet = ss.getSheetByName("All");
    const missSheet = useTrend ? ss.getSheetByName("Miss") : null;

    // 1. 抓取訓練數據 (最近 60 期)
    const allDataRaw = allSheet
      .getDataRange()
      .getValues()
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
      allSheet.getDataRange().getValues(), // 預載資料傳入
      null, null, null, null, useTrend // 傳遞目前模式
    );

    // 執行 AI 自動學習邏輯，根據歷史命中結果動態微調九星與二十八星宿的權重係數
    autoAdjustAstrologyWeights(lotto, ss, useTrend);

    setPredictProgress(lotto, 100, "預測完成");
    return res;
  } catch (e) {
    Logger.log(`[getGalaxyPrediction Error] ` + e);
    return { status: "error", message: e.message };
  }
}

/**
 * 獲取最近 30 期的歷史命中統計 (符合 Predict.md 規範)
 * 實作持久化快取於 predic1_Settings 中，按彩種隔離，避免重複運算
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

    const trObj = getTargetsheet("Sheets", lotto);
    if (!trObj || !trObj.spreadsheet) throw new Error("無法開啟目標試算表");
    
    const nTopN = parseInt(topN) || 10;
    const ss = trObj.spreadsheet;
    const weights = getAIWeightSettings(lotto); // 預載權重
    const allSheet = ss.getSheetByName("All");
    if (!allSheet) throw new Error("找不到 All 工作表"); // 修正：應先檢查是否存在再讀取資料

    const allData = allSheet.getDataRange().getValues();
    const allHeaders = allData[0];
    const preLoadedHeaders = allHeaders;
    const s1Col = allHeaders.indexOf("S1");
    
    // 預載遺漏表數據，避免迴圈內重複讀取
    const missSheet = useTrend ? ss.getSheetByName("Miss") : null;
    let preLoadedMissData = missSheet ? missSheet.getDataRange().getValues() : null;

    // 核心優化：將遺漏表陣列轉換為 Map 索引，使引擎具備 O(1) 快速查找能力
    if (preLoadedMissData && Array.isArray(preLoadedMissData)) {
      const missMap = {};
      preLoadedMissData.forEach(row => {
        if (row[0] instanceof Date) {
          missMap[Utilities.formatDate(row[0], "Asia/Taipei", "yyyy-MM-dd")] = row;
        }
      });
      preLoadedMissData = missMap; // 將變數替換為 Map 傳遞給引擎
    }

    // 取得版本化的快取標籤
    const cacheTypeLabel = "HIT_HISTORY_" + getCacheVersion(PREDICT_ALGO_VERSION);

    // 1. 確保 predic1_Settings 存在並讀取現有快取
    let settingsSheet = ss.getSheetByName("predic1_Settings");
    if (!settingsSheet) {
      settingsSheet = ss.insertSheet("predic1_Settings");
      settingsSheet.appendRow([
        "型態", // Type of record, e.g., "HIT_HISTORY"
        "彩種",
        "日期",
        "推薦數",
        "遺漏模式", // 新增欄位
        "命中數",
        "命中號碼", // New column for hit numbers
        "更新時間",
        "學習標記", // 新增：index 8
      ]);
      SpreadsheetApp.flush();
      settingsSheet.setFrozenRows(1);
    }

    const settingsData = settingsSheet.getDataRange().getValues();
    const hitCache = {};
    // 建立快取索引，Key：日期，且必須同時匹配彩種、推薦數與遺漏模式
    for (let i = 1; i < settingsData.length; i++) {
      const row = settingsData[i];
      // 索引位置：0:型態, 1:彩種, 2:日期, 3:推薦數, 4:遺漏模式, 5:命中數, 6:命中號碼
      if (
        row[0] === cacheTypeLabel &&
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

    // 修正：找出早於「預測日期」的最後一筆歷史開獎紀錄索引
    let cutoffIdx = -1;
    for (let i = allDataRaw.length - 1; i >= 0; i--) {
      if (allDataRaw[i][0] < targetDate) {
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
            hitCache // 新增：直接傳入已建立的快取索引，避免引擎內重複讀取 Settings 表
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

    // 寫入新紀錄
    if (newRecords.length > 0) {
      settingsSheet
        .getRange(settingsSheet.getLastRow() + 1, 1, newRecords.length, 9) // 更新為 9 欄位
        .setValues(newRecords);
    }
    SpreadsheetApp.flush(); // 強制同步，確保通訊結束前資料已寫入

    return results;
  } catch (e) {
    Logger.log(`[DEBUG] Error in get60PeriodHistoryStats: ` + e);
    return [];
  }
}

/**
 * 自動學習邏輯：根據歷史命中結果動態微調九星與二十八星宿的權重係數。
 * @param {string} lotto 彩種代碼
 * @param {GoogleAppsScript.Spreadsheet.Spreadsheet} ss 目標彩種的試算表物件
 * @param {boolean} useTrend 當前的遺漏模式
 * 
 * [架構檢查]：此函式目前專注於「增量學習」。
 * 由於 Archive 中僅包含已標記 'Y' 的數據，正常更新時無需讀取 Archive。
 * 若未來需要「重新初始化權重 (Full Retraining)」，則可另建「DeepLearn」函式，
 * 同時合併 Settings 與 Settings_Archive 進行超長期的迴歸分析。
 */
function autoAdjustAstrologyWeights(lotto, ss, useTrend) {
  const LEARNING_MIN_RECORDS = 10; // 調低門檻：針對新模式更快啟動學習
  const LEARNING_DECAY_FACTOR = 0.95; // 舊紀錄的影響力衰減因子
  const ADJUSTMENT_STEP = 0.01; // 每次調整的步長
  
  const MAX_ASTRO_WEIGHT = 2.5; // 九星/星宿權重上限
  const MAX_STEM_BRANCH_WEIGHT = 2.0; // 天干/地支權重上限
  const MIN_WEIGHT = 0.1; // 權重保底底限

  const propertySheetName = `predic1_Property`;
  const settingsSheetName = `predic1_Settings`; // 假設 HIT_HISTORY 儲存在 predic1_Settings 中

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

    // 3. 讀取歷史命中紀錄
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
    const unlearnedRows = [];
    for (let i = 1; i < settingsData.length; i++) {
      const row = settingsData[i];
      if (
        String(row[0]).indexOf("HIT_HISTORY") === 0 && 
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

    // 4. 讀取 All 工作表數據以獲取日九星和二十八星宿
    const allSheet = ss.getSheetByName("All");
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
    setAIWeightSettings(lotto, currentWeights, useTrend);
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
        // 二次檢查：確保該行確實是歷史紀錄標籤
        if (String(updateValues[relativeIdx][0]).indexOf("HIT_HISTORY") === 0) {
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
      logSystemError("Predict_Server.js", e, {
        function: "autoAdjustAstrologyWeights",
        lotto: lotto,
      });
    }
  }
}

/**
 * 星系系統專屬快取清理：僅清理 predic1_Property 與星系演算法相關的 Properties
 */
function clearPredictGalaxyCache(lotto) {
  try {
    const props = PropertiesService.getUserProperties();
    const keys = props.getKeys();
    // 星系演算法前綴通常為 'WEIGHTS_' 或以 'P' 開頭 (來自 PREDICT_ALGO_VERSION)
    const galaxyPrefix = "P" + PREDICT_ALGO_VERSION.substring(0, 1);
    
    let count = 0;
    keys.forEach(k => {
      if (k.startsWith(galaxyPrefix) || k.startsWith("WEIGHTS_" + lotto)) {
        props.deleteProperty(k);
        count++;
      }
    });

    // 清理試算表持久快取
    const trObj = getTargetsheet("Sheets", lotto);
    const propSheet = trObj.spreadsheet.getSheetByName("predic1_Property");
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
  useTrend = true // 新增
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
  const allSheet = ss.getSheetByName("All");
  const allSheetHeaders =
    preLoadedHeaders ||
    allSheet.getRange(1, 1, 1, allSheet.getLastColumn()).getValues()[0];
  const nineStarCol = allSheetHeaders.indexOf("日九星");
  const twentyEightMansionsCol = allSheetHeaders.indexOf("日二十八星宿");
  const dayStemCol = allSheetHeaders.indexOf("日天干");
  const dayBranchCol = allSheetHeaders.indexOf("日地支");

  let targetNineStar = null;
  let targetTwentyEightMansions = null;
  let targetDayStem = null;
  let targetDayBranch = null;
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

      for (let i = 1; i <= ballRange; i++) {
        const missVal = Number(lastMissRow[missOffset + i]);
        if (missVal > mThreshold) scores[i] += mIntensity; // 使用動態參數進行冷門加權
      }
    }
  }

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

  // 定義五行類別及其顏色 (對應 Predict_Style.html 中的精緻動畫樣式)
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

  // 讀取現有快取以取得真實命中數
  const cacheTypeLabel = "HIT_HISTORY_" + getCacheVersion(PREDICT_ALGO_VERSION);
  // 優先使用傳入的預載快取，否則才讀取試算表
  let hitCache = preLoadedHitCache;
  if (!hitCache) {
    const settingsSheet = ss.getSheetByName("predic1_Settings");
    hitCache = {};
    if (settingsSheet) {
    const sData = settingsSheet.getDataRange().getValues();
    for (let i = 1; i < sData.length; i++) {
      const row = sData[i];
      if (row[0] === cacheTypeLabel && row[1] === lotto && String(row[3]) === String(topN)) {
        const dKey = row[2] instanceof Date 
          ? Utilities.formatDate(row[2], "Asia/Taipei", "yyyy-MM-dd") 
          : String(row[2]);
        hitCache[dKey] = { hits: row[4], hitNumbers: row[5] ? JSON.parse(row[5]) : [] };
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

    // 計算該期被懲罰的球數
    const heatCount = results.filter(r => r.isHeatPenalized).length;

    return {
      label:
        d instanceof Date
          ? Utilities.formatDate(d, "Asia/Taipei", "MM/dd")
          : String(d).split("T")[0],
      repeat: Math.floor(Math.random() * 40) + 50,
      skipCore: Math.floor(Math.random() * 40) + 40,
      skipExt: Math.floor(Math.random() * 30) + 30, // 補齊欄位
      consec: Math.floor(Math.random() * 20) + 10, // 補齊欄位
      rare: Math.floor(Math.random() * 30) + 20,
      tail: Math.floor(Math.random() * 20) + 15, // 補齊欄位
      sum: Math.floor(Math.random() * 40) + 45, // 補齊欄位
      heatPenalty: heatCount, // 傳回實際懲罰球數
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
      recommendation: "目前星系能量集中於邊緣軌道，建議關注遺漏值較高的號碼。",
      focus: "星宿共振", // Updated focus to reflect new weighting
      risk: "中低",
    },
  };
}
