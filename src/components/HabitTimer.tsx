import { useEffect, useState } from 'react';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Habit } from '../lib/types';
import { getData, useStore } from '../lib/store';
import { entryOf, isDone } from '../lib/stats';
import { todayKey } from '../lib/date';
import { useTimer } from '../lib/timer';
import { navigate } from '../router';
import { Modal, toast } from './ui';
import { celebrate } from './HabitRow';

/* ---------- Cronómetro de un hábito (sigue corriendo aunque cierres la app) ---------- */

interface Stopwatch {
  habitId: string | null;
  date: string;
  t0: number; // inicio del tramo actual
  acc: number; // segundos acumulados en tramos anteriores
  paused: boolean;
}

export const useStopwatch = create<Stopwatch>()(
  persist((): Stopwatch => ({ habitId: null, date: '', t0: 0, acc: 0, paused: false }), { name: 'ritmo-stopwatch' })
);

export const elapsedOf = (s: Stopwatch, now = Date.now()) => (s.paused ? s.acc : s.acc + (now - s.t0) / 1000);

const startStopwatch = (habitId: string) => useStopwatch.setState({ habitId, date: todayKey(), t0: Date.now(), acc: 0, paused: false });
const togglePause = () => {
  const s = useStopwatch.getState();
  useStopwatch.setState(s.paused ? { paused: false, t0: Date.now() } : { paused: true, acc: elapsedOf(s) });
};
const clearStopwatch = () => useStopwatch.setState({ habitId: null, date: '', t0: 0, acc: 0, paused: false });

export const fmtClock = (sec: number) => {
  const s = Math.max(0, Math.floor(sec));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const r = s % 60;
  return h ? `${h}:${String(m).padStart(2, '0')}:${String(r).padStart(2, '0')}` : `${String(m).padStart(2, '0')}:${String(r).padStart(2, '0')}`;
};
export const fmtDuration = (sec: number) => {
  const m = Math.round(sec / 60);
  return m >= 60 ? `${Math.floor(m / 60)} h ${String(m % 60).padStart(2, '0')}` : `${m} min`;
};

function useTick(active: boolean) {
  const [, set] = useState(0);
  useEffect(() => {
    if (!active) return;
    const i = setInterval(() => set((x) => x + 1), 500);
    return () => clearInterval(i);
  }, [active]);
}

/** Suma tiempo a un hábito en un día, y opcionalmente lo marca como hecho. */
export function addTime(h: Habit, date: string, seconds: number, mark: boolean) {
  const { setEntry } = useStore.getState();
  const e = entryOf(getData().logs, date, h.id);
  const total = (e?.seconds ?? 0) + Math.round(seconds);
  const minutes = Math.round(seconds / 60);
  let value = e?.value ?? 0;
  // los hábitos que se miden en minutos suman lo cronometrado
  if (h.kind === 'quantity' && /min/i.test(h.unit ?? '')) value += minutes;
  else if (mark && h.kind === 'check') value = 1;
  else if (mark && h.kind === 'count') value += 1;
  const wasDone = isDone(h, e, date);
  setEntry(date, h.id, { ...e, value, seconds: total, skipped: false });
  if (!wasDone && isDone(h, entryOf(getData().logs, date, h.id), date)) celebrate(null, date);
}

/* ---------- Elegir cómo empezar ---------- */

const useChooser = create<{ habitId: string | null }>(() => ({ habitId: null }));
export const openTimeChooser = (habitId: string) => useChooser.setState({ habitId });

export function TimeChooser() {
  const habitId = useChooser((s) => s.habitId);
  const habits = useStore((s) => s.habits);
  const running = useStopwatch((s) => s.habitId);
  const h = habits.find((x) => x.id === habitId);
  const close = () => useChooser.setState({ habitId: null });
  if (!h) return null;
  const startWatch = () => {
    if (running && running !== h.id) {
      toast('Ya hay un cronómetro en curso: terminalo primero', '⏱');
      return close();
    }
    startStopwatch(h.id);
    close();
  };
  const startPomodoro = () => {
    const t = useTimer.getState();
    t.setHabit(h.id);
    if (!t.running) {
      if (t.phase !== 'work') t.setPhase('work');
      useTimer.getState().start();
    }
    close();
    navigate('focus');
  };
  return (
    <Modal open onClose={close}>
      <div className="row between" style={{ marginBottom: 14 }}>
        <h2 className="h2">{h.emoji} {h.name}</h2>
        <button className="btn ghost icon" onClick={close} aria-label="Cerrar">✕</button>
      </div>
      <div className="col" style={{ gap: 10 }}>
        <button className="time-opt" onClick={startWatch}>
          <span className="to-ico">⏱️</span>
          <span><b>Cronómetro</b><span className="small muted">Cuenta el tiempo hasta que lo termines. Podés pausarlo.</span></span>
        </button>
        <button className="time-opt" onClick={startPomodoro}>
          <span className="to-ico">🍅</span>
          <span><b>Pomodoro</b><span className="small muted">{getData().settings.pomoWork} min de enfoque y descansos, en ciclos. Cada pomodoro suma su tiempo.</span></span>
        </button>
        {h.kind !== 'quantity' && (
          <button className="btn ghost" onClick={() => { addTime(h, todayKey(), 0, true); close(); }}>Ya lo hice, sin cronómetro</button>
        )}
      </div>
    </Modal>
  );
}

