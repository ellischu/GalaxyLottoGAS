/*
常見遊戲的 API 代碼對照：
如果您需要查詢其他遊戲，只需修改網址中的遊戲名稱部分：
大樂透：lotto649Result
今彩539：Daily539Result
威力彩：SuperLotto638Result
3星彩：3DResult
4星彩：4DResult 
例如，今彩 539 的 API 網址為：
https://api.taiwanlottery.com/TLCAPIWeB/Lottery/Daily539Result?period=115000001
 */

/**
 * 每日更新主流程
 * @param {boolean} isUI 是否為 UI 模式 (UI 模式會每步回傳以更新進度條)
 */
function dailyupdate(isUI) {
  const stateKey = "DAILY_UPDATE_FLOW_STATE";
  let state = getProgress(stateKey) || { step: 0 };
  const lottos = ["L539", "L649", "L638", "LSix"];

  // 定義任務序列
  const tasks = [];
  lottos.forEach((l) =>
    tasks.push({ name: "Update_" + l, run: () => updatenumber(l) }),
  );
  lottos.forEach((l) =>
    tasks.push({ name: "Combine_" + l, run: () => combineData(l) }),
  );
  lottos.forEach((l) =>
    tasks.push({ name: "Miss_" + l, run: () => genMissData(l) }),
  );

  tasks.push({
    name: "PreloadCache",
    run: () => {
      preloadPrediction1Cache();
      return { status: "complete" };
    },
  });
  tasks.push({
    name: "Archive",
    run: () => {
      maintenance_ArchiveOldRecords();
      return { status: "complete" };
    },
  });
  tasks.push({
    name: "Cleanup",
    run: () => {
      autoCleanupErrorLog(30);
      return { status: "complete" };
    },
  });


  for (let i = state.step; i < tasks.length; i++) {
    // 檢查整體執行時間
    if (isNearTimeout()) {
      saveProgress(stateKey, { step: i });
      logSystemError("dailyupdate", "超時保護觸發：已暫停於步驟 " + tasks[i].name, "WARNING");
      return {
        status: "continue",
        message: "系統即將超時，已存檔並待下次觸發續傳。",
      };
    }

    let task = tasks[i];
    logSystemError("dailyupdate", "正在執行: " + task.name);

    let result = task.run();

    // 如果子任務回傳需要續傳，則停止目前序列
    if (result && result.status === "continue") {
      saveProgress(stateKey, { step: i });
      logSystemError("dailyupdate", "子任務 " + task.name + " 要求續傳：" + result.message);
      return result;
    }

    // 步驟完成，更新索引
    state.step = i + 1;
    saveProgress(stateKey, state);

    // 核心修正：如果是 UI 觸發，則每個任務完成後回傳一次狀態給前端更新進度條。
    // 若是背景排程觸發 (isUI 不為 true)，則在時間允許內繼續執行下一個任務。
    if (isUI === true) {
      return {
        status: "continue",
        message: `已完成任務: ${task.name}。準備執行下一個任務...`,
      };
    }
  }

  // 全部完成，清除流程進度
  clearProgress(stateKey);
  logSystemError("dailyupdate", "每日更新任務已全數執行完畢");
  return { status: "complete", message: "全部任務已完成" };
}

