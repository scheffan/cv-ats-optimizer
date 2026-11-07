import { test, expect } from '@playwright/test';
import { CV_ORIGINAL, OFERTA, CV_IA } from '../tests/datos.js';

const API = '**/optimizar';

function simularApi(page, cuerpo, estado = 200) {
  return page.route(API, (route) => route.fulfill({ status: estado, contentType: 'application/json', body: JSON.stringify(cuerpo) }));
}

async function completar(page) {
  await page.getByTestId('archivo-cv').setInputFiles('e2e/fixtures/cv-ejemplo.txt');
  await expect(page.getByRole('status')).toContainText('CV leído');
  await page.getByTestId('oferta').fill(OFERTA);
}

test.beforeEach(async ({ page }) => { await page.goto('/'); });

test('lee el texto de un CV en PDF dentro del navegador', async ({ page }) => {
  await page.getByTestId('archivo-cv').setInputFiles('e2e/fixtures/cv-ejemplo.pdf');
  await expect(page.getByRole('status')).toContainText('CV leído');
  await expect(page.getByTestId('texto-cv')).toHaveValue(/Tienda Nube/);
});

test('flujo completo: optimiza, muestra la vista previa y el LaTeX', async ({ page }) => {
  await simularApi(page, { cv: CV_IA });
  await completar(page);
  const pedido = page.waitForRequest(API);
  await page.getByTestId('optimizar').click();
  const cuerpo = (await pedido).postDataJSON();
  expect(cuerpo.cv).toContain('Tienda Nube');
  expect(Object.keys(cuerpo).sort()).toEqual(['cv', 'idioma', 'oferta']); // solo viaja el texto, nada más

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
  await expect(page.getByRole('status')).toContainText('Muchos pedidos seguidos');
});

test('no llama a la IA si falta la oferta', async ({ page }) => {
  let llamadas = 0;
  await page.route(API, (route) => { llamadas++; return route.abort(); });
  await page.getByText('Ver o corregir el texto leído').click();
  await page.getByTestId('texto-cv').fill(CV_ORIGINAL);
  await page.getByTestId('optimizar').click();
  await expect(page.getByRole('status')).toContainText('Pegá la descripción completa');
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
  await expect(page.getByRole('status')).toContainText('CV leído');
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
