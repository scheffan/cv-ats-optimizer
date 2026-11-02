// Genera un .tex de ejemplo para comprobar en CI que la plantilla compila con pdflatex.
import { writeFileSync } from 'node:fs';
import { cvALatex } from '../web/js/latex.js';
import { CV_IA } from '../tests/datos.js';

const conCaracteresRaros = { ...CV_IA, otros: ['C# & .NET al 100%', 'Inglés B2 (First Certificate) ~ 2020', 'Ruta: C:\\proyectos\\qa_tests'] };
writeFileSync('ejemplo.tex', cvALatex(conCaracteresRaros));
console.log('ejemplo.tex generado');
