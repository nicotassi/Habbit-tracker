import { useMemo, useState } from 'react';
import {
  Area, Bar as RBar, BarChart, CartesianGrid, Cell, ComposedChart, Line, PolarAngleAxis, PolarGrid, Radar, RadarChart, Scatter,
  ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import { useStore } from '../lib/store';
import {
  activeHabits, categoryBreakdown, completionRate, dayStats, hourProfile, insights, mean, moodImpact, moodSeries,
  rollingAvg, strength, streaks, weekdayProfile,
} from '../lib/stats';
import { addDays, range, shortDate, todayKey, WEEKDAYS_SHORT, weekStartOf } from '../lib/date';
import { Heatmap } from '../components/Heatmap';
import { Bar, ChartTooltip, Empty, Seg, Stat } from '../components/ui';
import { navigate } from '../router';

type Span = 7 | 30 | 90 | 365;

export function Analytics() {
  const data = useStore();
  const [span, setSpan] = useState<Span>(30);
  const [metric, setMetric] = useState<'mood' | 'energy' | 'stress'>('mood');
  const today = todayKey();
  const ws = data.settings.weekStart;
  const habits = activeHabits(data);

  const c = useMemo(() => {
    const days = range(addDays(today, -(span - 1)), today);
    const prevDays = range(addDays(today, -(span * 2 - 1)), addDays(today, -span));
    const agg = (ds: string[]) => {
      let done = 0, total = 0, perfect = 0, active = 0;
      for (const d of ds) {
        const s = dayStats(data, d, habits);
        done += s.done;
        total += s.total;
        if (s.total && s.done === s.total) perfect++;
        if (s.done > 0) active++;
      }
      const moods = ds.map((d) => data.moods[d]?.mood).filter((x): x is number => typeof x === 'number');
      return { done, total, rate: total ? done / total : 0, perfect, active, mood: mean(moods), moodN: moods.length };
    };
    const cur = agg(days);
    const prev = agg(prevDays);
    const series = moodSeries(data, days);
    const roll = rollingAvg(series, 'rate', 7);
    const daily = series.map((r, i) => ({ ...r, label: shortDate(r.date), roll: roll[i] }));
    // semanas
    const weeks: { w: string; rate: number }[] = [];
    for (let w = weekStartOf(days[0], ws); w <= today; w = addDays(w, 7)) {
      const s = agg(range(w, addDays(w, 6) > today ? today : addDays(w, 6)));
      weeks.push({ w: shortDate(w), rate: Math.round(s.rate * 100) });
    }
    const wd = weekdayProfile(data, days, habits);
    const weekday = [1, 2, 3, 4, 5, 6, 0].map((i) => ({ d: WEEKDAYS_SHORT[i], rate: Math.round(wd[i] * 100) }));
    const cats = categoryBreakdown(data, days[0], today);
    const ranking = habits.map((h) => {
      const r = completionRate(h, data.logs, days[0], today, ws);
      const rp = completionRate(h, data.logs, prevDays[0], prevDays[prevDays.length - 1], ws);
      return { h, rate: r, trend: h.createdAt <= prevDays[0] ? r - rp : null, strength: strength(h, data.logs, ws), streak: streaks(h, data.logs, ws) };
    }).sort((a, b) => b.rate - a.rate);
    const hours = hourProfile(data, days).map((x) => ({ ...x, label: `${x.hour}h` }));
    return { cur, prev, daily, weeks, weekday, cats, ranking, hours };
  }, [data, span, today, ws, habits]);

  const impact = useMemo(() => moodImpact(data, metric), [data, metric]);
  const ins = useMemo(() => insights(data), [data]);

  if (!habits.length) {
    return (
      <div>
        <div className="page-head"><div><div className="eyebrow">Análisis</div><h1 className="title">Tu <em>progreso</em></h1></div></div>
        <div className="card"><Empty emoji="📊" title="Todavía no hay datos"><p>Creá hábitos o cargá la demo desde Ajustes.</p><button className="btn primary" onClick={() => navigate('settings')}>Ir a Ajustes</button></Empty></div>
      </div>
    );
  }

  const delta = (a: number, b: number, pct = true) => {
    if (!c.prev.total && pct) return null;
    const d = pct ? Math.round((a - b) * 100) : Math.round((a - b) * 10) / 10;
    if (d === 0) return <span className="muted small">= vs período anterior</span>;
    return <span className={d > 0 ? 'delta-up' : 'delta-down'}>{d > 0 ? '▲' : '▼'} {Math.abs(d)}{pct ? ' pts' : ''} vs anterior</span>;
  };

  return (
    <div>
      <div className="page-head">
        <div><div className="eyebrow">Análisis</div><h1 className="title">Tu <em>progreso</em></h1></div>
        <Seg value={span} onChange={setSpan} options={[{ v: 7, l: '7 días' }, { v: 30, l: '30 días' }, { v: 90, l: '3 meses' }, { v: 365, l: '1 año' }]} />
      </div>

      <div className="grid g4" style={{ marginBottom: 16 }}>
        <div className="card"><Stat k="Cumplimiento" v={Math.round(c.cur.rate * 100)} unit="%" sub={delta(c.cur.rate, c.prev.rate)} /></div>
        <div className="card"><Stat k="Hábitos completados" v={c.cur.done} sub={<span className="muted">de {c.cur.total} programados</span>} /></div>
        <div className="card"><Stat k="Días perfectos" v={c.cur.perfect} sub={<span className="muted">{c.cur.active} días con actividad</span>} /></div>
        <div className="card"><Stat k="Ánimo promedio" v={c.cur.moodN ? c.cur.mood.toFixed(1) : '–'} unit="/5" sub={c.cur.moodN && c.prev.moodN ? delta(c.cur.mood, c.prev.mood, false) : <span className="muted">{c.cur.moodN} registros</span>} /></div>
      </div>

      <div className="grid g3">
        <div className="card span3">
          <div className="card-head">
            <div><h3 className="h3">Cumplimiento diario y ánimo</h3><span className="sub">Barras: % del día · Línea: media de 7 días · Puntos: ánimo</span></div>
          </div>
          <ResponsiveContainer width="100%" height={280}>
            <ComposedChart data={c.daily}>
              <defs>
                <linearGradient id="ga" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--accent)" stopOpacity={0.3} />
                  <stop offset="100%" stopColor="var(--accent)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid vertical={false} strokeDasharray="3 3" />
              <XAxis dataKey="label" tickLine={false} axisLine={false} minTickGap={24} />
              <YAxis yAxisId="r" domain={[0, 100]} tickLine={false} axisLine={false} width={34} unit="%" />
              <YAxis yAxisId="m" orientation="right" domain={[1, 5]} tickLine={false} axisLine={false} width={24} />
              <Tooltip content={<ChartTooltip fmt={(v, n) => (n === 'Ánimo' ? `${v}/5` : `${v}%`)} />} />
              {span <= 90 ? <RBar yAxisId="r" dataKey="rate" name="Día" fill="var(--accent)" fillOpacity={0.22} radius={[4, 4, 0, 0]} /> : <Area yAxisId="r" dataKey="rate" name="Día" stroke="none" fill="url(#ga)" />}
              <Line yAxisId="r" dataKey="roll" name="Media 7d" stroke="var(--accent)" strokeWidth={2.5} dot={false} type="monotone" />
              <Scatter yAxisId="m" dataKey="mood" name="Ánimo" fill="var(--lav)" shape={(pr: { cx?: number; cy?: number }) => (pr.cx == null || pr.cy == null ? <g /> : <circle cx={pr.cx} cy={pr.cy} r={3.5} fill="var(--lav)" />)} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>

        <div className="card span3">
          <div className="card-head"><div><h3 className="h3">Mapa de constancia</h3><span className="sub">Últimas 53 semanas · % de hábitos cumplidos por día</span></div></div>
          <Heatmap weeks={53} weekStart={ws} values={(d) => { const s = dayStats(data, d, habits); return s.total ? s.rate : null; }} onPick={(d) => navigate(`calendar/${d}`)} />
        </div>

        {ins.length > 0 && (
          <div className="card span3">
            <div className="card-head"><div><h3 className="h3">Insights automáticos</h3><span className="sub">Patrones detectados en tus datos</span></div></div>
            <div className="grid g2">
              {ins.map((i, k) => (
                <div key={k} className={`insight ${i.tone}`}>
                  <div className="i-ico">{i.icon}</div>
                  <div><div style={{ fontWeight: 600 }}>{i.title}</div><div className="small ink2">{i.body}</div></div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="card span2">
          <div className="card-head"><h3 className="h3">Tendencia semanal</h3></div>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={c.weeks}>
              <CartesianGrid vertical={false} strokeDasharray="3 3" />
              <XAxis dataKey="w" tickLine={false} axisLine={false} minTickGap={20} />
              <YAxis domain={[0, 100]} tickLine={false} axisLine={false} width={34} unit="%" />
              <Tooltip content={<ChartTooltip fmt={(v) => `${v}%`} />} cursor={{ fill: 'var(--bg-2)' }} />
              <RBar dataKey="rate" name="Semana" radius={[8, 8, 8, 8]}>
                {c.weeks.map((w, i) => <Cell key={i} fill="var(--ink)" fillOpacity={0.25 + (w.rate / 100) * 0.75} />)}
              </RBar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="card">
          <div className="card-head"><h3 className="h3">Día de la semana</h3></div>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={c.weekday}>
              <XAxis dataKey="d" tickLine={false} axisLine={false} />
              <YAxis hide domain={[0, 100]} />
              <Tooltip content={<ChartTooltip fmt={(v) => `${v}%`} />} cursor={{ fill: 'var(--bg-2)' }} />
              <RBar dataKey="rate" name="Cumplimiento" radius={[8, 8, 8, 8]}>
                {c.weekday.map((w, i) => <Cell key={i} fill="var(--accent)" fillOpacity={0.3 + (w.rate / 100) * 0.7} />)}
              </RBar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="card span2">
          <div className="card-head"><div><h3 className="h3">Ranking de hábitos</h3><span className="sub">Ordenado por cumplimiento en el período</span></div></div>
          <div style={{ overflowX: 'auto' }}>
            <table className="table">
              <thead><tr><th>Hábito</th><th style={{ width: '30%' }}>Cumplimiento</th><th className="num">Tendencia</th><th className="num hide-mobile">Fuerza</th><th className="num">Racha</th></tr></thead>
              <tbody>
                {c.ranking.map(({ h, rate, trend, strength: s, streak }) => (
                  <tr key={h.id} style={{ cursor: 'pointer' }} onClick={() => navigate(`habit/${h.id}`)}>
                    <td><span style={{ marginRight: 8 }}>{h.emoji}</span>{h.name}</td>
                    <td><div className="row"><div className="grow"><Bar value={rate} color={h.color} /></div><span className="small" style={{ width: 36, textAlign: 'right' }}>{Math.round(rate * 100)}%</span></div></td>
                    <td className="num">{trend === null ? <span className="muted">–</span> : <span className={trend >= 0 ? 'delta-up' : 'delta-down'}>{trend >= 0 ? '▲' : '▼'} {Math.abs(Math.round(trend * 100))}</span>}</td>
                    <td className="num hide-mobile">{Math.round(s * 100)}</td>
                    <td className="num">🔥 {streak.current}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="card">
          <div className="card-head"><h3 className="h3">Balance por área</h3></div>
          {c.cats.length >= 3 ? (
            <ResponsiveContainer width="100%" height={260}>
              <RadarChart data={c.cats} outerRadius="72%">
                <PolarGrid />
                <PolarAngleAxis dataKey="category" tick={{ fontSize: 12, fill: 'var(--ink-2)' }} />
                <Radar dataKey="rate" name="Cumplimiento" stroke="var(--accent)" fill="var(--accent)" fillOpacity={0.25} strokeWidth={2} />
                <Tooltip content={<ChartTooltip fmt={(v) => `${v}%`} />} />
              </RadarChart>
            </ResponsiveContainer>
          ) : (
            <div className="col">
              {c.cats.map((x) => (
                <div key={x.category}><div className="row between small"><span>{x.category}</span><b>{x.rate}%</b></div><Bar value={x.rate / 100} /></div>
              ))}
              <span className="tiny muted">Con 3+ categorías ves un radar.</span>
            </div>
          )}
        </div>

        <div className="card span2">
          <div className="card-head">
            <div><h3 className="h3">¿Qué hábitos mueven tu bienestar?</h3><span className="sub">Diferencia promedio en días que cumplís vs días que no</span></div>
            <Seg value={metric} onChange={setMetric} options={[{ v: 'mood', l: 'Ánimo' }, { v: 'energy', l: 'Energía' }, { v: 'stress', l: 'Estrés' }]} />
          </div>
          {impact.length ? (
            <ResponsiveContainer width="100%" height={Math.max(160, impact.length * 38)}>
              <BarChart data={impact.map((i) => ({ name: `${i.habit.emoji} ${i.habit.name}`, delta: Math.round(i.delta * 100) / 100 }))} layout="vertical" margin={{ left: 10 }}>
                <XAxis type="number" tickLine={false} axisLine={false} />
                <YAxis type="category" dataKey="name" width={150} tickLine={false} axisLine={false} tick={{ fontSize: 12.5, fill: 'var(--ink-2)' }} />
                <ReferenceLine x={0} stroke="var(--line-2)" />
                <Tooltip content={<ChartTooltip fmt={(v) => `${v > 0 ? '+' : ''}${v}`} />} cursor={{ fill: 'var(--bg-2)' }} />
                <RBar dataKey="delta" name="Diferencia" radius={6}>
                  {impact.map((i, k) => {
                    const good = metric === 'stress' ? i.delta < 0 : i.delta > 0;
                    return <Cell key={k} fill={good ? 'var(--good)' : 'var(--bad)'} fillOpacity={0.8} />;
                  })}
                </RBar>
              </BarChart>
            </ResponsiveContainer>
          ) : <div className="small muted">Registrá tu ánimo varios días (y no siempre cumplas todo 😉) para ver correlaciones.</div>}
        </div>

        <div className="card">
          <div className="card-head"><div><h3 className="h3">¿A qué hora?</h3><span className="sub">Cuándo marcás tus hábitos</span></div></div>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={c.hours}>
              <XAxis dataKey="label" tickLine={false} axisLine={false} interval={3} />
              <YAxis hide />
              <Tooltip content={<ChartTooltip />} cursor={{ fill: 'var(--bg-2)' }} />
              <RBar dataKey="count" name="Completados" fill="var(--lav)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
          {(() => {
            const max = c.hours.reduce((m, x) => (x.count > m.count ? x : m), c.hours[0]);
            return max.count ? <div className="small ink2">Tu hora pico es a las <b>{max.hour}:00</b>.</div> : null;
          })()}
        </div>
      </div>
    </div>
  );
}
