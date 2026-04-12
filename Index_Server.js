/**
 * Index_Server.js
 * 處理首頁 (Index.html) 相關的伺服器端邏輯與系統監控。
 */

/**
 * 獲取系統健康度統計 (供首頁面板使用)
 * 統計 PropertiesService 中的權重快取數量與各彩種存檔筆數。
 */
function getSystemHealthStats() {
  try {
    const stats = {
      cacheCount: 0,
      archiveCount: 0,
      appVersion: getCacheVersion(),
    };

    // 1. 計算 UserProperties 中的權重快取數量
    const props = PropertiesService.getUserProperties().getKeys();
    stats.cacheCount = props.filter((k) => k.startsWith("WEIGHTS_")).length;

    // 2. 統計各彩種存檔區的紀錄總數
    const lottos = ["L539", "L649", "L638", "LSix"];
    lottos.forEach((lotto) => {
      try {
        const trObj = getTargetsheet("Sheets", lotto);
        const archiveSheet = trObj.spreadsheet.getSheetByName(
          "predic1_Settings_Archive",
        );
        if (archiveSheet) {
          const lastRow = archiveSheet.getLastRow();
          if (lastRow > 1) stats.archiveCount += lastRow - 1;
        }
      } catch (e) {
        // 忽略個別彩種讀取失敗，確保整體面板仍能顯示
      }
    });

    return stats;
  } catch (e) {
    Logger.log("getSystemHealthStats Error: " + e.message);
    return null;
  }
}
