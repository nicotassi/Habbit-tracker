import { useMemo, useState } from 'react';
import { useStore } from '../lib/store';
import { activeHabits, dayStats, insights, levelOf, matchesDay, levelTitle, perfectDayStreak, xpOf } from '../lib/stats';
import { addDays, fromKey, greeting, prettyDate, relativeDay, todayKey, WEEKDAYS_LETTER, weekStartOf } from '../lib/date';
import { HabitRow } from '../components/HabitRow';
import { MoodLogger } from '../components/MoodLogger';
import { Bar, DateNav, Empty, Ring } from '../components/ui';
import { HabitForm } from '../components/HabitForm';
import type { TimeOfDay } from '../lib/types';
import { navigate } from '../router';

const QUOTES = [
  ['Somos lo que hacemos repetidamente. La excelencia no es un acto, es un hábito.', 'Will Durant'],
  ['No subís al nivel de tus metas, caés al nivel de tus sistemas.', 'James Clear'],
  ['Cada acción es un voto por el tipo de persona que querés ser.', 'James Clear'],
  ['El secreto para avanzar es empezar.', 'Mark Twain'],
  ['Pequeños pasos todos los días.', 'Anónimo'],
  ['La motivación te hace empezar. El hábito te hace seguir.', 'Jim Ryun'],
  ['No rompas la cadena.', 'Jerry Seinfeld'],
  ['Lo que se mide, mejora.', 'Peter Drucker'],
  ['La disciplina es elegir entre lo que querés ahora y lo que más querés.', 'Abraham Lincoln'],
  ['Hacelo imperfecto, pero hacelo.', 'Anónimo'],
  ['Nunca saltees dos veces.', 'James Clear'],
  ['El mejor momento para plantar un árbol fue hace 20 años. El segundo mejor es hoy.', 'Proverbio chino'],
];

const GROUPS: { k: TimeOfDay; label: string }[] = [
  { k: 'morning', label: '🌅 Mañana' },
  { k: 'afternoon', label: '☀️ Tarde' },
  { k: 'evening', label: '🌙 Noche' },
  { k: 'any', label: '✨ En cualquier momento' },
];

