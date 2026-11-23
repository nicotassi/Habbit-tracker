import { useState } from 'react';
import { useStore } from '../lib/store';
import type { Habit } from '../lib/types';
import { strength } from '../lib/stats';
import { WEEKDAYS_SHORT } from '../lib/date';
import { HabitForm } from '../components/HabitForm';
import { scheduleSummary } from '../lib/schedule';
import { Empty, Ring, Seg, toast } from '../components/ui';
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
  const { habits, logs, settings, updateHabit, reorderHabits } = useStore();
  const [view, setView] = useState<'active' | 'archived'>('active');
  const [cat, setCat] = useState('Todas');
  const [q, setQ] = useState('');
  const [edit, setEdit] = useState<Habit | null>(null);
  const [open, setOpen] = useState(false);
  const [sorting, setSorting] = useState(false);
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

  return (
    <div>
      <div className="page-head">
        <div>
          <div className="eyebrow">{habits.filter((h) => !h.archived).length} activos · sin límite</div>
          <h1 className="title">Tus <em>hábitos</em></h1>
        </div>
        <button className="btn primary" onClick={() => { setEdit(null); setOpen(true); }}>+ Nuevo hábito</button>
      </div>

      <div className="habits-filters">
        <Seg value={view} onChange={setView} options={[{ v: 'active', l: 'Activos' }, { v: 'archived', l: 'Archivados' }]} />
        {view === 'active' && list.length > 1 && (
          <button className={`btn sm ${sorting ? 'primary' : 'ghost'}`} onClick={() => setSorting((x) => !x)}>{sorting ? 'Listo' : '↕ Ordenar'}</button>
        )}
      </div>
      {cats.length > 2 && (
        <div className="chips-scroll">
          {cats.map((c) => <button key={c} className={`chip ${cat === c ? 'on' : ''}`} onClick={() => setCat(c)}>{c}</button>)}
        </div>
      )}
      {habits.length > 8 && <input className="input" style={{ marginBottom: 12 }} placeholder="Buscar hábito…" value={q} onChange={(e) => setQ(e.target.value)} />}

      {list.length === 0 ? (
        <div className="card"><Empty emoji={view === 'active' ? '🌱' : '🗄️'} title={view === 'active' ? 'No hay hábitos todavía' : 'Nada archivado'} /></div>
      ) : (
        <div className="habit-list">
          {list.map((h) => {
            const str = strength(h, logs, settings.weekStart);
            const sched = scheduleSummary(h);
            return (
              <div key={h.id} className="habit-row habit-item" onClick={() => !sorting && navigate(`habit/${h.id}`)}>
                <div className="habit-emoji" style={{ background: `color-mix(in srgb, ${h.color} 16%, transparent)` }}>{h.emoji}</div>
                <div className="grow">
                  <div className="habit-name">{h.name}</div>
                  <div className="habit-meta">{h.nonNegotiable && <span className="m-nn">🔒 No negociable</span>}<span>{freqLabel(h)}</span>{sched && <span>🕐 {sched}</span>}</div>
                </div>
                {sorting ? (
                  <div className="row" style={{ gap: 2 }}>
                    <button className="btn ghost icon" aria-label="Subir" onClick={(e) => { e.stopPropagation(); move(h.id, -1); }}>↑</button>
                    <button className="btn ghost icon" aria-label="Bajar" onClick={(e) => { e.stopPropagation(); move(h.id, 1); }}>↓</button>
                  </div>
                ) : view === 'archived' ? (
                  <button className="btn sm" onClick={(e) => { e.stopPropagation(); updateHabit(h.id, { archived: false }); toast('Restaurado', '🗄️'); }}>Restaurar</button>
                ) : (
                  <>
                    <Ring value={str} size={34} stroke={4} color={h.color}><span className="tiny">{Math.round(str * 100)}</span></Ring>
                    <span className="muted" aria-hidden="true">›</span>
                  </>
                )}
              </div>
            );
          })}
        </div>
      )}
      {view === 'active' && list.length > 0 && !sorting && <p className="tiny muted" style={{ margin: '10px 2px 0' }}>El número es la fuerza de cada hábito (0 a 100). Tocá uno para ver su racha, estadísticas y opciones.</p>}
      <HabitForm open={open} onClose={() => setOpen(false)} habit={edit} />
    </div>
  );
}
