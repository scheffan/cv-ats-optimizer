// Detecta texto tecleado al azar ("asdfgh", "ausasigfasuia") en el detalle que escribe la persona,
// para no mandarle a la IA algo sin sentido que termine "rellenando".

const BIGRAMAS_RAROS = /hf|fh|sf|fs|gf|fg|hj|jh|jf|fj|vf|fv|zf|fz|kf|fk|sg|gsf|qw|wq|xz|zx|jk|kj|dfg|sdf|asd|ghj|hjk|jkl/g;

export function pareceSinSentido(texto) {
  const palabras = String(texto ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').match(/[a-zñ]+/g) ?? [];
  return palabras.some((p) => {
    if (p.length < 7) return false;
    const raros = (p.match(BIGRAMAS_RAROS) ?? []).length;
    const sinVocales = /[^aeiou]{5,}/.test(p);
    return raros >= 2 || sinVocales;
  });
}
