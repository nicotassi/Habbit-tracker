import { useRef } from 'react';
import { getData, useStore } from '../lib/store';
import { buildDemo } from '../lib/demo';
import { copyBackup, exportCSV, exportJSON, parseBackup, readBackup } from '../lib/io';
import type { AppData } from '../lib/types';
import { askConfirm, askText, Seg, toast } from '../components/ui';
import { navigate } from '../router';
import { changePin, deleteAccount, flush, logout, pull, useCloud } from '../lib/cloud';
import { InstallCard } from '../components/Install';
import { applyUpdate, checkForUpdate } from '../lib/update';

// Dentro de un iframe (p. ej. el visor de claude.ai) las descargas están bloqueadas.
const embedded = window.top !== window;

export function Settings() {
  const { settings, setSettings, replaceAll, reset, habits, moods } = useStore();
  const file = useRef<HTMLInputElement>(null);
  const restore = async (d: AppData) => {
    if (await askConfirm('¿Reemplazar tus datos?', { body: 'El backup reemplaza todos los hábitos y registros actuales.', ok: 'Importar' })) { replaceAll(d); toast('Backup importado', '✅'); }
  };
  const copy = async () => {
    if (await copyBackup()) return toast('Backup copiado. Guardalo en tus notas o mandátelo por mensaje.', '📋');
    await askText('Copiá este texto', JSON.stringify(getData()), { multiline: true, ok: 'Listo' });
  };
  const paste = async () => {
    const t = await askText('Pegá tu backup', '', { multiline: true, body: 'Pegá el texto que copiaste con “Copiar backup”.', ok: 'Continuar' });
    if (!t) return;
    try { await restore(parseBackup(t)); } catch { toast('Ese texto no es un backup válido', '⚠️'); }
  };
  const askNotif = async () => {
    if (!('Notification' in window)) return toast('Tu navegador no soporta notificaciones', '🔕');
    const p = await Notification.requestPermission();
    setSettings({ notifications: p === 'granted' });
    toast(p === 'granted' ? 'Recordatorios activados' : 'Permiso denegado', p === 'granted' ? '🔔' : '🔕');
  };
  return (
    <div>
      <div className="page-head"><div><div className="eyebrow">Ajustes</div><h1 className="title">Tu <em>espacio</em></h1></div></div>
      <AccountCard />
      <div className="grid g2">
        <div className="card col" style={{ gap: 18 }}>
          <h3 className="h3">Perfil y apariencia</h3>
          <div className="field"><label className="label">Tu nombre</label><input className="input" value={settings.name} onChange={(e) => setSettings({ name: e.target.value })} placeholder="¿Cómo te llamamos?" /></div>
          <div className="field"><span className="label">Tema</span>
            <Seg value={settings.theme} onChange={(t) => setSettings(t === 'graphite' && settings.accent === '#c8643b' ? { theme: t, accent: '#d4d7de' } : t !== 'graphite' && settings.accent === '#d4d7de' ? { theme: t, accent: '#c8643b' } : { theme: t })}
              options={[{ v: 'light', l: '☀️ Claro' }, { v: 'dark', l: '🌙 Oscuro' }, { v: 'graphite', l: '◼️ Grafito' }, { v: 'system', l: '💻 Sistema' }]} />
          </div>
          <div className="field"><span className="label">Tamaño de letra</span>
            <Seg<number> value={settings.fontScale ?? 1} onChange={(v) => setSettings({ fontScale: v })}
              options={[
                { v: 0.88, l: <span style={{ fontSize: 11 }}>A</span> },
                { v: 0.94, l: <span style={{ fontSize: 13 }}>A</span> },
                { v: 1, l: <span style={{ fontSize: 15 }}>A</span> },
                { v: 1.08, l: <span style={{ fontSize: 17 }}>A</span> },
                { v: 1.16, l: <span style={{ fontSize: 19 }}>A</span> },
              ]} />
            <span className="tiny muted" style={{ marginTop: 6 }}>La del medio es el tamaño normal. Se guarda en tu cuenta.</span>
          </div>
          <div className="field"><span className="label">Color de acento</span>
            <div className="swatches">
              {['#c8643b', '#d4d7de', '#8b7fd1', '#3f8f7a', '#4ea3d9', '#d16ba5', '#c9a227', '#1c1b19'].map((c) => (
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
          <InstallCard />
          <div className="card col" style={{ gap: 10 }}>
            <h3 className="h3">🔄 Versión de la app</h3>
            <p className="small muted" style={{ margin: 0 }}>
              Versión del {new Date(__BUILD_TIME__).toLocaleString('es', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })}.
              La app se actualiza sola al abrirla; si querés, podés buscar una versión nueva ahora.
            </p>
            <div><button className="btn" onClick={async () => {
              toast('Buscando…', '🔄');
              if (await checkForUpdate()) { toast('Hay una versión nueva: actualizando', '✨'); await flush().catch(() => {}); applyUpdate(); }
              else toast('Ya tenés la última versión', '✅');
            }}>Buscar actualización</button></div>
          </div>
          <div className="card col" style={{ gap: 12 }}>
            <h3 className="h3">Tus datos</h3>
            <p className="small muted" style={{ margin: 0 }}>Todo se guarda en la nube con tu cuenta. También podés descargar o copiar un backup cuando quieras. {habits.length} hábitos · {Object.keys(moods).length} registros de ánimo.</p>
            <div className="row wrap">
              {!embedded && <button className="btn" onClick={exportJSON}>⬇️ Backup (JSON)</button>}
              {!embedded && <button className="btn" onClick={exportCSV}>📄 Exportar CSV</button>}
              <button className="btn" onClick={() => file.current?.click()}>⬆️ Importar archivo</button>
              <button className="btn" onClick={copy}>📋 Copiar backup</button>
              <button className="btn" onClick={paste}>📥 Pegar backup</button>
              <input ref={file} type="file" accept="application/json" hidden onChange={async (e) => {
                const f = e.target.files?.[0];
                if (!f) return;
                try {
                  const d = await readBackup(f);
                  await restore(d);
                } catch { toast('Archivo inválido', '⚠️'); }
                e.target.value = '';
              }} />
            </div>
          </div>
          <div className="card col" style={{ gap: 12 }}>
            <h3 className="h3">Explorar con datos de ejemplo</h3>
            <p className="small muted" style={{ margin: 0 }}>Carga 4 meses de hábitos, ánimo y sesiones de foco simulados para ver todos los análisis en acción.</p>
            <div><button className="btn accent" onClick={async () => { if (!habits.length || await askConfirm('¿Cargar la demo?', { body: 'Reemplaza tus datos actuales por datos de ejemplo.', ok: 'Cargar demo' })) { replaceAll(buildDemo()); toast('Demo cargada', '✨'); navigate('today'); } }}>✨ Cargar demo</button></div>
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
            <p className="small muted" style={{ margin: 0 }}>“Borrar todo” vacía tus datos pero mantiene la cuenta. “Eliminar cuenta” borra la cuenta y todos sus datos de la nube.</p>
            <div><button className="btn danger" onClick={async () => { if (await askConfirm('¿Borrar todos los datos?', { body: 'Se eliminan hábitos, registros de ánimo, objetivos y logros. No se puede deshacer.', danger: true, ok: 'Borrar todo' })) { reset(); toast('Datos borrados', '🗑️'); } }}>Borrar todo</button>
              <button className="btn danger" style={{ marginLeft: 8 }} onClick={async () => {
                const pin = await askText('Eliminar la cuenta', '', { body: 'Se borran tu usuario y todos tus datos de la nube. No se puede deshacer. Escribí tu PIN para confirmar.', ok: 'Eliminar cuenta' });
                if (!pin) return;
                try { await deleteAccount(pin); toast('Cuenta eliminada', '👋'); } catch (e) { toast(e instanceof Error ? e.message : 'No se pudo eliminar', '⚠️'); }
              }}>Eliminar cuenta</button></div>
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

function AccountCard() {
  const { session, status, lastSync, error } = useCloud();
  if (!session) return null;
  const label = { idle: 'Conectado', saving: 'Guardando…', saved: 'Todo guardado en la nube', offline: 'Sin conexión: los cambios se suben cuando vuelva internet', error: 'No se pudo guardar' }[status];
  const doChangePin = async () => {
    const old = await askText('PIN actual', '', { ok: 'Seguir' });
    if (!old) return;
    const nw = await askText('PIN nuevo (4 a 12 números)', '', { ok: 'Seguir' });
    if (!nw) return;
    const again = await askText('Repetí el PIN nuevo', '', { ok: 'Cambiar PIN' });
    if (again !== nw) return toast('Los PIN no coinciden', '⚠️');
    try { await changePin(old, nw); toast('PIN cambiado. Se cerraron las sesiones de otros dispositivos.', '🔐'); }
    catch (e) { toast(e instanceof Error ? e.message : 'No se pudo cambiar', '⚠️'); }
  };
  return (
    <div className="card account-card" style={{ marginBottom: 16 }}>
      <div className="row wrap" style={{ gap: 14 }}>
        <div className="account-avatar">{(session.name || session.user).slice(0, 1).toUpperCase()}</div>
        <div className="grow">
          <div style={{ fontWeight: 600 }}>{session.name || session.user} <span className="muted small">@{session.user}</span></div>
          <div className={`small sync-text ${status}`}>
            <span className={`sync-dot ${status}`}><span className="dot" /></span> {label}
            {lastSync && status === 'saved' && <span className="muted"> · {new Date(lastSync).toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' })}</span>}
          </div>
          {status === 'error' && error && <div className="tiny" style={{ color: 'var(--bad)' }}>{error}</div>}
        </div>
        <div className="row wrap" style={{ gap: 6 }}>
          <button className="btn sm" onClick={async () => { await flush(); await pull(); toast('Sincronizado', '☁️'); }}>☁️ Sincronizar</button>
          <button className="btn sm" onClick={doChangePin}>🔐 Cambiar PIN</button>
          <button className="btn sm" onClick={async () => { if (await askConfirm('¿Cerrar sesión?', { body: 'Tus datos quedan guardados en la nube. En este dispositivo se borra la copia local; para volver a verlos entrá con tu usuario y PIN.', ok: 'Cerrar sesión' })) await logout(); }}>Cerrar sesión</button>
        </div>
      </div>
      <p className="tiny muted" style={{ margin: '12px 0 0' }}>Para usar Ritmo en otro celular o compu, abrí el mismo link y entrá con <b>@{session.user}</b> y tu PIN. Otra persona puede crear su propia cuenta desde la pantalla de inicio.</p>
    </div>
  );
}
