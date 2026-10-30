import { useEffect, useState, type ReactNode } from 'react';
import { create } from 'zustand';

export function Ring({ value, size = 120, stroke = 10, color = 'var(--accent)', track = 'var(--bg-2)', children }: {
  value: number; size?: number; stroke?: number; color?: string; track?: string; children?: ReactNode;
}) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const v = Math.max(0, Math.min(1, value));
  return (
    <div className="ring-wrap" style={{ width: size, height: size }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={track} strokeWidth={stroke} />
        <circle
          cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={stroke} strokeLinecap="round"
          strokeDasharray={c} strokeDashoffset={c * (1 - v)} style={{ transition: 'stroke-dashoffset .6s cubic-bezier(.2,.8,.2,1)' }}
        />
      </svg>
      <div className="ring-label">{children}</div>
    </div>
  );
}

export function Modal({ open, onClose, children, wide }: { open: boolean; onClose: () => void; children: ReactNode; wide?: boolean }) {
  useEffect(() => {
    if (!open) return;
    const k = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={`modal ${wide ? 'wide' : ''}`}>{children}</div>
    </div>
  );
}

export function Bar({ value, color = 'var(--accent)' }: { value: number; color?: string }) {
  return (
    <div className="bar">
      <div style={{ width: `${Math.max(0, Math.min(1, value)) * 100}%`, background: color }} />
    </div>
  );
}

export function Seg<T extends string | number>({ value, options, onChange }: { value: T; options: { v: T; l: ReactNode }[]; onChange: (v: T) => void }) {
  return (
    <div className="seg">
      {options.map((o) => (
        <button key={String(o.v)} className={o.v === value ? 'on' : ''} onClick={() => onChange(o.v)} type="button">
          {o.l}
        </button>
      ))}
    </div>
  );
}

export function Stat({ k, v, sub, unit }: { k: string; v: ReactNode; sub?: ReactNode; unit?: string }) {
  return (
    <div className="stat">
      <span className="k">{k}</span>
      <span className="v">
        {v}
        {unit && <small> {unit}</small>}
      </span>
      {sub && <span className="small">{sub}</span>}
    </div>
  );
}

export function Empty({ emoji, title, children }: { emoji: string; title: string; children?: ReactNode }) {
  return (
    <div className="empty">
      <div className="e">{emoji}</div>
      <h2 className="h2" style={{ color: 'var(--ink)', margin: '8px 0' }}>{title}</h2>
      {children}
    </div>
  );
}

/* ---------- Toasts ---------- */
interface Toast { id: number; text: string; icon?: string }
const useToasts = create<{ list: Toast[]; push: (t: Omit<Toast, 'id'>) => void }>((set) => ({
  list: [],
  push: (t) => {
    const id = Date.now() + Math.random();
    set((s) => ({ list: [...s.list, { ...t, id }] }));
    setTimeout(() => set((s) => ({ list: s.list.filter((x) => x.id !== id) })), 3200);
  },
}));
export const toast = (text: string, icon?: string) => useToasts.getState().push({ text, icon });
export function Toasts() {
  const list = useToasts((s) => s.list);
  return (
    <div className="toasts">
      {list.map((t) => (
        <div className="toast" key={t.id}>
          {t.icon && <span>{t.icon}</span>}
          {t.text}
        </div>
      ))}
    </div>
  );
}

/* ---------- Confetti ---------- */
export function confetti(x = window.innerWidth / 2, y = window.innerHeight / 2, amount = 80) {
  const canvas = document.createElement('canvas');
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  Object.assign(canvas.style, { position: 'fixed', inset: '0', pointerEvents: 'none', zIndex: '100' });
  document.body.appendChild(canvas);
  const ctx = canvas.getContext('2d')!;
  const colors = ['#c8643b', '#f3b378', '#8b7fd1', '#5aa469', '#4ea3d9', '#e7c35a'];
  const parts = Array.from({ length: amount }, () => ({
    x, y,
    vx: (Math.random() - 0.5) * 14,
    vy: -Math.random() * 13 - 3,
    r: Math.random() * 6 + 3,
    c: colors[Math.floor(Math.random() * colors.length)],
    rot: Math.random() * Math.PI,
    vr: (Math.random() - 0.5) * 0.3,
  }));
  let frame = 0;
  const tick = () => {
    frame++;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    for (const p of parts) {
      p.vy += 0.4;
      p.vx *= 0.99;
      p.x += p.vx;
      p.y += p.vy;
      p.rot += p.vr;
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      ctx.fillStyle = p.c;
      ctx.globalAlpha = Math.max(0, 1 - frame / 110);
      ctx.fillRect(-p.r / 2, -p.r / 4, p.r, p.r / 2);
      ctx.restore();
    }
    if (frame < 110) requestAnimationFrame(tick);
    else canvas.remove();
  };
  tick();
}

let audioCtx: AudioContext | null = null;
export function chime(high = false) {
  try {
    audioCtx = audioCtx ?? new AudioContext();
    const ctx = audioCtx;
    const notes = high ? [659, 784, 988] : [523, 659];
    notes.forEach((f, i) => {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = 'sine';
      o.frequency.value = f;
      const t = ctx.currentTime + i * 0.08;
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(0.08, t + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.5);
      o.connect(g).connect(ctx.destination);
      o.start(t);
      o.stop(t + 0.55);
    });
  } catch {
    /* sin audio */
  }
}

export function ChartTooltip({ active, payload, label, fmt }: {
  active?: boolean; payload?: { name: string; value: number; color: string }[]; label?: string; fmt?: (v: number, n: string) => string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="tooltip-box">
      <div style={{ fontWeight: 600, marginBottom: 4 }}>{label}</div>
      {payload.map((p) => (
        <div key={p.name} className="row" style={{ gap: 6 }}>
          <span style={{ width: 8, height: 8, borderRadius: 2, background: p.color }} />
          <span className="muted">{p.name}</span>
          <b style={{ marginLeft: 'auto' }}>{fmt ? fmt(p.value, p.name) : p.value}</b>
        </div>
      ))}
    </div>
  );
}

/* ---------- Diálogos propios (el visor bloquea confirm/prompt) ---------- */
interface DialogReq {
  kind: 'confirm' | 'text';
  title: string;
  body?: string;
  initial?: string;
  multiline?: boolean;
  danger?: boolean;
  ok?: string;
  resolve: (v: string | boolean | null) => void;
}
const useDialog = create<{ req: DialogReq | null; set: (r: DialogReq | null) => void }>((set) => ({ req: null, set: (req) => set({ req }) }));

export function askConfirm(title: string, opts: { body?: string; danger?: boolean; ok?: string } = {}): Promise<boolean> {
  return new Promise((resolve) => useDialog.getState().set({ kind: 'confirm', title, ...opts, resolve: (v) => resolve(v === true) }));
}
export function askText(title: string, initial = '', opts: { body?: string; multiline?: boolean; ok?: string } = {}): Promise<string | null> {
  return new Promise((resolve) => useDialog.getState().set({ kind: 'text', title, initial, ...opts, resolve: (v) => resolve(typeof v === 'string' ? v : null) }));
}

export function Dialogs() {
  const req = useDialog((s) => s.req);
  const set = useDialog((s) => s.set);
  const [val, setVal] = useState('');
  useEffect(() => setVal(req?.initial ?? ''), [req]);
  if (!req) return null;
  const close = (v: string | boolean | null) => { req.resolve(v); set(null); };
  const submit = () => close(req.kind === 'confirm' ? true : val);
  return (
    <div className="overlay" style={{ zIndex: 70 }} onMouseDown={(e) => e.target === e.currentTarget && close(null)}>
      <form className="modal" style={{ width: 'min(420px, 100%)' }} onSubmit={(e) => { e.preventDefault(); submit(); }} onKeyDown={(e) => e.key === 'Escape' && close(null)}>
        <h2 className="h2" style={{ fontSize: 24, marginBottom: 8 }}>{req.title}</h2>
        {req.body && <p className="small ink2" style={{ marginTop: 0 }}>{req.body}</p>}
        {req.kind === 'text' && (req.multiline
          ? <textarea id="dialog-text" className="textarea" autoFocus value={val} onChange={(e) => setVal(e.target.value)} style={{ minHeight: 120 }} />
          : <input id="dialog-text" className="input" autoFocus value={val} onChange={(e) => setVal(e.target.value)} />)}
        <div className="row" style={{ justifyContent: 'flex-end', marginTop: 16 }}>
          <button type="button" className="btn ghost" onClick={() => close(null)}>Cancelar</button>
          <button type="submit" autoFocus={req.kind === 'confirm'} className="btn primary" style={req.danger ? { background: 'var(--bad)', borderColor: 'var(--bad)' } : undefined}>{req.ok ?? 'Aceptar'}</button>
        </div>
      </form>
    </div>
  );
}

/* ---------- Navegador de fechas ---------- */
export function DateNav({ date, onChange, max }: { date: string; onChange: (d: string) => void; max: string }) {
  const shift = (n: number) => {
    const d = new Date(date + 'T12:00:00');
    d.setDate(d.getDate() + n);
    const k = d.toISOString().slice(0, 10);
    if (k <= max) onChange(k);
  };
  return (
    <div className="date-nav">
      <button className="btn icon" type="button" onClick={() => shift(-1)} aria-label="Día anterior">‹</button>
      <input id="date-nav-input" className="input date-input" type="date" value={date} max={max} aria-label="Elegir fecha"
        onChange={(e) => e.target.value && e.target.value <= max && onChange(e.target.value)} />
      <button className="btn icon" type="button" onClick={() => shift(1)} disabled={date >= max} aria-label="Día siguiente">›</button>
    </div>
  );
}
