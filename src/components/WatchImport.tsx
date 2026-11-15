import { useEffect, useRef, useState } from 'react';
import type { WatchMetrics } from '../lib/types';
import { useStore } from '../lib/store';
import { activeHabits, entryOf, isDone, isScheduled } from '../lib/stats';
import { CartesianGrid, ComposedChart, Line, ResponsiveContainer, Scatter, Tooltip, XAxis, YAxis } from 'recharts';
import { readWatchScreenshot, WATCH_FIELDS } from '../lib/watch';
import { shortDate, todayKey } from '../lib/date';
import { Bar, ChartTooltip, Modal, toast } from './ui';

type Step = 'pick' | 'reading' | 'review';

export function WatchImport({ open, onClose, date: initialDate }: { open: boolean; onClose: () => void; date: string }) {
  const existing = useStore((s) => s.watch);
  const setWatch = useStore((s) => s.setWatch);
  const setMood = useStore((s) => s.setMood);
  const moods = useStore((s) => s.moods);
  const [step, setStep] = useState<Step>('pick');
  const [date, setDate] = useState(initialDate);
  const [preview, setPreview] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [values, setValues] = useState<Record<string, string>>({});
  const [found, setFound] = useState<number | null>(null);
  const [rawText, setRawText] = useState('');
  const [showRaw, setShowRaw] = useState(false);
  const file = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    setStep('pick');
    setDate(initialDate);
    setFound(null);
    setRawText('');
    setShowRaw(false);
    setProgress(0);
    setPreview((p) => { if (p) URL.revokeObjectURL(p); return null; });
  }, [open, initialDate]);

  const fill = (m: WatchMetrics) => {
    const v: Record<string, string> = {};
    for (const f of WATCH_FIELDS) if (m[f.key] !== undefined) v[f.key] = String(m[f.key]);
    setValues(v);
  };

  const onFile = async (f: File | undefined) => {
    if (!f) return;
    setPreview(URL.createObjectURL(f));
    setStep('reading');
    setProgress(0.02);
    try {
      const r = await readWatchScreenshot(f, setProgress);
      // lo que ya había cargado ese día se mantiene si la captura no lo trae
      fill({ ...(existing[date] ?? {}), ...r.metrics });
      setFound(Object.keys(r.metrics).length);
      setRawText(r.text);
      setStep('review');
    } catch {
      toast('No pude leer la captura. Probá con otra o cargá los datos a mano.', '⚠️');
      fill(existing[date] ?? {});
      setFound(0);
      setStep('review');
    }
  };

  const save = () => {
    const m: WatchMetrics = {};
    for (const f of WATCH_FIELDS) {
      const raw = (values[f.key] ?? '').trim().replace(',', '.');
      if (raw === '') continue;
      const n = Number(raw);
      if (isFinite(n) && n >= 0) (m as Record<string, number>)[f.key] = n;
    }
    setWatch(date, m);
    // si ese día ya tiene ánimo registrado, el sueño también va a su registro
    if (m.sleepHours !== undefined && moods[date]) setMood(date, { sleep: Math.round(m.sleepHours * 2) / 2 });
    toast(Object.keys(m).length ? 'Datos del reloj guardados' : 'Datos del reloj borrados', '⌚');
    onClose();
  };

  return (
    <Modal open={open} onClose={onClose}>
      <div className="row between" style={{ marginBottom: 14 }}>
        <h2 className="h2">⌚ Datos del reloj</h2>
        <button className="btn ghost icon" onClick={onClose} aria-label="Cerrar">✕</button>
      </div>

      {step === 'pick' && (
        <div className="col" style={{ gap: 12 }}>
          <p className="small ink2" style={{ margin: 0 }}>
            Subí una captura de la app de tu reloj (Garmin, Apple Salud, Samsung Health, Fitbit, Huawei…) con tu resumen del día:
            sueño, pasos, frecuencia cardíaca, estrés, energía. La leo en tu celular, sin mandarla a ningún lado, y vos revisás los números antes de guardar.
          </p>
          <input ref={file} type="file" accept="image/*" hidden onChange={(e) => onFile(e.target.files?.[0])} />
          <button className="btn primary" style={{ padding: '14px 16px', fontSize: 16 }} onClick={() => file.current?.click()}>📷 Elegir captura</button>
          <button className="btn" onClick={() => { fill(existing[date] ?? {}); setFound(null); setStep('review'); }}>✍️ Cargar a mano</button>
        </div>
      )}

      {step === 'reading' && (
        <div className="col" style={{ gap: 14, alignItems: 'center', textAlign: 'center' }}>
          {preview && <img src={preview} alt="Captura elegida" className="watch-preview" />}
          <div style={{ width: '100%' }}>
            <div className="small" style={{ marginBottom: 6 }}>Leyendo la captura… {Math.round(progress * 100)}%</div>
            <Bar value={progress} />
          </div>
          <div className="tiny muted">La primera vez tarda unos segundos más: descarga el lector de texto.</div>
        </div>
      )}

      {step === 'review' && (
        <div className="col" style={{ gap: 14 }}>
          {found !== null && (
            <div className={`watch-found ${found ? 'ok' : 'none'}`}>
              {found ? `Encontré ${found} ${found === 1 ? 'dato' : 'datos'}. Revisalos y corregí lo que haga falta.` : 'No encontré datos en la captura. Podés cargarlos a mano.'}
            </div>
          )}
          <div className="row wrap" style={{ gap: 12, alignItems: 'flex-start' }}>
            {preview && <img src={preview} alt="Captura" className="watch-preview small" />}
            <div className="field" style={{ flex: '1 1 160px' }}>
              <label className="label" htmlFor="watch-date">Día</label>
              <input id="watch-date" className="input" type="date" value={date} max={todayKey()} onChange={(e) => e.target.value && setDate(e.target.value)} />
            </div>
          </div>
          <div className="watch-fields">
            {WATCH_FIELDS.map((f) => (
              <div className="field" key={f.key}>
                <label className="label" htmlFor={`watch-${f.key}`}>{f.icon} {f.label}{f.unit && <span className="muted"> ({f.unit})</span>}</label>
                <input id={`watch-${f.key}`} className={`input ${values[f.key] ? 'filled' : ''}`} inputMode="decimal" placeholder="—"
                  value={values[f.key] ?? ''} onChange={(e) => setValues((v) => ({ ...v, [f.key]: e.target.value }))} />
              </div>
            ))}
          </div>
          {rawText && (
            <div>
              <button className="btn ghost sm" onClick={() => setShowRaw((s) => !s)}>{showRaw ? 'Ocultar' : 'Ver'} texto leído</button>
              {showRaw && <pre className="watch-raw">{rawText}</pre>}
            </div>
          )}
          <div className="row" style={{ justifyContent: 'flex-end' }}>
            <button className="btn ghost" onClick={onClose}>Cancelar</button>
            <button className="btn primary" onClick={save}>Guardar</button>
          </div>
        </div>
      )}
    </Modal>
  );
}

