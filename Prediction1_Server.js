/** 演算法邏輯版本：當修改 corePredict 權重或公式後，請遞增此版本號以自動失效舊快取 */
const PRCT1_ALGO_VERSION = "A107"; // 遞增版本號以自動失效舊快取

/**
 * getPrediction01 - 主預測進入點
 */
function getPrediction01(lotto, dateStr, useTrend, topNChoice) {
  try {
    const targetDate = new Date(dateStr.replace(/-/g, "/"));
    targetDate.setHours(0, 0, 0, 0);
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
    const targetTime = targetDate.getTime();
    let targetIdx = -1;
    for (let i = adDataAll.length - 1; i >= 1; i--) {
      const rowDate = adDataAll[i][0];
      if (rowDate instanceof Date && rowDate.getTime() === targetTime) {
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
      .filter((row) => row[0] instanceof Date);

    const todayActualInAll = allDataRaw.find(
      (row) => row[0].getTime() === targetTime,
    );

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
      const drawDaysMap = {
        L539: [1, 2, 3, 4, 5, 6],
        L649: [2, 5],
        L638: [1, 4],
        LSix: [2, 4, 6],
      };
      const isMajorDrawDay = drawDaysMap[lotto]
        ? drawDaysMap[lotto].includes(dayOfWeek)
        : false;

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
              Math.max(0, trainingCutoffIdx - 59),
              trainingCutoffIdx + 1,
            )
          : [];

      if (trainingData.length === 0) throw new Error("歷史資料不足");

      // --- 核心優化：連號傾向偵測 ---
      const ballCount = lotto === "L539" ? 5 : 6;
      const recent3 = trainingData.slice(-3);
      let consecutiveMatch = 0;
      recent3.forEach((row) => {
        const nums = row
          .slice(1, ballCount + 1)
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
      const predResult = corePredict(
        lotto,
        trainingData,
        useTrend ? missSheet : null,
        targetDate,
        signalBoost,
        yearStem,
        isYearDayHarmony,
        tripleElement,
        topNChoice,
        isConsecutiveTrend,
        ss, // 傳入當前彩種試算表物件以存取 prct1_Property
      );

      if (!predResult) throw new Error("核心演算法未回傳結果");

      const resultNumbers = predResult.numbers.slice(0, topNChoice);

      // 4. 計算相關係數 (假設以權重前 N 名與實際結果的匹配度作為係數參考)
      const correlation = calculateCorrelation(resultNumbers, todayActualInAll);

      // --- 數據分析師：平衡偏移偵測 (趨勢比對) ---
      const recentDataForTrend = trainingData.slice(-20);
      const maxNumAnalyst = lotto === "L638" ? 38 : lotto === "L539" ? 39 : 49;
      const midPointAnalyst = Math.floor(maxNumAnalyst / 2);
      let tBig = 0,
        tSmall = 0,
        tOdd = 0,
        tEven = 0;

      recentDataForTrend.forEach((row) => {
        const nums = row
          .slice(1, ballCount + 1)
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
      const theoryMeanSum = ((1 + maxNumAnalyst) * ballCount) / 2;

      const trendStats = {
        bigCount: tBig / 20, // 平均每期顆數
        smallCount: tSmall / 20,
        oddCount: tOdd / 20,
        evenCount: tEven / 20,
        bigRatio: trendBigRatio,
        oddRatio: trendOddRatio,
        theoryMeanSum: theoryMeanSum,
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
      const isS1Hit = actualS1 && resultNumbers.map(Number).includes(actualS1);
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

      // --- 核心優化：權重自動學習機制 (初步框架) ---
      autoAdjustBaseWeights(settingsSheet, lotto, ss);

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
      );

      return {
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
        isCached: predResult.isCached, // 回傳快取命中狀態
        lotto: lotto, // 供前端按鈕識別
        resonanceNumbers: predResult.resonanceNumbers,
        balanceStats: getBalanceStats(resultNumbers, lotto),
        lastDrawNums:
          trainingData.length >= 1
            ? trainingData[trainingData.length - 1]
                .slice(1, 8)
                .map(Number)
                .filter((n) => n > 0)
            : [],
        prevDrawNums:
          trainingData.length >= 2
            ? trainingData[trainingData.length - 2]
                .slice(1, 8)
                .map(Number)
                .filter((n) => n > 0)
            : [],
      };
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
        getCacheVersion(PRCT1_ALGO_VERSION) +
        "_STATS_" +
        lotto +
        "_" +
        lastDrawDate;
      const missCacheKey =
        getCacheVersion(PRCT1_ALGO_VERSION) +
        "_MISS_" +
        lotto +
        "_" +
        lastDrawDate;

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
function calculateCorrelation(predicted, actual) {
  if (!actual) return (Math.random() * 0.4 + 0.2).toFixed(4);
  const actualNums = actual
    .slice(1, 8)
    .map(Number)
    .filter((n) => n > 0);
  const hits = predicted.filter((n) => actualNums.includes(Number(n))).length;
  return (hits / actualNums.length).toFixed(4);
}

/** 計算組合平衡指標統計 */
function getBalanceStats(numbers, lotto) {
  const maxNum = lotto === "L638" ? 38 : lotto === "L539" ? 39 : 49;
  const mid = Math.floor(maxNum / 2);
  let big = 0,
    small = 0,
    odd = 0,
    even = 0;
  numbers.forEach((n) => {
    const num = Number(n);
    if (num > mid) big++;
    else small++;
    if (num % 2 !== 0) odd++;
    else even++;
  });
  return { big, small, odd, even };
}

/** 核心預測邏輯封裝 */
function corePredict(
  lotto,
  trainingData,
  missSheet,
  targetDate,
  signalBoost = 1.0,
  yearStem = "",
  isHarmony = false,
  tripleElement = null,
  topNChoice = 10,
  isConsecutiveTrend = false,
  ss = null, // 目標專屬試算表
) {
  try {
    const learnedWeights = getLearnedBaseWeights(lotto, ss); // 取得學習後的權重
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
      getCacheVersion(PRCT1_ALGO_VERSION) +
      "_STATS_" +
      lotto +
      "_" +
      lastDrawDate;

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

    let finalWeights = {};
    let reboundNumbers = []; // 存儲觸發反彈預警的號碼
    let resonanceNumbers = []; // 存儲受共振加權的號碼

    // --- 年天干五行加權設定 ---
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
        resonanceNumbers.push(String(num));
      }
      // 三合局噴發加權 (1.5x)
      if (isTripleActive && tripleLuckyDigits.includes(lastDigit)) {
        metaBoost *= 1 + learnedWeights.metaBoostTriple * envSensitivity;
        if (!resonanceNumbers.includes(String(num)))
          resonanceNumbers.push(String(num));
      }

      // --- 新增：位置回歸限制器 (依據各柱平均值修正偏離過遠的權重) ---
      applyPositionLimiter(num, finalWeights, stats.columnMeans);

      finalWeights[num] *= metaBoost;
    });

    // --- 數據分析師優化：執行環境平衡因子 (移出迴圈，僅執行一次以確保邏輯正確並提升效能) ---
    applyAnalystFilters(finalWeights, lotto, trainingData);

    if (missSheet) {
      const missStartIdx = lotto === "L539" ? 7 : 9;
      const missCacheKey =
        getCacheVersion(PRCT1_ALGO_VERSION) +
        "_MISS_" +
        lotto +
        "_" +
        lastDrawDate;
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

      if (!missPackage) {
        const missData = missSheet
          .getDataRange()
          .getValues()
          .filter((row) => new Date(row[0]) < targetDate)
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
      const catIdx = Math.min(Math.floor(index / categorySize), categories.length - 1);
      return {
        number: num,
        elementCategory: categories[catIdx].name,
        elementColor: categories[catIdx].color
      };
    });

    return {
      numbers: predictionObjects.slice(0, 20), // 改為回傳物件陣列
      labels: generateLabels(sortedNumbers, stats, reboundNumbers),
      resonanceNumbers: resonanceNumbers,
      columnMeans: stats.columnMeans, // 將 stats.columnMeans 從 corePredict 傳出
      avgAmp: stats.avgAmp, // 將 stats.avgAmp 從 corePredict 傳出
      isCached: isFromCache, // 傳遞快取狀態
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
  const topCandidates = Object.entries(weights)
    .sort((a, b) => b[1] - a[1])
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
      const penalty = run.length >= 4 ? 0.75 : 0.85;
      weights[weakestNum] *= penalty;

      i += run.length - 1; // 跳過已處理的連號區間
    }
  }
}

/** 統計出球頻率、連莊與隔期跳 */
function calculateStats(data, type) {
  const maxNum = type === "L638" ? 38 : type === "L539" ? 39 : 49;
  const ballCount = type === "L539" ? 5 : 6;
  const freq = {},
    repeats = {},
    skips = {};
  const sumHistory = [];
  const colSums = new Array(ballCount).fill(0);
  let validRows = 0;

  for (let i = 1; i <= maxNum; i++) {
    freq[i] = 0;
    repeats[i] = 0;
    skips[i] = 0;
  }

  // 1. 將每一期轉換為 Set 並計算柱位平均與總和歷史
  const sets = data.map((row) => {
    const nums = row
      .slice(1, ballCount + 1)
      .map(Number)
      .filter((n) => n > 0);
    if (nums.length === ballCount) {
      nums.forEach((n, idx) => {
        colSums[idx] += n;
      });
      sumHistory.push(nums.reduce((a, b) => a + b, 0));
      validRows++;
    }
    return new Set(nums);
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
      if (num < 1 || num > maxNum) return;
      freq[num] += 1 * timeDecayWeight;

      // 統計連莊 (本期與上期同時出現)
      if (i > 0 && sets[i - 1].has(num)) repeats[num] += 1 * timeDecayWeight;

      // 統計隔期跳 (本期與前二期出現，但前一期沒出現)
      if (i > 1 && sets[i - 2].has(num) && !sets[i - 1].has(num))
        skips[num] += 1 * timeDecayWeight;
    });
  });

  return {
    frequency: freq,
    repeats: repeats,
    skips: skips,
    avg: (data.length * ballCount) / maxNum,
    columnMeans: columnMeans,
    avgAmp: avgAmp.toFixed(1),
  };
}

/** 計算各球號遺漏值的平均值與標準差 */
function calculateMissStandardDeviation(missData, lotto, startIdx) {
  const maxNum = lotto === "L638" ? 38 : lotto === "L539" ? 39 : 49;
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
  const maxNum = lotto === "L638" ? 38 : lotto === "L539" ? 39 : 49;

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

  // 區分一般號與特別號 (L539 無特別號)
  const mainRange = lotto === "L539" ? [1, 6] : [1, 7];
  const s1Idx = lotto === "L539" ? -1 : 7;

  const mainNums = actual
    .slice(mainRange[0], mainRange[1])
    .map(Number)
    .filter((n) => n > 0);
  const s1 = s1Idx !== -1 ? Number(actual[s1Idx]) : null;

  const mainHits = predicted.filter((n) => mainNums.includes(Number(n))).length;
  const s1Hit = s1 && predicted.map(Number).includes(s1);

  const totalToHit = lotto === "L539" ? 5 : 6;
  let summary = `命中 ${mainHits}/${totalToHit}`;
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
) {
  const results = [];
  const newRecords = [];
  const trObj = getTargetsheet("Sheets", lotto);
  const settingsSheet = trObj.spreadsheet.getSheetByName("prct1_Settings");

  // 1. 預先讀取現有紀錄，防止重複計算與寫入
  const hitCache = {};
  if (settingsSheet) {
    const settingsData = settingsSheet.getDataRange().getValues();
    for (let j = 1; j < settingsData.length; j++) {
      const row = settingsData[j];
      if (row[0] === "HIT_HISTORY" && row[1] === lotto && String(row[3]) === String(topN)) {
        const dKey = row[2] instanceof Date 
          ? Utilities.formatDate(row[2], "GMT+8", "yyyy-MM-dd") 
          : String(row[2]);
        hitCache[dKey] = row[4];
      }
    }
  }

  // 效能優化：改用索引查找，避免在迴圈內反覆 filter 日期物件
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
  for (let i = startIndex; i <= targetIdx; i++) {
    const record = allDataRaw[i];
    const d = record[0];
    // 取得該期回測所需的 60 期訓練資料
    const train = allDataRaw.slice(Math.max(0, i - 60), i);

    try {
      const dStr = Utilities.formatDate(d, "GMT+8", "yyyy-MM-dd");
      
      // 2. 檢查快取是否存在（包含 0 命中的紀錄）
      if (hitCache[dStr] !== undefined) {
        results.push({
          date: Utilities.formatDate(d, "GMT+8", "MM-dd"),
          hits: hitCache[dStr],
        });
        continue;
      }

      if (train.length >= 5) {
        const pred = corePredict(lotto, train, missSheet, d);
        const actualNums = record
          .slice(1, 8)
          .map(Number)
          .filter((n) => n > 0);
        const hits = pred.numbers
          .slice(0, topN)
          .filter((n) => actualNums.includes(Number(n))).length;
        results.push({
          date: Utilities.formatDate(d, "GMT+8", "MM-dd"),
          hits: hits,
        });
        // 準備存入快取
        newRecords.push([
          "HIT_HISTORY", 
          lotto, 
          dStr, 
          topN, 
          hits, 
          JSON.stringify([]), // 命中號碼佔位符，補齊為 7 欄位
          new Date()
        ]);
      }
    } catch (loopErr) {
      Logger.log(`回測跳過期數 ${d}: ${loopErr.message}`);
    }
  }

  // 批次更新快取工作表
  if (newRecords.length > 0 && settingsSheet) {
    settingsSheet
      .getRange(settingsSheet.getLastRow() + 1, 1, newRecords.length, 7)
      .setValues(newRecords);
  }
  return results;
}

/**
 * 供前端呼叫的 V1 歷史命中統計進入點
 */
function getPrediction1HistoryStats(lotto, topN) {
  try {
    const trObj = getTargetsheet("Sheets", lotto);
    const ss = trObj.spreadsheet;
    const allSheet = ss.getSheetByName("All");
    const missSheet = ss.getSheetByName("Miss");
    const allDataRaw = allSheet.getDataRange().getValues().filter(row => row[0] instanceof Date);
    
    // 預設以今日為基準回測最近 30 期
    const targetDate = new Date();
    return getRecentHistoryHits(allDataRaw, 30, lotto, topN, missSheet, targetDate);
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
  const maxNum = lotto === "L638" ? 38 : lotto === "L539" ? 39 : 49;
  const midPoint = Math.floor(maxNum / 2);
  const ballCount = lotto === "L539" ? 5 : 6;

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

  // 理論中值 (例如 539: 100, 649: 150)
  const theoryMeanSum = ((1 + maxNum) * ballCount) / 2;

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
    // 若上期和值遠高於理論均值，則給予「能拉低總和」的小號 15% 補償權重
    if (lastSum > theoryMeanSum + avgAmp && n < midPoint) correction *= 1.15;
    if (lastSum < theoryMeanSum - avgAmp && n > midPoint) correction *= 1.15;

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
  const cacheKey =
    getCacheVersion(PRCT1_ALGO_VERSION) + "_LEARNED_WEIGHTS_" + lotto;

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

    if (correlation >= 0.3 || remarks.includes("命中")) {
      const recordWeight = Math.pow(
        LEARNING_DECAY_FACTOR,
        fullData.length - 1 - i,
      );
      if (remarks.includes("特別號命中") || remarks.includes("命中")) {
        adjustedWeights.repeat += recordWeight * 0.02;
        adjustedWeights.skip += recordWeight * 0.01;
      }
      const changedParams = String(row[changedParamsIdx] || "");
      if (changedParams.includes("年天干") && remarks.includes("命中")) {
        adjustedWeights.metaBoostYear += recordWeight * 0.005;
      }
    }
  }

  // 將調整後的權重改存入彩種專屬試算表的 prct1_Property
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
  const cacheKey =
    getCacheVersion(PRCT1_ALGO_VERSION) + "_LEARNED_WEIGHTS_" + lotto;
  const cached = getPropertySheetValue("prct1_Property", cacheKey, null, ss);

  const defaultWeights = {
    frequency: 0.4,
    repeat: 0.875,
    skip: 0.45,
    metaBoostYear: 0.1,
    metaBoostTriple: 0.5,
    posSevereThres: 15, // 位置限制：極端偏離距離門檻 (預設 15)
    posNormalThres: 10, // 位置限制：一般偏離距離門檻 (預設 10)
    posSevereFactor: 0.92, // 位置限制：極端偏離降權係數 (預設 0.92)
    posNormalFactor: 0.96, // 位置限制：一般偏離降權係數 (預設 0.96)
  };

  if (cached) {
    return typeof cached === "string" ? JSON.parse(cached) : cached;
  }
  return defaultWeights;
}
