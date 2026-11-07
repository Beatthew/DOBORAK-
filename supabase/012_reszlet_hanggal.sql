-- BEATHUB, 12. lépés: egy dal groove-ja vagy fillje önálló tananyagként, a dalból kivágott hangjával.
-- A szerkesztő „Tananyagba” gombja a minta ütemeit kivágja a dal két sávjából, a „clips” tárhelyre tölti
-- (clips/<tétel id>/drums.wav, band.wav), és library_items sort ír clip leírással. Órához adva a clip a materials sorba másolódik.
-- clip: { "path": "<mappa a clips tárhelyen>", "song": "<dal id>", "from": 9, "to": 12, "duration": 8.64,
--         "score": [{ "beats": [...], "hands": [...] }, …] }   (score = a kivágott ütemek kottája)
-- Többször is futtatható.

alter table public.library_items add column if not exists clip jsonb;
alter table public.materials add column if not exists clip jsonb;

insert into storage.buckets (id, name, public) values ('clips', 'clips', false) on conflict (id) do nothing;
drop policy if exists "clips bucket: tanár mindent" on storage.objects;
create policy "clips bucket: tanár mindent" on storage.objects for all
  using (bucket_id = 'clips' and public.is_teacher()) with check (bucket_id = 'clips' and public.is_teacher());
-- egy pár ütemes gyakorló részlet: bármelyik belépett diák lejátszhatja, akinek órájába kerül
drop policy if exists "clips bucket: belépve olvasható" on storage.objects;
create policy "clips bucket: belépve olvasható" on storage.objects for select
  using (bucket_id = 'clips' and auth.uid() is not null);
