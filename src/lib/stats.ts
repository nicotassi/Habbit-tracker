import type { AppData, Entry, Habit, Logs, MoodEntry } from './types';
import { addDays, diffDays, fromKey, range, todayKey, weekStartOf } from './date';

export function entryOf(logs: Logs, date: string, habitId: string): Entry | undefined {
  return logs[date]?.[habitId];
}

/** ¿Corresponde hacer el hábito ese día? (perWeek: cualquier día es válido) */
export function isScheduled(h: Habit, date: string): boolean {
  if (date < h.createdAt) return false;
  if (h.frequency.type === 'weekdays') return h.frequency.days.includes(fromKey(date).getDay());
  return true;
}

/** Igual que isScheduled pero ignora la fecha de creación: sirve para cargar días anteriores. */
export function matchesDay(h: Habit, date: string): boolean {
  if (h.frequency.type === 'weekdays') return h.frequency.days.includes(fromKey(date).getDay());
  return true;
}

export function isDone(h: Habit, e: Entry | undefined, date?: string): boolean {
  if (h.kind === 'avoid') {
    if (date && (date < h.createdAt || date > todayKey())) return false;
    return !e || e.value <= 0;
  }
  if (!e) return false;
  return e.value >= (h.kind === 'check' ? 1 : h.target);
}

export function progressOf(h: Habit, e: Entry | undefined): number {
  if (h.kind === 'avoid') return e && e.value > 0 ? 0 : 1;
  if (!e) return 0;
  const t = h.kind === 'check' ? 1 : h.target || 1;
  return Math.max(0, Math.min(1, e.value / t));
}

export function weekCount(h: Habit, logs: Logs, date: string, weekStart: 0 | 1): number {
  const ws = weekStartOf(date, weekStart);
  let c = 0;
  for (let i = 0; i < 7; i++) {
    const d = addDays(ws, i);
    if (isDone(h, entryOf(logs, d, h.id), d)) c++;
  }
  return c;
}

/** Hábitos que "cuentan" para el porcentaje de un día. */
export function countsForDay(h: Habit, logs: Logs, date: string, weekStart: 0 | 1): boolean {
  if (!isScheduled(h, date)) return false;
  if (logs[date]?.[h.id]?.skipped) return false;
  if (h.frequency.type === 'perWeek') {
    if (isDone(h, entryOf(logs, date, h.id), date)) return true;
    // cuenta solo si la cuota semanal todavía no se cumplió antes de este día
    const ws = weekStartOf(date, weekStart);
    let before = 0;
    for (let d = ws; d < date; d = addDays(d, 1)) if (isDone(h, entryOf(logs, d, h.id), d)) before++;
    return before < h.frequency.times;
  }
  return true;
}

export function dayStats(data: AppData, date: string, habits = activeHabits(data)) {
  let total = 0;
  let done = 0;
  let progress = 0;
  for (const h of habits) {
    if (!countsForDay(h, data.logs, date, data.settings.weekStart)) continue;
    total++;
    const e = entryOf(data.logs, date, h.id);
    if (isDone(h, e, date)) done++;
    progress += progressOf(h, e);
  }
  return { total, done, rate: total ? done / total : 0, progress: total ? progress / total : 0 };
}

export function activeHabits(data: AppData): Habit[] {
  return data.habits.filter((h) => !h.archived).sort((a, b) => a.order - b.order);
}

export interface StreakInfo {
  current: number;
  best: number;
  unit: string;
}

