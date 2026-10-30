import type { AppData } from './types';
import { getData } from './store';
import { range, todayKey } from './date';
import { isDone } from './stats';

function download(name: string, content: string, type: string) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function exportJSON() {
  download(`ritmo-backup-${todayKey()}.json`, JSON.stringify(getData(), null, 2), 'application/json');
}

const esc = (v: unknown) => {
  const s = String(v ?? '');
  return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

export function exportCSV() {
  const d = getData();
  const rows = [['fecha', 'habito', 'tipo', 'valor', 'meta', 'unidad', 'cumplido', 'saltado', 'nota']];
  const dates = Object.keys(d.logs).sort();
  for (const date of dates) {
    for (const h of d.habits) {
      const e = d.logs[date][h.id];
      if (!e) continue;
      rows.push([date, h.name, h.kind, String(e.value), String(h.target), h.unit ?? '', isDone(h, e, date) ? '1' : '0', e.skipped ? '1' : '0', e.note ?? '']);
    }
  }
  download(`ritmo-habitos-${todayKey()}.csv`, rows.map((r) => r.map(esc).join(',')).join('\n'), 'text/csv');
  const mrows = [['fecha', 'animo', 'energia', 'estres', 'sueno', 'emociones', 'etiquetas', 'gratitud', 'nota']];
  const start = Object.keys(d.moods).sort()[0];
  if (start) {
    for (const k of range(start, todayKey())) {
      const m = d.moods[k];
      if (!m) continue;
      mrows.push([k, String(m.mood), String(m.energy), String(m.stress), String(m.sleep ?? ''), m.emotions.join('|'), m.tags.join('|'), m.gratitude.join('|'), m.note]);
    }
    setTimeout(() => download(`ritmo-animo-${todayKey()}.csv`, mrows.map((r) => r.map(esc).join(',')).join('\n'), 'text/csv'), 300);
  }
}

export async function readBackup(file: File): Promise<AppData> {
  const text = await file.text();
  const data = JSON.parse(text);
  if (!data || !Array.isArray(data.habits) || typeof data.logs !== 'object') throw new Error('Archivo inválido');
  return data as AppData;
}
