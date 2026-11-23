import { Fragment, useEffect, useMemo, useRef, useState } from 'react';
import { useStore, getData } from './lib/store';
import { navigate, useRoute } from './router';
import { activeHabits, entryOf, isDone, isScheduled, levelOf, levelTitle, xpOf } from './lib/stats';
import { evaluateAchievements, ACHIEVEMENTS } from './lib/achievements';
import { todayKey } from './lib/date';
import { Bar, BrandMark, chime, confetti, Dialogs, toast, Toasts } from './components/ui';
import { checkTimer, PHASE_LABEL, phaseMinutes, secondsLeft, setFinishListener, useTimer } from './lib/timer';
import { useNow } from './pages/Focus';
import { Login } from './pages/Login';
import { flush, startSync, useCloud } from './lib/cloud';
import { applyUpdate, checkForUpdate, useUpdate } from './lib/update';
import { InstallBanner } from './components/Install';
import { StopwatchBar, TimeChooser, useStopwatch } from './components/HabitTimer';
import { slotFor } from './lib/schedule';
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
import { Coach } from './pages/Coach';
import { Day } from './pages/Day';

const NAV = [
  { id: 'today', ico: '☀️', label: 'Hoy' },
  { id: 'coach', ico: '🧭', label: 'Cómo vas' },
  { id: 'habits', ico: '🌱', label: 'Hábitos' },
  { id: 'analytics', ico: '📊', label: 'Análisis' },
  { id: 'mood', ico: '🫶', label: 'Ánimo' },
  { id: 'calendar', ico: '🗓️', label: 'Calendario' },
  { id: 'focus', ico: '🍅', label: 'Pomodoro' },
  { id: 'goals', ico: '🚩', label: 'Objetivos' },
  { id: 'achievements', ico: '🏆', label: 'Logros' },
  { id: 'ajustes', ico: '⚙️', label: 'Ajustes' },
];
const MOBILE = ['today', 'habits', 'mood', 'analytics', 'focus'];

/** Puerta de entrada: sin sesión muestra el login; con sesión, la app y la sincronización con la nube. */
export default function Root() {
  const session = useCloud((s) => s.session);
  const theme = useStore((s) => s.settings.theme);
  const accent = useStore((s) => s.settings.accent);
  useEffect(() => {
    const apply = () => {
      const dark = theme === 'dark' || theme === 'graphite' || (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
      document.documentElement.dataset.theme = theme === 'graphite' ? 'graphite' : dark ? 'dark' : 'light';
      document.documentElement.style.setProperty('--accent', accent);
      document.documentElement.style.setProperty('--accent-soft', `color-mix(in srgb, ${accent} 18%, var(--surface))`);
      document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme === 'graphite' ? '#0b0b0c' : dark ? '#151412' : '#f7f4ee');
    };
    apply();
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    mq.addEventListener('change', apply);
    return () => mq.removeEventListener('change', apply);
  }, [theme, accent]);
  // tamaño del texto: escala el contenido de las pantallas (las barras fijas quedan igual)
  const fontScale = useStore((s) => s.settings.fontScale ?? 1);
  useEffect(() => { document.documentElement.style.setProperty('--ui-zoom', String(fontScale)); }, [fontScale]);
  useEffect(() => (session ? startSync() : undefined), [session?.user, session?.token]); // eslint-disable-line

  // Versiones nuevas: se revisa al abrir, cada 15 minutos y al volver a la app.
  // Al volver a la app (o al abrirla) se actualiza sola si no hay nada a medio hacer; si no, aparece el botón "Actualizar".
  useEffect(() => {
    const busy = () => !!document.querySelector('.overlay, .sheet-overlay') || !!useStopwatch.getState().habitId;
    const check = async (autoApply: boolean) => {
      if (!(await checkForUpdate())) return;
      if (autoApply && !busy()) {
        await flush().catch(() => {});
        applyUpdate();
      }
    };
    const first = setTimeout(() => check(true), 3000);
    const every = setInterval(() => check(false), 15 * 60 * 1000);
    const onVisible = () => document.visibilityState === 'visible' && check(true);
    document.addEventListener('visibilitychange', onVisible);
    return () => { clearTimeout(first); clearInterval(every); document.removeEventListener('visibilitychange', onVisible); };
  }, []);

  return session ? <App /> : <><Login /><UpdateBanner /><Toasts /><Dialogs /></>;
}

