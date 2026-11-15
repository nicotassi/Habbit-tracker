// "Cómo vas": análisis por reglas y estadística simple, sin IA. Corre en el dispositivo.
// Compara cada dato con tu propia normal (últimas 4 semanas), detecta tendencias,
// busca patrones entre hábitos y salud (el mismo día y al día siguiente) y redacta recomendaciones.
import type { AppData, Habit } from './types';
import { activeHabits, dayStats, entryOf, isDone, isScheduled, mean, streaks } from './stats';
import { milestonesOf, rescueOf, risksFor } from './forecast';
import { addDays, range, todayKey } from './date';

/* ---------- Métricas diarias ---------- */

export type MetricKey =
  | 'habits' | 'mood' | 'moodStress' | 'energy' | 'sleep' | 'deepSleep' | 'sleepScore'
  | 'steps' | 'restingHr' | 'watchStress' | 'bodyBattery' | 'hrv' | 'focus';

interface MetricMeta {
  label: string;
  /** true: más es mejor; false: menos es mejor */
  higherIsBetter: boolean;
  /** diferencia mínima que vale la pena mencionar */
  minDiff: number;
  /** para concordar: "tu energía fue más baja", "tus pasos fueron más altos" */
  fem?: boolean;
  plural?: boolean;
  fmt: (v: number) => string;
}

const hm = (h: number) => {
  const t = Math.round(h * 60);
  return `${Math.floor(t / 60)} h ${String(t % 60).padStart(2, '0')}`;
};
const int = (v: number) => Math.round(v).toLocaleString('es');
const one = (v: number) => (Math.round(v * 10) / 10).toLocaleString('es');

export const METRICS: Record<MetricKey, MetricMeta> = {
  habits: { label: 'cumplimiento de hábitos', higherIsBetter: true, minDiff: 10, fmt: (v) => `${Math.round(v)}%` },
  mood: { label: 'ánimo', higherIsBetter: true, minDiff: 0.5, fmt: (v) => `${one(v)}/5` },
  moodStress: { label: 'estrés (registro)', higherIsBetter: false, minDiff: 0.5, fmt: (v) => `${one(v)}/5` },
  energy: { fem: true, label: 'energía', higherIsBetter: true, minDiff: 0.5, fmt: (v) => `${one(v)}/5` },
  sleep: { label: 'sueño', higherIsBetter: true, minDiff: 0.4, fmt: hm },
  deepSleep: { label: 'sueño profundo', higherIsBetter: true, minDiff: 0.15, fmt: hm },
  sleepScore: { label: 'puntaje de sueño', higherIsBetter: true, minDiff: 5, fmt: int },
  steps: { plural: true, label: 'pasos', higherIsBetter: true, minDiff: 1500, fmt: int },
  restingHr: { fem: true, label: 'frecuencia cardíaca en reposo', higherIsBetter: false, minDiff: 3, fmt: (v) => `${int(v)} ppm` },
  watchStress: { label: 'estrés (reloj)', higherIsBetter: false, minDiff: 8, fmt: int },
  bodyBattery: { fem: true, label: 'energía del reloj', higherIsBetter: true, minDiff: 8, fmt: int },
  hrv: { fem: true, label: 'VFC', higherIsBetter: true, minDiff: 5, fmt: (v) => `${int(v)} ms` },
  focus: { plural: true, label: 'minutos de foco', higherIsBetter: true, minDiff: 20, fmt: (v) => `${int(v)} min` },
};

export function metricValue(data: AppData, key: MetricKey, d: string): number | undefined {
  const m = data.moods[d];
  const w = data.watch?.[d];
  switch (key) {
    case 'habits': {
      const s = dayStats(data, d);
      return s.total ? s.rate * 100 : undefined;
    }
    case 'mood': return m?.mood;
    case 'moodStress': return m?.stress;
    case 'energy': return m?.energy;
    case 'sleep': return w?.sleepHours ?? m?.sleep;
    case 'deepSleep': return w?.deepSleepHours;
    case 'sleepScore': return w?.sleepScore;
    case 'steps': return w?.steps;
    case 'restingHr': return w?.restingHr;
    case 'watchStress': return w?.stress;
    case 'bodyBattery': return w?.bodyBattery;
    case 'hrv': return w?.hrv;
    case 'focus': {
      const mins = data.focus.filter((f) => f.date === d).reduce((s, f) => s + f.minutes, 0);
      return mins || undefined;
    }
  }
}

