import { useEffect, useLayoutEffect, useRef } from 'react';
import { Tab, cardStore, libraryStore, startStores, ui } from './store/app';
import { startSocial } from './store/social';
import { dueCards } from './lib/review';
import { Spring, smooth } from './lib/spring';
import { Banner, Icon } from './ui/kit';
import { Calculator } from './views/Calculator';
import { Courses } from './views/Courses';
import { Library } from './views/Library';
import { Review } from './views/Review';
import { Settings } from './views/Settings';
import { Today } from './views/Today';

const items: Array<{ id: Tab; label: string; icon: 'today' | 'library' | 'review' | 'courses' | 'calculator' | 'settings' }> = [
  { id: 'today', label: 'Heute', icon: 'today' },
  { id: 'library', label: 'Bibliothek', icon: 'library' },
  { id: 'review', label: 'Karten', icon: 'review' },
  { id: 'courses', label: 'Kurse', icon: 'courses' },
  { id: 'calculator', label: 'Rechner', icon: 'calculator' },
  { id: 'settings', label: 'Einstellungen', icon: 'settings' },
];

export function App() {
  const tab = ui.use().tab;
  const cards = cardStore.use().list;
  libraryStore.use();
  const due = dueCards(cards).length;

  // One indicator slides to the active item on a spring, so switching areas is a movement, not a swap.
  const nav = useRef<HTMLElement>(null);
  const indicator = useRef<HTMLDivElement>(null);
  const slide = useRef<Spring>();
  const placed = useRef(false);
  useLayoutEffect(() => {
    if (!slide.current) {
      slide.current = new Spring(0, smooth, (y) => {
        if (indicator.current) indicator.current.style.transform = `translateY(${y}px)`;
      });
    }
    const active = nav.current?.querySelector<HTMLElement>('.nav.on');
    if (!active || !indicator.current) return;
    indicator.current.style.height = `${active.offsetHeight}px`;
    if (placed.current) slide.current.to(active.offsetTop);
    else slide.current.jump(active.offsetTop);
    placed.current = true;
  }, [tab]);

  useEffect(() => {
    void startStores();
    void startSocial();
  }, []);

  // The main process forwards Ctrl+1 to Ctrl+6 while the calculator has the keyboard.
  useEffect(() => window.api?.onNavigate((index) => ui.set({ tab: items[index]?.id ?? 'today' })), []);

  // Ctrl+1 to Ctrl+6 switch the area.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (!event.ctrlKey || event.altKey || event.shiftKey) return;
      const index = Number(event.key) - 1;
      if (index >= 0 && index < items.length) {
        event.preventDefault();
        ui.set({ tab: items[index].id });
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <div className="shell">
      <nav className="sidebar" ref={nav}>
        <div className="indicator" ref={indicator} />
        <div className="brand">SCHUL-PIP</div>
        {items.map((item, index) => (
          <button key={item.id} className={`nav ${tab === item.id ? 'on' : ''}`} onClick={() => ui.set({ tab: item.id })} title={`Strg+${index + 1}`}>
            <Icon name={item.icon} />
            {item.label}
            {item.id === 'review' && due > 0 && <span className="badge">{due}</span>}
          </button>
        ))}
        <div className="spacer" />
        <div className="foot">Windows · Version {window.api?.version ?? 'dev'}</div>
      </nav>
      <main className="main">
        {tab === 'today' && <Today />}
        {tab === 'library' && <Library />}
        {tab === 'review' && <Review />}
        {tab === 'courses' && <Courses />}
        {tab === 'calculator' && <Calculator />}
        {tab === 'settings' && <Settings />}
      </main>
      <Banner />
    </div>
  );
}
