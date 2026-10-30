import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { getData, useStore } from './store';
import { entryOf } from './stats';
import { todayKey } from './date';

export type Phase = 'work' | 'short' | 'long' | 'free';

interface TimerState {
  phase: Phase;
  running: boolean;
  /** timestamp de fin mientras corre */
  endAt: number | null;
  /** segundos restantes mientras está pausado */
  remaining: number;
  /** pomodoros completados en el ciclo actual (para el descanso largo) */
  cycle: number;
  habitId: string;
  label: string;
  freeMinutes: number;
  setPhase: (p: Phase) => void;
  start: () => void;
  pause: () => void;
  reset: () => void;
  skip: () => void;
  setHabit: (id: string) => void;
  setLabel: (l: string) => void;
  setFreeMinutes: (m: number) => void;
}

export function phaseMinutes(p: Phase, freeMinutes: number): number {
  const s = getData().settings;
  return p === 'work' ? s.pomoWork : p === 'short' ? s.pomoShort : p === 'long' ? s.pomoLong : freeMinutes;
}

export const PHASE_LABEL: Record<Phase, string> = { work: 'Pomodoro', short: 'Descanso corto', long: 'Descanso largo', free: 'Foco libre' };

export const useTimer = create<TimerState>()(
  persist(
    (set, get) => ({
      phase: 'work',
      running: false,
      endAt: null,
      remaining: 25 * 60,
      cycle: 0,
      habitId: '',
      label: 'Trabajo profundo',
      freeMinutes: 45,
      setPhase: (phase) => set({ phase, running: false, endAt: null, remaining: phaseMinutes(phase, get().freeMinutes) * 60 }),
      start: () => {
        const s = get();
        if (s.running) return;
        const rem = s.remaining > 0 ? s.remaining : phaseMinutes(s.phase, s.freeMinutes) * 60;
        set({ running: true, endAt: Date.now() + rem * 1000, remaining: rem });
      },
      pause: () => {
        const s = get();
        if (!s.running || !s.endAt) return;
        set({ running: false, endAt: null, remaining: Math.max(0, Math.round((s.endAt - Date.now()) / 1000)) });
      },
      reset: () => set((s) => ({ running: false, endAt: null, remaining: phaseMinutes(s.phase, s.freeMinutes) * 60 })),
      skip: () => advance(false),
      setHabit: (habitId) => set({ habitId }),
      setLabel: (label) => set({ label }),
      setFreeMinutes: (m) => set((s) => ({ freeMinutes: m, ...(s.phase === 'free' && !s.running ? { remaining: m * 60 } : {}) })),
    }),
    { name: 'ritmo-timer' }
  )
);

export function secondsLeft(s: Pick<TimerState, 'running' | 'endAt' | 'remaining'>, now = Date.now()): number {
  return s.running && s.endAt ? Math.max(0, Math.ceil((s.endAt - now) / 1000)) : s.remaining;
}

/** Cantidad de pomodoros (sesiones de la fase "work") completados en una fecha. */
export function pomodorosOn(date: string): number {
  return getData().focus.filter((f) => f.date === date && f.label.startsWith('🍅')).length;
}

type Listener = (ev: { finished: Phase; next: Phase; minutes: number }) => void;
let onFinish: Listener = () => {};
export const setFinishListener = (l: Listener) => (onFinish = l);

/** Pasa a la fase siguiente. Si `completed`, registra la sesión terminada. */
function advance(completed: boolean, early = false) {
  const t = useTimer.getState();
  const st = getData().settings;
  const finished = t.phase;
  const total = phaseMinutes(finished, t.freeMinutes);
  // si se termina antes, se registran solo los minutos realmente hechos
  const minutes = early ? Math.max(1, Math.round((total * 60 - secondsLeft(t)) / 60)) : total;
  let next: Phase = finished;
  let cycle = t.cycle;
  if (finished === 'work') {
    if (completed) cycle += 1;
    next = cycle > 0 && cycle % Math.max(1, st.pomoEvery) === 0 && completed ? 'long' : 'short';
  } else if (finished === 'short' || finished === 'long') {
    next = 'work';
    if (finished === 'long') cycle = 0;
  }
  if (completed && (finished === 'work' || finished === 'free')) logSession(finished, minutes, t.habitId, t.label);
  const auto = completed && st.pomoAuto && finished !== 'free';
  const rem = phaseMinutes(next, t.freeMinutes) * 60;
  useTimer.setState({ phase: next, cycle, running: auto, endAt: auto ? Date.now() + rem * 1000 : null, remaining: rem });
  if (completed) onFinish({ finished, next, minutes });
}

function logSession(phase: Phase, minutes: number, habitId: string, label: string) {
  const data = getData();
  const h = data.habits.find((x) => x.id === habitId);
  const name = h ? h.name : label || 'Foco';
  useStore.getState().addFocus({ minutes, label: phase === 'work' ? `🍅 ${name}` : name, habitId: h?.id });
  if (!h) return;
  const d = todayKey();
  const e = entryOf(getData().logs, d, h.id);
  if (h.kind === 'check') useStore.getState().setEntry(d, h.id, { ...e, value: 1 });
  else if (h.kind === 'quantity' && /min/i.test(h.unit ?? '')) useStore.getState().setEntry(d, h.id, { ...e, value: (e?.value ?? 0) + minutes });
  else if (h.kind === 'count') useStore.getState().setEntry(d, h.id, { ...e, value: (e?.value ?? 0) + 1 });
}

/** Termina la fase actual ahora, registrando lo hecho. */
export const finishNow = () => advance(true, true);

/** Revisa si la fase terminó. Se llama periódicamente desde App (funciona en cualquier pestaña). */
export function checkTimer() {
  const t = useTimer.getState();
  if (t.running && t.endAt && Date.now() >= t.endAt) advance(true);
}
