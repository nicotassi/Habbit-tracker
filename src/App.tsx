import { Fragment, useEffect, useMemo, useState } from 'react';
import { useStore, getData } from './lib/store';
import { navigate, useRoute } from './router';
import { activeHabits, entryOf, isDone, isScheduled, levelOf, levelTitle, xpOf } from './lib/stats';
import { evaluateAchievements, ACHIEVEMENTS } from './lib/achievements';
import { todayKey } from './lib/date';
import { Bar, confetti, toast, Toasts } from './components/ui';
import { HabitForm } from './components/HabitForm';
import { Today } from './pages/Today';
import { Habits } from './pages/Habits';
import { HabitDetail } from './pages/HabitDetail';
import { Analytics } from './pages/Analytics';
import { Mood } from './pages/Mood';
import { Calendar } from './pages/Calendar';
import { Focus } from './pages/Focus';
import { Goals } from './pages/Goals';
import { Achievements } from './pages/Achievements';
import { Settings } from './pages/Settings';

const NAV = [
  { id: 'today', ico: '☀️', label: 'Hoy' },
  { id: 'habits', ico: '🌱', label: 'Hábitos' },
  { id: 'analytics', ico: '📊', label: 'Análisis' },
  { id: 'mood', ico: '🫶', label: 'Ánimo' },
  { id: 'calendar', ico: '🗓️', label: 'Calendario' },
  { id: 'focus', ico: '⏱️', label: 'Foco' },
  { id: 'goals', ico: '🚩', label: 'Objetivos' },
  { id: 'achievements', ico: '🏆', label: 'Logros' },
  { id: 'settings', ico: '⚙️', label: 'Ajustes' },
];
const MOBILE = ['today', 'habits', 'analytics', 'mood', 'calendar'];

export default function App() {
  const route = useRoute();
  const page = route[0] ?? 'today';
  const data = useStore();
  const [palette, setPalette] = useState(false);
  const [newHabit, setNewHabit] = useState(false);

  // Tema
  useEffect(() => {
    const apply = () => {
      const dark = data.settings.theme === 'dark' || (data.settings.theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
      document.documentElement.dataset.theme = dark ? 'dark' : 'light';
      document.documentElement.style.setProperty('--accent', data.settings.accent);
      document.documentElement.style.setProperty('--accent-soft', `color-mix(in srgb, ${data.settings.accent} 18%, var(--surface))`);
      document.querySelector('meta[name="theme-color"]')?.setAttribute('content', dark ? '#151412' : '#f7f4ee');
    };
    apply();
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    mq.addEventListener('change', apply);
    return () => mq.removeEventListener('change', apply);
  }, [data.settings.theme, data.settings.accent]);

  // Logros
  useEffect(() => {
    const t = setTimeout(() => {
      const d = getData();
      const now = evaluateAchievements(d);
      const fresh = now.filter((id) => !d.unlocked[id]);
      if (!fresh.length) return;
      const firstRun = Object.keys(d.unlocked).length === 0 && fresh.length > 3;
      data.unlock(fresh);
      if (!firstRun) {
        fresh.slice(0, 3).forEach((id, i) => {
          const a = ACHIEVEMENTS.find((x) => x.id === id)!;
          setTimeout(() => toast(`Logro desbloqueado: ${a.title}`, a.emoji), i * 700);
        });
        if (d.settings.confetti) confetti(window.innerWidth / 2, 80, 120);
      }
    }, 400);
    return () => clearTimeout(t);
  }, [data.logs, data.moods, data.habits, data.focus, data.reviews, data.goals]); // eslint-disable-line

  // Recordatorios
  useEffect(() => {
    if (!data.settings.notifications) return;
    const fired = new Set<string>();
    const tick = () => {
      if (!('Notification' in window) || Notification.permission !== 'granted') return;
      const now = new Date();
      const hhmm = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
      const d = getData();
      const today = todayKey();
      for (const h of activeHabits(d)) {
        if (h.reminder !== hhmm || !isScheduled(h, today) || isDone(h, entryOf(d.logs, today, h.id), today)) continue;
        const key = `${today}-${h.id}`;
        if (fired.has(key)) continue;
        fired.add(key);
        new Notification(`${h.emoji} ${h.name}`, { body: h.why || 'Es momento de tu hábito', icon: './icon.svg' });
      }
    };
    const i = setInterval(tick, 20000);
    tick();
    return () => clearInterval(i);
  }, [data.settings.notifications]);

  // Atajos
  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); setPalette((p) => !p); return; }
      const t = e.target as HTMLElement;
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(t.tagName) || e.metaKey || e.ctrlKey || e.altKey) return;
      if (document.querySelector('.overlay')) return;
      if (e.key === 'n') { e.preventDefault(); setNewHabit(true); }
      const n = Number(e.key);
      if (n >= 1 && n <= NAV.length) navigate(NAV[n - 1].id);
    };
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, []);

  const xp = xpOf(data);
  const lv = levelOf(xp);

  const content = (() => {
    switch (page) {
      case 'habits': return <Habits />;
      case 'habit': return <HabitDetail id={route[1]} />;
      case 'analytics': return <Analytics />;
      case 'mood': return <Mood />;
      case 'calendar': return <Calendar key={route[1]} initial={route[1]} />;
      case 'focus': return <Focus key={route[1]} habitId={route[1]} />;
      case 'goals': return <Goals />;
      case 'achievements': return <Achievements />;
      case 'settings': return <Settings />;
      default: return <Today />;
    }
  })();
  const active = page === 'habit' ? 'habits' : page;

  return (
    <div className="app">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark">
            <svg width="20" height="20" viewBox="0 0 64 64"><path d="M8 38c7 0 7-16 14-16s7 20 14 20 7-24 14-24" fill="none" stroke="#f3d9b1" strokeWidth="7" strokeLinecap="round" strokeLinejoin="round" /></svg>
          </div>
          <span className="brand-name">Ritmo</span>
        </div>
        <button className="nav-item" onClick={() => setPalette(true)} style={{ border: '1px solid var(--line)', marginBottom: 10, color: 'var(--ink-3)' }}>
          <span className="ico">🔎</span><span className="grow">Buscar…</span><kbd>⌘K</kbd>
        </button>
        {NAV.map((n, i) => (
          <Fragment key={n.id}>
            {i === 5 && <div className="nav-section">Crecimiento</div>}
            {i === 8 && <div className="nav-section">Sistema</div>}
            <button className={`nav-item ${active === n.id ? 'active' : ''}`} onClick={() => navigate(n.id)}>
              <span className="ico">{n.ico}</span>{n.label}
            </button>
          </Fragment>
        ))}
        <div className="sidebar-foot">
          <button className="btn primary" style={{ width: '100%', marginBottom: 12 }} onClick={() => setNewHabit(true)}>+ Nuevo hábito</button>
          <div className="level-card" onClick={() => navigate('achievements')} style={{ cursor: 'pointer' }}>
            <div className="lv"><span>Nivel {lv.level} · {levelTitle(lv.level)}</span><b>{xp}</b></div>
            <div style={{ marginTop: 8 }}><Bar value={lv.progress} /></div>
          </div>
        </div>
      </aside>

      <main className="main">{content}</main>

      <nav className="mobile-nav">
        {NAV.filter((n) => MOBILE.includes(n.id)).map((n) => (
          <button key={n.id} className={active === n.id ? 'active' : ''} onClick={() => navigate(n.id)}>
            <span className="ico">{n.ico}</span>{n.label}
          </button>
        ))}
        <button onClick={() => setPalette(true)}><span className="ico">☰</span>Más</button>
      </nav>

      {palette && <Palette onClose={() => setPalette(false)} onNew={() => { setPalette(false); setNewHabit(true); }} />}
      <HabitForm open={newHabit} onClose={() => setNewHabit(false)} />
      <Toasts />
    </div>
  );
}

