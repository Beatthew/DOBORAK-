// @ts-nocheck — a Song Practice-ből behúzva (scripts/import-song.mjs). A kottát ott szerkeszd, majd húzd be újra.
import type { SongData } from '../types';

/* ---------- Snow (Hey Oh) – Red Hot Chili Peppers ---------- (Drum Split) */
const song: SongData = (() => {
  const BPM = 105, OFFSET = 9.94;   // OFFSET = az 1. ütem első leütése (mp)
  /* tempótérkép: [ütem, mp] pontok, köztük lineáris; az utolsó pont után állandó 105 BPM */
  const TEMPO_MAP = [[1, 0.68], [2, 2.99], [3, 5.31], [4, 7.62], [5, 9.94], [6, 12.26], [7, 14.57], [8, 16.89], [9, 19.2], [10, 21.52], [11, 23.82], [12, 26.14], [13, 28.45], [14, 30.76], [15, 33.07], [16, 35.37], [17, 37.66], [18, 39.99], [19, 42.31], [20, 44.63], [21, 46.93], [22, 49.23], [23, 51.56], [24, 53.87], [25, 56.13], [26, 58.47], [27, 60.8], [28, 63.1], [29, 65.42], [30, 67.73], [31, 70.05], [32, 72.35], [33, 74.64], [34, 76.97], [35, 79.31], [36, 81.61], [37, 83.9], [38, 86.22], [39, 88.55], [40, 90.83], [41, 93.13], [42, 95.53], [43, 97.89], [44, 100.29], [45, 102.73], [46, 105.13], [47, 107.33], [48, 109.61], [49, 111.86], [50, 114.13], [51, 116.36], [52, 118.61], [53, 120.86], [54, 123.11], [55, 125.36], [56, 127.63], [57, 129.87], [58, 132.1], [59, 134.32], [60, 136.58], [61, 138.81], [62, 141.04], [63, 143.28], [64, 145.6], [65, 147.94], [66, 150.25], [67, 152.5], [68, 154.79], [69, 157.1], [70, 159.37], [71, 161.65], [72, 163.94], [73, 166.22], [74, 168.5], [75, 170.78], [76, 173.09], [77, 175.41], [78, 177.71], [79, 180], [80, 182.32], [81, 184.64], [82, 186.95], [83, 189.22], [84, 191.63], [85, 194], [86, 196.38], [87, 198.8], [88, 201.17], [89, 203.42], [90, 205.68], [91, 207.93], [92, 210.17], [93, 212.42], [94, 214.65], [95, 216.9], [96, 219.13], [97, 221.34], [98, 223.56], [99, 225.78], [100, 227.97], [101, 230.19], [102, 232.4], [103, 234.63], [104, 236.8], [105, 239], [106, 241.22], [107, 243.43], [108, 245.63], [109, 247.84], [110, 250.06], [111, 252.28], [112, 254.46], [113, 256.65], [114, 258.85], [115, 261.06], [116, 263.25], [117, 265.44], [118, 267.66], [119, 269.85], [120, 272.15], [121, 274.41], [122, 276.63], [123, 278.86], [124, 281.14], [125, 283.46]];
  const FILES = { Drums: 'snow-drums.mp3', Band: 'snow-band.mp3' };
  const SECTIONS = [
    { name: "Intro", from: 1, to: 4, tacet: true },
    { name: "Verse 1", from: 5, to: 24 },
    { name: "Verse 2", from: 25, to: 40 },
    { name: "Break", from: 41, to: 46 },
    { name: "Chorus 1", from: 47, to: 62 },
    { name: "Verse 3", from: 63, to: 82 },
    { name: "Break", from: 83, to: 88 },
    { name: "Chorus 2", from: 89, to: 118 },
    { name: "Vége", from: 119, to: 125 }
  ];
  const EVENTS = [
    { name: "Beszállás", kind: "FILL", from: 4, to: 4 },
    { name: "Verse fill", kind: "FILL", from: 8, to: 8, beat: 3 },
    { name: "B", kind: "FILL", from: 16, to: 16, beat: 4 },
    { name: "C", kind: "FILL", from: 24, to: 24, beat: 3 },
    { name: "D", kind: "FILL", from: 32, to: 32, beat: 4 },
    { name: "E", kind: "FILL", from: 40, to: 40, beat: 3 },
    { name: "Pergő 16-od", kind: "FILL", from: 46, to: 46 },
    { name: "Lezárás / átvezetés", kind: "FILL", from: 62, to: 62 },
    { name: "Verse fill", kind: "FILL", from: 66, to: 66, beat: 3 },
    { name: "B", kind: "FILL", from: 74, to: 74, beat: 4 },
    { name: "E", kind: "FILL", from: 82, to: 82, beat: 3 },
    { name: "Pergő 16-od", kind: "FILL", from: 88, to: 88 },
    { name: "Lezárás / átvezetés", kind: "FILL", from: 118, to: 118 }
  ];
  const G = {
    rest: ['-', '-', '-', '-'],
    "v": ["h+k h", "h+s h", "h+k h", "h+s h"],   // Verse
    "vC": ["c+k h", "h+s h", "h+k h", "h+s h"],   // Verse · crash az 1-re
    "ch": ["h+k - - k", "h+s k", "h+k - - k", "h+s k"],   // Chorus · pontozott
    "chC": ["c+k - - k", "h+s k", "h+k - - k", "h+s k"],   // Chorus · pontozott · crash az 1-re
    "stop": ["-", "s+t+k", "-", "s+t+k"],   // Break · stop
    "stopC": ["c", "s+t+k", "-", "s+t+k"],   // Break · stop · crash-sel
    "hit": ["c+k", "-", "-", "-"],   // Crash ütés
    "pick": ["-", "-", "- - - s", "s t"],   // Beszállás (fill)
    "fA": ["h+k h", "h+s h", "h+k - h s", "s t"],   // Verse fill (fill)
    "fB": ["h+k h", "h+s h", "h+k h", "h - s s"],   // Verse fill · B (fill)
    "fC": ["h+k h", "h+s h", "h+k - s s", "t t s t"],   // Verse fill · C (fill)
    "fD": ["h+k h", "h+s h", "h+k h", "h s s k"],   // Verse fill · D (fill)
    "fE": ["h+k h", "h+s h", "h+s - - s", "s t"],   // Verse fill · E (fill)
    "roll": ["s s s s", "s s s s", "s s s s", "s s s s"],   // Pergő 16-od (fill)
    "end": ["c+k", "h+s", "s s", "s s k -"],   // Lezárás / átvezetés (fill)
  };
  const rep = (k, n) => Array(n).fill(k);
  const SCORE = [null,                                                     // 1-től indexelve
    ...rep("rest", 3), "pick",   // 1–4 Intro
    "vC", ...rep("v", 2), "fA", "vC", ...rep("v", 6), "fB", "vC", ...rep("v", 6), "fC",   // 5–24 Verse 1
    "vC", ...rep("v", 6), "fD", "vC", ...rep("v", 6), "fE",   // 25–40 Verse 2
    "stopC", ...rep("stop", 4), "roll",   // 41–46 Break
    "chC", ...rep("ch", 14), "end",   // 47–62 Chorus 1
    "vC", ...rep("v", 2), "fA", "vC", ...rep("v", 6), "fB", "vC", ...rep("v", 6), "fE",   // 63–82 Verse 3
    "stopC", ...rep("stop", 4), "roll",   // 83–88 Break
    "chC", ...rep("ch", 28), "end",   // 89–118 Chorus 2
    "hit", ...rep("rest", 6),   // 119–125 Vége
  ].map(k => k && G[k]);
  /* építőelemek a tanuló STUDY ELEMENTS nézetéhez: loop = a gyakorláskor ismételt ütemek */
  const ELEMENTS = [
    { name: "Beszállás", type: "fill", beats: G["pick"], loop: [3, 4], variants: [] },
    { name: "Verse", type: "groove", beats: G["v"], loop: [6, 7], variants: [{ name: "crash az 1-re", beats: G["vC"], loop: [5, 5] }] },
    { name: "Verse fill", type: "fill", beats: G["fA"], loop: [7, 8], variants: [{ name: "B", beats: G["fB"], loop: [15, 16] }, { name: "C", beats: G["fC"], loop: [23, 24] }, { name: "D", beats: G["fD"], loop: [31, 32] }, { name: "E", beats: G["fE"], loop: [39, 40] }] },
    { name: "Break · stop", type: "groove", beats: G["stop"], loop: [42, 45], variants: [{ name: "crash-sel", beats: G["stopC"], loop: [41, 41] }] },
    { name: "Pergő 16-od", type: "fill", beats: G["roll"], loop: [45, 46], variants: [] },
    { name: "Chorus · pontozott", type: "groove", beats: G["ch"], loop: [48, 51], variants: [{ name: "crash az 1-re", beats: G["chC"], loop: [47, 47] }] },
    { name: "Lezárás / átvezetés", type: "fill", beats: G["end"], loop: [61, 62], variants: [] },
    { name: "Crash ütés", type: "groove", beats: G["hit"], loop: [119, 119], variants: [] }
  ];
  return {
    id: 'snow', title: "Snow (Hey Oh)", artist: "Red Hot Chili Peppers", info: "Red Hot Chili Peppers · 105 BPM · 4/4", tags: ['4/4'],
    bpm: BPM, offset: OFFSET, tempoMap: TEMPO_MAP, files: FILES,
    sections: SECTIONS, events: EVENTS, score: SCORE, rideBars: new Set([]), elements: ELEMENTS,
  };
})();

export default song;