function updatenumber(sheetName) {
  // sheetName L539 = "今彩539";
  // sheetName L649 = "大樂透";
  // sheetName L638 = "威力彩";
  // sheetName L3D = "3星彩";
  // sheetName L4D = "4星彩";
  // shsstName LSix = "六合彩";

  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(sheetName);
  if (!sheet) {
    logSystemError("updatenumber", "找不到工作表: " + sheetName, "ERROR", "", {
      sheetName: sheetName,
    });
    return;
  }

  //獲取最後一行的 period 值，第一行為標題
  //建立標題行對應
  // 今彩539： period,Date,L1,L2,L3,L4,L5,Sum,series
  // 大樂透： period,Date,L1,L2,L3,L4,L5,L6,S1,Sum,series
  // 威力彩： period,Date,L1,L2,L3,L4,L5,L6,S1,Sum,series
  // 六合彩： period,Date,L1,L2,L3,L4,L5,L6,S1,Sum,series

  // 讀取第一行標題，建立欄位名稱對應的索引
  var headerRow = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  var headerMap = {};
  for (var i = 0; i < headerRow.length; i++) {
    headerMap[headerRow[i]] = i + 1;
  }

  // 從第二行開始有資料
  var lastRow = sheet.getLastRow();
  //設定欄位名稱為 period，預設值為 115000001，若最後一行有值則使用最後一行的值
  var period = "115000001";
  if (lastRow > 1) {
    // 讀取最後一行的 period 值，使用 headerMap 來確保讀取正確的欄位
    var periodCol = headerMap["period"];
    if (periodCol) {
      period = sheet.getRange(lastRow, periodCol).getValue();
    } else {
      logSystemError("updatenumber", "找不到 'period' 欄位，使用預設值 " + period, "WARNING", "", {
        sheetName: sheetName,
      });
    }
  }
  logSystemError("updatenumber", "使用 sheetName: " + sheetName + "，period 值: " + period);

  var scrapeRes =
    sheetName === "LSix"
      ? scrapeDailySix(sheetName, period)
      : scrapeDailyCash(sheetName, period);
  var Result = scrapeRes.data || [];

  var dataToWrite = [];
  if (Result && Result.length > 0) {
    // 這裡可以根據實際需求將 Result 寫入 Google Sheet，以下為示例程式碼
    dataToWrite = Result.map(function (item) {
      // 根據 sheetName 決定要寫入的欄位順序，以下為示例，請根據實際 API 回傳結構調整
      if (sheetName === "L539") {
        return [
          item.period,
          // lotteryDate 的值對應到 Date 欄位，請根據實際 API 回傳結構 yyyy-MM-dd 調整成 YYYY/MM/DD 格式,去除日期中的時間部分
          item.lotteryDate.replace(/-/g, "/").split(/[T ]/)[0],
          // drawNumberAppear 的值對應到 L1~L5 欄位，請根據實際 API 回傳結構調整
          item.drawNumberAppear[0],
          item.drawNumberAppear[1],
          item.drawNumberAppear[2],
          item.drawNumberAppear[3],
          item.drawNumberAppear[4],
          // item.drawNumberAppear 的值的總合對應到 Sum 欄位，請根據實際 API 回傳結構調整
          item.drawNumberAppear.reduce(function (a, b) {
            return a + b;
          }, 0),
          // series 的值對應到 series 欄位，請根據實際 API 回傳結構調整,由 period 的值倒數3位轉成數字(interger)對應到 series 欄位
          parseInt(String(item.period).slice(-3)),
        ];
      } else if (sheetName === "L649") {
        return [
          item.period,
          // lotteryDate 的值對應到 Date 欄位，請根據實際 API 回傳結構 yyyy-MM-dd 調整成 YYYY/MM/DD 格式,去除日期中的時間部分
          item.lotteryDate.replace(/-/g, "/").split(/[T ]/)[0],
          // drawNumberAppear 的值對應到 L1~L6 欄位，請根據實際 API 回傳結構調整
          item.drawNumberAppear[0],
          item.drawNumberAppear[1],
          item.drawNumberAppear[2],
          item.drawNumberAppear[3],
          item.drawNumberAppear[4],
          item.drawNumberAppear[5],
          item.drawNumberAppear[6], // 特別號對應到 S1 欄位，請根據實際 API 回傳結構調整
          // item.drawNumberAppear 的值的總合對應到 Sum 欄位，請根據實際 API 回傳結構調整
          item.drawNumberAppear.reduce(function (a, b) {
            return a + b;
          }, 0),
          // series 的值對應到 series 欄位，請根據實際 API 回傳結構調整,由 period 的值倒數3位轉成數字(interger)對應到 series 欄位
          parseInt(String(item.period).slice(-3)),
        ];
      } else if (sheetName === "L638") {
        return [
          item.period,
          // lotteryDate 的值對應到 Date 欄位，請根據實際 API 回傳結構 yyyy-MM-dd 調整成 YYYY/MM/DD 格式,去除日期中的時間部分
          item.lotteryDate.replace(/-/g, "/").split(/[T ]/)[0],
          // drawNumberAppear 的值對應到 L1~L6 欄位，請根據實際 API 回傳結構調整
          item.drawNumberAppear[0],
          item.drawNumberAppear[1],
          item.drawNumberAppear[2],
          item.drawNumberAppear[3],
          item.drawNumberAppear[4],
          item.drawNumberAppear[5],
          item.drawNumberAppear[6], // 特別號對應到 S1 欄位，請根據實際 API 回傳結構調整
          // item.drawNumberAppear 的值的總合對應到 Sum 欄位，請根據實際 API 回傳結構調整
          item.drawNumberAppear.slice(0, 6).reduce(function (a, b) {
            return a + b;
          }, 0),
          // series 的值對應到 series 欄位，請根據實際 API 回傳結構調整,由 period 的值倒數3位轉成數字(interger)對應到 series 欄位
          parseInt(String(item.period).slice(-3)),
        ];
      } else if (sheetName === "LSix") {
        return [
          "'" + item.period,
          // lotteryDate 的值對應到 Date 欄位
          item.lotteryDate.replace(/-/g, "/").split(/[T ]/)[0],
          // drawNumberAppear 的值對應到 L1~L6 欄位
          item.drawNumberAppear[0],
          item.drawNumberAppear[1],
          item.drawNumberAppear[2],
          item.drawNumberAppear[3],
          item.drawNumberAppear[4],
          item.drawNumberAppear[5],
          item.drawNumberAppear[6], // 特別號對應到 S1 欄位
          // item.drawNumberAppear 的值的總合對應到 Sum 欄位
          item.drawNumberAppear.reduce(function (a, b) {
            return a + b;
          }, 0),
          // series 的值對應到 series 欄位
          parseInt(String(item.period).slice(-3)),
        ];
      }
    });
    // 將資料寫入 Google Sheet，從最後一行的下一行開始寫入
    sheet
      .getRange(lastRow + 1, 1, dataToWrite.length, dataToWrite[0].length)
      .setValues(dataToWrite);

    logSystemError("updatenumber", "成功寫入 " + dataToWrite.length + " 筆資料到 " + sheetName);
  }

  if (scrapeRes.status === "continue") {
    return {
      status: "continue",
      message: sheetName + " 抓取未完，已處理至 " + scrapeRes.lastPeriod,
    };
  }

  return { status: "success", message: "工作表 " + sheetName + " 更新完成" };
}