export function streaks(h: Habit, logs: Logs, weekStart: 0 | 1, today = todayKey()): StreakInfo {
  if (h.frequency.type === 'perWeek') {
    const times = h.frequency.times;
    const startW = weekStartOf(h.createdAt, weekStart);
    const thisW = weekStartOf(today, weekStart);
    let best = 0;
    let run = 0;
    const weeks: boolean[] = [];
    for (let w = startW; w <= thisW; w = addDays(w, 7)) weeks.push(weekCount(h, logs, w, weekStart) >= times);
    weeks.forEach((ok) => {
      run = ok ? run + 1 : 0;
      best = Math.max(best, run);
    });
    let current = 0;
    for (let i = weeks.length - 1; i >= 0; i--) {
      if (weeks[i]) current++;
      else if (i === weeks.length - 1) continue; // semana en curso sin terminar
      else break;
    }
    return { current, best, unit: current === 1 ? 'semana' : 'semanas' };
  }
  let best = 0;
  let run = 0;
  const days = range(h.createdAt, today);
  const flags: (boolean | null)[] = days.map((d) => {
    if (!isScheduled(h, d)) return null;
    const e = entryOf(logs, d, h.id);
    if (e?.skipped) return null;
    return isDone(h, e, d);
  });
  flags.forEach((f) => {
    if (f === null) return;
    run = f ? run + 1 : 0;
    best = Math.max(best, run);
  });
  let current = 0;
  for (let i = flags.length - 1; i >= 0; i--) {
    const f = flags[i];
    if (f === null) continue;
    if (f) current++;
    else if (i === flags.length - 1) continue; // hoy todavía pendiente
    else break;
  }
  return { current, best, unit: current === 1 ? 'día' : 'días' };
}

/** Puntaje de fuerza del hábito (0..1), media móvil exponencial al estilo "habit strength". */
export function strengthSeries(h: Habit, logs: Logs, weekStart: 0 | 1, end = todayKey()): { date: string; score: number }[] {
  const out: { date: string; score: number }[] = [];
  let score = 0;
  const alpha = 0.052; // vida media ≈ 13 evaluaciones
  for (const d of range(h.createdAt, end)) {
    if (h.frequency.type === 'perWeek') {
      // al cierre de cada día evaluamos el ritmo semanal acumulado
      const ws = weekStartOf(d, weekStart);
      const elapsed = diffDays(d, ws) + 1;
      const c = weekCount(h, logs, d, weekStart);
      const expected = (h.frequency.times * elapsed) / 7;
      const v = Math.min(1, c / Math.max(expected, 0.0001));
      score = score + alpha * (v - score);
    } else if (isScheduled(h, d)) {
      const e = entryOf(logs, d, h.id);
      if (!e?.skipped) {
        const isToday = d === end;
        const v = progressOf(h, e);
        if (!(isToday && v === 0 && h.kind !== 'avoid')) score = score + alpha * (v - score);
      }
    }
    out.push({ date: d, score });
  }
  return out;
}

export function strength(h: Habit, logs: Logs, weekStart: 0 | 1): number {
  const s = strengthSeries(h, logs, weekStart);
  return s.length ? s[s.length - 1].score : 0;
}

export function completionRate(h: Habit, logs: Logs, from: string, to: string, weekStart: 0 | 1): number {
  if (h.frequency.type === 'perWeek') {
    let met = 0;
    let total = 0;
    for (let w = weekStartOf(from, weekStart); w <= to; w = addDays(w, 7)) {
      if (addDays(w, 6) < h.createdAt) continue;
      total++;
      met += Math.min(1, weekCount(h, logs, w, weekStart) / h.frequency.times);
    }
    return total ? met / total : 0;
  }
  let done = 0;
  let total = 0;
  for (const d of range(from < h.createdAt ? h.createdAt : from, to)) {
    if (!isScheduled(h, d)) continue;
    const e = entryOf(logs, d, h.id);
    if (e?.skipped) continue;
    if (d === todayKey() && !isDone(h, e, d)) continue;
    total++;
    if (isDone(h, e, d)) done++;
  }
  return total ? done / total : 0;
}

export function totalCompletions(h: Habit, logs: Logs): number {
  if (h.kind === 'avoid') {
    let c = 0;
    for (const d of range(h.createdAt, todayKey())) if (isDone(h, entryOf(logs, d, h.id), d)) c++;
    return c;
  }
  let c = 0;
  for (const d of Object.keys(logs)) if (isDone(h, logs[d][h.id], d)) c++;
  return c;
}

