/**
 * Predict_Server.js (概念性實作)
 * 處理伺服器端邏輯，包括權重管理、資料快取和預測計算。
 */

/**
 * 獲取指定彩種的 AI 學習權重設定。
 * 優先從 PropertiesService 快取中讀取，若無則從試算表讀取並寫入快取。
 * @param {string} lottoType 彩種類型 (e.g., "L539", "L649")
 * @returns {Object} 該彩種的權重設定物件
 */
function getAIWeightSettings(lottoType) {
  try {
    const cacheKey = `WEIGHTS_${lottoType}`;
    const userProperties = PropertiesService.getUserProperties();

    // 嘗試從 PropertiesService 讀取快取
    const cachedWeights = userProperties.getProperty(cacheKey);
    if (cachedWeights) {
      Logger.log(
        `[Cache Hit] AI Weights for ${lottoType} loaded from PropertiesService.`,
      );
      return JSON.parse(cachedWeights);
    }

    Logger.log(
      `[Cache Miss] AI Weights for ${lottoType} not found in PropertiesService. Loading from sheet.`,
    );

    // 如果快取中沒有，則從試算表讀取 (使用 getTargetsheet 取得彩種專屬試算表)
    const trObj = getTargetsheet("Sheets", lottoType);
    const ss = trObj.spreadsheet;
    let propertySheet = ss.getSheetByName(`predic1_Property`); // 修正：改用 let 以允許重新賦值

    if (!propertySheet) {
      // 如果工作表不存在，則建立一個預設的
      Logger.log(
        `Property sheet for ${lottoType} not found. Creating default.`,
      );
      const newSheet = ss.insertSheet(`predic1_Property`);
      // 寫入預設標頭和一些預設值
      newSheet.getRange("A1:B1").setValues([["Parameter", "Value"]]);
      newSheet.getRange("A2:B11").setValues([
        ["frequency", 1.0],
        ["repeat", 1.2],
        ["nineStar", 0.8], // 日九星權重
        ["twentyEightMansions", 0.7], // 二十八星宿權重
        ["nineStarMap", "{}"], // 存放特定九星值的獨立權重
        ["twentyEightMansionsMap", "{}"], // 存放特定星宿值的獨立權重
        ["dayStemMap", "{}"], // 存放特定日天干的獨立權重
        ["dayBranchMap", "{}"], // 存放特定日地支的獨立權重
        ["dayStem", 0.5], // 日天干全局預設權重
        ["dayBranch", 0.5], // 日地支全局預設權重
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
  }
}

/**
 * 更新指定彩種的 AI 學習權重設定。
 * 同步更新試算表和 PropertiesService 快取。
 * @param {string} lottoType 彩種類型 (e.g., "L539", "L649")
 * @param {Object} newWeights 新的權重設定物件
 */
function setAIWeightSettings(lottoType, newWeights) {
  try {
    const cacheKey = `WEIGHTS_${lottoType}`;
    const userProperties = PropertiesService.getUserProperties();

    // 更新 PropertiesService 快取
    userProperties.setProperty(cacheKey, JSON.stringify(newWeights));
    Logger.log(
      `[Cache Update] AI Weights for ${lottoType} updated in PropertiesService.`,
    );

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

    // 清空現有資料 (除了標頭)
    const lastRow = propertySheet.getLastRow();
    if (lastRow > 1) {
      propertySheet.getRange(2, 1, lastRow - 1, 2).clearContent();
    }

    // 寫入新的權重資料
    const dataToWrite = Object.entries(newWeights).map(([key, value]) => {
      return [key, typeof value === "object" ? JSON.stringify(value) : value];
    });

    if (dataToWrite.length > 0) {
      propertySheet
        .getRange(2, 1, dataToWrite.length, 2)
        .setValues(dataToWrite);
    }
    Logger.log(`[Sheet Update] AI Weights for ${lottoType} updated in sheet.`);
  } catch (e) {
    Logger.log(`Error in setAIWeightSettings for ${lottoType}: ` + e);
    throw new Error(
      `Failed to update AI weights for ${lottoType}: ${e.message}`,
    );
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
 * getGalaxyPrediction - Predict.html 專屬的主預測進入點 (符合 Predict.md 規範)
 */
function getGalaxyPrediction(lotto, dateStr, useTrend, topN) {
  try {
    const targetDate = new Date(dateStr.replace(/-/g, "/"));
    setPredictProgress(lotto, 10, "正在初始化星系環境...");

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
    );

    // 執行 AI 自動學習邏輯，根據歷史命中結果動態微調九星與二十八星宿的權重係數
    autoAdjustAstrologyWeights(lotto, ss);

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
 * @returns {Array} 包含日期與命中數的物件陣列
 */
function get60PeriodHistoryStats(lotto, topN, targetDateStr) {
  try {
    let targetDate = targetDateStr
      ? new Date(targetDateStr.replace(/-/g, "/"))
      : new Date();
    targetDate.setHours(0, 0, 0, 0); // 統一時間基準，避免時分秒導致的比對偏差

    const trObj = getTargetsheet("Sheets", lotto);
    const nTopN = parseInt(topN) || 10;
    const ss = trObj.spreadsheet;
    const weights = getAIWeightSettings(lotto); // 預載權重
    const allSheet = ss.getSheetByName("All");
    if (!allSheet) throw new Error("找不到 All 工作表"); // 修正：應先檢查是否存在再讀取資料

    const allData = allSheet.getDataRange().getValues();
    const allHeaders = allData[0];
    const preLoadedHeaders = allHeaders;
    const s1Col = allHeaders.indexOf("S1");

    // 1. 確保 predic1_Settings 存在並讀取現有快取
    let settingsSheet = ss.getSheetByName("predic1_Settings");
    if (!settingsSheet) {
      settingsSheet = ss.insertSheet("predic1_Settings");
      settingsSheet.appendRow([
        "型態", // Type of record, e.g., "HIT_HISTORY"
        "彩種",
        "日期",
        "推薦數",
        "命中數",
        "命中號碼", // New column for hit numbers
        "更新時間",
      ]);
      settingsSheet.setFrozenRows(1);
    }

    const settingsData = settingsSheet.getDataRange().getValues();
    const hitCache = {};
    // 建立快取索引，確保 Key 為字串，避免類型不匹配導致查找失敗
    for (let i = 1; i < settingsData.length; i++) {
      const row = settingsData[i];
      // 優化：僅載入與當前彩種及推薦數相符的快取，並簡化 Key 結構以提升比對效能
      if (row[0] === "HIT_HISTORY" && row[1] === lotto && String(row[3]) === String(nTopN)) {
        const dKey =
          row[2] instanceof Date
            ? Utilities.formatDate(row[2], "Asia/Taipei", "yyyy-MM-dd")
            : String(row[2]);
        hitCache[dKey] = {
          hits: row[4],
          hitNumbers: row[5] ? JSON.parse(row[5]) : [], // Parse hitNumbers from JSON string
        };
      }
    }

    // 取得歷史開獎資料
    const allDataRaw = allData.filter((row) => row[0] instanceof Date);
    const missSheet = ss.getSheetByName("Miss"); // 統一在此處宣告

    // 修正：找出早於「預測日期」的最後一筆歷史開獎紀錄索引
    let cutoffIdx = -1;
    for (let i = allDataRaw.length - 1; i >= 0; i--) {
      if (allDataRaw[i][0] < targetDate) {
        cutoffIdx = i;
        break;
      }
    }

    if (cutoffIdx === -1) return []; // 若無可用歷史資料則回傳空

    const limit = 30; // 固定為 30 期
    const startIndex = Math.max(0, cutoffIdx - limit + 1);
    const recentData = allDataRaw.slice(startIndex, cutoffIdx + 1); // 從切點往前切出 30 期

    const newRecords = [];
    const results = recentData.map((row, index) => {
      const dateFull = Utilities.formatDate(row[0], "Asia/Taipei", "yyyy-MM-dd");
      const dateShort = Utilities.formatDate(row[0], "Asia/Taipei", "MM/dd");
      const cacheKey = dateFull;

      if (hitCache[cacheKey] !== undefined) {
        return {
          date: dateShort,
          hits: hitCache[cacheKey].hits,
          hitNumbers: hitCache[cacheKey].hitNumbers || [],
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
        if (actualNums.length === 0)
          return { date: dateShort, hits: 0, hitNumbers: [] };

        // 取得訓練資料
        const targetIdxInRaw = allDataRaw.findIndex(
          (r) => r[0].getTime() === row[0].getTime(),
        );
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
            missSheet, // Pass missSheet as is, it will be used to get the last miss row before targetDate
            row[0], // The historical date itself is the targetDate for this backtest
            nTopN,
            ss,
            allData,
            weights, // 傳入預載權重
            preLoadedHeaders, // 傳入預載標頭
          );

          if (predResult && predResult.results) {
            const predictedNums = predResult.results.map((item) =>
              Number(item.number),
            );
            hitNumbers = predictedNums.filter((num) =>
              actualNums.includes(num),
            );

            // 歷史回測同步比對特別號 (S1)
            if (
              lotto !== "L539" &&
              s1Col !== -1 &&
              row[s1Col] !== undefined &&
              row[s1Col] !== ""
            ) {
              const histS1 = Number(row[s1Col]);
              if (predictedNums.includes(histS1)) {
                hitNumbers.push(histS1);
              }
            }

            hits = hitNumbers.length;
          }
        }

        newRecords.push([
          "HIT_HISTORY",
          lotto,
          dateFull,
          nTopN,
          hits,
          JSON.stringify(hitNumbers), // Store hitNumbers as JSON string
          new Date(),
        ]);
      } catch (e) {
        Logger.log(`History backtest error: ${dateFull} ` + e);
        // In case of error, still push a record to avoid re-calculating this failed entry
        newRecords.push([
          "HIT_HISTORY",
          lotto,
          dateFull,
          nTopN, // 修正：確保寫入的是解析後的數值，避免型別不一致
          0, // 0 hits on error
          JSON.stringify([]), // Empty hit numbers on error
          new Date(),
        ]);
      }

      return { date: dateShort, hits: hits, hitNumbers: hitNumbers };
    });

    // 寫入新紀錄
    if (newRecords.length > 0) {
      settingsSheet
        .getRange(settingsSheet.getLastRow() + 1, 1, newRecords.length, 7) // Updated column count to 7
        .setValues(newRecords);
    }

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
 */
function autoAdjustAstrologyWeights(lotto, ss) {
  const LEARNING_MIN_RECORDS = 20; // 至少需要 20 筆歷史命中紀錄才啟動學習
  const LEARNING_DECAY_FACTOR = 0.95; // 舊紀錄的影響力衰減因子
  const ADJUSTMENT_STEP = 0.01; // 每次調整的步長

  const propertySheetName = `predic1_Property`;
  const settingsSheetName = `predic1_Settings`; // 假設 HIT_HISTORY 儲存在 predic1_Settings 中

  try {
    // 1. 檢查上次學習時間，避免頻繁執行
    const lastLearningTimestampKey = `LAST_ASTRO_LEARN_TS_${lotto}`;
    const lastLearningTimestamp = getPropertySheetValue(
      propertySheetName,
      lastLearningTimestampKey,
      0,
      ss,
    );
    const now = new Date().getTime();
    const COOLDOWN_PERIOD = 24 * 60 * 60 * 1000; // 24 小時冷卻期

    if (now - lastLearningTimestamp < COOLDOWN_PERIOD) {
      Logger.log(
        `[AutoLearn] Astrology weights for ${lotto} are in cooldown. Skipping learning.`,
      );
      return;
    }

    // 2. 取得當前權重
    let currentWeights = getAIWeightSettings(lotto);
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
    const settingsData = settingsSheet.getDataRange().getValues();
    const hitHistory = settingsData.filter(
      (row) => row[0] === "HIT_HISTORY" && row[1] === lotto,
    );

    if (hitHistory.length < LEARNING_MIN_RECORDS) {
      Logger.log(
        `[AutoLearn] Not enough historical hit records (${hitHistory.length}) for ${lotto}. Skipping learning.`,
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
        const formattedDate = Utilities.formatDate(
          rowDate,
          "GMT+8",
          "yyyy-MM-dd",
        );
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

    // 遍歷歷史命中紀錄，從最新紀錄開始，並應用衰減因子
    for (let i = hitHistory.length - 1; i >= 0; i--) {
      const row = hitHistory[i];
      const recordDateStr = Utilities.formatDate(row[2], "GMT+8", "yyyy-MM-dd"); // row[2] is the date
      const hits = row[4]; // row[4] is the hits count
      const topN = row[3]; // row[3] is topN
      const maxPossibleHits = lotto === "L539" ? 5 : 6; // 假設最大命中數為球數

      const astroData = astroDataMap[recordDateStr];

      if (astroData) {
        const effectiveness = hits / Math.min(topN, maxPossibleHits); // 命中率作為有效性指標
        const decayFactor = Math.pow(
          LEARNING_DECAY_FACTOR,
          hitHistory.length - 1 - i,
        );

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
    }

    // 計算整體平均命中率作為基準
    const overallAvgHits =
      hitHistory.reduce((sum, row) => sum + row[4], 0) / hitHistory.length;
    const overallAvgEffectiveness = overallAvgHits / (lotto === "L539" ? 5 : 6); // 根據最大可能命中數進行正規化

    // 6. 調整個別九星、星宿、天干、地支權重
    Object.keys(nineStarStats).forEach((val) => {
      const avg = nineStarStats[val].sum / nineStarStats[val].count;
      let w = currentWeights.nineStarMap[val] || currentWeights.nineStar || 0.8;

      if (avg > overallAvgEffectiveness * 1.1)
        w = Math.min(2.5, w + ADJUSTMENT_STEP);
      else if (avg < overallAvgEffectiveness * 0.9)
        w = Math.max(0.1, w - ADJUSTMENT_STEP);

      currentWeights.nineStarMap[val] = parseFloat(w.toFixed(3));
    });

    Object.keys(mansionStats).forEach((val) => {
      const avg = mansionStats[val].sum / mansionStats[val].count;
      let w =
        currentWeights.twentyEightMansionsMap[val] ||
        currentWeights.twentyEightMansions ||
        0.7;

      if (avg > overallAvgEffectiveness * 1.1)
        w = Math.min(2.5, w + ADJUSTMENT_STEP);
      else if (avg < overallAvgEffectiveness * 0.9)
        w = Math.max(0.1, w - ADJUSTMENT_STEP);

      currentWeights.twentyEightMansionsMap[val] = parseFloat(w.toFixed(3));
    });

    Object.keys(stemStats).forEach((val) => {
      const avg = stemStats[val].sum / stemStats[val].count;
      let w = currentWeights.dayStemMap[val] || currentWeights.dayStem || 0.5;

      if (avg > overallAvgEffectiveness * 1.1)
        w = Math.min(2.0, w + ADJUSTMENT_STEP);
      else if (avg < overallAvgEffectiveness * 0.9)
        w = Math.max(0.1, w - ADJUSTMENT_STEP);

      currentWeights.dayStemMap[val] = parseFloat(w.toFixed(3));
    });

    Object.keys(branchStats).forEach((val) => {
      const avg = branchStats[val].sum / branchStats[val].count;
      let w =
        currentWeights.dayBranchMap[val] || currentWeights.dayBranch || 0.5;

      if (avg > overallAvgEffectiveness * 1.1)
        w = Math.min(2.0, w + ADJUSTMENT_STEP);
      else if (avg < overallAvgEffectiveness * 0.9)
        w = Math.max(0.1, w - ADJUSTMENT_STEP);

      currentWeights.dayBranchMap[val] = parseFloat(w.toFixed(3));
    });

    // 7. 更新權重並記錄學習時間
    setAIWeightSettings(lotto, currentWeights);
    setPropertySheetValue(propertySheetName, lastLearningTimestampKey, now, ss);

    console.log(
      `[AutoLearn] Astrology weights learning completed for ${lotto}.`,
    );
  } catch (e) {
    console.error(
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
) {
  // 1. 取得權重設定
  const weights = preLoadedWeights || getAIWeightSettings(lotto);
  const ballRange = lotto === "L539" || lotto === "L638" ? 39 : 49;
  const scores = {};

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
  const targetDateFormatted = Utilities.formatDate(
    targetDate,
    "GMT+8",
    "yyyy-MM-dd",
  ); // 修正：補回警告訊息所需的變數
  const s1Col = allSheetHeaders.indexOf("S1"); // 動態查找 S1 欄位索引

  for (let i = 1; i < allData.length; i++) {
    const cellDate = allData[i][0];
    if (
      cellDate instanceof Date &&
      Utilities.formatDate(cellDate, "GMT+8", "yyyy-MM-dd") ===
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
      if (scores[num] !== undefined) scores[num] += weights.frequency || 1.0;
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
    // 獲取與 targetDate 相符或最近的歷史遺漏數據
    const missData = missSheet.getDataRange().getValues();
    let lastMissRow = null;
    const targetTime = targetDate.getTime();

    // 從 Miss 工作表的最新數據開始向前查找，直到找到與 targetDate 匹配或在 targetDate 之前的最近一筆數據
    for (let i = missData.length - 1; i >= 1; i--) {
      // 從第二行開始 (跳過標頭)
      const rowDate = missData[i][0];
      if (rowDate instanceof Date && rowDate.getTime() <= targetTime) {
        lastMissRow = missData[i];
        break;
      }
    }

    if (lastMissRow) {
      // 假設 M1~M49 在 All 工作表欄位之後，具體依據 Predict.md 定義
      const missOffset = lotto === "L539" ? 7 : 8;
      for (let i = 1; i <= ballRange; i++) {
        const missVal = Number(lastMissRow[missOffset + i]);
        if (missVal > 10) scores[i] += weights.skip || 0.5; // 冷門反彈加權
      }
    }
  }

  // 5. 排序並選取 TopN
  const sortedBalls = Object.keys(scores)
    .map((num) => ({
      number: String(num).padStart(2, "0"),
      score: scores[num],
      probability:
        Math.min(95, 40 + (scores[num] / trainingData.length) * 100).toFixed(
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

    return {
      ...ball,
      status: status,
      statusColor: statusColor,
      isPotentialCold: status === "潛力",
      elementCategory: elementCategory, // Add element category
      elementColor: elementColor, // Add element color
    };
  });

  // 6. 模擬信心指數歷史 (用於圖表渲染)
  const recentHistoryForLabels = trainingData.slice(-10);
  const confidenceHistory = recentHistoryForLabels.map((row) => {
    const d = row[0];
    return {
      label:
        d instanceof Date
          ? Utilities.formatDate(d, "GMT+8", "MM/dd")
          : String(d).split("T")[0],
      repeat: Math.floor(Math.random() * 40) + 50,
      skipCore: Math.floor(Math.random() * 40) + 40,
      skipExt: Math.floor(Math.random() * 30) + 30, // 補齊欄位
      consec: Math.floor(Math.random() * 20) + 10, // 補齊欄位
      rare: Math.floor(Math.random() * 30) + 20,
      tail: Math.floor(Math.random() * 20) + 15, // 補齊欄位
      sum: Math.floor(Math.random() * 40) + 45, // 補齊欄位
      hits: Math.floor(Math.random() * 4),
    };
  });

  // 新增：計算命中數 (獲利星等)
  let profitStars = 0;
  let isS1Hit = false; // 新增：特別號是否命中
  if (actualDraw) {
    const predNums = results.map((r) => Number(r.number));
    profitStars = predNums.filter((n) => actualDraw.includes(n)).length;

    // 檢查特別號是否命中
    if (actualS1 && predNums.includes(actualS1)) {
      isS1Hit = true;
    }
  }

  // 新增：計算星系軌道震盪頻率 (基於近期和值振幅)
  // 優化：動態查找 Sum 欄位，避免因欄位偏移抓到空值
  const sumColIdx = allSheetHeaders.indexOf("Sum");
  const sumHistory = trainingData
    .map((row) => {
      if (sumColIdx !== -1 && row[sumColIdx] !== "")
        return Number(row[sumColIdx]);
      // 備援：若無 Sum 欄位，則手動計算球號總和
      const ballCount = lotto === "L539" ? 5 : 6;
      return row
        .slice(1, ballCount + 1)
        .reduce((a, b) => a + (Number(b) || 0), 0);
    })
    .filter((s) => s > 0);

  const amplitudes = [];
  for (let i = 1; i < sumHistory.length; i++) {
    amplitudes.push(Math.abs(sumHistory[i] - sumHistory[i - 1]));
  }
  const avgAmplitude =
    amplitudes.length > 0
      ? amplitudes.reduce((a, b) => a + b, 0) / amplitudes.length
      : 0;
  const ampPercentile = Math.max(
    5.0,
    Math.min(98.5, (avgAmplitude / (lotto === "L539" ? 32 : 52)) * 100),
  ).toFixed(1);

  return {
    status: "success",
    date: Utilities.formatDate(targetDate, "GMT+8", "yyyy-MM-dd"),
    results: results,
    actualDraw: actualDraw, // 回傳當日開獎
    profitStars: profitStars, // 回傳命中數
    maxStars: lotto === "L539" ? 5 : 6, // 回傳總球數
    actualS1: actualS1, // 回傳特別號
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
