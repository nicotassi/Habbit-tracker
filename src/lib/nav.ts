import { useStore } from './store';

// Secciones de la app. Las de la barra de abajo (celular) las elige cada persona en "Editar pestañas".
export const NAV = [
  { id: 'inicio', ico: '🚀', label: 'Inicio' },
  { id: 'today', ico: '☀️', label: 'Hoy' },
  { id: 'coach', ico: '🧭', label: 'Cómo vas' },
  { id: 'habits', ico: '🌱', label: 'Hábitos' },
  { id: 'analytics', ico: '📊', label: 'Análisis' },
  { id: 'mood', ico: '🫶', label: 'Ánimo' },
  { id: 'calendar', ico: '🗓️', label: 'Calendario' },
  { id: 'focus', ico: '🍅', label: 'Pomodoro' },
  { id: 'goals', ico: '🚩', label: 'Objetivos' },
  { id: 'achievements', ico: '🏆', label: 'Logros' },
  { id: 'ajustes', ico: '⚙️', label: 'Ajustes' },
];

export const DEFAULT_TABS = ['inicio', 'today', 'habits', 'analytics', 'mood'];
export const MAX_TABS = 5;

/** Pestañas válidas de la barra de abajo, en el orden elegido. */
export function cleanTabs(t: unknown): string[] {
  if (!Array.isArray(t)) return DEFAULT_TABS;
  const ids = t.filter((x, i): x is string => typeof x === 'string' && NAV.some((n) => n.id === x) && t.indexOf(x) === i).slice(0, MAX_TABS);
  return ids.length ? ids : DEFAULT_TABS;
}

export const useTabs = () => cleanTabs(useStore((s) => s.settings.navTabs));