export function totalAmount(h: Habit, logs: Logs): number {
  let s = 0;
  for (const d of Object.keys(logs)) s += logs[d][h.id]?.value ?? 0;
  return s;
}

export function weekdayProfile(data: AppData, days: string[], habits = activeHabits(data)) {
  const acc = Array.from({ length: 7 }, () => ({ done: 0, total: 0 }));
  for (const d of days) {
    const s = dayStats(data, d, habits);
    const wd = fromKey(d).getDay();
    acc[wd].done += s.done;
    acc[wd].total += s.total;
  }
  return acc.map((a) => (a.total ? a.done / a.total : 0));
}

export function totalCompletionsAll(data: AppData): number {
  let c = 0;
  for (const h of data.habits) c += totalCompletions(h, data.logs);
  return c;
}

export function xpOf(data: AppData): number {
  let xp = 0;
  for (const h of data.habits) xp += totalCompletions(h, data.logs) * 10;
  xp += Object.keys(data.moods).length * 5;
  xp += data.focus.reduce((s, f) => s + Math.round(f.minutes / 5), 0);
  xp += Object.keys(data.reviews).length * 25;
  return xp;
}

export function levelOf(xp: number) {
  const level = Math.floor(Math.sqrt(xp / 60)) + 1;
  const curBase = (level - 1) ** 2 * 60;
  const nextBase = level ** 2 * 60;
  return { level, progress: (xp - curBase) / (nextBase - curBase), toNext: nextBase - xp };
}

export const LEVEL_TITLES = [
  'Semilla', 'Brote', 'Raíz', 'Tallo', 'Hoja', 'Flor', 'Árbol joven', 'Roble', 'Bosque', 'Montaña', 'Constelación', 'Leyenda',
];
export const levelTitle = (l: number) => LEVEL_TITLES[Math.min(l - 1, LEVEL_TITLES.length - 1)];

/** Días con actividad perfecta consecutivos (todos los hábitos del día hechos). */
export function perfectDayStreak(data: AppData): { current: number; best: number; count: number } {
  const habits = activeHabits(data);
  if (!habits.length) return { current: 0, best: 0, count: 0 };
  const start = habits.reduce((m, h) => (h.createdAt < m ? h.createdAt : m), todayKey());
  let run = 0;
  let best = 0;
  let count = 0;
  const days = range(start, todayKey());
  const flags = days.map((d) => {
    const s = dayStats(data, d, habits);
    return s.total > 0 && s.done === s.total;
  });
  flags.forEach((f) => {
    if (f) count++;
    run = f ? run + 1 : 0;
    best = Math.max(best, run);
  });
  let current = 0;
  for (let i = flags.length - 1; i >= 0; i--) {
    if (flags[i]) current++;
    else if (i === flags.length - 1) continue;
    else break;
  }
  return { current, best, count };
}

export function mean(xs: number[]): number {
  return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0;
}

export function pearson(xs: number[], ys: number[]): number {
  const n = Math.min(xs.length, ys.length);
  if (n < 3) return 0;
  const mx = mean(xs);
  const my = mean(ys);
  let num = 0;
  let dx = 0;
  let dy = 0;
  for (let i = 0; i < n; i++) {
    num += (xs[i] - mx) * (ys[i] - my);
    dx += (xs[i] - mx) ** 2;
    dy += (ys[i] - my) ** 2;
  }
  return dx && dy ? num / Math.sqrt(dx * dy) : 0;
}

export interface HabitMoodImpact {
  habit: Habit;
  withMood: number;
  withoutMood: number;
  delta: number;
  nWith: number;
  nWithout: number;
  metric: 'mood' | 'energy' | 'stress';
}

