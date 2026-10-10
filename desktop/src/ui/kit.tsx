import { ReactNode, createContext, useCallback, useContext, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Spring, lively, project, reducedMotion, releaseVelocity, rubberband, smooth } from '../lib/spring';
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

const HIDDEN = -96;

/** Status message at the top: drops in on a spring and leaves along the same path. */
export function Banner() {
  const message = ui.use().message;
  const [text, setText] = useState<string | null>(null);
  const element = useRef<HTMLDivElement>(null);
  const spring = useRef<Spring>();
  if (!spring.current) {
    spring.current = new Spring(HIDDEN, smooth, (y) => {
      if (element.current) element.current.style.transform = `translate(-50%, ${y}px)`;
    });
  }

  useEffect(() => {
    if (!message) return;
    const timer = setTimeout(() => say(null), 6000);
    return () => clearTimeout(timer);
  }, [message]);

  useLayoutEffect(() => {
    const y = spring.current!;
    if (message && text !== message) setText(message);
    else if (message) y.to(0);
    else y.to(HIDDEN, { onRest: () => setText(null) });
  }, [message, text]);

  if (text === null) return null;
  return (
    <div className="banner" role="status" ref={element}>
      <span>{text}</span>
      <button onClick={() => say(null)} aria-label="Schließen">✕</button>
    </div>
  );
}

// Dialogs open from the control that was pressed, so remember where the last press happened.
let lastPress = { x: 0, y: 0, at: 0 };
if (typeof window !== 'undefined') {
  window.addEventListener('pointerdown', (event) => { lastPress = { x: event.clientX, y: event.clientY, at: Date.now() }; }, true);
}

const DialogClose = createContext<() => void>(() => {});
/** Closes the surrounding dialog with its exit animation. */
export const useDialogClose = () => useContext(DialogClose);

const DRAG_START = 10;
const DISMISS_AT = 150;

/**
 * A sheet that materializes from the control that opened it. It can be dragged down at any moment (also while it
 * is still arriving or leaving), follows the pointer 1:1, resists upwards and, on release, projects the flick to
 * decide between dismissing and springing back with the release velocity.
 */
export function Dialog({ children, onClose }: { children: ReactNode; onClose: () => void }) {
  const scrim = useRef<HTMLDivElement>(null);
  const card = useRef<HTMLDivElement>(null);
  const presence = useRef<Spring>();
  const offset = useRef<Spring>();
  const closing = useRef(false);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  const paint = useCallback(() => {
    const p = presence.current!.value;
    const y = offset.current!.value;
    const visible = Math.min(1, Math.max(0, p));
    const pulled = Math.min(1, Math.max(0, y) / 600);
    if (scrim.current) {
      scrim.current.style.opacity = String(visible * (1 - pulled * 0.6));
      scrim.current.style.backdropFilter = `blur(${(visible * 6).toFixed(2)}px)`;
    }
    if (card.current) {
      card.current.style.opacity = String(visible);
      card.current.style.transform = reducedMotion() ? 'none' : `translateY(${y.toFixed(2)}px) scale(${(0.9 + 0.1 * p).toFixed(4)})`;
    }
  }, []);

  if (!presence.current) presence.current = new Spring(0, smooth, paint);
  if (!offset.current) offset.current = new Spring(0, smooth, paint);

  useLayoutEffect(() => {
    const box = card.current!.getBoundingClientRect();
    const recent = Date.now() - lastPress.at < 3000;
    const x = recent ? Math.min(Math.max(lastPress.x - box.left, 0), box.width) : box.width / 2;
    const y = recent ? Math.min(Math.max(lastPress.y - box.top, 0), box.height) : box.height / 2;
    card.current!.style.transformOrigin = `${x}px ${y}px`;
    paint();
    presence.current!.to(1);
    return () => { presence.current!.grab(); offset.current!.grab(); };
  }, [paint]);

  const dismiss = useCallback((velocity = 0) => {
    if (closing.current) return;
    closing.current = true;
    const done = () => onCloseRef.current();
    if (velocity > 0) {
      offset.current!.to(window.innerHeight, { velocity, onRest: done });
      presence.current!.to(0);
    } else {
      presence.current!.to(0, { onRest: done });
      offset.current!.to(0);
    }
  }, []);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') dismiss();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [dismiss]);

  const drag = useRef<{ id: number; startY: number; grab: number; active: boolean; samples: Array<{ t: number; v: number }> } | null>(null);

  const onPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0 || (event.target as HTMLElement).closest('input, textarea, select, button, a, label, [contenteditable], .no-drag')) return;
    // Grab the sheet wherever it is on screen right now, even in the middle of an animation.
    const y = offset.current!.grab();
    presence.current!.grab();
    closing.current = false;
    event.currentTarget.setPointerCapture(event.pointerId);
    drag.current = { id: event.pointerId, startY: event.clientY, grab: y, active: false, samples: [{ t: event.timeStamp, v: event.clientY }] };
  };

  const onPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    if (!d || d.id !== event.pointerId) return;
    if (!d.active && Math.abs(event.clientY - d.startY) < DRAG_START) return;
    d.active = true;
    d.samples.push({ t: event.timeStamp, v: event.clientY });
    if (d.samples.length > 12) d.samples.shift();
    const raw = d.grab + (event.clientY - d.startY);
    offset.current!.jump(raw >= 0 ? raw : -rubberband(-raw, window.innerHeight));
  };

  const onPointerUp = (event: React.PointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    if (!d || d.id !== event.pointerId) return;
    drag.current = null;
    const y = offset.current!;
    if (!d.active) {
      // A press without a drag: if it interrupted an exit, finish arriving.
      presence.current!.to(1);
      y.to(0);
      return;
    }
    const velocity = releaseVelocity(d.samples);
    if (y.value + project(velocity) > DISMISS_AT && velocity >= 0) {
      dismiss(Math.max(velocity, 0));
    } else {
      y.to(0, { velocity, config: Math.abs(velocity) > 300 ? lively : smooth });
      presence.current!.to(1);
    }
  };

  return (
    <DialogClose.Provider value={dismiss}>
      <div ref={scrim} className="scrim" style={{ opacity: 0 }} onMouseDown={(event) => event.target === event.currentTarget && dismiss()}>
        <div
          ref={card}
          className="dialog"
          role="dialog"
          style={{ opacity: 0 }}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
        >
          {children}
        </div>
      </div>
    </DialogClose.Provider>
  );
}

