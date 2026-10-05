/**
 * 診斷用：測試 google.script.run 通訊是否正常
 */
function ping() {
  return { status: "success", message: "pong" };
}

/**
 * 診斷用：測試小量回傳 (不出動 getTargetsheet)
 * @param {string} lotto 彩種代碼
 */
function getMissDataLight(lotto) {
  try {
    lotto = lotto || "L539";
    // 新架構：Miss ← {lotto}_Miss 試算表
    var missSS = _getMissSS(lotto);
    if (!missSS) return { status: "error", message: "no " + lotto + "_Miss sub-SS" };
    var missSheet = missSS.getSheetByName("Miss");
    if (!missSheet) {
      var allSS = _getAllSS(lotto);
      var allSheet = allSS ? allSS.getSheetByName("All") : null;
      if (!allSheet) return { status: "error", message: "no Miss/All sheet" };
      return { status: "success", rows: 0, cols: 0, fromAll: true };
    }
    var raw = missSheet.getDataRange().getValues();
    if (raw.length <= 1) return { status: "success", rows: 0, cols: 0 };
    return { status: "success", rows: raw.length, cols: raw[0].length };
  } catch (e) {
    return { status: "error", message: e.toString() };
  }
}

/**
 * 獲取遺漏表資料 — 唯讀，不修改任何工作表
 * @param {string} lotto 彩種
 * @param {string} dateStr 基準日期
 * @param {number} methodSN 方法序號
 * @param {number} limit 筆數
 * @returns {Object} { status, headers, rows, method, summary, dateCol }
 */
/**
 * 新架構試算表解析（資料夾 > 試算表 > 工作表），Miss 模組查詢端專用：
 *   All  ← {lotto} 試算表
 *   Miss ← {lotto}_Miss 試算表
 * 查詢失敗回傳 null（由呼叫端轉為 {status:"error"}，不拋錯以維持前端相容）。
 */
function _getMissSS(lotto) {
  try {
    var trObj = getTargetsheet("Sheets", lotto + "_Miss");
    return trObj ? trObj.spreadsheet : null;
  } catch (e) {
    return null;
  }
}

function _getAllSS(lotto) {
  try {
    var trObj = getTargetsheet("Sheets", lotto);
    return trObj ? trObj.spreadsheet : null;
  } catch (e) {
    return null;
  }
}

/** 舊名相容：過去 All/Miss 同試算表，現轉向 {lotto}_Miss 試算表 */
function _getLottoSS(lotto) {
  return _getMissSS(lotto);
}

function _readMissData(missSS, methodSN) {
  var missSheet = missSS.getSheetByName("Miss");
  if (!missSheet) return null;
  var raw = missSheet.getDataRange().getValues();
  if (raw.length <= 1) return null;
  var h = raw[0].map(function(c) { return String(c || "").trim(); });
  var snCol = h.indexOf("lngMethodSN");
  var dateCol = h.indexOf("Date");
  if (snCol === -1 || dateCol === -1) return null;
  var count = 0;
  for (var i = 1; i < raw.length; i++) { if (Number(raw[i][snCol]) === methodSN) count++; }
  return { raw: raw, headers: h, snCol: snCol, dateCol: dateCol, count: count };
}

function _ensureMissData(lotto, methodSN) {
  var missSS = _getMissSS(lotto);
  if (!missSS) return null;
  var info = _readMissData(missSS, methodSN);
  if (info && info.count > 0) return info;
  Logger.log("[_ensureMissData] lotto=%s methodSN=%s starting genMissData", lotto, methodSN);
  var result = genMissData(lotto, new Date(), methodSN, "ASC", -1);
  var iterations = 0;
  while (result && result.status === "continue" && iterations < 200) {
    iterations++;
    Logger.log("[_ensureMissData] lotto=%s methodSN=%s continue iteration=%d", lotto, methodSN, iterations);
    result = genMissData(lotto, new Date(), methodSN, "ASC", -1);
  }
  if (result && Array.isArray(result)) {
    Logger.log("[_ensureMissData] lotto=%s methodSN=%s completed rows=%d", lotto, methodSN, result.length);
  } else if (result && result.status === "error") {
    Logger.log("[_ensureMissData] lotto=%s methodSN=%s error=%s", lotto, methodSN, result.message);
  }
  return _readMissData(missSS, methodSN);
}

