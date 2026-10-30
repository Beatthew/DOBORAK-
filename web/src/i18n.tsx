import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { Lang } from './types';

interface Counts {
  grooves: number;
  fills: number;
  exercises: number;
  songs: number;
}

const hu = {
  appName: 'BEATHUB',
  lessonN: (n: number) => `${n}. óra`,
  exercises: 'Gyakorlatok',
  hh: 'Lábcin',
  sn: 'Pergő',
  kk: 'Lábdob',
  ride: 'Ride',
  crash: 'Beütő',
  count: ['egy', 'gyet', 'ket', 'tőt', 'hár', 'mat', 'né', 'gyet'],
  bars: (n: number) => `${n} ütem`,
  playAlong: 'Játssz rá ezekre',
  play: 'Lejátszás',
  stop: 'Megállítás',
  playTwice: 'Lejátszás kétszer',
  openOnSpotify: 'Megnyitás Spotify-on',
  language: 'Nyelv',
  back: 'Vissza',
  noLessons: 'Még nincs feltöltött óra.',
  lessonMissing: 'Ez az óra nem található.',
  summary: (c: Counts) =>
    [c.grooves && `${c.grooves} groove`, c.fills && `${c.fills} fill`, c.exercises && `${c.exercises} gyakorlat`, c.songs && `${c.songs} dal`]
      .filter(Boolean)
      .join(' · '),
  fills: 'Fillek',
  t1: 'Kistam',
  t2: 'Középtam',
  ft: 'Álló tam',
  sticking: ['J', 'B', 'J', 'B', 'J', 'B', 'J', 'B'],
  stickingKey: 'J = jobb kéz · B = bal kéz',
  landingKey: 'Minden fill után az egyre: beütő + lábdob.',
  staffKey: 'Melyik vonal melyik dob',
  lessons: 'Órák',
};

type Dict = typeof hu;

const en: Dict = {
  appName: 'BEATHUB',
  lessonN: (n) => `Lesson ${n}`,
  exercises: 'Exercises',
  hh: 'Hi-hat',
  sn: 'Snare',
  kk: 'Kick',
  ride: 'Ride',
  crash: 'Crash',
  count: ['1', '&', '2', '&', '3', '&', '4', '&'],
  bars: (n) => `${n} ${n === 1 ? 'bar' : 'bars'}`,
  playAlong: 'Play along to these',
  play: 'Play',
  stop: 'Stop',
  playTwice: 'Play twice',
  openOnSpotify: 'Open on Spotify',
  language: 'Language',
  back: 'Back',
  noLessons: 'No lessons uploaded yet.',
  lessonMissing: 'This lesson does not exist.',
  summary: (c) =>
    [
      c.grooves && `${c.grooves} ${c.grooves === 1 ? 'groove' : 'grooves'}`,
      c.fills && `${c.fills} ${c.fills === 1 ? 'fill' : 'fills'}`,
      c.exercises && `${c.exercises} ${c.exercises === 1 ? 'exercise' : 'exercises'}`,
      c.songs && `${c.songs} ${c.songs === 1 ? 'song' : 'songs'}`,
    ]
      .filter(Boolean)
      .join(' · '),
  fills: 'Fills',
  t1: 'High tom',
  t2: 'Mid tom',
  ft: 'Floor tom',
  sticking: ['R', 'L', 'R', 'L', 'R', 'L', 'R', 'L'],
  stickingKey: 'R = right hand · L = left hand',
  landingKey: 'After every fill, on beat one: crash + kick.',
  staffKey: 'Which line is which drum',
  lessons: 'Lessons',
};

const dicts: Record<Lang, Dict> = { hu, en };

/** Az adatként tárolt magyar szövegek angolul (anyagtípus, kategória, tananyag, dalrészek): így a már mentett anyag is vált.
 *  A tanár által szabadon beírt szöveg, ami nincs itt, úgy marad, ahogy írta. */
