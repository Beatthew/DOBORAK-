-- BEATHUB, 11. lépés: a dalok a Supabase-ben (a Song Practice beköltözött a Tananyag → Dalok oldalra).
-- A tanár linket ad be (status 'queued'); a gépen futó feldolgozó (worker/beathub_worker.py) felveszi,
-- letölti, szétválasztja (dob + band), elemzi, a két sávot a „songs” tárhelyre tölti, a szerkezetet a structure-be írja.
-- A szerkezet pontosan a Song Practice structure.json-ja: bpm, offset, tempo_map, downbeats, bars, sections (+ bars), patterns.
-- Többször is futtatható.

create table if not exists public.songs (
  id text primary key,                     -- a dal azonosítója (pl. 'skyfall'); az órák anyagai erre hivatkoznak
  video_id text,                           -- YouTube azonosító (11 karakter); kézzel készült dalnál üres
  title text not null default '',
  artist text not null default '',
  status text not null default 'queued'
    check (status in ('queued', 'downloading', 'separating', 'analyzing', 'done', 'error')),
  progress integer not null default 0,
  error text,
  structure jsonb,
  published boolean not null default false, -- látják-e a diákok
  folder text,                             -- a Dalok oldal mappája (pl. 'Dorka'); üres = a fő listában
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists songs_video on public.songs (video_id) where video_id is not null;

create or replace function public.touch_updated_at() returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;
drop trigger if exists songs_touch on public.songs;
create trigger songs_touch before update on public.songs for each row execute function public.touch_updated_at();

-- a feldolgozó életjele: a Dalok oldal szól, ha a gépen nem fut
create table if not exists public.worker_status (
  id integer primary key default 1 check (id = 1),
  last_seen timestamptz not null default now(),
  device text not null default ''
);

alter table public.songs enable row level security;
alter table public.worker_status enable row level security;

drop policy if exists "songs: tanár" on public.songs;
create policy "songs: tanár" on public.songs for all using (public.is_teacher()) with check (public.is_teacher());
drop policy if exists "songs: diák a közzétettet olvassa" on public.songs;
create policy "songs: diák a közzétettet olvassa" on public.songs for select using (published and auth.uid() is not null);
drop policy if exists "worker_status: tanár olvas" on public.worker_status;
create policy "worker_status: tanár olvas" on public.worker_status for select using (public.is_teacher());

-- a sávok: songs/<dal id>/drums.mp3 és band.mp3
insert into storage.buckets (id, name, public) values ('songs', 'songs', false) on conflict (id) do nothing;
drop policy if exists "songs bucket: tanár mindent" on storage.objects;
create policy "songs bucket: tanár mindent" on storage.objects for all
  using (bucket_id = 'songs' and public.is_teacher()) with check (bucket_id = 'songs' and public.is_teacher());
drop policy if exists "songs bucket: közzétett dal olvasható" on storage.objects;
create policy "songs bucket: közzétett dal olvasható" on storage.objects for select
  using (bucket_id = 'songs' and auth.uid() is not null
         and exists (select 1 from public.songs s where s.id = (storage.foldername(name))[1] and s.published));

-- a Dalok oldal élőben látja a feldolgozás állapotát
do $$ begin
  alter publication supabase_realtime add table public.songs;
exception when duplicate_object then null;
end $$;
