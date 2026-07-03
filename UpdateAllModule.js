/**
 *
 * @param {*} sheetname
 * @returns
 */
function combineData(sheetname) {
  const trObj = getTargetsheet("Sheets", sheetname);
  const trspreadsheet = trObj.spreadsheet;
  let trsheet = trspreadsheet.getSheetByName("All");

  if (!trsheet) {
    trsheet = trspreadsheet.insertSheet("All");
  }

  const srsheet1 = mainspreadsheet.getSheetByName(sheetname);

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

  const allDataMap = {};
  if (allDataSheet) {
    const adValues = allDataSheet.getDataRange().getValues();
    adValues.forEach((row, idx) => {
      if (idx === 0 || !row[0]) return;
      // 使用與 Utility.js 相同的日期格式化邏輯作為 Key
      const dObj =
        row[0] instanceof Date
          ? row[0]
          : new Date(String(row[0]).replace(/-/g, "/"));
      const dateKey = Utilities.formatDate(dObj, "Asia/Taipei", "yyyy-MM-dd");
      allDataMap[dateKey] = row;
    });
  }

  // --- 批次處理邏輯 (支援續傳) ---
  var progress = getProgress("Update_JOB");
  var currentIndex = 1;
  var rowsToAdd = [];
  const batchSize = 100; // 稍微增加批次大小以減少 API 呼叫次數

  if (progress) {
    currentIndex = progress.currentIndex || 1;
  }

  // 預先取得起始行號，避免在迴圈內頻繁呼叫 getLastRow() 導致 API 頻率限制
  let writeRow = trsheet.getLastRow() + 1;
  for (var i = currentIndex; i < srData.length; i++) {
    var row = srData[i];
    var d = row[dateCol];
    if (lastdate && d <= lastdate) continue;

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

      // 2. 寫入成功或接近超時，立即更新續傳進度快照
      saveProgress("Update_JOB", {
        status: "continue",
        currentIndex: nextIndex,
        total: srData.length,
      });

      // 3. 偵測到即將超時或執行時間已久(15秒)，中斷迴圈返回前端更新進度，以維持 UI 響應
      const elapsed = new Date().getTime() - startTime;
      if (elapsed > 15000 || isNearTimeout()) {
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
  clearProgress("Update_JOB");
  return { status: "complete", message: "全部處理完成！", btntext: "確定" };
}

/**
 *
 * @param {*} sheetname
 * @returns
 */
function genMissData_legacy(sheetname) {
  const trObj = getTargetsheet("Sheets", sheetname);
  const trspreadsheet = trObj.spreadsheet;
  let trsheet = trspreadsheet.getSheetByName("Miss");
  const srsheet = trspreadsheet.getSheetByName("All");

  if (!srsheet) {
    return {
      status: "error",
      message: "找不到 'All' 工作表，請先執行合併表格更新。",
    };
  }

  if (!trsheet) {
    trsheet = trspreadsheet.insertSheet("Miss");
  }

  // 1. 遊戲規格組態化：未來若 L638 特別號增加，僅需修改 maxSpecial 數值
  const gameConfig = {
    L539: { maxNum: 39, hasS1: false, maxSpecial: 0 },
    L649: { maxNum: 49, hasS1: true, maxSpecial: 0 },
    LSix: { maxNum: 49, hasS1: true, maxSpecial: 0 },
    L638: { maxNum: 38, hasS1: true, maxSpecial: 8 },
  };

  const config = gameConfig[sheetname] || gameConfig["L539"];
  const { maxNum, hasS1, maxSpecial } = config;

  // 2. 取得來源資料 (All 工作表)
  const srData = srsheet.getDataRange().getValues();
  if (srData.length < 2) {
    return { status: "complete", message: "來源工作表無資料。" };
  }

  const srHeaders = srData[0];
  const dateCol = srHeaders.indexOf("Date");
  const nCols = srHeaders
    .map((h, i) => (h.match(/^N\d+$/) ? i : -1))
    .filter((idx) => idx !== -1);
  const s1Col = srHeaders.indexOf("S1");
  const sumCol = srHeaders.indexOf("Sum");

  // 3. 檢查現有進度與最後寫入日期
  let lastDate = null;
  let lastMissValues = []; // 儲存 M1...Mn 的前一筆狀態
  let lastSpecialMissValues = []; // 儲存 MS1...MSn (L638)
  let trLastRow = trsheet.getLastRow();

  // --- 自動偵測與修復 (Repair Logic) ---
  if (trLastRow > 0 && trsheet.getRange(1, 1).getValue() !== "Date") {
    logSystemError("genMissData", `偵測到 ${sheetname} - Miss 表格標題損壞，正在重置...`, "WARNING");
    trsheet.clear();
    trLastRow = 0;
  }

  if (trLastRow > 1) {
    const trHeaders = trsheet
      .getRange(1, 1, 1, trsheet.getLastColumn())
      .getValues()[0];
    const trLastRowData = trsheet
      .getRange(trLastRow, 1, 1, trsheet.getLastColumn())
      .getValues()[0];

    const dateVal = trLastRowData[trHeaders.indexOf("Date")];
    if (dateVal && !isNaN(new Date(dateVal).getTime())) {
      lastDate = new Date(dateVal);
    } else {
      // 修復：如果最後一行損壞，移除並遞迴重新執行
      logSystemError("genMissData", "偵測到 Miss 表格末行損壞，正在自動修復...", "WARNING");
      trsheet.deleteRow(trLastRow);
      return genMissData_legacy(sheetname);
    }

    // 載入前一筆的遺漏值
    for (let j = 1; j <= maxNum; j++) {
      let idx = trHeaders.indexOf("M" + j);
      lastMissValues.push(idx > -1 ? trLastRowData[idx] : 0);
    }
    if (maxSpecial > 0) {
      for (let j = 1; j <= maxSpecial; j++) {
        // 使用 MS 前綴以區分開獎欄位 S1 與 遺漏值欄位
        // 若未來 pool 增加，indexOf 會自動處理找不到新欄位的情況 (給予預設值 0)
        let idx = trHeaders.indexOf("MS" + j);
        lastSpecialMissValues.push(idx > -1 ? trLastRowData[idx] : 0);
      }
    }
  } else if (trLastRow === 0) {
    // 若工作表全新，寫入標題行
    let headers = ["Date"];
    nCols.forEach((_, i) => headers.push("N" + (i + 1)));
    if (hasS1) headers.push("S1");
    headers.push("Sum");
    for (let j = 1; j <= maxNum; j++) headers.push("M" + j);
    // 修正原本的巢狀迴圈錯誤，動態生成 MS 標題
    for (let j = 1; j <= maxSpecial; j++) headers.push("MS" + j);
    trsheet.appendRow(headers);
  }

  // 4. 批次處理邏輯 (支援中斷續傳)
  var progress = getProgress("Miss_JOB");
  var currentIndex = 1;
  var rowsToAdd = [];
  const batchSize = 500; // 每 500 筆強制寫入一次，避免記憶體壓力

  if (progress && progress.sheetname === sheetname) {
    currentIndex = progress.currentIndex || 1;
    lastMissValues = progress.lastMissValues || [];
    lastSpecialMissValues = progress.lastSpecialMissValues || [];
  }

  let writeRow = trsheet.getLastRow() + 1;
  for (var i = currentIndex; i < srData.length; i++) {
    var row = srData[i];
    var d = row[dateCol];
    if (lastDate && d <= lastDate) continue;

    var drawnNums = nCols.map((idx) => row[idx]);
    var s1Val = s1Col > -1 ? row[s1Col] : null;
    var sumVal = sumCol > -1 ? row[sumCol] : null;

    // 計算主號遺漏 (M1...Mn)
    let currentMiss = [];

    // --- 效能優化：使用 Set 提升搜尋效率 ($O(1)$) ---
    let poolSet = new Set(drawnNums);
    if (hasS1 && sheetname !== "L638" && s1Val !== null) {
      poolSet.add(s1Val);
    }

    for (let j = 1; j <= maxNum; j++) {
      let isDrawn = poolSet.has(j);
      if (lastMissValues.length === 0) {
        currentMiss.push(isDrawn ? 0 : 1);
      } else {
        currentMiss.push(
          isDrawn ? 0 : (Number(lastMissValues[j - 1]) || 0) + 1,
        );
      }
    }
    lastMissValues = currentMiss;

    // 計算特別號遺漏 (MS1...MS8 for L638)
    let currentSpecialMiss = [];
    if (maxSpecial > 0) {
      for (let j = 1; j <= maxSpecial; j++) {
        let isDrawn = s1Val === j;
        if (lastSpecialMissValues.length === 0) {
          currentSpecialMiss.push(isDrawn ? 0 : 1);
        } else {
          currentSpecialMiss.push(
            isDrawn ? 0 : (Number(lastSpecialMissValues[j - 1]) || 0) + 1,
          );
        }
      }
      lastSpecialMissValues = currentSpecialMiss;
    }

    // 組建輸出資料行 [Date, N1...Nn, S1?, Sum, M1...Mn, MS1...MS8?]
    let newRow = [d, ...drawnNums];
    if (hasS1) newRow.push(s1Val);
    if (sumVal !== null) newRow.push(sumVal);
    newRow = newRow.concat(currentMiss);
    if (maxSpecial > 0) newRow = newRow.concat(currentSpecialMiss);

    rowsToAdd.push(newRow);

    // --- 效能優化：達到批次量或快要超時時寫入 ---
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
          SpreadsheetApp.flush();
        } catch (e) {
          logSystemError("genMissData", e.toString(), "ERROR", `${sheetname} 遺漏表批次寫入失敗`);
          return { status: "error", message: "遺漏表批次寫入失敗：" + e };
        }
      }

      // 2. 寫入成功或接近超時，立即更新續傳進度快照
      saveProgress("Miss_JOB", {
        status: "continue",
        sheetname: sheetname,
        currentIndex: nextIndex,
        total: srData.length,
        lastMissValues: lastMissValues,
        lastSpecialMissValues: lastSpecialMissValues,
      });

      // 3. 偵測到即將超時或執行時間已久(15秒)，中斷迴圈返回前端更新進度，以維持 UI 響應
      const elapsed = new Date().getTime() - startTime;
      if (elapsed > 15000 || isNearTimeout()) {
        return {
          status: "continue",
          message: "遺漏表處理中 " + nextIndex + " / " + srData.length,
          currentIndex: nextIndex,
          total: srData.length,
        };
      }
    }
  }

  // 寫入剩餘資料並清除進度
  if (rowsToAdd.length > 0) {
    trsheet
      .getRange(writeRow, 1, rowsToAdd.length, rowsToAdd[0].length)
      .setValues(rowsToAdd);
    SpreadsheetApp.flush();
  }
  logSystemError("genMissData", `${sheetname} 遺漏表更新成功`, "INFO");

  clearProgress("Miss_JOB");
  return { status: "complete", message: "全部處理完成！", btntext: "確定" };
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
    clearProgress("Update_JOB");
    clearProgress("Miss_JOB");
  } catch (e) {
    Logger.log("清理全局進度標記時發生錯誤: " + e.message);
  }

  const summary = [];

  // 2. 遍歷各彩種進行深層資料維護
  lottos.forEach((lotto) => {
    try {
      const trObj = getTargetsheet("Sheets", lotto);
      const ss = trObj.spreadsheet;

      // 呼叫 Prediction1_Server.js 中的版本自動管理邏輯
      // 這會移除 prct1_Property 中除最新 2 個演算法版本以外的所有過期數據
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
