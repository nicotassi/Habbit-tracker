// Metas que se adaptan solas: si un hábito viene fallando seguido, propone achicar la meta;
// si está consolidado, propone subirla. Nunca cambia nada sin que lo aceptes.
import type { AppData, Habit } from './types';
import { activeHabits, entryOf, isDone, isScheduled, streaks, targetOn, timesOn, weekCount } from './stats';
import { addDays, diffDays, todayKey, weekStartOf } from './date';

export type AdaptDir = 'down' | 'up' | 'shrink';

export interface AdaptSuggestion {
  habit: Habit;
  dir: AdaptDir;
  title: string;
  text: string;
  evidence: string;
  /** cambio propuesto (sin cambio = sugerencia de achicar el hábito editándolo) */
  change?: { target?: number; times?: number };
  cta: string;
}

const COOLDOWN = 14 * 86400000;

/** Redondea a un número "lindo" según su tamaño. */
export function niceNumber(v: number): number {
  if (v < 15) return Math.max(1, Math.round(v));
  if (v < 100) return Math.round(v / 5) * 5;
  if (v < 1000) return Math.round(v / 50) * 50;
  return Math.round(v / 500) * 500;
}

const median = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b);
  return s.length ? (s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2) : 0;
};

const pctTxt = (r: number) => `${Math.round(r * 100)}%`;
const unitOf = (h: Habit, n: number) => (h.unit ? `${n} ${h.unit}` : String(n));

export function adaptSuggestions(data: AppData, today = todayKey(), now = Date.now()): AdaptSuggestion[] {
  const out: AdaptSuggestion[] = [];
  const ws = data.settings.weekStart;
  for (const h of activeHabits(data)) {
    if (h.kind === 'avoid') continue;
    const rec = data.adapt?.[h.id];
    if (rec && now - rec.at < COOLDOWN) continue;
    const lastChange = h.goalLog?.length ? h.goalLog[h.goalLog.length - 1].until : null;
    const since = lastChange && lastChange >= h.createdAt ? addDays(lastChange, 1) : h.createdAt;
    if (diffDays(today, since) < 14) continue; // muy nuevo o recién ajustado: hay que darle tiempo

    if (h.frequency.type === 'perWeek') {
      const times = timesOn(h, today);
      const thisW = weekStartOf(today, ws);
      const weeks = [1, 2, 3, 4].map((i) => addDays(thisW, -7 * i)).filter((w) => w >= weekStartOf(since, ws) && addDays(w, 6) >= since);
      if (weeks.length < 2) continue;
      const counts = weeks.map((w) => weekCount(h, data.logs, w, ws));
      const avg = counts.reduce((a, b) => a + b, 0) / counts.length;
      const met = counts.filter((c) => c >= times).length;
      if (avg < times * 0.6 && times > 1) {
        const next = Math.max(1, Math.min(times - 1, Math.round(avg) || 1));
        out.push({
          habit: h, dir: 'down', change: { times: next }, cta: `Bajar a ${next} por semana`,
          title: `${h.emoji} ${h.name}: ¿una meta más alcanzable?`,
          text: `Tu meta es ${times} veces por semana, pero venís haciendo ${avg.toFixed(1).replace('.0', '')} en promedio. Con ${next} por semana vas a cumplir más seguido, y cumplir es lo que construye el hábito. Cuando se vuelva fácil, la subimos.`,
          evidence: `Últimas ${weeks.length} semanas: ${counts.slice().reverse().join(', ')} veces · meta cumplida ${met} de ${weeks.length}`,
        });
      } else if (met === weeks.length && weeks.length >= 3 && times < 7) {
        const next = times + 1;
        out.push({
          habit: h, dir: 'up', change: { times: next }, cta: `Subir a ${next} por semana`,
          title: `${h.emoji} ${h.name} ya es parte tuya`,
          text: `Cumpliste tu meta de ${times} por semana todas las semanas. Si querés un nuevo desafío, probá con ${next}. Si preferís mantenerlo así, también está perfecto.`,
          evidence: `Últimas ${weeks.length} semanas: ${counts.slice().reverse().join(', ')} veces`,
        });
      }
      continue;
    }

    // hábitos diarios o de días fijos: últimos 21 días agendados (sin contar hoy ni los salteados)
    const days: string[] = [];
    for (let d = addDays(today, -1); d >= since && days.length < 21 && diffDays(today, d) <= 45; d = addDays(d, -1)) {
      if (isScheduled(h, d) && !entryOf(data.logs, d, h.id)?.skipped) days.push(d);
    }
    if (days.length < 8) continue;
    const recent = days.slice(0, 14);
    const doneRecent = recent.filter((d) => isDone(h, entryOf(data.logs, d, h.id), d)).length;
    const rate = doneRecent / recent.length;
    const target = targetOn(h, today);
    const numeric = h.kind === 'count' || h.kind === 'quantity';

    if (rate < 0.4) {
      if (numeric && target >= 2) {
        const vals = recent.map((d) => entryOf(data.logs, d, h.id)?.value ?? 0).filter((v) => v > 0);
        let next = niceNumber(vals.length >= 3 ? median(vals) : target * 0.5);
        if (next >= target) next = niceNumber(target * 0.7);
        if (next >= target) next = target - 1;
        next = Math.max(1, next);
        out.push({
          habit: h, dir: 'down', change: { target: next }, cta: `Probar con ${unitOf(h, next)}`,
          title: `${h.emoji} ${h.name}: ¿una meta más alcanzable?`,
          text: `En las últimas semanas lo cumpliste ${pctTxt(rate)} de las veces${vals.length >= 3 ? ` y cuando lo hacés llegás a unos ${unitOf(h, niceNumber(median(vals)))}` : ''}. ¿Probamos con ${unitOf(h, next)} por ahora? Mejor una meta chica que se cumple que una grande que frustra. Cuando se vuelva fácil, la subimos.`,
          evidence: `${doneRecent} de ${recent.length} días cumplidos · meta actual ${unitOf(h, target)}`,
        });
      } else {
        out.push({
          habit: h, dir: 'shrink', cta: 'Achicar el hábito',
          title: `${h.emoji} ${h.name} viene costando`,
          text: `Lo hiciste ${pctTxt(rate)} de los días. No es falta de ganas: probablemente es muy grande o está en mal momento. Probá con la versión de 2 minutos (por ejemplo, solo empezar), con menos días por semana o con otro horario.`,
          evidence: `${doneRecent} de ${recent.length} días cumplidos`,
        });
      }
      continue;
    }

    if (numeric && days.length >= 14) {
      const rate21 = days.filter((d) => isDone(h, entryOf(data.logs, d, h.id), d)).length / days.length;
      const st = streaks(h, data.logs, ws, today);
      if (rate21 >= 0.9 && st.current >= 10) {
        let next = niceNumber(target * 1.2);
        if (next <= target) next = target + 1;
        out.push({
          habit: h, dir: 'up', change: { target: next }, cta: `Subir a ${unitOf(h, next)}`,
          title: `${h.emoji} ${h.name} ya es parte tuya`,
          text: `Lo cumplís el ${pctTxt(rate21)} de los días y llevás ${st.current} seguidos. Si querés seguir creciendo, probá con ${unitOf(h, next)}. Si preferís mantenerlo así, también está perfecto.`,
          evidence: `${days.length} días analizados · racha de ${st.current}`,
        });
      }
    }
  }
  const order: Record<AdaptDir, number> = { down: 0, shrink: 1, up: 2 };
  return out.sort((a, b) => order[a.dir] - order[b.dir] || Number(!!b.habit.nonNegotiable) - Number(!!a.habit.nonNegotiable));
}
