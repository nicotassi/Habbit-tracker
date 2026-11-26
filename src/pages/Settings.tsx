import { useRef, useState } from 'react';
import { getData, useStore } from '../lib/store';
import { buildDemo } from '../lib/demo';
import { copyBackup, exportCSV, exportJSON, parseBackup, readBackup } from '../lib/io';
import type { AppData } from '../lib/types';
import { askConfirm, askText, Seg, toast } from '../components/ui';
import { navigate } from '../router';
import { changePin, deleteAccount, flush, logout, pull, useCloud } from '../lib/cloud';
import { InstallCard } from '../components/Install';
import { applyUpdate, checkForUpdate } from '../lib/update';
import { disablePush, enablePush, lastPushError, waitForPermission, pushNeedsInstall, pushOnThisDevice, pushSupported, testPush, type EnableResult } from '../lib/push';

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
        </div>

        <div className="col" style={{ gap: 16 }}>
          <NotifyCard />
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

function Switch({ on, set, label }: { on: boolean; set: (v: boolean) => void; label: string }) {
  return (
    <button type="button" role="switch" aria-checked={on} aria-label={label} className={`mini-switch ${on ? 'on' : ''}`} onClick={() => set(!on)}><span /></button>
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

/** Avisos push y horarios de los rituales de arranque y cierre. */
function NotifyCard() {
  const { settings, setSettings } = useStore();
  const [on, setOn] = useState(pushOnThisDevice());
  const [busy, setBusy] = useState(false);
  const [step, setStep] = useState('');
  const [problem, setProblem] = useState('');
  const [manual, setManual] = useState(false);
  const samsung = /SamsungBrowser/i.test(navigator.userAgent);
  const enable = async () => {
    setBusy(true);
    setProblem('');
    const r = await enablePush(setStep);
    setBusy(false);
    setStep('');
    const msg: Partial<Record<EnableResult, string>> = {
      install: 'En iPhone, primero agregá Ritmo a la pantalla de inicio (Compartir → Agregar a inicio), abrila desde ese ícono y activá los avisos ahí.',
      denied: 'El permiso de notificaciones está bloqueado. Habilitalo en los ajustes del celular (Notificaciones → Ritmo, o en el navegador: Configuración del sitio → Notificaciones) y probá de nuevo.',
      unsupported: 'Este navegador no soporta avisos push. Probá con Chrome en Android o con la app agregada a inicio en iPhone.',
      'perm-timeout': '',
      sw: 'La app no terminó de prepararse en este dispositivo. Cerrala del todo, volvé a abrirla y tocá Activar de nuevo.',
      subscribe: 'El servicio de avisos del celular no respondió. Revisá que el navegador tenga permitido mandar notificaciones y que no estés en modo ahorro de datos, y probá de nuevo.',
      server: 'No se pudo guardar en el servidor. Revisá tu conexión y probá de nuevo.',
      error: 'No se pudieron activar los avisos. Probá de nuevo.',
    };
    if (r === 'ok') { setOn(true); setManual(false); toast('Avisos activados en este dispositivo', '🔔'); }
    else if (r === 'perm-timeout') {
      setManual(true);
      // cuando lo habilites en la configuración, se activa solo al volver a la app
      if (await waitForPermission()) { setManual(false); void enable(); }
    }
    else setProblem(`${msg[r] ?? msg.error}${lastPushError ? ` (detalle: ${lastPushError})` : ''}`);
  };
  const disable = async () => { await disablePush(); setOn(false); toast('Avisos desactivados en este dispositivo', '🔕'); };
  return (
    <div className="card col notify-card" style={{ gap: 12 }}>
      <h3 className="h3">🔔 Avisos y rituales</h3>
      <p className="small muted" style={{ margin: 0 }}>
        Ritmo te avisa aunque tengas la app cerrada y el celular bloqueado: a la mañana con tu plan, a la hora de cada hábito con horario y a la noche para cerrar el día.
      </p>
      {on ? (
        <div className="row wrap" style={{ gap: 8 }}>
          <span className="pill good">✓ Activados en este dispositivo</span>
          <button className="btn sm" onClick={async () => { await testPush(); toast('Te mando uno de prueba: llega en 1 o 2 minutos', '🔔'); }}>Probar</button>
          <button className="btn sm ghost" onClick={disable}>Desactivar</button>
        </div>
      ) : (
        <div className="col" style={{ gap: 6 }}>
          <button className="btn primary" disabled={busy} onClick={enable} style={{ alignSelf: 'flex-start' }}>{busy ? step || 'Activando…' : 'Activar avisos en este dispositivo'}</button>
          {manual && (samsung ? (
            <div className="coach-note warn perm-help">
              <span className="cn-ico">🔔</span>
              <div className="small">
                <b>Samsung Internet no muestra el pedido de permiso dentro de la app instalada.</b> Hay que darlo una sola vez desde el navegador; después los avisos funcionan en la app.
                <ol>
                  <li>Tocá el botón de abajo (o abrí <b>Samsung Internet</b> y entrá a <i>nicotassi.github.io/Habbit-tracker</i>).</li>
                  <li>Si te lo pide, entrá con tu usuario y PIN.</li>
                  <li>Andá a <i>Ajustes → Avisos y rituales → Activar avisos</i> y tocá <b>Permitir</b> en el cartel.</li>
                  <li>Volvé a la app: ya queda activado.</li>
                </ol>
                <div className="row wrap" style={{ gap: 8 }}>
                  <a className="btn sm primary" href="https://nicotassi.github.io/Habbit-tracker/?abrir=navegador#ajustes" target="_blank" rel="noopener">Abrir en Samsung Internet</a>
                  <button className="btn sm" onClick={enable}>Ya lo habilité: activar</button>
                </div>
                <p className="tiny muted" style={{ margin: '8px 0 0' }}>Si en el navegador tampoco aparece el cartel: Samsung Internet → ☰ → Configuración → Sitios y descargas → Notificaciones → activá “Permitir notificaciones” y revisá que este sitio no esté bloqueado.</p>
              </div>
            </div>
          ) : (
            <div className="coach-note warn perm-help">
              <span className="cn-ico">🔔</span>
              <div className="small">
                <b>Tu navegador no mostró el pedido de permiso.</b> Habilitalo a mano (una sola vez) y volvé acá: se activa solo.
                <ol>
                  <li><b>Con Ritmo instalada:</b> mantené apretado el ícono de Ritmo → <i>Información de la app</i> → <i>Notificaciones</i> → activalas.</li>
                  <li><b>En Chrome:</b> abrí <i>nicotassi.github.io/Habbit-tracker</i>, tocá el ícono a la izquierda de la dirección (🔒 o ⚙️) → <i>Permisos</i> → <i>Notificaciones</i> → <i>Permitir</i>.</li>
                  <li>Si en Chrome ves una campanita tachada en la barra de direcciones, tocala y elegí <i>Permitir</i>.</li>
                </ol>
                <button className="btn sm" onClick={enable}>Ya lo habilité: activar</button>
              </div>
            </div>
          ))}
          {problem && <div className="coach-note warn"><span className="cn-ico">⚠️</span><div className="small">{problem}</div></div>}
          {pushNeedsInstall() && <span className="tiny muted">En iPhone los avisos funcionan con Ritmo agregado a la pantalla de inicio (Compartir → Agregar a inicio).</span>}
          {!pushNeedsInstall() && !pushSupported() && <span className="tiny muted">Este navegador no soporta avisos push.</span>}
        </div>
      )}
      <div className="notify-rows">
        <div className="notify-row">
          <span className="grow">☀️ Arranque</span>
          <input className="input time-input" type="time" aria-label="Hora del arranque" value={settings.ritualMorning} onChange={(e) => e.target.value && setSettings({ ritualMorning: e.target.value })} />
          <Switch on={settings.pushMorning} set={(v) => setSettings({ pushMorning: v })} label="Aviso de arranque" />
        </div>
        <div className="notify-row">
          <span className="grow">🕐 Hora de cada hábito</span>
          <Switch on={settings.pushHabits} set={(v) => setSettings({ pushHabits: v })} label="Aviso a la hora de cada hábito" />
        </div>
        <div className="notify-row">
          <span className="grow">🌙 Cierre</span>
          <input className="input time-input" type="time" aria-label="Hora del cierre" value={settings.ritualEvening} onChange={(e) => e.target.value && setSettings({ ritualEvening: e.target.value })} />
          <Switch on={settings.pushEvening} set={(v) => setSettings({ pushEvening: v })} label="Aviso de cierre" />
        </div>
      </div>
      <span className="tiny muted">Como mucho: uno a la mañana, uno por cada hábito con horario y uno a la noche. Si ya hiciste el hábito o el ritual, el aviso no llega.</span>
    </div>
  );
}
