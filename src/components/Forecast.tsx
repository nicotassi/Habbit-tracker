import type { Habit } from '../lib/types';
import { useStore } from '../lib/store';
import { milestonesOf, nextMilestone, risksFor } from '../lib/forecast';
import { diffDays, fromKey, MONTHS, todayKey } from '../lib/date';
import { navigate } from '../router';

const when = (k: string) => {
  const n = diffDays(k, todayKey());
  const d = fromKey(k);
  const date = `${d.getDate()} de ${MONTHS[d.getMonth()]}`;
  if (n <= 0) return 'hoy';
  if (n === 1) return 'mañana';
  return `el ${date} (en ${n} días)`;
};

/** Hoy: hábitos con riesgo según tu historial y el próximo hito. */
export function ForecastCard() {
  const data = useStore();
  const risks = risksFor(data).slice(0, 3);
  const next = nextMilestone(data);
  if (!risks.length && !next) return null;
  return (
    <div className="card forecast-card">
      <div className="card-head"><h3 className="h3">🔮 Pronóstico de hoy</h3></div>
      <div className="col" style={{ gap: 10 }}>
        {risks.map((r) => (
          <button key={r.habit.id} className="forecast-item risk" onClick={() => navigate(`habit/${r.habit.id}`)}>
            <span className="fi-ico">{r.habit.emoji}</span>
            <span className="small">
              Los <b>{r.weekday}</b> fallás <b>{r.habit.name}</b> el <b>{Math.round(r.failRate * 100)}%</b> de las veces (en general, {Math.round(r.usualFailRate * 100)}%).
              Hoy es {r.today}: dale prioridad.
            </span>
          </button>
        ))}
        {next && (
          <button className="forecast-item good" onClick={() => navigate(`habit/${next.habit.id}`)}>
            <span className="fi-ico">{next.habit.emoji}</span>
            <span className="small">
              {next.kind === 'automatic'
                ? <>Si seguís así, <b>{next.habit.name}</b> llega a <b>66 días seguidos</b> {when(next.date)}: el punto en que un hábito suele volverse automático.</>
                : <>Si lo hacés cada día que toca, <b>{next.habit.name}</b> queda <b>consolidado</b> (fuerza 80%) {when(next.date)}.</>}
            </span>
          </button>
        )}
      </div>
    </div>
  );
}

/** Detalle de un hábito: hitos proyectados y su día más difícil. */
export function HabitForecast({ habit }: { habit: Habit }) {
  const data = useStore();
  const m = milestonesOf(habit, data);
  const items: { ico: string; text: React.ReactNode }[] = [];
  if (m.automatic) items.push({ ico: '🧬', text: <>Con tu racha actual de {m.streak} {m.streak === 1 ? 'día' : 'días'}, llegás a <b>66 días seguidos</b> (hábito automático) {when(m.automatic)} si no fallás.</> });
  else if (m.streak >= 66) items.push({ ico: '🧬', text: <>Ya pasaste los <b>66 días seguidos</b>: este hábito ya es automático.</> });
  if (m.consolidated) items.push({ ico: '💪', text: <>Fuerza actual {Math.round(m.strength * 100)}%: llega a <b>80% (consolidado)</b> {when(m.consolidated)} si lo hacés cada día que toca.</> });
  else items.push({ ico: '💪', text: <>Fuerza {Math.round(m.strength * 100)}%: está <b>consolidado</b>. Mantenelo.</> });
  if (m.worstDay && m.worstDay.rate < 0.75) items.push({ ico: '⚠️', text: <>Tu día más difícil son los <b>{m.worstDay.weekday}</b> ({Math.round(m.worstDay.rate * 100)}% de cumplimiento). Planificalos con un disparador concreto.</> });
  return (
    <div className="card">
      <div className="card-head"><h3 className="h3">🔮 Pronóstico</h3></div>
      <div className="col" style={{ gap: 10 }}>
        {items.map((it, i) => (
          <div key={i} className="forecast-item"><span className="fi-ico">{it.ico}</span><span className="small">{it.text}</span></div>
        ))}
      </div>
    </div>
  );
}
