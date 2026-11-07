// Idiomas en los que se puede generar el CV y los títulos de cada sección.
export const IDIOMAS = {
  es: { nombre: 'español', titulos: { perfil: 'Perfil', experiencia: 'Experiencia', educacion: 'Educación', proyectos: 'Proyectos', habilidades: 'Habilidades', otros: 'Otros' } },
  en: { nombre: 'inglés', titulos: { perfil: 'Profile', experiencia: 'Experience', educacion: 'Education', proyectos: 'Projects', habilidades: 'Skills', otros: 'Additional information' } },
};

export function titulos(cv) {
  return (IDIOMAS[cv?.idioma] ?? IDIOMAS.es).titulos;
}
