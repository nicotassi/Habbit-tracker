import { useState } from 'react';
import { prettyDate, relativeDay, todayKey } from '../lib/date';
import { DateNav } from '../components/ui';
import { DayView } from '../components/DayView';

/** Pantalla "Mi día": la jornada en bloques de mañana, tarde y noche. */
export function Day() {
  const [date, setDate] = useState(todayKey());
  return (
    <div>
      <div className="page-head">
        <div><div className="eyebrow">{relativeDay(date)} · {prettyDate(date)}</div><h1 className="title">Mi <em>día</em></h1></div>
        <DateNav date={date} onChange={setDate} max="9999-12-31" />
      </div>
      <DayView date={date} />
    </div>
  );
}
