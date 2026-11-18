const GAME_CONFIG = {
  L539: { maxNum: 39, hasS1: false, maxSpecial: 0 },
  L649: { maxNum: 49, hasS1: true, maxSpecial: 0 },
  LSix: { maxNum: 49, hasS1: true, maxSpecial: 0 },
  L638: { maxNum: 38, hasS1: true, maxSpecial: 8 },
};

/**
 * 新架構試算表解析（資料夾 > 試算表 > 工作表），Miss 模組專用：
 *   All  ← {lotto} 試算表
 *   Miss ← {lotto}_Miss 試算表
 * 每彩種需 Sheets 註冊表含 {lotto}、{lotto}_Miss 兩筆（4 彩種共 8 筆）。
 */
function getMissSpreadsheets(lotto) {
  var allSS = getMissSpreadsheetEntry(lotto);
  var missSS = getMissSpreadsheetEntry(lotto + "_Miss");
  return { allSS: allSS, missSS: missSS };
}

/**
 * 開啟 Sheets 註冊表指定鍵的試算表；鍵缺失或 URL 無效時拋出可讀錯誤。
 * Miss 模組專用（鍵為 {lotto} / {lotto}_Miss）。
 */
function getMissSpreadsheetEntry(key) {
  var trObj = null;
  try {
    trObj = getTargetsheet("Sheets", key);
  } catch (e) {
    throw new Error("Sheets 註冊表缺少 Miss 專用鍵 [" + key + "] 或開啟失敗（" + e.message + "），請補上每彩種 {彩種}、{彩種}_Miss 共 8 筆註冊");
  }
  if (!trObj || !trObj.spreadsheet) {
    throw new Error("Sheets 註冊表缺少 Miss 專用鍵 [" + key + "]，請補上每彩種 {彩種}、{彩種}_Miss 共 8 筆註冊");
  }
  return trObj.spreadsheet;
}

/**
 * 驗證 Miss 新架構 Sheets 註冊表（唯讀，不寫入）。
 * 僅檢查本模組所需的 4 彩種 × 2 筆：{lotto}、{lotto}_Miss（共 8 筆）。
 * 部署前在 GAS 編輯器執行一次即可。
 * @returns {Object} { status, checked, missing }
 */
