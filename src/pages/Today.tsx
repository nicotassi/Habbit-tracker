import { useEffect, useMemo, useState } from 'react';
import { useStore } from '../lib/store';
import { activeHabits, activityStreak, dayStats, entryOf, isDone, levelOf, matchesDay, nonNegotiableDay, xpOf } from '../lib/stats';
import { addDays, fromKey, greeting, prettyDate, relativeDay, todayKey, WEEKDAYS_SHORT } from '../lib/date';
import { HabitRow } from '../components/HabitRow';
import { MoodLogger } from '../components/MoodLogger';
import { Empty, Ring, Seg } from '../components/ui';
import { DayView } from '../components/DayView';
import { dailyReport, light } from '../lib/coach';
import { rescueOf } from '../lib/forecast';
import { effectiveTimeOfDay, startMinutes } from '../lib/schedule';
import { HabitForm } from '../components/HabitForm';
import type { Habit, TimeOfDay } from '../lib/types';
import { navigate } from '../router';

const GROUPS: { k: TimeOfDay; label: string }[] = [
  { k: 'morning', label: '🌅 Mañana' },
  { k: 'afternoon', label: '☀️ Tarde' },
  { k: 'evening', label: '🌙 Noche' },
  { k: 'any', label: '✨ En cualquier momento' },
];

/* Hoy: lo justo para el día — resumen en una línea, los hábitos y el ánimo.
   Las estadísticas (racha, grilla del mes, pronóstico, nivel) viven en Análisis, Cómo vas y Logros. */
export function Today() {
  const data = useStore();
  const [date, setDate] = useState(todayKey());
  const [formOpen, setFormOpen] = useState(false);
  // vista de los hábitos: lista o "Mi día" por bloques (se recuerda la última elegida)
  const [view, setViewState] = useState<'list' | 'day'>(() => { try { return localStorage.getItem('ritmo-today-view') === 'day' ? 'day' : 'list'; } catch { return 'list'; } });
  const setView = (v: 'list' | 'day') => { setViewState(v); try { localStorage.setItem('ritmo-today-view', v); } catch { /* sin almacenamiento */ } };
  // cada minuto se refresca el estado de los horarios ("Ahora", "En 15 min", "Atrasado")
  const [, setMinute] = useState(0);
  useEffect(() => {
    const i = setInterval(() => setMinute((x) => x + 1), 60000);
    return () => clearInterval(i);
  }, []);
  const habits = activeHabits(data);
  const allScheduled = habits.filter((h) => matchesDay(h, date));
  // "nunca dos veces seguidas": los que se fallaron el último día programado van primero
  // los no negociables van primero, en su propio grupo
  const byTime = (a: Habit, b: Habit) => startMinutes(a, date) - startMinutes(b, date);
  const nonNeg = allScheduled.filter((h) => h.nonNegotiable).sort(byTime);
  const rescue = allScheduled.filter((h) => !h.nonNegotiable && rescueOf(h, data.logs, date));
  const scheduled = allScheduled.filter((h) => !h.nonNegotiable && !rescue.includes(h)).sort(byTime);
  const isToday = date === todayKey();
  const doneCount = (hs: Habit[]) => hs.filter((h) => isDone(h, entryOf(data.logs, date, h.id), date)).length;

  return (
    <div className="today">
      <div className="today-head">
        <div className="grow" style={{ minWidth: 0 }}>
          <div className="eyebrow">{relativeDay(date)} · {prettyDate(date)}</div>
          <h1 className="title today-title">
            {isToday ? <>{greeting()}{data.settings.name ? <>, <em>{data.settings.name}</em></> : ''}.</> : <>Editando <em>{relativeDay(date) === 'Ayer' ? 'ayer' : prettyDate(date)}</em></>}
          </h1>
        </div>
        <DatePill date={date} onChange={setDate} />
      </div>

      {!isToday && (
        <div className="past-banner">
          <span>✏️ Estás cargando el <b>{prettyDate(date)}</b>.</span>
          <button className="btn sm primary" onClick={() => setDate(todayKey())}>Volver a hoy</button>
        </div>
      )}

      {habits.length > 0 && <TodaySummary date={date} />}

      <div className="today-grid">
        <div className="col" style={{ gap: 12, minWidth: 0 }}>
          {habits.length === 0 ? (
            <div className="card">
              <Empty emoji="🌱" title="Empezá tu primer hábito">
                <p>Sin límites: agregá todos los que quieras. También podés cargar datos de ejemplo para explorar.</p>
                <div className="row" style={{ justifyContent: 'center' }}>
                  <button className="btn primary" onClick={() => setFormOpen(true)}>+ Crear hábito</button>
                  <button className="btn" onClick={() => navigate('ajustes')}>Cargar demo</button>
                </div>
              </Empty>
            </div>
          ) : (
            <>
              <div className="row between" style={{ flexWrap: 'nowrap' }}>
                <h2 className="h2 section-title">Hábitos</h2>
                <Seg<'list' | 'day'> value={view} onChange={setView} options={[{ v: 'list', l: '☰ Lista' }, { v: 'day', l: '🕒 Mi día' }]} />
              </div>
              {view === 'day' ? <DayView date={date} /> : (
                <>
                  {nonNeg.length > 0 && (
                    <div className="habit-group nn-group">
                      <div className="group-label nn">🔒 No negociables <span>{doneCount(nonNeg)}/{nonNeg.length}</span></div>
                      <div className="habit-list">{nonNeg.map((h) => <HabitRow key={h.id} habit={h} date={date} />)}</div>
                    </div>
                  )}
                  {rescue.length > 0 && (
                    <div className="habit-group">
                      <div className="group-label warn">🛟 Rescate <span>· ayer no salió, hoy aunque sea un poco</span></div>
                      <div className="habit-list">{rescue.map((h) => <HabitRow key={h.id} habit={h} date={date} />)}</div>
                    </div>
                  )}
                  {GROUPS.map((g) => {
                    const list = scheduled.filter((h) => effectiveTimeOfDay(h, date) === g.k);
                    if (!list.length) return null;
                    return (
                      <div key={g.k} className="habit-group">
                        <div className="group-label">{g.label} <span>{doneCount(list)}/{list.length}</span></div>
                        <div className="habit-list">{list.map((h) => <HabitRow key={h.id} habit={h} date={date} />)}</div>
                      </div>
                    );
                  })}
                  {habits.length > allScheduled.length && (
                    <details className="not-today">
                      <summary className="muted small">No programados {isToday ? 'hoy' : 'este día'} ({habits.length - allScheduled.length})</summary>
                      <div className="habit-list" style={{ marginTop: 8, opacity: 0.75 }}>
                        {habits.filter((h) => !matchesDay(h, date)).map((h) => <HabitRow key={h.id} habit={h} date={date} />)}
                      </div>
                    </details>
                  )}
                </>
              )}
            </>
          )}
        </div>

        <div className="card mood-card">
          <div className="card-head" style={{ marginBottom: 10 }}>
            <h3 className="h3">¿Cómo te sentís?</h3>
            <button className="btn ghost sm" onClick={() => navigate('mood')}>Ver más ›</button>
          </div>
          <MoodLogger date={date} compact />
        </div>
      </div>
      <HabitForm open={formOpen} onClose={() => setFormOpen(false)} />
    </div>
  );
}

