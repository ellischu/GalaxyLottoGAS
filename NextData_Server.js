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
function _appendNextRows(nextSS, sheetName, headers, rows, dedupCol) {
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
  if (sheet.getLastRow() > 1) {
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
    raw.slice(1).forEach(function(r) {
      if (!r[dateIdx]) return;
      var s = Utilities.formatDate(new Date(r[dateIdx]), "Asia/Taipei", "yyyy-MM-dd");
      if (!seenAll[s]) { seenAll[s] = true; allDatesAsc.push(s); }
    });
    allDatesAsc.sort();

    // 2. DataN00 索引 strcheck → SN；配置新 SN
    var intRSVn = [5, 7, 9, 14].indexOf(Number(rsvn)) > -1 ? Number(rsvn) : (NEXT_KD_RSVN[lotto] || 9);
    var n00Sheet = nextSS.getSheetByName("DataN00");
    var checkToSN = {};
    var maxSN = 0;
    if (n00Sheet && n00Sheet.getLastRow() > 1) {
      var n00Data = n00Sheet.getDataRange().getValues();
      var n00H = n00Data[0].map(function(c) { return String(c || "").trim(); });
      var chkCol = n00H.indexOf("strcheck");
      var snCol = n00H.indexOf("lngDataN00SN");
      if (chkCol > -1 && snCol > -1) {
        for (var ni = 1; ni < n00Data.length; ni++) {
          var sn = Number(n00Data[ni][snCol]) || 0;
          if (sn > maxSN) maxSN = sn;
          checkToSN[String(n00Data[ni][chkCol]).trim()] = sn;
        }
      }
    }

    // 2b. DataNKD00 索引 strcheck → KDSN；配置新 KDSN
    var kd00Sheet = nextSS.getSheetByName("DataNKD00");
    var checkToKDSN = {};
    var maxKDSN = 0;
    if (kd00Sheet && kd00Sheet.getLastRow() > 1) {
      var kd00Data = kd00Sheet.getDataRange().getValues();
      var kd00H = kd00Data[0].map(function(c) { return String(c || "").trim(); });
      var kdKdCol = kd00H.indexOf("lngDataN00KDSN");
      var kdChkCol = kd00H.indexOf("strcheck");
      if (kdKdCol > -1 && kdChkCol > -1) {
        for (var ki = 1; ki < kd00Data.length; ki++) {
          var kdsn = Number(kd00Data[ki][kdKdCol]) || 0;
          if (kdsn > maxKDSN) maxKDSN = kdsn;
          checkToKDSN[String(kd00Data[ki][kdChkCol]).trim()] = kdsn;
        }
      }
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
    var allSheetNames = Object.keys(sheetRows);
    var histSheetNames = positions.map(function(p) { return p.sheet; });
    var nextSheetNames = positions.map(function(p) { return p.nsheet; });
    var varSheetNames = positions.map(function(p) { return p.varsheet; });
    // KD 工作表準備
    var kd00Rows = [];
    var kdSheetRows = {};
    var kdSheetHeaders = {};
    positions.forEach(function(p) {
      kdSheetRows[p.kdsheet] = [];
      kdSheetHeaders[p.kdsheet] = _nextKDHeaders(p);
    });
    var kdSheetNames = Object.keys(kdSheetRows);
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
    // 預讀各子表已存在 SN（各 1 次讀取），供缺列檢測
    var snSets = {};
    allSheetNames.forEach(function(nm) {
      var s = {};
      var sh = nextSS.getSheetByName(nm);
      if (sh && sh.getLastRow() > 1 && _nextSNCol(sh) === 0) {
        sh.getRange(2, 1, sh.getLastRow() - 1, 1).getValues().forEach(function(r) { s[Number(r[0])] = true; });
      }
      snSets[nm] = s;
    });
    // 預讀各 KD 子表已存在 KDSN（第 1 欄）
    var kdSnSets = {};
    kdSheetNames.forEach(function(nm) {
      var s = {};
      var sh = nextSS.getSheetByName(nm);
      if (sh && sh.getLastRow() > 1) {
        sh.getRange(2, 1, sh.getLastRow() - 1, 1).getValues().forEach(function(r) { s[Number(r[0])] = true; });
      }
      kdSnSets[nm] = s;
    });
    // 預讀各預測 KD 子表已存在 KDSN（第 1 欄）
    var kdNextSnSets = {};
    nkSheetNames.forEach(function(nm) {
      var s = {};
      var sh = nextSS.getSheetByName(nm);
      if (sh && sh.getLastRow() > 1) {
        sh.getRange(2, 1, sh.getLastRow() - 1, 1).getValues().forEach(function(r) { s[Number(r[0])] = true; });
      }
      kdNextSnSets[nm] = s;
    });
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
      // 歷史表完整性（欄位 0 = 快照 SN）／預測表完整性（欄位 0 = 目標日 SN）／變異量表完整性（欄位 0 = 快照 SN）
      var histComplete = histSheetNames.every(function(nm) { return !!snSets[nm][sn]; });
      var nextComplete = nextSheetNames.every(function(nm) { return !!snSets[nm][tSn]; });
      var varComplete = varSheetNames.every(function(nm) { return !!snSets[nm][sn]; });
      // KD 完整性：strcheck（SN#RSVn#RSVCo）需存在於 DataNKD00，且 KDSN 需存在於所有 DataNKD0x
      var kdCheck = sn + "#" + intRSVn + "#" + NEXT_KD_RSVCO;
      var kdsn = checkToKDSN[kdCheck] || 0;
      var kdComplete = kdsn > 0 && kdSheetNames.every(function(nm) { return !!kdSnSets[nm][kdsn]; });
      // 預測 KD 完整性：目標日 KDSN（Tsn#RSVn#RSVCo）需存在於 DataNKD00，且存在於所有 DataNNextKD0x
      var nextKdCheck = tSn + "#" + intRSVn + "#" + NEXT_KD_RSVCO;
      var tKdsn = checkToKDSN[nextKdCheck] || 0;
      var nextKdComplete = tKdsn > 0 && nkSheetNames.every(function(nm) { return !!kdNextSnSets[nm][tKdsn]; });
      if (histComplete && nextComplete && kdComplete && nextKdComplete && varComplete) return;
      // 目標日 KDSN 配號（尚未開獎的目標日也先建 DataNKD00 列，開獎後沿用同 KDSN 補子列）
      if (!nextKdComplete && tKdsn === 0) {
        maxKDSN++;
        tKdsn = maxKDSN;
        checkToKDSN[nextKdCheck] = tKdsn;
        kd00Rows.push([tKdsn, tSn, intRSVn, NEXT_KD_RSVCO, nextKdCheck]);
      }
      // 以該期為界：含當期在內往前 BASE＋200 期為數列，當期列為號碼
      var dTime = new Date(ds.replace(/-/g, "/")).getTime();
      var before = priors.filter(function(r) { return new Date(r[dateIdx]).getTime() <= dTime; });
      var take = Math.min(before.length, baseRange + 200);
      var win2 = before.slice(before.length - take);
      var dayRow = null;
      for (var k = priors.length - 1; k >= 0; k--) {
        if (Utilities.formatDate(new Date(priors[k][dateIdx]), "Asia/Taipei", "yyyy-MM-dd") === ds) { dayRow = priors[k]; break; }
      }
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
        if (!histComplete) {
          var wins = _calcPositionWindows(series);
          var row = [sn, num];
          wins.forEach(function(r) { row.push(r.avg, r.std, r.min, r.max); });
          row.push(sn + "#" + num);
          sheetRows[p.sheet].push(row);
        }
        // 變異量表 DataNVAR0x：一列（僅當變異量表不完整時）
        if (!varComplete) {
          var varWins = _calcPositionVar(series);
          var varRow = [sn];
          varWins.forEach(function(r) { varRow.push(r.avgVar, r.stdVar, r.minVar, r.maxVar); });
          sheetRows[p.varsheet].push(varRow);
        }
        // 預測表 DataNNext0x：全號池每號一列（欄位 0 ＝ 目標日 SN，strcheck＝目標SN#cand）
        var candWins = null;
        if (!nextComplete || !nextKdComplete) {
          candWins = {};
          for (var cand = 1; cand <= poolMax; cand++) candWins[cand] = _calcNextCandWins(series, cand);
        }
        if (!nextComplete) {
          for (var cand2 = 1; cand2 <= poolMax; cand2++) {
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
          }
          kdWins = _nextWindows().map(function(w) {
            var kd = _calcKD(series, w, intRSVn);
            return { w: w, rsv: _nextRound3(kd.rsv), k: _nextRound3(kd.k), d: _nextRound3(kd.d), j: _nextRound3(kd.j) };
          });
          if (!kdComplete) {
            var kdRow = [kdsn];
            kdWins.forEach(function(r) { kdRow.push(r.rsv, r.k, r.d, r.j); });
            kdRow.push(kdsn + "#" + num);
            kdSheetRows[p.kdsheet].push(kdRow);
          }
        }
        // 預測 KD 表 DataNNextKD0x：候選號 × 5 窗口（Current＝候選 AVG，前筆＝觀測日 DataNKD 值）
        if (!nextKdComplete) {
          var avgByW = {};
          _nextWindows().forEach(function(w) {
            var a = [];
            for (var ai = w - 1; ai < series.length; ai++) a.push(_nextAvg(series.slice(ai - w + 1, ai + 1)));
            avgByW[w] = a;
          });
          for (var cand3 = 1; cand3 <= poolMax; cand3++) {
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

    // 4. 批次寫入（先子表含預測表、後 DataN00；任一失敗則本輪不寫 N00，下次重算不髒快取）
    var writeLog = [];
    var allOk = true;
    allSheetNames.forEach(function(nm) {
      try {
        var nw = _appendNextRows(nextSS, nm, sheetHeaders[nm], sheetRows[nm]);
        if (nw > 0) writeLog.push(nm + "寫入" + nw + "列");
      } catch (e) {
        allOk = false;
        writeLog.push("ERR " + nm + "寫入失敗：" + e.toString());
        Logger.log("[getNextData] write %s failed: %s", nm, e.toString());
      }
    });
    // KD 子表寫入（去重欄 = lngDataN00KDSN）
    kdSheetNames.forEach(function(nm) {
      try {
        var nw = _appendNextRows(nextSS, nm, kdSheetHeaders[nm], kdSheetRows[nm], "lngDataN00KDSN");
        if (nw > 0) writeLog.push(nm + "寫入" + nw + "列");
      } catch (e) {
        allOk = false;
        writeLog.push("ERR " + nm + "寫入失敗：" + e.toString());
        Logger.log("[getNextData] write %s failed: %s", nm, e.toString());
      }
    });
    // 預測 KD 子表寫入（去重欄 = lngDataN00KDSN）
    nkSheetNames.forEach(function(nm) {
      try {
        var nw = _appendNextRows(nextSS, nm, nkSheetHeaders[nm], nkSheetRows[nm], "lngDataN00KDSN");
        if (nw > 0) writeLog.push(nm + "寫入" + nw + "列");
      } catch (e) {
        allOk = false;
        writeLog.push("ERR " + nm + "寫入失敗：" + e.toString());
        Logger.log("[getNextData] write %s failed: %s", nm, e.toString());
      }
    });
    if (allOk) {
      try {
        var n0 = _appendNextRows(nextSS, "DataN00", _nextN00Headers(), n00Rows);
        if (n0 > 0) writeLog.push("DataN00寫入" + n0 + "列");
      } catch (e) {
        allOk = false;
        writeLog.push("ERR DataN00寫入失敗：" + e.toString());
        Logger.log("[getNextData] write DataN00 failed: %s", e.toString());
      }
      // DataNKD00 寫入（去重欄 = strcheck，支援同 SN 多組 KD 參數）
      if (kd00Rows.length > 0) {
        try {
          var nw = _appendNextRows(nextSS, "DataNKD00", _nextKD00Headers(), kd00Rows, "strcheck");
          if (nw > 0) writeLog.push("DataNKD00寫入" + nw + "列");
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
      return _readNextSnapshot(nextSS, lotto, positions, snOfDate[ds], methodSN, ds, baseRange, checkToKDSN, intRSVn);
    });
    var predict = null;
    if (pageDates.length > 0) {
      var pTsn = targetOfDate[pageDates[0]];
      var pTKdsn = checkToKDSN[pTsn + "#" + intRSVn + "#" + NEXT_KD_RSVCO] || 0;
      predict = _readNextPredict(nextSS, positions, pTsn, targetDateOf[pageDates[0]], pTKdsn);
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
function _readNextSnapshot(nextSS, lotto, positions, sn, methodSN, ymdDash, baseRange, checkToKDSN, intRSVn) {
  var flat = ymdDash.replace(/-/g, "");
  var kdCheck = sn + "#" + intRSVn + "#" + NEXT_KD_RSVCO;
  var kdsn = (checkToKDSN && checkToKDSN[kdCheck]) || 0;
  var out = positions.map(function(p) {
    var sheet = nextSS.getSheetByName(p.sheet);
    var wins = _nextWindows().map(function(w) { return { w: w, avg: 0, std: 0, min: 0, max: 0, rsv: 0, k: 0, d: 0, j: 0 }; });
    var num = 0;
    if (sheet && sheet.getLastRow() > 1) {
      var data = sheet.getDataRange().getValues();
      var h = data[0].map(function(c) { return String(c || "").trim(); });
      var snC = h.indexOf("lngDataN00SN");
      var numC = h.indexOf(p.numCol);
      for (var i = 1; i < data.length; i++) {
        if (Number(data[i][snC]) === sn) {
          num = numC > -1 ? (Number(data[i][numC]) || 0) : 0;
          wins = _nextWindows().map(function(w) {
            var sfx = p.pos + _nextWinSuffix(w);
            var gi = function(n) { var c = h.indexOf(n); return c > -1 ? Number(data[i][c]) || 0 : 0; };
            return { w: w, avg: gi("sglAvg" + sfx), std: gi("sglStd" + sfx), min: gi("intMin" + sfx), max: gi("intMax" + sfx) };
          });
          break;
        }
      }
    }
    // KD 指標讀回（經 KDSN）
    if (kdsn > 0) {
      var kdSheet = nextSS.getSheetByName(p.kdsheet);
      if (kdSheet && kdSheet.getLastRow() > 1) {
        var kdData = kdSheet.getDataRange().getValues();
        var kdH = kdData[0].map(function(c) { return String(c || "").trim(); });
        var kdSnC = kdH.indexOf("lngDataN00KDSN");
        for (var ki = 1; ki < kdData.length; ki++) {
          if (Number(kdData[ki][kdSnC]) === kdsn) {
            wins = wins.map(function(wObj) {
              var sfx = p.pos + _nextWinSuffix(wObj.w);
              var gi = function(n) { var c = kdH.indexOf(n); return c > -1 ? Number(kdData[ki][c]) || 0 : 0; };
              return {
                w: wObj.w, avg: wObj.avg, std: wObj.std, min: wObj.min, max: wObj.max,
                rsv: gi("sglAvg" + sfx + "RSV"), k: gi("sglAvg" + sfx + "K"),
                d: gi("sglAvg" + sfx + "D"), j: gi("sglAvg" + sfx + "J"),
              };
            });
            break;
          }
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

/** 依 N00SN 讀回單期預測表（DataNNext0x，全候選號碼由小到大）；
 *  經目標日 KDSN 讀回預測 KD（DataNNextKD0x，依候選號併入各窗口 rsv/k/d/j） */
function _readNextPredict(nextSS, positions, sn, ymdDash, kdsn) {
  var out = positions.map(function(p) {
    var sheet = nextSS.getSheetByName(p.nsheet);
    var rows = [];
    if (sheet && sheet.getLastRow() > 1) {
      var data = sheet.getDataRange().getValues();
      var h = data[0].map(function(c) { return String(c || "").trim(); });
      var snC = h.indexOf("lngDataN00SN");
      var numC = h.indexOf(p.numCol);
      for (var i = 1; i < data.length; i++) {
        if (Number(data[i][snC]) !== sn) continue;
        var wins = _nextWindows().map(function(w) {
          var sfx = p.pos + _nextWinSuffix(w);
          var gi = function(n) { var c = h.indexOf(n); return c > -1 ? Number(data[i][c]) || 0 : 0; };
          return { w: w, avg: gi("sglAvg" + sfx), std: gi("sglStd" + sfx), min: gi("intMin" + sfx), max: gi("intMax" + sfx) };
        });
        rows.push({ num: numC > -1 ? (Number(data[i][numC]) || 0) : 0, wins: wins });
      }
      rows.sort(function(a, b) { return a.num - b.num; });
    }
    // 預測 KD 讀回（欄 0 ＝ KDSN、第 2 欄＝候選號）
    if (kdsn > 0) {
      var kdSheet = nextSS.getSheetByName(p.nkdsheet);
      if (kdSheet && kdSheet.getLastRow() > 1) {
        var kdData = kdSheet.getDataRange().getValues();
        var kdH = kdData[0].map(function(c) { return String(c || "").trim(); });
        var kdKdC = kdH.indexOf("lngDataN00KDSN");
        var kdNumC = kdH.indexOf(p.numCol);
        if (kdKdC > -1 && kdNumC > -1) {
          for (var ki = 1; ki < kdData.length; ki++) {
            if (Number(kdData[ki][kdKdC]) !== kdsn) continue;
            var byNum = Number(kdData[ki][kdNumC]) || 0;
            var kdW = {};
            _nextWindows().forEach(function(w) {
              var sfx = p.pos + _nextWinSuffix(w);
              var gi = function(n) { var c = kdH.indexOf(n); return c > -1 ? Number(kdData[ki][c]) || 0 : 0; };
              kdW[w] = { rsv: gi("sglAvg" + sfx + "RSV"), k: gi("sglAvg" + sfx + "K"),
                d: gi("sglAvg" + sfx + "D"), j: gi("sglAvg" + sfx + "J") };
            });
            rows.forEach(function(r) {
              if (r.num !== byNum) return;
              r.wins.forEach(function(x) {
                if (!kdW[x.w]) return;
                x.rsv = kdW[x.w].rsv; x.k = kdW[x.w].k; x.d = kdW[x.w].d; x.j = kdW[x.w].j;
              });
            });
          }
        }
      }
    }
    return { key: p.nsheet.replace("Data", ""), sheet: p.nsheet, title: p.title, col: p.col, rows: rows };
  });
  return { sn: sn, date: ymdDash, kdsn: kdsn, positions: out };
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
