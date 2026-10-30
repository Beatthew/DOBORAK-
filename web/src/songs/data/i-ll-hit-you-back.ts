// @ts-nocheck — a Song Practice-ből behúzva (scripts/import-song.mjs). A kottát ott szerkeszd, majd húzd be újra.
import type { SongData } from '../types';

/* ---------- I'll Hit You Back ---------- (Drum Split) */
const song: SongData = (() => {
  const BPM = 111, OFFSET = 0.2;   // OFFSET = az 1. ütem első leütése (mp)
  /* tempótérkép: [ütem, mp] pontok, köztük lineáris; az utolsó pont után állandó 111 BPM */
  const TEMPO_MAP = [[1, 0.2], [9, 17.48], [35, 73.64], [69, 147.06], [84, 179.46], [86, 183.78], [104, 222.66]];
  const FILES = { Drums: 'i-ll-hit-you-back-drums.mp3', Band: 'i-ll-hit-you-back-band.mp3' };
  const SECTIONS = [
    { name: "Intro", from: 1, to: 8, tacet: true },
    { name: "Szekció B", from: 9, to: 16 },
    { name: "Verse 1", from: 17, to: 24 },
    { name: "Chorus 1", from: 25, to: 32 },
    { name: "istrumental", from: 33, to: 40 },
    { name: "Verse 2", from: 41, to: 48 },
    { name: "Chorus 2", from: 49, to: 56 },
    { name: "BUILD", from: 57, to: 64 },
    { name: "Bridge", from: 65, to: 80 },
    { name: "Chorus 3", from: 81, to: 88 },
    { name: "BUILD", from: 89, to: 96 },
    { name: "ENDING", from: 97, to: 104 }
  ];
  const EVENTS = [
    { name: "Fill 1", kind: "FILL", from: 24, to: 24, beat: 4 },
    { name: "Fill 1", kind: "FILL", from: 32, to: 32 },
    { name: "kiállás", kind: "FILL", from: 48, to: 48 },
    { name: "v1", kind: "FILL", from: 64, to: 64 },
    { name: "BIG FILL", kind: "FILL", from: 77, to: 80 },
    { name: "v1", kind: "FILL", from: 92, to: 92 },
    { name: "v1", kind: "FILL", from: 96, to: 96 },
    { name: "kiállás", kind: "FILL", from: 103, to: 103 }
  ];
  const G = {
    rest: ['-', '-', '-', '-'],
    "pmvplbf2f": ["h+k h", "h+s h", "h h", "h+s h+k"],   // groove 1
    "pmvple26h": ["h+k h", "h+s h", "h h", "s - s s"],   // Fill 1 (fill)
    "pmvpliyka": ["h+k - o -", "h+s - h k", "h s h+k k", "h+s - h+k -"],   // groove 2
    "pmvpluiz0": ["h+k - h -", "h+s - h k", "h s h+k k", "h+s - h+k -"],   // groove 2.1 ( close hh )
    "pmvplw7ui1a5": ["c+k - h -", "h+s - h k", "h s h+k k", "h+s - h+k -"],   // groove 2.1 ( close hh ) · v1
    "pmvplwihf30q": ["c+k - o -", "h+s - h k", "h s h+k k", "h+s - h+k -"],   // groove 2 · v1
    "pmvplwxwzvv7": ["h+k - h -", "h+s - h k", "h s h+k k", "h+s s h+k -"],   // groove 2.1 ( close hh ) · v2
    "pmvpm632s": ["c+k", "-", "-", "-"],   // kiállás (fill)
    "pmvpm96cz": ["o+k k", "o+s k", "o+k k", "o+s k"],   // BUILD UP GROOVE
    "pmvpmc54v4yc": ["c+k k", "o+s k", "o+k k", "o+s k"],   // BUILD UP GROOVE · v1
    "pmvpmd6xdy08": ["o+k -", "o+s k", "o+k k", "s s s s"],   // Fill 1 · v1 (fill)
    "pmvpmfzdy": Object.assign(["r+k r r r", "r r r r", "r r r r", "r r r+k r"], { hands: ["R L R L", "R L R L", "R L R L", "R L R L"] }),   // BRIDGE CINES GROOVE
    "pmvpms9v4": ["-", "-", "-", "-"],   // Új fill (fill)
    "pmvpmw2zx@1": Object.assign(["s s s s", "s s s s", "s s s s", "s s s s"], { hands: ["R L R L", "R L R L", "R L R L", "R L R L"] }),   // BIG FILL (fill) 1/4
    "pmvpmw2zx@2": Object.assign(["s s s s", "s s s s", "s s s s", "s s s s"], { hands: ["R L R L", "R L R L", "R L R L", "R L R L"] }),   // BIG FILL (fill) 2/4
    "pmvpmw2zx@3": Object.assign(["s s s s", "s s s s", "s s s s", "s s s s"], { hands: ["R L R L", "R L R L", "R L R L", "R L R L"] }),   // BIG FILL (fill) 3/4
    "pmvpmw2zx@4": Object.assign(["s+k s s s", "s+k s s s", "s+k s s s", "s+k s s s"], { hands: ["R L R L", "R L R L", "R L R L", "R L R L"] }),   // BIG FILL (fill) 4/4
    "pmvpn8dcg": Object.assign(["c+f+k - f+k -", "s+f - f+k -", "t+k t f+k -", "c+s - f+k -"], { hands: ["R - R -", "R - R -", "R L R -", "R - R -"] }),   // EDING GROOVE
    "pmvpndxww3k1": ["c+k k", "o+s k", "o+k k", "s s s s"],   // BUILD UP GROOVE · v2
  };
  const rep = (k, n) => Array(n).fill(k);
  const SCORE = [null,                                                     // 1-től indexelve
    ...rep("rest", 8),   // 1–8 Intro
    ...rep("pmvplbf2f", 8),   // 9–16 Szekció B
    ...rep("pmvplbf2f", 7), "pmvple26h",   // 17–24 Verse 1
    "pmvplwihf30q", ...rep("pmvpliyka", 6), "pmvple26h",   // 25–32 Chorus 1
    "pmvplw7ui1a5", ...rep("pmvpluiz0", 3), "pmvplwxwzvv7", ...rep("pmvpluiz0", 3),   // 33–40 istrumental
    ...rep("pmvplbf2f", 7), "pmvpm632s",   // 41–48 Verse 2
    "pmvplwihf30q", ...rep("pmvpliyka", 7),   // 49–56 Chorus 2
    "pmvpmc54v4yc", ...rep("pmvpm96cz", 6), "pmvpmd6xdy08",   // 57–64 BUILD
    ...rep("pmvpmfzdy", 12), "pmvpmw2zx@1", "pmvpmw2zx@2", "pmvpmw2zx@3", "pmvpmw2zx@4",   // 65–80 Bridge
    "pmvplwihf30q", ...rep("pmvpliyka", 7),   // 81–88 Chorus 3
    "pmvpmc54v4yc", "pmvpm96cz", "pmvpmc54v4yc", "pmvpmd6xdy08", ...rep("pmvpm96cz", 3), "pmvpmd6xdy08",   // 89–96 BUILD
    ...rep("pmvpn8dcg", 4), "pmvpmc54v4yc", "pmvpndxww3k1", "pmvpm632s", "rest",   // 97–104 ENDING
  ].map(k => k && G[k]);
  /* építőelemek a tanuló STUDY ELEMENTS nézetéhez: loop = a gyakorláskor ismételt ütemek */
  const ELEMENTS = [
    { name: "groove 1", type: "groove", beats: G["pmvplbf2f"], loop: [9, 12], variants: [] },
    { name: "Fill 1", type: "fill", beats: G["pmvple26h"], loop: [23, 24], variants: [{ name: "v1", beats: G["pmvpmd6xdy08"], loop: [63, 64] }] },
    { name: "groove 2", type: "groove", beats: G["pmvpliyka"], loop: [26, 29], variants: [{ name: "v1", beats: G["pmvplwihf30q"], loop: [25, 25] }] },
    { name: "groove 2.1 ( close hh )", type: "groove", beats: G["pmvpluiz0"], loop: [34, 36], variants: [{ name: "v1", beats: G["pmvplw7ui1a5"], loop: [33, 33] }, { name: "v2", beats: G["pmvplwxwzvv7"], loop: [37, 37] }] },
    { name: "kiállás", type: "fill", beats: G["pmvpm632s"], loop: [47, 48], variants: [] },
    { name: "BUILD UP GROOVE", type: "groove", beats: G["pmvpm96cz"], loop: [58, 61], variants: [{ name: "v1", beats: G["pmvpmc54v4yc"], loop: [57, 57] }, { name: "v2", beats: G["pmvpndxww3k1"], loop: [102, 102] }] },
    { name: "BRIDGE CINES GROOVE", type: "groove", beats: G["pmvpmfzdy"], loop: [65, 68], variants: [] },
    { name: "BIG FILL", type: "fill", beats: G["pmvpmw2zx@1"], bars: [G["pmvpmw2zx@1"], G["pmvpmw2zx@2"], G["pmvpmw2zx@3"], G["pmvpmw2zx@4"]], loop: [76, 80], variants: [] },
    { name: "EDING GROOVE", type: "groove", beats: G["pmvpn8dcg"], loop: [97, 100], variants: [] }
  ];
  return {
    id: 'i-ll-hit-you-back', title: "I'll Hit You Back", artist: "", info: "111 BPM · 4/4", tags: ['4/4'],
    bpm: BPM, offset: OFFSET, tempoMap: TEMPO_MAP, files: FILES,
    sections: SECTIONS, events: EVENTS, score: SCORE, rideBars: new Set([65, 66, 67, 68, 69, 70, 71, 72, 73, 74, 75, 76]), elements: ELEMENTS,
  };
})();

export default song;
