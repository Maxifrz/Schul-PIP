import { useEffect, useRef, useState } from 'react';
import { PipRun, isBird, obstacleHeight, obstacleLift, obstacleWidth, pipWidth, pipX, world } from '../lib/pipRun';
import { dueCards } from '../lib/review';
import { cardStore, libraryStore, ui } from '../store/app';
import { social } from '../store/social';
import { Caption } from '../ui/kit';

const weekdays = ['SONNTAG', 'MONTAG', 'DIENSTAG', 'MITTWOCH', 'DONNERSTAG', 'FREITAG', 'SAMSTAG'];
const months = ['JAN', 'FEB', 'MÄR', 'APR', 'MAI', 'JUN', 'JUL', 'AUG', 'SEP', 'OKT', 'NOV', 'DEZ'];

/** "DONNERSTAG · 1. OKT · 9:41" above the hero card. */
export function dateCaption(date: Date): string {
  return `${weekdays[date.getDay()]} · ${date.getDate()}. ${months[date.getMonth()]} · ${date.getHours()}:${String(date.getMinutes()).padStart(2, '0')}`;
}

const greeting = (hour: number) => (hour < 11 ? 'Guten Morgen.' : hour < 17 ? 'Guten Tag.' : 'Guten Abend.');

// Pip, drawn the way the iOS app draws it (13 by 13 pixels).
const cat = [
  '.............', '.oo.......oo.', '.opo.....opo.', '.offo...offo.', '.offfffffffo.', 'offfffffffffo', 'offeefffeeffo',
  'offeefffeeffo', 'offfffpfffffo', 'offfffffffffo', '.offfffffffo.', '.offwwfffwwo.', '..ooooooooo..',
];
const palette: Record<string, string> = { o: '#0a0a08', e: '#0a0a08', f: '#7fa98c', p: '#e5a8a2', w: '#fffdf6' };

function drawCat(context: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, step: boolean): void {
  const cw = width / cat[0].length;
  const ch = height / cat.length;
  cat.forEach((row, r) => {
    Array.from(row).forEach((value, c) => {
      if (value === '.') return;
      context.fillStyle = palette[value] ?? '#0a0a08';
      const shift = step && r >= cat.length - 2 ? cw * 0.6 : 0;
      context.fillRect(x + c * cw + shift, y + r * ch, cw + 0.5, ch + 0.5);
    });
  });
}

const bestKey = 'pip.run.best';
const readBest = () => {
  try {
    return Number(localStorage.getItem(bestKey)) || 0;
  } catch {
    return 0;
  }
};

function PipGame({ game, onClose }: { game: React.MutableRefObject<PipRun>; onClose: () => void }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const [, tick] = useState(0);

  useEffect(() => {
    let frame = 0;
    let last = performance.now();
    let wasRunning = false;
    const loop = (now: number) => {
      const run = game.current;
      run.step((now - last) / 1000);
      last = now;
      if (wasRunning && run.phase === 'over') {
        try {
          localStorage.setItem(bestKey, String(run.best));
        } catch {
          // the best score is only a convenience
        }
      }
      wasRunning = run.phase === 'running';
      draw(canvas.current, run);
      frame = requestAnimationFrame(loop);
    };
    frame = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(frame);
  }, [game]);

  const run = game.current;
  return (
    <div className="inner" style={{ padding: 0 }} onMouseDown={() => { game.current.jump(); tick((n) => n + 1); }}>
      <div className="row" style={{ padding: '14px 18px 0' }}>
        <span className="caption grow">{run.phase === 'ready' ? '→ ZUM STARTEN, ↑ SPRINGEN, ↓ DUCKEN, ESC ENDE' : ' '}</span>
        <button className="ghost" onMouseDown={(e) => e.stopPropagation()} onClick={onClose}>ENDE</button>
      </div>
      <canvas ref={canvas} height={230} style={{ height: 230 }} />
      <div className="row" style={{ padding: '0 18px 16px' }} onMouseDown={(e) => e.stopPropagation()}>
        <button className="btn accent small grow" onClick={() => { game.current.jump(); tick((n) => n + 1); }}>SPRUNG</button>
        <button className="btn accent small grow" onClick={() => { game.current.duck(); tick((n) => n + 1); }}>DUCKEN</button>
      </div>
    </div>
  );
}

