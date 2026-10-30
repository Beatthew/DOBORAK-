import type { Beats, SongData } from './types';

/* Dalból kivágott, önálló részletek: saját hangsávjuk van (public/songs/clips), a daltól függetlenül élnek,
   a dalt nem kell hozzájuk betölteni. A motor egy pár ütemes dalként játssza őket. */

const HIT_YOU_BACK_GROOVE_1: Beats = ['h+k h', 'h+s h', 'h h', 'h+s h+k'];

/** Kulcs: a tananyag-hivatkozás ('<kategória>/<tétel id>'), így az órához csatolt másolat is megtalálja. */
const CLIPS: Record<string, SongData> = {
  'grooveok/hit-you-back-groove-1': {
    id: 'hit-you-back-groove-1',
    title: 'groove 1',
    artist: "I'll Hit You Back",
    info: '111 BPM · 4/4',
    tags: ['4/4'],
    bpm: 111,
    offset: 0,
    // a dal 9–12. üteme, a dal saját tempótérképe szerint vágva (17,48–26,12 mp)
    tempoMap: [[1, 0], [5, 8.64]],
    files: { Drums: 'clips/hit-you-back-groove-1-drums.wav', Band: 'clips/hit-you-back-groove-1-band.wav' },
    sections: [{ name: 'groove 1', from: 1, to: 4 }],
    events: [],
    score: [null, HIT_YOU_BACK_GROOVE_1, HIT_YOU_BACK_GROOVE_1, HIT_YOU_BACK_GROOVE_1, HIT_YOU_BACK_GROOVE_1],
    rideBars: new Set(),
    elements: [],
  },
};

export const findClip = (ref: string | null | undefined) => (ref ? CLIPS[ref] : undefined);
