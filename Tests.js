/**
 * PredictModule 單元測試工具
 * 用於模擬各種邊際情況以確保系統魯棒性
 */
function runPredictUnitTests() {
  Logger.log("🚀 [Unit Test] 開始執行 PredictModule 壓力測試...");

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
