import { useEffect, useState } from 'react';

export function navigate(path: string) {
  window.location.hash = '/' + path.replace(/^\/+/, '');
  window.scrollTo({ top: 0 });
}

export function useRoute(): string[] {
  const parse = () => window.location.hash.replace(/^#\/?/, '').split('/').filter(Boolean);
  const [r, setR] = useState(parse);
  useEffect(() => {
    const f = () => setR(parse());
    window.addEventListener('hashchange', f);
    return () => window.removeEventListener('hashchange', f);
  }, []);
  return r;
}
