import { useEffect, useRef, useState } from 'react';
import type { Habit, TimeOfDay } from '../lib/types';
import { getData, useStore } from '../lib/store';
import { activeHabits, entryOf, isDone, matchesDay, progressOf } from '../lib/stats';
import { fmtSlot, slotFor, slotStatus, timeOfDayOf } from '../lib/schedule';
import { todayKey } from '../lib/date';
import { navigate } from '../router';
import { celebrate } from './HabitRow';
import { toast } from './ui';

/* Vista "Mi día": la jornada separada en mañana, tarde y noche, con los hábitos con horario
   ubicados en una línea de tiempo y los que no tienen hora fija dentro de su bloque. */

const HOUR_PX = 56;
const toMin = (hhmm: string) => {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + (m || 0);
};
const hh = (min: number) => `${String(Math.floor(min / 60) % 24).padStart(2, '0')}:00`;

type Sector = Exclude<TimeOfDay, 'any'>;
const SECTORS: { k: Sector; label: string; icon: string; from: number; to: number }[] = [
  { k: 'morning', label: 'Mañana', icon: '🌅', from: 6 * 60, to: 12 * 60 },
  { k: 'afternoon', label: 'Tarde', icon: '☀️', from: 12 * 60, to: 19 * 60 },
  { k: 'evening', label: 'Noche', icon: '🌙', from: 19 * 60, to: 24 * 60 },
];

interface Timed { h: Habit; start: number; end: number; label: string }

/** Reparte en columnas los bloques que se superponen. */
function lanes(items: Timed[]) {
  const sorted = [...items].sort((a, b) => a.start - b.start || b.end - a.end);
  const out: { item: Timed; lane: number; lanes: number }[] = [];
  let cluster: { item: Timed; lane: number }[] = [];
  let clusterEnd = -1;
  const flush = () => {
    const n = Math.max(1, ...cluster.map((c) => c.lane + 1));
    cluster.forEach((c) => out.push({ ...c, lanes: n }));
    cluster = [];
  };
  for (const it of sorted) {
    if (it.start >= clusterEnd && cluster.length) flush();
    const used = new Set(cluster.filter((c) => c.item.end > it.start).map((c) => c.lane));
    let lane = 0;
    while (used.has(lane)) lane++;
    cluster.push({ item: it, lane });
    clusterEnd = Math.max(clusterEnd, it.end);
  }
  if (cluster.length) flush();
  return out;
}

function useNow(active: boolean) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    if (!active) return;
    const i = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(i);
  }, [active]);
  return now;
}

function toggle(h: Habit, date: string, el: HTMLElement | null) {
  const { setEntry } = useStore.getState();
  const e = entryOf(getData().logs, date, h.id);
  if (h.kind !== 'check') return navigate(`habit/${h.id}`);
  if (date > todayKey()) return toast('Ese día todavía no llegó: podés verlo para planificar', '🗓️');
  const done = isDone(h, e, date);
  setEntry(date, h.id, done && !e?.note && !e?.seconds ? null : { ...e, value: done ? 0 : 1, skipped: false });
  if (!done) celebrate(el, date);
}

function Chip({ h, date }: { h: Habit; date: string }) {
  const logs = useStore((s) => s.logs);
  const e = entryOf(logs, date, h.id);
  const done = isDone(h, e, date);
  const prog = progressOf(h, e);
  return (
    <button className={`day-chip ${done ? 'done' : ''}`} style={{ ['--hc' as string]: h.color }} onClick={(ev) => toggle(h, date, ev.currentTarget)}
      title={h.kind === 'check' ? (done ? 'Desmarcar' : 'Marcar como hecho') : 'Ver hábito'}>
      <span>{h.emoji}</span>
      <span className="dc-name">{h.name}</span>
      {done ? <b className="dc-check">✓</b> : h.kind !== 'check' && h.kind !== 'avoid' && prog > 0 ? <span className="tiny muted">{Math.round(prog * 100)}%</span> : null}
    </button>
  );
}

