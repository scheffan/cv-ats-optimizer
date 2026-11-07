// Pide el CV optimizado: al Worker (online) o a Ollama en tu propia compu (modo local).
import { API_URL, OLLAMA_URL, OLLAMA_MODELO } from './config.js';
import { armarMensajes, validarEntrada, normalizarCv } from './prompt.js';

export async function optimizar(cv, oferta, { modo = 'online', idioma = 'es', agregados = [] } = {}) {
  const entrada = validarEntrada({ cv, oferta, idioma, agregados });
  if (entrada.error) throw new Error(entrada.error);
  return modo === 'local' ? conOllama(entrada) : conWorker(entrada);
}

async function conWorker({ cv, oferta, idioma, agregados }) {
  const r = await fetch(API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ cv, oferta, idioma, agregados }),
  });
  const datos = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(datos.error ?? 'No se pudo conectar con el servicio.');
  return datos.cv;
}

async function conOllama({ cv, oferta, idioma, agregados }) {
  let r;
  try {
    r = await fetch(OLLAMA_URL, {
      method: 'POST',
      body: JSON.stringify({
        model: OLLAMA_MODELO, messages: armarMensajes(cv, oferta, idioma, agregados), format: 'json', stream: false,
        options: { temperature: 0.4 },
      }),
    });
  } catch {
    throw new Error('No encontré Ollama en localhost:11434. ¿Está abierto y con OLLAMA_ORIGINS configurado?');
  }
  if (!r.ok) throw new Error(`Ollama respondió ${r.status}. ¿Descargaste el modelo ${OLLAMA_MODELO}?`);
  const datos = await r.json();
  return normalizarCv(JSON.parse(datos.message.content));
}
