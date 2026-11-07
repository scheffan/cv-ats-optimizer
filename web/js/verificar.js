// Control de calidad: busca en el CV generado datos que no aparecen en el original.
// Es una red de seguridad por si la IA "inventa" empresas, fechas o números.

export function normalizar(texto) {
  return String(texto ?? '')
    .toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9%+#.]+/g, ' ')
    .trim();
}

function aparece(fragmento, original) {
  const f = normalizar(fragmento);
  if (!f) return true;
  // Alcanza con que estén todas las palabras significativas, en cualquier orden.
  return f.split(' ').filter((p) => p.length > 2).every((p) => original.includes(p));
}

export function numerosDe(texto) {
  return String(texto ?? '').match(/\d+(?:[.,]\d+)?/g) ?? [];
}

export function verificarCv(cv, textoOriginal) {
  const original = normalizar(textoOriginal);
  const numerosOriginales = new Set(numerosDe(textoOriginal));
  const avisos = [];

  for (const [seccion, items] of [['Experiencia', cv.experiencia], ['Educación', cv.educacion], ['Proyectos', cv.proyectos]]) {
    for (const item of items ?? []) {
      if (item.lugar && !aparece(item.lugar, original)) avisos.push(`${seccion}: "${item.lugar}" no figura en tu CV original.`);
      for (const n of numerosDe(item.fechas)) {
        if (!numerosOriginales.has(n)) avisos.push(`${seccion}: la fecha "${item.fechas}" no coincide con el original.`);
      }
      for (const logro of item.logros ?? []) {
        for (const n of numerosDe(logro)) {
          if (!numerosOriginales.has(n)) avisos.push(`${seccion}: el número "${n}" en "${logro}" no está en el original.`);
        }
      }
    }
  }
  return [...new Set(avisos)];
}
