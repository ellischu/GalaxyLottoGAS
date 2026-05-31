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
    const date = new Date(dateStr.replace(/-/g, "/"));
    const rowData = getAllData(date, true); // 使用物件模式取得資料
    if (!rowData || rowData.length === 0) return null;

    // 直接透過欄位名稱存取，不用再管索引
    const getVal = (name) =>
      rowData[name] !== undefined && rowData[name] !== ""
        ? String(rowData[name])
        : "";

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
 * 獲取托牌組合清單，包含欄位比對邏輯
 */
function getNextComboOptions(params) {
  try {
    const targetDate = new Date(params.date.replace(/-/g, "/"));
    let conditions = {};

    if (params.fieldMode && params.fields && params.fields.length > 0) {
      const fieldDetail = getFieldModeDetail(targetDate, params.fields);
      conditions = fieldDetail.conditions;
    }

    return getNextNumDetail(
      params.lotto,
      targetDate,
      params.nextNums,
      params.nextStep,
      conditions,
    );
  } catch (e) {
    return { strNextNums: "", StrNextNumSpe: "" };
  }
}

/**
 * 處理查詢請求並返回 Activity 頁面 URL
 */
function prepareActivityQuery(params) {
  try {
    const targetDate = new Date(params.date.replace(/-/g, "/"));
    let detail = "";
    let compares = "";
    let conditions = {};

    // 優化：僅在開啟欄位模式 (fieldMode) 時才呼叫 getAllData 取得環境數值
    if (params.fieldMode) {
      const fieldDetail = getFieldModeDetail(targetDate, params.fields);
      compares = fieldDetail.compares;
      detail = fieldDetail.detail;
      conditions = fieldDetail.conditions;
    }

    // 1. 構造方法參數並獲取序號
    const methodObj = {
      strCompareType: "AND",
      FieldMode: params.fieldMode,
      strCompares: compares,
      strComparesDetail: detail,
      NextNumsMode: params.nextMode,
      intNextNums: params.nextNums,
      intNextStep: params.nextStep,
      strNextNums: "",
      StrNextNumSpe: "",
      intDataLimit: params.dataLimit,
      intDataOffset: params.dataOffset,
      intSearchLimit: params.searchLimit,
      intSearchOffset: params.searchOffset,
    };

    if (params.nextMode) {
      // 如果前端有傳回具體的組合且不是 "all"，則直接使用 UI 選定的值
      if (params.strNextNums && params.strNextNums !== "all") {
        methodObj.strNextNums = params.strNextNums;
        methodObj.StrNextNumSpe = params.StrNextNumSpe || "";
      } else {
        const nextNumData = getNextNumDetail(
          params.lotto,
          targetDate,
          params.nextNums,
          params.nextStep,
          conditions,
        );
        methodObj.strNextNums = nextNumData.strNextNums;
        methodObj.StrNextNumSpe = nextNumData.StrNextNumSpe;
      }
    }
    const methodSN = getMethodSN(methodObj);
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
      methodObj: null, // 查詢時不再回傳除錯資訊
    };
  } catch (e) {
    return { status: "error", message: e.toString() };
  }
}

/**
 * 獲取預覽資料
 * 根據 Lotto, Date, Field 所提供的數值，讀取小於 Date 的 20 筆相符資料
 */
function getPreviewData(params) {
  try {
    const targetDate = new Date(params.date.replace(/-/g, "/"));
    let detail = "";
    let compares = "";
    let conditions = {};

    // 1. 統一獲取環境參數 (僅在開啟欄位模式時執行一次，避免重複讀取 AllData)
    if (params.fieldMode) {
      const fieldDetail = getFieldModeDetail(targetDate, params.fields);
      compares = fieldDetail.compares;
      detail = fieldDetail.detail;
      conditions = fieldDetail.conditions;
    }

    const methodObj = {
      strCompareType: "AND",
      FieldMode: params.fieldMode,
      strCompares: compares,
      strComparesDetail: detail,
      NextNumsMode: params.nextMode,
      intNextNums: params.nextNums,
      intNextStep: params.nextStep,
      strNextNums: "",
      StrNextNumSpe: "",
      intDataLimit: params.dataLimit,
      intDataOffset: params.dataOffset,
      intSearchLimit: params.searchLimit,
      intSearchOffset: params.searchOffset,
    };

    if (params.nextMode) {
      // 預覽時同樣優先使用 UI 選定的組合與特別號
      if (params.strNextNums && params.strNextNums !== "all") {
        methodObj.strNextNums = params.strNextNums;
        methodObj.StrNextNumSpe = params.StrNextNumSpe || "";
      } else {
        const nextNumData = getNextNumDetail(
          params.lotto,
          targetDate,
          params.nextNums,
          params.nextStep,
          conditions,
        );
        methodObj.strNextNums = nextNumData.strNextNums;
        methodObj.StrNextNumSpe = nextNumData.StrNextNumSpe;
      }
    }
    const methodSN = getMethodSN(methodObj); // 同樣調用此邏輯以供測試
    const isDebugMode = true;

    // 2. 調用公用函式獲取資料 (預覽固定取 20 筆)
    const resultRowsRaw = getDataBase(
      params.lotto,
      params.date,
      methodObj,
      "DESC",
      20,
    );

    // 3. 獲取標題列用於前端表格顯示
    const targetObj = getTargetsheet("Sheets", params.lotto);
    const sheet = targetObj.spreadsheet.getSheetByName("All");
    const headers = sheet
      .getRange(1, 1, 1, sheet.getLastColumn())
      .getValues()[0];
    const dateIdx = headers.indexOf("Date");

    // 4. 格式化結果 (將日期物件轉為字串供前端顯示)
    const resultRows = resultRowsRaw.map((row) => {
      if (row[dateIdx] instanceof Date) {
        row[dateIdx] = Utilities.formatDate(
          row[dateIdx],
          "Asia/Taipei",
          "yyyy-MM-dd",
        );
      }
      return row;
    });

    return {
      status: "success",
      headers: headers,
      rows: resultRows,
      methodSN: methodSN,
      methodObj: isDebugMode ? methodObj : null,
    };
  } catch (e) {
    return { status: "error", message: e.toString() };
  }
}