function Palette({ onClose, onNew }: { onClose: () => void; onNew: () => void }) {
  const data = useStore();
  const [q, setQ] = useState('');
  const [sel, setSel] = useState(0);
  const today = todayKey();
  const items = useMemo(() => {
    const list: { ico: string; label: string; hint?: string; run: () => void }[] = [
      { ico: '➕', label: 'Nuevo hábito', hint: 'N', run: onNew },
      ...NAV.map((n, i) => ({ ico: n.ico, label: `Ir a ${n.label}`, hint: String(i + 1), run: () => navigate(n.id) })),
      { ico: '🌗', label: 'Cambiar tema', run: () => data.setSettings({ theme: document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark' }) },
      ...activeHabits(data).flatMap((h) => {
        const done = isDone(h, entryOf(data.logs, today, h.id), today);
        const out = [{ ico: h.emoji, label: `Ver ${h.name}`, hint: 'estadísticas', run: () => navigate(`habit/${h.id}`) }];
        if (h.kind === 'check' && isScheduled(h, today)) out.unshift({ ico: done ? '↩️' : '✅', label: `${done ? 'Desmarcar' : 'Completar'} ${h.name}`, hint: 'hoy', run: () => { data.setEntry(today, h.id, done ? null : { value: 1 }); toast(done ? 'Desmarcado' : `${h.name} ✓`, h.emoji); } });
        return out;
      }),
    ];
    return list.filter((i) => i.label.toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '').includes(q.toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '')));
  }, [q, data, today, onNew]);
  useEffect(() => setSel(0), [q]);
  return (
    <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="palette">
        <input autoFocus placeholder="Buscá un hábito, una sección o una acción…" value={q} onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Escape') onClose();
            if (e.key === 'ArrowDown') { e.preventDefault(); setSel((s) => Math.min(items.length - 1, s + 1)); }
            if (e.key === 'ArrowUp') { e.preventDefault(); setSel((s) => Math.max(0, s - 1)); }
            if (e.key === 'Enter' && items[sel]) { items[sel].run(); onClose(); }
          }} />
        <div className="items">
          {items.map((it, i) => (
            <button key={it.label} className={`item ${i === sel ? 'sel' : ''}`} onMouseEnter={() => setSel(i)} onClick={() => { it.run(); onClose(); }}>
              <span style={{ width: 22, textAlign: 'center' }}>{it.ico}</span>
              <span className="grow">{it.label}</span>
              {it.hint && <kbd>{it.hint}</kbd>}
            </button>
          ))}
          {!items.length && <div className="small muted" style={{ padding: 14 }}>Sin resultados</div>}
        </div>
      </div>
    </div>
  );
}
