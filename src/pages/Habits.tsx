import { useState } from 'react';
import { useStore } from '../lib/store';
import type { Habit } from '../lib/types';
import { completionRate, strength, streaks, totalCompletions } from '../lib/stats';
import { addDays, todayKey, WEEKDAYS_SHORT } from '../lib/date';
import { HabitForm } from '../components/HabitForm';
import { askConfirm, Bar, Empty, Seg, toast } from '../components/ui';
import { navigate } from '../router';

export function freqLabel(h: Habit): string {
  if (h.frequency.type === 'daily') return 'Todos los días';
  if (h.frequency.type === 'perWeek') return `${h.frequency.times}× por semana`;
  const d = h.frequency.days;
  if (d.length === 5 && [1, 2, 3, 4, 5].every((x) => d.includes(x))) return 'Días de semana';
  if (d.length === 2 && d.includes(0) && d.includes(6)) return 'Fines de semana';
  return [1, 2, 3, 4, 5, 6, 0].filter((x) => d.includes(x)).map((x) => WEEKDAYS_SHORT[x]).join(', ');
}

export const kindLabel = (h: Habit) =>
  h.kind === 'check' ? 'Sí/No' : h.kind === 'avoid' ? 'Evitar' : `${h.target} ${h.unit ?? ''}`.trim();

export function Habits() {
  const { habits, logs, settings, updateHabit, deleteHabit, reorderHabits } = useStore();
  const [view, setView] = useState<'active' | 'archived'>('active');
  const [cat, setCat] = useState('Todas');
  const [q, setQ] = useState('');
  const [edit, setEdit] = useState<Habit | null>(null);
  const [open, setOpen] = useState(false);
  const cats = ['Todas', ...Array.from(new Set(habits.map((h) => h.category)))];
  const list = habits
    .filter((h) => (view === 'active' ? !h.archived : h.archived))
    .filter((h) => cat === 'Todas' || h.category === cat)
    .filter((h) => h.name.toLowerCase().includes(q.toLowerCase()))
    .sort((a, b) => a.order - b.order);
  const ordered = habits.filter((h) => !h.archived).sort((a, b) => a.order - b.order).map((h) => h.id);
  const move = (id: string, dir: -1 | 1) => {
    const i = ordered.indexOf(id);
    const j = i + dir;
    if (j < 0 || j >= ordered.length) return;
    const next = [...ordered];
    [next[i], next[j]] = [next[j], next[i]];
    reorderHabits(next);
  };
  const today = todayKey();

  return (
    <div>
      <div className="page-head">
        <div>
          <div className="eyebrow">{habits.filter((h) => !h.archived).length} activos · sin límite</div>
          <h1 className="title">Tus <em>hábitos</em></h1>
        </div>
        <button className="btn primary" onClick={() => { setEdit(null); setOpen(true); }}>+ Nuevo hábito</button>
      </div>

      <div className="row wrap" style={{ marginBottom: 16, gap: 12 }}>
        <Seg value={view} onChange={setView} options={[{ v: 'active', l: 'Activos' }, { v: 'archived', l: 'Archivados' }]} />
        <div className="row wrap" style={{ gap: 6 }}>
          {cats.map((c) => <button key={c} className={`chip ${cat === c ? 'on' : ''}`} onClick={() => setCat(c)}>{c}</button>)}
        </div>
        <input className="input" style={{ maxWidth: 220, marginLeft: 'auto' }} placeholder="Buscar…" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>

      {list.length === 0 ? (
        <div className="card"><Empty emoji={view === 'active' ? '🌱' : '🗄️'} title={view === 'active' ? 'No hay hábitos todavía' : 'Nada archivado'} /></div>
      ) : (
        <div className="grid g2">
          {list.map((h) => {
            const st = streaks(h, logs, settings.weekStart);
            const str = strength(h, logs, settings.weekStart);
            const rate = completionRate(h, logs, addDays(today, -29), today, settings.weekStart);
            return (
              <div key={h.id} className="card" style={{ padding: 16 }}>
                <div className="row" style={{ alignItems: 'flex-start' }}>
                  <div className="habit-emoji" style={{ background: `color-mix(in srgb, ${h.color} 16%, transparent)` }}>{h.emoji}</div>
                  <div className="grow" style={{ cursor: 'pointer' }} onClick={() => navigate(`habit/${h.id}`)}>
                    <div className="habit-name">{h.name}</div>
                    <div className="habit-meta">
                      <span>{freqLabel(h)}</span><span>· {kindLabel(h)}</span><span>· {h.category}</span>
                    </div>
                  </div>
                  {view === 'active' && (
                    <div className="row" style={{ gap: 2 }}>
                      <button className="btn ghost icon" title="Subir" onClick={() => move(h.id, -1)}>↑</button>
                      <button className="btn ghost icon" title="Bajar" onClick={() => move(h.id, 1)}>↓</button>
                    </div>
                  )}
                </div>
                <div className="grid g3" style={{ marginTop: 14, gap: 10 }}>
                  <div><div className="tiny muted">Racha</div><b>🔥 {st.current}</b> <span className="tiny muted">/ {st.best}</span></div>
                  <div><div className="tiny muted">30 días</div><b>{Math.round(rate * 100)}%</b></div>
                  <div><div className="tiny muted">Total</div><b>{totalCompletions(h, logs)}</b></div>
                </div>
                <div style={{ marginTop: 12 }}>
                  <div className="row between tiny muted" style={{ marginBottom: 4 }}><span>Fuerza del hábito</span><span>{Math.round(str * 100)}%</span></div>
                  <Bar value={str} color={h.color} />
                </div>
                <div className="row" style={{ marginTop: 12, gap: 4 }}>
                  <button className="btn sm" onClick={() => navigate(`habit/${h.id}`)}>📊 Estadísticas</button>
                  <button className="btn sm ghost" onClick={() => { setEdit(h); setOpen(true); }}>Editar</button>
                  <button className="btn sm ghost" onClick={() => { updateHabit(h.id, { archived: !h.archived }); toast(h.archived ? 'Restaurado' : 'Archivado (tu historial se conserva)', '🗄️'); }}>
                    {h.archived ? 'Restaurar' : 'Archivar'}
                  </button>
                  <button className="btn sm ghost danger" style={{ marginLeft: 'auto' }} onClick={async () => { if (await askConfirm(`¿Eliminar "${h.name}"?`, { body: 'Se borra el hábito y todo su historial. Si querés conservarlo, archivalo.', danger: true, ok: 'Eliminar' })) deleteHabit(h.id); }}>Eliminar</button>
                </div>
              </div>
            );
          })}
        </div>
      )}
      <HabitForm open={open} onClose={() => setOpen(false)} habit={edit} />
    </div>
  );
}
