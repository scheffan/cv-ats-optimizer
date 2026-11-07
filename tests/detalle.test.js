import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pareceSinSentido } from '../web/js/detalle.js';

test('detecta texto tecleado al azar', () => {
  for (const t of ['automatice asuhfausifhuaisfagsfasf', 'asdfasdfasdf', 'ausasigfasuia fhsjdkf', 'qwertyqwerty', 'xkcdbnmrt']) {
    assert.equal(pareceSinSentido(t), true, t);
  }
});

test('acepta frases reales en español e inglés', () => {
  for (const t of ['automaticé las pruebas de regresión con Playwright', 'levanté entornos de prueba con Docker',
    'responsabilidades de testing en GitHub Actions', 'automated end-to-end tests for the checkout flow',
    'transformaciones y procesamiento de datos', '', 'SQL']) {
    assert.equal(pareceSinSentido(t), false, t);
  }
});
