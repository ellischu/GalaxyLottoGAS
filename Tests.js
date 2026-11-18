/**
 * Prediction2Module 單元測試工具
 * 用於模擬各種邊際情況以確保系統魯棒性
 */
function runPredictUnitTests() {
  Logger.log("🚀 [Unit Test] 開始執行 Prediction2Module 壓力測試...");

  testTargetCoeffsEmpty();
  testInvalidInputHandling();
  testGetGameConfigSmoke();

  Logger.log("🏁 [Unit Test] 測試流程結束。");
}

/**
 * 場景 1：模擬 targetCoeffs 為空的情境
 */
function testTargetCoeffsEmpty() {
  Logger.log("--- 測試場景：模擬 targetCoeffs 為空 ---");
  try {
    const result = getPrediction("NON_EXISTENT_LOTTO", "2024-01-01", true, 10);

    if (result.status === "error") {
      Logger.log("✅ 通過：系統正確識別數據缺失並回傳 error 狀態。");
      Logger.log("捕捉到的訊息: " + result.message);
    } else {
      Logger.log("❌ 失敗：系統在數據缺失時未回傳錯誤狀態。");
    }
  } catch (e) {
    Logger.log("❌ 崩潰：測試執行過程發生非預期中斷: " + e.message);
  }
}

/**
 * 場景 2：驗證無效參數輸入都能正確回傳 error 狀態
 */
function testInvalidInputHandling() {
  Logger.log("--- 測試場景：無效參數輸入 ---");

  const testCases = [
    { lotto: null, date: "2024-01-01", desc: "彩種為 null" },
    { lotto: "L539", date: "INVALID_DATE", desc: "無效日期格式" },
    { lotto: "L539", date: "", desc: "日期為空字串" },
  ];

  testCases.forEach((tc) => {
    const result = getPrediction(tc.lotto, tc.date, true, 10);
    const passed = result.status === "error";
    Logger.log(`${passed ? "✅" : "❌"} [${tc.desc}]: ${result.message}`);
  });
}

/**
 * 場景 3：驗證 getGameConfig 回傳正確的彩種組態
 */
function testGetGameConfigSmoke() {
  Logger.log("--- 測試場景：getGameConfig 基本組態驗證 ---");

  var configs = {
    L539: { maxNum: 39, hasS1: false, maxSpecial: 0 },
    L649: { maxNum: 49, hasS1: true, maxSpecial: 0 },
    L638: { maxNum: 38, hasS1: true, maxSpecial: 8 },
    LSix: { maxNum: 49, hasS1: true, maxSpecial: 0 },
  };

  var allPassed = true;
  Object.keys(configs).forEach(function(key) {
    var cfg = getGameConfig(key);
    var expected = configs[key];
    var ok = cfg.maxNum === expected.maxNum
          && cfg.hasS1 === expected.hasS1
          && cfg.maxSpecial === expected.maxSpecial;
    if (!ok) {
      Logger.log("❌ [" + key + "] 期望=" + JSON.stringify(expected) + " 實際=" + JSON.stringify(cfg));
      allPassed = false;
    }
  });

  if (allPassed) {
    Logger.log("✅ 通過：所有彩種組態正確");
  } else {
    Logger.log("❌ 失敗：部分彩種組態不符");
  }
}

/**
 * NextData 震盪表：手動重建快照與表格（清除舊資料 + 建立新快照）
 * 用於初始化或修復 DataN00/DataN0x/DataNNext0x/DataNKD0x/DataNKDVAR0x 等工作表
 */
function rebuildNextDataL539() {
  Logger.log("🚀 [rebuildNextDataL539] 開始重建 L539 震盪表快照與表格...");

  // 1. 清除舊快照（若存在）
  Logger.log("1️⃣ 清除舊快照...");
  var clearResult = clearNextSnapshots("L539", 1, 200);
  Logger.log("清除結果: " + JSON.stringify(clearResult));

  // 2. 建立新快照與表格
  Logger.log("2️⃣ 建立新快照與表格...");
  var nextResult = getNextData("L539", "2026-10-20", 1, 200, 20, 0);
  Logger.log("建立結果: " + JSON.stringify(nextResult));

  if (nextResult.status === "success") {
    Logger.log("✅ [rebuildNextDataL539] 完成！已建立 " + (nextResult.snapshots ? nextResult.snapshots.length : 0) + " 期快照");
  } else {
    Logger.log("❌ [rebuildNextDataL539] 失敗：" + (nextResult.message || "未知錯誤"));
  }
}