function verifyMissRegistry() {
  var lottos = ["L539", "L649", "L638", "LSix"];
  var suffixes = ["", "_Miss"];
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
 * 篩選後的資料長度相同 → 直接合併輸出
 * SourceTemp 與 MissTemp 皆為 ASC 排序且日期一一對應
 */
function mergeMissData(sourceRows, missRows, sourceHeaders, missHeaders, dateCol) {
  const missDateCol = missHeaders.indexOf("Date");
  const mStartIdx = missHeaders.findIndex(h => h.startsWith("M")) || (missHeaders.length - 1);
  const mColCount = missHeaders.length - mStartIdx;

  return sourceRows.map((srcRow, i) => {
    const missRow = missRows[i];
    const result = srcRow.slice();
    for (let c = 0; c < mColCount; c++) {
      result.push(missRow[mStartIdx + c] !== undefined ? missRow[mStartIdx + c] : 0);
    }
    return result;
  });
}

/**
 * 篩選後的資料長度不同 → 補算遺漏數
 */
function fillMissData(sourceRows, missRows, lotto, dateCol) {
  const config = GAME_CONFIG[lotto] || GAME_CONFIG["L539"];
  const { maxNum, hasS1, maxSpecial } = config;

  const nCols = [];
  for (let c = 1; c <= (lotto === "L539" ? 5 : 6); c++) nCols.push(c);
  const nStartIdx = dateCol + 1;

  let prevMiss = [];
  let prevSpecialMiss = [];

  if (missRows && missRows.length > 0) {
    const mStartIdx = missRows[missRows.length - 1].length - maxNum - maxSpecial;
    for (let j = 0; j < maxNum; j++) prevMiss.push(Number(missRows[missRows.length - 1][mStartIdx + j]) || 0);
    if (maxSpecial > 0) {
      for (let j = 0; j < maxSpecial; j++) prevSpecialMiss.push(Number(missRows[missRows.length - 1][mStartIdx + maxNum + j]) || 0);
    }
  }

  var missDateLookup = {};
  if (missRows && missRows.length > 0) {
    for (var _mi = 0; _mi < missRows.length; _mi++) {
      (function(r) {
        var d = r[1];
        if (d) missDateLookup[new Date(d).getTime()] = true;
      })(missRows[_mi]);
    }
  }
  var missDateCol = missRows && missRows.length > 0 ? 1 : -1;

  for (var i = 0; i < sourceRows.length; i++) {
    var srcRow = sourceRows[i];
    var srcDate = srcRow[dateCol];

    if (missRows && missDateCol > -1) {
      if (missDateLookup[new Date(srcDate).getTime()]) continue;
    }

    const drawnNums = [];
    for (let c = 0; c < nCols.length; c++) {
      drawnNums.push(srcRow[nStartIdx + c]);
    }
    const s1Val = hasS1 ? srcRow[nStartIdx + nCols.length] : null;

    let poolSet = new Set(drawnNums);
    if (hasS1 && lotto !== "L638" && s1Val !== null) poolSet.add(s1Val);

    let currentMiss = [];
    for (let j = 1; j <= maxNum; j++) {
      if (prevMiss.length === 0) {
        currentMiss.push(poolSet.has(j) ? 0 : 1);
      } else {
        currentMiss.push(poolSet.has(j) ? 0 : (Number(prevMiss[j - 1]) || 0) + 1);
      }
    }
    prevMiss = currentMiss;

    let currentSpecialMiss = [];
    if (maxSpecial > 0) {
      for (let j = 1; j <= maxSpecial; j++) {
        if (prevSpecialMiss.length === 0) {
          currentSpecialMiss.push(s1Val === j ? 0 : 1);
        } else {
          currentSpecialMiss.push(s1Val === j ? 0 : (Number(prevSpecialMiss[j - 1]) || 0) + 1);
        }
      }
      prevSpecialMiss = currentSpecialMiss;
    }

    let missRow = [0, srcRow[dateCol]];
    for (let c = 0; c < nCols.length; c++) missRow.push(srcRow[nStartIdx + c]);
    if (hasS1) missRow.push(s1Val);
    missRow.push(srcRow[nStartIdx + nCols.length + (hasS1 ? 1 : 0)]);
    missRow = missRow.concat(currentMiss);
    if (maxSpecial > 0) missRow = missRow.concat(currentSpecialMiss);

    if (missRows) missRows.push(missRow);
    else missRows = [missRow];
  }

  const mStartIdx = missRows[0] ? (missRows[0].length - maxNum - maxSpecial) : 0;

  var missDateMap = {};
  var missDateExample = null;
  for (var mi = 0; mi < missRows.length; mi++) {
    (function(r) {
      if (r[1]) {
        var ts = new Date(r[1]).getTime();
        missDateMap[ts] = r;
        if (!missDateExample) missDateExample = { raw: r[1], ts: ts };
      }
    })(missRows[mi]);
  }

  Logger.log("[fillMissData] mStartIdx=%d maxNum=%d missRows=%d missDateMapKeys=%d", mStartIdx, maxNum, missRows ? missRows.length : 0, Object.keys(missDateMap).length);
  Logger.log("[fillMissData] example miss date: raw=%s ts=%s", String(missDateExample ? missDateExample.raw : "null"), missDateExample ? missDateExample.ts : "null");

  return sourceRows.map(function(srcRow) {
    var srcDate = new Date(srcRow[dateCol]).getTime();
    var matchedMiss = missDateMap[srcDate] || null;

    // Debug: log for 2026-06-16
    var dStr = srcRow[dateCol] instanceof Date ? Utilities.formatDate(srcRow[dateCol], "Asia/Taipei", "yyyy-MM-dd") : String(srcRow[dateCol]);
    if (dStr === "2026-06-16") {
      Logger.log("[fillMissData] target date=%s srcDate ts=%s found=%s mStartIdx=%d", dStr, srcDate, !!matchedMiss, mStartIdx);
      if (matchedMiss) {
        var sample = [];
        for (var sc = 0; sc < 10 && sc < maxNum + maxSpecial; sc++) sample.push(matchedMiss[mStartIdx + sc]);
        Logger.log("[fillMissData] first 10 M values: %s", JSON.stringify(sample));
      }
    }

    var result = srcRow.slice();
    if (matchedMiss) {
      for (var c = 0; c < maxNum + maxSpecial; c++) {
        result.push(matchedMiss[mStartIdx + c]);
      }
    } else {
      for (var c = 0; c < maxNum + maxSpecial; c++) result.push(0);
    }
    return result;
  });
}

/**
 * 取得 Miss 工作表的遊戲組態
 */
function getGameConfig(lotto) {
  return GAME_CONFIG[lotto] || GAME_CONFIG["L539"];
}

/**
 * 將遺漏資料寫入 Miss 工作表（各彩種子試算表）
 * @param {string} lotto 彩種
 * @param {number} methodSN 方法序號
 * @param {Array<Array>} dataRows 資料列（含 lngMethodSN 欄位）
 * @param {Object} config 遊戲組態 { maxNum, hasS1, maxSpecial }
 */
function writeMissSheet(lotto, methodSN, dataRows, config) {
  // 新架構：Miss ← {lotto}_Miss 試算表
  const ss = getMissSpreadsheets(lotto).missSS;
  let sheet = ss.getSheetByName("Miss");
  const { maxNum, hasS1, maxSpecial } = config;

  const headers = ["lngMethodSN", "Date"];
  const nCount = (lotto === "L539" ? 5 : 6);
  for (let j = 1; j <= nCount; j++) headers.push("N" + j);
  if (hasS1) headers.push("S1");
  headers.push("Sum");
  for (let j = 1; j <= maxNum; j++) headers.push("M" + j);
  for (let j = 1; j <= maxSpecial; j++) headers.push("MS" + j);

  function _safeRows(rows) {
    return rows.map(function(r) {
      var s = [];
      for (var ci = 0; ci < r.length; ci++) {
        var v = r[ci];
        if (v == null) { s.push(""); continue; }
        if (ci === 1 && !(v instanceof Date)) {
          var p = new Date(String(v).replace(/-/g, "/"));
          s.push(isNaN(p.getTime()) ? String(v) : p);
        } else {
          s.push(v);
        }
      }
      return s;
    });
  }

  if (!sheet) {
    sheet = ss.insertSheet("Miss");
    sheet.appendRow(headers);
    if (dataRows.length > 0) {
      var safeData = _safeRows(dataRows);
      sheet.getRange(2, 1, safeData.length, safeData[0].length).setValues(safeData);
    }
    return;
  }

  const existingData = sheet.getDataRange().getValues();
  const existingHeaders = existingData[0].map(h => String(h || "").trim());
  const snCol = existingHeaders.indexOf("lngMethodSN");
  const hasOldFormat = (snCol === -1 || existingHeaders[0] !== "lngMethodSN");

  if (hasOldFormat) {
    sheet.clear();
    sheet.appendRow(headers);
    if (dataRows.length > 0) {
      var safeData = _safeRows(dataRows);
      sheet.getRange(2, 1, safeData.length, safeData[0].length).setValues(safeData);
    }
    return;
  }

  const dateCol = existingHeaders.indexOf("Date");
  const existingDates = new Set();
  for (let i = 1; i < existingData.length; i++) {
    if (Number(existingData[i][snCol]) === methodSN) {
      const d = existingData[i][dateCol];
      if (d) existingDates.add(Utilities.formatDate(new Date(d), "Asia/Taipei", "yyyy-MM-dd"));
    }
  }

  const newRows = [];
  for (let i = 0; i < dataRows.length; i++) {
    const d = dataRows[i][1];
    if (!d) { newRows.push(dataRows[i]); continue; }
    if (!existingDates.has(Utilities.formatDate(new Date(d), "Asia/Taipei", "yyyy-MM-dd"))) {
      newRows.push(dataRows[i]);
    }
  }

  if (newRows.length === 0) return;

  try {
    var safeRows = _safeRows(newRows);
    const lastRow = sheet.getLastRow();
    sheet.getRange(lastRow + 1, 1, safeRows.length, safeRows[0].length).setValues(safeRows);
  } catch (e) {
    logSystemError("writeMissSheet", e.toString(), "ERROR", "setValues 失敗", {
      lotto: lotto,
      methodSN: methodSN,
      safeRowsLen: safeRows.length,
    });
    throw e;
  }
}

/**
 * 產生遺漏數資料並寫入 Miss 工作表
 * @param {string} lotto 彩種
 * @param {Date|string} date 基準日期
 * @param {number|Object} methodRef 方法序號(1=全資料) 或方法物件
 * @param {string} sort 排序 DESC/ASC
 * @param {number} limit 回傳筆數 (-1 不限制)
 * @returns {Array<Array>} 遺漏數資料
 */
function genMissData(lotto, date, methodRef, sort = "DESC", limit) {
  startTime = new Date().getTime();

  const isBaseData = (methodRef === 1 || methodRef === "1");
  let methodObj = isBaseData ? {} : (typeof methodRef === "object" ? methodRef : getMethodObj(Number(methodRef)));
  const methodSN = isBaseData ? 1 : (typeof methodRef === "object" ? getMethodSN(methodRef) : Number(methodRef));

  if (!methodObj) return [];

  Logger.log("[genMissData] start lotto=%s methodSN=%s", lotto, methodSN);

  var progressKey;
  try {
    progressKey = "GENMISS_JOB_" + lotto + "_" + methodSN;
    // 新架構：All ← {lotto} 試算表；Miss ← {lotto}_Miss 試算表
    const sheets = getMissSpreadsheets(lotto);
    const allSheet = sheets.allSS.getSheetByName("All");
    if (!allSheet) {
      Logger.log("[genMissData] no All sheet for %s", lotto);
      return [];
    }
    const rawAllData = allSheet.getDataRange().getValues();
    if (rawAllData.length <= 1) {
      Logger.log("[genMissData] All sheet only has headers for %s", lotto);
      return [];
    }
    const targetDate2 = new Date(String(date).replace(/-/g, "/"));
    const rawHeaders2 = rawAllData[0].map(h => String(h || "").trim());
    const dateIdx2 = rawHeaders2.indexOf("Date");
    const rawHeaders = rawHeaders2;

    const dateCol = rawHeaders.indexOf("Date");
    const nCols = rawHeaders.map((h, i) => h.match(/^N\d+$/) ? i : -1).filter(i => i !== -1);
    const s1Col = rawHeaders.indexOf("S1");
    const sumCol = rawHeaders.indexOf("Sum");

    const config = getGameConfig(lotto);
    const { maxNum, hasS1, maxSpecial } = config;

    const missHeaders = buildMissHeaders(config, lotto);

    // 先檢查是否有續傳進度（中斷續跑時不進行增量過濾）
    let progress = getProgress(progressKey);

    // 只在全新執行（無續傳進度）時讀取現有 Miss 資料，做增量過濾
    let lastMissDate = null;
    let initPrevMiss = [];
    let initPrevSpecialMiss = [];
    if (!progress) {
      const existingMissSheet = sheets.missSS.getSheetByName("Miss");
      if (existingMissSheet) {
        const existingData = existingMissSheet.getDataRange().getValues();
        if (existingData.length > 1) {
          const missH = existingData[0].map(function(c) { return String(c || "").trim(); });
          const msnCol = missH.indexOf("lngMethodSN");
          const mDateCol = missH.indexOf("Date");
          const m1Col = missH.indexOf("M1");
          if (msnCol > -1 && mDateCol > -1 && m1Col > -1) {
            const methodRows = [];
            for (let ei = 1; ei < existingData.length; ei++) {
              if (Number(existingData[ei][msnCol]) === methodSN) methodRows.push(existingData[ei]);
            }
            if (methodRows.length > 0) {
              methodRows.sort(function(a, b) { return new Date(b[mDateCol]) - new Date(a[mDateCol]); });
              const lastRow = methodRows[0];
              lastMissDate = lastRow[mDateCol] instanceof Date ? lastRow[mDateCol] : new Date(String(lastRow[mDateCol]).replace(/-/g, "/"));
              for (let j = 0; j < maxNum; j++) initPrevMiss.push(Number(lastRow[m1Col + j]) || 0);
              if (maxSpecial > 0) {
                const ms1Col = missH.indexOf("MS1");
                if (ms1Col > -1) {
                  for (let j = 0; j < maxSpecial; j++) initPrevSpecialMiss.push(Number(lastRow[ms1Col + j]) || 0);
                }
              }
            }
          }
        }
      }
    }

    const sourceData = rawAllData.slice(1)
      .filter(function(r) {
        if (!r[dateIdx2]) return false;
        var rd = new Date(r[dateIdx2]);
        if (rd >= targetDate2) return false;
        if (lastMissDate && rd <= lastMissDate) return false;
        return true;
      })
      .sort(function(a, b) { return new Date(a[dateIdx2]) - new Date(b[dateIdx2]); });

    Logger.log("[genMissData] lotto=%s methodSN=%s lastMissDate=%s newRows=%d progress=%s", lotto, methodSN, lastMissDate, sourceData ? sourceData.length : 0, !!progress);
    if (!sourceData || sourceData.length === 0) {
      Logger.log("[genMissData] no new source data to process");
      clearProgress(progressKey);
      return [];
    }

    let startIndex = 0;
    let prevMiss = initPrevMiss.length > 0 ? initPrevMiss : [];
    let prevSpecialMiss = initPrevSpecialMiss.length > 0 ? initPrevSpecialMiss : [];
    let missResults = [];
    let isFirstBatch = !lastMissDate;

    if (progress) {
      startIndex = progress.currentIndex || 0;
      prevMiss = progress.prevMiss || [];
      prevSpecialMiss = progress.prevSpecialMiss || [];
      isFirstBatch = false;
    }

    const ss = sheets.missSS;
    const maxLoopTime = 8000;

    for (let i = startIndex; i < sourceData.length; i++) {
      const row = sourceData[i];
      const drawnNums = nCols.map(idx => row[idx]);
      const s1Val = s1Col > -1 ? row[s1Col] : null;
      const sumVal = sumCol > -1 ? row[sumCol] : null;

      let poolSet = new Set(drawnNums);
      if (hasS1 && lotto !== "L638" && s1Val !== null) poolSet.add(s1Val);

      let currentMiss = [];
      for (let j = 1; j <= maxNum; j++) {
        if (prevMiss.length === 0) {
          currentMiss.push(poolSet.has(j) ? 0 : 1);
        } else {
          currentMiss.push(poolSet.has(j) ? 0 : (Number(prevMiss[j - 1]) || 0) + 1);
        }
      }
      prevMiss = currentMiss;

      let currentSpecialMiss = [];
      if (maxSpecial > 0) {
        for (let j = 1; j <= maxSpecial; j++) {
          if (prevSpecialMiss.length === 0) {
            currentSpecialMiss.push(s1Val === j ? 0 : 1);
          } else {
            currentSpecialMiss.push(s1Val === j ? 0 : (Number(prevSpecialMiss[j - 1]) || 0) + 1);
          }
        }
        prevSpecialMiss = currentSpecialMiss;
      }

      let dateVal = row[dateCol];
      if (dateVal != null && !(dateVal instanceof Date)) {
        var parsed = new Date(String(dateVal).replace(/-/g, "/"));
        dateVal = isNaN(parsed.getTime()) ? String(dateVal) : parsed;
      }
      let newRow = [methodSN, dateVal];
      nCols.forEach(idx => newRow.push(row[idx] == null ? "" : row[idx]));
      if (hasS1) newRow.push(s1Val == null ? "" : s1Val);
      if (sumVal !== null) newRow.push(sumVal == null ? "" : sumVal);
      newRow = newRow.concat(currentMiss);
      if (maxSpecial > 0) newRow = newRow.concat(currentSpecialMiss);
      missResults.push(newRow);

      // 攒批寫入：每 200 筆寫一次；只有接近超時或單次執行過久才存檔續傳。
      // （新架構初次回填動輒數千筆，若每 50 筆就續傳一次，排程 5 分鐘一支會永遠追不上日期）
      if (missResults.length >= 200 || isNearTimeout()) {
        const nextIndex = i + 1;

        if (missResults.length > 0) {
          Logger.log("[genMissData] batch write at i=%d nextIdx=%d rows=%d isFirst=%s", i, nextIndex, missResults.length, isFirstBatch);
          writeMissBatchDirect(ss, lotto, methodSN, missHeaders, missResults, isFirstBatch);
          missResults = [];
          SpreadsheetApp.flush();
          isFirstBatch = false;
        }

        const elapsed = new Date().getTime() - startTime;
        if (nextIndex < sourceData.length && (isNearTimeout() || elapsed > 25000)) {
          saveProgress(progressKey, {
            status: "continue",
            currentIndex: nextIndex,
            total: sourceData.length,
            prevMiss: prevMiss,
            prevSpecialMiss: prevSpecialMiss,
          });

          return {
            status: "continue",
            message: "遺漏計算中 " + nextIndex + " / " + sourceData.length,
            currentIndex: nextIndex,
            total: sourceData.length,
          };
        }
      }
    }

    if (missResults.length > 0) {
      Logger.log("[genMissData] final batch write: rows=%d isFirst=%s", missResults.length, isFirstBatch);
      writeMissBatchDirect(ss, lotto, methodSN, missHeaders, missResults, isFirstBatch);
      missResults = [];
      SpreadsheetApp.flush();
    }

    Logger.log("[genMissData] clearing progress key=%s", progressKey);
    clearProgress(progressKey);

    const missSheet = ss.getSheetByName("Miss");
    let outputData = [];
    if (missSheet) {
      const allData2 = missSheet.getDataRange().getValues();
      const h2 = allData2[0].map(c => String(c || "").trim());
      const snCol2 = h2.indexOf("lngMethodSN");
      const dateCol2 = h2.indexOf("Date");
      if (snCol2 > -1 && dateCol2 > -1) {
        outputData = allData2.slice(1).filter(r => Number(r[snCol2]) === methodSN);
        if (sort === "DESC") {
          outputData.sort((a, b) => new Date(b[dateCol2]) - new Date(a[dateCol2]));
        } else {
          outputData.sort((a, b) => new Date(a[dateCol2]) - new Date(b[dateCol2]));
        }
      }
    }
    const finalLimit = (limit !== undefined && limit !== null) ? parseInt(limit, 10) : -1;
    if (finalLimit > 0) outputData = outputData.slice(0, finalLimit);

    Logger.log("[genMissData] complete lotto=%s rows=%s", lotto, outputData.length);
    return outputData;
  } catch (e) {
    Logger.log("[genMissData] ERROR lotto=%s err=%s", lotto, e.message);
    logSystemError("genMissData", "genMissData error: " + e.message, {lotto, methodSN});
    clearProgress(progressKey);
    return [];
  }
}

function buildMissHeaders(config, lotto) {
  const { maxNum, hasS1, maxSpecial } = config;
  const headers = ["lngMethodSN", "Date"];
  const nCount = (lotto === "L539" ? 5 : 6);
  for (let j = 1; j <= nCount; j++) headers.push("N" + j);
  if (hasS1) headers.push("S1");
  headers.push("Sum");
  for (let j = 1; j <= maxNum; j++) headers.push("M" + j);
  for (let j = 1; j <= maxSpecial; j++) headers.push("MS" + j);
  return headers;
}

/**
 * 尾段修補（只附加、不刪除）：把 All 有、Miss（該 methodSN）缺的尾段日期補上。
 * 用於回填後發現最新 1~2 期缺失時執行。不帶參數會 4 彩種全補（methodSN=1）。
 * 在 GAS 編輯器直接執行 repairMissTail() 即可（不需參數）。
 * @param {string} lotto 彩種（省略則 4 彩種全補）
 * @param {number} methodSN 方法序號（預設 1）
 * @returns {string} 執行報告
 */
function repairMissTail(lotto, methodSN) {
  startTime = new Date().getTime();
  if (!lotto) {
    var reports = ["L539", "L649", "L638", "LSix"].map(function(l) {
      try {
        return l + ": " + repairMissTailSingle(l, methodSN);
      } catch (e) {
        return l + ": 失敗(" + e.message + ")";
      }
    });
    return reports.join("\n");
  }
  return lotto + ": " + repairMissTailSingle(lotto, methodSN);
}

function repairMissTailSingle(lotto, methodSN) {
  methodSN = Number(methodSN) || 1;
  var sheets = getMissSpreadsheets(lotto);
  var allSheet = sheets.allSS.getSheetByName("All");
  if (!allSheet || allSheet.getLastRow() <= 1) return "找不到 All 或無資料";
  var missSheet = sheets.missSS.getSheetByName("Miss");
  if (!missSheet || missSheet.getLastRow() <= 1) return "找不到 Miss 或無資料（請先跑一次 Miss 更新建表）";

  var toTime = function(v) {
    if (!v) return -1;
    var d = v instanceof Date ? v : new Date(String(v).replace(/-/g, "/"));
    return isNaN(d.getTime()) ? -1 : d.getTime();
  };
  var fmtD = function(t) { return Utilities.formatDate(new Date(t), "Asia/Taipei", "yyyy-MM-dd"); };

  var config = getGameConfig(lotto);
  var maxNum = config.maxNum, hasS1 = config.hasS1, maxSpecial = config.maxSpecial;
  var missHeaders = buildMissHeaders(config, lotto);

  var allData = allSheet.getDataRange().getValues();
  var ah = allData[0].map(function(c) { return String(c || "").trim(); });
  var dateCol = ah.indexOf("Date");
  if (dateCol === -1) return "All 缺少 Date 欄";
  var nCols = ah.map(function(h, i) { return /^N\d+$/.test(h) ? i : -1; }).filter(function(i) { return i !== -1; });
  var s1Col = ah.indexOf("S1");
  var sumCol = ah.indexOf("Sum");

  var missData = missSheet.getDataRange().getValues();
  var mh = missData[0].map(function(c) { return String(c || "").trim(); });
  var msnCol = mh.indexOf("lngMethodSN");
  var mDateCol = mh.indexOf("Date");
  var m1Col = mh.indexOf("M1");
  var ms1Col = mh.indexOf("MS1");
  if (msnCol === -1 || mDateCol === -1 || m1Col === -1) return "Miss 標頭不符（缺 lngMethodSN/Date/M1）";

  // 該 methodSN 已有日期 + 最新一列的遺漏狀態
  var have = {};
  var lastT = -1, prevMiss = [], prevSpecialMiss = [];
  for (var i = 1; i < missData.length; i++) {
    if (Number(missData[i][msnCol]) !== methodSN) continue;
    var t = toTime(missData[i][mDateCol]);
    if (t === -1) continue;
    have[t] = true;
    if (t > lastT) {
      lastT = t;
      prevMiss = [];
      for (var j = 0; j < maxNum; j++) prevMiss.push(Number(missData[i][m1Col + j]) || 0);
      prevSpecialMiss = [];
      if (maxSpecial > 0 && ms1Col > -1) {
        for (var k = 0; k < maxSpecial; k++) prevSpecialMiss.push(Number(missData[i][ms1Col + k]) || 0);
      }
    }
  }
  if (lastT === -1) return "Miss 無此 methodSN 資料（請先跑一次 Miss 更新）";

  // 只補尾段（比 lastT 新且缺失，ASC）；中段缺失僅回報不處理（附加會破壞順序）
  var tail = [], midGap = 0;
  for (var a = 1; a < allData.length; a++) {
    var at = toTime(allData[a][dateCol]);
    if (at === -1 || have[at]) continue;
    if (at > lastT) tail.push(allData[a]);
    else midGap++;
  }
  if (tail.length === 0) {
    return "無需修補：已對齊（最新=" + fmtD(lastT) + ")" + (midGap > 0 ? "；另有" + midGap + "筆中段缺失未處理" : "");
  }
  tail.sort(function(x, y) { return toTime(x[dateCol]) - toTime(y[dateCol]); });

  var rows = [];
  for (var s = 0; s < tail.length; s++) {
    if (isNearTimeout()) {
      if (rows.length > 0) {
        writeMissBatchDirect(sheets.missSS, lotto, methodSN, missHeaders, rows, false);
        SpreadsheetApp.flush();
        rows = [];
      }
      saveProgress("REPAIR_" + lotto + "_" + methodSN, { done: s, total: tail.length });
      return "執行逾時已存檔，重跑一次可續（已處理 " + s + "/" + tail.length + "）";
    }
    var row = tail[s];
    var drawnNums = nCols.map(function(idx) { return row[idx]; });
    var s1Val = s1Col > -1 ? row[s1Col] : null;
    var sumVal = sumCol > -1 ? row[sumCol] : null;
    var poolSet = new Set(drawnNums);
    if (hasS1 && lotto !== "L638" && s1Val !== null) poolSet.add(s1Val);
    var cur = [];
    for (var m = 1; m <= maxNum; m++) {
      cur.push(poolSet.has(m) ? 0 : (Number(prevMiss[m - 1]) || 0) + 1);
    }
    prevMiss = cur;
    var curS = [];
    if (maxSpecial > 0) {
      for (var q = 1; q <= maxSpecial; q++) {
        curS.push(s1Val === q ? 0 : (Number(prevSpecialMiss[q - 1]) || 0) + 1);
      }
      prevSpecialMiss = curS;
    }
    var dateVal = row[dateCol];
    var newRow = [methodSN, dateVal];
    nCols.forEach(function(idx) { newRow.push(row[idx] == null ? "" : row[idx]); });
    if (hasS1) newRow.push(s1Val == null ? "" : s1Val);
    if (sumVal !== null) newRow.push(sumVal == null ? "" : sumVal);
    newRow = newRow.concat(cur);
    if (maxSpecial > 0) newRow = newRow.concat(curS);
    rows.push(newRow);
  }
  if (rows.length > 0) {
    writeMissBatchDirect(sheets.missSS, lotto, methodSN, missHeaders, rows, false);
    SpreadsheetApp.flush();
  }
  clearProgress("REPAIR_" + lotto + "_" + methodSN);
  var msg = "已補上 " + tail.length + " 筆，最新=" + fmtD(toTime(tail[tail.length - 1][dateCol]));
  if (midGap > 0) msg += "；另有" + midGap + "筆中段缺失未處理";
  Logger.log("[repairMissTail] %s %s", lotto, msg);
  return msg;
}

function writeMissBatchDirect(ss, lotto, methodSN, headers, rows, isFirstBatch) {
  Logger.log("[writeMissBatch] lotto=%s first=%s rows=%d", lotto, isFirstBatch, rows.length);
  var sheet = ss.getSheetByName("Miss");
  if (isFirstBatch) {
    if (sheet) {
      // 只移除該 methodSN 的舊資料，保留其他 methodSN
      var allData = sheet.getDataRange().getValues();
      if (allData.length > 0) {
        var h = allData[0].map(function(c) { return String(c || "").trim(); });
        var snCol = h.indexOf("lngMethodSN");
        if (snCol > -1 && h.length === headers.length) {
          var keep = [allData[0]];
          for (var di = 1; di < allData.length; di++) {
            if (Number(allData[di][snCol]) !== methodSN) keep.push(allData[di]);
          }
          sheet.clear();
          if (keep.length > 1 || (keep.length === 1 && keep[0].length === headers.length)) {
            sheet.getRange(1, 1, keep.length, keep[0].length).setValues(keep);
          } else {
            sheet.appendRow(headers);
          }
        } else {
          sheet.clear();
          sheet.appendRow(headers);
        }
      } else {
        sheet.appendRow(headers);
      }
    } else {
      Logger.log("[writeMissBatch] creating new Miss sheet");
      sheet = ss.insertSheet("Miss");
      sheet.appendRow(headers);
    }
    SpreadsheetApp.flush();
    Logger.log("[writeMissBatch] headers written, getLastRow=%d", sheet.getLastRow());
  }
  if (rows.length === 0) { Logger.log("[writeMissBatch] no rows to write"); return; }
  var safeRows = [];
  for (var ri = 0; ri < rows.length; ri++) {
    var r = rows[ri];
    var s = [];
    for (var ci = 0; ci < r.length; ci++) {
      var v = r[ci];
      if (v == null) { s.push(""); continue; }
      if (ci === 1 && !(v instanceof Date)) {
        var p = new Date(String(v).replace(/-/g, "/"));
        s.push(isNaN(p.getTime()) ? String(v) : p);
      } else {
        s.push(v);
      }
    }
    safeRows.push(s);
  }
  var lastRow = sheet.getLastRow();
  Logger.log("[writeMissBatch] lastRow=%d safeRows=%d cols=%d", lastRow, safeRows.length, safeRows[0].length);
  if (safeRows.length > 0) {
    // 分塊寫入：單次 setValues 不超過 500 列，避免全量回填時超時
    var chunkSize = 500;
    for (var wi = 0; wi < safeRows.length; wi += chunkSize) {
      var chunk = safeRows.slice(wi, wi + chunkSize);
      sheet.getRange(lastRow + 1, 1, chunk.length, chunk[0].length).setValues(chunk);
      lastRow += chunk.length;
      SpreadsheetApp.flush();
    }
    Logger.log("[writeMissBatch] write OK, new lastRow=%d", sheet.getLastRow());
  }
}

/**
 * 從 Miss 工作表讀取遺漏數資料
 * @param {string} lotto 彩種
 * @param {Date|string} date 基準日期
 * @param {number|Object} methodRef 方法序號或物件
 * @param {string} sort 排序 DESC/ASC
 * @param {number} limit 回傳筆數 (-1 不限制)
 * @returns {Array<Array>} Miss 資料
 */
function getMissTable(lotto, date, methodRef, sort = "DESC", limit) {
  const methodSN = (methodRef === 1 || methodRef === "1") ? 1
    : (typeof methodRef === "object" ? getMethodSN(methodRef) : Number(methodRef));

  const sheets = getMissSpreadsheets(lotto);
  const sheet = sheets.missSS.getSheetByName("Miss");
  if (!sheet) return [];

  const data = sheet.getDataRange().getValues();
  if (data.length <= 1) return [];

  const headers = data[0].map(h => String(h || "").trim());
  const snCol = headers.indexOf("lngMethodSN");
  const dateCol = headers.indexOf("Date");
  if (snCol === -1 || dateCol === -1) return [];

  const targetDate = new Date(String(date).replace(/-/g, "/"));

  let filtered = data.slice(1).filter(row => {
    if (!row[dateCol]) return false;
    return Number(row[snCol]) === methodSN && new Date(row[dateCol]) < targetDate;
  });

  if (sort === "DESC") {
    filtered.sort((a, b) => new Date(b[dateCol]) - new Date(a[dateCol]));
  } else {
    filtered.sort((a, b) => new Date(a[dateCol]) - new Date(b[dateCol]));
  }

  const finalLimit = (limit !== undefined && limit !== null) ? parseInt(limit, 10) : -1;
  return finalLimit > 0 ? filtered.slice(0, finalLimit) : filtered;
}

/**
 * 取得遺漏表資料（依文件規範：BaseData vs TargetData 比對）
 * @param {string} lotto 彩種
 * @param {Date|string} date 基準日期
 * @param {number|Object} methodRef 方法序號或物件
 * @param {string} sort 排序 DESC/ASC
 * @param {number} limit 回傳筆數 (-1 不限制)
 * @returns {Object} { status, headers, rows, sourceHeaders }
 */


