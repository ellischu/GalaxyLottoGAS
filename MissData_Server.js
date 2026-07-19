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
    var lottoSS = _getLottoSS(lotto);
    if (!lottoSS) return { status: "error", message: "no " + lotto + " sub-SS" };
    var missSheet = lottoSS.getSheetByName("Miss");
    if (!missSheet) {
      var allSheet = lottoSS.getSheetByName("All");
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
function _getLottoSS(lotto) {
  var sheetsSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Sheets");
  if (!sheetsSheet) return null;
  var sData = sheetsSheet.getDataRange().getValues();
  for (var si = 1; si < sData.length; si++) {
    if (String(sData[si][0]).trim() === lotto) {
      var url = String(sData[si][1] || "").trim();
      var id = url.match(/[-\w]{25,}/);
      if (id) return SpreadsheetApp.openById(id[0]);
    }
  }
  return null;
}

function _readMissData(lottoSS, methodSN) {
  var missSheet = lottoSS.getSheetByName("Miss");
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
  var lottoSS = _getLottoSS(lotto);
  if (!lottoSS) return null;
  var info = _readMissData(lottoSS, methodSN);
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
  return _readMissData(lottoSS, methodSN);
}

function getMissDataDrawNumbers(lotto, dateStr) {
  try {
    var date = new Date(String(dateStr).replace(/-/g, "/"));
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
        for (var ni = 1; ni <= 5; ni++) {
          var idx = h.indexOf("N" + ni);
          if (idx > -1) nums.push(r[idx]);
        }
        return { status: "success", numbers: nums };
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
          for (var ni2 = 1; ni2 <= 5; ni2++) {
            var idx2 = h.indexOf("N" + ni2);
            if (idx2 > -1) nums2.push(r2[idx2]);
          }
          if (nums2.length > 0) return { status: "success", numbers: nums2 };
        }
      }
    }
    return { status: "success", numbers: [] };
  } catch (e) {
    logSystemError("getMissDataDrawNumbers", e.toString(), "ERROR", "取得當日號碼失敗", { lotto: lotto, dateStr: dateStr });
    return { status: "error", message: e.toString() };
  }
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

function getMissData(lotto, dateStr, methodSN, limit) {
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
      summary: { lotto: lotto, date: dateStr, methodSN: methodSN, rowCount: outputRows.length },
      dateCol: 1,
    };
  } catch (e) {
    logSystemError("getMissData", e.toString(), "ERROR", "取得遺漏表資料失敗", { lotto: lotto, dateStr: dateStr, methodSN: methodSN });
    return { status: "error", message: e.toString() };
  }
}
