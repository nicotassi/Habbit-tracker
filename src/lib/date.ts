export const DAY_MS = 86400000;

export function toKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function fromKey(k: string): Date {
  const [y, m, d] = k.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function todayKey(): string {
  return toKey(new Date());
}

export function addDays(k: string, n: number): string {
  const d = fromKey(k);
  d.setDate(d.getDate() + n);
  return toKey(d);
}

export function diffDays(a: string, b: string): number {
  return Math.round((fromKey(a).getTime() - fromKey(b).getTime()) / DAY_MS);
}

export function range(from: string, to: string): string[] {
  const out: string[] = [];
  let k = from;
  while (k <= to) {
    out.push(k);
    k = addDays(k, 1);
  }
  return out;
}

export function lastNDays(n: number, end = todayKey()): string[] {
  return range(addDays(end, -(n - 1)), end);
}

export function weekStartOf(k: string, weekStart: 0 | 1 = 1): string {
  const d = fromKey(k);
  const diff = (d.getDay() - weekStart + 7) % 7;
  return addDays(k, -diff);
}

export function monthKey(k: string): string {
  return k.slice(0, 7);
}

export const WEEKDAYS_SHORT = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
export const WEEKDAYS_LETTER = ['D', 'L', 'M', 'M', 'J', 'V', 'S'];
export const WEEKDAYS_LONG = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
export const MONTHS = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
export const MONTHS_SHORT = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

export function prettyDate(k: string): string {
  const d = fromKey(k);
  return `${WEEKDAYS_LONG[d.getDay()]} ${d.getDate()} de ${MONTHS[d.getMonth()]}`;
}

export function shortDate(k: string): string {
  const d = fromKey(k);
  return `${d.getDate()} ${MONTHS_SHORT[d.getMonth()]}`;
}

export function relativeDay(k: string): string {
  const diff = diffDays(todayKey(), k);
  if (diff === 0) return 'Hoy';
  if (diff === 1) return 'Ayer';
  if (diff === -1) return 'Mañana';
  return prettyDate(k);
}

export function greeting(): string {
  const h = new Date().getHours();
  if (h < 6) return 'Buenas noches';
  if (h < 13) return 'Buen día';
  if (h < 20) return 'Buenas tardes';
  return 'Buenas noches';
}
