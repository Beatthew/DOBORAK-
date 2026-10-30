import type { Beats } from '../songs/types';
import type { Cymbal, Drum, Exercise, Fill, Groove } from '../types';
import crashUrl from './samples/crash.wav';
import floortomUrl from './samples/floortom.wav';
import hihatUrl from './samples/hihat.wav';
import kickUrl from './samples/kick.wav';
import rideUrl from './samples/ride.wav';
import snareUrl from './samples/snare.wav';
import tom1Url from './samples/tom1.wav';
import tom2Url from './samples/tom2.wav';

export interface Bar {
  /** Eighth notes in this bar: 8, or 2 for the closing crash + kick. With a score: SCORE_DIV steps per quarter. */
  steps: number;
  groove?: Groove;
  fill?: Fill;
  /** Notated bar: the instrument tokens sounding on each step. */
  score?: string[][];
  cymbal: Cymbal;
  /** Crash replaces the cymbal on beat one. */
  crash: boolean;
  /** Only crash + kick on beat one, then the run ends. */
  landing?: boolean;
}

export interface PlayOptions {
  bpm: number;
  loop: boolean;
  /** Steps per quarter note; eighths by default. */
  div?: number;
  /** Fires as each eighth note sounds; step counts from 1. */
  onStep?: (step: number, total: number) => void;
  onEnd?: () => void;
}

let ctx: AudioContext | null = null;

function audio(): AudioContext | null {
  if (ctx) return ctx;
  const AC =
    window.AudioContext ??
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AC) return null;
  ctx = new AC();
  return ctx;
}

function noise(c: AudioContext, t: number, dur: number, freq: number, type: BiquadFilterType, vol: number) {
  const n = Math.floor(c.sampleRate * dur);
  const buf = c.createBuffer(1, n, c.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < n; i++) data[i] = Math.random() * 2 - 1;
  const src = c.createBufferSource();
  src.buffer = buf;
  const filter = c.createBiquadFilter();
  filter.type = type;
  filter.frequency.value = freq;
  const gain = c.createGain();
  gain.gain.setValueAtTime(vol, t);
  gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
  src.connect(filter).connect(gain).connect(c.destination);
  src.start(t);
  src.stop(t + dur);
}

function tone(c: AudioContext, t: number, from: number, to: number, dur: number, vol: number, type: OscillatorType) {
  const osc = c.createOscillator();
  const gain = c.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(from, t);
  osc.frequency.exponentialRampToValueAtTime(to, t + dur * 0.6);
  gain.gain.setValueAtTime(vol, t);
  gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
  osc.connect(gain).connect(c.destination);
  osc.start(t);
  osc.stop(t + dur + 0.02);
}

// Recorded one-shots (Real Drums Vol. 1 by George Rennie). They are bundled into the build,
// so playback works from a double-clicked file too. Until they are decoded, or if decoding
// fails, the synthesised fallbacks below play instead.
type SampleName = 'kick' | 'snare' | 'hihat' | 'ride' | 'crash' | 'tom1' | 'tom2' | 'floortom';

const sampleUrls: Record<SampleName, string> = {
  kick: kickUrl,
  snare: snareUrl,
  hihat: hihatUrl,
  ride: rideUrl,
  crash: crashUrl,
  tom1: tom1Url,
  tom2: tom2Url,
  floortom: floortomUrl,
};

/** Mix levels: the files are all normalised to the same peak. */
const sampleGain: Record<SampleName, number> = {
  kick: 1,
  snare: 0.85,
  hihat: 0.45,
  ride: 0.45,
  crash: 0.6,
  tom1: 0.85,
  tom2: 0.85,
  floortom: 0.9,
};

const buffers: Partial<Record<SampleName, AudioBuffer>> = {};
let loading: Promise<void> | null = null;

