// Rituales de 30 segundos: el arranque (cómo amanecí + mi plan + mi foco) y el cierre
// (lo que quedó + cómo estuve + cómo viene mañana).
import type { AppData } from './types';
import { addDays, todayKey } from './date';

export type RitualPart = 'morning' | 'evening';

const toMin = (hhmm: string) => +hhmm.slice(0, 2) * 60 + +hhmm.slice(3, 5);

/** Días seguidos con ese ritual hecho (si hoy todavía no se hizo, cuenta desde ayer). */
export function ritualStreak(data: AppData, part: RitualPart, today = todayKey()): number {
  const r = data.rituals ?? {};
  let d = r[today]?.[part] ? today : addDays(today, -1);
  let n = 0;
  while (r[d]?.[part]) { n++; d = addDays(d, -1); }
  return n;
}

/** ¿Qué ritual corresponde ofrecer ahora? */
export function ritualDue(data: AppData, now = new Date()): RitualPart | null {
  const today = todayKey();
  const r = data.rituals?.[today];
  const m = now.getHours() * 60 + now.getMinutes();
  const eve = toMin(data.settings.ritualEvening || '21:30');
  const morn = toMin(data.settings.ritualMorning || '08:00');
  if (!r?.evening && m >= Math.min(eve - 90, 19 * 60)) return 'evening';
  if (!r?.morning && m >= Math.min(morn - 120, 5 * 60) && m < 14 * 60) return 'morning';
  return null;
}

/** Lo que te dejaste anotado anoche para hoy. */
export const noteForToday = (data: AppData, today = todayKey()) => data.rituals?.[addDays(today, -1)]?.evening?.tomorrow?.trim() || '';
