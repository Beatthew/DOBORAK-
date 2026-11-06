import { lessons } from './lessons';

/** A dal gyakorló oldala az appon belül. */
export const songPath = (id: string) => `/dal/${encodeURIComponent(id)}`;

/** A kész órák mint technikai gyakorlatok: a hivatkozás az óra száma. */
export const exerciseList = [...lessons]
  .sort((a, b) => a.number - b.number)
  .map((l) => ({ ref: String(l.number), title: `${l.number}. óra`, bpm: l.bpm }));
export const findExercise = (ref: string | null) => exerciseList.find((e) => e.ref === ref);