function sd(xs: number[]): number {
  if (xs.length < 2) return 0;
  const mu = mean(xs);
  return Math.sqrt(xs.reduce((s, x) => s + (x - mu) ** 2, 0) / (xs.length - 1));
}

export interface Baseline { mean: number; sd: number; n: number; min: number; max: number }

/** Tu normal: los 28 días anteriores a `d`. */
export function baseline(data: AppData, key: MetricKey, d: string, days = 28): Baseline | null {
  const xs = range(addDays(d, -days), addDays(d, -1)).map((k) => metricValue(data, key, k)).filter((v): v is number => v !== undefined);
  if (xs.length < 5) return null;
  return { mean: mean(xs), sd: Math.max(sd(xs), METRICS[key].minDiff / 2), n: xs.length, min: Math.min(...xs), max: Math.max(...xs) };
}

/* ---------- Puntajes por área (0-100) ---------- */

export type Area = 'constancia' | 'descanso' | 'movimiento' | 'mente';
export const AREAS: { key: Area; label: string; icon: string }[] = [
  { key: 'constancia', label: 'Constancia', icon: '🔁' },
  { key: 'descanso', label: 'Descanso', icon: '😴' },
  { key: 'movimiento', label: 'Movimiento', icon: '👟' },
  { key: 'mente', label: 'Mente', icon: '🧠' },
];

const MOVE_RE = /entren|camin|corr|gym|gimnas|deporte|bici|nad|yoga|pesas|fútbol|futbol|crossfit|pilates|baile|sentadill|ejercicio|cardio|running|hiit|caminata|paseo|pasos/i;
export const isMovementHabit = (h: Habit) => MOVE_RE.test(h.name);

const avg = (xs: (number | undefined)[]) => {
  const v = xs.filter((x): x is number => x !== undefined && isFinite(x));
  return v.length ? mean(v) : undefined;
};
const clamp = (v: number) => Math.max(0, Math.min(100, v));

function sleepPoints(h: number) {
  if (h >= 7 && h <= 9) return 100;
  if (h < 7) return clamp(((h - 4) / 3) * 100);
  return clamp(100 - ((h - 9) / 2) * 20);
}

/** Puntaje de cada área para un día (lo que falte queda sin definir). */
export function dayAreas(data: AppData, d: string): Partial<Record<Area, number>> {
  const s = dayStats(data, d);
  const m = data.moods[d];
  const w = data.watch?.[d];
  const sleep = w?.sleepHours ?? m?.sleep;
  const deepRatio = w?.deepSleepHours !== undefined && sleep ? w.deepSleepHours / sleep : undefined;
  const moveHabits = activeHabits(data).filter((h) => isMovementHabit(h) && isScheduled(h, d) && h.frequency.type !== 'perWeek');
  const moveDone = moveHabits.length ? (moveHabits.filter((h) => isDone(h, entryOf(data.logs, d, h.id), d)).length / moveHabits.length) * 100 : undefined;
  return {
    constancia: s.total ? s.rate * 100 : undefined,
    descanso: avg([sleep !== undefined ? sleepPoints(sleep) : undefined, w?.sleepScore, deepRatio !== undefined ? clamp((deepRatio / 0.18) * 100) : undefined]),
    movimiento: avg([w?.steps !== undefined ? clamp((w.steps / 8000) * 100) : undefined, moveDone]),
    mente: avg([
      m ? ((m.mood - 1) / 4) * 100 : undefined,
      m ? ((5 - m.stress) / 4) * 100 : undefined,
      m ? ((m.energy - 1) / 4) * 100 : undefined,
      w?.stress !== undefined ? 100 - w.stress : undefined,
      w?.bodyBattery,
    ]),
  };
}

