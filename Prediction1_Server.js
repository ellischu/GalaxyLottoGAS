/** 演算法邏輯版本：當修改 corePredict 權重或公式後，請遞增此版本號以自動失效舊快取 */
const PRCT1_ALGO_VERSION = "A108"; // 結構優化版本

/** 執行緒級別快取，用於減少試算表讀取次數 (效能優化) */
var _prct1_propertyCache = {};

/**
 * 取得彩種核心組態 (封裝硬編碼參數)
 */
function getPrct1LottoConfig(lotto) {
  const configs = {
    // theorySum = k * (n+1) / 2
    // stdDev = sqrt(k * (n+1) * (n-k) / 12)
    L539: {
      ballCount: 5,
      maxNum: 39,
      hasS1: false,
      drawDays: [1, 2, 3, 4, 5, 6],
      theorySum: 100,
      stdDev: 23.8,
    },
    L649: {
      ballCount: 6,
      maxNum: 49,
      hasS1: true,
      drawDays: [2, 5],
      theorySum: 150,
      stdDev: 32.78,
    },
    L638: {
      ballCount: 6,
      maxNum: 38,
      hasS1: true,
      drawDays: [1, 4],
      theorySum: 117,
      stdDev: 24.98,
    },
    LSix: {
      ballCount: 6,
      maxNum: 49,
      hasS1: true,
      drawDays: [2, 4, 6],
      theorySum: 150,
      stdDev: 32.78,
    },
  };
  return configs[lotto] || configs.L539;
}

/**
 * getPrediction01 - 主預測進入點
 */
