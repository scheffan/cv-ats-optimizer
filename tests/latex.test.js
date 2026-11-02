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

test('omite secciones vacías', () => {
  const tex = cvALatex({ nombre: 'X' });
  assert.doesNotMatch(tex, /section/);
});