/** Promedio de cada área en un rango de días. */
export function areasOver(data: AppData, days: string[]): Partial<Record<Area, number>> {
  const per = days.map((d) => dayAreas(data, d));
  const out: Partial<Record<Area, number>> = {};
  for (const a of AREAS) {
    const v = avg(per.map((p) => p[a.key]));
    if (v !== undefined) out[a.key] = v;
  }
  return out;
}

export const overallOf = (a: Partial<Record<Area, number>>) => avg(AREAS.map((x) => a[x.key]));
export const light = (v?: number): 'good' | 'warn' | 'bad' | 'none' => (v === undefined ? 'none' : v >= 70 ? 'good' : v >= 45 ? 'warn' : 'bad');

/* ---------- Observaciones ---------- */

/** "tu ánimo fue más alto", "tu energía fue más baja", "tus pasos fueron más altos" */
const tu = (m: MetricMeta) => (m.plural ? 'tus' : 'tu');
const fue = (m: MetricMeta) => (m.plural ? 'fueron' : 'fue');
const es = (m: MetricMeta) => (m.plural ? 'son' : 'es');
const mas = (m: MetricMeta, up: boolean) => `más ${up ? 'alt' : 'baj'}${m.fem ? 'a' : 'o'}${m.plural ? 's' : ''}`;

export type Tone = 'good' | 'warn' | 'bad' | 'info';
export interface Note { icon: string; text: string; tone: Tone; evidence?: string }

/** Elige siempre la misma variante para un día, distinta entre días. */
function pick<T>(opts: T[], seed: string): T {
  let h = 0;
  for (const c of seed) h = (h * 31 + c.charCodeAt(0)) | 0;
  return opts[Math.abs(h) % opts.length];
}

const ICON: Partial<Record<MetricKey, string>> = {
  mood: '🙂', moodStress: '🌪', energy: '⚡', sleep: '😴', deepSleep: '🌌', sleepScore: '🌙', steps: '👟',
  restingHr: '❤️', watchStress: '🌪', bodyBattery: '🔋', hrv: '📈', focus: '⏱️', habits: '🔁',
};

const DAILY_KEYS: MetricKey[] = ['sleep', 'sleepScore', 'deepSleep', 'watchStress', 'bodyBattery', 'restingHr', 'hrv', 'steps', 'mood', 'energy', 'moodStress'];

/** El último día con datos de reloj o ánimo (hoy o hasta 2 días atrás). */
function latestDay(data: AppData, today: string): string | null {
  for (let i = 0; i <= 2; i++) {
    const d = addDays(today, -i);
    if (data.moods[d] || data.watch?.[d]) return d;
  }
  return null;
}

/** Cómo están tus datos más recientes comparados con tu normal. */
export function todayVsNormal(data: AppData, today = todayKey()): Note[] {
  const d = latestDay(data, today);
  if (!d) return [];
  const when = d === today ? 'Hoy' : d === addDays(today, -1) ? 'Ayer' : 'Hace 2 días';
  const out: (Note & { z: number })[] = [];
  for (const k of DAILY_KEYS) {
    const v = metricValue(data, k, d);
    const b = baseline(data, k, d);
    if (v === undefined || !b) continue;
    const meta = METRICS[k];
    const diff = v - b.mean;
    if (Math.abs(diff) < meta.minDiff) continue;
    const z = diff / b.sd;
    if (Math.abs(z) < 0.8) continue;
    const better = meta.higherIsBetter ? diff > 0 : diff < 0;
    const recent = range(addDays(d, -14), addDays(d, -1)).map((x) => metricValue(data, k, x)).filter((x): x is number => x !== undefined);
    const record = recent.length >= 5 && (diff > 0 ? v > Math.max(...recent) : v < Math.min(...recent));
    const recordTxt = record ? (diff > 0 ? ', el valor más alto de las últimas 2 semanas' : ', el valor más bajo de las últimas 2 semanas') : '';
    const amount = k === 'sleep' || k === 'deepSleep' ? hm(Math.abs(diff)) : meta.fmt(Math.abs(diff)).replace('/5', ' puntos');
    let text: string;
    if (k === 'sleep') text = `${when} dormiste ${meta.fmt(v)}: ${amount} ${diff > 0 ? 'más' : 'menos'} que tu promedio (${meta.fmt(b.mean)})${recordTxt}.`;
    else if (k === 'steps') text = `${when}: ${meta.fmt(v)} pasos, ${diff > 0 ? 'bastante más' : 'bastante menos'} que lo habitual (${meta.fmt(b.mean)})${recordTxt}.`;
    else text = `${when}, ${tu(meta)} ${meta.label} ${fue(meta)} ${meta.fmt(v)}, ${mas(meta, diff > 0)} que tu normal (${meta.fmt(b.mean)})${recordTxt}.`;
    out.push({ icon: ICON[k] ?? '•', text, tone: better ? 'good' : Math.abs(z) >= 1.5 ? 'bad' : 'warn', evidence: `Tu normal: promedio de ${b.n} días de las últimas 4 semanas.`, z: Math.abs(z) });
  }
  return out.sort((a, b) => b.z - a.z).slice(0, 5).map(({ z: _z, ...n }) => n);
}

