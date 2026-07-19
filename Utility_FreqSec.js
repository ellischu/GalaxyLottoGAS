/**
 * FreqSec 工作表緩存與計算模組
 *
 * FreqSec 工作表格式：
 *   [lngMethodSN, Date, N, intM, intMinM, intMaxM, sngAvgM, sngACM,
 *    intFreq05, intMin05, intMax05, sngAvg05, sngAC05,
 *    intFreq10, intMin10, intMax10, sngAvg10, sngAC10,
 *    intFreq25, intMin25, intMax25, sngAvg25, sngAC25,
 *    intFreq50, intMin50, intMax50, sngAvg50, sngAC50,
 *    intFreq100, intMin100, intMax100, sngAvg100, sngAC100]
 *   共 28 欄（lngMethodSN + Date + 26 統計值）
 *  同 (methodSN, date) 對應 GAME_CONFIG[lotto].maxNum 列（每號碼一列）
 */

function _normDate(v) {
  if (!v) return "";
  var d = v instanceof Date ? v : new Date(String(v).replace(/-/g, "/"));
  if (isNaN(d.getTime())) return "";
  return Utilities.formatDate(d, "Asia/Taipei", "yyyy-MM-dd");
}

function getFreqSecTable(lotto, dateStr, methodSN) {
  try {
    var trObj = getTargetsheet("Sheets", lotto);
    if (!trObj || !trObj.spreadsheet) return { rows: [], headers: [] };
    var sheet = trObj.spreadsheet.getSheetByName("FreqSec");
    if (!sheet) return { rows: [], headers: [] };

    var allData = sheet.getDataRange().getValues();
    if (allData.length <= 1) return { rows: [], headers: [] };

    var headers = allData[0].map(function(h) { return String(h || "").trim(); });
    var snCol = headers.indexOf("lngMethodSN");
    var dateCol = headers.indexOf("Date");
    if (snCol === -1 || dateCol === -1) return { rows: [], headers: [] };

    var targetDateStr = _normDate(dateStr);

    var filtered = [];
    for (var i = 1; i < allData.length; i++) {
      var row = allData[i];
      if (!row[dateCol]) continue;
      var rowDate = _normDate(row[dateCol]);
      if (Number(row[snCol]) === Number(methodSN) && rowDate === targetDateStr) {
        filtered.push(row);
      }
    }
    return { rows: filtered, headers: headers };
  } catch (e) {
    logSystemError("getFreqSecTable", e.toString(), "ERROR", "讀取 FreqSec 失敗");
    return { rows: [], headers: [] };
  }
}

function writeFreqSecBatch(ss, lotto, methodSN, dateStr, headers, rows) {
  Logger.log("[writeFreqSecBatch] lotto=%s methodSN=%s date=%s rows=%d", lotto, methodSN, dateStr, rows.length);
  try {
    var sheet = ss.getSheetByName("FreqSec");
    var fullHeaders = ["lngMethodSN", "Date"].concat(headers);
    if (!sheet) {
      sheet = ss.insertSheet("FreqSec");
      sheet.appendRow(fullHeaders);
    } else {
      var existing = sheet.getDataRange().getValues();
      if (existing.length === 0 || String(existing[0][0] || "").trim() !== "lngMethodSN") {
        sheet.clear();
        sheet.appendRow(fullHeaders);
      }
    }
    SpreadsheetApp.flush();

    // 清除同 (methodSN, date) 的舊資料
    clearFreqSecData(ss, lotto, methodSN, dateStr);

    if (rows.length === 0) return;

    var targetDateStr = _normDate(dateStr);
    var safeRows = [];
    for (var ri = 0; ri < rows.length; ri++) {
      var r = rows[ri];
      var s = [Number(methodSN)];
      s.push(targetDateStr);
      for (var ci = 0; ci < r.length; ci++) {
        var v = r[ci];
        s.push(v == null ? "" : v);
      }
      safeRows.push(s);
    }

    var lastRow = sheet.getLastRow();
    if (safeRows.length > 0) {
      sheet.getRange(lastRow + 1, 1, safeRows.length, safeRows[0].length).setValues(safeRows);
      SpreadsheetApp.flush();
    }
    Logger.log("[writeFreqSecBatch] wrote %d rows, lastRow=%d", safeRows.length, sheet.getLastRow());
  } catch (e) {
    logSystemError("writeFreqSecBatch", e.toString(), "ERROR", "寫入 FreqSec 失敗");
  }
}

