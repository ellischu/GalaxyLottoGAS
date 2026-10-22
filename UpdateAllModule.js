/**
 *
 * @param {*} sheetname
 * @returns
 */
function combineData(sheetname) {
  startTime = new Date().getTime();

  try {
    const trObj = getTargetsheet("Sheets", sheetname);
    const trspreadsheet = trObj.spreadsheet;
    let trsheet = trspreadsheet.getSheetByName("All");

    if (!trsheet) {
      trsheet = trspreadsheet.insertSheet("All");
    }

    const srsheet1 = mainspreadsheet.getSheetByName(sheetname);
    if (!srsheet1) {
      logSystemError("combineData", "找不到來源工作表: " + sheetname, "ERROR", "請先執行更新號碼", { sheetname: sheetname });
      return { status: "error", message: "找不到來源工作表: " + sheetname };
    }

  // --- 自動偵測與修復 (Repair Logic) ---
  let lastRow = trsheet.getLastRow();
  // 1. 檢查標題列是否消失或損壞 (All 工作表的第一格應為 Date)
  if (lastRow > 0 && trsheet.getRange(1, 1).getValue() !== "Date") {
    logSystemError("combineData", `偵測到 ${sheetname} - All 工作表標題損壞，正在重置結構...`, "WARNING");
    trsheet.clear();
    lastRow = 0;
  }

  // 檢查 trsheet 是否有資料，並取得最後一筆 Date 欄位資料
  // 如果沒有資料則 srsheet1 從第一筆資料開始結合
  let lastdate = null; //trsheet 的最後一筆 Date 欄位資料
  if (lastRow > 1) {
    var val = trsheet.getRange(lastRow, 1).getValue();
    // 檢查回傳的值是否可以被轉換為有效的日期物件
    if (val && !isNaN(new Date(val).getTime())) {
      lastdate = new Date(val);
    } else {
      // 修復：如果最後一行日期無效，移除該行並重新執行，以修復續傳邏輯
      logSystemError("combineData", `偵測到損壞的日期資料 (Row: ${lastRow})，正在自動修復...`, "WARNING");
      trsheet.deleteRow(lastRow);
      return combineData(sheetname);
    }
  }

  const srData = srsheet1.getDataRange().getValues();
  const headers = srData[0];
  const lCols = headers
    .map((h, i) => ({ h, i }))
    .filter((o) => o.h.match(/^L\d+$/))

    .map((o) => o.i);
  const s1Col = headers.indexOf("S1");
  const sumCol = headers.indexOf("Sum");
  const dateCol = headers.indexOf("Date");

  // --- 效能優化：預先讀取 AllData 並建立索引 Map ---
  const allDataSheet = mainspreadsheet.getSheetByName("AllData");

  // 2. 初始化標題 (如果表格是空的)
  if (lastRow === 0) {
    let headerRow = ["Date"];
    lCols.forEach((_, i) => headerRow.push("N" + (i + 1)));
    if (s1Col > -1) headerRow.push("S1");
    if (sumCol > -1) headerRow.push("Sum");

    // 加上來自 AllData 的擴充欄位標題
    if (allDataSheet) {
      const adHeaders = allDataSheet
        .getRange(1, 1, 1, allDataSheet.getLastColumn())
        .getValues()[0];
      headerRow = headerRow.concat(adHeaders.slice(1));
    }
    trsheet.appendRow(headerRow);
    Logger.log("已成功建立 'All' 工作表標頭。");
  }

  var allDataMap = {};
  if (allDataSheet) {
    var cache = CacheService.getScriptCache();
    var cached = cache.get("combine_AllDataMap");
    if (cached) {
      allDataMap = JSON.parse(cached);
    } else {
      const adValues = allDataSheet.getDataRange().getValues();
      adValues.forEach((row, idx) => {
        if (idx === 0 || !row[0]) return;
        const dObj =
          row[0] instanceof Date
            ? row[0]
            : new Date(String(row[0]).replace(/-/g, "/"));
        const dateKey = Utilities.formatDate(dObj, "Asia/Taipei", "yyyy-MM-dd");
        allDataMap[dateKey] = row;
      });
      try { cache.put("combine_AllDataMap", JSON.stringify(allDataMap), 600); } catch(e) {}
    }
  }

  // --- 批次處理邏輯 (支援續傳) ---
  var progress = getProgress("Combine_JOB_" + sheetname);
  var currentIndex = 1;
  var rowsToAdd = [];
  const batchSize = 50;

  if (progress) {
    currentIndex = progress.currentIndex || 1;
  }

  // 預先取得起始行號，避免在迴圈內頻繁呼叫 getLastRow() 導致 API 頻率限制
  let writeRow = trsheet.getLastRow() + 1;
  for (var i = currentIndex; i < srData.length; i++) {
    var row = srData[i];
    var d = row[dateCol];
    if (lastdate) {
      var dTime = d instanceof Date ? d.getTime() : new Date(String(d).replace(/-/g, "/")).getTime();
      var lastTime = lastdate instanceof Date ? lastdate.getTime() : new Date(String(lastdate).replace(/-/g, "/")).getTime();
      if (!isNaN(dTime) && !isNaN(lastTime) && dTime <= lastTime) continue;
    }

    Logger.log("date: " + d + ", index: " + i);
    var nums = lCols.map((idx) => row[idx]).sort((a, b) => a - b); // N1...Nn
    var s1 = s1Col > -1 ? row[s1Col] : null;
    var sum = sumCol > -1 ? row[sumCol] : null;

    // --- 效能優化：從記憶體 Map 取得資料，避免重複讀取工作表 ---
    const currentDObj =
      d instanceof Date ? d : new Date(String(d).replace(/-/g, "/"));
    const currentKey = Utilities.formatDate(
      currentDObj,
      "Asia/Taipei",
      "yyyy-MM-dd",
    );
    var datamap = allDataMap[currentKey] || [];

    // 結合 Date,N1,N2...Nn,S1,Sum 以及 datamap 的資料 ，寫入 trsheet
    var newRow = [d, ...nums];
    if (s1 !== null) newRow.push(s1);
    if (sum !== null) newRow.push(sum);

    if (datamap && datamap.length > 0) {
      newRow = newRow.concat(datamap.slice(1));
    }

    rowsToAdd.push(newRow);

    if (rowsToAdd.length >= batchSize || isNearTimeout()) {
      const nextIndex = i + 1; // 處理完當前索引 i，下次應從 i + 1 開始

      if (rowsToAdd.length > 0) {
        try {
          // 1. 先執行 API 寫入操作 (主動存檔)
          trsheet
            .getRange(writeRow, 1, rowsToAdd.length, rowsToAdd[0].length)
            .setValues(rowsToAdd);

          writeRow += rowsToAdd.length;
          rowsToAdd = [];
          // 強制同步試算表緩衝，確保資料狀態與後續的進度保存一致
          SpreadsheetApp.flush();
        } catch (e) {
          logSystemError("combineData", e.toString(), "ERROR", `${sheetname} 批次寫入失敗`, { writeRow: writeRow });
          return { status: "error", message: "合併表格批次寫入失敗：" + e };
        }
      }

      // 2. 寫入成功，立即保存進度並返回續傳，確保每次呼叫都在30秒內
      saveProgress("Combine_JOB_" + sheetname, {
        status: "continue",
        currentIndex: nextIndex,
        total: srData.length,
      });

      return {
        status: "continue",
        message:
          "合併表格處理中 " +
          nextIndex +
          " / " +
          srData.length +
          "，正在續傳...",
        currentIndex: nextIndex,
        total: srData.length,
      };
    }
  }

  // 寫入剩餘的資料 (迴圈正常結束後)
  if (rowsToAdd.length > 0) {
    try {
      trsheet
        .getRange(writeRow, 1, rowsToAdd.length, rowsToAdd[0].length)
        .setValues(rowsToAdd);
      SpreadsheetApp.flush();
    } catch (e) {
      logSystemError("combineData", e.toString(), "ERROR", `${sheetname} 最後殘留資料寫入失敗`);
      return { status: "error", message: "最後寫入失敗：" + e };
    }
  }

  // 全部完成
  clearProgress("Combine_JOB_" + sheetname);
  return { status: "complete", message: "全部處理完成！", btntext: "確定" };
  } catch (e) {
    logSystemError("combineData", e.toString(), "ERROR", `${sheetname} 合併失敗`, { sheetname: sheetname });
    return { status: "error", message: "合併失敗：" + e };
  }
}