function getMissDataDrawNumbers(lotto, dateStr) {
  try {
    var date = new Date(String(dateStr).replace(/-/g, "/"));
    // 新架構：All ← {lotto} 試算表（開獎號碼查詢不動）
    var trObj = getTargetsheet("Sheets", lotto);
    if (!trObj) return { status: "error", message: "no sheet" };
    var allSheet = trObj.spreadsheet.getSheetByName("All");
    if (!allSheet) return { status: "error", message: "no All sheet" };
    var data = allSheet.getDataRange().getValues();
    if (data.length <= 1) return { status: "error", message: "no data" };
    var h = data[0].map(function(c) { return String(c || "").trim(); });
    var dateCol = h.indexOf("Date");
    if (dateCol === -1) return { status: "error", message: "no Date" };
    for (var di = 1; di < data.length; di++) {
      var r = data[di];
      if (r[dateCol] instanceof Date && r[dateCol].getTime() === date.getTime()) {
        var nums = [];
        var nCount = (lotto === "L539") ? 5 : 6;
        for (var ni = 1; ni <= nCount; ni++) {
          var idx = h.indexOf("N" + ni);
          if (idx > -1) nums.push(r[idx]);
        }
        return { status: "success", numbers: nums, special: _getDrawSpecial(h, r) };
      }
    }
    // 如果日期沒有完全吻合，額外一天的範圍比對
    for (var di2 = 1; di2 < data.length; di2++) {
      var r2 = data[di2];
      if (r2[dateCol]) {
        var d2 = r2[dateCol] instanceof Date ? r2[dateCol] : new Date(String(r2[dateCol]).replace(/-/g, "/"));
        var diff = Math.abs(d2.getTime() - date.getTime());
        if (diff < 86400000) { // 24小時內
          var nums2 = [];
          var nCount2 = (lotto === "L539") ? 5 : 6;
          for (var ni2 = 1; ni2 <= nCount2; ni2++) {
            var idx2 = h.indexOf("N" + ni2);
            if (idx2 > -1) nums2.push(r2[idx2]);
          }
          if (nums2.length > 0) return { status: "success", numbers: nums2, special: _getDrawSpecial(h, r2) };
        }
      }
    }
    return { status: "success", numbers: [] };
  } catch (e) {
    logSystemError("getMissDataDrawNumbers", e.toString(), "ERROR", "取得當日號碼失敗", { lotto: lotto, dateStr: dateStr });
    return { status: "error", message: e.toString() };
  }
}

/**
 * 取開獎列的特別號（無 S1 欄或空值回傳 null；L539 無特別號）
 */
function _getDrawSpecial(headers, row) {
  var s1Idx = headers.indexOf("S1");
  if (s1Idx === -1) return null;
  var v = row[s1Idx];
  if (v === null || v === undefined || v === "") return null;
  return v;
}

function getMissDataAllData(dateStr) {
  try {
    var date = new Date(String(dateStr).replace(/-/g, "/"));
    var allData = getAllData(date, true);
    if (!allData) return { status: "error", message: "找不到該日期的環境參數" };

    var fields = [
      "年天干", "年地支", "月天干", "月地支", "日天干", "日地支",
      "時柱", "日五形", "日十二建除", "日九星", "日二十八星宿", "時二十八星宿",
      "日八掛", "本命", "父母", "福德", "田宅", "官祿", "奴僕", "遷移", "疾厄", "財帛", "子女", "夫妻", "兄弟", "命重"
    ];

    var result = {};
    fields.forEach(function(f) {
      var v = allData[f];
      result[f] = v instanceof Date ? Utilities.formatDate(v, "Asia/Taipei", "yyyy-MM-dd") : (v || "");
    });

    return { status: "success", data: result };
  } catch (e) {
    logSystemError("getMissDataAllData", e.toString(), "ERROR", "取得環境參數失敗", { dateStr: dateStr });
    return { status: "error", message: e.toString() };
  }
}

