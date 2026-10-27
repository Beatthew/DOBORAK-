// @ts-nocheck — a Song Practice-ből behúzva (scripts/import-song.mjs). A kottát ott szerkeszd, majd húzd be újra.
import type { SongData } from '../types';

/* ---------- Come Together – The Beatles ---------- (Drum Split) */
const song: SongData = (() => {
  const BPM = 83, OFFSET = 1.92;   // OFFSET = az 1. ütem első leütése (mp)
  /* tempótérkép: [ütem, mp] pontok, köztük lineáris; az utolsó pont után állandó 83 BPM */
  const TEMPO_MAP = [[1, 1.92], [3, 7.66], [5, 13.32], [11, 30.96], [13, 36.74], [17, 48.14], [22, 62.82], [26, 74.38], [28, 80.12], [31, 88.64], [35, 100.3], [38, 109.1], [41, 117.74], [43, 123.36], [49, 140.74], [51, 146.46], [53, 152.24], [57, 164.06], [63, 181.56], [67, 192.94], [69, 198.74], [72, 207.3], [73, 210.08], [77, 221.36], [79, 227.08], [82, 235.6], [83, 238.36], [86, 246.78], [89, 255.1]];
  const FILES = { Drums: 'come-together-drums.mp3', Band: 'come-together-band.mp3' };
  const SECTIONS = [
    { name: "Intro", from: 1, to: 4 },
    { name: "Verse 1", from: 5, to: 12 },
    { name: "Interlude", from: 13, to: 16 },
    { name: "Verse 2", from: 17, to: 24 },
    { name: "Chorus", from: 25, to: 26 },
    { name: "Interlude", from: 27, to: 30 },
    { name: "Verse 3", from: 31, to: 38 },
    { name: "Chorus", from: 39, to: 40 },
    { name: "Interlude", from: 41, to: 42 },
    { name: "Gitárszóló (?)", from: 43, to: 50 },
    { name: "Break", from: 51, to: 52, tacet: true },
    { name: "Verse 4", from: 53, to: 60 },
    { name: "Chorus (?)", from: 61, to: 62 },
    { name: "Interlude", from: 63, to: 66 },
    { name: "Outro (?)", from: 67, to: 89 }
  ];
  const EVENTS = [
    { name: "félütemes", kind: "FILL", from: 11, to: 12 },
    { name: "félütemes", kind: "FILL", from: 23, to: 24 },
    { name: "Chorus stop", kind: "FILL", from: 26, to: 26, beat: 3 },
    { name: "félütemes", kind: "FILL", from: 37, to: 38 },
    { name: "Chorus stop", kind: "FILL", from: 40, to: 40, beat: 3 },
    { name: "felutemes", kind: "FILL", from: 42, to: 42, beat: 2 },
    { name: "félütemes", kind: "FILL", from: 59, to: 60 },
    { name: "felutemes", kind: "FILL", from: 66, to: 66, beat: 2 }
  ];
  const G = {
    rest: ['-', '-', '-', '-'],
    "intro": ["h+k h+k", "h h h h - -", "t t t t f f", "f f f f - -"],   // Intro (shoot me)
    "verse": ["t+f+k f", "t+f+k f", "t+f+k f", "t+f+k f"],   // Verse groove
    "chorus": ["f+k f", "s+f+k f", "f+k f", "s+f+k f"],   // chorus groove
    "vend1": ["c+k - - k", "k", "k - - k", "k"],   // félütemes (fill)
    "vend2": ["k - - k", "k", "k - - k", "k"],   // Verse vége 2 (fill)
    "chstop": ["f+k f", "s+f+k f", "k", "-"],   // Chorus stop (fill)
    "pmvp6a4er": ["h+k h+k", "h h h o - -", "s t - s", "t t f f"],   // felutemes (fill)
    "pmvp6hyix": ["r+k r", "r+s+k r", "r+k r", "r+s+k r"],   // outroo groove
  };
  const rep = (k, n) => Array(n).fill(k);
  const SCORE = [null,                                                     // 1-től indexelve
    ...rep("intro", 4),   // 1–4 Intro
    ...rep("verse", 6), "vend1", "vend2",   // 5–12 Verse 1
    ...rep("intro", 4),   // 13–16 Interlude
    ...rep("verse", 6), "vend1", "vend2",   // 17–24 Verse 2
    "chorus", "chstop",   // 25–26 Chorus
    ...rep("intro", 4),   // 27–30 Interlude
    ...rep("verse", 6), "vend1", "vend2",   // 31–38 Verse 3
    "chorus", "chstop",   // 39–40 Chorus
    "intro", "pmvp6a4er",   // 41–42 Interlude
    ...rep("verse", 8),   // 43–50 Gitárszóló (?)
    ...rep("rest", 2),   // 51–52 Break
    ...rep("verse", 6), "vend1", "vend2",   // 53–60 Verse 4
    ...rep("chorus", 2),   // 61–62 Chorus (?)
    ...rep("intro", 3), "pmvp6a4er",   // 63–66 Interlude
    ...rep("pmvp6hyix", 16), ...rep("chorus", 6), "rest",   // 67–89 Outro (?)
  ].map(k => k && G[k]);
  /* építőelemek a tanuló STUDY ELEMENTS nézetéhez: loop = a gyakorláskor ismételt ütemek */
  const ELEMENTS = [
    { name: "Intro (shoot me)", type: "groove", beats: G["intro"], loop: [1, 4], variants: [] },
    { name: "Verse groove", type: "groove", beats: G["verse"], loop: [5, 8], variants: [] },
    { name: "félütemes", type: "fill", beats: G["vend1"], loop: [10, 11], variants: [] },
    { name: "Verse vége 2", type: "fill", beats: G["vend2"], loop: [11, 12], variants: [] },
    { name: "chorus groove", type: "groove", beats: G["chorus"], loop: [25, 25], variants: [] },
    { name: "Chorus stop", type: "fill", beats: G["chstop"], loop: [25, 26], variants: [] },
    { name: "felutemes", type: "fill", beats: G["pmvp6a4er"], loop: [41, 42], variants: [] },
    { name: "outroo groove", type: "groove", beats: G["pmvp6hyix"], loop: [67, 70], variants: [] }
  ];
  return {
    id: 'come-together', title: "Come Together", artist: "The Beatles", info: "The Beatles · 83 BPM · 4/4", tags: ['4/4'],
    bpm: BPM, offset: OFFSET, tempoMap: TEMPO_MAP, files: FILES,
    sections: SECTIONS, events: EVENTS, score: SCORE, rideBars: new Set([67, 68, 69, 70, 71, 72, 73, 74, 75, 76, 77, 78, 79, 80, 81, 82]), elements: ELEMENTS,
  };
})();

export default song;