/** Resumen de los datos del reloj de un día, con botón para cargar o editar. */
export function WatchSummary({ date }: { date: string }) {
  const m = useStore((s) => s.watch[date]);
  const [open, setOpen] = useState(false);
  const fmt = (k: keyof WatchMetrics, v: number) =>
    k === 'sleepHours' ? `${Math.floor(v)} h ${String(Math.round((v % 1) * 60)).padStart(2, '0')}` : k === 'steps' || k === 'calories' ? v.toLocaleString('es') : String(v);
  return (
    <div className="watch-summary">
      {m ? (
        <div className="row wrap" style={{ gap: 6 }}>
          {WATCH_FIELDS.filter((f) => m[f.key] !== undefined).map((f) => (
            <span key={f.key} className="chip" title={f.label}>{f.icon} {fmt(f.key, m[f.key]!)}{f.unit && f.unit !== '/100' && f.key !== 'sleepHours' ? ` ${f.unit}` : ''}</span>
          ))}
          <button className="btn ghost sm" onClick={() => setOpen(true)}>Editar</button>
        </div>
      ) : (
        <button className="btn sm" onClick={() => setOpen(true)}>⌚ Cargar captura del reloj</button>
      )}
      <WatchImport open={open} onClose={() => setOpen(false)} date={date} />
    </div>
  );
}

const LOWER_IS_BETTER: (keyof WatchMetrics)[] = ['stress', 'restingHr'];

