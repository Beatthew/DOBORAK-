import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

/** Null, amíg a .env.local (vagy a Netlify környezeti változók) nincs kitöltve. */
export const supabase: SupabaseClient | null = url && key ? createClient(url, key) : null;

export type Role = 'student' | 'teacher';
export type Kind = 'material' | 'song' | 'exercise' | 'library';

/** Egy diák (vagy a tanár). A tanár előre felveheti név + email alapján: amíg a diák nem regisztrál, user_id üres. */
export interface Profile {
  id: string;
  user_id: string | null;
  email: string;
  full_name: string;
  role: Role;
  created_at: string;
}

export interface LessonRow {
  id: string;
  student_id: string;
  date: string;
  title: string;
  notes: string;
  /** Az óra anyaga a kész órákból: az ottani óra száma, vagy null. */
  doborak: string | null;
  created_at: string;
}

export interface Material {
  id: string;
  student_id: string;
  lesson_id: string | null;
  kind: Kind;
  title: string;
  ref: string | null;
  file_path: string | null;
  file_name: string | null;
  link_url: string | null;
  note: string;
  /** A tananyagból kiválasztott tétel kottája (másolat, a diák nem látja a tananyag tábláit). */
  bars: { beats: string[]; hands?: string[] }[] | null;
  bpm: number | null;
  /** Hányadik az órán belül; null, ami még nem kapott helyet (az a végére kerül, felvétel szerint). */
  position?: number | null;
  created_at: string;
}

/** Egy óra anyagai a tanár által beállított sorrendben. */
export const inLessonOrder = (list: Material[]) =>
  [...list].sort(
    (a, b) => (a.position ?? Infinity) - (b.position ?? Infinity) || a.created_at.localeCompare(b.created_at),
  );

export const KIND_LABEL: Record<Kind, string> = { material: 'Órai anyag', song: 'Dal', exercise: 'Gyakorlat', library: 'Tananyag' };

/** Feltöltött fájl megnyitása: rövid ideig érvényes, aláírt link (a tárhely privát). */
export async function openFile(path: string) {
  if (!supabase) return;
  const win = window.open('', '_blank');
  const { data, error } = await supabase.storage.from('materials').createSignedUrl(path, 60 * 10);
  if (error || !data) {
    win?.close();
    alert('A fájlt nem sikerült megnyitni.');
    return;
  }
  if (win) win.location.href = data.signedUrl;
  else window.location.href = data.signedUrl;
}
