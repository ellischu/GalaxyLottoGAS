/**
 * 獲取 Activity 頁面初始化的標籤與環境數據
 */
function getActivityInitData(lotto, dateStr, methodSN) {
  var methodObj = null;
  if (Number(methodSN) === 1) {
    methodObj = { FieldMode: false, strCompares: "", NextNumsMode: false, intNextNums: 0, intNextStep: 0 };
  } else {
    methodObj = getMethodObj(Number(methodSN));
  }

  var trObj = getTargetsheet("Sheets", lotto);
  var lottoSs = trObj ? trObj.spreadsheet : null;
  if (!lottoSs) return { method: methodObj, env: null };

  var allSheet = lottoSs.getSheetByName("All");
  if (!allSheet) return { method: methodObj, env: null };

  var headers = allSheet.getRange(1, 1, 1, allSheet.getLastColumn()).getValues()[0];
  var allData = allSheet.getDataRange().getValues();
  var envObj = null;

  for (var j = 1; j < allData.length; j++) {
    var cellDate = allData[j][0];
    var cellDateStr = (cellDate instanceof Date)
      ? Utilities.formatDate(cellDate, "Asia/Taipei", "yyyy-MM-dd")
      : String(cellDate);
    if (cellDateStr === dateStr) {
      envObj = {};
      for (var ci = 0; ci < headers.length; ci++) envObj[headers[ci]] = allData[j][ci];
      envObj.Date = cellDateStr;
      break;
    }
  }
  Logger.log("[getActivityInitData] lotto=%s date=%s found=%s", lotto, dateStr, !!envObj);
  return { method: methodObj, env: envObj };
}

/**
 * 格式化環境參數為前端 AeraAll 表格所需的結構
 */
function formatEnvData(envObj, lotto) {
  if (!envObj) return [];

  var fieldOrder = ["Date", "N1", "N2", "N3", "N4", "N5"];
  if (lotto !== "L539") fieldOrder.push("N6");
  if (lotto === "L649" || lotto === "L638" || lotto === "LSix") fieldOrder.push("S1");
  fieldOrder.push("Sum",
    "年天干","年地支","月天干","月地支","日天干","日地支","時柱",
    "日五形","日十二建除","日九星","日二十八星宿","時二十八星宿","日八掛",
    "本命","父母","福德","田宅","官祿","奴僕","遷移","疾厄","財帛","子女","夫妻","兄弟","命重");

  var displayTitles = {
    Date:"日期", N1:"號1", N2:"號2", N3:"號3", N4:"號4", N5:"號5",
    N6:"號6", S1:"特別號1", Sum:"總合",
    年天干:"年干", 年地支:"年支", 月天干:"月干", 月地支:"月支",
    日天干:"日干", 日地支:"日支", 時柱:"時柱", 日五形:"日形",
    日十二建除:"日執", 日九星:"日星", 日二十八星宿:"日宿",
    時二十八星宿:"時宿", 日八掛:"日掛",
    本命:"本命", 父母:"父母", 福德:"福德", 田宅:"田宅", 官祿:"官祿",
    奴僕:"奴僕", 遷移:"遷移", 疾厄:"疾厄", 財帛:"財帛", 子女:"子女",
    夫妻:"夫妻", 兄弟:"兄弟", 命重:"命重"};

  var ballFields = {N1:true,N2:true,N3:true,N4:true,N5:true,N6:true,S1:true};
  var result = [];
  for (var fi = 0; fi < fieldOrder.length; fi++) {
    var f = fieldOrder[fi];
    var val = envObj[f];
    if (val === undefined || val === null) continue;
    if (val instanceof Date) val = Utilities.formatDate(val, "Asia/Taipei", "yyyy-MM-dd");
    result.push({ label: displayTitles[f] || f, value: String(val), isBall: !!ballFields[f], isChanged: false });
  }
  return result;
}

/**
 * 主入口：獲取 Activity 完整報告
 */
function getActivityReport(lotto, dateStr, methodSN) {
  Logger.log("[getActivityReport] lotto=%s date=%s methodSN=%s", lotto, dateStr, methodSN);
  var initData = getActivityInitData(lotto, dateStr, methodSN);
  var freqData = getFreqSecData(lotto, dateStr, methodSN);

  if (freqData.status !== "success") {
    Logger.log("[getActivityReport] freqData error: %s", freqData.message);
    return {
      status: "error", method: initData.method,
      envData: initData.env ? formatEnvData(initData.env, lotto) : [],
      message: freqData.message,
    };
  }

  Logger.log("[getActivityReport] success: %d rows, %d periods", freqData.statsRows.length, freqData.totalPeriods);
  return {
    status: "success", method: initData.method,
    envData: initData.env ? formatEnvData(initData.env, lotto) : [],
    fieldHeaders: freqData.statsHeaders, statsRows: freqData.statsRows,
    totalPeriods: freqData.totalPeriods, windowSize: freqData.windowSize,
  };
}