function getPrediction01(lotto, dateStr, useTrend, topNChoice) {
  try {
    const config = getPrct1LottoConfig(lotto);
    const startTime = Date.now();
    const targetDate = new Date(dateStr.replace(/-/g, "/"));
    targetDate.setHours(0, 0, 0, 0);
    const targetTime = targetDate.getTime();

    setPredictProgress(lotto, 5, "正在啟動星系運算儀...");

    const trObj = getTargetsheet("Sheets", lotto);
    const ss = trObj.spreadsheet;

    const allSheet = ss.getSheetByName("All");
    const missSheet = ss.getSheetByName("Miss");
    const settingsSheet =
      ss.getSheetByName("prct1_Settings") || ss.insertSheet("prct1_Settings");

    // 1. 提取 AllData 中該日期的基本資料 (檢查是否已有答案)
    const mainSs = SpreadsheetApp.getActiveSpreadsheet();
    const adSheet = mainSs.getSheetByName("AllData");
    const adDataAll = adSheet.getDataRange().getValues();

    // 尋找目標日期與前一期的索引以計算變動率
    const targetDateStrFormatted = Utilities.formatDate(
      targetDate,
      "GMT+8",
      "yyyy-MM-dd",
    );
    let targetIdx = -1;
    for (let i = adDataAll.length - 1; i >= 1; i--) {
      const rowDate = adDataAll[i][0];
      if (
        rowDate instanceof Date &&
        Utilities.formatDate(rowDate, "GMT+8", "yyyy-MM-dd") ===
          targetDateStrFormatted
      ) {
        targetIdx = i;
        break;
      }
    }

    const adRow = targetIdx !== -1 ? adDataAll[targetIdx] : null;
    const prevAdRow = targetIdx > 1 ? adDataAll[targetIdx - 1] : null;

    // 1.1 優先從 All 工作表(該彩種原始資料)尋找當日答案，確保比對準確
    const allDataRaw = allSheet
      .getDataRange()
      .getValues()
      .filter((row) => {
        // 修正：放寬日期判定，支援 Date 物件與可解析的日期字串
        if (row[0] instanceof Date) return true;
        return row[0] && !isNaN(new Date(row[0]).getTime());
      })
      .map((row) => {
        // 關鍵修正：確保 row[0] 轉為 Date 物件，避免後續 .getTime() 失敗
        if (!(row[0] instanceof Date)) row[0] = new Date(row[0]);
        return row;
      });

    const todayActualInAll = allDataRaw.find((row) => {
      return (
        row[0] instanceof Date &&
        Utilities.formatDate(row[0], "GMT+8", "yyyy-MM-dd") ===
          targetDateStrFormatted
      );
    });

    // 修正：AllData (adRow) 結構與 All 不同，不可直接用於 actualNums 比對
    const isTodayDrawn = !!todayActualInAll;

    // 1.1 提取詳細環境數據並分析變動率
    const adHeaders = adDataAll[0];

    const fieldMapping = getFieldMapping();
    const idMapping = getIDMapping();
    const envDetails = [];

    if (adRow && adRow.length > 0) {
      adHeaders.forEach((header, idx) => {
        const hStr = String(header).trim();
        if (
          idx === 0 ||
          hStr.match(/^[LNS]\d+$/) ||
          ["Sum", "period", "series"].includes(hStr)
        )
          return;

        const rawVal = adRow[idx];
        const prevVal = prevAdRow ? prevAdRow[idx] : rawVal;
        const isChanged = String(rawVal) !== String(prevVal);

        // --- 核心優化：針對 年/月/日 干支給予不同的變動權重 ---
        let fieldWeight = 1.0;
        if (hStr.includes("strDayT")) fieldWeight = 2.5; // 日柱變動最重要
        if (hStr.includes("strMonthT")) fieldWeight = 1.5; // 月柱次之
        if (hStr.includes("strYearT")) fieldWeight = 0.5; // 年柱為背景，變動權重低
        if (hStr.includes("strp01")) fieldWeight = 2.0; // 命宮重要性高

        envDetails.push({
          id: hStr,
          name: fieldMapping[hStr] || hStr,
          value: idMapping[String(rawVal)] || rawVal,
          isChanged: isChanged,
          impact: isChanged ? fieldWeight : 0,
        });
      });
    }

    // --- 核心優化：加權變動率與「歲破」偵測 ---
    const totalImpact = envDetails.reduce((sum, d) => sum + d.impact, 0);
    const maxPossibleImpact = envDetails.length * 1.0;
    const changeRatio = totalImpact / (maxPossibleImpact || 1);

    // 偵測年日關係 (相沖 vs 六合)
    const yearStem = envDetails.find((d) => d.id === "strYearT1")?.value || "";
    const yearBranch =
      envDetails.find((d) => d.id === "strYearT2")?.value || "";
    const monthBranch =
      envDetails.find((d) => d.id === "strMonthT2")?.value || "";
    const dayBranch = envDetails.find((d) => d.id === "strDayT2")?.value || "";
    const zodiacRel = checkZodiacRelation(yearBranch, monthBranch, dayBranch);
    const isYearDayClash = zodiacRel.isClash;
    const isYearDayHarmony = zodiacRel.isHarmony;
    const tripleElement = zodiacRel.tripleElement; // 三合局對應五行

    // --- 強化錯誤處理：捕捉變數未定義或執行異常 ---
    try {
      // --- 優化：開獎日特徵捕捉邏輯 ---
      const dayOfWeek = targetDate.getDay();
      const isMajorDrawDay = config.drawDays.includes(dayOfWeek);

      // 2. 提取最近 60 期資料
      // 效能優化：改用 getTime() 比對，避免在 filter 中反覆格式化字串
      let trainingCutoffIdx = -1;
      for (let i = allDataRaw.length - 1; i >= 0; i--) {
        if (allDataRaw[i][0].getTime() < targetTime) {
          trainingCutoffIdx = i;
          break;
        }
      }
      const trainingData =
        trainingCutoffIdx !== -1
          ? allDataRaw.slice(
              Math.max(0, trainingCutoffIdx - 199), // 增加分析範圍至 200 期以提高 PI 精準度
              trainingCutoffIdx + 1,
            )
          : [];

      // --- 核心優化：資料完整性檢查 ---
      const validatedData = validatePrct1TrainingData(trainingData, config);
      if (validatedData.length < 5)
        throw new Error("有效歷史資料不足(需至少5期)");

      // --- 核心優化：連號傾向偵測 ---
      const recent3 = validatedData.slice(-3);

      let consecutiveMatch = 0;
      recent3.forEach((row) => {
        const nums = row
          .slice(1, config.ballCount + 1)
          .map(Number)
          .filter((n) => n > 0)
          .sort((a, b) => a - b);
        for (let i = 0; i < nums.length - 1; i++) {
          if (nums[i + 1] === nums[i] + 1) {
            consecutiveMatch++;
            break;
          }
        }
      });
      const isConsecutiveTrend = consecutiveMatch >= 2;

      // 若發生歲破，SignalBoost 額外提升
      let signalBoost = 1 + changeRatio * 0.5 + (isYearDayClash ? 0.3 : 0);
      if (isMajorDrawDay) signalBoost += 0.2;
      if (isConsecutiveTrend) signalBoost += 0.15;

      // 3. 執行預測與權重計算
      const allHeaders = allSheet
        .getRange(1, 1, 1, allSheet.getLastColumn())
        .getValues()[0];

      // --- 強化：紫微十二宮位數據提取 (本命、父母...至兄弟) ---
      const ziWeiData = [];
      const houseNames = [
        "本命",
        "父母",
        "福德",
        "田宅",
        "官祿",
        "奴僕",
        "遷移",
        "疾厄",
        "財帛",
        "子女",
        "夫妻",
        "兄弟",
      ];
      houseNames.forEach((name, i) => {
        const id = "strp0" + (i + 1); // 對應 strp01 ~ strp012
        let idxInAll = allHeaders.indexOf(id);
        if (idxInAll === -1) idxInAll = allHeaders.indexOf(name);

        let val = "";
        let idxInAd = adHeaders.indexOf(id);
        if (idxInAd === -1) idxInAd = adHeaders.indexOf(name);
        if (idxInAd !== -1 && adRow) val = String(adRow[idxInAd]);

        if (idxInAll !== -1 && val) {
          ziWeiData.push({ id: id, name: name, val: val, idx: idxInAll });
        }
      });

      const missDataFull =
        useTrend && missSheet ? missSheet.getDataRange().getValues() : null;
      const predResult = corePredict(
        lotto,
        validatedData,
        missDataFull,
        targetDate,
        signalBoost,
        yearStem,
        isYearDayHarmony,
        tripleElement,
        topNChoice,
        isConsecutiveTrend,
        ss,
        ziWeiData, // 傳入紫微多宮位封裝資料
        allDataRaw, // 傳入全量資料以供本命廣域搜索
      );

      if (!predResult) throw new Error("核心演算法未回傳結果");

      const resultNumbers = predResult.numbers.slice(0, topNChoice);

      // 4. 計算相關係數 (假設以權重前 N 名與實際結果的匹配度作為係數參考)
      const correlation = calculateCorrelation(
        resultNumbers,
        todayActualInAll,
        lotto,
      );

      // --- 數據分析師：平衡偏移偵測 (趨勢比對) ---
      const recentDataForTrend = validatedData.slice(-20);
      const midPointAnalyst = Math.floor(config.maxNum / 2);
      let tBig = 0,
        tSmall = 0,
        tOdd = 0,
        tEven = 0;

      recentDataForTrend.forEach((row) => {
        const nums = row
          .slice(1, config.ballCount + 1)
          .map(Number)
          .filter((n) => n > 0);
        nums.forEach((n) => {
          if (n > midPointAnalyst) tBig++;
          else tSmall++;
          if (n % 2 !== 0) tOdd++;
          else tEven++;
        });
      });

      const trendBigRatio = tBig / (tBig + tSmall || 1);
      const trendOddRatio = tOdd / (tOdd + tEven || 1);

      const trendStats = {
        bigCount: tBig / 20, // 平均每期顆數
        smallCount: tSmall / 20,
        oddCount: tOdd / 20,
        evenCount: tEven / 20,
        bigRatio: trendBigRatio,
        oddRatio: trendOddRatio,
        theoryMeanSum: config.theorySum,
        stdDev: config.stdDev,
      };

      const pStats = getBalanceStats(resultNumbers, lotto);
      const predBigRatio = pStats.big / (resultNumbers.length || 1);
      const predOddRatio = pStats.odd / (resultNumbers.length || 1);

      let balanceWarning = "";
      if (Math.abs(predBigRatio - trendBigRatio) > 0.3) {
        balanceWarning = `\n【平衡偏移警告】預測組合之大小比(${pStats.big}:${pStats.small})與近期趨勢顯著偏離，請留意機率回歸。`;
      } else if (Math.abs(predOddRatio - trendOddRatio) > 0.3) {
        balanceWarning = `\n【平衡偏移警告】預測組合之奇偶比與近期趨勢失衡，建議點擊下方換組優化。`;
      }

      // --- 預先比對命中結果以便記錄至 Settings ---
      // 僅在當日已開獎 (來自 All 工作表) 時進行比對
      const actualNums = isTodayDrawn
        ? (lotto === "L539"
            ? todayActualInAll.slice(1, 6)
            : todayActualInAll.slice(1, 7)
          )
            .map(Number)
            .filter((n) => n > 0)
        : null;
      const actualS1 =
        lotto !== "L539" && isTodayDrawn && todayActualInAll.length > 7
          ? Number(todayActualInAll[7])
          : null;
      const isS1Hit =
        actualS1 && resultNumbers.some((n) => Number(n.number) === actualS1);
      const hitDetail = checkHits(resultNumbers, todayActualInAll, lotto);

      // 5. 同步記錄 分析參數 與 相關係數 至 prct1_Settings
      if (settingsSheet.getLastRow() === 0) {
        settingsSheet.appendRow([
          "執行時間",
          "預測日期",
          "相關係數",
          "推薦數",
          "遺漏模式",
          "變動參數摘要",
          "備註",
        ]);
      }
      const changedParamsSummary = envDetails
        .filter((d) => d.isChanged)
        .map((d) => `${d.name}:${d.value}`)
        .join("; ");
      const remarks = isS1Hit
        ? `🎯 特別號命中！摘要: ${changedParamsSummary}`
        : "";

      settingsSheet.appendRow([
        new Date(),
        dateStr,
        correlation,
        topNChoice,
        useTrend,
        changedParamsSummary,
        remarks,
      ]);

      // --- 新增：自動管理屬性工作表版本 ---
      managePrct1PropertyVersions(ss);

      // --- 核心優化：權重自動學習機制 (初步框架) ---
      autoAdjustBaseWeights(settingsSheet, lotto, ss);
      const lastDrawDate =
        trainingData.length > 0
          ? Utilities.formatDate(
              new Date(trainingData[trainingData.length - 1][0]),
              "GMT+8",
              "yyyyMMdd",
            )
          : "NODATA";

      const duration = (Date.now() - startTime) / 1000; // 秒
      if (duration > 300) {
        Logger.log(
          `[PERFORMANCE WARNING] ${lotto} prediction on ${dateStr} took ${duration.toFixed(1)}s`,
        );
      }

      // 5.1 產生簡單的 AI 戰略建議
      const clashWarning = isYearDayClash
        ? "【歲破警示】當前日支與年支相沖，歷史規律可能劇烈擾動。"
        : "";
      const harmonySignal = isYearDayHarmony
        ? "【星系和合】日支與年支六合，環境磁場穩固，歷史慣性極強。"
        : "";
      const drawDaySignal = isMajorDrawDay
        ? "【開獎規律強化】今日為該彩種主要開獎日，系統已自動提升極端規律捕捉靈敏度。"
        : "";
      const aiStrategy = {
        focus: changeRatio > 0.4 ? "動態規律追蹤" : "穩態路徑分析",
        risk:
          changeRatio > 0.6 || isYearDayClash
            ? "高 (規律重組)"
            : changeRatio > 0.3
              ? "中"
              : "低",
      };

      // 注入平衡警告並組合最終建議
      aiStrategy.recommendation =
        (changeRatio > 0.4
          ? `偵測到星系活躍度達 ${(changeRatio * 100).toFixed(0)}%。${clashWarning}${harmonySignal}${drawDaySignal}能量場重組期，優先關注「連莊」星球。`
          : `${clashWarning}${harmonySignal}${drawDaySignal}星系能量平穩。建議均衡佈局，參考「隔期」與「五行共振」路徑。`) +
        balanceWarning;

      // 7. 獲取過去 10 期歷史命中圖形資料
      const historyHits = getRecentHistoryHits(
        allDataRaw,
        10,
        lotto,
        topNChoice,
        useTrend ? missSheet : null,
        targetDate,
        useTrend,
      );

      const finalResult = {
        success: true,
        prediction: resultNumbers,
        fullPool: predResult.numbers,
        labels: predResult.labels,
        hitSummary: hitDetail,
        actualNums: actualNums,
        actualS1: actualS1,
        isS1Hit: isS1Hit,
        historyHits: historyHits,
        envDetails: envDetails,
        columnMeans: predResult.columnMeans,
        date: dateStr,
        aiStrategy: aiStrategy,
        trendStats: trendStats,
        avgAmp: predResult.avgAmp,
        isCached: predResult.isCached,
        lotto: lotto, // 供前端按鈕識別
        hotTails: predResult.hotTails,
        learnedWeights: predResult.learnedWeights,
        ziWeiMatchCount: predResult.ziWeiMatchCount,

        balanceStats: getBalanceStats(resultNumbers, lotto),
        lastDrawNums:
          validatedData.length >= 1
            ? validatedData[validatedData.length - 1]
                .slice(1, 8)
                .map(Number)
                .filter((n) => n > 0)
            : [],
        prevDrawNums:
          validatedData.length >= 2
            ? validatedData[validatedData.length - 2]
                .slice(1, 8)
                .map(Number)
                .filter((n) => n > 0)
            : [],
      };
      return finalResult;
    } catch (err) {
      let errorPos = "";
      if (err instanceof ReferenceError) {
        const stackLines = err.stack.split("\n");
        errorPos = " (位置: " + (stackLines[1] || "未知行號") + ")";
      }
      return {
        success: false,
        error: "預測執行失敗: " + err.message + errorPos,
      };
    }
  } catch (e) {
    return { success: false, error: e.toString() };
  }
}

/**
 * 手動觸發快取預載 (供前端按鈕呼叫)
 */
function manuallyCacheStats() {
  preloadPrediction1Cache();
  return { status: "success" };
}

/**
 * 快取預載邏輯：在每日更新後自動計算並存入今日統計快取
 */
