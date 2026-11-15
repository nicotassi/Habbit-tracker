import { Bar as RBar, BarChart, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { Habit } from '../lib/types';
import { useStore } from '../lib/store';
import { activeHabits } from '../lib/stats';
import { addDays, range, shortDate, todayKey } from '../lib/date';
import { Bar, ChartTooltip } from './ui';
import { fmtDuration } from './HabitTimer';
import { navigate } from '../router';

const secOn = (logs: ReturnType<typeof useStore.getState>['logs'], d: string, id: string) => logs[d]?.[id]?.seconds ?? 0;

/** Detalle de un hábito: cuánto tiempo le dedicaste. */
export function HabitTimeCard({ habit: h }: { habit: Habit }) {
  const logs = useStore((s) => s.logs);
  const today = todayKey();
  const all = Object.keys(logs).reduce((s, d) => s + secOn(logs, d, h.id), 0);
  if (!all && !h.trackTime) return null;
  const days30 = range(addDays(today, -29), today);
  const last30 = days30.reduce((s, d) => s + secOn(logs, d, h.id), 0);
  const daysWith = days30.filter((d) => secOn(logs, d, h.id) > 0).length;
  const week = range(addDays(today, -6), today).reduce((s, d) => s + secOn(logs, d, h.id), 0);
  const chart = days30.map((d) => ({ d: shortDate(d), min: Math.round(secOn(logs, d, h.id) / 60) }));
  return (
    <div className="card span2">
      <div className="card-head"><div><h3 className="h3">⏱ Tiempo dedicado</h3><span className="sub">Cronómetro, pomodoro y tiempo cargado a mano</span></div></div>
      {all ? (
        <>
          <div className="grid g4" style={{ gap: 12, marginBottom: 12 }}>
            <div><div className="tiny muted">Total</div><b>{fmtDuration(all)}</b></div>
            <div><div className="tiny muted">Últimos 30 días</div><b>{fmtDuration(last30)}</b></div>
            <div><div className="tiny muted">Esta semana</div><b>{fmtDuration(week)}</b></div>
            <div><div className="tiny muted">Promedio por día</div><b>{daysWith ? fmtDuration(last30 / daysWith) : '–'}</b></div>
          </div>
          <ResponsiveContainer width="100%" height={160}>
            <BarChart data={chart}>
              <XAxis dataKey="d" tickLine={false} axisLine={false} minTickGap={24} />
              <YAxis hide />
              <Tooltip content={<ChartTooltip fmt={(v) => `${v} min`} />} cursor={{ fill: 'var(--bg-2)' }} />
              <RBar dataKey="min" name="Minutos" radius={[5, 5, 0, 0]}>
                {chart.map((_, i) => <Cell key={i} fill={h.color} />)}
              </RBar>
            </BarChart>
          </ResponsiveContainer>
        </>
      ) : <p className="small muted" style={{ margin: 0 }}>Tocá ▶ en el hábito para empezar a medir el tiempo.</p>}
    </div>
  );
}

/** Análisis: tiempo dedicado a cada hábito en el período. */
export function TimeByHabit({ days }: { days: string[] }) {
  const data = useStore();
  const rows = activeHabits(data)
    .map((h) => ({ h, sec: days.reduce((s, d) => s + secOn(data.logs, d, h.id), 0) }))
    .filter((r) => r.sec > 0)
    .sort((a, b) => b.sec - a.sec);
  if (!rows.length) return null;
  const max = rows[0].sec;
  const total = rows.reduce((s, r) => s + r.sec, 0);
  return (
    <div className="card">
      <div className="card-head"><div><h3 className="h3">⏱ Tiempo por hábito</h3><span className="sub">{fmtDuration(total)} en el período</span></div></div>
      <div className="col" style={{ gap: 10 }}>
        {rows.map(({ h, sec }) => (
          <button key={h.id} className="time-row" onClick={() => navigate(`habit/${h.id}`)}>
            <span className="row between small" style={{ marginBottom: 4 }}><span>{h.emoji} {h.name}</span><b>{fmtDuration(sec)}</b></span>
            <Bar value={sec / max} color={h.color} />
          </button>
        ))}
      </div>
    </div>
  );
}