/** Compara el ánimo promedio en días con y sin el hábito cumplido. */
export function moodImpact(data: AppData, metric: 'mood' | 'energy' | 'stress' = 'mood'): HabitMoodImpact[] {
  const out: HabitMoodImpact[] = [];
  const moods = Object.values(data.moods);
  for (const h of activeHabits(data)) {
    const w: number[] = [];
    const wo: number[] = [];
    for (const m of moods) {
      if (!isScheduled(h, m.date)) continue;
      const done = isDone(h, entryOf(data.logs, m.date, h.id), m.date);
      (done ? w : wo).push(m[metric]);
    }
    if (w.length >= 3 && wo.length >= 3) {
      const a = mean(w);
      const b = mean(wo);
      out.push({ habit: h, withMood: a, withoutMood: b, delta: a - b, nWith: w.length, nWithout: wo.length, metric });
    }
  }
  return out.sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));
}

export function moodSeries(data: AppData, days: string[]) {
  return days.map((d) => {
    const m: MoodEntry | undefined = data.moods[d];
    const s = dayStats(data, d);
    return {
      date: d,
      mood: m?.mood ?? null,
      energy: m?.energy ?? null,
      stress: m?.stress ?? null,
      sleep: m?.sleep ?? null,
      rate: s.total ? Math.round(s.rate * 100) : null,
    };
  });
}

export function rollingAvg<T extends Record<string, unknown>>(rows: T[], key: keyof T, win = 7): (number | null)[] {
  return rows.map((_, i) => {
    const vals: number[] = [];
    for (let j = Math.max(0, i - win + 1); j <= i; j++) {
      const v = rows[j][key];
      if (typeof v === 'number') vals.push(v);
    }
    return vals.length ? Math.round(mean(vals) * 100) / 100 : null;
  });
}

export function emotionFrequency(data: AppData, days: string[]) {
  const c: Record<string, number> = {};
  for (const d of days) for (const e of data.moods[d]?.emotions ?? []) c[e] = (c[e] ?? 0) + 1;
  return Object.entries(c)
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count);
}

export function tagFrequency(data: AppData, days: string[]) {
  const c: Record<string, { count: number; mood: number[] }> = {};
  for (const d of days) {
    const m = data.moods[d];
    if (!m) continue;
    for (const t of m.tags) {
      c[t] = c[t] ?? { count: 0, mood: [] };
      c[t].count++;
      c[t].mood.push(m.mood);
    }
  }
  return Object.entries(c)
    .map(([name, v]) => ({ name, count: v.count, mood: mean(v.mood) }))
    .sort((a, b) => b.count - a.count);
}

export function categoryBreakdown(data: AppData, from: string, to: string) {
  const cats: Record<string, number[]> = {};
  for (const h of activeHabits(data)) {
    const c = h.category || 'General';
    cats[c] = cats[c] ?? [];
    cats[c].push(completionRate(h, data.logs, from, to, data.settings.weekStart));
  }
  return Object.entries(cats).map(([category, rates]) => ({ category, rate: Math.round(mean(rates) * 100) }));
}

export function hourProfile(data: AppData, days: string[]) {
  const hours = Array.from({ length: 24 }, (_, h) => ({ hour: h, count: 0 }));
  for (const d of days) {
    const day = data.logs[d];
    if (!day) continue;
    for (const id of Object.keys(day)) {
      const e = day[id];
      const h = data.habits.find((x) => x.id === id);
      if (!h || !e.at || h.kind === 'avoid') continue;
      if (!isDone(h, e, d)) continue;
      hours[new Date(e.at).getHours()].count++;
    }
  }
  return hours;
}

export interface Insight {
  icon: string;
  title: string;
  body: string;
  tone: 'good' | 'warn' | 'info';
}

