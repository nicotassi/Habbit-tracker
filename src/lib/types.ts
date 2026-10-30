export type HabitKind = 'check' | 'count' | 'quantity' | 'avoid';

export type Frequency =
  | { type: 'daily' }
  | { type: 'weekdays'; days: number[] } // 0 = domingo … 6 = sábado
  | { type: 'perWeek'; times: number };

export type TimeOfDay = 'any' | 'morning' | 'afternoon' | 'evening';

export interface Habit {
  id: string;
  name: string;
  emoji: string;
  color: string;
  kind: HabitKind;
  /** Meta diaria para count/quantity (para check/avoid es 1). */
  target: number;
  unit?: string;
  frequency: Frequency;
  category: string;
  timeOfDay: TimeOfDay;
  reminder?: string; // "HH:MM"
  why?: string; // motivación personal
  createdAt: string; // ISO date YYYY-MM-DD
  archived: boolean;
  order: number;
}

export interface Entry {
  value: number; // check: 1/0, count/quantity: número, avoid: 1 = recaída
  note?: string;
  skipped?: boolean; // día justificado (no rompe racha)
  at?: number; // timestamp
}

/** logs[date][habitId] */
export type Logs = Record<string, Record<string, Entry>>;

export interface MoodEntry {
  date: string;
  mood: number; // 1..5
  energy: number; // 1..5
  stress: number; // 1..5
  sleep?: number; // horas
  emotions: string[];
  tags: string[];
  gratitude: string[];
  note: string;
  updatedAt: number;
}

export interface FocusSession {
  id: string;
  habitId?: string;
  minutes: number;
  label: string;
  at: number;
  date: string;
}

export interface Goal {
  id: string;
  title: string;
  habitId?: string;
  /** cantidad objetivo de completados del hábito en el período */
  target: number;
  deadline: string;
  createdAt: string;
  done?: boolean;
}

export interface WeeklyReview {
  week: string; // fecha del lunes
  wins: string;
  lessons: string;
  focus: string;
  rating: number;
}

export interface Settings {
  name: string;
  theme: 'light' | 'dark' | 'system';
  weekStart: 0 | 1;
  accent: string;
  notifications: boolean;
  confetti: boolean;
  sound: boolean;
  pomoWork: number; // minutos
  pomoShort: number;
  pomoLong: number;
  pomoEvery: number; // pomodoros antes del descanso largo
  pomoGoal: number; // pomodoros por día
  pomoAuto: boolean; // arrancar la siguiente fase sola
}

export interface AppData {
  version: number;
  habits: Habit[];
  logs: Logs;
  moods: Record<string, MoodEntry>;
  focus: FocusSession[];
  goals: Goal[];
  reviews: Record<string, WeeklyReview>;
  settings: Settings;
  unlocked: Record<string, number>; // id logro -> timestamp
}