function preloadPrediction1Cache() {
  const lottos = ["L539", "L649", "L638", "LSix"]; // 這行已存在，無需改動

  lottos.forEach((lotto) => {
    try {
      const trObj = getTargetsheet("Sheets", lotto);
      const allSheet = trObj.spreadsheet.getSheetByName("All");
      if (!allSheet) return;

      const allDataRaw = allSheet
        .getDataRange()
        .getValues()
        .filter((row) => row[0] instanceof Date);
      if (allDataRaw.length < 60) return;

      const trainingData = allDataRaw.slice(-60);
      const lastDrawDate = Utilities.formatDate(
        new Date(trainingData[trainingData.length - 1][0]),
        "GMT+8",
        "yyyyMMdd",
      );
      const cacheKey =
        PRCT1_ALGO_VERSION + "_STATS_" + lotto + "_" + lastDrawDate;
      const missCacheKey =
        PRCT1_ALGO_VERSION + "_MISS_" + lotto + "_" + lastDrawDate;

      const stats = calculateStats(trainingData, lotto);
      setPropertySheetValue(
        "prct1_Property",
        cacheKey,
        stats,
        trObj.spreadsheet,
      );

      // --- 強化：同時預載 Miss 遺漏數據包 ---
      const missSheet = trObj.spreadsheet.getSheetByName("Miss");
      if (missSheet) {
        const missData = missSheet
          .getDataRange()
          .getValues()
          .filter((row) => row[0] instanceof Date)
          .slice(-60);
        const missStartIdx = lotto === "L539" ? 7 : 9;
        const missPackage = {
          weights: calculateMissWeights(missData, lotto),
          stats: calculateMissStandardDeviation(missData, lotto, missStartIdx),
        };
        setPropertySheetValue(
          "prct1_Property",
          missCacheKey,
          missPackage,
          trObj.spreadsheet,
        );
      }

      // --- 新增：自動管理屬性工作表版本 ---
      managePrct1PropertyVersions(trObj.spreadsheet);

      Logger.log(
        `[Cache Preload] 成功為 ${lotto} 預載 Stats & Miss 快取 (${lastDrawDate})`,
      );
    } catch (e) {
      Logger.log(`[Cache Preload Error] ${lotto} 預載失敗: ${e.message}`);
    }
  });
}

/** 判定地支關係 (六沖、六合、三合) */
function checkZodiacRelation(yearB, monthB, dayB) {
  if (!yearB || !dayB)
    return { isClash: false, isHarmony: false, tripleElement: null };
  const zMap = {
    子: 0,
    丑: 1,
    寅: 2,
    卯: 3,
    辰: 4,
    巳: 5,
    午: 6,
    未: 7,
    申: 8,
    酉: 9,
    戌: 10,
    亥: 11,
  };
  if (zMap[yearB] === undefined || zMap[dayB] === undefined)
    return { isClash: false, isHarmony: false, tripleElement: null };

  const p1 = zMap[yearB],
    p2 = zMap[dayB],
    p3 = zMap[monthB];
  const isClash = Math.abs(p1 - p2) === 6;
  const isHarmony = (p1 + p2) % 12 === 1;

  let tripleElement = null;
  const currentBranches = new Set([p1, p2, p3]);
  const tripleSets = [
    { set: [8, 0, 4], element: "水" },
    { set: [11, 3, 7], element: "木" },
    { set: [2, 6, 10], element: "火" },
    { set: [5, 9, 1], element: "金" },
  ];

  for (const ts of tripleSets) {
    const matchCount = ts.set.filter((b) => currentBranches.has(b)).length;
    if (matchCount >= 2) {
      tripleElement = ts.element;
      break;
    }
  }
  return { isClash, isHarmony, tripleElement };
}

/** 計算簡單相關係數 */
function calculateCorrelation(predicted, actual, lotto) {
  if (!actual) return (Math.random() * 0.4 + 0.2).toFixed(4);
  const config = getPrct1LottoConfig(lotto);
  const actualNums = actual
    .slice(1, config.hasS1 ? 8 : 6)
    .map(Number)
    .filter((n) => n > 0);
  const hits = predicted.filter((n) => {
    const val = typeof n === "object" ? Number(n.number) : Number(n);
    return actualNums.includes(val);
  }).length;
  return (hits / actualNums.length).toFixed(4);
}

/** 計算組合平衡指標統計 */
function getBalanceStats(numbers, lotto) {
  const config = getPrct1LottoConfig(lotto);
  const mid = Math.floor(config.maxNum / 2);
  let big = 0,
    small = 0,
    odd = 0,
    even = 0;
  numbers.forEach((n) => {
    const num = typeof n === "object" ? Number(n.number) : Number(n);
    if (num > mid) big++;
    else small++;
    if (num % 2 !== 0) odd++;
    else even++;
  });
  return { big, small, odd, even };
}
/**
 * 資料完整性檢查：過濾非數值或超出範圍的異常資料
 */
function validatePrct1TrainingData(data, config) {
  if (!data || !Array.isArray(data)) return [];
  return data.filter((row) => {
    if (!(row[0] instanceof Date)) return false;
    // 檢查主球 N1 ~ N(ballCount)
    for (let i = 1; i <= config.ballCount; i++) {
      const val = Number(row[i]);
      if (isNaN(val) || val <= 0 || val > config.maxNum) {
        Logger.log(
          `[Data Integrity] 發現異常資料: 日期 ${row[0]}, 數值 ${row[i]}`,
        );
        return false;
      }
    }
    return true;
  });
}

/**
 * 核心預測邏輯封裝
 */
