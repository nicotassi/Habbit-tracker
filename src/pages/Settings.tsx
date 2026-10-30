import { useRef } from 'react';
import { useStore } from '../lib/store';
import { buildDemo } from '../lib/demo';
import { exportCSV, exportJSON, readBackup } from '../lib/io';
import { Seg, toast } from '../components/ui';
import { navigate } from '../router';

export function Settings() {
  const { settings, setSettings, replaceAll, reset, habits, moods } = useStore();
  const file = useRef<HTMLInputElement>(null);
  const askNotif = async () => {
    if (!('Notification' in window)) return toast('Tu navegador no soporta notificaciones', '🔕');
    const p = await Notification.requestPermission();
    setSettings({ notifications: p === 'granted' });
    toast(p === 'granted' ? 'Recordatorios activados' : 'Permiso denegado', p === 'granted' ? '🔔' : '🔕');
  };
  return (
    <div>
      <div className="page-head"><div><div className="eyebrow">Ajustes</div><h1 className="title">Tu <em>espacio</em></h1></div></div>
      <div className="grid g2">
        <div className="card col" style={{ gap: 18 }}>
          <h3 className="h3">Perfil y apariencia</h3>
          <div className="field"><label className="label">Tu nombre</label><input className="input" value={settings.name} onChange={(e) => setSettings({ name: e.target.value })} placeholder="¿Cómo te llamamos?" /></div>
          <div className="field"><span className="label">Tema</span>
            <Seg value={settings.theme} onChange={(t) => setSettings({ theme: t })} options={[{ v: 'light', l: '☀️ Claro' }, { v: 'dark', l: '🌙 Oscuro' }, { v: 'system', l: '💻 Sistema' }]} />
          </div>
          <div className="field"><span className="label">Color de acento</span>
            <div className="swatches">
              {['#c8643b', '#8b7fd1', '#3f8f7a', '#4ea3d9', '#d16ba5', '#c9a227', '#1c1b19'].map((c) => (
                <button key={c} className={`swatch ${settings.accent === c ? 'on' : ''}`} style={{ background: c }} onClick={() => setSettings({ accent: c })} />
              ))}
            </div>
          </div>
          <div className="field"><span className="label">La semana empieza el</span>
            <Seg value={settings.weekStart} onChange={(w) => setSettings({ weekStart: w })} options={[{ v: 1, l: 'Lunes' }, { v: 0, l: 'Domingo' }]} />
          </div>
          <Toggle label="🎉 Confeti al completar" on={settings.confetti} set={(v) => setSettings({ confetti: v })} />
          <Toggle label="🔔 Sonido al completar" on={settings.sound} set={(v) => setSettings({ sound: v })} />
          <div className="row between">
            <span>⏰ Recordatorios del navegador</span>
            {settings.notifications ? <button className="btn sm" onClick={() => setSettings({ notifications: false })}>Desactivar</button> : <button className="btn sm primary" onClick={askNotif}>Activar</button>}
          </div>
          <span className="tiny muted">Los recordatorios se disparan a la hora configurada en cada hábito mientras la app esté abierta (o instalada como app).</span>
        </div>

        <div className="col" style={{ gap: 16 }}>
          <div className="card col" style={{ gap: 12 }}>
            <h3 className="h3">Tus datos</h3>
            <p className="small muted" style={{ margin: 0 }}>Todo se guarda localmente en este dispositivo. {habits.length} hábitos · {Object.keys(moods).length} registros de ánimo.</p>
            <div className="row wrap">
              <button className="btn" onClick={exportJSON}>⬇️ Backup (JSON)</button>
              <button className="btn" onClick={exportCSV}>📄 Exportar CSV</button>
              <button className="btn" onClick={() => file.current?.click()}>⬆️ Importar backup</button>
              <input ref={file} type="file" accept="application/json" hidden onChange={async (e) => {
                const f = e.target.files?.[0];
                if (!f) return;
                try {
                  const d = await readBackup(f);
                  if (confirm('Esto reemplaza tus datos actuales. ¿Continuar?')) { replaceAll(d); toast('Backup importado', '✅'); }
                } catch { toast('Archivo inválido', '⚠️'); }
                e.target.value = '';
              }} />
            </div>
          </div>
          <div className="card col" style={{ gap: 12 }}>
            <h3 className="h3">Explorar con datos de ejemplo</h3>
            <p className="small muted" style={{ margin: 0 }}>Carga 4 meses de hábitos, ánimo y sesiones de foco simulados para ver todos los análisis en acción.</p>
            <div><button className="btn accent" onClick={() => { if (!habits.length || confirm('Esto reemplaza tus datos actuales. ¿Continuar?')) { replaceAll(buildDemo()); toast('Demo cargada', '✨'); navigate('today'); } }}>✨ Cargar demo</button></div>
          </div>
          <div className="card col" style={{ gap: 12 }}>
            <h3 className="h3">Atajos de teclado</h3>
            <div className="small col" style={{ gap: 6 }}>
              <span><kbd>⌘</kbd> <kbd>K</kbd> / <kbd>Ctrl</kbd> <kbd>K</kbd> Paleta de comandos</span>
              <span><kbd>N</kbd> Nuevo hábito</span>
              <span><kbd>1</kbd>–<kbd>8</kbd> Navegar entre secciones</span>
            </div>
          </div>
          <div className="card col" style={{ gap: 12, borderColor: 'color-mix(in srgb, var(--bad) 30%, var(--line))' }}>
            <h3 className="h3" style={{ color: 'var(--bad)' }}>Zona de peligro</h3>
            <div><button className="btn danger" onClick={() => { if (confirm('¿Borrar TODOS los datos? No se puede deshacer.')) { reset(); toast('Datos borrados', '🗑️'); } }}>Borrar todo</button></div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Toggle({ label, on, set }: { label: string; on: boolean; set: (v: boolean) => void }) {
  return (
    <label className="row between" style={{ cursor: 'pointer' }}>
      <span>{label}</span>
      <button type="button" onClick={() => set(!on)} style={{ width: 44, height: 26, borderRadius: 999, border: 0, background: on ? 'var(--ink)' : 'var(--line-2)', position: 'relative', transition: 'background .2s' }}>
        <span style={{ position: 'absolute', top: 3, left: on ? 21 : 3, width: 20, height: 20, borderRadius: '50%', background: 'var(--surface)', transition: 'left .2s' }} />
      </button>
    </label>
  );
}
