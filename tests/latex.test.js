import { test } from 'node:test';
import assert from 'node:assert/strict';
import { escapar, cvALatex } from '../web/js/latex.js';

test('escapa caracteres especiales de LaTeX', () => {
  assert.equal(escapar('C# & 100% $_'), 'C\\# \\& 100\\% \\$\\_');
});

test('arma el documento con nombre y secciones', () => {
  const tex = cvALatex({
    nombre: 'Ana Pérez', contacto: ['ana@mail.com'], resumen: 'Analista QA',
    experiencia: [{ titulo: 'QA Jr', lugar: 'Acme', fechas: '2024 - hoy', logros: ['Automaticé 40 tests'] }],
    habilidades: ['Playwright', 'SQL'],
  });
  assert.match(tex, /Ana Pérez/);
  assert.match(tex, /\\section\*\{Experiencia\}/);
  assert.match(tex, /\\item Automaticé 40 tests/);
  assert.match(tex, /Playwright, SQL/);
});

test('incluye la sección de proyectos', () => {
  const tex = cvALatex({ nombre: 'X', proyectos: [{ titulo: 'Bot de Python', lugar: 'GitHub', fechas: '2025', logros: ['Automaticé reportes'] }] });
  assert.match(tex, /\\section\*\{Proyectos\}/);
  assert.match(tex, /Bot de Python --- GitHub/);
});

test('omite secciones vacías', () => {
  const tex = cvALatex({ nombre: 'X' });
  assert.doesNotMatch(tex, /section/);
});

test('usa títulos en inglés cuando el CV es en inglés', () => {
  const tex = cvALatex({ nombre: 'X', idioma: 'en', resumen: 'QA analyst', habilidades: ['SQL'] });
  assert.match(tex, /\\section\*\{Profile\}/);
  assert.match(tex, /\\section\*\{Skills\}/);
  assert.doesNotMatch(tex, /Perfil/);
});
