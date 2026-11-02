// Lee el CV en el navegador. El archivo nunca se sube: solo se extrae el texto.
import * as pdfjs from '../vendor/pdf.min.mjs';

pdfjs.GlobalWorkerOptions.workerSrc = new URL('../vendor/pdf.worker.min.mjs', import.meta.url).href;

export const TAMANO_MAXIMO = 5 * 1024 * 1024;

export async function leerCv(archivo) {
  if (archivo.size > TAMANO_MAXIMO) throw new Error('El archivo pesa más de 5 MB.');
  const nombre = archivo.name.toLowerCase();
  if (nombre.endsWith('.pdf')) return leerPdf(archivo);
  if (nombre.endsWith('.docx')) return leerDocx(archivo);
  if (nombre.endsWith('.txt') || nombre.endsWith('.md')) return (await archivo.text()).trim();
  throw new Error('Formato no soportado. Usá PDF, DOCX o TXT.');
}

async function leerPdf(archivo) {
  const pdf = await pdfjs.getDocument({ data: await archivo.arrayBuffer() }).promise;
  const paginas = [];
  for (let i = 1; i <= pdf.numPages; i++) {
    const pagina = await pdf.getPage(i);
    const { items } = await pagina.getTextContent();
    let texto = '';
    for (const item of items) texto += item.str + (item.hasEOL ? '\n' : ' ');
    paginas.push(texto);
  }
  const texto = paginas.join('\n').replace(/[ \t]+/g, ' ').trim();
  if (texto.length < 50) throw new Error('No se pudo leer texto del PDF. ¿Es una imagen escaneada?');
  return texto;
}

async function leerDocx(archivo) {
  const { value } = await window.mammoth.extractRawText({ arrayBuffer: await archivo.arrayBuffer() });
  return value.trim();
}
