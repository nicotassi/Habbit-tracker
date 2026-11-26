import { useState, type ReactNode } from 'react';
import type { Habit } from '../lib/types';
import { useStore, getData } from '../lib/store';
import { dayStats, entryOf, isDone, progressOf, streaks, targetOn, timesOn, weekCount } from '../lib/stats';
import { fromKey, todayKey } from '../lib/date';
import { askText, chime, confetti, floatXP, toast } from './ui';
import { navigate } from '../router';
import { rescueOf } from '../lib/forecast';
import { fmtSlot, slotFor, slotStatus } from '../lib/schedule';
import { fmtDuration, TimeButton } from './HabitTimer';


export function celebrate(el: HTMLElement | null, date: string) {
  const { settings } = getData();
  const rect = el?.getBoundingClientRect();
  const x = rect ? rect.left + rect.width / 2 : window.innerWidth / 2;
  const y = rect ? rect.top + rect.height / 2 : window.innerHeight / 2;
  // esperar a que el store se actualice
  setTimeout(() => {
    const s = dayStats(getData(), date);
    const perfect = s.total > 0 && s.done === s.total;
    floatXP(x, y - 18);
    if (settings.confetti) confetti(x, y, perfect ? 160 : 36);
    if (settings.sound) chime(perfect);
    if (perfect) toast('¡Día perfecto! Completaste todo', '🌟');
  }, 0);
}