function getMissData(lotto, dateStr, methodSN, limit, withDiag) {
  try {
    Logger.log("[getMissData] lotto=%s date=%s methodSN=%s limit=%s", lotto, dateStr, methodSN, limit);
    limit = parseInt(limit, 10);
    if (isNaN(limit) || limit < 1) limit = 50;

    var merged = getMissDataTable(lotto, dateStr, Number(methodSN), "DESC", limit);
    if (merged.status !== "success") {
      return { status: "success", headers: [], rows: [], dateCol: 1, summary: { lotto: lotto, date: dateStr, methodSN: methodSN, rowCount: 0 }, message: merged.message };
    }

    // getMissDataTable 回傳的 headers 已是 keepHeaders 格式
    // rows 是 Miss 格式 [methodSN, Date, N1..N5, Sum, M1..M39]
    // 只需修正 lngMethodSN 欄位為正確的 methodSN
    var keepHeaders = merged.headers;
    var outputRows = merged.rows.map(function(row) {
      var newRow = row.slice();
      newRow[0] = methodSN; // 確保 lngMethodSN 正確
      return newRow;
    });

    // Debug: verify output for 2026-06-16
    for (var odi = 0; odi < outputRows.length; odi++) {
      var dv = outputRows[odi][1];
      if (dv) {
        var dStr = dv instanceof Date ? Utilities.formatDate(dv, "Asia/Taipei", "yyyy-MM-dd") : String(dv);
        if (dStr === "2026-06-16") {
          Logger.log("[getMissData] output date=2026-06-16 M5=%s M17=%s", outputRows[odi][12], outputRows[odi][16+1]);
          break;
        }
      }
    }

    // Convert Date objects in output
    for (var oi = 0; oi < outputRows.length; oi++) {
      for (var cj = 0; cj < outputRows[oi].length; cj++) {
        if (outputRows[oi][cj] instanceof Date) {
          outputRows[oi][cj] = Utilities.formatDate(outputRows[oi][cj], "Asia/Taipei", "yyyy-MM-dd");
        }
      }
    }

    var methodInfo = null;
    if (methodSN !== 1) {
      var methodSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Method");
      if (methodSheet) {
        var mData = methodSheet.getDataRange().getValues();
        var mHeaders = mData[0].map(function(h) { return String(h || "").trim(); });
        var mSnCol = mHeaders.indexOf("lngMethodSN");
        for (var mi = 1; mi < mData.length; mi++) {
          if (Number(mData[mi][mSnCol]) === methodSN) {
            methodInfo = {};
            for (var mj = 0; mj < mHeaders.length; mj++) {
              var mv = mData[mi][mj];
              if (mv instanceof Date) mv = Utilities.formatDate(mv, "Asia/Taipei", "yyyy-MM-dd");
              methodInfo[mHeaders[mj]] = mv;
            }
            break;
          }
        }
      }
    }

    return {
      status: "success",
      headers: keepHeaders,
      rows: outputRows,
      method: methodInfo,
      summary: getMissDataSummary(lotto, dateStr, methodSN, outputRows.length, withDiag),
      dateCol: 1,
    };
  } catch (e) {
    logSystemError("getMissData", e.toString(), "ERROR", "取得遺漏表資料失敗", { lotto: lotto, dateStr: dateStr, methodSN: methodSN });
    return { status: "error", message: e.toString() };
  }
}

/**
 * 組裝 getMissData 回傳的 summary；withDiag=true 時才附三層日期診斷（除錯用）。
 */
function getMissDataSummary(lotto, dateStr, methodSN, rowCount, withDiag) {
  var summary = { lotto: lotto, date: dateStr, methodSN: methodSN, rowCount: rowCount };
  if (withDiag === true) {
    var d = collectMissDiag(lotto, dateStr, methodSN);
    summary.diag = d.status === "success"
      ? { raw: d.raw, all: d.all, miss: d.miss, branch: d.branch }
      : { error: d.message };
  }
  return summary;
}
/**
 * 唯讀診斷核心：比對 原始開獎 / All / Miss 三層最新日期，定位「日期沒對上」卡在哪一層。
 * 不寫入任何工作表。
 * @param {string} lotto 彩種
 * @param {string} dateStr 基準日期
 * @param {number} methodSN 方法序號
 * @returns {Object} { status, raw, all, miss, sourceCount, missCount, branch }
 */
