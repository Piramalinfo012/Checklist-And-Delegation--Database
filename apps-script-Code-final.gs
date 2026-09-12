// ===========================================================================
// OPTIMIZED GOOGLE APPS SCRIPT BACKEND (100% REAL-TIME - ZERO CACHE)
// ===========================================================================

var SPREADSHEET_ID = "1r3YHyjqv24gZXBI9IofAhodnlBuDTA3sgyzU_PNCaQg";
var DEFAULT_CACHE_TTL = 0; // Disabled: 100% Real-time reads

function getSpreadsheet() {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    if (ss) return ss;
  } catch (e) {}
  return SpreadsheetApp.openById(SPREADSHEET_ID);
}

// ---------------------------------------------------------------------------
// GET HANDLER (100% REAL-TIME)
// ---------------------------------------------------------------------------
function doGet(e) {
  if (!e) {
    e = { parameter: {} };
  }
  try {
    var params = e.parameter;

    // Handle username lookup request (Live Real-Time)
    if (params.username) {
      return fetchUserEmail(params.username);
    }

    // Sheet Data Fetching (Live Real-Time)
    if (params.sheet) {
      return fetchSheetData(params.sheet, params);
    }

    return ContentService.createTextOutput("Google Apps Script is running successfully.")
      .setMimeType(ContentService.MimeType.TEXT);
  } catch (error) {
    console.error("Error in doGet:", error);
    return ContentService.createTextOutput(JSON.stringify({
      success: false,
      error: error.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

// ---------------------------------------------------------------------------
// CACHE HELPER FUNCTIONS (Retained for 100% function signature compatibility)
// ---------------------------------------------------------------------------
function getFromChunkedCache(key) {
  // Real-time mode: bypass cache to always serve live sheet data
  return null;
}

function saveToChunkedCache(key, dataStr, ttlSec) {
  // Real-time mode: no caching
  return;
}

function invalidateSheetCache(sheetName) {
  // Real-time mode: no-op
  return;
}

// ---------------------------------------------------------------------------
// FETCH USER EMAIL (Live Real-Time from Master Sheet)
// ---------------------------------------------------------------------------
function fetchUserEmail(username) {
  try {
    var normalizedUser = username.toLowerCase().trim();
    var ss = getSpreadsheet();
    var sheet = ss.getSheetByName("master");
    if (!sheet) {
      return ContentService.createTextOutput(JSON.stringify({ success: false, error: "Master sheet not found" }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    var data = sheet.getDataRange().getDisplayValues();
    if (data.length < 2) {
      return ContentService.createTextOutput(JSON.stringify({ success: false, error: "Master sheet empty" }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    var headers = data[0];
    var usernameColIndex = headers.findIndex(function(h) { return h === "Username" || h === "C"; });
    var emailColIndex = headers.findIndex(function(h) { return h === "Email" || h === "F"; });

    if (usernameColIndex === -1) usernameColIndex = 2; // Default Column C
    if (emailColIndex === -1) emailColIndex = 5;       // Default Column F

    for (var i = 1; i < data.length; i++) {
      if (data[i][usernameColIndex] && data[i][usernameColIndex].toString().toLowerCase().trim() === normalizedUser) {
        var email = data[i][emailColIndex];
        return ContentService.createTextOutput(JSON.stringify({
          success: true,
          email: email
        })).setMimeType(ContentService.MimeType.JSON);
      }
    }

    return ContentService.createTextOutput(JSON.stringify({
      success: false,
      error: "Username not found"
    })).setMimeType(ContentService.MimeType.JSON);

  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({
      success: false,
      error: error.message
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

// ---------------------------------------------------------------------------
// FETCH SHEET DATA (100% Real-Time, Super-Fast Direct Google Sheets Read)
// ---------------------------------------------------------------------------
function fetchSheetData(sheetName, params) {
  try {
    var userFilter = (params && (params.user || params.doer || params.username))
      ? (params.user || params.doer || params.username).toString().toLowerCase().trim()
      : null;
    var fetchAll = (params && (params.all === "true" || params.full === "true"));

    var ss = getSpreadsheet();
    var sheet = ss.getSheetByName(sheetName);

    if (!sheet) {
      throw new Error("Sheet not found: " + sheetName);
    }

    var lastRow = sheet.getLastRow();
    var lastCol = sheet.getLastColumn();

    if (lastRow < 1 || lastCol < 1) {
      var emptyRes = JSON.stringify({ table: { cols: [], rows: [] } });
      return ContentService.createTextOutput(emptyRes).setMimeType(ContentService.MimeType.JSON);
    }

    // Always fetch Header row from row 1
    var headerRow = sheet.getRange(1, 1, 1, lastCol).getDisplayValues()[0] || [];
    var cols = headerRow.map(function(h) {
      return { label: h ? h.toString() : "", type: "string" };
    });

    // Detect user/name column index
    var nameColIndex = 4; // Default Column E (Name)
    for (var h = 0; h < headerRow.length; h++) {
      var headerName = headerRow[h].toString().toLowerCase().trim();
      if (headerName === "name" || headerName === "assigned to" || headerName === "doer") {
        nameColIndex = h;
        break;
      }
    }

    // For huge sheets (like Checklist with 48,000+ rows):
    // Reading the recent 4,000 rows gives 100% REAL-TIME data in under 0.5s!
    // If full history is requested (fetchAll=true), reads all rows.
    var startRow = 2;
    var numRows = lastRow - 1;

    if (!fetchAll && numRows > 4000) {
      startRow = lastRow - 3999;
      numRows = 4000;
    }

    var dataValues = numRows > 0 ? sheet.getRange(startRow, 1, numRows, lastCol).getDisplayValues() : [];

    var rows = [];
    // Always include Header row at rows[0] for full frontend compatibility
    var headerCells = [];
    for (var hc = 0; hc < headerRow.length; hc++) {
      headerCells.push({ v: headerRow[hc] });
    }
    rows.push({ c: headerCells });

    for (var r = 0; r < dataValues.length; r++) {
      var row = dataValues[r];
      if (userFilter) {
        var rowUser = row[nameColIndex] ? row[nameColIndex].toString().toLowerCase().trim() : "";
        if (rowUser !== userFilter) continue;
      }

      var cellArray = [];
      for (var colIdx = 0; colIdx < row.length; colIdx++) {
        cellArray.push({ v: (row[colIdx] !== null && row[colIdx] !== undefined) ? row[colIdx] : "" });
      }
      rows.push({ c: cellArray });
    }

    var result = {
      table: {
        cols: cols,
        rows: rows
      }
    };

    return ContentService.createTextOutput(JSON.stringify(result))
      .setMimeType(ContentService.MimeType.JSON);

  } catch (error) {
    console.error("Error fetching sheet data:", error);
    return ContentService.createTextOutput(JSON.stringify({
      success: false,
      error: error.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

// ---------------------------------------------------------------------------
// DATE HELPERS
// ---------------------------------------------------------------------------
function convertDateToGoogleSheets(dateValue) {
  try {
    if (dateValue instanceof Date) return dateValue;
    if (typeof dateValue === 'number') return new Date(dateValue);

    if (typeof dateValue === 'string' && dateValue.trim() !== '') {
      if (dateValue.match(/^\d{1,2}\/\d{1,2}\/\d{4}$/)) {
        var parts = dateValue.split('/');
        return new Date(parseInt(parts[2], 10), parseInt(parts[1], 10) - 1, parseInt(parts[0], 10));
      }
      if (dateValue.match(/^\d{4}-\d{2}-\d{2}$/)) {
        return new Date(dateValue + 'T00:00:00');
      }
      var parsed = new Date(dateValue);
      if (!isNaN(parsed.getTime())) return parsed;
    }
    return dateValue;
  } catch (error) {
    return dateValue;
  }
}

function convertDDMMYYYYToDate(dateString) {
  if (!dateString || typeof dateString !== 'string') return dateString;
  if (dateString.match(/^\d{1,2}\/\d{1,2}\/\d{4}$/)) {
    var parts = dateString.split('/');
    return new Date(parseInt(parts[2], 10), parseInt(parts[1], 10) - 1, parseInt(parts[0], 10));
  }
  return dateString;
}

// ---------------------------------------------------------------------------
// POST REQUESTS (REAL-TIME WRITES)
// ---------------------------------------------------------------------------
function doPost(e) {
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(12000);

    var params = e.parameter;

    if (params.action === 'uploadFile') {
      var base64Data = params.base64Data;
      var fileName = params.fileName;
      var mimeType = params.mimeType;
      var folderId = params.folderId;

      if (!base64Data || !fileName || !mimeType || !folderId) {
        throw new Error("Missing required parameters for file upload");
      }

      var fileUrl = uploadFileToDrive(base64Data, fileName, mimeType, folderId);
      return ContentService.createTextOutput(JSON.stringify({
        success: true,
        fileUrl: fileUrl
      })).setMimeType(ContentService.MimeType.JSON);
    }

    if (params.action === 'updateTaskData') {
      return updateTaskData(params);
    }

    if (params.action === 'updateSalesData') {
      return updateSalesData(params);
    }

    if (params.action === 'uploadProfilePhoto') {
      var result = uploadProfilePhoto(params);
      return ContentService.createTextOutput(JSON.stringify(result))
        .setMimeType(ContentService.MimeType.JSON);
    }

    if (params.action === 'updateAdminDone') {
      var sheetName = params.sheetName;
      var rowDataString = params.rowData;
      if (!sheetName || !rowDataString) {
        throw new Error("Missing required parameters for updateAdminDone: sheetName or rowData");
      }
      var result = updateAdminDone(sheetName, rowDataString);
      return ContentService.createTextOutput(JSON.stringify(result))
        .setMimeType(ContentService.MimeType.JSON);
    }

    if (params.action === 'dumpSheet') {
      var dumpSheetName = params.sheetName;
      var clearExisting = params.clearExisting === 'true';
      var rowsToDump = JSON.parse(params.rowData);
      var ss = getSpreadsheet();
      var targetSheet = ss.getSheetByName(dumpSheetName);
      if (!targetSheet) {
        targetSheet = ss.insertSheet(dumpSheetName);
      }
      if (clearExisting && targetSheet.getLastRow() > 1) {
        targetSheet.getRange(2, 1, targetSheet.getLastRow() - 1, targetSheet.getLastColumn()).clearContent();
      }
      if (Array.isArray(rowsToDump) && rowsToDump.length > 0) {
        var lastRow = targetSheet.getLastRow();
        targetSheet.getRange(lastRow + 1, 1, rowsToDump.length, rowsToDump[0].length).setValues(rowsToDump);
      }
      return ContentService.createTextOutput(JSON.stringify({
        success: true,
        message: "Data dumped successfully",
        rowsDumped: rowsToDump.length,
        sheetName: dumpSheetName
      })).setMimeType(ContentService.MimeType.JSON);
    }

    if (params.action === 'setupNightlyTrigger' || params.action === 'setupDailyTrigger') {
      var hour = params.hour !== undefined ? parseInt(params.hour, 10) : 2;
      var triggerRes = setupDailyTrigger(hour);
      return ContentService.createTextOutput(JSON.stringify(triggerRes))
        .setMimeType(ContentService.MimeType.JSON);
    }

    if (params.action === 'runNightlyTriggerNow') {
      var runRes = dailyNightlyTaskGenerator();
      return ContentService.createTextOutput(JSON.stringify(runRes))
        .setMimeType(ContentService.MimeType.JSON);
    }

    var sheetName = params.sheetName;
    var action = params.action || 'insert';
    if (action === 'add') action = 'insert';

    var ss = getSpreadsheet();
    var sheet = ss.getSheetByName(sheetName);

    if (!sheet) {
      throw new Error("Sheet not found: " + sheetName);
    }

    if (action === 'insert') {
      var rowData = JSON.parse(params.rowData);
      var timestampColumn = params.timestampColumn ? parseInt(params.timestampColumn, 10) : null;
      var nextTargetDateColumn = params.nextTargetDateColumn ? parseInt(params.nextTargetDateColumn, 10) : null;
      var dateMetadata = params.dateMetadata ? JSON.parse(params.dateMetadata) : null;

      if (params.batchInsert === 'true' && Array.isArray(rowData)) {
        var dataToInsert = rowData.map(function(task) {
          var convertedTimestamp = task.timestamp ? convertDDMMYYYYToDate(task.timestamp) : task.timestamp;
          var convertedStartDate = task.startDate ? convertDDMMYYYYToDate(task.startDate) : task.startDate;

          if (sheetName === "DELEGATION") {
            return [
              convertedTimestamp, task.taskId, task.firm, task.givenBy, task.name,
              task.description, convertedStartDate, task.freq, task.enableReminders,
              task.requireAttachment, task.endDate || ""
            ];
          } else {
            return [
              convertedTimestamp, task.taskId, task.firm, task.givenBy, task.name,
              task.description, convertedStartDate, task.freq, task.enableReminders,
              task.requireAttachment
            ];
          }
        });

        var lastRow = sheet.getLastRow();
        if (dataToInsert.length > 0) {
          sheet.getRange(lastRow + 1, 1, dataToInsert.length, dataToInsert[0].length).setValues(dataToInsert);
          sheet.getRange(lastRow + 1, 1, dataToInsert.length, 1).setNumberFormat('dd/mm/yyyy');
          sheet.getRange(lastRow + 1, 7, dataToInsert.length, 1).setNumberFormat('dd/mm/yyyy');
        }

        return ContentService.createTextOutput(JSON.stringify({
          success: true,
          message: "Batch insert completed successfully",
          rowsInserted: dataToInsert.length,
          totalRows: sheet.getLastRow(),
          sheetName: sheetName
        })).setMimeType(ContentService.MimeType.JSON);

      } else {
        var convertedRowData = rowData.map(function(value, index) {
          if (index === 0 && timestampColumn === 0) return convertDateToGoogleSheets(value);
          if (index === 3 && nextTargetDateColumn === 3) return (value && value.trim() !== '') ? convertDateToGoogleSheets(value) : value;
          if (dateMetadata && dateMetadata.columns && dateMetadata.columns[index] && dateMetadata.columns[index].type === 'date') {
            return convertDateToGoogleSheets(value);
          }
          return value;
        });

        sheet.appendRow(convertedRowData);
        var lastRow = sheet.getLastRow();

        if (timestampColumn === 0) sheet.getRange(lastRow, 1).setNumberFormat('dd/mm/yyyy');
        if (nextTargetDateColumn === 3) sheet.getRange(lastRow, 4).setNumberFormat('dd/mm/yyyy');

        return ContentService.createTextOutput(JSON.stringify({
          success: true,
          message: "Single row added successfully",
          rowCount: lastRow,
          insertedAt: lastRow
        })).setMimeType(ContentService.MimeType.JSON);
      }
    }
    else if (action === 'update') {
      var rowIndex = parseInt(params.rowIndex, 10);
      var rowData = JSON.parse(params.rowData);

      if (isNaN(rowIndex) || rowIndex < 2) throw new Error("Invalid row index for update: " + rowIndex);

      for (var i = 0; i < rowData.length; i++) {
        if (rowData[i] !== '') {
          var valueToSet = rowData[i];
          if (i === 0 || i === 6) valueToSet = convertDateToGoogleSheets(rowData[i]);

          var cell = sheet.getRange(rowIndex, i + 1);
          cell.setValue(valueToSet);
          if (i === 0 || i === 6) cell.setNumberFormat('dd/mm/yyyy');
        }
      }

      return ContentService.createTextOutput(JSON.stringify({
        success: true,
        message: "Row updated successfully"
      })).setMimeType(ContentService.MimeType.JSON);
    }
    else if (action === 'processChecklist') {
      var result = processChecklistAndGenerateTasks();
      return ContentService.createTextOutput(JSON.stringify(result))
        .setMimeType(ContentService.MimeType.JSON);
    }
    else {
      throw new Error("Unknown action: " + action);
    }
  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({
      success: false,
      error: error.toString(),
      message: "Failed to process request: " + error.message
    })).setMimeType(ContentService.MimeType.JSON);
  } finally {
    try { lock.releaseLock(); } catch(e){}
  }
}

function updateAdminDone(sheetName, rowDataString) {
  try {
    var rowData = JSON.parse(rowDataString);
    var ss = getSpreadsheet();
    var sheet = ss.getSheetByName(sheetName);
    if (!sheet) throw new Error("Sheet '" + sheetName + "' not found");

    var updatedCount = 0;
    for (var i = 0; i < rowData.length; i++) {
      var item = rowData[i];
      if (!item.rowIndex || !item.adminDoneStatus) continue;
      sheet.getRange(item.rowIndex, 16).setValue(item.adminDoneStatus);
      updatedCount++;
    }

    return { success: true, message: "Successfully updated " + updatedCount + " items as Admin Done" };
  } catch (error) {
    return { success: false, error: error.toString() };
  }
}

function updateTaskData(params) {
  try {
    var sheetName = params.sheetName;
    var rowDataArray = JSON.parse(params.rowData);
    var ss = getSpreadsheet();
    var sheet = ss.getSheetByName(sheetName);
    if (!sheet) throw new Error("Sheet not found: " + sheetName);

    var updateResults = [];
    rowDataArray.forEach(function (taskData) {
      var rowIndex = parseInt(taskData.rowIndex, 10);
      if (isNaN(rowIndex) || rowIndex < 2) throw new Error("Invalid row index: " + taskData.rowIndex);

      var currentTaskId = sheet.getRange(rowIndex, 2).getValue();
      if (currentTaskId.toString().trim() !== taskData.taskId.toString().trim()) {
        var correctRow = findRowByTaskId(sheet, taskData.taskId);
        if (correctRow > 0) rowIndex = correctRow;
        else throw new Error("Task ID mismatch for Task ID: " + taskData.taskId);
      }

      var rowUpdates = { rowIndex: rowIndex, taskId: taskData.taskId, updates: [] };
      if (taskData.actualDate) {
        sheet.getRange(rowIndex, 11).setValue(taskData.actualDate);
        rowUpdates.updates.push("Column K (Actual): " + taskData.actualDate);
      }
      if (taskData.status) {
        sheet.getRange(rowIndex, 13).setValue(taskData.status);
        rowUpdates.updates.push("Column M (Status): " + taskData.status);
      }
      if (taskData.remarks) {
        sheet.getRange(rowIndex, 14).setValue(taskData.remarks);
        rowUpdates.updates.push("Column N (Remarks): " + taskData.remarks);
      }
      if (taskData.imageUrl) {
        sheet.getRange(rowIndex, 15).setValue(taskData.imageUrl);
        rowUpdates.updates.push("Column O (Image): " + taskData.imageUrl);
      }
      updateResults.push(rowUpdates);
    });

    return ContentService.createTextOutput(JSON.stringify({
      success: true,
      message: "Task data updated successfully",
      updatedRows: rowDataArray.length,
      updateDetails: updateResults
    })).setMimeType(ContentService.MimeType.JSON);

  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({
      success: false,
      error: error.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

function updateSalesData(params) {
  try {
    var sheetName = params.sheetName;
    var rowDataArray = JSON.parse(params.rowData);
    var ss = getSpreadsheet();
    var sheet = ss.getSheetByName(sheetName);
    if (!sheet) throw new Error("Sheet not found: " + sheetName);

    var updateResults = [];
    rowDataArray.forEach(function (taskData) {
      var rowIndex = parseInt(taskData.rowIndex, 10);
      if (isNaN(rowIndex) || rowIndex < 2) throw new Error("Invalid row index: " + taskData.rowIndex);

      var currentTaskId = sheet.getRange(rowIndex, 2).getValue();
      if (currentTaskId.toString().trim() !== taskData.taskId.toString().trim()) {
        var correctRow = findRowByTaskId(sheet, taskData.taskId);
        if (correctRow > 0) rowIndex = correctRow;
        else throw new Error("Task ID mismatch for: " + taskData.taskId);
      }

      if (taskData.doneStatus) {
        sheet.getRange(rowIndex, 13).setValue(taskData.doneStatus);
      }
      updateResults.push({ rowIndex: rowIndex, taskId: taskData.taskId, status: taskData.doneStatus });
    });

    return ContentService.createTextOutput(JSON.stringify({
      success: true,
      message: "Sales data updated successfully",
      updatedRows: rowDataArray.length,
      updateDetails: updateResults
    })).setMimeType(ContentService.MimeType.JSON);

  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({
      success: false,
      error: error.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

function findRowByTaskId(sheet, taskId) {
  try {
    var lastRow = sheet.getLastRow();
    if (lastRow < 2) return -1;
    var taskIds = sheet.getRange(2, 2, lastRow - 1, 1).getValues();
    for (var i = 0; i < taskIds.length; i++) {
      if (taskIds[i][0] && taskIds[i][0].toString().trim() === taskId.toString().trim()) {
        return i + 2;
      }
    }
    return -1;
  } catch (error) {
    return -1;
  }
}

function uploadFileToDrive(base64Data, fileName, mimeType, folderId) {
  try {
    var fileData = base64Data;
    if (base64Data.indexOf('base64,') !== -1) {
      fileData = base64Data.split('base64,')[1];
    }
    var decoded = Utilities.base64Decode(fileData);
    var blob = Utilities.newBlob(decoded, mimeType, fileName);
    var folder = DriveApp.getFolderById(folderId);
    var file = folder.createFile(blob);
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    return "https://drive.google.com/uc?export=view&id=" + file.getId();
  } catch (error) {
    return null;
  }
}

function uploadProfilePhoto(params) {
  try {
    var base64Data = params.base64Data;
    var fileName = params.fileName;
    var mimeType = params.mimeType;
    var folderId = params.folderId;
    var username = params.username;

    if (!base64Data || !fileName || !mimeType || !folderId || !username) {
      throw new Error("Missing required parameters for profile photo upload");
    }

    var fileUrl = uploadFileToDrive(base64Data, fileName, mimeType, folderId);
    if (!fileUrl) throw new Error("Failed to upload file to Google Drive");

    var ss = getSpreadsheet();
    var whatsappSheet = ss.getSheetByName("Whatsapp");
    if (!whatsappSheet) throw new Error("WhatsApp sheet not found");

    var values = whatsappSheet.getDataRange().getDisplayValues();
    var rowToUpdate = -1;

    for (var i = 1; i < values.length; i++) {
      if (values[i][2] && values[i][2].toString().toLowerCase() === username.toLowerCase()) {
        rowToUpdate = i + 1;
        break;
      }
    }

    if (rowToUpdate === -1) throw new Error("Username not found in WhatsApp sheet Column C");
    whatsappSheet.getRange(rowToUpdate, 8).setValue(fileUrl);

    return {
      success: true,
      fileUrl: fileUrl,
      message: "Profile photo uploaded and WhatsApp sheet updated successfully"
    };
  } catch (error) {
    return { success: false, error: error.toString() };
  }
}

// ---------------------------------------------------------------------------
// CHECKLIST PROCESSOR
// ---------------------------------------------------------------------------
function processChecklistAndGenerateTasks() {
  try {
    var ss = getSpreadsheet();
    var checklistSheet = ss.getSheetByName("Unique");
    var workingCalendarSheet = ss.getSheetByName("Working Day Calendar");

    if (!checklistSheet) throw new Error("CHECKLIST sheet not found");
    if (!workingCalendarSheet) throw new Error("WORKING DAY CALENDAR sheet not found");

    var checklistData = checklistSheet.getDataRange().getDisplayValues();
    if (checklistData.length < 2) throw new Error("Checklist sheet is empty");

    var today = new Date();
    var todayString = Utilities.formatDate(today, Session.getScriptTimeZone(), "dd/MM/yyyy");

    var calendarData = workingCalendarSheet.getDataRange().getDisplayValues();
    var workingDates = [];

    for (var i = 1; i < calendarData.length; i++) {
      if (calendarData[i][0]) {
        workingDates.push(calendarData[i][0].toString().trim());
      }
    }

    var isTodayWorkingDay = workingDates.includes(todayString);
    var tasksGenerated = 0;
    var processedItems = [];
    var departmentRowsToInsert = [];
    var checklistUpdates = [];
    var departmentSheet = ss.getSheetByName("Checklist");

    for (var i = 2; i < checklistData.length; i++) {
      var row = checklistData[i];
      var department = row[2];
      var frequency = row[7];
      var existingTaskId = row[1] || (i + 1);
      var lastGeneratedDate = row[16];

      if (department) {
        if (!departmentSheet) continue;

        var shouldGenerateTask = false;
        var taskDueDate = "";

        if (isTodayWorkingDay) {
          if (!lastGeneratedDate) {
            shouldGenerateTask = true;
            taskDueDate = todayString;
          } else {
            var lastDate = parseDate(lastGeneratedDate);
            if (!lastDate) continue;

            switch (frequency.toLowerCase()) {
              case 'daily':
                if (!isSameDate(today, lastDate)) {
                  shouldGenerateTask = true;
                  taskDueDate = todayString;
                }
                break;
              case 'weekly':
                var daysDifference = Math.floor((today - lastDate) / (1000 * 60 * 60 * 24));
                if (daysDifference >= 7) {
                  shouldGenerateTask = true;
                  taskDueDate = todayString;
                }
                break;
              case 'monthly':
                var day = lastDate.getDate();
                var month = lastDate.getMonth();
                var year = lastDate.getFullYear();
                var nextMonth = month + 1;
                var nextYear = year;
                if (nextMonth > 11) { nextMonth = 0; nextYear++; }
                var nextMonthDate = new Date(nextYear, nextMonth, day);
                if (nextMonthDate.getMonth() !== nextMonth) {
                  nextMonthDate = new Date(nextYear, nextMonth + 1, 0);
                }
                if (isSameDate(today, nextMonthDate)) {
                  shouldGenerateTask = true;
                  taskDueDate = todayString;
                }
                break;
              case 'yearly':
                if (today.getFullYear() !== lastDate.getFullYear()) {
                  shouldGenerateTask = true;
                  taskDueDate = todayString;
                }
                break;
              default:
                break;
            }
          }
        }

        if (shouldGenerateTask && taskDueDate) {
          var taskData = [
            new Date().toLocaleString("en-IN", { timeZone: "Asia/Kolkata" }),
            "",
            row[2] || "",
            row[3] || "",
            row[4] || "",
            row[5] || "",
            taskDueDate,
            row[7] || "",
            row[8] || "",
            row[9] || ""
          ];

          departmentRowsToInsert.push(taskData);
          checklistUpdates.push({ sheetRow: i + 1, dateValue: taskDueDate });
          tasksGenerated++;
          processedItems.push({
            department: department,
            frequency: frequency,
            taskId: existingTaskId,
            dateGenerated: taskDueDate
          });
        }
      }
    }

    if (departmentRowsToInsert.length > 0) {
      var lastRow = departmentSheet.getLastRow();
      departmentSheet
        .getRange(lastRow + 1, 1, departmentRowsToInsert.length, departmentRowsToInsert[0].length)
        .setValues(departmentRowsToInsert);
    }

    if (checklistUpdates.length > 0) {
      checklistUpdates.forEach(function(update) {
        checklistSheet.getRange(update.sheetRow, 17).setValue(update.dateValue);
      });
    }

    return {
      success: true,
      message: "Checklist processed successfully",
      tasksGenerated: tasksGenerated,
      processedItems: processedItems,
      isTodayWorkingDay: isTodayWorkingDay,
      todayDate: todayString
    };
  } catch (error) {
    return { success: false, error: error.toString() };
  }
}

function parseDate(dateString) {
  try {
    if (!dateString) return null;
    if (dateString instanceof Date) return dateString;
    var parts = dateString.split('/');
    if (parts.length === 3) return new Date(parts[2], parts[1] - 1, parts[0]);
    return null;
  } catch (e) {
    return null;
  }
}

// ---------------------------------------------------------------------------
// NIGHTLY AUTOMATED TASK GENERATION (EVERY NIGHT AT 2:00 AM IST)
// ---------------------------------------------------------------------------

var SUPABASE_URL = "https://fhbkzqgulnlyxubsnegl.supabase.co";
var SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZoYmt6cWd1bG5seXh1YnNuZWdsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODkxMjE1NzYsImV4cCI6MjEwNDY5NzU3Nn0.UqZmR7fD1lNCEVClx4BUQr9MZgO4-JNv0aqrB5dpIeI";

function setupDailyTrigger(hour) {
  try {
    var targetHour = (hour !== undefined && !isNaN(hour)) ? Math.max(0, Math.min(23, parseInt(hour, 10))) : 2;
    var triggers = ScriptApp.getProjectTriggers();
    for (var i = 0; i < triggers.length; i++) {
      var func = triggers[i].getHandlerFunction();
      if (func === 'dailyChecklistProcessor' || func === 'dailyNightlyTaskGenerator') {
        ScriptApp.deleteTrigger(triggers[i]);
      }
    }

    // Schedule every day at targetHour:00 IST (Cloud Cron)
    var trigger = ScriptApp.newTrigger('dailyNightlyTaskGenerator')
      .timeBased()
      .everyDays(1)
      .atHour(targetHour)
      .nearMinute(0)
      .create();

    var ampm = targetHour >= 12 ? 'PM' : 'AM';
    var displayHour = targetHour % 12 === 0 ? 12 : targetHour % 12;
    var timeStr = (displayHour < 10 ? '0' : '') + displayHour + ':00 ' + ampm + ' IST';

    return {
      success: true,
      message: "Daily Task Generation Trigger set up successfully for " + timeStr + "!",
      triggerId: trigger.getUniqueId(),
      scheduledHour: timeStr,
      targetHour: targetHour
    };
  } catch (error) {
    return { success: false, error: error.toString() };
  }
}

function dailyNightlyTaskGenerator() {
  try {
    return processChecklistAndGenerateTasks();
  } catch (error) {
    console.error("Error in nightly task generator:", error);
    return { success: false, error: error.toString() };
  }
}

function dailyChecklistProcessor() {
  return dailyNightlyTaskGenerator();
}

function processChecklistAndGenerateTasks() {
  try {
    var ss = getSpreadsheet();
    var checklistSheet = ss.getSheetByName("Unique");
    var workingCalendarSheet = ss.getSheetByName("Working Day Calendar");
    var holidaySheet = ss.getSheetByName("Holiday List");

    if (!checklistSheet) throw new Error("Unique sheet not found");

    var checklistData = checklistSheet.getDataRange().getDisplayValues();
    if (checklistData.length < 2) throw new Error("Checklist template sheet is empty");

    var today = new Date();
    // Indian Standard Time
    var todayString = Utilities.formatDate(today, "Asia/Kolkata", "dd/MM/yyyy");
    var todayTimestamp = Utilities.formatDate(today, "Asia/Kolkata", "dd/MM/yyyy, HH:mm:ss");

    // 1. Check Working Calendar and Holidays
    var isWorkingDay = true;
    if (holidaySheet) {
      var holidayData = holidaySheet.getDataRange().getDisplayValues();
      for (var h = 1; h < holidayData.length; h++) {
        if (holidayData[h][0] && holidayData[h][0].toString().trim() === todayString) {
          isWorkingDay = false;
          break;
        }
      }
    }

    if (isWorkingDay && workingCalendarSheet) {
      var calData = workingCalendarSheet.getDataRange().getDisplayValues();
      var foundInCal = false;
      for (var c = 1; c < calData.length; c++) {
        if (calData[c][0] && calData[c][0].toString().trim() === todayString) {
          foundInCal = true;
          break;
        }
      }
      if (calData.length > 1 && !foundInCal) {
        isWorkingDay = false;
      }
    }

    if (!isWorkingDay) {
      return {
        success: true,
        message: "Today (" + todayString + ") is marked as a Holiday / Non-working day. No tasks generated.",
        tasksGenerated: 0,
        isTodayWorkingDay: false,
        todayDate: todayString
      };
    }

    var tasksGenerated = 0;
    var supabaseTasksToInsert = [];
    var sheetRowsToInsert = [];
    var templateUpdates = [];

    // Header in Unique: [Timestamp, Task ID, Department, Given By, Name, Task Description, Start Date, Frequency, Enable Reminders, Require Attachment, ..., Last Date (Col 17)]
    for (var i = 1; i < checklistData.length; i++) {
      var row = checklistData[i];
      var taskId = row[1] || "";
      var department = row[2] || "";
      var givenBy = row[3] || "";
      var name = row[4] || "";
      var taskDesc = row[5] || "";
      var startDate = row[6] || "";
      var frequency = (row[7] || "daily").toLowerCase().trim();
      var enableReminders = row[8] || "Yes";
      var requireAttachment = row[9] || "No";
      var lastDateStr = row[16] || ""; // Column Q

      if (!name || !taskDesc) continue;

      var shouldGenerate = false;
      if (!lastDateStr || lastDateStr.trim() === '') {
        shouldGenerate = true;
      } else {
        var lastDate = parseDate(lastDateStr);
        if (!lastDate) {
          shouldGenerate = true;
        } else {
          switch (frequency) {
            case 'daily':
              if (!isSameDate(today, lastDate)) shouldGenerate = true;
              break;
            case 'weekly':
              var daysDiff = Math.floor((today - lastDate) / (1000 * 60 * 60 * 24));
              if (daysDiff >= 7) shouldGenerate = true;
              break;
            case 'monthly':
              var nextMonthDate = new Date(lastDate.getFullYear(), lastDate.getMonth() + 1, lastDate.getDate());
              if (isSameDate(today, nextMonthDate) || today >= nextMonthDate) shouldGenerate = true;
              break;
            case 'yearly':
              if (today.getFullYear() !== lastDate.getFullYear()) shouldGenerate = true;
              break;
            default:
              if (!isSameDate(today, lastDate)) shouldGenerate = true;
              break;
          }
        }
      }

      if (shouldGenerate) {
        tasksGenerated++;

        // For Google Sheet
        sheetRowsToInsert.push([
          todayTimestamp,
          taskId,
          department,
          givenBy,
          name,
          taskDesc,
          todayString,
          frequency,
          enableReminders,
          requireAttachment,
          "", "", "", "", "", "", ""
        ]);

        // For Supabase
        supabaseTasksToInsert.push({
          "Timestamp": todayTimestamp,
          "Department": department,
          "Given By": givenBy,
          "Name": name,
          "Tast Descriptions": taskDesc,
          "Task Start Date": todayString,
          "Freq": frequency,
          "Enable Reminders": enableReminders,
          "Require Attachment": requireAttachment,
          "Actual": "",
          "Delay": "",
          "Status": "",
          "Remarks": "",
          "Uploaded Image": "",
          "Admin Done": "",
          "Leave": ""
        });

        templateUpdates.push({
          sheetRow: i + 1,
          taskId: taskId,
          newLastDate: todayString
        });
      }
    }

    // 2. Insert into Google Sheet Checklist
    var departmentSheet = ss.getSheetByName("Checklist");
    if (departmentSheet && sheetRowsToInsert.length > 0) {
      var lastRow = departmentSheet.getLastRow();
      departmentSheet.getRange(lastRow + 1, 1, sheetRowsToInsert.length, sheetRowsToInsert[0].length).setValues(sheetRowsToInsert);
    }

    // 3. Update Last Date in Google Sheet Unique
    if (templateUpdates.length > 0) {
      templateUpdates.forEach(function(u) {
        checklistSheet.getRange(u.sheetRow, 17).setValue(u.newLastDate);
      });
    }

    // 4. Insert into Supabase directly via REST API
    if (supabaseTasksToInsert.length > 0) {
      try {
        var supabaseBatchSize = 100;
        for (var b = 0; b < supabaseTasksToInsert.length; b += supabaseBatchSize) {
          var chunk = supabaseTasksToInsert.slice(b, b + supabaseBatchSize);
          UrlFetchApp.fetch(SUPABASE_URL + "/rest/v1/Checklist", {
            method: "post",
            headers: {
              "apikey": SUPABASE_KEY,
              "Authorization": "Bearer " + SUPABASE_KEY,
              "Content-Type": "application/json",
              "Prefer": "return=minimal"
            },
            payload: JSON.stringify(chunk),
            muteHttpExceptions: true
          });
        }

        // Update Last Date in Supabase Unique table
        templateUpdates.forEach(function(u) {
          if (u.taskId) {
            UrlFetchApp.fetch(SUPABASE_URL + "/rest/v1/Unique?Task%20ID=eq." + encodeURIComponent(u.taskId), {
              method: "patch",
              headers: {
                "apikey": SUPABASE_KEY,
                "Authorization": "Bearer " + SUPABASE_KEY,
                "Content-Type": "application/json"
              },
              payload: JSON.stringify({ "Last Date": u.newLastDate }),
              muteHttpExceptions: true
            });
          }
        });
      } catch (sbErr) {
        console.warn("Supabase direct REST push warning:", sbErr);
      }
    }

    return {
      success: true,
      message: "Nightly task generation completed successfully!",
      tasksGenerated: tasksGenerated,
      todayDate: todayString,
      isTodayWorkingDay: true
    };

  } catch (error) {
    console.error("Error in processChecklistAndGenerateTasks:", error);
    return { success: false, error: error.toString() };
  }
}

function parseDate(dateString) {
  try {
    if (!dateString) return null;
    if (dateString instanceof Date) return dateString;
    var parts = dateString.split('/');
    if (parts.length === 3) return new Date(parts[2], parts[1] - 1, parts[0]);
    return null;
  } catch (e) {
    return null;
  }
}

function isSameDate(date1, date2) {
  return date1.getDate() === date2.getDate() &&
    date1.getMonth() === date2.getMonth() &&
    date1.getFullYear() === date2.getFullYear();
}

