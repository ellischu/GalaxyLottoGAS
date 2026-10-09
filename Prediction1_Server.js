/** 演算法邏輯版本：當修改 corePredict 權重或公式後，請遞增此版本號以自動失效舊快取 */
const PRCT1_ALGO_VERSION = "A147"; // 實作紫微共振能量歸一化與顯示精度優化

/** 執行緒級別快取，用於減少試算表讀取次數 (效能優化，Prediction1 模組專用) */
var _predic1_propertyCache = {};

/**
 * 新架構試算表解析（資料夾 > 試算表 > 工作表）。
 * Prediction1 模組專用（勿與 Predict 模組的 prct1_* / {lotto}_Predict 混用）：
 *   All  ← {lotto} 試算表
 *   Miss ← {lotto}_Miss 試算表（useTrend=true 時必需）
 *   predic1_Settings / predic1_Property / predic1_History / predic1_Settings_Archive ← {lotto}_Prediction1 試算表
 * 本模組每彩種需 Sheets 註冊表含 {lotto}、{lotto}_Miss、{lotto}_Prediction1 三筆（4 彩種共 12 筆）。
 */
function getPrediction1Spreadsheets(lotto) {
  var allSS = getPrediction1SpreadsheetEntry(lotto);
  var missSS = getPrediction1SpreadsheetEntry(lotto + "_Miss");
  var p1SS = getPrediction1SpreadsheetEntry(lotto + "_Prediction1");
  return { allSS: allSS, missSS: missSS, p1SS: p1SS };
}

/**
 * 開啟 Sheets 註冊表指定鍵的試算表；鍵缺失或 URL 無效時拋出可讀錯誤。
 * Prediction1 模組專用（鍵為 {lotto} / {lotto}_Miss / {lotto}_Prediction1，勿傳入 {lotto}_Predict）。
 */
function getPrediction1SpreadsheetEntry(key) {
  var trObj = null;
  try {
    trObj = getTargetsheet("Sheets", key);
  } catch (e) {
    throw new Error(`Sheets 註冊表缺少 Prediction1 專用鍵 [${key}] 或開啟失敗（${e.message}），請補上每彩種 {彩種}、{彩種}_Miss、{彩種}_Prediction1 共 12 筆註冊`);
  }
  if (!trObj || !trObj.spreadsheet) {
    throw new Error(`Sheets 註冊表缺少 Prediction1 專用鍵 [${key}]，請補上每彩種 {彩種}、{彩種}_Miss、{彩種}_Prediction1 共 12 筆註冊`);
  }
  return trObj.spreadsheet;
}

/**
 * 新架構建表（Prediction1 模組專用，操作對象限 {lotto}_Prediction1 試算表）。
 * 欄位以實際工作表為準（2026-10 核對，勿套用 Predict 模組 prct1_* 的標頭）：
 *   predic1_Settings：執行時間/預測日期/相關係數/推薦數/遺漏模式/變動參數摘要/備註（7 欄，執行紀錄）
 *   predic1_History：型態/彩種/日期/推薦數/遺漏模式/命中數/命中號碼/更新時間（8 欄，回測快取）
 *   predic1_Property：Key/Value/LastUpdated（KV；程式讀寫第 3 欄時間戳）
 *   predic1_Settings_Archive：與 predic1_Settings 同 7 欄（預留封存用，現階段無寫入）
 * 非破壞式：工作表已存在時絕不改寫標頭與資料，僅在缺表或空表時建表填標頭。
 */
function ensurePrediction1Sheets(p1SS) {
  function ensureSheet(name, header) {
    var sh = p1SS.getSheetByName(name);
    if (!sh) {
      sh = p1SS.insertSheet(name);
      sh.appendRow(header);
      sh.setFrozenRows(1);
    } else if (sh.getLastRow() === 0) {
      sh.appendRow(header);
      sh.setFrozenRows(1);
    }
    return sh;
  }
  var propSheet = ensureSheet("predic1_Property", ["Key", "Value", "LastUpdated"]);
  // 既有 Property 表若標頭缺欄，僅補空白標頭格，不動任何資料列
  try {
    var propHeader = ["Key", "Value", "LastUpdated"];
    for (var c = 1; c <= 3; c++) {
      if (!String(propSheet.getRange(1, c).getValue() || "").trim()) {
        propSheet.getRange(1, c).setValue(propHeader[c - 1]);
      }
    }
  } catch (e) { /* 標頭修補失敗不阻斷主流程 */ }
  var settingsSheet = ensureSheet("predic1_Settings", ["執行時間", "預測日期", "相關係數", "推薦數", "遺漏模式", "變動參數摘要", "備註"]);
  var historySheet = ensureSheet("predic1_History", ["型態", "彩種", "日期", "推薦數", "遺漏模式", "命中數", "命中號碼", "更新時間"]);
  var archiveSheet = ensureSheet("predic1_Settings_Archive", ["執行時間", "預測日期", "相關係數", "推薦數", "遺漏模式", "變動參數摘要", "備註"]);
  SpreadsheetApp.flush();
  return { propertySheet: propSheet, settingsSheet: settingsSheet, historySheet: historySheet, archiveSheet: archiveSheet };
}

