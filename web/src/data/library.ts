import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import type { Beats } from '../songs/types';
import type { Fill, Groove } from '../types';
import { fills, grooves } from './lessons';

/* A tananyag: bővíthető kategóriák, bennük tételek. A beépített kategóriák és az eddig tanított groove-ok / fillek
   itt, a kódban élnek; amit a tanár az appban hozzáad, az a Supabase-ben (supabase/004_tananyag.sql). */

export interface Category {
  id: string;
  name: string;
}

export interface ScoreBar {
  beats: string[];
  hands?: string[];
}

export interface LibraryItem {
  id: string;
  category: string;
  title: string;
  subtitle: string;
  bpm: number;
  /** A kotta (lásd songs/notation.ts); üres, amíg a feltöltött kép nincs átírva. */
  bars: ScoreBar[];
  note: string;
  image_path: string | null;
  file_name: string | null;
  builtin?: boolean;
}

export const CATEGORIES: Category[] = [
  { id: 'hangszerismeret', name: 'Hangszerismeret / Gear' },
  { id: 'rudimentek', name: 'Rudimentek' },
  { id: 'grooveok', name: 'Groove-ok' },
  { id: 'dalok', name: 'Dalok' },
  { id: 'fillek', name: 'Fillek' },
  { id: 'stilusgyakorlatok', name: 'Stílusgyakorlatok' },
  { id: 'technika', name: 'Technika' },
  { id: 'transzkripciok', name: 'Transzkripciók' },
  { id: 'ritmusgyakorlatok', name: 'Ritmusgyakorlatok' },
];

export const toBeats = (bar: ScoreBar): Beats => Object.assign([...bar.beats], bar.hands ? { hands: bar.hands } : {});

/** Egy groove (nyolcadokra írt hihat / pergő / lábdob minta) kottaként. */
export function grooveBar(g: Groove): ScoreBar {
  const slot = (i: number) =>
    [g.hh[i] === '1' && 'h', g.sn[i] === '1' && 's', g.kk[i] === '1' && 'k'].filter(Boolean).join('+') || '-';
  return { beats: [0, 2, 4, 6].map((i) => `${slot(i)} ${slot(i + 1)}`) };
}

const FILL_INST: Record<Fill['drums'][number], string> = { sn: 's', t1: 't', t2: 'u', ft: 'f' };

/** Egy fill kottaként, váltott kézzel. */
export function fillBar(f: Fill): ScoreBar {
  const inst = f.drums.map((d) => FILL_INST[d]);
  return {
    beats: [0, 2, 4, 6].map((i) => `${inst[i]} ${inst[i + 1]}`),
    hands: ['R L', 'R L', 'R L', 'R L'],
  };
}

const GROOVE_TITLES: Record<string, [string, string]> = {
  g1: ['Money Beat', 'Groove 1'],
  g2: ['Rock You Groove', 'Groove 2'],
  g3: ['Groove 3', 'Az első két groove összevonva'],
  g4: ['4 on the Floor', 'Groove 4'],
};

/** Az eddig tanított anyag (az első három óra). */
const TAUGHT: LibraryItem[] = [
  ...grooves.map((g) => ({
    id: g.id,
    category: 'grooveok',
    title: GROOVE_TITLES[g.id]?.[0] ?? g.name,
    subtitle: GROOVE_TITLES[g.id]?.[1] ?? '',
    bpm: 90,
    bars: [grooveBar(g)],
    note: g.noteHu ?? '',
    image_path: null,
    file_name: null,
    builtin: true,
  })),
  ...fills.map((f) => ({
    id: f.id,
    category: 'fillek',
    title: f.name,
    subtitle: f.titleHu,
    bpm: 90,
    bars: [fillBar(f)],
    note: '',
    image_path: null,
    file_name: null,
    builtin: true,
  })),
];

export const MISSING_TABLES =
  'A mentéshez egyszer le kell futtatni a supabase/004_tananyag.sql fájlt a Supabase SQL Editorban.';

