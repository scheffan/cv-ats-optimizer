// Worker de Cloudflare: recibe el texto del CV y la oferta, llama a un modelo abierto en Groq y devuelve el CV ordenado.
// No guarda nada: no hay base de datos y nunca se loguea el contenido.
import { armarMensajes, validarEntrada, normalizarCv } from '../../web/js/prompt.js';

const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';
const MAX_BYTES = 40_000;
// Uso gratis por persona y por día: 1 CV nuevo y hasta 2 actualizaciones con datos sumados.
export const LIMITE_DIARIO = { optimizar: 1, actualizar: 2 };
const TOPE_GLOBAL_POR_DEFECTO = 150;
const DOS_DIAS = 172_800;

// La IP nunca se guarda: solo un hash con sal secreta, que además vence a las 48 h.
export async function huellaAnonima(ip, sal) {
  const datos = new TextEncoder().encode(`${sal}|${ip}`);
  const hash = await crypto.subtle.digest('SHA-256', datos);
  return [...new Uint8Array(hash)].slice(0, 16).map((b) => b.toString(16).padStart(2, '0')).join('');
}

async function revisarCupo(env, ip, tipo) {
  const dia = new Date().toISOString().slice(0, 10);
  const persona = `${dia}:${tipo}:${await huellaAnonima(ip, env.CODIGO_ACCESO ?? 'cv-ats')}`;
  const global = `${dia}:global`;
  const [usados, total] = await Promise.all([env.USOS.get(persona), env.USOS.get(global)]);
  const tope = Number(env.TOPE_GLOBAL ?? TOPE_GLOBAL_POR_DEFECTO);
  if (Number(total ?? 0) >= tope) return { error: 'Hoy se agotaron los usos gratis de todos. Volvé mañana o mirá el ejemplo.' };
  if (Number(usados ?? 0) >= LIMITE_DIARIO[tipo]) {
    return { error: tipo === 'optimizar'
      ? 'Ya usaste tu CV gratis de hoy. Volvé mañana o mirá el ejemplo.'
      : 'Ya usaste las actualizaciones gratis de hoy. Volvé mañana.' };
  }
  return {
    // Se descuenta solo si la IA respondió bien.
    descontar: () => Promise.all([
      env.USOS.put(persona, String(Number(usados ?? 0) + 1), { expirationTtl: DOS_DIAS }),
      env.USOS.put(global, String(Number(total ?? 0) + 1), { expirationTtl: DOS_DIAS }),
    ]),
  };
}
// Groq retira modelos seguido: la lista se puede cambiar en wrangler.toml (MODELOS) sin tocar código.
const MODELOS_POR_DEFECTO = ['openai/gpt-oss-120b', 'openai/gpt-oss-20b'];

export function listaModelos(env) {
  const propios = (env.MODELOS ?? '').split(',').map((m) => m.trim()).filter(Boolean);
  return propios.length ? propios : MODELOS_POR_DEFECTO;
}

// Saca el objeto JSON aunque el modelo lo envuelva en ```json o le agregue texto.
export function extraerJson(texto) {
  const limpio = String(texto ?? '').replace(/```(?:json)?/gi, '');
  const inicio = limpio.indexOf('{');
  const fin = limpio.lastIndexOf('}');
  if (inicio === -1 || fin <= inicio) throw new Error('Sin JSON');
  return JSON.parse(limpio.slice(inicio, fin + 1));
}

function cabecerasCors(origen, env) {
  const permitidos = (env.ORIGENES_PERMITIDOS ?? '').split(',').map((o) => o.trim()).filter(Boolean);
  const ok = permitidos.includes(origen);
  return {
    'Access-Control-Allow-Origin': ok ? origen : permitidos[0] ?? 'null',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, X-Codigo-Acceso',
    'Vary': 'Origin',
  };
}

// Compara en tiempo constante para no filtrar el código por diferencias de tiempo.
export function codigoValido(recibido, esperado) {
  if (!esperado || typeof recibido !== 'string') return false;
  const a = new TextEncoder().encode(recibido);
  const b = new TextEncoder().encode(esperado);
  let diferencia = a.length ^ b.length;
  for (let i = 0; i < b.length; i++) diferencia |= (a[i] ?? 0) ^ b[i];
  return diferencia === 0;
}

function responder(cuerpo, estado, cors) {
  return new Response(JSON.stringify(cuerpo), {
    status: estado,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', ...cors },
  });
}

async function llamarGroq(mensajes, env, modelo) {
  const cuerpo = {
    model: modelo, messages: mensajes, temperature: 0.4, max_completion_tokens: 6000,
    response_format: { type: 'json_object' },
  };
  if (modelo.startsWith('openai/gpt-oss')) cuerpo.reasoning_effort = 'low';
  return fetch(GROQ_URL, {
    method: 'POST',
    headers: { Authorization: `Bearer ${env.GROQ_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(cuerpo),
  });
}