function draw(canvas: HTMLCanvasElement | null, run: PipRun): void {
  if (!canvas) return;
  const ratio = window.devicePixelRatio || 1;
  const width = canvas.clientWidth;
  const height = 230;
  if (canvas.width !== Math.floor(width * ratio)) canvas.width = Math.floor(width * ratio);
  canvas.height = Math.floor(height * ratio);
  const context = canvas.getContext('2d');
  if (!context) return;
  context.setTransform(ratio, 0, 0, ratio, 0, 0);
  context.clearRect(0, 0, width, height);
  const css = getComputedStyle(document.documentElement);
  const accent = css.getPropertyValue('--accent').trim() || '#7fa98c';
  const ink = '#f1efe7';
  const groundY = height - 30;
  const scale = Math.min(width / world.width, (groundY - 30) / world.height);
  const originX = (width - world.width * scale) / 2;
  const rect = (x: number, lift: number, w: number, h: number): [number, number, number, number] => [originX + x * scale, groundY - (lift + h) * scale, w * scale, h * scale];

  context.strokeStyle = accent;
  context.globalAlpha = 0.7;
  context.lineWidth = 2;
  context.setLineDash([6, 5]);
  context.lineDashOffset = run.distance * scale;
  context.beginPath();
  context.moveTo(0, groundY + 2);
  context.lineTo(width, groundY + 2);
  context.stroke();
  context.globalAlpha = 1;
  context.setLineDash([]);

  context.fillStyle = ink;
  context.font = "24px 'Jersey 10', monospace";
  context.textAlign = 'right';
  const score = String(run.score).padStart(5, '0');
  const best = String(Math.max(run.best, run.score)).padStart(5, '0');
  context.fillText(`HI ${best}  ${score}`, width - 16, groundY - world.height * scale + 6);

  for (const o of run.obstacles) {
    if (isBird(o)) {
      const flap = Math.floor(run.distance / 18) % 2 === 0;
      const [x, y, w, h] = rect(o.x, obstacleLift(o), obstacleWidth(o), obstacleHeight(o));
      context.fillStyle = ink;
      context.fillRect(x, y, w, h);
      context.fillStyle = '#9b978d';
      context.fillRect(x + w * 0.3, flap ? y - h * 0.7 : y + h, w * 0.4, h * 0.7);
    } else {
      const double = o.kind === 'cactusDouble';
      const trunk = double ? 8 : Math.max(6, obstacleWidth(o) * 0.45);
      for (let i = 0; i < (double ? 2 : 1); i++) {
        const offset = double ? i * 20 : (obstacleWidth(o) - trunk) / 2;
        const h = double && i === 1 ? obstacleHeight(o) * 0.8 : obstacleHeight(o);
        context.fillStyle = '#7fa98c';
        context.fillRect(...rect(o.x + offset, 0, trunk, h));
        context.fillRect(...rect(o.x + offset - 4, h * 0.4, 4, 3));
        context.fillRect(...rect(o.x + offset + trunk, h * 0.55, 4, 3));
      }
    }
  }

  const [px, py, pw, ph] = rect(pipX, run.y, pipWidth, run.pipHeight);
  drawCat(context, px, py, pw, ph, !run.isAirborne && run.phase === 'running' && Math.floor(run.distance / 14) % 2 === 0);

  if (run.phase === 'over') {
    context.fillStyle = accent;
    context.font = "44px 'Jersey 10', monospace";
    context.textAlign = 'center';
    context.fillText('GAME OVER', width / 2, groundY - world.height * scale * 0.5);
  }
}

