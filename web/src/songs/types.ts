/** Egy ütem kottája: 4 negyed, negyedenként szóközzel elválasztott tagok (lásd notation.ts). */
export type Beats = string[] & { hands?: string[] };

export interface Section {
  name: string;
  from: number;
  to: number;
  tacet?: boolean;
  note?: string;
}

export interface SongEvent {
  name: string;
  kind: string;
  from: number;
  to: number;
  beat?: number;
}

export interface ElementPart {
  name: string;
  beats: Beats;
  /** Több ütemes elem: az összes üteme. */
  bars?: Beats[];
  /** A dal ütemei, ahol ez az elem szól: ezt ismétli a lejátszó. */
  loop: [number, number];
}

export interface SongElement extends ElementPart {
  type: 'groove' | 'fill';
  variants: ElementPart[];
}

/** Egy dal, ahogy a Song Practice-ből behúzva érkezik. */
export interface SongData {
  id: string;
  title: string;
  artist: string;
  info: string;
  tags: string[];
  bpm: number;
  offset: number;
  /** [ütem, mp] pontok, köztük lineáris. */
  tempoMap: [number, number][];
  files: { Drums: string; Band: string };
  sections: Section[];
  events: SongEvent[];
  /** 1-től indexelve; üres = szünet. */
  score: (Beats | null | undefined)[];
  rideBars: Set<number>;
  elements: SongElement[];
}