function clearFreqSecData(ss, lotto, methodSN, dateStr) {
  try {
    var sheet = ss.getSheetByName("FreqSec");
    if (!sheet) return;
    var allData = sheet.getDataRange().getValues();
    if (allData.length <= 1) return;

    var headers = allData[0].map(function(h) { return String(h || "").trim(); });
    var snCol = headers.indexOf("lngMethodSN");
    var dateCol = headers.indexOf("Date");
    if (snCol === -1 || dateCol === -1) return;

    var targetDateStr = _normDate(dateStr);
    var keep = [allData[0]];
    for (var i = 1; i < allData.length; i++) {
      var row = allData[i];
      var rowDate = _normDate(row[dateCol]);
      if (!(Number(row[snCol]) === Number(methodSN) && rowDate === targetDateStr)) {
        keep.push(row);
      }
    }
    sheet.clear();
    if (keep.length > 0) {
      sheet.getRange(1, 1, keep.length, keep[0].length).setValues(keep);
      SpreadsheetApp.flush();
    }
  } catch (e) {
    logSystemError("clearFreqSecData", e.toString(), "ERROR", "清除 FreqSec 失敗");
  }
}

/**
 * 計算 FreqSec 統計資料（從 Miss 表即時計算）
 */
function computeFreqSecData(lotto, dateStr, methodSN) {
  var config = getGameConfig(lotto);
  var maxNum = config.maxNum, hasS1 = config.hasS1, nCount = (lotto === "L539" ? 5 : 6);

  var merged = getMissDataTable(lotto, dateStr, Number(methodSN), "DESC", 300);
  if (merged.status !== "success" || !merged.rows || merged.rows.length === 0) {
    Logger.log("[computeFreqSecData] getMissDataTable failed: %s", merged.message);
    return { status: "error", message: merged.message || "無資料" };
  }

  var rows = merged.rows;
  var headers = merged.headers;
  var totalPeriods = rows.length;
  Logger.log("[computeFreqSecData] loaded %d periods from Miss data", totalPeriods);
  if (totalPeriods > 0) {
    var dateCol = merged.dateCol;
    var dateStr0 = rows[0][dateCol] instanceof Date ? Utilities.formatDate(rows[0][dateCol], "Asia/Taipei", "yyyy-MM-dd") : String(rows[0][dateCol]).substring(0,10);
    var dateStr4 = totalPeriods > 4 ? (rows[4][dateCol] instanceof Date ? Utilities.formatDate(rows[4][dateCol], "Asia/Taipei", "yyyy-MM-dd") : String(rows[4][dateCol]).substring(0,10)) : "N/A";
    Logger.log("[computeFreqSecData] dateCol=%d row[0].date=%s row[4].date=%s", dateCol, dateStr0, dateStr4);
  }
  var windowSize = Math.min(totalPeriods, 200);

  var nIndices = [];
  for (var k = 1; k <= nCount; k++) { var idx = headers.indexOf("N" + k); if (idx !== -1) nIndices.push(idx); }
  var s1Idx = hasS1 ? headers.indexOf("S1") : -1;
  var mStartIdx = headers.indexOf("M1");

  var appearAll = [];
  for (var n = 1; n <= maxNum; n++) appearAll.push(new Array(totalPeriods).fill(false));

  for (var p = 0; p < totalPeriods; p++) {
    var row = rows[p];
    for (var ni = 0; ni < nIndices.length; ni++) {
      var val = Number(row[nIndices[ni]]);
      if (val >= 1 && val <= maxNum) appearAll[val - 1][p] = true;
    }
    if (hasS1 && lotto !== "L638" && s1Idx !== -1) {
      var s1Val = Number(row[s1Idx]);
      if (s1Val >= 1 && s1Val <= maxNum) appearAll[s1Val - 1][p] = true;
    }
  }

  function calcStdDev(arr) {
    if (arr.length < 2) return 0;
    var mean = 0; for (var si = 0; si < arr.length; si++) mean += arr[si]; mean /= arr.length;
    var sumSq = 0; for (var si = 0; si < arr.length; si++) sumSq += (arr[si] - mean) * (arr[si] - mean);
    return Math.round(Math.sqrt(sumSq / arr.length) * 1000) / 1000;
  }

  var zones = [5, 10, 25, 50, 100];
  var results = [];

  for (var intN = 1; intN <= maxNum; intN++) {
    var idx = intN - 1;
    var missArr = [];
    for (var p = 0; p < windowSize; p++) missArr.push(Number(rows[p][mStartIdx + idx]) || 0);

    var appearArr = appearAll[idx];
    var rowData = [intN];

    if (totalPeriods < 2) {
      rowData.push(missArr[0] || 0);
      for (var f = 0; f < 4; f++) rowData.push(0);
      for (var z = 0; z < zones.length; z++) rowData.push(0,0,0,0,0);
      results.push(rowData);
      continue;
    }

    var intM = missArr[0];
    var intMinM = Math.min.apply(null, missArr);
    var intMaxM = Math.max.apply(null, missArr);
    var sumMiss = 0; for (var si = 0; si < missArr.length; si++) sumMiss += missArr[si];
    var sngAvgM = Math.round(sumMiss / missArr.length * 1000) / 1000;
    var sngACM = calcStdDev(missArr);
    rowData.push(intM, intMinM, intMaxM, sngAvgM, sngACM);

    for (var z = 0; z < zones.length; z++) {
      var zoneSize = zones[z];
      var freqArr = new Array(windowSize);
      for (var q = 0; q < windowSize; q++) {
        var remaining = totalPeriods - q;
        var lookAhead = Math.min(zoneSize, remaining);
        var count = 0;
        for (var ka = 0; ka < lookAhead; ka++) { if (appearArr[q + ka]) count++; }
        freqArr[q] = count;
      }
      var currentFreq = freqArr[0];
      var minFreq = Math.min.apply(null, freqArr);
      var maxFreq = Math.max.apply(null, freqArr);
      var sumFreq = 0; for (var si = 0; si < freqArr.length; si++) sumFreq += freqArr[si];
      var avgFreq = Math.round(sumFreq / freqArr.length * 1000) / 1000;
      var stdFreq = calcStdDev(freqArr);
      rowData.push(currentFreq, minFreq, maxFreq, avgFreq, stdFreq);
    }
    results.push(rowData);
  }

  var statsHeaders = [
    "intN","intM",
    "intMinM","intMaxM","sngAvgM","sngACM",
    "intFreq05","intMin05","intMax05","sngAvg05","sngAC05",
    "intFreq10","intMin10","intMax10","sngAvg10","sngAC10",
    "intFreq25","intMin25","intMax25","sngAvg25","sngAC25",
    "intFreq50","intMin50","intMax50","sngAvg50","sngAC50",
    "intFreq100","intMin100","intMax100","sngAvg100","sngAC100",
  ];

  return {
    status: "success", statsHeaders: statsHeaders, statsRows: results,
    totalPeriods: totalPeriods, windowSize: windowSize,
  };
}