/* ---------- Barra del cronómetro en curso ---------- */

export function StopwatchBar() {
  const sw = useStopwatch();
  const habits = useStore((s) => s.habits);
  const [finishing, setFinishing] = useState(false);
  useTick(!!sw.habitId && !sw.paused);
  const h = habits.find((x) => x.id === sw.habitId);
  if (!sw.habitId) return null;
  if (!h) { clearStopwatch(); return null; }
  const sec = elapsedOf(sw);
  return (
    <>
      <div className={`stopwatch-bar ${sw.paused ? 'paused' : ''}`} role="status">
        <span className="sw-ico">{h.emoji}</span>
        <div className="grow" style={{ minWidth: 0 }}>
          <div className="sw-label">{sw.paused ? 'En pausa' : 'Cronómetro'} · {h.name}</div>
          <div className="sw-time">{fmtClock(sec)}</div>
        </div>
        <button className="btn sm" onClick={togglePause}>{sw.paused ? 'Seguir' : 'Pausar'}</button>
        <button className="btn sm primary" onClick={() => { if (!sw.paused) togglePause(); setFinishing(true); }}>Terminar</button>
      </div>
      {finishing && <FinishModal habit={h} seconds={sec} date={sw.date} onClose={() => setFinishing(false)} />}
    </>
  );
}

function FinishModal({ habit: h, seconds, date, onClose }: { habit: Habit; seconds: number; date: string; onClose: () => void }) {
  const done = isDone(h, entryOf(getData().logs, date, h.id), date);
  const minutesUnit = h.kind === 'quantity' && /min/i.test(h.unit ?? '');
  const save = (mark: boolean) => {
    addTime(h, date, seconds, mark);
    clearStopwatch();
    toast(`${fmtDuration(seconds)} guardados en ${h.name}`, '⏱');
    onClose();
  };
  const discard = () => { clearStopwatch(); toast('Cronómetro descartado', '🗑️'); onClose(); };
  const resume = () => { togglePause(); onClose(); };
  return (
    <Modal open onClose={resume}>
      <h2 className="h2" style={{ marginBottom: 6 }}>{h.emoji} {h.name}</h2>
      <div className="serif" style={{ fontSize: 48, lineHeight: 1.1 }}>{fmtDuration(seconds)}</div>
      <p className="small muted" style={{ marginTop: 4 }}>{seconds < 30 ? 'Fue muy corto: podés seguir o descartarlo.' : minutesUnit ? `Se suman a tus ${h.unit} de hoy.` : 'Elegí cómo guardarlo.'}</p>
      <div className="col" style={{ gap: 8, marginTop: 12 }}>
        {seconds >= 30 && !minutesUnit && !done && (h.kind === 'check' || h.kind === 'count') && (
          <button className="btn primary" onClick={() => save(true)}>{h.kind === 'count' ? 'Guardar y sumar 1' : 'Guardar y marcar como hecho'}</button>
        )}
        {seconds >= 30 && <button className={`btn ${minutesUnit || done || h.kind === 'quantity' ? 'primary' : ''}`} onClick={() => save(false)}>{minutesUnit ? 'Guardar' : 'Solo guardar el tiempo'}</button>}
        <button className="btn" onClick={resume}>Seguir con el cronómetro</button>
        <button className="btn ghost danger" onClick={discard}>Descartar</button>
      </div>
    </Modal>
  );
}

/** Botón de la fila del hábito: inicia, o muestra el tiempo si está corriendo. */
export function TimeButton({ habit: h }: { habit: Habit }) {
  const sw = useStopwatch();
  const pomo = useTimer((s) => s.running && s.habitId === h.id);
  const mine = sw.habitId === h.id;
  useTick(mine && !sw.paused);
  if (mine) return <button className="time-btn on" onClick={togglePause} aria-label={sw.paused ? 'Seguir' : 'Pausar'}>{sw.paused ? '▶' : '⏸'}<span className="tb-time"> {fmtClock(elapsedOf(sw))}</span></button>;
  if (pomo) return <button className="time-btn on" onClick={() => navigate('focus')} aria-label="Pomodoro en curso">🍅<span className="tb-time"> en curso</span></button>;
  return <button className="time-btn" onClick={() => openTimeChooser(h.id)} aria-label={`Iniciar ${h.name}`}>▶</button>;
}
