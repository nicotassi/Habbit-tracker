// Avisos push con el celular bloqueado.
// La app arma con su propio motor la agenda de avisos de los próximos 7 días (arranque, horarios de
// cada hábito y cierre) y la sube a Supabase cada vez que cambian los datos. El servidor solo manda
// lo que vence (ver supabase/ritmo_push.sql y supabase/functions/ritmo-push).
import type { AppData } from './types';
import { getData, useStore } from './store';
import { rpc, useCloud } from './cloud';
import { buildDayPlan } from './engine';
import { activeHabits, entryOf, isDone, isScheduled, matchesDay, nonNegotiableDay } from './stats';
import { slotFor } from './schedule';
import { addDays, fromKey, todayKey } from './date';
import { isIOS, isStandalone } from '../components/Install';

export interface PushItem { key: string; at: string; title: string; body: string; url: string }

const DEVICE_KEY = 'ritmo-push-device';

export const pushSupported = () =>
  typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;

/** En iPhone los avisos solo funcionan con la app agregada a la pantalla de inicio. */
export const pushNeedsInstall = () => isIOS() && !isStandalone();

/** ¿Este dispositivo recibe avisos push? */
export const pushOnThisDevice = () => {
  try { return localStorage.getItem(DEVICE_KEY) === '1'; } catch { return false; }
};

const at = (date: string, hhmm: string) => {
  const d = fromKey(date);
  d.setHours(+hhmm.slice(0, 2), +hhmm.slice(3, 5), 0, 0);
  return d;
};

const list = (names: string[]) => (names.length <= 1 ? names.join('') : `${names.slice(0, -1).join(', ')} y ${names[names.length - 1]}`);

/** Agenda de avisos de los próximos días, calculada con los datos actuales. */
export function buildPushPlan(data: AppData, now = new Date(), days = 7): PushItem[] {
  const s = data.settings;
  const out: PushItem[] = [];
  const today = todayKey();
  for (let i = 0; i < days; i++) {
    const date = addDays(today, i);
    const ritual = data.rituals?.[date];
    const isToday = i === 0;
    const plan = s.pushMorning || s.pushEvening ? buildDayPlan(data, date, now) : null;

    // ☀️ arranque
    if (s.pushMorning && plan && !ritual?.morning) {
      const when = at(date, s.ritualMorning || '08:00');
      if (when > now && plan.items.length) {
        const nn = plan.items.filter((x) => x.habit.nonNegotiable);
        const first = plan.items.find((x) => !x.done && x.habit.kind !== 'avoid');
        const bits: string[] = [];
        if (nn.length) bits.push(`🔒 ${list(nn.map((x) => x.habit.name))}.`);
        if (first) bits.push(`Primer paso: ${first.habit.emoji} ${first.habit.name}.`);
        bits.push('Arrancá tu día en 30 segundos.');
        // el tipo de día solo se sabe con los datos de ese día; para los próximos, un saludo con el resumen
        const title = isToday ? `☀️ ${plan.title}` : `☀️ Buen día${s.name ? `, ${s.name}` : ''}: ${plan.items.length === 1 ? '1 hábito' : `${plan.items.length} hábitos`} hoy`;
        out.push({ key: `m|${date}`, at: when.toISOString(), title, body: bits.join(' '), url: '#ritual-morning' });
      }
    }

    // 🕐 a la hora de cada hábito (si tiene horario o recordatorio)
    if (s.pushHabits) {
      let n = 0;
      for (const h of activeHabits(data)) {
        if (n >= 8) break;
        if (!matchesDay(h, date) || !isScheduled(h, date)) continue;
        const time = h.reminder || slotFor(h, date)?.start;
        if (!time) continue;
        const when = at(date, time);
        if (when <= now) continue;
        if (isToday && isDone(h, entryOf(data.logs, date, h.id), date)) continue;
        if (entryOf(data.logs, date, h.id)?.skipped) continue;
        const slot = slotFor(h, date);
        out.push({
          key: `h|${h.id}|${date}`, at: when.toISOString(),
          title: `${h.emoji} ${h.name}${slot ? ` · ${slot.start}${slot.end ? `–${slot.end}` : ''}` : ''}`,
          body: [h.nonNegotiable ? '🔒 No negociable de hoy.' : '', h.why || 'Es tu momento. Tocá para marcarlo.'].filter(Boolean).join(' '),
          url: '#today',
        });
        n++;
      }
    }

    // 🌙 cierre
    if (s.pushEvening && plan && !ritual?.evening && plan.items.length) {
      const when = at(date, s.ritualEvening || '21:30');
      if (when > now) {
        let body = 'Cerrá el día en 30 segundos: lo que quedó, cómo estuviste y cómo viene mañana.';
        if (isToday) {
          const pending = plan.items.filter((x) => !x.done && x.habit.kind !== 'avoid');
          const nn = nonNegotiableDay(data, date);
          if (!pending.length) body = '🏆 Día completo. Cerralo en 30 segundos y mirá cómo viene mañana.';
          else body = `Te ${pending.length === 1 ? 'queda 1 hábito' : `quedan ${pending.length} hábitos`}${nn.pending.length ? ` (🔒 ${list(nn.pending.map((h) => h.name))})` : ''}. Todavía suma: cerrá el día en 30 segundos.`;
        }
        out.push({ key: `e|${date}`, at: when.toISOString(), title: '🌙 Cierre del día', body, url: '#ritual-evening' });
      }
    }
  }
  return out.sort((a, b) => a.at.localeCompare(b.at)).slice(0, 200);
}

