// Automatikusan generált (scripts/import-song.mjs) — a BEATHUBba behúzott dalok.
import type { SongData } from './types';
import s_another_one_bites_the_dust from './data/another-one-bites-the-dust';
import s_come_together from './data/come-together';
import s_i_ll_hit_you_back from './data/i-ll-hit-you-back';
import s_skyfall from './data/skyfall';
import s_snow from './data/snow';

export const SONGS: SongData[] = [s_another_one_bites_the_dust, s_come_together, s_i_ll_hit_you_back, s_skyfall, s_snow];
export const findSongData = (id: string | null | undefined) => SONGS.find((s) => s.id === id);
