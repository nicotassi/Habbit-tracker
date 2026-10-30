import { useState } from 'react';
import { useStore } from '../lib/store';
import { activeHabits, dayStats, isScheduled } from '../lib/stats';
import { addDays, fromKey, MONTHS, prettyDate, todayKey, toKey, WEEKDAYS_SHORT, weekStartOf } from '../lib/date';
import { HabitRow } from '../components/HabitRow';
import { MoodLogger, moodFace } from '../components/MoodLogger';
import { Ring } from '../components/ui';

export function Calendar({ initial }: { initial?: string }) {
  const data = useStore();
  const [sel, setSel] = useState(initial ?? todayKey());
  const [cursor, setCursor] = useState(() => { const d = fromKey(initial ?? todayKey()); return new Date(d.getFullYear(), d.getMonth(), 1); });
  const ws = data.settings.weekStart;
  const first = toKey(cursor);
  const start = weekStartOf(first, ws);
  const cells = Array.from({ length: 42 }, (_, i) => addDays(start, i));
  const today = todayKey();
  const habits = activeHabits(data);
  const monthDays = cells.filter((d) => fromKey(d).getMonth() === cursor.getMonth() && d <= today);
  const monthStats = monthDays.reduce((a, d) => { const s = dayStats(data, d, habits); return { done: a.done + s.done, total: a.total + s.total, perfect: a.perfect + (s.total && s.done === s.total ? 1 : 0) }; }, { done: 0, total: 0, perfect: 0 });
  const s = dayStats(data, sel, habits);

  return (
    <div>
      <div className="page-head">
        <div><div className="eyebrow">Calendario</div><h1 className="title"><em>{MONTHS[cursor.getMonth()]}</em> {cursor.getFullYear()}</h1></div>
        <div className="row">
          <button className="btn icon" onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1))}>‹</button>
          <button className="btn sm" onClick={() => { const t = new Date(); setCursor(new Date(t.getFullYear(), t.getMonth(), 1)); setSel(today); }}>Hoy</button>
          <button className="btn icon" onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1))}>›</button>
        </div>
      </div>
      <div className="grid g3">
        <div className="card span2">
          <div className="row wrap" style={{ gap: 20, marginBottom: 16 }}>
            <span className="small"><b>{monthStats.total ? Math.round((monthStats.done / monthStats.total) * 100) : 0}%</b> <span className="muted">cumplimiento del mes</span></span>
            <span className="small"><b>{monthStats.done}</b> <span className="muted">hábitos completados</span></span>
            <span className="small"><b>⭐ {monthStats.perfect}</b> <span className="muted">días perfectos</span></span>
          </div>
          <div className="cal">
            {Array.from({ length: 7 }, (_, i) => <div key={i} className="dow">{WEEKDAYS_SHORT[(i + ws) % 7]}</div>)}
            {cells.map((d) => {
              const st = dayStats(data, d, habits);
              const out = fromKey(d).getMonth() !== cursor.getMonth();
              const future = d > today;
              const mood = data.moods[d]?.mood;
              return (
                <button key={d} className={`cal-day ${out ? 'out' : ''} ${d === today ? 'today' : ''} ${d === sel ? 'sel' : ''}`} onClick={() => !future && setSel(d)} style={{ opacity: future && !out ? 0.5 : undefined }}>
                  {!future && st.total > 0 && <div className="bg" style={{ background: 'var(--accent)', opacity: st.rate * 0.55 }} />}
                  <span className="n">{fromKey(d).getDate()}</span>
                  <span className="m">{mood ? moodFace(mood) : st.total && st.done === st.total && !future ? '⭐' : ''}</span>
                </button>
              );
            })}
          </div>
        </div>
        <div className="col" style={{ gap: 16 }}>
          <div className="card">
            <div className="row" style={{ gap: 14, marginBottom: 14 }}>
              <Ring value={s.progress} size={64} stroke={7}><b className="small">{Math.round(s.progress * 100)}%</b></Ring>
              <div><div className="eyebrow">Día seleccionado</div><div className="serif" style={{ fontSize: 24, lineHeight: 1.1 }}>{prettyDate(sel)}</div></div>
            </div>
            <div className="habit-list">
              {habits.filter((h) => isScheduled(h, sel)).map((h) => <HabitRow key={h.id} habit={h} date={sel} />)}
              {!habits.some((h) => isScheduled(h, sel)) && <div className="small muted">Sin hábitos programados.</div>}
            </div>
          </div>
          <div className="card"><div className="card-head"><h3 className="h3">Ánimo</h3></div><MoodLogger date={sel} compact /></div>
        </div>
      </div>
    </div>
  );
}