let timer: ReturnType<typeof setTimeout> | undefined;
let lastSent = '';

/** Sube la agenda (con un pequeño retraso para juntar varios cambios). */
export function schedulePlanUpload(delay = 4000) {
  clearTimeout(timer);
  timer = setTimeout(() => void uploadPlan(), delay);
}

export async function uploadPlan(extra: PushItem[] = []): Promise<void> {
  const s = useCloud.getState().session;
  const data = getData();
  if (!s || !data.settings.pushActive) return;
  const items = [...extra, ...buildPushPlan(data)];
  const sig = JSON.stringify(items);
  if (!extra.length && sig === lastSent) return;
  try {
    await rpc('ritmo_push_plan', { p_user: s.user, p_token: s.token, p_items: items });
    lastSent = sig;
  } catch {
    /* sin conexión: se vuelve a intentar con el próximo cambio */
  }
}

function keyBytes(b64: string): Uint8Array {
  const pad = '='.repeat((4 - (b64.length % 4)) % 4);
  const raw = atob((b64 + pad).replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

export type EnableResult = 'ok' | 'denied' | 'unsupported' | 'install' | 'perm-timeout' | 'sw' | 'subscribe' | 'server' | 'error';

class StepError extends Error { constructor(public code: EnableResult, public detail = '') { super(code); } }

const withTimeout = <T,>(p: Promise<T>, ms: number, code: EnableResult): Promise<T> =>
  Promise.race([p, new Promise<T>((_, rej) => setTimeout(() => rej(new StepError(code, 'tiempo agotado')), ms))]);

/** Service worker activo (lo registra si hace falta). */
async function activeRegistration(): Promise<ServiceWorkerRegistration> {
  let reg = await navigator.serviceWorker.getRegistration();
  if (!reg) reg = await navigator.serviceWorker.register('./sw.js');
  if (reg.active) return reg;
  return withTimeout(navigator.serviceWorker.ready, 15000, 'sw');
}

export let lastPushError = '';

/** Espera (hasta 2 minutos) a que el permiso quede habilitado desde la configuración. */
export function waitForPermission(): Promise<boolean> {
  return new Promise((res) => {
    const t0 = Date.now();
    const i = setInterval(() => {
      if (Notification.permission === 'granted') { clearInterval(i); res(true); }
      else if (Date.now() - t0 > 120000) { clearInterval(i); res(false); }
    }, 1000);
  });
}

/* Diagnóstico: cada intento de activación deja un registro de sus pasos en la cuenta
   (tabla ritmo_push_diag), así se puede ver en qué paso falla un celular sin pedir capturas. */
let diagLog: { attempt: string; t0: number; steps: Record<string, unknown>[] } | null = null;
function diag(step: string, extra: Record<string, unknown> = {}) {
  const s = useCloud.getState().session;
  if (!s || !diagLog) return;
  diagLog.steps.push({ ms: Date.now() - diagLog.t0, step, ...extra });
  rpc('ritmo_push_diag', { p_user: s.user, p_token: s.token, p_attempt: diagLog.attempt, p_info: { steps: diagLog.steps } }).catch(() => {});
}
const errText = (e: unknown) => (e instanceof StepError ? `${e.code} ${e.detail}` : e instanceof Error ? `${e.name}: ${e.message}` : String(e));

async function environment(): Promise<Record<string, unknown>> {
  const env: Record<string, unknown> = {
    ua: navigator.userAgent,
    standalone: isStandalone(),
    displayMode: ['standalone', 'minimal-ui', 'fullscreen', 'browser'].find((m) => matchMedia(`(display-mode: ${m})`).matches),
    notifPermission: typeof Notification !== 'undefined' ? Notification.permission : 'sin Notification',
    pushManager: 'PushManager' in window,
    controller: !!navigator.serviceWorker?.controller,
    version: typeof __BUILD_TIME__ !== 'undefined' ? __BUILD_TIME__ : '',
  };
  try { env.permQuery = (await navigator.permissions.query({ name: 'notifications' as PermissionName })).state; } catch (e) { env.permQuery = errText(e); }
  try {
    const reg = await withTimeout(navigator.serviceWorker.getRegistration(), 4000, 'sw');
    env.reg = reg ? { scope: reg.scope, active: reg.active?.state ?? null, waiting: !!reg.waiting, installing: !!reg.installing } : null;
    if (reg) {
      try { env.pushPermState = await withTimeout(reg.pushManager.permissionState({ userVisibleOnly: true }), 4000, 'subscribe'); } catch (e) { env.pushPermState = errText(e); }
      try { env.hasSub = !!(await withTimeout(reg.pushManager.getSubscription(), 4000, 'subscribe')); } catch (e) { env.hasSub = errText(e); }
    }
  } catch (e) { env.reg = errText(e); }
  return env;
}

/** Pide permiso, suscribe este dispositivo y sube la agenda. `onStep` cuenta en qué paso va. */
export async function enablePush(onStep: (s: string) => void = () => {}): Promise<EnableResult> {
  diagLog = { attempt: Math.random().toString(36).slice(2, 10), t0: Date.now(), steps: [] };
  // el pedido de permiso tiene que salir directo del toque: se lanza antes de cualquier espera
  const needAsk = typeof Notification !== 'undefined' && Notification.permission !== 'granted' && !pushNeedsInstall();
  let early: Promise<NotificationPermission> | null = null;
  if (needAsk) {
    try { early = Promise.resolve(Notification.requestPermission() ?? Notification.permission); } catch (e) { early = Promise.reject(e); }
    early.then((r) => diag('respuesta del permiso', { result: r }), (e) => diag('error del permiso', { error: errText(e) }));
  }
  void environment().then((env) => diag('inicio', env));
  if (pushNeedsInstall()) { diag('fin', { result: 'install' }); return 'install'; }
  if (!pushSupported()) { diag('fin', { result: 'unsupported' }); return 'unsupported'; }
  const s = useCloud.getState().session;
  if (!s) return 'error';
  lastPushError = '';
  const r = await enableSteps(onStep, early, s);
  diag('fin', { result: r, detail: lastPushError });
  return r;
}

async function enableSteps(onStep: (s: string) => void, early: Promise<NotificationPermission> | null, s: { user: string; token: string }): Promise<EnableResult> {
  try {
    onStep('Pidiendo permiso…');
    let perm = Notification.permission;
    if (perm !== 'granted') {
      // se pide siempre (algunos navegadores informan mal el estado); tiene que salir directo del toque
      const asked = early ?? Promise.resolve(Notification.requestPermission() ?? Notification.permission);
      // si el navegador no muestra el pedido (Chrome a veces lo "silencia"), se sigue igual apenas
      // el permiso se habilita a mano en la configuración
      const watch = new Promise<NotificationPermission>((res) => {
        const i = setInterval(() => { if (Notification.permission === 'granted') { clearInterval(i); res('granted'); } }, 700);
        setTimeout(() => clearInterval(i), 120000);
      });
      onStep('Esperando el permiso…');
      perm = await withTimeout(Promise.race([asked, watch]), 9000, 'perm-timeout');
    }
    diag('permiso', { perm });
    if (perm !== 'granted') return 'denied';

    onStep('Preparando la app…');
    const reg = await withTimeout(activeRegistration(), 20000, 'sw');
    diag('service worker listo', { active: reg.active?.state });

    onStep('Conectando…');
    const key = await withTimeout(rpc<string>('ritmo_vapid', {}), 15000, 'server');
    let sub = await withTimeout(reg.pushManager.getSubscription(), 10000, 'subscribe');
    // una suscripción vieja con otra clave no sirve: se rehace
    const appKey = sub?.options?.applicationServerKey;
    if (sub && appKey && btoa(String.fromCharCode(...new Uint8Array(appKey))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '') !== key) {
      await sub.unsubscribe().catch(() => {});
      sub = null;
    }
    diag('suscripción previa', { has: !!sub });
    if (!sub) {
      try {
        sub = await withTimeout(reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(key) as BufferSource }), 20000, 'subscribe');
      } catch (e) {
        if (e instanceof StepError) throw e;
        throw new StepError('subscribe', e instanceof Error ? `${e.name}: ${e.message}` : String(e));
      }
    }

    diag('suscripto', { endpoint: sub.endpoint.slice(0, 60) });
    onStep('Guardando…');
    try {
      await withTimeout(rpc('ritmo_push_sub', { p_user: s.user, p_token: s.token, p_sub: sub.toJSON() }), 15000, 'server');
    } catch (e) {
      if (e instanceof StepError) throw e;
      throw new StepError('server', e instanceof Error ? e.message : String(e));
    }
    try { localStorage.setItem(DEVICE_KEY, '1'); } catch { /* sin almacenamiento */ }
    useStore.getState().setSettings({ pushActive: true, notifications: true });
    lastSent = '';
    await uploadPlan();
    return 'ok';
  } catch (e) {
    diag('error', { error: errText(e) });
    if (e instanceof StepError) { lastPushError = e.detail; return e.code; }
    lastPushError = e instanceof Error ? `${e.name}: ${e.message}` : String(e);
    return 'error';
  }
}

