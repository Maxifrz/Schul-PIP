import { useEffect } from 'react';
import { LearnVerdict } from '../../lib/learn/exercise';
import { LessonModel } from '../../lib/learn/lessonModel';
import type { Clef, StaffNote, StaffSpec, ToneSpec } from '../../lib/learn/media';
import { glyphPath, glyphWidth, GlyphName } from '../../lib/learn/music/glyphs';
import { PianoLayout, accidentalFor, flags, keySignatureSigns, ledgerSteps, shiftedSteps, stemUp, stepOf } from '../../lib/learn/music/rules';
import { playTones, stopTones } from '../../lib/learn/music/synth';
import { Glyph } from '../../ui/glyph';

const maxSpace = 12;
const clefName = (c: Clef) => ({ treble: 'Violinschlüssel', bass: 'Bassschlüssel', alto: 'Altschlüssel' })[c];
const clefGlyph = (c: Clef): GlyphName => ({ treble: 'gClef', bass: 'fClef', alto: 'cClef' } as const)[c];

/** Notes on a staff, drawn in the text color so it fits light and dark mode. Where things go comes from the rules module; this only paints it. */
export function StaffView({ spec }: { spec: StaffSpec }) {
  const slotCount = spec.chord ? 1 : spec.notes.length;
  const signs = Math.min(7, Math.abs(spec.keySignature));
  const clefW = glyphWidth[clefGlyph(spec.clef)];
  const leading = 0.6 + clefW + signs + (spec.time ? 2.4 : 0) + 1.2;
  const needed = leading + Math.max(1, slotCount) * 3.4 + 1;
  const width = 520;
  const height = maxSpace * 13;
  const s = Math.min(maxSpace, width / needed);
  const bottom = height / 2 + 2 * s;
  const y = (step: number) => bottom - (step * s) / 2;
  const shapes: JSX.Element[] = [];
  let k = 0;
  const key = () => `s${k++}`;
  const sw = (m: number, base: number) => Math.max(m, s * base);

  for (let line = 0; line < 5; line++) shapes.push(<line key={key()} x1={0} x2={width} y1={y(line * 2)} y2={y(line * 2)} stroke="currentColor" strokeWidth={sw(1, 0.09)} />);
  shapes.push(<line key={key()} x1={width - 1} x2={width - 1} y1={y(0)} y2={y(8)} stroke="currentColor" strokeWidth={sw(1.5, 0.16)} />);

  let x = 0.6 * s;
  shapes.push(<path key={key()} d={glyphPath(clefGlyph(spec.clef), x, bottom, s)} fill="currentColor" />);
  x += clefW * s;
  const sign = (accidental: string, ax: number, step: number) => {
    const lift = accidental.includes('flat') || accidental === 'flat' ? 0.4 * s : 0;
    const symbol = ({ sharp: '♯', flat: '♭', natural: '♮', doubleSharp: '♯♯', doubleFlat: '♭♭' } as Record<string, string>)[accidental];
    shapes.push(<text key={key()} x={ax} y={y(step) - lift} fontSize={s * 2.7} textAnchor="middle" dominantBaseline="central" fill="currentColor">{symbol}</text>);
  };
  for (const g of keySignatureSigns(spec.keySignature, spec.clef)) {
    sign(g.sharp ? 'sharp' : 'flat', x + s * 0.4, g.step);
    x += s;
  }
  if (spec.time) {
    const parts = spec.time.split('/');
    if (parts.length === 2) parts.forEach((part, i) => shapes.push(<text key={key()} x={x + s * 0.8} y={y(i === 0 ? 6 : 2)} fontSize={s * 2.5} fontWeight={700} textAnchor="middle" dominantBaseline="central" fill="currentColor">{part}</text>));
    x += 2.4 * s;
  }
  x += 1.2 * s;

  const slots = Math.max(1, slotCount);
  const slotWidth = Math.min(6 * s, Math.max(3.4 * s, (width - x - s) / slots));

  const rest = (value: StaffNote['value'], cx: number) => {
    switch (value) {
      case 'whole': shapes.push(<rect key={key()} x={cx - 0.65 * s} y={y(6)} width={1.3 * s} height={0.5 * s} fill="currentColor" />); break;
      case 'half': shapes.push(<rect key={key()} x={cx - 0.65 * s} y={y(4) - 0.5 * s} width={1.3 * s} height={0.5 * s} fill="currentColor" />); break;
      case 'quarter': shapes.push(<path key={key()} d={glyphPath('quarterRest', cx - 0.45 * s, bottom, s)} fill="currentColor" />); break;
      case 'eighth': shapes.push(<path key={key()} d={glyphPath('eighthRest', cx - 0.45 * s, bottom, s)} fill="currentColor" />); break;
      default: shapes.push(<path key={key()} d={glyphPath('sixteenthRest', cx - 0.6 * s, bottom, s)} fill="currentColor" />);
    }
  };

  const drawSlot = (notes: StaffNote[], cx: number) => {
    const first = notes[0];
    if (!first) return;
    if (first.isRest) { rest(first.value, cx); return; }
    const steps = notes.map((n) => stepOf(n.pitch, spec.clef));
    const up = stemUp(steps);
    const moved = shiftedSteps(steps);
    const value = first.value;
    notes.forEach((note, index) => {
      const step = steps[index];
      const headX = cx + (moved[index] ? (up ? 1.15 * s : -1.15 * s) : 0);
      for (const ledger of ledgerSteps(step)) shapes.push(<line key={key()} x1={headX - s} x2={headX + s} y1={y(ledger)} y2={y(ledger)} stroke="currentColor" strokeWidth={sw(1, 0.12)} />);
      const accidental = accidentalFor(note.pitch, spec.keySignature);
      if (accidental) sign(accidental, cx - 1.5 * s, step);
      const wide = value === 'whole' ? 1 : 0.66;
      shapes.push(
        <ellipse key={key()} cx={0} cy={0} rx={wide * s} ry={0.5 * s} transform={`translate(${headX} ${y(step)}) rotate(-18)`}
          fill={value === 'whole' || value === 'half' ? 'none' : 'currentColor'} stroke="currentColor" strokeWidth={value === 'whole' ? sw(1.5, 0.26) : value === 'half' ? sw(1.5, 0.2) : 0} />,
      );
    });
    if (value === 'whole') return;
    const ys = steps.map((st) => y(st));
    const low = Math.max(...ys), high = Math.min(...ys);
    const stemX = cx + (up ? 0.6 * s : -0.6 * s);
    const tip = up ? high - 3.3 * s : low + 3.3 * s;
    shapes.push(<line key={key()} x1={stemX} x2={stemX} y1={up ? low : high} y2={tip} stroke="currentColor" strokeWidth={sw(1, 0.13)} />);
    for (let flag = 0; flag < flags(value); flag++) {
      const offset = flag * 0.9 * s;
      const sx = stemX, sy = up ? tip + offset : tip - offset;
      const dir = up ? 1 : -1;
      shapes.push(<path key={key()} d={`M${sx} ${sy}C${sx + 0.1 * s} ${sy + dir * 0.9 * s} ${sx + 1.2 * s} ${sy + dir * 0.9 * s} ${sx + 0.95 * s} ${sy + dir * 2 * s}`} fill="none" stroke="currentColor" strokeWidth={sw(1.2, 0.3)} strokeLinecap="round" />);
    }
  };

  for (let slot = 0; slot < slotCount; slot++) drawSlot(spec.chord ? spec.notes : [spec.notes[slot]], x + slotWidth * (slot + 0.5));

  const count = spec.notes.length;
  return (
    <svg className="ln-staff" viewBox={`0 0 ${width} ${height}`} role="img" aria-label={`Notenzeile im ${clefName(spec.clef)} mit ${count} ${count === 1 ? 'Note' : 'Noten'}`}>
      {shapes}
    </svg>
  );
}

