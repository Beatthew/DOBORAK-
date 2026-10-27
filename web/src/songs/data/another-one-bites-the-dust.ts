// @ts-nocheck — a Song Practice-ből behúzva (scripts/import-song.mjs). A kottát ott szerkeszd, majd húzd be újra.
import type { SongData } from '../types';

/* ---------- Another One Bites the Dust – Queen ---------- (Drum Split) */
const song: SongData = (() => {
  const BPM = 110, OFFSET = 3.38;   // OFFSET = az 1. ütem első leütése (mp)
  /* tempótérkép: [ütem, mp] pontok, köztük lineáris; az utolsó pont után állandó 110 BPM */
  const TEMPO_MAP = [[1, 3.38], [8, 18.58], [11, 25.12], [26, 57.7], [31, 68.6], [34, 75.08], [37, 81.62], [52, 114.22], [61, 133.84], [67, 146.88], [73, 159.96], [92, 201.32], [97, 212.24]];
  const FILES = { Drums: 'another-one-bites-the-dust-drums.mp3', Band: 'another-one-bites-the-dust-band.mp3' };
  const SECTIONS = [
    { name: "Intro", from: 1, to: 10 },
    { name: "Verse 1", from: 11, to: 18 },
    { name: "Chorus 1", from: 19, to: 30 },
    { name: "Verse 2", from: 31, to: 38 },
    { name: "Chorus 2", from: 39, to: 46 },
    { name: "Interlude", from: 47, to: 64 },
    { name: "Bridge", from: 65, to: 68, tacet: true },
    { name: "Verse 3 (2. oldal?)", from: 69, to: 80 },
    { name: "Chorus 3 (2. oldal?)", from: 81, to: 96 },
    { name: "Vége", from: 97, to: 97 }
  ];
  const EVENTS = [
    { name: "Fill", kind: "FILL", from: 18, to: 18, beat: 3 },
    { name: "Fill", kind: "FILL", from: 38, to: 38, beat: 3 },
    { name: "Fill", kind: "FILL", from: 64, to: 64, beat: 3 },
    { name: "Fill", kind: "FILL", from: 80, to: 80, beat: 3 },
    { name: "Fill", kind: "FILL", from: 96, to: 96, beat: 3 }
  ];
  const G = {
    rest: ['-', '-', '-', '-'],
    "groove": ["h+k h", "h+s+k h", "h+k h", "h+s+k h"],   // Groove
    "fill": ["h+k h", "h+s+k h", "h+k s s s", "s+k f - -"],   // Fill (fill)
  };
  const rep = (k, n) => Array(n).fill(k);
  const SCORE = [null,                                                     // 1-től indexelve
    ...rep("groove", 10),   // 1–10 Intro
    ...rep("groove", 7), "fill",   // 11–18 Verse 1
    ...rep("groove", 12),   // 19–30 Chorus 1
    ...rep("groove", 7), "fill",   // 31–38 Verse 2
    ...rep("groove", 8),   // 39–46 Chorus 2
    ...rep("groove", 17), "fill",   // 47–64 Interlude
    ...rep("rest", 4),   // 65–68 Bridge
    ...rep("groove", 11), "fill",   // 69–80 Verse 3 (2. oldal?)
    ...rep("groove", 15), "fill",   // 81–96 Chorus 3 (2. oldal?)
    "rest",   // 97–97 Vége
  ].map(k => k && G[k]);
  /* építőelemek a tanuló STUDY ELEMENTS nézetéhez: loop = a gyakorláskor ismételt ütemek */
  const ELEMENTS = [
    { name: "Groove", type: "groove", beats: G["groove"], loop: [1, 4], variants: [] },
    { name: "Fill", type: "fill", beats: G["fill"], loop: [17, 18], variants: [] }
  ];
  return {
    id: 'another-one-bites-the-dust', title: "Another One Bites the Dust", artist: "Queen", info: "Queen · 110 BPM · 4/4", tags: ['4/4'],
    bpm: BPM, offset: OFFSET, tempoMap: TEMPO_MAP, files: FILES,
    sections: SECTIONS, events: EVENTS, score: SCORE, rideBars: new Set([]), elements: ELEMENTS,
  };
})();

export default song;
