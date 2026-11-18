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
        // 新架構：Prediction2 存檔位於 {lotto}_Prediction2 試算表 > predic2_History_Archive 工作表
        const trObj = getTargetsheet("Sheets", lotto + "_Prediction2");
        const archiveSheet = trObj.spreadsheet.getSheetByName(
          "predic2_History_Archive",
        );
        if (archiveSheet) {
          const lastRow = archiveSheet.getLastRow();
          if (lastRow > 1) stats.archiveCount += lastRow - 1;
        }
      } catch (e) {
        // 忽略個別彩種讀取失敗，確保整體面板仍能顯示
        logSystemError("getSystemHealthStats", e.toString(), "WARNING", `讀取 ${lotto} 存檔筆數失敗`);
      }
    });

    return stats;
  } catch (e) {
    logSystemError("getSystemHealthStats", e.message, "ERROR", "系統健康度統計失敗");
    return null;
  }
}

/**
 * 首頁載入時檢查四個彩種的原始開獎表與 All 合併表是否同步；未同步時自動補齊。
 * 支援 GAS 時間限制續傳：前端收到 continue 後再次呼叫本函式。
 * @returns {Object} {status, message, details}
 */
function syncHomeLotteryData() {
  const lottos = ["L539", "L649", "L638", "LSix"];
  const ss =
    typeof mainspreadsheet !== "undefined"
      ? mainspreadsheet
      : SpreadsheetApp.getActiveSpreadsheet();

  try {
    for (let i = 0; i < lottos.length; i++) {
      const lotto = lottos[i];
      const sourceSheet = ss.getSheetByName(lotto);
      if (!sourceSheet || sourceSheet.getLastRow() < 2) {
        return {
          status: "error",
          message: lotto + " 原始開獎資料不存在，無法同步 All。",
        };
      }

      const sourceHeaders = sourceSheet
        .getRange(1, 1, 1, sourceSheet.getLastColumn())
        .getValues()[0];
      const dateCol = sourceHeaders.indexOf("Date");
      if (dateCol < 0) {
        return { status: "error", message: lotto + " 原始資料缺少 Date 欄位。" };
      }

      const sourceLastRow = sourceSheet.getLastRow();
      const sourceLastDate = normDrawDateStr(
        sourceSheet.getRange(sourceLastRow, dateCol + 1).getValue(),
      );
      if (!sourceLastDate) {
        return { status: "error", message: lotto + " 原始資料最後日期格式錯誤。" };
      }

      const target = getTargetsheet("Sheets", lotto);
      const allSheet = target.spreadsheet.getSheetByName("All");
      let allLastDate = null;
      if (allSheet && allSheet.getLastRow() > 1) {
        allLastDate = normDrawDateStr(allSheet.getRange(allSheet.getLastRow(), 1).getValue());
      }

      // 先比對最後日期；日期相同時再比對資料筆數（不含標題列）。
      const sourceDataCount = sourceLastRow - 1;
      const allDataCount = allSheet ? Math.max(0, allSheet.getLastRow() - 1) : 0;
      const isSynced = allLastDate === sourceLastDate &&
        sourceDataCount === allDataCount;

      if (!isSynced) {
        const updateResult = updatenumber(lotto);
        if (updateResult && updateResult.status === "error") return updateResult;
        if (updateResult && updateResult.status === "continue") {
          return {
            status: "continue",
            message: lotto + " 原始資料更新續傳中。",
          };
        }

        const combineResult = combineData(lotto);
        if (combineResult && combineResult.status === "error") return combineResult;
        if (combineResult && combineResult.status === "continue") {
          return {
            status: "continue",
            message: lotto + " All 合併續傳中。",
          };
        }
      }
    }

    return { status: "complete", message: "四個彩種 All 工作表皆已同步。" };
  } catch (e) {
    logSystemError("syncHomeLotteryData", e.toString(), "ERROR", "首頁資料同步檢查失敗");
    return { status: "error", message: "首頁資料同步檢查失敗：" + e.message };
  }
}

/**
 * 首頁快速同步檢查：只有最後日期不同時才立即更新並合併。
 * 日期相同的資料筆數比對交由背景函式處理，避免阻塞首頁顯示。
 * @returns {Object} {status, message}
 */
