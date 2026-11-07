import { test } from 'node:test';
import assert from 'node:assert/strict';
import { armarMensajes, validarEntrada, normalizarCv, INSTRUCCIONES, LIMITE_CV } from '../web/js/prompt.js';
import { CV_ORIGINAL, OFERTA, CV_IA } from './datos.js';

test('las instrucciones prohíben inventar y piden mantener el tono', () => {
  assert.match(INSTRUCCIONES, /No inventes nada/);
  assert.match(INSTRUCCIONES, /Mantené el tono/);
});

test('arma mensajes de sistema y usuario con el CV y la oferta', () => {
  const [sistema, usuario] = armarMensajes(CV_ORIGINAL, OFERTA);
  assert.equal(sistema.role, 'system');
  assert.ok(usuario.content.includes('Tienda Nube'));
  assert.ok(usuario.content.includes('QA Automation'));
});

test('rechaza CV vacío, oferta corta y textos gigantes', () => {
  assert.ok(validarEntrada({ cv: '', oferta: OFERTA }).error);
  assert.ok(validarEntrada({ cv: CV_ORIGINAL, oferta: 'corta' }).error);
  assert.ok(validarEntrada({ cv: 'x'.repeat(LIMITE_CV + 1), oferta: OFERTA }).error);
  assert.ok(validarEntrada({ cv: 123, oferta: OFERTA }).error);
  assert.deepEqual(validarEntrada({ cv: CV_ORIGINAL, oferta: OFERTA }), { cv: CV_ORIGINAL, oferta: OFERTA });
});

test('normaliza respuestas con campos faltantes o de otro tipo', () => {
  const cv = normalizarCv({ nombre: 'Ana', experiencia: [{ titulo: 'Dev', logros: 'no es lista' }], habilidades: 'x' });
  assert.deepEqual(cv.experiencia[0].logros, []);
  assert.deepEqual(cv.habilidades, []);
  assert.deepEqual(cv.faltantes, []);
});

test('conserva los proyectos y pide no descartar secciones', () => {
  assert.match(INSTRUCCIONES, /No descartes secciones/);
  const cv = normalizarCv({ nombre: 'Ana', proyectos: [{ titulo: 'Web', logros: ['Hecha con HTML'] }] });
  assert.equal(cv.proyectos[0].titulo, 'Web');
});

test('falla si la respuesta no tiene ni nombre ni experiencia', () => {
  assert.throws(() => normalizarCv({}));
  assert.equal(normalizarCv(CV_IA).nombre, 'Juan Gómez');
});
