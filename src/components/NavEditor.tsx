import { useEffect, useState } from 'react';
import { useStore } from '../lib/store';
import { DEFAULT_TABS, MAX_TABS, NAV, cleanTabs } from '../lib/nav';
import { Modal, toast } from './ui';

/** Elegir qué secciones van en la barra de abajo y en qué orden (el resto queda en "Más"). */
export function NavEditor({ open, onClose }: { open: boolean; onClose: () => void }) {
  const saved = useStore((s) => s.settings.navTabs);
  const setSettings = useStore((s) => s.setSettings);
  const [tabs, setTabs] = useState<string[]>(cleanTabs(saved));
  useEffect(() => { if (open) setTabs(cleanTabs(saved)); }, [open]); // eslint-disable-line

  const item = (id: string) => NAV.find((n) => n.id === id)!;
  const move = (i: number, d: -1 | 1) => setTabs((t) => {
    const j = i + d;
    if (j < 0 || j >= t.length) return t;
    const n = [...t];
    [n[i], n[j]] = [n[j], n[i]];
    return n;
  });
  const remove = (id: string) => {
    if (tabs.length <= 1) return toast('Dejá al menos una pestaña', '☝️');
    setTabs((t) => t.filter((x) => x !== id));
  };
  const add = (id: string) => {
    if (tabs.length >= MAX_TABS) return toast(`Entran hasta ${MAX_TABS}. Sacá una para sumar otra`, '☝️');
    setTabs((t) => [...t, id]);
  };
  const save = () => { setSettings({ navTabs: tabs }); toast('Pestañas guardadas', '✨'); onClose(); };
  const rest = NAV.filter((n) => !tabs.includes(n.id));

  return (
    <Modal open={open} onClose={onClose}>
      <div className="row between" style={{ marginBottom: 6 }}>
        <h2 className="h2">Editar pestañas</h2>
        <button className="btn ghost icon" onClick={onClose} aria-label="Cerrar">✕</button>
      </div>
      <p className="small muted" style={{ marginTop: 0 }}>Elegí hasta {MAX_TABS} para la barra de abajo y ordenalas con las flechas. Las demás quedan en “Más”.</p>

      {/* vista previa */}
      <div className="nav-preview" aria-hidden="true">
        {tabs.map((id) => <span key={id}><b>{item(id).ico}</b>{item(id).label}</span>)}
        <span><b>☰</b>Más</span>
      </div>

      <span className="label">En la barra ({tabs.length}/{MAX_TABS})</span>
      <ol className="nav-edit-list">
        {tabs.map((id, i) => (
          <li key={id} className="nav-edit-item">
            <span className="ne-ico">{item(id).ico}</span>
            <span className="grow">{item(id).label}</span>
            <button className="btn ghost icon sm" aria-label={`Subir ${item(id).label}`} disabled={i === 0} onClick={() => move(i, -1)}>↑</button>
            <button className="btn ghost icon sm" aria-label={`Bajar ${item(id).label}`} disabled={i === tabs.length - 1} onClick={() => move(i, 1)}>↓</button>
            <button className="btn ghost icon sm" aria-label={`Sacar ${item(id).label}`} onClick={() => remove(id)}>✕</button>
          </li>
        ))}
      </ol>

      <span className="label" style={{ marginTop: 14 }}>En “Más”</span>
      <div className="nav-edit-list">
        {rest.map((n) => (
          <div key={n.id} className="nav-edit-item off">
            <span className="ne-ico">{n.ico}</span>
            <span className="grow">{n.label}</span>
            <button className="btn sm" aria-label={`Agregar ${n.label}`} disabled={tabs.length >= MAX_TABS} onClick={() => add(n.id)}>+ Agregar</button>
          </div>
        ))}
      </div>

      <div className="row between" style={{ marginTop: 16, gap: 8 }}>
        <button className="btn ghost sm" onClick={() => setTabs(DEFAULT_TABS)}>Restablecer</button>
        <button className="btn primary" onClick={save}>Guardar</button>
      </div>
    </Modal>
  );
}