/**
 * FreqSec 查詢流程（組合 Step1~3）
 *
 * Step 1: 比對主試算表 lotto 表 vs 子試算表 All 表的最後日期
 *         不同則呼叫 combineData→回傳 error 若續傳中
 * Step 2: 查 FreqSec 快取 → 無資料則計算+寫入
 * Step 3: 檢查列數 → 不足則清除→重算→寫入；正確則直接回傳
 */
function getFreqSecData(lotto, dateStr, methodSN) {
  // Step 1: combineData 檢查
  var srcSheet = mainspreadsheet.getSheetByName(lotto);
  var trObj = getTargetsheet("Sheets", lotto);
  var allSheet = trObj.spreadsheet.getSheetByName("All");

  if (srcSheet && allSheet) {
    var srcHeaders = srcSheet.getRange(1, 1, 1, srcSheet.getLastColumn()).getValues()[0];
    var srcDateCol = -1;
    for (var ci = 0; ci < srcHeaders.length; ci++) {
      if (String(srcHeaders[ci] || "").trim() === "Date") { srcDateCol = ci; break; }
    }
    if (srcDateCol > -1 && srcSheet.getLastRow() > 1 && allSheet.getLastRow() > 1) {
      var srcLastDate = srcSheet.getRange(srcSheet.getLastRow(), srcDateCol + 1).getValue();
      var allLastDate = allSheet.getRange(allSheet.getLastRow(), 1).getValue();
      var srcStr = srcLastDate instanceof Date
        ? Utilities.formatDate(srcLastDate, "Asia/Taipei", "yyyy-MM-dd")
        : String(srcLastDate || "").replace(/-/g, "/").substring(0, 10);
      var allStr = allLastDate instanceof Date
        ? Utilities.formatDate(allLastDate, "Asia/Taipei", "yyyy-MM-dd")
        : String(allLastDate || "").substring(0, 10);
      if (srcStr !== allStr) {
        Logger.log("[getFreqSecData] combineData needed: src=%s all=%s", srcStr, allStr);
        var combineResult = combineData(lotto);
        if (combineResult.status !== "complete") {
          return { status: "error", message: "資料尚未同步（combineData " + combineResult.status + "），請稍後再試" };
        }
      }
    }
  }

  // Step 2: 查 FreqSec 快取
  var maxNum = getGameConfig(lotto).maxNum;
  var cached = getFreqSecTable(lotto, dateStr, methodSN);

  if (cached.rows.length === 0) {
    // Step 2a: 無快取 → 計算 + 寫入
    Logger.log("[getFreqSecData] no cache, computing...");
    var computed = computeFreqSecData(lotto, dateStr, methodSN);
    if (computed.status !== "success") return computed;
    writeFreqSecBatch(trObj.spreadsheet, lotto, methodSN, dateStr, computed.statsHeaders, computed.statsRows);
    return computed;
  }

  if (cached.rows.length === maxNum) {
    // Step 3: 快取有效 → 回傳（去除 lngMethodSN, Date 欄位）
    Logger.log("[getFreqSecData] cache hit: %d rows", cached.rows.length);
    var outHeaders = cached.headers.slice(2);
    var outRows = [];
    for (var ri = 0; ri < cached.rows.length; ri++) {
      outRows.push(cached.rows[ri].slice(2));
    }
    // 輕量查詢 Miss 總筆數（僅計數）
    var missCount = 0;
    try {
      var missRaw = getMissTable(lotto, dateStr, methodSN, "DESC", -1);
      missCount = missRaw.length;
    } catch(e) {}
    return {
      status: "success", statsHeaders: outHeaders, statsRows: outRows,
      totalPeriods: missCount, windowSize: Math.min(missCount, 200),
    };
  }

  // Step 3: 不足 → 清除 → 重算 → 寫入
  Logger.log("[getFreqSecData] cache incomplete: %d rows, expected %d, recomputing...", cached.rows.length, maxNum);
  clearFreqSecData(trObj.spreadsheet, lotto, methodSN, dateStr);
  var computed = computeFreqSecData(lotto, dateStr, methodSN);
  if (computed.status !== "success") return computed;
  writeFreqSecBatch(trObj.spreadsheet, lotto, methodSN, dateStr, computed.statsHeaders, computed.statsRows);
  return computed;
}
