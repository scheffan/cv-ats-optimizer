import { test } from 'node:test';
import assert from 'node:assert/strict';
import { verificarCv, normalizar } from '../web/js/verificar.js';
import { CV_ORIGINAL, CV_IA } from './datos.js';

test('normaliza tildes y mayúsculas', () => {
  assert.equal(normalizar('Educación UTN'), 'educacion utn');
});

test('un CV fiel al original no genera avisos', () => {
  assert.deepEqual(verificarCv(CV_IA, CV_ORIGINAL), []);
});

test('detecta una empresa inventada', () => {
  const inventado = structuredClone(CV_IA);
  inventado.experiencia.push({ titulo: 'QA Lead', lugar: 'Mercado Libre', fechas: '', logros: [] });
  const avisos = verificarCv(inventado, CV_ORIGINAL);
  assert.ok(avisos.some((a) => a.includes('Mercado Libre')));
});

test('detecta números y fechas que no estaban', () => {
  const inflado = structuredClone(CV_IA);
  inflado.experiencia[0].logros = ['Automaticé 500 casos de regresión.'];
  inflado.experiencia[0].fechas = '2020 a 2025';
  const avisos = verificarCv(inflado, CV_ORIGINAL);
  assert.ok(avisos.some((a) => a.includes('"500"')));
  assert.ok(avisos.some((a) => a.includes('2020 a 2025')));
});
