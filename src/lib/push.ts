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

export type EnableResult = 'ok' | 'denied' | 'unsupported' | 'install' | 'error';

/** Pide permiso, suscribe este dispositivo y sube la agenda. */
export async function enablePush(): Promise<EnableResult> {
  if (pushNeedsInstall()) return 'install';
  if (!pushSupported()) return 'unsupported';
  const s = useCloud.getState().session;
  if (!s) return 'error';
  const perm = await Notification.requestPermission();
  if (perm !== 'granted') return 'denied';
  try {
    const reg = await navigator.serviceWorker.ready;
    const key = await rpc<string>('ritmo_vapid', {});
    let sub = await reg.pushManager.getSubscription();
    if (!sub) sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(key) as BufferSource });
    await rpc('ritmo_push_sub', { p_user: s.user, p_token: s.token, p_sub: sub.toJSON() });
    try { localStorage.setItem(DEVICE_KEY, '1'); } catch { /* sin almacenamiento */ }
    useStore.getState().setSettings({ pushActive: true, notifications: true });
    lastSent = '';
    await uploadPlan();
    return 'ok';
  } catch {
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
