-- A diák azt a dalt is olvashatja (szerkezet + hangsávok), amit a tanár kiadott neki egy órában,
-- akkor is, ha a dal nincs közzétéve a Dalok listában. (Eddig a kiadott, de nem közzétett dal nem játszódott le.)

create or replace function public.song_visible(song_id text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from songs s where s.id = song_id and s.published)
      or exists (
        select 1 from materials m
        where m.kind = 'song' and m.ref = song_id and m.student_id = public.my_profile_id()
      );
$$;

revoke all on function public.song_visible(text) from public;
grant execute on function public.song_visible(text) to authenticated;

drop policy if exists "songs: diák a közzétettet olvassa" on public.songs;
create policy "songs: diák a közzétettet olvassa" on public.songs
  for select using (auth.uid() is not null and public.song_visible(id));

drop policy if exists "songs bucket: közzétett dal olvasható" on storage.objects;
create policy "songs bucket: közzétett dal olvasható" on storage.objects
  for select using (
    bucket_id = 'songs' and auth.uid() is not null and public.song_visible((storage.foldername(name))[1])
  );
