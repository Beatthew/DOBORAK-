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
const LANG_KEY = 'beathub.lang';

interface I18n {
  lang: Lang;
  setLang: (lang: Lang) => void;
  t: Dict;
  /** Picks the text for the current language, falling back to the other one when empty. */
  pick: (huText: string, enText: string) => string;
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