export async function disablePush(): Promise<void> {
  try { localStorage.removeItem(DEVICE_KEY); } catch { /* sin almacenamiento */ }
  const s = useCloud.getState().session;
  try {
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.getSubscription();
    if (sub) {
      if (s) await rpc('ritmo_push_unsub', { p_user: s.user, p_token: s.token, p_endpoint: sub.endpoint }).catch(() => {});
      await sub.unsubscribe();
    }
  } catch { /* nada que desuscribir */ }
}

/** Aviso de prueba: llega en menos de un minuto, aunque cierres la app. */
export async function testPush(): Promise<void> {
  const now = new Date(Date.now() + 5000);
  lastSent = '';
  await uploadPlan([{ key: `t|${now.getTime()}`, at: now.toISOString(), title: '🔔 Ritmo', body: 'Así te van a llegar los avisos. ¡Listo!', url: '#inicio' }]);
}

/** Mantiene la agenda al día: al cambiar los datos, al abrir la app y cada hora. */
export function startPushSync() {
  const unsub = useStore.subscribe((st, prev) => {
    if (!st.settings.pushActive) return;
    if (st.logs !== prev.logs || st.habits !== prev.habits || st.moods !== prev.moods || st.settings !== prev.settings || st.rituals !== prev.rituals) schedulePlanUpload();
  });
  const first = setTimeout(() => void uploadPlan(), 2500);
  const every = setInterval(() => { lastSent = ''; void uploadPlan(); }, 60 * 60 * 1000);
  return () => { unsub(); clearTimeout(first); clearInterval(every); };
}
