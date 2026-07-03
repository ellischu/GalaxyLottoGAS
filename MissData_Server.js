/**
 * 診斷用：測試 google.script.run 通訊是否正常
 */
function ping() {
  return { status: "success", message: "pong" };
}

/**
 * 診斷用：測試小量回傳 (不出動 getTargetsheet)
 */
function getMissDataLight() {
  try {
    var lottoSS = _getLottoSS("L539");
    if (!lottoSS) return { status: "error", message: "no L539 sub-SS" };
    var missSheet = lottoSS.getSheetByName("Miss");
    if (!missSheet) return { status: "error", message: "no Miss sheet" };
    var raw = missSheet.getDataRange().getValues();
    if (raw.length <= 1) return { status: "error", message: "no Miss data" };
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
  genMissData(lotto, new Date(), methodSN, "ASC", -1);
  return _readMissData(lottoSS, methodSN);
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

    var info = _ensureMissData(lotto, Number(methodSN));
    if (!info) {
      return { status: "success", headers: [], rows: [], dateCol: 1, summary: { lotto: lotto, date: dateStr, methodSN: methodSN, rowCount: 0 }, message: "尚無遺漏資料" };
    }

    var headersRow = info.headers;
    var snCol = info.snCol;
    var dateCol = info.dateCol;
    var rawData = info.raw;
    var targetDate = new Date(String(dateStr).replace(/-/g, "/"));

    var filtered = [];
    for (var ri = 1; ri < rawData.length; ri++) {
      var row = rawData[ri];
      if (!row[dateCol]) continue;
      if (Number(row[snCol]) !== methodSN) continue;
      if (new Date(row[dateCol]) >= targetDate) continue;
      filtered.push(row);
    }

    filtered.sort(function(a, b) {
      return new Date(b[dateCol]) - new Date(a[dateCol]);
    });

    var outputRows = limit > 0 ? filtered.slice(0, limit) : filtered;

    function _convertDates(arr) {
      for (var ci = 0; ci < arr.length; ci++) {
        if (arr[ci] instanceof Date) arr[ci] = Utilities.formatDate(arr[ci], "Asia/Taipei", "yyyy-MM-dd");
      }
      return arr;
    }
    for (var oi = 0; oi < outputRows.length; oi++) _convertDates(outputRows[oi]);
    _convertDates(headersRow);

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
      headers: headersRow,
      rows: outputRows,
      method: methodInfo,
      summary: { lotto: lotto, date: dateStr, methodSN: methodSN, rowCount: outputRows.length },
      dateCol: dateCol,
    };
  } catch (e) {
    logSystemError("getMissData", e.toString(), "ERROR", "取得遺漏表資料失敗", { lotto: lotto, dateStr: dateStr, methodSN: methodSN });
    return { status: "error", message: e.toString() };
  }
}
