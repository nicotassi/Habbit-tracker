import { useMemo, useState } from 'react';
import { useStore } from '../lib/store';
import { buildDayPlan } from '../lib/engine';
import { adaptSuggestions } from '../lib/adapt';
import { noteForToday, ritualStreak, type RitualPart } from '../lib/rituals';
import { dayStats, levelOf, perfectDayStreak, xpOf } from '../lib/stats';
import { slotFor } from '../lib/schedule';
import { addDays, prettyDate, todayKey } from '../lib/date';
import { MOODS } from '../components/MoodLogger';
import { HabitRow } from '../components/HabitRow';
import { AdaptCard } from '../components/AdaptCard';
import { WatchImport } from '../components/WatchImport';
import { openTimeChooser } from '../components/HabitTimer';
import { confetti, toast } from '../components/ui';
import { navigate } from '../router';

const ENERGY = [1, 2, 3, 4, 5];

function Steps({ n, of }: { n: number; of: number }) {
  return <div className="rit-steps" aria-label={`Paso ${n + 1} de ${of}`}>{Array.from({ length: of }, (_, i) => <span key={i} className={i <= n ? 'on' : ''} />)}</div>;
}

function MoodPick({ date }: { date: string }) {
  const mood = useStore((s) => s.moods[date]);
  const watch = useStore((s) => s.watch[date]);
  const setMood = useStore((s) => s.setMood);
  return (
    <div className="col" style={{ gap: 16 }}>
      <div className="mood-scale">
        {MOODS.map((m) => (
          <button key={m.v} className={`mood-btn ${mood?.mood === m.v ? 'on' : ''}`} onClick={() => setMood(date, { mood: m.v })}>
            <span className="face">{m.face}</span><span>{m.label}</span>
          </button>
        ))}
      </div>
      <div className="field">
        <span className="label">⚡ Energía</span>
        <div className="rit-scale">
          {ENERGY.map((v) => <button key={v} className={`chip ${mood?.energy === v && mood ? 'on' : ''}`} onClick={() => setMood(date, { energy: v })}>{'⚡'.repeat(v)}</button>)}
        </div>
      </div>
      <div className="field">
        <span className="label">😴 Horas de sueño {watch?.sleepHours ? <span className="tiny muted">· tu reloj dice {watch.sleepHours.toFixed(1)} h</span> : null}</span>
        <div className="row">
          <input className="slider" type="range" min={0} max={12} step={0.5} value={mood?.sleep ?? watch?.sleepHours ?? 7} onChange={(e) => setMood(date, { sleep: Number(e.target.value) })} />
          <b style={{ minWidth: 40 }}>{mood?.sleep ?? '–'} h</b>
        </div>
      </div>
    </div>
  );
}

/* Arranque y cierre del día: tres pasos cortos cada uno. */
export function Ritual({ part }: { part: RitualPart }) {
  return part === 'evening' ? <Evening /> : <Morning />;
}