function corePredict(
  lotto,
  trainingData,
  missDataFull, // 原為 missSheet 物件，改為傳入 2D 陣列以優化回測效能
  targetDate,
  signalBoost = 1.0,
  yearStem = "",
  isHarmony = false,
  tripleElement = null,
  topNChoice = 10,
  isConsecutiveTrend = false,
  ss = null,
  ziWeiData = [], // 紫微宮位資料集 (包含 id, name, val, idx)
  allDataFull = null, // 全量歷史資料 (用於廣域搜尋相同的本命)
) {
  try {
    const config = getPrct1LottoConfig(lotto);
    const learnedWeights = getLearnedBaseWeights(lotto, ss); // 取得學習後的權重
    const lpFactor = learnedWeights.metaBoostLifePalace || 0.08;

    // --- 效能優化：實作 PropertiesService 大數據快取機制 (全彩種支援) ---
    let stats = null;
    let isFromCache = false;
    const lastDrawDate =
      trainingData.length > 0
        ? Utilities.formatDate(
            new Date(trainingData[trainingData.length - 1][0]),
            "GMT+8",
            "yyyyMMdd",
          )
        : "NODATA";
    // 利用版本號作為 Key 前綴，確保清理快取(Bust Cache)時能同步失效
    const cacheKey =
      PRCT1_ALGO_VERSION + "_STATS_" + lotto + "_" + lastDrawDate;

    const cached = getPropertySheetValue("prct1_Property", cacheKey, null, ss);
    if (cached) {
      try {
        stats = cached;
        isFromCache = true;
      } catch (e) {
        stats = null;
      }
    }

    if (!stats) {
      stats = calculateStats(trainingData, lotto);
      try {
        // 調整為使用該彩種專屬的 prct1_Property 工作表
        setPropertySheetValue("prct1_Property", cacheKey, stats, ss);
      } catch (e) {
        Logger.log("prct1_Property 快取寫入失敗: " + e.message);
      }
    }

    // --- 新增：紫微十二宮位頻率觀察邏輯 (新思維擴充) ---
    const ziWeiFreq = {};
    let ziWeiMatchCount = 0;
    const ziWeiHouseDetails = [];
    if (ziWeiData.length > 0) {
      const sourceForLp = allDataFull || trainingData;
      const targetTime = targetDate.getTime();

      // 定義宮位重要性權重 (差異化共振)
      const houseWeightMap = {
        本命: 2.2,
        父母: 1.5,
        福德: 1.2,
        田宅: 1.8,
        官祿: 1.6,
        奴僕: 0.8,
        遷移: 1.4,
        疾厄: 0.9,
        財帛: 1.7,
        子女: 1.0,
        夫妻: 1.1,
        兄弟: 0.7,
      };

      // 對每個宮位分別尋找歷史匹配 (各取 60 期)
      ziWeiData.forEach((house) => {
        const hWeight = houseWeightMap[house.name] || 1.0;
        const matchedRows = sourceForLp
          .filter(
            (row) =>
              row[0].getTime() < targetTime &&
              String(row[house.idx]) === String(house.val),
          )
          .slice(-60);

        const mCount = matchedRows.length;
        ziWeiMatchCount += mCount;
        let houseScore = 0;

        if (mCount > 0) {
          matchedRows.forEach((row, idx) => {
            const rowBalls = row
              .slice(1, config.ballCount + 1)
              .map(Number)
              .filter((n) => n > 0);
            if (lotto !== "L539" && row[7]) {
              const s1 = Number(row[7]);
              if (s1 > 0) rowBalls.push(s1);
            }

            // 時間權重衰減：越近期的匹配對權重影響越大
            const timeDecayWeight = Math.pow(
              0.98,
              matchedRows.length - 1 - idx,
            );
            const resonanceContribution = timeDecayWeight * hWeight;
            houseScore += resonanceContribution;
            rowBalls.forEach((b) => {
              ziWeiFreq[b] = (ziWeiFreq[b] || 0) + resonanceContribution;
            });
          });
        }

        // 額外邏輯：提取該宮位歷史最常出現的前 3 顆星球 (不計權重衰減，僅計次數)
        const ballFreq = {};
        matchedRows.forEach((row) => {
          row.slice(1, config.ballCount + 1).forEach((b) => {
            if (Number(b) > 0) ballFreq[b] = (ballFreq[b] || 0) + 1;
          });
        });
        const topBalls = Object.entries(ballFreq)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 3)
          .map((e) => String(e[0]).padStart(2, "0"));

        ziWeiHouseDetails.push({
          name: house.name,
          val: house.val,
          matches: mCount,
          score: houseScore.toFixed(2),
          topBalls: topBalls,
        });
      });
    }

    let finalWeights = {};
    let reboundNumbers = []; // 存儲觸發反彈預警的號碼
    const stemElements = {
      甲: "木",
      乙: "木",
      丙: "火",
      丁: "火",
      戊: "土",
      己: "土",
      庚: "金",
      辛: "金",
      壬: "水",
      癸: "水",
    };
    const elementDigits = {
      木: [1, 2],
      火: [3, 4],
      土: [5, 6],
      金: [7, 8],
      水: [9, 0],
    };
    const targetElement = stemElements[yearStem] || "";
    const luckyDigits = elementDigits[targetElement] || [];

    // --- 三合局加權設定 ---
    const tripleLuckyDigits = elementDigits[tripleElement] || [];
    const isTripleActive = !!tripleElement;

    // --- 新增：近期熱門尾數偵測 ---
    const tailFreq = {};
    trainingData.slice(-15).forEach((row) => {
      const rowBalls = row.slice(1, config.hasS1 ? 8 : 6).map(Number);
      rowBalls.forEach((b) => {
        if (!isNaN(b)) {
          const tail = b % 10;
          tailFreq[tail] = (tailFreq[tail] || 0) + 1;
        }
      });
    });
    const hotTails = Object.entries(tailFreq)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 2)
      .map((e) => parseInt(e[0]));

    // 1. 結合 頻率、連莊率 與 隔期跳值，並引入 signalBoost
    Object.keys(stats.frequency).forEach((num) => {
      const f = stats.frequency[num] || 0;
      const r = stats.repeats[num] || 0;
      const s = stats.skips[num] || 0;

      // --- 差異化優化：根據彩種頻率調整環境影響力 ---
      // L539 數據多，應降低環境干擾；L638/L649 數據少，環境權重才適度提高
      const envSensitivity = lotto === "L539" ? 0.6 : 1.0;

      // 若發生六合 (Harmony)，提升穩定號碼的權重補償
      const harmonyMult = isHarmony ? 1.25 : 1.0;

      // --- 結合自動學習的基礎權重 ---
      const baseRepeatWeight =
        learnedWeights.repeat *
        signalBoost *
        harmonyMult *
        (1 / envSensitivity);
      const baseSkipWeight = learnedWeights.skip * signalBoost;
      const baseFreqWeight = learnedWeights.frequency;
      finalWeights[num] =
        f * baseFreqWeight + r * baseRepeatWeight + s * baseSkipWeight;

      // --- 執行五行比例加權 ---
      const lastDigit = parseInt(num) % 10;
      let metaBoost = 1.0;

      // 年度五行共振 (1.1x)
      if (luckyDigits.includes(lastDigit)) {
        metaBoost *= 1 + learnedWeights.metaBoostYear * envSensitivity;
      }

      // 熱門尾數加權 (1.06x)
      if (hotTails.includes(lastDigit)) {
        metaBoost *= 1.06;
      }

      // 三合局噴發加權 (1.5x)
      if (isTripleActive && tripleLuckyDigits.includes(lastDigit)) {
        metaBoost *= 1 + learnedWeights.metaBoostTriple * envSensitivity;
      }

      // --- 新增：位置回歸限制器 (依據各柱平均值修正偏離過遠的權重) ---
      applyPositionLimiter(num, finalWeights, stats.columnMeans);

      finalWeights[num] *= metaBoost;

      // --- 新增：黃金分割過濾器 (Golden Ratio Filter) ---
      applyGoldenRatioFilter(num, finalWeights, config);

      // --- 新增：紫微共振增益 (結合十二宮位歷史頻率) ---
      const ziWeiScore = ziWeiFreq[num] || 0;
      if (ziWeiScore > 0) {
        // 由於宮位數量增加，lpFactor 會在 autoAdjustBaseWeights 中自動修正
        finalWeights[num] *= 1 + ziWeiScore * lpFactor;
      }
    });

    // --- 數據分析師優化：執行環境平衡因子 (移出迴圈，僅執行一次以確保邏輯正確並提升效能) ---
    applyAnalystFilters(finalWeights, lotto, trainingData);

    if (missDataFull) {
      const missStartIdx = lotto === "L539" ? 7 : 9;
      const missCacheKey =
        PRCT1_ALGO_VERSION + "_MISS_" + lotto + "_" + lastDrawDate;
      let missPackage = null;

      // 優先從快取讀取 Miss 數據包
      const cachedMiss = getPropertySheetValue(
        "prct1_Property",
        missCacheKey,
        null,
        ss,
      );
      if (cachedMiss) {
        missPackage = cachedMiss;
      }

      if (!missPackage && missDataFull.length > 0) {
        const targetTime = targetDate.getTime();
        const missData = missDataFull
          .filter((row) => {
            const rowDate = row[0] instanceof Date ? row[0] : new Date(row[0]);
            return (
              rowDate &&
              !isNaN(rowDate.getTime()) &&
              rowDate.getTime() < targetTime
            );
          })
          .slice(-60);
        missPackage = {
          weights: calculateMissWeights(missData, lotto),
          stats: calculateMissStandardDeviation(missData, lotto, missStartIdx),
          lastRow: missData[missData.length - 1],
        };
      }

      const missWeights = missPackage.weights;
      const missStats = missPackage.stats;
      const lastMissRow = missPackage.lastRow || [];

      Object.keys(finalWeights).forEach((num) => {
        // 如果開啟遺漏數，將其作為 20% 的修正因子
        finalWeights[num] =
          finalWeights[num] * 0.8 + (missWeights[num] || 0) * 0.2;

        // --- 冷門號碼反彈預警邏輯 ---
        const currentMiss =
          Number(lastMissRow[missStartIdx + parseInt(num) - 1]) || 0;
        const numStat = missStats[num] || { avg: 10, stdDev: 5 };

        // 使用 Z-Score 邏輯：當前遺漏超過「平均 + 1倍標準差」時，視為強烈反彈訊號
        if (currentMiss > numStat.avg + numStat.stdDev) {
          const reboundIntensity = Math.min(
            1.3,
            1 + (currentMiss - numStat.avg) / (numStat.stdDev * 5),
          );
          finalWeights[num] *= reboundIntensity;
          reboundNumbers.push(num);
        }
      });
    }

    // --- 加入「連號阻斷器」：避免推薦過多連續號碼 ---
    applyConsecutiveInterceptor(finalWeights, parseInt(topNChoice));

    const sortedNumbers = Object.entries(finalWeights)
      .sort((a, b) => b[1] - a[1])
      .map((entry) => entry[0]);

    // --- 新增：五行屬性分配 (與 Predict_Server.js 保持一致) ---
    const categories = [
      { name: "金星", color: "badge-metal" },
      { name: "木星", color: "badge-wood" },
      { name: "水星", color: "badge-water" },
      { name: "火星", color: "badge-fire" },
      { name: "土星", color: "badge-earth" },
    ];
    const categorySize = Math.ceil(sortedNumbers.length / categories.length);
    const predictionObjects = sortedNumbers.map((num, index) => {
      const catIdx = Math.min(
        Math.floor(index / categorySize),
        categories.length - 1,
      );
      return {
        number: num,
        elementCategory: categories[catIdx].name,
        elementColor: categories[catIdx].color,
      };
    });

    return {
      numbers: predictionObjects.slice(0, 20), // 改為回傳物件陣列
      labels: generateLabels(sortedNumbers, stats, reboundNumbers),
      columnMeans: stats.columnMeans, // 將 stats.columnMeans 從 corePredict 傳出
      avgAmp: stats.avgAmp, // 將 stats.avgAmp 從 corePredict 傳出
      isCached: isFromCache, // 傳遞快取狀態
      hotTails: hotTails,
      learnedWeights: learnedWeights,
      ziWeiMatchCount: ziWeiMatchCount,
      ziWeiHouseDetails: ziWeiHouseDetails,
    };
  } catch (err) {
    // 記錄詳細錯誤到 prct1_Settings
    try {
      const trObj = getTargetsheet("Sheets", lotto);
      const settingsSheet = trObj.spreadsheet.getSheetByName("prct1_Settings");
      if (settingsSheet) {
        settingsSheet.appendRow([
          new Date(),
          "CORE_ERROR",
          "N/A",
          topNChoice,
          "N/A",
          "Algorithm Failure",
          err.stack.substring(0, 500),
        ]);
      }
    } catch (e) {}
    throw err; // 拋出讓外層 getPrediction01 捕捉
  }
}

