import { useEffect, useState } from 'react';
import { Bar as RBar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useStore } from '../lib/store';
import { activeHabits } from '../lib/stats';
import { lastNDays, shortDate, todayKey } from '../lib/date';
import { finishNow, PHASE_LABEL, phaseMinutes, pomodorosOn, secondsLeft, useTimer, type Phase } from '../lib/timer';
import { ChartTooltip, Ring, Seg, Stat } from '../components/ui';

const FREE_PRESETS = [15, 25, 45, 60, 90];
const fmt = (s: number) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;

export function useNow(active: boolean) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (!active) return;
    const i = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(i);
  }, [active]);
  return now;
}

export function Focus({ habitId }: { habitId?: string }) {
  const data = useStore();
  const { focus, deleteFocus, settings, setSettings } = data;
  const t = useTimer();
  const [tab, setTab] = useState<'pomo' | 'free' | 'breath'>(t.phase === 'free' ? 'free' : 'pomo');
  const [config, setConfig] = useState(false);
  const now = useNow(t.running);

  useEffect(() => { if (habitId) t.setHabit(habitId); }, [habitId]); // eslint-disable-line

  const left = secondsLeft(t, now);
  const total = phaseMinutes(t.phase, t.freeMinutes) * 60;
  const pct = total ? 1 - left / total : 0;
  const today = todayKey();
  const pomosToday = pomodorosOn(today);
  const isBreak = t.phase === 'short' || t.phase === 'long';
  const color = isBreak ? 'var(--good)' : 'var(--accent)';

  const switchTab = (v: 'pomo' | 'free' | 'breath') => {
    setTab(v);
    if (v === 'free' && t.phase !== 'free' && !t.running) t.setPhase('free');
    if (v === 'pomo' && t.phase === 'free' && !t.running) t.setPhase('work');
  };
  const setPomo = (p: Partial<typeof settings>) => {
    setSettings(p);
    if (!t.running) setTimeout(() => useTimer.getState().reset(), 0);
  };

  const days = lastNDays(14);
  const chart = days.map((d) => ({
    d: shortDate(d),
    min: focus.filter((f) => f.date === d).reduce((s, f) => s + f.minutes, 0),
    pomos: focus.filter((f) => f.date === d && f.label.startsWith('🍅')).length,
  }));
  const todayMin = focus.filter((f) => f.date === today).reduce((s, f) => s + f.minutes, 0);
  const totalMin = focus.reduce((s, f) => s + f.minutes, 0);
  const totalPomos = focus.filter((f) => f.label.startsWith('🍅')).length;
  const linked = data.habits.find((h) => h.id === t.habitId);

  const timerCard = (
    <>
      <div className="eyebrow">{PHASE_LABEL[t.phase]}{linked ? ` · ${linked.emoji} ${linked.name}` : t.phase === 'free' || t.phase === 'work' ? ` · ${t.label}` : ''}</div>
      <div style={{ margin: '18px auto 8px', width: 'fit-content', maxWidth: '100%' }}>
        <Ring value={pct} size={Math.min(260, typeof window !== 'undefined' ? window.innerWidth - 80 : 260)} stroke={12} color={color}>
          <div className="timer">{fmt(left)}</div>
          {tab === 'pomo' && <div className="small muted">{t.phase === 'work' ? `${(t.cycle % Math.max(1, settings.pomoEvery)) + 1} de ${settings.pomoEvery}` : 'Respirá, estirate'}</div>}
        </Ring>
      </div>
      <div className="row wrap" style={{ justifyContent: 'center' }}>
        <button className="btn primary" style={{ padding: '12px 28px', fontSize: 16 }} onClick={() => (t.running ? t.pause() : t.start())}>
          {t.running ? 'Pausar' : left < total ? 'Continuar' : 'Empezar'}
        </button>
        <button className="btn" onClick={t.reset}>Reiniciar</button>
        {tab === 'pomo' && <button className="btn ghost" onClick={t.skip}>Saltar fase ⏭</button>}
        {t.running && !isBreak && <button className="btn ghost" onClick={finishNow}>Terminar ya</button>}
      </div>
    </>
  );

  return (
    <div>
      <div className="page-head">
        <div><div className="eyebrow">Foco</div><h1 className="title">Modo <em>flow</em></h1></div>
        <Seg value={tab} onChange={switchTab} options={[{ v: 'pomo', l: '🍅 Pomodoro' }, { v: 'free', l: '🎯 Libre' }, { v: 'breath', l: '🌬 Respirar' }]} />
      </div>
      <div className="grid g3">
        <div className="card span2" style={{ textAlign: 'center', padding: '28px 16px' }}>
          {tab === 'breath' ? <Breath /> : (
            <>
              {tab === 'pomo' && (
                <div className="row" style={{ justifyContent: 'center', marginBottom: 14 }}>
                  <Seg<Phase> value={t.phase === 'free' ? 'work' : t.phase} onChange={(p) => t.setPhase(p)}
                    options={[{ v: 'work', l: `Pomodoro ${settings.pomoWork}′` }, { v: 'short', l: `Corto ${settings.pomoShort}′` }, { v: 'long', l: `Largo ${settings.pomoLong}′` }]} />
                </div>
              )}
              {timerCard}

              {tab === 'pomo' && (
                <div className="col" style={{ marginTop: 24, alignItems: 'center' }}>
                  <div className="pomo-count" aria-label={`${pomosToday} de ${settings.pomoGoal} pomodoros hoy`}>
                    {Array.from({ length: Math.max(settings.pomoGoal, pomosToday) }, (_, i) => (
                      <span key={i} className={i < pomosToday ? 'on' : ''}>🍅</span>
                    ))}
                  </div>
                  <div className="small"><b>{pomosToday}</b> <span className="muted">de {settings.pomoGoal} pomodoros hoy</span></div>
                </div>
              )}

              {!t.running && (
                <div className="col" style={{ marginTop: 22, alignItems: 'center' }}>
                  {tab === 'free' && (
                    <div className="row wrap" style={{ justifyContent: 'center', gap: 6 }}>
                      {FREE_PRESETS.map((p) => <button key={p} className={`chip ${t.freeMinutes === p ? 'on' : ''}`} onClick={() => t.setFreeMinutes(p)}>{p} min</button>)}
                    </div>
                  )}
                  <div className="row wrap" style={{ justifyContent: 'center', maxWidth: 520, width: '100%' }}>
                    <select id="focus-habit" className="select" style={{ flex: '1 1 180px' }} value={t.habitId} onChange={(e) => t.setHabit(e.target.value)}>
                      <option value="">Sin hábito vinculado</option>
                      {activeHabits(data).map((h) => <option key={h.id} value={h.id}>{h.emoji} {h.name}</option>)}
                    </select>
                    {!t.habitId && <input id="focus-label" className="input" style={{ flex: '1 1 180px' }} value={t.label} onChange={(e) => t.setLabel(e.target.value)} placeholder="¿En qué te enfocás?" />}
                  </div>
                  {t.habitId && <div className="tiny muted">Al terminar se suma al hábito (Sí/No, contador o minutos).</div>}
                  {tab === 'pomo' && <button className="btn ghost sm" onClick={() => setConfig((c) => !c)}>⚙️ {config ? 'Ocultar configuración' : 'Configurar pomodoro'}</button>}
                </div>
              )}

              {tab === 'pomo' && config && !t.running && (
                <div className="pomo-config">
                  <NumField id="pomo-work" label="Pomodoro (min)" value={settings.pomoWork} min={1} max={180} onChange={(v) => setPomo({ pomoWork: v })} />
                  <NumField id="pomo-short" label="Descanso corto" value={settings.pomoShort} min={1} max={60} onChange={(v) => setPomo({ pomoShort: v })} />
                  <NumField id="pomo-long" label="Descanso largo" value={settings.pomoLong} min={1} max={90} onChange={(v) => setPomo({ pomoLong: v })} />
                  <NumField id="pomo-every" label="Largo cada" value={settings.pomoEvery} min={1} max={12} onChange={(v) => setPomo({ pomoEvery: v })} />
                  <NumField id="pomo-goal" label="Meta diaria" value={settings.pomoGoal} min={1} max={24} onChange={(v) => setPomo({ pomoGoal: v })} />
                  <label className="row" style={{ gap: 8, cursor: 'pointer', alignSelf: 'end', paddingBottom: 10 }}>
                    <input id="pomo-auto" type="checkbox" checked={settings.pomoAuto} onChange={(e) => setSettings({ pomoAuto: e.target.checked })} />
                    <span className="small">Arrancar la siguiente fase sola</span>
                  </label>
                </div>
              )}
            </>
          )}
        </div>
        <div className="col" style={{ gap: 16 }}>
          <div className="card grid g2">
            <Stat k="Pomodoros hoy" v={pomosToday} />
            <Stat k="Foco hoy" v={todayMin} unit="min" />
            <Stat k="Pomodoros total" v={totalPomos} />
            <Stat k="Horas total" v={Math.round(totalMin / 6) / 10} unit="h" />
          </div>
          <div className="card">
            <div className="card-head"><h3 className="h3">Últimos 14 días</h3><span className="sub">minutos de foco</span></div>
            <ResponsiveContainer width="100%" height={160}>
              <BarChart data={chart}>
                <XAxis dataKey="d" tickLine={false} axisLine={false} interval={3} />
                <YAxis hide />
                <Tooltip content={<ChartTooltip fmt={(v, n) => (n === 'Foco' ? `${v} min` : String(v))} />} cursor={{ fill: 'var(--bg-2)' }} />
                <RBar dataKey="min" name="Foco" fill="var(--accent)" radius={[6, 6, 6, 6]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="card span3">
          <div className="card-head"><h3 className="h3">Historial</h3></div>
          {focus.length ? (
            <div style={{ overflowX: 'auto' }}>
              <table className="table">
                <thead><tr><th>Fecha</th><th>Sesión</th><th className="num">Min</th><th /></tr></thead>
                <tbody>
                  {focus.slice().reverse().slice(0, 30).map((f) => (
                    <tr key={f.id}><td>{shortDate(f.date)}</td><td>{f.label}</td><td className="num">{f.minutes}</td><td className="num"><button className="btn ghost sm" aria-label="Borrar sesión" onClick={() => deleteFocus(f.id)}>✕</button></td></tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : <div className="small muted">Todavía no hiciste sesiones de foco.</div>}
        </div>
      </div>
    </div>
  );
}

function NumField({ id, label, value, min, max, onChange }: { id: string; label: string; value: number; min: number; max: number; onChange: (v: number) => void }) {
  return (
    <div className="field">
      <label className="label" htmlFor={id}>{label}</label>
      <input id={id} className="input" type="number" inputMode="numeric" min={min} max={max} value={value}
        onChange={(e) => { const v = Number(e.target.value); if (v >= min && v <= max) onChange(v); }} />
    </div>
  );
}

function Breath() {
  const [phase, setPhase] = useState(0);
  const [on, setOn] = useState(false);
  const phases = [{ t: 'Inhalá', s: 1.35 }, { t: 'Sostené', s: 1.35 }, { t: 'Exhalá', s: 0.8 }, { t: 'Sostené', s: 0.8 }];
  useEffect(() => {
    if (!on) return;
    const t = setInterval(() => setPhase((p) => (p + 1) % 4), 4000);
    return () => clearInterval(t);
  }, [on]);
  return (
    <div className="col" style={{ alignItems: 'center', gap: 24 }}>
      <div className="eyebrow">Respiración cuadrada · 4-4-4-4</div>
      <div className="breath" style={{ transform: `scale(${on ? phases[phase].s : 1})` }}>
        <div className="serif" style={{ fontSize: 32 }}>{on ? phases[phase].t : 'Listo'}</div>
      </div>
      <button className="btn primary" onClick={() => { setOn((o) => !o); setPhase(0); }}>{on ? 'Detener' : 'Comenzar'}</button>
      <div className="small muted" style={{ maxWidth: 380 }}>Ideal antes de una sesión de foco o en momentos de estrés. Seguí el círculo: 4 segundos cada fase.</div>
    </div>
  );
}