function collectMissDiag(lotto, dateStr, methodSN) {
  try {
    lotto = lotto || "L539";
    methodSN = Number(methodSN) || 1;

    var fmt = function(v) {
      if (!v) return null;
      var d = v instanceof Date ? v : new Date(String(v).replace(/-/g, "/"));
      if (isNaN(d.getTime())) return String(v);
      return Utilities.formatDate(d, "Asia/Taipei", "yyyy-MM-dd");
    };
    var toTime = function(v) {
      if (!v) return -1;
      var d = v instanceof Date ? v : new Date(String(v).replace(/-/g, "/"));
      return isNaN(d.getTime()) ? -1 : d.getTime();
    };
    // 輕量讀取：標頭列 + 最後一列（開獎/All 皆按日期附加，最新即最後一列）
    var lastDateOf = function(sheet, sheetLabel) {
      var info = { rows: 0, latest: null, latestT: -1 };
      if (!sheet || sheet.getLastRow() <= 1) return info;
      var lastRow = sheet.getLastRow();
      var lastCol = sheet.getLastColumn();
      var h = sheet.getRange(1, 1, 1, lastCol).getValues()[0]
        .map(function(c) { return String(c || "").trim(); });
      var dateCol = h.indexOf("Date");
      if (dateCol === -1) return info;
      info.rows = lastRow - 1;
      var v = sheet.getRange(lastRow, dateCol + 1, 1, 1).getValue();
      var t = toTime(v);
      // 最後一列若無日期（極少數髒資料），往前找 5 列
      var r = lastRow;
      while (t === -1 && r > Math.max(1, lastRow - 5)) {
        r--;
        t = toTime(sheet.getRange(r, dateCol + 1, 1, 1).getValue());
      }
      if (t > -1) { info.latestT = t; info.latest = fmt(new Date(t)); }
      return info;
    };

    // 第 1 層：主試算表原始開獎
    var rawSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(lotto);
    var rawInfo = lastDateOf(rawSheet);

    // 第 2/3 層：新架構 All ← {lotto}；Miss ← {lotto}_Miss
    var sheets = getMissSpreadsheets(lotto);
    var allInfo = lastDateOf(sheets.allSS.getSheetByName("All"));

    // Miss 依 methodSN 交錯存放，只讀前兩欄掃描（新格式：lngMethodSN, Date, ...）
    var missInfo = { rows: 0, latest: null, latestT: -1 };
    var missSheet = sheets.missSS.getSheetByName("Miss");
    if (missSheet && missSheet.getLastRow() > 1) {
      var mLastRow = missSheet.getLastRow();
      var mH = missSheet.getRange(1, 1, 1, missSheet.getLastColumn()).getValues()[0]
        .map(function(c) { return String(c || "").trim(); });
      var mSnCol = mH.indexOf("lngMethodSN");
      var mDateCol = mH.indexOf("Date");
      if (mDateCol > -1) {
        var cols = Math.max(mDateCol + 1, 2);
        var md = missSheet.getRange(2, 1, mLastRow - 1, cols).getValues();
        var cnt = 0, bestT = -1;
        for (var mi = 0; mi < md.length; mi++) {
          if (mSnCol > -1 && Number(md[mi][mSnCol]) !== methodSN) continue;
          cnt++;
          var t = toTime(md[mi][mDateCol]);
          if (t > bestT) bestT = t;
        }
        missInfo.rows = cnt;
        if (bestT > -1) { missInfo.latestT = bestT; missInfo.latest = fmt(new Date(bestT)); }
      }
    }

    // 以日期推斷查詢分支（與 getMissDataTable 等長/補齊條件同義）
    var branch = (allInfo.latestT === missInfo.latestT) ? "equal(直接回傳Miss)"
      : (allInfo.latestT > missInfo.latestT ? "fill(增量補齊並寫回)" : "stale(Miss比All新,不應發生)");

    return {
      status: "success",
      lotto: lotto, date: dateStr, methodSN: methodSN,
      raw: { rows: rawInfo.rows, latest: rawInfo.latest },
      all: { rows: allInfo.rows, latest: allInfo.latest },
      miss: { rows: missInfo.rows, latest: missInfo.latest },
      branch: branch,
    };
  } catch (e) {
    return { status: "error", message: e.toString() };
  }
}

/**
 * 唯讀診斷（供 DevTools Console 直接呼叫）：
 *   google.script.run.withSuccessHandler(function(r){console.log(JSON.stringify(r))}).getMissDiag("L539","2026-10-05",1);
 */
function getMissDiag(lotto, dateStr, methodSN) {
  return collectMissDiag(lotto, dateStr, methodSN);
}