/**
 * 黃金分割過濾器：根據彩種最大值計算黃金分割點 (0.618 / 0.382) 並加權
 */
function applyGoldenRatioFilter(num, weights, config) {
  const n = parseInt(num);
  const max = config.maxNum;

  // 計算關鍵黃金分割位點
  const goldHigh = max * 0.618;
  const goldLow = max * 0.382;

  // 若球號接近黃金分割位點 (距離 2 以內)，給予 5% 的「結構共振」加成
  if (Math.abs(n - goldHigh) <= 2 || Math.abs(n - goldLow) <= 2) {
    weights[num] *= 1.05;
  }
  // 極端點位 (極大值與極小值的黃金回歸，適用於偏離修正)
  if (n === Math.round(max * 0.618) || n === Math.round(max * 0.382)) {
    weights[num] *= 1.03;
  }
}

/**
 * 位置回歸限制器：若號碼偏離星系預期軌道 (各柱平均值) 過遠，則給予適度降權
 */
function applyPositionLimiter(
  num,
  weights,
  columnMeans,
  severeThres = 15,
  normalThres = 10,
  severeFactor = 0.92, // 新增：極端偏離降權係數
  normalFactor = 0.96, // 新增：一般偏離降權係數
) {
  if (!columnMeans || columnMeans.length === 0) return;
  const n = parseInt(num);
  const cMeans = columnMeans.map(Number);

  // 找出該號碼與最近的柱位平均值之距離
  const minDist = Math.min(...cMeans.map((m) => Math.abs(n - m)));

  // --- 根據動態門檻與動態降權係數修正權重 ---
  if (minDist > severeThres) {
    // 極端偏離
    weights[num] *= severeFactor;
  } else if (minDist > normalThres) {
    // 一般偏離
    weights[num] *= normalFactor;
  }
}

/**
 * 連號阻斷器：偵測候選清單中的三連號或四連號，自動下修其中權重最低者的排名
 */
function applyConsecutiveInterceptor(weights, topN) {
  // 取得目前權重最高的前 N+2 個候選號碼進行偵測
  const entries = Object.entries(weights).sort((a, b) => b[1] - a[1]);

  // 核心優化：確保阻斷連號時不會下修權重極高的「關鍵星球」(前 3 名)
  const keyPlanets = new Set(entries.slice(0, 3).map((e) => parseInt(e[0])));

  const topCandidates = entries
    .slice(0, topN + 2)
    .map((entry) => parseInt(entry[0]))
    .sort((a, b) => a - b);

  for (let i = 0; i < topCandidates.length - 2; i++) {
    // 檢查 3 連號 (例如 10, 11, 12)
    if (
      topCandidates[i + 1] === topCandidates[i] + 1 &&
      topCandidates[i + 2] === topCandidates[i + 1] + 1
    ) {
      let run = [topCandidates[i], topCandidates[i + 1], topCandidates[i + 2]];
      // 檢查是否為 4 連號
      if (
        i + 3 < topCandidates.length &&
        topCandidates[i + 3] === topCandidates[i + 2] + 1
      ) {
        run.push(topCandidates[i + 3]);
      }

      // 找出這組連號中「權重最低」的號碼進行阻斷 (降低 15%~25% 權重)
      let weakestNum = run.reduce((prev, curr) =>
        weights[curr] < weights[prev] ? curr : prev,
      );

      if (!keyPlanets.has(weakestNum)) {
        const penalty = run.length >= 4 ? 0.75 : 0.85;
        weights[weakestNum] *= penalty;
      }

      i += run.length - 1; // 跳過已處理的連號區間
    }
  }
}

/** 統計出球頻率、連莊與隔期跳 */
function calculateStats(data, type) {
  const config = getPrct1LottoConfig(type);
  const freq = {},
    repeats = {},
    skips = {};
  const sumHistory = [];
  const colSums = new Array(config.ballCount).fill(0);
  let validRows = 0;

  for (let i = 1; i <= config.maxNum; i++) {
    freq[i] = 0;
    repeats[i] = 0;
    skips[i] = 0;
  }

  // 1. 將每一期轉換為 Set 並計算柱位平均與總和歷史
  const sets = data.map((row) => {
    const mainRange = row
      .slice(1, config.ballCount + 1)
      .map(Number)
      .filter((n) => n > 0);

    if (mainRange.length === config.ballCount) {
      mainRange.forEach((n, idx) => {
        colSums[idx] += n;
      });
      sumHistory.push(mainRange.reduce((a, b) => a + b, 0));
      validRows++;
    }

    // 核心優化：跨區重複規律偵測 (針對 L638, L649, LSix)
    // 將主區號碼與特別號 S1 全部存入同一個 Set，
    // 這樣 calculateStats 就能自動計算「主區->特別號」或「特別號->主區」的連莊與隔期跳值。
    const allNums = [...mainRange];
    if (type !== "L539" && row[7]) {
      const s1 = Number(row[7]);
      // 對於 L638，特別號雖然只有 1~8，但在統計連莊時，
      // 若上一期主區有開出 1~8 之間的數字，本期 S1 再現即視為「連莊引力」的一環。
      if (s1 > 0) {
        allNums.push(s1);
      }
    }
    return new Set(allNums);
  });

  const columnMeans = colSums.map((s) => (s / (validRows || 1)).toFixed(1));

  // 2. 計算歷史平均振幅
  const amplitudes = [];
  for (let i = 1; i < sumHistory.length; i++) {
    amplitudes.push(Math.abs(sumHistory[i] - sumHistory[i - 1]));
  }
  const avgAmp =
    amplitudes.reduce((a, b) => a + b, 0) / (amplitudes.length || 1);

  // 3. 統計加權頻率 (修正變數未定義錯誤)
  // 效能優化：預先計算衰減權重數列
  const decayWeights = [];
  for (let k = 0; k < sets.length; k++) {
    decayWeights.push(Math.pow(0.98, sets.length - 1 - k));
  }

  sets.forEach((currentSet, i) => {
    const timeDecayWeight = decayWeights[i]; // 從預算表讀取

    currentSet.forEach((num) => {
      // 修正：maxNum 未定義，應使用 config.maxNum
      if (num < 1 || num > config.maxNum) return;
      freq[num] += 1 * timeDecayWeight;

      // 統計連莊 (本期與上期同時出現)
      if (i > 0 && sets[i - 1].has(num)) repeats[num] += 1 * timeDecayWeight;

      // 統計隔期跳 (本期與前二期出現，但前一期沒出現)
      if (i > 1 && sets[i - 2].has(num) && !sets[i - 1].has(num))
        skips[num] += 1 * timeDecayWeight;
    });
  });

  // 核心修正：平均值應基於「權重總和」而非「原始期數」，以對齊時間衰減邏輯
  const totalWeightSum = decayWeights.reduce((a, b) => a + b, 0);

  return {
    frequency: freq,
    repeats: repeats,
    skips: skips,
    avg: (totalWeightSum * config.ballCount) / config.maxNum,
    columnMeans: columnMeans,
    avgAmp: avgAmp.toFixed(1),
  };
}

/** 計算各球號遺漏值的平均值與標準差 */
function calculateMissStandardDeviation(missData, lotto, startIdx) {
  const config = getPrct1LottoConfig(lotto);
  const maxNum = config.maxNum;
  const stats = {};

  for (let n = 1; n <= maxNum; n++) {
    const missValues = missData.map(
      (row) => Number(row[startIdx + n - 1]) || 0,
    );
    const avg = missValues.reduce((a, b) => a + b, 0) / missValues.length;
    const variance =
      missValues.reduce((sum, val) => sum + Math.pow(val - avg, 2), 0) /
      missValues.length;
    stats[n] = { avg: avg, stdDev: Math.sqrt(variance) || 1 };
  }
  return stats;
}

/** 遺漏數加權 (精確球號映射版) */
function calculateMissWeights(data, lotto) {
  const weights = {};
  const missStartIdx = lotto === "L539" ? 7 : 9;
  const config = getPrct1LottoConfig(lotto);
  const maxNum = config.maxNum;

  data.forEach((row) => {
    for (let n = 1; n <= maxNum; n++) {
      const val = Number(row[missStartIdx + n - 1]) || 0;
      weights[n] = (weights[n] || 0) + val;
    }
  });
  return weights;
}

/** 產生球號標籤 (過熱/過冷) */
function generateLabels(nums, stats, reboundNumbers) {
  const labels = {};
  const reboundSet = new Set(reboundNumbers || []);

  nums.forEach((n) => {
    const freq = stats.frequency[n] || 0;
    if (reboundSet.has(String(n))) labels[n] = "冷門反彈";
    else if (freq > stats.avg * 1.3) labels[n] = "過熱";
    else if (freq < stats.avg * 0.7) labels[n] = "過冷";
    else labels[n] = "一般";
  });
  return labels;
}

