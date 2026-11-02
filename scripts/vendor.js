// Copia las librerías del navegador a web/vendor para servirlas desde el mismo sitio (sin CDNs de terceros).
import { cpSync, mkdirSync } from 'node:fs';

const archivos = {
  'node_modules/pdfjs-dist/build/pdf.min.mjs': 'pdf.min.mjs',
  'node_modules/pdfjs-dist/build/pdf.worker.min.mjs': 'pdf.worker.min.mjs',
  'node_modules/mammoth/mammoth.browser.min.js': 'mammoth.browser.min.js',
  'node_modules/pdfmake/build/pdfmake.min.js': 'pdfmake.min.js',
  'node_modules/pdfmake/build/vfs_fonts.js': 'vfs_fonts.js',
};
mkdirSync('web/vendor', { recursive: true });
for (const [origen, destino] of Object.entries(archivos)) cpSync(origen, `web/vendor/${destino}`);
console.log(`Copiadas ${Object.keys(archivos).length} librerías a web/vendor`);
