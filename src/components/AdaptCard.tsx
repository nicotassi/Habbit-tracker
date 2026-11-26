import { useState } from 'react';
import { useStore } from '../lib/store';
import type { AdaptSuggestion } from '../lib/adapt';
import { todayKey } from '../lib/date';
import { HabitForm } from './HabitForm';
import { toast } from './ui';

/** Sugerencia de ajuste de meta: aceptar, mantener o (si no hay número que cambiar) editar el hábito. */
export function AdaptCard({ s, compact }: { s: AdaptSuggestion; compact?: boolean }) {
  const changeGoal = useStore((st) => st.changeGoal);
  const setAdapt = useStore((st) => st.setAdapt);
  const [edit, setEdit] = useState(false);
  const apply = () => {
    if (!s.change) { setEdit(true); return; }
    changeGoal(s.habit.id, todayKey(), s.change);
    setAdapt(s.habit.id, { at: Date.now(), action: 'applied', dir: s.dir });
    toast(s.dir === 'up' ? '¡Nueva meta! A por más' : 'Meta ajustada. Ahora a cumplirla', s.dir === 'up' ? '🚀' : '🎚️');
  };
  const keep = () => {
    setAdapt(s.habit.id, { at: Date.now(), action: 'dismissed', dir: s.dir });
    toast('Listo, la dejamos como está. Te vuelvo a preguntar en un par de semanas', '👍');
  };
  return (
    <div className={`adapt-card ${s.dir}`}>
      <div className="adapt-kicker">{s.dir === 'up' ? '📈 Subir la vara' : '🎚️ Ajuste sugerido'}</div>
      <div className="adapt-title">{s.title}</div>
      <p className="small adapt-text">{s.text}</p>
      {!compact && <div className="tiny muted">{s.evidence}</div>}
      <div className="row wrap" style={{ gap: 8, marginTop: 10 }}>
        <button className="btn sm primary" onClick={apply}>{s.cta}</button>
        <button className="btn sm ghost" onClick={keep}>Mantener como está</button>
      </div>
      <HabitForm open={edit} onClose={() => { setEdit(false); setAdapt(s.habit.id, { at: Date.now(), action: 'applied', dir: s.dir }); }} habit={s.habit} />
    </div>
  );
}
