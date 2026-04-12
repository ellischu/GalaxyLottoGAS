GalaxyLotto 試算表：
* L539 工作表：記錄由地球在特定日期，固定時間，觀察L539象限的39顆星球出現的結果。
   * period 欄位：Title:期數，Type:string (不可重複)
   * Date 欄位：Title :日期，Type:Date
   * L1欄位：Title:落1，Type:integer
   * L2欄位：Title:落2，Type:integer
   * L3欄位：Title:落3，Type:integer
   * L4欄位：Title:落4，Type:integer
   * L5欄位：Title:落5，Type:integer
   * Sum欄位：Title:總合，Type:integer
   * series 欄位:Title:序號，Type:integer
* L649 工作表：記錄由地球在特定日期，固定時間，觀察L649象限的49顆星球出現的結果。
   * period 欄位：Title:期數，Type:string (不可重複)
   * Date 欄位：Title :日期，Type:Date
   * L1欄位：Title:落1，Type:integer
   * L2欄位：Title:落2，Type:integer
   * L3欄位：Title:落3，Type:integer
   * L4欄位：Title:落4，Type:integer
   * L5欄位：Title:落5，Type:integer
   * L6欄位：Title:落6，Type:integer
   * S1欄位：Title:特1，Type:integer
   * Sum欄位：Title:總合，Type:integer
   * series 欄位:Title:序號，Type:integer
* L638 工作表：記錄由地球在特定日期，固定時間，觀察L638象限的38顆星球出現的結果。
   * period 欄位：Title:期數，Type:string (不可重複)
   * Date 欄位：Title :日期，Type:Date
   * L1欄位：Title:落1，Type:integer
   * L2欄位：Title:落2，Type:integer
   * L3欄位：Title:落3，Type:integer
   * L4欄位：Title:落4，Type:integer
   * L5欄位：Title:落5，Type:integer
   * L6欄位：Title:落6，Type:integer
   * S1欄位：Title:特1，Type:integer (1~8顆 )
   * Sum欄位：Title:總合，Type:integer
   * series 欄位:Title:序號，Type:integer
* LSix 工作表：記錄由地球在特定日期，固定時間，觀察LSix象限的49顆星球出現的結果。
   * period 欄位：Title:期數，Type:string (不可重複)
   * Date 欄位：Title :日期，Type:Date
   * L1欄位：Title:落1，Type:integer
   * L2欄位：Title:落2，Type:integer
   * L3欄位：Title:落3，Type:integer
   * L4欄位：Title:落4，Type:integer
   * L5欄位：Title:落5，Type:integer
   * L6欄位：Title:落6，Type:integer
   * S1欄位：Title:特1，Type:integer
   * Sum欄位：Title:總合，Type:integer
   * series 欄位:Title:序號，Type:integer
* AllData 工作表：日期與參數的值。
   * Date 欄位：Title :日期，Type:Date (不可重複)
   * strYearT1欄位：Title :年干，Type:string
   * strYearT2欄位：Title :年支，Type:string
   * strMonthT1欄位：Title :月干，Type:string
   * strMonthT2欄位：Title :月支，Type:string
   * strDayT1欄位：Title :日干，Type:string
   * strDayT2欄位：Title :日支，Type:string
   * strHourT欄位：Title :時柱，Type:string
   * strDayFive欄位：Title :日形，Type:string
   * strDayTwelve欄位：Title :日執，Type:string
   * strDayNine欄位：Title :日星，Type:string
   * strDayTwentyEight欄位：Title :日宿，Type:string
   * strHourTwentyEight欄位：Title :時宿，Type:string
   * strDayEight欄位：Title :日掛，Type:string
   * strp01欄位：Title :本命，Type:string
   * strp02欄位：Title :父母，Type:string
   * strp03欄位：Title :福德，Type:string
   * strp04欄位：Title :田宅，Type:string
   * strp05欄位：Title :官祿，Type:string
   * strp06欄位：Title :奴僕，Type:string
   * strp07欄位：Title :遷移，Type:string
   * strp08欄位：Title :疾厄，Type:string
   * strp09欄位：Title :財帛，Type:string
   * strp010欄位：Title :子女，Type:string
   * strp011欄位：Title :夫妻，Type:string
   * strp012欄位：Title :兄弟，Type:string
   * strp013欄位：Title :命重，Type:string
   * 所有代碼對應值在 IDName 工作表中。