/** Tendencia de un dato del reloj y qué hábitos lo mueven. */
export function WatchCard({ days }: { days: string[] }) {
  const data = useStore();
  const available = WATCH_FIELDS.filter((f) => days.filter((d) => data.watch[d]?.[f.key] !== undefined).length >= 3);
  const [key, setKey] = useState<keyof WatchMetrics>('sleepHours');
  const field = available.find((f) => f.key === key) ?? available[0];
  if (!field) {
    return (
      <div className="card" style={{ marginTop: 16 }}>
        <div className="card-head"><h3 className="h3">⌚ Tu reloj</h3></div>
        <p className="small muted" style={{ margin: 0 }}>Cargá capturas del reloj algunos días (botón “Cargar captura del reloj” en el registro de ánimo) y acá vas a ver la evolución de tu sueño, pasos, estrés y energía, y qué hábitos los mejoran.</p>
      </div>
    );
  }
  const k = field.key;
  const rows = days.map((d) => ({ date: d, label: shortDate(d), v: data.watch[d]?.[k] ?? null }));
  const vals = rows.map((r) => r.v).filter((v): v is number => v !== null);
  const avg = vals.reduce((a, b) => a + b, 0) / vals.length;
  const roll = rows.map((_, i) => {
    const w = rows.slice(Math.max(0, i - 6), i + 1).map((r) => r.v).filter((v): v is number => v !== null);
    return w.length ? Math.round((w.reduce((a, b) => a + b, 0) / w.length) * 10) / 10 : null;
  });
  const chart = rows.map((r, i) => ({ ...r, avg: roll[i] }));
  const lowerBetter = LOWER_IS_BETTER.includes(k);
  // días con el hábito cumplido vs sin cumplir
  const impacts = activeHabits(data)
    .map((h) => {
      const w: number[] = [];
      const wo: number[] = [];
      for (const d of days) {
        const v = data.watch[d]?.[k];
        if (v === undefined || !isScheduled(h, d)) continue;
        (isDone(h, entryOf(data.logs, d, h.id), d) ? w : wo).push(v);
      }
      if (w.length < 3 || wo.length < 3) return null;
      const a = w.reduce((x, y) => x + y, 0) / w.length;
      const b = wo.reduce((x, y) => x + y, 0) / wo.length;
      return { h, a, b, rel: b ? (a - b) / Math.abs(b) : 0 };
    })
    .filter((x): x is NonNullable<typeof x> => !!x && Math.abs(x.rel) >= 0.05)
    .sort((x, y) => Math.abs(y.rel) - Math.abs(x.rel))
    .slice(0, 3);
  const f1 = (v: number) => (field.step ? v.toFixed(1) : Math.round(v).toLocaleString('es'));

  return (
    <div className="card" style={{ marginTop: 16 }}>
      <div className="card-head">
        <div><h3 className="h3">⌚ Tu reloj</h3><span className="sub">{field.label} · promedio {f1(avg)} {field.unit !== '/100' ? field.unit : ''} · {vals.length} días con datos</span></div>
      </div>
      <div className="row wrap" style={{ gap: 6, marginBottom: 12 }}>
        {available.map((f) => <button key={f.key} className={`chip ${f.key === k ? 'on' : ''}`} onClick={() => setKey(f.key)}>{f.icon} {f.label}</button>)}
      </div>
      <ResponsiveContainer width="100%" height={220}>
        <ComposedChart data={chart}>
          <CartesianGrid vertical={false} strokeDasharray="3 3" />
          <XAxis dataKey="label" tickLine={false} axisLine={false} minTickGap={24} />
          <YAxis tickLine={false} axisLine={false} width={44} domain={['auto', 'auto']} />
          <Tooltip content={<ChartTooltip fmt={(v) => `${f1(v)} ${field.unit !== '/100' ? field.unit : ''}`} />} />
          <Scatter dataKey="v" name={field.label} fill="var(--lav)" shape={(pr: { cx?: number; cy?: number }) => (pr.cx == null || pr.cy == null ? <g /> : <circle cx={pr.cx} cy={pr.cy} r={3} fill="var(--lav)" fillOpacity={0.55} />)} />
          <Line dataKey="avg" name="Media 7 días" stroke="var(--lav)" strokeWidth={2.5} dot={false} connectNulls type="monotone" />
        </ComposedChart>
      </ResponsiveContainer>
      {impacts.length > 0 && (
        <div className="col" style={{ gap: 8, marginTop: 10 }}>
          <div className="eyebrow">Qué lo mueve</div>
          {impacts.map(({ h, a, b, rel }) => {
            const good = lowerBetter ? rel < 0 : rel > 0;
            return (
              <div key={h.id} className="row small" style={{ gap: 8 }}>
                <span>{h.emoji}</span>
                <span className="grow">Los días que hacés <b>{h.name}</b>: {f1(a)} vs {f1(b)}</span>
                <span className={good ? 'delta-up' : 'delta-down'}>{rel > 0 ? '▲' : '▼'} {Math.abs(Math.round(rel * 100))}%</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
