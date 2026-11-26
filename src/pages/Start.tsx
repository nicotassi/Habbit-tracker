import { useEffect, useMemo, useState } from 'react';
import { useStore } from '../lib/store';
import { buildDayPlan, greetingFor, type PlanItem } from '../lib/engine';
import { light } from '../lib/coach';
import { prettyDate, todayKey } from '../lib/date';
import { HabitRow } from '../components/HabitRow';
import { MoodLogger } from '../components/MoodLogger';
import { openTimeChooser } from '../components/HabitTimer';
import { Empty, Ring } from '../components/ui';
import { navigate } from '../router';

const MODE_ICON = { recover: '🛌', regain: '🛟', steady: '🎯', push: '🚀', complete: '🏆', closing: '🌙' } as const;

function Reasons({ item }: { item: PlanItem }) {
  if (!item.reasons.length && !item.minimal) return null;
  return (
    <div className="plan-reasons">
      {item.reasons.map((r, i) => <span key={i} className={`reason ${r.tone}`}>{r.icon} {r.text}</span>)}
      {item.minimal && <span className="reason info">🪶 Versión mínima vale</span>}
    </div>
  );
}

/* Inicio: el motor del día. Toma tus hábitos de hoy, tus resultados y los consejos del análisis
   y los convierte en cómo encarar el día: tipo de día, próximo paso, plan priorizado y qué está en juego. */