/**
 * 一鍵清理所有彩種過期快取與進度 (後端維護函式)
 * 遍歷所有彩種，清理全局任務進度並觸發各試算表內部的過期版本管理
 * @returns {Object} 執行報告
 */
function cleanupAllLotteryCaches() {
  const lottos = ["L539", "L649", "L638", "LSix"];

  // 1. 強制清理 PropertiesService 中的全局任務進度 (斷點續傳快取)
  // 這確保了所有彩種的「合併表格」與「遺漏表」任務都會重新開始
  try {
    lottos.forEach(function(l) {
      clearProgress("Combine_JOB_" + l);
      clearProgress("Miss_JOB_" + l);
    });
  } catch (e) {
    Logger.log("清理全局進度標記時發生錯誤: " + e.message);
  }

  const summary = [];

  // 2. 遍歷各彩種進行深層資料維護
  lottos.forEach((lotto) => {
    try {
      // 新架構：V1 屬性位於 {lotto}_Prediction1 試算表 > predic1_Property 工作表
      const trObj = getTargetsheet("Sheets", lotto + "_Prediction1");
      const ss = trObj.spreadsheet;

      // 呼叫 Prediction1_Server.js 中的版本自動管理邏輯
      // 這會移除 predic1_Property 中除最新 2 個演算法版本以外的所有過期數據
      if (typeof managePrct1PropertyVersions === "function") {
        managePrct1PropertyVersions(ss);
      }

      summary.push(`${lotto}: OK`);
    } catch (e) {
      summary.push(`${lotto}: Fail (${e.message})`);
    }
  });

  return {
    status: "success",
    message: "星系快取清理任務完成。\n結果摘要: " + summary.join(", "),
  };
}

