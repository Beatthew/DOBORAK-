import type { ScoreBar } from './library';

/* Lábdob permutációk (függetlenítés): egy negyed négy tizenhatodából minden lehetséges lábdob-ritmus (15 db),
   amit a tanuló a lábdob nélküli alap groove mind a négy negyedére rárak. */

export const KICK_PERMS_REF = 'fuggetlenites/labdob-permutaciok';
/** A kiadott anyag oldala (a diák is eléri). */
export const KICK_PERMS_PATH = '/anyag/labdob-permutaciok';

export interface KickPerm {
  letter: string;
  /** melyik tizenhatodon szól a lábdob (0–3) */
  hits: number[];
}

const count = (m: number) => [3, 2, 1, 0].filter((b) => (m >> b) & 1).length;

/** Hangszám szerint, azon belül elölről hátrafelé: A–D egy hang, E–J kettő, K–N három, O mind a négy. */
export const KICK_PERMS: KickPerm[] = Array.from({ length: 15 }, (_, i) => i + 1)
  .sort((a, b) => count(a) - count(b) || b - a)
  .map((m, i) => ({ letter: String.fromCharCode(65 + i), hits: [0, 1, 2, 3].filter((s) => (m >> (3 - s)) & 1) }));

/** Lábcin nyolcadok, pergő a 2-re és a 4-re; a permutáció mind a négy negyedre rákerül. */
export function permutationBar(perm: KickPerm | null): ScoreBar {
  const k = (s: number) => !!perm?.hits.includes(s);
  const beat = (snare: boolean) =>
    [`h${snare ? '+s' : ''}${k(0) ? '+k' : ''}`, k(1) ? 'k' : '-', `h${k(2) ? '+k' : ''}`, k(3) ? 'k' : '-']
      .join(' ')
      .replace(/^(\S+) - (\S+) -$/, '$1 $2');
  return { beats: [beat(false), beat(true), beat(false), beat(true)] };
}
