// Modo demo: la web pública muestra un ejemplo con datos ficticios y una respuesta grabada,
// así se puede ver cómo funciona sin gastar la cuota de la IA.

export const CV_DEMO = `Lucía Fernández
lucia.fernandez@ejemplo.com | +54 11 0000-0000 | Rosario, Santa Fe | linkedin.com/in/lucia-ejemplo

Perfil
Soy analista QA con 3 años de experiencia en aplicaciones web. Me gusta encontrar errores antes que el usuario y automatizar lo repetitivo para que el equipo se enfoque en lo importante.

Experiencia
Analista QA - Tienda Ejemplo S.A. - 2022 a 2025
- Automaticé 120 casos de regresión con Playwright y bajé el tiempo de pruebas un 40%.
- Documenté y prioricé bugs en Jira junto al equipo de desarrollo.
- Probé APIs REST con Postman antes de cada release.

Tester Manual (pasantía) - Software Demo SRL - 2021 a 2022
- Ejecuté casos de prueba funcionales en una app de turnos médicos.
- Armé la primera matriz de pruebas del equipo.

Educación
Tecnicatura en Programación - Instituto Ejemplo - 2019 a 2021

Proyectos
Bot de reportes en Python - 2024
- Script que junta los resultados de las pruebas y manda un resumen diario por correo.

Habilidades: Playwright, JavaScript, Postman, SQL, Jira, Git, Python
Idiomas: inglés intermedio (B1)`;

export const OFERTA_DEMO = `QA Automation Semi Senior - Empresa de e-commerce (ejemplo)
Buscamos una persona para sumarse al equipo de calidad de nuestra plataforma de compras online.
Requisitos: experiencia con Playwright o Cypress, JavaScript o TypeScript, pruebas de API con Postman, SQL para validar datos y trabajo con metodologías ágiles.
Deseable: CI/CD con GitHub Actions, Docker y experiencia en sistemas de pagos.`;

const BASE = {
  es: {
    nombre: 'Lucía Fernández',
    contacto: ['lucia.fernandez@ejemplo.com', '+54 11 0000-0000', 'Rosario, Santa Fe', 'linkedin.com/in/lucia-ejemplo'],
    resumen: 'Soy analista QA con 3 años de experiencia en aplicaciones web de comercio electrónico. Automatizo pruebas con Playwright y valido APIs con Postman, para encontrar errores antes que el usuario y que el equipo se enfoque en lo importante.',
    experiencia: [
      { titulo: 'Analista QA', lugar: 'Tienda Ejemplo S.A.', fechas: '2022 a 2025', logros: [
        'Automaticé 120 casos de regresión con Playwright y bajé el tiempo de pruebas un 40%.',
        'Probé APIs REST con Postman antes de cada release.',
        'Documenté y prioricé bugs en Jira junto al equipo de desarrollo.'] },
      { titulo: 'Tester Manual (pasantía)', lugar: 'Software Demo SRL', fechas: '2021 a 2022', logros: [
        'Ejecuté casos de prueba funcionales en una app de turnos médicos.',
        'Armé la primera matriz de pruebas del equipo.'] },
    ],
    educacion: [{ titulo: 'Tecnicatura en Programación', lugar: 'Instituto Ejemplo', fechas: '2019 a 2021', logros: [] }],
    proyectos: [{ titulo: 'Bot de reportes en Python', lugar: '', fechas: '2024', logros: ['Script que junta los resultados de las pruebas y manda un resumen diario por correo.'] }],
    habilidades: ['Playwright', 'JavaScript', 'Postman', 'SQL', 'Jira', 'Git', 'Python'],
    otros: ['Inglés intermedio (B1)'],
    coincidencias: ['Playwright', 'JavaScript', 'Postman', 'SQL'],
    faltantes: ['TypeScript', 'Metodologías ágiles', 'GitHub Actions', 'Docker', 'Sistemas de pagos'],
  },
  en: {
    nombre: 'Lucía Fernández',
    contacto: ['lucia.fernandez@ejemplo.com', '+54 11 0000-0000', 'Rosario, Santa Fe', 'linkedin.com/in/lucia-ejemplo'],
    resumen: 'QA analyst with 3 years of experience in e-commerce web applications. I automate tests with Playwright and validate APIs with Postman, catching bugs before users do so the team can focus on what matters.',
    experiencia: [
      { titulo: 'QA Analyst', lugar: 'Tienda Ejemplo S.A.', fechas: '2022 – 2025', logros: [
        'Automated 120 regression test cases with Playwright, cutting testing time by 40%.',
        'Tested REST APIs with Postman before every release.',
        'Documented and prioritized bugs in Jira together with the development team.'] },
      { titulo: 'Manual Tester (internship)', lugar: 'Software Demo SRL', fechas: '2021 – 2022', logros: [
        'Ran functional test cases on a medical appointments app.',
        "Built the team's first test matrix."] },
    ],
    educacion: [{ titulo: 'Programming Technical Degree', lugar: 'Instituto Ejemplo', fechas: '2019 – 2021', logros: [] }],
    proyectos: [{ titulo: 'Python reporting bot', lugar: '', fechas: '2024', logros: ['Script that gathers test results and emails a daily summary.'] }],
    habilidades: ['Playwright', 'JavaScript', 'Postman', 'SQL', 'Jira', 'Git', 'Python'],
    otros: ['English: intermediate (B1)'],
    coincidencias: ['Playwright', 'JavaScript', 'Postman', 'SQL'],
    faltantes: ['TypeScript', 'Agile methodologies', 'GitHub Actions', 'Docker', 'Payment systems'],
  },
};

const etiqueta = (e) => [e.titulo, e.lugar].filter(Boolean).join(' — ');

// Simula la respuesta de la IA, incluyendo lo que la persona sumó.
export function respuestaDemo(idioma = 'es', agregados = []) {
  const cv = structuredClone(BASE[idioma] ?? BASE.es);
  for (const a of agregados) {
    const destino = [...cv.experiencia, ...cv.proyectos, ...cv.educacion].find((e) => etiqueta(e) === a.lugar);
    const texto = a.detalle
      ? `${a.detalle.charAt(0).toUpperCase()}${a.detalle.slice(1)} (${a.requisito}).`
      : (idioma === 'en' ? `Worked with ${a.requisito}.` : `Trabajé con ${a.requisito}.`);
    if (destino) destino.logros.push(texto);
    else cv.otros.push(texto);
    if (!cv.habilidades.includes(a.requisito)) cv.habilidades.push(a.requisito);
    cv.faltantes = cv.faltantes.filter((f) => f !== a.requisito);
    cv.coincidencias.push(a.requisito);
  }
  return cv;
}

export const esperar = (ms) => new Promise((r) => setTimeout(r, ms));
