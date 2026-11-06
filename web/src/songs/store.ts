import { useEffect, useSyncExternalStore } from 'react';
import { supabase } from '../lib/supabase';
import { elements, toSongData, type Structure } from './structure';
import type { SongData } from './types';

/* A dalok a Supabase-ben (songs tábla + „songs” tárhely; supabase/011_dalok.sql). A tanár mindet látja,
   a diák csak a közzétetteket (ezt az adatbázis szabja meg). Egy közös, frissülő lista az egész appnak. */

export type SongStatus = 'queued' | 'downloading' | 'separating' | 'analyzing' | 'done' | 'error';

export interface SongRow {
  id: string;
  video_id: string | null;
  title: string;
  artist: string;
  status: SongStatus;
  progress: number;
  error: string | null;
  structure: Structure | null;
  published: boolean;
  folder: string | null;
  created_at: string;
  updated_at: string;
}

let rows: SongRow[] | null = null;
let loading: Promise<void> | null = null;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((f) => f());

export function reloadSongs() {
  if (!supabase) {
    rows = [];
    emit();
    return Promise.resolve();
  }
  loading = (async () => {
    const { data } = await supabase.from('songs').select('*').order('created_at', { ascending: false });
    rows = (data as SongRow[]) ?? [];
    emit();
  })();
  return loading;
}

/** egy sor helyben frissítve (szerkesztés, élő állapot), a lista újratöltése nélkül */
export function patchSong(row: Partial<SongRow> & { id: string }) {
  if (!rows) return;
  const i = rows.findIndex((r) => r.id === row.id);
  rows = i < 0 ? [row as SongRow, ...rows] : rows.map((r, k) => (k === i ? { ...r, ...row } : r));
  emit();
}
export function dropSong(id: string) {
  if (!rows) return;
  rows = rows.filter((r) => r.id !== id);
  emit();
}

const subscribe = (f: () => void) => {
  listeners.add(f);
  return () => listeners.delete(f);
};

/** az összes látható dal (null, amíg töltődik) */
export function useSongs(): SongRow[] | null {
  const list = useSyncExternalStore(subscribe, () => rows);
  useEffect(() => {
    if (!rows && !loading) void reloadSongs();
  }, []);
  return list;
}

/** a kész, lejátszható dalok */
export const playable = (list: SongRow[] | null) => (list ?? []).filter((s) => s.status === 'done' && s.structure);

export const findSong = (list: SongRow[] | null, id: string | null | undefined) => (list ?? []).find((s) => s.id === id);

/** a dal kártyáján: előadó, BPM, groove és fill szám */
export function songSummary(s: SongRow) {
  const els = s.structure ? elements(s.structure, s.structure.patterns ?? {}) : [];
  return [
    s.artist,
    s.structure ? `${s.structure.bpm} BPM` : '',
    s.structure ? `${els.filter((e) => e.type === 'groove').length} groove` : '',
    s.structure ? `${els.filter((e) => e.type === 'fill').length} fill` : '',
  ].filter(Boolean).join(' · ');
}

export const coverUrl = (s: Pick<SongRow, 'video_id'>) => (s.video_id ? `https://i.ytimg.com/vi/${s.video_id}/mqdefault.jpg` : null);

/** a lejátszó dala: a szerkezet + a két sáv rövid ideig érvényes linkje */
export async function loadSongData(row: SongRow): Promise<SongData> {
  if (!supabase || !row.structure) throw new Error('A dal még nincs kész.');
  const { data, error } = await supabase.storage.from('songs').createSignedUrls([`${row.id}/drums.mp3`, `${row.id}/band.mp3`], 60 * 60 * 6);
  if (error || !data || data.some((d) => !d.signedUrl)) throw new Error('A hangsávok nem érhetők el.');
  return toSongData(row, row.structure, { Drums: data[0].signedUrl!, Band: data[1].signedUrl! });
}
