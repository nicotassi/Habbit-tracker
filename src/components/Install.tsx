import { useEffect, useState } from 'react';
import { create } from 'zustand';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

// El evento puede llegar antes de que React monte la app: se captura al cargar este módulo.
const useInstall = create<{ prompt: BeforeInstallPromptEvent | null; installed: boolean }>(() => ({ prompt: null, installed: false }));
if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    useInstall.setState({ prompt: e as BeforeInstallPromptEvent });
  });
  window.addEventListener('appinstalled', () => useInstall.setState({ prompt: null, installed: true }));
}

const SNOOZE_KEY = 'ritmo-install-snooze';
export const isStandalone = () =>
  window.matchMedia('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
const ua = () => navigator.userAgent;
export const isIOS = () => /iphone|ipad|ipod/i.test(ua()) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
const isMobile = () => isIOS() || /android/i.test(ua());
// navegadores internos de otras apps (WhatsApp, Instagram, Facebook…), donde no se puede instalar
const isInApp = () => /FBAN|FBAV|Instagram|Line\/|WhatsApp|Twitter|TikTok|; wv\)/i.test(ua());

async function install() {
  const p = useInstall.getState().prompt;
  if (!p) return;
  await p.prompt();
  await p.userChoice.catch(() => null);
  useInstall.setState({ prompt: null });
}

/** Explicación de cómo instalar según el navegador. */
export function InstallHow() {
  const prompt = useInstall((s) => s.prompt);
  if (prompt) return <button className="btn primary" style={{ width: '100%' }} onClick={install}>Instalar Ritmo</button>;
  if (isInApp())
    return <p className="small ink2" style={{ margin: 0 }}>Estás en el navegador de otra app (WhatsApp, Instagram…). Tocá el menú <b>⋯</b> y elegí <b>“Abrir en el navegador”</b> (Safari o Chrome). Ahí vas a poder instalarla.</p>;
  if (isIOS())
    return <p className="small ink2" style={{ margin: 0 }}>En Safari, tocá <b>Compartir</b> (el cuadrado con la flecha hacia arriba) y después <b>“Agregar a inicio”</b>.</p>;
  return <p className="small ink2" style={{ margin: 0 }}>En el menú del navegador (<b>⋮</b>) elegí <b>“Instalar app”</b> o <b>“Agregar a pantalla de inicio”</b>.</p>;
}

/** Cartel flotante que invita a instalar la app (solo en el navegador, no si ya está instalada). */
export function InstallBanner({ top }: { top?: boolean }) {
  const prompt = useInstall((s) => s.prompt);
  const installed = useInstall((s) => s.installed);
  const [show, setShow] = useState(false);
  useEffect(() => {
    let snoozed = 0;
    try { snoozed = Number(localStorage.getItem(SNOOZE_KEY) ?? 0); } catch { /* sin almacenamiento */ }
    // en celular siempre se ofrece (con instrucciones); en compu solo si el navegador permite instalar
    const t = setTimeout(() => setShow(!isStandalone() && snoozed < Date.now() && (isMobile() || !!prompt)), 1200);
    return () => clearTimeout(t);
  }, [prompt]);
  if (!show || installed || isStandalone()) return null;
  const later = () => {
    try { localStorage.setItem(SNOOZE_KEY, String(Date.now() + 3 * 86400000)); } catch { /* sin almacenamiento */ }
    setShow(false);
  };
  return (
    <div className={`install-banner ${top ? 'top' : ''}`} role="dialog" aria-label="Instalar Ritmo">
      <div className="row" style={{ marginBottom: 10 }}>
        <img src="./icon-192.png" alt="" width={40} height={40} style={{ borderRadius: 11 }} />
        <div className="grow">
          <b>Instalá Ritmo como app</b>
          <div className="small muted">Ícono en tu pantalla, pantalla completa y acceso rápido.</div>
        </div>
      </div>
      <InstallHow />
      <button className="btn ghost sm" style={{ width: '100%', marginTop: 6 }} onClick={later}>Ahora no</button>
    </div>
  );
}

/** Tarjeta para Ajustes. */
export function InstallCard() {
  if (isStandalone()) return null;
  return (
    <div className="card col" style={{ gap: 12 }}>
      <h3 className="h3">📲 Instalar como app</h3>
      <InstallHow />
    </div>
  );
}
