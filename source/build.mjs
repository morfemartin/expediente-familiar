// Construye web/dist: página editorial con contenido e imágenes cifradas
// (AES-256-GCM, clave derivada con PBKDF2-SHA256 600k). Sin dependencias.
// Uso: node build.mjs                 (clave de .clave o nueva)
//      CLAVE="nueva" node build.mjs   (cambia la clave)
// Registro de visitas: la URL /exec del Apps Script va en .registro_url
import { readFileSync, writeFileSync, existsSync, mkdirSync, rmSync } from "node:fs";
import { randomBytes, webcrypto } from "node:crypto";
import { fileURLToPath } from "node:url";
import { sitio, cadena, actas, notaDocumental, pendientes } from "./src/datos.mjs";

const here = fileURLToPath(new URL(".", import.meta.url));
const FOLIOS = here + "../fuentes/familysearch/";
const FOTOS = here + "src/img/";
const subtle = webcrypto.subtle;
const ITER = 600000;

// ---------- clave ----------
let clave = process.env.CLAVE;
if (!clave && existsSync(here + ".clave")) clave = readFileSync(here + ".clave", "utf8").trim();
if (!clave) {
  const abc = "abcdefghjkmnpqrstuvwxyz23456789";
  const b = randomBytes(12);
  clave = [0, 4, 8].map((o) => [...b.subarray(o, o + 4)].map((x) => abc[x % abc.length]).join("")).join("-");
}
writeFileSync(here + ".clave", clave + "\n", { mode: 0o600 });
const REG = existsSync(here + ".registro_url") ? readFileSync(here + ".registro_url", "utf8").trim() : "";

const enc = new TextEncoder();
const salt = randomBytes(16);
const base = await subtle.importKey("raw", enc.encode(clave), "PBKDF2", false, ["deriveKey"]);
const key = await subtle.deriveKey({ name: "PBKDF2", salt, iterations: ITER, hash: "SHA-256" }, base, { name: "AES-GCM", length: 256 }, false, ["encrypt"]);
const cifrar = async (buf) => { const iv = randomBytes(12); const ct = Buffer.from(await subtle.encrypt({ name: "AES-GCM", iv }, key, buf)); return { iv: iv.toString("base64"), ct }; };

rmSync(here + "dist/f", { recursive: true, force: true });
mkdirSync(here + "dist/f", { recursive: true });

// ---------- imágenes cifradas ----------
const imagenes = {}; // id -> {f, i, n}
let nImg = 0;
async function registrarImg(ruta, nombreDescarga) {
  const { iv, ct } = await cifrar(readFileSync(ruta));
  const id = "i" + String(++nImg).padStart(2, "0");
  writeFileSync(here + `dist/f/${id}.bin`, ct);
  imagenes[id] = { f: `f/${id}.bin`, i: iv, n: nombreDescarga };
  return id;
}

// ---------- texto ----------
const esc = (t) => String(t).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
function resaltar(texto, frases = []) {
  let h = esc(texto);
  for (const f of frases) { const e = esc(f); h = h.split(e).join(`<mark>${e}</mark>`); }
  return h.split("\n\n").map((p) => `<p>${p}</p>`).join("");
}
const ETQ = {
  literal: "Transcripción leída en la imagen",
  auto: "Transcripción automática de FamilySearch, revisada · correcciones entre [ ]",
  indice: "Índice de FamilySearch",
  muestra: "Transcripción de demostración",
};
const romanos = ["I", "II", "III", "IV"];

async function figura(a) {
  const lista = a.folio ? [{ ruta: FOLIOS + a.folio, label: a.marcas ? "Folio completo · resaltado" : "Folio completo", marcas: a.marcas }] : (a.imgs || []).map((im) => ({ ruta: FOTOS + im.file, label: im.label }));
  if (!lista.length) return `<div class="fig vacia"><span>Sin imagen publicada</span><small>Contiene datos de personas vivas</small></div>`;
  let h = "";
  for (const [n, im] of lista.entries()) {
    const id = await registrarImg(im.ruta, `${a.id}_${n + 1}.jpg`);
    const mk = im.marcas ? ` data-marcas="${esc(JSON.stringify(im.marcas))}"` : "";
    h += `<figure class="fig" data-img="${id}"${mk} tabindex="0" role="button" aria-label="Ampliar ${esc(a.titulo)} — ${esc(im.label)}"><div class="ph"><span>Descifrando…</span></div><figcaption><span>${esc(im.label)}</span><span class="zoom">Ampliar ↗</span></figcaption></figure>`;
  }
  return `<div class="figs">${h}</div>`;
}