/** Pendiente por día (mínimos cuadrados). */
function slope(points: { x: number; y: number }[]): number {
  const n = points.length;
  const mx = mean(points.map((p) => p.x));
  const my = mean(points.map((p) => p.y));
  let num = 0, den = 0;
  for (const p of points) { num += (p.x - mx) * (p.y - my); den += (p.x - mx) ** 2; }
  return n > 1 && den ? num / den : 0;
}

const TREND_KEYS: MetricKey[] = ['habits', 'sleep', 'sleepScore', 'steps', 'watchStress', 'restingHr', 'bodyBattery', 'mood', 'energy', 'moodStress', 'hrv'];

/** Tendencias de las últimas 2 semanas. */
export function trends(data: AppData, today = todayKey()): Note[] {
  const out: (Note & { w: number })[] = [];
  const days = range(addDays(today, -14), addDays(today, -1));
  for (const k of TREND_KEYS) {
    const pts = days.map((d, i) => ({ x: i, y: metricValue(data, k, d) })).filter((p): p is { x: number; y: number } => p.y !== undefined);
    if (pts.length < 7) continue;
    const meta = METRICS[k];
    const perWeek = slope(pts) * 7;
    if (Math.abs(perWeek) < meta.minDiff * 0.6) continue;
    const up = perWeek > 0;
    const good = meta.higherIsBetter ? up : !up;
    const amount = k === 'sleep' ? `${Math.round(Math.abs(perWeek) * 60)} minutos` : k === 'habits' ? `${Math.round(Math.abs(perWeek))} puntos` : meta.fmt(Math.abs(perWeek)).replace('/5', ' puntos');
    out.push({
      icon: up ? '📈' : '📉',
      text: `${meta.plural ? 'Tus' : 'Tu'} ${meta.label} ${meta.plural ? 'vienen' : 'viene'} ${up ? 'subiendo' : 'bajando'}: unos ${amount} por semana en las últimas 2 semanas.`,
      tone: good ? 'good' : 'warn',
      evidence: `Calculado con ${pts.length} días con datos.`,
      w: Math.abs(perWeek) / meta.minDiff,
    });
  }
  return out.sort((a, b) => b.w - a.w).slice(0, 4).map(({ w: _w, ...n }) => n);
}

/* ---------- Patrones entre hábitos y salud ---------- */

export interface Pattern extends Note { habit: Habit; metric: MetricKey; lag: 0 | 1; effect: number }

const SAME_DAY: MetricKey[] = ['mood', 'energy', 'moodStress', 'watchStress', 'steps', 'bodyBattery'];
const NEXT_DAY: MetricKey[] = ['sleep', 'sleepScore', 'deepSleep', 'restingHr', 'hrv', 'mood', 'energy', 'bodyBattery'];

/**
 * Compara los días en que hiciste cada hábito con los que no.
 * lag 1: el hábito de un día contra el dato del día siguiente (el sueño de la captura de hoy es el de anoche).
 */
