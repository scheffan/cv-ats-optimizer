// Arma un CV en LaTeX de una columna, apto para ATS, a partir de datos estructurados.
// Sin tablas, sin columnas, sin íconos: texto plano que los ATS leen bien.

const ESPECIALES = {
  '\\': '\\textbackslash{}', '{': '\\{', '}': '\\}', '$': '\\$', '&': '\\&',
  '#': '\\#', '%': '\\%', '_': '\\_', '~': '\\textasciitilde{}', '^': '\\textasciicircum{}',
};

export function escapar(texto) {
  return String(texto ?? '').replace(/[\\{}$&#%_~^]/g, (c) => ESPECIALES[c]);
}

function seccion(titulo, cuerpo) {
  if (!cuerpo.trim()) return '';
  return `\\section*{${escapar(titulo)}}\n${cuerpo}\n`;
}

function vinetas(items = []) {
  const limpios = items.filter((i) => String(i ?? '').trim());
  if (!limpios.length) return '';
  return `\\begin{itemize}\n${limpios.map((i) => `  \\item ${escapar(i)}`).join('\n')}\n\\end{itemize}\n`;
}

function entrada({ titulo, lugar, fechas, logros }) {
  const cabecera = [titulo, lugar].filter(Boolean).map(escapar).join(' --- ');
  const fecha = fechas ? ` \\hfill ${escapar(fechas)}` : '';
  return `\\textbf{${cabecera}}${fecha}\\par\n${vinetas(logros)}`;
}

export function cvALatex(cv) {
  const { nombre = '', contacto = [], resumen = '', experiencia = [], educacion = [], proyectos = [],
    habilidades = [], otros = [] } = cv;
  return `\\documentclass[11pt]{article}
\\usepackage[utf8]{inputenc}
\\usepackage[T1]{fontenc}
\\usepackage[margin=2cm]{geometry}
\\usepackage{enumitem}
\\setlist{nosep,leftmargin=1.2em}
\\pagestyle{empty}
% Texto copiable y legible para los ATS
\\input{glyphtounicode}
\\pdfgentounicode=1
\\begin{document}
{\\LARGE\\textbf{${escapar(nombre)}}}\\\\
${contacto.filter(Boolean).map(escapar).join(' | ')}

${seccion('Perfil', resumen ? escapar(resumen) : '')}${seccion('Experiencia', experiencia.map(entrada).join('\n'))}${seccion('Educación', educacion.map(entrada).join('\n'))}${seccion('Proyectos', proyectos.map(entrada).join('\n'))}${seccion('Habilidades', habilidades.filter(Boolean).map(escapar).join(', '))}${seccion('Otros', vinetas(otros))}\\end{document}
`;
}
