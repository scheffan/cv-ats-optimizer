import { test, expect } from '@playwright/test';
import { CV_ORIGINAL, OFERTA, CV_IA } from '../tests/datos.js';

const API = '**/optimizar';

function simularApi(page, cuerpo, estado = 200) {
  return page.route(API, (route) => route.fulfill({ status: estado, contentType: 'application/json', body: JSON.stringify(cuerpo) }));
}

async function completar(page) {
  await page.getByTestId('archivo-cv').setInputFiles('e2e/fixtures/cv-ejemplo.txt');
  await expect(page.getByTestId('estado')).toContainText('CV leído');
  await page.getByTestId('oferta').fill(OFERTA);
}

test.beforeEach(async ({ page }, info) => {
  // Las pruebas de la IA real usan un código; las del modo demo entran sin código.
  if (!info.title.startsWith('demo:')) await page.addInitScript(() => localStorage.setItem('cv-ats-codigo', 'codigo-de-prueba'));
  await page.goto('/');
});

test('lee el texto de un CV en PDF dentro del navegador', async ({ page }) => {
  await page.getByTestId('archivo-cv').setInputFiles('e2e/fixtures/cv-ejemplo.pdf');
  await expect(page.getByTestId('estado')).toContainText('CV leído');
  await expect(page.getByTestId('texto-cv')).toHaveValue(/Tienda Nube/);
});

test('flujo completo: optimiza, muestra la vista previa y el LaTeX', async ({ page }) => {
  await simularApi(page, { cv: CV_IA });
  await completar(page);
  const pedido = page.waitForRequest(API);
  await page.getByTestId('optimizar').click();
  const req = await pedido;
  expect(req.headers()['x-codigo-acceso']).toBe('codigo-de-prueba');
  const cuerpo = req.postDataJSON();
  expect(cuerpo.cv).toContain('Tienda Nube');
  expect(Object.keys(cuerpo).sort()).toEqual(['agregados', 'cv', 'idioma', 'oferta']); // solo viaja el texto, nada más

  await expect(page.getByTestId('vista-previa')).toContainText('Juan Gómez');
  await expect(page.getByTestId('coincidencias')).toContainText('Playwright');
  await expect(page.getByTestId('faltantes')).toContainText('Docker');
  await expect(page.getByTestId('avisos')).toBeHidden();

  await page.getByRole('tab', { name: 'LaTeX' }).click();
  await expect(page.getByTestId('vista-latex')).toContainText('\\documentclass[11pt]{article}');
});

test('descarga el CV en PDF y en .tex', async ({ page }) => {
  await simularApi(page, { cv: CV_IA });
  await completar(page);
  await page.getByTestId('optimizar').click();

  const [pdf] = await Promise.all([page.waitForEvent('download'), page.getByTestId('bajar-pdf').click()]);
  expect(pdf.suggestedFilename()).toBe('juan-gomez-cv-ats.pdf');
  const [tex] = await Promise.all([page.waitForEvent('download'), page.getByTestId('bajar-tex').click()]);
  expect(tex.suggestedFilename()).toBe('juan-gomez-cv-ats.tex');
});

test('avisa cuando la IA agrega una empresa que no estaba', async ({ page }) => {
  const inventado = structuredClone(CV_IA);
  inventado.experiencia.push({ titulo: 'QA Lead', lugar: 'Mercado Libre', fechas: '2025', logros: [] });
  await simularApi(page, { cv: inventado });
  await completar(page);
  await page.getByTestId('optimizar').click();
  await expect(page.getByTestId('avisos')).toContainText('Mercado Libre');
});

test('muestra el error del servidor cuando se pasa el límite', async ({ page }) => {
  await simularApi(page, { error: 'Muchos pedidos seguidos. Probá de nuevo en un minuto.' }, 429);
  await completar(page);
  await page.getByTestId('optimizar').click();
  await expect(page.getByTestId('estado')).toContainText('Muchos pedidos seguidos');
});

test('no llama a la IA si falta la oferta', async ({ page }) => {
  let llamadas = 0;
  await page.route(API, (route) => { llamadas++; return route.abort(); });
  await page.getByText('Ver o corregir el texto leído').click();
  await page.getByTestId('texto-cv').fill(CV_ORIGINAL);
  await page.getByTestId('optimizar').click();
  await expect(page.getByTestId('estado')).toContainText('Pegá la descripción completa');
  expect(llamadas).toBe(0);
});

