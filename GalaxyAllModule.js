function combineData_Legacy(sheetname) {
  startTime = new Date().getTime();

  const trObj = getTargetsheet("Sheets", sheetname);
  const trspreadsheet = trObj.spreadsheet;
  let trsheet = trspreadsheet.getSheetByName("All");

  if (!trsheet) {
    trsheet = trspreadsheet.insertSheet("All");
  }

  const srsheet1 = mainspreadsheet.getSheetByName(sheetname);

  // 檢查 trsheet 是否有資料，並取得最後一筆 Date 欄位資料
  // 如果沒有資料則 srsheet1 從第一筆資料開始結合
  let lastdate = null; //trsheet 的最後一筆 Date 欄位資料
  const lastRow = trsheet.getLastRow();
  if (lastRow > 1) {
    var val = trsheet.getRange(lastRow, 1).getValue();
    // 檢查回傳的值是否可以被轉換為有效的日期物件
    if (val && !isNaN(new Date(val).getTime())) {
      lastdate = new Date(val);
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

  // loop
  // 取得 srsheet1 的 L1,L2,L3,L4,L5 (L6: L649,L638,Lsix 要一起排序 )(S1:L649,L638,Lsix不排序) ,轉成 N1,N2,N3,N4,N5,N6,S1

  // --- 批次處理邏輯 (支援續傳) ---
  var progress = getProgress("Combine_JOB_" + sheetname);
  var currentIndex = 1;
  var rowsToAdd = [];

  if (progress) {
    currentIndex = progress.currentIndex || 1;
  }

  for (var i = currentIndex; i < srData.length; i++) {
    var row = srData[i];
    var d = row[dateCol];
    if (lastdate) {
      var dTime = d instanceof Date ? d.getTime() : new Date(String(d).replace(/-/g, "/")).getTime();
      var lastTime = lastdate instanceof Date ? lastdate.getTime() : new Date(String(lastdate).replace(/-/g, "/")).getTime();
      if (!isNaN(dTime) && !isNaN(lastTime) && dTime <= lastTime) continue;
    }

    logSystemError("combineData_Legacy", "date: " + d + ", index: " + i, "INFO", "正在処理歴弹數檓");
    var nums = lCols.map((idx) => row[idx]).sort((a, b) => a - b); // N1...Nn
    var s1 = s1Col > -1 ? row[s1Col] : null;
    var sum = sumCol > -1 ? row[sumCol] : null;

    var datamap = getAllData(d);

    // 結合 Date,N1,N2...Nn,S1,Sum 以及 datamap 的資料 ，寫入 trsheet
    var newRow = [d, ...nums];
    if (s1 !== null) newRow.push(s1);
    if (sum !== null) newRow.push(sum);

    if (datamap && datamap.length > 0) {
      newRow = newRow.concat(datamap.slice(1));
    }

    rowsToAdd.push(newRow);

    // 每 50 筆資料 update 一次    // 檢查是否快要超時
    if (isNearTimeout()) {
      saveProgress("Combine_JOB_" + sheetname, {
        status: "continue",
        currentIndex: i,
        total: srData.length,
      });

      try {
        if (rowsToAdd.length > 0) {
          trsheet
            .getRange(
              trsheet.getLastRow() + 1,
              1,
              rowsToAdd.length,
              rowsToAdd[0].length,
            )
            .setValues(rowsToAdd);
        }
      } catch (e) {
        logSystemError("combineData_Legacy", e.toString(), "ERROR", "寫入試算表失敗", { sheetname: sheetname, index: i });
        return { status: "error", message: "寫入試算表時發生錯誤：" + e };
      }
      rowsToAdd = [];
      return {
        status: "continue",
        message: "已處理 " + i + " / " + srData.length + " 筆資料，正在續傳...",
        currentIndex: i,
        total: srData.length,
      };
    }
  }

  // 寫入剩餘的資料 (迴圈正常結束後)
  if (rowsToAdd.length > 0) {
    try {
      trsheet
        .getRange(
          trsheet.getLastRow() + 1,
          1,
          rowsToAdd.length,
          rowsToAdd[0].length,
        )
        .setValues(rowsToAdd);
    } catch (e) {
      logSystemError("combineData_Legacy", e.toString(), "ERROR", "最後寫入失敗", { sheetname: sheetname });
      return { status: "error", message: "最後寫入失敗：" + e };
    }
  }

  // 全部完成
  clearProgress("Combine_JOB_" + sheetname);
  return {
    status: "complete",
    message: "全部處理完成！",
    btntext: "確定",
  };
}

function genMissData_Legacy(sheetname) {
  startTime = new Date().getTime();

  const trObj = getTargetsheet("Sheets", sheetname);
  const trspreadsheet = trObj.spreadsheet;
  let trsheet = trspreadsheet.getSheetByName("Miss");
  const srsheet = trspreadsheet.getSheetByName("All");

  if (!srsheet) {
    logSystemError("genMissData_Legacy", "找不到 'All' 工作表", "ERROR", "失敗表源工作表不存在", { sheetname: sheetname });
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
  const trLastRow = trsheet.getLastRow();

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
  var progress = getProgress("Miss_JOB_" + sheetname);
  var currentIndex = 1;
  var rowsToAdd = [];

  if (progress) {
    currentIndex = progress.currentIndex || 1;
    lastMissValues = progress.lastMissValues || [];
    lastSpecialMissValues = progress.lastSpecialMissValues || [];
  }

  for (var i = currentIndex; i < srData.length; i++) {
    var row = srData[i];
    var d = row[dateCol];
    if (lastDate) {
      var dTime = d instanceof Date ? d.getTime() : new Date(String(d).replace(/-/g, "/")).getTime();
      var lastTime = lastDate instanceof Date ? lastDate.getTime() : new Date(String(lastDate).replace(/-/g, "/")).getTime();
      if (!isNaN(dTime) && !isNaN(lastTime) && dTime <= lastTime) continue;
    }

    var drawnNums = nCols.map((idx) => row[idx]);
    var s1Val = s1Col > -1 ? row[s1Col] : null;
    var sumVal = sumCol > -1 ? row[sumCol] : null;

    // 計算主號遺漏 (M1...Mn)
    let currentMiss = [];
    // 邏輯優化：L638 的 S1 屬於第二區，不影響第一區的遺漏計算
    let poolNums = [...drawnNums];
    if (hasS1 && sheetname !== "L638" && s1Val !== null) {
      poolNums.push(s1Val);
    }

    for (let j = 1; j <= maxNum; j++) {
      let isDrawn = poolNums.indexOf(j) > -1;
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

    // 檢查超時，執行儲存並返回續傳訊號
    if (isNearTimeout()) {
      saveProgress("Miss_JOB_" + sheetname, {
        status: "continue",
        sheetname: sheetname,
        currentIndex: i,
        total: srData.length,
        lastMissValues: lastMissValues,
        lastSpecialMissValues: lastSpecialMissValues,
      });

      if (rowsToAdd.length > 0) {
        trsheet
          .getRange(trLastRow + 1, 1, rowsToAdd.length, rowsToAdd[0].length)
          .setValues(rowsToAdd);
      }
      return {
        status: "continue",
        message: "遺漏表處理中 " + i + " / " + srData.length,
        currentIndex: i,
        total: srData.length,
      };
    }
  }

  // 寫入剩餘資料並清除進度
  if (rowsToAdd.length > 0) {
    trsheet
      .getRange(
        trsheet.getLastRow() + 1,
        1,
        rowsToAdd.length,
        rowsToAdd[0].length,
      )
      .setValues(rowsToAdd);
  }

  clearProgress("Miss_JOB_" + sheetname);
  return {
    status: "complete",
    message: "全部處理完成！",
    btntext: "確定",
  };
}
