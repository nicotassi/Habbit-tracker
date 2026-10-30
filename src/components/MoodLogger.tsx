import { useEffect, useState } from 'react';
import { useStore } from '../lib/store';
import type { MoodEntry } from '../lib/types';
import { toast } from './ui';

export const MOODS = [
  { v: 1, face: '😣', label: 'Muy mal', color: '#c2483d' },
  { v: 2, face: '😕', label: 'Mal', color: '#d08a4a' },
  { v: 3, face: '😐', label: 'Normal', color: '#c9a227' },
  { v: 4, face: '🙂', label: 'Bien', color: '#7aa85a' },
  { v: 5, face: '😄', label: 'Genial', color: '#3f8f5a' },
];
export const moodFace = (v?: number | null) => (v ? MOODS[Math.round(v) - 1]?.face : '·');
export const moodColor = (v?: number | null) => (v ? MOODS[Math.max(0, Math.min(4, Math.round(v) - 1))].color : 'var(--bg-2)');

export const EMOTIONS = ['tranquilo', 'contento', 'motivado', 'agradecido', 'enfocado', 'creativo', 'enamorado', 'orgulloso', 'cansado', 'ansioso', 'triste', 'irritable', 'aburrido', 'abrumado', 'solo', 'nostálgico'];
export const TAGS = ['trabajo', 'familia', 'amigos', 'pareja', 'deporte', 'naturaleza', 'salida', 'viaje', 'lluvia', 'sol', 'enfermo', 'estudio', 'proyecto', 'música', 'cine', 'cocina'];

export function MoodLogger({ date, compact }: { date: string; compact?: boolean }) {
  const mood = useStore((s) => s.moods[date]);
  const setMood = useStore((s) => s.setMood);
  const [open, setOpen] = useState(!compact);
  const [note, setNote] = useState(mood?.note ?? '');
  const [grat, setGrat] = useState('');
  const [customTag, setCustomTag] = useState('');
  useEffect(() => setNote(mood?.note ?? ''), [date, mood?.note]);

  const patch = (p: Partial<MoodEntry>) => setMood(date, p);
  const toggle = (key: 'emotions' | 'tags', v: string) => {
    const cur = mood?.[key] ?? [];
    patch({ [key]: cur.includes(v) ? cur.filter((x) => x !== v) : [...cur, v] });
  };

  return (
    <div className="col" style={{ gap: 14 }}>
      <div className="mood-scale">
        {MOODS.map((m) => (
          <button key={m.v} className={`mood-btn ${mood?.mood === m.v ? 'on' : ''}`} onClick={() => { patch({ mood: m.v }); if (!mood) toast('Ánimo registrado', m.face); setOpen(true); }}>
            <span className="face">{m.face}</span>
            <span>{m.label}</span>
          </button>
        ))}
      </div>
      {compact && mood && !open && (
        <button className="btn ghost sm" style={{ alignSelf: 'flex-start' }} onClick={() => setOpen(true)}>+ Energía, estrés, sueño, emociones, notas…</button>
      )}
      {open && mood && (
        <>
          <div className="grid g3">
            <Slider label="⚡ Energía" value={mood.energy} onChange={(v) => patch({ energy: v })} />
            <Slider label="🌪 Estrés" value={mood.stress} onChange={(v) => patch({ stress: v })} />
            <div className="field">
              <span className="label">😴 Horas de sueño</span>
              <div className="row">
                <input className="slider" type="range" min={0} max={12} step={0.5} value={mood.sleep ?? 7} onChange={(e) => patch({ sleep: Number(e.target.value) })} />
                <b style={{ minWidth: 34 }}>{mood.sleep ?? '–'}</b>
              </div>
            </div>
          </div>
          <div>
            <span className="label">Emociones</span>
            <div className="row wrap" style={{ gap: 6 }}>
              {EMOTIONS.map((e) => (
                <button key={e} className={`chip ${mood.emotions.includes(e) ? 'on' : ''}`} onClick={() => toggle('emotions', e)}>{e}</button>
              ))}
            </div>
          </div>
          <div>
            <span className="label">¿Qué pasó hoy?</span>
            <div className="row wrap" style={{ gap: 6 }}>
              {Array.from(new Set([...TAGS, ...mood.tags])).map((t) => (
                <button key={t} className={`chip ${mood.tags.includes(t) ? 'on' : ''}`} onClick={() => toggle('tags', t)}>#{t}</button>
              ))}
              <input className="input" style={{ width: 130, padding: '5px 10px', borderRadius: 999 }} placeholder="+ etiqueta" value={customTag}
                onChange={(e) => setCustomTag(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter' && customTag.trim()) { toggle('tags', customTag.trim().toLowerCase()); setCustomTag(''); } }} />
            </div>
          </div>
          <div>
            <span className="label">🙏 Gratitud</span>
            <div className="col" style={{ gap: 6 }}>
              {mood.gratitude.map((g, i) => (
                <div key={i} className="row small">
                  <span>•</span><span className="grow">{g}</span>
                  <button className="btn ghost sm" onClick={() => patch({ gratitude: mood.gratitude.filter((_, j) => j !== i) })}>✕</button>
                </div>
              ))}
              <input className="input" placeholder="Hoy agradezco…" value={grat} onChange={(e) => setGrat(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter' && grat.trim()) { patch({ gratitude: [...mood.gratitude, grat.trim()] }); setGrat(''); } }} />
            </div>
          </div>
          <div>
            <span className="label">📓 Diario</span>
            <textarea className="textarea" placeholder="¿Cómo fue tu día? ¿Qué aprendiste?" value={note} onChange={(e) => setNote(e.target.value)} onBlur={() => note !== mood.note && patch({ note })} />
          </div>
        </>
      )}
    </div>
  );
}

function Slider({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <div className="field">
      <span className="label">{label}</span>
      <div className="row">
        <input className="slider" type="range" min={1} max={5} value={value} onChange={(e) => onChange(Number(e.target.value))} />
        <b style={{ minWidth: 20 }}>{value}</b>
      </div>
    </div>
  );
}