/** Aviso de versión nueva con botón para actualizar. */
function UpdateBanner() {
  const available = useUpdate((s) => s.available);
  if (!available) return null;
  return (
    <div className="update-banner" role="status">
      <span>✨ Hay una versión nueva de Ritmo</span>
      <button className="btn sm primary" onClick={async () => { await flush().catch(() => {}); applyUpdate(); }}>Actualizar</button>
    </div>
  );
}

function App() {
  const route = useRoute();
  const page = route[0] ?? 'today';
  const data = useStore();
  const [palette, setPalette] = useState(false);
  const [newHabit, setNewHabit] = useState(false);
  const [more, setMore] = useState(false);

  // Pomodoro: revisa el temporizador en cualquier pestaña y avisa al terminar cada fase
  useEffect(() => {
    setFinishListener(({ finished, next, minutes }) => {
      const s = getData().settings;
      if (s.sound) chime(true);
      try { navigator.vibrate?.([200, 100, 200]); } catch { /* sin vibración */ }
      const msg = finished === 'work' ? `🍅 Pomodoro terminado (${minutes} min). Ahora: ${PHASE_LABEL[next].toLowerCase()}.`
        : finished === 'free' ? `Terminaste ${minutes} min de foco.` : '☕ Fin del descanso. ¡A enfocarse!';
      toast(msg);
      if (finished === 'work' && s.confetti) confetti(window.innerWidth / 2, window.innerHeight / 3, 90);
      if ('Notification' in window && Notification.permission === 'granted') {
        try { new Notification('Ritmo', { body: msg, icon: './icon.svg' }); } catch { /* algunos navegadores solo permiten notificar desde el service worker */ }
      }
    });
    const i = setInterval(checkTimer, 1000);
    const vis = () => checkTimer();
    document.addEventListener('visibilitychange', vis);
    checkTimer();
    return () => { clearInterval(i); document.removeEventListener('visibilitychange', vis); };
  }, []);


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
        // aviso a la hora del recordatorio, o si no tiene, a la hora de inicio de su horario
        const at = h.reminder || slotFor(h, today)?.start;
        if (at !== hhmm || !isScheduled(h, today) || isDone(h, entryOf(d.logs, today, h.id), today)) continue;
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
  // aviso al subir de nivel (no al cargar la app ni al cambiar de cuenta)
  const prevLevel = useRef<number | null>(null);
  useEffect(() => {
    const prev = prevLevel.current;
    prevLevel.current = lv.level;
    if (prev !== null && lv.level === prev + 1) {
      setTimeout(() => toast(`¡Subiste a nivel ${lv.level}: ${levelTitle(lv.level)}!`, '⭐'), 600);
      if (getData().settings.confetti) setTimeout(() => confetti(window.innerWidth / 2, 120, 160), 600);
    }
  }, [lv.level]);

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
      case 'ajustes': return <Settings />;
      case 'coach': return <Coach />;
      case 'dia': return <Day />;
      default: return <Today />;
    }
  })();
  const active = page === 'habit' ? 'habits' : page;
  const go = (id: string) => { setMore(false); navigate(id); };

  return (
    <div className="app">
      <aside className="sidebar">
        <div className="brand">
          <BrandMark size={32} />
          <span className="brand-name">Ritmo</span>
          <button className="btn ghost icon" style={{ marginLeft: 'auto' }} title="Ajustes" aria-label="Ajustes" onClick={() => navigate('ajustes')}>⚙️</button>
        </div>
        <TimerPill />
        <div style={{ padding: '0 6px 10px' }}><SyncDot label /></div>
        <button className="nav-item" onClick={() => setPalette(true)} style={{ border: '1px solid var(--line)', marginBottom: 10, color: 'var(--ink-3)' }}>
          <span className="ico">🔎</span><span className="grow">Buscar…</span><kbd>⌘K</kbd>
        </button>
        {NAV.map((n, i) => (
          <Fragment key={n.id}>
            {i === 6 && <div className="nav-section">Crecimiento</div>}
            {i === 9 && <div className="nav-section">Sistema</div>}
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

      <header className="topbar">
        <button className="brand" style={{ border: 0, background: 'transparent', padding: 0 }} onClick={() => go('today')}>
          <BrandMark size={30} />
          <span className="brand-name" style={{ fontSize: 24 }}>Ritmo</span>
        </button>
        <TimerPill compact />
        <SyncDot />
        <div className="row" style={{ gap: 2, marginLeft: 'auto' }}>
          <button className="btn ghost icon" aria-label="Nuevo hábito" onClick={() => setNewHabit(true)}>＋</button>
          <button className="btn ghost icon" aria-label="Buscar" onClick={() => setPalette(true)}>🔎</button>
          <button className={`btn ghost icon ${active === 'ajustes' ? 'on' : ''}`} aria-label="Ajustes" onClick={() => go('ajustes')}>⚙️</button>
        </div>
      </header>

      <main className="main"><div className="page-anim" key={route.join("-")}>{content}</div></main>

      <nav className="mobile-nav">
        {NAV.filter((n) => MOBILE.includes(n.id)).map((n) => (
          <button key={n.id} className={active === n.id && !more ? 'active' : ''} onClick={() => go(n.id)}>
            <span className="ico">{n.ico}</span>{n.label}
          </button>
        ))}
        <button className={more || (!MOBILE.includes(active)) ? 'active' : ''} onClick={() => setMore((m) => !m)}><span className="ico">☰</span>Más</button>
      </nav>

      {more && (
        <div className="sheet-overlay" onClick={(e) => e.target === e.currentTarget && setMore(false)}>
          <div className="sheet">
            <div className="sheet-grid">
              {NAV.filter((n) => !MOBILE.includes(n.id)).map((n) => (
                <button key={n.id} className={`sheet-item ${active === n.id ? 'active' : ''}`} onClick={() => go(n.id)}>
                  <span className="ico">{n.ico}</span>{n.label}
                </button>
              ))}
              <button className="sheet-item" onClick={() => { setMore(false); setNewHabit(true); }}><span className="ico">➕</span>Nuevo hábito</button>
              <button className="sheet-item" onClick={() => { setMore(false); setPalette(true); }}><span className="ico">🔎</span>Buscar</button>
            </div>
          </div>
        </div>
      )}

      {palette && <Palette onClose={() => setPalette(false)} onNew={() => { setPalette(false); setNewHabit(true); }} />}
      <HabitForm open={newHabit} onClose={() => setNewHabit(false)} />
      <InstallBanner />
      <UpdateBanner />
      <StopwatchBar />
      <TimeChooser />
      <Toasts />
      <Dialogs />
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
      { ico: '🌗', label: 'Cambiar tema', run: () => data.setSettings({ theme: document.documentElement.dataset.theme === 'light' ? 'dark' : 'light' }) },
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

/** Muestra el pomodoro en curso desde cualquier pestaña. */
function TimerPill({ compact }: { compact?: boolean }) {
  const t = useTimer();
  const now = useNow(t.running);
  const left = secondsLeft(t, now);
  // visible mientras corre o si quedó pausado a mitad de una fase
  if (!t.running && left >= phaseMinutes(t.phase, t.freeMinutes) * 60) return null;
  const mm = `${String(Math.floor(left / 60)).padStart(2, '0')}:${String(left % 60).padStart(2, '0')}`;
  const isBreak = t.phase === 'short' || t.phase === 'long';
  return (
    <button className={`timer-pill ${isBreak ? 'break' : ''} ${compact ? 'compact' : ''}`} onClick={() => navigate('focus')} aria-label={`${PHASE_LABEL[t.phase]}: quedan ${mm}`}>
      <span>{isBreak ? '☕' : '🍅'}</span><b>{mm}</b>{!compact && <span className="muted">{PHASE_LABEL[t.phase]}</span>}
    </button>
  );
}

/** Punto de estado de la sincronización con la nube. */
function SyncDot({ label }: { label?: boolean }) {
  const status = useCloud((s) => s.status);
  const user = useCloud((s) => s.session?.user);
  const text = { idle: 'Conectado', saving: 'Guardando…', saved: 'Guardado en la nube', offline: 'Sin conexión: se guarda al volver', error: 'Error al guardar' }[status];
  return (
    <button className={`sync-dot ${status}`} title={text} aria-label={text} onClick={() => navigate('ajustes')}>
      <span className="dot" />{label && <span className="small"><b>@{user}</b> · {text}</span>}
    </button>
  );
}
