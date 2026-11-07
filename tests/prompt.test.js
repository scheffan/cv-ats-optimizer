import { test } from 'node:test';
import assert from 'node:assert/strict';
import { armarMensajes, textoAgregados, validarEntrada, validarAgregados, normalizarCv, INSTRUCCIONES, LIMITE_CV } from '../web/js/prompt.js';
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
  assert.deepEqual(validarEntrada({ cv: CV_ORIGINAL, oferta: OFERTA }), { cv: CV_ORIGINAL, oferta: OFERTA, idioma: 'es', agregados: [] });
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

test('pide el CV en el idioma elegido y no acepta idiomas desconocidos', () => {
  assert.match(armarMensajes(CV_ORIGINAL, OFERTA, 'en')[0].content, /todo el CV en inglés/);
  assert.match(armarMensajes(CV_ORIGINAL, OFERTA)[0].content, /todo el CV en español/);
  assert.equal(validarEntrada({ cv: CV_ORIGINAL, oferta: OFERTA, idioma: 'fr' }).idioma, 'es');
  assert.equal(validarEntrada({ cv: CV_ORIGINAL, oferta: OFERTA, idioma: 'en' }).idioma, 'en');
});

test('suma al pedido lo que la persona confirmó que tiene', () => {
  const agregados = [{ requisito: 'Docker', lugar: 'Analista QA — Tienda Nube', detalle: 'levanté entornos de prueba' }];
  const [sistema, usuario] = armarMensajes(CV_ORIGINAL, OFERTA, 'es', agregados);
  assert.match(sistema.content, /DATOS AGREGADOS POR LA PERSONA/);
  assert.match(usuario.content, /- Docker: lo usó en "Analista QA — Tienda Nube". Detalle: levanté entornos de prueba/);
  assert.doesNotMatch(armarMensajes(CV_ORIGINAL, OFERTA)[1].content, /DATOS AGREGADOS/);
});

test('valida y recorta los datos agregados', () => {
  assert.deepEqual(validarAgregados(undefined), []);
  assert.ok(validarAgregados('no').error);
  assert.ok(validarAgregados(Array(16).fill({ requisito: 'a', lugar: 'b' })).error);
  const [a] = validarAgregados([{ requisito: 'x'.repeat(200), lugar: 'Acme', detalle: 5 }, { requisito: 'sin lugar' }]);
  assert.equal(a.requisito.length, 80);
  assert.equal(a.detalle, '');
  assert.equal(validarAgregados([{ requisito: 'sin lugar' }]).length, 0);
});

test('descarta un detalle tecleado al azar y pide no inventar contexto', () => {
  const [a] = validarAgregados([{ requisito: 'Mainframe', lugar: 'MaitWeb', detalle: 'automatice asuhfausifhuaisfagsfasf' }]);
  assert.equal(a.detalle, '');
  assert.match(textoAgregados([a]), /no inventes tareas, contextos/);
});
