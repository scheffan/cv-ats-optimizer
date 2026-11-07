import { leerCv } from './lectura.js';
import { optimizar } from './ia.js';
import { cvALatex } from './latex.js';
import { cvADocumento, nombreArchivo } from './pdf-cv.js';
import { verificarCv } from './verificar.js';
import { titulos } from './idiomas.js';
import { textoAgregados } from './prompt.js';

const $ = (id) => document.getElementById(id);
let cvActual = null;
let latexActual = '';
let agregados = [];
let requisitoElegido = '';

function estado(mensaje, esError = false) {
  $('estado').textContent = mensaje;
  $('estado').classList.toggle('error', esError);
}

function crear(etiqueta, texto, clase) {
  const el = document.createElement(etiqueta);
  if (texto) el.textContent = texto; // siempre textContent: nada de HTML del usuario o de la IA
  if (clase) el.className = clase;
  return el;
}

function lista(items) {
  const ul = crear('ul');
  for (const i of items) ul.append(crear('li', i));
  return ul;
}

function renderizarVista(cv) {
  const hoja = $('vista-previa');
  hoja.replaceChildren(crear('p', cv.nombre, 'nombre'), crear('p', cv.contacto.join(' | '), 'contacto'));
  const t = titulos(cv);
  const seccion = (titulo) => hoja.append(crear('h3', titulo));
  if (cv.resumen) { seccion(t.perfil); hoja.append(crear('p', cv.resumen)); }
  for (const [titulo, items] of [[t.experiencia, cv.experiencia], [t.educacion, cv.educacion], [t.proyectos, cv.proyectos ?? []]]) {
    if (!items.length) continue;
    seccion(titulo);
    for (const e of items) {
      const cab = crear('div', null, 'cabecera');
      cab.append(crear('span', [e.titulo, e.lugar].filter(Boolean).join(' — ')), crear('span', e.fechas));
      hoja.append(cab);
      if (e.logros.length) hoja.append(lista(e.logros));
    }
  }
  if (cv.habilidades.length) { seccion(t.habilidades); hoja.append(crear('p', cv.habilidades.join(', '))); }
  if (cv.otros.length) { seccion(t.otros); hoja.append(lista(cv.otros)); }
}

function renderizarFaltantes() {
  const yaSumados = new Set(agregados.map((a) => a.requisito));
  $('faltantes').replaceChildren(...(cvActual?.faltantes ?? []).filter((f) => !yaSumados.has(f)).map((f) => {
    const chip = crear('button', `+ ${f}`, 'chip');
    chip.type = 'button';
    chip.setAttribute('aria-pressed', String(f === requisitoElegido));
    chip.addEventListener('click', () => abrirFormulario(f));
    const li = crear('li');
    li.append(chip);
    return li;
  }));
}

function renderizarAgregados() {
  $('agregados').replaceChildren(...agregados.map((a, i) => {
    const li = crear('li', `${a.requisito} · ${a.lugar}`);
    const quitar = crear('button', '×');
    quitar.type = 'button';
    quitar.setAttribute('aria-label', `Quitar ${a.requisito}`);
    quitar.addEventListener('click', () => { agregados.splice(i, 1); renderizarAgregados(); renderizarFaltantes(); });
    li.append(quitar);
    return li;
  }));
  $('caja-agregados').hidden = agregados.length === 0;
}

function lugaresPosibles(cv) {
  const etiqueta = (e) => [e.titulo, e.lugar].filter(Boolean).join(' — ');
  return [...cv.experiencia, ...(cv.proyectos ?? []), ...cv.educacion].map(etiqueta).filter(Boolean)
    .concat('Proyecto personal o curso');
}

function abrirFormulario(requisito) {
  requisitoElegido = requisito;
  $('agregar-requisito').textContent = requisito;
  $('agregar-lugar').replaceChildren(...lugaresPosibles(cvActual).map((l) => {
    const op = crear('option', l);
    op.value = l;
    return op;
  }));
  $('agregar-detalle').value = '';
  $('form-agregar').hidden = false;
  renderizarFaltantes();
  $('agregar-lugar').focus();
}

function cerrarFormulario() {
  requisitoElegido = '';
  $('form-agregar').hidden = true;
  renderizarFaltantes();
}

