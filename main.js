// main.js - Google Apps Script Backend Logic (已修正語法錯誤)
const DataManager = {
  fetchAndConnect: function () {
    // 使用 Google Apps Script API 連接到 Google Sheets
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    try {
      return ss;
    } catch (e) {
      throw new Error("Failed to access spreadsheet");
    }
  },

  getBatchData: function (lastDate, batchSize) {
    if (!lastDate || !batchSize) {
      Logger.log("Missing parameters in getBatchData");
      return [];
    }

    const ss = this.fetchAndConnect();
    const sheet = ss.getSheetByName("原始開獎工作表");
    if (!sheet) {
      throw new Error('Sheet "原始開獎工作表" not found');
    }

    // 獲取所有數據，避免在迴圈內反覆呼叫 API
    const values = sheet.getDataRange().getValues();
    const lastDateObj = new Date(lastDate);

    // 過濾條件：日期大於指定日期且在批次範圍內
    let resultData = [];
    for (let i = 0; i < values.length - 1; i++) {
      if (!values[i][0]) continue; // 跳過空行

      const currentDate = new Date(values[i][0]);

      if (currentDate > lastDateObj && resultData.length < batchSize) {
        try {
          resultData.push({
            date: values[i][0],
            n1: parseInt(values[i][1]) || "",
            n2: parseInt(values[i][2]) || "",
            n3: parseInt(values[i][3]) || "",
            n4: parseInt(values[i][4]) || "",
            n5: parseInt(values[i][5]) || "",
            s1: values[i][6] || "",
          });
        } catch (e) {
          Logger.log(`Data parsing error at row ${i}:`, e);
          continue; // 跳過無法解析的列
        }
      }
    }

    return resultData.reverse(); // 倒序，從新到舊
  },

  resetProgress: function () {
    const ss = this.fetchAndConnect();
    const sheet = ss.getSheetByName("原始開獎工作表");
    try {
      if (sheet) {
        // 假設進度存儲在 Z1
        sheet.getRange("Z1").clearContent();
        Logger.log("Progress has been reset.");
      }
    } catch (e) {
      Logger.log("Reset failed: " + e.message);
    }
  },

  getLastProcessTime: function () {
    try {
      const ss = this.fetchAndConnect();
      const sheet = ss.getSheetByName("原始開獎工作表");
      if (!sheet) return "";

      // 獲取最後一列的資料
      const lastRow = sheet.getLastRow();
      if (lastRow < 2) return "";

      // 假設日期記錄在第一欄 (A列)
      const lastDate = sheet.getRange(lastRow, 1).getValue();
      if (lastDate instanceof Date) {
        return Utilities.formatDate(
          lastDate,
          "Asia/Taipei",
          "yyyy-MM-dd HH:mm:ss",
        );
      }
      return String(lastDate);
    } catch (e) {
      Logger.log("Error getting last process time: " + e.message);
      return "";
    }
  },
};
