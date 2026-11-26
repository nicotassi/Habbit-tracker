import { create } from 'zustand';
import type { AppData } from './types';
import { emptyData, getData, useStore } from './store';

// Proyecto de Supabase compartido (Futbol-pro); las tablas y funciones de Ritmo llevan prefijo ritmo_.
// La clave publicable solo permite llamar a las funciones ritmo_* (las tablas están cerradas).
const SB = 'https://qsijvmbhblestmrjhznw.supabase.co';
const KEY = 'sb_publishable_3Iyro2OVmwFbLeYkqvlnNA_6a5-v4Po';

const SESSION_KEY = 'ritmo-session';
const PENDING_KEY = 'ritmo-pending';

export interface Session {
  user: string;
  token: string;
  name: string;
}

const ls = {
  get<T>(k: string, d: T): T {
    try {
      const v = localStorage.getItem(k);
      return v ? (JSON.parse(v) as T) : d;
    } catch {
      return d;
    }
  },
  set(k: string, v: unknown) {
    try {
      if (v === null || v === undefined) localStorage.removeItem(k);
      else localStorage.setItem(k, JSON.stringify(v));
    } catch {
      /* almacenamiento bloqueado: la app sigue funcionando en memoria */
    }
  },
};

const MESSAGES: Record<string, string> = {
  login_invalido: 'Usuario o PIN incorrectos.',
  bloqueado: 'Demasiados intentos. Esperá 15 minutos y probá de nuevo.',
  usuario_existe: 'Ese usuario ya existe. Elegí otro o entrá con tu PIN.',
  usuario_invalido: 'El usuario debe tener entre 3 y 30 caracteres: letras, números, punto, guion o guion bajo.',
  pin_invalido: 'El PIN debe tener entre 4 y 12 números.',
  pin_actual_incorrecto: 'El PIN actual no es correcto.',
  sesion_invalida: 'Tu sesión se cerró. Volvé a entrar con tu usuario y PIN.',
  datos_muy_grandes: 'Tus datos superan el tamaño permitido.',
};

export class CloudError extends Error {
  constructor(public code: string, message?: string) {
    super(MESSAGES[code] ?? message ?? 'No se pudo conectar. Revisá tu conexión a internet.');
  }
}

