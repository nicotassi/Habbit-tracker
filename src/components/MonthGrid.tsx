import { useEffect, useRef, useState } from 'react';
import { useStore } from '../lib/store';
import { activeHabits, activityStreak, entryOf, isDone, isScheduled } from '../lib/stats';
import { addDays, fromKey, MONTHS, shortDate, todayKey, WEEKDAYS_LETTER } from '../lib/date';
import { CountUp } from './ui';
import { navigate } from '../router';

/** Una fila por hábito y un punto de color por día del mes (estilo “Tus hábitos”). */
export function MonthGrid() {
  const data = useStore();
  const today = todayKey();
  const [offset, setOffset] = useState(0);
  const base = fromKey(today);
  const first = new Date(base.getFullYear(), base.getMonth() + offset, 1);
  const n = new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate();
  const k0 = `${first.getFullYear()}-${String(first.getMonth() + 1).padStart(2, '0')}-01`;
  const days = Array.from({ length: n }, (_, i) => addDays(k0, i));
  const habits = activeHabits(data);
  const scroller = useRef<HTMLDivElement>(null);
  // en pantallas angostas, se desplaza para que hoy quede a la derecha (se ven los últimos días cumplidos)
  useEffect(() => {
    const el = scroller.current;
    if (!el) return;
    const t = el.querySelector<HTMLElement>('.mg-head.today');
    el.scrollLeft = t && offset === 0 ? Math.max(0, t.offsetLeft + t.offsetWidth + 8 - el.clientWidth) : 0;
  }, [offset, habits.length]);
  if (!habits.length) return null;

  return (
    <div className="card month-card">
      <div className="card-head">
        <div><h3 className="h3">Tus hábitos en {MONTHS[first.getMonth()]}</h3><span className="sub">Cada punto es un día cumplido</span></div>
        <div className="row" style={{ gap: 4 }}>
          <button className="btn ghost icon" aria-label="Mes anterior" onClick={() => setOffset((o) => o - 1)}>‹</button>
          <button className="btn ghost icon" aria-label="Mes siguiente" disabled={offset >= 0} onClick={() => setOffset((o) => o + 1)}>›</button>
        </div>
      </div>
      <div className="month-grid-wrap" ref={scroller}>
        <div className="month-grid" style={{ gridTemplateColumns: `var(--mg-label) repeat(${n}, var(--mg-dot))` }}>
          <div />
          {days.map((d) => (
            <div key={d} className={`mg-head ${d === today ? 'today' : ''}`}>
              <span>{WEEKDAYS_LETTER[fromKey(d).getDay()]}</span>
              <b>{fromKey(d).getDate()}</b>
            </div>
          ))}
          {habits.map((h) => (
            <Row key={h.id} name={h.name} emoji={h.emoji} onOpen={() => navigate(`habit/${h.id}`)}>
              {days.map((d) => {
                const future = d > today;
                const sched = isScheduled(h, d) || !!entryOf(data.logs, d, h.id);
                const done = !future && isDone(h, entryOf(data.logs, d, h.id), d);
                const skipped = entryOf(data.logs, d, h.id)?.skipped;
                return (
                  <span
                    key={d}
                    title={`${h.name} · ${shortDate(d)}${done ? ' ✓' : skipped ? ' (salteado)' : ''}`}
                    className={`mg-dot ${done ? 'on' : ''} ${future ? 'future' : ''} ${!sched && !future ? 'off' : ''} ${d === today ? 'today' : ''}`}
                    style={done ? { background: h.color, boxShadow: `0 0 10px -2px ${h.color}` } : undefined}
                  />
                );
              })}
            </Row>
          ))}
        </div>
      </div>
    </div>
  );
}

function Row({ name, emoji, onOpen, children }: { name: string; emoji: string; onOpen: () => void; children: React.ReactNode }) {
  return (
    <>
      <button className="mg-label" onClick={onOpen} title={name}><span>{emoji}</span><span className="mg-name">{name}</span></button>
      {children}
    </>
  );
}

/** Racha de días seguidos con actividad, en grande. */
export function StreakCard() {
  const data = useStore();
  const s = activityStreak(data);
  return (
    <div className="card streak-card">
      <div className="eyebrow">Racha</div>
      <div className="streak-main">
        <span className={`streak-flame ${s.current > 0 ? 'lit' : ''}`} aria-hidden="true">🔥</span>
        <span className="streak-num"><CountUp value={s.current} /></span>
      </div>
      <div className="small muted">{s.current === 1 ? 'día seguido' : 'días seguidos'}{!s.todayDone && s.current > 0 ? ' · completá algo hoy para sumar' : ''}</div>
      <div className="streak-week" aria-label="Últimos 7 días">
        {s.last7.map((d) => (
          <span key={d.date} className={d.on ? 'on' : ''} title={shortDate(d.date)}>
            <i />
            <small>{WEEKDAYS_LETTER[fromKey(d.date).getDay()]}</small>
          </span>
        ))}
      </div>
      <div className="tiny muted">Mejor racha: <b>{s.best}</b> {s.best === 1 ? 'día' : 'días'}</div>
    </div>
  );
}
