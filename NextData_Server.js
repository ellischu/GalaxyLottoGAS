/**
 * NextData（震盪表）後端 — 查詢時計算，不參與每日排程
 * 規格：docs/ModuleDataNext.md
 * 試算表：{lotto}_DataNext（Sheets 註冊表需含 L539_DataNext 等 4 筆）
 * 工作表：DataN00（快照頭，一 MSN#Date#BASE 一列）
 *         DataN01~N06（第1~6柱歷史）、DataN07（特別號歷史，僅 L649/LSix；L638 不算 S1）
 *         DataNNext01~07（同柱預測：全號池每號一列，候選＋往前窗口）
 *         DataNKD00（KD 係數頭）、DataNKD01~07（同柱 KD/J 指標：RSV/K/D/J × 5 窗口）
 * 呈現：一頁顯示 limit 期快照（預設 20 期，由新到舊）
 */

/**
 * 診斷用：測試 google.script.run 通訊是否正常
 */
function nextPing() {
  return { status: "success", message: "pong" };
}

/**
 * 新架構試算表解析：All ← {lotto} 試算表；DataN00~N07 ← {lotto}_DataNext 試算表
 */
function getNextSpreadsheets(lotto) {
  var allSS = getNextSpreadsheetEntry(lotto);
  var nextSS = getNextSpreadsheetEntry(lotto + "_DataNext");
  return { allSS: allSS, nextSS: nextSS };
}

/**
 * 開啟 Sheets 註冊表指定鍵的試算表；鍵缺失或 URL 無效時拋出可讀錯誤。
 */
function getNextSpreadsheetEntry(key) {
  var trObj = null;
  try {
    trObj = getTargetsheet("Sheets", key);
  } catch (e) {
    throw new Error("Sheets 註冊表缺少震盪表專用鍵 [" + key + "] 或開啟失敗（" + e.message + "），請補上每彩種 {彩種}_DataNext 共 4 筆註冊");
  }
  if (!trObj || !trObj.spreadsheet) {
    throw new Error("Sheets 註冊表缺少震盪表專用鍵 [" + key + "]，請補上每彩種 {彩種}_DataNext 共 4 筆註冊");
  }
  return trObj.spreadsheet;
}

/**
 * 驗證震盪表 Sheets 註冊表（唯讀，不寫入）。部署前在 GAS 編輯器執行一次即可。
 * @returns {Object} { status, checked, missing }
 */