export default {
  async fetch(request, env) {
    const origen = request.headers.get('Origin') ?? '';
    const cors = cabecerasCors(origen, env);
    const url = new URL(request.url);

    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
    if (url.pathname !== '/optimizar' || request.method !== 'POST') {
      return responder({ error: 'No encontrado' }, 404, cors);
    }
    if (cors['Access-Control-Allow-Origin'] !== origen) {
      return responder({ error: 'Origen no permitido' }, 403, cors);
    }

    // Con código (el dueño) no hay límite diario; un código mal escrito se rechaza para que se note.
    const codigo = request.headers.get('X-Codigo-Acceso') ?? '';
    const esDueno = codigoValido(codigo, env.CODIGO_ACCESO);
    if (codigo && !esDueno) return responder({ error: 'Código de acceso inválido.', codigoInvalido: true }, 401, cors);

    // Límite por IP (binding de Rate Limiting de Cloudflare, no guarda datos del usuario).
    if (env.LIMITADOR) {
      const ip = request.headers.get('CF-Connecting-IP') ?? 'desconocida';
      const { success } = await env.LIMITADOR.limit({ key: ip });
      if (!success) return responder({ error: 'Muchos pedidos seguidos. Probá de nuevo en un minuto.' }, 429, cors);
    }

    // Cortamos pedidos gigantes antes de procesarlos (CV + oferta + datos sumados entran de sobra).
    const largo = Number(request.headers.get('Content-Length') ?? 0);
    if (largo > MAX_BYTES) return responder({ error: 'El pedido es demasiado grande.' }, 413, cors);
    const crudo = await request.text();
    if (crudo.length > MAX_BYTES) return responder({ error: 'El pedido es demasiado grande.' }, 413, cors);
    let datos;
    try { datos = JSON.parse(crudo); } catch { return responder({ error: 'JSON inválido' }, 400, cors); }
    const entrada = validarEntrada(datos);
    if (entrada.error) return responder({ error: entrada.error }, 400, cors);

    let cupo = null;
    if (!esDueno) {
      if (!env.USOS) return responder({ error: 'El uso gratis no está disponible ahora.' }, 503, cors);
      const ip = request.headers.get('CF-Connecting-IP') ?? 'desconocida';
      cupo = await revisarCupo(env, ip, entrada.agregados.length ? 'actualizar' : 'optimizar');
      if (cupo.error) return responder({ error: cupo.error, limiteDiario: true }, 429, cors);
    }

    const mensajes = armarMensajes(entrada.cv, entrada.oferta, entrada.idioma, entrada.agregados);
    let ultimoEstado = 0;
    let cuotaAgotada = false;
    for (const modelo of listaModelos(env)) {
      const r = await llamarGroq(mensajes, env, modelo);
      ultimoEstado = r.status;
      if (r.status === 401) return responder({ error: 'La clave de Groq no es válida.' }, 502, cors);
      if (r.status === 429) { cuotaAgotada = true; continue; }
      if (!r.ok) continue; // modelo retirado o caído: probamos con el siguiente
      try {
        const json = await r.json();
        const cv = normalizarCv(extraerJson(json.choices[0].message.content));
        if (cupo) await cupo.descontar();
        return responder({ cv, modelo }, 200, cors);
      } catch {
        continue; // respuesta inválida: probamos con el siguiente
      }
    }
    if (cuotaAgotada) return responder({ error: 'Se agotó la cuota gratuita de hoy. Probá mañana o usá el modo local.' }, 503, cors);
    return responder({ error: `El servicio de IA no respondió (código ${ultimoEstado}). Probá más tarde.` }, 502, cors);
  },
};
