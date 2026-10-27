// @ts-nocheck — a Song Practice-ből behúzva (scripts/import-song.mjs). A kottát ott szerkeszd, majd húzd be újra.
import type { SongData } from '../types';

/* ---------- Skyfall – Adele ---------- (Drum Split) */
const song: SongData = (() => {
  const BPM = 75, OFFSET = 1.86;   // OFFSET = az 1. ütem első leütése (mp)
  /* tempótérkép: [ütem, mp] pontok, köztük lineáris; az utolsó pont után állandó 75 BPM */
  const TEMPO_MAP = [[1, 1.86], [84, 267.46000000000004], [85, 269.27]];
  const FILES = { Drums: 'skyfall-drums.mp3', Band: 'skyfall-band.mp3' };
  const SECTIONS = [
    { name: "Intro", from: 1, to: 10, tacet: true },
    { name: "Verse 1", from: 11, to: 18, tacet: true },
    { name: "Pre-chorus", from: 19, to: 26 },
    { name: "Chorus 1", from: 27, to: 34 },
    { name: "Verse 2", from: 35, to: 46 },
    { name: "Chorus 2", from: 47, to: 54 },
    { name: "Bridge", from: 55, to: 62 },
    { name: "Chorus 3", from: 63, to: 70 },
    { name: "Chorus 4", from: 71, to: 78 },
    { name: "Outro", from: 79, to: 84 },
    { name: "Vége", from: 85, to: 91 }
  ];
  const EVENTS = [
    { name: "Fill 1", kind: "FILL", from: 26, to: 26 },
    { name: "v1", kind: "FILL", from: 46, to: 46, beat: 2 },
    { name: "v2", kind: "FILL", from: 70, to: 70 },
    { name: "Befejezés", kind: "FILL", from: 85, to: 86 }
  ];
  const G = {
    rest: ['-', '-', '-', '-'],
    "ride": ["r+k r", "r r", "r+k r", "r r"],   // Pre-chorus · ride
    "ride1": ["k", "r r", "r+k r", "r r"],   // Pre-chorus · ride · beszállás
    "ride2": ["r+k r", "r r", "r r", "r+k r"],   // Pre-chorus · ride · átvezetés
    "gr": ["h+k - h k", "h+s - h k", "h+k h+k", "h+s h"],   // Fő groove
    "grC": ["c+k - h k", "h+s - h k", "h+k h+k", "h+s h"],   // Fő groove · crash az 1-re
    "rd": ["r+k - r k", "r+s - r k", "r+k r+k", "r+s r"],   // Ride groove
    "rdC": ["c+k - r k", "r+s - r k", "r+k r+k", "r+s r"],   // Ride groove · crash az 1-re
    "br": ["-", "s", "-", "s"],   // Bridge · negyedes
    "brC": ["c+k", "s", "-", "s"],   // Bridge · negyedes · crash
    "br58": ["-", "s", "-", "s - s s"],   // Bridge · negyedes · pergő átvezetés
    "br59": ["c+k", "s", "-", "s+t"],   // Bridge · negyedes · crash + tam
    "hit": ["c+k", "-", "-", "-"],   // Crash ütés
    "fill1": Object.assign(["-", "-", "s - o s s s", "s s t t f f"], { hands: ["-", "-", "R - R L R L", "R L R L R L"] }),   // Fill 1 (fill)
    "fill2": ["s o", "o - s s", "o - s s", "t t f f"],   // Fill 2 (fill)
    "end1": ["c+k", "- s s", "s", "-"],   // Befejezés (fill)
    "end2": ["c+k", "s", "-", "-"],   // Befejezés · Befejezés 2 (fill)
    "pmvpc7mfuldn": ["o+k o+k", "h+s - h k", "h+k h+k", "h+s h"],   // Fő groove · v1
    "pmvpc8mv4fuo": Object.assign(["o+k o+k", "s - o+k - - s", "s - o+k - - s", "s s t t f f"], { hands: ["R R", "R - R - - L", "R - R - - L", "R L R L R L"] }),   // Fill 2 · v1 (fill)
    "pmvpcdmzujr1": Object.assign(["s - o+k - - s", "s k - k - k", "- - s s s s", "t t t t f f"], { hands: ["R - R - - -", "R - - - - -", "- - R L R L", "R L R L R L"] }),   // Fill 2 · v2 (fill)
    "pmvpcpo8beay": ["r+k - r -", "r+s - k r+k - -", "r k - r+k - -", "s s t t f f"],   // Ride groove · v1
    "pmvpcry9yllr": ["r+k - r k", "r+s - r k", "r+k - r+k s", "s t f f"],   // Ride groove · v2
  };
  const rep = (k, n) => Array(n).fill(k);
  const SCORE = [null,                                                     // 1-től indexelve
    ...rep("rest", 10),   // 1–10 Intro
    ...rep("rest", 8),   // 11–18 Verse 1
    "ride1", ...rep("ride", 4), "ride2", "hit", "fill1",   // 19–26 Pre-chorus
    "grC", ...rep("gr", 7),   // 27–34 Chorus 1
    "grC", ...rep("gr", 9), "pmvpc7mfuldn", "pmvpc8mv4fuo",   // 35–46 Verse 2
    "grC", ...rep("gr", 7),   // 47–54 Chorus 2
    "brC", "br", "brC", "br58", "br59", "br", "brC", "rest",   // 55–62 Bridge
    "grC", ...rep("gr", 6), "pmvpcdmzujr1",   // 63–70 Chorus 3
    "rdC", ...rep("rd", 7),   // 71–78 Chorus 4
    "rdC", ...rep("rd", 2), "pmvpcpo8beay", "rd", "pmvpcry9yllr",   // 79–84 Outro
    "end1", "end2", "hit", ...rep("rest", 4),   // 85–91 Vége
  ].map(k => k && G[k]);
  /* építőelemek a tanuló STUDY ELEMENTS nézetéhez: loop = a gyakorláskor ismételt ütemek */
  const ELEMENTS = [
    { name: "Pre-chorus · ride", type: "groove", beats: G["ride"], loop: [20, 23], variants: [{ name: "beszállás", beats: G["ride1"], loop: [19, 19] }, { name: "átvezetés", beats: G["ride2"], loop: [24, 24] }] },
    { name: "Crash ütés", type: "groove", beats: G["hit"], loop: [25, 25], variants: [] },
    { name: "Fill 1", type: "fill", beats: G["fill1"], loop: [25, 26], variants: [] },
    { name: "Fő groove", type: "groove", beats: G["gr"], loop: [28, 31], variants: [{ name: "crash az 1-re", beats: G["grC"], loop: [27, 27] }, { name: "v1", beats: G["pmvpc7mfuldn"], loop: [45, 45] }] },
    { name: "Bridge · negyedes", type: "groove", beats: G["br"], loop: [56, 56], variants: [{ name: "crash", beats: G["brC"], loop: [55, 55] }, { name: "pergő átvezetés", beats: G["br58"], loop: [58, 58] }, { name: "crash + tam", beats: G["br59"], loop: [59, 59] }] },
    { name: "Ride groove", type: "groove", beats: G["rd"], loop: [72, 75], variants: [{ name: "crash az 1-re", beats: G["rdC"], loop: [71, 71] }, { name: "v1", beats: G["pmvpcpo8beay"], loop: [82, 82] }, { name: "v2", beats: G["pmvpcry9yllr"], loop: [84, 84] }] },
    { name: "Befejezés", type: "fill", beats: G["end1"], loop: [84, 85], variants: [{ name: "Befejezés 2", beats: G["end2"], loop: [85, 86] }] },
    { name: "Fill 2", type: "fill", beats: G["fill2"], loop: [45, 46], variants: [{ name: "v1", beats: G["pmvpc8mv4fuo"], loop: [45, 46] }, { name: "v2", beats: G["pmvpcdmzujr1"], loop: [69, 70] }] }
  ];
  return {
    id: 'skyfall', title: "Skyfall", artist: "Adele", info: "Adele · 75 BPM · 4/4", tags: ['4/4'],
    bpm: BPM, offset: OFFSET, tempoMap: TEMPO_MAP, files: FILES,
    sections: SECTIONS, events: EVENTS, score: SCORE, rideBars: new Set([19, 20, 21, 22, 23, 24, 71, 72, 73, 74, 75, 76, 77, 78, 79, 80, 81, 82, 83, 84]), elements: ELEMENTS,
  };
})();

export default song;
