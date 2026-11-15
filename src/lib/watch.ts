import type { WatchMetrics } from './types';

export const WATCH_FIELDS: { key: keyof WatchMetrics; label: string; unit: string; step?: number; icon: string }[] = [
  { key: 'sleepHours', label: 'Sueño', unit: 'h', step: 0.1, icon: '😴' },
  { key: 'deepSleepHours', label: 'Sueño profundo', unit: 'h', step: 0.1, icon: '🌌' },
  { key: 'sleepScore', label: 'Puntaje de sueño', unit: '/100', icon: '🌙' },
  { key: 'steps', label: 'Pasos', unit: '', icon: '👟' },
  { key: 'restingHr', label: 'FC en reposo', unit: 'ppm', icon: '❤️' },
  { key: 'hrv', label: 'VFC (HRV)', unit: 'ms', icon: '📈' },
  { key: 'stress', label: 'Estrés', unit: '/100', icon: '🌪' },
  { key: 'bodyBattery', label: 'Energía (Body Battery)', unit: '/100', icon: '🔋' },
  { key: 'calories', label: 'Calorías', unit: 'kcal', icon: '🔥' },
  { key: 'spo2', label: 'Oxígeno en sangre', unit: '%', icon: '🫁' },
  { key: 'vo2max', label: 'VO₂ máx', unit: '', icon: '🫀' },
  { key: 'weightKg', label: 'Peso', unit: 'kg', step: 0.1, icon: '⚖️' },
  { key: 'km', label: 'Distancia', unit: 'km', step: 0.1, icon: '📍' },
];

const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

/** Números de un texto: "8.432", "10,214" y "1 109" (miles) → 8432 / 10214 / 1109; "7,5" → 7.5 */
function numbers(s: string): { value: number; digits: number; raw: string }[] {
  const out: { value: number; digits: number; raw: string }[] = [];
  for (const m of s.matchAll(/(?<![\d.,:/])(\d{1,3}(?:[., ]\d{3})+|\d+(?:[.,]\d+)?)(?![\d:])/g)) {
    let r = m[1];
    if (/^\d{1,3}([., ]\d{3})+$/.test(r)) r = r.replace(/[., ]/g, '');
    else r = r.replace(',', '.');
    const value = Number(r);
    if (isFinite(value)) out.push({ value, digits: r.replace('.', '').length, raw: m[1] });
  }
  return out;
}

/** Duraciones: "04:49", "7 h 32 min", "6h 48m", "43 min" → horas */
function duration(s: string): number | undefined {
  const c = s.match(/(?<!\d)(\d{1,2}):(\d{2})(?!\d)/);
  if (c) return Number(c[1]) + Number(c[2]) / 60;
  const hm = s.match(/(\d{1,2})\s*(?:h|hs|hr|hrs|horas?)\.?\s*(?:(\d{1,2})\s*(?:m|min|mins|minutos?)\b)?/);
  if (hm) return Number(hm[1]) + (hm[2] ? Number(hm[2]) / 60 : 0);
  const m = s.match(/(\d{1,3})\s*(?:min|mins|minutos)\b/);
  if (m) return Number(m[1]) / 60;
  return undefined;
}

type Lines = string[];

/**
 * Busca la etiqueta y toma el valor en el mismo renglón (después de la etiqueta)
 * o en los renglones siguientes. Las apps de reloj suelen poner el nombre arriba y el número abajo.
 */
function near<T>(lines: Lines, label: RegExp, read: (s: string) => T | undefined, ahead = 3): T | undefined {
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(label);
    if (!m) continue;
    const rest = lines[i].slice((m.index ?? 0) + m[0].length);
    const v = read(rest);
    if (v !== undefined) return v;
    for (let j = 1; j <= ahead && i + j < lines.length; j++) {
      const w = read(lines[i + j]);
      if (w !== undefined) return w;
    }
  }
  return undefined;
}

const intIn = (min: number, max: number) => (s: string) => numbers(s).find((n) => Number.isInteger(n.value) && n.value >= min && n.value <= max)?.value;
const decIn = (min: number, max: number) => (s: string) => numbers(s).find((n) => n.value >= min && n.value <= max)?.value;