function syncHomeLotteryDates() {
  const lottos = ["L539", "L649", "L638", "LSix"];
  const ss =
    typeof mainspreadsheet !== "undefined"
      ? mainspreadsheet
      : SpreadsheetApp.getActiveSpreadsheet();

  try {
    for (let i = 0; i < lottos.length; i++) {
      const lotto = lottos[i];
      const sourceSheet = ss.getSheetByName(lotto);
      if (!sourceSheet || sourceSheet.getLastRow() < 2) continue;

      const sourceHeaders =
        sourceSheet.getRange(1, 1, 1, sourceSheet.getLastColumn()).getValues()[0];
      const dateCol = sourceHeaders.indexOf("Date");
      if (dateCol < 0) continue;

      const sourceLastDate = normDrawDateStr(
        sourceSheet
          .getRange(sourceSheet.getLastRow(), dateCol + 1)
          .getValue(),
      );
      const target = getTargetsheet("Sheets", lotto);
      const allSheet = target.spreadsheet.getSheetByName("All");
      let allLastDate = null;
      if (allSheet && allSheet.getLastRow() > 1) {
        allLastDate = normDrawDateStr(
          allSheet.getRange(allSheet.getLastRow(), 1).getValue(),
        );
      }

      if (sourceLastDate && sourceLastDate !== allLastDate) {
        const updateResult = updatenumber(lotto);
        if (updateResult && updateResult.status === "error") return updateResult;
        if (updateResult && updateResult.status === "continue") {
          return { status: "continue", message: lotto + " 原始資料更新續傳中。" };
        }

        const combineResult = combineData(lotto);
        if (combineResult && combineResult.status === "error") return combineResult;
        if (combineResult && combineResult.status === "continue") {
          return { status: "continue", message: lotto + " All 合併續傳中。" };
        }
      }
    }

    return { status: "complete", message: "日期檢查完成。" };
  } catch (e) {
    logSystemError("syncHomeLotteryDates", e.toString(), "ERROR", "首頁日期同步檢查失敗");
    return { status: "error", message: "首頁日期同步檢查失敗：" + e.message };
  }
}

/**
 * 背景檢查來源與 All 的資料筆數；筆數不同時補做更新與合併。
 * @returns {Object} {status, message}
 */
function syncHomeLotteryCounts() {
  const lottos = ["L539", "L649", "L638", "LSix"];
  const ss =
    typeof mainspreadsheet !== "undefined"
      ? mainspreadsheet
      : SpreadsheetApp.getActiveSpreadsheet();

  try {
    for (let i = 0; i < lottos.length; i++) {
      const lotto = lottos[i];
      const sourceSheet = ss.getSheetByName(lotto);
      if (!sourceSheet) continue;

      const target = getTargetsheet("Sheets", lotto);
      const allSheet = target.spreadsheet.getSheetByName("All");
      const sourceCount = Math.max(0, sourceSheet.getLastRow() - 1);
      const allCount = allSheet ? Math.max(0, allSheet.getLastRow() - 1) : 0;
      if (sourceCount === allCount) continue;

      const updateResult = updatenumber(lotto);
      if (updateResult && updateResult.status === "error") return updateResult;
      if (updateResult && updateResult.status === "continue") {
        return { status: "continue", message: lotto + " 原始資料更新續傳中。" };
      }

      const combineResult = combineData(lotto);
      if (combineResult && combineResult.status === "error") return combineResult;
      if (combineResult && combineResult.status === "continue") {
        return { status: "continue", message: lotto + " All 合併續傳中。" };
      }
    }

    return { status: "complete", message: "資料筆數檢查完成。" };
  } catch (e) {
    logSystemError("syncHomeLotteryCounts", e.toString(), "ERROR", "首頁資料筆數檢查失敗");
    return { status: "error", message: "首頁資料筆數檢查失敗：" + e.message };
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
  const transientPrefixes = ["Combine_JOB_", "Miss_JOB_", "TransformAllData_JOB"];
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
    logSystemError("maintenance_PruneSystemProperties", `已清理 ${pruneCount} 筆冗餘系統屬性`, "INFO", "系統屬性維護完成");
  }
  
  return {
    status: "success",
    pruned: pruneCount
  };
}
