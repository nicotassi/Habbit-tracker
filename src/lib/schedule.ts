// Horario de un hábito: el mismo todos los días o distinto según el día de la semana.
import type { Habit, TimeOfDay, TimeSlot } from './types';
import { fromKey } from './date';

const toMin = (hhmm: string) => {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + (m || 0);
};

/** Horario del hábito para una fecha (null si ese día no tiene horario). */
export function slotFor(h: Habit, date: string): TimeSlot | null {
  const s = h.schedule;
  if (!s) return null;
  if (s.mode === 'perDay') {
    const slot = s.perDay?.[fromKey(date).getDay()];
    return slot?.start ? slot : null;
  }
  return s.slot?.start ? s.slot : null;
}

/** Mañana (antes de las 12), tarde (antes de las 19) o noche, según la hora de inicio. */
export function timeOfDayOf(start: string): TimeOfDay {
  const m = toMin(start);
  return m < 12 * 60 ? 'morning' : m < 19 * 60 ? 'afternoon' : 'evening';
}

/** El momento del día en que aparece el hábito: el de su horario, o el elegido a mano. */
export function effectiveTimeOfDay(h: Habit, date: string): TimeOfDay {
  const slot = slotFor(h, date);
  return slot ? timeOfDayOf(slot.start) : h.timeOfDay;
}

export const fmtSlot = (s: TimeSlot) => (s.end ? `${s.start}–${s.end}` : s.start);

/** Minutos desde medianoche de la hora de inicio, para ordenar (sin horario: al final). */
export const startMinutes = (h: Habit, date: string) => {
  const s = slotFor(h, date);
  return s ? toMin(s.start) : 24 * 60 + 1;
};

export type SlotStatus = { kind: 'now' | 'soon' | 'late'; label: string } | null;

/** Estado respecto de la hora actual (solo tiene sentido para hoy y si no está hecho). */
export function slotStatus(slot: TimeSlot, now = new Date()): SlotStatus {
  const n = now.getHours() * 60 + now.getMinutes();
  const start = toMin(slot.start);
  // sin hora de fin, se considera una ventana de 30 minutos
  let end = slot.end ? toMin(slot.end) : start + 30;
  if (end <= start) end += 24 * 60; // termina después de medianoche
  if (n >= start && n < end) return { kind: 'now', label: 'Ahora' };
  if (start > n && start - n <= 30) return { kind: 'soon', label: `En ${start - n} min` };
  if (n >= end && n - end <= 6 * 60) return { kind: 'late', label: 'Atrasado' };
  return null;
}

/** Resumen corto del horario: "07:30–08:00", "L-V 07:30 · S 10:00" */
export function scheduleSummary(h: Habit): string | null {
  const s = h.schedule;
  if (!s) return null;
  if (s.mode === 'same') return s.slot?.start ? fmtSlot(s.slot) : null;
  const letters = ['D', 'L', 'M', 'X', 'J', 'V', 'S'];
  const groups = new Map<string, number[]>();
  for (const d of [1, 2, 3, 4, 5, 6, 0]) {
    const slot = s.perDay?.[d];
    if (!slot?.start) continue;
    const k = fmtSlot(slot);
    groups.set(k, [...(groups.get(k) ?? []), d]);
  }
  if (!groups.size) return null;
  return [...groups.entries()].map(([k, ds]) => `${ds.map((d) => letters[d]).join('')} ${k}`).join(' · ');
}