/** Beépített + a tanár által hozzáadott kategóriák és tételek. Ha a táblák még nincsenek meg, csak a beépítettek látszanak. */
export function useLibrary() {
  const [categories, setCategories] = useState<Category[]>(CATEGORIES);
  const [items, setItems] = useState<LibraryItem[]>(TAUGHT);
  const [ready, setReady] = useState(false);

  const reload = useCallback(async () => {
    if (supabase) {
      const [c, i] = await Promise.all([
        supabase.from('library_categories').select('id, name').order('created_at'),
        supabase.from('library_items').select('*').order('created_at'),
      ]);
      setCategories([...CATEGORIES, ...((c.data as Category[]) ?? [])]);
      setItems([...TAUGHT, ...((i.data as LibraryItem[]) ?? [])]);
    }
    setReady(true);
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  return { categories, items, ready, reload };
}

export type Subdivision = 'negyedes' | 'nyolcados' | 'tizenhatodos' | 'triolas';

export const SUBDIVISIONS: [Subdivision, string][] = [
  ['negyedes', 'Negyedes'],
  ['nyolcados', 'Nyolcados'],
  ['tizenhatodos', 'Tizenhatodos'],
  ['triolas', 'Triolás'],
];

const gcd = (a: number, b: number): number => (b ? gcd(b, a % b) : a);

/** A kotta legkisebb tényleges értéke: a szűrő ez alapján sorol, a kézi címkézés helyett. */
export function subdivisionOf(bars: ScoreBar[]): Subdivision | null {
  let finest = 0;
  let triplet = false;
  for (const bar of bars)
    for (const beat of bar.beats) {
      const slots = beat.trim().split(/\s+/);
      slots.forEach((slot, i) => {
        if (slot === '-') return;
        const need = slots.length / gcd(i, slots.length);
        if (need % 3 === 0) triplet = true;
        finest = Math.max(finest, need);
      });
    }
  if (!finest) return null;
  if (triplet) return 'triolas';
  return finest === 1 ? 'negyedes' : finest === 2 ? 'nyolcados' : 'tizenhatodos';
}

const TOKEN = /^(\([crhotusfk]\)|[crhotusfk]>?)$/;

/** Kottakód → ütemek. Soronként egy ütem, a negyedek | jellel elválasztva: h+k h | h+s h | h+k h | h+s h
 *  A @-cal kezdődő sor az előtte lévő ütem kézrendje: @ R L | R L | R L | R L */
export function parseScoreCode(code: string): { bars: ScoreBar[]; error: string } {
  const bars: ScoreBar[] = [];
  for (const [n, raw] of code.split('\n').entries()) {
    const line = raw.trim();
    if (!line) continue;
    const isHands = line.startsWith('@');
    const beats = line.replace(/^@/, '').split('|').map((b) => b.trim().replace(/\s+/g, ' '));
    if (beats.length !== 4) return { bars, error: `${n + 1}. sor: négy negyed kell, | jellel elválasztva.` };
    if (isHands) {
      if (!bars.length) return { bars, error: `${n + 1}. sor: a kézrend egy ütem után jöhet.` };
      bars[bars.length - 1].hands = beats;
      continue;
    }
    const wrong = beats
      .flatMap((b) => b.split(' '))
      .flatMap((s) => (s === '-' ? [] : s.split('+')))
      .find((t) => !TOKEN.test(t));
    if (wrong) return { bars, error: `${n + 1}. sor: ismeretlen jel: ${wrong}` };
    const size = beats.find((b) => ![1, 2, 3, 4, 6].includes(b.split(' ').length));
    if (size) return { bars, error: `${n + 1}. sor: egy negyed 1, 2, 3, 4 vagy 6 tagú lehet: ${size}` };
    bars.push({ beats });
  }
  return { bars, error: '' };
}

export const formatScoreCode = (bars: ScoreBar[]) =>
  bars.map((b) => b.beats.join(' | ') + (b.hands ? `\n@ ${b.hands.join(' | ')}` : '')).join('\n');
