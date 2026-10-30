import { useMemo, useState } from 'react';
import { Area, AreaChart, Bar as RBar, BarChart, CartesianGrid, Cell, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useStore } from '../lib/store';
import { completionRate, entryOf, isDone, isScheduled, mean, progressOf, strengthSeries, streaks, totalAmount, totalCompletions } from '../lib/stats';
import { addDays, diffDays, fromKey, MONTHS_SHORT, range, shortDate, todayKey, WEEKDAYS_SHORT } from '../lib/date';
import { Heatmap } from '../components/Heatmap';
import { HabitForm } from '../components/HabitForm';
import { ChartTooltip, Empty, Ring, Seg, Stat } from '../components/ui';
import { navigate } from '../router';
import { freqLabel, kindLabel } from './Habits';
import { HabitRow } from '../components/HabitRow';

export function HabitDetail({ id }: { id: string }) {
  const data = useStore();
  const h = data.habits.find((x) => x.id === id);
  const [edit, setEdit] = useState(false);
  const [span, setSpan] = useState<30 | 90 | 365>(90);
  const ws = data.settings.weekStart;
  const today = todayKey();

  const computed = useMemo(() => {
    if (!h) return null;
    const strength = strengthSeries(h, data.logs, ws);
    const from = addDays(today, -(span - 1));
    const strengthSpan = strength.filter((s) => s.date >= from).map((s) => ({ date: shortDate(s.date), score: Math.round(s.score * 100) }));
    // por mes
    const months: Record<string, { done: number; total: number }> = {};
    for (const d of range(h.createdAt, today)) {
      const m = d.slice(0, 7);
      months[m] = months[m] ?? { done: 0, total: 0 };
      if (isScheduled(h, d)) months[m].total++;
      if (isDone(h, entryOf(data.logs, d, h.id), d)) months[m].done++;
    }
    const monthly = Object.entries(months).slice(-12).map(([m, v]) => ({ m: MONTHS_SHORT[Number(m.slice(5)) - 1], done: v.done, rate: v.total ? Math.round((v.done / v.total) * 100) : 0 }));
    // por día de semana
    const wd = Array.from({ length: 7 }, () => ({ done: 0, total: 0 }));
    for (const d of range(h.createdAt, today)) {
      if (!isScheduled(h, d)) continue;
      const i = fromKey(d).getDay();
      wd[i].total++;
      if (isDone(h, entryOf(data.logs, d, h.id), d)) wd[i].done++;
    }
    const weekday = [1, 2, 3, 4, 5, 6, 0].map((i) => ({ d: WEEKDAYS_SHORT[i], rate: wd[i].total ? Math.round((wd[i].done / wd[i].total) * 100) : 0 }));
    const values = range(from, today).map((d) => ({ date: shortDate(d), v: entryOf(data.logs, d, h.id)?.value ?? 0 }));
    const notes = Object.keys(data.logs).filter((d) => data.logs[d][h.id]?.note).sort().reverse().map((d) => ({ d, note: data.logs[d][h.id].note! }));
    const moodW: number[] = [];
    const moodWo: number[] = [];
    for (const m of Object.values(data.moods)) {
      if (!isScheduled(h, m.date)) continue;
      (isDone(h, entryOf(data.logs, m.date, h.id), m.date) ? moodW : moodWo).push(m.mood);
    }
    return { strength: strengthSpan, curStrength: strength.at(-1)?.score ?? 0, monthly, weekday, values, notes, moodW: mean(moodW), moodWo: mean(moodWo), nMood: moodW.length + moodWo.length };
  }, [h, data.logs, data.moods, span, ws, today]);

  if (!h || !computed) return <div className="card"><Empty emoji="🤷" title="Hábito no encontrado"><button className="btn" onClick={() => navigate('habits')}>Volver</button></Empty></div>;
  const st = streaks(h, data.logs, ws);
  const r30 = completionRate(h, data.logs, addDays(today, -29), today, ws);
  const rAll = completionRate(h, data.logs, h.createdAt, today, ws);
  const total = totalCompletions(h, data.logs);
  const amount = totalAmount(h, data.logs);
  const age = diffDays(today, h.createdAt) + 1;
  const quantitative = h.kind === 'count' || h.kind === 'quantity';

  return (
    <div>
      <div className="page-head">
        <div className="row" style={{ gap: 16 }}>
          <div className="habit-emoji" style={{ width: 64, height: 64, fontSize: 32, borderRadius: 20, background: `color-mix(in srgb, ${h.color} 18%, transparent)` }}>{h.emoji}</div>
          <div>
            <div className="eyebrow">{h.category} · {freqLabel(h)} · {kindLabel(h)}</div>
            <h1 className="title">{h.name}</h1>
            {h.why && <div className="ink2" style={{ marginTop: 4 }}>“{h.why}”</div>}
          </div>
        </div>
        <div className="row">
          <button className="btn ghost" onClick={() => navigate('habits')}>← Hábitos</button>
          <button className="btn" onClick={() => setEdit(true)}>Editar</button>
        </div>
      </div>

      <div style={{ marginBottom: 16 }}><HabitRow habit={h} date={today} /></div>

      <div className="grid g4" style={{ marginBottom: 16 }}>
        <div className="card row" style={{ gap: 16 }}>
          <Ring value={computed.curStrength} size={78} stroke={8} color={h.color}><b>{Math.round(computed.curStrength * 100)}</b></Ring>
          <div><div className="k small muted">Fuerza</div><div className="small ink2">{computed.curStrength > 0.8 ? 'Consolidado 💪' : computed.curStrength > 0.5 ? 'En camino' : 'Construyendo'}</div></div>
        </div>
        <div className="card"><Stat k="Racha actual" v={`🔥 ${st.current}`} sub={<span className="muted">Mejor: {st.best} {st.unit}</span>} /></div>
        <div className="card"><Stat k="Últimos 30 días" v={Math.round(r30 * 100)} unit="%" sub={<span className="muted">Histórico: {Math.round(rAll * 100)}%</span>} /></div>
        <div className="card"><Stat k={quantitative ? `Total ${h.unit ?? ''}` : 'Veces completado'} v={quantitative ? amount.toLocaleString('es') : total} sub={<span className="muted">En {age} días</span>} /></div>
      </div>

      <div className="grid g3">
        <div className="card span3">
          <div className="card-head">
            <div><h3 className="h3">Año en un vistazo</h3><span className="sub">Cada cuadrado es un día</span></div>
          </div>
          <Heatmap weeks={53} color={h.color} weekStart={ws} values={(d) => (d < h.createdAt ? null : isScheduled(h, d) || entryOf(data.logs, d, h.id) ? progressOf(h, entryOf(data.logs, d, h.id)) : null)} />
        </div>

        <div className="card span2">
          <div className="card-head">
            <div><h3 className="h3">Evolución de la fuerza</h3><span className="sub">Media móvil exponencial: sube con constancia, baja suave cuando fallás</span></div>
            <Seg value={span} onChange={setSpan} options={[{ v: 30, l: '30d' }, { v: 90, l: '90d' }, { v: 365, l: '1a' }]} />
          </div>
          <ResponsiveContainer width="100%" height={240}>
            <AreaChart data={computed.strength}>
              <defs>
                <linearGradient id="gs" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={h.color} stopOpacity={0.35} />
                  <stop offset="100%" stopColor={h.color} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid vertical={false} strokeDasharray="3 3" />
              <XAxis dataKey="date" tickLine={false} axisLine={false} minTickGap={30} />
              <YAxis domain={[0, 100]} tickLine={false} axisLine={false} width={30} />
              <Tooltip content={<ChartTooltip fmt={(v) => `${v}%`} />} />
              <Area type="monotone" dataKey="score" name="Fuerza" stroke={h.color} strokeWidth={2.5} fill="url(#gs)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        <div className="card">
          <div className="card-head"><h3 className="h3">Por día de la semana</h3></div>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={computed.weekday}>
              <XAxis dataKey="d" tickLine={false} axisLine={false} />
              <YAxis hide domain={[0, 100]} />
              <Tooltip content={<ChartTooltip fmt={(v) => `${v}%`} />} cursor={{ fill: 'var(--bg-2)' }} />
              <RBar dataKey="rate" name="Cumplimiento" radius={[8, 8, 8, 8]}>
                {computed.weekday.map((w, i) => <Cell key={i} fill={h.color} fillOpacity={0.35 + (w.rate / 100) * 0.65} />)}
              </RBar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {quantitative && (
          <div className="card span2">
            <div className="card-head"><div><h3 className="h3">Valores registrados</h3><span className="sub">Meta: {h.target} {h.unit}</span></div></div>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={computed.values}>
                <CartesianGrid vertical={false} strokeDasharray="3 3" />
                <XAxis dataKey="date" tickLine={false} axisLine={false} minTickGap={30} />
                <YAxis tickLine={false} axisLine={false} width={40} />
                <Tooltip content={<ChartTooltip fmt={(v) => `${v} ${h.unit ?? ''}`} />} cursor={{ fill: 'var(--bg-2)' }} />
                <ReferenceLine y={h.target} stroke="var(--ink-3)" strokeDasharray="4 4" />
                <RBar dataKey="v" name={h.unit || 'valor'} radius={[4, 4, 0, 0]}>
                  {computed.values.map((v, i) => <Cell key={i} fill={h.color} fillOpacity={v.v >= h.target ? 1 : 0.4} />)}
                </RBar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        <div className={`card ${quantitative ? '' : 'span2'}`}>
          <div className="card-head"><h3 className="h3">Mes a mes</h3></div>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={computed.monthly}>
              <XAxis dataKey="m" tickLine={false} axisLine={false} />
              <YAxis hide />
              <Tooltip content={<ChartTooltip />} cursor={{ fill: 'var(--bg-2)' }} />
              <RBar dataKey="done" name="Completados" fill={h.color} radius={[8, 8, 8, 8]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="card">
          <div className="card-head"><h3 className="h3">Impacto en tu ánimo</h3></div>
          {computed.nMood >= 6 ? (
            <div className="col">
              <div className="row between"><span className="small">Días que lo hacés</span><b className="serif" style={{ fontSize: 28 }}>{computed.moodW.toFixed(1)}</b></div>
              <div className="row between"><span className="small">Días que no</span><b className="serif" style={{ fontSize: 28 }}>{computed.moodWo.toFixed(1)}</b></div>
              <div className={computed.moodW >= computed.moodWo ? 'delta-up' : 'delta-down'}>
                {computed.moodW >= computed.moodWo ? '▲' : '▼'} {Math.abs(computed.moodW - computed.moodWo).toFixed(2)} puntos de ánimo
              </div>
              <div className="tiny muted">Basado en {computed.nMood} días con ánimo registrado.</div>
            </div>
          ) : <div className="small muted">Registrá tu ánimo algunos días más para ver la relación con este hábito.</div>}
        </div>

        <div className="card">
          <div className="card-head"><h3 className="h3">Notas</h3><span className="sub">{computed.notes.length}</span></div>
          {computed.notes.length ? (
            <div className="col" style={{ maxHeight: 220, overflowY: 'auto' }}>
              {computed.notes.map((n) => <div key={n.d} className="small"><b>{shortDate(n.d)}</b> <span className="ink2">{n.note}</span></div>)}
            </div>
          ) : <div className="small muted">Agregá notas desde el menú ⋯ de cada día.</div>}
        </div>
      </div>
      <HabitForm open={edit} onClose={() => setEdit(false)} habit={h} />
    </div>
  );
}