test('no ejecuta HTML que venga en la respuesta (XSS)', async ({ page }) => {
  const malicioso = { ...CV_IA, nombre: '<img src=x onerror="window.hackeado=1">' };
  await simularApi(page, { cv: malicioso });
  await completar(page);
  await page.getByTestId('optimizar').click();
  await expect(page.getByTestId('vista-previa')).toContainText('<img src=x');
  expect(await page.evaluate(() => window.hackeado)).toBeUndefined();
});

test('no carga nada de dominios externos', async ({ page }) => {
  const externos = [];
  page.on('request', (r) => { if (!r.url().startsWith('http://localhost:5173')) externos.push(r.url()); });
  await page.reload();
  await page.getByTestId('archivo-cv').setInputFiles('e2e/fixtures/cv-ejemplo.pdf');
  await expect(page.getByTestId('estado')).toContainText('CV leído');
  expect(externos).toEqual([]);
});

test('genera el CV en inglés si se elige English', async ({ page }) => {
  await simularApi(page, { cv: CV_IA });
  await completar(page);
  await page.getByText('English').click();
  const pedido = page.waitForRequest(API);
  await page.getByTestId('optimizar').click();
  expect((await pedido).postDataJSON().idioma).toBe('en');
  await expect(page.getByTestId('vista-previa')).toContainText('Experience');
  await page.getByRole('tab', { name: 'LaTeX' }).click();
  await expect(page.getByTestId('vista-latex')).toContainText('\\section*{Skills}');
});

test('permite sumar algo que faltaba y actualizar el CV', async ({ page }) => {
  await simularApi(page, { cv: CV_IA });
  await completar(page);
  await page.getByTestId('optimizar').click();
  await expect(page.getByTestId('faltantes')).toContainText('Docker');

  await page.getByRole('button', { name: '+ Docker' }).click();
  await expect(page.getByTestId('form-agregar')).toBeVisible();
  await page.getByTestId('agregar-lugar').selectOption('Analista QA — Tienda Nube');
  await page.getByTestId('agregar-detalle').fill('levanté entornos de prueba');
  await page.getByTestId('agregar-confirmar').click();

  await expect(page.getByTestId('agregados')).toContainText('Docker → Analista QA — Tienda Nube (levanté entornos de prueba)');
  await expect(page.getByTestId('actualizar')).toHaveText('Actualizar CV (1 sin aplicar)');
  await expect(page.getByTestId('faltantes')).not.toContainText('Docker');

  await page.unroute(API);
  const actualizado = { ...CV_IA, habilidades: [...CV_IA.habilidades, 'Docker'], faltantes: ['TypeScript', 'GitHub Actions'] };
  await simularApi(page, { cv: actualizado });
  const pedido = page.waitForRequest(API);
  await page.getByTestId('actualizar').click();
  const cuerpo = (await pedido).postDataJSON();
  expect(cuerpo.agregados).toEqual([{ requisito: 'Docker', lugar: 'Analista QA — Tienda Nube', detalle: 'levanté entornos de prueba' }]);
  await expect(page.getByTestId('vista-previa')).toContainText('Docker');
  await expect(page.getByTestId('avisos')).toBeHidden();
  await expect(page.getByTestId('estado-analisis')).toContainText('CV actualizado con 1 dato');
  await expect(page.getByTestId('actualizar')).toHaveText('CV actualizado ✓');
  await expect(page.getByTestId('actualizar')).toBeDisabled();
});

test('quitar un dato sumado lo devuelve a la lista de faltantes', async ({ page }) => {
  await simularApi(page, { cv: CV_IA });
  await completar(page);
  await page.getByTestId('optimizar').click();
  await page.getByRole('button', { name: '+ TypeScript' }).click();
  await page.getByTestId('agregar-lugar').selectOption('Tecnicatura en Programación — UTN');
  await page.getByTestId('agregar-confirmar').click();
  await page.getByRole('button', { name: 'Quitar TypeScript' }).click();
  await expect(page.getByTestId('faltantes')).toContainText('TypeScript');
  await expect(page.getByTestId('actualizar')).toBeHidden();
});