function scrapeDailyCash(sheetName, period) {
  // sheetName L539 = "今彩539";
  // sheetName L649 = "大樂透";
  // sheetName L638 = "威力彩";
  // sheetName L3D = "3星彩";
  // sheetName L4D = "4星彩";
  // shsstName LSix = "六合彩";

  // API 網址
  var url00 = "https://api.taiwanlottery.com/TLCAPIWeB/Lottery/";

  //：lotto649Result
  //今彩539：Daily539Result
  //威力彩：SuperLotto638Result
  //3星彩：3DResult
  //4星彩：4DResult

  // 根據 sheetName 決定要使用的 API 網址後綴，並組合成完整的 API 網址
  var url01 = "";
  if (sheetName === "L539") {
    url01 = "Daily539Result";
  } else if (sheetName === "L649") {
    url01 = "lotto649Result";
  } else if (sheetName === "L638") {
    url01 = "SuperLotto638Result";
  } else if (sheetName === "L3D") {
    url01 = "3DResult";
  } else if (sheetName === "L4D") {
    url01 = "4DResult";
  } else if (sheetName === "LSix") {
    url01 = "lotto649Result";
  } else {
    logSystemError("scrapeDailyCash", "未知的 sheetName: " + sheetName, "ERROR", "", {
      sheetName: sheetName,
    });
    return;
  }

  // 資料中最後一期期別，預設為 115000001，若 sheet 中已有資料則使用最後一行的 period 值
  var startperiod = parseInt(period) + 1; // 從下一期開始抓取
  //獲取API最後一期期別
  var endperiod = getendPeriod(sheetName, url00, url01, startperiod);
  if (!endperiod) {
    endperiod = startperiod + 1; // 如果無法獲取 API 最後期別，則預設抓取 100 期
  }

  logSystemError(
    "scrapeDailyCash",
    "開始抓取資料，起始期別: " + startperiod + "，API 最後期別: " + endperiod,
  );

  var Lottoresult = [];
  for (var p = startperiod; p <= endperiod; p++) {
    // 檢查超時
    if (isNearTimeout()) {
      return { status: "continue", data: Lottoresult, lastPeriod: p - 1 };
    }

    // Logger.log("正在抓取期別: " + p);
    var url = url00 + url01 + "?period=" + p;
    // Logger.log("正在抓取網址: " + url);

    var response = UrlFetchApp.fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/ 120.0.0.0 Safari/537.36",
        Referer: "https://www.taiwanlottery.com/",
        "Accept-Language": "zh-TW,zh;q=0.9,en-US;q=0.8,en;q=0.7",
      },
      muteHttpExceptions: true,
    });

    var json = JSON.parse(response.getContentText());
    if (sheetName === "L539" && json.content && json.content.daily539Res) {
      Lottoresult = Lottoresult.concat(json.content.daily539Res);
    } else if (
      sheetName === "L649" &&
      json.content &&
      json.content.lotto649Res
    ) {
      Lottoresult = Lottoresult.concat(json.content.lotto649Res);
    } else if (
      sheetName === "L638" &&
      json.content &&
      json.content.superLotto638Res
    ) {
      Lottoresult = Lottoresult.concat(json.content.superLotto638Res);
    }

    Utilities.sleep(200); // 避免請求過快
    if (!Lottoresult || Lottoresult.length === 0) {
      logSystemError("scrapeDailyCash", "未找到資料，期別: " + p, "WARNING", "", {
        period: p,
      });
      continue;
    }
  }
  return { status: "complete", data: Lottoresult };
}

