import { useMemo, useState } from 'react';
import { useStore } from '../lib/store';
import { AREAS, dailyReport, light, weeklyReport, type Area, type Note } from '../lib/coach';
import { activeHabits } from '../lib/stats';
import { shortDate, todayKey } from '../lib/date';
import { CountUp, Empty, Ring, Seg } from '../components/ui';
import { navigate } from '../router';
import { ForecastCard } from '../components/Forecast';
import { AdaptCard } from '../components/AdaptCard';
import { adaptSuggestions } from '../lib/adapt';

const TONE_COLOR = { good: 'var(--good)', warn: 'var(--warn)', bad: 'var(--bad)', none: 'var(--line-2)' } as const;

function NoteList({ notes, empty }: { notes: Note[]; empty?: string }) {
  if (!notes.length) return empty ? <p className="small muted" style={{ margin: 0 }}>{empty}</p> : null;
  return (
    <div className="col" style={{ gap: 8 }}>
      {notes.map((n, i) => (
        <div key={i} className={`coach-note ${n.tone}`}>
          <span className="cn-ico">{n.icon}</span>
          <div>
            <div className="small">{n.text}</div>
            {n.evidence && <div className="tiny muted" style={{ marginTop: 2 }}>{n.evidence}</div>}
          </div>
        </div>
      ))}
    </div>
  );
}

function AreaTile({ area, value, normal }: { area: Area; value?: number; normal?: number }) {
  const meta = AREAS.find((a) => a.key === area)!;
  const l = light(value);
  const delta = value !== undefined && normal !== undefined ? value - normal : undefined;
  return (
    <div className={`area-tile ${l}`}>
      <div className="area-head">
        <span className="small">{meta.icon} {meta.label}</span>
        <span className="area-dot" style={{ background: TONE_COLOR[l] }} />
      </div>
      <div className="area-num">{value === undefined ? '–' : <CountUp value={Math.round(value)} />}</div>
      <div className="tiny muted">
        {value === undefined ? 'Sin datos todavía' : delta === undefined ? 'Calculando tu normal…' : Math.abs(delta) < 3 ? 'Igual que tu normal' : (
          <span className={delta > 0 ? 'delta-up' : 'delta-down'}>{delta > 0 ? '▲' : '▼'} {Math.round(Math.abs(delta))} vs tu normal</span>
        )}
      </div>
    </div>
  );
}

