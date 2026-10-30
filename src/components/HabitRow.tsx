import { useState } from 'react';
import type { Habit } from '../lib/types';
import { useStore, getData } from '../lib/store';
import { dayStats, entryOf, isDone, progressOf, streaks, weekCount } from '../lib/stats';
import { addDays, weekStartOf } from '../lib/date';
import { chime, confetti, toast } from './ui';
import { navigate } from '../router';

const TOD: Record<string, string> = { morning: '🌅 Mañana', afternoon: '☀️ Tarde', evening: '🌙 Noche' };

export function celebrate(el: HTMLElement | null, date: string) {
  const { settings } = getData();
  const rect = el?.getBoundingClientRect();
  const x = rect ? rect.left + rect.width / 2 : window.innerWidth / 2;
  const y = rect ? rect.top + rect.height / 2 : window.innerHeight / 2;
  // esperar a que el store se actualice
  setTimeout(() => {
    const s = dayStats(getData(), date);
    const perfect = s.total > 0 && s.done === s.total;
    if (settings.confetti) confetti(x, y, perfect ? 160 : 36);
    if (settings.sound) chime(perfect);
    if (perfect) toast('¡Día perfecto! Completaste todo', '🌟');
  }, 0);
}

export function HabitRow({ habit: h, date }: { habit: Habit; date: string }) {
  const logs = useStore((s) => s.logs);
  const weekStart = useStore((s) => s.settings.weekStart);
  const setEntry = useStore((s) => s.setEntry);
  const [menu, setMenu] = useState(false);
  const e = entryOf(logs, date, h.id);
  const done = isDone(h, e, date);
  const prog = progressOf(h, e);
  const st = streaks(h, logs, weekStart, date);
  const value = e?.value ?? 0;

  const commit = (v: number, el: HTMLElement | null) => {
    const wasDone = done;
    setEntry(date, h.id, v <= 0 && !e?.note ? null : { ...e, value: Math.max(0, v), skipped: false });
    const nowDone = h.kind === 'check' ? v >= 1 : v >= h.target;
    if (!wasDone && nowDone) celebrate(el, date);
  };

  const step = h.kind === 'quantity' ? (h.target >= 1000 ? Math.round(h.target / 10) : h.target >= 100 ? 10 : h.target >= 20 ? 5 : 1) : 1;

  const weekly = h.frequency.type === 'perWeek' ? weekCount(h, logs, date, weekStart) : null;
  const ws = weekStartOf(date, weekStart);

  return (
    <div className={`habit-row ${done ? 'done' : ''}`}>
      <div className="fill" style={{ width: `${prog * 100}%`, background: h.color }} />
      <button className="habit-emoji" style={{ background: `color-mix(in srgb, ${h.color} 16%, transparent)`, border: 0 }} onClick={() => navigate(`habit/${h.id}`)}>
        {h.emoji}
      </button>
      <div className="grow" style={{ cursor: 'pointer' }} onClick={() => navigate(`habit/${h.id}`)}>
        <div className="habit-name">{h.name}</div>
        <div className="habit-meta">
          {st.current > 0 && <span>🔥 {st.current} {st.unit}</span>}
          {h.kind === 'avoid' && <span>{done ? 'Día limpio' : 'Recaída registrada'}</span>}
          {h.timeOfDay !== 'any' && <span className="hide-mobile">{TOD[h.timeOfDay]}</span>}
          {weekly !== null && h.frequency.type === 'perWeek' && (
            <span className="row" style={{ gap: 6 }}>
              {weekly}/{h.frequency.times} esta semana
              <span className="week-dots">
                {Array.from({ length: 7 }, (_, i) => {
                  const d = addDays(ws, i);
                  return <span key={i} style={{ background: isDone(h, entryOf(logs, d, h.id), d) ? h.color : undefined }} />;
                })}
              </span>
            </span>
          )}
          {e?.skipped && <span>⏸ Día salteado</span>}
          {e?.note && <span title={e.note}>📝 {e.note.slice(0, 28)}{e.note.length > 28 ? '…' : ''}</span>}
        </div>
      </div>

      {(h.kind === 'count' || h.kind === 'quantity') && (
        <div className="stepper">
          <button onClick={(ev) => commit(value - step, ev.currentTarget)} aria-label="restar">−</button>
          <div className="val" onClick={() => {
            const r = prompt(`${h.name}: ¿cuánto${h.unit ? ` (${h.unit})` : ''}?`, String(value));
            if (r !== null && !isNaN(Number(r))) commit(Number(r), null);
          }} style={{ cursor: 'text' }}>
            {value}<small>/{h.target}{h.unit ? ` ${h.unit}` : ''}</small>
          </div>
          <button onClick={(ev) => commit(value + step, ev.currentTarget)} aria-label="sumar">+</button>
        </div>
      )}

      {h.kind === 'check' && (
        <button className={`checkbtn ${done ? 'on' : ''}`} style={done ? { background: h.color } : undefined} onClick={(ev) => commit(done ? 0 : 1, ev.currentTarget)} aria-label="completar">
          {done ? '✓' : ''}
        </button>
      )}

      {h.kind === 'avoid' && (
        <button className="btn sm" style={!done ? { background: 'var(--bad)', color: '#fff', borderColor: 'var(--bad)' } : undefined}
          onClick={() => setEntry(date, h.id, done ? { value: 1 } : null)}>
          {done ? 'Recaí' : 'Deshacer'}
        </button>
      )}

      <div style={{ position: 'relative' }}>
        <button className="btn ghost icon" onClick={() => setMenu((m) => !m)} aria-label="más">⋯</button>
        {menu && (
          <div className="card" style={{ position: 'absolute', right: 0, top: 40, zIndex: 20, padding: 6, width: 210 }} onMouseLeave={() => setMenu(false)}>
            <button className="menu-item"
              onClick={() => { const n = prompt('Nota para este día', e?.note ?? ''); if (n !== null) setEntry(date, h.id, { value: e?.value ?? 0, skipped: e?.skipped, note: n }); setMenu(false); }}>
              📝 Agregar nota
            </button>
            <button className="menu-item"
              onClick={() => { setEntry(date, h.id, e?.skipped ? null : { value: 0, skipped: true, note: e?.note }); setMenu(false); toast(e?.skipped ? 'Salteo quitado' : 'Día salteado: no rompe tu racha', '⏸'); }}>
              ⏸ {e?.skipped ? 'Quitar salteo' : 'Saltear hoy (justificado)'}
            </button>
            <button className="menu-item"
              onClick={() => navigate(`focus/${h.id}`)}>
              ⏱ Sesión de foco
            </button>
            <button className="menu-item"
              onClick={() => navigate(`habit/${h.id}`)}>
              📊 Ver estadísticas
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