function scrapeDailySix(sheetName, period) {
  var url = "https://lotto.arclink.com.tw/kj_6.html";
  var result = [];

  try {
    var response = UrlFetchApp.fetch(url, {
      muteHttpExceptions: true,
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      },
    });

    // 台灣舊網站常使用 Big5 編碼，需轉換以免亂碼
    var html = response.getBlob().getDataAsString("Big5");

    // 根據指示：六合彩開獎號碼 後面的表格 才是我們需要的資料
    var keyword = "六合彩開獎號碼";
    var idx = html.indexOf(keyword);
    if (idx !== -1) {
      html = html.substring(idx);
    }

    // 使用 Regex 抓取表格列 (tr)
    var rowRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
    var cellRegex = /<td[^>]*>([\s\S]*?)<\/td>/gi;

    var match;
    while ((match = rowRegex.exec(html)) !== null) {
      // 加入超時保護
      if (isNearTimeout()) {
        return { status: "continue", data: result, lastPeriod: "N/A" };
      }

      var rowContent = match[1];
      var cells = [];
      var cellMatch;
      // 抓取列中的所有儲存格 (td)
      // 六合彩開獎號碼 後面的表格 才是我們需要的資料，前面表格的 td 可能不完整，所以先抓取所有 tr，再從 tr 中抓取 td，最後再判斷是否為有效資料列
      while ((cellMatch = cellRegex.exec(rowContent)) !== null) {
        // 去除 HTML 標籤並修剪空白
        cells.push(cellMatch[1].replace(/<[^>]+>/g, "").trim());
        //Logger.log("抓取到儲存格內容: " + cells[cells.length - 1]);
      }
      //Logger.log("抓取到列內容，儲存格數量: " + cells.length);
      // 判斷是否為有效資料列
      // 欄位順序: 期號(0): 026022, 開獎日期(1): 2026-02-26, 開獎號碼(2) 06,19,38,15,42,13,34

      if (cells.length >= 3) {
        var p = cells[0];
        // 將 period 轉成字串並補零到 6 位數
        p = String(p).padStart(6, "0");
        //Logger.log("正在處理期號: " + p);
        // 簡單驗證期號是否為數字
        if (/^\d+$/.test(p)) {
          // 只抓取比目前 sheet 中最後一期更新的資料
          if (parseInt(p, 10) > parseInt(period, 10)) {
            var nums = [];
            // 提取號碼，格式為 "06,19,38,15,42,13,34"
            var numArr = cells[2].split(",");
            for (var i = 0; i < numArr.length; i++) {
              nums.push(parseInt(numArr[i], 10));
            }
            result.push({
              period: p,
              lotteryDate: cells[1],
              drawNumberAppear: nums,
            });
          }
        }
      }
    }

    // 將結果按期號由小到大排序 (舊到新)，以便依序寫入
    result.sort(function (a, b) {
      return parseInt(a.period, 10) - parseInt(b.period, 10);
    });
  } catch (e) {
    logSystemError("scrapeDailySix", "scrapeDailySix 發生錯誤: " + e.toString(), "ERROR", "", {
      sheetName: sheetName,
    });
  }
  // 回傳抓取結果 Logger.log("成功抓取 " + result.length + " 筆資料");
  return { status: "complete", data: result };
}