function renderizarAnalisis(cv, avisos) {
  $('coincidencias').replaceChildren(...cv.coincidencias.map((c) => crear('li', c)));
  renderizarFaltantes();
  $('lista-avisos').replaceChildren(...avisos.map((a) => crear('li', a)));
  $('avisos').hidden = avisos.length === 0;
}

function descargar(contenido, nombre, tipo) {
  const url = URL.createObjectURL(new Blob([contenido], { type: tipo }));
  const a = Object.assign(document.createElement('a'), { href: url, download: nombre });
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

async function alCargarArchivo(archivo) {
  if (!archivo) return;
  estado('Leyendo tu CV…');
  try {
    $('texto-cv').value = await leerCv(archivo);
    $('texto-zona').textContent = `✓ ${archivo.name}`;
    estado('CV leído. Ahora pegá la oferta.');
  } catch (e) {
    estado(e.message, true);
  }
}

async function alOptimizar() {
  agregados = [];
  cerrarFormulario();
  renderizarAgregados();
  await generar('Analizando el CV y la oferta…');
}

async function alActualizar() {
  cerrarFormulario();
  await generar('Actualizando tu CV con lo que sumaste…');
}

async function generar(mensaje) {
  const boton = $('boton-optimizar');
  const modo = document.querySelector('input[name="modo"]:checked').value;
  const idioma = document.querySelector('input[name="idioma"]:checked').value;
  const original = $('texto-cv').value;
  boton.disabled = true;
  $('boton-actualizar').disabled = true;
  estado(modo === 'local' ? 'Procesando con Ollama (puede tardar)…' : mensaje);
  try {
    cvActual = { ...(await optimizar(original, $('oferta').value, { modo, idioma, agregados })), idioma };
    latexActual = cvALatex(cvActual);
    renderizarVista(cvActual);
    renderizarAnalisis(cvActual, verificarCv(cvActual, original + textoAgregados(agregados)));
    $('vista-latex').textContent = latexActual;
    $('snip-overleaf').value = latexActual;
    $('acciones').hidden = false;
    estado('Listo. Revisalo antes de enviarlo.');
  } catch (e) {
    estado(e.message, true);
  } finally {
    boton.disabled = false;
    $('boton-actualizar').disabled = false;
  }
}

function cambiarVista(vista) {
  for (const b of document.querySelectorAll('[data-vista]')) b.setAttribute('aria-selected', String(b.dataset.vista === vista));
  $('vista-previa').hidden = vista !== 'previa';
  $('vista-latex').hidden = vista !== 'latex';
}

$('archivo-cv').addEventListener('change', (e) => alCargarArchivo(e.target.files[0]));
const zona = $('zona-archivo');
zona.addEventListener('dragover', (e) => { e.preventDefault(); zona.classList.add('activa'); });
zona.addEventListener('dragleave', () => zona.classList.remove('activa'));
zona.addEventListener('drop', (e) => { e.preventDefault(); zona.classList.remove('activa'); alCargarArchivo(e.dataTransfer.files[0]); });
$('boton-optimizar').addEventListener('click', alOptimizar);
$('boton-actualizar').addEventListener('click', alActualizar);
$('agregar-cancelar').addEventListener('click', cerrarFormulario);
$('form-agregar').addEventListener('submit', (e) => {
  e.preventDefault();
  agregados.push({ requisito: requisitoElegido, lugar: $('agregar-lugar').value, detalle: $('agregar-detalle').value.trim() });
  cerrarFormulario();
  renderizarAgregados();
  estado('Sumado. Cuando termines, tocá "Actualizar CV".');
});
for (const b of document.querySelectorAll('[data-vista]')) b.addEventListener('click', () => cambiarVista(b.dataset.vista));
$('bajar-tex').addEventListener('click', () => descargar(latexActual, nombreArchivo(cvActual, 'tex'), 'application/x-tex'));
$('bajar-pdf').addEventListener('click', () => window.pdfMake.createPdf(cvADocumento(cvActual)).download(nombreArchivo(cvActual, 'pdf')));
$('copiar-tex').addEventListener('click', async () => {
  await navigator.clipboard.writeText(latexActual);
  estado('LaTeX copiado.');
});