export function Coach() {
  const data = useStore();
  const [tab, setTab] = useState<'today' | 'week'>(() => (new Date().getDay() === 0 || new Date().getDay() === 1 ? 'week' : 'today'));
  const today = todayKey();
  const r = useMemo(() => dailyReport(data, today), [data, today]);
  const w = useMemo(() => weeklyReport(data, today), [data, today]);
  const adapts = useMemo(() => adaptSuggestions(data, today), [data, today]);

  if (!activeHabits(data).length && !Object.keys(data.moods).length) {
    return (
      <div>
        <div className="page-head"><div><div className="eyebrow">Tu análisis</div><h1 className="title">Cómo <em>vas</em></h1></div></div>
        <div className="card"><Empty emoji="🧭" title="Todavía no hay datos"><p>Cargá hábitos, ánimo o capturas del reloj y acá vas a ver tu informe.</p></Empty></div>
      </div>
    );
  }

  return (
    <div>
      <div className="page-head">
        <div><div className="eyebrow">Tu análisis · sin IA, en tu dispositivo</div><h1 className="title">Cómo <em>vas</em></h1></div>
        <Seg value={tab} onChange={setTab} options={[{ v: 'today', l: 'Hoy' }, { v: 'week', l: 'Tu semana' }]} />
      </div>

      {!r.enoughData && (
        <div className="past-banner" style={{ marginBottom: 16 }}>
          <span>🌱 Llevás {r.daysWithData} {r.daysWithData === 1 ? 'día' : 'días'} con datos. Con 2 o 3 semanas el análisis se vuelve mucho más preciso.</span>
        </div>
      )}

      {adapts.length > 0 && (
        <div className="card" style={{ marginBottom: 16 }}>
          <div className="card-head"><div><h3 className="h3">🎚️ Metas a ajustar</h3><span className="sub">Para que cada meta sea un desafío posible</span></div></div>
          <div className="grid g2">{adapts.map((a) => <AdaptCard key={a.habit.id} s={a} />)}</div>
        </div>
      )}

      {tab === 'today' ? (
        <>
          <div className="hero coach-hero" style={{ marginBottom: 16 }}>
            <div className="row" style={{ gap: 24, flexWrap: 'wrap', position: 'relative', zIndex: 1 }}>
              <Ring value={(r.overall ?? 0) / 100} size={124} stroke={10} color="#f3b378" track="rgba(255,255,255,.12)">
                <div className="serif" style={{ fontSize: 44, lineHeight: 1 }}>{r.overall === undefined ? '–' : <CountUp value={Math.round(r.overall)} />}</div>
                <div className="tiny" style={{ opacity: .6 }}>de 100</div>
              </Ring>
              <div className="grow" style={{ minWidth: 200 }}>
                <div className="muted small">Tu puntaje ahora</div>
                <div className="serif coach-headline">{r.headline}</div>
                {r.summary && <div className="small" style={{ opacity: .8, marginTop: 6 }}>{r.summary}</div>}
              </div>
            </div>
          </div>

          <div className="grid g4" style={{ marginBottom: 16 }}>
            {AREAS.map((a) => <AreaTile key={a.key} area={a.key} value={r.areas[a.key]} normal={r.normal[a.key]} />)}
          </div>

          <div className="grid g2">
            <div className="card">
              <div className="card-head"><div><h3 className="h3">🧭 Qué hacer hoy</h3><span className="sub">Según cómo dormiste, tu estrés y tus hábitos</span></div></div>
              <NoteList notes={r.recommendations} empty="Nada urgente: seguí con tu rutina." />
            </div>
            <div className="card">
              <div className="card-head"><div><h3 className="h3">🔎 Lo que veo</h3><span className="sub">Tus datos más recientes comparados con tu normal</span></div></div>
              <NoteList notes={r.today} empty="Nada fuera de lo común en tus últimos datos. Cargá ánimo o una captura del reloj para comparar." />
            </div>
            <div className="card">
              <div className="card-head"><div><h3 className="h3">📈 Tendencias</h3><span className="sub">Últimas 2 semanas</span></div></div>
              <NoteList notes={r.trends} empty="Sin cambios fuertes en las últimas 2 semanas." />
            </div>
            <ForecastCard />
            <div className="card">
              <div className="card-head"><div><h3 className="h3">✨ Patrones que encontré</h3><span className="sub">Qué pasa los días que hacés cada hábito</span></div></div>
              <NoteList notes={r.patterns} empty="Necesito más días con hábitos y datos de ánimo o del reloj para encontrar patrones." />
              {r.patterns.length > 0 && <p className="tiny muted" style={{ margin: '10px 0 0' }}>Son patrones en tus datos, no causas seguras: otras cosas pueden influir.</p>}
            </div>
          </div>
        </>
      ) : (
        <>
          <div className="hero coach-hero" style={{ marginBottom: 16 }}>
            <div className="row" style={{ gap: 24, flexWrap: 'wrap', position: 'relative', zIndex: 1 }}>
              <Ring value={(w.overall ?? 0) / 100} size={124} stroke={10} color="#f3b378" track="rgba(255,255,255,.12)">
                <div className="serif" style={{ fontSize: 44, lineHeight: 1 }}>{w.overall === undefined ? '–' : <CountUp value={Math.round(w.overall)} />}</div>
                <div className="tiny" style={{ opacity: .6 }}>de 100</div>
              </Ring>
              <div className="grow" style={{ minWidth: 200 }}>
                <div className="muted small">Semana del {shortDate(w.from)} al {shortDate(w.to)}</div>
                <div className="serif coach-headline">
                  {w.overall === undefined ? 'Semana sin datos' : w.prevOverall === undefined ? 'Tu primera semana medida' : w.overall - w.prevOverall >= 3 ? 'Mejor que la semana anterior' : w.prevOverall - w.overall >= 3 ? 'Un poco por debajo de la anterior' : 'Pareja con la semana anterior'}
                </div>
                {w.prevOverall !== undefined && w.overall !== undefined && <div className="small" style={{ opacity: .8, marginTop: 6 }}>{Math.round(w.prevOverall)} → {Math.round(w.overall)} puntos · {w.perfectDays} {w.perfectDays === 1 ? 'día perfecto' : 'días perfectos'}</div>}
              </div>
            </div>
          </div>
          <div className="grid g4" style={{ marginBottom: 16 }}>
            {AREAS.map((a) => <AreaTile key={a.key} area={a.key} value={w.areas[a.key]} normal={w.prev[a.key]} />)}
          </div>
          <div className="grid g3">
            <div className="card">
              <div className="card-head"><h3 className="h3">🏆 Lo que salió bien</h3></div>
              <NoteList notes={w.wins} empty="Esta semana no hubo hitos destacados. La próxima va a ser mejor." />
            </div>
            <div className="card">
              <div className="card-head"><h3 className="h3">🔧 Para mejorar</h3></div>
              <NoteList notes={w.improve} empty="Nada importante para corregir. ¡Muy bien!" />
            </div>
            <div className="card">
              <div className="card-head"><h3 className="h3">🎯 Para esta semana</h3></div>
              {w.suggestion && <NoteList notes={[w.suggestion]} />}
            </div>
          </div>
        </>
      )}
      <p className="tiny muted" style={{ marginTop: 16 }}>
        Cómo se calcula: cada área va de 0 a 100. Constancia = hábitos cumplidos (últimos 7 días). Descanso = horas y puntaje de sueño.
        Movimiento = pasos y hábitos de ejercicio. Mente = ánimo, estrés y energía. “Tu normal” es tu propio promedio de las 4 semanas anteriores.
      </p>
    </div>
  );
}

/** Resumen corto para la pantalla Hoy. */
export function CoachBrief() {
  const data = useStore();
  const today = todayKey();
  const r = useMemo(() => dailyReport(data, today), [data, today]);
  if (r.overall === undefined) return null;
  const tip = r.recommendations[0] ?? r.today[0] ?? r.patterns[0];
  return (
    <button className="card coach-brief" onClick={() => navigate('coach')}>
      <Ring value={r.overall / 100} size={64} stroke={6} color={TONE_COLOR[light(r.overall)]}>
        <b><CountUp value={Math.round(r.overall)} /></b>
      </Ring>
      <div className="grow" style={{ minWidth: 0 }}>
        <div className="eyebrow">🧭 Cómo vas</div>
        <div style={{ fontWeight: 600 }}>{r.headline}</div>
        {tip && <div className="small ink2 coach-tip">{tip.icon} {tip.text}</div>}
      </div>
      <span className="muted" aria-hidden="true">›</span>
    </button>
  );
}