function getendPeriod(sheetName, url00, url01, startperiod) {
  try {
    var now = new Date();
    // 如果現在是每月的第一天，則查詢上個月的資料，否則查詢本月的資料 （因為每月的第一天可能還沒有當月的資料）
    if (now.getDate() === 1) {
      now.setMonth(now.getMonth() - 1);
    }
    var d = new Date(now.getFullYear(), now.getMonth(), 1);
    var queryMonth =
      d.getFullYear() + "-" + ("0" + (d.getMonth() + 1)).slice(-2);
    var url = url00 + url01 + "?period&month=" + queryMonth;

    logSystemError("getendPeriod", "正在抓取網址: " + url, "INFO", "", {
      queryMonth: queryMonth,
    });

    var response = UrlFetchApp.fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        Referer: "https://www.taiwanlottery.com/",
        "Accept-Language": "zh-TW,zh;q=0.9,en-US;q=0.8,en;q=0.7",
      },
      muteHttpExceptions: true,
    });

    // 檢查回應狀態碼，確保成功抓取資料
    // 今彩539 的 API 回傳結構為 { content: { daily539Res: [...] } }，其他遊戲可能結構不同，需根據實際情況調整解析方式
    // 大樂透的 API 回傳結構為 { content: { lotto649Res: [...] } }，
    // 威力彩的 API 回傳結構為 { content: { superLotto638Res: [...] } }，
    // 3星彩的 API 回傳結構為 { content: { threeDRes: [...] } }，
    // 4星彩的 API 回傳結構為 { content: { fourDRes: [...] } }

    var Lottoresult = [];
    if (response.getResponseCode() === 200) {
      var json = JSON.parse(response.getContentText());
      if (sheetName === "L539" && json.content && json.content.daily539Res) {
        Lottoresult = Lottoresult.concat(json.content.daily539Res);
        json.content.daily539Res;
      } else if (
        sheetName === "L649" &&
        json.content &&
        json.content.lotto649Res
      ) {
        Lottoresult = Lottoresult.concat(json.content.lotto649Res);
      } else if (
        sheetName === "L638" &&
        json.content &&
        json.content.superLotto638Res
      ) {
        Lottoresult = Lottoresult.concat(json.content.superLotto638Res);
      }
    } else {
      logSystemError(
        "getendPeriod",
        "抳取失敗 (" + queryMonth + ")，狀態碼: " + response.getResponseCode(),
        "ERROR",
        "",
        { responseCode: response.getResponseCode(), queryMonth: queryMonth },
      );
    }
    Utilities.sleep(200); // 避免請求過快

    if (!Lottoresult || Lottoresult.length === 0) {
      logSystemError("getendPeriod", "未找到資料", "WARNING", "", {
        queryMonth: queryMonth,
      });
      return;
    }
  } catch (e) {
    logSystemError("getendPeriod", "發生錯誤: " + e.toString(), "ERROR", "", {
      sheetName: sheetName,
      queryMonth: queryMonth,
    });
  }
  // 回傳最大的period值，若無資料則回傳原始的 startperiod
  if (Lottoresult.length > 0) {
    var maxPeriod = Lottoresult.reduce(function (max, item) {
      return item.period > max ? item.period : max;
    }, Lottoresult[0].period);
    return maxPeriod;
  } else {
    return startperiod;
  }
}