export function CancelButton() {
  const close = useDialogClose();
  return <button className="btn outline" onClick={close}>Abbrechen</button>;
}

/** A confirm or prompt without the browser's own dialogs. */
export function PromptDialog({ title, label, initial = '', confirm, onSubmit, onClose }: { title: string; label?: string; initial?: string; confirm: string; onSubmit: (text: string) => void; onClose: () => void }) {
  return (
    <Dialog onClose={onClose}>
      <PromptBody title={title} label={label} initial={initial} confirm={confirm} onSubmit={onSubmit} />
    </Dialog>
  );
}

function PromptBody({ title, label, initial, confirm, onSubmit }: { title: string; label?: string; initial: string; confirm: string; onSubmit: (text: string) => void }) {
  const [text, setText] = useState(initial);
  const close = useDialogClose();
  return (
      <div className="col">
        <Caption>{title}</Caption>
        <input className="field" autoFocus placeholder={label} value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && text.trim() !== '') { onSubmit(text); close(); } }} />
        <div className="row" style={{ justifyContent: 'flex-end' }}>
          <button className="btn outline" onClick={close}>Abbrechen</button>
          <button className="btn" disabled={text.trim() === ''} onClick={() => { onSubmit(text); close(); }}>{confirm}</button>
        </div>
      </div>
  );
}

export function ConfirmDialog({ title, text, confirm, onConfirm, onClose }: { title: string; text: string; confirm: string; onConfirm: () => void; onClose: () => void }) {
  return (
    <Dialog onClose={onClose}>
      <ConfirmBody title={title} text={text} confirm={confirm} onConfirm={onConfirm} />
    </Dialog>
  );
}

function ConfirmBody({ title, text, confirm, onConfirm }: { title: string; text: string; confirm: string; onConfirm: () => void }) {
  const close = useDialogClose();
  return (
    <div className="col">
      <Caption>{title}</Caption>
      <p className="muted" style={{ margin: 0 }}>{text}</p>
      <div className="row" style={{ justifyContent: 'flex-end' }}>
        <button className="btn outline" onClick={close}>Abbrechen</button>
        <button className="btn" onClick={() => { onConfirm(); close(); }}>{confirm}</button>
      </div>
    </div>
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
