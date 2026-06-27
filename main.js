// main.js - Google Apps Script Backend Logic (已修正語法錯誤)
const DataManager = {
  fetchAndConnect: function () {
    // 使用 Google Apps Script API 連接到 Google Sheets
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    try {
      return ss;
    } catch (e) {
      logSystemError("fetchAndConnect", e.toString(), "ERROR", "試算表連接失敗");
      throw new Error("Failed to access spreadsheet");
    }
  },

  getBatchData: function (lastDate, batchSize) {
    if (!lastDate || !batchSize) {
      logSystemError("getBatchData", "缺少必要參數: lastDate=" + lastDate + ", batchSize=" + batchSize, "WARNING", "參數驗證失敗");
      return [];
    }

    const ss = this.fetchAndConnect();
    const sheet = ss.getSheetByName("原始開獎工作表");
    if (!sheet) {
      logSystemError("getBatchData", "找不到工作表: 原始開獎工作表", "ERROR", "必需的工作表不存在");
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
          logSystemError("getBatchData", "資料解析錯誤: " + e.toString(), "WARNING", "第 " + i + " 列資料解析失敗", { row: i });
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
        logSystemError("resetProgress", "進度已重設", "INFO", "進度重設完成");
      }
    } catch (e) {
      logSystemError("resetProgress", e.toString(), "ERROR", "重設進度失敗");
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
      logSystemError("getLastProcessTime", e.toString(), "WARNING", "取得最後處理時間失敗");
      return "";
    }
  },
};
