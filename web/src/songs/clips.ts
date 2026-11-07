import { supabase } from '../lib/supabase';
import type { Beats, SongData } from './types';

/* Dalból kivágott, önálló részletek: saját hangsávjuk van, a daltól függetlenül élnek,
   a dalt nem kell hozzájuk betölteni. A motor egy pár ütemes dalként játssza őket.
   - a beépített (Ádám groove 1-e): public/songs/clips, itt a kódban;
   - a szerkesztő „Tananyagba” gombjával készültek: a „clips” tárhelyen, a leírásuk a tananyag-tétel clip mezőjében
     (supabase/012_reszlet_hanggal.sql), az órához adva a materials sorba másolva. */

/** egy kivágott részlet leírása (library_items.clip, materials.clip) */
export interface ClipRef {
  /** mappa a „clips” tárhelyen: <path>/drums.wav, band.wav */
  path: string;
  /** a dal, amiből kivágták, és a dal ütemei */
  song: string;
  from: number;
  to: number;
  /** mp: a kivágott rész hossza (= to − from + 1 ütem) */
  duration: number;
  /** a kivágott ütemek kottája */
  score: { beats: string[]; hands?: string[] }[];
}

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

/** a tárhelyen lévő részlet a lejátszónak: a kottája és a két sáv rövid ideig érvényes linkje */
export async function storedClipData(clip: ClipRef, title: string, bpm: number): Promise<SongData> {
  if (!supabase) throw new Error('Nincs kapcsolat.');
  const { data, error } = await supabase.storage.from('clips').createSignedUrls([`${clip.path}/drums.wav`, `${clip.path}/band.wav`], 60 * 60 * 6);
  if (error || !data || data.some((d) => !d.signedUrl)) throw new Error('A részlet hangja nem érhető el.');
  const n = clip.score.length;
  // egyes ütemek: ugyanaz a kotta ugyanaz a tömb (a lejátszó azonosság alapján jelöli a nagy kottán)
  const seen = new Map<string, Beats>();
  const score = clip.score.map((b) => {
    const k = JSON.stringify(b);
    if (!seen.has(k)) seen.set(k, Object.assign([...b.beats], b.hands ? { hands: b.hands } : {}));
    return seen.get(k)!;
  });
  return {
    id: clip.path, title, artist: '', info: '', tags: [], bpm, offset: 0,
    tempoMap: [[1, 0], [n + 1, clip.duration]],
    files: { Drums: data[0].signedUrl!, Band: data[1].signedUrl! },
    sections: [{ name: title, from: 1, to: n }],
    events: [],
    score: [null, ...score],
    rideBars: new Set(),
    elements: [],
  };
}
