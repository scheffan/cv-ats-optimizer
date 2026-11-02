// Instrucciones para el modelo. La regla de oro: no inventar nada y mantener la voz del original.

export const LIMITE_CV = 15000;
export const LIMITE_OFERTA = 8000;

export const INSTRUCCIONES = `Sos un especialista en selección de personal y en sistemas ATS.
Vas a recibir el CV de una persona y una oferta laboral. Tu trabajo es reescribir el CV para esa oferta.

Reglas que no se negocian:
1. No inventes nada. Cada empresa, puesto, fecha, título, herramienta, número y logro tiene que estar en el CV original. Si la oferta pide algo que el CV no tiene, NO lo agregues: anotalo en "faltantes".
2. Mantené el tono de la persona: misma persona gramatical, mismo registro (formal o informal), mismo idioma y el mismo estilo de verbos. Reordená y ajustá, pero que suene a quien lo escribió, no a una plantilla.
3. No copies frases de la oferta. Solo podés usar sus palabras clave cuando describen algo que el CV ya demuestra.
4. Priorizá lo que coincide con la oferta: ponelo primero, con verbos de acción y resultados concretos si el original los tiene.
5. Una sola columna, sin tablas, sin íconos y sin emojis. Texto plano que un ATS pueda leer.
6. Las fechas se copian tal cual aparecen en el original.

Respondé SOLO con un objeto JSON con esta forma:
{
  "nombre": "string",
  "contacto": ["email", "teléfono", "ciudad", "linkedin u otros enlaces"],
  "resumen": "2 a 4 oraciones",
  "experiencia": [{"titulo": "puesto", "lugar": "empresa", "fechas": "tal cual el original", "logros": ["..."]}],
  "educacion": [{"titulo": "carrera o curso", "lugar": "institución", "fechas": "...", "logros": []}],
  "habilidades": ["..."],
  "otros": ["idiomas, certificaciones, proyectos u otros datos del original"],
  "coincidencias": ["palabras clave de la oferta que el CV sí demuestra"],
  "faltantes": ["requisitos de la oferta que el CV no menciona"]
}`;

export function armarMensajes(cv, oferta) {
  return [
    { role: 'system', content: INSTRUCCIONES },
    { role: 'user', content: `CV ORIGINAL:\n"""\n${cv}\n"""\n\nOFERTA LABORAL:\n"""\n${oferta}\n"""` },
  ];
}

export function validarEntrada(datos) {
  const cv = typeof datos?.cv === 'string' ? datos.cv.trim() : '';
  const oferta = typeof datos?.oferta === 'string' ? datos.oferta.trim() : '';
  if (cv.length < 200) return { error: 'El CV es muy corto o no se pudo leer.' };
  if (oferta.length < 80) return { error: 'Pegá la descripción completa de la oferta.' };
  if (cv.length > LIMITE_CV) return { error: `El CV supera los ${LIMITE_CV} caracteres.` };
  if (oferta.length > LIMITE_OFERTA) return { error: `La oferta supera los ${LIMITE_OFERTA} caracteres.` };
  return { cv, oferta };
}

const LISTAS = ['contacto', 'experiencia', 'educacion', 'habilidades', 'otros', 'coincidencias', 'faltantes'];

// Normaliza lo que devuelve el modelo para que el front no reciba sorpresas.
export function normalizarCv(crudo) {
  const cv = typeof crudo === 'object' && crudo ? crudo : {};
  const salida = { nombre: String(cv.nombre ?? '').trim(), resumen: String(cv.resumen ?? '').trim() };
  for (const clave of LISTAS) salida[clave] = Array.isArray(cv[clave]) ? cv[clave] : [];
  for (const clave of ['experiencia', 'educacion']) {
    salida[clave] = salida[clave]
      .filter((e) => e && typeof e === 'object')
      .map((e) => ({
        titulo: String(e.titulo ?? ''), lugar: String(e.lugar ?? ''), fechas: String(e.fechas ?? ''),
        logros: Array.isArray(e.logros) ? e.logros.map(String) : [],
      }));
  }
  for (const clave of ['contacto', 'habilidades', 'otros', 'coincidencias', 'faltantes']) {
    salida[clave] = salida[clave].map(String).filter((s) => s.trim());
  }
  if (!salida.nombre && !salida.experiencia.length) throw new Error('Respuesta incompleta del modelo');
  return salida;
}