/** A button that plays the notes of an ear exercise. */
export function TonePlayButton({ spec }: { spec: ToneSpec }) {
  useEffect(() => stopTones, []);
  const label = spec.together ? 'Klang anhören' : spec.midi.length > 1 ? 'Töne anhören' : 'Ton anhören';
  return <button className="btn" onClick={() => playTones(spec)} aria-label={label}><Glyph name="speaker" size={18} />{label}</button>;
}

/** A piano keyboard to tap a key on. The answer is the key's MIDI number as text ("60" is the middle C). No key is named, because the exercises ask for them. */
export function PianoView({ model, correct, revealsSolution }: { model: LessonModel; correct: number[]; revealsSolution: boolean }) {
  const [low, high] = PianoLayout.range(correct);
  const whites = PianoLayout.whiteKeys(low, high);
  const verdict: LearnVerdict | null = model.verdict;
  const w = 100 / Math.max(1, whites.length);
  const state = (midi: number): string => {
    const text = String(midi);
    if (verdict) {
      if (correct.includes(midi) && (revealsSolution || verdict === 'right')) return 'right';
      if (model.choice === text) return 'wrong';
    } else if (model.choice === text) return 'picked';
    return '';
  };
  const key = (midi: number, black: boolean, left: number, width: number) => (
    <button key={midi} type="button" className={`ln-key ${black ? 'black' : 'white'} ${state(midi)}`} style={{ left: `${left}%`, width: `${width}%` }}
      aria-label={PianoLayout.name(midi)} aria-pressed={model.choice === String(midi)} disabled={verdict !== null} onClick={() => model.pick(String(midi))} />
  );
  return (
    <div className="ln-piano" role="group" aria-label="Klaviatur">
      {whites.map((midi, i) => key(midi, false, i * w, w))}
      {Array.from({ length: high - low + 1 }, (_, i) => low + i).filter(PianoLayout.isBlack).map((midi) => key(midi, true, PianoLayout.blackKeyCenter(midi, low) * w - w * 0.31, w * 0.62))}
    </div>
  );
}
