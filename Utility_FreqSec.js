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

function _getBacktestCache(lotto, methodSN) {
  try {
    var trObj = getTargetsheet("Sheets", lotto);
    if (!trObj || !trObj.spreadsheet) return null;
    var sheet = trObj.spreadsheet.getSheetByName("FreqSecTest");
    if (!sheet) return null;
    var data = sheet.getDataRange().getValues();
    if (data.length < 2) return null;
    var h = data[0].map(function(v) { return String(v || "").trim(); });
    var snCol = h.indexOf("lngMethodSN");
    var cacheCol = h.indexOf("cacheData");
    if (snCol === -1 || cacheCol === -1) return null;
    for (var i = 1; i < data.length; i++) {
      if (Number(data[i][snCol]) === Number(methodSN)) {
        return JSON.parse(data[i][cacheCol]);
      }
    }
  } catch(e) { logSystemError("_getBacktestCache", e.toString(), "ERROR", "讀取 FreqSecTest 失敗"); }
  return null;
}

function _setBacktestCache(lotto, methodSN, cacheData) {
  try {
    var trObj = getTargetsheet("Sheets", lotto);
    if (!trObj || !trObj.spreadsheet) return;
    var sheet = trObj.spreadsheet.getSheetByName("FreqSecTest");
    if (!sheet) {
      sheet = trObj.spreadsheet.insertSheet("FreqSecTest");
      sheet.appendRow(["lngMethodSN", "cacheData", "updatedAt"]);
    }
    var data = sheet.getDataRange().getValues();
    var h = data[0].map(function(v) { return String(v || "").trim(); });
    var snCol = h.indexOf("lngMethodSN");
    var cacheCol = h.indexOf("cacheData");
    var updatedCol = h.indexOf("updatedAt");
    if (snCol === -1) { snCol = 0; cacheCol = 1; updatedCol = 2; }
    var jsonStr = JSON.stringify(cacheData);
    var now = new Date();
    for (var i = 1; i < data.length; i++) {
      if (Number(data[i][snCol]) === Number(methodSN)) {
        sheet.getRange(i + 1, cacheCol + 1).setValue(jsonStr);
        if (updatedCol >= 0) sheet.getRange(i + 1, updatedCol + 1).setValue(now);
        return;
      }
    }
    sheet.appendRow([Number(methodSN), jsonStr, now]);
  } catch(e) { logSystemError("_setBacktestCache", e.toString(), "ERROR", "寫入 FreqSecTest 失敗"); }
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
 * 回溯測試：計算各條件對出現率的實際影響（差異值）
 * 遍歷全歷史，對每個號碼、每期、每個分區追蹤 rolling freq，
 * 當 freq == max/min 時檢查下一期該號碼是否出現。
 * 結果 cache 至 ScriptProperties (BACKTEST_{lotto}_{methodSN})。
 */
function backtestFreqSec(lotto, methodSN) {
  var config = getGameConfig(lotto);
  var maxNum = config.maxNum, hasS1 = config.hasS1, nCount = (lotto === "L539" ? 5 : 6);
  var baseRate = nCount / maxNum;

  // 讀取全歷史 Miss 資料（ASC 排序，不限量）
  var merged = getMissDataTable(lotto, "2099-12-31", Number(methodSN), "ASC", -1);
  if (merged.status !== "success" || !merged.rows || merged.rows.length < 100) {
    return { status: "error", message: "資料不足 (" + (merged.rows ? merged.rows.length : 0) + " 期)" };
  }

  var rows = merged.rows;
  var headers = merged.headers;
  var totalPeriods = rows.length;

  var nIndices = [];
  for (var k = 1; k <= nCount; k++) { var idx = headers.indexOf("N" + k); if (idx !== -1) nIndices.push(idx); }
  var s1Idx = hasS1 ? headers.indexOf("S1") : -1;

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

  var zones = [5, 10, 25, 50, 100];
  var zoneColStarts = { 5: 6, 10: 11, 25: 16, 50: 21, 100: 26 };

  // 重心樣本收集
  var centroidSamples = [];

  // 匯總統計: Freq05_max, Freq05_min, ..., M_max, M_avg
  var stats = {};

  function initStat(key) { if (!stats[key]) stats[key] = { total: 0, hit: 0 }; }

  zones.forEach(function(z) { initStat("Freq" + z + "_max"); initStat("Freq" + z + "_min"); });
  initStat("M_max"); initStat("M_avg");

  for (var intN = 1; intN <= maxNum; intN++) {
    var appearArr = appearAll[intN - 1];

    // 頻率追蹤
    var freqRoll = {};
    var freqMax = {};
    var freqMin = {};
    zones.forEach(function(z) { freqRoll[z] = 0; freqMax[z] = 0; freqMin[z] = z + 1; });

    // 遺漏追蹤
    var rollMiss = 0;
    var maxMiss = 0;
    var cumMiss = 0;

    for (var p = 0; p < totalPeriods - 1; p++) {  // p+1 必須存在
      // 更新頻率
      zones.forEach(function(z) {
        if (p >= z) freqRoll[z] -= (appearArr[p - z] ? 1 : 0);
        freqRoll[z] += (appearArr[p] ? 1 : 0);
        if (p >= z - 1) {
          if (freqRoll[z] > freqMax[z]) freqMax[z] = freqRoll[z];
          if (freqRoll[z] < freqMin[z]) freqMin[z] = freqRoll[z];
          if (freqRoll[z] === freqMax[z]) { stats["Freq" + z + "_max"].total++; if (appearArr[p + 1]) stats["Freq" + z + "_max"].hit++; }
          if (freqRoll[z] === freqMin[z]) { stats["Freq" + z + "_min"].total++; if (appearArr[p + 1]) stats["Freq" + z + "_min"].hit++; }
        }
      });

      // 計算重心（所有 window 填滿後才計算）
      if (p >= 99) {
        var c05 = freqRoll[5];
        var c10_val = freqRoll[10] - freqRoll[5];
        var c25_val = freqRoll[25] - freqRoll[10];
        var c50_val = freqRoll[50] - freqRoll[25];
        var c100_val = freqRoll[100] - freqRoll[50];
        var totalC = c05 + c10_val + c25_val + c50_val + c100_val;
        if (totalC === 0) {
          centroidSamples.push({ num: intN, centroid: -1, nextAppear: appearArr[p + 1], period: p });
        } else {
          var centVal = (c05 * 3 + c10_val * 8 + c25_val * 18 + c50_val * 38 + c100_val * 75) / totalC / 100;
          centroidSamples.push({ num: intN, centroid: centVal, nextAppear: appearArr[p + 1], period: p });
        }
      }

      // 更新遺漏
      if (appearArr[p]) rollMiss = 0; else rollMiss++;
      cumMiss += rollMiss;
      var avgMiss = cumMiss / (p + 1);

      if (rollMiss >= maxMiss) {
        maxMiss = rollMiss;
        stats.M_max.total++;
        if (appearArr[p + 1]) stats.M_max.hit++;
      }
      if (rollMiss >= avgMiss) { stats.M_avg.total++; if (appearArr[p + 1]) stats.M_avg.hit++; }
    }
  }

  // ── 重心分桶 ──
  var centKeys = [], centBuckets = {}, centRanges = {};
  centKeys.push("Centroid_Zero");
  centBuckets["Centroid_Zero"] = { total: 0, hit: 0, label: "Centroid_Zero" };

  // 分離零次與非零次
  var zeroSamples = centroidSamples.filter(function(s) { return s.centroid === -1; });
  var nonZero = centroidSamples.filter(function(s) { return s.centroid !== -1; });

  // 零次桶
  zeroSamples.forEach(function(s) {
    centBuckets["Centroid_Zero"].total++;
    if (s.nextAppear) centBuckets["Centroid_Zero"].hit++;
  });

  // 非零次排序
  nonZero.sort(function(a, b) { return a.centroid - b.centroid; });

  // 均分 5 桶
  var bucketSize = Math.ceil(nonZero.length / 5);
  for (var bi = 0; bi < 5; bi++) {
    var bStart = bi * bucketSize;
    var bEnd = Math.min(bStart + bucketSize, nonZero.length);
    if (bStart >= nonZero.length) break;
    var bucketSamples = nonZero.slice(bStart, bEnd);
    var bKey = "Centroid_B" + (bi + 1);
    var bMin = bucketSamples[0].centroid;
    var bMax = bucketSamples[bucketSamples.length - 1].centroid;
    centKeys.push(bKey);
    centRanges[bKey] = { min: bMin, max: bMax };
    centBuckets[bKey] = { total: 0, hit: 0, label: bKey + "(" + Number(bMin).toFixed(4) + "-" + Number(bMax).toFixed(4) + ")" };
    bucketSamples.forEach(function(s) {
      centBuckets[bKey].total++;
      if (s.nextAppear) centBuckets[bKey].hit++;
    });
  }

  // 加入 stats
  centKeys.forEach(function(key) {
    stats[key] = { total: centBuckets[key].total, hit: centBuckets[key].hit };
  });

  // 計算各條件差異值
  var diffs = {};
  var backtestRows = [];
  Object.keys(stats).forEach(function(key) {
    var s = stats[key];
    var actualRate = s.total > 0 ? s.hit / s.total : baseRate;
    var diff = actualRate - baseRate;
    diffs[key] = Math.round(diff * 100000) / 100000; // 保留 5 位小數
    var displayKey = centBuckets[key] ? centBuckets[key].label : key;
    backtestRows.push({
      key: displayKey, total: s.total, hit: s.hit,
      actualRate: Math.round(actualRate * 10000) / 10000,
      baseRate: Math.round(baseRate * 10000) / 10000,
      diff: Math.round(diff * 100000) / 100000,
    });
  });

  // 寫入 FreqSecTest 工作表 cache
  try {
    var appVersion = getCacheVersion();
    var cacheData = { btVersion: 4, version: appVersion, diffs: diffs, rows: backtestRows, baseRate: baseRate, centRanges: centRanges, timestamp: new Date().getTime() };
    _setBacktestCache(lotto, methodSN, cacheData);
  } catch(e) { logSystemError("backtestFreqSec", e.toString(), "ERROR", "寫入 cache 失敗"); }

  return { status: "success", diffs: diffs, rows: backtestRows, baseRate: baseRate };
}

/**
 * 套用回溯測試的差異值至當期統計資料，對所有號碼評分排名
 */
function scoreWithDiffs(lotto, dateStr, methodSN) {
  var config = getGameConfig(lotto);
  var maxNum = config.maxNum, nCount = (lotto === "L539" ? 5 : 6);
  var baseRate = nCount / maxNum;

  // 讀取 FreqSecTest 工作表 cache
  var cached = _getBacktestCache(lotto, methodSN);
  if (!cached || !cached.diffs) {
    return { status: "error", message: "請先執行回溯測試" };
  }
  var diffs = cached.diffs;
  var centRanges = cached.centRanges || {};

  // 取得當期統計資料
  var stats = computeFreqSecData(lotto, dateStr, methodSN);
  if (stats.status !== "success") return stats;

  // 取得歷史期數號碼（5/10/25/50）
  var historyData = getHistoryNumbers(lotto, dateStr, methodSN);
  var historyMap = {};
  historyData.forEach(function(h) { historyMap[h.offset] = h.numbers; });

  var zones = [5, 10, 25, 50, 100];
  var zoneColStarts = { 5: 6, 10: 11, 25: 16, 50: 21, 100: 26 };
  var scored = [];

  stats.statsRows.forEach(function(row) {
    var intN = row[0];
    var intM = row[1];
    var intMaxM = row[3];
    var sngAvgM = row[4];
    var adj = 0;
    var details = [];
    var nearZero = false;
    var adjFreqMax = 0, adjMissRatio = 0, adjCentroid = 0;

    zones.forEach(function(z) {
      var ci = zoneColStarts[z];
      var freq = row[ci];
      var minFreq = row[ci + 1];
      var maxFreq = row[ci + 2];
      if (freq === maxFreq) {
        if (z !== 100 && historyMap[z] && historyMap[z].indexOf(intN) === -1) {
          nearZero = true;
          details.push("頻" + z + "=max且非" + z + "期前號碼");
        } else {
          var d = diffs["Freq" + z + "_max"];
          if (d !== undefined) { var adjVal = -Math.abs(d); adj += adjVal; adjFreqMax += adjVal; details.push("頻" + z + "=max:" + (adjVal >= 0 ? "+" : "") + (adjVal * 100).toFixed(4) + "%"); }
        }
      }
    });

    if (intM >= sngAvgM) {
      var d = diffs.M_max;
      if (d !== undefined) { var ratio = Math.max(0, (intM - sngAvgM) / (intMaxM - sngAvgM)); var adjVal = Math.abs(d) * ratio; adj += adjVal; adjMissRatio = adjVal; details.push("Miss比=" + ratio.toFixed(4) + "x:" + (adjVal >= 0 ? "+" : "") + (adjVal * 100).toFixed(4) + "%"); }
    }

    // 重心評分
    var c05 = row[6], c10 = row[11], c25 = row[16], c50 = row[21], c100 = row[26];
    var c10_val = c10 - c05, c25_val = c25 - c10, c50_val = c50 - c25, c100_val = c100 - c50;
    var totalC = c05 + c10_val + c25_val + c50_val + c100_val;
    var centroid, centBucket = "Centroid_Zero";
    if (totalC === 0) {
      centroid = -1;
    } else {
      centroid = (c05 * 3 + c10_val * 8 + c25_val * 18 + c50_val * 38 + c100_val * 75) / totalC / 100;
      // 找所屬桶
      for (var bk = 1; bk <= 5; bk++) {
        var bKey = "Centroid_B" + bk;
        var r = centRanges[bKey];
        if (r && centroid >= r.min && centroid <= r.max) { centBucket = bKey; break; }
      }
    }
    var centDiff = diffs[centBucket];
    if (centDiff !== undefined) {
      adj += centDiff;
      adjCentroid = centDiff;
      details.push("重心:" + (centroid >= 0 ? Number(centroid).toFixed(4) : "零次") + " " + centBucket + ":" + (centDiff >= 0 ? "+" : "") + (centDiff * 100).toFixed(4) + "%");
    }

    var finalScore = nearZero ? baseRate * 0.01 : baseRate + adj;
    scored.push({
      number: intN, miss: intM,
      adj: (finalScore - baseRate),
      score: finalScore,
      details: details.join("、"),
      factors: { freqMax: adjFreqMax, miss: adjMissRatio, centroid: adjCentroid, nearZero: nearZero },
    });
  });

  scored.sort(function(a, b) { return b.score - a.score; });
  scored.forEach(function(s, i) { s.rank = i + 1; });

  return {
    status: "success", baseRate: baseRate, scored: scored,
    lotto: lotto, dateStr: dateStr, methodSN: methodSN,
  };
}

/**
 * 協調函數：backtest（含 cache）+ score
 */
function getBacktestAndScore(lotto, dateStr, methodSN) {
  var backtestResult = null;
  try {
    var cached = _getBacktestCache(lotto, methodSN);
    if (cached) {
      var appVersion = getCacheVersion();
      if (cached.btVersion === 4 && cached.version === appVersion) {
        backtestResult = { status: "success", diffs: cached.diffs, rows: cached.rows, baseRate: cached.baseRate };
      }
    }
  } catch(e) {}

  if (!backtestResult) {
    backtestResult = backtestFreqSec(lotto, methodSN);
    if (backtestResult.status !== "success") return backtestResult;
  }

  var scoreResult = scoreWithDiffs(lotto, dateStr, methodSN);
  if (scoreResult.status !== "success") return scoreResult;

  return {
    status: "success",
    backtest: { diffs: backtestResult.diffs, rows: backtestResult.rows, baseRate: backtestResult.baseRate },
    ranking: { baseRate: scoreResult.baseRate, scored: scoreResult.scored },
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
