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
  /** Horario fijo: el mismo todos los días o uno distinto por día de la semana */
  schedule?: HabitSchedule;
  why?: string; // motivación personal
  /** "Cuenta tiempo": se puede iniciar con cronómetro o pomodoro y se registra cuánto le dedicaste */
  trackTime?: boolean;
  createdAt: string; // ISO date YYYY-MM-DD
  archived: boolean;
  order: number;
}

export interface TimeSlot {
  start: string; // "HH:MM"
  end?: string; // "HH:MM", opcional
}

export interface HabitSchedule {
  mode: 'same' | 'perDay';
  slot?: TimeSlot;
  /** día de la semana (0 = domingo … 6 = sábado) → horario */
  perDay?: Record<number, TimeSlot>;
}

export interface Entry {
  value: number; // check: 1/0, count/quantity: número, avoid: 1 = recaída
  note?: string;
  skipped?: boolean; // día justificado (no rompe racha)
  at?: number; // timestamp
  seconds?: number; // tiempo dedicado ese día
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

/** Datos de salud del reloj para un día (cargados desde una captura o a mano). */
export interface WatchMetrics {
  sleepHours?: number;
  deepSleepHours?: number;
  sleepScore?: number;
  steps?: number;
  restingHr?: number;
  hrv?: number;
  stress?: number;
  bodyBattery?: number;
  calories?: number;
  spo2?: number;
  vo2max?: number;
  weightKg?: number;
  km?: number;
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
  theme: 'light' | 'dark' | 'graphite' | 'system';
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
  /** tamaño del texto: 0.88 … 1.16 (1 = normal) */
  fontScale: number;
}

export interface AppData {
  version: number;
  habits: Habit[];
  logs: Logs;
  moods: Record<string, MoodEntry>;
  watch: Record<string, WatchMetrics>;
  focus: FocusSession[];
  goals: Goal[];
  reviews: Record<string, WeeklyReview>;
  settings: Settings;
  unlocked: Record<string, number>; // id logro -> timestamp
}
