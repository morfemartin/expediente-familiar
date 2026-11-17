// Optional visit logger. Set the destination in the script properties.

function cellText(value, limit) {
  const text = typeof value === "string" ? value.trim().slice(0, limit) : "";
  return /^[=+@-]/.test(text) ? "'" + text : text;
}

function doPost(event) {
  let data;
  try {
    data = JSON.parse(event.postData.contents);
  } catch (_) {
    return ContentService.createTextOutput("invalid data");
  }

  const name = cellText(data && data.nombre, 80);
  if (!name) return ContentService.createTextOutput("missing name");

  const properties = PropertiesService.getScriptProperties();
  const spreadsheetId = properties.getProperty("SPREADSHEET_ID");
  const sheetId = properties.getProperty("SHEET_ID");
  if (!spreadsheetId || !sheetId) throw new Error("Set SPREADSHEET_ID and SHEET_ID");
  const sheet = SpreadsheetApp.openById(spreadsheetId).getSheetById(Number(sheetId));
  if (!sheet) throw new Error("Visit log sheet not found");

  sheet.appendRow([
    new Date(),
    name,
    cellText(data.navegador, 200),
    cellText(data.pantalla, 20),
    cellText(data.idioma, 20),
  ]);
  return ContentService.createTextOutput("ok");
}
