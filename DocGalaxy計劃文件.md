# 系統環境

- 系統 : GAS 系統(6分鐘執行限制) , jQuery , BootStrap ,swal2 界面
- 界面 : 手機 1080 *2340,平板 1280*800 ,桌面
- 回答完整程式碼以方便閱讀及尋找。
- 以中文回答

# 試算表資料

- [Spreadsheet](DocSpreadsheet.md)： 試算表及工作表資料。

# 模組或程式建構

- [CLAUDE](DocCLAUDE.md) : 設計規範。
- [Predict](DocPredict.md) ： Predict 模組。
- [prediction1](Docprediction1.md) : Prediction1 模組。
- [prediction2](Docprediction2.md) : Prediction2 模組(行星模組)。
- [AllFunction](DocAllFunction.md) : 所有程式函式索引。
- [Activity](DocActivity.md) : 活性表單設計。
- [Utility](DocUtility.md) : 公用程式。

## Function 函式設計

### Miss 工作表

- 建立遺漏數表格 L539試算表>Miss 工作表 。

### All 工作表

- 建立新L539試算表>All 工作表 。
  - 建立 L539試算表>All工作表，以Date欄位結合 GalaxyLotto試算表>L539 工作表 及 GalaxyLotto試算表>AllData 工作表 。
  - 檢查 L539試算表>All工作表 是否有資料，如果有則選擇最後一筆資料的 Date 欄位 as
    sDate ，從 GalaxyLotto 試算表 > L539 工作表 的 Date 欄位 > sDate,依序處理。
