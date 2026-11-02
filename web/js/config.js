// En local usa el Worker de `wrangler dev`; publicado, el de Cloudflare.
// La URL de producción la completa el workflow "Publicar" con la que devuelve Cloudflare.
const enLocal = ['localhost', '127.0.0.1'].includes(location.hostname);

export const API_URL = enLocal
  ? 'http://localhost:8787/optimizar'
  : 'https://cv-ats-optimizer.scheffan.workers.dev/optimizar';
export const OLLAMA_URL = 'http://localhost:11434/api/chat';
export const OLLAMA_MODELO = 'llama3.1:8b';
