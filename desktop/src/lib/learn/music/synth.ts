import type { ToneSpec } from '../media';

export const frequencyOf = (midi: number): number => 440 * 2 ** ((midi - 69) / 12);

/** One note of the soft piano-like tone: a few harmonics with a quick attack and a slow decay. */
export function toneAt(midi: number, t: number, length: number, together: boolean): number {
  const omega = 2 * Math.PI * frequencyOf(midi);
  const attack = Math.min(1, t / 0.01);
  const decay = Math.exp(-t * (together ? 1.6 : 3.2));
  const release = Math.max(0, Math.min(1, (length - t) / 0.05));
  const wave = Math.sin(omega * t) + 0.4 * Math.sin(2 * omega * t) + 0.18 * Math.sin(3 * omega * t) + 0.08 * Math.sin(4 * omega * t);
  return (wave * attack * decay * release) / 1.66;
}

/** The samples of the notes, one after the other or as a chord, computed here so no sound files are needed. */
export function renderTones(spec: ToneSpec, sampleRate: number): Float32Array<ArrayBuffer> {
  const noteSeconds = spec.together ? 1.8 : 0.75;
  const gap = spec.together ? 0 : 0.05;
  const count = spec.together ? 1 : spec.midi.length;
  const frames = Math.floor((count * (noteSeconds + gap) + 0.2) * sampleRate);
  const samples = new Float32Array(new ArrayBuffer(frames * 4));
  const groups = spec.together ? [spec.midi] : spec.midi.map((m) => [m]);
  const loudness = 0.5 / Math.max(1, groups[0]?.length ?? 1);
  groups.forEach((group, position) => {
    const start = Math.floor(position * (noteSeconds + gap) * sampleRate);
    const length = Math.floor(noteSeconds * sampleRate);
    for (const midi of group) {
      for (let step = 0; step < length && start + step < frames; step++) {
        samples[start + step] += toneAt(midi, step / sampleRate, noteSeconds, spec.together) * loudness * 2;
      }
    }
  });
  return samples;
}

let context: AudioContext | null = null;
let current: AudioBufferSourceNode | null = null;

/** Plays the notes; does nothing where there is no audio. */
export function playTones(spec: ToneSpec): void {
  if (spec.midi.length === 0 || typeof AudioContext === 'undefined') return;
  context ??= new AudioContext();
  void context.resume();
  stopTones();
  const samples = renderTones(spec, context.sampleRate);
  const buffer = context.createBuffer(1, samples.length, context.sampleRate);
  buffer.copyToChannel(samples, 0);
  const source = context.createBufferSource();
  source.buffer = buffer;
  source.connect(context.destination);
  source.start();
  current = source;
}

export function stopTones(): void {
  try { current?.stop(); } catch { /* already stopped */ }
  current = null;
}
