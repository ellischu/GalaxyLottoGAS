/**
 * PredictModule 單元測試工具
 * 用於模擬各種邊際情況以確保系統魯棒性
 */
function runPredictUnitTests() {
  console.log("🚀 [Unit Test] 開始執行 PredictModule 壓力測試...");

  testTargetCoeffsEmpty();
  testInvalidInputHandling();
  testCacheHitScenarios();

  console.log("🏁 [Unit Test] 測試流程結束。");
}

/**
 * 場景 1：模擬 targetCoeffs 為空的情境
 */
function testTargetCoeffsEmpty() {
  console.log("--- 測試場景：模擬 targetCoeffs 為空 ---");
  try {
    // 使用一個絕對不存在的彩種代碼，這會導致 getTargetsheet 失敗或資料抓取為空
    const result = getPrediction("NON_EXISTENT_LOTTO", "2024-01-01", true, 10);

    if (result.status === "error") {
      console.log("✅ 通過：系統正確識別數據缺失並回傳 error 狀態。");
      console.log("捕捉到的訊息: " + result.message);
    } else {
      console.warn("❌ 失敗：系統在數據缺失時未回傳錯誤狀態。");
    }
  } catch (e) {
    console.error("❌ 崩潰：測試執行過程發生非預期中斷: " + e.message);
  }
}

/**
 * 場景 2：驗證參數預驗證 (Sanity Check)
 */
function testInvalidInputHandling() {
  console.log("--- 測試場景：無效參數輸入 ---");

  const testCases = [
    { lotto: null, date: "2024-01-01", desc: "彩種為 null" },
    { lotto: "L539", date: "INVALID_DATE", desc: "無效日期格式" },
    { lotto: "L539", date: "", desc: "日期為空字串" },
  ];

  testCases.forEach((tc) => {
    const result = getPrediction(tc.lotto, tc.date, true, 10);
    const passed =
      result.status === "error" && result.message.includes("參數異常");
    console.log(`${passed ? "✅" : "❌"} [${tc.desc}]: ${result.message}`);
  });
}

/**
 * 場景 3：模擬命中快取與 isHighGravityMode 驗證
 */
function testCacheHitScenarios() {
  console.log("--- 測試場景：模擬命中快取與 isHighGravityMode 驗證 ---");
  const cache = CacheService.getScriptCache();
  const lotto = "L539";
  const date = "2026-04-04";
  const cacheKey = "PRED_MODEL_" + lotto + "_" + date;

  // 1. 準備模擬快取資料 (包含高引力模式標記)
  const mockModel = {
    status: "complete",
    isHighGravityMode: true, 
    isOctaveResonance: true,
    learnedEffArr: new Array(50).fill(1.0), // 模擬係數權重
    confidenceHistory: [],
    aiStrategy: { recommendation: "這是快取測試建議" },
    results: [],
    date: date
  };

  try {
    // 強制寫入快取
    cache.put(cacheKey, JSON.stringify(mockModel), 60);

    // 2. 執行預測 (此時 bypassCache 應為 false，故會命中快取)
    const result = getPrediction(lotto, date, true, 10);

    // 3. 驗證賦值是否正確
    if (result.isHighGravityMode === true) {
      console.log("✅ 通過：系統成功從快取中還原 isHighGravityMode 狀態。");
    } else {
      console.warn("❌ 失敗：isHighGravityMode 在快取模式下未能正確賦值。");
    }
  } catch (e) {
    console.error("❌ 測試崩潰: " + e.message);
  } finally {
    // 清理測試資料
    cache.remove(cacheKey);
  }
}
