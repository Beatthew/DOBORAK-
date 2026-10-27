import type { Fill, Groove, Lesson } from '../types';

// All lesson content lives here. Grooves and fills are shared, so a later
// lesson's exercises can reuse an earlier lesson's grooves.

export const grooves: Groove[] = [
  { id: 'g1', name: 'Groove 1', hh: '11111111', sn: '00100010', kk: '10001000' },
  { id: 'g2', name: 'Groove 2', hh: '11111111', sn: '00100010', kk: '11001100' },
  {
    id: 'g3',
    name: 'Groove 3',
    hh: '11111111',
    sn: '00100010',
    kk: '10001100',
    noteHu: 'Az első két groove összevonva: az eleje Groove 1, a vége Groove 2.',
    noteEn: 'The first two grooves combined: it starts like Groove 1 and ends like Groove 2.',
  },
  {
    id: 'g4',
    name: 'Groove 4',
    hh: '11111111',
    sn: '00100010',
    kk: '10101010',
    noteHu: 'Four on the floor – lábdob minden negyedre.',
    noteEn: 'Four on the floor – kick on every beat.',
  },
];

export const fills: Fill[] = [
  {
    id: 'f1',
    name: 'Fill 1',
    titleHu: 'Csak pergőn',
    titleEn: 'Snare only',
    drums: ['sn', 'sn', 'sn', 'sn', 'sn', 'sn', 'sn', 'sn'],
  },
  {
    id: 'f2',
    name: 'Fill 2',
    titleHu: 'Le a tamokra',
    titleEn: 'Down the toms',
    drums: ['sn', 'sn', 'sn', 'sn', 't1', 't1', 'ft', 'ft'],
  },
  {
    id: 'f3',
    name: 'Fill 3',
    titleHu: 'Körbe a dobon',
    titleEn: 'Around the kit',
    drums: ['sn', 'sn', 't1', 't1', 't2', 't2', 'ft', 'ft'],
  },
];

export const findGroove = (id: string) => grooves.find((g) => g.id === id);
export const findFill = (id: string) => fills.find((f) => f.id === id);

/** Colour slot of a groove: the same groove always gets the same colour, in every lesson. */
export const grooveTone = (id: string) => Math.max(0, grooves.findIndex((g) => g.id === id)) % 2;

const fillNoteHu = '3 ütem groove, 1 ütem fill, körbe-körbe. A fill után az egyre: beütő + lábdob.';
const fillNoteEn = '3 bars of groove, 1 bar of fill, round and round. After the fill, on beat one: crash + kick.';

