import type { AppData } from './types';
import { activeHabits, levelOf, perfectDayStreak, streaks, totalCompletionsAll, xpOf } from './stats';

export interface Achievement {
  id: string;
  emoji: string;
  title: string;
  desc: string;
  check: (d: AppData, ctx: Ctx) => boolean;
}

interface Ctx {
  bestStreak: number;
  completions: number;
  perfect: { current: number; best: number; count: number };
  level: number;
}

export const ACHIEVEMENTS: Achievement[] = [
  { id: 'first-habit', emoji: '🌱', title: 'Primer paso', desc: 'Creá tu primer hábito', check: (d) => d.habits.length >= 1 },
  { id: 'five-habits', emoji: '🧺', title: 'Coleccionista', desc: 'Tené 5 hábitos activos', check: (d) => activeHabits(d).length >= 5 },
  { id: 'ten-habits', emoji: '🏗️', title: 'Arquitecto', desc: 'Tené 10 hábitos activos', check: (d) => activeHabits(d).length >= 10 },
  { id: 'first-check', emoji: '✅', title: 'Arranque', desc: 'Completá un hábito', check: (_, c) => c.completions >= 1 },
  { id: 'c50', emoji: '🎯', title: 'Cincuentena', desc: '50 hábitos completados', check: (_, c) => c.completions >= 50 },
  { id: 'c250', emoji: '💯', title: 'Imparable', desc: '250 hábitos completados', check: (_, c) => c.completions >= 250 },
  { id: 'c1000', emoji: '🌋', title: 'Mil veces', desc: '1000 hábitos completados', check: (_, c) => c.completions >= 1000 },
  { id: 's3', emoji: '🔥', title: 'En llamas', desc: 'Racha de 3 días', check: (_, c) => c.bestStreak >= 3 },
  { id: 's7', emoji: '📅', title: 'Semana redonda', desc: 'Racha de 7 días', check: (_, c) => c.bestStreak >= 7 },
  { id: 's21', emoji: '🧠', title: 'Hábito formado', desc: 'Racha de 21 días', check: (_, c) => c.bestStreak >= 21 },
  { id: 's66', emoji: '🧬', title: 'Automático', desc: 'Racha de 66 días (lo que dice la ciencia)', check: (_, c) => c.bestStreak >= 66 },
  { id: 's100', emoji: '💎', title: 'Centenario', desc: 'Racha de 100 días', check: (_, c) => c.bestStreak >= 100 },
  { id: 's365', emoji: '👑', title: 'Un año entero', desc: 'Racha de 365 días', check: (_, c) => c.bestStreak >= 365 },
  { id: 'perfect1', emoji: '⭐', title: 'Día perfecto', desc: 'Completá todos tus hábitos en un día', check: (_, c) => c.perfect.count >= 1 },
  { id: 'perfect7', emoji: '🌟', title: 'Semana perfecta', desc: '7 días perfectos seguidos', check: (_, c) => c.perfect.best >= 7 },
  { id: 'perfect30', emoji: '✨', title: 'Mes impecable', desc: '30 días perfectos en total', check: (_, c) => c.perfect.count >= 30 },
  { id: 'mood1', emoji: '🫶', title: 'Autoconocimiento', desc: 'Registrá tu ánimo por primera vez', check: (d) => Object.keys(d.moods).length >= 1 },
  { id: 'mood30', emoji: '📖', title: 'Diario constante', desc: '30 registros de ánimo', check: (d) => Object.keys(d.moods).length >= 30 },
  { id: 'grat', emoji: '🙏', title: 'Agradecido', desc: 'Anotá 20 cosas por las que estás agradecido', check: (d) => Object.values(d.moods).reduce((s, m) => s + m.gratitude.length, 0) >= 20 },
  { id: 'focus1', emoji: '⏱️', title: 'Foco', desc: 'Completá una sesión de foco', check: (d) => d.focus.length >= 1 },
  { id: 'focus10h', emoji: '🧘', title: 'Flow', desc: '10 horas de foco acumuladas', check: (d) => d.focus.reduce((s, f) => s + f.minutes, 0) >= 600 },
  { id: 'review1', emoji: '🪞', title: 'Reflexivo', desc: 'Hacé tu primera revisión semanal', check: (d) => Object.keys(d.reviews).length >= 1 },
  { id: 'review8', emoji: '🗺️', title: 'Estratega', desc: '8 revisiones semanales', check: (d) => Object.keys(d.reviews).length >= 8 },
  { id: 'goal1', emoji: '🚩', title: 'Con dirección', desc: 'Creá un objetivo', check: (d) => d.goals.length >= 1 },
  { id: 'lvl5', emoji: '🌳', title: 'Nivel 5', desc: 'Alcanzá el nivel 5', check: (_, c) => c.level >= 5 },
  { id: 'lvl10', emoji: '🏔️', title: 'Nivel 10', desc: 'Alcanzá el nivel 10', check: (_, c) => c.level >= 10 },
];

export function evaluateAchievements(d: AppData): string[] {
  const ws = d.settings.weekStart;
  const bestStreak = d.habits.reduce((m, h) => Math.max(m, streaks(h, d.logs, ws).best * (h.frequency.type === 'perWeek' ? 7 : 1)), 0);
  const ctx: Ctx = {
    bestStreak,
    completions: totalCompletionsAll(d),
    perfect: perfectDayStreak(d),
    level: levelOf(xpOf(d)).level,
  };
  return ACHIEVEMENTS.filter((a) => a.check(d, ctx)).map((a) => a.id);
}
