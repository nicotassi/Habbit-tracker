import { useEffect, useRef, useState } from 'react';
import { Bar as RBar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useStore, getData } from '../lib/store';
import { activeHabits, entryOf } from '../lib/stats';
import { lastNDays, shortDate, todayKey } from '../lib/date';
import { ChartTooltip, chime, confetti, Seg, Stat, toast } from '../components/ui';

type Mode = 'focus' | 'break' | 'breath';
const PRESETS = [15, 25, 45, 60, 90];

export function Focus({ habitId }: { habitId?: string }) {
  const { habits, focus, addFocus, deleteFocus, setEntry } = useStore();
  const [mode, setMode] = useState<Mode>('focus');
  const [minutes, setMinutes] = useState(25);
  const [left, setLeft] = useState(25 * 60);
  const [running, setRunning] = useState(false);
  const [label, setLabel] = useState('Trabajo profundo');
  const [linked, setLinked] = useState<string>(habitId ?? '');
  const startRef = useRef<number | null>(null);
  const baseLeft = useRef(left);

  useEffect(() => { if (!running) { setLeft((mode === 'break' ? 5 : minutes) * 60); } }, [minutes, mode]); // eslint-disable-line
  useEffect(() => {
    if (!running) return;
    startRef.current = Date.now();
    baseLeft.current = left;
    const t = setInterval(() => {
      const l = Math.max(0, baseLeft.current - Math.floor((Date.now() - startRef.current!) / 1000));
      setLeft(l);
      if (l === 0) {
        clearInterval(t);
        setRunning(false);
        finish();
      }
    }, 250);
    return () => clearInterval(t);
  }, [running]); // eslint-disable-line

  useEffect(() => {
    const mm = String(Math.floor(left / 60)).padStart(2, '0');
    const ss = String(left % 60).padStart(2, '0');
    document.title = running ? `${mm}:${ss} · Ritmo` : 'Ritmo';
    return () => { document.title = 'Ritmo'; };
  }, [left, running]);

  const finish = () => {
    chime(true);
    if (mode === 'focus') {
      const h = habits.find((x) => x.id === linked);
      addFocus({ minutes, label: h ? h.name : label, habitId: linked || undefined });
      if (h && (h.kind === 'quantity' || h.kind === 'check')) {
        const d = todayKey();
        const e = entryOf(getData().logs, d, h.id);
        const unitIsMin = /min/i.test(h.unit ?? '');
        if (h.kind === 'check') setEntry(d, h.id, { ...e, value: 1 });
        else if (unitIsMin) setEntry(d, h.id, { ...e, value: (e?.value ?? 0) + minutes });
      }
      confetti(window.innerWidth / 2, window.innerHeight / 3, 90);
      toast(`¡${minutes} minutos de foco!`, '🎯');
      if (Notification?.permission === 'granted') new Notification('Ritmo', { body: `Terminaste ${minutes} min de foco. Tomate un descanso.` });
      setMode('break');
    } else {
      toast('Descanso terminado', '☕');
      setMode('focus');
    }
  };

  const total = mode === 'break' ? 5 * 60 : minutes * 60;
  const pct = 1 - left / total;
  const days = lastNDays(14);
  const chart = days.map((d) => ({ d: shortDate(d), min: focus.filter((f) => f.date === d).reduce((s, f) => s + f.minutes, 0) }));
  const todayMin = focus.filter((f) => f.date === todayKey()).reduce((s, f) => s + f.minutes, 0);
  const totalMin = focus.reduce((s, f) => s + f.minutes, 0);
  const week = focus.filter((f) => lastNDays(7).includes(f.date)).reduce((s, f) => s + f.minutes, 0);

  return (
    <div>
      <div className="page-head">
        <div><div className="eyebrow">Foco</div><h1 className="title">Modo <em>flow</em></h1></div>
        <Seg value={mode} onChange={(m) => { setRunning(false); setMode(m); }} options={[{ v: 'focus', l: '🎯 Foco' }, { v: 'break', l: '☕ Descanso' }, { v: 'breath', l: '🌬 Respirar' }]} />
      </div>
      <div className="grid g3">
        <div className="card span2" style={{ textAlign: 'center', padding: '40px 20px' }}>
          {mode === 'breath' ? <Breath /> : (
            <>
              <div className="eyebrow">{mode === 'focus' ? (habits.find((h) => h.id === linked)?.name ?? label) : 'Descanso'}</div>
              <div className="timer" style={{ margin: '12px 0' }}>{String(Math.floor(left / 60)).padStart(2, '0')}:{String(left % 60).padStart(2, '0')}</div>
              <div className="bar" style={{ maxWidth: 420, margin: '0 auto 24px' }}><div style={{ width: `${pct * 100}%`, background: 'var(--accent)' }} /></div>
              <div className="row" style={{ justifyContent: 'center' }}>
                <button className="btn primary" style={{ padding: '12px 28px', fontSize: 16 }} onClick={() => setRunning((r) => !r)}>{running ? 'Pausar' : left < total ? 'Continuar' : 'Empezar'}</button>
                <button className="btn" onClick={() => { setRunning(false); setLeft(total); }}>Reiniciar</button>
                {running && <button className="btn ghost" onClick={() => { setRunning(false); setLeft(0); finish(); }}>Terminar ya</button>}
              </div>
              {mode === 'focus' && !running && (
                <div className="col" style={{ marginTop: 28, alignItems: 'center' }}>
                  <div className="row wrap" style={{ justifyContent: 'center', gap: 6 }}>
                    {PRESETS.map((p) => <button key={p} className={`chip ${minutes === p ? 'on' : ''}`} onClick={() => setMinutes(p)}>{p} min</button>)}
                  </div>
                  <div className="row wrap" style={{ justifyContent: 'center', maxWidth: 520, width: '100%' }}>
                    <select className="select" style={{ flex: 1, minWidth: 180 }} value={linked} onChange={(e) => setLinked(e.target.value)}>
                      <option value="">Sin hábito vinculado</option>
                      {activeHabits(getData()).map((h) => <option key={h.id} value={h.id}>{h.emoji} {h.name}</option>)}
                    </select>
                    {!linked && <input className="input" style={{ flex: 1, minWidth: 180 }} value={label} onChange={(e) => setLabel(e.target.value)} placeholder="¿En qué te enfocás?" />}
                  </div>
                  {linked && <div className="tiny muted">Al terminar se registra automáticamente en el hábito (si es Sí/No o se mide en minutos).</div>}
                </div>
              )}
            </>
          )}
        </div>
        <div className="col" style={{ gap: 16 }}>
          <div className="card grid g2">
            <Stat k="Hoy" v={todayMin} unit="min" />
            <Stat k="Esta semana" v={Math.round(week / 6) / 10} unit="h" />
            <Stat k="Total" v={Math.round(totalMin / 6) / 10} unit="h" />
            <Stat k="Sesiones" v={focus.length} />
          </div>
          <div className="card">
            <div className="card-head"><h3 className="h3">Últimos 14 días</h3></div>
            <ResponsiveContainer width="100%" height={160}>
              <BarChart data={chart}>
                <XAxis dataKey="d" tickLine={false} axisLine={false} interval={2} />
                <YAxis hide />
                <Tooltip content={<ChartTooltip fmt={(v) => `${v} min`} />} cursor={{ fill: 'var(--bg-2)' }} />
                <RBar dataKey="min" name="Foco" fill="var(--accent)" radius={[6, 6, 6, 6]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="card span3">
          <div className="card-head"><h3 className="h3">Historial</h3></div>
          {focus.length ? (
            <table className="table">
              <thead><tr><th>Fecha</th><th>Sesión</th><th className="num">Minutos</th><th /></tr></thead>
              <tbody>
                {focus.slice().reverse().slice(0, 30).map((f) => (
                  <tr key={f.id}><td>{shortDate(f.date)}</td><td>{f.label}</td><td className="num">{f.minutes}</td><td className="num"><button className="btn ghost sm" onClick={() => deleteFocus(f.id)}>✕</button></td></tr>
                ))}
              </tbody>
            </table>
          ) : <div className="small muted">Todavía no hiciste sesiones de foco.</div>}
        </div>
      </div>
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
