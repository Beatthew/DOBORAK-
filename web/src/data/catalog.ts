import { lessons } from './lessons';
import songs from './songs.json';

/** A Song Practice dalai (npm run sync-songs frissíti). */
export const songList: { id: string; title: string; artist: string }[] = songs;
export const findSong = (id: string | null) => songList.find((s) => s.id === id);
/** A dal megnyitása a beépített Song Practice-ben. */
export const songHref = (id: string) => `./dalok/#${encodeURIComponent(id)}`;

/** A dobórák órái mint technikai gyakorlatok: a hivatkozás az óra száma. */
export const exerciseList = [...lessons]
  .sort((a, b) => a.number - b.number)
  .map((l) => ({ ref: String(l.number), title: `${l.number}. dobóra`, bpm: l.bpm }));
export const findExercise = (ref: string | null) => exerciseList.find((e) => e.ref === ref);