export function patterns(data: AppData, today = todayKey(), days = 60): Pattern[] {
  const out: Pattern[] = [];
  const window = range(addDays(today, -days), addDays(today, -1));
  for (const h of activeHabits(data)) {
    for (const [lag, keys] of [[0, SAME_DAY], [1, NEXT_DAY]] as const) {
      for (const k of keys) {
        const w: number[] = [];
        const wo: number[] = [];
        for (const d of window) {
          if (!isScheduled(h, d) || entryOf(data.logs, d, h.id)?.skipped) continue;
          const target = lag ? addDays(d, 1) : d;
          if (target > today) continue;
          const v = metricValue(data, k, target);
          if (v === undefined) continue;
          (isDone(h, entryOf(data.logs, d, h.id), d) ? w : wo).push(v);
        }
        if (w.length < 4 || wo.length < 4) continue;
        const a = mean(w);
        const b = mean(wo);
        const pooled = Math.sqrt(((w.length - 1) * sd(w) ** 2 + (wo.length - 1) * sd(wo) ** 2) / (w.length + wo.length - 2)) || METRICS[k].minDiff;
        const effect = (a - b) / pooled;
        if (Math.abs(effect) < 0.5 || Math.abs(a - b) < METRICS[k].minDiff * 0.6) continue;
        const meta = METRICS[k];
        const good = meta.higherIsBetter ? a > b : a < b;
        const more = a > b;
        let text: string;
        if (lag && k === 'sleep') text = `Las noches después de ${h.emoji} ${h.name} dormís ${hm(Math.abs(a - b))} ${more ? 'más' : 'menos'} (${meta.fmt(a)} vs ${meta.fmt(b)}).`;
        else if (lag) text = `Al día siguiente de ${h.emoji} ${h.name}, ${tu(meta)} ${meta.label} ${es(meta)} ${mas(meta, more)}: ${meta.fmt(a)} vs ${meta.fmt(b)}.`;
        else if (k === 'steps') text = `Los días que hacés ${h.emoji} ${h.name} das ${meta.fmt(Math.abs(a - b))} pasos ${more ? 'más' : 'menos'} (${meta.fmt(a)} vs ${meta.fmt(b)}).`;
        else text = `Los días que hacés ${h.emoji} ${h.name}, ${tu(meta)} ${meta.label} ${es(meta)} ${mas(meta, more)}: ${meta.fmt(a)} vs ${meta.fmt(b)}.`;
        out.push({ icon: good ? '✨' : '⚠️', text, tone: good ? 'good' : 'warn', evidence: `${w.length} días con el hábito y ${wo.length} sin él. Es un patrón, no una causa segura.`, habit: h, metric: k, lag, effect });
      }
    }
  }
  // un patrón por hábito y métrica (el de mayor efecto), ordenados por fuerza
  const best = new Map<string, Pattern>();
  for (const p of out) {
    const key = `${p.habit.id}-${p.metric}`;
    if (!best.has(key) || Math.abs(best.get(key)!.effect) < Math.abs(p.effect)) best.set(key, p);
  }
  // como mucho 2 patrones por hábito, para que el informe cubra más cosas
  const perHabit = new Map<string, number>();
  return [...best.values()]
    .sort((a, b) => Math.abs(b.effect) - Math.abs(a.effect))
    .filter((p) => {
      const n = perHabit.get(p.habit.id) ?? 0;
      perHabit.set(p.habit.id, n + 1);
      return n < 2;
    })
    .slice(0, 5);
}

/* ---------- Recomendación del día ---------- */

