import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import worker, { extraerJson, listaModelos, codigoValido, huellaAnonima } from '../worker/src/index.js';
import { CV_ORIGINAL, OFERTA, CV_IA } from './datos.js';

const ORIGEN = 'https://scheffan.github.io';
const env = { GROQ_API_KEY: 'clave-de-prueba', CODIGO_ACCESO: 'codigo-secreto', ORIGENES_PERMITIDOS: `${ORIGEN},http://localhost:5173` };
const fetchReal = globalThis.fetch;
let llamadas;

function pedido(cuerpo, { origen = ORIGEN, metodo = 'POST', ruta = '/optimizar', codigo = 'codigo-secreto' } = {}) {
  return new Request(`https://worker.test${ruta}`, {
    method: metodo,
    headers: { Origin: origen, 'Content-Type': 'application/json', 'CF-Connecting-IP': '1.2.3.4', ...(codigo ? { 'X-Codigo-Acceso': codigo } : {}) },
    body: metodo === 'POST' ? JSON.stringify(cuerpo) : undefined,
  });
}

function respuestaGroq(contenido, estado = 200) {
  return new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify(contenido) } }] }), { status: estado });
}

beforeEach(() => { llamadas = []; });
afterEach(() => { globalThis.fetch = fetchReal; });

test('devuelve el CV optimizado y nunca expone la clave', async () => {
  globalThis.fetch = async (url, opciones) => { llamadas.push({ url, opciones }); return respuestaGroq(CV_IA); };
  const r = await worker.fetch(pedido({ cv: CV_ORIGINAL, oferta: OFERTA }), env);
  const cuerpo = await r.json();
  assert.equal(r.status, 200);
  assert.equal(cuerpo.cv.nombre, 'Juan Gómez');
  assert.equal(r.headers.get('Cache-Control'), 'no-store');
  assert.ok(!JSON.stringify(cuerpo).includes('clave-de-prueba'));
  assert.equal(llamadas[0].opciones.headers.Authorization, 'Bearer clave-de-prueba');
});

test('rechaza orígenes que no son la web', async () => {
  const r = await worker.fetch(pedido({ cv: CV_ORIGINAL, oferta: OFERTA }, { origen: 'https://otro.com' }), env);
  assert.equal(r.status, 403);
});

test('valida la entrada antes de llamar a la IA', async () => {
  globalThis.fetch = async () => { throw new Error('no debería llamar'); };
  const r = await worker.fetch(pedido({ cv: 'corto', oferta: OFERTA }), env);
  assert.equal(r.status, 400);
});

test('responde 429 cuando se pasa el límite por IP', async () => {
  const r = await worker.fetch(pedido({ cv: CV_ORIGINAL, oferta: OFERTA }),
    { ...env, LIMITADOR: { limit: async () => ({ success: false }) } });
  assert.equal(r.status, 429);
});

test('si el modelo grande se queda sin cuota, usa el chico', async () => {
  globalThis.fetch = async (url, opciones) => {
    const { model } = JSON.parse(opciones.body);
    llamadas.push(model);
    return model.includes('120b') ? new Response('{}', { status: 429 }) : respuestaGroq(CV_IA);
  };
  const r = await worker.fetch(pedido({ cv: CV_ORIGINAL, oferta: OFERTA }), env);
  assert.equal(r.status, 200);
  assert.deepEqual(llamadas, ['openai/gpt-oss-120b', 'openai/gpt-oss-20b']);
});

test('maneja una respuesta que no es JSON válido', async () => {
  globalThis.fetch = async () => new Response(JSON.stringify({ choices: [{ message: { content: 'hola' } }] }));
  const r = await worker.fetch(pedido({ cv: CV_ORIGINAL, oferta: OFERTA }), env);
  assert.equal(r.status, 502);
});

test('responde el preflight de CORS y 404 en otras rutas', async () => {
  const pre = await worker.fetch(pedido(null, { metodo: 'OPTIONS' }), env);
  assert.equal(pre.status, 204);
  assert.equal(pre.headers.get('Access-Control-Allow-Origin'), ORIGEN);
  const otra = await worker.fetch(pedido({}, { ruta: '/admin' }), env);
  assert.equal(otra.status, 404);
});

test('si un modelo fue retirado (404), pasa al siguiente', async () => {
  globalThis.fetch = async (url, opciones) => {
    const { model } = JSON.parse(opciones.body);
    return model === 'viejo' ? new Response('{}', { status: 404 }) : respuestaGroq(CV_IA);
  };
  const r = await worker.fetch(pedido({ cv: CV_ORIGINAL, oferta: OFERTA }), { ...env, MODELOS: 'viejo, nuevo' });
  assert.equal(r.status, 200);
  assert.equal((await r.json()).modelo, 'nuevo');
});

test('avisa claro si la clave de Groq es inválida', async () => {
  globalThis.fetch = async () => new Response('{}', { status: 401 });
  const r = await worker.fetch(pedido({ cv: CV_ORIGINAL, oferta: OFERTA }), env);
  assert.match((await r.json()).error, /clave de Groq/);
});