export function DayView({ date }: { date: string }) {
  const data = useStore();
  const isToday = date === todayKey();
  const now = useNow(isToday);
  const nowMin = now.getHours() * 60 + now.getMinutes();
  const nowRef = useRef<HTMLDivElement>(null);
  const habits = activeHabits(data).filter((h) => matchesDay(h, date));

  // clasifica: con horario (va a la línea de tiempo), con momento del día, o en cualquier momento
  const timed: Timed[] = [];
  const bySector: Record<Sector, Habit[]> = { morning: [], afternoon: [], evening: [] };
  const anytime: Habit[] = [];
  for (const h of habits) {
    const s = slotFor(h, date);
    if (s) {
      const start = toMin(s.start);
      let end = s.end ? toMin(s.end) : start + 30;
      if (end <= start) end = 24 * 60; // cruza la medianoche: se muestra hasta el final del día
      timed.push({ h, start, end, label: fmtSlot(s) });
    } else if (h.timeOfDay === 'any') anytime.push(h);
    else bySector[h.timeOfDay].push(h);
  }

  const doneOf = (hs: Habit[]) => hs.filter((h) => isDone(h, entryOf(data.logs, date, h.id), date)).length;
  const sectorItems = (k: Sector) => ({
    timed: timed.filter((t) => timeOfDayOf(`${Math.floor(t.start / 60)}:${t.start % 60}`) === k),
    loose: bySector[k],
  });
  const totalOf = (k: Sector) => {
    const it = sectorItems(k);
    const hs = [...it.timed.map((t) => t.h), ...it.loose];
    return { total: hs.length, done: doneOf(hs) };
  };
  const currentSector: Sector | null = isToday ? (nowMin < 12 * 60 ? 'morning' : nowMin < 19 * 60 ? 'afternoon' : 'evening') : null;

  useEffect(() => {
    // al abrir el día de hoy, se lleva la vista hasta la hora actual
    if (isToday) setTimeout(() => nowRef.current?.scrollIntoView({ block: 'center', behavior: 'smooth' }), 250);
  }, [date]); // eslint-disable-line

  if (!habits.length) return <div className="card"><p className="small muted" style={{ margin: 0 }}>No hay hábitos para este día.</p></div>;
  const allDone = doneOf(habits);

  return (
    <div className="day-view">
      {/* resumen: el día en tres bloques */}
      <div className="day-strip" role="list" aria-label="Tu día por bloques">
        {SECTORS.map((s) => {
          const t = totalOf(s.k);
          return (
            <button key={s.k} role="listitem" className={`ds-seg ${s.k} ${currentSector === s.k ? 'current' : ''}`} style={{ flexGrow: s.to - s.from }}
              onClick={() => document.getElementById(`sector-${s.k}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })}>
              <span className="ds-top">{s.icon} {s.label}</span>
              <span className="ds-count">{t.total ? `${t.done}/${t.total}` : 'libre'}</span>
              <span className="ds-bar"><i style={{ width: `${t.total ? (t.done / t.total) * 100 : 0}%` }} /></span>
            </button>
          );
        })}
      </div>
      <div className="tiny muted" style={{ margin: '6px 2px 14px' }}>
        {allDone}/{habits.length} hechos{anytime.length ? ` · ${anytime.length} sin horario al final` : ''}{isToday ? ` · ahora: ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}` : ''}
      </div>

      {SECTORS.map((s) => {
        const it = sectorItems(s.k);
        const t = totalOf(s.k);
        // el bloque se agranda si algún hábito empieza antes o termina después de sus horas habituales
        const from = Math.min(s.from, ...it.timed.map((x) => Math.floor(x.start / 60) * 60));
        const to = Math.max(s.to, ...it.timed.map((x) => Math.ceil(x.end / 60) * 60));
        const hours = Array.from({ length: (to - from) / 60 + 1 }, (_, i) => from + i * 60);
        const placed = lanes(it.timed);
        const showNow = isToday && nowMin >= from && nowMin <= to;
        return (
          <section key={s.k} id={`sector-${s.k}`} className={`day-sector ${s.k} ${currentSector === s.k ? 'current' : ''}`}>
            <header className="dsec-head">
              <span className="dsec-title">{s.icon} {s.label}</span>
              <span className="tiny muted">{hh(s.from)}–{s.to === 24 * 60 ? '24:00' : hh(s.to)}</span>
              <span className="dsec-count">{t.total ? `${t.done}/${t.total}` : 'Libre'}</span>
            </header>

            {it.loose.length > 0 && (
              <div className="dsec-loose">
                <span className="tiny muted">Durante la {s.label.toLowerCase()}, sin hora fija</span>
                <div className="row wrap" style={{ gap: 6 }}>{it.loose.map((h) => <Chip key={h.id} h={h} date={date} />)}</div>
              </div>
            )}

            {it.timed.length > 0 ? (
              <div className="timeline" style={{ height: ((to - from) / 60) * HOUR_PX }}>
                {hours.map((m) => (
                  <div key={m} className="tl-hour" style={{ top: ((m - from) / 60) * HOUR_PX }}><span>{hh(m)}</span></div>
                ))}
                {placed.map(({ item, lane, lanes: n }) => {
                  const e = entryOf(data.logs, date, item.h.id);
                  const done = isDone(item.h, e, date);
                  const top = ((item.start - from) / 60) * HOUR_PX;
                  const height = Math.max(26, ((item.end - item.start) / 60) * HOUR_PX - 3);
                  const st = isToday && !done ? slotStatus(slotFor(item.h, date)!, now) : null;
                  return (
                    <button key={item.h.id}
                      className={`tl-block ${done ? 'done' : ''} ${st?.kind ?? ''} ${height < 44 ? 'compact' : ''} ${lane > 0 ? 'narrow' : ''}`}
                      style={{
                        top, height, zIndex: 1 + lane, ['--hc' as string]: item.h.color,
                        // superpuestos en cascada: el primero ocupa todo el ancho y los siguientes se corren a la derecha
                        left: `calc(52px + (100% - 56px) * ${n > 1 ? (lane * 0.5) / (n - 1) : 0})`,
                        width: `calc((100% - 56px) * ${n > 1 ? 1 - (lane * 0.5) / (n - 1) : 1} - 2px)`,
                      }}
                      onClick={(ev) => toggle(item.h, date, ev.currentTarget)}
                      title={`${item.h.name} · ${item.label}`}>
                      <span className="tlb-main">
                        <span>{item.h.emoji}</span>
                        <span className="tlb-name">{item.h.name}</span>
                        {done && <b className="dc-check">✓</b>}
                      </span>
                      <span className="tlb-time">{item.label}{st ? ` · ${st.label}` : ''}</span>
                    </button>
                  );
                })}
                {showNow && <div ref={nowRef} className="tl-now" style={{ top: ((nowMin - from) / 60) * HOUR_PX }}><span>{String(now.getHours()).padStart(2, '0')}:{String(now.getMinutes()).padStart(2, '0')}</span></div>}
              </div>
            ) : (
              !it.loose.length && <p className="small muted" style={{ margin: '4px 0 0' }}>Nada programado en este bloque.</p>
            )}
            {!it.timed.length && currentSector === s.k && <div ref={nowRef} />}
          </section>
        );
      })}

      {anytime.length > 0 && (
        <section className="day-sector anytime">
          <header className="dsec-head">
            <span className="dsec-title">✨ En cualquier momento</span>
            <span className="dsec-count">{doneOf(anytime)}/{anytime.length}</span>
          </header>
          <div className="row wrap" style={{ gap: 6 }}>{anytime.map((h) => <Chip key={h.id} h={h} date={date} />)}</div>
        </section>
      )}
      <p className="tiny muted" style={{ margin: '10px 2px 0' }}>Tocá un hábito de Sí/No para marcarlo; los demás abren su detalle. Los horarios se configuran al editar cada hábito.</p>
    </div>
  );
}