export function recommendations(data: AppData, today = todayKey()): Note[] {
  const out: Note[] = [];
  const d = latestDay(data, today) ?? today;
  const sleep = metricValue(data, 'sleep', d);
  const sb = baseline(data, 'sleep', d);
  const wStress = metricValue(data, 'watchStress', d);
  const mStress = metricValue(data, 'moodStress', d);
  const battery = metricValue(data, 'bodyBattery', d);
  const mood = metricValue(data, 'mood', d);
  const lowSleep = sleep !== undefined && (sleep < 6 || (sb && sleep < sb.mean - sb.sd));
  const highStress = (wStress !== undefined && wStress >= 60) || (mStress !== undefined && mStress >= 4);
  const lowEnergy = (battery !== undefined && battery < 30) || (mood !== undefined && mood <= 2);
  const habits = activeHabits(data);
  const rescue = habits.filter((h) => rescueOf(h, data.logs, today)?.state === 'rescue');
  const risks = risksFor(data, today);
  const signals = [lowSleep, highStress, lowEnergy].filter(Boolean).length;

  if (signals >= 2) {
    out.push({
      icon: '🛌', tone: 'warn',
      text: pick([
        'Hoy es día de recuperación: hacé la versión más chica de cada hábito, no rompas las rachas y acostate más temprano.',
        'Tu cuerpo pide pausa. Priorizá lo básico (agua, caminar un poco, dormir temprano) y hacé tus hábitos en versión mínima.',
      ], today),
      evidence: [lowSleep && 'dormiste poco', highStress && 'estrés alto', lowEnergy && 'energía o ánimo bajos'].filter(Boolean).join(', ') + '.',
    });
  } else if (lowSleep) {
    out.push({ icon: '😴', tone: 'warn', text: pick(['Dormiste poco: evitá cafeína después de las 16 y probá acostarte 30 minutos antes esta noche.', 'Noche corta: hoy cuidá la energía, hacé lo importante temprano y dejá las pantallas antes de dormir.'], today) });
  } else if (highStress) {
    const calm = patterns(data, today).find((p) => (p.metric === 'watchStress' || p.metric === 'moodStress') && p.effect < 0);
    const meditation = habits.find((h) => /medit|respir|yoga|mindful/i.test(h.name));
    out.push({
      icon: '🌿', tone: 'warn',
      text: calm ? `Estrés alto. En tus datos, ${calm.habit.emoji} ${calm.habit.name} lo baja: buen día para no saltearlo.`
        : meditation ? `Estrés alto: hoy ${meditation.emoji} ${meditation.name} es tu mejor herramienta, aunque sean 5 minutos.`
        : 'Estrés alto: probá la respiración guiada de la pestaña Pomodoro (4 minutos) y una caminata corta.',
    });
  } else {
    const score = overallOf(areasOver(data, range(addDays(today, -2), today)));
    if (score !== undefined && score >= 75) out.push({ icon: '🚀', tone: 'good', text: pick(['Venís con todo: buen día para sumar un poco más a tu hábito más difícil.', 'Estás en buena forma: aprovechá para adelantar algo que venís postergando.'], today) });
  }

  if (rescue.length) out.push({ icon: '🛟', tone: 'warn', text: `Prioridad: ${rescue.map((h) => `${h.emoji} ${h.name}`).join(', ')}. Ayer no ${rescue.length === 1 ? 'salió' : 'salieron'}; nunca dos veces seguidas.` });
  if (risks[0]) out.push({ icon: '🔮', tone: 'info', text: `Los ${risks[0].weekday} te cuesta ${risks[0].habit.emoji} ${risks[0].habit.name} (lo fallás el ${Math.round(risks[0].failRate * 100)}% de las veces). Hacelo temprano.` });
  const steps = baseline(data, 'steps', today);
  if (steps && steps.mean < 6000) out.push({ icon: '👟', tone: 'info', text: `Tu promedio es de ${int(steps.mean)} pasos. Una caminata de 20 minutos suma unos 2.500.` });
  return out.slice(0, 4);
}

/* ---------- Informe ---------- */

export interface Report {
  enoughData: boolean;
  daysWithData: number;
  overall?: number;
  overallNormal?: number;
  areas: Partial<Record<Area, number>>;
  normal: Partial<Record<Area, number>>;
  headline: string;
  summary: string;
  today: Note[];
  trends: Note[];
  patterns: Pattern[];
  recommendations: Note[];
}

function headlineFor(score: number | undefined, seed: string): string {
  if (score === undefined) return 'Todavía estoy conociéndote.';
  if (score >= 80) return pick(['Venís muy bien.', 'Gran momento: estás en tu mejor nivel.', 'Excelente: todo suma.'], seed);
  if (score >= 60) return pick(['Vas bien, con margen para mejorar.', 'Buen ritmo, con algunos puntos para ajustar.', 'Bien encaminado.'], seed);
  if (score >= 40) return pick(['Días irregulares: hay cosas para ajustar.', 'Vas a media máquina: enfocate en lo básico.', 'Ni bien ni mal: elegí una cosa para mejorar.'], seed);
  return pick(['Venís con poca energía: priorizá lo básico.', 'Momento difícil: bajá la exigencia y sostené lo mínimo.'], seed);
}