export function Today() {
  const { list } = cardStore.use();
  const { items } = libraryStore.use();
  const socialState = social.use();
  const now = new Date();
  const due = dueCards(list).length;
  const last = [...items].filter((m) => m.lastOpenedAt).sort((a, b) => (b.lastOpenedAt ?? 0) - (a.lastOpenedAt ?? 0))[0];
  const [playing, setPlaying] = useState(false);
  const game = useRef(new PipRun(BigInt(Date.now()), readBest()));
  const [, tick] = useState(0);
  const [clock, setClock] = useState(now);

  useEffect(() => {
    const timer = setInterval(() => setClock(new Date()), 30_000);
    return () => clearInterval(timer);
  }, []);

  // Right arrow starts the game; up jumps (also space), down ducks, escape leaves. Typing in a field is left alone.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) return;
      if (event.ctrlKey || event.metaKey || event.altKey) return;
      if (event.key === 'ArrowRight') {
        event.preventDefault();
        setPlaying(true);
        game.current.start();
      } else if (!playing) {
        return;
      } else if (event.key === 'ArrowUp' || event.key === ' ') {
        event.preventDefault();
        game.current.jump();
      } else if (event.key === 'ArrowDown') {
        event.preventDefault();
        game.current.duck();
      } else if (event.key === 'Escape') {
        setPlaying(false);
      }
      tick((n) => n + 1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [playing]);

  return (
    <div className="page">
      <div className="hero">
        {playing ? (
          <PipGame game={game} onClose={() => setPlaying(false)} />
        ) : (
          <div className="inner">
            <span className="caption">{dateCaption(clock)}</span>
            <div className="row" style={{ alignItems: 'flex-end', flex: 1, gap: 28 }}>
              <div className="col grow" style={{ gap: 6 }}>
                <span className="line">{greeting(clock.getHours())}</span>
                <span className="big">{due > 0 ? `${due} KARTEN` : 'RUHIG.'}</span>
                <span className="line">{due > 0 ? 'WARTEN AUF DICH.' : 'NICHTS FÄLLIG.'}</span>
              </div>
              <div className="col" style={{ alignItems: 'flex-start', gap: 10 }}>
                <span className="bubble">{due > 0 ? `${due} ${due === 1 ? 'Karte wartet' : 'Karten warten'}. Los?` : 'Alles wiederholt. Mrrp.'}</span>
                <PipSprite onClick={() => { setPlaying(true); game.current.start(); }} />
                <span className="caption">TIPPEN ODER PFEIL RECHTS</span>
              </div>
            </div>
          </div>
        )}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 14, marginTop: 18 }}>
        <button className="card col" onClick={() => ui.set({ tab: 'review' })}>
          <Caption>Karten</Caption>
          <span style={{ fontSize: 34, fontWeight: 800, letterSpacing: '-0.03em' }}>{due}</span>
          <span className="muted small">{due === 0 ? 'Nichts fällig' : due === 1 ? 'Karte fällig' : 'Karten fällig'}</span>
        </button>
        <button className="card col" onClick={() => ui.set({ tab: 'courses' })}>
          <Caption>Kurse</Caption>
          <span style={{ fontSize: 34, fontWeight: 800, letterSpacing: '-0.03em' }}>{socialState.phase === 'signedIn' ? socialState.groups.length : '–'}</span>
          <span className="muted small">{socialState.phase === 'signedIn' ? 'Kurse und Gruppen' : 'Server verbinden und anmelden'}</span>
        </button>
        <button className="card col" onClick={() => ui.set({ tab: 'library' })}>
          <Caption>Weiterlesen</Caption>
          <span style={{ fontSize: 20, fontWeight: 700, overflowWrap: 'anywhere' }}>{last ? last.title : 'Noch nichts geöffnet'}</span>
          <span className="muted small">{last ? `Seite ${last.lastPage}` : 'Importiere ein PDF in der Bibliothek'}</span>
        </button>
      </div>
    </div>
  );
}

function PipSprite({ onClick }: { onClick: () => void }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const element = canvas.current;
    const context = element?.getContext('2d');
    if (!element || !context) return;
    context.clearRect(0, 0, element.width, element.height);
    drawCat(context, 0, 0, element.width, element.height, false);
  }, []);
  return <canvas ref={canvas} width={104} height={104} style={{ width: 104, height: 104, cursor: 'pointer', imageRendering: 'pixelated' }} onClick={onClick} aria-label="Pip" />;
}
