import { useStore } from '../lib/store';
import { ACHIEVEMENTS } from '../lib/achievements';
import { LEVEL_TITLES, levelOf, levelTitle, xpOf } from '../lib/stats';
import { Bar, Ring } from '../components/ui';

export function Achievements() {
  const data = useStore();
  const xp = xpOf(data);
  const lv = levelOf(xp);
  const got = ACHIEVEMENTS.filter((a) => data.unlocked[a.id]).length;
  return (
    <div>
      <div className="page-head">
        <div><div className="eyebrow">Logros · {got}/{ACHIEVEMENTS.length}</div><h1 className="title">Tu <em>colección</em></h1></div>
      </div>
      <div className="hero" style={{ marginBottom: 16 }}>
        <div className="row" style={{ gap: 28, flexWrap: 'wrap', position: 'relative', zIndex: 1 }}>
          <Ring value={lv.progress} size={120} stroke={10} color="#f3b378" track="rgba(255,255,255,.12)">
            <div className="serif" style={{ fontSize: 40, lineHeight: 1 }}>{lv.level}</div>
          </Ring>
          <div className="grow">
            <div className="muted small">Nivel {lv.level}</div>
            <div className="big">{levelTitle(lv.level)}</div>
            <div className="muted small" style={{ marginTop: 6 }}>{xp} XP · faltan {lv.toNext} para {levelTitle(lv.level + 1)}</div>
            <div className="tiny muted" style={{ marginTop: 10 }}>+10 XP por hábito · +5 por registro de ánimo · +1 cada 5 min de foco · +25 por revisión semanal</div>
          </div>
        </div>
      </div>
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-head"><h3 className="h3">Camino de niveles</h3></div>
        <div className="row wrap" style={{ gap: 8 }}>
          {LEVEL_TITLES.map((t, i) => (
            <span key={t} className={`chip ${i + 1 === lv.level ? 'on' : ''}`} style={{ opacity: i + 1 > lv.level ? 0.45 : 1 }}>{i + 1}. {t}</span>
          ))}
        </div>
        <div style={{ marginTop: 14 }}><Bar value={got / ACHIEVEMENTS.length} /></div>
      </div>
      <div className="grid g3">
        {ACHIEVEMENTS.map((a) => {
          const t = data.unlocked[a.id];
          return (
            <div key={a.id} className={`ach ${t ? '' : 'locked'}`}>
              <div className="e">{a.emoji}</div>
              <div>
                <div style={{ fontWeight: 600 }}>{a.title}</div>
                <div className="small muted">{a.desc}</div>
                {t && <div className="tiny" style={{ color: 'var(--good)', marginTop: 2 }}>Desbloqueado el {new Date(t).toLocaleDateString('es')}</div>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
