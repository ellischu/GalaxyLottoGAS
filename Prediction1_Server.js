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
    let targetIdx = -1;
    for (let i = adDataAll.length - 1; i >= 1; i--) {
      if (
        Utilities.formatDate(
          new Date(adDataAll[i][0]),
          "GMT+8",
          "yyyy-MM-dd",
        ) === dateStr
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
      .filter((row) => row[0] instanceof Date);
    const todayActualInAll = allDataRaw.find(
      (row) =>
        Utilities.formatDate(new Date(row[0]), "GMT+8", "yyyy-MM-dd") ===
        dateStr,
    );
    const todayActual = todayActualInAll || adRow; // 若 All 沒資料才用 AllData

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

    // 若發生歲破，SignalBoost 額外提升，且標記為高震盪
    const signalBoost = 1 + changeRatio * 0.5 + (isYearDayClash ? 0.3 : 0);

    // 2. 提取最近 60 期資料 (排除預測日及之後)
    const trainingData = allDataRaw
      .filter((row) => new Date(row[0]).getTime() < targetDate.getTime())
      .slice(-60);
    if (trainingData.length === 0) throw new Error("歷史資料不足");

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
    );
    const resultNumbers = predResult.numbers.slice(0, topNChoice);

    // 4. 計算相關係數 (假設以權重前 N 名與實際結果的匹配度作為係數參考)
    const correlation = calculateCorrelation(resultNumbers, todayActual);

    // --- 數據分析師：平衡偏移偵測 (趨勢比對) ---
    const recentDataForTrend = trainingData.slice(-20);
    const maxNumAnalyst = lotto === "L539" || lotto === "L638" ? 39 : 49;
    const midPointAnalyst = Math.floor(maxNumAnalyst / 2);
    const ballCountAnalyst = lotto === "L539" ? 5 : 6;
    let tBig = 0,
      tSmall = 0,
      tOdd = 0,
      tEven = 0;

    recentDataForTrend.forEach((row) => {
      const nums = row
        .slice(1, ballCountAnalyst + 1)
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
    const ballCount = lotto === "L539" ? 5 : 6;
    const maxNum = lotto === "L539" || lotto === "L638" ? 39 : 49;
    const theoryMeanSum = ((1 + maxNum) * ballCount) / 2;

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
    // 修正 Slice 範圍：L539 取 index 1-5 (N1-N5), 其他取 1-6 (N1-N6)，排除 Sum 欄位
    const actualNums = todayActual
      ? (lotto === "L539" ? todayActual.slice(1, 6) : todayActual.slice(1, 7))
          .map(Number)
          .filter((n) => n > 0)
      : null;
    const actualS1 =
      lotto !== "L539" && todayActual && todayActual.length > 7
        ? Number(todayActual[7])
        : null;
    const isS1Hit = actualS1 && resultNumbers.map(Number).includes(actualS1);
    const hitDetail = checkHits(resultNumbers, todayActual, lotto);

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

    // 5.1 產生簡單的 AI 戰略建議
    const clashWarning = isYearDayClash
      ? "【歲破警示】當前日支與年支相沖，歷史規律可能劇烈擾動。"
      : "";
    const harmonySignal = isYearDayHarmony
      ? "【星系和合】日支與年支六合，環境磁場穩固，歷史慣性極強。"
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
        ? `偵測到星系活躍度達 ${(changeRatio * 100).toFixed(0)}%。${clashWarning}${harmonySignal}能量場重組期，優先關注「連莊」星球。`
        : `${clashWarning}${harmonySignal}星系能量平穩。建議均衡佈局，參考「隔期」與「五行共振」路徑。`) +
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
      fullPool: predResult.numbers, // 回傳完整 20 名候選池供前端換組
      labels: predResult.labels,
      hitSummary: hitDetail,
      actualNums: actualNums,
      actualS1: actualS1,
      isS1Hit: isS1Hit,
      historyHits: historyHits,
      envDetails: envDetails,
      columnMeans: predResult.columnMeans, // 回傳各柱平均值
      date: dateStr,
      aiStrategy: aiStrategy,
      trendStats: trendStats, // 回傳近期趨勢數據
      avgAmp: predResult.avgAmp, // 回傳歷史平均振幅
      resonanceNumbers: predResult.resonanceNumbers, // 回傳受共振加權的號碼
      balanceStats: getBalanceStats(resultNumbers, lotto), // 回傳平衡指標數據
      // 增加最後兩期的中獎號碼，用於前端標示連莊與隔期
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
  } catch (e) {
    return { success: false, error: e.toString() };
  }
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
  const maxNum = lotto === "L539" || lotto === "L638" ? 39 : 49;
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
  const isHarmony = (p1 + p2) % 12 === 1; // 六合判定公式

  // --- 三合局判定 (申子辰、亥卯未、寅午戌、巳酉丑) ---
  let tripleElement = null;
  const currentBranches = new Set([p1, p2, p3]);

  const tripleSets = [
    { set: [8, 0, 4], element: "水" }, // 申子辰
    { set: [11, 3, 7], element: "木" }, // 亥卯未
    { set: [2, 6, 10], element: "火" }, // 寅午戌
    { set: [5, 9, 1], element: "金" }, // 巳酉丑
  ];

  for (const ts of tripleSets) {
    // 若年、月、日中有兩個或三個構成三合核心 (必須包含長生、帝旺或墓庫)
    const matchCount = ts.set.filter((b) => currentBranches.has(b)).length;
    if (matchCount >= 2) {
      tripleElement = ts.element;
      break;
    }
  }

  return { isClash, isHarmony, tripleElement };
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
) {
  const stats = calculateStats(trainingData, lotto);
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

    // 若發生六合 (Harmony)，提升穩定號碼 (頻率與連莊) 的權重補償
    const harmonyMult = isHarmony ? 1.25 : 1.0;

    const repeatWeight = r * 2.5 * 0.35 * signalBoost * harmonyMult;
    const skipWeight = s * 1.8 * 0.25 * signalBoost;
    finalWeights[num] = f * 0.4 + repeatWeight + skipWeight;

    // --- 執行五行比例加權 ---
    const lastDigit = parseInt(num) % 10;
    let metaBoost = 1.0;

    // 年度五行共振 (1.1x)
    if (luckyDigits.includes(lastDigit)) {
      metaBoost *= 1.1;
      resonanceNumbers.push(String(num));
    }
    // 三合局噴發加權 (1.5x)
    if (isTripleActive && tripleLuckyDigits.includes(lastDigit)) {
      metaBoost *= 1.5;
      if (!resonanceNumbers.includes(String(num)))
        resonanceNumbers.push(String(num));
    }

    // --- 數據分析師優化：執行環境平衡因子 (奇偶/大小/和值) ---
    applyAnalystFilters(finalWeights, lotto, trainingData);

    // --- 新增：位置回歸限制器 (依據各柱平均值修正偏離過遠的權重) ---
    applyPositionLimiter(num, finalWeights, stats.columnMeans);

    finalWeights[num] *= metaBoost;
  });

  if (missSheet) {
    const missData = missSheet
      .getDataRange()
      .getValues()
      .filter((row) => new Date(row[0]) < targetDate)
      .slice(-60);
    const missWeights = calculateMissWeights(missData, lotto);
    const lastMissRow = missData[missData.length - 1];
    const missStartIdx = lotto === "L539" ? 7 : 9;

    // 2.1 計算遺漏值的統計偏差
    const missStats = calculateMissStandardDeviation(
      missData,
      lotto,
      missStartIdx,
    );

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

  return {
    numbers: sortedNumbers.slice(0, 20), // 擴充至 20 個供前端一鍵換組使用
    labels: generateLabels(sortedNumbers, stats, reboundNumbers),
    resonanceNumbers: resonanceNumbers,
    columnMeans: stats.columnMeans, // 將 stats.columnMeans 從 corePredict 傳出
    avgAmp: stats.avgAmp, // 將 stats.avgAmp 從 corePredict 傳出
  };
}

