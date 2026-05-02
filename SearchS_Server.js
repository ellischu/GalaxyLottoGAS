/**
 * 獲取所有環境參數欄位清單 (從 AllData 工作表標題列獲取)
 * 用於 SearchS.html 的 SecField 下拉選單
 */
function getFieldList() {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName("AllData");
    if (!sheet) return [];

    // 取得第一列標題
    const headers = sheet
      .getRange(1, 1, 1, sheet.getLastColumn())
      .getValues()[0];

    // 排除「Date」或「日期」欄位，並轉換為物件格式
    return headers
      .filter((h) => h && h !== "Date" && h !== "日期")
      .map((h) => ({
        id: h,
        name: getActivityDisplayTitle(h), // 使用新函式進行名稱對應
      }));
  } catch (e) {
    return [];
  }
}

/**
 * 根據 DocActivity.md#AeraAll 規格轉換 FieldName 為顯示標題
 * @param {string} fieldName 原始欄位名稱
 * @returns {string} 顯示標題
 */
function getActivityDisplayTitle(fieldName) {
  const mapping = {
    Date: "日期",
    N1: "號1",
    N2: "號2",
    N3: "號3",
    N4: "號4",
    N5: "號5",
    N6: "號6",
    S1: "特別號1",
    Sum: "總合",
    年天干: "年干",
    年地支: "年支",
    月天干: "月干",
    月地支: "月支",
    日天干: "日干",
    日地支: "日支",
    時柱: "時柱",
    日五形: "日形",
    日十二建除: "日執",
    日九星: "日星",
    日二十八星宿: "日宿",
    時二十八星宿: "時宿",
    日八掛: "日掛",
    本命: "本命",
    父母: "父母",
    福德: "福德",
    田宅: "田宅",
    官祿: "官祿",
    奴僕: "奴僕",
    遷移: "遷移",
    疾厄: "疾厄",
    財帛: "財帛",
    子女: "子女",
    夫妻: "夫妻",
    兄弟: "兄弟",
    命重: "命重",
  };

  // 處理 N1~N6 的動態匹配 (如果傳入的是 N1, N2...)
  if (mapping[fieldName]) return mapping[fieldName];

  // 處理編號類的模糊匹配 (例如 號1, 號2...)
  if (/^N[1-6]$/.test(fieldName)) return fieldName.replace("N", "號");

  return fieldName; // 若無對應則回傳原名
}

/**
 * 獲取預測日期的環境參數摘要
 */
function getDatePreview(lotto, dateStr) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName("AllData");
    if (!sheet) return null;
    // 取得標題列並修剪空白
    const headers = sheet
      .getRange(1, 1, 1, sheet.getLastColumn())
      .getValues()[0]
      .map((h) => String(h).trim());

    const date = new Date(dateStr);
    const rowData = getAllData(date); // 調用 Utility.js 中的函式，傳回的是原始陣列
    if (!rowData || rowData.length === 0) return null;

    // 輔助函式：根據標題名稱安全地從陣列中提取數值
    const getVal = (name) => {
      const idx = headers.indexOf(name);
      return idx > -1 &&
        rowData[idx] !== null &&
        rowData[idx] !== undefined &&
        rowData[idx] !== ""
        ? String(rowData[idx])
        : "";
    };

    // 確保即使 Key 不存在也不會回傳 null，而是回傳 undefined 或空字串
    return {
      dayG: getVal("日天干"),
      dayZ: getVal("日地支"),
      fiveElements: getVal("日五形") || "無",
      lifePalace: getVal("本命") || "無",
      dayStar: getVal("日九星") || "無",
    };
  } catch (e) {
    return null;
  }
}

/**
 * 處理查詢請求並返回 Activity 頁面 URL
 */
function prepareActivityQuery(params) {
  try {
    // 1. 構造方法參數並獲取序號 (getMethodSN 定義於 Utility.js)
    const methodObj = {
      strCompareType: "AND",
      FieldMode: params.fieldMode,
      strCompares: params.fields.join("#"),
      strComparesDetail: "", // 後端會根據日期自動匹配細節
      NextNumsMode: params.nextMode,
      intNextNums: params.nextNums,
      intNextStep: params.nextStep,
      intDataLimit: params.dataLimit,
      intDataOffset: params.dataOffset,
      intSearchLimit: params.searchLimit,
      intSearchOffset: params.searchOffset,
    };

    // 【除錯中】目前先不要 call getMethodSN
    // const methodSN = getMethodSN(methodObj);
    const methodSN = 9999; // 暫時固定序號
    const isDebugMode = true;

    // 2. 生成 Web App URL
    // 假設系統入口為 Web App，透過 query string 切換至 Activity 頁面
    const scriptUrl = ScriptApp.getService().getUrl();
    const queryParams = {
      page: "Activity",
      lotto: params.lotto,
      date: params.date,
      methodSN: methodSN,
      module: params.module,
    };

    const url =
      scriptUrl +
      "?" +
      Object.keys(queryParams)
        .map(
          (k) =>
            encodeURIComponent(k) + "=" + encodeURIComponent(queryParams[k]),
        )
        .join("&");

    return {
      status: "success",
      url: url,
      methodSN: methodSN,
      methodObj: isDebugMode ? methodObj : null, // 回傳構造後的物件供前端偵錯顯示
    };
  } catch (e) {
    return { status: "error", message: e.toString() };
  }
}