/** Extrae métricas del texto que leyó el OCR. Lo no encontrado queda sin definir. */
export function parseWatchText(raw: string): WatchMetrics {
  const lines = norm(raw).split('\n').map((l) => l.replace(/[|]/g, ' ').trim()).filter(Boolean);
  const all = lines.join('\n');
  const m: WatchMetrics = {};

  // sueño total: "Duración (del sueño)", "Sueño", "Tiempo dormido"… pero no "sueño profundo/ligero/REM" ni "puntuación"
  const sleepLabel = /(duracion(?: del sueno)?|tiempo dormido|horas de sueno|sueno total|total sleep|time asleep|(?<!puntuacion de |puntaje de |calidad del )\bsueno\b(?! profundo| ligero| rem)|\bsleep\b(?! score))/;
  const sleep = near(lines, sleepLabel, (s) => (/profundo|ligero|rem|deep|light/.test(s) ? undefined : duration(s)));
  if (sleep !== undefined && sleep >= 1 && sleep <= 16) m.sleepHours = Math.round(sleep * 100) / 100;
  else {
    // sin etiqueta: una sola duración plausible se toma como sueño
    const durs = [...all.matchAll(/(\d{1,2})\s*(?:h|hs|hr|horas?)\.?\s*(\d{1,2})?\s*(?:m|min)?\b/g)].filter((x) => Number(x[1]) >= 3 && Number(x[1]) <= 13);
    if (durs.length === 1) m.sleepHours = Math.round((Number(durs[0][1]) + Number(durs[0][2] ?? 0) / 60) * 100) / 100;
  }
  const deep = near(lines, /sueno profundo|deep sleep/, duration);
  if (deep !== undefined && deep > 0 && deep < 8) m.deepSleepHours = Math.round(deep * 100) / 100;

  m.sleepScore = near(lines, /puntuacion de(?:l)? sueno|puntaje de(?:l)? sueno|sleep score|calidad del sueno|indice de sueno/, intIn(1, 100));
  m.steps = near(lines, /\bpasos\b|\bsteps\b/, intIn(10, 199999)) ?? numbers(all.match(/([\d.,]+)\s*(?:pasos|steps)/)?.[1] ?? '')[0]?.value;
  m.restingHr =
    near(lines, /fc en reposo|frecuencia cardiaca en reposo|resting heart rate|resting hr|\brhr\b/, intIn(30, 130), 1) ??
    intIn(30, 130)(all.match(/(\d{2,3})\s*(?:ppm|lpm|bpm)/)?.[1] ?? '') ??
    near(lines, /salud del corazon|frecuencia cardiaca|heart rate/, intIn(30, 130));
  m.hrv = near(lines, /\bvfc\b|\bhrv\b|variabilidad/, intIn(5, 250), 2);
  m.stress = near(lines, /estres|stress/, intIn(1, 100), 2);
  m.bodyBattery = near(lines, /body battery|bateria corporal|\bbateria\b|\benergia\b/, intIn(1, 100), 2);
  // "520/600 CAL" (logrado / meta): se toma lo logrado
  const ratio = all.match(/(\d[\d.,]*)\s*\/\s*[\d.,]+\s*(?:kcal|cal)\b/);
  m.calories = (ratio ? intIn(50, 14999)(ratio[1]) : undefined) ??
    near(lines, /\bcalorias?\b|\bcalories\b/, (s) => numbers(s.replace(/\d+\s*kcal\s*(quema en reposo|consumo de actividad|en reposo|activas?)/g, '')).find((n) => n.value >= 50 && n.value < 15000)?.value);
  m.spo2 = intIn(70, 100)(all.match(/(?:spo2|oxigeno|oxygen|saturacion)[^\d\n]{0,40}(?:\n[^\d\n]{0,40}){0,2}(\d{2,3})\s*%/)?.[1] ?? '');
  m.vo2max = near(lines, /vo.?\s*max|vo2/, intIn(15, 95), 2);
  // peso: entre los números cercanos se toma el más preciso (el valor grande suele tener más decimales que el eje del gráfico)
  // peso: entre los números cercanos se toma el más preciso (el valor grande suele tener más decimales que el eje del gráfico)
  for (let i = 0; i < lines.length && m.weightKg === undefined; i++) {
    if (!/\bpeso\b|\bweight\b/.test(lines[i])) continue;
    const c = lines.slice(i, i + 5).flatMap((l) => numbers(l)).filter((n) => n.value >= 30 && n.value <= 250 && /[.,]/.test(n.raw));
    if (c.length) m.weightKg = c.sort((x, y) => y.digits - x.digits)[0].value;
  }
  m.km = decIn(0.01, 299)(all.match(/(\d+(?:[.,]\d+)?)\s*km\b/)?.[1] ?? '');

  // anillos tipo "48  7" seguidos de "SUEÑO  ESFUERZO" (en el mismo renglón o en renglones sueltos):
  // los números se emparejan en orden con sus etiquetas
  const tokens = lines.flatMap((l) => (/^[\d\s]+$/.test(l) || /^[a-z]+(\s+[a-z]+)*$/.test(l) ? l.split(/\s+/) : ['|']));
  for (let i = 0; i < tokens.length; ) {
    let j = i;
    while (j < tokens.length && /^\d{1,3}$/.test(tokens[j])) j++;
    let k = j;
    while (k < tokens.length && /^[a-z]+$/.test(tokens[k])) k++;
    const nums = tokens.slice(i, j);
    const labels = tokens.slice(j, k);
    if (nums.length && nums.length === labels.length) {
      labels.forEach((l, n) => {
        const v = Number(nums[n]);
        if (v > 100) return;
        if (l === 'sueno' && m.sleepScore === undefined) m.sleepScore = v;
        if (l === 'estres' && m.stress === undefined) m.stress = v;
        if ((l === 'energia' || l === 'bateria') && m.bodyBattery === undefined) m.bodyBattery = v;
      });
    }
    i = Math.max(i + 1, k);
  }

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
    // ancho de trabajo ~1200 px (las capturas de celular suelen ser angostas y muy largas),
    // sin pasar de ~16 millones de píxeles para no trabar el celular
    const scale = Math.min(2.5, 1200 / img.width, Math.sqrt(16e6 / (img.width * img.height)));
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
    await worker.setParameters({ tessedit_pageseg_mode: '11' as never });
    const r = await worker.recognize(canvas);
    return { text: r.data.text, metrics: parseWatchText(r.data.text) };
  } finally {
    await worker.terminate();
  }
}