* Sheets 工作表：記錄各個試算表的網址。
   * SheetN欄位：Title:工作表名稱，Type:string (不可重複)
   * Url欄位：Title:網址，Type:http
* Folders 工作表：記錄各個資料夾的網址。
   * FolderN欄位：Title:資料夾名稱，Type:string (不可重複)
   * Url欄位：Title:網址，Type:http
* IDName 工作表：記錄各個ID對應的名稱。
   * ID欄位：Title:ID代號，Type:string (不可重複)
   * IDName欄位：Title:ID名稱，Type:string (不可重複)




L539試算表：
* All 工作表
概念描述：
* 如何以行星軌道模型描述其軌跡，並預測其特定日期可能出現的星球代號。
   * 先以軌道模型個別測試。
   * 這些星球可能是其他星球的衛星，必須測試各個星球與其他星球之間的關係。
   * 

* 建立遺漏數表格 L539 試算表 >Miss 工作表 。


   *    * 



* 建立新試算表L539 >All 工作表 。
* 建立 L539 試算表 >All工作表 ，以Date欄位結合 GalaxyLotto 試算表 >  L539 工作表 及 GalaxyLotto 試算表 > AllData 工作表 。
* 先檢查 L539 試算表 >All工作表 是否有資料，如果有則選擇最後一筆資料的 Date 欄位 as sDate ，從 GalaxyLotto 試算表 >  L539 工作表 的 Date 欄位 > sDate,依序處理。
* const mainspreadsheet = SpreadsheetApp.getActiveSpreadsheet(); //已建立
* 建立Utility.js 中  function combineData(sheetname) {
   * const trspreadsheet = getTargetsheet(“Sheets”,sheetname).spreadsheet;
   * const trsheet = trspreadsheet.getSheetByName(“All”);
   *    * const srsheet1 = mainspreadsheet.getSheetByName(sheetname);
   *    * // 檢查 trsheet 是否有資料，並取得最後一筆 Date 欄位資料
   * // 如果沒有資料則 srsheet1 從第一筆資料開始結合
   * const lastdate = ; //trsheet 的最後一筆 Date 欄位資料
   * // loop 
   * // 取得 srsheet1 的 L1,L2,L3,L4,L5 (L6: L649,L638,Lsix 要一起排序 )(S1:L649,L638,Lsix不排序) ,轉成 N1,N2,N3,N4,N5,N6,S1
   *  var datamap = getAllData(date);
   * //結合 Date,N1,N2,B3,N4,N5,N6,S1,Sum 以及 datamap 的資料 ，寫入 trsheet 
   * }
   * 先處理10筆資料用以驗證正確性。
* 建立Utility.js 中 function getTarget(sheetName, targetName) {
   *  var sheet = MainSpreadsheet.getSheetByName(sheetName);
   *   if (!sheet) throw new Error("找不到 SYCompany 中的" + sheetName + "工作表");
   *    *   var data = sheet.getDataRange().getValues();
   *   var url = "";
   *    *   for (var i = 1; i < data.length; i++) {
   *     if (data[i][0] === targetName) {
   *       url = data[i][1];
   *       break;
   *     }
   *   }
   *   // console.log("取得試算表網址: " + url);
   *   return url;
   * }


* 建立Utility.js 中  function getTargetsheet(sheetName, targetName) {
   * var res = getTarget(sheetName, targetName);
   * var fileId = getIdFromUrl(res);
   *   if (!fileId || typeof fileId !== 'string') {
   *     throw new Error("無法從 URL 解析出有效的 ID: " + res);
   *   }
   *   var file = DriveApp.getFileById(fileId);
   *   var ssheet = SpreadsheetApp.open(file);
   *   return {
   *     url: res,
   *     id: fileId,
   *     spreadsheet: ssheet
   *   };
* 建立Utility.js 中  function getAllData(date){
   * const srsheet2 = mainspreadsheet.getSheetByName(“AllData”);
   * // 以 date find Date 欄位,並傳回 整列資料
   * }