/** Decodes every sample once; safe to call repeatedly. */
export function preloadSamples(): Promise<void> {
  const c = audio();
  if (!c) return Promise.resolve();
  loading ??= Promise.all(
    (Object.keys(sampleUrls) as SampleName[]).map(async (name) => {
      try {
        const res = await fetch(sampleUrls[name]);
        buffers[name] = await c.decodeAudioData(await res.arrayBuffer());
      } catch {
        // keep the synthesised fallback for this drum
      }
    }),
  ).then(() => undefined);
  return loading;
}

function sample(c: AudioContext, t: number, name: SampleName, level = 1): boolean {
  const buffer = buffers[name];
  if (!buffer) return false;
  const src = c.createBufferSource();
  src.buffer = buffer;
  const gain = c.createGain();
  gain.gain.value = sampleGain[name] * level;
  src.connect(gain).connect(c.destination);
  src.start(t);
  return true;
}

const snare = (c: AudioContext, t: number) => sample(c, t, 'snare') || noise(c, t, 0.18, 1800, 'bandpass', 0.7);
const kick = (c: AudioContext, t: number) => sample(c, t, 'kick') || tone(c, t, 140, 45, 0.22, 0.9, 'sine');
const crash = (c: AudioContext, t: number) => sample(c, t, 'crash') || noise(c, t, 1.4, 3500, 'highpass', 0.55);

const toms: Record<Exclude<Drum, 'sn'>, { name: SampleName; pitch: [number, number] }> = {
  t1: { name: 'tom1', pitch: [260, 170] },
  t2: { name: 'tom2', pitch: [190, 125] },
  ft: { name: 'floortom', pitch: [120, 78] },
};

function drum(c: AudioContext, t: number, d: Drum) {
  if (d === 'sn') {
    snare(c, t);
    return;
  }
  const tom = toms[d];
  if (sample(c, t, tom.name)) return;
  tone(c, t, tom.pitch[0], tom.pitch[1], 0.32, 0.75, 'sine');
  noise(c, t, 0.04, 2500, 'bandpass', 0.15);
}

const SCORE_SAMPLE: Record<string, SampleName> = {
  c: 'crash', r: 'ride', h: 'hihat', o: 'hihat', t: 'tom1', u: 'tom2', s: 'snare', f: 'floortom', k: 'kick',
};

/** One notated hit: '(s)' is a ghost note, 's>' an accent. */
function scoreHit(c: AudioContext, t: number, token: string) {
  const name = SCORE_SAMPLE[token.replace(/[()>]/g, '')];
  if (name) sample(c, t, name, token.startsWith('(') ? 0.35 : token.endsWith('>') ? 1.2 : 1);
}

function hit(c: AudioContext, t: number, bar: Bar, i: number) {
  if (bar.score) {
    bar.score[i].forEach((token) => scoreHit(c, t, token));
    return;
  }
  if (bar.landing) {
    if (i === 0) {
      crash(c, t);
      kick(c, t);
    }
    return;
  }
  if (i === 0 && bar.crash) {
    crash(c, t);
  } else if (bar.groove?.hh[i] === '1') {
    if (bar.cymbal === 'ride') {
      if (!sample(c, t, 'ride')) {
        noise(c, t, 0.3, 5500, 'bandpass', 0.22);
        tone(c, t, 3200, 3100, 0.3, 0.06, 'triangle');
      }
    } else if (!sample(c, t, 'hihat')) {
      noise(c, t, 0.05, 7000, 'highpass', 0.25);
    }
  }
  if (bar.fill) {
    drum(c, t, bar.fill.drums[i]);
    return;
  }
  if (bar.groove?.sn[i] === '1') snare(c, t);
  if (bar.groove?.kk[i] === '1') kick(c, t);
}

/** Schedules bars on the audio clock a little ahead of time, so timing does not drift with the UI. */
export class Player {
  private interval: number | null = null;
  private timeouts: number[] = [];
  private run = 0;

