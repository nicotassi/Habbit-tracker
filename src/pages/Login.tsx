import { useState } from 'react';
import { hasLocalData, login, signup, useCloud } from '../lib/cloud';
import { Seg } from '../components/ui';
import { InstallBanner } from '../components/Install';

export function Login() {
  const sessionError = useCloud((s) => s.error);
  const local = hasLocalData();
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [user, setUser] = useState(() => { try { return localStorage.getItem('ritmo-last-user') ?? ''; } catch { return ''; } });
  const [pin, setPin] = useState('');
  const [pin2, setPin2] = useState('');
  const [name, setName] = useState('');
  const [keep, setKeep] = useState(true);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(sessionError);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr('');
    const u = user.trim().toLowerCase();
    if (!/^[a-z0-9._-]{3,30}$/.test(u)) return setErr('El usuario debe tener entre 3 y 30 caracteres: letras, números, punto, guion o guion bajo (sin espacios).');
    if (!/^\d{4,12}$/.test(pin)) return setErr('El PIN debe tener entre 4 y 12 números.');
    if (mode === 'signup' && pin !== pin2) return setErr('Los dos PIN no coinciden.');
    setBusy(true);
    try {
      if (mode === 'login') await login(u, pin);
      else await signup(u, pin, name.trim(), local && keep);
      try { localStorage.setItem('ritmo-last-user', u); } catch { /* sin almacenamiento */ }
    } catch (x) {
      setErr(x instanceof Error ? x.message : 'No se pudo conectar.');
      setPin('');
      setPin2('');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="login-wrap">
      <form className="login-card" onSubmit={submit}>
        <div className="col" style={{ alignItems: 'center', gap: 6, marginBottom: 18 }}>
          <div className="brand-mark" style={{ width: 56, height: 56, borderRadius: 16 }}>
            <svg width="34" height="34" viewBox="0 0 64 64"><path d="M8 38c7 0 7-16 14-16s7 20 14 20 7-24 14-24" fill="none" stroke="#f3d9b1" strokeWidth="7" strokeLinecap="round" strokeLinejoin="round" /></svg>
          </div>
          <h1 className="title" style={{ fontSize: 44, margin: 0 }}>Ritmo</h1>
          <div className="eyebrow">Hábitos · Ánimo · Progreso</div>
        </div>

        <div className="row" style={{ justifyContent: 'center', marginBottom: 18 }}>
          <Seg value={mode} onChange={(m) => { setMode(m); setErr(''); }} options={[{ v: 'login', l: 'Entrar' }, { v: 'signup', l: 'Crear cuenta' }]} />
        </div>

        <div className="col" style={{ gap: 12 }}>
          <div className="field">
            <label className="label" htmlFor="login-user">Usuario</label>
            <input id="login-user" className="input" autoComplete="username" autoCapitalize="none" autoCorrect="off" spellCheck={false}
              placeholder="ej: nico" value={user} onChange={(e) => setUser(e.target.value)} />
          </div>
          {mode === 'signup' && (
            <div className="field">
              <label className="label" htmlFor="login-name">Tu nombre (opcional)</label>
              <input id="login-name" className="input" autoComplete="nickname" placeholder="Cómo querés que te salude" value={name} onChange={(e) => setName(e.target.value)} />
            </div>
          )}
          <div className="field">
            <label className="label" htmlFor="login-pin">PIN {mode === 'signup' && <span className="muted">(4 a 12 números)</span>}</label>
            <input id="login-pin" className="input pin-input" type="password" inputMode="numeric" pattern="[0-9]*" maxLength={12}
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'} placeholder="••••" value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))} />
          </div>
          {mode === 'signup' && (
            <div className="field">
              <label className="label" htmlFor="login-pin2">Repetí el PIN</label>
              <input id="login-pin2" className="input pin-input" type="password" inputMode="numeric" pattern="[0-9]*" maxLength={12}
                autoComplete="new-password" placeholder="••••" value={pin2} onChange={(e) => setPin2(e.target.value.replace(/\D/g, ''))} />
            </div>
          )}

          {mode === 'signup' && local && (
            <label className="row small" style={{ gap: 8, cursor: 'pointer', alignItems: 'flex-start' }}>
              <input id="login-keep" type="checkbox" checked={keep} onChange={(e) => setKeep(e.target.checked)} style={{ marginTop: 3 }} />
              <span>Guardar en la cuenta los hábitos y registros que ya tengo en este dispositivo</span>
            </label>
          )}
          {mode === 'login' && local && (
            <p className="tiny muted" style={{ margin: 0 }}>Este dispositivo tiene datos cargados sin cuenta. Si entrás a una cuenta existente, se reemplazan por los de la cuenta. Para conservarlos, elegí <b>Crear cuenta</b>.</p>
          )}

          {err && <div className="form-error" role="alert">{err}</div>}

          <button type="submit" className="btn primary" style={{ width: '100%', padding: '12px 16px', fontSize: 16 }} disabled={busy}>
            {busy ? 'Conectando…' : mode === 'login' ? 'Entrar' : 'Crear cuenta'}
          </button>
          <p className="tiny muted" style={{ margin: 0, textAlign: 'center' }}>
            Tus datos se guardan en la nube con tu usuario: entrá desde cualquier celular o compu con el mismo usuario y PIN.
          </p>
        </div>
      </form>
      <InstallBanner />
    </div>
  );
}
