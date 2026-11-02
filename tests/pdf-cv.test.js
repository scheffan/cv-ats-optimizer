import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cvADocumento, nombreArchivo } from '../web/js/pdf-cv.js';
import { CV_IA } from './datos.js';

test('el PDF es A4, de una columna y con las secciones del CV', () => {
  const doc = cvADocumento(CV_IA);
  assert.equal(doc.pageSize, 'A4');
  const textos = JSON.stringify(doc.content);
  for (const s of ['PERFIL', 'EXPERIENCIA', 'EDUCACIÓN', 'HABILIDADES', 'Tienda Nube']) assert.ok(textos.includes(s), s);
  assert.ok(!textos.includes('OTROS'));
});

test('arma un nombre de archivo sin tildes ni espacios', () => {
  assert.equal(nombreArchivo(CV_IA, 'pdf'), 'juan-gomez-cv-ats.pdf');
  assert.equal(nombreArchivo({}, 'tex'), 'cv-cv-ats.tex');
});