export function dailyReport(data: AppData, today = todayKey()): Report {
  const last28 = range(addDays(today, -28), today);
  const daysWithData = last28.filter((d) => data.moods[d] || data.watch?.[d] || dayStats(data, d).done > 0).length;
  // "ahora": constancia de los últimos 7 días completos; el resto, últimos 3 días (suaviza días a medio cargar)
  const recent3 = areasOver(data, range(addDays(today, -2), today));
  const recent7 = areasOver(data, range(addDays(today, -7), addDays(today, -1)));
  const areas: Partial<Record<Area, number>> = { ...recent3, constancia: recent7.constancia };
  const normal = areasOver(data, range(addDays(today, -31), addDays(today, -4)));
  const overall = overallOf(areas);
  const overallNormal = overallOf(normal);
  const present = AREAS.filter((a) => areas[a.key] !== undefined);
  let summary = '';
  if (present.length >= 2) {
    const best = present.reduce((x, y) => (areas[y.key]! > areas[x.key]! ? y : x));
    const worst = present.reduce((x, y) => (areas[y.key]! < areas[x.key]! ? y : x));
    summary = `Lo más fuerte: ${best.label.toLowerCase()} (${Math.round(areas[best.key]!)}). Lo más flojo: ${worst.label.toLowerCase()} (${Math.round(areas[worst.key]!)}).`;
  }
  if (overall !== undefined && overallNormal !== undefined && Math.abs(overall - overallNormal) >= 5) {
    summary += ` Estás ${overall > overallNormal ? 'por encima' : 'por debajo'} de tu normal (${Math.round(overallNormal)}).`;
  }
  return {
    enoughData: daysWithData >= 10,
    daysWithData,
    overall,
    overallNormal,
    areas,
    normal,
    headline: headlineFor(overall, today),
    summary: summary.trim(),
    today: todayVsNormal(data, today),
    trends: trends(data, today),
    patterns: patterns(data, today),
    recommendations: recommendations(data, today),
  };
}

/* ---------- Resumen semanal ---------- */

export interface WeekReport {
  from: string;
  to: string;
  areas: Partial<Record<Area, number>>;
  prev: Partial<Record<Area, number>>;
  overall?: number;
  prevOverall?: number;
  wins: Note[];
  improve: Note[];
  suggestion: Note | null;
  perfectDays: number;
}

const AREA_TIPS: Record<Area, string[]> = {
  constancia: ['Bajá la meta de tu hábito más difícil a la mitad durante una semana: sostener vale más que hacer mucho.', 'Anclá tus hábitos a algo que ya hacés: “después del café, 10 minutos de…”.'],
  descanso: ['Fijá una hora de ir a dormir y poné una alarma 30 minutos antes para empezar a bajar.', 'Probá una semana sin pantallas en la cama: cargá el celular fuera del cuarto.'],
  movimiento: ['Sumá una caminata de 20 minutos después de comer: son unos 2.500 pasos y ayuda a dormir.', 'Agendá tus entrenamientos como reuniones: día y hora fijos.'],
  mente: ['Probá 5 minutos de respiración guiada al mediodía (pestaña Pomodoro).', 'Escribí tres cosas por las que estás agradecido cada noche esta semana.'],
};

