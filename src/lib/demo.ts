import type { AppData, Habit, Logs, MoodEntry } from './types';
import { addDays, fromKey, range, todayKey } from './date';
import { DEFAULT_SETTINGS, uid } from './store';

function rng(seed: number) {
  return () => {
    seed = (seed * 16807) % 2147483647;
    return (seed - 1) / 2147483646;
  };
}

/** Genera ~120 días de datos realistas para explorar la app. */
export function buildDemo(): AppData {
  const rand = rng(42);
  const today = todayKey();
  const start = addDays(today, -120);
  const mk = (p: Partial<Habit> & Pick<Habit, 'name' | 'emoji' | 'color' | 'kind'>, i: number): Habit => ({
    id: uid(),
    target: 1,
    frequency: { type: 'daily' },
    category: 'General',
    timeOfDay: 'any',
    createdAt: start,
    archived: false,
    order: i,
    ...p,
  });
  const habits: Habit[] = [
    mk({ name: 'Meditar', emoji: '🧘', color: '#8b7fd1', kind: 'quantity', target: 10, unit: 'min', category: 'Mente', timeOfDay: 'morning', why: 'Para empezar el día con calma' }, 0),
    mk({ name: 'Tomar agua', emoji: '💧', color: '#4ea3d9', kind: 'count', target: 8, unit: 'vasos', category: 'Salud' }, 1),
    mk({ name: 'Leer', emoji: '📚', color: '#d08a4a', kind: 'quantity', target: 20, unit: 'páginas', category: 'Mente', timeOfDay: 'evening' }, 2),
    mk({ name: 'Entrenar', emoji: '🏋️', color: '#d4574a', kind: 'check', frequency: { type: 'perWeek', times: 4 }, category: 'Salud', timeOfDay: 'afternoon' }, 3),
    mk({ name: 'Caminar 8k pasos', emoji: '🚶', color: '#5aa469', kind: 'check', category: 'Salud' }, 4),
    mk({ name: 'Sin redes antes de dormir', emoji: '📵', color: '#5f6b7a', kind: 'avoid', category: 'Mente', timeOfDay: 'evening' }, 5),
    mk({ name: 'Inglés', emoji: '🗣️', color: '#c9a227', kind: 'quantity', target: 15, unit: 'min', frequency: { type: 'weekdays', days: [1, 2, 3, 4, 5] }, category: 'Aprendizaje' }, 6),
    mk({ name: 'Escribir diario', emoji: '✍️', color: '#b5838d', kind: 'check', category: 'Mente', timeOfDay: 'evening' }, 7),
  ];
  const skill = [0.72, 0.6, 0.55, 0.62, 0.68, 0.7, 0.5, 0.45];
  const logs: Logs = {};
  const moods: Record<string, MoodEntry> = {};
  const emotions = ['tranquilo', 'contento', 'motivado', 'cansado', 'ansioso', 'agradecido', 'enfocado', 'irritable', 'creativo'];
  const tags = ['trabajo', 'familia', 'amigos', 'deporte', 'naturaleza', 'lluvia', 'viaje', 'salida'];
  const grat = ['un café rico', 'charla con un amigo', 'el sol de la mañana', 'dormir bien', 'una buena comida', 'terminar un proyecto', 'mi familia', 'una caminata'];
  for (const d of range(start, today)) {
    const wd = fromKey(d).getDay();
    const progress = (fromKey(d).getTime() - fromKey(start).getTime()) / (fromKey(today).getTime() - fromKey(start).getTime());
    const weekendPenalty = wd === 0 || wd === 6 ? -0.15 : 0;
    const dayVibe = rand() - 0.5;
    logs[d] = {};
    let doneCount = 0;
    habits.forEach((h, i) => {
      if (h.frequency.type === 'weekdays' && !h.frequency.days.includes(wd)) return;
      if (d === today && rand() < 0.5) return;
      const p = skill[i] + progress * 0.2 + weekendPenalty + dayVibe * 0.3;
      const hit = rand() < p;
      const hour = h.timeOfDay === 'morning' ? 7 : h.timeOfDay === 'afternoon' ? 15 : h.timeOfDay === 'evening' ? 21 : 9 + Math.floor(rand() * 10);
      const at = fromKey(d).getTime() + hour * 3600000 + Math.floor(rand() * 3600000);
      if (h.kind === 'avoid') {
        if (!hit) logs[d][h.id] = { value: 1, at };
        else doneCount++;
        return;
      }
      if (h.frequency.type === 'perWeek' && rand() < 0.4) return;
      if (h.kind === 'check') {
        if (hit) {
          logs[d][h.id] = { value: 1, at };
          doneCount++;
        }
      } else {
        const v = hit ? h.target + Math.floor(rand() * h.target * 0.5) : Math.floor(rand() * h.target * 0.8);
        if (v > 0) logs[d][h.id] = { value: v, at };
        if (hit) doneCount++;
      }
    });
    if (rand() < 0.85) {
      const sleep = Math.round((6 + rand() * 2.5 + (wd === 0 || wd === 6 ? 0.8 : 0)) * 2) / 2;
      const base = 2.2 + doneCount * 0.25 + (sleep - 7) * 0.35 + dayVibe;
      const mood = Math.max(1, Math.min(5, Math.round(base)));
      moods[d] = {
        date: d,
        mood,
        energy: Math.max(1, Math.min(5, Math.round(base + (rand() - 0.5)))),
        stress: Math.max(1, Math.min(5, Math.round(4.5 - base * 0.6 + rand()))),
        sleep,
        emotions: emotions.filter(() => rand() < 0.2).slice(0, 3),
        tags: tags.filter(() => rand() < 0.18),
        gratitude: rand() < 0.5 ? [grat[Math.floor(rand() * grat.length)]] : [],
        note: '',
        updatedAt: Date.now(),
      };
    }
  }
  const focus = range(addDays(today, -40), today)
    .filter(() => rand() < 0.5)
    .map((d) => ({ id: uid(), minutes: 25 * (1 + Math.floor(rand() * 3)), label: 'Trabajo profundo', at: fromKey(d).getTime() + 10 * 3600000, date: d, habitId: rand() < 0.3 ? habits[6].id : undefined }));
  return {
    version: 1,
    habits,
    logs,
    moods,
    focus,
    goals: [
      { id: uid(), title: 'Leer 40 veces este trimestre', habitId: habits[2].id, target: 40, deadline: addDays(today, 45), createdAt: addDays(today, -45) },
      { id: uid(), title: 'Entrenar 50 veces', habitId: habits[3].id, target: 50, deadline: addDays(today, 60), createdAt: start },
    ],
    reviews: {},
    settings: { ...DEFAULT_SETTINGS, name: 'Nico' },
    unlocked: {},
  };
}