const EN_TEXT: Record<string, string> = {
  'A mentéshez egyszer le kell futtatni a supabase/004_tananyag.sql fájlt a Supabase SQL Editorban.': 'To save, run supabase/004_tananyag.sql once in the Supabase SQL Editor.',
  'Órai anyag': 'Lesson material',
  Dal: 'Song',
  Gyakorlat: 'Exercise',
  Tananyag: 'Library',
  'Hangszerismeret / Gear': 'Instrument basics / Gear',
  Rudimentek: 'Rudiments',
  'Groove-ok': 'Grooves',
  Dalok: 'Songs',
  Fillek: 'Fills',
  Stílusgyakorlatok: 'Style exercises',
  Technika: 'Technique',
  Transzkripciók: 'Transcriptions',
  Ritmusgyakorlatok: 'Rhythm exercises',
  Negyedes: 'Quarter',
  Nyolcados: 'Eighth',
  Tizenhatodos: 'Sixteenth',
  Triolás: 'Triplet',
  'Az első két groove összevonva': 'The first two grooves combined',
  'Az első két groove összevonva: az eleje Groove 1, a vége Groove 2.': 'The first two grooves combined: it starts like Groove 1 and ends like Groove 2.',
  'Four on the floor – lábdob minden negyedre.': 'Four on the floor – kick on every beat.',
  'Csak pergőn': 'Snare only',
  'Le a tamokra': 'Down the toms',
  'Körbe a dobon': 'Around the kit',
  'Váltott kéz': 'Alternating hands',
  'Kétszer jobb, kétszer bal': 'Two rights, two lefts',
  'A Money Beat felépítése': 'Building the Money Beat',
  'Első groove 1. lépés: hihat': 'First groove, step 1: hi-hat',
  'Első groove 2. lépés: hihat + pergő': 'First groove, step 2: hi-hat + snare',
  'Első groove 3. lépés: hihat + lábdob': 'First groove, step 3: hi-hat + kick',
  'Pergő a 2-re és a 4-re': 'Snare on 2 and 4',
  'Lábdob az 1-re és a 3-ra': 'Kick on 1 and 3',
  'Nyitott HH': 'Open HH',
  Hihat: 'Hi-hat',
  Tam: 'Tom',
  Pergő: 'Snare',
  'Álló tam': 'Floor tom',
  Lábdob: 'Kick',
  negyed: 'quarter',
  '8-ad': '8th',
  triola: 'triplet',
  '16-od': '16th',
  szextola: 'sextuplet',
  Befejezés: 'Ending',
  'Befejezés 2': 'Ending 2',
  Vége: 'End',
  'Crash ütés': 'Crash hit',
  'Fő groove': 'Main groove',
  beszállás: 'entry',
  Beszállás: 'Entry',
  'crash az 1-re': 'crash on 1',
  'crash-sel': 'with crash',
  'pergő átvezetés': 'snare transition',
  átvezetés: 'transition',
  'Pergő 16-od': 'Snare 16ths',
  'Lezárás / átvezetés': 'Closing / transition',
  'Bridge · negyedes': 'Bridge · quarters',
  'Chorus · pontozott': 'Chorus · dotted',
  'Gitárszóló (?)': 'Guitar solo (?)',
  'Verse vége 2': 'Verse ending 2',
  felutemes: 'half-bar',
  félütemes: 'half-bar',
  'Chorus 3 (2. oldal?)': 'Chorus 3 (page 2?)',
  'Verse 3 (2. oldal?)': 'Verse 3 (page 2?)',
};
const LANG_KEY = 'beathub.lang';

interface I18n {
  lang: Lang;
  setLang: (lang: Lang) => void;
  t: Dict;
  /** Picks the text for the current language, falling back to the other one when empty. */
  pick: (huText: string, enText: string) => string;
  /** Egy adatként tárolt magyar szöveg az aktuális nyelven (lásd EN_TEXT; a "3. óra" alakú címek is). */
  text: (huText: string) => string;
  /** A dátumok formátumához. */
  locale: string;
}

const I18nContext = createContext<I18n | null>(null);

function initialLang(): Lang {
  try {
    const saved = localStorage.getItem(LANG_KEY);
    if (saved === 'hu' || saved === 'en') return saved;
  } catch {
    // default below
  }
  return 'hu';
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(initialLang);

  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

  const value = useMemo<I18n>(
    () => ({
      lang,
      setLang: (next) => {
        setLangState(next);
        try {
          localStorage.setItem(LANG_KEY, next);
        } catch {
          // preference just won't persist
        }
      },
      t: dicts[lang],
      pick: (huText, enText) => (lang === 'en' ? enText || huText : huText || enText),
      text: (huText) => {
        if (lang !== 'en') return huText;
        const lesson = /^(\d+)\. óra$/.exec(huText);
        return lesson ? `Lesson ${lesson[1]}` : EN_TEXT[huText] ?? huText;
      },
      locale: lang === 'en' ? 'en-GB' : 'hu-HU',
    }),
    [lang],
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18n {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error('useI18n must be used inside I18nProvider');
  return ctx;
}
