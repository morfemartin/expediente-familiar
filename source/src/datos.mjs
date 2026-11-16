// Fichas y folios simulados para la demo del portfolio.
export const sitio = {
  referencia: "Edición de demostración",
  descripcion: "Es posible recorrer un expediente documental, ampliar un folio y consultar su transcripción con esta edición de prueba.",
  subtitulo: "Archivo documental",
  despedida: "Demostración",
  lugares: "Archivo de muestra",
  fuentes: "Contenido y folio de demostración",
  contacto: {
    nombre: "Archivo de muestra",
    correo: "archivo@example.invalid",
  },
};

export const cadena = [
  { n: "Primera generación", d: "Folio de nacimiento · Registro de muestra" },
  { n: "Segunda generación", d: "Referencia cruzada · Nota de archivo" },
];

export const actas = [
  {
    id: "D01",
    gen: "Primera generación",
    titulo: "Acta de nacimiento de muestra",
    fecha: "06-08-1901",
    lugar: "Municipio de muestra",
    ref: "Folio de demostración n.º 1",
    prueba: "Ejemplo de lectura y cotejo entre el folio y la transcripción.",
    estado: "muestra",
    texto: "En el registro de muestra se deja constancia de la inscripción del seis de agosto de mil novecientos uno. La anotación marginal remite al cuaderno segundo.",
    imgs: [{ file: "folio-demo.jpg", label: "Folio de demostración" }],
    destacar: ["La anotación marginal remite al cuaderno segundo."],
  },
];

export const notaDocumental = {
  id: "N01",
  titulo: "Referencia al cuaderno segundo",
  fecha: "1901",
  lugar: "Archivo de muestra",
  ref: "Nota marginal",
  estado: "muestra",
  texto: "La nota al margen remite al cuaderno segundo del mismo registro. Esta ficha muestra cómo documentar una referencia cruzada.",
  imgs: [{ file: "folio-demo.jpg", label: "Folio de referencia" }],
};

export const pendientes = [
  "Cotejar la nota marginal con el índice del cuaderno segundo.",
];
