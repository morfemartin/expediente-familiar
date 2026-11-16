// Receptor opcional de visitas. Configura el destino en las propiedades del script.

function textoParaCelda(valor, maximo) {
  const texto = typeof valor === "string" ? valor.trim().slice(0, maximo) : "";
  return /^[=+@-]/.test(texto) ? "'" + texto : texto;
}

function doPost(e) {
  let datos;
  try {
    datos = JSON.parse(e.postData.contents);
  } catch (_) {
    return ContentService.createTextOutput("datos inválidos");
  }

  const nombre = textoParaCelda(datos && datos.nombre, 80);
  if (!nombre) return ContentService.createTextOutput("sin nombre");

  const propiedades = PropertiesService.getScriptProperties();
  const libro = propiedades.getProperty("SPREADSHEET_ID");
  const pestaña = propiedades.getProperty("SHEET_ID");
  if (!libro || !pestaña) throw new Error("Configura SPREADSHEET_ID y SHEET_ID");
  const hoja = SpreadsheetApp.openById(libro).getSheetById(Number(pestaña));
  if (!hoja) throw new Error("No se encontró la pestaña de registro");

  hoja.appendRow([
    new Date(),
    nombre,
    textoParaCelda(datos.navegador, 200),
    textoParaCelda(datos.pantalla, 20),
    textoParaCelda(datos.idioma, 20),
  ]);
  return ContentService.createTextOutput("ok");
}