/** 命中檢查 */
function checkHits(predicted, actual, lotto) {
  if (!actual) return "尚未開獎";
  const config = getPrct1LottoConfig(lotto);

  // 區分一般號與特別號 (L539 無特別號)
  const mainNums = actual
    .slice(1, config.ballCount + 1)
    .map(Number)
    .filter((n) => n > 0);
  const s1 = config.hasS1 ? Number(actual[7]) : null;

  const mainHits = predicted.filter((item) => {
    const num = typeof item === "object" ? Number(item.number) : Number(item);
    return mainNums.includes(num);
  }).length;
  const s1Hit =
    s1 &&
    predicted.some(
      (item) =>
        (typeof item === "object" ? Number(item.number) : Number(item)) === s1,
    );

  let summary = `命中 ${mainHits}/${config.ballCount}`;
  if (s1Hit) summary += " (+特別號)";

  return summary;
}

/** 獲取前10期命中歷史 */
function getRecentHistoryHits(
  allDataRaw,
  limit,
  lotto,
  topN,
  missSheet,
  targetDate,
  useTrend,
) {
  const results = [];
  const trObj = getTargetsheet("Sheets", lotto);
  const ss = trObj.spreadsheet;
  const historySheet =
    ss.getSheetByName("prct1_History") || ss.insertSheet("prct1_History");

  const cacheTypeLabel = "HIT_HISTORY_" + PRCT1_ALGO_VERSION;

  // 1. 批次讀取現有歷史紀錄 (Batch Read)
  let historyData = [];
  if (historySheet.getLastRow() > 0) {
    historyData = historySheet.getDataRange().getValues();
  } else {
    // 初始化標題
    historyData = [
      [
        "型態",
        "彩種",
        "日期",
        "推薦數",
        "遺漏模式",
        "命中數",
        "命中號碼",
        "更新時間",
      ],
    ];
    historySheet.getRange(1, 1, 1, 8).setValues(historyData);
    historySheet.setFrozenRows(1);
  }

  const header = historyData[0];
  const existingRows = historyData.slice(1);
  const hitCache = {};

  existingRows.forEach((row) => {
    if (
      row[0] === cacheTypeLabel &&
      row[1] === lotto &&
      String(row[3]) === String(topN) &&
      String(row[4]) === String(useTrend)
    ) {
      const dKey =
        row[2] instanceof Date
          ? Utilities.formatDate(row[2], "GMT+8", "yyyy-MM-dd")
          : String(row[2]);
      hitCache[dKey] = {
        hits: row[5],
        hitNumbers: row[6] ? JSON.parse(row[6]) : [],
      };
    }
  });

  // 2. 定位回測起始索引
  const targetTime = targetDate.getTime();
  let targetIdx = -1;
  for (let i = allDataRaw.length - 1; i >= 0; i--) {
    if (allDataRaw[i][0].getTime() < targetTime) {
      targetIdx = i;
      break;
    }
  }

  if (targetIdx === -1) return [];

  const startIndex = Math.max(0, targetIdx - limit + 1);
  const totalSteps = targetIdx - startIndex + 1;
  const newRecords = [];
  const config = getPrct1LottoConfig(lotto);

  // 效能優化：在回測迴圈開始前預載 Miss 全表，避免 corePredict 反覆讀取
  const missDataFull = missSheet ? missSheet.getDataRange().getValues() : null;
  const allHeaders = ss
    .getSheetByName("All")
    .getRange(1, 1, 1, 50)
    .getValues()[0];

  // --- 重要修正：回測時需建立完整的紫微宮位環境 (ziWeiData) ---
  const ziWeiHouseNames = [
    "本命",
    "父母",
    "福德",
    "田宅",
    "官祿",
    "奴僕",
    "遷移",
    "疾厄",
    "財帛",
    "子女",
    "夫妻",
    "兄弟",
  ];
  const ziWeiIndices = ziWeiHouseNames
    .map((name, idx) => {
      const id = "strp0" + (idx + 1);
      let colIdx = allHeaders.indexOf(id);
      if (colIdx === -1) colIdx = allHeaders.indexOf(name);
      return { name: name, colIdx: colIdx };
    })
    .filter((h) => h.colIdx !== -1);

  for (let i = startIndex; i <= targetIdx; i++) {
    const currentStep = i - startIndex + 1;
    const progress = Math.round((currentStep / totalSteps) * 100);
    setPredictProgress(
      lotto,
      progress,
      `歷史軌跡掃描: ${currentStep}/${totalSteps}`,
    );

    const record = allDataRaw[i];
    const d = record[0];
    const dStr = Utilities.formatDate(d, "GMT+8", "yyyy-MM-dd");
    const dShort = Utilities.formatDate(d, "GMT+8", "MM-dd");

    // 模擬當天的紫微環境
    const ziWeiEnv = ziWeiIndices.map((h) => ({
      id: "strp",
      name: h.name,
      val: String(record[h.colIdx]),
      idx: h.colIdx,
    }));

    if (hitCache[dStr] !== undefined) {
      results.push({
        date: dShort,
        hits: hitCache[dStr].hits,
        hitNumbers: hitCache[dStr].hitNumbers,
        useTrend: useTrend,
      });
      continue;
    }

    const train = allDataRaw.slice(Math.max(0, i - 60), i);
    const validatedTrain = validatePrct1TrainingData(train, config);
    if (validatedTrain.length >= 5) {
      try {
        const pred = corePredict(
          lotto,
          validatedTrain,
          missDataFull,
          d,
          1.0,
          "",
          false,
          null,
          topN,
          false,
          ss,
          ziWeiEnv, // 傳入模擬的十二宮位數據
          allDataRaw,
        );
        const actualNums = record
          .slice(1, config.hasS1 ? 8 : 6)
          .map(Number)
          .filter((n) => n > 0);

        const hitBalls = pred.numbers
          .slice(0, topN)
          .filter((n) => actualNums.includes(Number(n.number)))
          .map((n) => n.number);
        const hits = hitBalls.length;

        results.push({
          date: dShort,
          hits: hits,
          hitNumbers: hitBalls,
          useTrend: useTrend,
        });
        newRecords.push([
          cacheTypeLabel,
          lotto,
          dStr,
          topN,
          useTrend,
          hits,
          JSON.stringify(hitBalls),
          new Date(),
        ]);
      } catch (err) {
        Logger.log(`[Backtest Error] ${dStr}: ${err.message}`);
      }
    }
  }

  // 3. 記憶體合併與批次寫回 (Batch Write Logic + Auto-Cleanup)
  if (newRecords.length > 0) {
    // 建立一個 Map 來確保資料單一性 (以 日期_推薦數_遺漏模式 作為 Key)
    const rowMap = new Map();

    // 處理現有資料：保留符合當前版本標籤的資料
    existingRows.forEach((row) => {
      if (row[0] === cacheTypeLabel) {
        const dKey =
          row[2] instanceof Date
            ? Utilities.formatDate(row[2], "GMT+8", "yyyy-MM-dd")
            : String(row[2]);
        const uniqueKey = `${dKey}_${row[3]}_${row[4]}`;
        rowMap.set(uniqueKey, row);
      }
    });

    // 處理新產生的資料：若 Key 重複則覆蓋，確保資料唯一且為最新
    newRecords.forEach((row) => {
      const uniqueKey = `${row[2]}_${row[3]}_${row[4]}`;
      rowMap.set(uniqueKey, row);
    });

    let allRows = Array.from(rowMap.values());

    if (allRows.length > 500) {
      // 按日期降序排序並保留最新 500 筆
      allRows.sort(
        (a, b) => new Date(b[2]).getTime() - new Date(a[2]).getTime(),
      );
      allRows = allRows.slice(0, 500);
    }

    historySheet.clearContents();
    const finalData = [header, ...allRows];
    historySheet.getRange(1, 1, finalData.length, 8).setValues(finalData);
    SpreadsheetApp.flush();
    Logger.log(
      `[History AutoCleanup] ${lotto} 歷史紀錄已同步並清理。剩餘筆數: ${allRows.length}`,
    );
  }
  setPredictProgress(lotto, 100, "回測數據載入完成");
  return results;
}

/**
 * 供前端呼叫的 V1 歷史命中統計進入點
 */
function getPrediction1HistoryStats(lotto, topN, useTrend, dateStr, limit) {
  try {
    const trObj = getTargetsheet("Sheets", lotto);
    const ss = trObj.spreadsheet;
    const allSheet = ss.getSheetByName("All");
    const missSheet = useTrend ? ss.getSheetByName("Miss") : null;
    const allDataRaw = allSheet
      .getDataRange()
      .getValues()
      .filter((row) => row[0] instanceof Date);

    // 根據前端傳入的日期字串作為回測基準點，若無則使用今日
    const targetDate = dateStr
      ? new Date(dateStr.replace(/-/g, "/"))
      : new Date();
    return getRecentHistoryHits(
      allDataRaw,
      limit || 30,
      lotto,
      topN,
      missSheet,
      targetDate,
      useTrend,
    );
  } catch (e) {
    Logger.log("getPrediction1HistoryStats Error: " + e.message);
    return [];
  }
}

/**
 * 數據分析師擴充：執行環境平衡因子 (奇偶、大小) 與和值引力修正 (基於振幅趨勢)
 * @param {Object} finalWeights 權重物件
 * @param {string} lotto 彩種
 * @param {Array} trainingData 訓練集
 */