test('si fallan todos los modelos, informa el código', async () => {
  globalThis.fetch = async () => new Response('{}', { status: 500 });
  const r = await worker.fetch(pedido({ cv: CV_ORIGINAL, oferta: OFERTA }), env);
  assert.equal(r.status, 502);
  assert.match((await r.json()).error, /código 500/);
});

test('extrae el JSON aunque venga envuelto en texto o en ```json', () => {
  assert.deepEqual(extraerJson('Acá está:\n```json\n{"nombre":"Ana"}\n```'), { nombre: 'Ana' });
  assert.throws(() => extraerJson('sin json'));
});

test('usa los modelos de la variable MODELOS o los de por defecto', () => {
  assert.deepEqual(listaModelos({ MODELOS: 'a, b' }), ['a', 'b']);
  assert.equal(listaModelos({})[0], 'openai/gpt-oss-120b');
});

test('rechaza pedidos demasiado grandes antes de procesarlos', async () => {
  globalThis.fetch = async () => { throw new Error('no debería llamar'); };
  const r = await worker.fetch(pedido({ cv: 'x'.repeat(50_000), oferta: OFERTA }), env);
  assert.equal(r.status, 413);
  assert.equal(r.headers.get('X-Content-Type-Options'), 'nosniff');
});

function kvFalso() {
  const datos = new Map();
  return { datos, get: async (k) => datos.get(k) ?? null, put: async (k, v) => { datos.set(k, v); } };
}

test('sin código: 1 CV gratis por día por persona', async () => {
  globalThis.fetch = async () => respuestaGroq(CV_IA);
  const USOS = kvFalso();
  const r1 = await worker.fetch(pedido({ cv: CV_ORIGINAL, oferta: OFERTA }, { codigo: null }), { ...env, USOS });
  assert.equal(r1.status, 200);
  const r2 = await worker.fetch(pedido({ cv: CV_ORIGINAL, oferta: OFERTA }, { codigo: null }), { ...env, USOS });
  assert.equal(r2.status, 429);
  const cuerpo = await r2.json();
  assert.equal(cuerpo.limiteDiario, true);
  assert.match(cuerpo.error, /CV gratis de hoy/);
});

test('sin código: hasta 2 actualizaciones con datos sumados', async () => {
  globalThis.fetch = async () => respuestaGroq(CV_IA);
  const USOS = kvFalso();
  const agregados = [{ requisito: 'Docker', lugar: 'Analista QA — Tienda Nube' }];
  const estados = [];
  for (let i = 0; i < 3; i++) {
    const r = await worker.fetch(pedido({ cv: CV_ORIGINAL, oferta: OFERTA, agregados }, { codigo: null }), { ...env, USOS });
    estados.push(r.status);
  }
  assert.deepEqual(estados, [200, 200, 429]);
});

test('no se descuenta el uso si la IA falla', async () => {
  globalThis.fetch = async () => new Response('{}', { status: 500 });
  const USOS = kvFalso();
  await worker.fetch(pedido({ cv: CV_ORIGINAL, oferta: OFERTA }, { codigo: null }), { ...env, USOS });
  assert.equal(USOS.datos.size, 0);
});

test('el tope global corta a todos y no se guardan IPs', async () => {
  globalThis.fetch = async () => respuestaGroq(CV_IA);
  const USOS = kvFalso();
  const r1 = await worker.fetch(pedido({ cv: CV_ORIGINAL, oferta: OFERTA }, { codigo: null }), { ...env, USOS, TOPE_GLOBAL: '1' });
  assert.equal(r1.status, 200);
  assert.ok(![...USOS.datos.keys()].some((k) => k.includes('1.2.3.4')));
  const otra = new Request('https://worker.test/optimizar', { method: 'POST', body: JSON.stringify({ cv: CV_ORIGINAL, oferta: OFERTA }),
    headers: { Origin: ORIGEN, 'CF-Connecting-IP': '5.6.7.8' } });
  const r2 = await worker.fetch(otra, { ...env, USOS, TOPE_GLOBAL: '1' });
  assert.equal(r2.status, 429);
  assert.match((await r2.json()).error, /agotaron los usos gratis de todos/);
});

test('con código no hay límite diario; un código incorrecto se rechaza', async () => {
  globalThis.fetch = async () => respuestaGroq(CV_IA);
  const USOS = kvFalso();
  for (let i = 0; i < 3; i++) {
    const r = await worker.fetch(pedido({ cv: CV_ORIGINAL, oferta: OFERTA }), { ...env, USOS });
    assert.equal(r.status, 200);
  }
  assert.equal(USOS.datos.size, 0);
  const mal = await worker.fetch(pedido({ cv: CV_ORIGINAL, oferta: OFERTA }, { codigo: 'otro' }), { ...env, USOS });
  assert.equal(mal.status, 401);
  assert.equal(codigoValido('x', undefined), false);
});

test('la huella anónima es estable y no contiene la IP', async () => {
  const a = await huellaAnonima('1.2.3.4', 'sal');
  assert.equal(a, await huellaAnonima('1.2.3.4', 'sal'));
  assert.notEqual(a, await huellaAnonima('1.2.3.4', 'otra-sal'));
  assert.ok(!a.includes('1.2.3.4'));
});
