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

/** Egy ütem kottaként: `sound` = a hangerő is benne van (hangsúly / ghost), különben csak a sima jegyfejek. */
export function strokeBeats(bar: string, meter: number, sound: boolean): Beats {
  const perBeat = bar.length / meter;
  return Array.from({ length: meter }, (_, q) =>
    [...bar.slice(q * perBeat, (q + 1) * perBeat)].map((s) => (!sound ? 's' : s === 'F' || s === 'D' ? 's>' : '(s)')).join(' '),
  );
}
