function combineData(sheetname) {
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
  var progress = getProgress("Update_JOB");
  var currentIndex = 1;
  var rowsToAdd = [];

  if (progress) {
    currentIndex = progress.currentIndex || 1;
  }

  for (var i = currentIndex; i < srData.length; i++) {
    var row = srData[i];
    var d = row[dateCol];
    if (lastdate && d <= lastdate) continue;

    Logger.log("date: " + d + ", index: " + i);
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
      saveProgress("Update_JOB", {
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
      return { status: "error", message: "最後寫入失敗：" + e };
    }
  }

  // 全部完成
  clearProgress("Update_JOB");
  return {
    status: "complete",
    message: "全部處理完成！",
    btntext: "確定",
  };
}