/**
 * NextData 震盪表：手動重建快照與表格（清除舊資料 + 建立新快照）
 * 可自訂彩種、日期、方法序號、BASE 期數
 * @param {string} lotto 彩種 (L539/L649/L638/LSix)
 * @param {string} dateStr 基準日期 (yyyy-MM-dd)
 * @param {number} methodSN 方法序號
 * @param {number} baseRange 資料提供期數
 */
function rebuildNextDataCustom(lotto, dateStr, methodSN, baseRange) {
  lotto = lotto || "L539";
  dateStr = dateStr || "2026-10-20";
  methodSN = methodSN || 1;
  baseRange = baseRange || 200;

  Logger.log("🚀 [rebuildNextDataCustom] 開始重建 " + lotto + " 震盪表快照與表格...");

  // 1. 清除舊快照（若存在）
  Logger.log("1️⃣ 清除舊快照...");
  var clearResult = clearNextSnapshots(lotto, methodSN, baseRange);
  Logger.log("清除結果: " + JSON.stringify(clearResult));

  // 2. 建立新快照與表格
  Logger.log("2️⃣ 建立新快照與表格...");
  var nextResult = getNextData(lotto, dateStr, methodSN, baseRange, 20, 0);
  Logger.log("建立結果: " + JSON.stringify(nextResult));

  if (nextResult.status === "success") {
    Logger.log("✅ [rebuildNextDataCustom] 完成！已建立 " + (nextResult.snapshots ? nextResult.snapshots.length : 0) + " 期快照");
  } else {
    Logger.log("❌ [rebuildNextDataCustom] 失敗：" + (nextResult.message || "未知錯誤"));
  }
}

/**
 * NextData 震盪表：僅清除指定彩種/方法/BASE 的快照與表格
 * @param {string} lotto 彩種 (L539/L649/L638/LSix)
 * @param {number} methodSN 方法序號 (null 表示全部)
 * @param {number} baseRange 資料提供期數 (null 表示全部)
 */
function clearNextDataOnly(lotto, methodSN, baseRange) {
  lotto = lotto || "L539";
  Logger.log("🧹 [clearNextDataOnly] 清除 " + lotto + " 快照 (methodSN=" + methodSN + ", baseRange=" + baseRange + ")...");
  var result = clearNextSnapshots(lotto, methodSN, baseRange);
  Logger.log("清除結果: " + JSON.stringify(result));
  if (result.status === "success") {
    Logger.log("✅ 已清除 " + (result.deleted || 0) + " 筆快照");
  } else {
    Logger.log("❌ 清除失敗：" + (result.message || "未知錯誤"));
  }
}

/**
 * NextData 震盪表：僅建立快照與表格（不清除舊資料）
 * @param {string} lotto 彩種 (L539/L649/L638/LSix)
 * @param {string} dateStr 基準日期 (yyyy-MM-dd)
 * @param {number} methodSN 方法序號
 * @param {number} baseRange 資料提供期數
 */
function buildNextDataOnly(lotto, dateStr, methodSN, baseRange) {
  lotto = lotto || "L539";
  dateStr = dateStr || "2026-10-20";
  methodSN = methodSN || 1;
  baseRange = baseRange || 200;

  Logger.log("🔨 [buildNextDataOnly] 建立 " + lotto + " 快照與表格 (date=" + dateStr + ", methodSN=" + methodSN + ", baseRange=" + baseRange + ")...");
  var result = getNextData(lotto, dateStr, methodSN, baseRange, 20, 0);
  Logger.log("建立結果: " + JSON.stringify(result));
  if (result.status === "success") {
    Logger.log("✅ 已建立 " + (result.snapshots ? result.snapshots.length : 0) + " 期快照");
  } else {
    Logger.log("❌ 建立失敗：" + (result.message || "未知錯誤"));
  }
}