export function Today() {
  const data = useStore();
  const [date, setDate] = useState(todayKey());
  const [formOpen, setFormOpen] = useState(false);
  const [group, setGroup] = useState(true);
  const habits = activeHabits(data);
  const scheduled = habits.filter((h) => matchesDay(h, date));
  const s = dayStats(data, date);
  const xp = xpOf(data);
  const lv = levelOf(xp);
  const pd = perfectDayStreak(data);
  const quote = QUOTES[Math.floor(fromKey(date).getTime() / 86400000) % QUOTES.length];
  const tip = useMemo(() => insights(data)[0], [data.logs, data.moods, data.habits]);
  const ws = weekStartOf(date, data.settings.weekStart);
  const isToday = date === todayKey();

  return (
    <div>
      <div className="page-head">
        <div>
          <div className="eyebrow">{relativeDay(date)} · {prettyDate(date)}</div>
          <h1 className="title">
            {isToday ? <>{greeting()}{data.settings.name ? <>, <em>{data.settings.name}</em></> : ''}.</> : <>Editando <em>{relativeDay(date) === 'Ayer' ? 'ayer' : prettyDate(date)}</em></>}
          </h1>
        </div>
        <div className="row wrap">
          <DateNav date={date} onChange={setDate} max={todayKey()} />
          <button className="btn primary hide-mobile" onClick={() => setFormOpen(true)}>+ Nuevo hábito</button>
        </div>
      </div>

      {!isToday && (
        <div className="past-banner">
          <span>✏️ Estás cargando el <b>{prettyDate(date)}</b>. Podés marcar hábitos, cantidades, notas y ánimo de ese día.</span>
          <button className="btn sm primary" onClick={() => setDate(todayKey())}>Volver a hoy</button>
        </div>
      )}

      <div className="grid g3" style={{ marginBottom: 16 }}>
        <div className="hero span2">
          <div className="row" style={{ gap: 28, alignItems: 'center', flexWrap: 'wrap', position: 'relative', zIndex: 1 }}>
            <Ring value={s.progress} size={132} stroke={11} color="#f3b378" track="rgba(255,255,255,.12)">
              <div className="serif" style={{ fontSize: 36, lineHeight: 1 }}>{Math.round(s.progress * 100)}%</div>
            </Ring>
            <div className="grow">
              <div className="muted small">Progreso del día</div>
              <div className="big">{s.done}<span style={{ fontSize: 32, opacity: .5 }}>/{s.total}</span></div>
              <div className="muted small" style={{ marginTop: 6 }}>
                {s.total === 0 ? 'Nada programado. Día libre 🌴' : s.done === s.total ? '¡Todo hecho! Disfrutá el resto del día.' : `Te faltan ${s.total - s.done} para el día perfecto.`}
              </div>
              <div className="row week-strip" style={{ marginTop: 16, gap: 8 }}>
                {Array.from({ length: 7 }, (_, i) => {
                  const d = addDays(ws, i);
                  const ds = dayStats(data, d);
                  const future = d > todayKey();
                  return (
                    <button key={d} onClick={() => !future && setDate(d)} style={{ border: 0, background: 'transparent', color: 'inherit', padding: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, opacity: future ? 0.35 : 1 }}>
                      <span style={{ fontSize: 11, opacity: .6 }}>{WEEKDAYS_LETTER[fromKey(d).getDay()]}</span>
                      <Ring value={future ? 0 : ds.progress} size={30} stroke={4} color="#f3b378" track="rgba(255,255,255,.14)">
                        <span style={{ fontSize: 10, fontWeight: d === date ? 700 : 400 }}>{fromKey(d).getDate()}</span>
                      </Ring>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
        <div className="card col" style={{ justifyContent: 'space-between' }}>
          <div>
            <div className="row between">
              <span className="eyebrow">Nivel {lv.level}</span>
              <span className="badge">{xp} XP</span>
            </div>
            <div className="serif" style={{ fontSize: 34, lineHeight: 1.1, margin: '6px 0 10px' }}>{levelTitle(lv.level)}</div>
            <Bar value={lv.progress} />
            <div className="tiny muted" style={{ marginTop: 6 }}>{lv.toNext} XP para el próximo nivel</div>
          </div>
          <div className="row between" style={{ marginTop: 14 }}>
            <div><div className="serif" style={{ fontSize: 28 }}>🔥 {pd.current}</div><div className="tiny muted">días perfectos seguidos</div></div>
            <div style={{ textAlign: 'right' }}><div className="serif" style={{ fontSize: 28 }}>{pd.best}</div><div className="tiny muted">récord</div></div>
          </div>
        </div>
      </div>

      <div className="grid g3">
        <div className="span2 col" style={{ gap: 16 }}>
          {habits.length === 0 ? (
            <div className="card">
              <Empty emoji="🌱" title="Empezá tu primer hábito">
                <p>Sin límites: agregá todos los que quieras. También podés cargar datos de ejemplo para explorar.</p>
                <div className="row" style={{ justifyContent: 'center' }}>
                  <button className="btn primary" onClick={() => setFormOpen(true)}>+ Crear hábito</button>
                  <button className="btn" onClick={() => navigate('ajustes')}>Cargar demo</button>
                </div>
              </Empty>
            </div>
          ) : (
            <>
              <div className="row between">
                <h2 className="h2">Hábitos</h2>
                <button className="btn ghost sm" onClick={() => setGroup((g) => !g)}>{group ? 'Ver lista simple' : 'Agrupar por momento'}</button>
              </div>
              {group ? (
                GROUPS.map((g) => {
                  const list = scheduled.filter((h) => h.timeOfDay === g.k);
                  if (!list.length) return null;
                  return (
                    <div key={g.k}>
                      <div className="eyebrow" style={{ margin: '4px 4px 8px' }}>{g.label}</div>
                      <div className="habit-list">{list.map((h) => <HabitRow key={h.id} habit={h} date={date} />)}</div>
                    </div>
                  );
                })
              ) : (
                <div className="habit-list">{scheduled.map((h) => <HabitRow key={h.id} habit={h} date={date} />)}</div>
              )}
              {habits.length > scheduled.length && (
                <details>
                  <summary className="muted small" style={{ cursor: 'pointer', padding: 4 }}>No programados hoy ({habits.length - scheduled.length})</summary>
                  <div className="habit-list" style={{ marginTop: 8, opacity: .7 }}>
                    {habits.filter((h) => !matchesDay(h, date)).map((h) => <HabitRow key={h.id} habit={h} date={date} />)}
                  </div>
                </details>
              )}
            </>
          )}
        </div>

        <div className="col" style={{ gap: 16 }}>
          <div className="card">
            <div className="card-head">
              <h3 className="h3">¿Cómo te sentís?</h3>
              <button className="btn ghost sm" onClick={() => navigate('mood')}>Diario →</button>
            </div>
            <MoodLogger date={date} compact />
          </div>
          {tip && (
            <div className={`insight ${tip.tone}`}>
              <div className="i-ico">{tip.icon}</div>
              <div>
                <div style={{ fontWeight: 600 }}>{tip.title}</div>
                <div className="small ink2">{tip.body}</div>
                <button className="btn ghost sm" style={{ marginTop: 6, marginLeft: -10 }} onClick={() => navigate('analytics')}>Más análisis →</button>
              </div>
            </div>
          )}
          <div className="card soft">
            <div className="serif" style={{ fontSize: 22, lineHeight: 1.25 }}>“{quote[0]}”</div>
            <div className="small muted" style={{ marginTop: 8 }}>— {quote[1]}</div>
          </div>
        </div>
      </div>
      <HabitForm open={formOpen} onClose={() => setFormOpen(false)} />
    </div>
  );
}