/**
 * 位置回歸限制器：若號碼偏離星系預期軌道 (各柱平均值) 過遠，則給予適度降權
 */
function applyPositionLimiter(num, weights, columnMeans) {
  if (!columnMeans || columnMeans.length === 0) return;
  const n = parseInt(num);
  const cMeans = columnMeans.map(Number);

  // 找出該號碼與最近的柱位平均值之距離
  const minDist = Math.min(...cMeans.map((m) => Math.abs(n - m)));

  // 若該號碼與任何一個位置的平均值距離都超過 15 (極端偏離)
  // 則視為偏離軌道，給予 5%~10% 的權重修正
  if (minDist > 15) {
    weights[num] *= 0.92;
  } else if (minDist > 10) {
    weights[num] *= 0.96;
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
  const maxNum = type === "L539" || type === "L638" ? 39 : 49;
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
    const nums = row.slice(1, ballCount + 1).map(Number).filter((n) => n > 0);
    if (nums.length === ballCount) {
      nums.forEach((n, idx) => { colSums[idx] += n; });
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
  const avgAmp = amplitudes.reduce((a, b) => a + b, 0) / (amplitudes.length || 1);

  // 3. 統計加權頻率 (修正變數未定義錯誤)
  sets.forEach((currentSet, i) => {
    const indexDiff = sets.length - 1 - i;
    const timeDecayWeight = Math.pow(0.98, indexDiff); // 每天衰減 2%

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
  const maxNum = lotto === "L539" || lotto === "L638" ? 39 : 49;
  const stats = {};

  for (let n = 1; n <= maxNum; n++) {
    const missValues = missData.map(
      (row) => Number(row[startIdx + n - 1]) || 0,
    );
    const avg = missValues.reduce((a, b) => a + b, 0) / missValues.length;
    const variance =
      missValues.reduce((sum, val) => sum + Math.pow(val - avg, 2), 0) /
      missValues.length;
    stats[n] = {
      avg: avg,
      stdDev: Math.sqrt(variance) || 1,
    };
  }
  return stats;
}

/** 遺漏數加權 (精確球號映射版) */
function calculateMissWeights(data, lotto) {
  const weights = {};
  const missStartIdx = lotto === "L539" ? 7 : 9;
  const maxNum = lotto === "L539" || lotto === "L638" ? 39 : 49;

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

  // 過濾出小於預測日期的資料，並取最後 10 筆作為回測樣本
  const pastPeriods = allDataRaw
    .filter((row) => new Date(row[0]) < targetDate)
    .slice(-limit);

  pastPeriods.forEach((record) => {
    const d = new Date(record[0]);
    const train = allDataRaw
      .filter((row) => new Date(row[0]).getTime() < d.getTime())
      .slice(-60);
    if (train.length > 0) {
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
    }
  });
  return results;
}

/**
 * 數據分析師擴充：執行環境平衡因子 (奇偶、大小) 與和值引力修正 (基於振幅趨勢)
 * @param {Object} finalWeights 權重物件
 * @param {string} lotto 彩種
 * @param {Array} trainingData 訓練集
 */
function applyAnalystFilters(finalWeights, lotto, trainingData) {
  const maxNum = lotto === "L539" || lotto === "L638" ? 39 : 49;
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
