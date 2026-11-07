import { leerCv } from './lectura.js';
import { optimizar } from './ia.js';
import { cvALatex } from './latex.js';
import { cvADocumento, nombreArchivo } from './pdf-cv.js';
import { verificarCv } from './verificar.js';
import { titulos } from './idiomas.js';
import { textoAgregados } from './prompt.js';
import { pareceSinSentido } from './detalle.js';

const $ = (id) => document.getElementById(id);
let cvActual = null;
let latexActual = '';
let agregados = []; // { requisito, lugar, detalle, incluido }
const seleccionados = new Set();

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
    const elegido = seleccionados.has(f);
    const chip = crear('button', `${elegido ? '✓' : '+'} ${f}`, 'chip');
    chip.type = 'button';
    chip.setAttribute('aria-pressed', String(elegido));
    chip.addEventListener('click', () => alternarRequisito(f));
    const li = crear('li');
    li.append(chip);
    return li;
  }));
}

function pendientes() {
  return agregados.filter((a) => !a.incluido).length;
}

function renderizarAgregados() {
  $('agregados').replaceChildren(...agregados.map((a, i) => {
    const li = crear('li', null, a.incluido ? 'incluido' : 'pendiente');
    const texto = crear('span', `${a.incluido ? '✓ ' : ''}${a.requisito} → ${a.lugar}${a.detalle ? ` (${a.detalle})` : ''}`);
    const quitar = crear('button', '×');
    quitar.type = 'button';
    quitar.setAttribute('aria-label', `Quitar ${a.requisito}`);
    quitar.addEventListener('click', () => {
      agregados.splice(i, 1);
      // Si ya estaba en el CV, hay que actualizar para sacarlo.
      if (a.incluido) agregados.forEach((x) => { x.incluido = false; });
      renderizarAgregados();
      renderizarFaltantes();
    });
    li.append(texto, quitar);
    return li;
  }));
  const n = pendientes();
  $('caja-agregados').hidden = agregados.length === 0;
  $('boton-actualizar').disabled = n === 0;
  $('boton-actualizar').textContent = n ? `Actualizar CV (${n} sin aplicar)` : 'CV actualizado ✓';
}

function lugaresPosibles(cv) {
  const etiqueta = (e) => [e.titulo, e.lugar].filter(Boolean).join(' — ');
  return [...cv.experiencia, ...(cv.proyectos ?? []), ...cv.educacion].map(etiqueta).filter(Boolean)
    .concat('Proyecto personal o curso');
}

function alternarRequisito(requisito) {
  if (seleccionados.has(requisito)) seleccionados.delete(requisito);
  else seleccionados.add(requisito);
  if (seleccionados.size && $('form-agregar').hidden) prepararFormulario();
  $('form-agregar').hidden = seleccionados.size === 0;
  $('agregar-requisito').textContent = [...seleccionados].join(', ');
  $('agregar-confirmar').textContent = seleccionados.size > 1 ? `Agregar los ${seleccionados.size}` : 'Agregar';
  renderizarFaltantes();
}

function prepararFormulario() {
  const opciones = [Object.assign(crear('option', 'Elegí una experiencia…'), { value: '', disabled: true, selected: true })];
  for (const l of lugaresPosibles(cvActual)) opciones.push(Object.assign(crear('option', l), { value: l }));
  $('agregar-lugar').replaceChildren(...opciones);
  $('agregar-detalle').value = '';
}

function cerrarFormulario() {
  seleccionados.clear();
  $('form-agregar').hidden = true;
  renderizarFaltantes();
}

function estadoAnalisis(mensaje, tipo = '') {
  $('estado-analisis').textContent = mensaje;
  $('estado-analisis').className = `estado ${tipo}`;
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
  estadoAnalisis('');
  await generar('Analizando el CV y la oferta…');
}

async function alActualizar() {
  cerrarFormulario();
  estadoAnalisis('Actualizando tu CV…');
  const ok = await generar('Actualizando tu CV con lo que sumaste…');
  if (!ok) { estadoAnalisis('No se pudo actualizar. Probá de nuevo.', 'error'); return; }
  const n = agregados.length;
  estadoAnalisis(`✓ CV actualizado con ${n} ${n === 1 ? 'dato' : 'datos'}. Fijate la vista previa.`, 'ok');
  const hoja = $('vista-previa');
  hoja.classList.remove('resaltar');
  void hoja.offsetWidth;
  hoja.classList.add('resaltar');
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
    cvActual = { ...(await optimizar(original, $('oferta').value, { modo, idioma, agregados: agregados.map(({ requisito, lugar, detalle }) => ({ requisito, lugar, detalle })) })), idioma };
    latexActual = cvALatex(cvActual);
    renderizarVista(cvActual);
    renderizarAnalisis(cvActual, verificarCv(cvActual, original + textoAgregados(agregados)));
    $('vista-latex').textContent = latexActual;
    $('snip-overleaf').value = latexActual;
    $('acciones').hidden = false;
    agregados.forEach((a) => { a.incluido = true; });
    estado('Listo. Revisalo antes de enviarlo.');
    return true;
  } catch (e) {
    estado(e.message, true);
    return false;
  } finally {
    boton.disabled = false;
    renderizarAgregados();
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
  const lugar = $('agregar-lugar').value;
  if (!lugar) { estadoAnalisis('Elegí dónde lo usaste.', 'error'); $('agregar-lugar').focus(); return; }
  const detalle = $('agregar-detalle').value.trim();
  if (pareceSinSentido(detalle)) { estadoAnalisis('Lo que escribiste en "¿Cómo lo usaste?" no parece una frase. Corregilo o dejalo vacío.', 'error'); $('agregar-detalle').focus(); return; }
  for (const requisito of seleccionados) agregados.push({ requisito, lugar, detalle, incluido: false });
  cerrarFormulario();
  renderizarAgregados();
  estadoAnalisis('Sumado. Podés elegir más o tocar "Actualizar CV".');
});
for (const b of document.querySelectorAll('[data-vista]')) b.addEventListener('click', () => cambiarVista(b.dataset.vista));
$('bajar-tex').addEventListener('click', () => descargar(latexActual, nombreArchivo(cvActual, 'tex'), 'application/x-tex'));
$('bajar-pdf').addEventListener('click', () => window.pdfMake.createPdf(cvADocumento(cvActual)).download(nombreArchivo(cvActual, 'pdf')));
$('copiar-tex').addEventListener('click', async () => {
  await navigator.clipboard.writeText(latexActual);
  estado('LaTeX copiado.');
});
