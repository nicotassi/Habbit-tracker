// Motor del día: a partir de tus hábitos, tus resultados y el análisis de "Cómo vas",
// arma cómo encarar el día: qué tipo de día es, qué hacer primero, por qué y qué está en juego.
import type { AppData, Habit } from './types';
import { activeHabits, dayStats, entryOf, isDone, levelOf, matchesDay, nonNegotiableDay, perfectDayStreak, streaks, xpOf } from './stats';
import { milestonesOf, rescueOf, risksFor } from './forecast';
import { dailyReport, METRICS, type Note, type Pattern } from './coach';
import { slotFor, slotStatus, startMinutes, type SlotStatus } from './schedule';
import { diffDays, fromKey, todayKey } from './date';

export type DayMode = 'recover' | 'regain' | 'steady' | 'push' | 'complete' | 'closing';

export interface Reason { icon: string; text: string; tone: 'nn' | 'warn' | 'good' | 'info' }

export interface PlanItem {
  habit: Habit;
  done: boolean;
  tier: number; // 0 no negociable, 1 rescate, 2 día difícil, 3 su horario es ahora o ya pasó, 4 resto
  reasons: Reason[];
  status: SlotStatus;
  /** sugerencia de versión mínima (días de recuperación o rescate) */
  minimal: boolean;
}

export interface DayPlan {
  mode: DayMode;
  title: string;
  subtitle: string;
  quote: [string, string];
  score?: number;
  items: PlanItem[];
  next: PlanItem | null;
  stakes: Note[];
  why: Note[];
  tips: Note[];
  progress: { done: number; total: number; nnDone: number; nnTotal: number };
  needsCheckIn: boolean;
  evening: boolean;
}

const QUOTES: Record<DayMode, [string, string][]> = {
  recover: [
    ['Descansar también es parte del plan.', 'Anónimo'],
    ['En los días difíciles, hacé lo mínimo, pero hacelo.', 'Anónimo'],
    ['La constancia se construye en los días que no tenés ganas.', 'Anónimo'],
  ],
  regain: [
    ['Fallar un día es humano. Fallar dos es el comienzo de un nuevo hábito.', 'James Clear'],
    ['No importa cuántas veces caigas, sino cuántas te levantás.', 'Vince Lombardi'],
    ['Hoy es el día perfecto para retomar.', 'Anónimo'],
  ],
  steady: [
    ['Somos lo que hacemos repetidamente.', 'Will Durant'],
    ['Pequeños pasos todos los días.', 'Anónimo'],
    ['No subís al nivel de tus metas, caés al nivel de tus sistemas.', 'James Clear'],
  ],
  push: [
    ['Cada acción es un voto por la persona que querés ser.', 'James Clear'],
    ['Lo que hacés hoy puede mejorar todos tus mañanas.', 'Ralph Marston'],
    ['Estás en racha: aprovechala.', 'Anónimo'],
  ],
  complete: [
    ['Día cumplido. Disfrutá el resto.', 'Ritmo'],
    ['La disciplina de hoy es la libertad de mañana.', 'Jocko Willink'],
  ],
  closing: [
    ['Terminá el día con una victoria, aunque sea chica.', 'Anónimo'],
    ['Mañana empezás de nuevo, pero hoy todavía suma.', 'Anónimo'],
  ],
};

const pick = <T,>(xs: T[], seed: string) => {
  let h = 0;
  for (const c of seed) h = (h * 31 + c.charCodeAt(0)) | 0;
  return xs[Math.abs(h) % xs.length];
};

