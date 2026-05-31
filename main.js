// main.js

const DataManager = {
  fetchAndConnect: function() {
    // 使用 Google Apps Script 套件連接到 Google Sheets
    return SpreadsheetApp.getActiveSpreadsheet();
  },

  getBatchData: function(lastDate, batchSize) {
    const sheet = this.fetchAndConnect().getSheetByName("原始開獎工作表");
    const dataRange = sheet.getDataRange();
    const values = dataRange.getValues();

    // 假設 values 是一個二维数组，其中第一列是日期
    return values.filter(row => row[0] > lastDate).slice(0, batchSize);
  }
};

const DataTransformer = {
  transformData: function(rawBatchData, envParams) {
    const transformedData = rawBatchData.map(row => {
      // 在這裡實現業務邏輯轉換
      return {
        Date: row[0],
        N1: row[1],
        N2: row[2],
        N3: row[3],
        N4: row[4],
        N5: row[5],
        S1: row[6],
        Sum: row[7]
      };
    });

    // 合併原始數據和環境參數
    return transformedData.map(data => ({
      ...data,
      ...envParams
    }));
  }
};

const DataSink = {
  writeToSheet: function(dataBatch, sheetName, startRow) {
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(sheetName);
    sheet.getRange(startRow, 1, dataBatch.length, Object.keys(dataBatch[0]).length).setValues(
      dataBatch.map(obj => Object.values(obj))
    );
  }
};

function mainProcess(lastDate, batchSize) {
  try {
    const rawData = DataManager.getBatchData(lastDate, batchSize);
    if (rawData.length === 0) return;

    // 假設從別處獲取環境參數
    const envParams = {
      param1: 'value1',
      param2: 'value2'
    };

    const transformedData = DataTransformer.transformData(rawData, envParams);
    
    DataSink.writeToSheet(transformedData, "All 工作表", 1);

    // 断點續傳邏輯（示例）
    Logger.log(`Processed data till date: ${transformedData[transformedData.length - 1].Date}`);
  } catch (error) {
    Logger.log('Error occurred:', error);
    throw new Error('Processing failed');
  }
}

// 主程序入口
function doGet() {
  mainProcess('2023-01-01', 100); // 設定初始日期和批次大小
}