import { ReactNode, useEffect, useState } from 'react';
import { say, ui } from '../store/app';

export function Caption({ children }: { children: ReactNode }) {
  return <div className="caption">{children}</div>;
}

export function PageHeader({ caption, title, children }: { caption: string; title: string; children?: ReactNode }) {
  return (
    <div className="row" style={{ alignItems: 'flex-end', marginBottom: 24 }}>
      <div className="grow">
        <Caption>{caption}</Caption>
        <h1 className="title">{title}</h1>
      </div>
      {children}
    </div>
  );
}

export function Banner() {
  const message = ui.use().message;
  useEffect(() => {
    if (!message) return;
    const timer = setTimeout(() => say(null), 6000);
    return () => clearTimeout(timer);
  }, [message]);
  if (!message) return null;
  return (
    <div className="banner" role="status">
      <span>{message}</span>
      <button onClick={() => say(null)} aria-label="Schließen">✕</button>
    </div>
  );
}

export function Dialog({ children, onClose }: { children: ReactNode; onClose: () => void }) {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <div className="scrim" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <div className="dialog" role="dialog">{children}</div>
    </div>
  );
}

/** A confirm or prompt without the browser's own dialogs. */
export function PromptDialog({ title, label, initial = '', confirm, onSubmit, onClose }: { title: string; label?: string; initial?: string; confirm: string; onSubmit: (text: string) => void; onClose: () => void }) {
  const [text, setText] = useState(initial);
  return (
    <Dialog onClose={onClose}>
      <div className="col">
        <Caption>{title}</Caption>
        <input className="field" autoFocus placeholder={label} value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && text.trim() !== '') { onSubmit(text); onClose(); } }} />
        <div className="row" style={{ justifyContent: 'flex-end' }}>
          <button className="btn outline" onClick={onClose}>Abbrechen</button>
          <button className="btn" disabled={text.trim() === ''} onClick={() => { onSubmit(text); onClose(); }}>{confirm}</button>
        </div>
      </div>
    </Dialog>
  );
}

export function ConfirmDialog({ title, text, confirm, onConfirm, onClose }: { title: string; text: string; confirm: string; onConfirm: () => void; onClose: () => void }) {
  return (
    <Dialog onClose={onClose}>
      <div className="col">
        <Caption>{title}</Caption>
        <p className="muted" style={{ margin: 0 }}>{text}</p>
        <div className="row" style={{ justifyContent: 'flex-end' }}>
          <button className="btn outline" onClick={onClose}>Abbrechen</button>
          <button className="btn" onClick={() => { onConfirm(); onClose(); }}>{confirm}</button>
        </div>
      </div>
    </Dialog>
  );
}

export function Pills<T extends string>({ items, value, onChange }: { items: Array<{ id: T; label: string }>; value: T; onChange: (id: T) => void }) {
  return (
    <div className="tabs">
      {items.map((item) => (
        <button key={item.id} className={`pill ${item.id === value ? 'on' : ''}`} onClick={() => onChange(item.id)}>
          {item.label}
        </button>
      ))}
    </div>
  );
}

const paths: Record<string, string> = {
  today: 'M3 11.5 12 4l9 7.5M5.5 10v9h13v-9',
  library: 'M5 4h3v16H5zM10.5 4h3v16h-3zM16 6.5l3-.8 3.4 13-3 .8z',
  review: 'M4 6h16v12H4zM8 10h8M8 14h5',
  courses: 'M9 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM3 19c0-3 2.7-5 6-5s6 2 6 5M17 10a2.5 2.5 0 1 0 0-5M17.5 14c2.2.4 3.5 2 3.5 4.5',
  calculator: 'M6 3h12v18H6zM9 7h6M9 12h1.5M13.5 12H15M9 16h1.5M13.5 16H15',
  settings: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19 12l2-1.5-2-3.5-2.4.8a7 7 0 0 0-1.8-1L14.4 4h-4l-.4 2.8a7 7 0 0 0-1.8 1L5.8 7 3.800 10.5 5.800 12a7 7 0 0 0 0 2L3.800 15.500 5.800 19l2.400-.8a7 7 0 0 0 1.800 1l.4 2.800h4l.4-2.800a7 7 0 0 0 1.800-1l2.400.8 2-3.500-2-1.500a7 7 0 0 0 0-2z',
};

export function Icon({ name }: { name: keyof typeof paths }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={paths[name]} />
    </svg>
  );
}
