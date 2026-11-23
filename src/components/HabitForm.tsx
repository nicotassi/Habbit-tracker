import { useEffect, useState } from 'react';
import type { Frequency, Habit, HabitKind, HabitSchedule, TimeOfDay, TimeSlot } from '../lib/types';
import { useStore } from '../lib/store';
import { WEEKDAYS_LETTER } from '../lib/date';
import { Modal, Seg, toast } from './ui';

export const COLORS = ['#c8643b', '#d4574a', '#d08a4a', '#c9a227', '#5aa469', '#3f8f7a', '#4ea3d9', '#5b6ee1', '#8b7fd1', '#b5838d', '#d16ba5', '#5f6b7a'];
export const EMOJIS = '💧🧘📚🏋️🚶🏃🚴🧗🏊🥗🍎🥦☕🚭🍷📵💤😴🛏️🌅🧠✍️📝🎨🎸🎹🗣️💻📈💰🧹🧺🌱🌿🪴🐶🙏❤️🫶😊🧴🦷💊🌞📖🎧🧩♟️🎯⏰📞👨‍👩‍👧🤝🚰🥤🍫🎮📺🛒🧾✈️'.match(/\p{Extended_Pictographic}(‍\p{Extended_Pictographic})*️?/gu) ?? [];

export const TEMPLATES: Partial<Habit>[] = [
  { name: 'Tomar agua', emoji: '💧', kind: 'count', target: 8, unit: 'vasos', category: 'Salud', color: '#4ea3d9' },
  { name: 'Meditar', emoji: '🧘', kind: 'quantity', target: 10, unit: 'min', category: 'Mente', color: '#8b7fd1', timeOfDay: 'morning' },
  { name: 'Leer', emoji: '📚', kind: 'quantity', target: 20, unit: 'páginas', category: 'Mente', color: '#d08a4a', timeOfDay: 'evening' },
  { name: 'Entrenar', emoji: '🏋️', kind: 'check', frequency: { type: 'perWeek', times: 3 }, category: 'Salud', color: '#d4574a' },
  { name: 'Caminar', emoji: '🚶', kind: 'quantity', target: 8000, unit: 'pasos', category: 'Salud', color: '#5aa469' },
  { name: 'Dormir 8 h', emoji: '😴', kind: 'check', category: 'Salud', color: '#5b6ee1', timeOfDay: 'evening' },
  { name: 'No fumar', emoji: '🚭', kind: 'avoid', category: 'Salud', color: '#5f6b7a' },
  { name: 'Sin azúcar', emoji: '🍫', kind: 'avoid', category: 'Salud', color: '#b5838d' },
  { name: 'Escribir diario', emoji: '✍️', kind: 'check', category: 'Mente', color: '#b5838d', timeOfDay: 'evening' },
  { name: 'Practicar idioma', emoji: '🗣️', kind: 'quantity', target: 15, unit: 'min', category: 'Aprendizaje', color: '#c9a227' },
  { name: 'Ahorrar', emoji: '💰', kind: 'quantity', target: 1000, unit: '$', category: 'Finanzas', color: '#3f8f7a' },
  { name: 'Llamar a alguien querido', emoji: '📞', kind: 'check', frequency: { type: 'perWeek', times: 2 }, category: 'Vínculos', color: '#d16ba5' },
];

type Draft = Omit<Habit, 'id' | 'createdAt' | 'archived' | 'order'>;

const blank = (): Draft => ({
  name: '',
  emoji: '🌱',
  color: COLORS[0],
  kind: 'check',
  target: 1,
  unit: '',
  frequency: { type: 'daily' },
  category: 'General',
  timeOfDay: 'any',
  reminder: '',
  why: '',
});

