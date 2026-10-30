import { useEffect, useState } from 'react';
import type { Frequency, Habit, HabitKind, TimeOfDay } from '../lib/types';
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
    const clean: Draft = { ...d, name: d.name.trim(), target: d.kind === 'check' || d.kind === 'avoid' ? 1 : Math.max(1, Number(d.target) || 1) };
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
            <div className="row" style={{ marginTop: 10, gap: 6 }}>
              {[1, 2, 3, 4, 5, 6, 0].map((i) => {
                const f = d.frequency as { type: 'weekdays'; days: number[] };
                const on = f.days.includes(i);
                return (
                  <button key={i} className={`chip ${on ? 'on' : ''}`} style={{ width: 38, justifyContent: 'center' }}
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

        <div className="grid g2">
          <div className="field">
            <label className="label">Categoría</label>
            <input className="input" list="cats" value={d.category} onChange={(e) => set({ category: e.target.value })} />
            <datalist id="cats">{categories.map((c) => <option key={c} value={c} />)}</datalist>
          </div>
          <div className="field">
            <label className="label">Momento del día</label>
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
            <label className="label">Recordatorio</label>
            <input className="input" type="time" value={d.reminder ?? ''} onChange={(e) => set({ reminder: e.target.value })} />
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