const WEEKDAY = ['domingos', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábados'];

/** Frase corta de por qué te conviene un hábito, a partir de un patrón (positivo) de tus datos. */
const FRIENDLY: Record<string, string> = {
  mood: 'Mejora tu ánimo', energy: 'Te da más energía', moodStress: 'Te baja el estrés', watchStress: 'Te baja el estrés',
  sleep: 'Dormís más', sleepScore: 'Mejora tu sueño', deepSleep: 'Más sueño profundo', steps: 'Te hace mover más',
  bodyBattery: 'Te recarga energía', restingHr: 'Baja tu pulso en reposo', hrv: 'Mejora tu recuperación', habits: 'Te ordena el día', focus: 'Te enfoca más',
};
function patternReason(p: Pattern): string {
  const base = FRIENDLY[p.metric] ?? `Mejora tu ${METRICS[p.metric].label}`;
  if (p.lag && p.metric === 'sleep') return 'Dormís más esa noche';
  return p.lag ? `${base} al día siguiente` : base;
}

export function buildDayPlan(data: AppData, date = todayKey(), now = new Date()): DayPlan {
  const isToday = date === todayKey();
  const hour = isToday ? now.getHours() : 9;
  const habits = activeHabits(data).filter((h) => matchesDay(h, date));
  const ws = data.settings.weekStart;
  const report = isToday ? dailyReport(data, date) : null;
  const risks = isToday ? risksFor(data, date) : [];
  const goodPatterns = (report?.patterns ?? []).filter((p) => p.tone === 'good');
  const mood = data.moods[date];

  const items: PlanItem[] = habits.map((h) => {
    const e = entryOf(data.logs, date, h.id);
    const done = isDone(h, e, date);
    const reasons: Reason[] = [];
    const rescue = rescueOf(h, data.logs, date);
    const risk = risks.find((r) => r.habit.id === h.id);
    const slot = slotFor(h, date);
    const status = slot && isToday && !done ? slotStatus(slot, now) : null;
    if (h.nonNegotiable) reasons.push({ icon: '🔒', text: 'No negociable', tone: 'nn' });
    if (rescue?.state === 'rescue') reasons.push({ icon: '🛟', text: rescue.missed === 1 ? 'Ayer no salió' : `${rescue.missed} días sin hacerlo`, tone: 'warn' });
    if (risk) reasons.push({ icon: '⚠️', text: `Los ${risk.weekday} te cuesta (${Math.round(risk.failRate * 100)}%)`, tone: 'warn' });
    if (status) reasons.push({ icon: '🕐', text: status.kind === 'late' ? 'Se te pasó la hora' : status.label, tone: status.kind === 'late' ? 'warn' : 'info' });
    if (!done && h.frequency.type !== 'perWeek') {
      const st = streaks(h, data.logs, ws, date);
      if (st.current >= 3) reasons.push({ icon: '🔥', text: `Racha de ${st.current}: hoy la llevás a ${st.current + 1}`, tone: 'good' });
      const m = milestonesOf(h, data);
      if (m.automatic && diffDays(m.automatic, date) <= 7) reasons.push({ icon: '🧬', text: `A ${Math.max(1, diffDays(m.automatic, date) + 1)} días de volverse automático`, tone: 'good' });
    }
    const pat = goodPatterns.find((p) => p.habit.id === h.id);
    if (pat) reasons.push({ icon: '✨', text: patternReason(pat), tone: 'good' });
    const tier = h.nonNegotiable ? 0 : rescue?.state === 'rescue' ? 1 : risk ? 2 : status && (status.kind === 'now' || status.kind === 'late') ? 3 : 4;
    return { habit: h, done, tier, reasons: reasons.slice(0, 3), status, minimal: false };
  });

  // tipo de día
  const recIcons = new Set((report?.recommendations ?? []).map((r) => r.icon));
  const pending = items.filter((i) => !i.done);
  const rescues = items.filter((i) => i.tier === 1 && !i.done).length;
  const nn = nonNegotiableDay(data, date);
  let mode: DayMode;
  if (items.length && !pending.length) mode = 'complete';
  else if (isToday && hour >= 20) mode = 'closing';
  else if (recIcons.has('🛌') || (mood && (mood.energy <= 2 || mood.mood <= 2))) mode = 'recover';
  else if (rescues >= 2) mode = 'regain';
  else if ((report?.overall ?? 0) >= 75 && !rescues) mode = 'push';
  else mode = 'steady';
  if (mode === 'recover' || mode === 'regain') for (const i of items) if (!i.done && i.habit.kind !== 'check' && i.habit.kind !== 'avoid') i.minimal = true;

  // orden: lo pendiente primero, por prioridad y después por horario
  items.sort((a, b) => Number(a.done) - Number(b.done) || a.tier - b.tier || startMinutes(a.habit, date) - startMinutes(b.habit, date));
  const next = items.find((i) => !i.done && i.habit.kind !== 'avoid') ?? null;

  const s = dayStats(data, date);
  const name = data.settings.name ? `, ${data.settings.name}` : '';
  const titles: Record<DayMode, [string, string]> = {
    recover: ['Día de recuperación', 'Tu cuerpo pide pausa. Hoy el objetivo es no romper nada: la versión más chica de cada hábito, y a dormir temprano.'],
    regain: ['Día de recuperar el ritmo', `Ayer se cayeron ${rescues} hábitos. Nunca dos veces seguidas: arrancá por esos, aunque sea un poco.`],
    steady: ['Día de constancia', 'Ni más ni menos: lo de siempre, bien hecho. La magia está en repetir.'],
    push: ['Día para ir por más', `Venís muy bien${report?.overall !== undefined ? ` (${Math.round(report.overall)} puntos)` : ''}. Es un buen día para sumarle un extra a tu hábito más difícil.`],
    complete: [`¡Día completo${name}!`, 'Hiciste todo lo que te propusiste. Lo que venga ahora es extra.'],
    closing: ['Cierre del día', pending.length ? `Te ${pending.length === 1 ? 'queda 1 hábito' : `quedan ${pending.length} hábitos`}. Elegí uno y cerrá el día con una victoria.` : 'Buen día. Mañana, a repetir.'],
  };
  if (nn.total && !nn.complete && mode !== 'complete') titles[mode][1] += ` Primero: ${nn.pending.map((h) => h.name).join(', ')}.`;

  // lo que está en juego hoy
  const stakes: Note[] = [];
  const bigStreaks = items.filter((i) => !i.done).map((i) => ({ i, st: streaks(i.habit, data.logs, ws, date) })).filter((x) => x.st.unit !== 'semanas' && x.st.current >= 7).sort((a, b) => b.st.current - a.st.current);
  if (bigStreaks[0]) stakes.push({ icon: '🔥', tone: 'good', text: `${bigStreaks[0].i.habit.emoji} ${bigStreaks[0].i.habit.name}: ${bigStreaks[0].st.current} días seguidos. Hoy define si sigue creciendo.` });
  if (s.total && s.done < s.total) {
    const pd = perfectDayStreak(data);
    stakes.push({ icon: '⭐', tone: 'info', text: `Si completás los ${s.total - s.done} que faltan, sumás un día perfecto${pd.current ? ` y llevás la racha de días perfectos a ${pd.current + 1}` : ''}.` });
  }
  const lv = levelOf(xpOf(data));
  const toLevel = Math.ceil(lv.toNext / 10);
  if (toLevel <= Math.max(3, pending.length)) stakes.push({ icon: '🆙', tone: 'good', text: `Estás a ${toLevel} ${toLevel === 1 ? 'hábito' : 'hábitos'} de subir al nivel ${lv.level + 1}.` });
  if (nn.total) stakes.push({ icon: '🔒', tone: nn.complete ? 'good' : 'warn', text: nn.complete ? 'Tus no negociables ya están hechos.' : `No negociables: ${nn.done} de ${nn.total} hechos.` });

  // por qué te conviene (tus propios datos, contados como motivación)
  const why: Note[] = goodPatterns.slice(0, 3).map((p) => ({ icon: '✨', tone: 'good', text: p.text, evidence: p.evidence }));

  // consejos de "Cómo vas" que no repiten lo que ya está en el plan
  const tips = (report?.recommendations ?? []).filter((r) => r.icon !== '🔒' && r.icon !== '🛟' && r.icon !== '🔮').slice(0, 3);

  return {
    mode,
    title: titles[mode][0],
    subtitle: titles[mode][1],
    quote: pick(QUOTES[mode], date),
    score: report?.overall,
    items,
    next,
    stakes: stakes.slice(0, 4),
    why,
    tips,
    progress: { done: s.done, total: s.total, nnDone: nn.done, nnTotal: nn.total },
    needsCheckIn: isToday && !mood,
    evening: isToday && hour >= 20,
  };
}

/** Saludo según la hora. */
export function greetingFor(now = new Date()): string {
  const h = now.getHours();
  return h < 6 ? 'Buenas noches' : h < 13 ? 'Buen día' : h < 20 ? 'Buenas tardes' : 'Buenas noches';
}

export const weekdayName = (date: string) => WEEKDAY[fromKey(date).getDay()];