export function weeklyReport(data: AppData, today = todayKey()): WeekReport {
  const to = addDays(today, -1);
  const from = addDays(to, -6);
  const days = range(from, to);
  const prevDays = range(addDays(from, -7), addDays(from, -1));
  const areas = areasOver(data, days);
  const prev = areasOver(data, prevDays);
  const habits = activeHabits(data);
  const ws = data.settings.weekStart;
  const rate = (h: Habit, ds: string[]) => {
    const sch = ds.filter((d) => isScheduled(h, d) && !entryOf(data.logs, d, h.id)?.skipped);
    if (h.frequency.type === 'perWeek') return Math.min(1, ds.filter((d) => isDone(h, entryOf(data.logs, d, h.id), d)).length / h.frequency.times);
    return sch.length ? sch.filter((d) => isDone(h, entryOf(data.logs, d, h.id), d)).length / sch.length : undefined;
  };
  const rated = habits.map((h) => ({ h, r: rate(h, days), p: rate(h, prevDays) })).filter((x): x is { h: Habit; r: number; p: number | undefined } => x.r !== undefined);
  const perfectDays = days.filter((d) => { const s = dayStats(data, d, habits); return s.total > 0 && s.done === s.total; }).length;

  const wins: Note[] = [];
  rated.filter((x) => x.r >= 0.85).sort((a, b) => b.r - a.r).slice(0, 2).forEach((x) => wins.push({ icon: x.h.emoji, tone: 'good', text: `${x.h.name}: ${Math.round(x.r * 100)}% de la semana.` }));
  const improved = rated.filter((x) => x.p !== undefined && x.r - x.p >= 0.2).sort((a, b) => b.r - b.p! - (a.r - a.p!))[0];
  if (improved) wins.push({ icon: '📈', tone: 'good', text: `${improved.h.emoji} ${improved.h.name} mejoró: de ${Math.round(improved.p! * 100)}% a ${Math.round(improved.r * 100)}%.` });
  const longest = habits.map((h) => ({ h, s: streaks(h, data.logs, ws) })).filter((x) => x.s.unit !== 'semanas' && x.s.current >= 7).sort((a, b) => b.s.current - a.s.current)[0];
  if (longest) wins.push({ icon: '🔥', tone: 'good', text: `${longest.h.emoji} ${longest.h.name} lleva ${longest.s.current} días seguidos.` });
  if (perfectDays >= 2) wins.push({ icon: '⭐', tone: 'good', text: `${perfectDays} días perfectos esta semana.` });
  for (const a of AREAS) {
    const v = areas[a.key], p = prev[a.key];
    if (v !== undefined && p !== undefined && v - p >= 8) wins.push({ icon: a.icon, tone: 'good', text: `${a.label} subió ${Math.round(v - p)} puntos frente a la semana anterior.` });
  }

  const improve: Note[] = [];
  const weakest = rated.filter((x) => x.r < 0.6).sort((a, b) => a.r - b.r)[0];
  if (weakest) {
    const m = milestonesOf(weakest.h, data);
    improve.push({ icon: weakest.h.emoji, tone: 'warn', text: `${weakest.h.name} quedó en ${Math.round(weakest.r * 100)}%${m.worstDay ? `; los ${m.worstDay.weekday} son tu día más difícil` : ''}.` });
  }
  const presentAreas = AREAS.filter((a) => areas[a.key] !== undefined);
  const worstArea = presentAreas.length ? presentAreas.reduce((x, y) => (areas[y.key]! < areas[x.key]! ? y : x)) : undefined;
  if (worstArea && areas[worstArea.key]! < 65) improve.push({ icon: worstArea.icon, tone: 'warn', text: `${worstArea.label} fue tu área más floja (${Math.round(areas[worstArea.key]!)} puntos).` });
  for (const a of AREAS) {
    const v = areas[a.key], p = prev[a.key];
    if (v !== undefined && p !== undefined && p - v >= 8 && a.key !== worstArea?.key) improve.push({ icon: a.icon, tone: 'warn', text: `${a.label} bajó ${Math.round(p - v)} puntos frente a la semana anterior.` });
  }

  let suggestion: Note | null = null;
  if (worstArea && areas[worstArea.key]! < 70) suggestion = { icon: '🎯', tone: 'info', text: pick(AREA_TIPS[worstArea.key], from) };
  else if (weakest) suggestion = { icon: '🎯', tone: 'info', text: `Esta semana, ${weakest.h.emoji} ${weakest.h.name} en versión mínima todos los días que toque: el objetivo es no fallar dos veces seguidas.` };
  else suggestion = { icon: '🎯', tone: 'info', text: 'Todo en orden: sumá un hábito nuevo pequeño o subí un poco la meta de uno que ya tengas consolidado.' };

  return { from, to, areas, prev, overall: overallOf(areas), prevOverall: overallOf(prev), wins: wins.slice(0, 4), improve: improve.slice(0, 3), suggestion, perfectDays };
}