export function HabitForm({ open, onClose, habit }: { open: boolean; onClose: () => void; habit?: Habit | null }) {
  const { addHabit, updateHabit, habits } = useStore();
  const [d, setD] = useState<Draft>(blank());
  const [showEmoji, setShowEmoji] = useState(false);
  useEffect(() => {
    if (open) setD(habit ? { ...blank(), ...habit } : blank());
    setShowEmoji(false);
  }, [open, habit]);
  const categories = Array.from(new Set(['General', 'Salud', 'Mente', 'Aprendizaje', 'Trabajo', 'Vínculos', 'Finanzas', ...habits.map((h) => h.category)]));
  const set = (p: Partial<Draft>) => setD((x) => ({ ...x, ...p }));
  const setFreq = (f: Frequency) => set({ frequency: f });
  const save = () => {
    if (!d.name.trim()) return toast('Ponele un nombre al hábito', '✏️');
    const schedule = cleanSchedule(d);
    if (schedule === 'error') return;
    const clean: Draft = { ...d, schedule, name: d.name.trim(), target: d.kind === 'check' || d.kind === 'avoid' ? 1 : Math.max(1, Number(d.target) || 1) };
    if (habit) {
      updateHabit(habit.id, clean);
      toast('Hábito actualizado', '✨');
    } else {
      addHabit(clean);
      toast(`${clean.emoji} ${clean.name} agregado`, '🌱');
    }
    onClose();
  };
  return (
    <Modal open={open} onClose={onClose}>
      <div className="row between" style={{ marginBottom: 18 }}>
        <h2 className="h2">{habit ? 'Editar hábito' : 'Nuevo hábito'}</h2>
        <button className="btn ghost icon" onClick={onClose}>✕</button>
      </div>

      {!habit && (
        <div style={{ marginBottom: 18 }}>
          <span className="label">Plantillas rápidas</span>
          <div className="row wrap" style={{ gap: 6 }}>
            {TEMPLATES.map((t) => (
              <button key={t.name} className="chip" onClick={() => setD({ ...blank(), ...t } as Draft)}>
                {t.emoji} {t.name}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="col" style={{ gap: 16 }}>
        <div className="row" style={{ alignItems: 'flex-end' }}>
          <button
            className="habit-emoji" type="button"
            style={{ background: `color-mix(in srgb, ${d.color} 18%, transparent)`, border: 0, width: 48, height: 48, fontSize: 24 }}
            onClick={() => setShowEmoji((v) => !v)}
          >
            {d.emoji}
          </button>
          <div className="field grow">
            <label className="label">Nombre</label>
            <input className="input" autoFocus value={d.name} placeholder="Ej: Meditar, Leer, Tomar agua…" onChange={(e) => set({ name: e.target.value })} onKeyDown={(e) => e.key === 'Enter' && save()} />
          </div>
        </div>
        {showEmoji && (
          <div>
            <div className="emoji-grid">
              {EMOJIS.map((e) => (
                <button key={e} className={d.emoji === e ? 'on' : ''} onClick={() => { set({ emoji: e }); setShowEmoji(false); }}>{e}</button>
              ))}
            </div>
            <input className="input" style={{ marginTop: 6 }} placeholder="…o pegá cualquier emoji" maxLength={4} onChange={(e) => e.target.value && set({ emoji: e.target.value })} />
          </div>
        )}

        <div className="field">
          <span className="label">Color</span>
          <div className="swatches">
            {COLORS.map((c) => (
              <button key={c} className={`swatch ${d.color === c ? 'on' : ''}`} style={{ background: c }} onClick={() => set({ color: c })} />
            ))}
          </div>
        </div>

        <div className="field">
          <span className="label">Tipo</span>
          <Seg<HabitKind>
            value={d.kind}
            onChange={(k) => set({ kind: k, target: k === 'count' ? 8 : k === 'quantity' ? 30 : 1, unit: k === 'count' ? 'veces' : k === 'quantity' ? 'min' : '' })}
            options={[
              { v: 'check', l: '✓ Sí / No' },
              { v: 'count', l: '# Contador' },
              { v: 'quantity', l: '⏱ Cantidad' },
              { v: 'avoid', l: '🚫 Evitar' },
            ]}
          />
          <span className="tiny muted" style={{ marginTop: 6 }}>
            {d.kind === 'check' && 'Lo hiciste o no. Simple.'}
            {d.kind === 'count' && 'Sumá de a uno hasta llegar a la meta (vasos de agua, series…).'}
            {d.kind === 'quantity' && 'Registrá un número con unidad (minutos, páginas, km, $…).'}
            {d.kind === 'avoid' && 'Un mal hábito a dejar. Cada día limpio cuenta; marcá si recaíste.'}
          </span>
        </div>

        {d.kind !== 'avoid' && (
          <div className="field">
            <span className="label">Cómo se cumple</span>
            <Seg<'mark' | 'time'>
              value={d.trackTime ? 'time' : 'mark'}
              onChange={(v) => set({ trackTime: v === 'time' })}
              options={[{ v: 'mark', l: '✓ Solo marcar' }, { v: 'time', l: '⏱ Cuenta tiempo' }]}
            />
            <span className="tiny muted" style={{ marginTop: 6 }}>
              {d.trackTime
                ? 'Aparece un botón ▶ para iniciarlo con cronómetro o pomodoro, y se registra cuánto tiempo le dedicaste cada día.'
                : 'Se marca con un toque, sin cronómetro.'}
            </span>
          </div>
        )}

        <button type="button" className={`nn-toggle ${d.nonNegotiable ? 'on' : ''}`} onClick={() => set({ nonNegotiable: !d.nonNegotiable })} aria-pressed={!!d.nonNegotiable}>
          <span className="nn-ico">🔒</span>
          <span className="grow" style={{ textAlign: 'left' }}>
            <b>No negociable</b>
            <span className="tiny muted" style={{ display: 'block' }}>Lo que tenés que hacer sí o sí. Va primero en Hoy, se destaca y te aviso si queda pendiente.</span>
          </span>
          <span className={`switch ${d.nonNegotiable ? 'on' : ''}`} aria-hidden="true"><i /></span>
        </button>

        {(d.kind === 'count' || d.kind === 'quantity') && (
          <div className="grid g2">
            <div className="field">
              <label className="label">Meta diaria</label>
              <input className="input" type="number" min={1} value={d.target} onChange={(e) => set({ target: Number(e.target.value) })} />
            </div>
            <div className="field">
              <label className="label">Unidad</label>
              <input className="input" value={d.unit} placeholder="min, páginas, km…" onChange={(e) => set({ unit: e.target.value })} />
            </div>
          </div>
        )}

        <div className="field">
          <span className="label">Frecuencia</span>
          <Seg
            value={d.frequency.type}
            onChange={(t) => setFreq(t === 'daily' ? { type: 'daily' } : t === 'weekdays' ? { type: 'weekdays', days: [1, 2, 3, 4, 5] } : { type: 'perWeek', times: 3 })}
            options={[
              { v: 'daily', l: 'Todos los días' },
              { v: 'weekdays', l: 'Días específicos' },
              { v: 'perWeek', l: 'X veces por semana' },
            ]}
          />
          {d.frequency.type === 'weekdays' && (
            <div className="day-picks" style={{ marginTop: 10 }}>
              {[1, 2, 3, 4, 5, 6, 0].map((i) => {
                const f = d.frequency as { type: 'weekdays'; days: number[] };
                const on = f.days.includes(i);
                return (
                  <button key={i} className={`chip ${on ? 'on' : ''}`}
                    onClick={() => setFreq({ type: 'weekdays', days: on ? f.days.filter((x) => x !== i) : [...f.days, i] })}>
                    {WEEKDAYS_LETTER[i]}
                  </button>
                );
              })}
            </div>
          )}
          {d.frequency.type === 'perWeek' && (
            <div className="row" style={{ marginTop: 10 }}>
              <input className="slider" type="range" min={1} max={7} value={d.frequency.times} onChange={(e) => setFreq({ type: 'perWeek', times: Number(e.target.value) })} />
              <b style={{ minWidth: 90 }}>{d.frequency.times} por semana</b>
            </div>
          )}
        </div>

        <ScheduleField draft={d} set={set} />

        <div className="grid g2">
          <div className="field">
            <label className="label">Categoría</label>
            <input className="input" list="cats" value={d.category} onChange={(e) => set({ category: e.target.value })} />
            <datalist id="cats">{categories.map((c) => <option key={c} value={c} />)}</datalist>
          </div>
          <div className="field">
            <label className="label">Momento del día{d.schedule ? <span className="muted"> (sin horario)</span> : ''}</label>
            <select className="select" value={d.timeOfDay} onChange={(e) => set({ timeOfDay: e.target.value as TimeOfDay })}>
              <option value="any">En cualquier momento</option>
              <option value="morning">🌅 Mañana</option>
              <option value="afternoon">☀️ Tarde</option>
              <option value="evening">🌙 Noche</option>
            </select>
          </div>
        </div>

        <div className="grid g2">
          <div className="field">
            <label className="label">Recordatorio{d.schedule ? <span className="muted"> (opcional)</span> : ''}</label>
            <input className="input" type="time" value={d.reminder ?? ''} onChange={(e) => set({ reminder: e.target.value })} />
            {d.schedule && <span className="tiny muted" style={{ marginTop: 4 }}>Si lo dejás vacío, te aviso a la hora de inicio del horario.</span>}
          </div>
          <div className="field">
            <label className="label">¿Por qué lo hacés?</label>
            <input className="input" value={d.why ?? ''} placeholder="Tu motivación" onChange={(e) => set({ why: e.target.value })} />
          </div>
        </div>

        <div className="row" style={{ justifyContent: 'flex-end', marginTop: 6 }}>
          <button className="btn ghost" onClick={onClose}>Cancelar</button>
          <button className="btn primary" onClick={save}>{habit ? 'Guardar cambios' : 'Crear hábito'}</button>
        </div>
      </div>
    </Modal>
  );
}

/* ---------- Horario ---------- */

const DAY_ORDER = [1, 2, 3, 4, 5, 6, 0];
const DAY_NAMES = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];

/** Días en que corresponde el hábito según su frecuencia (en orden de lunes a domingo). */
const daysOf = (f: Frequency) => (f.type === 'weekdays' ? DAY_ORDER.filter((x) => f.days.includes(x)) : DAY_ORDER);

/** Valida el horario del borrador. undefined = sin horario; 'error' = no se puede guardar. */
function cleanSchedule(d: Draft): HabitSchedule | undefined | 'error' {
  const s = d.schedule;
  if (!s) return undefined;
  const bad = (x: TimeSlot) => !!x.end && x.end === x.start;
  if (s.mode === 'same') {
    if (!s.slot?.start) {
      toast('Poné la hora de inicio del horario (o elegí “Sin horario”)', '🕐');
      return 'error';
    }
    if (bad(s.slot)) { toast('La hora de fin tiene que ser distinta a la de inicio', '🕐'); return 'error'; }
    return { mode: 'same', slot: { start: s.slot.start, ...(s.slot.end ? { end: s.slot.end } : {}) } };
  }
  const perDay: Record<number, TimeSlot> = {};
  for (const day of daysOf(d.frequency)) {
    const x = s.perDay?.[day];
    if (!x?.start) continue;
    if (bad(x)) { toast(`${DAY_NAMES[day]}: la hora de fin tiene que ser distinta a la de inicio`, '🕐'); return 'error'; }
    perDay[day] = { start: x.start, ...(x.end ? { end: x.end } : {}) };
  }
  if (!Object.keys(perDay).length) {
    toast('Poné la hora de inicio de al menos un día (o elegí “Sin horario”)', '🕐');
    return 'error';
  }
  return { mode: 'perDay', perDay };
}

function ScheduleField({ draft: d, set }: { draft: Draft; set: (p: Partial<Draft>) => void }) {
  const s = d.schedule;
  const mode: 'none' | 'same' | 'perDay' = s ? s.mode : 'none';
  const days = daysOf(d.frequency);
  const changeMode = (m: 'none' | 'same' | 'perDay') => {
    if (m === 'none') return set({ schedule: undefined });
    if (m === 'same') {
      const first = s?.mode === 'perDay' ? Object.values(s.perDay ?? {}).find((x) => x?.start) : s?.slot;
      return set({ schedule: { mode: 'same', slot: first ?? { start: '' } } });
    }
    // distinto por día: arranca con el horario general en cada día
    const base = s?.mode === 'same' ? s.slot : undefined;
    const perDay: Record<number, TimeSlot> = { ...(s?.perDay ?? {}) };
    for (const day of days) if (!perDay[day] && base?.start) perDay[day] = { ...base };
    set({ schedule: { mode: 'perDay', perDay } });
  };
  const setSame = (p: Partial<TimeSlot>) => set({ schedule: { mode: 'same', slot: { start: '', ...s?.slot, ...p } } });
  const setDay = (day: number, p: Partial<TimeSlot>) =>
    set({ schedule: { mode: 'perDay', perDay: { ...(s?.perDay ?? {}), [day]: { start: '', ...s?.perDay?.[day], ...p } } } });
  const copyToAll = (day: number) => {
    const src = s?.perDay?.[day];
    if (!src?.start) return toast('Primero poné el horario de ese día', '🕐');
    const perDay: Record<number, TimeSlot> = {};
    for (const x of days) perDay[x] = { ...src };
    set({ schedule: { mode: 'perDay', perDay } });
    toast('Horario copiado a todos los días', '📋');
  };

  return (
    <div className="field">
      <span className="label">Horario</span>
      <Seg value={mode} onChange={changeMode}
        options={[{ v: 'none', l: 'Sin horario' }, { v: 'same', l: 'Igual cada día' }, { v: 'perDay', l: 'Distinto por día' }]} />
      {mode === 'same' && (
        <div className="slot-row" style={{ marginTop: 10 }}>
          <label className="slot-field"><span className="tiny muted">Desde</span>
            <input id="schedule-start" className="input" type="time" value={s?.slot?.start ?? ''} onChange={(e) => setSame({ start: e.target.value })} />
          </label>
          <label className="slot-field"><span className="tiny muted">Hasta (opcional)</span>
            <input id="schedule-end" className="input" type="time" value={s?.slot?.end ?? ''} onChange={(e) => setSame({ end: e.target.value || undefined })} />
          </label>
        </div>
      )}
      {mode === 'perDay' && (
        <div className="slot-grid" style={{ marginTop: 10 }}>
          {days.map((day, i) => (
            <div key={day} style={{ display: 'contents' }}>
              <span className="slot-day">{DAY_NAMES[day].slice(0, 3)}</span>
              <input id={`schedule-start-${day}`} aria-label={`${DAY_NAMES[day]}: desde`} className="input" type="time" value={s?.perDay?.[day]?.start ?? ''} onChange={(e) => setDay(day, { start: e.target.value })} />
              <span className="muted">a</span>
              <input id={`schedule-end-${day}`} aria-label={`${DAY_NAMES[day]}: hasta (opcional)`} className="input" type="time" value={s?.perDay?.[day]?.end ?? ''} onChange={(e) => setDay(day, { end: e.target.value || undefined })} />
              {i === 0 && days.length > 1 && <button type="button" className="btn ghost sm slot-copy" onClick={() => copyToAll(day)} title="Copiar este horario a todos los días">Copiar a todos</button>}
            </div>
          ))}
        </div>
      )}
      <span className="tiny muted" style={{ marginTop: 6 }}>
        {mode === 'none' && 'Opcional. Con horario, el hábito se ordena por hora en Hoy y te avisa a tiempo.'}
        {mode === 'same' && 'Se aplica a cada día de la frecuencia elegida arriba.'}
        {mode === 'perDay' && (d.frequency.type === 'weekdays'
          ? 'Un horario para cada día elegido en la frecuencia. Si dejás un día vacío, ese día queda sin horario.'
          : 'Un horario para cada día de la semana. Si dejás un día vacío, ese día queda sin horario. Para elegir días, usá “Días específicos” en la frecuencia.')}
      </span>
    </div>
  );
}
