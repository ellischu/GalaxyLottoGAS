/**
 * PredictModule.js
 * 專門處理 AI 星系預測與回測學習邏輯
 */

/**
 * 根據係數預測最可能的 10 顆星球 (AI 進階版)
 * @param {string} lotto 彩種 (L539, L649, etc.)
 * @param {string} dateStr 預測日期 (YYYY-MM-DD)
 * @param {boolean} useTrend 是否考慮冷熱趨勢權重
 * @param {string|number} topNChoice 推薦號碼數量 (5, 7, 10)
 */
function getPrediction(lotto, dateStr, useTrend, topNChoice) {
  try {
    const ctx = initPredictionContext(lotto, dateStr);
    const {
      targetData,
      historicalData,
      data,
      dateCol,
      targetMonth,
      toTime,
      predTime,
      sumCol,
      s1Col,
      maxNum,
      rarityConfig,
      lastKnownSum,
      nCols,
      targetSumVal,
      coeffStartIdx,
      allDataHeaders,
      validCoeffIndices,
      targetCoeffs,
      avgFrequency,
      anomalyMultiplier,
      severeMultiplier,
      bypassCache,
      bypassCacheRowIdx,
      settingsSheet,
      baseWeights,
      trObj,
    } = ctx;

    const cache = CacheService.getScriptCache();
    const cacheKey = "PRED_MODEL_" + lotto + "_" + dateStr;
    const cachedModel = cache.get(cacheKey);
    let learnedResult = cachedModel ? JSON.parse(cachedModel) : null;

    let coeffWeights = [...(baseWeights || [])];

    let repeatConf = 0,
      skipConf = 0,
      rareConf = 0,
      consecConf = 0,
      tailConf = 0,
      sumConf = 0,
      isChaos = false,
      isHighGravityMode = false,
      isOctaveResonance = false,
      learningMode,
      learningInsights,
      learnedEffArr,
      confidenceHistory,
      aiStrategy,
      coeffAverages,
      ampPercentile = "0",
      isDeviated = false,
      isSevereAnomaly = false,
      learningReport = [], // 宣告於頂層，避免重複宣告
      perturbationFactors = [], // 宣告於頂層，避免作用域錯誤
      targetYearStem,
      targetYearBranch,
      targetMonthStem,
      targetMonthBranch,
      targetDayStem,
      targetDayFive,
      targetDayBranch,
      targetHourBranch;

    if (!learnedResult || bypassCache) {
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
      const allHistAmplitudes = [];
      for (let j = 1; j <= maxNum; j++) runningMisses[j] = 0;

      const preProcessedHistory = historicalData.map((row, idx) => {
        if (idx === 0) return null;
        const nums = (nCols || [])
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
        const prevSum =
          idx > 1 ? Number(historicalData[idx - 1][sumCol]) : sumVal;
        const sumAmplitude = Math.abs(sumVal - prevSum);
        if (idx > 1) allHistAmplitudes.push(sumAmplitude);

        return {
          nums: nums,
          set: new Set(nums),
          coeffs: validCoeffIndices.map(
            (vIdx) => row.slice(coeffStartIdx)[vIdx],
          ),
          misses: missSnapshot,
          sumVal: sumVal,
          sumAmplitude: sumAmplitude,
          sumRange: Math.floor(sumVal / 20),
          tails: new Set(nums.map((n) => n % 10)),
        };
      });

      // --- 第一輪：計算歷史係數平均值 (常態) ---
      let coeffSums = new Array(targetCoeffs.length).fill(0);
      let coeffCounts = new Array(targetCoeffs.length).fill(0);

      preProcessedHistory.forEach((hist) => {
        if (!hist) return;
        validCoeffIndices.forEach((vIdx, j) => {
          const val = parseFloat(hist.coeffs[j]);
          if (!isNaN(val) && isFinite(val)) {
            coeffSums[j] += val;
            coeffCounts[j]++;
          }
        });
      });
      coeffAverages = coeffSums.map((sum, j) =>
        coeffCounts[j] > 0 ? sum / coeffCounts[j] : null,
      );

      // --- 新增：計算「命重」的歷史標準差與統計基準 ---
      const lwIdx = (allDataHeaders || []).findIndex(
        (h) => h === "命重" || h === "strp13",
      );
      let lwStdDev = 1.0;
      if (lwIdx !== -1) {
        const lwValues = preProcessedHistory
          .map((h) => (h ? parseFloat(h.coeffs[lwIdx]) : null))
          .filter((v) => !isNaN(v));
        const lwAvg = coeffAverages[lwIdx];
        const lwVariance =
          lwValues.reduce((s, v) => s + Math.pow(v - lwAvg, 2), 0) /
          (lwValues.length || 1);
        lwStdDev = Math.sqrt(lwVariance) || 0.1;
      }

      // --- 優化：封裝環境感應參數計算，確保閉包捕捉到的參數具備一致性 ---
      const env = getEnvironmentSensingParams(
        allHistAmplitudes,
        targetSumVal,
        lastKnownSum,
        lotto,
        rarityConfig,
        {
          currentLw: lwIdx !== -1 ? parseFloat(targetCoeffs[lwIdx]) : null,
          avgLw: lwIdx !== -1 ? coeffAverages[lwIdx] : null,
          stdDevLw: lwStdDev,
          lwZScore:
            lwIdx !== -1
              ? (parseFloat(targetCoeffs[lwIdx]) - coeffAverages[lwIdx]) /
                lwStdDev
              : 0,
        },
        targetCoeffs,
        allDataHeaders,
      );
      ampPercentile = env.ampPercentile;
      const {
        repeatModifier,
        isHighGravityMode: envGravity,
        rarityThresholdMultiplier,
        rareNormalization,
        skipDepth,
        skipNormalization,
        isOctaveResonance: envResonance,
      } = env;
      isOctaveResonance = envResonance;
      isHighGravityMode = envGravity;

      const performLearning = (startIdx, endIdx) => {
        for (let t = startIdx; t < endIdx; t++) {
          const test = preProcessedHistory[t];
          const tM1 = preProcessedHistory[t - 1];
          if (!test || !tM1) continue;

          test.nums.forEach((n) => {
            const rarityBonus =
              Math.min(
                rarityConfig.cap,
                avgFrequency / (numberFrequencies[n] || 1),
              ) *
              (1 +
                Math.max(0, (test.misses[n] || 0) - rarityConfig.missThres) *
                  rarityConfig.missWeight);
            let val =
              1.0 *
              rarityBonus *
              (numberFrequencies[n] > avgFrequency * 1.5 ? 0.7 : 1.0);
            if (tM1.set.has(n)) {
              val += 0.8;
              repeatCaptureScore += val;
            }

            // 動態深度偵測：根據 skipDepth 決定回溯期數
            for (let d = 2; d <= 1 + skipDepth; d++) {
              const tMd = t >= d ? preProcessedHistory[t - d] : null;
              if (tMd && tMd.set.has(n)) {
                const decay = 1 / (d - 1); // 距離越遠，貢獻權重衰減
                const skipContrib = 0.5 * decay;
                val += skipContrib;
                skipCaptureScore += val;
                break; // 只要在窗口內找到，即算作一次隔期捕捉
              }
            }

            if (numberFrequencies[n] < avgFrequency * rarityThresholdMultiplier)
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
              for (let j = 0; j < (targetCoeffs || []).length; j++) {
                const dist = calculateSymbolDistance(
                  test.coeffs[j],
                  targetCoeffs[j],
                  allDataHeaders[j],
                  isHighGravityMode,
                );
                learnedEfficiency[j] += hitGradientWeight / (dist + 0.1);
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
        Math.round(
          ((repeatCaptureScore * repeatModifier) / (trainWindow * 1.8)) * 100,
        ),
      );
      skipConf = Math.min(
        99,
        Math.round(
          (skipCaptureScore / (trainWindow * skipNormalization)) * 100,
        ),
      );
      rareConf = Math.min(
        99,
        Math.round(
          (rareCaptureScore / (trainWindow * rareNormalization)) * 100,
        ),
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

      // --- 第二階段：偵測到混亂時，自動擴大搜尋窗口 (擴展至 100 期) ---
      if (isChaos && historicalData.length > trainWindow + 2) {
        const expandedWindow = Math.min(historicalData.length - 2, 100);
        if (expandedWindow > trainWindow) {
          const initialWindow = trainWindow;
          const backupEfficiency = [...learnedEfficiency];
          const backupRepeatScore = repeatCaptureScore;
          const backupSkipScore = skipCaptureScore;
          const backupRareScore = rareCaptureScore;
          const backupConsecScore = consecCaptureScore;
          const backupTailScore = tailCaptureScore;
          const backupSumScore = sumCaptureScore;
          const backupRepeatConf = repeatConf;
          const backupSkipConf = skipConf;
          const backupRareConf = rareConf;
          const backupIsChaos = isChaos;

          learningMode = expandedWindow + "期廣域學習";
          performLearning(
            historicalData.length - expandedWindow,
            historicalData.length - initialWindow,
          );

          trainWindow = expandedWindow;
          repeatConf = Math.min(
            99,
            Math.round(
              ((repeatCaptureScore * repeatModifier) / (trainWindow * 1.8)) *
                100,
            ),
          );
          skipConf = Math.min(
            99,
            Math.round(
              (skipCaptureScore / (trainWindow * skipNormalization)) * 100,
            ),
          );
          rareConf = Math.min(
            99,
            Math.round(
              (rareCaptureScore / (trainWindow * rareNormalization)) * 100,
            ),
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

          // 比較：如果擴展後平均捕捉率下降，則自動捨棄擴展結果並回滾
          if (
            repeatConf + skipConf + rareConf <
            backupRepeatConf + backupSkipConf + backupRareConf
          ) {
            learnedEfficiency.splice(
              0,
              learnedEfficiency.length,
              ...backupEfficiency,
            );
            repeatCaptureScore = backupRepeatScore;
            skipCaptureScore = backupSkipScore;
            rareCaptureScore = backupRareScore;
            consecCaptureScore = backupConsecScore;
            tailCaptureScore = backupTailScore;
            sumCaptureScore = backupSumScore;
            repeatConf = backupRepeatConf;
            skipConf = backupSkipConf;
            isChaos = backupIsChaos;
            trainWindow = initialWindow;
            learningMode = initialWindow + "期精準學習 (自動回退)";
          }
        }
      }

      // --- 進階優化：基於 Z-Score 與信噪比(SNR)的動態權重分配 ---
      learningReport = [];
      const avgEfficiency =
        learnedEfficiency.reduce((a, b) => a + b, 0) /
        (learnedEfficiency.length || 1);

      // 計算效率標準差以識別具備統計顯著性的「強引力」指標
      const effVariance =
        learnedEfficiency.reduce(
          (sum, val) => sum + Math.pow(val - avgEfficiency, 2),
          0,
        ) / (learnedEfficiency.length || 1);
      const effStdDev = Math.sqrt(effVariance) || 1;

      coeffWeights.forEach((w, idx) => {
        // 計算 Z-Score 以識別核心訊號 (Signal) 與雜訊 (Noise)
        const zScore = (learnedEfficiency[idx] - avgEfficiency) / effStdDev;
        let snrRatio =
          avgEfficiency > 0 ? learnedEfficiency[idx] / avgEfficiency : 1.0;

        // --- 優化：基於週期性敏感度的平滑 Power 曲線 ---
        const name = allDataHeaders[idx];
        const isCyclical = ["星宿", "九星", "執", "八卦"].some((k) =>
          name.includes(k),
        );

        let power = 1.6; // 基礎冪次
        if (zScore > 0) {
          // 對於正向訊號，隨 Z-Score 線性增加權重靈敏度
          power += zScore * 0.8;
          if (isCyclical) power *= 1.25; // 額外強化週期性訊號 (星宿/九星) 的主導性
        } else {
          // 對於負向訊號 (雜訊)，加快降權速度
          power += zScore * 0.4;
        }
        power = Math.max(0.6, Math.min(4.5, power)); // 限制冪次區間

        let adjustment = Math.pow(snrRatio, power);

        // --- 新增：根據「共振潛能」自動調整隨機擾動抑制強度 ---
        if (name.includes("隨機")) {
          // 以連莊與隔期信心作為共振的前兆指標 (0~1)
          const resonancePotential = (repeatConf + skipConf) / 200;
          // 當共振潛能越高，額外給予隨機係數 0.4x ~ 1.0x 的抑制權重
          const resonanceSuppression = 1.0 - resonancePotential * 0.6;
          adjustment *= resonanceSuppression;
        }

        // 擴大權重彈性區間 (0.2x ~ 5.0x)，提升預測模型的靈敏度
        const finalBoost = Math.max(0.2, Math.min(5.0, adjustment));
        coeffWeights[idx] = w * finalBoost;

        // 記錄學習報告
        learningReport.push({
          name: allDataHeaders[idx],
          boost: finalBoost,
          efficiency: learnedEfficiency[idx],
        });
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
          sSCore = 0,
          sSExt = 0,
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
            // 核心隔期 (t-2)
            if (t2 && t2.set.has(n)) sSCore += 1.0;
            // 擴展隔期 (t-3)
            const t3 = t >= 3 ? preProcessedHistory[t - 3] : null;
            if (t3 && t3.set.has(n)) sSExt += 0.5;

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
            skipCore: Math.min(99, Math.round((sSCore / 1.2) * 100)),
            skipExt: Math.min(99, Math.round((sSExt / 0.8) * 100)),
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
        coeffAverages,
        ampPercentile: ampPercentile,
        isHighGravityMode: isHighGravityMode,
        isOctaveResonance: isOctaveResonance,
        aiStrategy: generateAIStrategy({
          repeatConf,
          skipConf,
          rareConf,
          sumConf,
        }),
      };
      cache.put(cacheKey, JSON.stringify(learnedResult), 1800); // 縮短快取時間提升即時性

      // 優化：確保運算與快取成功後，且原本為 true 的情況下才重置 BypassCache 狀態
      // 這能避免不必要的試算表寫入動作，並確保在運算失敗時保留強制重算狀態
      if (bypassCache && settingsSheet && bypassCacheRowIdx !== -1) {
        settingsSheet.getRange(bypassCacheRowIdx, 2).setValue(false);
      }
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
        aiStrategy,
        coeffAverages,
        ampPercentile,
        isHighGravityMode,
        isOctaveResonance,
      } = learnedResult);
      if (learnedEffArr && learnedEffArr.length === coeffWeights.length) {
        learnedEffArr.forEach((w, idx) => (coeffWeights[idx] = w));
      }
    }

    // --- 動態調整異常/嚴重異常門檻 (anomalyMultiplier, severeMultiplier) ---
    const ampVal_num = parseFloat(ampPercentile) || 0;
    let dynamicAnomalyMultiplier = anomalyMultiplier;
    let dynamicSevereMultiplier = severeMultiplier;

    if (ampVal_num > 85) {
      dynamicAnomalyMultiplier *= 0.8; // 高震盪：降低門檻，更敏感
      dynamicSevereMultiplier *= 0.8;
    } else if (ampVal_num < 15) {
      dynamicAnomalyMultiplier *= 1.1; // 低震盪：提高門檻，聚焦強烈偏差
      dynamicSevereMultiplier *= 1.1;
    }

    if (isOctaveResonance) {
      dynamicAnomalyMultiplier *= 0.7; // 倍頻共振：極度敏感模式
      dynamicSevereMultiplier *= 0.7;
    }

    // --- 新增：過熱號碼降權集合 (確保在快取模式下也能運行) ---
    const last60ForPenalty = historicalData.slice(-60);
    const freqForPenalty = {};
    last60ForPenalty.forEach((row) => {
      nCols.forEach((idx) => {
        const n = Number(row[idx]);
        if (n) freqForPenalty[n] = (freqForPenalty[n] || 0) + 1;
      });
    });
    const penalizedSet = new Set(
      Object.keys(freqForPenalty)
        .filter((n) => freqForPenalty[n] > avgFrequency * 1.5)
        .map(Number),
    );

    let drawsBefore = [];
    for (
      let i = historicalData.length - 1;
      i >= 1 && drawsBefore.length < 2;
      i--
    ) {
      let nums = (nCols || []).map((idx) => historicalData[i][idx]);
      if (s1Col > -1 && historicalData[i][s1Col])
        nums.push(historicalData[i][s1Col]);
      drawsBefore.push(nums);
    }
    const lastDrawSet = new Set((drawsBefore[0] || []).map(Number));
    const lastLastDrawSet = new Set((drawsBefore[1] || []).map(Number));

    // 取得前一期的係數，用於偵測突發性變動
    const lastHistoricalRow = historicalData[historicalData.length - 1];
    const lastHistoricalCoeffs = validCoeffIndices.map(
      (vIdx) => lastHistoricalRow.slice(coeffStartIdx)[vIdx],
    );

    let statusInfo = {};
    let trendMultipliers = {};
    const missSheet = trObj.spreadsheet.getSheetByName("Miss");
    if (useTrend && missSheet && missSheet.getLastRow() > 1) {
      const mData = missSheet.getDataRange().getValues();
      const mHeads = mData[0];
      const mDateCol = mHeads.indexOf("Date");

      // 尋找預測日期之前的最後一筆遺漏值紀錄 (確保回測一致性)
      let mVals = null;
      for (let i = mData.length - 1; i >= 1; i--) {
        if (toTime(mData[i][mDateCol]) < predTime) {
          mVals = mData[i];
          break;
        }
      }

      // 若找不到更早的，則退而求其次使用當前最後一列 (避免全新工作表報錯)
      if (!mVals) {
        mVals = mData[mData.length - 1];
      }

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

    // --- 準備相似度與偏差分析 ---
    const targetCoeffAverages =
      typeof coeffAverages !== "undefined"
        ? coeffAverages
        : new Array(targetCoeffs.length).fill(null);
    let targetDeviation = 0;
    targetCoeffs.forEach((val, idx) => {
      if (targetCoeffAverages[idx] !== null)
        targetDeviation +=
          Math.abs((Number(val) || 0) - targetCoeffAverages[idx]) *
          (coeffWeights[idx] || 1.0);
    });

    let totalHistDeviation = 0;
    let allHistDevs = []; // 用於存儲每一期的歷史偏差值

    // --- 第一階段：掃描全歷史以建立統計基準 (Z-Score 基礎) ---
    for (let i = 1; i < historicalData.length; i++) {
      const row = historicalData[i];
      const rowCoeffs = validCoeffIndices.map(
        (vIdx) => row.slice(coeffStartIdx)[vIdx],
      );

      let histToNormalDist = 0;
      rowCoeffs.forEach((val, idx) => {
        if (targetCoeffAverages[idx] !== null)
          histToNormalDist +=
            Math.abs(Number(val) - targetCoeffAverages[idx]) *
            (coeffWeights[idx] || 1.0);
      });
      totalHistDeviation += histToNormalDist;
      allHistDevs.push(histToNormalDist);
    }

    const avgHistDeviation =
      totalHistDeviation / (historicalData.length - 1 || 1);

    // --- 優化：動態閾值計演算法 (基於 Z-Score 邏輯) ---
    // 計算歷史偏差值的標準差
    const variance =
      allHistDevs.reduce(
        (sum, val) => sum + Math.pow(val - avgHistDeviation, 2),
        0,
      ) / (allHistDevs.length || 1);
    let stdDev = Math.sqrt(variance) || 1; // 避免除以零

    // --- 優化：在高引力模式下自動進行標準差平滑化處理 ---
    if (isHighGravityMode) {
      // 當星系進入高引力震盪模式，能量分佈極端化，標準差易受噪訊干擾。
      // 透過引入歷史平均偏差 (avgHistDeviation) 進行 15% 的權重平滑，提升 Z-Score 的魯棒性。
      stdDev = stdDev * 0.85 + avgHistDeviation * 0.15;
    }

    // 門檻 = 平均值 + (設定倍率 * 標準差)
    isDeviated =
      targetDeviation > avgHistDeviation + dynamicAnomalyMultiplier * stdDev;
    isSevereAnomaly =
      targetDeviation > avgHistDeviation + dynamicSevereMultiplier * stdDev;

    // --- 第二階段：偵測極端偏差與 Z-Score (判定重組狀態) ---
    let extremeDeviationCount = 0;
    let highZScoreCount = 0;
    let suddenChangeCount = 0; // 新增：突發性變動計數
    let suddenChangeFactors = []; // 新增：突發性變動係數名稱
    perturbationFactors = []; // 修正：移除 let，使用頂層已宣告的變數

    targetCoeffs.forEach((val, idx) => {
      const header = allDataHeaders[idx];
      const avg = targetCoeffAverages[idx];

      // 使用統一的符號距離計算，不再強行轉 Number
      const currentDist = calculateSymbolDistance(
        val,
        avg === null ? val : avg,
        header,
        isHighGravityMode,
      );

      if (avg !== null) {
        // 計算百分比差異 (僅針對數值型如「命重」)
        const isNumeric = !isNaN(parseFloat(val)) && isFinite(val);
        const pct =
          isNumeric && parseFloat(avg) !== 0
            ? (Math.abs(parseFloat(val) - parseFloat(avg)) /
                Math.abs(parseFloat(avg))) *
              100
            : currentDist > 2.0
              ? 200
              : 0; // 非數值型若距離過大則視為 200% 偏差

        if (pct >= 200) {
          extremeDeviationCount++;
          perturbationFactors.push(header);
        }

        // 計算 Z-Score：(加權絕對差異) / 系統標準差
        let weight = coeffWeights[idx] || 1.0;

        // 優化「命重」權重：由於浮點數差異量級較小，給予 2.5x 的靈敏度補償
        if (header === "命重" || header === "strp13") weight *= 2.5;

        const zScore = (currentDist * weight) / (stdDev || 1);
        if (zScore >= 3.0) highZScoreCount++;
      }

      // 偵測與前一期係數的突發性變動
      if (
        lastHistoricalCoeffs[idx] !== undefined &&
        lastHistoricalCoeffs[idx] !== null
      ) {
        const distanceToPrev = calculateSymbolDistance(
          val,
          lastHistoricalCoeffs[idx],
          allDataHeaders[idx],
          isHighGravityMode,
        );
        // 設定一個閾值，例如距離大於 3 視為顯著變動
        const SUDDEN_CHANGE_THRESHOLD = 3.0;
        if (distanceToPrev > SUDDEN_CHANGE_THRESHOLD) {
          suddenChangeCount++;
          suddenChangeFactors.push(allDataHeaders[idx]);
        }
      }
    });

    // --- 第三階段：動態調整相似搜尋窗口 (規律重組擴展) ---
    // 根據推薦數量設定基礎搜尋範圍：數量愈少，窗口愈緊湊以提升精準度
    let baseWindow = 100;
    const choice = parseInt(topNChoice);
    if (choice === 5) {
      baseWindow = 80; // 嚴選 5 顆：縮小窗口，鎖定最核心的近期相似規律
    } else if (choice === 10 || isChaos) {
      baseWindow = 120; // 推薦 10 顆或混亂狀態：擴大窗口，增加數據覆蓋率以提升統計穩定度
    }

    // --- 新增：根據 ampPercentile (震盪百分比) 進一步動態微調基礎窗口 ---
    const ampVal = parseFloat(ampPercentile) || 0;
    if (ampVal > 85) {
      // 高震盪模式：星系處於極端變動期，擴大窗口 (1.25x) 以捕捉歷史上的「突發性」跳躍規律
      baseWindow = Math.floor(baseWindow * 1.25);
    } else if (ampVal < 15) {
      // 極低震盪模式：星系能量沉寂，縮小窗口 (0.85x) 以精準鎖定當前的低頻慣性
      baseWindow = Math.floor(baseWindow * 0.85);
    }

    // 若偵測到規律重組 (High Z-Score)，進一步擴展搜尋深度 (1.5x) 以尋找可能的路徑偏差
    const similarityWindow =
      highZScoreCount >= 3 ? Math.floor(baseWindow * 1.5) : baseWindow;

    const startIdx = Math.max(1, historicalData.length - similarityWindow);
    if (highZScoreCount >= 3) learningMode += " (規律重組擴展模式)";

    let similarityHistory = [];
    for (let i = startIdx; i < historicalData.length; i++) {
      const row = historicalData[i];
      let distance = 0;
      const rowCoeffs = validCoeffIndices.map(
        (vIdx) => row.slice(coeffStartIdx)[vIdx],
      );

      let penaltyTypesFound = new Set();
      for (let j = 0; j < (targetCoeffs || []).length; j++) {
        const v1 = targetCoeffs[j];
        const v2 = rowCoeffs[j];
        distance +=
          calculateSymbolDistance(
            v1,
            v2,
            allDataHeaders[j],
            isHighGravityMode,
          ) * coeffWeights[j];

        const pType = getZodiacPenaltyType(v1, v2);
        if (pType !== "NONE") penaltyTypesFound.add(pType);
      }

      // 若同時出現兩種以上類型的相刑 (Double Penalty)，加重距離懲罰 (1.8x)
      if (penaltyTypesFound.size >= 2) distance *= 1.8;

      // --- 優化：當推薦數量設定為 5 (嚴選模式) 時，提升相似度權重的過濾門檻 ---
      let weightPower = 0.75;
      let weightThreshold = 0;
      if (parseInt(topNChoice) === 5) {
        weightPower = 1.2; // 提高冪次使權重隨距離增加而劇烈衰減
        weightThreshold = 0.05; // 捨棄權重低於 0.05 的雜訊，僅保留高度相似的樣本
      }
      let weight = 1 / (Math.pow(distance, weightPower) + 1.2);
      if (weight < weightThreshold) weight = 0;

      const rowDate =
        row[dateCol] instanceof Date ? row[dateCol] : new Date(row[dateCol]);
      if (rowDate.getMonth() === targetMonth) weight *= 1.15;

      similarityHistory.push({
        date: row[dateCol],
        score: weight,
        coeffs: rowCoeffs,
        nums: nCols.map((cIdx) => Number(row[cIdx])), // 記錄該日期的開獎號碼
      });

      nCols.forEach((idx) => {
        if (numberScores[row[idx]] !== undefined)
          numberScores[row[idx]] += weight;
      });
    }

    // 若超過 3 個係數偏差大於 200%，視為星系極度不穩定，執行信心下修
    let isPenaltyApplied = false;
    if (extremeDeviationCount >= 3) {
      isPenaltyApplied = true;
      const penaltyFactor = 0.8; // 降低 20% 信心
      repeatConf = Math.round(repeatConf * penaltyFactor);
      skipConf = Math.round(skipConf * penaltyFactor);
      rareConf = Math.round(rareConf * penaltyFactor);
      consecConf = Math.round(consecConf * penaltyFactor);
      tailConf = Math.round(tailConf * penaltyFactor);
      sumConf = Math.round(sumConf * penaltyFactor);

      // 如果信心下修後觸發混亂閾值，更新混亂狀態
      isChaos = isChaos || repeatConf < 40 || skipConf < 40;
    }

    // --- 新增：偵測天干五合驅動力 (分析相似度最高的歷史日期) ---
    const top3MatchesRaw = similarityHistory
      .sort((a, b) => b.score - a.score)
      .slice(0, 3);

    // --- 新增：偵測大跨度週期規律 ---
    let hasLargeSpanPeriodicPattern = false;
    let hasShortTermIntensivePattern = false;
    let isHybridResonance = false; // 多重共振標記
    let zMultiplier = 1.2; // 預設濾網強度 (中性)

    if (top3MatchesRaw.length >= 2) {
      // 至少需要兩個匹配才能計算跨度
      const dates = top3MatchesRaw.map((m) => new Date(m.date));
      dates.sort((a, b) => a.getTime() - b.getTime()); // 確保日期是排序的

      const earliestDate = dates[0];
      const latestDate = dates[dates.length - 1];
      const diffTime = Math.abs(latestDate.getTime() - earliestDate.getTime());
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

      // 計算最小日期差距 (判定是否有聚集現象)
      let minGap = Infinity;
      for (let k = 0; k < dates.length - 1; k++) {
        let gap = Math.ceil(
          (dates[k + 1].getTime() - dates[k].getTime()) / (1000 * 60 * 60 * 24),
        );
        if (gap < minGap) minGap = gap;
      }

      // 定義大跨度閾值 (例如：超過 1 年)
      const largeSpanThresholdDays = 365;
      if (diffDays > largeSpanThresholdDays) {
        hasLargeSpanPeriodicPattern = true;
      }

      // 修改：偵測是否存在短期聚集 (30天內有兩筆以上匹配)
      if (minGap <= 30) {
        hasShortTermIntensivePattern = true;
      }

      // 同時觸發判定為共振模式
      isHybridResonance =
        hasLargeSpanPeriodicPattern && hasShortTermIntensivePattern;

      // --- 優化：基於 isHybridResonance 動態縮小 Z-Score 容錯閾值 ---
      if (isHybridResonance && similarityHistory.length > 0) {
        const scores = similarityHistory.map((m) => m.score);
        const avgS = scores.reduce((a, b) => a + b, 0) / scores.length;
        const stdS =
          Math.sqrt(
            scores.reduce((a, b) => a + Math.pow(b - avgS, 2), 0) /
              scores.length,
          ) || 0.1;

        // --- 優化：根據震盪百分比 (ampPercentile) 動態調整 Z-Score 過濾強度 ---
        const ampVal_num = parseFloat(ampPercentile) || 0;
        zMultiplier = 1.2; // 基礎門檻 (中性環境)

        if (ampVal_num > 85) {
          zMultiplier = 1.6; // 高震盪：星系混亂，需更嚴苛地提取「極強訊號」以排除雜訊
        } else if (ampVal_num < 15) {
          zMultiplier = 0.8; // 低震盪：星系平穩，可適度放寬門檻以包含更多穩定的微弱規律
        }

        // --- 優化：當處於「高引力震盪模式」時，自動收緊相似度過濾門檻 (提升 1.5x) ---
        if (isHighGravityMode) zMultiplier *= 1.5;

        // 計算動態共振過濾閾值
        const resonanceZThreshold = avgS + zMultiplier * stdS;

        // 重置並重新分配號碼評分，排除非共振頻率的樣本干擾
        for (let n in numberScores) numberScores[n] = 0;
        similarityHistory.forEach((m) => {
          if (m.score >= resonanceZThreshold) {
            m.nums.forEach((num) => {
              if (numberScores[num] !== undefined) numberScores[num] += m.score;
            });
          }
        });
      }
    }

    // --- 建立共振核心號碼集合 ---
    const resonanceNumberSet = new Set();
    if (isHybridResonance) {
      top3MatchesRaw.forEach((m) => {
        m.nums.forEach((n) => resonanceNumberSet.add(n));
      });
    }

    let stemComboCount = 0;
    let zodiacHarmonyCount = 0;
    let tripleHarmonyCount = 0;
    let zodiacPenaltyCount = 0;
    let doublePenaltyCount = 0;
    const sMap = {
      甲: 0,
      乙: 1,
      丙: 2,
      丁: 3,
      戊: 4,
      己: 5,
      庚: 6,
      辛: 7,
      壬: 8,
      癸: 9,
    };
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

    top3MatchesRaw.forEach((m) => {
      let typesInThisMatch = new Set();
      m.coeffs.forEach((cVal, idx) => {
        const p1 = String(targetCoeffs[idx] || "")
          .replace(/\d+/, "")
          .trim();
        const p2 = String(cVal || "")
          .replace(/\d+/, "")
          .trim();
        if (
          sMap.hasOwnProperty(p1) &&
          sMap.hasOwnProperty(p2) &&
          Math.abs(sMap[p1] - sMap[p2]) === 5
        )
          stemComboCount++;
        if (
          zMap.hasOwnProperty(p1) &&
          zMap.hasOwnProperty(p2) &&
          (zMap[p1] + zMap[p2]) % 12 === 1
        )
          zodiacHarmonyCount++;

        if (zMap.hasOwnProperty(p1) && zMap.hasOwnProperty(p2)) {
          const diffZ = Math.abs(zMap[p1] - zMap[p2]);
          if (diffZ !== 0 && diffZ % 4 === 0) tripleHarmonyCount++;

          const pType = getZodiacPenaltyType(targetCoeffs[idx], cVal);
          if (pType !== "NONE") {
            zodiacPenaltyCount++;
            typesInThisMatch.add(pType);
          }
        }
      });
      if (typesInThisMatch.size >= 2) doublePenaltyCount++;
    });

    // --- 新增：週期性指標對比資料 (用於前端明細小視窗) ---
    let nineStarMatchCount = 0;
    let mansionMatchCount = 0;
    const cyclicalComparison = top3MatchesRaw.map((m) => {
      const details = [];
      allDataHeaders.forEach((h, idx) => {
        if (
          h.includes("九星") ||
          h.includes("星宿") ||
          h.includes("日九星") ||
          h.includes("星宿")
        ) {
          const isMatch = String(targetCoeffs[idx]) === String(m.coeffs[idx]);
          if (isMatch) {
            if (h.includes("九星")) nineStarMatchCount++;
            if (h.includes("星宿")) mansionMatchCount++;
          }
          details.push({
            name: h,
            target: targetCoeffs[idx],
            match: m.coeffs[idx],
            isMatch: isMatch,
          });
        }
      });
      return {
        date:
          m.date instanceof Date
            ? Utilities.formatDate(m.date, "GMT+8", "yyyy-MM-dd")
            : m.date.toString().split("T")[0],
        details: details,
      };
    });

    // 偵測目標日期宮位中的吉星組合 (Lucky Pairs)
    const luckyPairsMap = {
      左輔右弼: ["左輔", "右弼"],
      文昌文曲: ["文昌", "文曲"],
      天魁天鉞: ["天魁", "天鉞"],
      三台八座: ["三台", "八座"],
      龍池鳳閣: ["龍池", "鳳閣"],
      恩光天貴: ["恩光", "天貴"],
      台輔封誥: ["台輔", "封誥"],
    };
    const unluckyPairsMap = {
      羊陀交戰: ["擎羊", "陀羅"],
      火鈴肆虐: ["火星", "鈴星"],
      空劫同臨: ["地空", "地劫"],
      大耗地劫: ["大耗", "地劫"],
    };
    let foundLuckyCombos = [];
    let foundUnluckyCombos = [];
    let hasCareerHuaQuan = false;
    let hasParentsHuaKe = false;
    let hasWealthHuaLu = false;
    let hasSelfPalacePenalty = false;
    let hasLuJieClash = false;
    let hasLuMaCombo = false;
    let hasLongFengCombo = false;
    let hasLuckyVoided = false;
    let luckyPalaceCount = 0;
    const voidStarList = ["地空", "地劫", "旬空", "截空"];
    targetDayBranch = "";
    targetHourBranch = "";
    targetCoeffs.forEach((cVal, idx) => {
      const h = allDataHeaders[idx];
      if (h.startsWith("strp") && h !== "strp13") {
        const s = String(cVal || "");
        for (const name in luckyPairsMap) {
          const lp = luckyPairsMap[name];
          if (s.indexOf(lp[0]) !== -1 && s.indexOf(lp[1]) !== -1) {
            if (foundLuckyCombos.indexOf(name) === -1)
              foundLuckyCombos.push(name);
          }
        }
        for (const name in unluckyPairsMap) {
          const up = unluckyPairsMap[name];
          if (s.indexOf(up[0]) !== -1 && s.indexOf(up[1]) !== -1) {
            if (foundUnluckyCombos.indexOf(name) === -1)
              foundUnluckyCombos.push(name);
          }
        }
        // 偵測官祿宮(strp05) 是否具備化權
        if (h === "strp05" && s.indexOf("化權") !== -1) {
          hasCareerHuaQuan = true;
        }
        // 偵測父母宮(strp02) 是否具備化科
        if (h === "strp02" && s.indexOf("化科") !== -1) {
          hasParentsHuaKe = true;
        }
        // 偵測財帛宮(strp09) 是否具備化祿
        if (h === "strp09" && s.indexOf("化祿") !== -1) {
          hasWealthHuaLu = true;
        }
        // 偵測命宮(strp01) 是否具備自刑
        if (h === "strp01" && s.indexOf("自刑") !== -1) {
          hasSelfPalacePenalty = true;
        }
        // 偵測 祿逢劫殺 (化祿 + 地劫 同宮)
        if (s.indexOf("化祿") !== -1 && s.indexOf("地劫") !== -1) {
          hasLuJieClash = true;
        }
        // 偵測 祿馬交馳 (化祿 + 天馬 同宮)
        if (s.indexOf("化祿") !== -1 && s.indexOf("天馬") !== -1) {
          hasLuMaCombo = true;
        }
        // 偵測 龍鳳配 (龍池 + 鳳閣 同宮)
        if (s.indexOf("龍池") !== -1 && s.indexOf("鳳閣") !== -1) {
          hasLongFengCombo = true;
        }
        // 偵測化空 (吉星與空亡星同宮)
        const hasVoid = voidStarList.some((vs) => s.indexOf(vs) !== -1);
        const hasLuckyTrans = ["化祿", "化權", "化科"].some(
          (t) => s.indexOf(t) !== -1,
        );
        if (hasVoid && hasLuckyTrans) hasLuckyVoided = true;
        if (hasLuckyTrans) luckyPalaceCount++;
      }
      if (h === "strYearT1" || h === "年天干")
        targetYearStem = String(cVal || "").trim();
      if (h === "strYearT2" || h === "年地支")
        targetYearBranch = String(cVal || "").trim();
      if (h === "strMonthT1" || h === "月天干")
        targetMonthStem = String(cVal || "").trim();
      if (h === "strMonthT2" || h === "月地支")
        targetMonthBranch = String(cVal || "").trim();
      if (h === "strDayFive" || h === "日五形")
        targetDayFive = String(cVal || "").trim();
      if (h === "strDayT1" || h === "日天干")
        targetDayStem = String(cVal || "").trim();
      if (h === "strDayT2" || h === "日地支")
        targetDayBranch = String(cVal || "").trim();
      if (h === "strHourT" || h === "時柱") {
        const sStr = String(cVal || "").trim();
        // 提取地支部分 (例如 "甲子" 提取 "子")
        targetHourBranch = sStr.length >= 2 ? sStr[sStr.length - 1] : sStr;
      }
    });

    // 偵測天克地衝 (日柱 vs 年柱) - 系統性規律重組警告 (複用已定義的 sMap 與 zMap)
    let hasSkyEarthClash = false;
    if (
      sMap.hasOwnProperty(targetYearStem) &&
      sMap.hasOwnProperty(targetDayStem) &&
      zMap.hasOwnProperty(targetYearBranch) &&
      zMap.hasOwnProperty(targetDayBranch)
    ) {
      // 天克：天干相沖 (相隔6位)；地衝：地支相沖 (相隔6位)
      if (
        Math.abs(sMap[targetYearStem] - sMap[targetDayStem]) === 6 &&
        Math.abs(zMap[targetYearBranch] - zMap[targetDayBranch]) === 6
      ) {
        hasSkyEarthClash = true;
      }
    }

    // 偵測歲破 (日支 vs 年支) - 環境能量衝突警告
    let hasYearlyClash = false;
    if (
      zMap.hasOwnProperty(targetYearBranch) &&
      zMap.hasOwnProperty(targetDayBranch)
    ) {
      if (Math.abs(zMap[targetYearBranch] - zMap[targetDayBranch]) === 6) {
        hasYearlyClash = true;
      }
    }

    // 偵測天合地合 (日柱 vs 月柱) - 情感穩定與內部和諧訊號
    let hasDayMonthCombo = false;
    if (
      sMap.hasOwnProperty(targetMonthStem) &&
      sMap.hasOwnProperty(targetDayStem) &&
      zMap.hasOwnProperty(targetMonthBranch) &&
      zMap.hasOwnProperty(targetDayBranch)
    ) {
      // 天合：天干五合 (相隔5位)
      const isStemCombo =
        Math.abs(sMap[targetMonthStem] - sMap[targetDayStem]) === 5;
      // 地合：地支六合 (總和除12餘1)
      const isZodiacHarmony =
        (zMap[targetMonthBranch] + zMap[targetDayBranch]) % 12 === 1;

      if (isStemCombo && isZodiacHarmony) hasDayMonthCombo = true;
    }

    // 偵測金鎖結構 (日支同時與月支、時支和合) - 極致穩定與高信心訊號
    const checkHarmony = (b1, b2) => {
      if (!zMap.hasOwnProperty(b1) || !zMap.hasOwnProperty(b2)) return false;
      const p1 = zMap[b1],
        p2 = zMap[b2];
      const isSix = (p1 + p2) % 12 === 1; // 六合
      const isTriple = Math.abs(p1 - p2) !== 0 && Math.abs(p1 - p2) % 4 === 0; // 三合
      return isSix || isTriple;
    };

    let hasGoldenLock = false;
    if (targetDayBranch && targetMonthBranch && targetHourBranch) {
      if (
        checkHarmony(targetDayBranch, targetMonthBranch) &&
        checkHarmony(targetDayBranch, targetHourBranch)
      ) {
        hasGoldenLock = true;
      }
    }

    // 偵測日五行強度 (日五行 vs 月令) - 能量基底判斷
    const elementSeasonStrength = {
      木: {
        supported: ["寅", "卯", "亥", "子"],
        weakened: ["巳", "午", "辰", "戌", "丑", "未", "申", "酉"],
      },
      火: {
        supported: ["巳", "午", "寅", "卯"],
        weakened: ["辰", "戌", "丑", "未", "申", "酉", "亥", "子"],
      },
      土: {
        supported: ["辰", "戌", "丑", "未", "巳", "午"],
        weakened: ["申", "酉", "亥", "子", "寅", "卯"],
      },
      金: {
        supported: ["申", "酉", "辰", "戌", "丑", "未"],
        weakened: ["亥", "子", "寅", "卯", "巳", "午"],
      },
      水: {
        supported: ["亥", "子", "申", "酉"],
        weakened: ["寅", "卯", "巳", "午", "辰", "戌", "丑", "未"],
      },
    };
    let dayElementStrength = "NEUTRAL";
    if (elementSeasonStrength[targetDayFive]) {
      if (
        elementSeasonStrength[targetDayFive].supported.indexOf(
          targetMonthBranch,
        ) !== -1
      ) {
        dayElementStrength = "SUPPORTED";
      } else if (
        elementSeasonStrength[targetDayFive].weakened.indexOf(
          targetMonthBranch,
        ) !== -1
      ) {
        dayElementStrength = "WEAKENED";
      }
    }

    // 偵測三煞 (日支 vs 年支) - 能量停滯與僵化警告
    const threeKillingsMap = {
      // 寅午戌 (火) -> 亥子丑 (北)
      寅: ["亥", "子", "丑"],
      午: ["亥", "子", "丑"],
      戌: ["亥", "子", "丑"],
      // 申子辰 (水) -> 巳午未 (南)
      申: ["巳", "午", "未"],
      子: ["巳", "午", "未"],
      辰: ["巳", "午", "未"],
      // 亥卯未 (木) -> 申酉戌 (西)
      亥: ["申", "酉", "戌"],
      卯: ["申", "酉", "戌"],
      未: ["申", "酉", "戌"],
      // 巳酉丑 (金) -> 寅卯辰 (東)
      巳: ["寅", "卯", "辰"],
      酉: ["寅", "卯", "辰"],
      丑: ["寅", "卯", "辰"],
    };
    const hasThreeKillings = !!(
      threeKillingsMap[targetYearBranch] &&
      threeKillingsMap[targetYearBranch].indexOf(targetDayBranch) !== -1
    );

    // 偵測日支與時支構成的相刑 (兩重相刑判定)
    const dhPenalty = getZodiacPenaltyType(targetDayBranch, targetHourBranch);
    const dSelf = getZodiacPenaltyType(targetDayBranch, targetDayBranch);
    const hSelf = getZodiacPenaltyType(targetHourBranch, targetHourBranch);
    const targetPenaltyTypes = new Set();
    if (dhPenalty !== "NONE") targetPenaltyTypes.add(dhPenalty);
    if (dSelf !== "NONE") targetPenaltyTypes.add(dSelf);
    if (hSelf !== "NONE") targetPenaltyTypes.add(hSelf);
    // 當存在多種相刑類型或日時產生特定交互時，判定為兩重相刑
    const hasDayHourDoublePenalty = targetPenaltyTypes.size >= 2;

    // 重新產生/優化 AI 戰略建議，注入擾動因子資訊
    aiStrategy = generateAIStrategy({
      repeatConf,
      skipConf,
      rareConf,
      sumConf,
      perturbationFactors: perturbationFactors,
      isPenalty: isPenaltyApplied,
      highZScoreCount: highZScoreCount,
      hasStemComboDrive: stemComboCount >= 2, // 若前三名匹配中出現 2 次以上五合，判定為驅動因子
      hasZodiacHarmonyDrive: zodiacHarmonyCount >= 2, // 新增：地支六合偵測
      hasTripleHarmonyDrive: tripleHarmonyCount >= 3, // 新增：地支三合偵測 (門檻設較高因出現率較頻繁)
      hasZodiacPenaltyDrive: zodiacPenaltyCount >= 2, // 新增：地支相刑偵測
      hasDoublePenaltyDrive: doublePenaltyCount >= 1, // 新增：多重相刑偵測
      foundLuckyCombos: foundLuckyCombos,
      foundUnluckyCombos: foundUnluckyCombos,
      nineStarMatchCount: nineStarMatchCount,
      mansionMatchCount: mansionMatchCount,
      hasCareerHuaQuan: hasCareerHuaQuan,
      hasParentsHuaKe: hasParentsHuaKe,
      hasWealthHuaLu: hasWealthHuaLu,
      hasSelfPalacePenalty: hasSelfPalacePenalty,
      hasDayHourDoublePenalty: hasDayHourDoublePenalty,
      hasLuJieClash: hasLuJieClash,
      hasLuMaCombo: hasLuMaCombo,
      hasLongFengCombo: hasLongFengCombo,
      hasFiveStarAlignment: luckyPalaceCount >= 5,
      hasLuckyVoided: hasLuckyVoided,
      hasSkyEarthClash: hasSkyEarthClash,
      hasYearlyClash: hasYearlyClash,
      hasGoldenLock: hasGoldenLock,
      hasDayMonthCombo: hasDayMonthCombo,
      hasThreeKillings: hasThreeKillings,
      dayElementStrength: dayElementStrength,
      hasLargeSpanPeriodicPattern: hasLargeSpanPeriodicPattern, // 新增：大跨度週期規律
      isHighGravityMode: isHighGravityMode, // 傳遞高引力模式標記
      suddenChangeCount: suddenChangeCount, // 傳遞突發性變動計數
      suddenChangeFactors: suddenChangeFactors, // 傳遞突發性變動係數
      hasShortTermIntensivePattern: hasShortTermIntensivePattern, // 新增：短期密集規律
      targetDayFive: targetDayFive,
      zMultiplier: zMultiplier, // 傳遞濾網強度數值
      targetDayBranch: targetDayBranch,
      targetYearBranch: targetYearBranch,
      targetHourBranch: targetHourBranch,
    });

    const top3Matches = top3MatchesRaw.map((m) => ({
      date:
        m.date instanceof Date
          ? Utilities.formatDate(m.date, "GMT+8", "yyyy-MM-dd")
          : m.date.toString().split("T")[0],
      score: m.score,
      coeffs: m.coeffs,
    }));

    for (let num in numberScores) {
      let finalMult = trendMultipliers[num] || 1.0;

      // --- 孤兒號碼過濾：若處於多重共振模式，且號碼未出現在核心共振期，則強力降權 ---
      if (isHybridResonance && !resonanceNumberSet.has(Number(num))) {
        finalMult *= 0.5; // 孤兒號碼權重減半，確保預測更聚焦於共振頻率
      }
      numberScores[num] *= finalMult;
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
      const tSet = new Set((drawsBefore[0] || []).map((n) => n % 10));
      for (let n = 1; n <= maxNum; n++) {
        if (tSet.has(n % 10)) numberScores[n] *= 1 + tailConf / 1000;
      }
    }

    const topN = topNChoice ? parseInt(topNChoice) : isChaos ? 12 : 10;
    const sortedResults = Object.keys(numberScores)
      .map((n) => ({ n: parseInt(n), s: numberScores[n] }))
      .sort((a, b) => b.s - a.s)
      .slice(0, topN);
    const totalS = sortedResults.reduce((a, c) => a + c.s, 0);

    // --- 修正：若總分 totalS 為 0，則平均分配機率，避免顯示 0% ---
    let defaultProb = "0%";
    if (totalS === 0 && sortedResults.length > 0) {
      defaultProb = (100 / sortedResults.length).toFixed(1) + "%";
    }

    const finalData = sortedResults.map((item) => ({
      number: item.n,
      probability:
        totalS > 0 ? ((item.s / totalS) * 100).toFixed(1) + "%" : defaultProb,
      status: statusInfo[item.n] ? statusInfo[item.n].text : "一般",
      statusColor: statusInfo[item.n]
        ? statusInfo[item.n].color
        : "bg-secondary",
      isRepeat: lastDrawSet.has(item.n),
      isSkip: lastLastDrawSet.has(item.n),
      isHeatPenalized: penalizedSet.has(item.n),
      isPotentialCold:
        statusInfo[item.n] &&
        (statusInfo[item.n].text === "冷門" ||
          statusInfo[item.n].text === "極冷"),
    }));

    let actualDraw = null,
      profitStars = 0,
      maxStarsVal = nCols.length, // 預設最大星等為開獎球數
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

      // --- 根據 zMultiplier 調整獲利星等權重 (難度加權) ---
      // 以標準濾網 1.2 為基準。濾網越嚴格(Z越高)，命中權重越高；反之則下修。
      const difficultyWeight = zMultiplier / 1.2;
      profitStars = Number(
        ((mainHit + (isS1Hit ? 0.5 : 0)) * difficultyWeight).toFixed(2),
      );
      maxStarsVal = Number((nCols.length * difficultyWeight).toFixed(2));
    }

    const resultObj = {
      status: "complete",
      date: dateStr,
      results: finalData,
      isChaos: isChaos,
      learningMode: learningMode,
      isSevereAnomaly: isSevereAnomaly,
      isDeviated: isDeviated,
      stdDev: stdDev,
      avgHistDeviation: avgHistDeviation,
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
      profitStars: Number(profitStars),
      maxStars: maxStarsVal,
      isS1Hit: isS1Hit,
      bypassCache: ctx.bypassCache,
      confidenceHistory: confidenceHistory,
      aiStrategy: aiStrategy,
      cyclicalComparison: cyclicalComparison,
    };
    return resultObj;
  } catch (err) {
    // 紀錄錯誤至系統屬性方便統計
    try {
      const props = PropertiesService.getScriptProperties();
      const count = parseInt(props.getProperty("ERR_PREDICT_COUNT") || "0") + 1;
      props.setProperty("ERR_PREDICT_COUNT", count.toString());

      // 安全性檢查：限制 Stack Trace 長度 (避免 9KB 限制導致二次崩潰)
      const safeStack = String(err.stack || "").substring(0, 8000);
      props.setProperty(
        "ERR_PREDICT_LAST",
        JSON.stringify({
          time: new Date().toISOString(),
          lotto: lotto,
          date: dateStr,
          message: err.message,
          stack: safeStack,
        }),
      );
    } catch (logErr) {
      console.error("Critical logging failure:", logErr);
    }

    console.error(
      `[getPrediction Error] ${lotto} @ ${dateStr}: ${err.message}\n${err.stack}`,
    );
    return {
      status: "error",
      message: `預測核心異常：${err.message}`,
      debugInfo: {
        location: "PredictModule.getPrediction",
        stack: `[Environment Context]\nLotto: ${lotto}\nDate: ${dateStr}\nTrend: ${useTrend}\nTopN: ${topNChoice}\n${"-".repeat(30)}\n${err.stack}`,
        context: { lotto, dateStr, useTrend, topNChoice },
      },
    };
  }
} // 確保 getPrediction 函式在此完全結束

/**
 * 根據信心指數產生 AI 策略建議
 */
function generateAIStrategy(stats) {
  let recommendation = "星系進入平穩期，建議均衡配置號碼。";
  let focus = "平衡佈局";
  let risk = "低";

  // --- 新增：濾網強度技術分析描述 ---
  if (stats.zMultiplier !== undefined) {
    const z = stats.zMultiplier;
    let filterDesc = "";
    if (z >= 1.5) {
      filterDesc = `\n【技術分析：極致濾網】當前星系震盪劇烈，系統已自動將訊號濾網強度提升至 ${z.toFixed(1)}x，僅保留核心共振頻率，有效排除背景雜訊。`;
    } else if (z <= 0.9) {
      filterDesc = `\n【技術分析：寬頻掃描】當前星系能量平穩，系統已將濾網下調至 ${z.toFixed(1)}x，擴大樣本捕捉範圍以涵蓋微弱但穩定的慣性訊號。`;
    } else {
      filterDesc = `\n【技術分析：標準濾網】系統目前運作於標準辨識精度 (${z.toFixed(1)}x)，平衡了訊號純度與統計樣本容量。`;
    }
    recommendation += filterDesc;
  }

  // 偵測天干五合驅動力
  // 偵測大跨度週期規律
  if (stats.hasLargeSpanPeriodicPattern) {
    recommendation +=
      "\n【深度洞察：大跨度週期規律】偵測到歷史高相似期分佈於較長的時間跨度。這暗示當前星系軌道可能遵循一個宏觀的、緩慢演變的週期性規律，建議深入分析其長期趨勢。";
    focus = focus === "平衡佈局" ? "長期週期追蹤" : focus + " (長期週期)";
    risk = risk === "低" ? "中 (長期規律)" : risk;
  }

  // 偵測短期密集規律
  if (stats.hasShortTermIntensivePattern) {
    recommendation +=
      "\n【深度洞察：短期密集規律】偵測到歷史高相似期在時間分佈上高度聚集（小於 60 天）。這顯示星系目前正受強大的短期慣性主導，規律的即時性與爆發力強，建議鎖定當前的趨勢走勢。";
    focus = focus === "平衡佈局" ? "短期趨勢爆發" : focus + " (短期慣性)";
    risk = risk === "低" ? "中 (高時效性)" : risk;
  }

  // 偵測多重共振 (Hybrid Resonance)
  if (stats.hasLargeSpanPeriodicPattern && stats.hasShortTermIntensivePattern) {
    recommendation +=
      "\n【核心警示：星系多重共振】偵測到「長效週期」與「短期聚集」同時發生。星系能量高度集中，系統已啟動「共振過濾」，自動壓制了與核心規律不符的孤兒號碼。";
    focus = "多重共振模式";
    risk = "極低 (規律高度疊加)";
  }

  if (stats.hasStemComboDrive) {
    recommendation +=
      "\n【星相特徵：天干五合】偵測到當前預測受「天干五合」強力驅動。歷史相似期顯示能量轉化趨於和諧，建議關注規律性強且穩定性高的號碼組合。";
    focus = "五合和諧模式";
  }

  // 偵測地支六合驅動力
  if (stats.hasZodiacHarmonyDrive) {
    recommendation +=
      "\n【星相特徵：地支六合】偵測到歷史相似期存在顯著的「地支六合」關係。能量表現趨於契合，通常預示著號碼走勢具備較強的吸引力與重現規律。";
    focus = focus === "平衡佈局" ? "六合穩定模式" : focus + " (含六合)";
  }

  // 偵測地支三合驅動力
  if (stats.hasTripleHarmonyDrive) {
    recommendation +=
      "\n【星相特徵：地支三合】星系能量呈現「三方會照」之勢。這是一種強大的動態循環，歷史上常伴隨號碼的結構性噴發，建議關注近期出現頻率中等的組合。";
    focus = focus === "平衡佈局" ? "三方能量共振" : focus + " (含三合)";
  }

  // 偵測吉星組合
  if (stats.foundLuckyCombos && stats.foundLuckyCombos.length > 0) {
    const formattedLuckyCombos = stats.foundLuckyCombos
      .map((combo) => `<span class="lucky-combo">${combo}</span>`)
      .join("、");
    recommendation += `\n【吉祥星曜】偵測到目標日期宮位具備吉星成雙組合：${formattedLuckyCombos}。歷史數據顯示此類組合能大幅提升軌道穩定性，有利於規律性強的號碼產出。`;
    focus = focus === "平衡佈局" ? "吉星高亮模式" : focus + " (吉星加持)";
  }

  // 偵測週期共振 (九星與星宿在 Top 3 匹配中的重複率)
  if (stats.nineStarMatchCount >= 2 || stats.mansionMatchCount >= 2) {
    recommendation += `\n【週期共振】偵測到歷史高相似期中，「日九星」或「二十八星宿」與目標日高度重合。這代表當前星相處於歷史強規律的共振點，預測軌道之歷史重現率較高。`;
    focus = focus === "平衡佈局" ? "週期共振模式" : focus + " (規律共振)";
  }

  // 偵測五星連珠 (多宮位吉化)
  if (stats.hasFiveStarAlignment) {
    recommendation += `\n【天象大吉：五星連珠】偵測到全星盤中有 5 個以上宮位同時具備吉化能量（化祿、化權、化科）。這象徵多維度能量產生強力共振，預測軌道將極度趨向規律性噴發，信心度極高。`;
    focus = "五星共振模式";
    risk = "極低";
  }

  // 偵測金鎖結構 (高信心度)
  if (stats.hasGoldenLock) {
    recommendation += `\n【核心亮點：金鎖結構】偵測到日支與月、時支形成「雙重和合」的金鎖結構。這代表當前星系軌道極度穩固，雜訊干擾降至最低。歷史相似期顯示此類結構的預測命中率具備高度統計學意義，建議作為核心參考基準。`;
    focus = "金鎖共振模式";
    risk = "極低";
  }

  // 偵測天合地合 (情感穩定)
  if (stats.hasDayMonthCombo) {
    recommendation += `\n【心境和諧：天合地合】偵測到日柱與月柱形成「天合地合」。這象徵內在情感與外部環境的高度契合，能量場表現極為平穩。歷史相似期顯示走勢較少出現極端偏離，利於觀察穩定規律。`;
    focus = focus === "平衡佈局" ? "穩定共振模式" : focus + " (心境穩定)";
  }

  // 偵測日五行強度
  if (stats.dayElementStrength === "SUPPORTED") {
    recommendation += `\n【五行氣旺】偵測到日五行「${stats.targetDayFive}」受月令環境強力扶助（旺相）。這代表當天能量基底深厚且活躍，有助於規律性強的號碼走勢持續發展，預測信心度較高。`;
    focus = focus === "平衡佈局" ? "能量氣旺模式" : focus + " (氣旺)";
  } else if (stats.dayElementStrength === "WEAKENED") {
    recommendation += `\n【五行氣弱】偵測到日五行「${stats.targetDayFive}」受月令環境剋洩（休囚死）。能量基底較為虛弱，容易受到隨機雜訊干擾，號碼走勢可能出現零星偏離。`;
    focus = focus === "平衡佈局" ? "能量守恆模式" : focus + " (氣弱)";
    risk = risk === "低" ? "中 (氣弱震盪)" : risk;
  }

  // 偵測化空 (吉星受阻)
  if (stats.hasLuckyVoided) {
    recommendation += `\n【能量中和：化空】偵測到目標日期宮位出現「吉星化空」現象（吉化星曜與空亡星同宮）。這代表原本的吉祥能量受阻或虛浮化，歷史相似期顯示好運能量較難落實，需防範走勢虛高。`;
    focus = focus === "平衡佈局" ? "能量中和模式" : focus + " (吉化受阻)";
  }

  // 偵測財帛宮化祿 (財星環繞)
  if (stats.hasWealthHuaLu) {
    recommendation += `\n【財星環繞】偵測到財帛宮具備「<span class="lucky-combo">化祿</span>」能量。這象徵財務軌道的引力強化與資源匯聚，歷史數據顯示此時能量場極為穩固，有利於捕捉具備週期性的號碼。`;
    focus = focus === "平衡佈局" ? "財富磁吸模式" : focus + " (財帛加持)";
  }

  // 偵測官祿宮化權 (事業衝刺)
  if (stats.hasCareerHuaQuan) {
    recommendation += `\n【事業衝刺】偵測到官祿宮具備「<span class="lucky-combo">化權</span>」能量。這象徵專業領域的權威與執行力提升，歷史相似期顯示職場軌道動能強勁，有助於號碼走勢的結構性穩定。`;
    focus = focus === "平衡佈局" ? "事業權力模式" : focus + " (官祿加持)";
  }

  // 偵測父母宮化科 (貴人提攜)
  if (stats.hasParentsHuaKe) {
    recommendation += `\n【貴人提攜】偵測到父母宮具備「<span class="lucky-combo">化科</span>」能量。這象徵來自長輩、上司或體制的聲望與助力，歷史相似期顯示外部磁場穩定，有助於降低隨機雜訊對號碼軌道的干擾。`;
    focus = focus === "平衡佈局" ? "貴人守護模式" : focus + " (父母加持)";
  }

  // 偵測 祿馬交馳 (財祿流動)
  if (stats.hasLuMaCombo) {
    recommendation += `\n【格局亮點：祿馬交馳】偵測到宮位具備「<span class="lucky-combo">化祿</span>」與「<span class="lucky-combo">天馬</span>」同宮。這代表「動能帶動財祿」，歷史相似期顯示能量場具備高度的活躍性與獲利結構，利於捕捉具備強勢動能的號碼。`;
    focus = focus === "平衡佈局" ? "祿馬交馳模式" : focus + " (祿馬加持)";
  }

  // 偵測 龍鳳配 (能量平衡)
  if (stats.hasLongFengCombo) {
    recommendation += `\n【格局亮點：龍鳳配】偵測到宮位具備「<span class="lucky-combo">龍池</span>」與「<span class="lucky-combo">鳳閣</span>」同宮。這象徵能量的精緻平衡與格局提升，歷史相似期顯示走勢具備較強的穩定性與協調感。`;
    focus = focus === "平衡佈局" ? "龍鳳呈祥模式" : focus + " (龍鳳加持)";
  }

  // 偵測 祿逢劫殺 (吉中藏凶)
  if (stats.hasLuJieClash) {
    recommendation += `\n【風險警告：祿逢劫殺】偵測到宮位出現「<span class="lucky-combo">化祿</span>」與「<span class="unlucky-combo">地劫</span>」同宮。這象徵吉祥能量受到嚴重截留（祿逢劫殺），歷史相似期顯示能量場極易發生突發性耗損，建議採取保守策略。`;
    risk =
      risk === "極低" || risk === "低" ? "中高 (祿逢劫殺)" : "極高 (祿逢劫殺)";
    focus = focus === "平衡佈局" ? "防禦保守模式" : focus + " (防範祿劫)";
  }

  // 偵測凶星組合
  if (stats.foundUnluckyCombos && stats.foundUnluckyCombos.length > 0) {
    const formattedUnluckyCombos = stats.foundUnluckyCombos
      .map((combo) => `<span class="unlucky-combo">${combo}</span>`)
      .join("、");
    recommendation += `\n【凶煞警告】偵測到目標日期宮位具備凶星匯聚組合：${formattedUnluckyCombos}。此類組合常伴隨能量劇烈震盪，易導致規律偏移，建議採取保守避險策略。`;
    risk = "極高 (煞星衝擊)";
  }

  // 偵測命宮自刑 (風險警告)
  if (stats.hasSelfPalacePenalty) {
    recommendation += `\n【風險警告：命宮自刑】偵測到命宮出現「<span class="unlucky-combo">自刑</span>」特徵。這象徵能量場的內部衝突與規律內耗，歷史數據顯示此類走勢極易發生突發性斷裂或難以預測的偏離，建議採取保守策略。`;
    risk = "極高 (命宮自刑)";
    focus = focus === "平衡佈局" ? "避險保護模式" : focus + " (防禦加重)";
  }

  // 偵測日支與時支相刑 (兩重相刑)
  if (stats.hasDayHourDoublePenalty) {
    recommendation += `\n【極高風險：兩重相刑】偵測到目標日地支「<span class="unlucky-combo">${stats.targetDayBranch}</span>」與時地支「<span class="unlucky-combo">${stats.targetHourBranch}</span>」構成兩重相刑交互。這代表能量磁場極度混亂，規律性常因劇烈震盪而失效，強烈建議採取極端防禦或低注碼策略。`;
    risk = "極高 (兩重相刑)";
    focus = "極端防禦模式";
  }

  // 偵測天克地衝 (系統規律重組)
  if (stats.hasSkyEarthClash) {
    recommendation += `\n【系統警告：天克地衝】偵測到日柱與年柱產生「天克地衝」極端交互。這象徵整體能量場的「重開機」與規律徹底崩解，歷史數據顯示此類走勢完全不可預測，建議停止參考歷史規律，採取最保守佈局。`;
    risk = "極高 (系統性重組)";
    focus = "規律重置模式";
  }

  // 偵測歲破 (環境對沖)
  if (stats.hasYearlyClash) {
    recommendation += `\n【環境警告：歲破】偵測到日支「<span class="unlucky-combo">${stats.targetDayBranch}</span>」與年支「<span class="unlucky-combo">${stats.targetYearBranch}</span>」產生正向對沖（歲破）。這代表當前能量場與大環境磁場不睦，歷史規律易受外力干擾而失真，建議採取保守避險策略。`;
    risk = risk === "低" ? "中高 (歲破對沖)" : "極高 (歲破對沖)";
    focus = focus === "平衡佈局" ? "環境避險模式" : focus + " (防範歲破)";
  }

  // 偵測三煞 (能量停滯)
  if (stats.hasThreeKillings) {
    recommendation += `\n【能量停滯：三煞】偵測到日支「<span class="unlucky-combo">${stats.targetDayBranch}</span>」落入年支「<span class="unlucky-combo">${stats.targetYearBranch}</span>」的「三煞」方位。這象徵能量場的滯礙與凝結，歷史相似期常出現冷號持續或走勢僵化的現象，建議多觀察、少重注。`;
    risk = risk === "低" ? "中 (能量停滯)" : risk;
    focus = focus === "平衡佈局" ? "保守防禦模式" : focus + " (防範三煞)";
  }

  // 偵測「大耗」與「地劫」同時出現，自動調降信心指數
  if (
    stats.foundUnluckyCombos &&
    stats.foundUnluckyCombos.includes("大耗地劫")
  ) {
    recommendation += `\n【極端風險警告：大耗地劫同現】偵測到「大耗」與「地劫」同時出現。這象徵能量場的極度耗損與破敗，歷史數據顯示此類組合極易導致預測失準，建議大幅調降信心指數，採取極端保守策略。`;
    risk = "極高 (大耗地劫)";
    focus = "極端避險模式";
  }

  // 偵測突發性重組
  if (stats.suddenChangeCount > 0) {
    recommendation += `\n【突發性重組警告】偵測到 ${stats.suddenChangeCount} 個關鍵係數在最新一期發生劇烈變動：${stats.suddenChangeFactors.join("、")}。這預示著星系規律可能正在經歷突發性重組，歷史慣性可能失效，建議高度警惕。`;
    risk = "極高 (突發性重組)";
    focus = "規律重組應對";
  }

  // 偵測地支相刑 (風險警告)
  if (stats.hasZodiacPenaltyDrive) {
    recommendation +=
      "\n【風險警告：地支相刑】偵測到當前星相處於「相刑」震盪期。這通常代表能量衝突與不穩定，號碼走勢可能出現極端偏離或難以預測的跳躍，建議降低注碼或採取多樣化避險佈局。";
    risk = "高 (相刑震盪)";
  }

  // 偵測多重相刑 (Double Penalty)
  if (stats.hasDoublePenaltyDrive) {
    recommendation +=
      "\n【核心警告：多重相刑】偵測到星系中同時存在多種「相刑」關係（如自刑與無禮之刑疊加）。這代表能量結構極度扭曲，歷史相似期常出現難以預料的劇烈跳動，建議採取極度保守策略。";
    focus = "多重負向能量共振";
    risk = "極高 (多重相刑)";
  }

  // 對照表健康報告
  if (stats.unmappedPercentage > 10) {
    recommendation += `\n【數據配置警告】對照表完整度僅 ${(100 - stats.unmappedPercentage).toFixed(1)}%。有 ${stats.unmappedPercentage.toFixed(1)}% 的係數未被正確識別，可能影響預測精準度。`;
    risk = "中高 (配置不全)";
  }

  // 偵測系統性規律重組 (Z-Score 過高係數過多)
  if (stats.highZScoreCount >= 3) {
    recommendation = "【技術警告：規律重組中】\n" + recommendation;
    risk = "極高 (系統性偏移)";
  }

  // 基礎信心判斷
  if (stats.repeatConf > 70) {
    recommendation =
      "偵測到強烈的連莊引力！歷史相似期傾向重複上一期星球，建議優先追熱。";
    focus = "激進追熱";
  } else if (stats.rareConf > 60) {
    recommendation =
      "星系能量向邊緣移動，歷史冷號反彈機率增加，建議在預測中挑選 2-3 顆冷門星球。";
    focus = "冷號反彈";
    risk = "中";
  } else if (stats.sumConf < 30) {
    recommendation = "和值震盪劇烈，規律特徵不明顯，建議採取保守散點佈局。";
    risk = "高";
  }

  // 注入星系擾動因子偵測結果
  if (stats.perturbationFactors && stats.perturbationFactors.length > 0) {
    recommendation += `\n偵測到「星系擾動因子」：${stats.perturbationFactors.join("、")}。軌道規律受此異動影響，預測穩定度下降。`;
    if (stats.isPenalty) {
      recommendation += " 信心指數已自動執行安全下修。";
      risk = "極高 (數據不穩)";
    } else {
      risk = "中高 (局部異動)";
    }
  }

  return { recommendation, focus, risk };
}
/**
 * 簡單版預測 (Legacy) - 同樣移動到此以便統一管理
 */
function getPrediction_Simple(lotto, dateStr, useTrend, topNChoice) {
  try {
    const ctx = initPredictionContext(lotto, dateStr);
    const {
      targetData,
      historicalData,
      dateCol,
      targetMonth,
      sumCol,
      maxNum,
      nCols,
      rarityConfig,
      lastKnownSum,
      targetSumVal,
      coeffStartIdx,
      allDataHeaders,
      validCoeffIndices,
      targetCoeffs,
      trObj,
      baseWeights,
    } = ctx;

    const numberScores = {};
    for (let i = 1; i <= maxNum; i++) numberScores[i] = 0;

    // 1. 預先計算振幅與環境感應，以便在相似度計算中使用正確的 isHighGravityMode
    const allHistAmplitudes = historicalData.slice(1).map((row, idx, arr) => {
      const currentSum = Number(row[sumCol]) || 0;
      const prevSum = idx > 0 ? Number(arr[idx - 1][sumCol]) : currentSum;
      return Math.abs(currentSum - prevSum);
    });

    const env = getEnvironmentSensingParams(
      allHistAmplitudes,
      targetSumVal,
      ctx.lastKnownSum,
      lotto,
      rarityConfig,
      null,
      targetCoeffs,
      allDataHeaders,
    );
    const ampPercentile = env.ampPercentile;
    const isHighGravityMode = env.isHighGravityMode;

    // 2. 執行相似度計算迴圈
    let similarityHistory = [];
    historicalData.forEach((row, idx) => {
      if (idx === 0) return;
      let distance = 0;
      const rowCoeffs = validCoeffIndices.map(
        (vIdx) => row.slice(coeffStartIdx)[vIdx],
      );
      let penaltyTypesFound = new Set();
      for (let j = 0; j < (targetCoeffs || []).length; j++) {
        const v1 = targetCoeffs[j];
        const v2 = rowCoeffs[j];
        distance +=
          calculateSymbolDistance(
            v1,
            v2,
            allDataHeaders[j],
            isHighGravityMode,
          ) * baseWeights[j];

        const pType = getZodiacPenaltyType(v1, v2);
        if (pType !== "NONE") penaltyTypesFound.add(pType);
      }

      if (penaltyTypesFound.size >= 2) distance *= 1.8;

      // --- 優化：簡單預測模式下同樣套用嚴選過濾邏輯 ---
      let weightPower = 0.75;
      let weightThreshold = 0;
      if (parseInt(topNChoice) === 5) {
        weightPower = 1.2;
        weightThreshold = 0.05;
      }
      let weight = 1 / (Math.pow(distance, weightPower) + 1.2);
      if (weight < weightThreshold) weight = 0;

      // --- 歷史同月份權重加成 (Capture Monthly Cycles) ---
      const rowDate =
        row[dateCol] instanceof Date
          ? row[dateCol]
          : new Date(String(row[dateCol]).replace(/-/g, "/"));
      if (rowDate.getMonth() === targetMonth) weight *= 1.15;

      similarityHistory.push({
        date: row[dateCol],
        score: weight,
        coeffs: rowCoeffs,
      });

      nCols.forEach((cIdx) => {
        const num = row[cIdx];
        if (numberScores[num] !== undefined) numberScores[num] += weight;
      });
    });

    let statusInfo = {};
    if (useTrend) {
      const missSheet = trObj.spreadsheet.getSheetByName("Miss");
      if (missSheet && missSheet.getLastRow() > 1) {
        const mData = missSheet.getDataRange().getValues();
        const mHeads = mData[0];
        const mDateCol = mHeads.indexOf("Date");

        let mVals = null;
        const predTime_simple = new Date(dateStr.replace(/-/g, "/")).setHours(
          0,
          0,
          0,
          0,
        );
        for (let i = mData.length - 1; i >= 1; i--) {
          const rowTime =
            mData[i][mDateCol] instanceof Date
              ? mData[i][mDateCol].getTime()
              : new Date(
                  String(mData[i][mDateCol]).replace(/-/g, "/"),
                ).getTime();
          if (rowTime < predTime_simple) {
            mVals = mData[i];
            break;
          }
        }
        if (!mVals) mVals = mData[mData.length - 1];

        for (let j = 1; j <= maxNum; j++) {
          let mIdx = mHeads.indexOf("M" + j);
          if (mIdx > -1) {
            let c = Number(mVals[mIdx]) || 0;
            if (c <= 2) {
              numberScores[j] *= 1.2;
              statusInfo[j] = { text: "熱門", color: "bg-danger" };
            } else if (c >= 12) {
              numberScores[j] *= 0.8;
              statusInfo[j] = { text: "冷門", color: "bg-dark" };
            }
          }
        }
      }
    }

    const topN = topNChoice ? parseInt(topNChoice) : 10;
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
    }));

    const topMatches = similarityHistory
      .sort((a, b) => b.score - a.score)
      .slice(0, 3)
      .map((m) => {
        // 增加日期解析保護
        const dObj =
          m.date instanceof Date
            ? m.date
            : new Date(String(m.date).replace(/-/g, "/"));
        return {
          date: Utilities.formatDate(dObj, "Asia/Taipei", "yyyy-MM-dd"),
          score: m.score,
          coeffs: m.coeffs,
        };
      });

    return {
      status: "complete",
      date: dateStr,
      results: finalData,
      learningMode: "基礎快速預測",
      top3Matches: topMatches,
      allDataHeaders: allDataHeaders,
      targetCoeffs: targetCoeffs,
      ampPercentile: ampPercentile,
      aiStrategy: {
        recommendation:
          "目前使用基礎預測模式。星系能量穩定度：" +
          (ampPercentile > 80 ? "劇烈震盪" : "平穩"),
        focus: "基礎相似度",
        risk: ampPercentile > 80 ? "高" : "低",
      },
    };
  } catch (err) {
    console.error(`[getPrediction_Simple Error] ${err.message}\n${err.stack}`);
    // 修正：增加 PropertiesService 溢位保護，防止二次崩潰
    try {
      const props = PropertiesService.getScriptProperties();
      const count = parseInt(props.getProperty("ERR_PREDICT_COUNT") || "0") + 1;
      props.setProperty("ERR_PREDICT_COUNT", count.toString());

      const safeStack = String(err.stack || "").substring(0, 8000);
      props.setProperty(
        "ERR_PREDICT_LAST",
        JSON.stringify({
          time: new Date().toISOString(),
          lotto: lotto,
          date: dateStr,
          message: err.message,
          stack: safeStack,
        }),
      );
    } catch (logErr) {
      console.error("Logging failed in getPrediction_Simple:", logErr);
    }

    console.error(
      `[getPrediction_Simple Error] ${lotto} @ ${dateStr}: ${err.message}\n${err.stack}`,
    );
    return {
      status: "error",
      message: `預測核心異常(Simple)：${err.message}`,
      debugInfo: {
        location: "PredictModule.getPrediction_Simple",
        stack: `[Environment Context]\nLotto: ${lotto}\nDate: ${dateStr}\nMode: Simple/Legacy\n${"-".repeat(30)}\n${err.stack}`,
        context: { lotto, dateStr },
      },
    };
  }
}

/**
 * 統一初始化預測所需的所有數據與環境參數
 */
function initPredictionContext(lotto, dateStr) {
  // --- 輸入參數預驗證 (Sanity Check) ---
  if (!lotto || typeof lotto !== "string") {
    throw new Error("預測參數異常：未提供有效的彩種代碼 (Lotto)。");
  }
  if (!dateStr) {
    throw new Error("預測參數異常：預測日期 (Date) 缺失。");
  }

  // 嘗試解析日期，確保格式正確（支援 YYYY/MM/DD 或 YYYY-MM-DD）
  const testDate = new Date(String(dateStr).replace(/-/g, "/"));
  if (isNaN(testDate.getTime())) {
    throw new Error(`預測參數異常：日期格式無法識別 [${dateStr}]。`);
  }
  // ------------------------------------

  const trObj = getTargetsheet("Sheets", lotto);
  const sheet = trObj.spreadsheet.getSheetByName("All");
  if (!sheet) throw new Error("找不到歷史資料表 (All)。");

  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  const dateCol = headers.indexOf("Date");
  const sumCol = headers.indexOf("Sum");
  const s1Col = headers.indexOf("S1");

  const maxNumConfig = {
    L649: 49,
    LSix: 49,
    L638: 38,
    DEFAULT: 39,
  };
  const maxNum = maxNumConfig[lotto] || maxNumConfig["DEFAULT"];

  // 優化日期格式化：確保比對基準一致 (yyyy-MM-dd)
  const formatDate = (v) => {
    if (!v) return "";
    try {
      const d = v instanceof Date ? v : new Date(String(v).replace(/-/g, "/"));
      return Utilities.formatDate(d, "Asia/Taipei", "yyyy-MM-dd");
    } catch (e) {
      return "";
    }
  };
  const targetDateKey = formatDate(dateStr);
  const predTime = new Date(dateStr.replace(/-/g, "/")).setHours(0, 0, 0, 0);

  let targetData = null;
  let isFromAllData = false;

  // 1. 優先從該彩種的 All 工作表尋找 (包含號碼與係數)
  for (let i = data.length - 1; i >= 1; i--) {
    if (formatDate(data[i][dateCol]) === targetDateKey) {
      targetData = data[i];
      break;
    }
  }

  // 2. 若 All 表格尚未包含該日期，則從主試算表的 AllData (環境係數來源) 取得
  if (!targetData) {
    const fallbackSheet =
      SpreadsheetApp.getActiveSpreadsheet().getSheetByName("AllData");
    if (fallbackSheet) {
      const adcValues = fallbackSheet.getDataRange().getValues();
      targetData = adcValues.find(
        (row) => formatDate(row[0]) === targetDateKey,
      );
      if (targetData) isFromAllData = true;
    }
  }

  if (!targetData) {
    throw new Error(
      `找不到日期 [${dateStr}] 的預測係數。請確保 All 或 AllDataC 包含該日期資料。`,
    );
  }

  const historicalData = [
    headers,
    ...data.slice(1).filter((row) => {
      const rowTime = new Date(
        String(row[dateCol]).replace(/-/g, "/"),
      ).getTime();
      return rowTime < predTime;
    }),
  ];
  if (historicalData.length < 5)
    throw new Error("歷史數據不足，無法進行預測。");

  const lastKnownSum =
    Number(historicalData[historicalData.length - 1][sumCol]) || 0;
  const coeffStartIdx = sumCol + 1;
  const rawAllDataHeaders = headers.slice(coeffStartIdx);

  // --- 修正：根據來源動態提取 targetCoeffs ---
  let targetCoeffs = [];
  let targetSumVal = 0;

  if (isFromAllData) {
    // 來源是 AllData：第 0 欄是日期，其後直接是係數。Sum 預設為 0
    const adcSheet =
      SpreadsheetApp.getActiveSpreadsheet().getSheetByName("AllData");
    if (!adcSheet) {
      throw new Error("找不到環境係數表 (AllData)，請確認該工作表是否存在。");
    }
    const adcHeaders = adcSheet.getDataRange().getValues()[0];
    targetCoeffs = rawAllDataHeaders.map((h) => {
      const idx = adcHeaders.indexOf(String(h).trim());
      return idx > -1 ? targetData[idx] : "";
    });
    targetSumVal = 0;
  } else {
    // 來源是 All：遵循 coeffStartIdx 索引
    targetCoeffs = rawAllDataHeaders.map(
      (_, idx) => targetData[coeffStartIdx + idx],
    );
    targetSumVal = Number(targetData[sumCol]) || 0;
  }

  let settingsSheet = trObj.spreadsheet.getSheetByName("predic1_settings");
  if (!settingsSheet) {
    settingsSheet = trObj.spreadsheet.insertSheet("predic1_settings");
    const defaultSettings = [
      ["參數名稱", "設定值", "說明"],
      ["System_AnomalyThreshold", 2.5, "一般異常門檻"],
      ["System_SevereThreshold", 4.5, "嚴重異常門檻"],
      ["System_BypassCache", false, "是否強制重算"],
      ["Weight_波動", 2.5, "權重"],
      ["Weight_成交", 1.8, "權重"],
      ["Weight_趨勢", 1.5, "權重"],
      ["Weight_隨機", 0.8, "權重"],
      ["Weight_星宿", 2.2, "權重"],
      ["Weight_九星", 2.0, "權重"],
      ["Weight_S1", lotto === "L638" ? 3.5 : 1.8, "特別號權重"],
      ["Rarity_Cap", 1.5, "稀有度加成上限"],
      ["Rarity_MissThres", 10, "遺漏補正起始期數門檻"],
      ["Rarity_MissWeight", 0.05, "每期遺漏加成之斜率權重"],
    ];
    settingsSheet
      .getRange(1, 1, defaultSettings.length, 3)
      .setValues(defaultSettings);
    settingsSheet.setFrozenRows(1);
  }
  const settingsData = settingsSheet.getDataRange().getValues();

  // 初始化配置，完全從該彩種的 settings 讀取
  let rarityConfig = { cap: 1.5, missThres: 10, missWeight: 0.05 };
  let weightConfig = { DEFAULT: 1.0 };
  let anomalyMultiplier = 2.5,
    severeMultiplier = 4.5,
    bypassCache = false,
    bypassCacheRowIdx = -1;

  settingsData.forEach((row, i) => {
    const key = String(row[0] || "").trim();
    const val = row[1];
    if (key === "System_AnomalyThreshold")
      anomalyMultiplier = Number(val) || 2.5;
    if (key === "System_SevereThreshold") severeMultiplier = Number(val) || 4.5;
    if (key === "System_BypassCache") {
      bypassCache = val === true || String(val).toUpperCase() === "TRUE";
      bypassCacheRowIdx = i + 1;
    }
    if (key.startsWith("Rarity_")) {
      const rKey = key.replace("Rarity_", "");
      if (rKey === "Cap") rarityConfig.cap = Number(val);
      if (rKey === "MissThres") rarityConfig.missThres = Number(val);
      if (rKey === "MissWeight") rarityConfig.missWeight = Number(val);
    }
    if (key.startsWith("Weight_"))
      weightConfig[key.replace("Weight_", "")] = Number(val);
  });

  const ignoreKeywords = ["標示", "系統", "內容", "備註", "ID"];
  const validCoeffIndices = [];
  const allDataHeaders = [];
  rawAllDataHeaders.forEach((h, idx) => {
    const headerStr = String(h || "").trim();
    if (!ignoreKeywords.some((key) => headerStr.includes(key))) {
      validCoeffIndices.push(idx);
      allDataHeaders.push(headerStr);
    }
  });

  // 過濾無效關鍵字後的最終係數集合
  const finalTargetCoeffs = validCoeffIndices.map((idx) => targetCoeffs[idx]);
  const nCols = headers
    .map((h, i) => (h.match(/^[NL]\d+$/) ? i : -1))
    .filter((i) => i !== -1);

  if (allDataHeaders.length === 0 || finalTargetCoeffs.length === 0) {
    throw new Error(
      "無法識別任何有效的預測係數。請檢查 'All' 或 'AllData' 工作表的係數欄位名稱。",
    );
  }
  const avgFrequency = ((historicalData.length - 1) * nCols.length) / maxNum;

  const baseWeights = allDataHeaders.map((h) => {
    const matchKey = Object.keys(weightConfig).find((key) =>
      String(h).includes(key),
    );
    return matchKey ? weightConfig[matchKey] : weightConfig["DEFAULT"];
  });

  // --- 偵錯日誌：輸出最終權重與門檻數值 ---
  const debugLog = {
    lotto: lotto,
    date: dateStr,
    thresholds: {
      anomaly: anomalyMultiplier,
      severe: severeMultiplier,
      bypassCache: bypassCache,
    },
    rarity: rarityConfig,
    weightConfig: weightConfig,
  };
  Logger.log(`[PredictContext Debug] ${JSON.stringify(debugLog, null, 2)}`);

  return {
    targetData: targetData,
    historicalData,
    data,
    headers,
    dateCol,
    targetMonth: new Date(dateStr.replace(/-/g, "/")).getMonth(),
    toTime: (v) => new Date(String(v).replace(/-/g, "/")).setHours(0, 0, 0, 0),
    predTime,
    sumCol,
    s1Col,
    maxNum,
    nCols,
    lastKnownSum,
    targetSumVal,
    coeffStartIdx,
    allDataHeaders,
    validCoeffIndices,
    targetCoeffs: finalTargetCoeffs,
    avgFrequency,
    anomalyMultiplier,
    severeMultiplier,
    bypassCache,
    bypassCacheRowIdx,
    baseWeights,
    rarityConfig,
    settingsSheet,
    trObj,
  };
}

/**
 * 計算係數符號之間的距離 (支援命相學、星相學等符號比對)
 * 邏輯：若符號包含數字 (如 Phase 1) 則計算數值差；若為純符號則採等值比對。
 * @param {boolean} isHighGravityMode 是否處於高引力震盪模式，會影響化忌等凶星的權重
 */
function calculateSymbolDistance(
  v1,
  v2,
  fieldName = "",
  isHighGravityMode = false,
) {
  // --- 強化類型檢查與標準化 ---
  const ensureString = (val) => {
    if (val === null || val === undefined) return "";
    // 若不是字串則強制轉型，若是字串則進行去空白
    return typeof val === "string" ? val.trim() : String(val).trim();
  };

  const s1 = ensureString(v1);
  const s2 = ensureString(v2);

  // 全局懲罰因子：偵測「大耗」與「地劫」同時出現 (在高引力模式下懲罰加重)
  let unluckyPenalty =
    (s1.indexOf("大耗") !== -1 && s1.indexOf("地劫") !== -1) ||
    (s2.indexOf("大耗") !== -1 && s2.indexOf("地劫") !== -1)
      ? isHighGravityMode
        ? 1.8
        : 1.5
      : 1.0;
  if (isHighGravityMode) unluckyPenalty *= 1.1; // 高引力模式下所有基礎誤差小幅放大

  // 12 地支 (Zodiac/Earthly Branches) 映射
  const zodiacMap = {
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

  // 提取前綴符號以便判斷 (處理如 "子1" 或 "甲子")
  const p1_check = s1.replace(/[\d\.]+/, "").trim();
  const p2_check = s2.replace(/[\d\.]+/, "").trim();
  const isZodiacSearch =
    zodiacMap.hasOwnProperty(p1_check) && zodiacMap.hasOwnProperty(p2_check);

  // 非地支符號且完全相同，直接回傳 0
  if (s1 === s2 && !isZodiacSearch) return 0;

  // 10 天干 (Heavenly Stems) 映射
  const stemMap = {
    甲: 0,
    乙: 1,
    丙: 2,
    丁: 3,
    戊: 4,
    己: 5,
    庚: 6,
    辛: 7,
    壬: 8,
    癸: 9,
  };

  // 五行、十二執位、九星、二十八星宿、八卦 映射
  const fiveElementsMap = { 金: 0, 木: 1, 水: 2, 火: 3, 土: 4 };
  const officers = [
    "建",
    "除",
    "滿",
    "平",
    "定",
    "執",
    "破",
    "危",
    "成",
    "收",
    "開",
    "閉",
  ];
  const nineStars = ["一", "二", "三", "四", "五", "六", "七", "八", "九"];
  const trigrams = { 乾: 0, 兌: 1, 離: 2, 震: 3, 巽: 4, 坎: 5, 艮: 6, 坤: 7 };
  const mansions = [
    "角",
    "亢",
    "氐",
    "房",
    "心",
    "尾",
    "箕", // 東方青龍
    "斗",
    "牛",
    "女",
    "虛",
    "危",
    "室",
    "壁", // 北方玄武
    "奎",
    "婁",
    "胃",
    "昴",
    "畢",
    "觜",
    "參", // 西方白虎
    "井",
    "鬼",
    "柳",
    "星",
    "張",
    "翼",
    "軫", // 南方朱雀
  ];

  // 提取前綴與數字 (支援浮點數如紫微命重 4.2)
  const p1 = s1.replace(/[\d\.]+/, "").trim();
  const p2 = s2.replace(/[\d\.]+/, "").trim();
  const n1 = parseFloat(s1.match(/[\d\.]+/)?.[0]) || 0;
  const n2 = parseFloat(s2.match(/[\d\.]+/)?.[0]) || 0;

  const isZ1 = zodiacMap.hasOwnProperty(p1);
  const isZ2 = zodiacMap.hasOwnProperty(p2);
  const isS1 = stemMap.hasOwnProperty(p1);
  const isS2 = stemMap.hasOwnProperty(p2);

  // 情況 0: 處理干支組合 (如 strHourT "甲子")
  if (p1.length === 2 && p2.length === 2) {
    const s1_stem = p1[0],
      s1_branch = p1[1];
    const s2_stem = p2[0],
      s2_branch = p2[1];
    if (
      stemMap.hasOwnProperty(s1_stem) &&
      zodiacMap.hasOwnProperty(s1_branch) &&
      stemMap.hasOwnProperty(s2_stem) &&
      zodiacMap.hasOwnProperty(s2_branch)
    ) {
      return (
        unluckyPenalty *
        ((calculateSymbolDistance(
          s1_stem,
          s2_stem,
          fieldName,
          isHighGravityMode,
        ) +
          calculateSymbolDistance(
            s1_branch,
            s2_branch,
            fieldName,
            isHighGravityMode,
          )) /
          2)
      );
    }
  }

  // 情況 1: 五行 (strDayFive) - 考慮生剋
  if (
    fiveElementsMap.hasOwnProperty(p1) &&
    fiveElementsMap.hasOwnProperty(p2)
  ) {
    if (p1 === p2) return 0;
    const idx1 = fiveElementsMap[p1],
      idx2 = fiveElementsMap[p2];
    // 簡單生剋邏輯：相生距離較近 (1.0)，相剋或中性較遠 (2.0)
    const generating = [
      [1, 3],
      [3, 4],
      [4, 0],
      [0, 2],
      [2, 1],
    ]; // 木生火, 火生土...
    const isGen = generating.some(
      (pair) =>
        (pair[0] === idx1 && pair[1] === idx2) ||
        (pair[0] === idx2 && pair[1] === idx1),
    );

    // 修正：在高引力模式下，放大「非相生」關係的距離 (從 2.5 提升至 3.5)
    const baseElementDist = isGen ? 1.0 : 2.5;
    return (
      baseElementDist *
      (isHighGravityMode && !isGen ? 1.4 : 1.0) *
      unluckyPenalty
    );
  }

  // 情況 2: 週期性循環 (十二執位、九星、星宿)
  const getCycleDist = (val1, val2, list) => {
    const i1 = list.indexOf(val1),
      i2 = list.indexOf(val2);
    if (i1 === -1 || i2 === -1) return null;
    const diff = Math.abs(i1 - i2);
    return Math.min(diff, list.length - diff) / (list.length / 6); // 歸一化距離
  };

  let offDist = getCycleDist(p1, p2, officers);
  if (offDist !== null) {
    // 修正：執位在高引力模式下，若涉及「破、危、閉」等凶位，距離加重 1.5 倍
    if (
      isHighGravityMode &&
      (["破", "危", "閉"].includes(p1) || ["破", "危", "閉"].includes(p2))
    ) {
      offDist *= 1.5;
    }
    return offDist * unluckyPenalty;
  }

  let starDist = getCycleDist(p1, p2, nineStars);
  if (starDist !== null) {
    // 修正：九星在高引力模式下，涉及「二、五、七」凶星時，距離加重 1.4 倍
    if (
      isHighGravityMode &&
      (["二", "五", "七"].includes(p1) || ["二", "五", "七"].includes(p2))
    ) {
      starDist *= 1.4;
    }
    return starDist * unluckyPenalty;
  }

  let mansionDist = getCycleDist(p1, p2, mansions);
  if (mansionDist !== null) {
    if (isHighGravityMode) {
      // 二十八星宿依四神獸分類：
      // 西方白虎七宿 (奎、婁、胃、昴、畢、觜、參) 屬金，主肅殺、變動，在高引力模式下其擾動效應放大
      const whiteTiger = ["奎", "婁", "胃", "昴", "畢", "觜", "參"];
      // 其他傳統凶宿或變動宿：危 (Danger)、虛 (Void)、鬼 (Ghost)、亢 (Neck)
      const volatileMansions = ["危", "虛", "鬼", "亢"];

      if (
        whiteTiger.includes(p1) ||
        whiteTiger.includes(p2) ||
        volatileMansions.includes(p1) ||
        volatileMansions.includes(p2)
      ) {
        mansionDist *= 1.35; // 針對不穩定星宿給予 1.35x 距離修正
      }
    }
    return mansionDist * unluckyPenalty;
  }

  // 情況 3: 八卦
  if (trigrams.hasOwnProperty(p1) && trigrams.hasOwnProperty(p2)) {
    return (
      (Math.abs(trigrams[p1] - trigrams[p2]) === 4 ? 3.0 : 1.5) * unluckyPenalty
    ); // 對沖卦距離遠
  }

  // 情況 4: 紫微斗數宮位 (strp01-strp12)
  // 假設宮位資料格式為空格分隔的星曜名稱，例如 "紫微 天府 祿存"
  const ZWDS_MAJOR_STARS = new Set([
    "紫微",
    "天機",
    "太陽",
    "武曲",
    "天同",
    "廉貞",
    "天府",
    "太陰",
    "貪狼",
    "巨門",
    "天相",
    "天梁",
    "七殺",
    "破軍",
  ]);
  const ZWDS_MINOR_STARS = new Set([
    "祿存",
    "天馬",
    "左輔",
    "右弼",
    "文昌",
    "文曲",
    "天魁",
    "天鉞",
    "擎羊",
    "陀羅",
    "火星",
    "鈴星",
    "地空",
    "地劫",
    "天刑",
    "天姚",
    "陰煞",
    "孤辰",
    "寡宿",
    "蜚廉",
    "破碎",
    "華蓋",
    "咸池",
    "天喜",
    "紅鸞",
    "旬空",
    "截空",
    "龍池",
    "鳳閣",
    "台輔",
    "封誥",
    "恩光",
    "天貴",
    "三台",
    "八座",
    "龍德",
    "奏書",
    "將星",
    "攀鞍",
    "歲驛",
    "劫煞",
    "災煞",
    "天煞",
    "指背",
    "月煞",
    "亡神",
    "晦氣",
    "喪門",
    "貫索",
    "官符",
    "小耗",
    "大耗",
    "白虎",
    "天德",
    "吊客",
    "病符",
    "天狗",
  ]);

  // 兼容轉換後的中文標題
  const ZWDS_PALACES = [
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
  const isZWDSField = (field) =>
    (field.startsWith("strp") && field !== "strp13") ||
    ZWDS_PALACES.includes(field);

  const isZWDS1 =
    isZWDSField(fieldName) ||
    ZWDS_MAJOR_STARS.has(p1) ||
    ZWDS_MINOR_STARS.has(p1);
  const isZWDS2 =
    isZWDSField(s2.split(" ")[0]) ||
    ZWDS_MAJOR_STARS.has(p2) ||
    ZWDS_MINOR_STARS.has(p2);

  if (isZWDS1 && isZWDS2) {
    // 廟旺利陷權重映射：數值代表能量強度
    const brightnessMap = {
      廟: 1.3,
      旺: 1.2,
      得: 1.1,
      利: 1.0,
      平: 0.9,
      不: 0.8,
      陷: 0.5,
    };

    const parseStarMap = (palaceStr) => {
      const map = {};
      const transSuffixes = ["化祿", "化權", "化科", "化忌"];
      // 使用正則拆分星曜名稱與括號內的亮度標籤，例如 "紫微(廟)"
      palaceStr.split(/\s+/).forEach((item) => {
        const m = item.match(/^([^\(]+)(?:\((.+)\))?$/);
        if (m) {
          const fullName = m[1];
          const b = m[2];

          let name = fullName;
          let transform = null;
          // 偵測並提取四化 Suffix
          for (let suffix of transSuffixes) {
            if (fullName.endsWith(suffix)) {
              name = fullName.substring(0, fullName.length - 2);
              transform = suffix;
              break;
            }
          }

          if (ZWDS_MAJOR_STARS.has(name) || ZWDS_MINOR_STARS.has(name)) {
            map[name] = { b: brightnessMap[b] || 1.0, t: transform };
          }
        }
      });
      return map;
    };

    const starMap1 = parseStarMap(s1);
    const starMap2 = parseStarMap(s2);
    const names1 = Object.keys(starMap1);
    const names2 = Object.keys(starMap2);

    if (names1.length === 0 && names2.length === 0) return 0;
    if (names1.length === 0 || names2.length === 0) return 4.0;

    let commonMajorScore = 0;
    let commonMinorScore = 0;
    let brightnessDiff = 0;
    let uniqueNames = new Set([...names1, ...names2]);

    // 偵測凶格/煞星組合 (Clashes)
    const getClashScore = (starMap) => {
      let score = 0;
      // 六煞星：擎羊, 陀羅, 火星, 鈴星, 地空, 地劫
      const shaStars = ["擎羊", "陀羅", "火星", "鈴星", "地空", "地劫"];
      shaStars.forEach((star) => {
        if (starMap[star]) {
          // 煞星落陷 (陷=0.5) 能量更兇
          const multiplier = 2.0 - starMap[star].b;
          score += 1.2 * multiplier;
        }
      });

      // 偵測 化忌 (Hua Ji) 的衝擊
      Object.keys(starMap).forEach((name) => {
        if (starMap[name].t === "化忌") {
          // 命宮(strp01) 化忌影響力翻倍，代表本命格受阻，能量劇烈震盪
          let jiMultiplier = fieldName === "strp01" ? 4.5 : 2.2;
          // 高引力模式下，化忌的負向擾動影響力加重 1.5 倍
          if (isHighGravityMode) jiMultiplier *= 1.5;
          score += jiMultiplier * starMap[name].b; // 化忌在旺位影響力更大
        }
      });

      // 偵測 祿逢劫殺 (化祿 + 地劫 同宮) 的衝突
      Object.keys(starMap).forEach((name) => {
        const t = starMap[name].t;
        if (t === "化祿" && starMap["地劫"]) {
          score += 3.5; // 祿被截，能量劇烈震盪
        }
      });

      // 特定凶格加成 (例如：羊陀、火鈴、空劫同宮)
      if (starMap["擎羊"] && starMap["陀羅"]) score += 3.0;
      if (starMap["火星"] && starMap["鈴星"]) score += 2.0;
      if (starMap["地空"] && starMap["地劫"]) score += 2.0;

      return score;
    };

    // 偵測吉格/吉星組合 (Lucky Stars & Pairs)
    const getLuckyScore = (starMap) => {
      let score = 0;
      const voidStars = ["地空", "地劫", "旬空", "截空"];
      const hasVoid = voidStars.some((vs) => starMap[vs]);

      // 偵測 祿馬交馳 (化祿 + 天馬 同宮)
      const hasHuaLu = Object.values(starMap).some((obj) => obj.t === "化祿");
      if (hasHuaLu && starMap["天馬"]) {
        let luMaBonus = 2.0 * starMap["天馬"].b;
        // 化空判定：祿馬若遇空亡，能量減半
        if (hasVoid) luMaBonus *= 0.5;
        score += luMaBonus;
      }

      // 常見對星組合
      const luckyPairs = [
        ["左輔", "右弼"],
        ["文昌", "文曲"],
        ["天魁", "天鉞"],
        ["三台", "八座"],
        ["龍池", "鳳閣"],
        ["恩光", "天貴"],
        ["台輔", "封誥"],
      ];
      luckyPairs.forEach((pair) => {
        let pairScore = 0;
        if (starMap[pair[0]] && starMap[pair[1]]) {
          // 吉星成對且廟旺則加成更高
          const avgB = (starMap[pair[0]].b + starMap[pair[1]].b) / 2;
          pairScore = 2.5 * avgB;
        } else if (starMap[pair[0]] || starMap[pair[1]]) {
          const starObj = starMap[pair[0]] || starMap[pair[1]];
          pairScore = 0.5 * starObj.b;
        }
        // 化空判定：成對吉星若遇空亡，能量減半
        if (hasVoid) pairScore *= 0.5;
        score += pairScore;
      });

      // 偵測 化祿、化權、化科 的正向加成
      const transBonus = { 化祿: 1.8, 化權: 1.3, 化科: 1.0 };
      Object.keys(starMap).forEach((name) => {
        const t = starMap[name].t;
        if (transBonus[t]) {
          let effectiveBonus = transBonus[t];
          // 財帛宮(strp09) 化祿能量加成翻倍，代表財源穩固，軌道引力極強
          if (t === "化祿" && fieldName === "strp09") effectiveBonus *= 2.0;
          // 官祿宮(strp05) 化權能量加成翻倍，代表事業成就與職場軌道穩定性
          if (t === "化權" && fieldName === "strp05") effectiveBonus *= 2.0;
          // 父母宮(strp02) 化科能量加成翻倍，代表聲望與體制助力
          if (t === "化科" && fieldName === "strp02") effectiveBonus *= 2.0;

          // 化空判定：四化吉星若遇空亡，吉化能量減半
          const finalBonus = hasVoid ? effectiveBonus * 0.5 : effectiveBonus;
          score += finalBonus * starMap[name].b;
        }
      });
      return score;
    };

    const clash1 = getClashScore(starMap1);
    const clash2 = getClashScore(starMap2);
    const lucky1 = getLuckyScore(starMap1);
    const lucky2 = getLuckyScore(starMap2);

    names1.forEach((star) => {
      if (starMap2[star]) {
        const avgB = (starMap1[star].b + starMap2[star].b) / 2;
        if (ZWDS_MAJOR_STARS.has(star)) commonMajorScore += avgB;
        else if (ZWDS_MINOR_STARS.has(star)) commonMinorScore += avgB;

        // 計算同一顆星曜在不同日期的亮度與四化狀態差異
        let diff = Math.abs(starMap1[star].b - starMap2[star].b);
        if (starMap1[star].t !== starMap2[star].t) {
          diff += 0.6; // 四化狀態不一致視為能量性質變動
        }
        brightnessDiff += diff;
      }
    });

    // 額外獎勵：若兩者皆具備相同的吉星對 (如雙方都有 左輔+右弼)
    let comboBonus = 0;
    const auspiciousPairs = [
      ["左輔", "右弼"],
      ["文昌", "文曲"],
      ["天魁", "天鉞"],
    ];
    auspiciousPairs.forEach((pair) => {
      if (
        starMap1[pair[0]] &&
        starMap1[pair[1]] &&
        starMap2[pair[0]] &&
        starMap2[pair[1]]
      ) {
        comboBonus += 1.8; // 強力拉近相似距離
      }
    });

    // --- 新增：高引力穩定屬性 (紫微、天府) ---
    let gravityStabilityAnchor = 0;
    if (isHighGravityMode) {
      // 紫微 (星主) 與 天府 (庫星) 在高引力模式下具備穩定時空結構的能力
      const anchorStars = ["紫微", "天府"];
      anchorStars.forEach((star) => {
        if (starMap1[star] && starMap2[star]) {
          // 若雙方皆具備核心穩定星曜，則扣減距離權重，減少環境擾動產生的虛假偏差
          gravityStabilityAnchor += 1.2;
        }
      });
    }

    // 距離計算邏輯：
    // 共同主星越多，距離越近 (權重高)
    // 共同次星越多，距離越近 (權重中)
    // 能量性質差異 (Clash Score) 越大，距離越遠 (確保大凶之日與大吉之日具有顯著的相似度落差)
    // 吉星對齊度 (Lucky Score) 差異越大，距離越遠
    const baseDist = Math.max(
      0,
      uniqueNames.size -
        commonMajorScore * 1.5 -
        commonMinorScore * 0.5 -
        comboBonus -
        gravityStabilityAnchor,
    );
    const clashDist = Math.abs(clash1 - clash2);
    const luckyDist = Math.abs(lucky1 - lucky2);

    return (
      (baseDist + clashDist + luckyDist + brightnessDiff) * 0.8 * unluckyPenalty
    );
  }

  // 情況 A: 兩者皆為地支符號 (計算星相循環距離)
  if (isZ1 && isZ2) {
    const pos1 = zodiacMap[p1];
    const pos2 = zodiacMap[p2];
    const diff = Math.abs(pos1 - pos2);

    // 基礎循環距離 (0-6)
    let zodiacDist = Math.min(diff, 12 - diff);

    // 0. 三合 (Triple Harmonies) 判定：(diff 為 4 或 8)
    if (diff === 4 || diff === 8) {
      zodiacDist *= 0.7; // 給予 0.7x 距離縮減
    }

    // 1. 六合 (Six Harmonies) 判定：距離更近 (加成 0.5x)
    // 包含：子丑, 寅亥, 卯戌, 辰酉, 巳申, 午未
    if ((pos1 + pos2) % 12 === 1) {
      zodiacDist *= 0.5;
    }
    // 2. 六沖 (Six Clashes) 判定：距離更遠 (懲罰 2.0x)
    // 包含：子午, 丑未, 寅申, 卯酉, 辰戌, 巳亥 (diff 為 6)
    else if (diff === 6) {
      zodiacDist *= 2.0;
    }

    // 3. 地支相刑 (Zodiac Penalties) 判定：距離增加 (1.5x)
    const pType = getZodiacPenaltyType(v1, v2);

    if (pType !== "NONE") {
      // 若為自刑且符號完全相同，給予微小擾動距離 (0.2) 代表不穩定性，而非完全靜止的 0
      if (pos1 === pos2 && s1 === s2) zodiacDist = 0.2;
      else zodiacDist *= 1.5;
    } else if (s1 === s2) {
      zodiacDist = 0; // 無刑且相同則為 0
    }

    // 基礎地支權重 (0-6) + 數值偏移
    return (zodiacDist + Math.abs(n1 - n2) * 0.5) * unluckyPenalty;
  }

  // 情況 B: 兩者皆為天干符號 (計算五合與相沖)
  if (isS1 && isS2) {
    const pos1 = stemMap[p1];
    const pos2 = stemMap[p2];
    const diff = Math.abs(pos1 - pos2);

    // 10 循環基礎距離 (最大距離為 5)
    let stemDist = Math.min(diff, 10 - diff);

    // 1. 五合 (Five Combinations) 判定：距離更近 (加成 0.5x)
    // 包含：甲己, 乙庚, 丙辛, 丁壬, 戊癸 (diff 恆為 5)
    if (diff === 5) {
      stemDist *= 0.5;
    }
    // 2. 天干相沖 (Clashes) 判定：距離更遠 (懲罰 2.0x)
    // 包含：甲庚, 乙辛, 丙壬, 丁癸 (diff 恆為 6)
    else if (diff === 6) {
      stemDist *= 2.0;
    }
    return (stemDist + Math.abs(n1 - n2) * 0.5) * unluckyPenalty;
  }

  // 情況 C: 標籤相同但數字不同 (例如 "Phase 1" vs "Phase 3")
  if (p1 === p2 && p1 !== "") {
    return Math.abs(n1 - n2) * unluckyPenalty;
  }

  // 完全不同的符號，給予固定較大距離
  return 5 * unluckyPenalty;
} // 確保 calculateSymbolDistance 函式在此完全結束

/**
 * 判定地支相刑類型
 * @returns {string} NONE, SELF, UNCIVILIZED, UNGRATEFUL, BULLYING
 */
function getZodiacPenaltyType(v1, v2) {
  const s1 = String(v1 || "")
    .replace(/\d+/, "")
    .trim();
  const s2 = String(v2 || "")
    .replace(/\d+/, "")
    .trim();
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

  if (!zMap.hasOwnProperty(s1) || !zMap.hasOwnProperty(s2)) return "NONE";

  const pos1 = zMap[s1],
    pos2 = zMap[s2];

  // 1. 自刑 (辰午酉亥)
  if (pos1 === pos2 && [4, 6, 9, 11].includes(pos1)) return "SELF";

  // 2. 無禮之刑 (子卯)
  if ((pos1 === 0 && pos2 === 3) || (pos1 === 3 && pos2 === 0))
    return "UNCIVILIZED";

  // 3. 恃勢之刑 (丑戌未三刑)
  if ([1, 7, 10].includes(pos1) && [1, 7, 10].includes(pos2) && pos1 !== pos2)
    return "BULLYING";

  // 4. 無恩之刑 (寅巳申三刑)
  if ([2, 5, 8].includes(pos1) && [2, 5, 8].includes(pos2) && pos1 !== pos2)
    return "UNGRATEFUL";

  return "NONE";
}

/**
 * 計算和值振幅百分位數
 */
function calculateAmpPercentile(amplitudes, targetSum, lastSum) {
  const currentAmp = Math.abs(targetSum - lastSum);
  const sortedAmps = [...amplitudes].sort((a, b) => a - b);
  const ampRank = sortedAmps.filter((v) => v < currentAmp).length;
  return ((ampRank / (sortedAmps.length || 1)) * 100).toFixed(1);
}

/**
 * 計算兩個字串的相似度 (基於 Levenshtein Distance)
 * @returns {number} 0 ~ 1 之間的相似度得分
 */
function calculateStringSimilarity(s1, s2) {
  if (s1 === s2) return 1.0;
  const len1 = s1.length,
    len2 = s2.length;
  if (len1 === 0 || len2 === 0) return 0.0;

  const matrix = Array.from({ length: len1 + 1 }, (_, i) => [i]);
  for (let j = 0; j <= len2; j++) matrix[0][j] = j;

  for (let i = 1; i <= len1; i++) {
    for (let j = 1; j <= len2; j++) {
      const cost = s1[i - 1] === s2[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + cost,
      );
    }
  }
  const distance = matrix[len1][len2];
  return 1.0 - distance / Math.max(len1, len2);
}

/**
 * 封裝環境感應參數計算邏輯 (Private Utility)
 * 根據歷史震盪百分比計算各項修正係數與過濾門檻
 * @param {string} lotto 彩種，用於定義差異化閾值
 * @param {Object} rarityConfig 從試算表解析出的稀有度配置
 * @param {Object} lwStats 命重統計資訊 (currentLw, avgLw, stdDevLw)
 */
function getEnvironmentSensingParams(
  amplitudes,
  targetSum,
  lastSum,
  lotto,
  rarityConfig,
  lwStats,
  targetCoeffs,
  allDataHeaders,
) {
  const ampStr = calculateAmpPercentile(amplitudes, targetSum, lastSum);
  const ampVal = parseFloat(ampStr);

  // --- 優化：不同彩種的震盪敏感度配置 ---
  const lottoThresholds = {
    L539: { low: 15, high: 85 }, // 每日開獎，維持標準靈敏度
    L649: { low: 20, high: 80 }, // 樣本稀疏，提早觸發環境防禦 (較保守)
    L638: { low: 10, high: 90 }, // 第一區號碼較少，僅在極端震盪時切換模式
    LSix: { low: 15, high: 85 },
    DEFAULT: { low: 15, high: 85 },
  };

  const config = lottoThresholds[lotto] || lottoThresholds["DEFAULT"];

  // --- 命重異常偵測 (高引力震盪邏輯) ---
  let isHighGravityMode = false; // 標記是否進入高引力模式
  let gravityInertiaBoost = 1.0; // 高引力模式下的慣性加成
  let isOctaveResonance = false; // 標記是否進入倍頻共振模式
  let lwZScore = 0; // 命重 Z-Score
  if (lwStats && lwStats.currentLw !== null && lwStats.avgLw !== null) {
    lwZScore = lwStats.lwZScore; // 直接使用傳入的 Z-score
    if (lwZScore > 2.2) {
      isHighGravityMode = true;
      gravityInertiaBoost = 1.35; // 進入高引力模式，慣性加成提升 35%
    }
  }

  // --- 新增：命重與日九星倍頻共振強化連莊權重 ---
  let resonanceBoost = 1.0;
  const nineStarIdx = (allDataHeaders || []).findIndex((h) => h === "日九星"); // 修復重複宣告與潛在 undefined 錯誤
  if (nineStarIdx !== -1 && targetCoeffs && targetCoeffs[nineStarIdx]) {
    const nineStarValStr = String(targetCoeffs[nineStarIdx]).trim();
    const nineStarsMap = {
      一: 1,
      二: 2,
      三: 3,
      四: 4,
      五: 5,
      六: 6,
      七: 7,
      八: 8,
      九: 9,
    };
    const nineStarNum = nineStarsMap[nineStarValStr];

    // 定義「倍頻共振」條件：命重 Z-score 中度偏離 (>1.5) 且日九星處於極端位置 (1,2,8,9)
    if (
      lwZScore > 1.5 &&
      nineStarNum &&
      (nineStarNum <= 2 || nineStarNum >= 8)
    ) {
      resonanceBoost = 1.2; // 額外強化 20% 連莊權重
    }
  }

  // 定義連莊修正係數：低震盪增加慣性，高震盪抑制預期
  let repeatModifier =
    ampVal < config.low ? 1.25 : ampVal > config.high ? 0.75 : 1.0;
  repeatModifier *= gravityInertiaBoost; // 疊加引力修正
  repeatModifier *= resonanceBoost; // 疊加倍頻共振修正

  // 定義稀有定義門檻：高震盪放寬捕捉冷號，低震盪聚焦極端冷號
  const rarityThresholdMultiplier =
    ampVal > config.high ? 1.2 : ampVal < config.low ? 0.8 : 1.0;
  const rareNormalization = 1.2 * rarityThresholdMultiplier;

  // 定義隔期捕捉深度：高震盪擴大偵測範圍
  const skipDepth = ampVal > config.high ? 2 : 1;
  const skipNormalization = skipDepth === 2 ? 2.2 : 1.5;

  return {
    ampPercentile: ampStr,
    ampVal_num: ampVal,
    isHighGravityMode,
    isOctaveResonance,
    repeatModifier,
    rarityThresholdMultiplier,
    rareNormalization,
    skipDepth,
    skipNormalization,
    // 再次確保屬性完整，避免傳入 partial object
    rarityConfig: {
      cap: 1.5,
      missThres: 10,
      missWeight: 0.05,
      ...rarityConfig,
    },
  };
}
