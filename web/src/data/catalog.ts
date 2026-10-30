import { SONGS } from '../songs';
import { lessons } from './lessons';

/** A BEATHUBba behúzott dalok (scripts/import-song.mjs) — nem azonos a Song Practice teljes listájával. */
export const songList = SONGS.map((s) => ({ id: s.id, title: s.title, artist: s.artist, bpm: s.bpm }));
export const findSong = (id: string | null) => songList.find((s) => s.id === id);
/** A dal gyakorló oldala az appon belül. */
export const songPath = (id: string) => `/dal/${encodeURIComponent(id)}`;

/** A kész órák mint technikai gyakorlatok: a hivatkozás az óra száma. */
export const exerciseList = [...lessons]
  .sort((a, b) => a.number - b.number)
  .map((l) => ({ ref: String(l.number), title: `${l.number}. óra`, bpm: l.bpm }));
export const findExercise = (ref: string | null) => exerciseList.find((e) => e.ref === ref);
