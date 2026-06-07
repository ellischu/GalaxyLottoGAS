/** 演算法邏輯版本：當修改 corePredict 權重或公式後，請遞增此版本號以自動失效舊快取 */
const PRCT1_ALGO_VERSION = "A147"; // 實作紫微共振能量歸一化與顯示精度優化

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
      "Asia/Taipei",
      "yyyy-MM-dd",
    );
    // --- 核心優化：強化日期與標頭比對之魯棒性 ---
    const adHeaders = adDataAll[0].map((h) => String(h || "").trim());
    let targetIdx = -1;
    let fallbackIdx = -1;

    // 取得目標日期的標準時間數值 (排除時分秒)
    const targetTimeVal = targetDate.getTime();

    for (let i = adDataAll.length - 1; i >= 1; i--) {
      let rowDate = adDataAll[i][0];
      // 略過空值或無效日期，防止 fallbackIdx 被誤導至 1970 年的空白行
      if (!rowDate || (rowDate instanceof Date && isNaN(rowDate.getTime())))
        continue;

      if (!(rowDate instanceof Date)) rowDate = new Date(rowDate);
      const rowTimeVal = rowDate.setHours(0, 0, 0, 0);
      if (isNaN(rowTimeVal) || rowTimeVal <= 0) continue;

      const rowDateStr = Utilities.formatDate(
        rowDate,
        "Asia/Taipei",
        "yyyy-MM-dd",
      );

      // 1. 精確日期比對
      if (rowDateStr === targetDateStrFormatted) {
        targetIdx = i;
        break;
      }
      // 2. 遞補比對
      if (rowTimeVal < targetTimeVal && fallbackIdx === -1) {
        fallbackIdx = i;
      }
    }

    let isUsingFallbackEnv = false;
    if (targetIdx === -1 && fallbackIdx !== -1) {
      targetIdx = fallbackIdx;
      isUsingFallbackEnv = true;
      Logger.log(
        `[Env Fallback] 找不到 ${targetDateStrFormatted} 的精確參數，遞補使用 ${Utilities.formatDate(adDataAll[fallbackIdx][0], "Asia/Taipei", "yyyy-MM-dd")} 的資料。`,
      );
    }

    // --- 新增：當檢索完全失敗時的 Debug 資訊輸出 ---
    if (targetIdx === -1) {
      const lastRow = adDataAll[adDataAll.length - 1];
      const lastDateVal = lastRow ? lastRow[0] : "空表或無資料";
      Logger.log(
        `[Critical Debug] targetIdx 搜尋失敗。目標日期: ${targetDateStrFormatted}, AllData 最後一列日期值: ${lastDateVal}, 類型: ${typeof lastDateVal}, 是否為 Date 物件: ${lastDateVal instanceof Date}`,
      );
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
        Utilities.formatDate(row[0], "Asia/Taipei", "yyyy-MM-dd") ===
          targetDateStrFormatted
      );
    });

    // 修正：AllData (adRow) 結構與 All 不同，不可直接用於 actualNums 比對
    const isTodayDrawn = !!todayActualInAll;

    // 1.1 提取詳細環境數據 (adHeaders 已於上方進行 trim 處理)
    const fieldMapping = getFieldMapping();
    const idMapping = getIDMapping();
    const envDetails = [];

    if (adRow && adRow.length > 0) {
      adHeaders.forEach((header, idx) => {
        const hStr = String(header).trim();
        if (
          idx === 0 ||
          hStr.indexOf("號") === 0 ||
          hStr === "特1" ||
          hStr === "S1" ||
          ["Sum", "總合", "期數", "序號", "命重"].includes(hStr) ||
          hStr.match(/^[LNS]\d+$/)
        )
          return;

        const rawVal = adRow[idx];
        const prevVal = prevAdRow ? prevAdRow[idx] : rawVal;
        const isChanged = String(rawVal) !== String(prevVal);

        // --- 核心優化：針對 年/月/日 干支給予不同的變動權重 ---
        let fieldWeight = 1.0;
        if (hStr.indexOf("日") === 0) fieldWeight = 2.5; // 日級參數變動最重要 (日干, 日支, 日形...)
        if (hStr.indexOf("月") === 0) fieldWeight = 1.5; // 月級參數次之
        if (hStr.indexOf("年") === 0) fieldWeight = 0.5; // 年級參數為背景
        if (hStr === "本命") fieldWeight = 2.0; // 本命宮位重要性高

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

    // --- 新增：環境參數變動雷達 ---
    let radarMsg = "";
    if (changeRatio > 0.7) {
      radarMsg = `🌀 星系能量重組日 (變動率: ${(changeRatio * 100).toFixed(1)}%)`;
      Logger.log(`[Environmental Radar] ${targetDateStrFormatted} ${radarMsg}`);
    }

    // 偵測年日關係 (相沖 vs 六合)
    const yearStem = envDetails.find((d) => d.id === "年天干")?.value || "";
    const yearBranch = envDetails.find((d) => d.id === "年地支")?.value || "";
    const monthBranch = envDetails.find((d) => d.id === "月地支")?.value || "";
    const dayBranch = envDetails.find((d) => d.id === "日地支")?.value || "";
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
              Math.max(0, trainingCutoffIdx - 250), // 擴大抓取範圍至 250 期，預留 AI 窗口進化空間
              trainingCutoffIdx + 1,
            )
          : [];

      // --- 核心優化：資料完整性檢查 ---
      const validation = validatePrct1TrainingData(trainingData, config);
      const validatedData = validation.validData;
      const isDataLowQuality = validation.isLowQuality;

      // --- 核心修正：實作和值引力位移趨勢與分佈數據 (Z-Score) ---
      const sumGravityTrend = validatedData.slice(-40).map((row) => {
        const rowSum = row
          .slice(1, config.ballCount + 1)
          .map(Number)
          .reduce((a, b) => a + b, 0);
        return parseFloat(
          ((rowSum - config.theorySum) / (config.stdDev || 1)).toFixed(2),
        );
      });

      // 統計 SD 區間分佈熱力數據，劃分為 -3 至 +3 標準差區間
      const sumHeatmap = [0, 0, 0, 0, 0, 0, 0];
      sumGravityTrend.forEach((z) => {
        const bucket = Math.min(6, Math.max(0, Math.round(z) + 3));
        sumHeatmap[bucket]++;
      });

      // --- 新增：異常震盪自動標註邏輯 ---
      const lastZScore =
        sumGravityTrend.length > 0
          ? sumGravityTrend[sumGravityTrend.length - 1]
          : 0;
      let gravityStatus = "穩定";
      if (Math.abs(lastZScore) >= 2.0) gravityStatus = "極端震盪";
      else if (Math.abs(lastZScore) >= 1.0) gravityStatus = "震盪預警";

      // 計算均值回歸機率
      const meanReversionProb =
        calculateMeanReversionProbability(sumGravityTrend);

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

      // --- 強化：廣域星辰與宮位數據提取 (含紫微、時柱、九星、宿、掛等) ---
      const ziWeiData = [];
      const cosmicFields = [
        { id: "strp01", name: "本命" },
        { id: "strp02", name: "父母" },
        { id: "strp03", name: "福德" },
        { id: "strp04", name: "田宅" },
        { id: "strp05", name: "官祿" },
        { id: "strp06", name: "奴僕" },
        { id: "strp07", name: "遷移" },
        { id: "strp08", name: "疾厄" },
        { id: "strp09", name: "財帛" },
        { id: "strp10", name: "子女" },
        { id: "strp11", name: "夫妻" },
        { id: "strp12", name: "兄弟" },
        // 新增：星辰與時空欄位
        { id: "strHourT", name: "時柱" },
        { id: "strDayFive", name: "日五形" },
        { id: "strDayTwelve", name: "日十二建除" },
        { id: "strDayNine", name: "日九星" },
        { id: "strDayTwentyEight", name: "日二十八星宿" },
        { id: "strHourTwentyEight", name: "時二十八星宿" },
        { id: "strDayEight", name: "日八掛" },
      ];

      cosmicFields.forEach((field) => {
        const name = field.name;
        const idStandard = field.id;

        // 產生可能的 ID (針對 strp 系列的相容性處理)
        let idAlt = "";
        if (idStandard.startsWith("strp")) {
          const numPart = parseInt(idStandard.replace("strp", ""));
          idAlt = "strp0" + numPart;
        }

        // 優先搜尋中文欄位名稱，若無則搜尋 ID
        let idxInAll = allHeaders.findIndex((h) => {
          const s = String(h || "").trim();
          return s === name || s === idStandard || (idAlt && s === idAlt);
        });

        let val = "";
        // 尋找 AllData (主表) 中的對應參數
        let idxInAd = adHeaders.findIndex((h) => {
          const s = String(h || "").trim();
          return s === name || s === idStandard || (idAlt && s === idAlt);
        });
        if (idxInAd !== -1 && adRow) val = String(adRow[idxInAd]);

        if (idxInAll !== -1 && val) {
          ziWeiData.push({
            id: idStandard,
            name: name,
            val: val,
            idx: idxInAll,
          });
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

      // --- 提前計算歷史期數數據以便 checkHits 使用 ---
      const lastDrawNums =
        validatedData.length >= 1
          ? validatedData[validatedData.length - 1]
              .slice(1, config.hasS1 ? 8 : 6)
              .map(Number)
              .filter((n) => n > 0)
          : [];
      const prevDrawNums =
        validatedData.length >= 2
          ? validatedData[validatedData.length - 2]
              .slice(1, config.hasS1 ? 8 : 6)
              .map(Number)
              .filter((n) => n > 0)
          : [];

      // 執行強化版命中檢查
      const hitDetail = checkHits(
        resultNumbers,
        todayActualInAll,
        lotto,
        lastDrawNums,
        prevDrawNums,
      );

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
      let remarks = isS1Hit
        ? `🎯 特別號命中！摘要: ${changedParamsSummary}`
        : "";

      if (radarMsg) remarks = (remarks ? remarks + " | " : "") + radarMsg;

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
              "Asia/Taipei",
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
        isUsingFallbackEnv: isUsingFallbackEnv, // 告知前端是否使用了遞補數據
        freqAvg: predResult.avg,                 // 核心修正：補齊球號頻率平均值
        freqStdDev: predResult.freqStdDev,       // 核心修正：補齊球號頻率標準差
        sumGravityTrend: sumGravityTrend, // 和值位移趨勢 (Z-Score 序列)
        sumHeatmap: sumHeatmap, // 和值分佈熱力 (區間計數)
        gravityStatus: gravityStatus, // 引力震盪狀態
        meanReversionProb: meanReversionProb, // 均值回歸機率 (%)
        lotto: lotto, // 供前端按鈕識別
        hotTails: predResult.hotTails,
        learnedWeights: predResult.learnedWeights,
        ziWeiMatchCount: predResult.ziWeiMatchCount,
        ziWeiHouseDetails: predResult.ziWeiHouseDetails, // 核心修正：補齊回傳屬性
        dataQualityWarning: isDataLowQuality, // 新增：資料品質警告標籤
        balanceStats: getBalanceStats(resultNumbers, lotto),
        lastDrawNums: lastDrawNums,
        prevDrawNums: prevDrawNums,
        hitSummary: hitDetail.summary,
        // 增加：繼承狀態資訊供前端面板使用
        weightMetadata: getPrediction1WeightSettings(lotto),
        hitStats: { repeat: hitDetail.repeatHits, skip: hitDetail.skipHits },
      };
      return finalResult;
    } catch (err) {
      let errorPos = "";
      const currentAppVer =
        typeof getCacheVersion === "function" ? getCacheVersion() : "Unknown";
      if (err instanceof ReferenceError) {
        const stackLines = err.stack.split("\n");
        errorPos = " (位置: " + (stackLines[1] || "未知行號") + ")";
      }
      const verInfo = ` [Ver: ${currentAppVer} | Algo: ${PRCT1_ALGO_VERSION}]`;
      // 強化：將詳細錯誤記錄至伺服器日誌
      logSystemError("Prediction1_Server", err.toString(), "ERROR", "", {
        lotto: lotto,
        algoVer: PRCT1_ALGO_VERSION,
        appVer: currentAppVer,
      });
      return {
        success: false,
        error: "預測執行失敗: " + err.message + errorPos + verInfo,
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
      const ss = trObj.spreadsheet;
      const learnedWeights = getLearnedBaseWeights(lotto, ss);
      const windowSize = Math.round(learnedWeights.observationWindow || 60);

      const allSheet = trObj.spreadsheet.getSheetByName("All");
      if (!allSheet) return;

      const allDataRaw = allSheet
        .getDataRange()
        .getValues()
        .filter((row) => row[0] instanceof Date);
      if (allDataRaw.length < windowSize) return;

      const trainingData = allDataRaw.slice(-windowSize);
      const lastDrawDate = Utilities.formatDate(
        new Date(trainingData[trainingData.length - 1][0]),
        "GMT+8",
        "yyyyMMdd",
      );
      const cacheKey = `${PRCT1_ALGO_VERSION}_W${windowSize}_STATS_${lotto}_${lastDrawDate}`;
      const missCacheKey = `${PRCT1_ALGO_VERSION}_W${windowSize}_MISS_${lotto}_${lastDrawDate}`;

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
          weights: calculateMissWeights(missData, lotto, null),
          stats: calculateMissStandardDeviation(
            missData,
            lotto,
            missStartIdx,
            null,
          ),
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
        `[Cache Preload] 成功為 ${lotto} 預載 W${windowSize} 快取 (${lastDrawDate})`,
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

  // 與 calculateStats 邏輯對齊：區分主球數與含特別號之有效總球數
  const mainBallCount = config.ballCount;
  const effectiveBallCount =
    mainBallCount + (lotto !== "L539" && config.hasS1 ? 1 : 0);

  const actualNums = actual
    .slice(1, effectiveBallCount + 1)
    .map(Number)
    .filter((n) => n > 0);
  const hits = predicted.filter((n) => {
    const val = typeof n === "object" ? Number(n.number) : Number(n);
    return actualNums.includes(val);
  }).length;
  return (hits / mainBallCount).toFixed(4);
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
  if (!data || !Array.isArray(data))
    return { validData: [], isLowQuality: false };
  const originalLength = data.length;
  const validData = data.filter((row) => {
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

  // 計算過濾掉的資料比例
  const filteredCount = originalLength - validData.length;
  const isLowQuality =
    originalLength > 0 ? filteredCount / originalLength > 0.2 : false;

  return { validData: validData, isLowQuality: isLowQuality };
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

    // --- 核心修正：套用進化式觀察窗口 ---
    const windowSize = Math.round(learnedWeights.observationWindow || 60);
    const activeTrainingData = trainingData.slice(-windowSize);

    const lpFactor = learnedWeights.metaBoostLifePalace || 0.08;

    // --- 效能優化：實作 PropertiesService 大數據快取機制 (全彩種支援) ---
    let stats = null;
    let isFromCache = false;
    const lastDrawDate =
      activeTrainingData.length > 0
        ? Utilities.formatDate(
            new Date(activeTrainingData[activeTrainingData.length - 1][0]),
            "Asia/Taipei",
            "yyyyMMdd",
          )
        : "NODATA";
    // 利用版本號作為 Key 前綴，確保清理快取(Bust Cache)時能同步失效
    // 關鍵：快取 Key 必須包含 windowSize，確保窗口變動時統計同步更新
    const cacheKey = `${PRCT1_ALGO_VERSION}_W${windowSize}_STATS_${lotto}_${lastDrawDate}`;

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
      stats = calculateStats(activeTrainingData, lotto, targetDate.getTime());
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
    if (ziWeiData && ziWeiData.length > 0) {
      const sourceForLp = allDataFull || activeTrainingData;
      const targetTime = targetDate.getTime();

      // 核心修正：從學習結果中取得各宮位共振權重，若無則使用系統初始值
      const houseWeightMap = learnedWeights.houseWeights;

      // --- 效能優化：改用單次遍歷分配法，取代嵌套過濾 ---
      const houseMatches = {};
      ziWeiData.forEach(
        (h) =>
          (houseMatches[h.idx] = {
            val: String(h.val),
            rows: [],
            name: h.name,
            weight: houseWeightMap[h.name] || 1.0,
          }),
      );

      sourceForLp.forEach((row) => {
        // 強制正規化時間戳記，確保嚴格排除包含 targetDate 在內的未來資料
        const rowTime = new Date(row[0]).setHours(0, 0, 0, 0);
        if (rowTime >= targetTime) return;

        ziWeiData.forEach((h) => {
          if (String(row[h.idx]) === houseMatches[h.idx].val) {
            houseMatches[h.idx].rows.push(row);
          }
        });
      });

      ziWeiData.forEach((house) => {
        const hInfo = houseMatches[house.idx];
        const matchedRows = hInfo.rows.slice(-windowSize);

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
            const resonanceContribution = timeDecayWeight * hInfo.weight;
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

    // --- 新增：環境共振奇點 (Environmental Resonance Singularity) ---
    // 針對「日十二建除」與「日九星」的特定組合實作額外權重引力
    const dayZhi = ziWeiData.find(d => d.name === "日十二建除")?.val || "";
    const dayStar = ziWeiData.find(d => d.name === "日九星")?.val || "";
    let singularityBoost = 1.0;

    // 奇點 A：星系大開 (開 + 8白) -> 全體權重活躍度提升
    if (dayZhi === "開" && dayStar === "8白") singularityBoost = 1.15;
    // 奇點 B：能量清洗 (除 + 6白) -> 針對冷門反彈加成提升
    else if (dayZhi === "除" && dayStar === "6白") singularityBoost = 1.12;
    // 奇點 C：規律重塑 (建 + 1白) -> 基礎頻率影響力提升
    else if (dayZhi === "建" && dayStar === "1白") singularityBoost = 1.10;

    if (singularityBoost > 1.0) {
      Logger.log(`[Singularity] 偵測到時空共振奇點: ${dayZhi}+${dayStar}, 增益: ${singularityBoost}x`);
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
    activeTrainingData.slice(-15).forEach((row) => {
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
      const elementWeights = learnedWeights.elementWeights || {};
      let metaBoost = 1.0;

      // 年度五行共振 (動態調整機制)
      if (luckyDigits.includes(lastDigit)) {
        const dynamicYearBoost = elementWeights[targetElement] || learnedWeights.metaBoostYear;
        metaBoost *= (1 + dynamicYearBoost * envSensitivity);
      }

      // 熱門尾數加權 (1.06x)
      // 套用奇點修正：星系大開時尾數引力增強
      if (hotTails.includes(lastDigit)) {
        metaBoost *= (1.06 * (singularityBoost > 1.1 ? 1.04 : 1.0));
      }

      // 三合局噴發加權 (1.5x)
      if (isTripleActive && tripleLuckyDigits.includes(lastDigit)) {
        metaBoost *= 1 + learnedWeights.metaBoostTriple * envSensitivity;
      }

      // --- 新增：位置回歸限制器 (依據各柱平均值修正偏離過遠的權重) ---
      applyPositionLimiter(
        num,
        finalWeights,
        stats.columnMeans,
        learnedWeights.posSevereThres,
        learnedWeights.posNormalThres,
        learnedWeights.posSevereFactor,
        learnedWeights.posNormalFactor,
        stats, // 傳入 stats 以便進行標籤預判，減少衝突
      );

      finalWeights[num] *= metaBoost;

      // --- 新增：黃金分割過濾器 (Golden Ratio Filter) ---
      applyGoldenRatioFilter(num, finalWeights, config);

      // --- 新增：紫微共振增益 (結合十二宮位歷史頻率) ---
      const ziWeiScore = ziWeiFreq[num] || 0;
      if (ziWeiScore > 0) {
        // 核心修正：引入「共振能量歸一化 (Resonance Normalization)」
        // 由於共振欄位已擴展至 19 個，原始積分會過高。
        // 透過除以基數 5，將增益拉回與原本 2 宮位時期相當的物理區間，確保權重穩定。
        const normalizedResonance = ziWeiScore / 5;
        finalWeights[num] *= 1 + normalizedResonance * lpFactor;
      }
    });

    // --- 數據分析師優化：執行環境平衡因子 (移出迴圈，僅執行一次以確保邏輯正確並提升效能) ---
    applyAnalystFilters(finalWeights, lotto, activeTrainingData);

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
            const rowDate = new Date(row[0]);
            return (
              rowDate &&
              !isNaN(rowDate.getTime()) &&
              rowDate.getTime() < targetTime
            );
          })
          .slice(-60);
        missPackage = {
          weights: calculateMissWeights(missData, lotto, targetTime),
          stats: calculateMissStandardDeviation(
            missData,
            lotto,
            missStartIdx,
            targetTime,
          ),
          lastRow: missData[missData.length - 1],
        };
      }

      const missWeights = missPackage.weights;
      const missStats = missPackage.stats;
      const lastMissRow = missPackage.lastRow || [];

      Object.keys(finalWeights).forEach((num) => {
        // 核心修正：將遺漏值修正佔比由 20% 提升至 25%，補償時間衰減後的數值縮減
        finalWeights[num] =
          finalWeights[num] * 0.75 + (missWeights[num] || 0) * 0.2;

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
      avg: stats.avg,
      freqStdDev: stats.freqStdDev,
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
 * 黃金分割過濾器：根據彩種理論期望值 (theorySum) 計算黃金分割位點並加權
 */
function applyGoldenRatioFilter(num, weights, config) {
  const n = parseInt(num);
  const theorySum = config.theorySum;
  const maxNum = config.maxNum;

  // 根據理論期望值計算關鍵黃金分割位點 (Galaxy Structural Nodes)
  // 這些位點代表了星系組合在數學上的最優美平衡點
  const goldHigh = theorySum * 0.618;
  const goldLow = theorySum * 0.382;

  // 將位點映射回號碼範圍 (1 ~ maxNum)
  // 若位點超過最大號碼，則採週期性回歸 (Modulo) 以尋找次級共振點
  const node1 = Math.round(goldHigh % maxNum) || maxNum;
  const node2 = Math.round(goldLow % maxNum) || maxNum;

  // 若球號接近黃金分割節點 (距離 1 以內)，給予 6% 的「結構共振」加成
  if (Math.abs(n - node1) <= 1 || Math.abs(n - node2) <= 1) {
    weights[num] *= 1.06;
  }

  // 精確命中節點時，額外疊加 2% 的「星系奇點」增益
  if (n === node1 || n === node2) {
    weights[num] *= 1.02;
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
  stats = null, // 新增：統計資訊用於緩解標籤衝突
) {
  if (!columnMeans || columnMeans.length === 0) return;
  const n = parseInt(num);
  const cMeans = columnMeans.map(Number);

  // 找出該號碼與最近的柱位平均值之距離
  const minDist = Math.min(...cMeans.map((m) => Math.abs(n - m)));

  // 衝突緩解邏輯：如果該號碼在歷史上處於「過熱」狀態，
  // 則說明該號碼具備打破規律的強動能，應適度放寬位置限制的懲罰。
  // 這能確保標籤顯示「過熱」時，該球號不至於因位置偏離而被過度壓制排名。
  let effectiveSevereFactor = severeFactor;
  let effectiveNormalFactor = normalFactor;

  if (stats && stats.avg > 0) {
    const freq = stats.frequency[num] || 0;
    if (freq > stats.avg * 1.35) {
      // 與 generateLabels 判定門檻保持同步
      effectiveSevereFactor = 1 - (1 - severeFactor) * 0.5; // 懲罰力度減半
      effectiveNormalFactor = 1 - (1 - normalFactor) * 0.5;
    }
  }

  // --- 根據動態門檻與動態降權係數修正權重 ---
  if (minDist > severeThres) {
    weights[num] *= effectiveSevereFactor;
  } else if (minDist > normalThres) {
    weights[num] *= effectiveNormalFactor;
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
function calculateStats(data, type, targetTime) {
  const config = getPrct1LottoConfig(type);

  // 核心修正：強制進行日期過濾，確保統計數據 (含連莊率 sets 陣列) 不包含 targetTime (含) 以後的資料
  const safeData = data.filter((row) => {
    if (!targetTime) return true;
    const rowTime = new Date(row[0]).setHours(0, 0, 0, 0);
    return rowTime < targetTime;
  });

  const effectiveBallCount =
    config.ballCount + (type !== "L539" && config.hasS1 ? 1 : 0);
  const mainBallCount = config.ballCount; // 明確區分主球數量，用於總和與柱位統計

  const freq = {},
    repeats = {},
    skips = {};
  const sumHistory = [];
  const colSums = new Array(mainBallCount).fill(0);
  let validRows = 0;

  for (let i = 1; i <= config.maxNum; i++) {
    freq[i] = 0;
    repeats[i] = 0;
    skips[i] = 0;
  }

  // 1. 將每一期轉換為 Set 並計算柱位平均與總和歷史
  const sets = safeData.map((row) => {
    const mainRange = row
      .slice(1, mainBallCount + 1)
      .map(Number)
      .filter((n) => n > 0);

    if (mainRange.length === mainBallCount) {
      mainRange.forEach((n, idx) => {
        colSums[idx] += n;
      });
      // 核心修正：確保總和計算僅包含主球，不受特別號納入頻率統計 (effectiveBallCount) 的影響
      sumHistory.push(mainRange.reduce((sum, n) => sum + n, 0));
      validRows++;
    }

    // 頻率與連莊統計則包含特別號 (若有)，以計算精確的共振引力
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

  // --- 核心修正：計算各統計維度的權重補償係數 ---
  // 1. 頻率總權重 (基準)
  const totalWeightSum = Math.max(
    1.0,
    decayWeights.reduce((a, b) => a + b, 0),
  );
  // 2. 連莊有效權重 (從索引 1 開始)
  const repeatWeightSum =
    sets.length > 1
      ? decayWeights.slice(1).reduce((a, b) => a + b, 0)
      : totalWeightSum;
  // 3. 隔期有效權重 (從索引 2 開始)
  const skipWeightSum =
    sets.length > 2
      ? decayWeights.slice(2).reduce((a, b) => a + b, 0)
      : totalWeightSum;

  // 補償係數：用於將較短觀測期的權重總量歸一化到與頻率相同尺度
  const repeatMultiplier = totalWeightSum / (repeatWeightSum || 1);
  const skipMultiplier = totalWeightSum / (skipWeightSum || 1);

  sets.forEach((currentSet, i) => {
    const timeDecayWeight = decayWeights[i];

    currentSet.forEach((num) => {
      if (num < 1 || num > config.maxNum) return;
      freq[num] += 1 * timeDecayWeight;

      // 統計連莊 (套用補償係數：補足因第一期無法計算連莊而損失的權重)
      if (i > 0 && sets[i - 1].has(num))
        repeats[num] += 1 * timeDecayWeight * repeatMultiplier;

      // 統計隔期跳 (套用補償係數)
      if (i > 1 && sets[i - 2].has(num) && !sets[i - 1].has(num))
        skips[num] += 1 * timeDecayWeight * skipMultiplier;
    });
  });

  // --- 核心修正：計算球號頻率的分佈標準差 (freqStdDev) ---
  // 用於提供更科學的「過熱/過冷」判定門檻
  let varianceSum = 0;
  const avgFreq = (totalWeightSum * effectiveBallCount) / (config.maxNum || 1);
  for (let i = 1; i <= config.maxNum; i++) {
    varianceSum += Math.pow(freq[i] - avgFreq, 2);
  }
  const freqStdDev = Math.sqrt(varianceSum / config.maxNum) || 0.1;

  return {
    frequency: freq,
    repeats: repeats,
    skips: skips,
    avg: avgFreq,
    freqStdDev: freqStdDev, // 新增：供標籤判定使用
    columnMeans: columnMeans,
    avgAmp: avgAmp.toFixed(1),
  };
}

/**
 * Z-Score 歷史分佈統計：預測下一期回歸中值的機率
 * 分析當前震盪狀態與「位移速率 (Velocity)」，判斷動能是否耗盡並預測回歸機率
 */
function calculateMeanReversionProbability(zTrend) {
  if (!zTrend || zTrend.length < 15) return 50;

  const lastZ = zTrend[zTrend.length - 1];
  const prevZ = zTrend[zTrend.length - 2];
  const lastV = lastZ - prevZ; // 當前位移速率 (速度為正代表向上偏離，速度為負代表向下修正)

  // 若目前已經非常接近中值 (|Z| < 0.5)，則回歸動力不顯著，預設為 50%
  if (Math.abs(lastZ) < 0.5) return 50;

  let weightedOccasions = 0;
  let weightedReversions = 0;

  // 掃描歷史趨勢，尋找與當前偏移方向相似的樣本
  for (let i = 1; i < zTrend.length - 1; i++) {
    const current = zTrend[i];
    const prev = zTrend[i - 1];
    const next = zTrend[i + 1];
    const currV = current - prev;

    // 1. 基礎匹配：判定當前點偏離方向與最後一期是否一致且具有強度
    const isSameDirection =
      (lastZ > 0.5 && current > 0.5) || (lastZ < -0.5 && current < -0.5);

    if (isSameDirection) {
      // 2. 位移速率加權 (Velocity Weighting)：
      // 若歷史樣本的位移速度方向與當前一致，賦予更高權重 (1.5x)，這能更精確地模擬動能狀態
      const vWeight = lastV * currV > 0 ? 1.5 : 0.5;

      weightedOccasions += vWeight;
      // 定義「回歸」：下一期數值絕對值減小，或直接發生正負反轉
      if (Math.abs(next) < Math.abs(current) || current * next <= 0) {
        weightedReversions += vWeight;
      }
    }
  }

  if (weightedOccasions === 0) return lastZ > 2.0 || lastZ < -2.0 ? 75 : 50;

  let prob = Math.round((weightedReversions / weightedOccasions) * 100);

  // --- 位移速率直接修正 (Momentum vs Braking) ---
  // 若 Z 為正且 V 為負，或 Z 為負且 V 為正 -> 代表已經開始減速或「回頭」，回歸機率大增
  const isDecelerating = (lastZ > 0 && lastV < 0) || (lastZ < 0 && lastV > 0);
  const velocityMag = Math.abs(lastV);

  if (isDecelerating) {
    // 已經偵測到轉折訊號，額外提升回歸信心
    prob += Math.min(15, velocityMag * 10);
  } else {
    // 還在加速偏離中，動能強勁，調降回歸預期
    prob -= Math.min(10, velocityMag * 8);
  }

  // 加上物理引力係數 (偏離中心越遠，強制拉力越強)
  const gravityBias = Math.min(25, Math.abs(lastZ) * 10);
  return Math.min(95, Math.max(5, prob + gravityBias * 0.2));
}

/** 計算各球號遺漏值的平均值與標準差 */
function calculateMissStandardDeviation(missData, lotto, startIdx, targetTime) {
  const config = getPrct1LottoConfig(lotto);
  const maxNum = config.maxNum;
  const stats = {};

  // 統一日期過濾邏輯：確保遺漏值標準差計算不包含 targetTime 當日
  const safeData = missData.filter((row) => {
    if (!targetTime) return true;
    const rowTime = new Date(row[0]).setHours(0, 0, 0, 0);
    return rowTime < targetTime;
  });

  for (let n = 1; n <= maxNum; n++) {
    const missValues = safeData.map(
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
function calculateMissWeights(data, lotto, targetTime) {
  const config = getPrct1LottoConfig(lotto);
  const maxNum = config.maxNum;
  const missStartIdx = lotto === "L539" ? 7 : 9;
  const weights = {};

  // 1. 統一日期過濾邏輯：確保遺漏權重加總不包含 targetTime 當日
  const safeData = data.filter((row) => {
    if (!targetTime) return true;
    const rowTime = new Date(row[0]).setHours(0, 0, 0, 0);
    return rowTime < targetTime;
  });

  // 2. 效能優化：預先計算衰減權重數列 (與 calculateStats 同步使用 0.98 因子)
  const decayWeights = [];
  for (let k = 0; k < safeData.length; k++) {
    decayWeights.push(Math.pow(0.98, safeData.length - 1 - k));
  }

  // 3. 執行加權累加
  safeData.forEach((row, i) => {
    const timeDecayWeight = decayWeights[i];
    for (let n = 1; n <= maxNum; n++) {
      const val = Number(row[missStartIdx + n - 1]) || 0;
      // 核心修正：導入時間衰減加權，確保遺漏值的貢獻度與時空距離掛鉤
      weights[n] = (weights[n] || 0) + val * timeDecayWeight;
    }
  });
  return weights;
}

/** 產生球號標籤 (過熱/過冷) */
function generateLabels(nums, stats, reboundNumbers) {
  const labels = {};
  const reboundSet = new Set(reboundNumbers || []);
  const avg = stats.avg || 1;
  const sd = stats.freqStdDev || 0.1;

  // 核心修正：改用動態標準差門檻 (Z-Score 判定)
  const hotThreshold = avg + sd * 1.8; // 約為統計顯著的高位
  const coldThreshold = avg - sd * 1.2; // 約為統計顯著的低位

  nums.forEach((n) => {
    const freq = stats.frequency[n] || 0;
    if (reboundSet.has(String(n))) labels[n] = "冷門反彈";
    else if (freq > hotThreshold) labels[n] = "過熱";
    else if (freq < coldThreshold) labels[n] = "過冷";
    else labels[n] = "一般";
  });
  return labels;
}

/** 命中檢查 */
function checkHits(predicted, actual, lotto, lastDraw = [], prevDraw = []) {
  if (!actual) return { summary: "尚未開獎", repeatHits: 0, skipHits: 0 };
  const config = getPrct1LottoConfig(lotto);

  // 區分一般號與特別號 (L539 無特別號)
  const mainNums = actual
    .slice(1, config.ballCount + 1)
    .map(Number)
    .filter((n) => n > 0);
  const s1 = config.hasS1 ? Number(actual[7]) : null;

  const hitBalls = predicted
    .filter((item) => {
      const num = typeof item === "object" ? Number(item.number) : Number(item);
      return mainNums.includes(num) || (s1 && num === s1);
    })
    .map((item) =>
      typeof item === "object" ? Number(item.number) : Number(item),
    );

  const mainHitsCount = hitBalls.filter((n) => mainNums.includes(n)).length;
  const s1Hit = s1 && hitBalls.includes(s1);

  // 計算連莊與隔期命中數
  const repeatHits = hitBalls.filter((n) => lastDraw.includes(n)).length;
  const skipHits = hitBalls.filter((n) => prevDraw.includes(n)).length;

  let summary = `命中 ${mainHitsCount}/${config.ballCount}`;
  if (s1Hit) summary += " (+特別號)";

  return { summary, repeatHits, skipHits };
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
    // 核心修正：確保當工作表為空時，正確初始化標題與格式
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
    historySheet.getRange(1, 1, 1, 8).setValues([historyData[0]]);
    historySheet.setFrozenRows(1);
  }

  // 確保標題列不為空
  const header =
    historyData && historyData.length > 0
      ? historyData[0]
      : [
          "型態",
          "彩種",
          "日期",
          "推薦數",
          "遺漏模式",
          "命中數",
          "命中號碼",
          "更新時間",
        ];
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
          ? Utilities.formatDate(row[2], "Asia/Taipei", "yyyy-MM-dd")
          : String(row[2]);
      hitCache[dKey] = {
        hits: row[5],
        hitNumbers: row[6] ? JSON.parse(row[6]) : [],
      };
    }
  });

  // 2. 定位回測起始索引
  const targetDateStr = Utilities.formatDate(
    targetDate,
    "Asia/Taipei",
    "yyyy-MM-dd",
  );
  const targetTime = targetDate.getTime();
  const allDataProcessed = allDataRaw.map((r) =>
    r[0] instanceof Date ? r : [new Date(r[0]), ...r.slice(1)],
  );
  allDataProcessed.forEach((r) => r[0].setHours(0, 0, 0, 0)); // 強制標準化時間

  Logger.log(
    `[Debug-History] 開始搜尋回測起點 - 彩種: ${lotto}, 目標日期: ${targetDateStr}, 總資料量: ${allDataProcessed.length}`,
  );

  let targetIdx = -1;
  for (let i = allDataProcessed.length - 1; i >= 0; i--) {
    const rowTime = allDataProcessed[i][0].getTime();
    if (rowTime < targetTime) {
      targetIdx = i;
      break;
    }
  }

  if (targetIdx === -1) {
    const firstDate =
      allDataProcessed.length > 0
        ? Utilities.formatDate(
            allDataProcessed[0][0],
            "Asia/Taipei",
            "yyyy-MM-dd",
          )
        : "無資料";
    const lastDate =
      allDataProcessed.length > 0
        ? Utilities.formatDate(
            allDataProcessed[allDataProcessed.length - 1][0],
            "Asia/Taipei",
            "yyyy-MM-dd",
          )
        : "無資料";
    Logger.log(
      `[Debug-History] 搜尋失敗：目標日期 ${targetDateStr} 不在資料範圍內 (${firstDate} ~ ${lastDate})`,
    );
    return [];
  }

  Logger.log(
    `[Debug-History] 找到起始索引: ${targetIdx}, 預計回測期數: ${limit}`,
  );

  const startIndex = Math.max(0, targetIdx - limit + 1);
  const totalSteps = targetIdx - startIndex + 1;
  let newRecords = [];
  const config = getPrct1LottoConfig(lotto);

  // 效能優化：在回測迴圈開始前預載 Miss 全表，避免 corePredict 反覆讀取
  const missDataFull = missSheet ? missSheet.getDataRange().getValues() : null;
  const allHeaders = ss
    .getSheetByName("All")
    .getRange(1, 1, 1, 50)
    .getValues()[0];

  // --- 關鍵效能優化：預先對所有紫微欄位建立索引映射，避免 corePredict 迴圈內重複掃描 ---
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
    "時柱",
    "日五形",
    "日十二建除",
    "日九星",
    "日二十八星宿",
    "時二十八星宿",
    "日八掛",
  ];
  const ziWeiIndices = ziWeiHouseNames
    .map((name, idx) => {
      const idStandard = "strp" + String(idx + 1).padStart(2, "0");
      let colIdx = allHeaders.findIndex(
        (h) => String(h).trim() === name || String(h).trim() === idStandard,
      );
      return { id: idStandard, name: name, colIdx: colIdx };
    })
    .filter((h) => h.colIdx !== -1);

  // 效能關鍵：預先切片背景資料，減少核心運算量
  const predBackgroundLimit = allDataProcessed.slice(0, targetIdx + 1);

  // 追蹤跳過原因
  let skipCount_Cache = 0;
  let skipCount_Validation = 0;

  for (let i = startIndex; i <= targetIdx; i++) {
    const currentStep = i - startIndex + 1;
    const progress = Math.round((currentStep / totalSteps) * 100);
    setPredictProgress(
      lotto,
      progress,
      `歷史軌跡掃描: ${currentStep}/${totalSteps}`,
    );

    const record = allDataProcessed[i];
    const d = record[0];
    const dStr = Utilities.formatDate(d, "Asia/Taipei", "yyyy-MM-dd");
    const dShort = Utilities.formatDate(d, "Asia/Taipei", "MM-dd");

    // 檢查快取
    if (hitCache[dStr] !== undefined) {
      results.push({
        date: dShort,
        hits: hitCache[dStr].hits,
        hitNumbers: hitCache[dStr].hitNumbers,
        useTrend: useTrend,
      });
      skipCount_Cache++;
      continue;
    }

    // 模擬當天的紫微環境
    const ziWeiEnv = ziWeiIndices.map((h) => ({
      id: h.id,
      name: h.name,
      val: String(record[h.colIdx]),
      idx: h.colIdx,
    }));

    // 從預處理的資料中取得訓練集，不再重新對全表做 slice
    const train = allDataProcessed.slice(Math.max(0, i - 250), i);
    const validatedTrain = validatePrct1TrainingData(train, config);
    // 核心修正：validatePrct1TrainingData 回傳的是物件，應檢查其內部的 validData 陣列長度
    if (validatedTrain.validData && validatedTrain.validData.length >= 5) {
      try {
        const pred = corePredict(
          lotto,
          validatedTrain.validData,
          missDataFull,
          d,
          1.0,
          "",
          false,
          null,
          topN,
          false,
          ss,
          ziWeiEnv,
          predBackgroundLimit, // 修正：傳入受限的背景資料而非全表
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
    } else {
      skipCount_Validation++;
    }
  }

  Logger.log(
    `[Debug-History] 掃描完成。新產生: ${newRecords.length} 筆, 快取跳過: ${skipCount_Cache} 筆, 驗證失敗: ${skipCount_Validation} 筆`,
  );

  // 3. 記憶體合併與批次寫回 (Batch Write Logic + Auto-Cleanup)
  // 修正：即使 newRecords 為 0，若 historySheet 資料異常也應重新檢查寫入
  if (newRecords.length > 0 || historySheet.getLastRow() <= 1) {
    // 建立一個 Map 來確保資料單一性 (以 日期_推薦數_遺漏模式 作為 Key)
    const rowMap = new Map();

    // 處理現有資料：保留符合當前版本的舊紀錄
    existingRows.forEach((row) => {
      const dKey =
        row[2] instanceof Date
          ? Utilities.formatDate(row[2], "Asia/Taipei", "yyyy-MM-dd")
          : String(row[2]);
      const uniqueKey = `${row[1]}_${dKey}_${row[3]}_${row[4]}`;
      // 如果是舊版本標籤，僅在 rowMap 中尚無資料時暫存，新生成的紀錄會覆蓋它
      rowMap.set(uniqueKey, row);
    });

    // 處理新產生的資料：若 Key 重複則覆蓋，確保資料唯一且為最新
    newRecords.forEach((row) => {
      // row[1]=lotto, row[2]=dStr, row[3]=topN, row[4]=useTrend
      const uniqueKey = `${row[1]}_${row[2]}_${row[3]}_${row[4]}`;
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

    // 確保所有行均為 8 欄，防止 setValues 失敗
    const validatedRows = allRows.map((r) =>
      r.length === 8 ? r : [...r, ...new Array(8 - r.length).fill("")],
    );

    if (validatedRows.length > 0) {
      historySheet.clearContents();
      const finalData = [header, ...validatedRows];
      historySheet.getRange(1, 1, finalData.length, 8).setValues(finalData);
      SpreadsheetApp.flush();
    }
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
  Logger.log(
    `[Debug-History] 前端請求回測統計: 彩種=${lotto}, 推薦數=${topN}, 模式=${useTrend}, 日期=${dateStr}`,
  );
  try {
    const trObj = getTargetsheet("Sheets", lotto);
    const ss = trObj.spreadsheet;
    const allSheet = ss.getSheetByName("All");
    const missSheet = useTrend ? ss.getSheetByName("Miss") : null;

    if (!allSheet) throw new Error(`找不到 ${lotto} 的 All 工作表`);

    // 修正：強化日期過濾與轉換邏輯，支援文字型日期
    const allDataRaw = allSheet
      .getDataRange()
      .getValues()
      .filter(
        (row) =>
          row[0] &&
          (row[0] instanceof Date || !isNaN(new Date(row[0]).getTime())),
      )
      .map((row) => {
        if (!(row[0] instanceof Date)) row[0] = new Date(row[0]);
        return row;
      });

    Logger.log(
      `[Debug-History] 從 All 工作表提取到有效開獎紀錄: ${allDataRaw.length} 筆`,
    );

    // 根據前端傳入的日期字串作為回測基準點，若無則使用今日
    let targetDate = dateStr
      ? new Date(dateStr.replace(/-/g, "/"))
      : new Date();
    targetDate.setHours(0, 0, 0, 0); // 核心修正：標準化目標日期至凌晨

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
  const prevSum =
    sumHistory.length > 1 ? sumHistory[sumHistory.length - 2] : lastSum;

  // 使用配置中的理論期望值與標準差
  const theoryMeanSum = config.theorySum;
  const stdDev = config.stdDev || 1;

  // 核心同步：計算最近一期的和值 Z-Score (與 sumGravityTrend 邏輯一致)
  const lastZScore = (lastSum - theoryMeanSum) / stdDev;
  const prevZScore = (prevSum - theoryMeanSum) / stdDev;
  const zVelocity = lastZScore - prevZScore; // 位移速率 (正值代表向上擴張，負值代表向下修正)

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

    // --- 和值引力修正 (Z-Score 位移速率感應版) ---
    // 當 Z-Score 偏離超過 1.0 時啟動引力回歸修正。
    // 引入速率補償：若偵測到回頭訊號 (Z 與 V 異號)，說明回歸動能已啟動，加大權重引力；
    // 若還在加速偏離 (Z 與 V 同號)，則保守調整強度以防禦連續震盪。
    if (Math.abs(lastZScore) > 1.0) {
      let gravityIntensity = 0.18; // 基礎修正增量 (對應原本的 1.18x)

      // 判定是否為「回頭/減速」狀態 (Decelerating)
      const isDecelerating =
        (lastZScore > 0 && zVelocity < 0) || (lastZScore < 0 && zVelocity > 0);
      if (isDecelerating) {
        // 偵測到反轉訊號，強化修正力道 (最高至 1.30x)
        gravityIntensity += Math.min(0.12, Math.abs(zVelocity) * 0.1);
      } else {
        // 仍具備偏離動能，收斂修正力道 (最低降至 1.10x)
        gravityIntensity -= Math.min(0.08, Math.abs(zVelocity) * 0.05);
      }

      if (lastZScore > 1.0 && n < midPoint) correction *= 1 + gravityIntensity;
      if (lastZScore < -1.0 && n > midPoint) correction *= 1 + gravityIntensity;
    }

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

  // 1. 取得現有權重 (含繼承邏輯)
  const adjustedWeights = getLearnedBaseWeights(lotto, ss);

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

  // 3. 核心修正：解除版本鎖定，改用「紀錄數量」增量學習 (每增加 5 筆學習一次)
  const lastLearnCount = getPropertySheetValue(
    "prct1_Property",
    cacheKey + "_LEARN_COUNT",
    0,
    ss,
  );
  if (fullData.length <= lastLearnCount + 5 && lastLearnCount > 0) return;

  const LEARNING_MIN_RECORDS = 10; // 至少需要 10 筆紀錄才啟動學習
  const LEARNING_DECAY_FACTOR = 0.9; // 舊紀錄的影響力衰減

  if (fullData.length <= LEARNING_MIN_RECORDS) {
    setPropertySheetValue("prct1_Property", cacheKey, adjustedWeights, ss);
    return;
  }

  const headers = fullData[0];
  const correlationIdx = headers.indexOf("相關係數");
  const changedParamsIdx = headers.indexOf("變動參數摘要");
  const remarksIdx = headers.indexOf("備註");

  if (correlationIdx === -1 || changedParamsIdx === -1 || remarksIdx === -1) {
    setPropertySheetValue("prct1_Property", cacheKey, adjustedWeights, ss);
    return;
  }

  // 確保 houseWeights 物件結構存在於 adjustedWeights 中
  adjustedWeights.houseWeights = adjustedWeights.houseWeights || {};

  // 定義宇宙參數共振偵測關鍵字 (移至迴圈外以優化效能並修正作用域錯誤)
  const cosmicKeywords = [
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
    "時柱",
    "日五形",
    "日十二建除",
    "日九星",
    "日二十八星宿",
    "時二十八星宿",
    "日八掛",
  ];

  // 從最新的紀錄開始學習
  for (let i = fullData.length - 1; i >= 1; i--) {
    const row = fullData[i];
    const correlation = parseFloat(row[correlationIdx]) || 0;
    const remarks = String(row[remarksIdx] || "");
    const changedParams = String(row[changedParamsIdx] || "");

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
      if (changedParams.includes("年天干") && remarks.includes("命中")) {
        adjustedWeights.metaBoostYear += recordWeight * 0.005;
      }

      // --- 核心進化：五行元素增益進化 ---
      const stemElements = { 甲: "木", 乙: "木", 丙: "火", 丁: "火", 戊: "土", 己: "土", 庚: "金", 辛: "金", 壬: "水", 癸: "水" };
      const yearlyElement = stemElements[changedParams.split("年天干:")[1]?.split(";")[0]?.trim()];
      if (yearlyElement && remarks.includes("命中")) {
        adjustedWeights.elementWeights = adjustedWeights.elementWeights || {};
        adjustedWeights.elementWeights[yearlyElement] = (adjustedWeights.elementWeights[yearlyElement] || 0.1) + recordWeight * 0.01;
      }

      const hasCosmicMatch = cosmicKeywords.some((key) =>
        changedParams.includes(key),
      );

      if (hasCosmicMatch && remarks.includes("命中")) {
        // 核心修正：當相關係數極高 (如命中 4/5 或 5/6) 時，視為強烈共振訊號，增益幅度翻倍
        const boostMultiplier = correlation > 0.8 ? 2.0 : 1.0;
        adjustedWeights.metaBoostLifePalace =
          (adjustedWeights.metaBoostLifePalace || 0.08) +
          recordWeight * 0.005 * boostMultiplier;
      }

      // --- 核心進化：個別宇宙宮位權重進化 ---
      // 若特定宮位在命中時處於變動狀態，代表該宮位之共振引力有效，強化其權重係數
      cosmicKeywords.forEach((key) => {
        if (changedParams.includes(key + ":") && remarks.includes("命中")) {
          const houseBoost =
            recordWeight * 0.02 * (correlation > 0.8 ? 2.0 : 1.0);
          adjustedWeights.houseWeights[key] =
            (adjustedWeights.houseWeights[key] || 1.0) + houseBoost;
        }
      });
    } else if (correlation < 0.15) {
      // 核心優化：表現不佳時適度下修權重，防止單一維度過度擴張
      adjustedWeights.repeat -= recordWeight * 0.005;
      adjustedWeights.skip -= recordWeight * 0.003;

      // 表現不佳時下修紫微權重
      if (cosmicKeywords.some((key) => changedParams.includes(key))) {
        adjustedWeights.metaBoostLifePalace =
          (adjustedWeights.metaBoostLifePalace || 0.08) - recordWeight * 0.002;
      }

      // 表現不佳時適度下修相關宮位權重，以抑制雜訊干擾
      cosmicKeywords.forEach((key) => {
        if (changedParams.includes(key + ":")) {
          const houseDecay = recordWeight * 0.01;
          adjustedWeights.houseWeights[key] =
            (adjustedWeights.houseWeights[key] || 1.0) - houseDecay;
        }
      });

      // --- 核心進化：觀察窗口動態對焦 ---
      // 當表現不佳時，AI 嘗試縮短或延長觀察期，尋找更具預測價值的週期區間
      const windowShift = (Math.random() > 0.5 ? 1 : -1) * recordWeight * 2;
      adjustedWeights.observationWindow =
        (adjustedWeights.observationWindow || 60) + windowShift;
    }
  }

  // 核心優化：執行最終數值箝位 (Clamping)，新增位置限制器參數的安全邊界
  const LIMITS = {
    repeat: { min: 0.5, max: 1.4 }, // 核心修正：微調上限以平衡補償係數
    skip: { min: 0.2, max: 0.9 },
    metaBoostYear: { min: 0.01, max: 0.3 },
    metaBoostLifePalace: { min: 0.005, max: 0.15 }, // 考慮到宮位變多，下修上限
    posSevereFactor: { min: 0.85, max: 1.0 },
    posNormalFactor: { min: 0.9, max: 1.0 },
    observationWindow: { min: 30, max: 150 }, // 限制窗口範圍
  };

  // 五行權重箝位
  if (adjustedWeights.elementWeights) {
    Object.keys(adjustedWeights.elementWeights).forEach(key => {
      adjustedWeights.elementWeights[key] = Math.max(0.01, Math.min(0.5, adjustedWeights.elementWeights[key]));
    });
  }

  // 個別宮位權重箝位：限制在 0.1 ~ 4.0 之間，防止單一宮位過度擴張
  Object.keys(adjustedWeights.houseWeights).forEach((key) => {
    adjustedWeights.houseWeights[key] = Math.max(
      0.1,
      Math.min(4.0, adjustedWeights.houseWeights[key]),
    );
  });

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
  adjustedWeights.posSevereFactor = Math.max(
    LIMITS.posSevereFactor.min,
    Math.min(
      LIMITS.posSevereFactor.max,
      adjustedWeights.posSevereFactor || 0.92,
    ),
  );
  adjustedWeights.posNormalFactor = Math.max(
    LIMITS.posNormalFactor.min,
    Math.min(
      LIMITS.posNormalFactor.max,
      adjustedWeights.posNormalFactor || 0.96,
    ),
  );
  adjustedWeights.observationWindow = Math.max(
    LIMITS.observationWindow.min,
    Math.min(
      LIMITS.observationWindow.max,
      adjustedWeights.observationWindow || 60,
    ),
  );

  try {
    setPropertySheetValue("prct1_Property", cacheKey, adjustedWeights, ss);
    // 紀錄目前的學習總數
    setPropertySheetValue(
      "prct1_Property",
      cacheKey + "_LEARN_COUNT",
      fullData.length,
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
          sheet.getRange(i + 1, 2, 1, 2).setValues([[stringValue, new Date()]]); // 同步更新 LastUpdated
          return;
        }
      }
    }
    sheet.appendRow([keyStr, stringValue, new Date()]); // 補齊 LastUpdated 欄位
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
    const trObj = getTargetsheet("Sheets", lotto);
    const ss = trObj.spreadsheet;
    const weightData = getLearnedBaseWeights(lotto, ss);

    // 讀取額外的元數據
    const learnCountKey =
      PRCT1_ALGO_VERSION + "_LEARNED_WEIGHTS_" + lotto + "_LEARN_COUNT";
    const learnCount = getPropertySheetValue(
      "prct1_Property",
      learnCountKey,
      0,
      ss,
    );

    return {
      ...weightData,
      learnCount: learnCount,
      algoVersion: PRCT1_ALGO_VERSION,
      isDefault: !getPropertySheetValue(
        "prct1_Property",
        PRCT1_ALGO_VERSION + "_LEARNED_WEIGHTS_" + lotto,
        null,
        ss,
      ),
    };
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
  let cached = getPropertySheetValue("prct1_Property", cacheKey, null, ss);

  // --- 強化：版本權重繼承機制 ---
  // 若當前版本無紀錄，搜尋所有版本的學習權重並選取最新的一個繼承，防止 AI 重置
  if (!cached) {
    const ssId = ss.getId();
    const cacheKeyInThread = ssId + "_prct1_Property";
    // 確保 internal cache 已載入
    getPropertySheetValue("prct1_Property", "DUMMY_VERSION_SCAN", null, ss);
    const fullCache = _prct1_propertyCache[cacheKeyInThread] || {};
    const suffix = "_LEARNED_WEIGHTS_" + lotto;

    // 效能優化：使用單次遍歷尋找最高版本，避免累積多年權重紀錄導致的排序效能開銷
    let bestKey = null;
    let maxVer = -1;
    Object.keys(fullCache).forEach((key) => {
      if (key.endsWith(suffix)) {
        const match = key.match(/^A(\d+)/);
        if (match) {
          const ver = parseInt(match[1], 10);
          if (ver > maxVer) {
            maxVer = ver;
            bestKey = key;
          }
        }
      }
    });

    if (bestKey) {
      const bestMatch = fullCache[bestKey];
      cached =
        typeof bestMatch === "string" ? JSON.parse(bestMatch) : bestMatch;
      Logger.log(
        `[Weight Inheritance] ${lotto} 成功繼承舊版權重數據: ${bestKey}`,
      );
    }
  }

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
    observationWindow: 60, // 新增：進化式觀察窗口初始值
    elementWeights: { 木: 0.1, 火: 0.1, 土: 0.1, 金: 0.1, 水: 0.1 }, // 新增：動態五行權重
    houseWeights: {
      // 新增：宮位共振初始權重
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
      時柱: 1.3,
      日五形: 1.5,
      日十二建除: 1.1,
      日九星: 1.4,
      日二十八星宿: 1.6,
      時二十八星宿: 1.2,
      日八掛: 1.0,
    },
  };

  if (cached) {
    const weights =
      typeof cached === "string" && cached.trim().startsWith("{")
        ? JSON.parse(cached)
        : cached;
    // 補全邏輯：執行深層合併確保 houseWeights 中的各個子項也能獲得預設值
    const merged = Object.assign({}, defaultWeights, weights);
    if (weights.houseWeights) {
      merged.houseWeights = Object.assign(
        {},
        defaultWeights.houseWeights,
        weights.houseWeights,
      );
    }
    if (weights.elementWeights) {
      merged.elementWeights = Object.assign({}, defaultWeights.elementWeights, weights.elementWeights);
    }
    return merged;
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
      const lastCol = propSheet.getLastColumn();
      if (lastRow > 1)
        propSheet.getRange(2, 1, lastRow - 1, lastCol).clearContent(); // 修正：清除所有欄位
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
      message: `清理完成！共移除 ${removedCount} 筆舊版本資料，保留 ${rowsToKeep.length} ���目前版本 (${PRCT1_ALGO_VERSION}) 紀錄。`,
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
      // 強化：支援不限位數的 A 系列版本號提取 (例如 A133, A1000)
      const match = key.match(/A(\d+)/);
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
      const match = key.match(/A(\d+)/);

      // --- 核心修正：保護 LearnedWeights 紀錄 ---
      // 1. 保留非版本化 Key
      // 2. 永久保留所有 LearnedWeights 紀錄，確保繼承鏈不斷裂
      // 3. 僅對體積較大的 _STATS_ 或 _MISS_ 紀錄執行版本過濾
      const isWeightKey = key.includes("_LEARNED_WEIGHTS_");
      return !match || isWeightKey || keepVersions.includes("A" + match[1]);
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
