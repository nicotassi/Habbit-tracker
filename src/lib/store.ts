import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { AppData, Entry, FocusSession, Goal, Habit, MoodEntry, Settings, WeeklyReview } from './types';
import { todayKey } from './date';

export const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);

export const DEFAULT_SETTINGS: Settings = {
  name: '',
  theme: 'system',
  weekStart: 1,
  accent: '#c8643b',
  notifications: false,
  confetti: true,
  sound: true,
};

export const emptyData = (): AppData => ({
  version: 1,
  habits: [],
  logs: {},
  moods: {},
  focus: [],
  goals: [],
  reviews: {},
  settings: { ...DEFAULT_SETTINGS },
  unlocked: {},
});

interface Actions {
  addHabit: (h: Omit<Habit, 'id' | 'createdAt' | 'archived' | 'order'> & Partial<Pick<Habit, 'createdAt'>>) => string;
  updateHabit: (id: string, patch: Partial<Habit>) => void;
  deleteHabit: (id: string) => void;
  reorderHabits: (ids: string[]) => void;
  setEntry: (date: string, habitId: string, entry: Entry | null) => void;
  setMood: (date: string, mood: Partial<MoodEntry>) => void;
  deleteMood: (date: string) => void;
  addFocus: (s: Omit<FocusSession, 'id' | 'at' | 'date'>) => void;
  deleteFocus: (id: string) => void;
  upsertGoal: (g: Partial<Goal> & { title: string }) => void;
  deleteGoal: (id: string) => void;
  setReview: (r: WeeklyReview) => void;
  setSettings: (s: Partial<Settings>) => void;
  unlock: (ids: string[]) => void;
  replaceAll: (d: AppData) => void;
  reset: () => void;
}

export type Store = AppData & Actions;

export const useStore = create<Store>()(
  persist(
    (set, get) => ({
      ...emptyData(),
      addHabit: (h) => {
        const id = uid();
        const order = get().habits.length;
        set((s) => ({
          habits: [...s.habits, { ...h, id, createdAt: h.createdAt ?? todayKey(), archived: false, order }],
        }));
        return id;
      },
      updateHabit: (id, patch) =>
        set((s) => ({ habits: s.habits.map((h) => (h.id === id ? { ...h, ...patch } : h)) })),
      deleteHabit: (id) =>
        set((s) => {
          const logs = { ...s.logs };
          for (const d of Object.keys(logs)) {
            if (logs[d][id]) {
              const { [id]: _, ...rest } = logs[d];
              logs[d] = rest;
            }
          }
          return { habits: s.habits.filter((h) => h.id !== id), logs };
        }),
      reorderHabits: (ids) =>
        set((s) => ({
          habits: s.habits.map((h) => ({ ...h, order: ids.indexOf(h.id) === -1 ? h.order : ids.indexOf(h.id) })),
        })),
      setEntry: (date, habitId, entry) =>
        set((s) => {
          const day = { ...(s.logs[date] ?? {}) };
          if (entry === null) delete day[habitId];
          else day[habitId] = { ...entry, at: Date.now() };
          return { logs: { ...s.logs, [date]: day } };
        }),
      setMood: (date, mood) =>
        set((s) => {
          const prev: MoodEntry = s.moods[date] ?? {
            date,
            mood: 3,
            energy: 3,
            stress: 3,
            emotions: [],
            tags: [],
            gratitude: [],
            note: '',
            updatedAt: Date.now(),
          };
          return { moods: { ...s.moods, [date]: { ...prev, ...mood, date, updatedAt: Date.now() } } };
        }),
      deleteMood: (date) =>
        set((s) => {
          const { [date]: _, ...rest } = s.moods;
          return { moods: rest };
        }),
      addFocus: (f) =>
        set((s) => ({ focus: [...s.focus, { ...f, id: uid(), at: Date.now(), date: todayKey() }] })),
      deleteFocus: (id) => set((s) => ({ focus: s.focus.filter((f) => f.id !== id) })),
      upsertGoal: (g) =>
        set((s) => {
          if (g.id && s.goals.some((x) => x.id === g.id)) {
            return { goals: s.goals.map((x) => (x.id === g.id ? { ...x, ...g } : x)) };
          }
          const goal: Goal = {
            id: uid(),
            target: 30,
            deadline: todayKey(),
            createdAt: todayKey(),
            ...g,
          };
          return { goals: [...s.goals, goal] };
        }),
      deleteGoal: (id) => set((s) => ({ goals: s.goals.filter((g) => g.id !== id) })),
      setReview: (r) => set((s) => ({ reviews: { ...s.reviews, [r.week]: r } })),
      setSettings: (p) => set((s) => ({ settings: { ...s.settings, ...p } })),
      unlock: (ids) =>
        set((s) => {
          const u = { ...s.unlocked };
          ids.forEach((i) => (u[i] = Date.now()));
          return { unlocked: u };
        }),
      replaceAll: (d) => set({ ...emptyData(), ...d, settings: { ...DEFAULT_SETTINGS, ...d.settings } }),
      reset: () => set(emptyData()),
    }),
    {
      name: 'ritmo-data',
      version: 1,
      partialize: (s) => ({
        version: s.version,
        habits: s.habits,
        logs: s.logs,
        moods: s.moods,
        focus: s.focus,
        goals: s.goals,
        reviews: s.reviews,
        settings: s.settings,
        unlocked: s.unlocked,
      }),
    }
  )
);

export function getData(): AppData {
  const s = useStore.getState();
  return {
    version: s.version,
    habits: s.habits,
    logs: s.logs,
    moods: s.moods,
    focus: s.focus,
    goals: s.goals,
    reviews: s.reviews,
    settings: s.settings,
    unlocked: s.unlocked,
  };
}
