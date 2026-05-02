/**
 * 獲取 Activity 頁面初始化的標籤與環境數據
 */
function getActivityInitData(lotto, dateStr, methodSN) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  // 1. 獲取方法資料 (從 Method 工作表)
  const methodSheet = ss.getSheetByName("Method");
  const methodData = methodSheet.getDataRange().getValues();
  let methodObj = null;
  for (let i = 1; i < methodData.length; i++) {
    if (String(methodData[i][0]) === String(methodSN)) {
      methodObj = {
        FieldMode: methodData[i][2],
        strCompares: methodData[i][3],
        NextNumsMode: methodData[i][5],
        intNextNums: methodData[i][6],
        intNextStep: methodData[i][7],
      };
      break;
    }
  }

  // 2. 獲取該日期的環境與開獎參數 (從彩種 All 工作表)
  const lottoSs = getTargetsheet("Sheets", lotto).spreadsheet;
  const allSheet = lottoSs.getSheetByName("All");
  const headers = allSheet
    .getRange(1, 1, 1, allSheet.getLastColumn())
    .getValues()[0];
  const allData = allSheet.getDataRange().getValues();

  const targetDate = new Date(dateStr).getTime();
  let envObj = null;

  for (let j = 1; j < allData.length; j++) {
    if (new Date(allData[j][0]).getTime() === targetDate) {
      envObj = {};
      headers.forEach((h, idx) => {
        envObj[h] = allData[j][idx];
      });
      // 格式化日期字串
      envObj.Date = Utilities.formatDate(
        new Date(allData[j][0]),
        "Asia/Taipei",
        "yyyy-MM-dd",
      );
      break;
    }
  }

  return { method: methodObj, env: envObj };
}

/**
 * 獲取結果統計表格資料 (從 FreqSec 工作表)
 * 這裡模擬根據 MethodSN 篩選對應的統計結果
 */
function getActivityTableData(lotto, dateStr, methodSN) {
  const lottoSs = getTargetsheet("Sheets", lotto).spreadsheet;
  const freqSheet = lottoSs.getSheetByName("FreqSec");
  if (!freqSheet) return [];

  const data = freqSheet.getDataRange().getValues();
  const headers = data[0];

  // 篩選符合 methodSN 的資料列 (假設 lngMethodSN 在第 3 欄)
  return data
    .slice(1)
    .filter((row) => String(row[2]) === String(methodSN))
    .map((row) => {
      let obj = {};
      headers.forEach((h, idx) => (obj[h] = row[idx]));
      return obj;
    });
}