function verifyNextRegistry() {
  var lottos = ["L539", "L649", "L638", "LSix"];
  var missing = [];
  var checked = 0;
  lottos.forEach(function(lotto) {
    [lotto, lotto + "_DataNext"].forEach(function(key) {
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

/** 震盪窗口：前 5/10/25/50/100 期 */
function _nextWindows() {
  return [5, 10, 25, 50, 100];
}

/** 窗口欄名後綴：5→"05"、10→"10"、25→"25"、50→"50"、100→"100"（配柱位成 sglAvg105/110/125/150/1100） */
function _nextWinSuffix(w) {
  if (w === 100) return "100";
  return w < 10 ? "0" + w : String(w);
}

/** 一次性修正舊窗口標頭誤寫（w=10/25/50 舊為 p+"010"/"025"/"050"，如 sglAvg1010Var→sglAvg110Var）。
 *  僅改第 1 列標頭名稱，資料欄位位置不變、不需重算。
 *  例：GAS 編輯器執行 fixNextWinHeaders("L539")（各曾載入的彩種各跑一次） */
function fixNextWinHeaders(lotto) {
  try {
    lotto = lotto || "L539";
    var nextSS = getNextSpreadsheets(lotto).nextSS;
    var names = [];
    _nextPositions(lotto).forEach(function(p) {
      names.push(p.sheet, p.nsheet, p.kdsheet, p.nkdsheet, p.varsheet);
    });
    var fixedSheets = [];
    names.forEach(function(nm) {
      var sh = nextSS.getSheetByName(nm);
      if (!sh || sh.getLastRow() < 1) return;
      var h = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0];
      var changed = false;
      var nh = h.map(function(c) {
        var s = String(c || "");
        var t = s;
        for (var pp = 1; pp <= 7; pp++) {
          t = t.split(pp + "010").join(pp + "10");
          t = t.split(pp + "025").join(pp + "25");
          t = t.split(pp + "050").join(pp + "50");
        }
        if (t !== s) changed = true;
        return t;
      });
      if (changed) {
        sh.getRange(1, 1, 1, nh.length).setValues([nh]);
        fixedSheets.push(nm);
      }
    });
    Logger.log("[fixNextWinHeaders] %s fixed=%s", lotto, fixedSheets.join(",") || "無");
    return { status: "success", lotto: lotto, fixedSheets: fixedSheets };
  } catch (e) {
    logSystemError("fixNextWinHeaders", e.toString(), "ERROR", "修正窗口標頭失敗", { lotto: lotto });
    return { status: "error", message: e.toString() };
  }
}

/**
 * 依彩種回傳柱位定義（Q1 定案：L638 不算 S1）
 * sheet=歷史表 DataN0x；nsheet=預測表 DataNNext0x；kdsheet=KD 表 DataNKD0x；nkdsheet=預測 KD 表 DataNNextKD0x；varsheet=變異量表 DataNVAR0x
 * @returns {Array} [{ pos, col, sheet, nsheet, kdsheet, numCol, title }]
 */
function _nextPositions(lotto) {
  var list = [];
  var nCount = (lotto === "L539" ? 5 : 6);
  for (var p = 1; p <= nCount; p++) {
    list.push({
      pos: p,
      col: "N" + p,
      sheet: "DataN0" + p,
      nsheet: "DataNNext0" + p,
      kdsheet: "DataNKD0" + p,
      numCol: "lngN" + p,
      nkdsheet: "DataNNextKD0" + p,
      varsheet: "DataNVAR0" + p,
      title: "第" + p + "柱",
    });
  }
  if (lotto === "L649" || lotto === "LSix") {
    list.push({ pos: 7, col: "S1", sheet: "DataN07", nsheet: "DataNNext07", kdsheet: "DataNKD07", nkdsheet: "DataNNextKD07", varsheet: "DataNVAR07", numCol: "lngS1", title: "特別號" });
  }
  return list;
}

/** 候選號池上限（主柱與 S1 皆取該彩種 maxNum：L539=39，L649/LSix=49，L638=38） */
function _nextPoolMax(lotto) {
  try {
    if (typeof getGameConfig === "function") return getGameConfig(lotto).maxNum;
  } catch (e) { /* fallback */ }
  return lotto === "L539" ? 39 : 49;
}

function _nextN00Headers() {
  return ["lngDataN00SN", "lngMethodSN", "Date", "intBaseRange", "strcheck"];
}

function _nextSheetHeaders(posDef) {
  var h = ["lngDataN00SN", posDef.numCol];
  _nextWindows().forEach(function(w) {
    var sfx = posDef.pos + _nextWinSuffix(w);
    h.push("sglAvg" + sfx, "sglStd" + sfx, "intMin" + sfx, "intMax" + sfx);
  });
  h.push("strcheck");
  return h;
}

/** KD 指標：各彩種 RSV 期數（對齊 C# 完成後調回：L539 每週6次→n=5 靈敏；L649/L638/LSix 同 C# n=9） */
var NEXT_KD_RSVN = { L539: 5, L649: 9, L638: 9, LSix: 9 };
/** KD 遞迴初值 */
var NEXT_KD_SEED = 50;
/** RSV 平滑係數 1/3 */
var NEXT_KD_RSVCO = 0.33333;

/** 取到小數第 3 位 */
function _nextRound3(v) {
  if (v === null || v === undefined || isNaN(v)) return 0;
  return Math.round(Number(v) * 1000) / 1000;
}

function _nextAvg(arr) {
  if (!arr || arr.length === 0) return 0;
  var s = 0;
  for (var i = 0; i < arr.length; i++) s += arr[i];
  return s / arr.length;
}

/** 樣本標準差（除以 N-1，同 Excel STDEV；N<=1 回 0 防除以零） */
function _nextStd(arr, avg) {
  if (!arr || arr.length <= 1) return 0;
  var s = 0;
  for (var i = 0; i < arr.length; i++) s += Math.pow(arr[i] - avg, 2);
  return Math.sqrt(s / (arr.length - 1));
}

/** 依單柱歷史數列計算 5 窗口統計（含當期本身）
 *  AVG/STD：同窗口平均與樣本標準差；MIN/MAX：同窗口原始號碼極值 */
function _calcPositionWindows(series) {
  return _nextWindows().map(function(w) {
    var tail = series.slice(Math.max(0, series.length - w));
    var avg = _nextAvg(tail);
    var std = _nextStd(tail, avg);
    var mn = tail.length ? Math.min.apply(null, tail) : 0;
    var mx = tail.length ? Math.max.apply(null, tail) : 0;
    return { w: w, avg: _nextRound3(avg), std: _nextRound3(std), min: _nextRound3(mn), max: _nextRound3(mx) };
  });
}

/** DataNVAR0x 標頭（每窗口 AvgVar/StdVar/MinVar/MaxVar 四欄） */
function _nextVarHeaders(posDef) {
  var h = ["lngDataN00SN"];
  _nextWindows().forEach(function(w) {
    var sfx = posDef.pos + _nextWinSuffix(w);
    h.push("sglAvg" + sfx + "Var", "sglStd" + sfx + "Var", "intMin" + sfx + "Var", "intMax" + sfx + "Var");
  });
  return h;
}

/** 依單柱歷史數列計算 5 窗口變異量（DataNVAR 規格）：
 *  AvgVar/StdVar＝與上一期 sglAvg/sglStd（round3 存值）之差；
 *  MinVar/MaxVar＝最近 w 期（含當期；105→5、110→10、125→25、150→50、1100→100）AvgVar 極值；
 *  首期（僅 1 期資料）全 0 */
function _calcPositionVar(series) {
  var m = series.length;
  return _nextWindows().map(function(w) {
    if (m < 2) return { w: w, avgVar: 0, stdVar: 0, minVar: 0, maxVar: 0 };
    var avgAt = [], stdAt = [];
    for (var j = 0; j < m; j++) {
      var tail = series.slice(Math.max(0, j - w + 1), j + 1);
      var raw = _nextAvg(tail);
      avgAt.push(_nextRound3(raw));
      stdAt.push(_nextRound3(_nextStd(tail, raw)));
    }
    var varArr = [0];
    for (var j2 = 1; j2 < m; j2++) varArr.push(_nextRound3(avgAt[j2] - avgAt[j2 - 1]));
    var tN = varArr.slice(Math.max(0, m - w));
    return { w: w,
      avgVar: varArr[m - 1],
      stdVar: _nextRound3(stdAt[m - 1] - stdAt[m - 2]),
      minVar: _nextRound3(Math.min.apply(null, tN)),
      maxVar: _nextRound3(Math.max.apply(null, tN)) };
  });
}

/** 依候選號計算 5 窗口預測統計：候選＋往前 (w-1) 期為窗口
 *  AVG/STD：窗口平均與樣本標準差；MIN/MAX：窗口原始號碼極值 */
function _calcNextCandWins(series, cand) {
  return _nextWindows().map(function(w) {
    var tail = series.slice(Math.max(0, series.length - (w - 1)));
    var vals = [cand].concat(tail);
    var avg = _nextAvg(vals);
    var std = _nextStd(vals, avg);
    var mn = Math.min.apply(null, vals);
    var mx = Math.max.apply(null, vals);
    return { w: w, avg: _nextRound3(avg), std: _nextRound3(std), min: _nextRound3(mn), max: _nextRound3(mx) };
  });
}

/** DataNKD00 標頭 */
function _nextKD00Headers() {
  return ["lngDataN00KDSN", "lngDataN00SN", "intRSVn", "sglRSVCo", "strcheck"];
}

/** DataNKD0x 標頭（每窗口 RSV/K/D/J 四欄） */
function _nextKDHeaders(posDef) {
  var h = ["lngDataN00KDSN"];
  _nextWindows().forEach(function(w) {
    var sfx = posDef.pos + _nextWinSuffix(w);
    h.push("sglAvg" + sfx + "RSV", "sglAvg" + sfx + "K", "sglAvg" + sfx + "D", "sglAvg" + sfx + "J");
  });
  h.push("strcheck");
  return h;
}

/** DataNNextKD0x 標頭（鍵＝目標日 KDSN、第 2 欄＝候選號；每窗口 RSV/K/D/J 四欄） */
function _nextNextKDHeaders(posDef) {
  var h = ["lngDataN00KDSN", posDef.numCol];
  _nextWindows().forEach(function(w) {
    var sfx = posDef.pos + _nextWinSuffix(w);
    h.push("sglAvg" + sfx + "RSV", "sglAvg" + sfx + "K", "sglAvg" + sfx + "D", "sglAvg" + sfx + "J");
  });
  return h;
}

/**
 * 預測 KD：以候選號當期 AVG 為 Current，Min/Max 取目標日（不含）前 intRSVn 期含觀測日的 AVG，
 * 前筆 RSV/K/D 取觀測日 DataNKD 已捨入值（同 C# SearchDataNNextKD 口徑）；
 * 資料不足（AVG 數 < intRSVn）種子 RSV=0/K=50/D=50；MX=MN 時沿用前筆 RSV；J=round3(3K-2D)。
 * @param {number[]} avgSeries 滾動 AVG(w) 序列（含各歷史日期，末筆＝觀測日）
 * @param {number} curAvg 候選號該窗口 AVG（DataNNext0x 存值）
 * @param {number} intRSVn RSV 回看期數
 * @param {{rsv:number,k:number,d:number}} prev 觀測日已存 KD 值
 * @returns {{rsv:number, k:number, d:number, j:number}}
 */
function _calcNextKD(avgSeries, curAvg, intRSVn, prev) {
  var round3 = function(x) { return Math.round(x * 1000) / 1000; };
  var co = Math.round(NEXT_KD_RSVCO * 1000) / 1000;
  if (!avgSeries || avgSeries.length < intRSVn) {
    return { rsv: 0, k: NEXT_KD_SEED, d: NEXT_KD_SEED, j: round3(3 * NEXT_KD_SEED - 2 * NEXT_KD_SEED) };
  }
  var win = avgSeries.slice(avgSeries.length - intRSVn);
  var mn = Math.min.apply(null, win);
  var mx = Math.max.apply(null, win);
  var rsv = mx !== mn ? (curAvg - mn) / (mx - mn) * 100 : prev.rsv;
  var kRaw = (1 - co) * prev.k + co * rsv;
  var dRaw = (1 - co) * prev.d + co * kRaw;
  var k = round3(kRaw), d = round3(dRaw);
  return { rsv: round3(rsv), k: k, d: d, j: round3(3 * k - 2 * d) };
}

/**
 * 依單柱歷史數列計算某窗口的 KD/J 指標（同 C# SearchDataNKD01 口徑）。
 * AVG(w) 曲線含當期原始號碼（AVG[i] = mean(series[i-w+1..i])）；
 * RSV 窗口取當期前 intRSVn 期 AVG（不含當期）；同 C# 每步驟 RSV/K/D 捨入 3 位後存、
 * 下一步吃已捨入值；co 取 Math.Round(RSVCo,3)=0.333；MX=MN 時沿用前筆 RSV；初值 RSV=0/K=50/D=50。
 * @param {number[]} series 單柱歷史號碼序列
 * @param {number} w 窗口期數
 * @param {number} intRSVn RSV 看回期數
 * @returns {{rsv:number, k:number, d:number, j:number}}
 */
function _calcKD(series, w, intRSVn) {
  // 滾動 AVG(w) 序列（含當期：AVG[i] = mean(series[i-w+1..i])）
  var avgSeries = [];
  for (var i = w - 1; i < series.length; i++) {
    var tail = series.slice(i - w + 1, i + 1);
    avgSeries.push(_nextAvg(tail));
  }
  var co = Math.round(NEXT_KD_RSVCO * 1000) / 1000; // 同 C# Math.Round(DblCoKD,3) = 0.333
  var round3 = function(x) { return Math.round(x * 1000) / 1000; };
  var rsv = 0, k = NEXT_KD_SEED, d = NEXT_KD_SEED; // 同 C# 首列：RSV=0、K=50、D=50
  if (avgSeries.length > intRSVn) {
    for (var i = intRSVn; i < avgSeries.length; i++) {
      var win = avgSeries.slice(i - intRSVn, i);
      var mn = Math.min.apply(null, win);
      var mx = Math.max.apply(null, win);
      // MX=MN 時沿用前筆 RSV（同 C# 取前日已存值）
      if (mx !== mn) rsv = (avgSeries[i] - mn) / (mx - mn) * 100;
      var kRaw = (1 - co) * k + co * rsv;
      var dRaw = (1 - co) * d + co * kRaw;
      rsv = round3(rsv);
      k = round3(kRaw);
      d = round3(dRaw);
    }
  }
  return { rsv: rsv, k: k, d: d, j: round3(3 * k - 2 * d) };
}

/** 批次附加多列（表不存在則建表含標頭；依 dedupCol 去重，預設第 1 欄）。
 * @param {string} [dedupCol] 去重欄名（省略則用第 1 欄）
 * @returns {number} 實際寫入列數（失敗抛錯，由呼叫端捕捉記入 writeLog） */
function _appendNextRows(nextSS, sheetName, headers, rows, dedupCol, skipDedup) {
  if (!rows || rows.length === 0) return 0;
  var sheet = nextSS.getSheetByName(sheetName);
  if (!sheet) {
    sheet = nextSS.insertSheet(sheetName);
    sheet.appendRow(headers);
    sheet.setFrozenRows(1);
  } else if (sheet.getLastRow() === 0) {
    sheet.appendRow(headers);
    sheet.setFrozenRows(1);
  }
  var toWrite = rows;
  if (!skipDedup && sheet.getLastRow() > 1) {
    var dedupIdx = dedupCol ? headers.indexOf(dedupCol) : 0;
    if (dedupIdx === -1) dedupIdx = 0;
    var col = sheet.getRange(2, dedupIdx + 1, sheet.getLastRow() - 1, 1).getValues();
    var have = {};
    col.forEach(function(r) { have[String(r[0])] = true; });
    toWrite = rows.filter(function(r) { return !have[String(r[dedupIdx])]; });
    if (toWrite.length === 0) return 0;
  }
  sheet.getRange(sheet.getLastRow() + 1, 1, toWrite.length, toWrite[0].length).setValues(toWrite);
  return toWrite.length;
}

/** 單次讀取工作表的必要範圍，供完整性檢查與回讀共用。 */
function _readNextSheetCache(nextSS, sheetName, requiredHeaders) {
  var sheet = nextSS.getSheetByName(sheetName);
  if (!sheet || sheet.getLastRow() < 1) {
    var newIndexes = {};
    requiredHeaders.forEach(function(h, i) { newIndexes[h] = i; });
    return { sheet: sheet, headers: requiredHeaders.slice(), rows: [], indexes: newIndexes, valid: true, isNew: true };
  }
  var lastRow = sheet.getLastRow();
  var lastCol = sheet.getLastColumn();
  var allHeaders = sheet.getRange(1, 1, 1, lastCol).getValues()[0].map(function(v) { return String(v || "").trim(); });
  var selected = requiredHeaders.filter(function(h, i, arr) { return allHeaders.indexOf(h) > -1 && arr.indexOf(h) === i; });
  var valid = allHeaders.length === requiredHeaders.length && requiredHeaders.every(function(h, i) { return allHeaders[i] === h; });
  var sourceCols = selected.map(function(h) { return allHeaders.indexOf(h); });
  var rows = [], headers = selected.slice();
  if (valid && sourceCols.length) {
    var first = Math.min.apply(null, sourceCols) + 1;
    var last = Math.max.apply(null, sourceCols) + 1;
    var block = sheet.getRange(1, first, lastRow, last - first + 1).getValues();
    headers = sourceCols.map(function(c) { return String(block[0][c - (first - 1)] || "").trim(); });
    rows = block.slice(1).map(function(row) { return sourceCols.map(function(c) { return row[c - (first - 1)]; }); });
  }
  var indexes = {};
  headers.forEach(function(h, i) { indexes[h] = i; });
  return { sheet: sheet, headers: headers, rows: rows, indexes: indexes, valid: valid, isNew: false };
}

/** 必要欄必須存在，且非 key 欄位均為有限數值。 */
function _nextRowHasFiniteValues(row, indexes, requiredHeaders, keyHeaders) {
  if (!row) return false;
  for (var i = 0; i < requiredHeaders.length; i++) {
    var h = requiredHeaders[i];
    var idx = indexes[h];
    if (idx === undefined) return false;
    if (keyHeaders.indexOf(h) > -1) {
      if (row[idx] === "" || row[idx] === null || row[idx] === undefined) return false;
    } else if (row[idx] === "" || row[idx] === null || row[idx] === undefined || !isFinite(Number(row[idx]))) {
      return false;
    }
  }
  return true;
}

/** 將指定 key 的資料列分組；有效性由呼叫者提供。 */
function _nextGroupRows(cache, keyHeader, isValidRow) {
  var groups = {};
  var idx = cache.indexes[keyHeader];
  if (!cache.valid || idx === undefined) return groups;
  cache.rows.forEach(function(row) {
    var key = String(row[idx]);
    if (!groups[key]) groups[key] = [];
    groups[key].push(row);
  });
  if (isValidRow) Object.keys(groups).forEach(function(key) {
    groups[key]._validRows = groups[key].filter(function(row) { return isValidRow(row, cache.indexes); });
  });
  return groups;
}

/** 將本次成功寫入的列同步進記憶體快取，讓後續回讀不再重掃試算表。 */
function _mergeNextCacheRows(cache, groups, keyHeader, rows, isValidRow) {
  if (!cache || !rows || !rows.length) return;
  var keyIx = cache.indexes[keyHeader];
  rows.forEach(function(row) {
    cache.rows.push(row);
    var key = String(row[keyIx]);
    if (!groups[key]) groups[key] = [];
    groups[key].push(row);
  });
  if (isValidRow) Object.keys(groups).forEach(function(key) {
    groups[key]._validRows = groups[key].filter(function(row) { return isValidRow(row, cache.indexes); });
  });
}

function _mergeNextCacheOnly(cache, rows) {
  if (cache && rows && rows.length) Array.prototype.push.apply(cache.rows, rows);
}

/** 檢查候選列是否恰為 1..poolMax 各一列且欄值完整；回傳缺少或無效的候選。 */
function _nextMissingCandidates(rows, indexes, keyHeader, requiredHeaders, poolMax) {
  var seen = {}, duplicates = {}, invalid = {}, invalidKey = false;
  var keyIdx = indexes[keyHeader];
  var sourceRows = rows || [];
  sourceRows.forEach(function(row) {
    var n = Number(row[keyIdx]);
    if (!isFinite(n) || n < 1 || n > poolMax || Math.floor(n) !== n) { invalidKey = true; return; }
    if (seen[n]) duplicates[n] = true;
    seen[n] = true;
    var keyColumns = [keyHeader, "strcheck", "lngDataN00SN", "lngDataN00KDSN", "lngMethodSN", "Date", "intBaseRange"];
    if (!_nextRowHasFiniteValues(row, indexes, requiredHeaders, keyColumns)) invalid[n] = true;
  });
  var missing = [];
  for (var n = 1; n <= poolMax; n++) if (!seen[n] || duplicates[n] || invalid[n]) missing.push(n);
  if (invalidKey) for (var c = 1; c <= poolMax; c++) if (missing.indexOf(c) < 0) missing.push(c);
  return missing;
}

/** 依工作表現有快取刪除指定 key 的重複/無效列。 */
function _removeInvalidNextKey(cache, groups, keyHeader, key, isValidRow) {
  var rows = groups[String(key)] || [];
  if (!rows.length || !cache || !cache.sheet) return 0;
  var allRows = cache.rows, ix = cache.indexes[keyHeader];
  var deleteIndexes = [];
  var rowCountByCandidate = {};
  rows.forEach(function(row) {
    var candidate = String(row[ix]);
    rowCountByCandidate[candidate] = (rowCountByCandidate[candidate] || 0) + 1;
  });
  allRows.forEach(function(row, i) {
    if (String(row[ix]) !== String(key)) return;
    var candidate = String(row[ix]);
    if (rowCountByCandidate[candidate] > 1 || !isValidRow(row, cache.indexes)) deleteIndexes.push(i + 2);
  });
  deleteIndexes.sort(function(a, b) { return b - a; }).forEach(function(rowNum) { cache.sheet.deleteRow(rowNum); });
  return deleteIndexes.length;
}

/** 僅刪除預測候選的重複/無效列，保留同一鍵下其他有效候選。 */
function _removeInvalidNextCandidates(cache, groups, parentKeyHeader, parentKey, candidateHeader, requiredHeaders, poolMax) {
  if (!cache || !cache.sheet) return 0;
  var parentIx = cache.indexes[parentKeyHeader], candidateIx = cache.indexes[candidateHeader];
  if (parentIx === undefined || candidateIx === undefined) return 0;
  var group = groups[String(parentKey)] || [], counts = {}, badRows = [];
  group.forEach(function(row) {
    var n = String(row[candidateIx]); counts[n] = (counts[n] || 0) + 1;
  });
  cache.rows.forEach(function(row, i) {
    if (String(row[parentIx]) !== String(parentKey)) return;
    var n = Number(row[candidateIx]);
    var badCandidate = !isFinite(n) || n < 1 || n > poolMax || Math.floor(n) !== n;
    var duplicate = counts[String(row[candidateIx])] > 1;
    var invalid = !_nextRowHasFiniteValues(row, cache.indexes, requiredHeaders,
      [parentKeyHeader, candidateHeader, "strcheck", "lngDataN00SN", "lngDataN00KDSN"]);
    if (badCandidate || duplicate || invalid) badRows.push(i + 2);
  });
  badRows.sort(function(a, b) { return b - a; }).forEach(function(rowNum) { cache.sheet.deleteRow(rowNum); });
  if (badRows.length) {
    var removed = {};
    badRows.forEach(function(rowNum) { removed[rowNum - 2] = true; });
    cache.rows = cache.rows.filter(function(row, i) { return !removed[i]; });
    groups[String(parentKey)] = cache.rows.filter(function(row) { return String(row[parentIx]) === String(parentKey); });
    groups[String(parentKey)]._validRows = groups[String(parentKey)].filter(function(row) {
      return _nextRowHasFiniteValues(row, cache.indexes, requiredHeaders,
        [parentKeyHeader, candidateHeader, "strcheck", "lngDataN00SN", "lngDataN00KDSN"]);
    });
  }
  return badRows.length;
}

/** SN 欄是否為第 1 欄（我方寫入格式） */
function _nextSNCol(sheet) {
  if (!sheet || sheet.getLastRow() < 1) return -1;
  var h = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0]
    .map(function(c) { return String(c || "").trim(); });
  return h.indexOf("lngDataN00SN");
}

/**
 * 主入口：取得基準日期前 limit 期震盪快照（由新到舊；缺快照即計算＋寫入）
 * 窗口含當期本身：例 2026-10-09 的 AVG105 ＝ 10-09,10-08,10-07,10-06,10-05 的 N1 平均
 * @param {string} lotto 彩種
 * @param {string} dateStr 基準日期 yyyy-MM-dd（取小於此日期的開獎期）
 * @param {number} methodSN 方法序號
 * @param {number} baseRange 資料提供期數（預設 200）
 * @param {number} limit 一頁期數（預設 20，上限 100）
 * @param {number} offset 偏移期數（預設 0，翻頁用）
 * @param {number} [rsvn] KD RSV 回看期數（可選 5/7/9/14，省略或不合法則用彩種預設）
 */
function getNextData(lotto, dateStr, methodSN, baseRange, limit, offset, rsvn) {
  startTime = new Date().getTime();
  try {
    lotto = lotto || "L539";
    methodSN = Number(methodSN) || 1;
    baseRange = parseInt(baseRange, 10);
    if (isNaN(baseRange) || baseRange < 10) baseRange = 200;
    limit = parseInt(limit, 10);
    if (isNaN(limit) || limit < 1) limit = 20;
    if (limit > 100) limit = 100;
    offset = parseInt(offset, 10) || 0;
    if (offset < 0) offset = 0;

    var targetDate = new Date(String(dateStr).replace(/-/g, "/"));
    if (isNaN(targetDate.getTime())) {
      return { status: "error", message: "日期格式錯誤：" + dateStr };
    }
    var ymdDash = Utilities.formatDate(targetDate, "Asia/Taipei", "yyyy-MM-dd");

    var sheets = getNextSpreadsheets(lotto);
    var nextSS = sheets.nextSS;
    var positions = _nextPositions(lotto);

    // 1. 讀 All，取 < 基準日的開獎期（ASC），日期清單 DESC 分頁
    var allSheet = sheets.allSS.getSheetByName("All");
    if (!allSheet) return { status: "error", message: "找不到 " + lotto + " 試算表的 All 工作表" };
    var raw = allSheet.getDataRange().getValues();
    if (raw.length <= 1) return { status: "error", message: lotto + " All 工作表無資料" };
    var headers = raw[0].map(function(c) { return String(c || "").trim(); });
    var dateIdx = headers.indexOf("Date");
    if (dateIdx === -1) return { status: "error", message: "All 工作表缺少 Date 欄" };
    var colIdx = {};
    positions.forEach(function(p) { colIdx[p.col] = headers.indexOf(p.col); });

    // 標頭檢查：主柱 N 欄若全部缺失，直接報錯並列出實際標頭（否則會全算出 0）
    var mainPos = positions.filter(function(p) { return p.col !== "S1"; });
    var missingMain = mainPos.filter(function(p) { return colIdx[p.col] === -1; }).map(function(p) { return p.col; });
    if (missingMain.length === mainPos.length) {
      return { status: "error", message: "All 工作表找不到號碼欄 [" + missingMain.join("、") + "]，實際標頭為：" + headers.join("｜") };
    }
    // S1 缺失則略過特別號（L638 依決議本就不算 S1）
    var notice = "";
    if (positions.some(function(p) { return p.col === "S1" && colIdx[p.col] === -1; })) {
      positions = mainPos;
      notice = "All 缺少 S1 欄，已略過特別號";
    }

    var priors = raw.slice(1).filter(function(r) {
      if (!r[dateIdx]) return false;
      // 不含基準日當日（假設當日尚未公佈號碼）；各快照窗口仍含快照自身當期
      return new Date(r[dateIdx]).getTime() < targetDate.getTime();
    }).sort(function(a, b) { return new Date(a[dateIdx]) - new Date(b[dateIdx]); });
    if (priors.length === 0) {
      return { status: "success", snapshots: [], method: _getNextMethodInfo(methodSN),
        summary: { lotto: lotto, date: ymdDash, methodSN: methodSN, baseRange: baseRange, rowCount: 0, notice: notice } };
    }

    var descDates = [];
    var seen = {};
    var priorIndexByDate = {};
    priors.forEach(function(r, i) {
      var d = Utilities.formatDate(new Date(r[dateIdx]), "Asia/Taipei", "yyyy-MM-dd");
      priorIndexByDate[d] = i;
    });
    for (var di = priors.length - 1; di >= 0; di--) {
      var ds = Utilities.formatDate(new Date(priors[di][dateIdx]), "Asia/Taipei", "yyyy-MM-dd");
      if (!seen[ds]) { seen[ds] = true; descDates.push(ds); }
    }
    var pageDates = descDates.slice(offset, offset + limit);
    if (pageDates.length === 0) {
      return { status: "success", snapshots: [], method: _getNextMethodInfo(methodSN),
        summary: { lotto: lotto, date: ymdDash, methodSN: methodSN, baseRange: baseRange, rowCount: 0, notice: notice } };
    }

    // 全部開獎日（ASC，去重）：供預測目標日查找
    var allDatesAsc = [];
    var seenAll = {};
    var rowByDate = {};
    raw.slice(1).forEach(function(r) {
      if (!r[dateIdx]) return;
      var s = Utilities.formatDate(new Date(r[dateIdx]), "Asia/Taipei", "yyyy-MM-dd");
      if (!seenAll[s]) { seenAll[s] = true; allDatesAsc.push(s); }
      rowByDate[s] = r;
    });
    allDatesAsc.sort();

    // 初始化每张 NextData 快取表的窄欄读取，后续索引、完整性与回读共用同一份数据。
    var tableCaches = {};
    function addTableCache(nm, required) {
      if (tableCaches[nm]) return;
      tableCaches[nm] = _readNextSheetCache(nextSS, nm, required);
    }
    positions.forEach(function(p) {
      addTableCache(p.sheet, _nextSheetHeaders(p));
      addTableCache(p.nsheet, _nextSheetHeaders(p));
      addTableCache(p.varsheet, _nextVarHeaders(p));
      addTableCache(p.kdsheet, _nextKDHeaders(p));
      addTableCache(p.nkdsheet, _nextNextKDHeaders(p));
    });
    addTableCache("DataN00", _nextN00Headers());
    addTableCache("DataNKD00", _nextKD00Headers());
    var badSchemas = Object.keys(tableCaches).filter(function(nm) {
      return !tableCaches[nm].valid && !tableCaches[nm].isNew;
    });
    if (badSchemas.length) {
      return { status: "error", message: "NextData 工作表標頭與程式規格不符，為避免錯欄寫入已停止：" + badSchemas.join("、") };
    }
    var histGroups = {}, nextGroups = {}, varGroups = {}, kdGroups = {}, nextKDGroups = {};
    positions.forEach(function(p) {
      var statHeaders = _nextSheetHeaders(p), varHeaders = _nextVarHeaders(p);
      var kdHeaders = _nextKDHeaders(p), nextKDHeaders = _nextNextKDHeaders(p);
      histGroups[p.sheet] = _nextGroupRows(tableCaches[p.sheet], "lngDataN00SN", function(row, ix) {
        return _nextRowHasFiniteValues(row, ix, statHeaders, ["lngDataN00SN", p.numCol, "strcheck"]);
      });
      nextGroups[p.nsheet] = _nextGroupRows(tableCaches[p.nsheet], "lngDataN00SN", function(row, ix) {
        return _nextRowHasFiniteValues(row, ix, statHeaders, ["lngDataN00SN", p.numCol, "strcheck"]);
      });
      varGroups[p.varsheet] = _nextGroupRows(tableCaches[p.varsheet], "lngDataN00SN", function(row, ix) {
        return _nextRowHasFiniteValues(row, ix, varHeaders, ["lngDataN00SN"]);
      });
      kdGroups[p.kdsheet] = _nextGroupRows(tableCaches[p.kdsheet], "lngDataN00KDSN", function(row, ix) {
        return _nextRowHasFiniteValues(row, ix, kdHeaders, ["lngDataN00KDSN", "strcheck"]);
      });
      nextKDGroups[p.nkdsheet] = _nextGroupRows(tableCaches[p.nkdsheet], "lngDataN00KDSN", function(row, ix) {
        return _nextRowHasFiniteValues(row, ix, nextKDHeaders, ["lngDataN00KDSN", p.numCol]);
      });
      tableCaches[p.sheet].requiredHeaders = statHeaders;
      tableCaches[p.nsheet].requiredHeaders = statHeaders;
      tableCaches[p.varsheet].requiredHeaders = varHeaders;
      tableCaches[p.kdsheet].requiredHeaders = kdHeaders;
      tableCaches[p.nkdsheet].requiredHeaders = nextKDHeaders;
    });

    // 2. DataN00 索引 strcheck → SN；配置新 SN
    var intRSVn = [5, 7, 9, 14].indexOf(Number(rsvn)) > -1 ? Number(rsvn) : (NEXT_KD_RSVN[lotto] || 9);
    var checkToSN = {};
    var maxSN = 0;
    var n00Cache = tableCaches.DataN00;
    if (n00Cache && n00Cache.valid) {
      var chkCol = n00Cache.indexes.strcheck;
      var snCol = n00Cache.indexes.lngDataN00SN;
      n00Cache.rows.forEach(function(row) {
        var sn = Number(row[snCol]) || 0;
        if (sn > maxSN) maxSN = sn;
        checkToSN[String(row[chkCol]).trim()] = sn;
      });
    }

    // 2b. DataNKD00 索引 strcheck → KDSN；配置新 KDSN
    var checkToKDSN = {};
    var maxKDSN = 0;
    var kd00Cache = tableCaches.DataNKD00;
    if (kd00Cache && kd00Cache.valid) {
      var kdKdCol = kd00Cache.indexes.lngDataN00KDSN;
      var kdDateSNCol = kd00Cache.indexes.lngDataN00SN;
      var kdChkCol = kd00Cache.indexes.strcheck;
      checkToKDSN.__byKDSN = {};
      kd00Cache.rows.forEach(function(row) {
        var kdsn = Number(row[kdKdCol]) || 0;
        if (kdsn > maxKDSN) maxKDSN = kdsn;
        checkToKDSN[String(row[kdChkCol]).trim()] = kdsn;
        if (kdsn > 0) checkToKDSN.__byKDSN[String(kdsn)] = {
          lngDataN00SN: Number(row[kdDateSNCol]) || 0,
          intRSVn: Number(row[kd00Cache.indexes.intRSVn]) || 0,
          sglRSVCo: Number(row[kd00Cache.indexes.sglRSVCo]) || 0,
        };
      });
    }

    // 3. 缺快照或子表缺列即計算（由舊到新），收集批次寫入列
    //    子表缺列時沿用原 SN 補算（自癒毒快取，不另配新號）
    //    同步計算預測表 DataNNext（全號池每號一列，候選＋往前窗口）
    var ascDates = pageDates.slice().sort();
    var n00Rows = [];
    var sheetRows = {};
    var sheetHeaders = {};
    positions.forEach(function(p) {
      sheetRows[p.sheet] = [];
      sheetHeaders[p.sheet] = _nextSheetHeaders(p);
      sheetRows[p.nsheet] = [];
      sheetHeaders[p.nsheet] = _nextSheetHeaders(p);
      sheetRows[p.varsheet] = [];
      sheetHeaders[p.varsheet] = _nextVarHeaders(p);
    });
    var nextSheetNames = positions.map(function(p) { return p.nsheet; });
    // KD 工作表準備
    var kd00Rows = [];
    var kdSheetRows = {};
    var kdSheetHeaders = {};
    positions.forEach(function(p) {
      kdSheetRows[p.kdsheet] = [];
      kdSheetHeaders[p.kdsheet] = _nextKDHeaders(p);
    });
    // 預測 KD 工作表準備（DataNNextKD0x，欄 0 ＝ 目標日 KDSN）
    var nkSheetRows = {};
    var nkSheetHeaders = {};
    positions.forEach(function(p) {
      nkSheetRows[p.nkdsheet] = [];
      nkSheetHeaders[p.nkdsheet] = _nextNextKDHeaders(p);
    });
    var nkSheetNames = Object.keys(nkSheetRows);
    var poolMax = _nextPoolMax(lotto);
    var snOfDate = {};
    var targetOfDate = {};
    var targetDateOf = {};
    var computedCount = 0;
    function hasCandidateKeyError(rows, indexes, candidateHeader, maxCandidate) {
      var ix = indexes[candidateHeader], seen = {};
      if (ix === undefined) return true;
      for (var i = 0; i < (rows || []).length; i++) {
        var value = Number(rows[i][ix]);
        if (!isFinite(value) || value < 1 || value > maxCandidate || Math.floor(value) !== value) return true;
        var n = String(value);
        if (seen[n]) return true;
        seen[n] = true;
      }
      return false;
    }
    function clearGroupedKey(cache, groups, keyHeader, key, validateRow) {
      var group = groups[String(key)] || [];
      if (!cache || !cache.sheet || !group.length) return;
      var keyIx = cache.indexes[keyHeader], badRows = [];
      var counts = {};
      group.forEach(function(row) {
        var k = String(row[keyIx]); counts[k] = (counts[k] || 0) + 1;
      });
      cache.rows.forEach(function(row, i) {
        if (String(row[keyIx]) !== String(key)) return;
        if (group.length > 1 || !validateRow(row, cache.indexes)) badRows.push(i + 2);
      });
      badRows.sort(function(a, b) { return b - a; }).forEach(function(rn) { cache.sheet.deleteRow(rn); });
      if (badRows.length) {
        groups[String(key)] = [];
        cache.rows = cache.rows.filter(function(row) { return String(row[keyIx]) !== String(key); });
      }
    }
    ascDates.forEach(function(ds) {
      var flat = ds.replace(/-/g, "");
      var check = methodSN + "#" + flat + "#" + baseRange;
      var sn = checkToSN[check] || 0;
      var isNewSnap = sn === 0;
      // 先配快照 SN（kdCheck 依 SN 組成，須先有 SN 才能建 KD strcheck）
      if (sn === 0) {
        maxSN++;
        sn = maxSN;
        checkToSN[check] = sn;
        n00Rows.push([sn, methodSN, flat, baseRange, check]);
      }
      snOfDate[ds] = sn;
      // 預測目標日：allDatesAsc 中下一個開獎日，找不到（尚未開獎）則用基準日 ymdDash
      var tDs = null;
      for (var ti = 0; ti < allDatesAsc.length; ti++) {
        if (allDatesAsc[ti] > ds) { tDs = allDatesAsc[ti]; break; }
      }
      if (!tDs) tDs = ymdDash;
      var tFlat = tDs.replace(/-/g, "");
      var tCheck = methodSN + "#" + tFlat + "#" + baseRange;
      var tSn = checkToSN[tCheck] || 0;
      if (tSn === 0) {
        maxSN++;
        tSn = maxSN;
        checkToSN[tCheck] = tSn;
        n00Rows.push([tSn, methodSN, tFlat, baseRange, tCheck]);
      }
      targetOfDate[ds] = tSn;
      targetDateOf[ds] = tDs;
      var histRebuild = {}, nextRebuild = {}, varRebuild = {}, kdRebuild = {};
      var rowKeyValid = function(row, indexes, required, keys) { return _nextRowHasFiniteValues(row, indexes, required, keys); };
      var histComplete = true;
      positions.forEach(function(p) {
        var nm = p.sheet;
        var rows = histGroups[nm][String(sn)] || [];
        var good = rows._validRows || [];
        histRebuild[nm] = rows.length !== 1 || good.length !== 1;
        if (histRebuild[nm]) {
          histComplete = false;
          clearGroupedKey(tableCaches[nm], histGroups[nm], "lngDataN00SN", sn, function(row, ix) {
            return rowKeyValid(row, ix, tableCaches[nm].requiredHeaders, ["lngDataN00SN", p.numCol, "strcheck"]);
          });
          histGroups[nm][String(sn)] = [];
        }
      });
      var varComplete = true;
      positions.forEach(function(p) {
        var nm = p.varsheet;
        var rows = varGroups[nm][String(sn)] || [];
        var good = rows._validRows || [];
        varRebuild[nm] = rows.length !== 1 || good.length !== 1;
        if (varRebuild[nm]) {
          varComplete = false;
          clearGroupedKey(tableCaches[nm], varGroups[nm], "lngDataN00SN", sn, function(row, ix) {
            return rowKeyValid(row, ix, tableCaches[nm].requiredHeaders, ["lngDataN00SN"]);
          });
          varGroups[nm][String(sn)] = [];
        }
      });
      var missingNext = {};
      var nextComplete = true;
      nextSheetNames.forEach(function(nm) {
        var cache = tableCaches[nm];
        var posDef = positions.filter(function(p) { return p.nsheet === nm; })[0];
        var nextRowsForKey = nextGroups[nm][String(tSn)] || [];
        var duplicateNext = hasCandidateKeyError(nextRowsForKey, cache.indexes, posDef.numCol, poolMax);
        missingNext[nm] = duplicateNext
          ? Array.from({ length: poolMax }, function(_, i) { return i + 1; })
          : _nextMissingCandidates(nextRowsForKey, cache.indexes, posDef.numCol, cache.requiredHeaders, poolMax);
        nextRebuild[nm] = missingNext[nm].length > 0;
        if (duplicateNext) clearGroupedKey(cache, nextGroups[nm], "lngDataN00SN", tSn, function() { return false; });
        else if (nextRebuild[nm]) _removeInvalidNextCandidates(cache, nextGroups[nm], "lngDataN00SN", tSn,
          posDef.numCol, cache.requiredHeaders, poolMax);
        if (nextRebuild[nm]) nextComplete = false;
      });
      // KD 完整性：每個快照 KDSN 每位置恰一列，所有指標欄皆有效。
      var kdCheck = sn + "#" + intRSVn + "#" + NEXT_KD_RSVCO;
      var kdsn = checkToKDSN[kdCheck] || 0;
      var kdComplete = kdsn > 0;
      positions.forEach(function(p) {
        var nm = p.kdsheet;
        var rows = kdGroups[nm][String(kdsn)] || [];
        var good = rows._validRows || [];
        kdRebuild[nm] = rows.length !== 1 || good.length !== 1;
        if (kdRebuild[nm]) {
          if (kdsn) {
            clearGroupedKey(tableCaches[nm], kdGroups[nm], "lngDataN00KDSN", kdsn, function(row, ix) {
              return rowKeyValid(row, ix, tableCaches[nm].requiredHeaders, ["lngDataN00KDSN", "strcheck"]);
            });
            kdGroups[nm][String(kdsn)] = [];
          }
          kdComplete = false;
        }
      });
      // 預測 KD 完整性：每個目標日 KDSN 各位置候選號完整且不重複。
      var nextKdCheck = tSn + "#" + intRSVn + "#" + NEXT_KD_RSVCO;
      var tKdsn = checkToKDSN[nextKdCheck] || 0;
      var missingNextKD = {};
      var nextKdComplete = tKdsn > 0;
      positions.forEach(function(p) {
        var nm = p.nkdsheet;
        var cache = tableCaches[nm];
        var posDef = p;
        var kdRowsForKey = nextKDGroups[nm][String(tKdsn)] || [];
        missingNextKD[nm] = _nextMissingCandidates(kdRowsForKey, cache.indexes, posDef.numCol, cache.requiredHeaders, poolMax);
        if (tKdsn && missingNextKD[nm].length) {
          var allCounts = {};
          kdRowsForKey.forEach(function(row) {
            var n = String(row[cache.indexes[posDef.numCol]]);
            allCounts[n] = (allCounts[n] || 0) + 1;
          });
          var dropRows = [];
          cache.rows.forEach(function(row, ri) {
            if (Number(row[cache.indexes.lngDataN00KDSN]) !== Number(tKdsn)) return;
            var n = Number(row[cache.indexes[posDef.numCol]]);
            var validCandidate = isFinite(n) && n >= 1 && n <= poolMax && Math.floor(n) === n;
            var validValues = rowKeyValid(row, cache.indexes, cache.requiredHeaders, ["lngDataN00KDSN", posDef.numCol]);
            if (!validCandidate || allCounts[String(n)] > 1 || !validValues) dropRows.push(ri + 2);
          });
          dropRows.sort(function(a, b) { return b - a; }).forEach(function(rn) { cache.sheet.deleteRow(rn); });
          if (dropRows.length) {
            var dropped = {};
            dropRows.forEach(function(rn) { dropped[rn - 2] = true; });
            cache.rows = cache.rows.filter(function(row, ri) { return !dropped[ri]; });
            nextKDGroups[nm][String(tKdsn)] = cache.rows.filter(function(row) {
              return Number(row[cache.indexes.lngDataN00KDSN]) === Number(tKdsn);
            });
            nextKDGroups[nm][String(tKdsn)]._validRows = nextKDGroups[nm][String(tKdsn)].filter(function(row) {
              return rowKeyValid(row, cache.indexes, cache.requiredHeaders, ["lngDataN00KDSN", posDef.numCol]);
            });
            // 删除非法候选后按剩余候选重新计算缺漏，只补洞，不重复写入完整候选。
            missingNextKD[nm] = _nextMissingCandidates(nextKDGroups[nm][String(tKdsn)], cache.indexes,
              posDef.numCol, cache.requiredHeaders, poolMax);
          }
        }
        if (missingNextKD[nm].length) nextKdComplete = false;
      });
      if (histComplete && nextComplete && kdComplete && nextKdComplete && varComplete) return;
      // 目標日 KDSN 配號（尚未開獎的目標日也先建 DataNKD00 列，開獎後沿用同 KDSN 補子列）
      if (!nextKdComplete && tKdsn === 0) {
        maxKDSN++;
        tKdsn = maxKDSN;
        checkToKDSN[nextKdCheck] = tKdsn;
        kd00Rows.push([tKdsn, tSn, intRSVn, NEXT_KD_RSVCO, nextKdCheck]);
        checkToKDSN.__byKDSN[String(tKdsn)] = { lngDataN00SN: tSn, intRSVn: intRSVn, sglRSVCo: NEXT_KD_RSVCO };
      }
      // 以該期為界：含當期在內往前 BASE＋200 期為數列，當期列為號碼
      var endIx = priorIndexByDate[ds];
      if (endIx === undefined) endIx = -1;
      var take = Math.min(endIx + 1, baseRange + 200);
      var win2 = endIx >= 0 ? priors.slice(endIx + 1 - take, endIx + 1) : [];
      var dayRow = rowByDate[ds] || null;
      var lens = [];
      positions.forEach(function(p) {
        var ci = colIdx[p.col];
        var series = [];
        if (ci > -1) {
          win2.forEach(function(r) {
            var v = Number(r[ci]);
            if (!isNaN(v)) series.push(v);
          });
        }
        lens.push(p.col + ":" + series.length);
        var num = 0;
        if (dayRow && ci > -1 && dayRow[ci] !== "" && dayRow[ci] !== null) num = Number(dayRow[ci]) || 0;
        // 歷史表 DataN0x：一列（僅當歷史表不完整時）
        if (!histComplete && histRebuild[p.sheet]) {
          var wins = _calcPositionWindows(series);
          var row = [sn, num];
          wins.forEach(function(r) { row.push(r.avg, r.std, r.min, r.max); });
          row.push(sn + "#" + num);
          sheetRows[p.sheet].push(row);
        }
        // 變異量表 DataNVAR0x：一列（僅當變異量表不完整時）
        if (!varComplete && varRebuild[p.varsheet]) {
          var varWins = _calcPositionVar(series);
          var varRow = [sn];
          varWins.forEach(function(r) { varRow.push(r.avgVar, r.stdVar, r.minVar, r.maxVar); });
          sheetRows[p.varsheet].push(varRow);
        }
        // 預測表 DataNNext0x：全號池每號一列（欄位 0 ＝ 目標日 SN，strcheck＝目標SN#cand）
        var candWins = null;
        var nextCandidatesToWrite = missingNext[p.nsheet] || [];
        var nextKdCandidatesToWrite = missingNextKD[p.nkdsheet] || [];
        if (nextCandidatesToWrite.length || nextKdCandidatesToWrite.length) {
          candWins = {};
          var candidatesNeeded = {};
          nextCandidatesToWrite.concat(nextKdCandidatesToWrite).forEach(function(n) { candidatesNeeded[n] = true; });
          Object.keys(candidatesNeeded).forEach(function(n) { candWins[n] = _calcNextCandWins(series, Number(n)); });
        }
        if (nextCandidatesToWrite.length) {
          for (var nc = 0; nc < nextCandidatesToWrite.length; nc++) {
            var cand2 = nextCandidatesToWrite[nc];
            var cw = candWins[cand2];
            var crow = [tSn, cand2];
            cw.forEach(function(r) { crow.push(r.avg, r.std, r.min, r.max); });
            crow.push(tSn + "#" + cand2);
            sheetRows[p.nsheet].push(crow);
          }
        }
        // KD 表 DataNKD0x：僅當 KD 不完整時計算
        var kdWins = null;
        if (!kdComplete || !nextKdComplete) {
          if (!kdComplete && kdsn === 0) {
            maxKDSN++;
            kdsn = maxKDSN;
            checkToKDSN[kdCheck] = kdsn;
            kd00Rows.push([kdsn, sn, intRSVn, NEXT_KD_RSVCO, kdCheck]);
            checkToKDSN.__byKDSN[String(kdsn)] = { lngDataN00SN: sn, intRSVn: intRSVn, sglRSVCo: NEXT_KD_RSVCO };
          }
          kdWins = _nextWindows().map(function(w) {
            var kd = _calcKD(series, w, intRSVn);
            return { w: w, rsv: _nextRound3(kd.rsv), k: _nextRound3(kd.k), d: _nextRound3(kd.d), j: _nextRound3(kd.j) };
          });
          if (!kdComplete && kdRebuild[p.kdsheet]) {
            var kdRow = [kdsn];
            kdWins.forEach(function(r) { kdRow.push(r.rsv, r.k, r.d, r.j); });
            kdRow.push(kdsn + "#" + num);
            kdSheetRows[p.kdsheet].push(kdRow);
          }
        }
        // 預測 KD 表 DataNNextKD0x：候選號 × 5 窗口（Current＝候選 AVG，前筆＝觀測日 DataNKD 值）
        if (nextKdCandidatesToWrite.length) {
          var avgByW = {};
          _nextWindows().forEach(function(w) {
            var a = [];
            for (var ai = w - 1; ai < series.length; ai++) a.push(_nextAvg(series.slice(ai - w + 1, ai + 1)));
            avgByW[w] = a;
          });
          for (var nci = 0; nci < nextKdCandidatesToWrite.length; nci++) {
            var cand3 = nextKdCandidatesToWrite[nci];
            var cwins = candWins[cand3];
            var nkRow = [tKdsn, cand3];
            _nextWindows().forEach(function(w, wi) {
              var nd = _calcNextKD(avgByW[w], cwins[wi].avg, intRSVn, kdWins[wi]);
              nkRow.push(nd.rsv, nd.k, nd.d, nd.j);
            });
            nkSheetRows[p.nkdsheet].push(nkRow);
          }
        }
      });
      if (!histComplete || !nextComplete || !kdComplete || !nextKdComplete || !varComplete) computedCount++;
      Logger.log("[getNextData] %s sn=%d tSn=%d(%s) kdsn=%d %s hist=%s next=%s kd=%s nkd=%s var=%s series=[%s]",
        ds, sn, tSn, tDs, kdsn, isNewSnap ? "new" : "heal",
        histComplete ? "ok" : "rebuild", nextComplete ? "ok" : "rebuild", kdComplete ? "ok" : "rebuild",
        nextKdComplete ? "ok" : "rebuild", varComplete ? "ok" : "rebuild", lens.join(","));
      if (isNearTimeout()) {
        Logger.log("[getNextData] near timeout, computed %d snapshots so far", computedCount);
      }
    });

    // 4. 批次寫入（快取 rows 已在完整性階段清掉壞 key；只附加本輪缺漏/重建資料）
    var writeLog = [];
    var allOk = true;
    Object.keys(sheetRows).forEach(function(nm) {
      try {
        var nw = _appendNextRows(nextSS, nm, sheetHeaders[nm], sheetRows[nm], null, true);
        if (nw > 0) writeLog.push(nm + "寫入" + nw + "列");
        if (nw > 0) {
          var posDef = positions.filter(function(p) { return p.sheet === nm || p.nsheet === nm || p.varsheet === nm; })[0];
          var keyHeader = "lngDataN00SN";
          var groupMap = nm.indexOf("DataNNext") === 0 ? nextGroups : (nm.indexOf("DataNVAR") === 0 ? varGroups : histGroups);
          _mergeNextCacheRows(tableCaches[nm], groupMap[nm], keyHeader, sheetRows[nm]);
        }
      } catch (e) {
        allOk = false;
        writeLog.push("ERR " + nm + "寫入失敗：" + e.toString());
        Logger.log("[getNextData] write %s failed: %s", nm, e.toString());
      }
    });
    // KD 子表只寫入實際需要重建的列；以 strcheck 去重。
    positions.forEach(function(p) {
      var nm = p.kdsheet;
      try {
        var nw = _appendNextRows(nextSS, nm, kdSheetHeaders[nm], kdSheetRows[nm], null, true);
        if (nw > 0) writeLog.push(nm + "寫入" + nw + "列");
        if (nw > 0) _mergeNextCacheRows(tableCaches[nm], kdGroups[nm], "lngDataN00KDSN", kdSheetRows[nm], function(row, ix) {
          return _nextRowHasFiniteValues(row, ix, tableCaches[nm].requiredHeaders, ["lngDataN00KDSN", "strcheck"]);
        });
      } catch (e) {
        allOk = false;
        writeLog.push("ERR " + nm + "寫入失敗：" + e.toString());
        Logger.log("[getNextData] write %s failed: %s", nm, e.toString());
      }
    });
    // 預測 KD 子表依 strcheck（KDSN#候選號）去重，只補缺漏候選。
    positions.forEach(function(p) {
      var nm = p.nkdsheet;
      try {
        var nw = _appendNextRows(nextSS, nm, nkSheetHeaders[nm], nkSheetRows[nm], null, true);
        if (nw > 0) writeLog.push(nm + "寫入" + nw + "列");
        if (nw > 0) _mergeNextCacheRows(tableCaches[nm], nextKDGroups[nm], "lngDataN00KDSN", nkSheetRows[nm], function(row, ix) {
          return _nextRowHasFiniteValues(row, ix, tableCaches[nm].requiredHeaders, ["lngDataN00KDSN", p.numCol]);
        });
      } catch (e) {
        allOk = false;
        writeLog.push("ERR " + nm + "寫入失敗：" + e.toString());
        Logger.log("[getNextData] write %s failed: %s", nm, e.toString());
      }
    });
    if (allOk) {
      try {
        var n0 = _appendNextRows(nextSS, "DataN00", _nextN00Headers(), n00Rows, null, true);
        if (n0 > 0) writeLog.push("DataN00寫入" + n0 + "列");
        if (n0 > 0) _mergeNextCacheOnly(tableCaches.DataN00, n00Rows);
      } catch (e) {
        allOk = false;
        writeLog.push("ERR DataN00寫入失敗：" + e.toString());
        Logger.log("[getNextData] write DataN00 failed: %s", e.toString());
      }
      // DataNKD00 寫入（去重欄 = strcheck，支援同 SN 多組 KD 參數）
      if (kd00Rows.length > 0) {
        try {
          var nw = _appendNextRows(nextSS, "DataNKD00", _nextKD00Headers(), kd00Rows, null, true);
          if (nw > 0) writeLog.push("DataNKD00寫入" + nw + "列");
          if (nw > 0) _mergeNextCacheOnly(tableCaches.DataNKD00, kd00Rows);
        } catch (e) {
          allOk = false;
          writeLog.push("ERR DataNKD00寫入失敗：" + e.toString());
          Logger.log("[getNextData] write DataNKD00 failed: %s", e.toString());
        }
      }
    } else {
      writeLog.push("子表未全成功，本輪跳過DataN00/DataNKD00寫入（下次重算）");
    }
    if (computedCount > 0) SpreadsheetApp.flush();

    // 5. 讀回本頁快照（由新到舊）＋最新期預測表（候選排名用）
    var snapshots = pageDates.map(function(ds) {
      return _readNextSnapshot(nextSS, lotto, positions, snOfDate[ds], methodSN, ds, baseRange, checkToKDSN, intRSVn, tableCaches, histGroups, kdGroups);
    });
    var predict = null;
    if (pageDates.length > 0) {
      var pTsn = targetOfDate[pageDates[0]];
      var pTKdsn = checkToKDSN[pTsn + "#" + intRSVn + "#" + NEXT_KD_RSVCO] || 0;
      var predictRanges = _readPredictRanges(nextSS, positions, targetDateOf[pageDates[0]].replace(/-/g, ""), methodSN, baseRange, intRSVn, tableCaches, histGroups, varGroups, kdGroups, checkToKDSN);
      predict = _readNextPredict(nextSS, positions, pTsn, targetDateOf[pageDates[0]], pTKdsn, predictRanges, tableCaches, nextGroups, nextKDGroups);
    }

    return {
      status: "success",
      snapshots: snapshots,
      predict: predict,
      method: _getNextMethodInfo(methodSN),
      summary: { lotto: lotto, date: ymdDash, methodSN: methodSN, baseRange: baseRange,
        intRSVn: intRSVn,
        rowCount: snapshots.length, computed: computedCount, notice: notice },
      writeLog: writeLog,
    };
  } catch (e) {
    logSystemError("getNextData", e.toString(), "ERROR", "取得震盪表失敗", { lotto: lotto, dateStr: dateStr, methodSN: methodSN });
    return { status: "error", message: e.toString() };
  }
}

/** 依 N00SN 讀回單期各柱列（含 KD 指標，經 strcheck→KDSN 對應） */
function _readNextSnapshot(nextSS, lotto, positions, sn, methodSN, ymdDash, baseRange, checkToKDSN, intRSVn, tableCaches, histGroups, kdGroups) {
  var flat = ymdDash.replace(/-/g, "");
  var kdCheck = sn + "#" + intRSVn + "#" + NEXT_KD_RSVCO;
  var kdsn = (checkToKDSN && checkToKDSN[kdCheck]) || 0;
  var out = positions.map(function(p) {
    var cache = tableCaches[p.sheet];
    var wins = _nextWindows().map(function(w) { return { w: w, avg: 0, std: 0, min: 0, max: 0, rsv: 0, k: 0, d: 0, j: 0 }; });
    var num = 0;
    var histRows = (histGroups[p.sheet] && histGroups[p.sheet][String(sn)]) || [];
    if (cache && histRows.length === 1) {
      var h = cache.headers;
      var row = histRows[0];
      var numC = h.indexOf(p.numCol);
      if (row) {
          num = numC > -1 ? (Number(row[numC]) || 0) : 0;
          wins = _nextWindows().map(function(w) {
            var sfx = p.pos + _nextWinSuffix(w);
            var gi = function(n) { var c = h.indexOf(n); return c > -1 ? Number(row[c]) || 0 : 0; };
            return { w: w, avg: gi("sglAvg" + sfx), std: gi("sglStd" + sfx), min: gi("intMin" + sfx), max: gi("intMax" + sfx) };
          });
      }
    }
    // KD 指標讀回（經 KDSN）
    if (kdsn > 0) {
      var kdCache = tableCaches[p.kdsheet];
      var kRows = (kdGroups[p.kdsheet] && kdGroups[p.kdsheet][String(kdsn)]) || [];
      if (kdCache && kRows.length === 1) {
        var kdH = kdCache.headers;
        for (var ki = 0; ki < kRows.length; ki++) {
          var kdRow = kRows[ki];
            wins = wins.map(function(wObj) {
              var sfx = p.pos + _nextWinSuffix(wObj.w);
              var gi = function(n) { var c = kdH.indexOf(n); return c > -1 ? Number(kdRow[c]) || 0 : 0; };
              return {
                w: wObj.w, avg: wObj.avg, std: wObj.std, min: wObj.min, max: wObj.max,
                rsv: gi("sglAvg" + sfx + "RSV"), k: gi("sglAvg" + sfx + "K"),
                d: gi("sglAvg" + sfx + "D"), j: gi("sglAvg" + sfx + "J"),
              };
            });
        }
      }
    }
    return { key: p.sheet.replace("Data", ""), sheet: p.sheet, title: p.title, col: p.col, num: num, wins: wins };
  });
  return {
    n00: { sn: sn, methodSN: methodSN, date: ymdDash, baseRange: baseRange,
      strcheck: methodSN + "#" + flat + "#" + baseRange },
    kd: { kdsn: kdsn },
    positions: out,
  };
}

/** 讀取預測標示需要的歷史範圍：DataN0x/DataNVAR0x 中目標日之前最近 100 期。 */
function _readPredictRanges(nextSS, positions, cutoffDate, methodSN, baseRange, intRSVn, tableCaches, histGroups, varGroups, kdGroups, checkToKDSN) {
  var out = {};
  var n00Cache = tableCaches.DataN00, dateBySN = {};
  if (n00Cache && n00Cache.valid) {
    var ns = n00Cache.indexes.lngDataN00SN, dc = n00Cache.indexes.Date;
    var nm = n00Cache.indexes.lngMethodSN, bc = n00Cache.indexes.intBaseRange;
    n00Cache.rows.forEach(function(row) {
      var dateValue = row[dc];
      var date = dateValue instanceof Date
        ? Utilities.formatDate(dateValue, "Asia/Taipei", "yyyyMMdd")
        : String(dateValue || "").replace(/-/g, "").replace(/\//g, "").slice(0, 8);
      if (date && Number(row[nm]) === Number(methodSN) && Number(row[bc]) === Number(baseRange)) dateBySN[Number(row[ns])] = date;
    });
  }
  positions.forEach(function(p) {
    function rowsBefore(cache, groups, keyColumn) {
      if (!cache || !cache.valid) return [];
      var snC = cache.indexes[keyColumn];
      if (snC === undefined) return [];
      var arr = [];
      Object.keys(groups).forEach(function(snKey) {
        var ds = dateBySN[Number(snKey)];
        var group = groups[snKey] || [];
        var good = group._validRows || [];
        if (ds && ds < cutoffDate && group.length === 1 && good.length === 1) arr.push({ date: ds, row: good[0], headers: cache.headers });
      });
      arr.sort(function(a, b) { return a.date.localeCompare(b.date); });
      return arr.slice(-100);
    }
    var histRows = rowsBefore(tableCaches[p.sheet], histGroups[p.sheet], "lngDataN00SN");
    var varRows = rowsBefore(tableCaches[p.varsheet], varGroups[p.varsheet], "lngDataN00SN");
    var kdCache = tableCaches[p.kdsheet];
    var kdRows = [];
    if (kdCache && kdCache.valid) {
      var kdHeader = "lngDataN00KDSN", kdIx = kdCache.indexes[kdHeader];
      Object.keys(kdGroups[p.kdsheet] || {}).forEach(function(kdKey) {
        var kdGroup = kdGroups[p.kdsheet][kdKey] || [];
        var kdGood = kdGroup._validRows || [];
        var kdCheck = checkToKDSN && checkToKDSN.__byKDSN ? checkToKDSN.__byKDSN[kdKey] : null;
        var snKey = kdCheck ? Number(kdCheck.lngDataN00SN) : 0;
        var ds = dateBySN[snKey];
        if (!ds || ds >= cutoffDate || kdGroup.length !== 1 || kdGood.length !== 1 ||
            kdCheck.intRSVn !== Number(intRSVn) || kdCheck.sglRSVCo !== Number(NEXT_KD_RSVCO)) return;
        kdRows.push({ date: ds, row: kdGood[0], headers: kdCache.headers });
      });
      kdRows.sort(function(a, b) { return a.date.localeCompare(b.date); });
      kdRows = kdRows.slice(-100);
    }
    var latest = histRows.length ? histRows[histRows.length - 1] : null;
    var latestVar = varRows.length ? varRows[varRows.length - 1] : null;
    var latestKD = kdRows.length ? kdRows[kdRows.length - 1] : null;
    var ranges = {};
    _nextWindows().forEach(function(w) {
      var sfx = p.pos + _nextWinSuffix(w);
      var fields = {
        avg: "sglAvg" + sfx, std: "sglStd" + sfx,
        avgVar: "sglAvg" + sfx + "Var", stdVar: "sglStd" + sfx + "Var",
        rsv: "sglAvg" + sfx + "RSV",
      };
      function vals(rows, field) {
        if (!rows.length) return [];
        var idx = rows[0].headers.indexOf(field);
        return idx < 0 ? [] : rows.map(function(r) { return Number(r.row[idx]); }).filter(function(v) { return isFinite(v); });
      }
      function extrema(v) { return v.length ? { min: Math.min.apply(null, v), max: Math.max.apply(null, v) } : null; }
      function getVal(entry, field) {
        if (!entry) return null;
        var idx = entry.headers.indexOf(field);
        if (idx < 0) return null;
        var value = Number(entry.row[idx]);
        return isFinite(value) ? value : null;
      }
      ranges[w] = {
        avg: extrema(vals(histRows, fields.avg)), std: extrema(vals(histRows, fields.std)),
        avgVar: extrema(vals(varRows, fields.avgVar)), stdVar: extrema(vals(varRows, fields.stdVar)),
        rsv: extrema(vals(kdRows, fields.rsv)),
        latestAvg: getVal(latest, fields.avg), latestStd: getVal(latest, fields.std),
        latestAvgVar: getVal(latestVar, fields.avgVar), latestStdVar: getVal(latestVar, fields.stdVar),
        latestRsv: getVal(latestKD, fields.rsv),
      };
    });
    out[p.nsheet] = { position: p.pos, historyCount: histRows.length, varHistoryCount: varRows.length,
      kdHistoryCount: kdRows.length, latestDate: latest ? latest.date : null, windows: ranges };
  });
  return out;
}

/** 由本次記憶體快取讀回單期預測表與預測 KD，不重讀工作表。 */
function _readNextPredict(nextSS, positions, sn, ymdDash, kdsn, ranges, tableCaches, nextGroups, nextKDGroups) {
  var out = positions.map(function(p) {
    var rows = [];
    var cache = tableCaches[p.nsheet];
    var cRows = nextGroups[p.nsheet][String(sn)] || [];
    if (cache && cRows.length) {
      var h = cache.headers;
      var numC = cache.indexes[p.numCol];
      for (var i = 0; i < cRows.length; i++) {
        var dataRow = cRows[i];
        var wins = _nextWindows().map(function(w) {
          var sfx = p.pos + _nextWinSuffix(w);
          var gi = function(n) { var c = cache.indexes[n]; return c !== undefined ? Number(dataRow[c]) || 0 : 0; };
          return { w: w, avg: gi("sglAvg" + sfx), std: gi("sglStd" + sfx), min: gi("intMin" + sfx), max: gi("intMax" + sfx) };
        });
        rows.push({ num: numC !== undefined ? (Number(dataRow[numC]) || 0) : 0, wins: wins });
      }
      rows.sort(function(a, b) { return a.num - b.num; });
    }
    // 預測 KD 讀回（欄 0 ＝ KDSN、第 2 欄＝候選號）
    if (kdsn > 0) {
      var kdCache = tableCaches[p.nkdsheet];
      var kdRows = nextKDGroups[p.nkdsheet][String(kdsn)] || [];
      var kdKdC = kdCache ? kdCache.indexes[p.numCol] : undefined;
      if (kdCache && kdKdC !== undefined) {
        var kdByNum = {};
        kdRows.forEach(function(kdDataRow) {
          var byNum = Number(kdDataRow[kdKdC]) || 0;
          var kdW = {};
          _nextWindows().forEach(function(w) {
            var sfx = p.pos + _nextWinSuffix(w);
            var gi = function(n) { var c = kdCache.indexes[n]; return c !== undefined ? Number(kdDataRow[c]) || 0 : 0; };
            kdW[w] = { rsv: gi("sglAvg" + sfx + "RSV"), k: gi("sglAvg" + sfx + "K"),
              d: gi("sglAvg" + sfx + "D"), j: gi("sglAvg" + sfx + "J") };
          });
          kdByNum[byNum] = kdW;
        });
        rows.forEach(function(r) {
          var kdW = kdByNum[r.num];
          if (!kdW) return;
          r.wins.forEach(function(x) {
            if (!kdW[x.w]) return;
            x.rsv = kdW[x.w].rsv; x.k = kdW[x.w].k; x.d = kdW[x.w].d; x.j = kdW[x.w].j;
          });
        });
      }
    }
    return { key: p.nsheet.replace("Data", ""), sheet: p.nsheet, title: p.title, col: p.col, rows: rows };
  });
  return { sn: sn, date: ymdDash, kdsn: kdsn, ranges: ranges || {}, positions: out };
}

function _getNextMethodInfo(methodSN) {
  if (Number(methodSN) === 1) return null;
  try {
    if (typeof getMethodObj === "function") return getMethodObj(Number(methodSN));
  } catch (e) { /* 忽略，僅為顯示用 */ }
  return null;
}

/** 當日開獎號碼（轉呼叫 Miss 通用實作，All 來源相同） */
function getNextDataDrawNumbers(lotto, dateStr) {
  if (typeof getMissDataDrawNumbers === "function") return getMissDataDrawNumbers(lotto, dateStr);
  return { status: "error", message: "getMissDataDrawNumbers 不存在" };
}

/** 當日環境參數（轉呼叫 Miss 通用實作） */
function getNextDataAllData(dateStr) {
  if (typeof getMissDataAllData === "function") return getMissDataAllData(dateStr);
  return { status: "error", message: "getMissDataAllData 不存在" };
}

/**
 * 除錯用：在 GAS 編輯器執行 debugNextData("L539")（換成你測試的彩種），
 * 開「執行紀錄」查看 All 標頭與末列，即可確認號碼欄名稱。
 */
function debugNextData(lotto) {
  try {
    lotto = lotto || "L539";
    var sheets = getNextSpreadsheets(lotto);
    var allSheet = sheets.allSS.getSheetByName("All");
    if (!allSheet) {
      Logger.log("[debugNextData] %s 無 All 工作表", lotto);
      return { status: "error", message: "無 All 工作表" };
    }
    var raw = allSheet.getDataRange().getValues();
    var headers = raw[0].map(function(c) { return String(c); });
    Logger.log("[debugNextData] lotto=%s rows=%d headers=%s", lotto, raw.length, headers.join("｜"));
    if (raw.length > 1) {
      var last = raw[raw.length - 1].map(function(v) {
        return v instanceof Date ? Utilities.formatDate(v, "Asia/Taipei", "yyyy-MM-dd") : v;
      });
      Logger.log("[debugNextData] lastRow=%s", last.join("｜"));
    }
    ["DataN00", "DataN01", "DataNNext01", "DataNKD00", "DataNKD01"].forEach(function(nm) {
      var sh = sheets.nextSS.getSheetByName(nm);
      Logger.log("[debugNextData] %s: %s", nm, sh ? ("rows=" + sh.getLastRow()) : "無此表");
    });
    return { status: "success", lotto: lotto, rows: raw.length, headers: headers };
  } catch (e) {
    Logger.log("[debugNextData] error: %s", e.toString());
    return { status: "error", message: e.toString() };
  }
}

/**
 * 清理指定方法/BASE 的震盪快照（含 DataN00 與各 DataN0x 子列，由下往上刪）。
 * 全零舊資料清掉後重查即會重算。methodSN/baseRange 傳 null 表示全部。
 * 例：clearNextSnapshots("L539", 1, 200)
 */
function clearNextSnapshots(lotto, methodSN, baseRange) {
  try {
    lotto = lotto || "L539";
    var nextSS = getNextSpreadsheets(lotto).nextSS;
    var n00 = nextSS.getSheetByName("DataN00");
    if (!n00 || n00.getLastRow() <= 1) return { status: "success", deleted: 0 };
    var data = n00.getDataRange().getValues();
    var h = data[0].map(function(c) { return String(c || "").trim(); });
    var chkCol = h.indexOf("strcheck");
    var snCol = h.indexOf("lngDataN00SN");
    if (chkCol === -1 || snCol === -1) return { status: "error", message: "DataN00 缺欄" };
    var victimSN = {};
    var n00DelRows = [];
    for (var i = 1; i < data.length; i++) {
      var parts = String(data[i][chkCol]).trim().split("#");
      var hitM = (methodSN === null || methodSN === undefined) || String(parts[0]) === String(methodSN);
      var hitB = (baseRange === null || baseRange === undefined) || String(parts[parts.length - 1]) === String(baseRange);
      if (hitM && hitB) {
        victimSN[Number(data[i][snCol])] = true;
        n00DelRows.push(i + 1);
      }
    }
    if (n00DelRows.length === 0) return { status: "success", deleted: 0 };
    // 先清 KD 子表（以 KDSN 為鍵，經 DataNKD00 SN→KDSN 對應）
    var victimKDSN = {};
    var kd00 = nextSS.getSheetByName("DataNKD00");
    if (kd00 && kd00.getLastRow() > 1) {
      var kdData = kd00.getDataRange().getValues();
      var kdH = kdData[0].map(function(c) { return String(c || "").trim(); });
      var kdKdCol = kdH.indexOf("lngDataN00KDSN");
      var kdSnCol = kdH.indexOf("lngDataN00SN");
      if (kdKdCol > -1 && kdSnCol > -1) {
        var kdDelRows = [];
        for (var ki = 1; ki < kdData.length; ki++) {
          if (victimSN[Number(kdData[ki][kdSnCol])]) {
            victimKDSN[Number(kdData[ki][kdKdCol])] = true;
            kdDelRows.push(ki + 1);
          }
        }
        // 刪 DataNKD0x / DataNNextKD0x 子列（以 KDSN 為鍵）
        _nextPositions(lotto).forEach(function(p) {
          [p.kdsheet, p.nkdsheet].forEach(function(nm) {
            var sh = nextSS.getSheetByName(nm);
            if (!sh || sh.getLastRow() <= 1) return;
            var d2 = sh.getDataRange().getValues();
            var del = [];
            for (var j = 1; j < d2.length; j++) {
              if (victimKDSN[Number(d2[j][0])]) del.push(j + 1);
            }
            del.sort(function(a, b) { return b - a; }).forEach(function(r) { sh.deleteRow(r); });
          });
        });
        // 刪 DataNKD00 自身
        kdDelRows.sort(function(a, b) { return b - a; }).forEach(function(r) { kd00.deleteRow(r); });
      }
    }
    // 再清主表子列（以 SN 為鍵）
    var sheetNames = ["DataN00"];
    _nextPositions(lotto).forEach(function(p) { sheetNames.push(p.sheet, p.nsheet, p.varsheet); });
    if (lotto === "L638" || lotto === "L649" || lotto === "LSix") sheetNames.push("DataN07", "DataNNext07");
    sheetNames.forEach(function(nm) {
      if (nm === "DataN00") return;
      var sh = nextSS.getSheetByName(nm);
      if (!sh || sh.getLastRow() <= 1) return;
      var d2 = sh.getDataRange().getValues();
      var h2 = d2[0].map(function(c) { return String(c || "").trim(); });
      var s2 = h2.indexOf("lngDataN00SN");
      if (s2 === -1) return;
      var del = [];
      for (var j = 1; j < d2.length; j++) {
        if (victimSN[Number(d2[j][s2])]) del.push(j + 1);
      }
      del.sort(function(a, b) { return b - a; }).forEach(function(r) { sh.deleteRow(r); });
    });
    n00DelRows.sort(function(a, b) { return b - a; }).forEach(function(r) { n00.deleteRow(r); });
    SpreadsheetApp.flush();
    return { status: "success", deleted: n00DelRows.length };
  } catch (e) {
    logSystemError("clearNextSnapshots", e.toString(), "ERROR", "清理震盪快照失敗", { lotto: lotto });
    return { status: "error", message: e.toString() };
  }
}