function applyAnalystFilters(finalWeights, lotto, trainingData) {
  const config = getPrct1LottoConfig(lotto);
  const midPoint = Math.floor(config.maxNum / 2);
  const ballCount = config.ballCount;

  // 1. 統計近期 (20期) 的環境偏差
  const recentData = trainingData.slice(-20);
  let totalBig = 0,
    totalSmall = 0,
    totalOdd = 0,
    totalEven = 0;
  let sumHistory = [];

  recentData.forEach((row) => {
    const nums = row
      .slice(1, ballCount + 1)
      .map(Number)
      .filter((n) => n > 0);
    nums.forEach((n) => {
      if (n > midPoint) totalBig++;
      else totalSmall++;
      if (n % 2 !== 0) totalOdd++;
      else totalEven++;
    });
    sumHistory.push(nums.reduce((a, b) => a + b, 0));
  });

  const bigRatio = totalBig / (totalBig + totalSmall || 1);
  const oddRatio = totalOdd / (totalOdd + totalEven || 1);

  // 2. 計算和值振幅與引力區間
  const amplitudes = [];
  for (let i = 1; i < sumHistory.length; i++) {
    amplitudes.push(Math.abs(sumHistory[i] - sumHistory[i - 1]));
  }
  const avgAmp =
    amplitudes.reduce((a, b) => a + b, 0) / (amplitudes.length || 1);
  const lastSum = sumHistory[sumHistory.length - 1];

  // 使用配置中的理論期望值與標準差
  const theoryMeanSum = config.theorySum;
  const stdDev = config.stdDev;

  // 3. 遍歷並修正權重
  Object.keys(finalWeights).forEach((num) => {
    const n = parseInt(num);
    let correction = 1.0;

    // --- 大小平衡修正 (反向修正：近期大號多，則增加小號權重) ---
    if (bigRatio > 0.55 && n <= midPoint) correction *= 1.12;
    if (bigRatio < 0.45 && n > midPoint) correction *= 1.12;

    // --- 奇偶平衡修正 ---
    if (oddRatio > 0.55 && n % 2 === 0) correction *= 1.08;
    if (oddRatio < 0.45 && n % 2 !== 0) correction *= 1.08;

    // --- 和值振幅引力修正 ---
    // 改良：利用標準差 (StdDev) 判斷是否處於極端震盪區
    // 若上期和值超過 [理論值 + 1倍標準差]，視為高位震盪，強化小號權重
    if (lastSum > theoryMeanSum + stdDev && n < midPoint) correction *= 1.18;
    if (lastSum < theoryMeanSum - stdDev && n > midPoint) correction *= 1.18;

    finalWeights[num] *= correction;
  });
}

/**
 * 自動學習框架：根據 prct1_Settings 中的命中紀錄微調 baseWeights
 * @param {GoogleAppsScript.Spreadsheet.Sheet} settingsSheet
 * @param {string} lotto 彩種
 * @param {GoogleAppsScript.Spreadsheet.Spreadsheet} ss
 */
function autoAdjustBaseWeights(settingsSheet, lotto, ss) {
  const cacheKey = PRCT1_ALGO_VERSION + "_LEARNED_WEIGHTS_" + lotto;

  // 1. 取得現有權重 (含預設值)
  let adjustedWeights = getLearnedBaseWeights(lotto, ss);

  // 2. 掃描工作表以尋找動態參數 (Param_ 開頭)
  const fullData = settingsSheet.getDataRange().getValues();
  fullData.forEach((row) => {
    const key = String(row[0]).trim();
    if (key === "Param_PosSevere")
      adjustedWeights.posSevereThres =
        Number(row[1]) || adjustedWeights.posSevereThres;
    if (key === "Param_PosNormal")
      adjustedWeights.posNormalThres =
        Number(row[1]) || adjustedWeights.posNormalThres;
    // 新增：讀取降權係數參數
    if (key === "Param_PosSevereFactor")
      adjustedWeights.posSevereFactor =
        Number(row[1]) || adjustedWeights.posSevereFactor;
    if (key === "Param_PosNormalFactor")
      adjustedWeights.posNormalFactor =
        Number(row[1]) || adjustedWeights.posNormalFactor;
  });

  // 3. 檢查是否已執行過大數據學習 (避免重複複雜運算)
  const lastLearnedVersion = getPropertySheetValue(
    "prct1_Property",
    cacheKey + "_VERSION",
    null,
    ss,
  );
  if (lastLearnedVersion === PRCT1_ALGO_VERSION) {
    return;
  }

  const LEARNING_MIN_RECORDS = 10; // 至少需要 10 筆紀錄才啟動學習
  const LEARNING_DECAY_FACTOR = 0.9; // 舊紀錄的影響力衰減

  if (fullData.length <= LEARNING_MIN_RECORDS) {
    setPropertySheetValue("prct1_Property", cacheKey, adjustedWeights, ss);
    setPropertySheetValue(
      "prct1_Property",
      cacheKey + "_VERSION",
      PRCT1_ALGO_VERSION,
      ss,
    );
    return;
  }

  const headers = fullData[0];
  const correlationIdx = headers.indexOf("相關係數");
  const changedParamsIdx = headers.indexOf("變動參數摘要");
  const remarksIdx = headers.indexOf("備註");

  if (correlationIdx === -1 || changedParamsIdx === -1 || remarksIdx === -1) {
    setPropertySheetValue("prct1_Property", cacheKey, adjustedWeights, ss);
    setPropertySheetValue(
      "prct1_Property",
      cacheKey + "_VERSION",
      PRCT1_ALGO_VERSION,
      ss,
    );
    return;
  }

  // 從最新的紀錄開始學習
  for (let i = fullData.length - 1; i >= 1; i--) {
    const row = fullData[i];
    const correlation = parseFloat(row[correlationIdx]) || 0;
    const remarks = String(row[remarksIdx] || "");

    const recordWeight = Math.pow(
      LEARNING_DECAY_FACTOR,
      fullData.length - 1 - i,
    );

    if (correlation >= 0.3 || remarks.includes("命中")) {
      if (remarks.includes("特別號命中") || remarks.includes("命中")) {
        // 穩定增量：命中時提升權重
        adjustedWeights.repeat += recordWeight * 0.015;
        adjustedWeights.skip += recordWeight * 0.008;
      }
      const changedParams = String(row[changedParamsIdx] || "");
      if (changedParams.includes("年天干") && remarks.includes("命中")) {
        adjustedWeights.metaBoostYear += recordWeight * 0.005;
      }
      // 紫微共振學習：若該期受紫微增益且命中，則強化權重
      if (
        (changedParams.includes("本命") || changedParams.includes("父母")) &&
        remarks.includes("命中")
      ) {
        adjustedWeights.metaBoostLifePalace =
          (adjustedWeights.metaBoostLifePalace || 0.08) + recordWeight * 0.005;
      }
    } else if (correlation < 0.15) {
      // 核心優化：表現不佳時適度下修權重，防止單一維度過度擴張
      adjustedWeights.repeat -= recordWeight * 0.005;
      adjustedWeights.skip -= recordWeight * 0.003;

      // 表現不佳時下修紫微權重
      const changedParams = String(row[changedParamsIdx] || "");
      if (changedParams.includes("本命") || changedParams.includes("父母")) {
        adjustedWeights.metaBoostLifePalace =
          (adjustedWeights.metaBoostLifePalace || 0.08) - recordWeight * 0.002;
      }
    }
  }

  // 核心優化：執行最終數值箝位 (Clamping)，防止參數調整過快或失真
  const LIMITS = {
    repeat: { min: 0.5, max: 1.5 },
    skip: { min: 0.2, max: 0.9 },
    metaBoostYear: { min: 0.01, max: 0.3 },
    metaBoostLifePalace: { min: 0.005, max: 0.15 }, // 考慮到宮位變多，下修上限
  };

  adjustedWeights.repeat = Math.max(
    LIMITS.repeat.min,
    Math.min(LIMITS.repeat.max, adjustedWeights.repeat),
  );
  adjustedWeights.skip = Math.max(
    LIMITS.skip.min,
    Math.min(LIMITS.skip.max, adjustedWeights.skip),
  );
  adjustedWeights.metaBoostYear = Math.max(
    LIMITS.metaBoostYear.min,
    Math.min(LIMITS.metaBoostYear.max, adjustedWeights.metaBoostYear),
  );
  adjustedWeights.metaBoostLifePalace = Math.max(
    LIMITS.metaBoostLifePalace.min,
    Math.min(
      LIMITS.metaBoostLifePalace.max,
      adjustedWeights.metaBoostLifePalace || 0.08,
    ),
  );

  try {
    setPropertySheetValue("prct1_Property", cacheKey, adjustedWeights, ss);
    setPropertySheetValue(
      "prct1_Property",
      cacheKey + "_VERSION",
      PRCT1_ALGO_VERSION,
      ss,
    );
    Logger.log(`[AutoLearn] ${lotto} 基礎權重已自動微調並存入試算表。`);
  } catch (e) {
    Logger.log(`[AutoLearn Error] ${lotto} 權重寫入失敗: ` + e.message);
  }
}

/**
 * 寫入 KV 資料至屬性工作表，確保 Key 不重複
 */
