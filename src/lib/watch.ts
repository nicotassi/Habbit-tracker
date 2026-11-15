import type { WatchMetrics } from './types';

export const WATCH_FIELDS: { key: keyof WatchMetrics; label: string; unit: string; step?: number; icon: string }[] = [
  { key: 'sleepHours', label: 'Sueño', unit: 'h', step: 0.1, icon: '😴' },
  { key: 'sleepScore', label: 'Puntaje de sueño', unit: '/100', icon: '🌙' },
  { key: 'steps', label: 'Pasos', unit: '', icon: '👟' },
  { key: 'restingHr', label: 'FC en reposo', unit: 'ppm', icon: '❤️' },
  { key: 'hrv', label: 'VFC (HRV)', unit: 'ms', icon: '📈' },
  { key: 'stress', label: 'Estrés', unit: '/100', icon: '🌪' },
  { key: 'bodyBattery', label: 'Energía (Body Battery)', unit: '/100', icon: '🔋' },
  { key: 'calories', label: 'Calorías', unit: 'kcal', icon: '🔥' },
  { key: 'spo2', label: 'Oxígeno en sangre', unit: '%', icon: '🫁' },
  { key: 'km', label: 'Distancia', unit: 'km', step: 0.1, icon: '📍' },
];

const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

/** "8.432" o "10,214" → 8432; "7,5" → 7.5 */
function num(raw: string, integer = false): number | undefined {
  let s = raw.trim();
  if (/^\d{1,3}([.,]\d{3})+$/.test(s)) s = s.replace(/[.,]/g, '');
  else s = s.replace(',', '.');
  const n = Number(s);
  if (!isFinite(n)) return undefined;
  return integer ? Math.round(n) : n;
}

const NUM = '(\\d{1,3}(?:[.,]\\d{3})+|\\d+(?:[.,]\\d+)?)';
// etiqueta y luego (hasta ~40 caracteres sin números) el valor
const after = (labels: string) => new RegExp(`(?:${labels})[^\\d\\n]{0,40}(?:\\n[^\\d\\n]{0,40}){0,2}${NUM}`);

function sleepFrom(t: string): number | undefined {
  const hm = (m: RegExpMatchArray) => Number(m[1]) + (m[2] ? Number(m[2]) / 60 : 0);
  const pat = '(\\d{1,2})\\s*(?:h|hs|hr|hrs|horas?)\\.?\\s*(?:(\\d{1,2})\\s*(?:m|min|mins|minutos?)\\b)?';
  const labeled = t.match(new RegExp(`(?:sueno|sleep|dormi|tiempo dormido|horas de sueno)[^\\d\\n]{0,40}(?:\\n[^\\d\\n]{0,40}){0,2}${pat}`));
  if (labeled) return hm(labeled);
  const colon = t.match(/(?:sueno|sleep)[^\d\n]{0,40}(?:\n[^\d\n]{0,40}){0,2}(\d{1,2}):(\d{2})/);
  if (colon) return Number(colon[1]) + Number(colon[2]) / 60;
  // sin etiqueta: si hay una sola duración "Xh Ym" plausible, se toma como sueño
  const all = [...t.matchAll(new RegExp(pat, 'g'))].filter((m) => Number(m[1]) >= 3 && Number(m[1]) <= 13);
  return all.length === 1 ? hm(all[0]) : undefined;
}