export const lessons: Lesson[] = [
  {
    id: 'lesson-1',
    number: 1,
    bpm: 90,
    grooveIds: ['g1', 'g2'],
    fillIds: [],
    songs: [
      { id: 's1', grooveId: 'g1', title: 'Undone – The Sweater Song', artist: 'Weezer', spotifyUrl: 'https://open.spotify.com/track/5WhtlIoxoZrMmuaWWEQhwV' },
      { id: 's2', grooveId: 'g1', title: 'Your Body Is A Wonderland', artist: 'John Mayer', spotifyUrl: 'https://open.spotify.com/track/7vFv0yFGMJW3qVXbAd9BK9' },
      { id: 's3', grooveId: 'g1', title: 'Hail To The King', artist: 'Avenged Sevenfold', spotifyUrl: 'https://open.spotify.com/track/5anCkDvJ17aznvK5TED5uo' },
      { id: 's4', grooveId: 'g1', title: 'Save Your Tears', artist: 'The Weeknd', spotifyUrl: 'https://open.spotify.com/track/5QO79kh1waicV47BqGRL3g' },
      { id: 's5', grooveId: 'g2', title: 'We Will Rock You', artist: 'Queen', spotifyUrl: 'https://open.spotify.com/track/2ELSVi4kwWOXgxiIC592tJ' },
    ],
    exercises: [
      {
        id: 'e1',
        titleHu: 'Váltás a hangszínek között',
        titleEn: 'Switching between sounds',
        parts: [
          { kind: 'groove', grooveId: 'g1', cymbal: 'hh', bars: 2 },
          { kind: 'groove', grooveId: 'g1', cymbal: 'ride', bars: 2 },
        ],
        noteHu: '',
        noteEn: '',
      },
      {
        id: 'e2',
        titleHu: 'Váltás a groove-ok között',
        titleEn: 'Switching between grooves',
        parts: [
          { kind: 'groove', grooveId: 'g1', cymbal: 'hh', bars: 4 },
          { kind: 'groove', grooveId: 'g2', cymbal: 'hh', bars: 4 },
        ],
        noteHu: '',
        noteEn: '',
      },
      {
        id: 'e3',
        titleHu: 'Kombináció',
        titleEn: 'Combination',
        parts: [
          { kind: 'groove', grooveId: 'g1', cymbal: 'hh', bars: 2 },
          { kind: 'groove', grooveId: 'g2', cymbal: 'ride', bars: 2 },
        ],
        noteHu: '',
        noteEn: '',
      },
      {
        id: 'e4',
        titleHu: 'Beütő cintányér (crash) a váltásnál',
        titleEn: 'Crash cymbal on the change',
        parts: [
          { kind: 'groove', grooveId: 'g1', cymbal: 'hh', bars: 2, crash: true },
          { kind: 'groove', grooveId: 'g2', cymbal: 'ride', bars: 2, crash: true },
        ],
        noteHu: 'Körbe-körbe megy. Minden váltáskor az egyre üss a beütő cintányérra.',
        noteEn: 'Loops round and round. At every change, hit the crash cymbal on beat one.',
      },
    ],
  },
  {
    id: 'lesson-2',
    number: 2,
    bpm: 90,
    grooveIds: [],
    fillIds: ['f1', 'f2', 'f3'],
    songs: [],
    exercises: [
      {
        id: 'l2e1',
        titleHu: 'Groove 1 + 1. fill',
        titleEn: 'Groove 1 + fill 1',
        parts: [
          { kind: 'groove', grooveId: 'g1', cymbal: 'hh', bars: 3, crash: true },
          { kind: 'fill', fillId: 'f1' },
        ],
        landing: true,
        noteHu: fillNoteHu,
        noteEn: fillNoteEn,
      },
      {
        id: 'l2e2',
        titleHu: 'Groove 2 + 2. fill',
        titleEn: 'Groove 2 + fill 2',
        parts: [
          { kind: 'groove', grooveId: 'g2', cymbal: 'hh', bars: 3, crash: true },
          { kind: 'fill', fillId: 'f2' },
        ],
        landing: true,
        noteHu: fillNoteHu,
        noteEn: fillNoteEn,
      },
      {
        id: 'l2e3',
        titleHu: 'Mindkét groove + 3. fill',
        titleEn: 'Both grooves + fill 3',
        parts: [
          { kind: 'groove', grooveId: 'g1', cymbal: 'hh', bars: 3, crash: true },
          { kind: 'fill', fillId: 'f3' },
          { kind: 'groove', grooveId: 'g2', cymbal: 'hh', bars: 3, crash: true },
          { kind: 'fill', fillId: 'f3' },
        ],
        landing: true,
        noteHu: fillNoteHu,
        noteEn: fillNoteEn,
      },
    ],
  },
  {
    id: 'lesson-3',
    number: 3,
    bpm: 90,
    grooveIds: ['g3', 'g4'],
    fillIds: [],
    songs: [
      { id: 'l3s1', grooveId: 'g3', title: 'Imagine', artist: 'John Lennon', spotifyUrl: '' },
      { id: 'l3s2', grooveId: 'g4', title: 'Another One Bites The Dust', artist: 'Queen', spotifyUrl: '' },
    ],
    exercises: [],
  },
];