test('permite elegir varios faltantes a la vez y obliga a elegir dónde', async ({ page }) => {
  await simularApi(page, { cv: CV_IA });
  await completar(page);
  await page.getByTestId('optimizar').click();
  await page.getByRole('button', { name: '+ TypeScript' }).click();
  await page.getByRole('button', { name: '+ GitHub Actions' }).click();
  await expect(page.getByTestId('agregar-confirmar')).toHaveText('Agregar los 2');

  await page.getByTestId('agregar-confirmar').click(); // sin elegir dónde: no agrega
  await expect(page.getByTestId('agregados')).toBeHidden();

  await page.getByTestId('agregar-lugar').selectOption('Analista QA — Tienda Nube');
  await page.getByTestId('agregar-confirmar').click();
  await expect(page.getByTestId('agregados')).toContainText('TypeScript → Analista QA — Tienda Nube');
  await expect(page.getByTestId('agregados')).toContainText('GitHub Actions → Analista QA — Tienda Nube');
  await expect(page.getByTestId('actualizar')).toHaveText('Actualizar CV (2 sin aplicar)');
});

test('no acepta un detalle tecleado al azar', async ({ page }) => {
  await simularApi(page, { cv: CV_IA });
  await completar(page);
  await page.getByTestId('optimizar').click();
  await page.getByRole('button', { name: '+ Docker' }).click();
  await page.getByTestId('agregar-lugar').selectOption('Analista QA — Tienda Nube');
  await page.getByTestId('agregar-detalle').fill('automatice asuhfausifhuaisfagsfasf');
  await page.getByTestId('agregar-confirmar').click();
  await expect(page.getByTestId('estado-analisis')).toContainText('no parece una frase');
  await expect(page.getByTestId('agregados')).toBeHidden();
});

test('demo: sin código muestra un ejemplo y no llama a la IA', async ({ page }) => {
  let llamadas = 0;
  await page.route(API, (route) => { llamadas++; return route.abort(); });
  await expect(page.getByTestId('aviso-demo')).toBeVisible();
  await page.getByTestId('optimizar').click();
  await expect(page.getByTestId('vista-previa')).toContainText('Lucía Fernández');
  await expect(page.getByTestId('faltantes')).toContainText('Docker');

  await page.getByRole('button', { name: '+ Docker' }).click();
  await page.getByTestId('agregar-lugar').selectOption('Analista QA — Tienda Ejemplo S.A.');
  await page.getByTestId('agregar-detalle').fill('levanté entornos de prueba');
  await page.getByTestId('agregar-confirmar').click();
  await page.getByTestId('actualizar').click();
  await expect(page.getByTestId('vista-previa')).toContainText('Levanté entornos de prueba (Docker).');
  expect(llamadas).toBe(0);
});

test('demo: con un CV propio avisa que la IA real está apagada', async ({ page }) => {
  let llamadas = 0;
  await page.route(API, (route) => { llamadas++; return route.abort(); });
  await page.getByTestId('archivo-cv').setInputFiles('e2e/fixtures/cv-ejemplo.txt');
  await expect(page.getByTestId('estado')).toContainText('CV leído');
  await page.getByTestId('optimizar').click();
  await expect(page.getByTestId('estado')).toContainText('la IA real está apagada');
  expect(llamadas).toBe(0);
});

test('demo: con un código se activa la IA real y se puede volver', async ({ page }) => {
  await page.getByTestId('boton-codigo').click();
  await page.getByTestId('codigo').fill('mi-codigo');
  await page.getByRole('button', { name: 'Activar IA' }).click();
  await expect(page.getByTestId('aviso-real')).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem('cv-ats-codigo'))).toBe('mi-codigo');
  await page.getByRole('button', { name: 'Volver a la demo' }).click();
  await expect(page.getByTestId('aviso-demo')).toBeVisible();
});

test('demo: un código incorrecto vuelve al modo demo', async ({ page }) => {
  await page.route(API, (route) => route.fulfill({ status: 401, contentType: 'application/json',
    body: JSON.stringify({ error: 'Código de acceso inválido. La web pública funciona en modo demo.', demo: true }) }));
  await page.evaluate(() => localStorage.setItem('cv-ats-codigo', 'malo'));
  await page.reload();
  await completar(page);
  await page.getByTestId('optimizar').click();
  await expect(page.getByTestId('estado')).toContainText('Código de acceso inválido');
  await expect(page.getByTestId('aviso-demo')).toBeVisible();
});

test('el formulario para sumar se cierra después de agregar', async ({ page }) => {
  await simularApi(page, { cv: CV_IA });
  await completar(page);
  await page.getByTestId('optimizar').click();
  await page.getByRole('button', { name: '+ Docker' }).click();
  await page.getByTestId('agregar-lugar').selectOption('Analista QA — Tienda Nube');
  await page.getByTestId('agregar-confirmar').click();
  await expect(page.getByTestId('form-agregar')).toBeHidden();
});
