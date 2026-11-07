// Código de acceso a la IA real. Se guarda solo en este navegador.
const CLAVE = 'cv-ats-codigo';

export function leerCodigo() {
  try { return localStorage.getItem(CLAVE) ?? ''; } catch { return ''; }
}

export function guardarCodigo(codigo) {
  try {
    if (codigo) localStorage.setItem(CLAVE, codigo);
    else localStorage.removeItem(CLAVE);
  } catch { /* sin almacenamiento: queda en modo demo */ }
}
