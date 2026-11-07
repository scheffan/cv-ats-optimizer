// Arma el PDF del CV en el navegador con la misma estructura que la plantilla LaTeX.
// Es texto real (no imagen), así que los ATS lo leen sin problemas.
import { titulos } from './idiomas.js';

function encabezadoSeccion(titulo) {
  return [
    { text: titulo.toUpperCase(), style: 'seccion' },
    { canvas: [{ type: 'line', x1: 0, y1: 0, x2: 515, y2: 0, lineWidth: 0.6 }], margin: [0, 0, 0, 4] },
  ];
}

function entrada({ titulo, lugar, fechas, logros }) {
  const bloque = [{
    columns: [
      { text: [titulo, lugar].filter(Boolean).join(' — '), bold: true },
      { text: fechas ?? '', alignment: 'right', width: 'auto' },
    ],
  }];
  if (logros?.length) bloque.push({ ul: logros, margin: [0, 2, 0, 6] });
  else bloque.push({ text: '', margin: [0, 0, 0, 6] });
  return bloque;
}

export function cvADocumento(cv) {
  const t = titulos(cv);
  const contenido = [
    { text: cv.nombre ?? '', style: 'nombre' },
    { text: (cv.contacto ?? []).join(' | '), margin: [0, 2, 0, 8] },
  ];
  if (cv.resumen) contenido.push(...encabezadoSeccion(t.perfil), { text: cv.resumen, margin: [0, 0, 0, 6] });
  if (cv.experiencia?.length) contenido.push(...encabezadoSeccion(t.experiencia), ...cv.experiencia.flatMap(entrada));
  if (cv.educacion?.length) contenido.push(...encabezadoSeccion(t.educacion), ...cv.educacion.flatMap(entrada));
  if (cv.proyectos?.length) contenido.push(...encabezadoSeccion(t.proyectos), ...cv.proyectos.flatMap(entrada));
  if (cv.habilidades?.length) contenido.push(...encabezadoSeccion(t.habilidades), { text: cv.habilidades.join(', '), margin: [0, 0, 0, 6] });
  if (cv.otros?.length) contenido.push(...encabezadoSeccion(t.otros), { ul: cv.otros });

  return {
    pageSize: 'A4',
    pageMargins: [40, 40, 40, 40],
    info: { title: `CV ${cv.nombre ?? ''}`.trim() },
    content: contenido,
    defaultStyle: { fontSize: 10.5, lineHeight: 1.15 },
    styles: {
      nombre: { fontSize: 20, bold: true },
      seccion: { fontSize: 11.5, bold: true, margin: [0, 8, 0, 2] },
    },
  };
}

export function nombreArchivo(cv, extension) {
  const base = normalizarNombre(cv.nombre) || 'cv';
  return `${base}-cv-ats.${extension}`;
}

function normalizarNombre(nombre) {
  return String(nombre ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}
