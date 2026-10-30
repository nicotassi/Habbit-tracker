import { useEffect, useState } from 'react';

// Rutas como "#nombre" o "#nombre-argumento" (el visor solo conserva hashes simples).
export function navigate(path: string) {
  const [name, ...rest] = path.replace(/^\/+/, '').split('/');
  window.location.hash = rest.length ? `${name}-${rest.join('-')}` : name;
  scrollToTop();
}

/** En celular el contenido scrollea dentro de <main>; en escritorio, la ventana. */
export function scrollToTop() {
  window.scrollTo({ top: 0 });
  document.querySelector('.main')?.scrollTo({ top: 0 });
}

export function useRoute(): string[] {
  const parse = () => {
    const h = window.location.hash.replace(/^#\/?/, '');
    const i = h.indexOf('-');
    return i === -1 ? (h ? [h] : []) : [h.slice(0, i), h.slice(i + 1)];
  };
  const [r, setR] = useState(parse);
  useEffect(() => {
    const f = () => setR(parse());
    window.addEventListener('hashchange', f);
    return () => window.removeEventListener('hashchange', f);
  }, []);
  return r;
}