function setPropertySheetValue(sheetName, key, value, ss) {
  try {
    // 清除快取，確保下次讀取為最新值
    const cacheKey = ss.getId() + "_" + sheetName;
    delete _prct1_propertyCache[cacheKey];

    const sheet = ss.getSheetByName(sheetName) || ss.insertSheet(sheetName);
    const lastRow = sheet.getLastRow();
    const stringValue =
      typeof value === "object" ? JSON.stringify(value) : value;
    const keyStr = String(key);

    if (lastRow > 0) {
      const data = sheet.getRange(1, 1, lastRow, 1).getValues();
      for (let i = 0; i < data.length; i++) {
        if (String(data[i][0]) === keyStr) {
          sheet.getRange(i + 1, 2).setValue(stringValue);
          return;
        }
      }
    }
    sheet.appendRow([keyStr, stringValue]);
  } catch (e) {
    Logger.log(`[setPropertySheetValue Error] ${e.message}`);
  }
}

/**
 * 從屬性工作表讀取資料
 */
function getPropertySheetValue(sheetName, key, defaultValue, ss) {
  try {
    const ssId = ss.getId();
    const cacheKey = ssId + "_" + sheetName;

    // 效能優化：如果該執行緒尚未讀取過此工作表，則一次性讀取並快取
    if (!_prct1_propertyCache[cacheKey]) {
      const sheet = ss.getSheetByName(sheetName);
      if (!sheet) return defaultValue;
      const data = sheet.getDataRange().getValues();
      const map = {};
      data.forEach((row) => {
        if (row[0]) map[String(row[0])] = row[1];
      });
      _prct1_propertyCache[cacheKey] = map;
    }

    const val = _prct1_propertyCache[cacheKey][String(key)];
    if (val === undefined) return defaultValue;
    try {
      return JSON.parse(val);
    } catch (e) {
      return val;
    }
  } catch (e) {
    return defaultValue;
  }
}

/**
 * 取得目前的 AI 學習權重參數 (供前端顯示)
 */
function getPrediction1WeightSettings(lotto) {
  try {
    // 取得目標彩種的專屬試算表
    const trObj = getTargetsheet("Sheets", lotto);
    return getLearnedBaseWeights(lotto, trObj.spreadsheet);
  } catch (e) {
    Logger.log("getPrediction1WeightSettings Error: " + e.message);
    return null;
  }
}

/**
 * 取得學習後的基礎權重，若無則回傳系統預設值
 * @param {string} lotto 彩種
 * @param {GoogleAppsScript.Spreadsheet.Spreadsheet} ss
 * @returns {Object} 權重物件
 */
function getLearnedBaseWeights(lotto, ss) {
  const cacheKey = PRCT1_ALGO_VERSION + "_LEARNED_WEIGHTS_" + lotto;
  const cached = getPropertySheetValue("prct1_Property", cacheKey, null, ss);

  const defaultWeights = {
    frequency: 0.4,
    repeat: 0.875,
    skip: 0.45,
    metaBoostYear: 0.1,
    metaBoostTriple: 0.5,
    metaBoostLifePalace: 0.08, // 新增：本命共振預設加成係數
    posSevereThres: 15, // 位置限制：極端偏離距離門檻 (預設 15)
    posNormalThres: 10, // 位置限制：一般偏離距離門檻 (預設 10)
    posSevereFactor: 0.92, // 位置限制：極端偏離降權係數 (預設 0.92)
    posNormalFactor: 0.96, // 位置限制：一般偏離降權係數 (預設 0.96)
  };

  if (cached) {
    const weights = typeof cached === "string" ? JSON.parse(cached) : cached;
    // 核心修正：使用 Object.assign 合併，確保舊快取能讀到新加入的預設參數 (如本命共振)
    return Object.assign({}, defaultWeights, weights);
  }
  return defaultWeights;
}

/**
 * V1 系統專屬快取清理：僅清理 prct1_Property 與 V1 演算法相關的 Properties
 */
function clearV1Cache(lotto) {
  try {
    const props = PropertiesService.getUserProperties();
    const keys = props.getKeys();
    // 核心修正：正確抓取版本主前綴 (例如 A107 -> A1) 以進行相關快取清理
    const v1Prefix = PRCT1_ALGO_VERSION.substring(0, 2);

    let count = 0;
    keys.forEach((k) => {
      if (k.startsWith(v1Prefix) || k.includes("_STATS_" + lotto)) {
        props.deleteProperty(k);
        count++;
      }
    });

    // 清理試算表持久快取
    const trObj = getTargetsheet("Sheets", lotto);
    const propSheet = trObj.spreadsheet.getSheetByName("prct1_Property");
    if (propSheet) {
      // 保留標題列，清除內容
      const lastRow = propSheet.getLastRow();
      if (lastRow > 1) propSheet.getRange(2, 1, lastRow - 1, 2).clearContent();
    }

    // 增加：隔離版本遞增
    incrementSystemVersion("V1");

    return {
      status: "success",
      message: `已清理 ${count} 項 V1 專屬快取數據。`,
    };
  } catch (e) {
    return { status: "error", message: "V1 快取清理失敗: " + e.message };
  }
}

/**
 * 獲取當前快取資訊 (供前端顯示)
 */
function getCacheInfo(lotto) {
  try {
    const ss = getTargetsheet("Sheets", lotto).spreadsheet;
    const propSheet = ss.getSheetByName("prct1_Property");

    return {
      version: PRCT1_ALGO_VERSION,
      rowCount: propSheet ? propSheet.getLastRow() : 0,
    };
  } catch (e) {
    return { version: PRCT1_ALGO_VERSION, rowCount: 0, piCount: 0 };
  }
}

/**
 * 清理 V1 專屬的舊版本歷史回測紀錄 (prct1_History)
 * 僅移除版本號不相符的資料，保留目前版本的紀錄。
 */
function clearPrediction1History(lotto) {
  try {
    const trObj = getTargetsheet("Sheets", lotto);
    const ss = trObj.spreadsheet;
    const historySheet = ss.getSheetByName("prct1_History");

    if (!historySheet)
      return { status: "success", message: "找不到歷史工作表，無需清理。" };

    const data = historySheet.getDataRange().getValues();
    if (data.length <= 1)
      return { status: "success", message: "目前無歷史資料。" };

    const header = data[0];
    // 取得當前演算法版本對應的標籤
    const currentCacheLabel = "HIT_HISTORY_" + PRCT1_ALGO_VERSION;

    // 過濾邏輯：只保留標籤符合目前版本的資料列
    const rowsToKeep = data
      .slice(1)
      .filter((row) => row[0] === currentCacheLabel);
    const removedCount = data.length - 1 - rowsToKeep.length;

    // 重新寫回試算表
    historySheet.clearContents();
    const finalData = [header, ...rowsToKeep];
    historySheet
      .getRange(1, 1, finalData.length, finalData[0].length)
      .setValues(finalData);

    return {
      status: "success",
      message: `清理完成！共移除 ${removedCount} 筆舊版本資料，保留 ${rowsToKeep.length} 筆目前版本 (${PRCT1_ALGO_VERSION}) 紀錄。`,
    };
  } catch (e) {
    return { status: "error", message: "清理舊版本歷史資料失敗: " + e.message };
  }
}

/**
 * 自動管理 prct1_Property：清理過舊版本的快取資料。
 * 儲存邏輯：允許不同版本的資料共存。
 * 管理邏輯：保留最近 2 個演算法版本 (如 A107, A106) 的資料，其餘自動刪除。
 * @param {GoogleAppsScript.Spreadsheet.Spreadsheet} ss 目標彩種試算表
 */
function managePrct1PropertyVersions(ss) {
  try {
    const propSheet = ss.getSheetByName("prct1_Property");
    if (!propSheet) return;

    const data = propSheet.getDataRange().getValues();
    if (data.length <= 1) return;

    // 1. 萃取所有存在的 A 系列版本號
    const versionsFound = new Set();
    data.forEach((row) => {
      const key = String(row[0]);
      // 優化：相容包含系統版本前綴的格式 (例如 v0.154_A107 -> 107)
      const match = key.match(/A(\d{3})/);
      if (match) versionsFound.add(match[1]);
    });

    // 2. 排序版本 (數字大代表新版本)
    const sortedVersions = Array.from(versionsFound)
      .map(Number)
      .sort((a, b) => b - a);
    if (sortedVersions.length <= 2) return; // 僅保留最新的 2 個版本，無需清理

    const keepVersions = sortedVersions.slice(0, 2).map((v) => "A" + v);

    // 3. 記憶體過濾法優化：批次重寫工作表以提升效能，避免迴圈 deleteRow 導致超時
    const header = data[0];
    const filteredRows = data.slice(1).filter((row) => {
      const key = String(row[0]);
      const match = key.match(/A(\d{3})/);
      // 保留非版本化 Key (如全域設定) 或屬於最新 2 個版本的資料
      return !match || keepVersions.includes("A" + match[1]);
    });

    if (filteredRows.length + 1 < data.length) {
      propSheet.clearContents();
      const newData = [header, ...filteredRows];
      propSheet
        .getRange(1, 1, newData.length, newData[0].length)
        .setValues(newData);
      SpreadsheetApp.flush();
      Logger.log(
        `[Property AutoManage] 已完成批次清理。保留版本: ${keepVersions.join(", ")}，剩餘行數: ${newData.length}`,
      );
    }
  } catch (e) {
    Logger.log(`[Property AutoManage Error] ${e.message}`);
  }
}