function Morning() {
  const data = useStore();
  const setRitual = useStore((s) => s.setRitual);
  const today = todayKey();
  const [step, setStep] = useState(0);
  const [intention, setIntention] = useState(data.rituals?.[today]?.morning?.intention ?? '');
  const plan = useMemo(() => buildDayPlan(data, today), [data, today]);
  const pending = plan.items.filter((i) => !i.done && i.habit.kind !== 'avoid');
  const [focusId, setFocusId] = useState<string | undefined>(data.rituals?.[today]?.morning?.focusId);
  const focus = pending.find((i) => i.habit.id === (focusId ?? plan.next?.habit.id)) ?? plan.next;
  const adapt = useMemo(() => adaptSuggestions(data, today)[0], [data, today]);
  const lastNight = noteForToday(data, today);
  const streak = ritualStreak(data, 'morning', today);
  const finish = () => {
    setRitual(today, 'morning', { at: Date.now(), intention: intention.trim() || undefined, focusId: focus?.habit.id });
    if (data.settings.confetti) confetti(window.innerWidth / 2, window.innerHeight / 3, 70);
    toast(streak + 1 > 1 ? `Arranque hecho · ${streak + 1} días seguidos` : 'Arranque hecho. ¡A por el día!', '☀️');
    if (focus?.habit.trackTime) openTimeChooser(focus.habit.id);
    navigate('inicio');
  };

  return (
    <div className="ritual morning">
      <div className="rit-head">
        <button className="btn ghost sm" onClick={() => navigate('inicio')}>✕ Cerrar</button>
        <Steps n={step} of={3} />
        <span className="tiny muted">☀️ Arranque</span>
      </div>

      {step === 0 && (
        <section className="rit-body">
          <div className="eyebrow">{prettyDate(today)}</div>
          <h1 className="title rit-title">¿Cómo <em>amaneciste</em>?</h1>
          <p className="muted small">Con esto ajusto tu plan: si dormiste poco o tenés poca energía, el día se arma más liviano.</p>
          <MoodPick date={today} />
          <button className="btn primary rit-next" onClick={() => setStep(1)}>Siguiente</button>
        </section>
      )}

      {step === 1 && (
        <section className="rit-body">
          <div className="eyebrow">Tu día</div>
          <h1 className="title rit-title">{plan.title}</h1>
          <p className="small">{plan.subtitle}</p>
          {lastNight && <div className="coach-note info"><span className="cn-ico">📝</span><div className="small">Anoche te anotaste: <b>{lastNight}</b></div></div>}
          {pending.length > 0 ? (
            <>
              <span className="label" style={{ marginTop: 6 }}>🎯 Elegí tu foco de hoy (lo que, si lo hacés, hace que el día valga)</span>
              <div className="col" style={{ gap: 6 }}>
                {pending.slice(0, 5).map((i) => (
                  <button key={i.habit.id} className={`rit-option ${focus?.habit.id === i.habit.id ? 'on' : ''}`} onClick={() => setFocusId(i.habit.id)}>
                    <span className="rit-emoji">{i.habit.emoji}</span>
                    <span className="grow">
                      <b>{i.habit.name}</b>
                      <span className="tiny muted">{[i.habit.nonNegotiable ? '🔒 No negociable' : '', slotFor(i.habit, today)?.start ?? '', i.reasons.find((r) => r.icon !== '🔒')?.text ?? ''].filter(Boolean).join(' · ')}</span>
                    </span>
                    <span className="rit-radio" />
                  </button>
                ))}
              </div>
            </>
          ) : <div className="card soft small">🏆 Ya hiciste todo lo de hoy.</div>}
          <div className="field">
            <span className="label">✍️ Hoy quiero… (opcional)</span>
            <input className="input" value={intention} onChange={(e) => setIntention(e.target.value)} placeholder="Ej.: estar presente con mi familia" maxLength={120} />
          </div>
          <div className="row" style={{ gap: 8 }}>
            <button className="btn" onClick={() => setStep(0)}>Atrás</button>
            <button className="btn primary grow" onClick={() => setStep(2)}>Siguiente</button>
          </div>
        </section>
      )}

      {step === 2 && (
        <section className="rit-body">
          <div className="eyebrow">Listo para arrancar</div>
          <h1 className="title rit-title">Tu día en <em>una línea</em></h1>
          <div className="rit-summary">
            {focus && <div><span>🎯 Foco</span><b>{focus.habit.emoji} {focus.habit.name}</b></div>}
            {plan.progress.nnTotal > 0 && <div><span>🔒 No negociables</span><b>{plan.items.filter((i) => i.habit.nonNegotiable).map((i) => i.habit.name).join(', ')}</b></div>}
            <div><span>📋 Hábitos de hoy</span><b>{plan.progress.total}</b></div>
            {intention.trim() && <div><span>✍️ Intención</span><b>{intention.trim()}</b></div>}
          </div>
          {adapt && <AdaptCard s={adapt} compact />}
          <p className="small muted">“{plan.quote[0]}” — {plan.quote[1]}</p>
          <div className="row" style={{ gap: 8 }}>
            <button className="btn" onClick={() => setStep(1)}>Atrás</button>
            <button className="btn primary grow rit-go" onClick={finish}>{focus?.habit.trackTime ? `▶ Arrancar con ${focus.habit.name}` : '☀️ Arrancar el día'}</button>
          </div>
        </section>
      )}
    </div>
  );
}

