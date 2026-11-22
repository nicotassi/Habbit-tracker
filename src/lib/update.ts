import { create } from 'zustand';

/** El archivo principal de esta versión (el nombre cambia con cada versión publicada). */
const currentScript = () => document.querySelector<HTMLScriptElement>('script[type="module"][src*="assets/index-"]')?.getAttribute('src')?.replace(/^\.\//, '') ?? null;

export const useUpdate = create<{ available: boolean }>(() => ({ available: false }));

/** Pregunta al servidor si hay una versión nueva publicada (sin usar copias guardadas). */
export async function checkForUpdate(): Promise<boolean> {
  const mine = currentScript();
  if (!mine || !navigator.onLine) return false;
  try {
    const r = await fetch(`./index.html?v=${Date.now()}`, { cache: 'no-store' });
    if (!r.ok) return false;
    const latest = (await r.text()).match(/assets\/index-[\w-]+\.js/)?.[0];
    const available = !!latest && latest !== mine;
    if (available) useUpdate.setState({ available: true });
    return available;
  } catch {
    return false;
  }
}

/** Recarga la app con la versión nueva. */
export function applyUpdate() {
  navigator.serviceWorker?.getRegistration().then((r) => r?.update()).catch(() => {});
  window.location.reload();
}
