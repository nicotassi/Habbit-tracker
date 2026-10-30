import { useMemo } from 'react';
import { addDays, fromKey, MONTHS_SHORT, shortDate, todayKey, weekStartOf } from '../lib/date';

export function Heatmap({ values, weeks = 26, color = 'var(--accent)', weekStart = 1, onPick, label = (v: number) => `${Math.round(v * 100)}%` }: {
  values: (date: string) => number | null;
  weeks?: number;
  color?: string;
  weekStart?: 0 | 1;
  onPick?: (d: string) => void;
  label?: (v: number) => string;
}) {
  const cols = useMemo(() => {
    const end = weekStartOf(todayKey(), weekStart);
    const start = addDays(end, -(weeks - 1) * 7);
    const out: string[][] = [];
    for (let w = 0; w < weeks; w++) {
      const col: string[] = [];
      for (let d = 0; d < 7; d++) col.push(addDays(start, w * 7 + d));
      out.push(col);
    }
    return out;
  }, [weeks, weekStart]);
  const today = todayKey();
  return (
    <div>
      <div className="heat-months">
        {cols.map((c, i) => {
          const d = fromKey(c[0]);
          const show = (i === 0 ? d.getDate() <= 14 : fromKey(cols[i - 1][0]).getMonth() !== d.getMonth()) && i < cols.length - 2;
          return <div key={i} style={{ width: 13, overflow: 'visible', whiteSpace: 'nowrap' }}>{show ? MONTHS_SHORT[d.getMonth()] : ''}</div>;
        })}
      </div>
      <div className="heat">
        {cols.map((c, i) => (
          <div className="heat-col" key={i}>
            {c.map((d) => {
              const v = d > today ? null : values(d);
              const bg = v === null ? undefined : v <= 0 ? undefined : `color-mix(in srgb, ${color} ${Math.round(20 + v * 80)}%, var(--bg-2))`;
              return (
                <div
                  key={d}
                  className="heat-cell"
                  title={`${shortDate(d)}${v !== null ? ' · ' + label(v) : ''}`}
                  onClick={() => onPick?.(d)}
                  style={{ background: bg, opacity: d > today ? 0.3 : 1, cursor: onPick ? 'pointer' : undefined, outline: d === today ? '1.5px solid var(--ink-3)' : undefined }}
                />
              );
            })}
          </div>
        ))}
      </div>
      <div className="legend" style={{ marginTop: 8, justifyContent: 'flex-end' }}>
        Menos
        {[0, 0.25, 0.5, 0.75, 1].map((v) => (
          <span key={v} className="sw" style={{ background: v === 0 ? 'var(--bg-2)' : `color-mix(in srgb, ${color} ${Math.round(20 + v * 80)}%, var(--bg-2))` }} />
        ))}
        Más
      </div>
    </div>
  );
}
