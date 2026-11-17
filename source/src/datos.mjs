// Fictional records and folios for the portfolio demo.
export const sitio = {
  referencia: "Demo edition",
  descripcion: "Browse a sample archive, zoom in on a folio, and compare it with its transcription.",
  subtitulo: "Family records",
  despedida: "Demo edition",
  lugares: "Sample archive",
  fuentes: "Fictional records and folio",
  contacto: {
    nombre: "Sample archive",
    correo: "archive@example.invalid",
  },
};

export const cadena = [
  { n: "First generation", d: "Birth folio · Sample register" },
  { n: "Second generation", d: "Cross-reference · Archive note" },
];

export const actas = [
  {
    id: "D01",
    gen: "First generation",
    titulo: "Sample birth record",
    fecha: "6 August 1901",
    lugar: "Sample municipality",
    ref: "Sample folio no. 1",
    prueba: "Compare this page of the register with its transcription.",
    estado: "muestra",
    texto: "The sample register records the entry on 6 August 1901. The marginal note refers to the second volume.",
    imgs: [{ file: "folio-demo.jpg", label: "Sample folio" }],
    destacar: ["The marginal note refers to the second volume."],
  },
];

export const notaDocumental = {
  id: "N01",
  titulo: "Reference to the second volume",
  fecha: "1901",
  lugar: "Sample archive",
  ref: "Marginal note",
  estado: "muestra",
  texto: "The marginal note points to the second volume of the same register.",
  imgs: [{ file: "folio-demo.jpg", label: "Reference folio" }],
};

export const pendientes = [
  "Compare the marginal note with the index of the second volume.",
];