async function articulo(a, { esNota = false } = {}) {
  return `
<article class="acta${esNota ? " acta-nota" : ""}" id="${a.id}">
  ${esNota ? "" : `<div class="acta-num"><span>${a.id}</span></div>`}
  <div class="acta-cuerpo">
    <header>
      ${a.gen ? `<p class="kicker">${esc(a.gen)}</p>` : ""}
      <h3>${esc(a.titulo)}</h3>
      <dl class="meta">
        <div><dt>Fecha</dt><dd>${esc(a.fecha)}</dd></div>
        <div><dt>Lugar</dt><dd>${esc(a.lugar)}</dd></div>
        ${a.ref ? `<div><dt>Registro</dt><dd>${esc(a.ref)}</dd></div>` : ""}
      </dl>
      ${a.prueba ? `<p class="prueba">${esc(a.prueba)}</p>` : ""}
      ${a.nota ? `<p class="prueba">${esc(a.nota)}</p>` : ""}
    </header>
    <div class="acta-grid">
      ${await figura(a)}
      <div class="tx">
        <p class="txh">${ETQ[a.estado] || ""}</p>
        <div class="txt${/^[…\[(.]/.test(a.texto) ? " sin" : ""}">${resaltar(a.texto, a.destacar)}</div>
        ${a.fs ? `<a class="enlace" href="${a.fs}" target="_blank" rel="noopener">Ver en FamilySearch ↗</a>` : ""}
      </div>
    </div>
  </div>
</article>`;
}

const firma = readFileSync(here + "src/marca/firma.svg", "utf8")
  .replace(/<\?xml[^>]*>\s*/, "").replace(/<defs>[\s\S]*?<\/defs>/, "")
  .replace(/ class="cls-1"/g, "").replace(/<svg /, '<svg class="firma" aria-label="Carballo" role="img" fill="currentColor" preserveAspectRatio="xMidYMid meet" ');

const morfe64 = "data:image/svg+xml;base64," + readFileSync(here + "src/marca/logo_morfe.svg").toString("base64");

let actasHtml = "";
for (const a of actas) actasHtml += await articulo(a);
const notaHtml = await articulo(notaDocumental, { esNota: true });
const { contacto } = sitio;
const contactoHtml = contacto ? `
    <address class="pie-contacto">
      <p class="caps pie-rotulo">Contacto</p>
      <p class="pie-nombre">${esc(contacto.nombre)}</p>
      ${contacto.correo ? `<a href="mailto:${esc(contacto.correo)}">${esc(contacto.correo)}</a>` : ""}
      ${contacto.telefono ? `<a href="tel:${contacto.telefono.replace(/[^+0-9]/g, "")}">${esc(contacto.telefono)}</a>` : ""}
    </address>` : "";

const contenido = `
<header class="mast">
  <div class="mast-top"><span>Expediente privado</span><span>${esc(sitio.referencia)}</span><span>Consultado por <b id="quien"></b></span></div>
  <div class="mast-logo"><img class="logo" src="carballo.webp" alt="Carballo" width="1500" height="531" decoding="async"></div>
  <p class="deck">${esc(sitio.descripcion)}</p>
  <nav class="indice">${["La cadena", "Las actas", "Nota documental", "Pendientes"].map((t, i) => `<a href="#s${i + 1}"><i>${romanos[i]}</i>${t}</a>`).join("")}</nav>
</header>

<section id="s1" class="sec">
  <h2><i>I</i>La cadena</h2>
  <ol class="cadena">${cadena.map((c, i) => `<li><span class="g">${String(i + 1).padStart(2, "0")}</span><div><strong>${esc(c.n)}</strong><em>${esc(c.d)}</em></div></li>`).join("")}</ol>
</section>

<section id="s2" class="sec">
  <h2><i>II</i>Las actas</h2>
  <p class="leyenda"><mark>Resaltado</mark> = lo esencial de cada acta. Toca la imagen para ampliarla y descargarla.</p>
  ${actasHtml}
</section>

<section id="s3" class="sec">
  <h2><i>III</i>Nota documental</h2>
  ${notaHtml}
</section>

<section id="s4" class="sec">
  <h2><i>IV</i>Pendientes</h2>
  <ul class="pend">${pendientes.map((p) => `<li>${esc(p)}</li>`).join("")}</ul>
</section>

<footer class="pie">
  <div class="pie-datos">
    ${contactoHtml}
    <div class="pie-creditos">
      <div class="pie-desarrollo">
        <img class="pie-morfe" src="${morfe64}" alt="Logo de Morfe Estudio">
        <div>
          <p class="caps pie-rotulo">Desarrollado por Morfe Estudio</p>
          <p class="pie-autor">Martin Alejandro Morfe Carballo</p>
        </div>
      </div>
      <div class="pie-enlaces">
        <a href="https://morfe.studio/" target="_blank" rel="noopener noreferrer">morfe.studio <span aria-hidden="true">↗</span></a>
        <a href="https://github.com/morfemartin/expediente-familiar" target="_blank" rel="noopener noreferrer">Repositorio en GitHub <span aria-hidden="true">↗</span></a>
      </div>
    </div>
  </div>
  <div class="pie-ficha">
    <span>Documento de trabajo, no oficial</span>
    <span>Actualizado ${new Date().toISOString().slice(0, 10)}</span>
    <span>${esc(sitio.fuentes)}</span>
  </div>
  <img class="pie-carballo" src="carballo-claro.webp" alt="Carballo" width="1500" height="531" loading="lazy" decoding="async">
</footer>`;