function Evening() {
  const data = useStore();
  const setRitual = useStore((s) => s.setRitual);
  const setMood = useStore((s) => s.setMood);
  const today = todayKey();
  const tomorrow = addDays(today, 1);
  const [step, setStep] = useState(0);
  const prev = data.rituals?.[today]?.evening;
  const [win, setWin] = useState(prev?.win ?? '');
  const [next, setNext] = useState(prev?.tomorrow ?? '');
  const [watchOpen, setWatchOpen] = useState(false);
  const plan = useMemo(() => buildDayPlan(data, today), [data, today]);
  const tPlan = useMemo(() => buildDayPlan(data, tomorrow), [data, tomorrow]);
  const pending = plan.items.filter((i) => !i.done);
  const stats = dayStats(data, today);
  const streak = ritualStreak(data, 'evening', today);
  const pd = perfectDayStreak(data);
  const lv = levelOf(xpOf(data));
  const firstTomorrow = [...tPlan.items].filter((i) => slotFor(i.habit, tomorrow)).sort((a, b) => slotFor(a.habit, tomorrow)!.start.localeCompare(slotFor(b.habit, tomorrow)!.start))[0];
  const tNN = tPlan.items.filter((i) => i.habit.nonNegotiable);
  const focusId = data.rituals?.[today]?.morning?.focusId;
  const focus = focusId ? plan.items.find((i) => i.habit.id === focusId) : undefined;

  const finish = () => {
    const w = win.trim();
    setRitual(today, 'evening', { at: Date.now(), win: w || undefined, tomorrow: next.trim() || undefined });
    if (w) {
      const m = data.moods[today];
      const line = `🌙 Lo mejor del día: ${w}`;
      if (!m?.note?.includes(line)) setMood(today, { note: m?.note ? `${m.note}\n${line}` : line });
    }
    if (data.settings.confetti) confetti(window.innerWidth / 2, window.innerHeight / 3, 70);
    toast(streak + 1 > 1 ? `Día cerrado · ${streak + 1} cierres seguidos` : 'Día cerrado. A descansar', '🌙');
    navigate('inicio');
  };

  return (
    <div className="ritual evening">
      <div className="rit-head">
        <button className="btn ghost sm" onClick={() => navigate('inicio')}>✕ Cerrar</button>
        <Steps n={step} of={3} />
        <span className="tiny muted">🌙 Cierre</span>
      </div>

      {step === 0 && (
        <section className="rit-body">
          <div className="eyebrow">{prettyDate(today)}</div>
          <h1 className="title rit-title">Lo que <em>quedó</em></h1>
          {pending.length ? (
            <>
              <p className="muted small">Marcá lo que hiciste y no cargaste. Si algo no se pudo, salteálo desde ⋯ (no rompe la racha si fue justificado).</p>
              <div className="habit-list">{pending.map((i) => <HabitRow key={i.habit.id} habit={i.habit} date={today} />)}</div>
            </>
          ) : (
            <div className="card soft"><p className="small" style={{ margin: 0 }}>🏆 Hiciste todo lo de hoy. ¡Día completo!</p></div>
          )}
          <div className="rit-progress"><b>{stats.done}/{stats.total}</b> hábitos hechos{focus ? <> · 🎯 tu foco ({focus.habit.name}) {focus.done ? 'cumplido ✓' : 'quedó pendiente'}</> : null}</div>
          <button className="btn primary rit-next" onClick={() => setStep(1)}>Siguiente</button>
        </section>
      )}

      {step === 1 && (
        <section className="rit-body">
          <div className="eyebrow">Cómo estuviste</div>
          <h1 className="title rit-title">¿Cómo fue tu <em>día</em>?</h1>
          <MoodPick date={today} />
          <div className="field">
            <span className="label">✨ Lo mejor del día (opcional)</span>
            <input className="input" value={win} onChange={(e) => setWin(e.target.value)} placeholder="Una cosa, aunque sea chica" maxLength={160} />
          </div>
          <button className="btn sm" style={{ alignSelf: 'flex-start' }} onClick={() => setWatchOpen(true)}>⌚ Cargar captura del reloj</button>
          <div className="row" style={{ gap: 8 }}>
            <button className="btn" onClick={() => setStep(0)}>Atrás</button>
            <button className="btn primary grow" onClick={() => setStep(2)}>Siguiente</button>
          </div>
          <WatchImport open={watchOpen} onClose={() => setWatchOpen(false)} date={today} />
        </section>
      )}

      {step === 2 && (
        <section className="rit-body">
          <div className="eyebrow">Mañana</div>
          <h1 className="title rit-title">Cómo viene <em>mañana</em></h1>
          <div className="rit-summary">
            <div><span>📋 Hoy</span><b>{stats.done} de {stats.total}{stats.total && stats.done === stats.total ? ' · día perfecto ⭐' : ''}</b></div>
            {pd.current > 1 && <div><span>⭐ Días perfectos seguidos</span><b>{pd.current}</b></div>}
            <div><span>🆙 Nivel</span><b>{lv.level} · faltan {lv.toNext} XP</b></div>
            {firstTomorrow && <div><span>🕐 Mañana arrancás con</span><b>{firstTomorrow.habit.emoji} {firstTomorrow.habit.name} a las {slotFor(firstTomorrow.habit, tomorrow)!.start}</b></div>}
            {tNN.length > 0 && <div><span>🔒 No negociables de mañana</span><b>{tNN.map((i) => i.habit.name).join(', ')}</b></div>}
            <div><span>📋 Hábitos de mañana</span><b>{tPlan.items.length}</b></div>
          </div>
          <div className="field">
            <span className="label">📝 Una cosa para mañana (te la recuerdo al arrancar)</span>
            <input className="input" value={next} onChange={(e) => setNext(e.target.value)} placeholder="Ej.: dejar la ropa de entrenar lista" maxLength={140} />
          </div>
          <div className="row" style={{ gap: 8 }}>
            <button className="btn" onClick={() => setStep(1)}>Atrás</button>
            <button className="btn primary grow rit-go" onClick={finish}>🌙 Cerrar el día</button>
          </div>
        </section>
      )}
    </div>
  );
}