/**
 * 資料庫體檢函式 (後端維護函式)
 * 檢查各彩種 All 工作表的最後日期是否與 AllData 同步
 * @returns {Object} 體檢報告
 */
function checkDatabaseHealth() {
  const lottos = ["L539", "L649", "L638", "LSix"];
  // 優先使用全域 mainspreadsheet 變數，若無則動態獲取
  const mainSs =
    typeof mainspreadsheet !== "undefined"
      ? mainspreadsheet
      : SpreadsheetApp.getActiveSpreadsheet();

  const reports = [];
  const details = [];
  let allSynced = true;

  // 2. 遍歷各彩種檢查同步狀態
  lottos.forEach((lotto) => {
    try {
      // 1. 取得主試算表中的來源工作表 (原始資料)
      const srcSheet = mainSs.getSheetByName(lotto);
      let srcLastTime = 0;
      let srcLastDateStr = "來源無資料";

      if (srcSheet) {
        const srcHeaders = srcSheet.getRange(1, 1, 1, srcSheet.getLastColumn()).getValues()[0];
        const dateColIdx = srcHeaders.indexOf("Date");
        const srcLastRow = srcSheet.getLastRow();
        if (srcLastRow > 1 && dateColIdx !== -1) {
          const val = srcSheet.getRange(srcLastRow, dateColIdx + 1).getValue();
          if (val instanceof Date && !isNaN(val.getTime())) {
            srcLastDateStr = Utilities.formatDate(val, "Asia/Taipei", "yyyy-MM-dd");
            srcLastTime = new Date(val).setHours(0, 0, 0, 0);
          }
        }
      }

      // 2. 取得彩種試算表中的合併工作表 (All)
      const trObj = getTargetsheet("Sheets", lotto);
      const ss = trObj.spreadsheet;
      const allSheet = ss.getSheetByName("All");

      let lottoLastDateStr = "工作表不存在";
      let status = "❌ 缺失";
      let canFix = false;

      if (allSheet) {
        const lastRow = allSheet.getLastRow();
        if (lastRow > 1) {
          const val = allSheet.getRange(lastRow, 1).getValue();
          if (val instanceof Date && !isNaN(val.getTime())) {
            lottoLastDateStr = Utilities.formatDate(
              val,
              "Asia/Taipei",
              "yyyy-MM-dd",
            );
            const lottoLastTime = new Date(val).setHours(0, 0, 0, 0);

            if (lottoLastTime === srcLastTime && srcLastTime !== 0) {
              status = "✅ 同步";
            } else if (lottoLastTime < srcLastTime) {
              status = "⚠️ 落後";
              allSynced = false;
            } else {
              status = "🚀 超前";
            }
          } else {
            lottoLastDateStr = "格式錯誤";
            status = "🛠 損壞";
            allSynced = false;
          }
        } else {
          lottoLastDateStr = "空表";
          status = "⚪ 待更新";
          allSynced = false;
        }
      }

      // 判定是否需要修復：只要不是「同步」且不是「超前」的異常狀態皆可修復
      canFix = status !== "✅ 同步" && status !== "🚀 超前";

      reports.push(`${lotto}: ${status} (來源:${srcLastDateStr} / 合併:${lottoLastDateStr})`);
      details.push({
        id: lotto,
        status: status,
        date: `來源:${srcLastDateStr} | 合併:${lottoLastDateStr}`,
        canFix: canFix,
      });
    } catch (e) {
      reports.push(`${lotto}: ❌ 體檢失敗 (${e.message})`);
      // 發生錯誤的彩種也標記為可修復
      details.push({ id: lotto, status: "❌ 錯誤", date: "N/A", canFix: true });
      allSynced = false;
    }
  });

  const finalMsg =
    `【星系資料庫維護體檢】\n基準：主表原始資料 vs 星系合併表格\n--------------------------\n` +
    reports.join("\n");

  return {
    status: allSynced ? "success" : "warning",
    message: finalMsg,
    allSynced: allSynced,
    details: details,
  };
}