const iv = randomBytes(12);
const ct = Buffer.from(await subtle.encrypt({ name: "AES-GCM", iv }, key, enc.encode(JSON.stringify({ html: contenido, img: imagenes, registro: REG }))));
const payload = {
  s: salt.toString("base64"),
  i: iv.toString("base64"),
  n: ITER,
  f: `f/expediente-${salt.toString("hex")}.bin`,
};

// ---------- página ----------
const page = `<!doctype html>
<html lang="es"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex,nofollow"><title>Carballo</title>
<link rel="icon" type="image/png" sizes="64x64" href="favicon.png">
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,500;0,600;1,400;1,500&family=Inter:wght@400;500;600&display=swap" rel="stylesheet" media="print" onload="this.media='all'">
<style>
:root{--paper:#f1efe9;--paper2:#e8e5dd;--ink:#1b1b19;--muted:#6d6b64;--rule:#1b1b19;--marker:rgba(234,193,8,.42);--red:#b3302b;--serif:"Cormorant Garamond",Garamond,"Times New Roman",serif;--sans:Inter,-apple-system,"Helvetica Neue",Arial,sans-serif}
*{box-sizing:border-box}html{scroll-behavior:smooth;-webkit-text-size-adjust:100%}
body{margin:0;font-variant-numeric:lining-nums;background:var(--ink);color:var(--ink);font-family:var(--serif);font-size:19px;line-height:1.5}
.caps{font-family:var(--sans);text-transform:uppercase;letter-spacing:.12em;font-size:11px}
mark{background:linear-gradient(transparent 12%,var(--marker) 12%,var(--marker) 88%,transparent 88%);color:inherit;padding:0 .08em;-webkit-box-decoration-break:clone;box-decoration-break:clone}

/* ---------- portada / acceso ---------- */
.marco{min-height:100vh;padding:clamp(14px,3.2vw,44px)}
.hoja{position:relative;min-height:calc(100vh - 2*clamp(14px,3.2vw,44px));background:var(--paper);overflow:hidden;display:flex;flex-direction:column}
#lock .firma{position:absolute;left:-6%;right:-14%;bottom:-6%;width:120%;height:auto;color:var(--ink);pointer-events:none}
.escudo-esq{position:absolute;z-index:2;top:clamp(24px,5vw,72px);right:clamp(24px,5vw,72px);width:clamp(44px,5vw,72px);height:auto}
.portada{position:relative;z-index:1;padding:clamp(28px,6vw,80px);max-width:560px}
.portada .caps{color:var(--ink)}
.portada h1{font-weight:400;font-size:clamp(46px,7.4vw,96px);line-height:.95;margin:22px 0 4px;letter-spacing:-.01em}
.portada h1 em{display:block;font-style:italic;font-weight:400}
.portada h1 small{display:block;font-family:var(--sans);font-size:clamp(13px,1.3vw,16px);letter-spacing:.24em;text-transform:uppercase;margin-top:18px}
form{margin-top:34px;display:grid;gap:12px;max-width:360px}
label{display:grid;gap:6px}
input{font:inherit;font-size:20px;padding:10px 0;border:0;border-bottom:1.5px solid var(--ink);background:transparent;color:var(--ink);border-radius:0;outline:none}
input:focus{border-bottom-width:2.5px}
button{justify-self:start;margin-top:8px;font-family:var(--sans);text-transform:uppercase;letter-spacing:.16em;font-size:12px;font-weight:600;padding:13px 26px;border:1.5px solid var(--ink);background:var(--ink);color:var(--paper);cursor:pointer}
button:hover{background:transparent;color:var(--ink)}
.campo-clave{display:grid;gap:6px}
.control-clave{display:grid;grid-template-columns:minmax(0,1fr) auto}
.control-clave input{width:100%;min-width:0}
.control-clave button{align-self:stretch;min-width:78px;min-height:44px;margin:0;padding:0 0 0 10px;border:0;border-bottom:1.5px solid var(--ink);background:transparent;color:var(--ink);font-size:11px;letter-spacing:.08em;text-align:right}
.control-clave button:hover{text-decoration:underline;text-underline-offset:3px}
.control-clave button:focus-visible{outline:2px solid var(--ink);outline-offset:3px}
#err{min-height:22px;font-family:var(--sans);font-size:13px;color:var(--red)}
.franja span{background:var(--paper);padding:3px 6px;margin:-3px -6px}
.franja{position:relative;z-index:1;margin-top:auto;display:flex;justify-content:space-between;gap:14px;flex-wrap:wrap;padding:18px clamp(28px,6vw,80px);font-family:var(--sans);text-transform:uppercase;letter-spacing:.12em;font-size:10.5px}

/* ---------- contenido ---------- */
#app .hoja{--margen-x:clamp(18px,6vw,96px);--margen-y:clamp(22px,5vw,72px);padding:var(--margen-y) var(--margen-x)}
.mast-top{display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap;font-family:var(--sans);text-transform:uppercase;letter-spacing:.12em;font-size:10.5px;border-bottom:1px solid var(--rule);padding-bottom:12px}
.mast-logo{display:flex;align-items:flex-end;justify-content:center;gap:clamp(10px,3vw,40px);margin:clamp(30px,6vw,70px) auto 10px;max-width:980px}
.mast-logo .logo{width:min(100%,880px);height:auto;display:block}
.mast h1{text-align:center;font-weight:400;font-size:clamp(40px,7vw,92px);line-height:1;margin:18px 0 0;letter-spacing:-.01em}
.mast h1 em{font-style:italic}
.deck{text-align:center;font-style:italic;font-size:clamp(19px,2vw,23px);max-width:720px;margin:18px auto 0;color:#33322e}
.indice{display:flex;justify-content:center;flex-wrap:wrap;gap:6px 28px;margin:34px 0 0;padding:14px 0;border-top:1px solid var(--rule);border-bottom:1px solid var(--rule);position:sticky;top:0;background:var(--paper);z-index:5}
.indice a{color:var(--ink);text-decoration:none;font-family:var(--sans);text-transform:uppercase;letter-spacing:.12em;font-size:11px}
.indice a i{font-family:var(--serif);font-style:italic;font-size:16px;letter-spacing:0;margin-right:6px;text-transform:none}
.sec{margin-top:clamp(56px,8vw,110px)}
.sec h2{font-weight:400;font-size:clamp(34px,5vw,62px);line-height:1;margin:0 0 10px;padding-bottom:16px;border-bottom:3px solid var(--rule);display:flex;align-items:baseline;gap:18px}
.sec h2 i{font-size:.55em;font-style:italic}
.leyenda{font-family:var(--sans);font-size:13px;color:var(--muted);margin:10px 0 0}

.cadena{list-style:none;margin:30px 0 0;padding:0;display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:0;border-left:1px solid var(--rule)}
.cadena li{display:flex;gap:14px;padding:18px 18px 22px;border-right:1px solid var(--rule);border-bottom:1px solid var(--rule)}
.cadena .g{font-family:var(--sans);font-size:11px;letter-spacing:.1em;padding-top:6px}
.cadena strong{display:block;font-weight:500;font-size:24px;line-height:1.15}
.cadena em{display:block;color:var(--muted);font-size:17px;margin-top:4px}

.acta{display:grid;grid-template-columns:110px 1fr;gap:0 28px;padding:44px 0;border-bottom:1px solid var(--rule)}
.acta-num span{font-size:46px;font-style:italic;line-height:1;font-variant-numeric:lining-nums}
.figs{position:sticky;top:70px}
.acta-nota{grid-template-columns:minmax(0,1fr);padding-top:24px}
.kicker{font-family:var(--sans);text-transform:uppercase;letter-spacing:.14em;font-size:11px;margin:0;color:var(--muted)}
.acta h3{font-weight:500;font-size:clamp(26px,3vw,36px);line-height:1.1;margin:6px 0 14px}
.meta{display:flex;flex-wrap:wrap;gap:6px 30px;margin:0 0 14px}
.meta dt{font-family:var(--sans);text-transform:uppercase;letter-spacing:.12em;font-size:10px;color:var(--muted)}
.meta dd{margin:2px 0 0;font-size:18px}
.prueba{font-style:italic;font-size:20px;margin:0 0 6px;max-width:760px}
.acta-grid{display:grid;grid-template-columns:minmax(0,1.1fr) minmax(0,1fr);gap:30px;margin-top:22px;align-items:start}
.figs{display:grid;gap:14px}
.fig{margin:0;cursor:zoom-in;outline:none}
.fig .ph{position:relative;aspect-ratio:1.42;background:var(--paper2);display:grid;place-items:center;overflow:hidden;border:1px solid #cfccc3}
.fig .ph span{font-family:var(--sans);font-size:11px;letter-spacing:.12em;text-transform:uppercase;color:var(--muted)}
.mk{position:absolute;background:rgba(234,193,8,.5);mix-blend-mode:multiply;border-radius:2px;pointer-events:none}
.fig img{width:100%;height:100%;object-fit:contain;display:block;filter:grayscale(1) contrast(1.05);transition:filter .3s,transform .4s}
.fig:hover img,.fig:focus img{filter:none;transform:scale(1.015)}
.fig figcaption{display:flex;justify-content:space-between;font-family:var(--sans);text-transform:uppercase;letter-spacing:.12em;font-size:10px;padding-top:8px}
.fig.vacia{display:grid;place-items:center;align-content:center;gap:6px;aspect-ratio:1.42;border:1px dashed #b9b6ad;font-family:var(--sans);font-size:11px;text-transform:uppercase;letter-spacing:.12em;color:var(--muted);cursor:default}
.tx .txh{font-family:var(--sans);text-transform:uppercase;letter-spacing:.12em;font-size:10px;color:var(--muted);margin:0 0 10px;padding-bottom:8px;border-bottom:1px solid #cfccc3}
.txt{font-size:18px;line-height:1.6;hyphens:manual}
.txt p{margin:0 0 12px}
.acta:not(.acta-nota) .txt:not(.sin)>p:first-child::first-letter{float:left;font-size:3.4em;line-height:.85;padding:4px 8px 0 0;font-weight:500}
.enlace{display:inline-block;margin-top:6px;font-family:var(--sans);text-transform:uppercase;letter-spacing:.12em;font-size:11px;color:var(--ink);border-bottom:1px solid var(--ink);text-decoration:none;padding-bottom:2px}
.pend{margin:24px 0 0;padding-left:1.2em;font-size:21px}.pend li{margin:10px 0}

/* ---------- pie del expediente ---------- */
.pie{
  --pie-regla:#5b554c;
  --pie-suave:#cdc5b8;
  display:grid;
  grid-template-columns:minmax(0,55fr) minmax(0,45fr);
  grid-template-areas:"marca datos" "ficha ficha";
  align-items:center;
  gap:clamp(26px,4.5vw,64px);
  margin:clamp(58px,8vw,110px) calc(0px - var(--margen-x)) calc(0px - var(--margen-y));
  padding:clamp(38px,6.2vw,90px) var(--margen-x) 20px;
  background:var(--ink);
  color:var(--paper);
}
.pie-carballo{grid-area:marca;display:block;width:100%;height:auto}
.pie-datos{grid-area:datos;min-width:0;border-left:1px solid var(--pie-regla);padding-left:clamp(24px,4vw,62px)}
.pie-contacto{font-style:normal}
.pie-rotulo{margin:0;color:var(--pie-suave)}
.pie-nombre{margin:3px 0 10px;font-size:clamp(32px,3.8vw,50px);font-weight:500;line-height:1;white-space:normal}
.pie-contacto a,.pie-enlaces a{color:inherit;font-family:var(--sans);font-size:14px;text-underline-offset:4px;text-decoration-color:var(--pie-regla);overflow-wrap:anywhere}
.pie-contacto a{display:block;width:fit-content;margin-top:7px}
.pie a:hover{text-decoration-color:currentColor}
.pie a:focus-visible{outline:1px solid currentColor;outline-offset:5px}
.pie-creditos{display:grid;gap:18px;margin-top:26px;padding-top:24px;border-top:1px solid var(--pie-regla)}
.pie-desarrollo{display:flex;align-items:center;gap:clamp(15px,3vw,36px);min-width:0}
.pie-morfe{display:block;width:clamp(68px,10vw,116px);height:auto;flex:none}
.pie-autor{margin:2px 0 0;font-size:21px;line-height:1.2}
.pie-enlaces{display:flex;flex-wrap:wrap;gap:8px 22px}
.pie-enlaces span{display:inline-block;margin-left:3px}
.pie-ficha{grid-area:ficha;display:flex;justify-content:space-between;gap:8px 22px;flex-wrap:wrap;padding-top:16px;border-top:1px solid var(--pie-regla);color:var(--pie-suave);font-family:var(--sans);font-size:10px;letter-spacing:.055em}

/* ---------- visor ---------- */
#visor{position:fixed;inset:0;background:rgba(20,20,18,.97);z-index:50;display:none;touch-action:none}
#visor.on{display:block}
#vwrap{position:absolute;left:0;top:0;transform-origin:0 0}
#vwrap img{display:block;user-select:none;-webkit-user-drag:none;max-width:none}
#visor{background:#141412}
.vbar{z-index:2;position:absolute;left:0;right:0;bottom:0;display:flex;justify-content:center;gap:8px;padding:14px;flex-wrap:wrap;background:linear-gradient(transparent,rgba(0,0,0,.6))}
.vbar button,.vbar a{margin:0;font-family:var(--sans);text-transform:uppercase;letter-spacing:.12em;font-size:11px;font-weight:600;padding:11px 16px;border:1px solid #f1efe9;background:transparent;color:#f1efe9;text-decoration:none;cursor:pointer}
.vtit{z-index:2;position:absolute;top:0;left:0;right:0;padding:14px 18px;color:#f1efe9;font-family:var(--sans);text-transform:uppercase;letter-spacing:.12em;font-size:11px;background:linear-gradient(rgba(0,0,0,.6),transparent)}

@media (max-width:820px){
  body{font-size:18px}
  .acta{grid-template-columns:1fr;padding:34px 0}
  .acta-num span{font-size:34px}
  .acta-nota{padding-top:24px}
  .pie{grid-template-columns:minmax(0,1fr);grid-template-areas:"datos" "ficha" "marca";row-gap:24px;padding-bottom:clamp(26px,7vw,52px)}
  .pie-datos{border-left:0;padding-left:0}
  .pie-carballo{width:calc(100% + 24px);margin:6px -12px 0}
  .acta-grid{grid-template-columns:1fr}
  #lock .hoja{min-height:calc(100svh - 28px)}
  #lock .firma{width:265%;left:-58%;right:auto;bottom:5.5%;transform:rotate(-7deg);transform-origin:left bottom}
  .portada{padding:34px 26px 0}
  .portada .caps{padding-right:64px}
  .portada h1{font-size:58px;margin-top:16px}
  form{margin-top:20px;gap:6px}
  .franja{padding:14px 26px;gap:6px 14px}
  .franja{font-size:9.5px}
  .escudo-esq{width:46px}
}
@media print{body{background:#fff}.marco{padding:0}.indice,#visor,.enlace{display:none}.acta,.pie{break-inside:avoid}.pie{print-color-adjust:exact;-webkit-print-color-adjust:exact}}
</style></head>
<body>
<div id="lock" class="marco"><div class="hoja">
  ${firma}
  <img class="escudo-esq" src="escudo-portada.webp" alt="Escudo" width="83" height="145" decoding="async">
  <div class="portada">
    <p class="caps">Expediente privado</p>
    <h1>Línea<em>Carballo</em><small>${esc(sitio.subtitulo)}</small></h1>
    <form id="f" autocomplete="off">
      <label><span class="caps">Tu nombre</span><input id="nom" required maxlength="80" autocomplete="name"></label>
      <div class="campo-clave">
        <label class="caps" for="k">Clave</label>
        <div class="control-clave">
          <input id="k" type="password" autocapitalize="off" autocorrect="off" spellcheck="false" required>
          <button id="ver-clave" type="button" aria-controls="k" aria-label="Mostrar clave">Mostrar</button>
        </div>
      </div>
      <button type="submit">Entrar</button>
      <div id="err" role="alert"></div>
    </form>
  </div>
  <div class="franja"><span>Documento de trabajo</span><span>${REG ? "Acceso registrado" : esc(sitio.despedida)}</span><span>${esc(sitio.lugares)}</span></div>
</div></div>
<div id="app" class="marco" hidden><div class="hoja" id="contenido"></div></div>
<div id="visor" aria-modal="true" role="dialog"><div class="vtit" id="vtit"></div><div id="vwrap"><img id="vimg" alt=""><div id="vmk"></div></div><div class="vbar"><button id="vmenos">−</button><button id="vmas">+</button><button id="vajustar">Ajustar</button><a id="vdesc" download>Descargar</a><button id="vcerrar">Cerrar</button></div></div>
<script>
const P=${JSON.stringify(payload)};
const b64=(s)=>Uint8Array.from(atob(s),c=>c.charCodeAt(0));
let KEY=null,IMG={};
async function derivar(clave){const base=await crypto.subtle.importKey("raw",new TextEncoder().encode(clave),"PBKDF2",false,["deriveKey"]);return crypto.subtle.deriveKey({name:"PBKDF2",salt:b64(P.s),iterations:P.n,hash:"SHA-256"},base,{name:"AES-GCM",length:256},false,["decrypt"]);}
let cargaExpediente;
function cargarExpediente(){
  if(!cargaExpediente){
    cargaExpediente=fetch(P.f).then(respuesta=>{
      if(!respuesta.ok)throw new Error("Error al descargar el expediente");
      return respuesta.arrayBuffer();
    }).catch(error=>{
      cargaExpediente=null;
      throw error;
    });
  }
  return cargaExpediente;
}
async function abrir(clave){
  const [k,ct]=await Promise.all([derivar(clave),cargarExpediente()]);
  const pt=await crypto.subtle.decrypt({name:"AES-GCM",iv:b64(P.i)},k,ct);
  KEY=k;
  return JSON.parse(new TextDecoder().decode(pt));
}
const cache={};
async function imagen(id){if(cache[id])return cache[id];const m=IMG[id];const r=await fetch(m.f+"?v="+encodeURIComponent(P.s));const ct=await r.arrayBuffer();const pt=await crypto.subtle.decrypt({name:"AES-GCM",iv:b64(m.i)},KEY,ct);return cache[id]=URL.createObjectURL(new Blob([pt],{type:"image/jpeg"}));}
function registrar(nombre,url){
  if(!url)return;
  fetch(url,{
    method:"POST",
    mode:"no-cors",
    headers:{"Content-Type":"text/plain"},
    body:JSON.stringify({nombre,navegador:navigator.userAgent,pantalla:screen.width+"x"+screen.height,idioma:navigator.language})
  }).catch(()=>{});
}
function marcasHtml(fig){const m=fig.dataset.marcas?JSON.parse(fig.dataset.marcas):[];return m.map(r=>'<span class="mk" style="left:'+r[0]*100+'%;top:'+r[1]*100+'%;width:'+(r[2]-r[0])*100+'%;height:'+(r[3]-r[1])*100+'%"></span>').join('')}
function mostrar(d,nombre){
  IMG=d.img;document.getElementById("contenido").innerHTML=d.html;document.getElementById("quien").textContent=nombre;
  document.getElementById("lock").remove();document.getElementById("app").hidden=false;window.scrollTo(0,0);
  const io=new IntersectionObserver((es)=>es.forEach(async e=>{if(!e.isIntersecting)return;io.unobserve(e.target);const fig=e.target;try{const u=await imagen(fig.dataset.img);const ph=fig.querySelector(".ph");ph.innerHTML='<img alt="" src="'+u+'">';const im=ph.firstChild;im.onload=()=>{ph.style.aspectRatio=im.naturalWidth+"/"+im.naturalHeight;ph.insertAdjacentHTML("beforeend",marcasHtml(fig))};}catch(_){fig.querySelector(".ph span").textContent="No se pudo cargar";}}),{rootMargin:"600px"});
  document.querySelectorAll(".fig[data-img]").forEach(f=>{io.observe(f);const go=()=>visor(f);f.addEventListener("click",go);f.addEventListener("keydown",e=>{if(e.key==="Enter"||e.key===" "){e.preventDefault();go()}})});
}
const campoClave=document.getElementById("k");
const verClave=document.getElementById("ver-clave");
verClave.addEventListener("click",()=>{
  const mostrarClave=campoClave.type==="password";
  campoClave.type=mostrarClave?"text":"password";
  verClave.textContent=mostrarClave?"Ocultar":"Mostrar";
  verClave.setAttribute("aria-label",mostrarClave?"Ocultar clave":"Mostrar clave");
});
const formulario=document.getElementById("f");
formulario.addEventListener("focusin",()=>{cargarExpediente().catch(()=>{});},{once:true});
formulario.addEventListener("submit",async(e)=>{
  e.preventDefault();const nombre=document.getElementById("nom").value.trim();const k=campoClave.value.trim();const err=document.getElementById("err");
  if(!nombre){err.textContent="Escribe tu nombre.";return}
  err.textContent="Abriendo…";
  try{const d=await abrir(k);try{sessionStorage.setItem("k",k);sessionStorage.setItem("n",nombre)}catch(_){}registrar(nombre,d.registro);mostrar(d,nombre);}
  catch(error){err.textContent=error.name==="OperationError"?"Clave incorrecta.":"No se pudo cargar el expediente. Intenta de nuevo.";}
});
(async()=>{let k=null,n=null;try{k=sessionStorage.getItem("k");n=sessionStorage.getItem("n")}catch(_){}if(k&&n){try{mostrar(await abrir(k),n)}catch(_){}}})();

/* visor con zoom */
const V=document.getElementById("visor"),VI=document.getElementById("vimg"),VW=document.getElementById("vwrap");let s=1,x=0,y=0,fit=1;
function aplicar(){VW.style.transform="translate("+x+"px,"+y+"px) scale("+s+")"}
function ajustar(){const w=innerWidth,h=innerHeight-70;fit=Math.min(w/VI.naturalWidth,h/VI.naturalHeight);s=fit;x=(w-VI.naturalWidth*s)/2;y=(h-VI.naturalHeight*s)/2;aplicar()}
function zoom(f,cx=innerWidth/2,cy=innerHeight/2){const ns=Math.min(Math.max(s*f,fit*.5),fit*12);x=cx-(cx-x)*ns/s;y=cy-(cy-y)*ns/s;s=ns;aplicar()}
async function visor(fig){const id=fig.dataset.img;const u=await imagen(id);VI.onload=()=>{VW.style.width=VI.naturalWidth+"px";VW.style.height=VI.naturalHeight+"px";ajustar()};VW.style.transform="scale(0)";document.getElementById("vmk").innerHTML=marcasHtml(fig);VI.src=u;document.getElementById("vdesc").href=u;document.getElementById("vdesc").download=IMG[id].n;document.getElementById("vtit").textContent=fig.getAttribute("aria-label").replace("Ampliar ","");V.classList.add("on");document.body.style.overflow="hidden";if(VI.complete&&VI.naturalWidth)ajustar();requestAnimationFrame(()=>{if(VI.naturalWidth)ajustar()})}
function cerrar(){V.classList.remove("on");document.body.style.overflow=""}
document.getElementById("vcerrar").onclick=cerrar;document.getElementById("vmas").onclick=()=>zoom(1.4);document.getElementById("vmenos").onclick=()=>zoom(1/1.4);document.getElementById("vajustar").onclick=ajustar;
addEventListener("keydown",e=>{if(!V.classList.contains("on"))return;if(e.key==="Escape")cerrar();if(e.key==="+"||e.key==="=")zoom(1.4);if(e.key==="-")zoom(1/1.4)});
V.addEventListener("wheel",e=>{e.preventDefault();zoom(e.deltaY<0?1.15:1/1.15,e.clientX,e.clientY)},{passive:false});
const ptrs=new Map();let last=null,dist0=0;
V.addEventListener("pointerdown",e=>{if(e.target.closest(".vbar"))return;V.setPointerCapture(e.pointerId);ptrs.set(e.pointerId,{x:e.clientX,y:e.clientY});last={x:e.clientX,y:e.clientY};if(ptrs.size===2){const [a,b]=[...ptrs.values()];dist0=Math.hypot(a.x-b.x,a.y-b.y)}});
V.addEventListener("pointermove",e=>{if(!ptrs.has(e.pointerId))return;ptrs.set(e.pointerId,{x:e.clientX,y:e.clientY});if(ptrs.size===2){const [a,b]=[...ptrs.values()];const d=Math.hypot(a.x-b.x,a.y-b.y);if(dist0){zoom(d/dist0,(a.x+b.x)/2,(a.y+b.y)/2)}dist0=d}else if(last){x+=e.clientX-last.x;y+=e.clientY-last.y;last={x:e.clientX,y:e.clientY};aplicar()}});
const fin=e=>{ptrs.delete(e.pointerId);if(ptrs.size<2)dist0=0;if(!ptrs.size)last=null;else last=[...ptrs.values()][0]};
V.addEventListener("pointerup",fin);V.addEventListener("pointercancel",fin);
V.addEventListener("dblclick",e=>zoom(2,e.clientX,e.clientY));
addEventListener("resize",()=>{if(V.classList.contains("on"))ajustar()});
</script>
</body></html>`;

writeFileSync(here + "dist/index.html", page);
writeFileSync(here + "dist/.nojekyll", "");
writeFileSync(here + "dist/" + payload.f, ct);
for (const recurso of ["favicon.png", "escudo-portada.webp", "carballo.webp", "carballo-claro.webp"]) {
  writeFileSync(here + "dist/" + recurso, readFileSync(here + "src/marca/" + recurso));
}
console.log(`OK index.html ${(page.length / 1024).toFixed(0)} KB · ${nImg} imágenes cifradas · registro ${REG ? "activo" : "pendiente"}`);
