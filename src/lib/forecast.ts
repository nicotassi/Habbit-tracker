import type { AppData, Habit, Logs } from './types';
import { activeHabits, entryOf, isDone, isScheduled, strength, streaks } from './stats';
import { addDays, fromKey, todayKey, WEEKDAYS_LONG } from './date';

/* ---------- Rescate: "nunca dos veces seguidas" ---------- */

export interface RescueInfo {
  /** rescue: ayer (último día programado) no se hizo y hoy todavía no; rescued: hoy se recuperó */
  state: 'rescue' | 'rescued';
  /** días programados seguidos sin hacerlo antes de hoy */
  missed: number;
}

function prevScheduled(h: Habit, date: string): string | null {
  for (let i = 1; i <= 7; i++) {
    const d = addDays(date, -i);
    if (d < h.createdAt) return null;
    if (isScheduled(h, d)) return d;
  }
  return null;
}

export function rescueOf(h: Habit, logs: Logs, date = todayKey()): RescueInfo | null {
  // los hábitos "X veces por semana" y los de evitar no tienen un día fijo que rescatar
  if (h.frequency.type === 'perWeek' || h.kind === 'avoid') return null;
  let missed = 0;
  let d = prevScheduled(h, date);
  while (d) {
    const e = entryOf(logs, d, h.id);
    if (e?.skipped) { d = prevScheduled(h, d); continue; }
    if (isDone(h, e, d)) break;
    missed++;
    if (missed >= 30) break;
    d = prevScheduled(h, d);
  }
  if (!missed) return null;
  return { state: isDone(h, entryOf(logs, date, h.id), date) ? 'rescued' : 'rescue', missed };
}

/** Veces que un hábito se retomó al día siguiente de fallarlo (para el logro). */
export function rescuesCount(data: AppData): number {
  let n = 0;
  for (const h of data.habits) {
    if (h.frequency.type === 'perWeek' || h.kind === 'avoid') continue;
    let prevMissed = false;
    for (let d = h.createdAt; d <= todayKey(); d = addDays(d, 1)) {
      if (!isScheduled(h, d)) continue;
      const e = entryOf(data.logs, d, h.id);
      if (e?.skipped) continue;
      const done = isDone(h, e, d);
      if (done && prevMissed) n++;
      if (d < todayKey()) prevMissed = !done;
    }
  }
  return n;
}

/* ---------- Pronóstico ---------- */

const WEEKDAY_PLURAL = ['domingos', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábados'];

export interface DayRisk {
  habit: Habit;
  failRate: number; // en este día de la semana
  usualFailRate: number; // en general
  samples: number;
  weekday: string; // "jueves", "sábados"
  today: string; // "jueves", "sábado"
}

/** Hábitos que suelen fallarse en el día de la semana de `date`. */
export function risksFor(data: AppData, date = todayKey()): DayRisk[] {
  const wd = fromKey(date).getDay();
  const out: DayRisk[] = [];
  for (const h of activeHabits(data)) {
    if (!isScheduled(h, date) || h.frequency.type === 'perWeek') continue;
    if (isDone(h, entryOf(data.logs, date, h.id), date) && h.kind !== 'avoid') continue;
    let same = 0, sameMiss = 0, all = 0, allMiss = 0;
    for (let i = 1; i <= 84; i++) {
      const d = addDays(date, -i);
      if (d < h.createdAt) break;
      if (!isScheduled(h, d)) continue;
      const e = entryOf(data.logs, d, h.id);
      if (e?.skipped) continue;
      const miss = !isDone(h, e, d);
      all++;
      if (miss) allMiss++;
      if (fromKey(d).getDay() === wd && same < 8) {
        same++;
        if (miss) sameMiss++;
      }
    }
    if (same < 4 || all < 10) continue;
    const failRate = sameMiss / same;
    const usual = allMiss / all;
    if (failRate >= 0.5 && failRate >= usual + 0.15) {
      out.push({ habit: h, failRate, usualFailRate: usual, samples: same, weekday: WEEKDAY_PLURAL[wd], today: WEEKDAYS_LONG[wd] });
    }
  }
  return out.sort((a, b) => b.failRate - a.failRate);
}

/** Avanza `n` días programados desde hoy (incluyéndolo si todavía no se hizo). */
function afterScheduledDays(h: Habit, logs: Logs, n: number, from = todayKey()): string {
  let d = isDone(h, entryOf(logs, from, h.id), from) ? addDays(from, 1) : from;
  let count = 0;
  for (let guard = 0; guard < 2000; guard++, d = addDays(d, 1)) {
    if (h.frequency.type === 'weekdays' && !h.frequency.days.includes(fromKey(d).getDay())) continue;
    count++;
    if (count >= n) return d;
  }
  return d;
}

export interface Milestones {
  /** fecha en la que la racha llega a 66 días (cuando un hábito suele volverse automático) */
  automatic: string | null;
  streak: number;
  /** fecha en la que la fuerza llega a 80% (consolidado) si se cumple cada día programado */
  consolidated: string | null;
  strength: number;
  /** peor día de la semana */
  worstDay: { weekday: string; rate: number } | null;
}

export function milestonesOf(h: Habit, data: AppData): Milestones {
  const ws = data.settings.weekStart;
  const st = streaks(h, data.logs, ws);
  const s = strength(h, data.logs, ws);
  let automatic: string | null = null;
  if (h.frequency.type !== 'perWeek' && st.current >= 1 && st.current < 66) automatic = afterScheduledDays(h, data.logs, 66 - st.current);
  let consolidated: string | null = null;
  if (s < 0.8) {
    const alpha = 0.052;
    const n = Math.ceil(Math.log((1 - 0.8) / (1 - s)) / Math.log(1 - alpha));
    consolidated = h.frequency.type === 'perWeek' ? addDays(todayKey(), n) : afterScheduledDays(h, data.logs, n);
  }
  // peor día de la semana (últimas 12 semanas)
  const acc = Array.from({ length: 7 }, () => ({ d: 0, t: 0 }));
  for (let i = 1; i <= 84; i++) {
    const d = addDays(todayKey(), -i);
    if (d < h.createdAt) break;
    if (!isScheduled(h, d) || entryOf(data.logs, d, h.id)?.skipped) continue;
    const w = fromKey(d).getDay();
    acc[w].t++;
    if (isDone(h, entryOf(data.logs, d, h.id), d)) acc[w].d++;
  }
  let worstDay: Milestones['worstDay'] = null;
  if (h.frequency.type !== 'perWeek') {
    acc.forEach((a, w) => {
      if (a.t < 4) return;
      const rate = a.d / a.t;
      if (!worstDay || rate < worstDay.rate) worstDay = { weekday: WEEKDAY_PLURAL[w], rate };
    });
  }
  return { automatic, streak: st.current, consolidated, strength: s, worstDay };
}

/** El hito más cercano entre todos los hábitos, para mostrar en Hoy. */
export function nextMilestone(data: AppData): { habit: Habit; date: string; kind: 'automatic' | 'consolidated'; streak: number } | null {
  let best: { habit: Habit; date: string; kind: 'automatic' | 'consolidated'; streak: number } | null = null;
  for (const h of activeHabits(data)) {
    const m = milestonesOf(h, data);
    const cands: [string | null, 'automatic' | 'consolidated'][] = [[m.automatic, 'automatic'], [m.consolidated, 'consolidated']];
    for (const [date, kind] of cands) {
      if (!date || (kind === 'automatic' && m.streak < 7)) continue;
      if (!best || date < best.date) best = { habit: h, date, kind, streak: m.streak };
    }
  }
  return best;
}