  /** Resolves false when nothing can play (no audio support, nothing to play, or stopped while loading). */
  async start(bars: Bar[], opts: PlayOptions): Promise<boolean> {
    this.stop();
    const c = audio();
    const seq = bars.flatMap((bar) => Array.from({ length: bar.steps }, (_, i) => ({ bar, i })));
    if (!c || seq.length === 0) return false;
    const run = ++this.run;
    void c.resume();
    await preloadSamples();
    if (this.run !== run) return false;
    const stepDur = 60 / opts.bpm / (opts.div ?? 2);
    const total = seq.length;
    let next = c.currentTime + 0.06;
    let s = 0;

    const later = (fn: () => void, at: number) => {
      const id = window.setTimeout(() => {
        if (this.run === run) fn();
      }, Math.max(0, (at - c.currentTime) * 1000));
      this.timeouts.push(id);
    };

    const schedule = () => {
      while (next < c.currentTime + 0.12) {
        if (s >= total) {
          if (!opts.loop) {
            if (this.interval !== null) window.clearInterval(this.interval);
            this.interval = null;
            later(() => opts.onEnd?.(), next);
            return;
          }
          s = 0;
        }
        hit(c, next, seq[s].bar, seq[s].i);
        const step = s + 1;
        later(() => opts.onStep?.(step, total), next);
        s += 1;
        next += stepDur;
      }
    };

    schedule();
    if (s < total || opts.loop) this.interval = window.setInterval(schedule, 25);
    return true;
  }

  stop() {
    this.run += 1;
    if (this.interval !== null) window.clearInterval(this.interval);
    this.interval = null;
    this.timeouts.forEach((id) => window.clearTimeout(id));
    this.timeouts = [];
  }
}

export function grooveBars(groove: Groove): Bar[] {
  return [{ steps: 8, groove, cymbal: 'hh', crash: false }];
}

export function fillBars(fill: Fill): Bar[] {
  return [
    { steps: 8, fill, cymbal: 'hh', crash: false },
    { steps: 2, cymbal: 'hh', crash: true, landing: true },
  ];
}

/** Steps per quarter of a notated bar: fits every subdivision the notation has (1, 2, 3, 4, 6). */
export const SCORE_DIV = 12;

/** Notated bars (songs/notation.ts) as playable bars. */
export function scoreBars(bars: Beats[]): Bar[] {
  return bars.map((beats) => {
    const score: string[][] = Array.from({ length: SCORE_DIV * 4 }, () => []);
    beats.forEach((beat, q) => {
      const slots = beat.trim().split(/\s+/);
      slots.forEach((slot, i) => {
        if (slot !== '-') score[q * SCORE_DIV + (i * SCORE_DIV) / slots.length].push(...slot.split('+'));
      });
    });
    return { steps: SCORE_DIV * 4, score, cymbal: 'hh', crash: false };
  });
}

/** Eighth notes one part takes up. */
export const partSteps = (part: Exercise['parts'][number]) => (part.kind === 'fill' ? 8 : part.bars * 8);

/** The parts played twice; a part marked crash starts on the crash unless it opens the run. */
export function exerciseBars(
  exercise: Exercise,
  findGroove: (id: string) => Groove | undefined,
  findFill: (id: string) => Fill | undefined,
): Bar[] {
  const bars: Bar[] = [];
  for (let pass = 0; pass < 2; pass++) {
    for (const part of exercise.parts) {
      if (part.kind === 'fill') {
        const fill = findFill(part.fillId);
        if (fill) bars.push({ steps: 8, fill, cymbal: 'hh', crash: false });
        continue;
      }
      const groove = findGroove(part.grooveId);
      if (!groove) continue;
      for (let i = 0; i < part.bars; i++) {
        bars.push({ steps: 8, groove, cymbal: part.cymbal, crash: !!part.crash && i === 0 && bars.length > 0 });
      }
    }
  }
  if (exercise.landing) bars.push({ steps: 2, cymbal: 'hh', crash: true, landing: true });
  return bars;
}
