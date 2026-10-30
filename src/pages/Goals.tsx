import { useState } from 'react';
import { useStore } from '../lib/store';
import type { Goal } from '../lib/types';
import { activeHabits, dayStats, entryOf, isDone, mean } from '../lib/stats';
import { addDays, diffDays, prettyDate, range, shortDate, todayKey, weekStartOf } from '../lib/date';
import { askConfirm, Bar, Empty, Modal, Ring, toast } from '../components/ui';
import { moodFace } from '../components/MoodLogger';

function goalProgress(g: Goal, data: ReturnType<typeof useStore.getState>) {
  const h = data.habits.find((x) => x.id === g.habitId);
  if (!h) return { count: 0, pct: 0 };
  let count = 0;
  for (const d of range(g.createdAt, todayKey() < g.deadline ? todayKey() : g.deadline)) if (isDone(h, entryOf(data.logs, d, h.id), d)) count++;
  return { count, pct: Math.min(1, count / g.target) };
}

export function Goals() {
  const data = useStore();
  const { goals, upsertGoal, deleteGoal, reviews, setReview } = data;
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<Partial<Goal>>({});
  const today = todayKey();
  const week = weekStartOf(today, data.settings.weekStart);
  const [wk, setWk] = useState(week);
  const rv = reviews[wk] ?? { week: wk, wins: '', lessons: '', focus: '', rating: 0 };
  const wDays = range(wk, addDays(wk, 6)).filter((d) => d <= today);
  const habits = activeHabits(data);
  const wStats = wDays.map((d) => dayStats(data, d, habits));
  const wRate = wStats.reduce((s, x) => s + x.done, 0) / Math.max(1, wStats.reduce((s, x) => s + x.total, 0));
  const wMood = mean(wDays.map((d) => data.moods[d]?.mood).filter((x): x is number => !!x));
  const best = habits
    .map((h) => ({ h, n: wDays.filter((d) => isDone(h, entryOf(data.logs, d, h.id), d)).length }))
    .sort((a, b) => b.n - a.n);

  const save = () => {
    if (!draft.title?.trim()) return toast('Ponele un título', '✏️');
    upsertGoal({ target: 30, deadline: addDays(today, 30), createdAt: today, ...draft, title: draft.title.trim() });
    setOpen(false);
    toast('Objetivo guardado', '🚩');
  };

  return (
    <div>
      <div className="page-head">
        <div><div className="eyebrow">Objetivos & revisión</div><h1 className="title">Hacia <em>dónde</em> vas</h1></div>
        <button className="btn primary" onClick={() => { setDraft({ habitId: habits[0]?.id, target: 30, deadline: addDays(today, 30), createdAt: today }); setOpen(true); }}>+ Nuevo objetivo</button>
      </div>

      {goals.length === 0 ? (
        <div className="card" style={{ marginBottom: 16 }}><Empty emoji="🚩" title="Sin objetivos todavía"><p>Ej: “Meditar 60 veces antes de fin de año”.</p></Empty></div>
      ) : (
        <div className="grid g3" style={{ marginBottom: 16 }}>
          {goals.map((g) => {
            const h = data.habits.find((x) => x.id === g.habitId);
            const p = goalProgress(g, data);
            const daysLeft = diffDays(g.deadline, today);
            const totalDays = Math.max(1, diffDays(g.deadline, g.createdAt));
            const expected = Math.min(1, diffDays(today, g.createdAt) / totalDays);
            const onTrack = p.pct >= expected - 0.05;
            return (
              <div key={g.id} className="card">
                <div className="row" style={{ gap: 14 }}>
                  <Ring value={p.pct} size={72} stroke={7} color={h?.color}><b className="small">{Math.round(p.pct * 100)}%</b></Ring>
                  <div className="grow">
                    <div style={{ fontWeight: 600 }}>{g.title}</div>
                    <div className="small muted">{h ? `${h.emoji} ${h.name}` : 'Hábito eliminado'} · {p.count}/{g.target}</div>
                    <div style={{ marginTop: 6 }}>
                      {p.pct >= 1 ? <span className="badge good">🎉 Logrado</span> : daysLeft < 0 ? <span className="badge bad">Vencido</span> : <span className={`badge ${onTrack ? 'good' : 'warn'}`}>{onTrack ? 'En ritmo' : 'Atrasado'} · {daysLeft} días</span>}
                    </div>
                  </div>
                </div>
                {p.pct < 1 && daysLeft > 0 && <div className="tiny muted" style={{ marginTop: 10 }}>Necesitás ~{Math.ceil(((g.target - p.count) / daysLeft) * 7)} por semana para llegar al {shortDate(g.deadline)}.</div>}
                <div className="row" style={{ marginTop: 10, gap: 4 }}>
                  <button className="btn ghost sm" onClick={() => { setDraft(g); setOpen(true); }}>Editar</button>
                  <button className="btn ghost sm danger" onClick={async () => (await askConfirm('¿Eliminar objetivo?', { danger: true, ok: 'Eliminar' })) && deleteGoal(g.id)}>Eliminar</button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div className="grid g3">
        <div className="card span2">
          <div className="card-head">
            <div><h3 className="h3">Revisión semanal</h3><span className="sub">Semana del {prettyDate(wk)}</span></div>
            <div className="row">
              <button className="btn icon sm" onClick={() => setWk(addDays(wk, -7))}>‹</button>
              <button className="btn icon sm" disabled={wk >= week} onClick={() => setWk(addDays(wk, 7))}>›</button>
            </div>
          </div>
          <div className="col" style={{ gap: 14 }}>
            {(['wins', 'lessons', 'focus'] as const).map((k) => (
              <div className="field" key={k}>
                <label className="label">{k === 'wins' ? '🏆 ¿Qué salió bien?' : k === 'lessons' ? '🧩 ¿Qué aprendiste / qué costó?' : '🎯 ¿En qué te enfocás la próxima semana?'}</label>
                <textarea className="textarea" defaultValue={rv[k]} key={wk + k} onBlur={(e) => e.target.value !== rv[k] && setReview({ ...rv, [k]: e.target.value })} />
              </div>
            ))}
            <div className="field">
              <span className="label">Calificá tu semana</span>
              <div className="row" style={{ gap: 4 }}>
                {[1, 2, 3, 4, 5].map((n) => (
                  <button key={n} className="btn ghost icon" style={{ fontSize: 22 }} onClick={() => { setReview({ ...rv, rating: n }); toast('Revisión guardada · +25 XP', '🪞'); }}>{n <= rv.rating ? '★' : '☆'}</button>
                ))}
              </div>
            </div>
          </div>
        </div>
        <div className="card soft col">
          <h3 className="h3">Resumen de la semana</h3>
          <div className="row" style={{ gap: 14 }}>
            <Ring value={wRate} size={76} stroke={8}><b>{Math.round(wRate * 100)}%</b></Ring>
            <div><div className="small">Cumplimiento</div><div className="small muted">Ánimo: {wMood ? `${moodFace(wMood)} ${wMood.toFixed(1)}` : '–'}</div></div>
          </div>
          <hr className="sep" style={{ margin: '8px 0' }} />
          {best.slice(0, 8).map(({ h, n }) => (
            <div key={h.id}>
              <div className="row between small"><span>{h.emoji} {h.name}</span><b>{n}/{wDays.length}</b></div>
              <Bar value={n / Math.max(1, wDays.length)} color={h.color} />
            </div>
          ))}
        </div>
      </div>

      <Modal open={open} onClose={() => setOpen(false)}>
        <h2 className="h2" style={{ marginBottom: 16 }}>{draft.id ? 'Editar objetivo' : 'Nuevo objetivo'}</h2>
        <div className="col" style={{ gap: 14 }}>
          <div className="field"><label className="label">Título</label><input className="input" autoFocus value={draft.title ?? ''} onChange={(e) => setDraft({ ...draft, title: e.target.value })} placeholder="Ej: Leer 50 veces este trimestre" /></div>
          <div className="field"><label className="label">Hábito</label>
            <select className="select" value={draft.habitId ?? ''} onChange={(e) => setDraft({ ...draft, habitId: e.target.value })}>
              {habits.map((h) => <option key={h.id} value={h.id}>{h.emoji} {h.name}</option>)}
            </select>
          </div>
          <div className="grid g3">
            <div className="field"><label className="label">Cantidad de veces</label><input className="input" type="number" min={1} value={draft.target ?? 30} onChange={(e) => setDraft({ ...draft, target: Number(e.target.value) })} /></div>
            <div className="field"><label className="label">Desde</label><input className="input" type="date" value={draft.createdAt ?? today} onChange={(e) => setDraft({ ...draft, createdAt: e.target.value })} /></div>
            <div className="field"><label className="label">Hasta</label><input className="input" type="date" value={draft.deadline ?? ''} onChange={(e) => setDraft({ ...draft, deadline: e.target.value })} /></div>
          </div>
          <div className="row" style={{ justifyContent: 'flex-end' }}>
            <button className="btn ghost" onClick={() => setOpen(false)}>Cancelar</button>
            <button className="btn primary" onClick={save}>Guardar</button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