export function Start() {
  const data = useStore();
  const [minute, setMinute] = useState(0);
  useEffect(() => {
    const i = setInterval(() => setMinute((x) => x + 1), 60000);
    return () => clearInterval(i);
  }, []);
  const today = todayKey();
  const plan = useMemo(() => buildDayPlan(data, today), [data, today, minute]); // eslint-disable-line
  const name = data.settings.name;

  if (!data.habits.some((h) => !h.archived)) {
    return (
      <div>
        <div className="page-head"><div><div className="eyebrow">{prettyDate(today)}</div><h1 className="title">{greetingFor()}{name ? <>, <em>{name}</em></> : ''}.</h1></div></div>
        <div className="card"><Empty emoji="🚀" title="Tu motor arranca con tus hábitos"><p>Creá tus hábitos y acá vas a ver todos los días cómo encarar la jornada: qué hacer primero, por qué y qué está en juego.</p><button className="btn primary" onClick={() => navigate('habits')}>Crear hábitos</button></Empty></div>
      </div>
    );
  }

  const pending = plan.items.filter((i) => !i.done);
  const done = plan.items.filter((i) => i.done);
  const pct = plan.progress.total ? plan.progress.done / plan.progress.total : 0;

  return (
    <div className="start">
      <div className="today-head">
        <div className="grow" style={{ minWidth: 0 }}>
          <div className="eyebrow">{prettyDate(today)}</div>
          <h1 className="title today-title">{greetingFor()}{name ? <>, <em>{name}</em></> : ''}.</h1>
        </div>
      </div>

      {/* tipo de día */}
      <section className={`mode-card ${plan.mode}`}>
        <div className="mode-top">
          <span className="mode-ico" aria-hidden="true">{MODE_ICON[plan.mode]}</span>
          <div className="grow" style={{ minWidth: 0 }}>
            <div className="mode-kicker">Cómo encarar tu día</div>
            <h2 className="mode-title">{plan.title}</h2>
          </div>
          <Ring value={pct} size={54} stroke={5} color="currentColor" track="color-mix(in srgb, currentColor 18%, transparent)">
            <b className="small">{plan.progress.done}/{plan.progress.total}</b>
          </Ring>
        </div>
        <p className="mode-sub">{plan.subtitle}</p>
        <div className="mode-chips">
          {plan.progress.nnTotal > 0 && <span className="mode-chip">🔒 {plan.progress.nnDone}/{plan.progress.nnTotal} no negociables</span>}
          {plan.score !== undefined && <button className={`mode-chip ${light(plan.score)}`} onClick={() => navigate('coach')}>🧭 {Math.round(plan.score)} puntos</button>}
        </div>
        <p className="mode-quote">“{plan.quote[0]}” <span>— {plan.quote[1]}</span></p>
      </section>

      {/* próximo paso */}
      {plan.next && (
        <section className="next-step">
          <div className="ns-kicker">👉 Tu próximo paso</div>
          <HabitRow habit={plan.next.habit} date={today} />
          <Reasons item={plan.next} />
          {plan.next.habit.trackTime && (
            <button className="btn primary ns-go" onClick={() => openTimeChooser(plan.next!.habit.id)}>▶ Empezar ahora</button>
          )}
        </section>
      )}

      {/* chequeo de cómo arrancás */}
      {plan.needsCheckIn && (
        <section className="card checkin">
          <div className="card-head" style={{ marginBottom: 8 }}><h3 className="h3">¿Cómo arrancás hoy?</h3><span className="sub">Así ajusto tu plan</span></div>
          <MoodLogger date={today} compact />
        </section>
      )}

      <div className="start-grid">
        {/* plan priorizado */}
        <section className="col" style={{ gap: 8, minWidth: 0 }}>
          <div className="row between" style={{ flexWrap: 'nowrap' }}>
            <h2 className="h2 section-title">Tu plan de hoy</h2>
            <button className="btn ghost sm" onClick={() => navigate('today')}>Ver Hoy ›</button>
          </div>
          {pending.length === 0 ? (
            <div className="card soft"><p className="small" style={{ margin: 0 }}>🏆 Todo hecho. Si querés sumar algo, elegí un hábito y hacé un extra.</p></div>
          ) : (
            <ol className="plan-list">
              {pending.map((it, n) => (
                <li key={it.habit.id} className={`plan-item tier-${it.tier}`}>
                  <span className="plan-n">{n + 1}</span>
                  <div className="grow" style={{ minWidth: 0 }}>
                    <HabitRow habit={it.habit} date={today} />
                    <Reasons item={it} />
                  </div>
                </li>
              ))}
            </ol>
          )}
          {done.length > 0 && (
            <details className="not-today">
              <summary className="muted small">✓ Hechos hoy ({done.length})</summary>
              <div className="habit-list" style={{ marginTop: 8 }}>{done.map((it) => <HabitRow key={it.habit.id} habit={it.habit} date={today} />)}</div>
            </details>
          )}
        </section>

        <div className="col" style={{ gap: 12, minWidth: 0 }}>
          {plan.stakes.length > 0 && (
            <section className="card">
              <div className="card-head" style={{ marginBottom: 8 }}><h3 className="h3">🎲 Lo que está en juego hoy</h3></div>
              <div className="col" style={{ gap: 8 }}>
                {plan.stakes.map((s, i) => <div key={i} className={`coach-note ${s.tone}`}><span className="cn-ico">{s.icon}</span><div className="small">{s.text}</div></div>)}
              </div>
            </section>
          )}
          {plan.why.length > 0 && (
            <section className="card">
              <div className="card-head" style={{ marginBottom: 8 }}><h3 className="h3">💡 Por qué te conviene</h3><span className="sub">según tus datos</span></div>
              <div className="col" style={{ gap: 8 }}>
                {plan.why.map((s, i) => <div key={i} className="coach-note good"><span className="cn-ico">{s.icon}</span><div><div className="small">{s.text}</div>{s.evidence && <div className="tiny muted">{s.evidence}</div>}</div></div>)}
              </div>
            </section>
          )}
          {plan.tips.length > 0 && (
            <section className="card">
              <div className="card-head" style={{ marginBottom: 8 }}><h3 className="h3">🧭 Consejos de hoy</h3><button className="btn ghost sm" onClick={() => navigate('coach')}>Cómo vas ›</button></div>
              <div className="col" style={{ gap: 8 }}>
                {plan.tips.map((s, i) => <div key={i} className={`coach-note ${s.tone}`}><span className="cn-ico">{s.icon}</span><div className="small">{s.text}</div></div>)}
              </div>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}
