import { useMemo, useState } from 'react';
import { Bar as RBar, BarChart, CartesianGrid, Cell, ComposedChart, Line, ResponsiveContainer, Scatter, ScatterChart, Tooltip, XAxis, YAxis, ZAxis } from 'recharts';
import { useStore } from '../lib/store';
import { scrollToTop } from '../router';
import { emotionFrequency, mean, pearson, rollingAvg, tagFrequency } from '../lib/stats';
import { addDays, MONTHS, MONTHS_SHORT, prettyDate, range, shortDate, todayKey } from '../lib/date';
import { MoodLogger, moodColor, moodFace } from '../components/MoodLogger';
import { ChartTooltip, DateNav, Empty, Seg, Stat } from '../components/ui';

export function Mood() {
  const { moods, deleteMood } = useStore();
  const [date, setDate] = useState(todayKey());
  const [span, setSpan] = useState<30 | 90 | 365>(30);
  const [search, setSearch] = useState('');
  const [shown, setShown] = useState(12);
  const today = todayKey();

  const c = useMemo(() => {
    const days = range(addDays(today, -(span - 1)), today);
    const rows = days.map((d) => ({ date: d, label: shortDate(d), mood: moods[d]?.mood ?? null, energy: moods[d]?.energy ?? null, stress: moods[d]?.stress ?? null }));
    const rm = rollingAvg(rows, 'mood', 7);
    const series = rows.map((r, i) => ({ ...r, moodAvg: rm[i] }));
    const entries = days.map((d) => moods[d]).filter(Boolean);
    const sleep = entries.filter((m) => typeof m.sleep === 'number').map((m) => ({ sleep: m.sleep!, mood: m.mood, z: 1 }));
    const dist = [1, 2, 3, 4, 5].map((v) => ({ v, face: moodFace(v), count: entries.filter((m) => m.mood === v).length }));
    return {
      series,
      entries,
      avg: mean(entries.map((m) => m.mood)),
      energy: mean(entries.map((m) => m.energy)),
      stress: mean(entries.map((m) => m.stress)),
      sleepAvg: mean(sleep.map((s) => s.sleep)),
      sleep,
      corr: pearson(sleep.map((s) => s.sleep), sleep.map((s) => s.mood)),
      dist,
      emotions: emotionFrequency({ moods } as never, days).slice(0, 10),
      tags: tagFrequency({ moods } as never, days).slice(0, 10),
    };
  }, [moods, span, today]);

  const year = new Date().getFullYear();
  const journal = Object.values(moods)
    .filter((m) => m.note || m.gratitude.length)
    .filter((m) => !search || (m.note + ' ' + m.gratitude.join(' ') + ' ' + m.tags.join(' ')).toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => (a.date < b.date ? 1 : -1))
    ;

  return (
    <div>
      <div className="page-head">
        <div><div className="eyebrow">Ánimo & diario</div><h1 className="title">Cómo te <em>sentís</em></h1></div>
        <Seg value={span} onChange={setSpan} options={[{ v: 30, l: '30 días' }, { v: 90, l: '3 meses' }, { v: 365, l: '1 año' }]} />
      </div>

      <div className="grid g3" style={{ marginBottom: 16 }}>
        <div className="card span2">
          <div className="card-head">
            <div><h3 className="h3">Registro de {prettyDate(date)}</h3><span className="sub">Elegí cómo estás y sumá contexto</span></div>
            <div className="row">
              <DateNav date={date} onChange={setDate} max={today} />
              {moods[date] && <button className="btn ghost sm danger" onClick={() => deleteMood(date)}>Borrar</button>}
            </div>
          </div>
          <MoodLogger date={date} />
        </div>
        <div className="col" style={{ gap: 16 }}>
          <div className="card grid g2" style={{ gap: 18 }}>
            <Stat k="Ánimo" v={c.entries.length ? c.avg.toFixed(1) : '–'} unit="/5" />
            <Stat k="Energía" v={c.entries.length ? c.energy.toFixed(1) : '–'} unit="/5" />
            <Stat k="Estrés" v={c.entries.length ? c.stress.toFixed(1) : '–'} unit="/5" />
            <Stat k="Sueño" v={c.sleep.length ? c.sleepAvg.toFixed(1) : '–'} unit="h" />
          </div>
          <div className="card">
            <div className="card-head"><h3 className="h3">Distribución</h3><span className="sub">{c.entries.length} registros</span></div>
            <div className="col" style={{ gap: 8 }}>
              {c.dist.slice().reverse().map((d) => (
                <div key={d.v} className="row">
                  <span style={{ fontSize: 20 }}>{d.face}</span>
                  <div className="grow bar"><div style={{ width: `${c.entries.length ? (d.count / c.entries.length) * 100 : 0}%`, background: moodColor(d.v) }} /></div>
                  <span className="small" style={{ width: 28, textAlign: 'right' }}>{d.count}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {c.entries.length === 0 ? (
        <div className="card"><Empty emoji="🫶" title="Registrá tu primer ánimo">Con unos días de datos vas a ver tendencias, correlaciones y tu año en píxeles.</Empty></div>
      ) : (
        <div className="grid g3">
          <div className="card span3">
            <div className="card-head"><div><h3 className="h3">Tendencia</h3><span className="sub">Ánimo, energía y estrés · línea gruesa = media 7 días</span></div></div>
            <ResponsiveContainer width="100%" height={260}>
              <ComposedChart data={c.series}>
                <CartesianGrid vertical={false} strokeDasharray="3 3" />
                <XAxis dataKey="label" tickLine={false} axisLine={false} minTickGap={24} />
                <YAxis domain={[1, 5]} ticks={[1, 2, 3, 4, 5]} tickLine={false} axisLine={false} width={24} />
                <Tooltip content={<ChartTooltip />} />
                <Line dataKey="energy" name="Energía" stroke="#c9a227" strokeWidth={1.5} dot={false} connectNulls type="monotone" strokeOpacity={0.7} />
                <Line dataKey="stress" name="Estrés" stroke="#d4574a" strokeWidth={1.5} dot={false} connectNulls type="monotone" strokeOpacity={0.7} strokeDasharray="4 3" />
                <Scatter dataKey="mood" name="Ánimo" fill="var(--lav)" fillOpacity={0.5} shape={(pr: { cx?: number; cy?: number }) => (pr.cx == null || pr.cy == null ? <g /> : <circle cx={pr.cx} cy={pr.cy} r={3} fill="var(--lav)" fillOpacity={0.5} />)} />
                <Line dataKey="moodAvg" name="Ánimo (7d)" stroke="var(--lav)" strokeWidth={3} dot={false} connectNulls type="monotone" />
              </ComposedChart>
            </ResponsiveContainer>
          </div>

          <div className="card span3">
            <div className="card-head"><div><h3 className="h3">Tu {year} en píxeles</h3><span className="sub">Cada día, coloreado por ánimo</span></div>
              <div className="legend">{[1, 2, 3, 4, 5].map((v) => <span key={v} className="sw" style={{ background: moodColor(v) }} />)}</div>
            </div>
            <YearInPixels year={year} onPick={setDate} />
          </div>

          <div className="card">
            <div className="card-head"><div><h3 className="h3">Sueño vs ánimo</h3><span className="sub">Correlación: {c.corr.toFixed(2)}</span></div></div>
            {c.sleep.length >= 3 ? (
              <ResponsiveContainer width="100%" height={220}>
                <ScatterChart>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis type="number" dataKey="sleep" name="Sueño" unit="h" domain={['dataMin - 0.5', 'dataMax + 0.5']} tickLine={false} axisLine={false} />
                  <YAxis type="number" dataKey="mood" name="Ánimo" domain={[1, 5]} ticks={[1, 2, 3, 4, 5]} tickLine={false} axisLine={false} width={24} />
                  <ZAxis dataKey="z" range={[60, 60]} />
                  <Tooltip cursor={{ strokeDasharray: '3 3' }} />
                  <Scatter data={c.sleep} fill="var(--lav)" fillOpacity={0.45} />
                </ScatterChart>
              </ResponsiveContainer>
            ) : <div className="small muted">Registrá tus horas de sueño para ver la relación.</div>}
            <div className="small ink2">{c.corr > 0.3 ? 'Dormir más se asocia claramente con mejor ánimo.' : c.corr < -0.3 ? 'Curioso: más sueño, menos ánimo.' : 'Relación débil por ahora.'}</div>
          </div>

          <div className="card">
            <div className="card-head"><h3 className="h3">Emociones frecuentes</h3></div>
            {c.emotions.length ? (
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={c.emotions} layout="vertical">
                  <XAxis type="number" hide />
                  <YAxis type="category" dataKey="name" width={90} tickLine={false} axisLine={false} tick={{ fontSize: 12.5, fill: 'var(--ink-2)' }} />
                  <Tooltip content={<ChartTooltip />} cursor={{ fill: 'var(--bg-2)' }} />
                  <RBar dataKey="count" name="Veces" fill="var(--lav)" radius={6} />
                </BarChart>
              </ResponsiveContainer>
            ) : <div className="small muted">Marcá emociones en tus registros.</div>}
          </div>

          <div className="card">
            <div className="card-head"><div><h3 className="h3">Contextos</h3><span className="sub">Ánimo promedio por etiqueta</span></div></div>
            {c.tags.length ? (
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={c.tags.map((t) => ({ ...t, mood: Math.round(t.mood * 10) / 10 }))} layout="vertical">
                  <XAxis type="number" domain={[0, 5]} hide />
                  <YAxis type="category" dataKey="name" width={90} tickLine={false} axisLine={false} tick={{ fontSize: 12.5, fill: 'var(--ink-2)' }} />
                  <Tooltip content={<ChartTooltip fmt={(v) => `${v}/5`} />} cursor={{ fill: 'var(--bg-2)' }} />
                  <RBar dataKey="mood" name="Ánimo" radius={6}>
                    {c.tags.map((t, i) => <Cell key={i} fill={moodColor(t.mood)} />)}
                  </RBar>
                </BarChart>
              </ResponsiveContainer>
            ) : <div className="small muted">Usá etiquetas como #trabajo o #familia.</div>}
          </div>
        </div>
      )}

      <div className="card" style={{ marginTop: 16 }}>
        <div className="card-head">
          <div><h3 className="h3">Diario</h3><span className="sub">Tus notas y gratitudes</span></div>
          <input className="input" style={{ maxWidth: 240 }} placeholder="Buscar en el diario…" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        {journal.length ? (
          <div className="col" style={{ gap: 0 }}>
            {journal.slice(0, shown).map((m) => (
              <div key={m.date} style={{ padding: '14px 0', borderBottom: '1px solid var(--line)', cursor: 'pointer' }} onClick={() => { setDate(m.date); scrollToTop(); }}>
                <div className="row"><span style={{ fontSize: 22 }}>{moodFace(m.mood)}</span><b>{prettyDate(m.date)}</b>
                  <span className="row wrap" style={{ gap: 4 }}>{m.tags.map((t) => <span key={t} className="badge">#{t}</span>)}</span></div>
                {m.note && <div className="ink2" style={{ marginTop: 6, whiteSpace: 'pre-wrap' }}>{m.note}</div>}
                {m.gratitude.length > 0 && <div className="small muted" style={{ marginTop: 4 }}>🙏 {m.gratitude.join(' · ')}</div>}
              </div>
            ))}
            {journal.length > shown && <button className="btn sm" style={{ alignSelf: 'center', marginTop: 12 }} onClick={() => setShown((n) => n + 20)}>Ver más ({journal.length - shown})</button>}
          </div>
        ) : <div className="small muted">Todavía no escribiste en el diario.</div>}
      </div>
    </div>
  );
}

function YearInPixels({ year, onPick }: { year: number; onPick: (d: string) => void }) {
  const moods = useStore((s) => s.moods);
  const today = todayKey();
  return (
    <div style={{ overflowX: 'auto' }}>
      <div style={{ display: 'grid', gridTemplateColumns: '34px repeat(31, minmax(12px, 1fr))', gap: 3, minWidth: 520 }}>
        <div />
        {Array.from({ length: 31 }, (_, i) => <div key={i} className="tiny muted" style={{ textAlign: 'center' }}>{i % 5 === 0 ? i + 1 : ''}</div>)}
        {MONTHS.map((_, m) => (
          <Row key={m} m={m} year={year} moods={moods} today={today} onPick={onPick} />
        ))}
      </div>
    </div>
  );
}

function Row({ m, year, moods, today, onPick }: { m: number; year: number; moods: Record<string, { mood: number }>; today: string; onPick: (d: string) => void }) {
  const days = new Date(year, m + 1, 0).getDate();
  return (
    <>
      <div className="tiny muted" style={{ alignSelf: 'center' }}>{MONTHS_SHORT[m]}</div>
      {Array.from({ length: 31 }, (_, i) => {
        if (i >= days) return <div key={i} />;
        const k = `${year}-${String(m + 1).padStart(2, '0')}-${String(i + 1).padStart(2, '0')}`;
        const mood = moods[k]?.mood;
        return (
          <div key={i} title={`${shortDate(k)}${mood ? ' ' + moodFace(mood) : ''}`} onClick={() => k <= today && onPick(k)}
            style={{ aspectRatio: '1', borderRadius: 3, background: mood ? moodColor(mood) : 'var(--bg-2)', opacity: k > today ? 0.35 : 1, cursor: 'pointer', outline: k === today ? '1.5px solid var(--ink)' : undefined }} />
        );
      })}
    </>
  );
}

