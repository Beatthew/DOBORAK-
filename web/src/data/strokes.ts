import type { Beats } from '../songs/types';

/* A Strokes tananyag: a négy ütéstípus és a rájuk épülő 27 gyakorlat. A kotta csak pergőn szól;
   a Full és a Down hangsúlyos, a Tap és az Up halk, így a gyakorlat hallatszik is. */

export const STROKES_REF = 'technika/strokes';

export type StrokeLetter = 'F' | 'D' | 'T' | 'U';

export interface StrokeType {
  letter: StrokeLetter;
  name: string;
  descHu: string;
  descEn: string;
  /** Honnan indul és hová tér vissza az ütés után a verő. */
  from: 'high' | 'low';
  to: 'high' | 'low';
}

export const STROKE_TYPES: StrokeType[] = [
  { letter: 'F', name: 'Full', descHu: 'Magasról indul, és magasra pattan vissza.', descEn: 'Starts high, rebounds high.', from: 'high', to: 'high' },
  { letter: 'D', name: 'Down', descHu: 'Magasról indul, és alacsonyan megáll.', descEn: 'Starts high, stops low.', from: 'high', to: 'low' },
  { letter: 'T', name: 'Tap', descHu: 'Alacsonyról indul, és alacsonyan marad.', descEn: 'Starts low, stays low.', from: 'low', to: 'low' },
  { letter: 'U', name: 'Up', descHu: 'Alacsonyról indul, és az ütés után magasra emelkedik.', descEn: 'Starts low, lifts high after the hit.', from: 'low', to: 'high' },
];

export interface StrokeExercise {
  n: number;
  /** Negyedek egy ütemben: 2/4 vagy 4/4. */
  meter: 2 | 4;
  /** Ütemenként az ütéstípusok sora. */
  bars: string[];
  /** A két kézrend (ütemenként ugyanaz, az ütések sorrendjében). */
  hands: [string, string];
}

const ALT4: [string, string] = ['RLRL', 'LRLR'];
const ALT8: [string, string] = ['RLRLRLRL', 'LRLRLRLR'];
const two = (n: number, bar: string): StrokeExercise => ({ n, meter: 2, bars: [bar], hands: bar.length === 2 ? ['RL', 'LR'] : ALT4 });
const four = (n: number, ...bars: string[]): StrokeExercise => ({ n, meter: 4, bars, hands: ALT8 });

export const STROKE_EXERCISES: StrokeExercise[] = [
  two(1, 'FF'),
  two(2, 'TT'),
  two(3, 'DD'),
  two(4, 'UU'),
  two(5, 'DDUU'),
  four(6, 'FFFFFFDD', 'TTTTTTUU'),
  four(7, 'FFDDTTUU'),
  four(8, 'FFFFDDUU'),
  four(9, 'DDTTTTUU'),
  four(10, 'DDDDDDDD', 'UUUUUUUU'),
  four(11, 'DDDDDDTT', 'UUUUUUFF'),
  four(12, 'DDDDDDUU'),
  four(13, 'UUUUUUDD'),
  { ...two(14, 'DTDT'), hands: ['RRLL', 'LLRR'] },
  two(15, 'TUTU'),
  two(16, 'TDTD'),
  two(17, 'TUTD'),
  two(18, 'TDTU'),
  two(19, 'TFTF'),
  two(20, 'FTFT'),
  two(21, 'FUFU'),
  two(22, 'FDFD'),
  two(23, 'FUFD'),
  two(24, 'FDFU'),
  two(25, 'UFUF'),
  two(26, 'UTUT'),
  two(27, 'DFDF'),
];

export type Hand = 'R' | 'L';

export interface HandHit {
  /** Hol szól az ütés a körben, lépésben. */
  t: number;
  stroke: StrokeType;
}

const typeOf = (letter: string) => STROKE_TYPES.find((s) => s.letter === letter) ?? STROKE_TYPES[0];

/** Melyik kéz mikor mit üt egy körben; lead = a kézrend felső (0, jobbról) vagy alsó (1, balról) sora. */
export function handHits(ex: StrokeExercise, lead: 0 | 1, stepsPerBeat: number): Record<Hand, HandHit[]> {
  const hits: Record<Hand, HandHit[]> = { R: [], L: [] };
  const barSteps = ex.meter * stepsPerBeat;
  ex.bars.forEach((bar, b) =>
    [...bar].forEach((letter, i) =>
      hits[ex.hands[lead][i] as Hand].push({ t: (b + i / bar.length) * barSteps, stroke: typeOf(letter) }),
    ),
  );
  return hits;
}

/** A verő magassága: 0 = a bőrön, 1 = magas. */
export const strokeHeight = (h: 'high' | 'low') => (h === 'high' ? 1 : 0.15);
const ease = (x: number) => x * x * (3 - 2 * x);

/** Hol jár egy kéz a körben: ütés után a típus végmagasságára pattan, a következő ütés előtt annak kezdőmagasságáról gyorsulva csap le. */
export function handMotion(hits: HandHit[], loop: number, pos: number) {
  const n = hits.findIndex((h) => h.t > pos);
  const end = hits[hits.length - 1];
  const last = n === 0 ? { ...end, t: end.t - loop } : n < 0 ? end : hits[n - 1];
  const next = n < 0 ? { ...hits[0], t: hits[0].t + loop } : hits[n];
  const gap = next.t - last.t, since = pos - last.t, edge = gap * 0.4;
  const after = strokeHeight(last.stroke.to), before = strokeHeight(next.stroke.from);
  let height: number;
  if (since < edge) height = after * (1 - (1 - since / edge) ** 2);
  else if (since > gap - edge) height = before * (1 - ((since - (gap - edge)) / edge) ** 2);
  else height = after + (before - after) * ease((since - edge) / (gap - 2 * edge));
  return { since, height, stroke: last.stroke };
}

/** Egy ütem kottaként: `sound` = a hangerő is benne van (hangsúly / ghost), különben csak a sima jegyfejek. */
export function strokeBeats(bar: string, meter: number, sound: boolean): Beats {
  const perBeat = bar.length / meter;
  return Array.from({ length: meter }, (_, q) =>
    [...bar.slice(q * perBeat, (q + 1) * perBeat)].map((s) => (!sound ? 's' : s === 'F' || s === 'D' ? 's>' : '(s)')).join(' '),
  );
}
