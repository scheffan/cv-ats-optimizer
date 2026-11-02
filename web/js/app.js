import { leerCv } from './lectura.js';
import { optimizar } from './ia.js';
import { cvALatex } from './latex.js';
import { cvADocumento, nombreArchivo } from './pdf-cv.js';
import { verificarCv } from './verificar.js';

const $ = (id) => document.getElementById(id);
let cvActual = null;
let latexActual = '';

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
  const seccion = (titulo) => hoja.append(crear('h3', titulo));
  if (cv.resumen) { seccion('Perfil'); hoja.append(crear('p', cv.resumen)); }
  for (const [titulo, items] of [['Experiencia', cv.experiencia], ['Educación', cv.educacion]]) {
    if (!items.length) continue;
    seccion(titulo);
    for (const e of items) {
      const cab = crear('div', null, 'cabecera');
      cab.append(crear('span', [e.titulo, e.lugar].filter(Boolean).join(' — ')), crear('span', e.fechas));
      hoja.append(cab);
      if (e.logros.length) hoja.append(lista(e.logros));
    }
  }
  if (cv.habilidades.length) { seccion('Habilidades'); hoja.append(crear('p', cv.habilidades.join(', '))); }
  if (cv.otros.length) { seccion('Otros'); hoja.append(lista(cv.otros)); }
}

function renderizarAnalisis(cv, avisos) {
  $('coincidencias').replaceChildren(...cv.coincidencias.map((c) => crear('li', c)));
  $('faltantes').replaceChildren(...cv.faltantes.map((c) => crear('li', c)));
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
  const boton = $('boton-optimizar');
  const modo = document.querySelector('input[name="modo"]:checked').value;
  const original = $('texto-cv').value;
  boton.disabled = true;
  estado(modo === 'local' ? 'Procesando con Ollama (puede tardar)…' : 'Analizando el CV y la oferta…');
  try {
    cvActual = await optimizar(original, $('oferta').value, { modo });
    latexActual = cvALatex(cvActual);
    renderizarVista(cvActual);
    renderizarAnalisis(cvActual, verificarCv(cvActual, original));
    $('vista-latex').textContent = latexActual;
    $('snip-overleaf').value = latexActual;
    $('acciones').hidden = false;
    estado('Listo. Revisalo antes de enviarlo.');
  } catch (e) {
    estado(e.message, true);
  } finally {
    boton.disabled = false;
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
for (const b of document.querySelectorAll('[data-vista]')) b.addEventListener('click', () => cambiarVista(b.dataset.vista));
$('bajar-tex').addEventListener('click', () => descargar(latexActual, nombreArchivo(cvActual, 'tex'), 'application/x-tex'));
$('bajar-pdf').addEventListener('click', () => window.pdfMake.createPdf(cvADocumento(cvActual)).download(nombreArchivo(cvActual, 'pdf')));
$('copiar-tex').addEventListener('click', async () => {
  await navigator.clipboard.writeText(latexActual);
  estado('LaTeX copiado.');
});