export async function rpc<T>(fn: string, args: Record<string, unknown>): Promise<T> {
  let r: Response;
  try {
    r = await fetch(`${SB}/rest/v1/rpc/${fn}`, {
      method: 'POST',
      headers: { apikey: KEY, Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(args),
    });
  } catch {
    throw new CloudError('offline');
  }
  const j = await r.json().catch(() => null);
  if (!r.ok) throw new CloudError(j?.message ?? 'error', j?.message);
  if (j && typeof j === 'object' && 'error' in j && typeof j.error === 'string') throw new CloudError(j.error);
  return j as T;
}

/* ---------- estado de la cuenta y la sincronización ---------- */
export type SyncStatus = 'idle' | 'saving' | 'saved' | 'offline' | 'error';

interface CloudState {
  session: Session | null;
  status: SyncStatus;
  lastSync: number | null;
  error: string;
}

export const useCloud = create<CloudState>(() => ({
  session: ls.get<Session | null>(SESSION_KEY, null),
  status: ls.get(PENDING_KEY, false) ? 'offline' : 'idle',
  lastSync: null,
  error: '',
}));

const setSession = (s: Session | null) => {
  ls.set(SESSION_KEY, s);
  useCloud.setState({ session: s });
};

let applying = false;
/** Reemplaza los datos locales por los del servidor sin disparar un guardado. */
function applyRemote(d: Partial<AppData> | null | undefined) {
  applying = true;
  try {
    useStore.getState().replaceAll({ ...emptyData(), ...(d ?? {}) } as AppData);
  } finally {
    applying = false;
  }
}

/* ---------- cuenta ---------- */
interface AuthResult {
  username: string;
  name: string;
  token: string;
  data: Partial<AppData>;
  updated_at: string;
}

export async function signup(user: string, pin: string, name: string, keepLocal: boolean): Promise<void> {
  const local = getData();
  const data: AppData = keepLocal ? local : emptyData();
  if (name && !data.settings.name) data.settings = { ...data.settings, name };
  const r = await rpc<AuthResult>('ritmo_signup', { p_user: user, p_pin: pin, p_name: name, p_data: data });
  setSession({ user: r.username, token: r.token, name: r.name });
  applyRemote(r.data);
  ls.set(PENDING_KEY, false);
  useCloud.setState({ status: 'saved', lastSync: Date.now(), error: '' });
}

export async function login(user: string, pin: string): Promise<void> {
  const r = await rpc<AuthResult>('ritmo_login', { p_user: user, p_pin: pin });
  setSession({ user: r.username, token: r.token, name: r.name });
  applyRemote(r.data);
  ls.set(PENDING_KEY, false);
  useCloud.setState({ status: 'saved', lastSync: Date.now(), error: '' });
}

/** Cierra la sesión y borra la copia local de los datos de este dispositivo. */
export async function logout(): Promise<void> {
  const s = useCloud.getState().session;
  if (s) {
    if (ls.get(PENDING_KEY, false)) await flush().catch(() => {});
    rpc('ritmo_logout', { p_user: s.user, p_token: s.token }).catch(() => {});
  }
  clearLocal();
}

function clearLocal() {
  clearTimeout(timer);
  setSession(null);
  applyRemote(emptyData());
  ls.set(PENDING_KEY, false);
  ls.set('ritmo-data', null);
  ls.set('ritmo-timer', null);
  useCloud.setState({ status: 'idle', lastSync: null, error: '' });
}

export async function changePin(oldPin: string, newPin: string) {
  const s = need();
  await rpc('ritmo_change_pin', { p_user: s.user, p_token: s.token, p_old: oldPin, p_new: newPin });
}

export async function deleteAccount(pin: string) {
  const s = need();
  await rpc('ritmo_delete_account', { p_user: s.user, p_token: s.token, p_pin: pin });
  clearLocal();
}

function need(): Session {
  const s = useCloud.getState().session;
  if (!s) throw new CloudError('sesion_invalida');
  return s;
}

/* ---------- sincronización ---------- */
let timer: ReturnType<typeof setTimeout> | undefined;
let inFlight: Promise<void> | null = null;

function handleError(e: unknown) {
  if (e instanceof CloudError && e.code === 'sesion_invalida') {
    clearLocal();
    useCloud.setState({ error: e.message });
    return;
  }
  const offline = e instanceof CloudError && e.code === 'offline';
  useCloud.setState({ status: offline ? 'offline' : 'error', error: e instanceof Error ? e.message : String(e) });
}

/** Sube los cambios pendientes al servidor. */
export async function flush(): Promise<void> {
  const s = useCloud.getState().session;
  if (!s || !ls.get(PENDING_KEY, false)) return;
  if (inFlight) return inFlight;
  inFlight = (async () => {
    useCloud.setState({ status: 'saving' });
    try {
      // si hubo cambios mientras se guardaba, se vuelve a subir
      for (let i = 0; i < 3 && ls.get(PENDING_KEY, false); i++) {
        ls.set(PENDING_KEY, false);
        try {
          await rpc('ritmo_save', { p_user: s.user, p_token: s.token, p_data: getData() });
        } catch (e) {
          ls.set(PENDING_KEY, true);
          throw e;
        }
      }
      useCloud.setState({ status: 'saved', lastSync: Date.now(), error: '' });
    } catch (e) {
      handleError(e);
    } finally {
      inFlight = null;
    }
  })();
  return inFlight;
}

/** Trae los datos del servidor (otro dispositivo pudo haberlos cambiado). */
export async function pull(): Promise<void> {
  const s = useCloud.getState().session;
  if (!s) return;
  if (ls.get(PENDING_KEY, false)) return flush();
  try {
    const r = await rpc<AuthResult>('ritmo_load', { p_user: s.user, p_token: s.token });
    if (!ls.get(PENDING_KEY, false)) applyRemote(r.data);
    useCloud.setState({ status: 'saved', lastSync: Date.now(), error: '' });
  } catch (e) {
    handleError(e);
  }
}

const KEYS = ['habits', 'logs', 'moods', 'watch', 'focus', 'goals', 'reviews', 'settings', 'unlocked', 'rituals', 'adapt'] as const;

/** Arranca la sincronización: guarda cada cambio (con un pequeño retraso) y refresca al volver a la app. */
export function startSync() {
  const unsub = useStore.subscribe((st, prev) => {
    if (applying || !useCloud.getState().session) return;
    if (!KEYS.some((k) => st[k] !== prev[k])) return;
    ls.set(PENDING_KEY, true);
    useCloud.setState({ status: 'saving' });
    clearTimeout(timer);
    timer = setTimeout(() => void flush(), 1200);
  });
  const onVisible = () => {
    if (document.visibilityState === 'visible') void pull();
    else void flush();
  };
  const onOnline = () => void flush();
  document.addEventListener('visibilitychange', onVisible);
  window.addEventListener('online', onOnline);
  window.addEventListener('pagehide', () => void flush());
  const every = setInterval(() => void flush(), 30000);
  void pull();
  return () => {
    unsub();
    clearInterval(every);
    document.removeEventListener('visibilitychange', onVisible);
    window.removeEventListener('online', onOnline);
  };
}

/** ¿Hay datos en este dispositivo de antes de tener cuenta? */
export function hasLocalData(): boolean {
  const d = getData();
  return d.habits.length > 0 || Object.keys(d.moods).length > 0;
}
