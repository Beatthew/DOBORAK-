export type Lang = 'hu' | 'en';

/** Eight characters of '0' | '1': one bar of eighth notes. */
export type Pattern = string;

export interface Groove {
  id: string;
  name: string;
  hh: Pattern;
  sn: Pattern;
  kk: Pattern;
  /** One line under the groove's name, e.g. where it comes from. */
  noteHu?: string;
  noteEn?: string;
}

/** Hand drums a fill can move between. */
export type Drum = 'sn' | 't1' | 't2' | 'ft';

/** One bar of eighth notes, alternating right and left hand, landing on crash + kick. */
export interface Fill {
  id: string;
  name: string;
  titleHu: string;
  titleEn: string;
  drums: Drum[];
}

export interface Song {
  id: string;
  grooveId: string;
  title: string;
  artist: string;
  spotifyUrl: string;
}

export type Cymbal = 'hh' | 'ride';

export type Part =
  | {
      kind: 'groove';
      grooveId: string;
      cymbal: Cymbal;
      bars: number;
      /** Starts on the crash whenever it follows another part. */
      crash?: boolean;
    }
  | { kind: 'fill'; fillId: string };

/** The parts play in order, the whole sequence twice. */
export interface Exercise {
  id: string;
  titleHu: string;
  titleEn: string;
  parts: Part[];
  /** Ends on crash + kick on the next beat one. */
  landing?: boolean;
  noteHu: string;
  noteEn: string;
}

export interface Lesson {
  id: string;
  number: number;
  bpm: number;
  /** Grooves shown as their own blocks in this lesson. */
  grooveIds: string[];
  /** Fills shown as their own blocks in this lesson. */
  fillIds: string[];
  songs: Song[];
  exercises: Exercise[];
}
