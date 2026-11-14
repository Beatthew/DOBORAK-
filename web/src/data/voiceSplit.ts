import type { ScoreBar } from './library';

/* Szólambontás: egy dal groove-ja fent, alatta szólampárosítások; amelyikre a tanuló koppint, csak azok a hangszerek
   maradnak a kottában (és a lejátszásban). Az első: az Elég Ha Élsz groove-ja (László Dorka, 2026-11-14). */

export const VOICE_SPLIT_REF = 'dalok/eleg-ha-elsz-szolamok';
/** A kiadott anyag oldala (a diák is eléri). */
export const VOICE_SPLIT_PATH = '/anyag/eleg-ha-elsz-szolamok';
/** a dal a Dalok között (songs.id) */
export const VOICE_SPLIT_SONG = 'Seqt_AQBLbs';

/** Lábcin nyolcadok, pergő a 2-re és a 4-re, lábdob az „egy”-re, a „tőt”-re és a „mat”-ra
 *  (a harmadik lábdob a „hár”-ról a „mat”-ra csúszik). */
export const VOICE_SPLIT_GROOVE: ScoreBar = { beats: ['h+k h', 'h+s h+k', 'h h+k', 'h+s h'] };

export type Voice = 'h' | 's' | 'k';

export const VOICE_NAME: Record<Voice, [string, string]> = {
  h: ['Lábcin', 'Hi-hat'],
  s: ['Pergő', 'Snare'],
  k: ['Lábdob', 'Kick'],
};

export interface VoiceSet {
  id: string;
  voices: Voice[];
}

/** A teljes groove, a három pár, majd a három szólam egyenként. */
export const VOICE_SETS: VoiceSet[] = [
  { id: 'mind', voices: ['h', 's', 'k'] },
  { id: 'labcin-labdob', voices: ['h', 'k'] },
  { id: 'labcin-pergo', voices: ['h', 's'] },
  { id: 'pergo-labdob', voices: ['s', 'k'] },
  { id: 'labcin', voices: ['h'] },
  { id: 'pergo', voices: ['s'] },
  { id: 'labdob', voices: ['k'] },
];

/** A groove csak a megadott szólamokkal; az üresen maradt helyekre szünet kerül. */
export function splitBar(bar: ScoreBar, voices: Voice[]): ScoreBar {
  const beats = bar.beats.map((beat) => {
    const slots = beat.split(' ').map((slot) => slot.split('+').filter((t) => voices.includes(t.replace(/[()>]/g, '') as Voice)).join('+') || '-');
    return slots.every((s) => s === '-') ? '-' : slots.join(' ');
  });
  return { beats };
}
