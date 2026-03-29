/**
 * PredictModule.js
 * 專門處理 AI 星系預測與回測學習邏輯
 */

/**
 * 根據係數預測最可能的 10 顆星球 (AI 進階版)
 * @param {string} lotto 彩種 (L539, L649, etc.)
 * @param {string} dateStr 預測日期 (YYYY-MM-DD)
 * @param {boolean} useTrend 是否考慮冷熱趨勢權重
 */
function getPrediction(lotto, dateStr, useTrend) {
  const cache = CacheService.getScriptCache();
  const cacheKey = "PRED_MODEL_" + lotto + "_" + dateStr;

  try {
    // 1. 取得目標日期的係數
    const targetData = getAllData(dateStr);
    if (!targetData || targetData.length <= 1) {
      throw new Error(
        "找不到日期 [" +
          dateStr +
          "] 的預測係數。請確認 'AllData' 工作表已更新且包含該日期紀錄。",
      );
    }

    // --- 嘗試從快取讀取已學習的模型結果 ---
    const cachedModel = cache.get(cacheKey);
    let learnedResult = cachedModel ? JSON.parse(cachedModel) : null;

    // 2. 打開該彩種的 All 工作表
    const trObj = getTargetsheet("Sheets", lotto);
    const sheet = trObj.spreadsheet.getSheetByName("All");
    if (!sheet) return { status: "error", message: "找不到合併表格資料。" };

    const data = sheet.getDataRange().getValues();
    if (data.length < 2) return { status: "error", message: "歷史資料不足。" };

    const headers = data[0];
    const dateCol = headers.indexOf("Date");
    const sumCol = headers.indexOf("Sum");
    const s1Col = headers.indexOf("S1");

    const maxNum =
      lotto === "L649" || lotto === "LSix" ? 49 : lotto === "L638" ? 38 : 39;

    const toTime = (v) => {
      if (!v) return 0;
      const d =
        v instanceof Date
          ? new Date(v)
          : new Date(v.toString().replace(/-/g, "/"));
      if (isNaN(d.getTime())) {
        throw new Error("偵測到無效的日期格式: [" + v + "]。");
      }
      return d.setHours(0, 0, 0, 0);
    };
    const predTime = toTime(dateStr);

    const historicalData = [
      data[0],
      ...data.slice(1).filter((row) => {
        const rowDate = row[dateCol];
        return toTime(rowDate) < predTime;
      }),
    ];

    const coeffStartIdx = sumCol + 1;
    const allDataSheet = mainspreadsheet.getSheetByName("AllData");
    const rawAllDataHeaders = allDataSheet
      .getRange(1, 2, 1, allDataSheet.getLastColumn() - 1)
      .getValues()[0];

    const ignoreKeywords = ["標示", "系統", "內容", "備註", "ID"];
    const validCoeffIndices = [];
    const allDataHeaders = [];

    rawAllDataHeaders.forEach((h, idx) => {
      const headerStr = String(h);
      const isIgnored = ignoreKeywords.some((key) => headerStr.includes(key));
      if (!isIgnored) {
        validCoeffIndices.push(idx);
        allDataHeaders.push(headerStr);
      }
    });

    const targetCoeffs = validCoeffIndices.map((idx) => targetData[idx + 1]);
    const nCols = headers
      .map((h, i) => (h.match(/^N\d+$/) ? i : -1))
      .filter((i) => i !== -1);
    if (nCols.length === 0) {
      headers.forEach((h, i) => {
        if (h.match(/^L\d+$/)) nCols.push(i);
      });
    }

    let weightConfig = {
      波動: 2.5,
      成交: 1.8,
      趨勢: 1.5,
      隨機: 0.8,
      日期: 0.5,
      Date: 0.5,
      strp: 2.5,
      DEFAULT: 1.0,
    };

    let generalSig = 1.8;
    let specificSig = null;
    let bypassCache = false;
    let bypassCacheRowIdx = -1;
    const settingsSheet = mainspreadsheet.getSheetByName("Settings");
    if (settingsSheet) {
      const settingsData = settingsSheet.getDataRange().getValues();
      settingsData.forEach((row, i) => {
        const key = String(row[0]);
        if (key === "SigThreshold") generalSig = Number(row[1]) || 1.8;
        if (key === "BypassCache") {
          bypassCache =
            row[1] === true || String(row[1]).toUpperCase() === "TRUE";
          bypassCacheRowIdx = i + 1;
        }
        if (key === lotto + "_SigThreshold") specificSig = Number(row[1]);
        if (String(row[0]).startsWith("Weight_")) {
          weightConfig[row[0].replace("Weight_", "")] = Number(row[1]) || 1.0;
        }
      });
    }

    const coeffWeights = allDataHeaders.map((h) => {
      const matchKey = Object.keys(weightConfig).find((key) =>
        String(h).includes(key),
      );
      return matchKey ? weightConfig[matchKey] : weightConfig["DEFAULT"];
    });

    let repeatConf,
      skipConf,
      rareConf,
      consecConf,
      tailConf,
      sumConf,
      isChaos,
      learningMode,
      learningInsights,
      learnedEffArr,
      confidenceHistory;

    if (!learnedResult || bypassCache) {
      if (bypassCache && settingsSheet && bypassCacheRowIdx !== -1) {
        settingsSheet.getRange(bypassCacheRowIdx, 2).setValue(false);
      }

      let trainWindow = Math.min(historicalData.length - 2, 60);
      let learnedEfficiency = new Array(targetCoeffs.length).fill(0);
      let repeatCaptureScore = 0,
        skipCaptureScore = 0,
        rareCaptureScore = 0,
        consecCaptureScore = 0,
        tailCaptureScore = 0,
        sumCaptureScore = 0;

      const numberFrequencies = {};
      const runningMisses = {};
      for (let j = 1; j <= maxNum; j++) runningMisses[j] = 0;

      const preProcessedHistory = historicalData.map((row, idx) => {
        if (idx === 0) return null;
        const nums = nCols
          .map((cIdx) => Number(row[cIdx]))
          .filter((n) => !isNaN(n));
        const drawSet = new Set(nums);
        const missSnapshot = { ...runningMisses };
        nums.forEach((n) => {
          numberFrequencies[n] = (numberFrequencies[n] || 0) + 1;
        });
        for (let j = 1; j <= maxNum; j++) {
          if (drawSet.has(j)) runningMisses[j] = 0;
          else runningMisses[j]++;
        }
        const sumVal = Number(row[sumCol]) || 0;
        return {
          nums: nums,
          set: new Set(nums),
          coeffs: validCoeffIndices.map(
            (vIdx) => row.slice(coeffStartIdx)[vIdx],
          ),
          misses: missSnapshot,
          sumVal: sumVal,
          sumRange: Math.floor(sumVal / 20),
          tails: new Set(nums.map((n) => n % 10)),
        };
      });
      const avgFrequency =
        Object.values(numberFrequencies).reduce((a, b) => a + b, 0) /
        (maxNum || 1);

      const performLearning = (startIdx, endIdx) => {
        for (let t = startIdx; t < endIdx; t++) {
          const test = preProcessedHistory[t];
          const tM1 = preProcessedHistory[t - 1];
          const tM2 = t > 2 ? preProcessedHistory[t - 2] : null;
          if (!test || !tM1) continue;

          test.nums.forEach((n) => {
            const rarityBonus =
              Math.min(1.5, avgFrequency / (numberFrequencies[n] || 1)) *
              (1 + Math.max(0, (test.misses[n] || 0) - 10) * 0.05);
            let val =
              1.0 *
              rarityBonus *
              (numberFrequencies[n] > avgFrequency * 1.5 ? 0.7 : 1.0);
            if (tM1.set.has(n)) {
              val += 0.8;
              repeatCaptureScore += val;
            }
            if (tM2 && tM2.set.has(n)) {
              val += 0.5;
              skipCaptureScore += val;
            }
            if (numberFrequencies[n] < avgFrequency)
              rareCaptureScore += rarityBonus;
            if (tM1.tails.has(n % 10)) tailCaptureScore += 0.3;
          });
          if (Math.abs(test.sumRange - tM1.sumRange) <= 1)
            sumCaptureScore += 0.5;
          const sortedT = [...test.nums].sort((a, b) => a - b);
          for (let k = 0; k < sortedT.length - 1; k++) {
            if (sortedT[k + 1] - sortedT[k] === 1) consecCaptureScore += 0.5;
          }

          for (let h = 1; h < t; h++) {
            const hist = preProcessedHistory[h];
            if (!hist) continue;
            const hitGradientWeight = Math.pow(
              hist.nums.filter((n) => test.set.has(n)).length,
              2,
            );
            if (hitGradientWeight > 0) {
              for (let j = 0; j < targetCoeffs.length; j++) {
                learnedEfficiency[j] +=
                  hitGradientWeight /
                  (Math.abs(Number(test.coeffs[j]) - Number(hist.coeffs[j])) +
                    0.1);
              }
            }
          }
        }
      };

      performLearning(
        historicalData.length - trainWindow,
        historicalData.length,
      );
      repeatConf = Math.min(
        99,
        Math.round((repeatCaptureScore / (trainWindow * 1.8)) * 100),
      );
      skipConf = Math.min(
        99,
        Math.round((skipCaptureScore / (trainWindow * 1.5)) * 100),
      );
      rareConf = Math.min(
        99,
        Math.round((rareCaptureScore / (trainWindow * 1.2)) * 100),
      );
      consecConf = Math.min(
        99,
        Math.round((consecCaptureScore / (trainWindow * 0.8)) * 100),
      );
      tailConf = Math.min(
        99,
        Math.round((tailCaptureScore / (trainWindow * 1.5)) * 100),
      );
      sumConf = Math.min(
        99,
        Math.round((sumCaptureScore / (trainWindow * 0.5)) * 100),
      );
      isChaos = repeatConf < 40 || skipConf < 40;
      learningMode = trainWindow + "期精準學習";

      const learningReport = [];
      const maxEff = Math.max(...learnedEfficiency) || 1;
      coeffWeights.forEach((w, idx) => {
        const adjustment = 0.5 + learnedEfficiency[idx] / maxEff;
        coeffWeights[idx] = w * adjustment;
        learningReport.push({ name: allDataHeaders[idx], boost: adjustment });
      });
      learningInsights = learningReport
        .sort((a, b) => b.boost - a.boost)
        .slice(0, 3)
        .map((i) => `${i.name} (${i.boost.toFixed(2)}x)`);
      learnedEffArr = coeffWeights;

      confidenceHistory = [];
      const lookback = 10;
      const startIdx = Math.max(1, historicalData.length - lookback);
      for (let t = startIdx; t < historicalData.length; t++) {
        let rS = 0,
          sS = 0,
          raS = 0,
          cS = 0,
          tS = 0,
          sumS = 0;
        const test = preProcessedHistory[t];
        const t1 = preProcessedHistory[t - 1];
        const t2 = t > 2 ? preProcessedHistory[t - 2] : null;
        if (test && t1) {
          const hitNumbers = test.nums.filter(
            (n) => t1.set.has(n) || (t2 && t2.set.has(n)),
          );
          test.nums.forEach((n) => {
            if (t1.set.has(n)) rS += 1.2;
            if (t2 && t2.set.has(n)) sS += 1.0;
            if (numberFrequencies[n] < avgFrequency) raS += 1.0;
            if (t1.tails.has(n % 10)) tS += 0.5;
          });
          const sortedT = [...test.nums].sort((a, b) => a - b);
          for (let k = 0; k < sortedT.length - 1; k++) {
            if (sortedT[k + 1] - sortedT[k] === 1) cS += 1.0;
          }
          if (Math.abs(test.sumRange - t1.sumRange) <= 1) sumS = 100;
          confidenceHistory.push({
            label: Utilities.formatDate(
              historicalData[t][dateCol],
              "GMT+8",
              "MM/dd",
            ),
            fullDate: Utilities.formatDate(
              historicalData[t][dateCol],
              "GMT+8",
              "yyyy-MM-dd",
            ),
            coeffs: test.coeffs,
            repeat: Math.min(99, Math.round((rS / 1.8) * 100)),
            skip: Math.min(99, Math.round((sS / 1.5) * 100)),
            rare: Math.min(99, Math.round((raS / 1.2) * 100)),
            consec: Math.min(99, Math.round((cS / 1.0) * 100)),
            tail: Math.min(99, Math.round((tS / 1.5) * 100)),
            sum: sumS,
            hits: hitNumbers.length,
            hitNumbers: hitNumbers,
          });
        }
      }
      learnedResult = {
        repeatConf,
        skipConf,
        rareConf,
        consecConf,
        tailConf,
        sumConf,
        isChaos,
        learningMode,
        learningInsights,
        learnedEffArr,
        confidenceHistory,
      };
      cache.put(cacheKey, JSON.stringify(learnedResult), 3600);
    } else {
      ({
        repeatConf,
        skipConf,
        rareConf,
        consecConf,
        tailConf,
        sumConf,
        isChaos,
        learningMode,
        learningInsights,
        learnedEffArr,
        confidenceHistory,
      } = learnedResult);
      learnedEffArr.forEach((w, idx) => (coeffWeights[idx] = w));
    }

    let drawsBefore = [];
    for (
      let i = historicalData.length - 1;
      i >= 1 && drawsBefore.length < 2;
      i--
    ) {
      let nums = nCols.map((idx) => historicalData[i][idx]);
      if (s1Col > -1 && historicalData[i][s1Col])
        nums.push(historicalData[i][s1Col]);
      drawsBefore.push(nums);
    }
    const lastDrawSet = new Set((drawsBefore[0] || []).map(Number));
    const lastLastDrawSet = new Set((drawsBefore[1] || []).map(Number));

    let statusInfo = {};
    let trendMultipliers = {};
    const missSheet = trObj.spreadsheet.getSheetByName("Miss");
    if (useTrend && missSheet && missSheet.getLastRow() > 1) {
      const mVals = missSheet
        .getRange(missSheet.getLastRow(), 1, 1, missSheet.getLastColumn())
        .getValues()[0];
      const mHeads = missSheet
        .getRange(1, 1, 1, missSheet.getLastColumn())
        .getValues()[0];
      for (let j = 1; j <= maxNum; j++) {
        let mIdx = mHeads.indexOf("M" + j);
        if (mIdx > -1) {
          let c = Number(mVals[mIdx]) || 0;
          if (c <= 2) {
            trendMultipliers[j] = 1.3;
            statusInfo[j] = { text: "極熱", color: "bg-danger" };
          } else if (c <= 6) {
            trendMultipliers[j] = 1.1;
            statusInfo[j] = { text: "熱門", color: "bg-warning text-dark" };
          } else if (c >= 15) {
            trendMultipliers[j] = 0.6;
            statusInfo[j] = { text: "極冷", color: "bg-dark" };
          } else if (c >= 10) {
            trendMultipliers[j] = 0.8;
            statusInfo[j] = { text: "冷門", color: "bg-info text-dark" };
          } else statusInfo[j] = { text: "一般", color: "bg-secondary" };
        }
      }
    }

    const numberScores = {};
    for (let i = 1; i <= maxNum; i++) numberScores[i] = 0;

    for (let i = 1; i < historicalData.length; i++) {
      const row = historicalData[i];
      let distance = 0;
      const rowCoeffs = validCoeffIndices.map(
        (vIdx) => row.slice(coeffStartIdx)[vIdx],
      );
      for (let j = 0; j < targetCoeffs.length; j++) {
        distance +=
          Math.abs(Number(targetCoeffs[j]) - Number(rowCoeffs[j])) *
          coeffWeights[j];
      }
      const weight = 1 / (distance + 0.1);
      nCols.forEach((idx) => {
        if (numberScores[row[idx]] !== undefined)
          numberScores[row[idx]] += weight;
      });
    }

    for (let num in numberScores) {
      numberScores[num] *= trendMultipliers[num] || 1.0;
    }

    if (consecConf > 50) {
      Object.keys(numberScores)
        .map((n) => ({ n: parseInt(n), s: numberScores[n] }))
        .sort((a, b) => b.s - a.s)
        .slice(0, 5)
        .forEach((x) => {
          if (numberScores[x.n - 1])
            numberScores[x.n - 1] *= 1 + consecConf / 500;
          if (numberScores[x.n + 1])
            numberScores[x.n + 1] *= 1 + consecConf / 500;
        });
    }

    if (tailConf > 50 && drawsBefore[0]) {
      const tSet = new Set(drawsBefore[0].map((n) => n % 10));
      for (let n = 1; n <= maxNum; n++) {
        if (tSet.has(n % 10)) numberScores[n] *= 1 + tailConf / 1000;
      }
    }

    const topN = isChaos ? 12 : 10;
    const sortedResults = Object.keys(numberScores)
      .map((n) => ({ n: parseInt(n), s: numberScores[n] }))
      .sort((a, b) => b.s - a.s)
      .slice(0, topN);
    const totalS = sortedResults.reduce((a, c) => a + c.s, 0);

    const finalData = sortedResults.map((item) => ({
      number: item.n,
      probability:
        totalS > 0 ? ((item.s / totalS) * 100).toFixed(1) + "%" : "0%",
      status: statusInfo[item.n] ? statusInfo[item.n].text : "一般",
      statusColor: statusInfo[item.n]
        ? statusInfo[item.n].color
        : "bg-secondary",
      isRepeat: lastDrawSet.has(item.n),
      isSkip: lastLastDrawSet.has(item.n),
      isPotentialCold:
        statusInfo[item.n] &&
        (statusInfo[item.n].text === "冷門" ||
          statusInfo[item.n].text === "極冷"),
    }));

    let actualDraw = null,
      profitStars = 0,
      isS1Hit = false;
    const actualRow = data
      .slice(1)
      .find((row) => toTime(row[dateCol]) === predTime);
    if (actualRow) {
      actualDraw = nCols
        .map((idx) => Number(actualRow[idx]))
        .filter((n) => n > 0);
      if (s1Col > -1 && actualRow[s1Col])
        actualDraw.push(Number(actualRow[s1Col]));
      const pNums = finalData.map((it) => it.number);
      const mainHit = pNums.filter((n) =>
        actualDraw.slice(0, s1Col > -1 ? -1 : undefined).includes(n),
      ).length;
      if (s1Col > -1) isS1Hit = pNums.includes(Number(actualRow[s1Col]));
      profitStars = mainHit + (isS1Hit ? 0.5 : 0);
    }

    return {
      status: "complete",
      date: dateStr,
      results: finalData,
      isChaos: isChaos,
      learningMode: learningMode,
      patternConfidence: {
        repeat: repeatConf,
        skip: skipConf,
        rare: rareConf,
        consec: consecConf,
        tail: tailConf,
        sum: sumConf,
      },
      learningInsights: learningInsights,
      top3Matches: top3Matches,
      allDataHeaders: allDataHeaders,
      targetCoeffs: targetCoeffs,
      actualDraw: actualDraw,
      profitStars: profitStars,
      maxStars: nCols.length,
      isS1Hit: isS1Hit,
      bypassCache: bypassCache,
      confidenceHistory: confidenceHistory,
    };
  } catch (err) {
    return { status: "error", message: "預測異常：" + err.message };
  }
}

/**
 * 簡單版預測 (Legacy) - 同樣移動到此以便統一管理
 */
function getPrediction_Simple(lotto, dateStr, useTrend) {
  // ... 原有 getPrediction_Simple 的內容 ...
  // 這裡省略具體實現以節省篇幅，建議將 GalaxyAllModule.js 的內容搬過來
}
