import type { ScoreBar } from './library';

/* Ritmusskála: ugyanaz az egy ütem váltott kézzel negyedekben, nyolcadokban, tizenhatodokban; a lábdob a negyedeken
   metronómként rátehető. Loop módban a fokok egymás után jönnek, mindegyik a beállított számú ütemig.
   Bővíthető: új fok = új sor a RHYTHM_LEVELS-ben (pl. triolák: notes 3). Először Tőth Ádám, 2026-11-14. */

export const RHYTHM_SCALE_REF = 'ritmusgyakorlatok/ritmusskala';
/** A kiadott anyag oldala (a diák is eléri). */
export const RHYTHM_SCALE_PATH = '/anyag/ritmusskala';

export interface RhythmLevel {
  id: string;
  name: [string, string];
  /** hány hang esik egy negyedre */
  notes: number;
}

export const RHYTHM_LEVELS: RhythmLevel[] = [
  { id: 'negyed', name: ['Negyedek', 'Quarters'], notes: 1 },
  { id: 'nyolcad', name: ['Nyolcadok', 'Eighths'], notes: 2 },
  { id: 'tizenhatod', name: ['Tizenhatodok', 'Sixteenths'], notes: 4 },
];

/** Egy ütem az adott fokon, váltott kézzel (R kezd); kick = lábdob minden negyeden. */
export function scaleBar(level: RhythmLevel, kick: boolean): ScoreBar {
  const beats: string[] = [];
  const hands: string[] = [];
  for (let b = 0; b < 4; b++) {
    const slots = Array.from({ length: level.notes }, (_, i) => (i === 0 && kick ? 's+k' : 's'));
    beats.push(slots.join(' '));
    hands.push(slots.map((_, i) => ((b * level.notes + i) % 2 ? 'L' : 'R')).join(' '));
  }
  return { beats, hands };
}