export function HabitRow({ habit: h, date }: { habit: Habit; date: string }) {
  const logs = useStore((s) => s.logs);
  const weekStart = useStore((s) => s.settings.weekStart);
  const setEntry = useStore((s) => s.setEntry);
  const updateHabit = useStore((s) => s.updateHabit);
  const [menu, setMenu] = useState(false);
  const e = entryOf(logs, date, h.id);
  const done = isDone(h, e, date);
  const prog = progressOf(h, e, date);
  const target = targetOn(h, date);
  const st = streaks(h, logs, weekStart, date);
  const value = e?.value ?? 0;
  const beforeStart = date < h.createdAt;
  const rescue = rescueOf(h, logs, date);
  const slot = slotFor(h, date);
  const status = slot && date === todayKey() && !done ? slotStatus(slot) : null;
  // al cargar un día pasado, la hora queda dentro de ese día (para el gráfico de horarios)
  const stamp = () => {
    if (date === todayKey()) return undefined;
    const now = new Date();
    return fromKey(date).getTime() + (now.getHours() * 60 + now.getMinutes()) * 60000;
  };

  const commit = (v: number, el: HTMLElement | null) => {
    const wasDone = done;
    setEntry(date, h.id, v <= 0 && !e?.note ? null : { ...e, value: Math.max(0, v), skipped: false, at: e?.at ?? stamp() });
    const nowDone = h.kind === 'check' ? v >= 1 : v >= target;
    if (!wasDone && nowDone) {
      celebrate(el, date);
      if (rescue?.state === 'rescue') setTimeout(() => toast('¡Rescatado! Nunca dos veces seguidas', '🛟'), 400);
    }
  };

  const step = h.kind === 'quantity' ? (target >= 1000 ? Math.round(target / 10) : target >= 100 ? 10 : target >= 20 ? 5 : 1) : 1;

  const weekly = h.frequency.type === 'perWeek' ? weekCount(h, logs, date, weekStart) : null;

  // un solo renglón de detalle, con lo más útil del momento (el resto está en el detalle del hábito)
  const meta: { text: ReactNode; cls?: string }[] = [];
  if (rescue?.state === 'rescue') meta.push({ text: `🛟 ${rescue.missed === 1 ? 'Ayer no salió' : `${rescue.missed} días sin hacerlo`}`, cls: 'm-warn' });
  if (rescue?.state === 'rescued') meta.push({ text: '🛟 Rescatado', cls: 'm-good' });
  if (h.kind === 'avoid') meta.push({ text: beforeStart && !e ? 'Sin registrar' : done ? 'Día limpio' : 'Recaída' });
  if (slot) meta.push({ text: <>🕐 {fmtSlot(slot)}{status && <b className={`slot-badge ${status.kind}`}> {status.label}</b>}</> });
  if (weekly !== null && h.frequency.type === 'perWeek') meta.push({ text: `${weekly}/${timesOn(h, date)} esta semana` });
  if (e?.skipped) meta.push({ text: '⏸ Salteado' });
  if (e?.seconds) meta.push({ text: `⏱ ${fmtDuration(e.seconds)}` });
  if (e?.note) meta.push({ text: '📝' });
  if (!meta.length && st.current >= 3) meta.push({ text: `🔥 ${st.current} ${st.unit}` });

  return (
    <div className={`habit-row ${done ? 'done' : ''} ${h.nonNegotiable ? 'nn' : ''}`}>
      <div className="fill" style={{ width: `${prog * 100}%`, background: h.color }} />
      <button className="habit-emoji" style={{ background: `color-mix(in srgb, ${h.color} 16%, transparent)`, border: 0 }} onClick={() => navigate(`habit/${h.id}`)}>
        {h.emoji}
      </button>
      <div className="grow" style={{ cursor: 'pointer' }} onClick={() => navigate(`habit/${h.id}`)}>
        <div className="habit-name">{h.nonNegotiable && <span className="nn-lock" title="No negociable">🔒 </span>}{h.name}</div>
        {meta.length > 0 && <div className="habit-meta">{meta.map((m, i) => <span key={i} className={m.cls}>{m.text}</span>)}</div>}
      </div>

      {(h.kind === 'count' || h.kind === 'quantity') && (
        <div className="stepper">
          <button onClick={(ev) => commit(value - step, ev.currentTarget)} aria-label="restar">−</button>
          <div className="val" onClick={async () => {
            const r = await askText(`${h.name}: ¿cuánto${h.unit ? ` (${h.unit})` : ''}?`, String(value), { ok: 'Guardar' });
            if (r !== null && r.trim() !== '' && !isNaN(Number(r.replace(',', '.')))) commit(Number(r.replace(',', '.')), null);
          }} style={{ cursor: 'text' }}>
            {value}<small>/{target}{h.unit ? ` ${h.unit}` : ''}</small>
          </div>
          <button onClick={(ev) => commit(value + step, ev.currentTarget)} aria-label="sumar">+</button>
        </div>
      )}

      {h.trackTime && h.kind !== 'avoid' && date === todayKey() && <TimeButton habit={h} />}

      {h.kind === 'check' && (
        <button className={`checkbtn ${done ? 'on' : ''}`} style={done ? { background: h.color } : undefined} onClick={(ev) => commit(done ? 0 : 1, ev.currentTarget)} aria-label="completar">
          {done ? '✓' : ''}
        </button>
      )}

      {h.kind === 'avoid' && beforeStart && !e && (
        <div className="row" style={{ gap: 4 }}>
          <button className="btn sm" onClick={() => { updateHabit(h.id, { createdAt: date }); toast('Día limpio registrado', '✨'); }}>Limpio</button>
          <button className="btn sm" onClick={() => setEntry(date, h.id, { value: 1 })}>Recaí</button>
        </div>
      )}

      {h.kind === 'avoid' && !(beforeStart && !e) && (
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
              onClick={async () => { setMenu(false); const n = await askText('Nota para este día', e?.note ?? '', { multiline: true, ok: 'Guardar nota' }); if (n !== null) setEntry(date, h.id, { ...e, value: e?.value ?? 0, note: n }); }}>
              📝 Agregar nota
            </button>
            {h.kind !== 'avoid' && (
              <button className="menu-item"
                onClick={async () => {
                  setMenu(false);
                  const r = await askText('Tiempo dedicado este día (minutos)', e?.seconds ? String(Math.round(e.seconds / 60)) : '', { ok: 'Guardar', body: 'Reemplaza el tiempo registrado. Dejalo vacío para borrarlo.' });
                  if (r === null) return;
                  const m = Number(r.replace(',', '.'));
                  if (r.trim() !== '' && (!isFinite(m) || m < 0)) return toast('Escribí los minutos con números', '⚠️');
                  setEntry(date, h.id, { ...e, value: e?.value ?? 0, seconds: r.trim() === '' ? undefined : Math.round(m * 60) });
                }}>
                ⏱ {e?.seconds ? 'Ajustar' : 'Cargar'} tiempo
              </button>
            )}
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
