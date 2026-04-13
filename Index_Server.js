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

/**
 * 系統自動維護：清理 PropertiesService 中過期或孤立的屬性
 * 用於防止儲存空間 (500KB Quota) 溢位，並確保系統健康度。
 * 建議由 dailywork.js 每日觸發一次。
 */
function maintenance_PruneSystemProperties() {
  const userProps = PropertiesService.getUserProperties();
  const scriptProps = PropertiesService.getScriptProperties();
  const activeLottos = ["L539", "L649", "L638", "LSix"];
  let pruneCount = 0;

  // 1. 清理 UserProperties (主要存放 AI 權重)
  const uProps = userProps.getProperties();
  for (const key in uProps) {
    // 清理非目前活躍彩種的 WEIGHTS 或 學習時間戳
    if (key.startsWith("WEIGHTS_") || key.startsWith("LAST_ASTRO_LEARN_TS_")) {
      const isOrphaned = !activeLottos.some(lotto => key.includes(lotto));
      if (isOrphaned) {
        userProps.deleteProperty(key);
        pruneCount++;
      }
    }
  }

  // 2. 清理 ScriptProperties (主要存放任務進度與系統版本)
  const sProps = scriptProps.getProperties();
  const transientPrefixes = ["Update_JOB", "Miss_JOB", "TransformAllData_JOB"];
  for (const key in sProps) {
    // 清理殘留的續傳進度 (如果該 key 存在超過 24 小時則視為垃圾)
    // 註：目前的 saveProgress 未存時間戳，此處先以「非關鍵 key」進行安全清理
    const isTransient = transientPrefixes.some(prefix => key.startsWith(prefix));
    if (isTransient) {
      // 如果專案目前沒有正在執行的任務（由 Lock 狀態推判定）則清理
      // 此處簡單處理：直接刪除過時的 JOB 狀態
      scriptProps.deleteProperty(key);
      pruneCount++;
    }
  }

  if (pruneCount > 0) {
    Logger.log(`[System Prune] 成功清理 ${pruneCount} 筆冗餘系統屬性。`);
  }
  
  return {
    status: "success",
    pruned: pruneCount
  };
}
