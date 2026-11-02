// Servidor estático mínimo para probar la web en local (sin dependencias).
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';

const RAIZ = join(import.meta.dirname, '..', 'web');
const PUERTO = Number(process.env.PUERTO ?? 5173);
const TIPOS = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml' };

createServer(async (req, res) => {
  const ruta = normalize(decodeURIComponent(new URL(req.url, 'http://x').pathname)).replace(/^(\.\.[/\\])+/, '');
  const archivo = join(RAIZ, ruta.endsWith('/') ? `${ruta}index.html` : ruta);
  try {
    const contenido = await readFile(archivo);
    res.writeHead(200, { 'Content-Type': `${TIPOS[extname(archivo)] ?? 'application/octet-stream'}; charset=utf-8` });
    res.end(contenido);
  } catch {
    res.writeHead(404).end('No encontrado');
  }
}).listen(PUERTO, () => console.log(`Web en http://localhost:${PUERTO}`));