/**
 * 驗證 Prediction1 新架構 Sheets 註冊表（唯讀，不寫入）。
 * 僅檢查本模組所需的 4 彩種 × 3 筆：{lotto}、{lotto}_Miss、{lotto}_Prediction1（共 12 筆）。
 * 與 Predict 模組的 verifyPredictRegistry（16 筆，含 _Predict）分開，勿混用。
 * 部署前在 GAS 編輯器執行一次即可。
 * @returns {Object} { status, checked, missing }
 */
function verifyPrediction1Registry() {
  var lottos = ["L539", "L649", "L638", "LSix"];
  var suffixes = ["", "_Miss", "_Prediction1"];
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
 * 唯讀診斷：回報 4 彩種 × {lotto}_Prediction1 四張工作表的實際標頭與列數。
 * 不寫入、不建表、不改標頭。在 GAS 編輯器執行後，開啟「執行紀錄」複製結果。
 * @returns {string} 多行文字報告
 */
function diagnosePrediction1Sheets() {
  var lottos = ["L539", "L649", "L638", "LSix"];
  var sheetNames = ["predic1_Settings", "predic1_History", "predic1_Property", "predic1_Settings_Archive"];
  var lines = [];
  lottos.forEach(function(lotto) {
    lines.push("=== " + lotto + "_Prediction1 ===");
    var p1SS = null;
    try {
      p1SS = getPrediction1Spreadsheets(lotto).p1SS;
      lines.push("試算表: " + p1SS.getName() + " (" + p1SS.getId() + ")");
    } catch (e) {
      lines.push("試算表開啟失敗: " + e.message);
      return;
    }
    sheetNames.forEach(function(name) {
      var sh = p1SS.getSheetByName(name);
      if (!sh) {
        lines.push(name + ": 缺表");
        return;
      }
      var lastRow = sh.getLastRow();
      var lastCol = sh.getLastColumn();
      var header = lastRow > 0
        ? sh.getRange(1, 1, 1, lastCol).getDisplayValues()[0].join(" | ")
        : "(空表)";
      lines.push(name + ": 列數=" + lastRow + " 欄數=" + lastCol + " 標頭=[" + header + "]");
    });
  });
  var report = lines.join("\n");
  Logger.log("\n" + report);
  return report;
}

/**
 * 取得彩種核心組態 (封裝硬編碼參數)
 */
function getPredic1LottoConfig(lotto) {
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

/** 舊名相容別名（Prediction1 內部已改用 getPredic1LottoConfig，勿與 Predict 模組混用） */
function getPrct1LottoConfig(lotto) {
  return getPredic1LottoConfig(lotto);
}

/**
 * 共用：由環境列計算預測訊號參數。
 * 實測 getPrediction01 與回測 getRecentHistoryHits 必須走同一套，否則同一日期兩邊排名分歧、命中數對不上。
 * @param {Array} headers 欄位列（AllData 或 All 表皆可，環境欄位名一致）
 * @param {Array|null} curRow 當日列
 * @param {Array|null} prevRow 前一日列（無則視為無變動）
 * @param {Array} train 已驗證訓練集（取末 3 期偵測連號傾向）
 * @param {Object} config 彩種組態
 * @param {Date} dateObj 目標日期
 * @returns {Object} { details, changeRatio, yearStem, isYearDayClash, isYearDayHarmony, tripleElement, isConsecutiveTrend, isMajorDrawDay, signalBoost }
 */
function getPredic1SignalParams(headers, curRow, prevRow, train, config, dateObj) {
  const fieldMapping = getFieldMapping();
  const idMapping = getIDMapping();
  const details = [];
  const hNames = (headers || []).map((h) => String(h || "").trim());
  if (curRow && curRow.length > 0) {
    hNames.forEach((hStr, idx) => {
      if (
        idx === 0 ||
        hStr.indexOf("號") === 0 ||
        hStr === "特1" ||
        hStr === "S1" ||
        ["Sum", "總合", "期數", "序號", "命重"].includes(hStr) ||
        hStr.match(/^[LNS]\d+$/)
      )
        return;
      const rawVal = curRow[idx];
      const prevVal = prevRow ? prevRow[idx] : rawVal;
      const isChanged = String(rawVal) !== String(prevVal);
      let fieldWeight = 1.0;
      if (hStr.indexOf("日") === 0) fieldWeight = 2.5;
      if (hStr.indexOf("月") === 0) fieldWeight = 1.5;
      if (hStr.indexOf("年") === 0) fieldWeight = 0.5;
      if (hStr === "本命") fieldWeight = 2.0;
      details.push({
        id: hStr,
        name: fieldMapping[hStr] || hStr,
        value: idMapping[String(rawVal)] || rawVal,
        isChanged: isChanged,
        impact: isChanged ? fieldWeight : 0,
      });
    });
  }
  const totalImpact = details.reduce((sum, d) => sum + d.impact, 0);
  const changeRatio = totalImpact / ((details.length * 1.0) || 1);
  const valOf = (id) => details.find((d) => d.id === id)?.value || "";
  const zodiacRel = checkZodiacRelation(valOf("年地支"), valOf("月地支"), valOf("日地支"));
  // 連號傾向偵測（取訓練集末 3 期）
  let consecutiveMatch = 0;
  (train || []).slice(-3).forEach((row) => {
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
  const isMajorDrawDay = dateObj ? config.drawDays.includes(dateObj.getDay()) : false;
  let signalBoost = 1 + changeRatio * 0.5 + (zodiacRel.isClash ? 0.3 : 0);
  if (isMajorDrawDay) signalBoost += 0.2;
  if (isConsecutiveTrend) signalBoost += 0.15;
  return {
    details: details,
    changeRatio: changeRatio,
    yearStem: valOf("年天干"),
    isYearDayClash: zodiacRel.isClash,
    isYearDayHarmony: zodiacRel.isHarmony,
    tripleElement: zodiacRel.tripleElement,
    isConsecutiveTrend: isConsecutiveTrend,
    isMajorDrawDay: isMajorDrawDay,
    signalBoost: signalBoost,
  };
}

/**
 * getPrediction01 - 主預測進入點
 */
function getPrediction01(lotto, dateStr, useTrend, topNChoice) {
  try {
    const config = getPredic1LottoConfig(lotto);
    const startTime = Date.now();
    const targetDate = new Date(dateStr.replace(/-/g, "/"));
    targetDate.setHours(0, 0, 0, 0);
    const targetTime = targetDate.getTime();

    setPredictProgress(lotto, 5, "正在啟動星系運算儀...");

    // 新架構：All ← {lotto} 試算表；Miss ← {lotto}_Miss 試算表；設定 ← {lotto}_Prediction1 試算表
    const sheets = getPrediction1Spreadsheets(lotto);
    const ss = sheets.p1SS;
    const ensured = ensurePrediction1Sheets(ss);

    const allSheet = sheets.allSS.getSheetByName("All");
    if (!allSheet) throw new Error(`找不到 ${lotto} 試算表中的 All 工作表`);
    const missSheet = sheets.missSS.getSheetByName("Miss");
    if (useTrend && !missSheet) throw new Error(`找不到 ${lotto}_Miss 試算表中的 Miss 工作表（已啟用遺漏模式）`);
    const settingsSheet = ensured.settingsSheet;

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

    // 1.1 提取詳細環境數據與訊號參數（與回測共用 getPredic1SignalParams，兩邊排名一致）
    // 註：連號傾向需已驗證訓練集，稍後以 validatedData 補算定案（見下文「訊號參數定案」）
    const _env0 = getPredic1SignalParams(adHeaders, adRow, prevAdRow, [], config, targetDate);
    const envDetails = _env0.details;
    let changeRatio = _env0.changeRatio;
    let yearStem = _env0.yearStem;
    let isYearDayClash = _env0.isYearDayClash;
    let isYearDayHarmony = _env0.isYearDayHarmony;
    let tripleElement = _env0.tripleElement;

    // --- 新增：環境參數變動雷達 ---
    let radarMsg = "";
    if (changeRatio > 0.7) {
      radarMsg = `🌀 星系能量重組日 (變動率: ${(changeRatio * 100).toFixed(1)}%)`;
      Logger.log(`[Environmental Radar] ${targetDateStrFormatted} ${radarMsg}`);
    }

    // --- 強化錯誤處理：捕捉變數未定義或執行異常 ---
    try {

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

      // --- 訊號參數定案：以已驗證訓練集重算（含連號傾向），與回測同一套 ---
      const _sig = getPredic1SignalParams(adHeaders, adRow, prevAdRow, validatedData, config, targetDate);
      changeRatio = _sig.changeRatio;
      yearStem = _sig.yearStem;
      isYearDayClash = _sig.isYearDayClash;
      isYearDayHarmony = _sig.isYearDayHarmony;
      tripleElement = _sig.tripleElement;
      const isConsecutiveTrend = _sig.isConsecutiveTrend;
      const isMajorDrawDay = _sig.isMajorDrawDay;
      const signalBoost = _sig.signalBoost;

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

      // 5. 同步記錄 分析參數 與 相關係數 至 predic1_Settings
      // （7 欄執行紀錄格式，與工作表標頭一致）
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
      managePredic1PropertyVersions(ss);

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
      // 新架構：All ← {lotto}；Miss ← {lotto}_Miss；屬性 ← {lotto}_Prediction1
      const sheets = getPrediction1Spreadsheets(lotto);
      const ss = sheets.p1SS;
      ensurePrediction1Sheets(ss);
      const learnedWeights = getLearnedBaseWeights(lotto, ss);
      const windowSize = Math.round(learnedWeights.observationWindow || 60);

      const allSheet = sheets.allSS.getSheetByName("All");
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
      setPredic1PropertyValue(
        "predic1_Property",
        cacheKey,
        stats,
        ss,
      );

      // --- 強化：同時預載 Miss 遺漏數據包 ---
      const missSheet = sheets.missSS.getSheetByName("Miss");
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
        setPredic1PropertyValue(
          "predic1_Property",
          missCacheKey,
          missPackage,
          ss,
        );
      }

      // --- 新增：自動管理屬性工作表版本 ---
      managePredic1PropertyVersions(ss);

      Logger.log(
        `[Cache Preload] 成功為 ${lotto} 預載 W${windowSize} 快取 (${lastDrawDate})`,
      );
    } catch (e) {
      logSystemError("preloadPrediction1Cache", e.message, "ERROR", `${lotto} 預載失敗`);
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

/** 計算簡單相關係數（命中率參考；尚未開獎時回傳隨機基線） */
function calculateCorrelation(predicted, actual, lotto) {
  if (!actual) return (Math.random() * 0.4 + 0.2).toFixed(4);
  const config = getPredic1LottoConfig(lotto);

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
  const config = getPredic1LottoConfig(lotto);
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
    const config = getPredic1LottoConfig(lotto);
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

    const cached = getPredic1PropertyValue("predic1_Property", cacheKey, null, ss);
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
        // 調整為使用該彩種專屬的 predic1_Property 工作表
        setPredic1PropertyValue("predic1_Property", cacheKey, stats, ss);
      } catch (e) {
        Logger.log("predic1_Property 快取寫入失敗: " + e.message);
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
      const cachedMiss = getPredic1PropertyValue(
        "predic1_Property",
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

    // --- 新增：五行屬性分配 (與 Prediction2_Server.js 保持一致) ---
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
    // 記錄詳細錯誤到 predic1_Settings（7 欄執行紀錄格式；外層另以 logSystemError 記入 ErrorLog）
    try {
      const p1SS = getPrediction1Spreadsheets(lotto).p1SS;
      const settingsSheet = p1SS.getSheetByName("predic1_Settings");
      if (settingsSheet) {
        settingsSheet.appendRow([
          new Date(),
          "CORE_ERROR",
          "N/A",
          topNChoice,
          "N/A",
          "Algorithm Failure",
          String((err && err.stack) || err).substring(0, 500),
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
  const config = getPredic1LottoConfig(type);

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
  const config = getPredic1LottoConfig(lotto);
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
  const config = getPredic1LottoConfig(lotto);
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
  const config = getPredic1LottoConfig(lotto);

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
  // 新架構：歷史紀錄位於 {lotto}_Prediction1 試算表 > predic1_History 工作表（Prediction1 專用，勿用 prct1_History）
  const ss = getPrediction1Spreadsheets(lotto).p1SS;
  const historySheet = ensurePrediction1Sheets(ss).historySheet;

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
  const config = getPredic1LottoConfig(lotto);

  // 效能優化：在回測迴圈開始前預載 Miss 全表，避免 corePredict 反覆讀取
  const missDataFull = missSheet ? missSheet.getDataRange().getValues() : null;
  // 新架構：All 標頭來自 {lotto} 試算表（ss 為 {lotto}_Prediction1 試算表）
  const allHeaders = getPrediction1Spreadsheets(lotto).allSS
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
        // 訊號參數與實測同一套（環境變動率/歲破/連號傾向皆按當日重算，避免兩邊排名分歧）
        const prevRecord = i > 0 ? allDataProcessed[i - 1] : null;
        const bSig = getPredic1SignalParams(allHeaders, record, prevRecord, validatedTrain.validData, config, d);
        const pred = corePredict(
          lotto,
          validatedTrain.validData,
          missDataFull,
          d,
          bSig.signalBoost,
          bSig.yearStem,
          bSig.isYearDayHarmony,
          bSig.tripleElement,
          topN,
          bSig.isConsecutiveTrend,
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
    // 新架構：All ← {lotto} 試算表；Miss ← {lotto}_Miss 試算表；歷史/屬性 ← {lotto}_Prediction1 試算表
    const sheets = getPrediction1Spreadsheets(lotto);
    ensurePrediction1Sheets(sheets.p1SS);
    const allSheet = sheets.allSS.getSheetByName("All");
    const missSheet = useTrend ? sheets.missSS.getSheetByName("Miss") : null;

    if (!allSheet) throw new Error(`找不到 ${lotto} 的 All 工作表`);
    if (useTrend && !missSheet) throw new Error(`找不到 ${lotto}_Miss 試算表中的 Miss 工作表（已啟用遺漏模式）`);

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
 * 一鍵診斷 09-17 案例（無參數，可直接在編輯器按執行；改條件請改下方常數）。
 * 兩種遺漏模式各跑一次，結果見「執行作業」→ 該次執行 → 記錄。
 * 若超時，請分兩次跑（先註解掉其中一行）。
 */
function debugVerify0917() {
  const lotto = "L539";
  const dateStr = "2026-09-17";
  const topN = 10;
  [true, false].forEach((trend) => {
    verifyPrediction1HistoryHit(lotto, dateStr, topN, trend);
  });
}

/**
 * 唯讀診斷：三方比對特定日期的回測命中（All 實際列 vs predic1_History 快取列 vs 略過快取直接重算）。
 * 用於追查「回測顯示命中與實際不符」（如 L539 09-17 顯示 3 顆、實際僅 2 顆）。
 * 不寫入任何工作表。在 GAS 編輯器執行後，開啟「執行紀錄」查看。
 * @param {string} lotto 彩種
 * @param {string} dateStr 日期 yyyy-MM-dd（需完整年份）
 * @param {number} topN 推薦數（需與圖表當時相同）
 * @param {boolean} useTrend 遺漏模式（需與圖表當時相同）
 * @returns {Object} { allRows, cachedRows, fresh, notes }
 */
function verifyPrediction1HistoryHit(lotto, dateStr, topN, useTrend) {
  const config = getPredic1LottoConfig(lotto);
  const sheets = getPrediction1Spreadsheets(lotto);
  topN = Number(topN) || 10;
  useTrend = !!useTrend;
  const target = new Date(String(dateStr).replace(/-/g, "/"));
  target.setHours(0, 0, 0, 0);
  const targetTime = target.getTime();
  const report = { lotto: lotto, dateStr: dateStr, topN: topN, useTrend: useTrend, allRows: [], cachedRows: [], fresh: null, notes: [] };

  // 1. All 實際列（含重複日期列一併列出）
  const allSheet = sheets.allSS.getSheetByName("All");
  if (!allSheet) throw new Error("找不到 " + lotto + " 的 All 工作表");
  const allData = allSheet.getDataRange().getValues();
  const ballCount = config.ballCount;
  allData.forEach((row, idx) => {
    if (idx === 0 || !row[0]) return;
    const d = row[0] instanceof Date ? new Date(row[0].getTime()) : new Date(row[0]);
    if (isNaN(d.getTime())) return;
    d.setHours(0, 0, 0, 0);
    if (d.getTime() !== targetTime) return;
    report.allRows.push({
      rowNumber: idx + 1,
      balls: row.slice(1, ballCount + 1).map(Number),
      s1: config.hasS1 ? Number(row[ballCount + 1]) : null,
    });
  });
  if (report.allRows.length === 0) report.notes.push("All 無此日期列");
  if (report.allRows.length > 1) report.notes.push("All 有重複日期列共 " + report.allRows.length + " 筆");

  // 2. predic1_History 快取列（同日期所有 topN/模式變體）
  const histSheet = sheets.p1SS.getSheetByName("predic1_History");
  if (histSheet && histSheet.getLastRow() > 0) {
    const hdata = histSheet.getDataRange().getValues();
    hdata.forEach((row, idx) => {
      if (idx === 0 || String(row[1]).trim() !== lotto) return;
      if (!row[2]) return;
      const d = row[2] instanceof Date ? new Date(row[2].getTime()) : new Date(row[2]);
      if (isNaN(d.getTime())) return;
      d.setHours(0, 0, 0, 0);
      if (d.getTime() !== targetTime) return;
      report.cachedRows.push({ rowNumber: idx + 1, type: row[0], topN: row[3], trend: row[4], hits: row[5], balls: row[6] });
    });
  }
  if (report.cachedRows.length === 0) report.notes.push("History 無此日期快取列");

  // 3. 略過快取直接重算（與 getRecentHistoryHits 同一路徑）
  try {
    const allDataRaw = allData.slice(1)
      .filter((row) => row[0] && (row[0] instanceof Date || !isNaN(new Date(row[0]).getTime())))
      .map((row) => {
        const r = row.slice();
        r[0] = r[0] instanceof Date ? new Date(r[0].getTime()) : new Date(r[0]);
        r[0].setHours(0, 0, 0, 0);
        return r;
      })
      .sort((a, b) => a[0] - b[0]);
    let idx = -1;
    for (let i = allDataRaw.length - 1; i >= 0; i--) {
      if (allDataRaw[i][0].getTime() === targetTime) { idx = i; break; }
    }
    if (idx === -1) {
      report.notes.push("排序後找不到此日期");
    } else {
      const record = allDataRaw[idx];
      const train = allDataRaw.slice(Math.max(0, idx - 250), idx);
      const validated = validatePrct1TrainingData(train, config);
      if (!validated.validData || validated.validData.length < 5) {
        report.notes.push("訓練集不足 5 筆");
      } else {
        const missSheet = useTrend ? sheets.missSS.getSheetByName("Miss") : null;
        const missDataFull = missSheet ? missSheet.getDataRange().getValues() : null;
        const allHeaders = sheets.allSS.getSheetByName("All").getRange(1, 1, 1, 50).getValues()[0];
        const ziWeiHouseNames = ["本命", "父母", "福德", "田宅", "官祿", "奴僕", "遷移", "疾厄", "財帛", "子女", "夫妻", "兄弟", "時柱", "日五形", "日十二建除", "日九星", "日二十八星宿", "時二十八星宿", "日八掛"];
        const ziWeiIndices = ziWeiHouseNames.map((name, hidx) => {
          const idStandard = "strp" + String(hidx + 1).padStart(2, "0");
          const colIdx = allHeaders.findIndex((h) => String(h).trim() === name || String(h).trim() === idStandard);
          return { id: idStandard, name: name, colIdx: colIdx };
        }).filter((h) => h.colIdx !== -1);
        const ziWeiEnv = ziWeiIndices.map((h) => ({ id: h.id, name: h.name, val: String(record[h.colIdx]), idx: h.colIdx }));
        const prevRecord = idx > 0 ? allDataRaw[idx - 1] : null;
        const vSig = getPredic1SignalParams(allHeaders, record, prevRecord, validated.validData, config, new Date(targetTime));
        const pred = corePredict(lotto, validated.validData, missDataFull, new Date(targetTime), vSig.signalBoost, vSig.yearStem, vSig.isYearDayHarmony, vSig.tripleElement, topN, vSig.isConsecutiveTrend, sheets.p1SS, ziWeiEnv, allDataRaw.slice(0, idx + 1));
        const actualNums = record.slice(1, config.hasS1 ? 8 : 6).map(Number).filter((n) => n > 0);
        const freshBalls = pred.numbers.slice(0, topN).filter((n) => actualNums.includes(Number(n.number))).map((n) => n.number);
        report.fresh = { balls: freshBalls, hits: freshBalls.length, actualNums: actualNums };
      }
    }
  } catch (e) {
    report.notes.push("重算失敗: " + e.message);
  }

  // 4. 自動判定
  const cached = report.cachedRows.find((r) => String(r.topN) === String(topN) && String(r.trend) === String(useTrend));
  if (cached && report.fresh) {
    if (String(cached.hits) !== String(report.fresh.hits)) {
      report.notes.push("快取命中數(" + cached.hits + ")與重算(" + report.fresh.hits + ")不一致→陳舊快取（All 事後被修正或權重已演化），請清掉該快取列後重跑回測");
    }
    const actualSet = new Set(report.fresh.actualNums);
    const phantom = (report.fresh.balls || []).filter((b) => !actualSet.has(Number(b)));
    if (phantom.length > 0) {
      report.notes.push("重算仍命中實際沒有的球:" + JSON.stringify(phantom) + "→計算切片或 All 資料有問題，請貼此報告處理");
    }
    if (report.notes.length === 0) report.notes.push("三方一致：快取正確，請確認比對的是否為同一年同一日期");
  }

  Logger.log("[VerifyHistory]\n" + JSON.stringify(report));
  return report;
}

/**
 * 數據分析師擴充：執行環境平衡因子 (奇偶、大小) 與和值引力修正 (基於振幅趨勢)
 * @param {Object} finalWeights 權重物件
 * @param {string} lotto 彩種
 * @param {Array} trainingData 訓練集
 */
function applyAnalystFilters(finalWeights, lotto, trainingData) {
  const config = getPredic1LottoConfig(lotto);
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
 * 自動學習框架：根據 predic1_Settings 中的命中紀錄微調 baseWeights
 * predic1_Settings 為 7 欄執行紀錄格式（執行時間/預測日期/相關係數/推薦數/遺漏模式/變動參數摘要/備註）
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
  const lastLearnCount = getPredic1PropertyValue(
    "predic1_Property",
    cacheKey + "_LEARN_COUNT",
    0,
    ss,
  );
  if (fullData.length <= lastLearnCount + 5 && lastLearnCount > 0) return;

  const LEARNING_MIN_RECORDS = 10; // 至少需要 10 筆紀錄才啟動學習
  const LEARNING_DECAY_FACTOR = 0.9; // 舊紀錄的影響力衰減

  if (fullData.length <= LEARNING_MIN_RECORDS) {
    setPredic1PropertyValue("predic1_Property", cacheKey, adjustedWeights, ss);
    return;
  }

  const headers = fullData[0];
  const correlationIdx = headers.indexOf("相關係數");
  const changedParamsIdx = headers.indexOf("變動參數摘要");
  const remarksIdx = headers.indexOf("備註");

  if (correlationIdx === -1 || changedParamsIdx === -1 || remarksIdx === -1) {
    setPredic1PropertyValue("predic1_Property", cacheKey, adjustedWeights, ss);
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
    setPredic1PropertyValue("predic1_Property", cacheKey, adjustedWeights, ss);
    // 紀錄目前的學習總數
    setPredic1PropertyValue(
      "predic1_Property",
      cacheKey + "_LEARN_COUNT",
      fullData.length,
      ss,
    );
    Logger.log(`[AutoLearn] ${lotto} 基礎權重已自動微調並存入試算表。`);
  } catch (e) {
    logSystemError("autoAdjustBaseWeights", e.message, "ERROR", `${lotto} 權重更新失敗`);
    Logger.log(`[AutoLearn Error] ${lotto} 權重寫入失敗: ` + e.message);
  }
}

/**
 * 寫入 KV 資料至屬性工作表，確保 Key 不重複（Prediction1 模組專用執行緒快取版）。
 * 命名加上 Predic1 前綴，避免覆蓋 Utility.js 的全域 setPropertySheetValue；勿改為 Predict 模組寫法。
 */
function setPredic1PropertyValue(sheetName, key, value, ss) {
  try {
    // 清除快取，確保下次讀取為最新值
    const cacheKey = ss.getId() + "_" + sheetName;
    delete _predic1_propertyCache[cacheKey];

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
    Logger.log(`[setPredic1PropertyValue Error] ${e.message}`);
  }
}

/**
 * 從屬性工作表讀取資料（Prediction1 模組專用執行緒快取版）。
 * 命名加上 Predic1 前綴，避免覆蓋 Utility.js 的全域 getPropertySheetValue；勿改為 Predict 模組寫法。
 */
function getPredic1PropertyValue(sheetName, key, defaultValue, ss) {
  try {
    const ssId = ss.getId();
    const cacheKey = ssId + "_" + sheetName;

    // 效能優化：如果該執行緒尚未讀取過此工作表，則一次性讀取並快取
    if (!_predic1_propertyCache[cacheKey]) {
      const sheet = ss.getSheetByName(sheetName);
      if (!sheet) return defaultValue;
      const data = sheet.getDataRange().getValues();
      const map = {};
      data.forEach((row) => {
        if (row[0]) map[String(row[0])] = row[1];
      });
      _predic1_propertyCache[cacheKey] = map;
    }

    const val = _predic1_propertyCache[cacheKey][String(key)];
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
    // 新架構：權重屬性位於 {lotto}_Prediction1 試算表 > predic1_Property 工作表
    const ss = getPrediction1Spreadsheets(lotto).p1SS;
    const weightData = getLearnedBaseWeights(lotto, ss);

    // 讀取額外的元數據
    const learnCountKey =
      PRCT1_ALGO_VERSION + "_LEARNED_WEIGHTS_" + lotto + "_LEARN_COUNT";
    const learnCount = getPredic1PropertyValue(
      "predic1_Property",
      learnCountKey,
      0,
      ss,
    );

    return {
      ...weightData,
      learnCount: learnCount,
      algoVersion: PRCT1_ALGO_VERSION,
      isDefault: !getPredic1PropertyValue(
        "predic1_Property",
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
  let cached = getPredic1PropertyValue("predic1_Property", cacheKey, null, ss);

  // --- 強化：版本權重繼承機制 ---
  // 若當前版本無紀錄，搜尋所有版本的學習權重並選取最新的一個繼承，防止 AI 重置
  if (!cached) {
    const ssId = ss.getId();
    const cacheKeyInThread = ssId + "_predic1_Property";
    // 確保 internal cache 已載入
    getPredic1PropertyValue("predic1_Property", "DUMMY_VERSION_SCAN", null, ss);
    const fullCache = _predic1_propertyCache[cacheKeyInThread] || {};
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
 * V1 系統專屬快取清理：僅清理 predic1_Property 與 V1 演算法相關的 Properties
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

    // 清理試算表持久快取（新架構：{lotto}_Prediction1 試算表 > predic1_Property，Prediction1 專用）
    const p1SS = getPrediction1Spreadsheets(lotto).p1SS;
    ensurePrediction1Sheets(p1SS);
    const propSheet = p1SS.getSheetByName("predic1_Property");
    if (propSheet) {
      // 保留標題列，清除內容
      const lastRow = propSheet.getLastRow();
      const lastCol = propSheet.getLastColumn();
      if (lastRow > 1)
        propSheet.getRange(2, 1, lastRow - 1, lastCol).clearContent(); // 修正：清除所有欄位
    }
    // 同步清除本模組執行緒快取，避免清除後仍讀到舊值
    delete _predic1_propertyCache[p1SS.getId() + "_predic1_Property"];

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
    // 新架構：屬性位於 {lotto}_Prediction1 試算表 > predic1_Property 工作表
    const ss = getPrediction1Spreadsheets(lotto).p1SS;
    const propSheet = ss.getSheetByName("predic1_Property");

    return {
      version: PRCT1_ALGO_VERSION,
      rowCount: propSheet ? propSheet.getLastRow() : 0,
    };
  } catch (e) {
    return { version: PRCT1_ALGO_VERSION, rowCount: 0, piCount: 0 };
  }
}

/**
 * 清理 V1 專屬的舊版本歷史回測紀錄 (predic1_History)
 * 僅移除版本號不相符的資料，保留目前版本的紀錄。
 */
function clearPrediction1History(lotto) {
  try {
    // 新架構：歷史紀錄位於 {lotto}_Prediction1 試算表 > predic1_History 工作表（Prediction1 專用，勿用 prct1_History）
    const ss = getPrediction1Spreadsheets(lotto).p1SS;
    const historySheet = ensurePrediction1Sheets(ss).historySheet;

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
 * 自動管理 predic1_Property：清理過舊版本的快取資料。
 * 儲存邏輯：允許不同版本的資料共存。
 * 管理邏輯：保留最近 2 個演算法版本 (如 A107, A106) 的資料，其餘自動刪除。
 * @param {GoogleAppsScript.Spreadsheet.Spreadsheet} ss 目標彩種試算表
 */
function managePredic1PropertyVersions(ss) {
  try {
    const propSheet = ss.getSheetByName("predic1_Property");
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