/** Extrae métricas del texto que leyó el OCR. Lo no encontrado queda sin definir. */
export function parseWatchText(raw: string): WatchMetrics {
  const t = norm(raw).replace(/[|]/g, ' ');
  const m: WatchMetrics = {};
  const take = (re: RegExp, integer = true, ok: (n: number) => boolean = () => true) => {
    const r = t.match(re);
    if (!r) return undefined;
    const n = num(r[r.length - 1], integer);
    return n !== undefined && ok(n) ? n : undefined;
  };
  const sleep = sleepFrom(t);
  if (sleep !== undefined && sleep > 0 && sleep <= 16) m.sleepHours = Math.round(sleep * 10) / 10;
  m.sleepScore = take(after('puntuacion de(?:l)? sueno|puntaje de(?:l)? sueno|sleep score|calidad del sueno|indice de sueno'), true, (n) => n <= 100);
  m.steps = take(after('pasos|steps'), true, (n) => n >= 10 && n < 200000) ?? take(new RegExp(`${NUM}\\s*(?:pasos|steps)`), true, (n) => n >= 10 && n < 200000);
  m.restingHr = take(after('fc en reposo|frecuencia cardiaca en reposo|en reposo|resting heart rate|resting hr|resting|reposo'), true, (n) => n >= 30 && n <= 130);
  if (m.restingHr === undefined) m.restingHr = take(new RegExp(`(\\d{2,3})\\s*(?:ppm|lpm|bpm)`), true, (n) => n >= 30 && n <= 130);
  m.hrv = take(after('vfc|hrv|variabilidad'), true, (n) => n >= 5 && n <= 250);
  m.stress = take(after('estres|stress'), true, (n) => n <= 100);
  m.bodyBattery = take(after('body battery|bateria corporal|bateria|energia'), true, (n) => n <= 100);
  // "520/600 CAL" (logrado / meta): se toma lo logrado
  m.calories = take(new RegExp(`${NUM}\\s*/\\s*[\\d.,]+\\s*(?:kcal|cal)\\b`), true, (n) => n >= 50 && n < 15000)
    ?? take(after('calorias|calories|kcal'), true, (n) => n >= 50 && n < 15000)
    ?? take(new RegExp(`${NUM}\\s*(?:kcal|cal)\\b`), true, (n) => n >= 50 && n < 15000);
  m.spo2 = take(new RegExp(`(?:spo2|oxigeno|oxygen|saturacion)[^\\d\\n]{0,40}(?:\\n[^\\d\\n]{0,40}){0,2}(\\d{2,3})\\s*%`), true, (n) => n >= 70 && n <= 100);
  m.km = take(new RegExp(`${NUM}\\s*km\\b`), false, (n) => n > 0 && n < 300);
  (Object.keys(m) as (keyof WatchMetrics)[]).forEach((k) => m[k] === undefined && delete m[k]);
  return m;
}

/** Prepara la imagen (tamaño y contraste) para que el OCR lea mejor. */
async function prepare(file: File): Promise<HTMLCanvasElement> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((ok, bad) => {
      const i = new Image();
      i.onload = () => ok(i);
      i.onerror = () => bad(new Error('No se pudo abrir la imagen'));
      i.src = url;
    });
    const scale = Math.min(2, 1800 / Math.max(img.width, img.height), Math.max(1, 1200 / img.width));
    const c = document.createElement('canvas');
    c.width = Math.round(img.width * scale);
    c.height = Math.round(img.height * scale);
    const ctx = c.getContext('2d')!;
    ctx.drawImage(img, 0, 0, c.width, c.height);
    const d = ctx.getImageData(0, 0, c.width, c.height);
    let sum = 0;
    for (let i = 0; i < d.data.length; i += 4) sum += 0.299 * d.data[i] + 0.587 * d.data[i + 1] + 0.114 * d.data[i + 2];
    const dark = sum / (d.data.length / 4) < 110;
    // escala de grises (y se invierte si es una pantalla oscura: el OCR lee mejor texto oscuro sobre claro)
    for (let i = 0; i < d.data.length; i += 4) {
      let g = 0.299 * d.data[i] + 0.587 * d.data[i + 1] + 0.114 * d.data[i + 2];
      if (dark) g = 255 - g;
      d.data[i] = d.data[i + 1] = d.data[i + 2] = g;
    }
    ctx.putImageData(d, 0, 0);
    return c;
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** Lee una captura del reloj en el propio dispositivo (gratis, sin enviarla a ningún servidor). */
export async function readWatchScreenshot(file: File, onProgress?: (p: number) => void): Promise<{ text: string; metrics: WatchMetrics }> {
  const [{ createWorker }, canvas] = await Promise.all([import('tesseract.js'), prepare(file)]);
  const worker = await createWorker(['spa', 'eng'], 1, {
    logger: (l: { status: string; progress: number }) => {
      if (l.status === 'recognizing text') onProgress?.(0.3 + l.progress * 0.7);
      else if (l.status.startsWith('loading')) onProgress?.(l.progress * 0.3);
    },
  });
  try {
    const r = await worker.recognize(canvas);
    return { text: r.data.text, metrics: parseWatchText(r.data.text) };
  } finally {
    await worker.terminate();
  }
}
