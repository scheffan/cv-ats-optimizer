# CV ATS Optimizer

[![Tests](https://github.com/scheffan/cv-ats-optimizer/actions/workflows/tests.yml/badge.svg)](https://github.com/scheffan/cv-ats-optimizer/actions/workflows/tests.yml)
[![Publicar web](https://github.com/scheffan/cv-ats-optimizer/actions/workflows/pages.yml/badge.svg)](https://github.com/scheffan/cv-ats-optimizer/actions/workflows/pages.yml)
![Licencia MIT](https://img.shields.io/badge/licencia-MIT-blue)

Web gratuita para adaptar tu CV a una oferta laboral puntual. Subís tu CV, pegás la publicación y en unos segundos tenés una versión de una columna, en LaTeX y PDF, pensada para pasar los filtros ATS.

**Probalo acá:** https://scheffan.github.io/cv-ats-optimizer/

![Captura de la app](docs/captura.png)

## Qué hace

- Lee tu CV en PDF, DOCX o TXT **dentro del navegador** (el archivo no se sube a ningún lado).
- Cruza el CV con la oferta usando Llama 3.3 70B y reordena todo para priorizar lo que coincide.
- Mantiene tu tono: misma persona, mismo registro y mismo idioma. La idea es que cada CV siga sonando a vos y no a una plantilla.
- **No inventa nada.** Lo que la oferta pide y tu CV no tiene aparece aparte, como "faltantes", para que decidas vos.
- Además, un control propio revisa el resultado y avisa si aparece una empresa, fecha o número que no estaba en tu original.
- Exporta a PDF, a `.tex` o lo abre directo en Overleaf.

## Privacidad

No hay base de datos, ni cuentas, ni registros. El texto del CV viaja solo para procesarse: el Worker no guarda nada, responde con `Cache-Control: no-store` y tiene los logs desactivados. Las librerías se sirven desde el mismo sitio, sin CDNs ni analíticas de terceros (hay un test E2E que lo verifica).

Si querés que no salga nada de tu compu, usá el **modo local** con Ollama.

## Cómo está armado

```
Navegador (GitHub Pages)                 Cloudflare Worker              Groq
┌──────────────────────────┐   texto    ┌──────────────────────┐       ┌──────────────┐
│ pdf.js / mammoth: lee CV │ ─────────> │ valida y limita x IP │ ────> │ Llama 3.3 70B│
│ arma LaTeX y PDF         │ <───────── │ clave API escondida  │ <──── │ (JSON)       │
│ verifica que no invente  │    JSON    │ no guarda nada       │       └──────────────┘
└──────────────────────────┘            └──────────────────────┘
```

- **Front:** HTML, CSS y JavaScript sin frameworks, publicado en GitHub Pages.
- **Back:** un Cloudflare Worker (plan gratis) que guarda la clave de Groq como secreto, acepta solo pedidos de la web y limita a 5 pedidos por minuto por IP. Si se agota la cuota del modelo grande, pasa a Llama 3.1 8B.
- **IA:** la API gratuita de Groq. El modelo devuelve JSON y la plantilla LaTeX se arma en el navegador, así el formato siempre sale prolijo y escapado.

## Tests

| Tipo | Qué cubre | Cantidad |
|---|---|---|
| Unitarios (`node:test`) | Escapado LaTeX, instrucciones, validación, normalización, detector de datos inventados, PDF y Worker (CORS, límite por IP, cambio de modelo, errores) | 21 |
| E2E (Playwright, escritorio y celular) | Lectura de PDF real, flujo completo, descargas, aviso de datos inventados, errores, XSS y que no se carguen dominios externos | 16 |
| LaTeX (CI) | Compila la plantilla con `pdflatex`, incluso con caracteres como `# & % _ \` | 1 |

```bash
npm ci
npm test            # unitarios
npm run test:e2e    # Playwright
```

## Correrlo en tu compu

```bash
npm ci
npm run dev         # web en http://localhost:5173
```

**Con Groq:** creá una clave gratis en https://console.groq.com/keys, copiá `worker/.dev.vars.example` como `worker/.dev.vars` y en otra terminal corré `cd worker && npx wrangler dev`.

**Con Ollama (100% local):**

```bash
ollama pull llama3.1:8b
# Windows (PowerShell), para que el navegador pueda hablar con Ollama:
setx OLLAMA_ORIGINS "http://localhost:5173,https://scheffan.github.io"
```

Reiniciá Ollama y elegí "Local" en la web.

## Publicarlo

1. **Worker:** `cd worker && npx wrangler login && npx wrangler secret put GROQ_API_KEY && npx wrangler deploy`. Copiá la URL que te da y ponela en `web/js/config.js`.
2. **Web:** en GitHub, Settings > Pages > Source: GitHub Actions. Cada push a `main` la publica.

## Licencia

MIT