/** Resumen del día en una línea: progreso, racha, nivel y puntaje de "Cómo vas" (cada uno lleva a su detalle). */
function TodaySummary({ date }: { date: string }) {
  const data = useStore();
  const s = dayStats(data, date);
  const streak = activityStreak(data);
  const lv = levelOf(xpOf(data));
  const nn = nonNegotiableDay(data, date);
  const report = useMemo(() => (date === todayKey() ? dailyReport(data) : null), [data, date]);
  const msg = s.total === 0 ? 'Día libre 🌴' : s.done === s.total ? '¡Día perfecto!' : `Te ${s.total - s.done === 1 ? 'falta 1' : `faltan ${s.total - s.done}`}`;
  return (
    <div className="today-summary">
      <div className="ts-progress">
        <Ring value={s.progress} size={46} stroke={5}><b className="small">{Math.round(s.progress * 100)}%</b></Ring>
        <div style={{ minWidth: 0 }}>
          <div className="ts-main">{s.done}<span>/{s.total}</span></div>
          <div className="tiny muted">{msg}</div>
        </div>
      </div>
      <div className="ts-chips">
        {nn.total > 0 && <span className={`ts-chip nn ${nn.complete ? 'ok' : ''}`} title="No negociables hechos hoy">🔒 <b>{nn.done}/{nn.total}</b></span>}
        <button className="ts-chip" onClick={() => navigate('analytics')} title="Racha: días seguidos con al menos un hábito">🔥 <b>{streak.current}</b></button>
        <button className="ts-chip" onClick={() => navigate('achievements')} title="Tu nivel">⭐ <b>{lv.level}</b></button>
        {report?.overall !== undefined && (
          <button className={`ts-chip score ${light(report.overall)}`} onClick={() => navigate('coach')} title="Cómo vas">🧭 <b>{Math.round(report.overall)}</b></button>
        )}
      </div>
    </div>
  );
}

/** Selector de fecha compacto: ‹ Hoy, lun 23 › (al tocar la fecha se abre el calendario del teléfono). */
function DatePill({ date, onChange }: { date: string; onChange: (d: string) => void }) {
  const today = todayKey();
  const d = fromKey(date);
  const label = date === today ? 'Hoy' : `${WEEKDAYS_SHORT[d.getDay()]} ${d.getDate()}`;
  return (
    <div className="date-pill">
      <button className="dp-arrow" aria-label="Día anterior" onClick={() => onChange(addDays(date, -1))}>‹</button>
      <label className="dp-label">
        <span>{label}</span>
        <input id="date-nav-input" type="date" value={date} max={today} aria-label="Elegir fecha" onChange={(e) => e.target.value && e.target.value <= today && onChange(e.target.value)} />
      </label>
      <button className="dp-arrow" aria-label="Día siguiente" disabled={date >= today} onClick={() => onChange(addDays(date, 1))}>›</button>
    </div>
  );
}