export function insights(data: AppData): Insight[] {
  const out: Insight[] = [];
  const habits = activeHabits(data);
  if (!habits.length) return out;
  const today = todayKey();
  const last30 = range(addDays(today, -29), today);
  const prev30 = range(addDays(today, -59), addDays(today, -30));
  const r = (days: string[]) => {
    let d = 0;
    let t = 0;
    for (const k of days) {
      const s = dayStats(data, k, habits);
      d += s.done;
      t += s.total;
    }
    return t ? d / t : 0;
  };
  const a = r(last30);
  const b = r(prev30);
  if (b > 0) {
    const diff = Math.round((a - b) * 100);
    if (diff >= 3) out.push({ icon: '📈', tone: 'good', title: `+${diff}% vs el mes anterior`, body: `Tu cumplimiento de los últimos 30 días es ${Math.round(a * 100)}%. Venís en subida.` });
    else if (diff <= -3) out.push({ icon: '🧭', tone: 'warn', title: `${diff}% vs el mes anterior`, body: `Bajaste un poco. Probá reducir la meta de algún hábito difícil para recuperar ritmo.` });
    else out.push({ icon: '⚖️', tone: 'info', title: 'Ritmo estable', body: `Mantenés un ${Math.round(a * 100)}% de cumplimiento, igual que el mes pasado.` });
  }
  const wd = weekdayProfile(data, last30.concat(prev30), habits);
  const hasWd = wd.some((x) => x > 0);
  if (hasWd) {
    const best = wd.indexOf(Math.max(...wd));
    const worst = wd.indexOf(Math.min(...wd.map((x) => (x === 0 ? 2 : x))));
    const names = ['domingos', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábados'];
    out.push({ icon: '🗓️', tone: 'info', title: `Tus ${names[best]} son tu mejor día`, body: `Cumplís ${Math.round(wd[best] * 100)}% los ${names[best]} y ${Math.round(wd[worst] * 100)}% los ${names[worst]}. Planificá los ${names[worst]} con más cariño.` });
  }
  const impact = moodImpact(data);
  const top = impact.find((i) => i.delta > 0.25);
  if (top) out.push({ icon: '💛', tone: 'good', title: `${top.habit.emoji} ${top.habit.name} te levanta el ánimo`, body: `Los días que lo hacés tu ánimo promedio es ${top.withMood.toFixed(1)} vs ${top.withoutMood.toFixed(1)} cuando no.` });
  const stressImpact = moodImpact(data, 'stress').find((i) => i.delta < -0.25);
  if (stressImpact) out.push({ icon: '🌿', tone: 'good', title: `${stressImpact.habit.emoji} ${stressImpact.habit.name} baja tu estrés`, body: `Estrés promedio ${stressImpact.withMood.toFixed(1)} cuando lo cumplís vs ${stressImpact.withoutMood.toFixed(1)} cuando no.` });
  const sleepDays = Object.values(data.moods).filter((m) => typeof m.sleep === 'number');
  if (sleepDays.length >= 7) {
    const c = pearson(sleepDays.map((m) => m.sleep as number), sleepDays.map((m) => m.mood));
    if (Math.abs(c) > 0.25) out.push({ icon: '😴', tone: c > 0 ? 'good' : 'info', title: c > 0 ? 'Dormir más = mejor ánimo' : 'El sueño no explica tu ánimo', body: `Correlación sueño-ánimo: ${c.toFixed(2)}. ${c > 0 ? 'Cuidar tus horas de sueño tiene efecto real.' : ''}` });
  }
  const ranked = habits
    .map((h) => ({ h, rate: completionRate(h, data.logs, addDays(today, -29), today, data.settings.weekStart) }))
    .filter((x) => diffDays(today, x.h.createdAt) >= 7);
  if (ranked.length >= 2) {
    ranked.sort((x, y) => y.rate - x.rate);
    const best = ranked[0];
    const worst = ranked[ranked.length - 1];
    out.push({ icon: '🏆', tone: 'good', title: `${best.h.emoji} ${best.h.name} está consolidado`, body: `${Math.round(best.rate * 100)}% de cumplimiento en 30 días.` });
    if (worst.rate < 0.5) out.push({ icon: '🔧', tone: 'warn', title: `${worst.h.emoji} ${worst.h.name} necesita ajuste`, body: `Solo ${Math.round(worst.rate * 100)}% en 30 días. ¿Meta más chica, otro horario o un disparador concreto?` });
  }
  const pd = perfectDayStreak(data);
  if (pd.current >= 2) out.push({ icon: '🔥', tone: 'good', title: `${pd.current} días perfectos seguidos`, body: `Tu récord es ${pd.best}. No cortes la cadena.` });
  return out;
}
